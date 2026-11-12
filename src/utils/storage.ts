import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { env } from "../config/env.js";

/**
 * Where uploaded files live.
 *
 * - `disk` (default): on the server's disk, which must then be a persistent volume.
 * - `db` (FILE_STORAGE=db): in MongoDB (GridFS), for hosts whose disk is wiped on every restart.
 *
 * `uploads` is the public media library, `cv` the private CVs of job applications.
 */
export type Bucket = "uploads" | "cv";

export const inDb = env.FILE_STORAGE === "db";

const DIRS: Record<Bucket, string> = {
  uploads: env.uploadDir,
  cv: path.join(env.privateUploadDir, "cv"),
};

/** Path of a file in `disk` mode. The name is reduced to its base: no traversal. */
export const diskPath = (bucket: Bucket, filename: string) => path.join(DIRS[bucket], path.basename(filename));

function gridfs(bucket: Bucket) {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB is not connected");
  return new mongoose.mongo.GridFSBucket(db, { bucketName: bucket });
}

export async function putFile(bucket: Bucket, filename: string, buffer: Buffer, contentType: string): Promise<void> {
  if (!inDb) {
    await mkdir(DIRS[bucket], { recursive: true });
    await writeFile(diskPath(bucket, filename), buffer, { flag: "wx", mode: bucket === "cv" ? 0o600 : 0o644 });
    return;
  }
  await new Promise<void>((resolve, reject) => {
    gridfs(bucket)
      .openUploadStream(filename, { metadata: { contentType } })
      .on("error", reject)
      .on("finish", () => resolve())
      .end(buffer);
  });
}

/** Throws when the file cannot be deleted or does not exist. */
export async function deleteFile(bucket: Bucket, filename: string): Promise<void> {
  if (!inDb) return unlink(diskPath(bucket, filename));
  const fs = gridfs(bucket);
  const files = await fs.find({ filename }).toArray();
  if (!files.length) throw new Error("File not found");
  for (const f of files) await fs.delete(f._id);
}

/**
 * Streams a file stored in MongoDB as the response body (`db` mode only).
 * Supports conditional requests and a single byte range (video playback needs it).
 * Returns false, without touching the response, when the file does not exist.
 */
export async function sendDbFile(req: Request, res: Response, bucket: Bucket, filename: string, opts: { cache: boolean }): Promise<boolean> {
  const fs = gridfs(bucket);
  const [file] = await fs.find({ filename }).limit(1).toArray();
  if (!file) return false;

  const size = file.length;
  let start = 0;
  let end = size - 1;

  if (opts.cache) {
    const etag = `"${file._id.toString()}"`;
    res.setHeader("ETag", etag);
    res.setHeader("Accept-Ranges", "bytes");
    if (req.get("if-none-match") === etag) {
      res.status(304).end();
      return true;
    }
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.get("range") ?? "");
    if (range && (range[1] || range[2])) {
      if (range[1]) {
        start = Number(range[1]);
        if (range[2]) end = Math.min(Number(range[2]), size - 1);
      } else {
        start = Math.max(size - Number(range[2]), 0);
      }
      if (start > end || start >= size) {
        res.status(416).setHeader("Content-Range", `bytes */${size}`).end();
        return true;
      }
      res.status(206).setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    }
  }

  const contentType = (file.metadata as { contentType?: string } | undefined)?.contentType;
  if (contentType && !res.getHeader("Content-Type")) res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", end - start + 1);
  if (req.method === "HEAD" || size === 0) {
    res.end();
    return true;
  }

  await new Promise<void>((resolve, reject) => {
    const stream = fs.openDownloadStream(file._id, { start, end: end + 1 });
    stream.on("error", (err) => (res.headersSent ? (res.destroy(), resolve()) : reject(err)));
    res.on("close", () => {
      stream.destroy();
      resolve();
    });
    stream.pipe(res);
  });
  return true;
}
