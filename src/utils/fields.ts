import type { ContentValue, FieldDef } from "../types/content.js";
import { youtubeId } from "./youtube.js";

const IMAGE_VALUE = /\.(jpe?g|png|svg|webp|gif|avif)(\?.*)?$/i;
const IMAGE_KEY = /(image|photo|poster|thumb|logo|cover|picture|src|avatar|banner|background)$/i;
const URL_KEY = /(href|url|link|portal)$/i;
const RICH_KEY = /^(title|heading|headline)$/i;

/** French labels for the keys used most often in the seeded content. */
const LABELS: Record<string, string> = {
  title: "Titre",
  subtitle: "Sous-titre",
  eyebrow: "Sur-titre",
  lead: "Chapô",
  intro: "Introduction",
  description: "Description",
  desc: "Description",
  text: "Texte",
  body: "Texte",
  paragraphs: "Paragraphes",
  paras: "Paragraphes",
  label: "Libellé",
  href: "Lien",
  url: "Lien",
  image: "Image",
  photo: "Photo",
  alt: "Texte alternatif",
  caption: "Légende",
  items: "Éléments",
  cards: "Cartes",
  cta: "Bouton",
  primaryCta: "Bouton principal",
  secondaryCta: "Bouton secondaire",
  buttons: "Boutons",
  quote: "Citation",
  name: "Nom",
  role: "Rôle",
  date: "Date",
  category: "Catégorie",
  excerpt: "Extrait",
  heading: "Titre",
  sections: "Sections",
  question: "Question",
  answer: "Réponse",
  q: "Question",
  a: "Réponse",
  value: "Valeur",
  icon: "Icône",
  video: "Vidéo",
  videoId: "Lien de la vidéo YouTube",
  youtubeId: "Lien de la vidéo YouTube",
  steps: "Étapes",
  stats: "Chiffres clés",
  tabs: "Onglets",
  note: "Note",
  links: "Liens",
  email: "E-mail",
  phone: "Téléphone",
  address: "Adresse",
  slug: "Identifiant d'URL",
  keyPoints: "Points clés",
  members: "Membres",
  facts: "Faits marquants",
  kind: "Type",
  feature: "Mise en avant",
  short: "Titre court",
  review: "Révision",
  thumb: "Vignette",
  poster: "Image d'aperçu",
  table: "Tableau",
  rows: "Lignes",
  head: "En-têtes",
  list: "Liste",
  points: "Points",
  tags: "Étiquettes",
  number: "Numéro",
  kicker: "Accroche",
  badge: "Badge",
  placeholder: "Texte indicatif",
};

