import type { Request, Response } from "express";
import { currentUser } from "../../middleware/auth.js";
import { clientIp } from "../../middleware/rateLimit.js";
import { param } from "../../middleware/validate.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import { created, ok, pageMeta } from "../../utils/response.js";
import { inDb, sendDbFile } from "../../utils/storage.js";
import { logActivity } from "../dashboard/activity.service.js";
import type { SubmissionType } from "./submission.model.js";
import * as service from "./submission.service.js";

/* ------------------------------------------------------------------ */
/* Website                                                             */
/* ------------------------------------------------------------------ */

/**
 * A filled honeypot means a robot. It gets the same answer as a real visitor (so it has
 * nothing to adapt to) but nothing is stored.
 */
function trapped(req: Request, res: Response, type: SubmissionType): boolean {
  if (!req.body.website) return false;
  logger.info({ type, ip: clientIp(req) }, "Form submission dropped (honeypot)");
  created(res, { reference: service.newReference(type) });
  return true;
}

export async function createContact(req: Request, res: Response) {
  if (trapped(req, res, "contact")) return;
  const { website: _website, ...input } = req.body;
  created(res, await service.createContact(input));
}

export async function createAdmission(req: Request, res: Response) {
  if (trapped(req, res, "admission")) return;
  const { website: _website, ...input } = req.body;
  created(res, await service.createAdmission(input));
}

export async function createJob(req: Request, res: Response) {
  if (trapped(req, res, "job")) return;
  const { website: _website, ...input } = req.body;
  created(res, await service.createJob(input, req.file));
}

/* ------------------------------------------------------------------ */
/* Backoffice                                                          */
/* ------------------------------------------------------------------ */

export async function list(_req: Request, res: Response) {
  const q = res.locals.query;
  const { items, total, counts } = await service.listSubmissions(q);
  ok(res, items, { ...pageMeta(q.page, q.limit, total), counts });
}

export async function counts(_req: Request, res: Response) {
  ok(res, await service.countSubmissions());
}

export async function get(req: Request, res: Response) {
  ok(res, await service.getSubmission(param(req, "id")));
}

export async function update(req: Request, res: Response) {
  const actor = currentUser(req);
  const { submission, statusChanged } = await service.updateSubmission(actor, param(req, "id"), req.body);
  const detail = statusChanged ? service.STATUS_LABELS[submission.status].toLowerCase() : "note";
  await logActivity(actor, "update", "submission", submission.id, `${submission.reference} · ${submission.name} (${detail})`, submission.type);
  ok(res, submission);
}

export async function remove(req: Request, res: Response) {
  const actor = currentUser(req);
  const submission = await service.deleteSubmission(param(req, "id"));
  await logActivity(actor, "delete", "submission", submission.id, `${submission.reference} · ${submission.name}`, submission.type);
  ok(res, { id: submission.id });
}

/** Personal data leaving the backoffice: never cached, never rendered in the browser. */
function asDownload(res: Response, filename: string, contentType: string) {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
}

export async function downloadCv(req: Request, res: Response) {
  const cv = await service.getCv(param(req, "id"));
  asDownload(res, cv.downloadName, cv.mimeType);
  if (inDb) {
    if (await sendDbFile(req, res, "cv", cv.filename, { cache: false })) return;
    for (const header of ["Content-Type", "Content-Disposition"]) res.removeHeader(header);
    throw ApiError.notFound("Le fichier du CV est introuvable");
  }
  await new Promise<void>((resolve, reject) => {
    res.sendFile(cv.path, { dotfiles: "deny", cacheControl: false, lastModified: false, etag: false }, (err) => {
      if (!err) return resolve();
      if (res.headersSent) return resolve();
      // The headers set above describe a file that is not coming.
      for (const header of ["Content-Type", "Content-Disposition"]) res.removeHeader(header);
      reject((err as NodeJS.ErrnoException).code === "ENOENT" ? ApiError.notFound("Le fichier du CV est introuvable") : err);
    });
  });
}

export async function exportCsv(req: Request, res: Response) {
  const actor = currentUser(req);
  const file = await service.exportSubmissions(res.locals.query);
  logger.info({ user: actor.email, rows: file.total, filename: file.filename }, "Submissions exported");
  asDownload(res, file.filename, "text/csv; charset=utf-8");
  res.send(file.content);
}
