import { Inflate, strFromU8 } from 'fflate';

type Entry = { name: string; originalSize: number; size: number; compression: number; dataStart: number };

/** Validate ZIP metadata before fflate allocates output buffers. ZIP64/multi-disk are unnecessary for 64 MB scene packs. */
export function inspectZip(bytes: Uint8Array): Entry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (offset: number) => view.getUint16(offset, true);
  const u32 = (offset: number) => view.getUint32(offset, true);
  const reject = (): never => { throw new Error('无法读取 ZIP：文件头无效、加密或包含不支持的条目，请重新导出普通 ZIP。'); };
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) && u32(end) !== 0x06054b50) end--;
  if (end < 0 || end < bytes.length - 65557 || end + 22 + u16(end + 20) !== bytes.length) reject();
  const count = u16(end + 10), central = u32(end + 16);
  if (u16(end + 4) || u16(end + 6) || u16(end + 8) !== count || count > 512 || central + u32(end + 12) !== end) reject();
  const entries: Entry[] = [];
  const ranges: { start: number; end: number }[] = [];
  let cursor = central;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || u32(cursor) !== 0x02014b50) reject();
    const flags = u16(cursor + 8), compression = u16(cursor + 10);
    const size = u32(cursor + 20), originalSize = u32(cursor + 24);
    const nameLength = u16(cursor + 28), extraLength = u16(cursor + 30), commentLength = u16(cursor + 32);
    const local = u32(cursor + 42), next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > end || flags & 0x2041 || u16(cursor + 34) || ((u32(cursor + 38) >>> 16) & 0xf000) === 0xa000 || ![0, 8].includes(compression)) reject();
    if (compression === 0 && size !== originalSize) reject();
    if (local + 30 > central || u32(local) !== 0x04034b50 || u16(local + 6) !== flags || u16(local + 8) !== compression) reject();
    const localNameLength = u16(local + 26), localExtraLength = u16(local + 28);
    const dataStart = local + 30 + localNameLength + localExtraLength;
    if (dataStart + size > central || nameLength !== localNameLength) reject();
    for (let n = 0; n < nameLength; n++) if (bytes[cursor + 46 + n] !== bytes[local + 30 + n]) reject();
    // With bit 3, stream writers place the sizes and CRC in a data descriptor instead.
    if (!(flags & 8) && (u32(local + 18) !== size || u32(local + 22) !== originalSize || u32(local + 14) !== u32(cursor + 16))) reject();
    ranges.push({ start: local, end: dataStart + size });
    entries.push({ name: strFromU8(bytes.subarray(cursor + 46, cursor + 46 + nameLength), !(flags & 2048)), originalSize, size, compression, dataStart });
    cursor = next;
  }
  if (cursor !== end) reject();
  ranges.sort((a, b) => a.start - b.start);
  for (let i = 1; i < ranges.length; i++) if (ranges[i].start < ranges[i - 1].end) reject();
  return entries;
}

export function extractEntry(bytes: Uint8Array, entry: Entry): Uint8Array {
  const input = bytes.subarray(entry.dataStart, entry.dataStart + entry.size);
  if (entry.compression === 0) return input.slice();
  let length = 0;
  const chunks: Uint8Array[] = [];
  const inflater = new Inflate(chunk => {
    length += chunk.length;
    if (length > entry.originalSize) throw new Error('ZIP 实际解压体积超过声明大小。');
    chunks.push(chunk);
  });
  // Small input chunks bound temporary output even when the declared size is forged.
  for (let offset = 0; offset < input.length; offset += 1024) inflater.push(input.subarray(offset, offset + 1024), offset + 1024 >= input.length);
  if (length !== entry.originalSize) throw new Error('ZIP 解压后的文件大小不一致。');
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}
