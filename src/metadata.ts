/**
 * 音频元数据解析：只依赖文件开头的一段字节（Worker 里用 R2 range 读取，约 2MB）。
 * 支持 FLAC / MP3(ID3v2) / M4A(MP4) / OGG(Opus|Vorbis) / WAV 的标签、封面与时长。
 * 解析失败时回退到「文件夹 + 文件名」推断。
 */

export interface Picture {
  mime: string;
  data: Uint8Array;
}

export interface ParsedMeta {
  title: string | null;
  artist: string | null;
  album: string | null;
  trackNo: number | null;
  duration: number | null; // 秒
  picture: Picture | null;
}

const emptyMeta = (): ParsedMeta => ({
  title: null,
  artist: null,
  album: null,
  trackNo: null,
  duration: null,
  picture: null,
});

/* ---------------- 基础工具 ---------------- */

function latin1(buf: Uint8Array, start: number, end: number): string {
  let s = "";
  for (let i = start; i < end && i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return s;
}

function utf8(buf: Uint8Array, start: number, end: number): string {
  try {
    return new TextDecoder("utf-8").decode(buf.subarray(start, end));
  } catch {
    return latin1(buf, start, end);
  }
}

function utf16(buf: Uint8Array, start: number, end: number, littleEndian: boolean): string {
  let s = "";
  for (let i = start; i + 1 < end; i += 2) {
    s += String.fromCharCode(littleEndian ? buf[i] | (buf[i + 1] << 8) : (buf[i] << 8) | buf[i + 1]);
  }
  return s;
}

let gbkDecoder: TextDecoder | null | undefined;
// 国内一些老 MP3 标签是 GBK 编码却标成 latin1，能转就转，转不动就按 latin1
function tryGbk(buf: Uint8Array, start: number, end: number): string | null {
  if (gbkDecoder === undefined) {
    try {
      gbkDecoder = new TextDecoder("gbk");
    } catch {
      gbkDecoder = null;
    }
  }
  if (!gbkDecoder) return null;
  try {
    return gbkDecoder.decode(buf.subarray(start, end));
  } catch {
    return null;
  }
}

function hasBomAscii(buf: Uint8Array, start: number, end: number): boolean {
  for (let i = start; i < end; i++) if (buf[i] > 0x7f) return false;
  return true;
}

function decodeTagText(body: Uint8Array): string {
  if (body.length === 0) return "";
  const enc = body[0];
  let s = "";
  if (enc === 1) {
    // UTF-16，带 BOM
    if (body[1] === 0xff && body[2] === 0xfe) s = utf16(body, 3, body.length, true);
    else if (body[1] === 0xfe && body[2] === 0xff) s = utf16(body, 3, body.length, false);
    else s = utf16(body, 1, body.length, true);
  } else if (enc === 2) {
    s = utf16(body, 1, body.length, false);
  } else if (enc === 3) {
    s = utf8(body, 1, body.length);
  } else {
    // 0 = latin1；纯 ASCII 直接 latin1，否则尝试 GBK（兼容国内老标签）
    if (hasBomAscii(body, 1, body.length)) s = latin1(body, 1, body.length);
    else s = tryGbk(body, 1, body.length) ?? latin1(body, 1, body.length);
  }
  return s;
}

function firstText(body: Uint8Array): string {
  const parts = decodeTagText(body)
    .split("\0")
    .map((t) => t.trim())
    .filter(Boolean);
  return parts[0] ?? "";
}

function syncsafe(buf: Uint8Array, o: number): number {
  return ((buf[o] & 0x7f) << 21) | ((buf[o + 1] & 0x7f) << 14) | ((buf[o + 2] & 0x7f) << 7) | (buf[o + 3] & 0x7f);
}

function deUnsync(b: Uint8Array): Uint8Array {
  let need = false;
  for (let i = 0; i < b.length - 1; i++) {
    if (b[i] === 0xff && b[i + 1] === 0x00) {
      need = true;
      break;
    }
  }
  if (!need) return b;
  const out = new Uint8Array(b.length);
  let w = 0;
  for (let i = 0; i < b.length; i++) {
    out[w++] = b[i];
    if (b[i] === 0xff && b[i + 1] === 0x00) i++;
  }
  return out.subarray(0, w);
}

function sniffImage(b: Uint8Array): string {
  if (b.length < 4) return "image/jpeg";
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57) return "image/webp";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (b[0] === 0x42 && b[1] === 0x4d) return "image/bmp";
  return "image/jpeg";
}

/* ---------------- Vorbis Comment（FLAC / OGG 共用） ---------------- */

