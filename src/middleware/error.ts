import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";

export function notFoundHandler(_req: Request, _res: Response) {
  throw ApiError.notFound("Route introuvable");
}

/** The only place where errors become HTTP responses. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  let error: ApiError;

  if (err instanceof ApiError) error = err;
  else if (err instanceof multer.MulterError) {
    error = ApiError.badRequest(err.code === "LIMIT_FILE_SIZE" ? "Fichier trop volumineux" : "Envoi de fichier invalide");
  } else if (err instanceof mongoose.Error.ValidationError) {
    error = ApiError.validation(Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })));
  } else if (err instanceof mongoose.Error.CastError) error = ApiError.notFound();
  else if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
    error = ApiError.conflict("Cette valeur existe déjà");
  } else if (typeof err === "object" && err !== null && (err as { type?: string }).type === "entity.parse.failed") {
    error = ApiError.badRequest("JSON invalide");
  } else if (typeof err === "object" && err !== null && (err as { type?: string }).type === "entity.too.large") {
    error = new ApiError(413, "PAYLOAD_TOO_LARGE", "Requête trop volumineuse");
  } else {
    logger.error({ err, path: req.path, method: req.method }, "Unhandled error");
    error = new ApiError(500, "INTERNAL_ERROR", "Une erreur interne est survenue");
  }

  res.status(error.status).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
      ...(!env.isProd && error.status === 500 && err instanceof Error ? { debug: err.message } : {}),
    },
  });
}
