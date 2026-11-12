/**
 * Seeds MongoDB with the content that used to be hardcoded in the website.
 *
 *   npm run seed            insert what is missing, never touch edited content
 *   npm run seed -- --force overwrite sections/entries with the seed files (drafts are discarded)
 *   npm run seed -- --force --only=home,contact   same, limited to some seed files
 */
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { connectDb, disconnectDb } from "../config/db.js";
import { env } from "../config/env.js";
import { ContentType } from "../modules/entries/contentType.model.js";
import { Entry } from "../modules/entries/entry.model.js";
import { Media } from "../modules/media/media.model.js";
import { Page } from "../modules/pages/page.model.js";
import { Section } from "../modules/sections/section.model.js";
import { User } from "../modules/users/user.model.js";
import { hashPassword } from "../modules/users/user.service.js";
import type { FieldDef } from "../types/content.js";
import { inferFields, mergeSamples, sanitizeContent } from "../utils/fields.js";
import { slugify } from "../utils/text.js";
import { revalidateSite } from "../utils/site.js";
import { SEED_MODULES } from "./content/index.js";

const force = process.argv.includes("--force");
// --only=home,contact limits the run to some seed files (see content/index.ts for the names).
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const ALL_MODULES = Object.values(SEED_MODULES);
const ACTIVE = Object.entries(SEED_MODULES).filter(([name]) => !only || only.includes(name)).map(([, m]) => m);
const log = (msg: string) => console.log(`  ${msg}`);

function checked(label: string, fields: FieldDef[], raw: Record<string, unknown>) {
  const { value, issues } = sanitizeContent(fields, raw);
  if (issues.length) {
    throw new Error(`Seed content for ${label} is invalid:\n${issues.map((i) => `   - ${i.path}: ${i.message}`).join("\n")}`);
  }
  return value;
}

async function seedPagesAndSections() {
  let pageOrder = 0;
  const counters = { pages: 0, inserted: 0, overwritten: 0, kept: 0, moved: 0 };

  for (const mod of ALL_MODULES) {
    for (const page of mod.pages ?? []) {
      await Page.updateOne({ key: page.key }, { $set: { ...page, order: pageOrder++ } }, { upsert: true });
      counters.pages++;
    }
  }

  const orderByPage = new Map<string, number>();
  for (const mod of ALL_MODULES) {
    for (const s of mod.sections ?? []) {
      const order = orderByPage.get(s.page) ?? 0;
      orderByPage.set(s.page, order + 1);
      if (!ACTIVE.includes(mod)) continue;
      const fields = s.fields ?? inferFields(s.content, s.overrides);
      let content = checked(`${s.page}/${s.key}`, fields, s.content);
      const meta = { label: s.label, description: s.description ?? "", restricted: s.restricted ?? false };
      const existing = await Section.findOne({ page: s.page, key: s.key }).select("_id").lean();

      if (s.replaces) {
        const old = await Section.findOne(s.replaces).select("content").lean();
        if (old) {
          if (!existing) {
            // Keep what editors wrote in the old section; fall back to the seed if it no longer fits.
            const carried = sanitizeContent(fields, { ...s.content, ...(old.content as Record<string, unknown>) });
            if (!carried.issues.length) content = carried.value;
          }
          await Section.deleteOne({ _id: old._id });
          counters.moved++;
        }
      }

      if (!existing) {
        await Section.create({ page: s.page, key: s.key, ...meta, order, fields, content, visible: true, publishedAt: new Date() });
        counters.inserted++;
      } else if (force) {
        await Section.updateOne(
          { _id: existing._id },
          { $set: { ...meta, order, fields, content, draft: null, draftUpdatedAt: null, visible: true, publishedAt: new Date() } },
        );
        counters.overwritten++;
      } else counters.kept++;
    }
  }
  log(`pages: ${counters.pages} · sections: ${counters.inserted} inserted, ${counters.overwritten} overwritten, ${counters.kept} kept${counters.moved ? `, ${counters.moved} moved` : ""}`);
}

