import type { Request, Response } from "express";
import { currentUser } from "../../middleware/auth.js";
import { param } from "../../middleware/validate.js";
import { ApiError } from "../../utils/ApiError.js";
import { created, ok, pageMeta } from "../../utils/response.js";
import { revalidateSite } from "../../utils/site.js";
import { logActivity } from "../dashboard/activity.service.js";
import * as service from "./media.service.js";
import { FILE_RULES } from "./media.rules.js";
import { uploadFieldsSchema } from "./media.validators.js";

export async function list(_req: Request, res: Response) {
  const q = res.locals.query;
  const { items, total, folders } = await service.listMedia(q);
  ok(res, items, { ...pageMeta(q.page, q.limit, total), folders });
}

export function rules(_req: Request, res: Response) {
  ok(res, FILE_RULES.map((r) => ({ mime: r.mime, ext: r.ext, kind: r.kind, maxBytes: r.maxBytes })));
}

export async function get(req: Request, res: Response) {
  ok(res, await service.getMedia(param(req, "id")));
}

export async function upload(req: Request, res: Response) {
  const actor = currentUser(req);
  const meta = uploadFieldsSchema.safeParse(req.body ?? {});
  if (!meta.success) throw ApiError.validation(meta.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  const files = Array.isArray(req.files) ? req.files : [];
  const media = await service.uploadMedia(actor, files, meta.data);
  for (const m of media) await logActivity(actor, "upload", "media", m.id, m.originalName);
  created(res, media);
}

export async function update(req: Request, res: Response) {
  const actor = currentUser(req);
  const media = await service.updateMedia(param(req, "id"), req.body);
  await logActivity(actor, "update", "media", media.id, media.originalName);
  ok(res, media);
}

export async function replace(req: Request, res: Response) {
  const actor = currentUser(req);
  const result = await service.replaceMedia(actor, param(req, "id"), req.file);
  await logActivity(actor, "update", "media", result.media.id, `${result.media.originalName} (remplacé)`);
  if (result.updatedReferences) void revalidateSite("media replaced");
  ok(res, result);
}

export async function remove(req: Request, res: Response) {
  const actor = currentUser(req);
  const media = await service.deleteMedia(param(req, "id"), res.locals.query.force === "true");
  await logActivity(actor, "delete", "media", media.id, media.originalName);
  ok(res, { id: media.id });
}
