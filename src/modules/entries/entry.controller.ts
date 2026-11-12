import type { Request, Response } from "express";
import { currentUser } from "../../middleware/auth.js";
import { param } from "../../middleware/validate.js";
import { created, ok, pageMeta } from "../../utils/response.js";
import { revalidateSite } from "../../utils/site.js";
import { logActivity } from "../dashboard/activity.service.js";
import * as service from "./entry.service.js";

export async function listTypes(_req: Request, res: Response) {
  ok(res, await service.listContentTypes());
}

export async function getType(req: Request, res: Response) {
  ok(res, await service.getContentType(param(req, "key")));
}

export async function createType(req: Request, res: Response) {
  const actor = currentUser(req);
  const type = await service.createContentType(req.body);
  await logActivity(actor, "create", "contentType", type.key, type.label, type.key);
  created(res, type);
}

export async function updateType(req: Request, res: Response) {
  const actor = currentUser(req);
  const type = await service.updateContentType(param(req, "key"), req.body);
  await logActivity(actor, "update", "contentType", type.key, type.label, type.key);
  ok(res, type);
}

export async function list(_req: Request, res: Response) {
  const q = res.locals.query;
  const { items, total } = await service.listEntries(q);
  ok(res, items, pageMeta(q.page, q.limit, total));
}

export async function get(req: Request, res: Response) {
  ok(res, await service.getEntry(param(req, "id")));
}

export async function create(req: Request, res: Response) {
  const actor = currentUser(req);
  const entry = await service.createEntry(actor, req.body);
  await logActivity(actor, "create", "entry", entry.id, entry.title || "Nouveau contenu", entry.type);
  if (entry.visible) void revalidateSite(`entry ${entry.type}`);
  created(res, entry);
}

export async function update(req: Request, res: Response) {
  const actor = currentUser(req);
  const { entry, visibilityChanged } = await service.updateEntry(actor, param(req, "id"), req.body);
  await logActivity(actor, visibilityChanged ? (entry.visible ? "show" : "hide") : "update", "entry", entry.id, entry.title, entry.type);
  void revalidateSite(`entry ${entry.type}`);
  ok(res, entry);
}

export async function saveDraft(req: Request, res: Response) {
  const actor = currentUser(req);
  const entry = await service.saveDraft(actor, param(req, "id"), req.body.data);
  await logActivity(actor, "update", "entry", entry.id, `${entry.title} (brouillon)`, entry.type);
  ok(res, entry);
}

export async function discardDraft(req: Request, res: Response) {
  ok(res, await service.discardDraft(param(req, "id")));
}

export async function publish(req: Request, res: Response) {
  const actor = currentUser(req);
  const entry = await service.publish(actor, param(req, "id"), req.body.data);
  await logActivity(actor, "publish", "entry", entry.id, entry.title, entry.type);
  void revalidateSite(`entry ${entry.type}`);
  ok(res, entry);
}

export async function remove(req: Request, res: Response) {
  const actor = currentUser(req);
  const entry = await service.deleteEntry(param(req, "id"));
  await logActivity(actor, "delete", "entry", entry.id, entry.title, entry.type);
  void revalidateSite(`entry ${entry.type}`);
  ok(res, { id: entry.id });
}

export async function reorder(req: Request, res: Response) {
  const actor = currentUser(req);
  const result = await service.reorder(req.body.type, req.body.ids);
  await logActivity(actor, "reorder", "entry", req.body.type, `Ordre : ${req.body.type}`, req.body.type);
  void revalidateSite(`reorder ${req.body.type}`);
  ok(res, result);
}
