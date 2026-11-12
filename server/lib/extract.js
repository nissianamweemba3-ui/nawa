// Text extraction for document intelligence. Supports plain text, Markdown, CSV, HTML and .docx.
// The .docx reader is a minimal ZIP central-directory parser using node:zlib (no third-party code).
import zlib from 'node:zlib';
import { decodeEntities, htmlToText } from './html-text.js';

export { htmlToText } from './html-text.js';

export const SUPPORTED_TYPES = {
  'text/plain': 'text',
  'text/markdown': 'text',
  'text/csv': 'text',
  'text/html': 'html',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

const MAX_ENTRY_BYTES = 20 * 1024 * 1024; // zip-bomb guard for decompressed XML

function readZipEntry(buf, wantedName) {
  // Locate End Of Central Directory record (signature 0x06054b50) scanning backwards.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error('Not a valid .docx (zip) file');
  const entries = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < entries; n++) {
    if (ptr + 46 > buf.length || buf.readUInt32LE(ptr) !== 0x02014b50) throw new Error('Corrupt zip central directory');
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const uncompSize = buf.readUInt32LE(ptr + 24);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.subarray(ptr + 46, ptr + 46 + nameLen).toString('utf8');
    if (name === wantedName) {
      if (uncompSize > MAX_ENTRY_BYTES) throw new Error('Document too large to analyse');
      if (buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('Corrupt zip local header');
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(start, start + compSize);
      if (method === 0) return data;
      if (method === 8) return zlib.inflateRawSync(data, { maxOutputLength: MAX_ENTRY_BYTES });
      throw new Error('Unsupported zip compression method');
    }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('word/document.xml not found in .docx');
}

export function docxToText(buf) {
  const xml = readZipEntry(buf, 'word/document.xml').toString('utf8');
  const paragraphs = xml.split(/<\/w:p>/).map((p) => {
    const runs = [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]);
    return decodeEntities(runs.join(''));
  });
  return paragraphs.filter((t) => t.trim()).join('\n');
}

export function extractText(mime, buffer) {
  const kind = SUPPORTED_TYPES[mime];
  if (!kind) throw new Error(`Unsupported document type for analysis: ${mime}`);
  if (kind === 'docx') return docxToText(buffer);
  const text = buffer.toString('utf8');
  return kind === 'html' ? htmlToText(text) : text;
}
