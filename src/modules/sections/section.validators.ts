import { z } from "zod";
import { fieldsSchema, keySchema } from "../../types/fieldSchema.js";

const content = z.record(z.string(), z.unknown());

export const listSectionsQuery = z.object({ page: keySchema.optional() });

export const createSectionSchema = z.object({
  page: keySchema,
  key: keySchema,
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300).default(""),
  fields: fieldsSchema.min(1, "Ajoutez au moins un champ"),
  restricted: z.boolean().default(false),
});

export const updateSectionSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    description: z.string().trim().max(300),
    visible: z.boolean(),
    fields: fieldsSchema.min(1),
    restricted: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Aucune modification");

export const saveContentSchema = z.object({ content });
export const publishSchema = z.object({ content: content.optional() });
export const reorderSchema = z.object({ page: keySchema, ids: z.array(z.string().regex(/^[a-f0-9]{24}$/)).min(1).max(200) });
