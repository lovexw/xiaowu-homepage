#!/usr/bin/env node
/**
 * 批量上传本地音乐文件夹到 Cloudflare R2（走 S3 兼容 API）。
 *
 * 1. 到 Cloudflare 控制台 → R2 → Manage R2 API Tokens → 创建 API Token（权限 Object Read & Write）
 * 2. 在命令里带上三个环境变量后运行，例如：
 *
 *   R2_ACCOUNT_ID=你的账户ID \
 *   R2_ACCESS_KEY_ID=你的AccessKeyID \
 *   R2_SECRET_ACCESS_KEY=你的SecretAccessKey \
 *   npm run upload -- "/Users/xw/Documents/小吴-音乐库"
 *
 * 会保留「歌手/专辑」目录结构，上传后播放器会自动读取标签和封面。
 */

import { AwsClient } from "aws4fetch";
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const AUDIO_EXT = new Set([".mp3", ".flac", ".m4a", ".aac", ".ogg", ".oga", ".opus", ".wav", ".webm"]);
const CONCURRENCY = 4;

const dir = process.argv[2];
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET = "xw-music" } = process.env;

if (!dir) {
  console.error("用法: npm run upload -- <音乐文件夹路径>");
  process.exit(1);
}
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error("缺少环境变量 R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY");
  console.error("到 Cloudflare 控制台 → R2 → Manage R2 API Tokens 创建后填入（脚本顶部注释有示例）");
  process.exit(1);
}
if (!statSync(dir).isDirectory()) {
  console.error(`不是文件夹: ${dir}`);
  process.exit(1);
}

function walk(d, out = []) {
  for (const name of readdirSync(d)) {
    if (name === ".DS_Store" || name.startsWith(".")) continue;
    const full = join(d, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (AUDIO_EXT.has(name.slice(name.lastIndexOf(".")).toLowerCase())) out.push(full);
  }
  return out;
}

const files = walk(dir);
if (!files.length) {
  console.error("该文件夹下没有找到音频文件（支持 mp3/flac/m4a/aac/ogg/opus/wav/webm）");
  process.exit(1);
}
console.log(`共找到 ${files.length} 个音频文件，目标桶: ${R2_BUCKET}\n`);

const client = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});
const base = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`;

const CONTENT_TYPE = {
  ".mp3": "audio/mpeg", ".flac": "audio/flac", ".m4a": "audio/mp4", ".aac": "audio/aac",
  ".ogg": "audio/ogg", ".oga": "audio/ogg", ".opus": "audio/ogg", ".wav": "audio/wav", ".webm": "audio/webm",
};

let done = 0;
let failed = 0;
const started = Date.now();

async function uploadOne(abs, idx) {
  const rel = relative(dir, abs);
  const key = "music/" + rel.split(sep).map(encodeURIComponent).join("/");
  const t0 = Date.now();
  try {
    const body = readFileSync(abs);
    const ext = abs.slice(abs.lastIndexOf(".")).toLowerCase();
    const url = `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
    const res = await client.fetch(url, {
      method: "PUT",
      body,
      headers: { "content-type": CONTENT_TYPE[ext] || "application/octet-stream" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text().catch(() => "")}`);
    done++;
    const mb = (body.length / 1048576).toFixed(1);
    console.log(`[${done + failed}/${files.length}] ✓ ${rel} (${mb} MB, ${Date.now() - t0} ms)`);
  } catch (err) {
    failed++;
    console.error(`[${done + failed}/${files.length}] ✗ ${rel} → ${err.message}`);
  }
}

// 简单并发池
let cursor = 0;
async function worker() {
  while (cursor < files.length) {
    const idx = cursor++;
    await uploadOne(files[idx], idx);
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));

console.log(`\n完成：成功 ${done}，失败 ${failed}，耗时 ${((Date.now() - started) / 1000).toFixed(1)}s`);
if (failed > 0) process.exitCode = 1;
console.log("打开播放器刷新即可看到；新歌的标签和封面会在后台自动逐首读取。");
