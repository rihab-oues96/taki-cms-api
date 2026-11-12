import type { Request, Response } from "express";
import { currentUser } from "../../middleware/auth.js";
import { param } from "../../middleware/validate.js";
import { created, ok } from "../../utils/response.js";
import { revalidateSite } from "../../utils/site.js";
import { logActivity } from "../dashboard/activity.service.js";
import * as service from "./section.service.js";

export async function list(req: Request, res: Response) {
  ok(res, await service.listSections(currentUser(req), res.locals.query.page));
}

export async function get(req: Request, res: Response) {
  ok(res, await service.getSection(currentUser(req), param(req, "id")));
}

export async function create(req: Request, res: Response) {
  const actor = currentUser(req);
  const section = await service.createSection(actor, req.body);
  await logActivity(actor, "create", "section", section.id, section.label, section.page);
  created(res, section);
}

export async function update(req: Request, res: Response) {
  const actor = currentUser(req);
  const { section, visibilityChanged, affectsSite } = await service.updateSection(actor, param(req, "id"), req.body);
  const action = visibilityChanged ? (section.visible ? "show" : "hide") : "update";
  await logActivity(actor, action, "section", section.id, section.label, section.page);
  if (affectsSite) void revalidateSite(`section ${section.page}/${section.key}`);
  ok(res, section);
}

export async function saveDraft(req: Request, res: Response) {
  const actor = currentUser(req);
  const section = await service.saveDraft(actor, param(req, "id"), req.body.content);
  await logActivity(actor, "update", "section", section.id, `${section.label} (brouillon)`, section.page);
  ok(res, section);
}

export async function discardDraft(req: Request, res: Response) {
  ok(res, await service.discardDraft(currentUser(req), param(req, "id")));
}

export async function publish(req: Request, res: Response) {
  const actor = currentUser(req);
  const section = await service.publish(actor, param(req, "id"), req.body.content);
  await logActivity(actor, "publish", "section", section.id, section.label, section.page);
  void revalidateSite(`section ${section.page}/${section.key}`);
  ok(res, section);
}

export async function remove(req: Request, res: Response) {
  const actor = currentUser(req);
  const section = await service.deleteSection(actor, param(req, "id"));
  await logActivity(actor, "delete", "section", section.id, section.label, section.page);
  void revalidateSite(`section ${section.page}/${section.key}`);
  ok(res, { id: section.id });
}

export async function reorder(req: Request, res: Response) {
  const actor = currentUser(req);
  const sections = await service.reorder(actor, req.body.page, req.body.ids);
  await logActivity(actor, "reorder", "section", req.body.page, `Sections de la page « ${req.body.page} »`, req.body.page);
  void revalidateSite(`reorder ${req.body.page}`);
  ok(res, sections);
}
