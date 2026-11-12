import type { AuthUser } from "../../types/express.js";
import type { FieldDef } from "../../types/content.js";
import { ApiError } from "../../utils/ApiError.js";
import { sanitizeContent } from "../../utils/fields.js";
import { escapeRegex, slugify } from "../../utils/text.js";
import { ContentType } from "./contentType.model.js";
import { Entry } from "./entry.model.js";

type EntryLean = NonNullable<Awaited<ReturnType<typeof findLean>>>;
const findLean = (id: string) => Entry.findById(id).lean();
type TypeLean = NonNullable<Awaited<ReturnType<typeof findType>>>;
const findType = (key: string) => ContentType.findOne({ key }).lean();

export function toContentType(t: TypeLean, count?: number) {
  return {
    key: t.key,
    label: t.label,
    singular: t.singular,
    description: t.description,
    fields: t.fields as FieldDef[],
    titleField: t.titleField,
    subtitleField: t.subtitleField,
    imageField: t.imageField,
    hasSlug: t.hasSlug,
    previewPath: t.previewPath,
    ...(count !== undefined ? { count } : {}),
  };
}

export function toEntry(e: EntryLean, withData = true) {
  return {
    id: String(e._id),
    type: e.type,
    slug: e.slug ?? null,
    title: e.title,
    order: e.order,
    visible: e.visible,
    hasDraft: e.draft !== null && e.draft !== undefined,
    draftUpdatedAt: e.draftUpdatedAt,
    publishedAt: e.publishedAt,
    updatedAt: e.updatedAt,
    updatedByName: e.updatedByName,
    data: withData ? e.data : undefined,
    ...(withData ? { draft: e.draft ?? null } : {}),
  };
}

async function requireType(key: string) {
  const type = await findType(key);
  if (!type) throw ApiError.badRequest("Type de contenu inconnu");
  return type;
}

function clean(type: TypeLean, raw: unknown) {
  const { value, issues } = sanitizeContent(type.fields as FieldDef[], raw);
  if (issues.length) throw ApiError.validation(issues);
  return value;
}

function titleOf(type: TypeLean, data: Record<string, unknown>): string {
  const v = data[type.titleField];
  return typeof v === "string" ? v.replace(/\*/g, "").slice(0, 300) : "";
}