export function humanize(key: string): string {
  if (LABELS[key]) return LABELS[key];
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export type FieldOverrides = Record<string, Partial<FieldDef>>;

function isPlainObject(v: unknown): v is Record<string, ContentValue> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function inferOne(name: string, value: unknown, path: string, overrides: FieldOverrides): FieldDef {
  const base: FieldDef = { name, label: humanize(name), type: "text" };

  if (typeof value === "boolean") base.type = "boolean";
  else if (typeof value === "number") base.type = "number";
  else if (typeof value === "string") {
    if (IMAGE_VALUE.test(value) || (IMAGE_KEY.test(name) && !/^https?:\/\/(www\.)?youtu/.test(value))) base.type = "image";
    else if (URL_KEY.test(name) || /^(https?:\/\/|mailto:|tel:)/.test(value)) base.type = "url";
    else if (/^\d{4}-\d{2}-\d{2}$/.test(value) && /date/i.test(name)) base.type = "date";
    else if (value.includes("*") || RICH_KEY.test(name)) base.type = "richtext";
    else if (value.length > 90 || value.includes("\n")) base.type = "textarea";
  } else if (Array.isArray(value)) {
    base.type = "list";
    // Merge every element so optional keys that only some items carry are not lost.
    const sample = value.every(isPlainObject)
      ? value.reduce<Record<string, unknown>>((acc, v) => mergeSample(acc, v), {})
      : (value.find((v) => v !== null && v !== undefined) ?? "");
    base.item = inferOne("item", sample, `${path}[]`, overrides);
    base.item.label = "Élément";
  } else if (isPlainObject(value)) {
    base.type = "group";
    base.fields = inferFields(value, overrides, path);
  } else if (IMAGE_KEY.test(name)) base.type = "image";

  const override = overrides[path];
  if (override) Object.assign(base, override);
  if (path.endsWith("[]")) {
    const itemOverride = overrides[path];
    if (itemOverride) Object.assign(base, itemOverride);
  }
  return base;
}

function mergeSample(acc: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> {
  for (const [k, v] of Object.entries(next)) {
    const cur = acc[k];
    if (cur === undefined || cur === null || cur === "") acc[k] = v;
    else if (Array.isArray(cur) && Array.isArray(v)) acc[k] = [...cur, ...v];
    else if (isPlainObject(cur) && isPlainObject(v)) acc[k] = mergeSample({ ...cur }, v);
    else if (typeof cur === "string" && typeof v === "string" && v.length > cur.length) acc[k] = v;
  }
  return acc;
}

/**
 * Builds field definitions from an example value. `overrides` is keyed by path
 * (`cta.href`, `items[].photo`) and wins over what was inferred.
 */
export function inferFields(value: Record<string, unknown>, overrides: FieldOverrides = {}, prefix = ""): FieldDef[] {
  return Object.entries(value).map(([key, v]) => inferOne(key, v, prefix ? `${prefix}.${key}` : key, overrides));
}

export function mergeSamples(samples: Record<string, unknown>[]): Record<string, unknown> {
  return samples.reduce<Record<string, unknown>>((acc, s) => mergeSample(acc, s), {});
}

/* ------------------------------------------------------------------ */
/* Validation + sanitisation of submitted content                      */
/* ------------------------------------------------------------------ */

export interface ContentIssue {
  path: string;
  message: string;
}

const MAX_TEXT = 20_000;
const MAX_LIST = 500;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const SAFE_LINK = /^(\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i;
const SAFE_MEDIA = /^(\/(?!\/)|https?:\/\/)/i;

function cleanString(v: string): string {
  return v.replace(CONTROL_CHARS, "").replace(/\r\n?/g, "\n");
}

function emptyValue(field: FieldDef): ContentValue {
  switch (field.type) {
    case "boolean":
      return false;
    case "number":
      return null;
    case "list":
      return [];
    case "group":
      return sanitizeFields(field.fields ?? [], {}, "", []) as ContentValue;
    default:
      return "";
  }
}

function sanitizeValue(field: FieldDef, raw: unknown, path: string, issues: ContentIssue[]): ContentValue {
  const missing = raw === undefined || raw === null || raw === "";
  if (missing) {
    if (field.required) issues.push({ path, message: `« ${field.label} » est obligatoire` });
    return emptyValue(field);
  }

  switch (field.type) {
    case "boolean":
      return raw === true || raw === "true";
    case "number": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) {
        issues.push({ path, message: `« ${field.label} » doit être un nombre` });
        return null;
      }
      return n;
    }
    case "group": {
      if (!isPlainObject(raw)) {
        issues.push({ path, message: `« ${field.label} » a un format invalide` });
        return emptyValue(field);
      }
      return sanitizeFields(field.fields ?? [], raw, path, issues) as ContentValue;
    }
    case "list": {
      if (!Array.isArray(raw)) {
        issues.push({ path, message: `« ${field.label} » doit être une liste` });
        return [];
      }
      if (raw.length > MAX_LIST) issues.push({ path, message: `« ${field.label} » contient trop d'éléments` });
      const item = field.item ?? { name: "item", label: "Élément", type: "text" as const };
      return raw.slice(0, MAX_LIST).map((v, i) => sanitizeValue(item, v, `${path}[${i}]`, issues));
    }
    default: {
      if (typeof raw !== "string") {
        issues.push({ path, message: `« ${field.label} » doit être un texte` });
        return "";
      }
      const value = cleanString(raw);
      if (value.length > MAX_TEXT) issues.push({ path, message: `« ${field.label} » est trop long` });
      if (field.type === "url" && !SAFE_LINK.test(value)) {
        issues.push({ path, message: `« ${field.label} » doit être un lien valide (/page, https://…, mailto:, tel:)` });
      }
      if (field.type === "youtube" && !youtubeId(value)) {
        issues.push({ path, message: `« ${field.label} » doit être le lien d'une vidéo YouTube (https://www.youtube.com/watch?v=…)` });
      }
      if (field.type === "image" && !SAFE_MEDIA.test(value)) {
        issues.push({ path, message: `« ${field.label} » doit pointer vers un média valide` });
      }
      if (field.type === "date" && Number.isNaN(Date.parse(value))) {
        issues.push({ path, message: `« ${field.label} » doit être une date valide` });
      }
      if (field.type === "select" && field.options && !field.options.some((o) => o.value === value)) {
        issues.push({ path, message: `« ${field.label} » : valeur non autorisée` });
      }
      return value;
    }
  }
}

function sanitizeFields(
  fields: FieldDef[],
  raw: Record<string, unknown>,
  prefix: string,
  issues: ContentIssue[],
): Record<string, ContentValue> {
  const out: Record<string, ContentValue> = {};
  // Only declared fields are kept: unknown keys never reach the database.
  for (const field of fields) {
    out[field.name] = sanitizeValue(field, raw[field.name], prefix ? `${prefix}.${field.name}` : field.name, issues);
  }
  return out;
}

export function sanitizeContent(fields: FieldDef[], raw: unknown): { value: Record<string, ContentValue>; issues: ContentIssue[] } {
  const issues: ContentIssue[] = [];
  if (!isPlainObject(raw)) return { value: {}, issues: [{ path: "", message: "Le contenu doit être un objet" }] };
  return { value: sanitizeFields(fields, raw, "", issues), issues };
}

/** Counts how many times `needle` appears as a string value anywhere in `value`. */
export function countReferences(value: unknown, needle: string): number {
  if (typeof value === "string") return value === needle ? 1 : 0;
  if (Array.isArray(value)) return value.reduce<number>((n, v) => n + countReferences(v, needle), 0);
  if (isPlainObject(value)) return Object.values(value).reduce<number>((n, v) => n + countReferences(v, needle), 0);
  return 0;
}

/** Returns a copy of `value` where every string equal to `from` becomes `to`. */
export function replaceReferences<T>(value: T, from: string, to: string): T {
  if (typeof value === "string") return (value === from ? to : value) as T;
  if (Array.isArray(value)) return value.map((v) => replaceReferences(v, from, to)) as T;
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceReferences(v, from, to)])) as T;
  }
  return value;
}