function parseVorbisComments(buf: Uint8Array, start: number, end: number, out: ParsedMeta): void {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let p = start;
  const rd32 = (): number | null => {
    if (p + 4 > end) return null;
    const v = dv.getUint32(p, true);
    p += 4;
    return v;
  };
  const vendorLen = rd32();
  if (vendorLen === null || vendorLen > end - p) return;
  p += vendorLen;
  const count = rd32();
  if (count === null) return;
  for (let i = 0; i < count && i < 512; i++) {
    const len = rd32();
    if (len === null) break;
    if (len > end - p) break;
    if (len > 0 && len < 8192) {
      const s = utf8(buf, p, p + len);
      const eq = s.indexOf("=");
      if (eq > 0) {
        const k = s.slice(0, eq).toUpperCase();
        const v = s.slice(eq + 1).trim();
        if (v) {
          if (k === "TITLE" && !out.title) out.title = v;
          else if (k === "ARTIST" && !out.artist) out.artist = v;
          else if (k === "ALBUM" && !out.album) out.album = v;
          else if (k === "TRACKNUMBER" && out.trackNo == null) {
            const n = parseInt(v, 10);
            if (!isNaN(n)) out.trackNo = n;
          }
        }
      }
    }
    p += len;
  }
}

/* ---------------- FLAC ---------------- */

function parseFlac(buf: Uint8Array, out: ParsedMeta, start = 4): ParsedMeta {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let p = start;
  while (p + 4 <= buf.length) {
    const head = buf[p];
    const last = (head & 0x80) !== 0;
    const type = head & 0x7f;
    const len = (buf[p + 1] << 16) | (buf[p + 2] << 8) | buf[p + 3];
    const body = p + 4;
    if (len < 0 || body + len > buf.length) break;

    if (type === 0 && len >= 18) {
      // STREAMINFO：采样率(20bit) / 声道(3bit) / 位深(5bit) / 总采样数(36bit)
      const o = body + 10;
      const sampleRate = (buf[o] << 12) | (buf[o + 1] << 4) | (buf[o + 2] >> 4);
      const totalSamples =
        (buf[o + 3] & 0x0f) * 4294967296 +
        buf[o + 4] * 16777216 +
        ((buf[o + 5] << 16) | (buf[o + 6] << 8) | buf[o + 7]);
      if (sampleRate > 0 && totalSamples > 0) out.duration = totalSamples / sampleRate;
    } else if (type === 4) {
      parseVorbisComments(buf, body, body + len, out);
    } else if (type === 6 && !out.picture && len >= 32) {
      const mimeLen = dv.getUint32(body + 4);
      const afterMime = body + 8 + mimeLen;
      if (afterMime + 4 <= body + len) {
        const descLen = dv.getUint32(afterMime);
        const dataLenPos = afterMime + 4 + descLen + 16; // 跳过描述 + 宽/高/色深/色彩数
        if (dataLenPos + 4 <= buf.length) {
          const dataLen = dv.getUint32(dataLenPos);
          const dataStart = dataLenPos + 4;
          if (dataLen > 0 && dataStart + dataLen <= buf.length) {
            out.picture = { mime: "image/jpeg", data: buf.slice(dataStart, dataStart + dataLen) };
          }
        }
      }
    }

    p = body + len;
    if (last) break;
  }
  return out;
}

/* ---------------- ID3v2 (MP3) ---------------- */

const V22_MAP: Record<string, string> = { TT2: "TIT2", TP1: "TPE1", TAL: "TALB", TRK: "TRCK", PIC: "APIC" };

function parseApic(body: Uint8Array, v22: boolean, out: ParsedMeta): void {
  let p = 1; // 编码字节
  let ptype: number;
  if (v22) {
    if (p + 4 > body.length) return;
    p += 3; // "JPG" 等三字符格式
    ptype = body[p];
    p += 1;
  } else {
    const z = body.indexOf(0, p);
    if (z < 0) return;
    p = z + 1; // mime 串结尾
    ptype = body[p];
    p += 1;
  }
  void ptype;
  const enc = body[0];
  if (enc === 1 || enc === 2) {
    while (p + 1 < body.length && !(body[p] === 0 && body[p + 1] === 0)) p += 2;
    p += 2;
  } else {
    const z2 = body.indexOf(0, p);
    if (z2 < 0) return;
    p = z2 + 1;
  }
  const data = body.slice(p);
  if (data.length > 128 && !out.picture) out.picture = { mime: sniffImage(data), data };
}

