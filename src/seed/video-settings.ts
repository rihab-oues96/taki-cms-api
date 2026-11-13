/**
 * One-off migration: the home page videos leave « Identité et coordonnées » and are edited
 * where they are shown.
 *
 *   npm run migrate:video-settings
 *
 *   heroVideoId → Accueil › Bannière d'accueil › Vidéos › Vidéo d'arrière-plan
 *   filmVideoId → Accueil › Bannière d'accueil › Vidéos › Film de l'école
 *               → Accueil › À propos de nous › Visite en vidéo
 *
 * The stored values (published and draft) are carried over, then the two fields are removed
 * from the site settings. Running it twice changes nothing.
 */
import { connectDb, disconnectDb } from "../config/db.js";
import { Section } from "../modules/sections/section.model.js";
import type { FieldDef } from "../types/content.js";
import { inferFields } from "../utils/fields.js";
import { revalidateSite } from "../utils/site.js";
import { SEED_MODULES } from "./content/index.js";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

const SOURCE = { page: "global", key: "site" };
const MOVES = [
  { from: "heroVideoId", page: "home", key: "hero", path: ["video", "backgroundVideoId"] },
  { from: "filmVideoId", page: "home", key: "hero", path: ["video", "filmVideoId"] },
  { from: "filmVideoId", page: "home", key: "about", path: ["videoId"] },
];

function getAt(obj: unknown, path: string[]): unknown {
  return path.reduce<unknown>((o, k) => (isObj(o) ? o[k] : undefined), obj);
}

function setAt(obj: Obj, path: string[], value: unknown) {
  let o = obj;
  for (const k of path.slice(0, -1)) {
    if (!isObj(o[k])) o[k] = {};
    o = o[k] as Obj;
  }
  o[path.at(-1) ?? ""] = value;
}

/** Adds the definition found at `path` in the seed to the stored ones, at the same position. Returns false when it cannot. */
function addField(seed: FieldDef[], stored: FieldDef[], path: string[]): boolean {
  const index = seed.findIndex((f) => f.name === path[0]);
  const from = seed[index];
  if (!from) return false;
  const existing = stored.find((f) => f.name === path[0]);
  if (path.length > 1) return !!existing?.fields && addField(from.fields ?? [], existing.fields, path.slice(1));
  if (!existing) stored.splice(Math.min(index, stored.length), 0, structuredClone(from));
  return true;
}

const text = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  await connectDb();
  const seeds = Object.values(SEED_MODULES).flatMap((m) => m.sections ?? []);
  const site = await Section.findOne(SOURCE).select("fields content draft").lean();
  const siteContent = (site?.content ?? {}) as Obj;
  const siteDraft = isObj(site?.draft) ? site.draft : undefined;
  let updated = 0;

  const targets = new Map<string, typeof MOVES>();
  for (const m of MOVES) targets.set(`${m.page}/${m.key}`, [...(targets.get(`${m.page}/${m.key}`) ?? []), m]);

  for (const [target, moves] of targets) {
    const [page = "", key = ""] = target.split("/");
    const seed = seeds.find((s) => s.page === page && s.key === key);
    const doc = await Section.findOne({ page, key }).select("fields content draft description").lean();
    if (!seed || !doc) continue;
    const seedFields = seed.fields ?? inferFields(seed.content, seed.overrides);
    const fields = structuredClone(doc.fields) as FieldDef[];
    const content = structuredClone(doc.content ?? {}) as Obj;
    let draft = isObj(doc.draft) ? (structuredClone(doc.draft) as Obj) : null;
    let newDraft = false;

    for (const m of moves) {
      if (!addField(seedFields, fields, m.path)) throw new Error(`${page}/${key}: no place for ${m.path.join(".")}`);
      const published = text(siteContent[m.from]) ?? getAt(seed.content, m.path);
      const pending = text(siteDraft?.[m.from]) ?? published;
      if (getAt(content, m.path) !== undefined) continue;
      setAt(content, m.path, published);
      if (draft) {
        if (getAt(draft, m.path) === undefined) setAt(draft, m.path, pending);
      } else if (pending !== published) {
        // An unpublished change of the video stays unpublished.
        draft = structuredClone(content);
        newDraft = true;
        setAt(draft, m.path, pending);
      }
    }

    const description = seed.description ?? "";
    if (same({ fields, content, draft, description }, { fields: doc.fields, content: doc.content, draft: doc.draft ?? null, description: doc.description })) continue;
    await Section.updateOne(
      { _id: doc._id },
      { $set: { fields, content, draft, description, ...(newDraft ? { draftUpdatedAt: new Date() } : {}) } },
      { timestamps: false },
    );
    updated++;
  }

  // Every target now holds the values: the site settings can drop them.
  if (site) {
    const names = new Set(MOVES.map((m) => m.from));
    const strip = (o: Obj) => Object.fromEntries(Object.entries(o).filter(([k]) => !names.has(k)));
    const next = {
      fields: (site.fields as FieldDef[]).filter((f) => !names.has(f.name)),
      content: strip(siteContent),
      draft: siteDraft ? strip(siteDraft) : (site.draft ?? null),
    };
    if (!same(next, { fields: site.fields, content: site.content, draft: site.draft ?? null })) {
      await Section.updateOne({ _id: site._id }, { $set: next }, { timestamps: false });
      updated++;
    }
  }

  console.log(`  Video settings: ${updated} sections updated`);
  if (updated) await revalidateSite("video-settings");
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
