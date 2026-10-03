// 视频列表的数据在 videos.json（可在 /admin 后台编辑），这里只做类型包装。
import data from './videos.json';

export interface Video {
  title: string;
  /** 视频页面链接（哔哩哔哩 / YouTube 等） */
  url: string;
  /** 封面图 URL，可选；为空时显示占位 */
  cover?: string;
  date?: string;
}

/** 数组为空时，首页“视频”区块整个不显示。 */
export const videos: Video[] = (data.items ?? []) as Video[];