function handleId3Frame(id: string, body: Uint8Array, out: ParsedMeta): void {
  if (id === "TIT2") {
    const v = firstText(body);
    if (v && !out.title) out.title = v;
  } else if (id === "TPE1") {
    const v = firstText(body);
    if (v && !out.artist) out.artist = v;
  } else if (id === "TALB") {
    const v = firstText(body);
    if (v && !out.album) out.album = v;
  } else if (id === "TRCK") {
    const n = parseInt(firstText(body), 10);
    if (!isNaN(n) && out.trackNo == null) out.trackNo = n;
  } else if (id === "APIC") {
    parseApic(body, false, out);
  }
}

function parseId3v2(buf: Uint8Array): [ParsedMeta, number] {
  const out = emptyMeta();
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const ver = buf[3];
  const flags = buf[5];
  const size = syncsafe(buf, 6);
  let work = buf;
  let end = Math.min(10 + size, buf.length);

  if (ver === 3 && flags & 0x80) {
    // v2.3 全局反同步：先整体还原，再按帧解析
    const restored = deUnsync(buf.subarray(10, end));
    work = new Uint8Array(10 + restored.length);
    work.set(buf.subarray(0, 10));
    work.set(restored, 10);
    end = work.length;
  }

  let p = 10;
  if (flags & 0x40) {
    // 扩展头
    try {
      if (ver === 4) p += syncsafe(work, p);
      else if (ver === 3) p += 4 + dv.getUint32(p);
    } catch {
      /* 忽略 */
    }
  }

  const hdr = ver === 2 ? 6 : 10;
  while (p + hdr <= end) {
    if (work[p] === 0) break; // padding
    let id: string;
    let fsize: number;
    let fflags = 0;
    if (ver === 2) {
      id = latin1(work, p, p + 3);
      fsize = (work[p + 3] << 16) | (work[p + 4] << 8) | work[p + 5];
    } else {
      id = latin1(work, p, p + 4);
      fsize = ver === 4 ? syncsafe(work, p + 4) : dv.getUint32(p + 4);
      fflags = work[p + 9];
    }
    const fp = p + hdr;
    if (fsize <= 0 || fp + fsize > end) break;
    let body = work.subarray(fp, fp + fsize);
    if (ver === 4 && fflags & 0x02) body = deUnsync(body);
    if (ver === 4 && fflags & 0x01) body = body.subarray(4); // 数据长度指示
    const mapped = ver === 2 ? V22_MAP[id] ?? id : id;
    handleId3Frame(mapped, body, out);
    p = fp + fsize;
  }
  return [out, 10 + size];
}

function mp3Duration(buf: Uint8Array, tagEnd: number, fileSize: number): number | null {
  const n = buf.length;
  let p = tagEnd;
  while (p + 4 <= n && !(buf[p] === 0xff && (buf[p + 1] & 0xe0) === 0xe0)) p++;
  if (p + 4 > n) return null;
  const b1 = buf[p + 1];
  const b2 = buf[p + 2];
  const b3 = buf[p + 3];
  const versionBits = (b1 >> 3) & 0x03; // 3=MPEG1 2=MPEG2 0=MPEG2.5
  const layerBits = (b1 >> 1) & 0x03; // 1=Layer III
  if (layerBits === 0 || versionBits === 1) return null;
  const isV1 = versionBits === 3;
  const brIdx = (b2 >> 4) & 0x0f;
  const srIdx = (b2 >> 2) & 0x03;
  const BR_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const BR_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  const SR: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
  const br = ((isV1 ? BR_V1 : BR_V2)[brIdx] || 0) * 1000;
  const srT = SR[versionBits];
  const sr = srT && srIdx < 3 ? srT[srIdx] : 0;
  if (!br || !sr) return null;

  // Xing/Info 头（VBR）
  const channels = ((b3 >> 6) & 0x03) === 3 ? 1 : 2;
  const sideInfo = isV1 ? (channels === 1 ? 17 : 32) : channels === 1 ? 9 : 17;
  const xingOff = p + 4 + sideInfo;
  if (xingOff + 16 <= n) {
    const tag4 = latin1(buf, xingOff, xingOff + 4);
    if (tag4 === "Xing" || tag4 === "Info") {
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      const xflags = dv.getUint32(xingOff + 4);
      if (xflags & 0x01) {
        const frames = dv.getUint32(xingOff + 8);
        if (frames > 0) return (frames * (isV1 ? 1152 : 576)) / sr;
      }
    }
  }
  return ((fileSize - p) * 8) / br; // CBR 估算
}

/* ---------------- MP4 / M4A ---------------- */

