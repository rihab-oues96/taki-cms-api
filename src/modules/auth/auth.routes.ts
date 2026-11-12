import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { authLimiter } from "../../middleware/rateLimit.js";
import { validateBody } from "../../middleware/validate.js";
import * as controller from "./auth.controller.js";
import { changePasswordSchema, loginSchema, updateProfileSchema } from "./auth.validators.js";

export const authRoutes = Router();

authRoutes.post("/login", authLimiter, validateBody(loginSchema), controller.login);
authRoutes.post("/logout", controller.logout);
authRoutes.get("/me", authenticate, controller.me);
authRoutes.patch("/me", authenticate, validateBody(updateProfileSchema), controller.updateProfile);
authRoutes.post("/password", authLimiter, authenticate, validateBody(changePasswordSchema), controller.changePassword);
