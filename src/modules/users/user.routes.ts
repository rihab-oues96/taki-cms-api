import { Router } from "express";
import { authorize } from "../../middleware/auth.js";
import { objectIdParam, validateBody, validateQuery } from "../../middleware/validate.js";
import * as controller from "./user.controller.js";
import { createUserSchema, listUsersQuery, resetPasswordSchema, updateUserSchema } from "./user.validators.js";

export const userRoutes = Router();

userRoutes.get("/", authorize("users:read"), validateQuery(listUsersQuery), controller.list);
userRoutes.post("/", authorize("users:manage"), validateBody(createUserSchema), controller.create);
userRoutes.patch("/:id", authorize("users:manage"), objectIdParam(), validateBody(updateUserSchema), controller.update);
userRoutes.post("/:id/password", authorize("users:manage"), objectIdParam(), validateBody(resetPasswordSchema), controller.resetPassword);
userRoutes.delete("/:id", authorize("users:manage"), objectIdParam(), controller.remove);
