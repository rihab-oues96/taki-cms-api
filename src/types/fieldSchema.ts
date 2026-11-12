import { z } from "zod";
import { FIELD_TYPES, type FieldDef } from "./content.js";

/** Zod schema for a (recursive) field definition, used when the structure itself is edited. */
export const fieldDefSchema: z.ZodType<FieldDef> = z.lazy(() =>
  z.object({
    name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,59}$/, "Nom technique invalide (lettres, chiffres, _)"),
    label: z.string().trim().min(1).max(120),
    type: z.enum(FIELD_TYPES),
    help: z.string().max(300).optional(),
    required: z.boolean().optional(),
    options: z.array(z.object({ value: z.string().max(120), label: z.string().max(120) })).max(100).optional(),
    fields: z.array(fieldDefSchema).max(60).optional(),
    item: fieldDefSchema.optional(),
  }),
);

export const fieldsSchema = z.array(fieldDefSchema).max(60);
export const keySchema = z.string().regex(/^[a-z][a-z0-9-]{1,59}$/, "Identifiant invalide (minuscules, chiffres, tirets)");
