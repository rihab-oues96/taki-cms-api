/**
 * One-off migration: the home page videos (background, school film, video tour) can now be a
 * YouTube link or an uploaded file.
 *
 *   npm run migrate:hero-video
 *
 * Only the stored field definitions change (type, label, help); the content is left untouched,
 * and running it twice changes nothing.
 */
import { connectDb, disconnectDb } from "../config/db.js";
import { Section } from "../modules/sections/section.model.js";
import type { FieldDef } from "../types/content.js";
import { inferFields } from "../utils/fields.js";
import { revalidateSite } from "../utils/site.js";
import { SEED_MODULES } from "./content/index.js";

/** Section and path (group names, then the field) of every definition to refresh from the seed files. */
const TARGETS = [
  { page: "home", key: "hero", path: ["video", "backgroundVideoId"] },
  { page: "home", key: "hero", path: ["video", "backgroundStart"] },
  { page: "home", key: "hero", path: ["video", "filmVideoId"] },
  { page: "home", key: "about", path: ["videoId"] },
];

function find(fields: FieldDef[], path: string[]): FieldDef | undefined {
  const field = fields.find((f) => f.name === path[0]);
  return path.length > 1 ? field?.fields && find(field.fields, path.slice(1)) : field;
}

async function main() {
  await connectDb();
  const seeds = Object.values(SEED_MODULES).flatMap((m) => m.sections ?? []);
  let updated = 0;
  for (const t of TARGETS) {
    const seed = seeds.find((s) => s.page === t.page && s.key === t.key);
    const doc = await Section.findOne({ page: t.page, key: t.key }).select("fields").lean();
    if (!seed || !doc) continue;
    const from = find(seed.fields ?? inferFields(seed.content, seed.overrides), t.path);
    const fields = structuredClone(doc.fields) as FieldDef[];
    const to = find(fields, t.path);
    if (!from || !to) continue;
    if (to.type === from.type && to.label === from.label && to.help === from.help) continue;
    to.type = from.type;
    to.label = from.label;
    if (from.help) to.help = from.help;
    await Section.updateOne({ _id: doc._id }, { $set: { fields } }, { timestamps: false });
    updated++;
  }
  console.log(`  Hero video: ${updated} sections updated`);
  if (updated) await revalidateSite("hero-video");
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
