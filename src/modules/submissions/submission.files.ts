import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import type { CvFile } from "./submission.model.js";

/**
 * CVs received with job applications.
 *
 * They are personal documents sent by strangers, so unlike the media library:
 * - they are stored outside the statically served uploads folder and are only reachable
 *   through the authenticated download route;
 * - the type is decided from the file's content, never from the name or the type the browser announced;
 * - only PDF and Word (.docx) are accepted; documents carrying macros are refused.
 */
export const CV_MAX_BYTES = 5 * 1024 * 1024;

const CV_DIR = path.join(env.privateUploadDir, "cv");

interface CvRule {
  mime: string;
  ext: string;
  matches: (buf: Buffer) => boolean;
}

const isZip = (b: Buffer) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

const CV_RULES: CvRule[] = [
  { mime: "application/pdf", ext: "pdf", matches: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: "docx",
    // A .docx is a zip whose (uncompressed) file names include the document part; a macro project makes it a .docm.
    matches: (b) => isZip(b) && b.includes("word/document.xml") && b.includes("[Content_Types].xml") && !b.includes("vbaProject"),
  },
];

/** Held in memory until the content has been checked; nothing unchecked touches the disk. */
export const cvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CV_MAX_BYTES, files: 1, fields: 12, fieldSize: 20_000 },
});

const invalid = (message: string) => ApiError.validation([{ path: "cv", message }]);

export function checkCv(file: Express.Multer.File | undefined): CvRule {
  if (!file || file.size === 0) throw invalid("Veuillez joindre votre CV (PDF ou Word .docx)");
  if (file.size > CV_MAX_BYTES) throw invalid(`Le CV dépasse la taille maximale (${CV_MAX_BYTES / 1024 / 1024} Mo)`);
  const rule = CV_RULES.find((r) => r.matches(file.buffer));
  if (!rule) throw invalid("Format de CV non accepté : envoyez un fichier PDF ou Word (.docx)");
  return rule;
}

/** Writes a checked CV under a random name: nothing in the path comes from the visitor. */
export async function storeCv(file: Express.Multer.File, rule: CvRule): Promise<CvFile> {
  const filename = `${randomBytes(16).toString("hex")}.${rule.ext}`;
  await mkdir(CV_DIR, { recursive: true });
  await writeFile(path.join(CV_DIR, filename), file.buffer, { flag: "wx", mode: 0o600 });
  // eslint-disable-next-line no-control-regex
  const originalName = path.basename(file.originalname).replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 200) || `cv.${rule.ext}`;
  return { filename, originalName, mimeType: rule.mime, size: file.size };
}

export const cvPath = (cv: Pick<CvFile, "filename">) => path.join(CV_DIR, path.basename(cv.filename));

export async function removeCv(cv: Pick<CvFile, "filename">): Promise<void> {
  try {
    await unlink(cvPath(cv));
  } catch (err) {
    logger.warn({ err: (err as Error).message, filename: cv.filename }, "Could not delete CV file");
  }
}
