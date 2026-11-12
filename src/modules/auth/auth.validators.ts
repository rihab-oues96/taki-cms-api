import { z } from "zod";
import { passwordSchema } from "../users/user.validators.js";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail invalide").max(254),
  password: z.string().min(1, "Mot de passe requis").max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({ name: z.string().trim().min(2).max(120) });