function parseMp4(buf: Uint8Array, out: ParsedMeta): ParsedMeta {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const ILST: Record<string, string> = {
    "\u00A9nam": "title",
    "\u00A9ART": "artist",
    "\u00A9alb": "album",
    aART: "albumartist",
    "\u00A9wrt": "albumartist",
  };

  const applyIlst = (field: string, kind: number, payload: Uint8Array) => {
    if (field === "title" || field === "artist" || field === "album" || field === "albumartist") {
      let v = "";
      if (kind === 2) v = utf16(payload, 0, payload.length, false);
      else v = utf8(payload, 0, payload.length);
      v = v.trim();
      if (!v) return;
      if (field === "title" && !out.title) out.title = v;
      else if (field === "artist" && !out.artist) out.artist = v;
      else if (field === "album" && !out.album) out.album = v;
      else if (field === "albumartist" && !out.artist) out.artist = v;
    } else if (field === "trkn") {
      if (payload.length >= 4) {
        const n = (payload[2] << 8) | payload[3];
        if (n > 0 && out.trackNo == null) out.trackNo = n;
      }
    } else if (field === "covr") {
      if (payload.length > 128 && !out.picture) out.picture = { mime: sniffImage(payload), data: payload.slice() };
    }
  };

  const walk = (start: number, end: number, depth: number) => {
    if (depth > 6) return;
    let p = start;
    while (p + 8 <= end) {
      let size = dv.getUint32(p);
      const type = latin1(buf, p + 4, p + 8);
      let hdr = 8;
      if (size === 1) {
        if (p + 16 > end) break;
        size = Number(dv.getBigUint64(p + 8));
        hdr = 16;
      } else if (size < 8) {
        size = end - p;
      }
      if (size < hdr || p + size > end) break;
      const bs = p + hdr;
      const be = p + size;

      if (type === "moov" || type === "udta" || type === "ilst") {
        walk(bs, be, depth + 1);
      } else if (type === "meta") {
        walk(bs + 4, be, depth + 1); // meta 盒子有 4 字节版本/标志
      } else if (type === "mvhd") {
        try {
          const version = buf[bs];
          if (version === 1) {
            const ts = dv.getUint32(bs + 20);
            const dur = Number(dv.getBigUint64(bs + 24));
            if (ts > 0 && dur > 0) out.duration = dur / ts;
          } else {
            const ts = dv.getUint32(bs + 12);
            const dur = dv.getUint32(bs + 16);
            if (ts > 0 && dur > 0) out.duration = dur / ts;
          }
        } catch {
          /* 忽略 */
        }
      } else {
        const field = ILST[type];
        if (field) {
          // ilst 子项内部找 "data" 盒子
          let q = bs;
          while (q + 8 <= be) {
            const dsz = dv.getUint32(q);
            if (dsz < 16 || q + dsz > be) break;
            if (latin1(buf, q + 4, q + 8) === "data") {
              const kind = dv.getUint32(q + 8) & 0xffffff;
              applyIlst(field, kind, buf.subarray(q + 16, q + dsz));
              break;
            }
            q += dsz;
          }
        } else if (type === "trkn") {
          applyIlst("trkn", 0, buf.subarray(bs + 16, be));
        } else if (type === "covr") {
          applyIlst("covr", 0, buf.subarray(bs + 8, be));
        }
      }
      p += size;
    }
  };

  walk(0, buf.length, 0);
  return out;
}

/* ---------------- OGG (Opus / Vorbis) ---------------- */

function parseOgg(buf: Uint8Array, out: ParsedMeta): ParsedMeta {
  const limit = Math.min(buf.length, 1 << 16);
  const find = (seq: string, from = 0): number => {
    for (let i = from; i + seq.length <= limit; i++) {
      let ok = true;
      for (let j = 0; j < seq.length; j++) {
        if (buf[i + j] !== seq.charCodeAt(j)) {
          ok = false;
          break;
        }
      }
      if (ok) return i;
    }
    return -1;
  };
  let pos = find("OpusTags");
  if (pos >= 0) parseVorbisComments(buf, pos + 8, limit, out);
  else {
    pos = find("\x03vorbis");
    if (pos >= 0) parseVorbisComments(buf, pos + 7, limit, out);
  }
  return out;
}

/* ---------------- WAV ---------------- */

