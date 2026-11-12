import { timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { param, validateBody } from "../../middleware/validate.js";
import { verifyPreview } from "../../utils/jwt.js";
import { ApiError } from "../../utils/ApiError.js";
import { ok } from "../../utils/response.js";
import * as service from "./public.service.js";

/** Read-only API consumed by the public website. No session, published content only. */
export const publicRoutes = Router();

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Drafts are only served to the website's own server, which proves itself with the shared secret. */
function isPreview(req: Request): boolean {
  const secret = req.get("x-preview-secret");
  return typeof secret === "string" && safeEqual(secret, env.PREVIEW_SECRET);
}

const KEY = /^[a-z][a-z0-9-]{1,59}$/;
function key(req: Request, name: string) {
  const value = param(req, name);
  if (!KEY.test(value)) throw ApiError.notFound();
  return value;
}

publicRoutes.get("/pages/:page", async (req: Request, res: Response) => {
  ok(res, await service.getPageContent(key(req, "page"), isPreview(req)));
});

publicRoutes.get("/entries/:type", async (req: Request, res: Response) => {
  ok(res, await service.getEntries(key(req, "type"), isPreview(req)));
});

publicRoutes.get("/entries/:type/:slug", async (req: Request, res: Response) => {
  ok(res, await service.getEntryBySlug(key(req, "type"), key(req, "slug"), isPreview(req)));
});

/** The website calls this before switching a visitor into preview mode. */
publicRoutes.post("/preview/verify", validateBody(z.object({ token: z.string().min(10).max(2000) })), (req: Request, res: Response) => {
  if (!verifyPreview(req.body.token)) throw ApiError.unauthorized("Lien d'aperçu expiré");
  ok(res, { valid: true });
});
