import { z } from "zod";
import { MEDIA_KINDS } from "./media.model.js";

const folder = z.string().trim().max(80).regex(/^[\p{L}\p{N} _-]*$/u, "Nom de dossier invalide");

export const listMediaQuery = z.object({
  search: z.string().trim().max(100).optional(),
  kind: z.enum(MEDIA_KINDS).optional(),
  folder: folder.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(120).default(48),
});

export const uploadFieldsSchema = z.object({ folder: folder.default(""), alt: z.string().trim().max(300).default("") });
export const updateMediaSchema = z
  .object({ alt: z.string().trim().max(300), folder })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Aucune modification");
export const deleteMediaQuery = z.object({ force: z.enum(["true", "false"]).default("false") });
