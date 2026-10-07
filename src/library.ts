/** R2 里的曲库缓存：music/ 存音频，covers/ 存封面，meta/library.json 是解析结果缓存。 */

export interface Track {
  key: string; // R2 对象键，如 music/Beyond/-BEYOND - 海阔天空.flac
  title: string;
  artist: string | null;
  album: string | null;
  trackNo: number | null;
  duration: number | null; // 秒
  cover: string | null; // covers/ 下的文件名，如 ab12....jpg
  size: number;
  format: string; // 小写扩展名
  etag: string; // 对象 ETag，内容变了会自动重新解析
}

export interface Library {
  v: number;
  tracks: Record<string, Track>;
}

export const TRACK_PREFIX = "music/";
const META_KEY = "meta/library.json";

export function newLibrary(): Library {
  return { v: 1, tracks: {} };
}

export async function loadLibrary(bucket: R2Bucket): Promise<Library> {
  try {
    const obj = await bucket.get(META_KEY);
    if (obj) {
      const data = await obj.json<Library>();
      if (data && data.tracks && typeof data.tracks === "object") return data;
    }
  } catch {
    /* 缓存坏了就重建 */
  }
  return newLibrary();
}

export function saveLibrary(bucket: R2Bucket, lib: Library): Promise<R2Object> {
  return bucket.put(META_KEY, JSON.stringify(lib), { httpMetadata: { contentType: "application/json" } });
}

export interface ObjectEntry {
  key: string;
  size: number;
  etag: string;
}

export async function listTrackEntries(bucket: R2Bucket): Promise<ObjectEntry[]> {
  const entries: ObjectEntry[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: TRACK_PREFIX, limit: 1000, cursor });
    for (const o of page.objects) entries.push({ key: o.key, size: o.size, etag: o.httpEtag });
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return entries;
}

export async function upsertLibraryEntry(bucket: R2Bucket, track: Track): Promise<void> {
  const lib = await loadLibrary(bucket);
  lib.tracks[track.key] = track;
  await saveLibrary(bucket, lib);
}

export async function removeLibraryEntry(bucket: R2Bucket, key: string): Promise<void> {
  const lib = await loadLibrary(bucket);
  if (lib.tracks[key]) {
    delete lib.tracks[key];
    await saveLibrary(bucket, lib);
  }
}