async function seedEntries() {
  let typeOrder = 0;
  for (const mod of ALL_MODULES) {
    for (const t of mod.contentTypes ?? []) {
      const order = typeOrder++;
      if (!ACTIVE.includes(mod)) continue;
      const seeds = ALL_MODULES.flatMap((m) => m.entries ?? []).filter((e) => e.type === t.key);
      const fields = t.fields ?? inferFields(mergeSamples(seeds.map((e) => e.data)), t.overrides);
      if (!fields.some((f) => f.name === t.titleField)) throw new Error(`Content type ${t.key}: titleField "${t.titleField}" is not a field`);

      const meta = {
        label: t.label,
        singular: t.singular,
        description: t.description ?? "",
        titleField: t.titleField,
        subtitleField: t.subtitleField ?? "",
        imageField: t.imageField ?? "",
        hasSlug: t.hasSlug ?? false,
        previewPath: t.previewPath ?? "",
        order,
      };
      const exists = await ContentType.exists({ key: t.key });
      if (!exists) await ContentType.create({ key: t.key, fields, ...meta });
      else if (force) await ContentType.updateOne({ key: t.key }, { $set: { fields, ...meta } });

      const count = await Entry.countDocuments({ type: t.key });
      if (count > 0 && !force) {
        log(`${t.key}: ${count} entries kept`);
        continue;
      }
      if (force) await Entry.deleteMany({ type: t.key });

      const docs = seeds.map((e, order) => {
        const data = checked(`${t.key}[${order}]`, fields, e.data);
        const rawTitle = data[t.titleField];
        const title = typeof rawTitle === "string" ? rawTitle.replace(/\*/g, "") : "";
        return {
          type: t.key,
          data,
          title,
          order,
          visible: e.visible ?? true,
          publishedAt: new Date(),
          ...(t.hasSlug ? { slug: e.slug ?? slugify(title) } : {}),
        };
      });
      if (docs.length) await Entry.insertMany(docs);
      log(`${t.key}: ${docs.length} entries inserted`);
    }
  }
}

const MIME: Record<string, { mime: string; kind: "image" | "video" | "document" }> = {
  ".jpg": { mime: "image/jpeg", kind: "image" },
  ".jpeg": { mime: "image/jpeg", kind: "image" },
  ".png": { mime: "image/png", kind: "image" },
  ".webp": { mime: "image/webp", kind: "image" },
  ".gif": { mime: "image/gif", kind: "image" },
  ".avif": { mime: "image/avif", kind: "image" },
  ".svg": { mime: "image/svg+xml", kind: "image" },
  ".mp4": { mime: "video/mp4", kind: "video" },
  ".webm": { mime: "video/webm", kind: "video" },
  ".pdf": { mime: "application/pdf", kind: "document" },
};

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

/** Registers the images already shipped with the website so they appear in the media library. */
async function seedMedia() {
  const publicDir = path.resolve(process.cwd(), env.SITE_PUBLIC_DIR);
  let added = 0;
  for (const root of ["media", "brand"]) {
    let files: string[];
    try {
      files = await walk(path.join(publicDir, root));
    } catch {
      log(`media: ${path.join(publicDir, root)} not found, skipped`);
      continue;
    }
    for (const file of files) {
      const type = MIME[path.extname(file).toLowerCase()];
      if (!type) continue;
      const rel = path.relative(publicDir, file).split(path.sep).join("/");
      const url = `/${rel}`;
      if (await Media.exists({ url })) continue;
      const folder = path.dirname(rel).split("/").slice(0, 2).join(" - ");
      await Media.create({
        url,
        storage: "site",
        filename: path.basename(file),
        originalName: path.basename(file),
        mimeType: type.mime,
        kind: type.kind,
        size: (await stat(file)).size,
        folder,
        uploadedByName: "Site web",
      });
      added++;
    }
  }
  log(`media: ${added} existing website files registered`);
}

async function seedAdmin() {
  if (await User.exists({})) return log("users: kept");
  if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) {
    return log("users: none created (set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD)");
  }
  await User.create({
    name: env.SEED_ADMIN_NAME,
    email: env.SEED_ADMIN_EMAIL,
    passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD),
    role: "super_admin",
  });
  log(`users: super admin ${env.SEED_ADMIN_EMAIL} created`);
}

async function main() {
  await connectDb();
  console.log(`Seeding ${force ? "(force: overwriting content)" : "(safe: only missing content)"}`);
  await Promise.all([Page.syncIndexes(), Section.syncIndexes(), ContentType.syncIndexes(), Entry.syncIndexes(), Media.syncIndexes(), User.syncIndexes()]);
  await seedAdmin();
  await seedPagesAndSections();
  await seedEntries();
  await seedMedia();
  await revalidateSite("seed");
  await disconnectDb();
  console.log("Done.");
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
