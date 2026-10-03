#!/usr/bin/env node
// 把一篇飞书云文档导入为 src/content/posts/<slug>/index.md（含图片）。
// 纯规则转换，不依赖 AI。读取依赖本机 lark-cli 的登录态（或 --as bot 的应用身份）。
//
// 用法：
//   node scripts/import-feishu.mjs <飞书链接或 token> [--slug my-post] [--tags a,b]
//        [--date 2026-10-01] [--description "..."] [--draft] [--as user|bot] [--dry-run]
//
// 同一篇文档（docToken 相同）再次导入时会覆盖原文章并保留 slug、date、tags、description。

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_DIR = path.join(ROOT, "src/content/posts");
const LARK_ENV = { ...process.env, LARKSUITE_CLI_NO_UPDATE_NOTIFIER: "1", LARKSUITE_CLI_NO_SKILLS_NOTIFIER: "1" };

// ---------------------------------------------------------------- 参数

function parseArgs(argv) {
  const opts = { as: "user", dryRun: false, draft: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) fail(`${a} 缺少参数值`);
      return argv[++i];
    };
    if (a === "--slug") opts.slug = next();
    else if (a === "--tags") opts.tags = next().split(/[,，]/).map((t) => t.trim()).filter(Boolean);
    else if (a === "--date") opts.date = next();
    else if (a === "--description") opts.description = next();
    else if (a === "--as") opts.as = next();
    else if (a === "--draft") opts.draft = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "-h" || a === "--help") usage(0);
    else if (a.startsWith("--")) fail(`未知参数 ${a}`);
    else rest.push(a);
  }
  if (rest.length !== 1) usage(1);
  opts.doc = rest[0];
  if (opts.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(opts.slug)) fail("--slug 只能包含小写字母、数字和连字符");
  if (opts.date && !/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) fail("--date 格式应为 YYYY-MM-DD");
  return opts;
}

function usage(code) {
  console.log("用法: node scripts/import-feishu.mjs <飞书链接或 token> [--slug s] [--tags a,b] [--date YYYY-MM-DD] [--description d] [--draft] [--as user|bot] [--dry-run]");
  process.exit(code);
}

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

function docTokenOf(input) {
  const m = input.match(/\/(?:docx|wiki)\/([A-Za-z0-9]+)/);
  if (m) return m[1];
  if (/^[A-Za-z0-9]+$/.test(input)) return input;
  fail(`无法从 ${input} 中识别文档 token`);
}

// ---------------------------------------------------------------- lark-cli

function lark(args, cwd) {
  try {
    return execFileSync("lark-cli", args, { cwd, env: LARK_ENV, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    const out = `${e.stdout || ""}${e.stderr || ""}`.trim();
    fail(`lark-cli ${args.slice(0, 2).join(" ")} 失败：\n${out || e.message}`);
  }
}

function fetchDocument(doc, as) {
  const raw = lark(["docs", "+fetch", "--doc", doc, "--as", as, "--format", "json"]);
  let json;
  try {
    json = JSON.parse(raw.slice(raw.indexOf("{")));
  } catch {
    fail(`无法解析 lark-cli 输出：\n${raw.slice(0, 500)}`);
  }
  const content = json?.data?.document?.content;
  if (!json.ok || typeof content !== "string") fail(`读取文档失败：\n${raw.slice(0, 800)}`);
  return content;
}

function downloadImage(token, dir, as) {
  const existing = fs.readdirSync(dir).find((f) => path.parse(f).name === token);
  if (existing) return existing;
  // lark-cli 在目标目录下用相对路径更稳定，扩展名由它自动识别
  lark(["docs", "+media-download", "--token", token, "--output", token, "--as", as], dir);
  const saved = fs.readdirSync(dir).find((f) => path.parse(f).name === token);
  if (!saved) fail(`图片 ${token} 下载后未找到文件`);
  return saved;
}

// ---------------------------------------------------------------- 解析飞书 XML

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" };

function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function parseXml(src) {
  const root = { tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[\w:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>|([^<]+)|</g;
  let m;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1];
    if (m[0].startsWith("<!--")) continue;
    if (m[1]) {
      const i = stack.map((n) => n.tag).lastIndexOf(m[1]);
      if (i > 0) stack.length = i;
      continue;
    }
    if (m[2]) {
      const attrs = {};
      for (const a of m[3].matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g)) attrs[a[1]] = decode(a[2] ?? a[3] ?? "");
      const node = { tag: m[2].toLowerCase(), attrs, children: [] };
      top.children.push(node);
      if (!m[4] && !VOID.has(node.tag)) stack.push(node);
      continue;
    }
    top.children.push({ tag: "#text", text: decode(m[5] ?? m[0]) });
  }
  return root;
}

const VOID = new Set(["br", "img", "col", "hr"]);

// ---------------------------------------------------------------- 转 Markdown

const BLOCK = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "ul", "ol", "pre", "table", "img", "grid", "hr", "callout", "title"]);

