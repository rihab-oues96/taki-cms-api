import type { Request, Response } from "express";
import { currentUser } from "../../middleware/auth.js";
import { param } from "../../middleware/validate.js";
import { created, ok } from "../../utils/response.js";
import { logActivity } from "../dashboard/activity.service.js";
import * as service from "./user.service.js";

export async function list(_req: Request, res: Response) {
  ok(res, await service.listUsers(res.locals.query));
}

export async function create(req: Request, res: Response) {
  const actor = currentUser(req);
  const user = await service.createUser(actor, req.body);
  await logActivity(actor, "create", "user", user.id, user.name);
  created(res, user);
}

export async function update(req: Request, res: Response) {
  const actor = currentUser(req);
  const user = await service.updateUser(actor, param(req, "id"), req.body);
  await logActivity(actor, "update", "user", user.id, user.name);
  ok(res, user);
}

export async function resetPassword(req: Request, res: Response) {
  const actor = currentUser(req);
  const user = await service.resetPassword(actor, param(req, "id"), req.body.password);
  await logActivity(actor, "update", "user", user.id, `${user.name} (mot de passe)`);
  ok(res, user);
}

export async function remove(req: Request, res: Response) {
  const actor = currentUser(req);
  const user = await service.deleteUser(actor, param(req, "id"));
  await logActivity(actor, "delete", "user", user.id, user.name);
  ok(res, { id: user.id });
}
