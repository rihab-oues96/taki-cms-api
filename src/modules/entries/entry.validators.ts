import { z } from "zod";
import { fieldsSchema, keySchema } from "../../types/fieldSchema.js";

const data = z.record(z.string(), z.unknown());
const slug = z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Identifiant d'URL invalide (minuscules, chiffres, tirets)").max(120);

export const listEntriesQuery = z.object({
  type: keySchema,
  search: z.string().trim().max(100).optional(),
  status: z.enum(["visible", "hidden", "draft"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const createEntrySchema = z.object({
  type: keySchema,
  data,
  slug: slug.optional(),
  visible: z.boolean().default(true),
});

export const updateEntrySchema = z
  .object({ visible: z.boolean(), slug })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Aucune modification");

export const saveEntryDraftSchema = z.object({ data });
export const publishEntrySchema = z.object({ data: data.optional() });
export const reorderEntriesSchema = z.object({ type: keySchema, ids: z.array(z.string().regex(/^[a-f0-9]{24}$/)).min(1).max(1000) });

export const createContentTypeSchema = z.object({
  key: keySchema,
  label: z.string().trim().min(1).max(120),
  singular: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300).default(""),
  fields: fieldsSchema.min(1, "Ajoutez au moins un champ"),
  titleField: z.string().min(1).max(60),
  subtitleField: z.string().max(60).default(""),
  imageField: z.string().max(60).default(""),
  hasSlug: z.boolean().default(false),
  previewPath: z.string().max(200).default(""),
});

export const updateContentTypeSchema = createContentTypeSchema
  .omit({ key: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Aucune modification");