function parseWav(buf: Uint8Array, out: ParsedMeta): ParsedMeta {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (latin1(buf, 0, 4) !== "RIFF" || latin1(buf, 8, 12) !== "WAVE") return out;
  let p = 12;
  let byteRate = 0;
  while (p + 8 <= buf.length) {
    const id = latin1(buf, p, p + 4);
    const size = dv.getUint32(p + 4);
    const body = p + 8;
    if (id === "fmt " && size >= 16) {
      byteRate = dv.getUint32(body + 8);
    } else if (id === "data") {
      if (byteRate > 0 && size > 0) out.duration = size / byteRate;
      break;
    } else if (id === "LIST" && size > 4) {
      // INFO 块：INAM 标题 / IART 歌手 / IPRD 专辑
      let q = body + 4;
      const listEnd = Math.min(body + size, buf.length);
      while (q + 8 <= listEnd) {
        const sid = latin1(buf, q, q + 4);
        const ssize = dv.getUint32(q + 4);
        if (ssize < 0 || q + 8 + ssize > listEnd) break;
        const val = utf8(buf, q + 8, q + 8 + ssize).replace(/\0+$/, "").trim();
        if (sid === "INAM" && val && !out.title) out.title = val;
        else if (sid === "IART" && val && !out.artist) out.artist = val;
        else if (sid === "IPRD" && val && !out.album) out.album = val;
        q += 8 + ssize + (ssize % 2);
      }
    }
    p = body + size + (size % 2);
  }
  return out;
}

/* ---------------- 文件名回退 ---------------- */

export function metaFromFilename(key: string): ParsedMeta {
  const out = emptyMeta();
  const path = key.startsWith("music/") ? key.slice(6) : key;
  const segs = path.split("/").filter(Boolean);
  const base = (segs[segs.length - 1] ?? key).replace(/\.[a-z0-9]{1,5}$/i, "");
  const name = base.replace(/^[\s\-–—_]+/, "").replace(/_+/g, " ").trim();

  let artist: string | null = null;
  let title = name;
  const spaced = /^(.{1,80}?)\s+[-–—]\s+(.+)$/.exec(name);
  const tight = spaced ? null : /^([^-–—]{1,40}?)[-–—](.+)$/.exec(name);
  if (spaced) {
    artist = spaced[1].trim() || null;
    title = spaced[2].trim();
  } else if (tight && tight[2].trim()) {
    artist = tight[1].trim() || null;
    title = tight[2].trim();
  } else {
    const numbered = /^(\d{1,3})\s*[.\-–—、]\s*(.+)$/.exec(name);
    if (numbered) {
      out.trackNo = parseInt(numbered[1], 10);
      title = numbered[2].trim();
    }
  }
  out.artist = artist;
  out.title = title || base;

  // 目录结构：歌手/专辑/文件 或 歌手/文件
  if (segs.length >= 3) {
    out.album = segs[segs.length - 2];
    out.artist = out.artist ?? segs[segs.length - 3];
  } else if (segs.length === 2) {
    out.artist = out.artist ?? segs[0];
  }
  return out;
}

/* ---------------- 入口 ---------------- */

export function parseAudioFile(head: Uint8Array, key: string, fileSize: number): ParsedMeta {
  let parsed = emptyMeta();
  try {
    let offset = 0;
    // 很多 FLAC/M4A 文件前面被加了 ID3v2 标签（国内软件常见），先剥掉再认格式
    if (head.length >= 10 && head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {
      const [m, tagEnd] = parseId3v2(head);
      parsed = m;
      offset = Math.min(tagEnd, head.length);
      if (parsed.duration == null && !isFlacAt(head, offset)) {
        parsed.duration = mp3Duration(head, tagEnd, fileSize);
      }
    }
    if (isFlacAt(head, offset)) {
      parsed = parseFlac(head, parsed, offset + 4);
    } else if (offset === 0 && head.length >= 12 && latin1(head, 4, 8) === "ftyp") {
      parsed = parseMp4(head, parsed);
    } else if (offset === 0 && head.length >= 4 && head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53) {
      parsed = parseOgg(head, parsed);
    } else if (offset === 0 && head.length >= 12 && latin1(head, 0, 4) === "RIFF" && latin1(head, 8, 12) === "WAVE") {
      parsed = parseWav(head, parsed);
    }
  } catch {
    /* 解析失败就走文件名回退 */
  }
  const fb = metaFromFilename(key);
  return {
    title: parsed.title || fb.title,
    artist: parsed.artist || fb.artist,
    album: parsed.album || fb.album,
    trackNo: parsed.trackNo ?? fb.trackNo,
    duration: parsed.duration && isFinite(parsed.duration) && parsed.duration > 0 ? parsed.duration : fb.duration,
    picture: parsed.picture,
  };
}

function isFlacAt(buf: Uint8Array, offset: number): boolean {
  return (
    buf.length >= offset + 4 &&
    buf[offset] === 0x66 &&
    buf[offset + 1] === 0x4c &&
    buf[offset + 2] === 0x61 &&
    buf[offset + 3] === 0x43
  );
}
