/**
 * One-off migration: the organisation chart used to be a content type (Contenus › Organigramme),
 * it is now part of the « Organigramme » section of the page Notre équipe, and each member can
 * have a photo.
 *
 *   npm run migrate:team
 *
 * The levels edited in the backoffice are copied into the section in their current order
 * (published values, and unpublished edits as a draft of the section), then the old content
 * type and its entries are removed. Levels that were hidden are not copied, since a section
 * has no per-level visibility. Running it twice changes nothing.
 */
import { connectDb, disconnectDb } from "../config/db.js";
import { ContentType } from "../modules/entries/contentType.model.js";
import { Entry } from "../modules/entries/entry.model.js";
import { Section } from "../modules/sections/section.model.js";
import type { FieldDef } from "../types/content.js";
import { inferFields, sanitizeContent } from "../utils/fields.js";
import { revalidateSite } from "../utils/site.js";
import { SEED_MODULES } from "./content/index.js";

const TYPE = "team";
const TARGET = { page: "equipe", key: "organisation" };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

async function main() {
  await connectDb();
  const seed = Object.values(SEED_MODULES).flatMap((m) => m.sections ?? []).find((s) => s.page === TARGET.page && s.key === TARGET.key);
  const doc = await Section.findOne(TARGET).select("fields content draft").lean();
  if (!seed || !doc) {
    console.log(`  ${TARGET.page}/${TARGET.key}: not found, skipped (run \`npm run seed\` first)`);
    return disconnectDb();
  }

  const entries = await Entry.find({ type: TYPE }).sort({ order: 1 }).select("title visible data draft").lean();
  const hasType = Boolean(await ContentType.exists({ key: TYPE }));
  const stored = doc.fields as FieldDef[];
  const migrated = stored.some((f) => f.name === "levels");

  if (migrated && !entries.length && !hasType) {
    console.log(`  ${TARGET.page}/${TARGET.key}: already up to date`);
    return disconnectDb();
  }

  if (!migrated) {
    const levelsField = inferFields(seed.content, seed.overrides).find((f) => f.name === "levels");
    if (!levelsField) throw new Error("The seed of equipe/organisation has no `levels` field");
    const fields = [...stored, levelsField];

    const shown = entries.filter((e) => e.visible);
    const hidden = entries.filter((e) => !e.visible);
    // Without any level in the database, the section starts with the levels of the seed file.
    const published = entries.length ? shown.map((e) => e.data) : seed.content.levels;
    const content = { ...(isObj(doc.content) ? doc.content : {}), levels: published };

    // Unpublished edits (of the section or of a level) stay unpublished.
    const hasDraft = isObj(doc.draft) || shown.some((e) => isObj(e.draft));
    const draft = hasDraft ? { ...(isObj(doc.draft) ? doc.draft : content), levels: shown.map((e) => (isObj(e.draft) ? e.draft : e.data)) } : null;

    const next: { content: Obj; draft: Obj | null } = { content, draft };
    for (const key of ["content", "draft"] as const) {
      if (!next[key]) continue;
      const { value, issues } = sanitizeContent(fields, next[key]);
      if (issues.length) throw new Error(`${TARGET.page}/${TARGET.key} (${key}) would be invalid:\n${issues.map((i) => `   - ${i.path}: ${i.message}`).join("\n")}`);
      next[key] = value;
    }

    await Section.updateOne(
      { _id: doc._id },
      { $set: { fields, ...next, label: seed.label, description: seed.description ?? "", ...(draft ? { draftUpdatedAt: new Date() } : {}) } },
      { timestamps: false },
    );
    console.log(`  ${TARGET.page}/${TARGET.key}: ${(next.content.levels as unknown[]).length} levels moved into the section${draft ? " (with a draft)" : ""}`);
    if (hidden.length) console.log(`  hidden levels not copied: ${hidden.map((e) => e.title).join(", ")}`);
  }

  const removed = await Entry.deleteMany({ type: TYPE });
  await ContentType.deleteOne({ key: TYPE });
  console.log(`  content type « ${TYPE} » removed (${removed.deletedCount} entries)`);

  await revalidateSite("team migration");
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
