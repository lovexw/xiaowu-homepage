import {
  loadLibrary,
  saveLibrary,
  listTrackEntries,
  upsertLibraryEntry,
  removeLibraryEntry,
  TRACK_PREFIX,
  type Track,
  type ObjectEntry,
} from "./library";
import { parseAudioFile, metaFromFilename } from "./metadata";

export interface Env {
  BUCKET: R2Bucket;
  ASSETS: Fetcher;
  PASSWORD?: string;
}

const COOKIE_NAME = "mp_auth";
const SESSION_DAYS = 30;
const BUILD_BATCH = 3; // 每次请求最多解析几首新歌（免费版 Workers 有 CPU 限制，靠前端轮询分批完成）
const META_READ_BYTES = 2 * 1024 * 1024;
const AUDIO_EXT = new Set(["mp3", "flac", "m4a", "aac", "ogg", "oga", "opus", "wav", "webm"]);

/* ---------------- 通用小工具 ---------------- */

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function contentTypeFor(name: string): string {
  switch (extOf(name)) {
    case "mp3":
      return "audio/mpeg";
    case "flac":
      return "audio/flac";
    case "m4a":
    case "m4b":
    case "mp4":
      return "audio/mp4";
    case "aac":
      return "audio/aac";
    case "ogg":
    case "oga":
    case "opus":
      return "audio/ogg";
    case "wav":
      return "audio/wav";
    case "webm":
      return "audio/webm";
    default:
      return "application/octet-stream";
  }
}

function isAudioName(name: string): boolean {
  return AUDIO_EXT.has(extOf(name));
}

function sanitizeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const cleaned = base
    .replace(/[*:<>?|"`\x00-\x1f]/g, "_")
    .replace(/^\.+/, "")
    .trim();
  return cleaned || "未命名";
}

/* ---------------- 登录态（HMAC 签名的过期时间，密钥即 PASSWORD） ---------------- */

async function hmacSign(payload: string, password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function makeToken(password: string): Promise<string> {
  const exp = String(Date.now() + SESSION_DAYS * 86400_000);
  return `${exp}.${await hmacSign(exp, password)}`;
}

async function verifyToken(token: string, password: string): Promise<boolean> {
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const expect = await hmacSign(exp, password);
  let diff = expect.length ^ sig.length;
  for (let i = 0; i < expect.length && i < sig.length; i++) diff |= expect.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

async function isAuthed(request: Request, env: Env): Promise<boolean> {
  if (!env.PASSWORD) return false;
  const bearer = request.headers.get("Authorization");
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : getCookie(request, COOKIE_NAME);
  return token ? verifyToken(token, env.PASSWORD) : false;
}

/* ---------------- 曲库构建 ---------------- */

function fallbackTrack(entry: ObjectEntry): Track {
  const fb = metaFromFilename(entry.key);
  return {
    key: entry.key,
    title: fb.title || entry.key,
    artist: fb.artist,
    album: fb.album,
    trackNo: fb.trackNo,
    duration: null,
    cover: null,
    size: entry.size,
    format: extOf(entry.key),
    etag: entry.etag,
  };
}

/** 读取文件头部字节，解析标签/封面，封面去重后写入 covers/ */
async function buildTrack(env: Env, entry: ObjectEntry): Promise<Track> {
  const head = await env.BUCKET.get(entry.key, { range: { offset: 0, length: META_READ_BYTES } });
  if (!head) throw new Error("对象不存在");
  const bytes = new Uint8Array(await head.arrayBuffer());
  const parsed = parseAudioFile(bytes, entry.key, entry.size);

  let cover: string | null = null;
  if (parsed.picture && parsed.picture.data.length > 128) {
    try {
      const digest = await crypto.subtle.digest("SHA-1", parsed.picture.data);
      const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
      const coverKey = `covers/${hex.slice(0, 32)}.${parsed.picture.mime === "image/png" ? "png" : "jpg"}`;
      await env.BUCKET.put(coverKey, parsed.picture.data, {
        httpMetadata: { contentType: parsed.picture.mime },
      });
      cover = coverKey.slice("covers/".length);
    } catch {
      /* 封面失败不影响曲目 */
    }
  }

  const fb = metaFromFilename(entry.key);
  return {
    key: entry.key,
    title: parsed.title || fb.title || entry.key,
    artist: parsed.artist || fb.artist,
    album: parsed.album || fb.album,
    trackNo: parsed.trackNo ?? fb.trackNo,
    duration: parsed.duration,
    cover,
    size: entry.size,
    format: extOf(entry.key),
    etag: entry.etag,
  };
}

/* ---------------- 各接口 ---------------- */

async function handleLogin(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.PASSWORD) {
    return json({ error: "服务端还没设置访问密码，请先运行：npx wrangler secret put PASSWORD" }, 500);
  }
  let body: { password?: string } | null = null;
  try {
    body = await request.json();
  } catch {
    /* 空请求体 */
  }
  if (typeof body?.password !== "string" || body.password !== env.PASSWORD) {
    return json({ error: "密码错误" }, 401);
  }
  const token = await makeToken(env.PASSWORD);
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return json({ ok: true }, 200, {
    "Set-Cookie": `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; SameSite=Lax${secure}`,
  });
}

async function handleLibrary(env: Env): Promise<Response> {
  const entries = await listTrackEntries(env.BUCKET);
  const lib = await loadLibrary(env.BUCKET);
  const liveKeys = new Set(entries.map((e) => e.key));
  for (const k of Object.keys(lib.tracks)) {
    if (!liveKeys.has(k)) delete lib.tracks[k]; // 已被删掉的文件
  }
  const pending = entries.filter((e) => {
    const t = lib.tracks[e.key];
    return !t || t.etag !== e.etag; // 新文件，或内容被覆盖过
  });
  const batch = pending.slice(0, BUILD_BATCH);
  for (const entry of batch) {
    try {
      lib.tracks[entry.key] = await buildTrack(env, entry);
    } catch {
      lib.tracks[entry.key] = fallbackTrack(entry);
    }
    await saveLibrary(env.BUCKET, lib); // 每解析一首就存一次，中途超时也不丢进度
  }
  return json({
    tracks: Object.values(lib.tracks),
    pending: pending.length - batch.length,
  });
}

function parseRangeHeader(header: string): R2Range {
  const m = /^bytes=(\d*)-(\d*)/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) throw new Error("range 格式无效");
  if (m[1] === "") return { suffix: parseInt(m[2], 10) };
  const start = parseInt(m[1], 10);
  if (m[2] === "") return { offset: start };
  const end = parseInt(m[2], 10);
  if (end < start) throw new Error("range 格式无效");
  return { offset: start, length: end - start + 1 };
}

function rangeBounds(r: R2Range, size: number): [number, number] {
  if ("suffix" in r) {
    const s = Math.min(r.suffix ?? 0, size);
    return [size - s, size - 1];
  }
  const start = Math.min(r.offset ?? 0, Math.max(0, size - 1));
  const end = "length" in r && r.length != null ? Math.min(start + r.length - 1, size - 1) : size - 1;
  return [start, Math.max(start, end)];
}

async function handleStream(request: Request, env: Env, path: string): Promise<Response> {
  let key: string;
  try {
    key = decodeURIComponent(path.slice("/api/stream/".length));
  } catch {
    return json({ error: "key 编码无效" }, 400);
  }
  if (!key.startsWith(TRACK_PREFIX)) key = TRACK_PREFIX + key;

  const rangeHeader = request.headers.get("range");
  try {
    const range = rangeHeader ? parseRangeHeader(rangeHeader) : undefined;
    const obj = await env.BUCKET.get(key, range ? { range } : undefined);
    if (!obj) return json({ error: "文件不存在" }, 404);
    const size = obj.size;
    const headers = new Headers();
    headers.set("Content-Type", contentTypeFor(key));
    headers.set("Accept-Ranges", "bytes");
    headers.set("ETag", obj.httpEtag);
    headers.set("Cache-Control", "private, max-age=86400");
    let status = 200;
    if (range) {
      const [start, end] = rangeBounds(range, size);
      headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
      headers.set("Content-Length", String(end - start + 1));
      status = 206;
    } else {
      headers.set("Content-Length", String(size));
    }
    return new Response(obj.body, { status, headers });
  } catch {
    const head = await env.BUCKET.head(key).catch(() => null);
    return json({ error: "range 无效" }, 416, { "Content-Range": `bytes */${head?.size ?? 0}` });
  }
}

async function handleCover(env: Env, path: string): Promise<Response> {
  const name = path.slice("/api/cover/".length);
  if (!/^[\w-]+\.(jpg|png|webp|gif|bmp)$/.test(name)) return json({ error: "封面 id 无效" }, 400);
  const obj = await env.BUCKET.get(`covers/${name}`);
  if (!obj) return json({ error: "没有封面" }, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, max-age=2592000, immutable");
  return new Response(obj.body, { headers });
}

async function handleUpload(request: Request, env: Env): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "表单解析失败" }, 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "缺少文件字段 file" }, 400);
  const rawName = file.name || "未命名";
  if (!isAudioName(rawName)) return json({ error: "暂不支持该格式，仅支持 mp3/flac/m4a/aac/ogg/opus/wav/webm" }, 400);

  const key = TRACK_PREFIX + sanitizeName(rawName);
  const buf = await file.arrayBuffer();
  const put = await env.BUCKET.put(key, buf, {
    httpMetadata: { contentType: file.type && file.type !== "application/octet-stream" ? file.type : contentTypeFor(rawName) },
  });

  const entry: ObjectEntry = { key, size: buf.byteLength, etag: put?.httpEtag ?? "" };
  let track: Track;
  try {
    track = await buildTrack(env, entry);
  } catch {
    track = fallbackTrack(entry);
  }
  await upsertLibraryEntry(env.BUCKET, track);
  return json({ ok: true, track });
}

