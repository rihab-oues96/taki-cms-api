import type { Response } from "express";

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/** Every successful response has the same envelope: { success, data, meta? }. */
export function ok<T>(res: Response, data: T, meta?: PageMeta | Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
}

export function created<T>(res: Response, data: T) {
  return ok(res, data, undefined, 201);
}

export function pageMeta(page: number, limit: number, total: number): PageMeta {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}
