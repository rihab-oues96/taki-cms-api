/**
 * One-off migration: YouTube videos used to be stored as bare ids, they are now full links.
 *
 *   npm run migrate:youtube-links
 *
 * For every field the seed files declare as `youtube`, the stored field definition gets the
 * new type and label, and the stored values (published and draft) become links. Everything
 * else is left untouched, and running it twice changes nothing.
 */
import { connectDb, disconnectDb } from "../config/db.js";
import { ContentType } from "../modules/entries/contentType.model.js";
import { Entry } from "../modules/entries/entry.model.js";
import { Section } from "../modules/sections/section.model.js";
import type { FieldDef } from "../types/content.js";
import { inferFields, mergeSamples } from "../utils/fields.js";
import { revalidateSite } from "../utils/site.js";
import { youtubeId, youtubeLink } from "../utils/youtube.js";
import { SEED_MODULES } from "./content/index.js";

const MODULES = Object.values(SEED_MODULES);
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** Ids of the shorts in the video library, to pick the right link for ids used elsewhere. */
const shorts = new Set<string>();

/** Copies type, label and help of the `youtube` fields onto the stored definitions. */
function syncFields(seed: FieldDef[], stored: FieldDef[]) {
  for (const s of seed) {
    const d = stored.find((f) => f.name === s.name);
    if (d) syncField(s, d);
  }
}

function syncField(s: FieldDef, d: FieldDef) {
  if (s.type === "youtube") {
    d.type = "youtube";
    // List items keep their generic label.
    if (d.name !== "item") d.label = s.label;
    if (s.help) d.help = s.help;
  } else if (s.type === "group" && d.fields) {
    syncFields(s.fields ?? [], d.fields);
  } else if (s.type === "list" && s.item && d.item) {
    if (s.item.type === "youtube") {
      d.label = s.label;
      if (s.help) d.help = s.help;
    }
    syncField(s.item, d.item);
  }
}

function convert(field: FieldDef, value: unknown, short: boolean | undefined): unknown {
  if (field.type === "youtube") {
    if (typeof value !== "string" || !value || youtubeId(value)) return value;
    return youtubeLink(value, short ?? shorts.has(value));
  }
  if (field.type === "group") return convertObject(field.fields ?? [], value);
  if (field.type === "list" && field.item && Array.isArray(value)) {
    const item = field.item;
    return value.map((v) => convert(item, v, short));
  }
  return value;
}

function convertObject<T>(fields: FieldDef[], value: T): T {
  if (!isObj(value)) return value;
  // A sibling "format" field says whether the video is a short.
  const short = value.kind === "short" || value.vertical === true ? true : value.kind === "long" || value.vertical === false ? false : undefined;
  const out: Obj = { ...value };
  for (const f of fields) if (f.name in out) out[f.name] = convert(f, out[f.name], short);
  return out as T;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  await connectDb();
  for (const e of await Entry.find({ type: "videos" }).select("data").lean()) {
    const data = e.data as Obj;
    if (data.kind === "short" && typeof data.id === "string") shorts.add(youtubeId(data.id) || data.id);
  }

  let sections = 0;
  for (const s of MODULES.flatMap((m) => m.sections ?? [])) {
    const seedFields = s.fields ?? inferFields(s.content, s.overrides);
    const doc = await Section.findOne({ page: s.page, key: s.key }).select("fields content draft").lean();
    if (!doc) continue;
    const fields = structuredClone(doc.fields) as FieldDef[];
    syncFields(seedFields, fields);
    const next = { fields, content: convertObject(seedFields, doc.content), draft: convertObject(seedFields, doc.draft) };
    if (same(next, { fields: doc.fields, content: doc.content, draft: doc.draft })) continue;
    await Section.updateOne({ _id: doc._id }, { $set: { ...next, description: s.description ?? "" } }, { timestamps: false });
    sections++;
  }

  let entries = 0;
  for (const t of MODULES.flatMap((m) => m.contentTypes ?? [])) {
    const seeds = MODULES.flatMap((m) => m.entries ?? []).filter((e) => e.type === t.key);
    const seedFields = t.fields ?? inferFields(mergeSamples(seeds.map((e) => e.data)), t.overrides);
    const type = await ContentType.findOne({ key: t.key }).select("fields").lean();
    if (!type) continue;
    const fields = structuredClone(type.fields) as FieldDef[];
    syncFields(seedFields, fields);
    if (!same(fields, type.fields)) await ContentType.updateOne({ _id: type._id }, { $set: { fields } });

    for (const e of await Entry.find({ type: t.key }).select("data draft").lean()) {
      const next = { data: convertObject(seedFields, e.data), draft: convertObject(seedFields, e.draft) };
      if (same(next, { data: e.data, draft: e.draft })) continue;
      await Entry.updateOne({ _id: e._id }, { $set: next }, { timestamps: false });
      entries++;
    }
  }

  console.log(`  YouTube links: ${sections} sections and ${entries} entries updated`);
  await revalidateSite("youtube-links");
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
