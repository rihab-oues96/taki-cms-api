import { z } from "zod";
import { ROLES } from "../../config/permissions.js";

export const passwordSchema = z
  .string()
  .min(10, "10 caractères minimum")
  .max(128)
  .regex(/[a-z]/, "Ajoutez une minuscule")
  .regex(/[A-Z]/, "Ajoutez une majuscule")
  .regex(/\d/, "Ajoutez un chiffre");

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(120),
  email: z.string().trim().toLowerCase().email("E-mail invalide").max(254),
  password: passwordSchema,
  role: z.enum(ROLES),
  active: z.boolean().default(true),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(254),
    role: z.enum(ROLES),
    active: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Aucune modification");

export const resetPasswordSchema = z.object({ password: passwordSchema });

export const listUsersQuery = z.object({
  search: z.string().trim().max(100).optional(),
  role: z.enum(ROLES).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
