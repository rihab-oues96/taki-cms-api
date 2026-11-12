/**
 * One-off migration: the website's forms used to open the visitor's mail client, they are
 * now sent to the API and listed in the backoffice.
 *
 *   npm run migrate:forms
 *
 * For the three form sections (pré-inscription, contact, candidature) it removes the texts
 * of the generated e-mail, adds the new ones (sending and confirmation messages, CV field)
 * with the wording of the seed files, and rewrites the notes that still talk about the mail
 * client. Everything editors changed elsewhere is left untouched, and running it twice
 * changes nothing.
 */
import { connectDb, disconnectDb } from "../config/db.js";
import { Section } from "../modules/sections/section.model.js";
import type { FieldDef } from "../types/content.js";
import { inferFields, sanitizeContent } from "../utils/fields.js";
import { revalidateSite } from "../utils/site.js";
import { SEED_MODULES } from "./content/index.js";

const FORMS = [
  { page: "admission", key: "form" },
  { page: "contact", key: "form" },
  { page: "jobs", key: "apply" },
];

/** Top-level texts that only made sense for the generated e-mail. */
const REMOVED = ["mail", "sentNote"];
/** Fields that stay but whose label in the editor changed (path from the section root). */
const RELABELLED = ["note", "labels.cv", "placeholders.cv", "previousOptions.value"];
/** Old default of the "CV link" label on the jobs form, now that the CV is a file. */
const OLD_CV_LINK_LABEL = "Lien vers votre CV ou profil LinkedIn (facultatif)";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Stored definitions, plus the ones the seed adds, in the seed's order. Stored customisations win. */
function mergeFields(stored: FieldDef[], seed: FieldDef[], prefix = ""): FieldDef[] {
  const out: FieldDef[] = [];
  for (const s of seed) {
    const path = prefix ? `${prefix}.${s.name}` : s.name;
    const d = stored.find((f) => f.name === s.name);
    if (!d) {
      out.push(s);
      continue;
    }
    const merged: FieldDef = { ...d };
    if (RELABELLED.includes(path)) merged.label = s.label;
    if (s.type === "group" && d.type === "group") merged.fields = mergeFields(d.fields ?? [], s.fields ?? [], path);
    if (s.type === "list" && d.type === "list" && s.item?.type === "group" && d.item?.type === "group") {
      merged.item = { ...d.item, fields: mergeFields(d.item.fields ?? [], s.item.fields ?? [], path) };
    }
    out.push(merged);
  }
  // Fields a super admin added by hand are kept, after the seeded ones.
  for (const d of stored) {
    if (!seed.some((s) => s.name === d.name) && !(prefix === "" && REMOVED.includes(d.name))) out.push(d);
  }
  return out;
}

/** Adds the keys the seed has and the stored content lacks; never replaces an existing value. */
function addMissing(stored: Obj, seed: Obj): Obj {
  const out: Obj = { ...stored };
  for (const [key, value] of Object.entries(seed)) {
    const current = out[key];
    if (current === undefined) out[key] = value;
    else if (isObj(current) && isObj(value)) out[key] = addMissing(current, value);
  }
  return out;
}

function migrateContent(stored: unknown, seed: Obj): unknown {
  if (!isObj(stored)) return stored;
  const out = addMissing(stored, seed);
  for (const key of REMOVED) delete out[key];
  // A note that still announces the mail client describes something that no longer happens.
  if (typeof out.note === "string" && /messagerie/i.test(out.note)) out.note = seed.note;
  if (isObj(out.labels) && isObj(seed.labels) && out.labels.cv === OLD_CV_LINK_LABEL) out.labels = { ...out.labels, cv: seed.labels.cv };
  return out;
}

async function main() {
  await connectDb();
  const seeds = Object.values(SEED_MODULES).flatMap((m) => m.sections ?? []);
  let updated = 0;

  for (const { page, key } of FORMS) {
    const seed = seeds.find((s) => s.page === page && s.key === key);
    const doc = await Section.findOne({ page, key }).select("fields content draft").lean();
    if (!seed || !doc) {
      console.log(`  ${page}/${key}: not found, skipped (run \`npm run seed\` first)`);
      continue;
    }

    const fields = mergeFields(doc.fields as FieldDef[], seed.fields ?? inferFields(seed.content, seed.overrides));
    const next = { fields, content: migrateContent(doc.content, seed.content), draft: migrateContent(doc.draft, seed.content) };
    if (same(next, { fields: doc.fields, content: doc.content, draft: doc.draft })) {
      console.log(`  ${page}/${key}: already up to date`);
      continue;
    }

    for (const [label, value] of [["content", next.content], ["draft", next.draft]] as const) {
      if (value === null || value === undefined) continue;
      const { issues } = sanitizeContent(fields, value);
      if (issues.length) throw new Error(`${page}/${key} (${label}) would be invalid:\n${issues.map((i) => `   - ${i.path}: ${i.message}`).join("\n")}`);
    }

    await Section.updateOne({ _id: doc._id }, { $set: { ...next, description: seed.description ?? "" } }, { timestamps: false });
    console.log(`  ${page}/${key}: updated`);
    updated++;
  }

  if (updated) await revalidateSite("forms migration");
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