function textOf(node) {
  if (node.tag === "#text") return node.text;
  if (node.tag === "br") return "\n";
  return (node.children || []).map(textOf).join("");
}

function escapeText(s) {
  return s.replace(/([\\`*_[\]])/g, "\\$1").replace(/<(?=[A-Za-z/!?])/g, "\\<").replace(/~~/g, "\\~\\~");
}

// 行首可能被误认为语法的字符
function escapeLineStart(line) {
  return line
    .replace(/^(\s*)([#>+-])(?=\s|$)/, "$1\\$2")
    .replace(/^(\s*)(\d+)([.)])(?=\s|$)/, "$1$2\\$3")
    .replace(/^(\s*)(=+|-{3,})\s*$/, "$1\\$2");
}

// 裸链接写成 <url>，避免 GFM 把紧跟的中文（如“（说明）”）也算进链接
function linkify(text) {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(/https?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'*+,;=%]+/g)) {
    const url = m[0].replace(/[.,;:!?'\]]+$/, "");
    out += escapeText(text.slice(last, m.index)) + `<${url}>`;
    last = m.index + url.length;
  }
  return out + escapeText(text.slice(last));
}

const PUNCT = /[\p{P}\p{S}]/u;
const SPACE = /\s/u;

// CommonMark 的 ** 在“中文标点 + 中文字符”相邻时无法闭合，这类情况改用 HTML 标签
function wrap(inner, md, html, prev, next) {
  if (!inner.trim()) return inner;
  const first = inner[0];
  const last = inner[inner.length - 1];
  const opens = !SPACE.test(first) && (!PUNCT.test(first) || !prev || SPACE.test(prev) || PUNCT.test(prev));
  const closes = !SPACE.test(last) && (!PUNCT.test(last) || !next || SPACE.test(next) || PUNCT.test(next));
  return opens && closes ? `${md}${inner}${md}` : `<${html}>${inner}</${html}>`;
}

function inline(nodes, ctx) {
  let out = "";
  nodes.forEach((node, i) => {
    const prev = out.slice(-1);
    const next = nodes[i + 1] ? textOf(nodes[i + 1])[0] : "";
    switch (node.tag) {
      case "#text":
        out += ctx.inLink ? escapeText(node.text) : linkify(node.text);
        break;
      case "br":
        out += ctx.inTable ? "<br>" : "\\\n";
        break;
      case "b":
      case "strong":
        out += wrap(inline(node.children, ctx), "**", "strong", prev, next);
        break;
      case "i":
      case "em":
        out += wrap(inline(node.children, ctx), "*", "em", prev, next);
        break;
      case "s":
      case "del":
        out += wrap(inline(node.children, ctx), "~~", "del", prev, next);
        break;
      case "u":
        out += `<u>${inline(node.children, ctx)}</u>`;
        break;
      case "code": {
        const t = textOf(node);
        const ticks = "`".repeat((t.match(/`+/g) || []).reduce((n, s) => Math.max(n, s.length), 0) + 1);
        out += /^`|`$/.test(t) ? `${ticks} ${t} ${ticks}` : `${ticks}${t}${ticks}`;
        break;
      }
      case "a": {
        const href = (node.attrs.href || "").trim();
        const label = inline(node.children, { ...ctx, inLink: true }) || escapeText(href);
        out += href ? `[${label}](${href.replace(/[()\s]/g, encodeURIComponent)})` : label;
        break;
      }
      case "span":
        out += inline(node.children, ctx);
        break;
      default:
        if (BLOCK.has(node.tag)) {
          out += textOf(node);
          ctx.warn(`段落内出现块级元素 <${node.tag}>，已按纯文本处理`);
        } else {
          ctx.warn(`未识别的行内元素 <${node.tag}>，已保留文字`);
          out += inline(node.children || [], ctx);
        }
    }
  });
  return out;
}

