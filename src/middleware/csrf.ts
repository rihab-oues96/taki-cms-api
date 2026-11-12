import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for the cookie session: a state-changing request must come from an
 * allowed origin. Browsers always send Origin on cross-site POST/PUT/PATCH/DELETE.
 * Requests without Origin (server-to-server, curl) are not driven by a victim's browser.
 */
export function originGuard(req: Request, _res: Response, next: NextFunction) {
  if (SAFE.has(req.method)) return next();
  const origin = req.get("origin");
  if (origin && !env.CORS_ORIGINS.includes(origin)) throw ApiError.forbidden("Origine non autorisée");
  next();
}
