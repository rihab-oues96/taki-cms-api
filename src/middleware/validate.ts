import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import type { ZodType } from "zod";
import { ApiError } from "../utils/ApiError.js";

function format(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  return error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message }));
}

/** Replaces req.body with the parsed (and stripped) value. */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) throw ApiError.validation(format(result.error));
    req.body = result.data;
    next();
  };
}

/** Parsed query is exposed on res.locals.query (req.query is read-only in Express 5). */
export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) throw ApiError.validation(format(result.error));
    res.locals.query = result.data;
    next();
  };
}

export function objectIdParam(name = "id") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const value = req.params[name];
    if (typeof value !== "string" || !mongoose.isValidObjectId(value)) throw ApiError.notFound();
    next();
  };
}

export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string" || !value) throw ApiError.notFound();
  return value;
}
