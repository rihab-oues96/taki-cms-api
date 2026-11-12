import { ApiError } from "../../utils/ApiError.js";
import { ContentType } from "../entries/contentType.model.js";
import { Entry } from "../entries/entry.model.js";
import { Section } from "../sections/section.model.js";

/** Published content of a page, keyed by section. Hidden sections are simply absent. */
export async function getPageContent(page: string, preview: boolean) {
  const sections = await Section.find({ page, visible: true }).sort({ order: 1 }).select("key content draft order").lean();
  const content: Record<string, unknown> = {};
  for (const s of sections) content[s.key] = preview && s.draft ? s.draft : s.content;
  return { page, order: sections.map((s) => s.key), sections: content };
}

type EntryRow = { _id: unknown; slug?: string | null; data: unknown; draft?: unknown; updatedAt?: Date };

function flatten(e: EntryRow, preview: boolean) {
  const data = (preview && e.draft ? e.draft : e.data) as Record<string, unknown>;
  // `_id` (not `id`): some content types have their own `id` field, e.g. a YouTube id.
  return { ...data, _id: String(e._id), ...(e.slug ? { slug: e.slug } : {}), updatedAt: e.updatedAt };
}

export async function getEntries(type: string, preview: boolean) {
  if (!(await ContentType.exists({ key: type }))) throw ApiError.notFound("Type de contenu introuvable");
  const entries = await Entry.find({ type, visible: true }).sort({ order: 1, createdAt: 1 }).select("slug data draft updatedAt").lean();
  return entries.map((e) => flatten(e, preview));
}

export async function getEntryBySlug(type: string, slug: string, preview: boolean) {
  const entry = await Entry.findOne({ type, slug, visible: true }).select("slug data draft updatedAt").lean();
  if (!entry) throw ApiError.notFound("Contenu introuvable");
  return flatten(entry, preview);
}
