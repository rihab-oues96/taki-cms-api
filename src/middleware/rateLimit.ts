import { isIP } from "node:net";
import type { Request } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

const body = (message: string) => ({ success: false, error: { code: "RATE_LIMITED", message } });

/** Brute-force protection on credentials endpoints. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: body("Trop de tentatives. Réessayez dans quelques minutes."),
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: body("Trop de requêtes. Réessayez dans un instant."),
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: body("Trop d'envois de fichiers. Réessayez dans un instant."),
});

/**
 * The visitor's address for a form submission. The request itself comes from the website's
 * server (which has proved itself with the shared secret), so the visitor is in `x-client-ip`.
 */
export function clientIp(req: Request): string {
  const forwarded = req.get("x-client-ip")?.trim() ?? "";
  return isIP(forwarded) ? forwarded : (req.ip ?? "");
}

/** Spam protection on the public forms: counts every attempt of one visitor, valid or not. */
export const submissionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = clientIp(req);
    return isIP(ip) ? ipKeyGenerator(ip) : "unknown";
  },
  message: body("Trop d'envois depuis votre connexion. Réessayez dans quelques minutes."),
});
