import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import type { AuthUser } from "../../types/express.js";
import { ApiError } from "../../utils/ApiError.js";
import { countReferences, replaceReferences } from "../../utils/fields.js";
import { logger } from "../../utils/logger.js";
import { escapeRegex, slugify } from "../../utils/text.js";
import { Entry } from "../entries/entry.model.js";
import { Section } from "../sections/section.model.js";
import { Media } from "./media.model.js";
import { ruleForMime } from "./media.rules.js";

type MediaLean = NonNullable<Awaited<ReturnType<typeof findLean>>>;
const findLean = (id: string) => Media.findById(id).lean();

export function toMedia(m: MediaLean) {
  return {
    id: String(m._id),
    url: m.url,
    storage: m.storage,
    filename: m.filename,
    originalName: m.originalName,
    mimeType: m.mimeType,
    kind: m.kind,
    size: m.size,
    alt: m.alt,
    folder: m.folder,
    uploadedByName: m.uploadedByName,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

/** Verifies the real file type and size, then writes it under a random name. */
async function store(file: Express.Multer.File) {
  const rule = ruleForMime(file.mimetype);
  if (!rule || !rule.matches(file.buffer)) {
    throw ApiError.badRequest(`Le contenu de « ${file.originalname} » ne correspond pas à un type de fichier autorisé`);
  }
  if (file.size > rule.maxBytes) {
    throw ApiError.badRequest(`« ${file.originalname} » dépasse la taille maximale (${Math.round(rule.maxBytes / 1024 / 1024)} Mo)`);
  }
  // The stored name never comes from the client: no path traversal, no overwrite, no executable extension.
  const base = slugify(path.parse(file.originalname).name).slice(0, 40) || "fichier";
  const filename = `${base}-${randomBytes(6).toString("hex")}.${rule.ext}`;
  await mkdir(env.uploadDir, { recursive: true });
  await writeFile(path.join(env.uploadDir, filename), file.buffer, { flag: "wx" });
  return { filename, url: `/uploads/${filename}`, rule };
}

async function removeFile(filename: string) {
  try {
    await unlink(path.join(env.uploadDir, path.basename(filename)));
  } catch (err) {
    logger.warn({ err: (err as Error).message, filename }, "Could not delete media file");
  }
}

export async function listMedia(q: { search?: string; kind?: string; folder?: string; page: number; limit: number }) {
  const filter: Record<string, unknown> = {};
  if (q.kind) filter.kind = q.kind;
  if (q.folder !== undefined) filter.folder = q.folder;
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), "i");
    filter.$or = [{ originalName: rx }, { alt: rx }, { url: rx }];
  }
  const [items, total, folders] = await Promise.all([
    Media.find(filter).sort({ createdAt: -1, _id: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Media.countDocuments(filter),
    Media.distinct("folder"),
  ]);
  return { items: items.map(toMedia), total, folders: folders.filter(Boolean).sort() };
}

export async function uploadMedia(actor: AuthUser, files: Express.Multer.File[], meta: { folder: string; alt: string }) {
  if (!files.length) throw ApiError.badRequest("Aucun fichier reçu");
  const created = [];
  for (const file of files) {
    const { filename, url, rule } = await store(file);
    const doc = await Media.create({
      url,
      storage: "upload",
      filename,
      originalName: file.originalname.slice(0, 200),
      mimeType: rule.mime,
      kind: rule.kind,
      size: file.size,
      alt: meta.alt,
      folder: meta.folder,
      uploadedBy: actor.id,
      uploadedByName: actor.name,
    });
    created.push(toMedia(doc.toObject() as MediaLean));
  }
  return created;
}

export async function updateMedia(id: string, input: { alt?: string; folder?: string }) {
  const media = await Media.findByIdAndUpdate(id, input, { new: true }).lean();
  if (!media) throw ApiError.notFound("Média introuvable");
  return toMedia(media);
}

/** Where a media URL is referenced, in published content and drafts. */
export async function findUsage(url: string) {
  const [sections, entries] = await Promise.all([
    Section.find().select("page key label content draft").lean(),
    Entry.find().select("type title data draft").lean(),
  ]);
  const usage: { kind: "section" | "entry"; id: string; label: string; context: string }[] = [];
  for (const s of sections) {
    if (countReferences(s.content, url) + countReferences(s.draft, url) > 0) {
      usage.push({ kind: "section", id: String(s._id), label: s.label, context: s.page });
    }
  }
  for (const e of entries) {
    if (countReferences(e.data, url) + countReferences(e.draft, url) > 0) {
      usage.push({ kind: "entry", id: String(e._id), label: e.title, context: e.type });
    }
  }
  return usage;
}

export async function getMedia(id: string) {
  const media = await findLean(id);
  if (!media) throw ApiError.notFound("Média introuvable");
  return { ...toMedia(media), usage: await findUsage(media.url) };
}

async function rewriteReferences(from: string, to: string): Promise<number> {
  let changed = 0;
  for (const s of await Section.find().select("content draft")) {
    if (countReferences(s.content, from) + countReferences(s.draft, from) === 0) continue;
    s.set("content", replaceReferences(s.content, from, to));
    if (s.draft) s.set("draft", replaceReferences(s.draft, from, to));
    await s.save();
    changed++;
  }
  for (const e of await Entry.find().select("data draft")) {
    if (countReferences(e.data, from) + countReferences(e.draft, from) === 0) continue;
    e.set("data", replaceReferences(e.data, from, to));
    if (e.draft) e.set("draft", replaceReferences(e.draft, from, to));
    await e.save();
    changed++;
  }
  return changed;
}

/** Swaps the file behind a media item and updates every piece of content that used it. */
export async function replaceMedia(actor: AuthUser, id: string, file: Express.Multer.File | undefined) {
  if (!file) throw ApiError.badRequest("Aucun fichier reçu");
  const media = await Media.findById(id);
  if (!media) throw ApiError.notFound("Média introuvable");

  const { filename, url, rule } = await store(file);
  const previous = { url: media.url, filename: media.filename, storage: media.storage };

  media.set({
    url,
    storage: "upload",
    filename,
    originalName: file.originalname.slice(0, 200),
    mimeType: rule.mime,
    kind: rule.kind,
    size: file.size,
    uploadedBy: actor.id,
    uploadedByName: actor.name,
  });
  await media.save();

  const updatedReferences = await rewriteReferences(previous.url, url);
  if (previous.storage === "upload") await removeFile(previous.filename);
  return { media: toMedia(media.toObject() as MediaLean), updatedReferences };
}

export async function deleteMedia(id: string, force: boolean) {
  const media = await Media.findById(id);
  if (!media) throw ApiError.notFound("Média introuvable");
  const usage = await findUsage(media.url);
  if (usage.length && !force) {
    throw ApiError.conflict("Ce média est utilisé dans du contenu", { usage });
  }
  await media.deleteOne();
  if (media.storage === "upload") await removeFile(media.filename);
  return toMedia(media.toObject() as MediaLean);
}
