import type { MEDIA_KINDS } from "./media.model.js";

type Kind = (typeof MEDIA_KINDS)[number];

export interface FileRule {
  mime: string;
  ext: string;
  kind: Kind;
  maxBytes: number;
  /** Checks the first bytes so a renamed file cannot pass as another type. */
  matches: (buf: Buffer) => boolean;
}

const MB = 1024 * 1024;
const starts = (buf: Buffer, bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b);
const ascii = (buf: Buffer, start: number, end: number) => buf.subarray(start, end).toString("latin1");

/** A deliberately strict SVG check: anything able to run script or load remote content is refused. */
function safeSvg(buf: Buffer): boolean {
  const text = buf.toString("utf8");
  if (!/<svg[\s>]/i.test(text.slice(0, 2048))) return false;
  return !/<script|<foreignObject|<iframe|<embed|<object|\son\w+\s*=|javascript:|<!ENTITY|xlink:href\s*=\s*["'](?!#|data:image\/)/i.test(text);
}

export const FILE_RULES: FileRule[] = [
  { mime: "image/jpeg", ext: "jpg", kind: "image", maxBytes: 8 * MB, matches: (b) => starts(b, [0xff, 0xd8, 0xff]) },
  { mime: "image/png", ext: "png", kind: "image", maxBytes: 8 * MB, matches: (b) => starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { mime: "image/webp", ext: "webp", kind: "image", maxBytes: 8 * MB, matches: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP" },
  { mime: "image/gif", ext: "gif", kind: "image", maxBytes: 8 * MB, matches: (b) => ["GIF87a", "GIF89a"].includes(ascii(b, 0, 6)) },
  { mime: "image/avif", ext: "avif", kind: "image", maxBytes: 8 * MB, matches: (b) => ascii(b, 4, 8) === "ftyp" && /avif|avis/.test(ascii(b, 8, 32)) },
  { mime: "image/svg+xml", ext: "svg", kind: "image", maxBytes: 1 * MB, matches: safeSvg },
  { mime: "video/mp4", ext: "mp4", kind: "video", maxBytes: 80 * MB, matches: (b) => ascii(b, 4, 8) === "ftyp" },
  { mime: "video/webm", ext: "webm", kind: "video", maxBytes: 80 * MB, matches: (b) => starts(b, [0x1a, 0x45, 0xdf, 0xa3]) },
  { mime: "application/pdf", ext: "pdf", kind: "document", maxBytes: 20 * MB, matches: (b) => ascii(b, 0, 5) === "%PDF-" },
];

export const MAX_UPLOAD_BYTES = Math.max(...FILE_RULES.map((r) => r.maxBytes));
export const ruleForMime = (mime: string) => FILE_RULES.find((r) => r.mime === mime);
