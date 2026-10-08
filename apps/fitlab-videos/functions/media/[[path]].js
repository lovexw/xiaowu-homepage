/**
 * /media/* → R2 桶（VIDEO_BUCKET）同域代理
 *
 * 作用：
 *  1. 前端无需跨域即可播放 R2 里的视频（m3u8 / ts / mp4 / 封面图）
 *  2. 支持 Range 请求（拖动进度条秒切）
 *  3. m3u8 短缓存，分片长缓存（文件名不变内容不变）
 *
 * 本地开发：`npx wrangler pages dev`（配合 wrangler.toml 的 R2 绑定，本地模拟桶）
 * 生产环境：Pages 项目设置里绑定 R2 → VIDEO_BUCKET（wrangler.toml 已声明）
 */

const MIME = {
  m3u8: 'application/vnd.apple.mpegurl',
  ts: 'video/mp2t',
  m4s: 'video/iso.segment',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  vtt: 'text/vtt; charset=utf-8',
  txt: 'text/plain; charset=utf-8'
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges'
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS }
  });
}

/** 解析 Range 头 → R2Range */
function parseRange(h) {
  if (!h) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(h.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  if (m[1] === '') return { suffix: Number(m[2]) };
  if (m[2] === '') return { offset: Number(m[1]) };
  return { offset: Number(m[1]), length: Number(m[2]) - Number(m[1]) + 1 };
}

export async function onRequest({ request, env, params }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  const bucket = env && env.VIDEO_BUCKET;
  if (!bucket) {
    return json({ error: 'R2 绑定 VIDEO_BUCKET 未配置：请在 Cloudflare Pages 项目设置中绑定 R2 存储桶' }, 500);
  }

  // 拼接对象 key：/media/strength/pec-deck-fly/master.m3u8 → strength/pec-deck-fly/master.m3u8
  const segs = params.path || [];
  const key = segs.map(decodeURIComponent).join('/');
  if (!key || key.includes('..') || key.includes('\0')) {
    return json({ error: 'Bad key', key }, 400);
  }

  const range = parseRange(request.headers.get('Range'));
  const options = range ? { range } : {};

  let obj;
  try {
    obj = await bucket.get(key, options);
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (/range|out of bounds/i.test(msg)) return json({ error: 'Range Not Satisfiable' }, 416);
    return json({ error: 'R2 读取失败: ' + msg }, 500);
  }
  if (!obj) return json({ error: 'Not found', key }, 404);

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  const ext = (key.split('.').pop() || '').toLowerCase();
  if (!headers.has('Content-Type')) headers.set('Content-Type', MIME[ext] || 'application/octet-stream');
  headers.set('ETag', obj.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', ext === 'm3u8'
    ? 'public, max-age=60'
    : 'public, max-age=31536000, immutable');
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);

  const isHead = request.method === 'HEAD';
  const r = obj.range;
  if (range && r && (r.offset !== undefined || r.length !== undefined || r.suffix !== undefined)) {
    const offset = r.offset !== undefined ? r.offset
      : r.suffix !== undefined ? Math.max(0, obj.size - r.suffix)
        : 0;
    const length = r.length !== undefined ? r.length
      : r.suffix !== undefined ? obj.size - offset
        : obj.size - offset;
    headers.set('Content-Range', `bytes ${offset}-${offset + Math.max(0, length - 1)}/${obj.size}`);
    headers.set('Content-Length', String(length));
    return new Response(isHead ? null : obj.body, { status: 206, headers });
  }

  if (isHead) headers.set('Content-Length', String(obj.size));
  return new Response(isHead ? null : obj.body, { status: 200, headers });
}
