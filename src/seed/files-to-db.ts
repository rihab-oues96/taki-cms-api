/**
 * One-off migration for FILE_STORAGE=db: copies the files of the uploads folders into MongoDB.
 *
 *   MONGODB_URI=<target database> FILE_STORAGE=db npm run migrate:files
 *
 * Files already present in the database are skipped, so running it twice changes nothing.
 */
import { readdir, readFile } from "node:fs/promises";
import mongoose from "mongoose";
import { connectDb, disconnectDb } from "../config/db.js";
import { Media } from "../modules/media/media.model.js";
import { Submission } from "../modules/submissions/submission.model.js";
import { diskPath, inDb, putFile, type Bucket } from "../utils/storage.js";

async function copy(bucket: Bucket, filename: string, contentType: string): Promise<boolean> {
  const exists = await mongoose.connection.db!.collection(`${bucket}.files`).findOne({ filename });
  if (exists) return false;
  await putFile(bucket, filename, await readFile(diskPath(bucket, filename)), contentType);
  return true;
}

async function main() {
  if (!inDb) throw new Error("Set FILE_STORAGE=db to run this migration");
  await connectDb();
  for (const bucket of ["uploads", "cv"] as const) {
    const names = await readdir(diskPath(bucket, "."), { withFileTypes: true }).catch(() => []);
    let copied = 0;
    for (const entry of names) {
      if (!entry.isFile() || entry.name.startsWith(".")) continue;
      const doc =
        bucket === "uploads"
          ? await Media.findOne({ storage: "upload", filename: entry.name }).select("mimeType").lean()
          : ((await Submission.findOne({ "cv.filename": entry.name }).select("cv").lean()) as { cv?: { mimeType: string } } | null)?.cv;
      if (!doc) {
        console.log(`[files] ${bucket}/${entry.name}: not referenced in the database, skipped`);
        continue;
      }
      if (await copy(bucket, entry.name, doc.mimeType)) copied++;
    }
    console.log(`[files] ${bucket}: ${copied} file(s) copied`);
  }
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
