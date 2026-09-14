/* 生成多尺寸应用图标：纯 Node 实现（zlib 内置，无第三方依赖）
 * 用法：node scripts/gen-icons.mjs <源PNG> <输出目录>
 * 产物：icon.ico（256 PNG + 128/64/48/32/16 BMP）、icon.png、128x128.png、128x128@2x.png、32x32.png
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/* ---------- PNG 解码（8bit RGBA/RGB，非隔行） ---------- */
function decodePNG(buf) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buf.subarray(0, 8).equals(sig)) throw new Error('不是 PNG 文件');
  let pos = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') { idat.push(data); }
    else if (type === 'IEND') { break; }
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('仅支持 8bit PNG，实际 ' + bitDepth);
  if (interlace !== 0) throw new Error('不支持隔行 PNG');
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!ch) throw new Error('仅支持 RGB/RGBA PNG，colorType=' + colorType);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  const out = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0;
      const b = prev[i];
      const c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (filter === 1) v = (v + a) & 255;
      else if (filter === 2) v = (v + b) & 255;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      cur[i] = v;
    }
    for (let x = 0; x < width; x++) {
      const si = x * ch, di = (y * width + x) * 4;
      out[di] = cur[si]; out[di + 1] = cur[si + 1]; out[di + 2] = cur[si + 2];
      out[di + 3] = ch === 4 ? cur[si + 3] : 255;
    }
    prev = cur;
  }
  return { width, height, rgba: out };
}

/* ---------- 区域平均缩放 ---------- */
function resize(src, sw, sh, tw, th) {
  const out = Buffer.alloc(tw * th * 4);
  for (let ty = 0; ty < th; ty++) {
    const y0 = Math.floor(ty * sh / th), y1 = Math.max(y0 + 1, Math.floor((ty + 1) * sh / th));
    for (let tx = 0; tx < tw; tx++) {
      const x0 = Math.floor(tx * sw / tw), x1 = Math.max(x0 + 1, Math.floor((tx + 1) * sw / tw));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = y0; y < y1 && y < sh; y++) {
        for (let x = x0; x < x1 && x < sw; x++) {
          const i = (y * sw + x) * 4;
          const al = src[i + 3] / 255;
          r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += src[i + 3]; n++;
        }
      }
      const di = (ty * tw + tx) * 4, av = a / n;
      out[di] = av ? Math.round(r / (av / 255) / n) : 0;
      out[di + 1] = av ? Math.round(g / (av / 255) / n) : 0;
      out[di + 2] = av ? Math.round(b / (av / 255) / n) : 0;
      out[di + 3] = Math.round(av);
    }
  }
  return out;
}

/* ---------- PNG 编码（RGBA，filter 0） ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function encodePNG(rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- ICO 封装（256 用 PNG，其余用 32bit BMP DIB） ---------- */
function bmpEntry(rgba, w, h) {
  const maskStride = Math.ceil(w / 32) * 4;
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(w, 4);
  header.writeInt32LE(h * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  const xor = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((h - 1 - y) * w + x) * 4, di = (y * w + x) * 4;
      xor[di] = rgba[si + 2]; xor[di + 1] = rgba[si + 1]; xor[di + 2] = rgba[si]; xor[di + 3] = rgba[si + 3];
    }
  }
  const and = Buffer.alloc(maskStride * h);
  return Buffer.concat([header, xor, and]);
}
function encodeICO(images) {
  const count = images.length;
  const dir = Buffer.alloc(6 + 16 * count);
  dir.writeUInt16LE(0, 0); dir.writeUInt16LE(1, 2); dir.writeUInt16LE(count, 4);
  const blobs = [];
  let offset = 6 + 16 * count;
  images.forEach(({ size, data }) => {
    const e = 6 + 16 * blobs.length;
    dir[e + 0] = size >= 256 ? 0 : size;
    dir[e + 1] = size >= 256 ? 0 : size;
    dir[e + 2] = 0; dir[e + 3] = 0;
    dir.writeUInt16LE(1, e + 4);
    dir.writeUInt16LE(32, e + 6);
    dir.writeUInt32LE(data.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += data.length;
    blobs.push(data);
  });
  return Buffer.concat([dir, ...blobs]);
}

/* ---------- 主流程 ---------- */
const [src, outDir] = process.argv.slice(2);
if (!src || !outDir) { console.error('用法: node gen-icons.mjs <源PNG> <输出目录>'); process.exit(1); }
const { width, height, rgba } = decodePNG(fs.readFileSync(src));
const min = Math.min(width, height);
const square = Buffer.alloc(min * min * 4);
{
  const ox = Math.floor((width - min) / 2), oy = Math.floor((height - min) / 2);
  for (let y = 0; y < min; y++) rgba.copy(square, y * min * 4, ((oy + y) * width + ox) * 4, ((oy + y) * width + ox + min) * 4);
}
const SIZES = [256, 128, 64, 48, 32, 16];
const rendered = new Map(SIZES.map(s => [s, resize(square, min, min, s, s)]));
const ico = encodeICO(SIZES.map(s => ({
  size: s,
  data: s === 256 ? encodePNG(rendered.get(256), 256, 256) : bmpEntry(rendered.get(s), s, s)
})));
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);
fs.writeFileSync(path.join(outDir, 'icon.png'), encodePNG(square, min, min));
for (const [name, s] of [['128x128.png', 128], ['128x128@2x.png', 256], ['32x32.png', 32]]) {
  fs.writeFileSync(path.join(outDir, name), encodePNG(rendered.get(s), s, s));
}
console.log('ICONS_OK ' + [...SIZES.map(s => s + 'px'), 'png'].join(','));
