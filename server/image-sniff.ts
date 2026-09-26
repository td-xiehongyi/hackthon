/**
 * 图片实际类型识别（docs/03 第 7.2 节）：按文件头魔数判定，并解析出宽高以确认文件头完整、
 * 可被读取。不信任扩展名或浏览器声明的 Content-Type。
 *
 * 只识别 JPEG / PNG / WebP / GIF；识别不了的一律返回 null，由调用方按政策拒绝。
 * 这里只做结构性检查（头部与尺寸），不做完整像素解码。
 */

export interface ImageInfo {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  width: number;
  height: number;
}

export function sniffImage(buf: Buffer): ImageInfo | null {
  if (buf.length < 16) return null;

  // PNG：签名 + IHDR
  if (buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    if (buf.length < 24 || buf.toString('latin1', 12, 16) !== 'IHDR') return null;
    return valid('image/png', buf.readUInt32BE(16), buf.readUInt32BE(20));
  }

  // GIF
  const gif = buf.toString('latin1', 0, 6);
  if (gif === 'GIF87a' || gif === 'GIF89a') return valid('image/gif', buf.readUInt16LE(6), buf.readUInt16LE(8));

  // WebP：RIFF....WEBP + VP8/VP8L/VP8X
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP' && buf.length >= 30) {
    const chunk = buf.toString('latin1', 12, 16);
    if (chunk === 'VP8X') return valid('image/webp', 1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3));
    if (chunk === 'VP8L' && buf[20] === 0x2f) {
      const b = buf.readUInt32LE(21);
      return valid('image/webp', (b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1);
    }
    if (chunk === 'VP8 ' && buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a) {
      return valid('image/webp', buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff);
    }
    return null;
  }

  // JPEG：SOI 后逐段查找 SOF 段
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) return null;
      const marker = buf[off + 1]!;
      if (marker === 0xff) { off += 1; continue; }
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { off += 2; continue; }
      const len = buf.readUInt16BE(off + 2);
      if (len < 2) return null;
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return valid('image/jpeg', buf.readUInt16BE(off + 7), buf.readUInt16BE(off + 5));
      off += 2 + len;
    }
    return null;
  }
  return null;
}

function valid(mediaType: ImageInfo['mediaType'], width: number, height: number): ImageInfo | null {
  return width > 0 && height > 0 ? { mediaType, width, height } : null;
}