async function handleDuration(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { key?: string; duration?: number } | null;
  if (!body || typeof body.key !== "string" || typeof body.duration !== "number" || !isFinite(body.duration) || body.duration <= 0) {
    return json({ error: "参数无效" }, 400);
  }
  const lib = await loadLibrary(env.BUCKET);
  const t = lib.tracks[body.key];
  if (t && (t.duration == null || Math.abs(t.duration - body.duration) > 0.35)) {
    t.duration = Math.round(body.duration * 10) / 10;
    await saveLibrary(env.BUCKET, lib);
  }
  return json({ ok: true });
}

async function handleDelete(url: URL, env: Env): Promise<Response> {
  const key = url.searchParams.get("key");
  if (!key || !key.startsWith(TRACK_PREFIX)) return json({ error: "key 无效" }, 400);
  await env.BUCKET.delete(key);
  await removeLibraryEntry(env.BUCKET, key);
  return json({ ok: true });
}

/* ---------------- 入口 ---------------- */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 静态页面交给 Workers Assets
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);

    if (path === "/api/login" && request.method === "POST") return handleLogin(request, env, url);
    if (path === "/api/logout" && request.method === "POST") {
      return json({ ok: true }, 200, { "Set-Cookie": `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax` });
    }

    if (!(await isAuthed(request, env))) return json({ error: "未登录" }, 401);

    if (path === "/api/library" && request.method === "GET") return handleLibrary(env);
    if (path.startsWith("/api/stream/") && request.method === "GET") return handleStream(request, env, path);
    if (path.startsWith("/api/cover/") && request.method === "GET") return handleCover(env, path);
    if (path === "/api/upload" && request.method === "POST") return handleUpload(request, env);
    if (path === "/api/duration" && request.method === "POST") return handleDuration(request, env);
    if (path === "/api/track" && request.method === "DELETE") return handleDelete(url, env);
    return json({ error: "未知接口" }, 404);
  },
} satisfies ExportedHandler<Env>;
