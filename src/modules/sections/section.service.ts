import type { AuthUser } from "../../types/express.js";
import type { FieldDef } from "../../types/content.js";
import { can } from "../../config/permissions.js";
import { ApiError } from "../../utils/ApiError.js";
import { sanitizeContent } from "../../utils/fields.js";
import { Page } from "../pages/page.model.js";
import { Section } from "./section.model.js";

type SectionLean = NonNullable<Awaited<ReturnType<typeof findLean>>>;
const findLean = (id: string) => Section.findById(id).lean();

export function toSection(s: SectionLean, withContent = true) {
  return {
    id: String(s._id),
    page: s.page,
    key: s.key,
    label: s.label,
    description: s.description,
    order: s.order,
    visible: s.visible,
    restricted: s.restricted,
    hasDraft: s.draft !== null && s.draft !== undefined,
    draftUpdatedAt: s.draftUpdatedAt,
    publishedAt: s.publishedAt,
    updatedAt: s.updatedAt,
    updatedByName: s.updatedByName,
    ...(withContent ? { fields: s.fields as FieldDef[], content: s.content, draft: s.draft ?? null } : {}),
  };
}

function assertAccess(actor: AuthUser, section: { restricted: boolean }) {
  if (section.restricted && !can(actor.role, "settings:manage")) {
    throw ApiError.forbidden("Cette section est réservée aux administrateurs");
  }
}

function clean(fields: FieldDef[], raw: unknown) {
  const { value, issues } = sanitizeContent(fields, raw);
  if (issues.length) throw ApiError.validation(issues);
  return value;
}

async function load(actor: AuthUser, id: string) {
  const section = await Section.findById(id);
  if (!section) throw ApiError.notFound("Section introuvable");
  assertAccess(actor, section);
  return section;
}

function stamp(section: { set(values: Record<string, unknown>): unknown }, actor: AuthUser) {
  section.set({ updatedBy: actor.id, updatedByName: actor.name });
}

export async function listSections(actor: AuthUser, page?: string) {
  const sections = await Section.find(page ? { page } : {}).sort({ page: 1, order: 1 }).select("-content -fields").lean();
  return sections
    .filter((s) => !s.restricted || can(actor.role, "settings:manage"))
    .map((s) => toSection(s as SectionLean, false));
}

export async function getSection(actor: AuthUser, id: string) {
  const section = await findLean(id);
  if (!section) throw ApiError.notFound("Section introuvable");
  assertAccess(actor, section);
  return toSection(section);
}

export async function createSection(
  actor: AuthUser,
  input: { page: string; key: string; label: string; description: string; fields: FieldDef[]; restricted: boolean },
) {
  if (!(await Page.exists({ key: input.page }))) throw ApiError.badRequest("Page inconnue");
  if (await Section.exists({ page: input.page, key: input.key })) {
    throw ApiError.conflict("Une section porte déjà cet identifiant sur cette page");
  }
  const last = await Section.findOne({ page: input.page }).sort({ order: -1 }).select("order").lean();
  const section = await Section.create({
    ...input,
    order: (last?.order ?? -1) + 1,
    // New sections start hidden and empty: nothing appears on the site until it is filled and shown.
    visible: false,
    content: clean(input.fields, {}),
    updatedBy: actor.id,
    updatedByName: actor.name,
  });
  return toSection(section.toObject() as SectionLean);
}

export async function updateSection(
  actor: AuthUser,
  id: string,
  input: Partial<{ label: string; description: string; visible: boolean; fields: FieldDef[]; restricted: boolean }>,
) {
  const section = await load(actor, id);
  const structural = input.fields !== undefined || input.restricted !== undefined;
  if (structural && !can(actor.role, "content:structure")) throw ApiError.forbidden();
  if (input.visible !== undefined && !can(actor.role, "content:publish")) throw ApiError.forbidden();

  const visibilityChanged = input.visible !== undefined && input.visible !== section.visible;
  if (input.label !== undefined) section.label = input.label;
  if (input.description !== undefined) section.description = input.description;
  if (input.visible !== undefined) section.visible = input.visible;
  if (input.restricted !== undefined) section.restricted = input.restricted;
  if (input.fields !== undefined) {
    section.set("fields", input.fields);
    // Re-shape stored values to the new structure (removed fields are dropped, new ones start empty).
    section.set("content", sanitizeContent(input.fields, section.content).value);
    if (section.draft) section.set("draft", sanitizeContent(input.fields, section.draft).value);
  }
  stamp(section, actor);
  await section.save();
  return { section: toSection(section.toObject() as SectionLean), visibilityChanged, affectsSite: visibilityChanged || input.fields !== undefined };
}

export async function saveDraft(actor: AuthUser, id: string, content: unknown) {
  const section = await load(actor, id);
  section.set("draft", clean(section.fields as FieldDef[], content));
  section.draftUpdatedAt = new Date();
  stamp(section, actor);
  await section.save();
  return toSection(section.toObject() as SectionLean);
}

export async function discardDraft(actor: AuthUser, id: string) {
  const section = await load(actor, id);
  section.set("draft", null);
  section.draftUpdatedAt = null;
  await section.save();
  return toSection(section.toObject() as SectionLean);
}

/** Publishes the given content, or the saved draft when no content is sent. */
export async function publish(actor: AuthUser, id: string, content?: unknown) {
  const section = await load(actor, id);
  const next = content !== undefined ? clean(section.fields as FieldDef[], content) : section.draft;
  if (next === null || next === undefined) throw ApiError.badRequest("Aucune modification à publier");
  section.set("content", next);
  section.set("draft", null);
  section.draftUpdatedAt = null;
  section.publishedAt = new Date();
  stamp(section, actor);
  await section.save();
  return toSection(section.toObject() as SectionLean);
}

export async function deleteSection(actor: AuthUser, id: string) {
  const section = await load(actor, id);
  await section.deleteOne();
  return toSection(section.toObject() as SectionLean, false);
}

export async function reorder(actor: AuthUser, page: string, ids: string[]) {
  const sections = await Section.find({ page }).select("_id restricted").lean();
  const known = new Set(sections.map((s) => String(s._id)));
  if (ids.some((id) => !known.has(id))) throw ApiError.badRequest("Liste de sections invalide");
  await Section.bulkWrite(ids.map((id, order) => ({ updateOne: { filter: { _id: id, page }, update: { $set: { order } } } })));
  return listSections(actor, page);
}