async function uniqueSlug(type: string, wanted: string, excludeId?: string): Promise<string> {
  const base = slugify(wanted) || "element";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const clash = await Entry.exists({ type, slug: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
    if (!clash) return candidate;
  }
  throw ApiError.conflict("Impossible de générer un identifiant d'URL unique");
}

/* ----------------------------- content types ----------------------------- */

export async function listContentTypes() {
  const [types, counts] = await Promise.all([
    ContentType.find().sort({ order: 1, label: 1 }).lean(),
    Entry.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$type", n: { $sum: 1 } } }]),
  ]);
  const byType = new Map(counts.map((c) => [c._id, c.n]));
  return types.map((t) => toContentType(t, byType.get(t.key) ?? 0));
}

export async function getContentType(key: string) {
  const type = await findType(key);
  if (!type) throw ApiError.notFound("Type de contenu introuvable");
  return toContentType(type, await Entry.countDocuments({ type: key }));
}

function assertFieldRefs(input: { fields?: FieldDef[]; titleField?: string }, fields: FieldDef[]) {
  if (input.titleField && !fields.some((f) => f.name === input.titleField)) {
    throw ApiError.badRequest("Le champ titre doit exister dans la liste des champs");
  }
}

export async function createContentType(input: Parameters<typeof ContentType.create>[0] & { key: string; fields: FieldDef[]; titleField: string }) {
  if (await ContentType.exists({ key: input.key })) throw ApiError.conflict("Ce type de contenu existe déjà");
  assertFieldRefs(input, input.fields);
  const last = await ContentType.findOne().sort({ order: -1 }).select("order").lean();
  const type = await ContentType.create({ ...input, order: (last?.order ?? -1) + 1 });
  return toContentType(type.toObject() as TypeLean, 0);
}

export async function updateContentType(key: string, input: Partial<{ fields: FieldDef[]; titleField: string }> & Record<string, unknown>) {
  const type = await ContentType.findOne({ key });
  if (!type) throw ApiError.notFound("Type de contenu introuvable");
  assertFieldRefs({ titleField: input.titleField ?? type.titleField }, input.fields ?? (type.fields as FieldDef[]));
  type.set(input);
  await type.save();
  return getContentType(key);
}

/* -------------------------------- entries -------------------------------- */

export async function listEntries(q: { type: string; search?: string; status?: string; page: number; limit: number }) {
  await requireType(q.type);
  const filter: Record<string, unknown> = { type: q.type };
  if (q.search) filter.title = new RegExp(escapeRegex(q.search), "i");
  if (q.status === "visible") filter.visible = true;
  if (q.status === "hidden") filter.visible = false;
  if (q.status === "draft") filter.draft = { $ne: null };

  const [items, total] = await Promise.all([
    Entry.find(filter).sort({ order: 1, createdAt: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Entry.countDocuments(filter),
  ]);
  return { items: items.map((e) => toEntry(e)), total };
}

export async function getEntry(id: string) {
  const entry = await findLean(id);
  if (!entry) throw ApiError.notFound("Contenu introuvable");
  return toEntry(entry);
}

export async function createEntry(actor: AuthUser, input: { type: string; data: unknown; slug?: string; visible: boolean }) {
  const type = await requireType(input.type);
  const data = clean(type, input.data);
  const title = titleOf(type, data);
  const first = await Entry.findOne({ type: input.type }).sort({ order: 1 }).select("order").lean();
  const entry = await Entry.create({
    type: input.type,
    data,
    title,
    visible: input.visible,
    // Newest first: new entries go to the top of the list.
    order: (first?.order ?? 1) - 1,
    ...(type.hasSlug ? { slug: await uniqueSlug(input.type, input.slug ?? title) } : {}),
    publishedAt: new Date(),
    updatedBy: actor.id,
    updatedByName: actor.name,
  });
  return toEntry(entry.toObject() as EntryLean);
}

async function load(id: string) {
  const entry = await Entry.findById(id);
  if (!entry) throw ApiError.notFound("Contenu introuvable");
  return entry;
}

export async function updateEntry(actor: AuthUser, id: string, input: { visible?: boolean; slug?: string }) {
  const entry = await load(id);
  const visibilityChanged = input.visible !== undefined && input.visible !== entry.visible;
  if (input.visible !== undefined) entry.visible = input.visible;
  if (input.slug !== undefined && input.slug !== entry.slug) {
    const type = await requireType(entry.type);
    if (!type.hasSlug) throw ApiError.badRequest("Ce type de contenu n'a pas d'identifiant d'URL");
    if (await Entry.exists({ type: entry.type, slug: input.slug, _id: { $ne: id } })) {
      throw ApiError.conflict("Cet identifiant d'URL est déjà utilisé");
    }
    entry.slug = input.slug;
  }
  entry.updatedBy = actor.id as never;
  entry.updatedByName = actor.name;
  await entry.save();
  return { entry: toEntry(entry.toObject() as EntryLean), visibilityChanged };
}

export async function saveDraft(actor: AuthUser, id: string, data: unknown) {
  const entry = await load(id);
  const type = await requireType(entry.type);
  entry.set("draft", clean(type, data));
  entry.draftUpdatedAt = new Date();
  entry.updatedBy = actor.id as never;
  entry.updatedByName = actor.name;
  await entry.save();
  return toEntry(entry.toObject() as EntryLean);
}

export async function discardDraft(id: string) {
  const entry = await load(id);
  entry.set("draft", null);
  entry.draftUpdatedAt = null;
  await entry.save();
  return toEntry(entry.toObject() as EntryLean);
}

export async function publish(actor: AuthUser, id: string, data?: unknown) {
  const entry = await load(id);
  const type = await requireType(entry.type);
  const next = data !== undefined ? clean(type, data) : (entry.draft as Record<string, unknown> | null);
  if (!next) throw ApiError.badRequest("Aucune modification à publier");
  entry.set("data", next);
  entry.set("draft", null);
  entry.draftUpdatedAt = null;
  entry.title = titleOf(type, next);
  entry.publishedAt = new Date();
  entry.updatedBy = actor.id as never;
  entry.updatedByName = actor.name;
  await entry.save();
  return toEntry(entry.toObject() as EntryLean);
}

export async function deleteEntry(id: string) {
  const entry = await load(id);
  await entry.deleteOne();
  return toEntry(entry.toObject() as EntryLean, false);
}

export async function reorder(type: string, ids: string[]) {
  const count = await Entry.countDocuments({ type, _id: { $in: ids } });
  if (count !== ids.length) throw ApiError.badRequest("Liste de contenus invalide");
  await Entry.bulkWrite(ids.map((id, order) => ({ updateOne: { filter: { _id: id, type }, update: { $set: { order } } } })));
  return { reordered: ids.length };
}