function paragraph(md) {
  return md
    .split("\n")
    .map((l) => escapeLineStart(l))
    .join("\n")
    .trim();
}

// 飞书里的空段落是作者手动排的间隔，保留为一行高的空白；首尾的空段落去掉
const GAP = '<div class="fs-gap"></div>';

function blocks(nodes, ctx) {
  const out = [];
  // 飞书有序列表：带 seq 的项从该数字重新开始；“自动编号”的项接着同一容器里上一个有序列表往下数，
  // 即使中间隔着段落。遇到标题时重新从 1 开始（经验规则）。
  let olNext = 1;
  for (const node of nodes) {
    if (/^h\d$/.test(node.tag)) olNext = 1;
    let md;
    if (node.tag === "p" && !textOf(node).trim() && !node.children.some((c) => c.tag === "img")) md = GAP;
    else if (node.tag === "ol") {
      md = list(node, ctx, 0, olNext);
      olNext = ctx.lastOl + 1;
    } else md = block(node, ctx);
    if (md != null && md !== "") out.push(md);
  }
  while (out[0] === GAP) out.shift();
  while (out[out.length - 1] === GAP) out.pop();
  return out.join("\n\n");
}

function block(node, ctx) {
  switch (node.tag) {
    case "#text":
      return node.text.trim() ? paragraph(escapeText(node.text)) : null;
    case "title":
      return null;
    case "p":
      return paragraph(inline(node.children, ctx)) || null;
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const level = Math.min(6, Number(node.tag[1]) + 1); // # 留给页面标题
      const text = inline(node.children, ctx).replace(/\\\n/g, " ").trim();
      return text ? `${"#".repeat(level)} ${text}` : null;
    }
    case "blockquote": {
      // 飞书引用块里的连续段落在视觉上是紧挨的几行，用硬换行保持这一点
      const allParas = node.children.every((c) => c.tag === "p" || (c.tag === "#text" && !c.text.trim()));
      const inner = allParas
        ? node.children.filter((c) => c.tag === "p").map((p) => paragraph(inline(p.children, ctx))).filter(Boolean).join("\\\n")
        : blocks(node.children, ctx);
      return inner ? inner.split("\n").map((l) => (l ? `> ${l}` : ">")).join("\n") : null;
    }
    case "callout": {
      const inner = blocks(node.children, ctx);
      return `<aside class="callout" data-kind="info">\n\n${inner}\n\n</aside>`;
    }
    case "ul":
    case "ol":
      return list(node, ctx);
    case "pre": {
      const code = textOf(node).replace(/\n$/, "");
      const fence = "`".repeat(Math.max(3, ...(code.match(/`{3,}/g) || []).map((s) => s.length + 1)));
      const lang = (node.attrs.lang || "").toLowerCase().replace(/[^a-z0-9+#-]/g, "");
      return `${fence}${lang === "plaintext" ? "text" : lang}\n${code}\n${fence}`;
    }
    case "table":
      return table(node, ctx);
    case "img":
      return image(node, ctx);
    case "grid": {
      const cols = node.children.filter((c) => c.tag === "column");
      const parts = cols.map((c) => {
        const ratio = Number(c.attrs["width-ratio"]);
        const style = Number.isFinite(ratio) && ratio > 0 ? ` style="--fs-ratio: ${ratio.toFixed(2)}"` : "";
        return `<div class="fs-col"${style}>\n\n${blocks(c.children, ctx)}\n\n</div>`;
      });
      return `<div class="fs-grid">\n${parts.join("\n")}\n</div>`;
    }
    case "hr":
      return "---";
    default:
      ctx.warn(`未识别的块 <${node.tag}>，已保留其中的文字`);
      return node.children?.length ? blocks(node.children, ctx) : null;
  }
}

function list(node, ctx, depth = 0, start = 1) {
  const ordered = node.tag === "ol";
  const items = node.children.filter((c) => c.tag === "li");
  let n = start;
  const lines = items.map((li) => {
    // 注意：lark-cli 给出的 seq-marker 不考虑跨段落续号，不能用；只认显式的 seq
    const seq = parseInt(li.attrs.seq, 10);
    if (ordered && Number.isFinite(seq)) n = seq;
    const marker = ordered ? `${n}. ` : "- ";
    if (ordered) ctx.lastOl = n;
    n += 1;
    const pad = " ".repeat(marker.length);
    const inlineNodes = li.children.filter((c) => !BLOCK.has(c.tag) || c.tag === "img");
    const nested = li.children.filter((c) => c.tag === "ul" || c.tag === "ol");
    const paras = li.children.filter((c) => c.tag === "p");
    let body = paragraph(inline(inlineNodes.filter((c) => c.tag !== "img"), ctx));
    for (const p of paras) body += (body ? "\n\n" : "") + paragraph(inline(p.children, ctx));
    let text = `${marker}${body.split("\n").join(`\n${pad}`)}`;
    for (const sub of nested) text += `\n${list(sub, ctx, depth + 1).split("\n").map((l) => pad + l).join("\n")}`;
    return text;
  });
  return lines.join("\n");
}

function table(node, ctx) {
  const rows = [];
  const walk = (n) => n.children.forEach((c) => (c.tag === "tr" ? rows.push(c) : c.children && c.tag !== "td" && c.tag !== "th" && walk(c)));
  walk(node);
  if (!rows.length) return null;
  const cell = (c) =>
    c.children
      .map((p) => (p.tag === "p" ? inline(p.children, { ...ctx, inTable: true }) : inline([p], { ...ctx, inTable: true })))
      .filter(Boolean)
      .join("<br>")
      .replace(/\|/g, "\\|")
      .replace(/\n/g, " ")
      .trim();
  const grid = rows.map((r) => r.children.filter((c) => c.tag === "td" || c.tag === "th"));
  if (grid.some((r) => r.some((c) => c.attrs.rowspan > 1 || c.attrs.colspan > 1))) ctx.warn("表格含合并单元格，已展开为普通表格");
  const width = Math.max(...grid.map((r) => r.length));
  const line = (cells) => `| ${Array.from({ length: width }, (_, i) => (cells[i] ? cell(cells[i]) : "")).join(" | ")} |`;
  return [line(grid[0]), `| ${Array(width).fill("---").join(" | ")} |`, ...grid.slice(1).map(line)].join("\n");
}

function image(node, ctx) {
  const token = node.attrs.src || node.attrs.token;
  if (!token) {
    ctx.warn("图片缺少 token，已跳过");
    return null;
  }
  ctx.images.add(token);
  const alt = (node.attrs.alt || "").replace(/\s+/g, " ").replace(/([[\]\\])/g, "\\$1").trim();
  return `![${alt}](./images/${token}{{ext:${token}}})`;
}

// ---------------------------------------------------------------- frontmatter

function yamlStr(s) {
  return JSON.stringify(String(s));
}

function readFrontmatter(file) {
  const src = fs.readFileSync(file, "utf8");
  const m = src.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('"')) v = JSON.parse(v);
    else if (v.startsWith("[")) v = JSON.parse(v);
    fm[kv[1]] = v;
  }
  const token = m[1].match(/^\s+docToken:\s*"?([A-Za-z0-9]+)"?/m);
  if (token) fm.docToken = token[1];
  return fm;
}

function findExisting(docToken) {
  if (!fs.existsSync(POSTS_DIR)) return null;
  for (const slug of fs.readdirSync(POSTS_DIR)) {
    const file = path.join(POSTS_DIR, slug, "index.md");
    if (fs.existsSync(file) && readFrontmatter(file).docToken === docToken) {
      const body = fs.readFileSync(file, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "").trim();
      return { slug, fm: readFrontmatter(file), body };
    }
  }
  return null;
}

// 文首的“时间戳 2026.10.01”引用块作为发布日期，并从正文移除
function takeDate(root) {
  const body = root.children.filter((n) => !(n.tag === "#text" && !n.text.trim()));
  const idx = body.findIndex((n) => n.tag !== "title");
  const first = body[idx];
  if (!first || first.tag !== "blockquote") return null;
  const m = textOf(first).trim().match(/^(?:时间戳|日期|发布于|date)[:：\s]*(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})日?$/i);
  if (!m) return null;
  root.children.splice(root.children.indexOf(first), 1);
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

function autoDescription(root) {
  let text = "";
  for (const n of root.children) {
    if (n.tag !== "p") {
      if (text && /^h\d$/.test(n.tag)) break;
      continue;
    }
    const t = textOf(n).replace(/\s+/g, " ").trim();
    if (!t) continue;
    text += t;
    if (text.length >= 60) break;
  }
  return text.length > 140 ? `${text.slice(0, 138)}…` : text;
}

// ---------------------------------------------------------------- 主流程

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const docToken = docTokenOf(opts.doc);
  const existing = findExisting(docToken);
  const slug = opts.slug || existing?.slug || docToken.toLowerCase();
  if (existing && opts.slug && opts.slug !== existing.slug) fail(`这篇文档已导入为 ${existing.slug}，如需改 slug 请先手动重命名该目录`);

  console.log(`→ 读取飞书文档 ${docToken}（身份：${opts.as}）`);
  const xml = fetchDocument(opts.doc, opts.as);
  const root = parseXml(xml);
  const titleNode = root.children.find((n) => n.tag === "title");
  const title = titleNode ? textOf(titleNode).trim() : "";
  if (!title) fail("文档没有标题");

  const docDate = takeDate(root);
  const warnings = [];
  const ctx = { images: new Set(), warn: (w) => warnings.push(w) };
  let body = blocks(root.children, ctx);

  // 正文有变化时记录更新日期（本机时区的今天）；没变化则沿用原值
  const today = new Date().toLocaleDateString("sv-SE");
  // 比较时忽略图片扩展名（新正文此时还是 {{ext:token}} 占位）
  const norm = (md) => md.replace(/\{\{ext:[^}]+\}\}/g, "").replace(/(\.\/images\/[A-Za-z0-9]+)\.[A-Za-z0-9]+/g, "$1").trim();
  const bodyChanged = Boolean(existing) && norm(existing.body) !== norm(body) && !opts.dryRun;
  const fm = {
    title,
    date: opts.date || existing?.fm.date || docDate || today,
    updated: bodyChanged ? today : existing?.fm.updated,
    description: opts.description || existing?.fm.description || autoDescription(root),
    tags: opts.tags || existing?.fm.tags || [],
    lang: "zh",
    draft: opts.draft,
  };
  const dir = path.join(POSTS_DIR, slug);
  const imgDir = path.join(dir, "images");

  if (opts.dryRun) {
    console.log(`(dry-run) 将写入 ${path.relative(ROOT, dir)}/index.md，图片 ${ctx.images.size} 张`);
  } else {
    fs.mkdirSync(imgDir, { recursive: true });
    let i = 0;
    for (const token of ctx.images) {
      process.stdout.write(`\r→ 下载图片 ${++i}/${ctx.images.size}`);
      const file = downloadImage(token, imgDir, opts.as);
      body = body.replaceAll(`{{ext:${token}}}`, path.extname(file));
    }
    if (ctx.images.size) process.stdout.write("\n");
    // 清理文档里已删除的旧图片
    for (const f of fs.readdirSync(imgDir)) if (!ctx.images.has(path.parse(f).name)) fs.rmSync(path.join(imgDir, f));
    if (!fs.readdirSync(imgDir).length) fs.rmdirSync(imgDir);
  }

  const front = [
    "---",
    `title: ${yamlStr(fm.title)}`,
    `date: ${fm.date}`,
    ...(fm.updated ? [`updated: ${fm.updated}`] : []),
    `description: ${yamlStr(fm.description)}`,
    `tags: ${JSON.stringify(fm.tags)}`,
    `lang: ${fm.lang}`,
    `draft: ${fm.draft}`,
    "source:",
    "  type: feishu",
    `  url: ${yamlStr(opts.doc.startsWith("http") ? opts.doc.split("?")[0] : `https://feishu.cn/docx/${docToken}`)}`,
    `  docToken: ${yamlStr(docToken)}`,
    `  importedAt: ${yamlStr(new Date().toISOString())}`,
    "---",
    "",
  ].join("\n");
  const output = `${front}\n${body}\n`;

  if (opts.dryRun) process.stdout.write(output);
  else fs.writeFileSync(path.join(dir, "index.md"), output);

  console.log(`✔ ${existing ? "已更新" : "已导入"}：${fm.title} → src/content/posts/${slug}/index.md`);
  console.log(`  日期 ${fm.date}${fm.updated ? `，更新于 ${fm.updated}` : ""}，图片 ${ctx.images.size} 张${fm.draft ? "，草稿" : ""}`);
  if (existing && !bodyChanged && !opts.dryRun) console.log("  正文与上次导入相同");
  for (const w of new Set(warnings)) console.log(`  ⚠ ${w}`);
}

main();
