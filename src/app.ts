import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { authenticate } from "./middleware/auth.js";
import { originGuard } from "./middleware/csrf.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { contentTypeRoutes, entryRoutes } from "./modules/entries/entry.routes.js";
import { mediaRoutes } from "./modules/media/media.routes.js";
import { pageRoutes } from "./modules/pages/page.routes.js";
import { publicRoutes } from "./modules/public/public.routes.js";
import { sectionRoutes } from "./modules/sections/section.routes.js";
import { publicSubmissionRoutes, submissionRoutes } from "./modules/submissions/submission.routes.js";
import { userRoutes } from "./modules/users/user.routes.js";
import { logger } from "./utils/logger.js";
import { ok } from "./utils/response.js";
import { inDb, sendDbFile } from "./utils/storage.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // Behind a reverse proxy in production: trust the first hop for client IPs (rate limiting) and HTTPS detection.
  if (env.isProd) app.set("trust proxy", 1);

  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/api/health" || Boolean(req.url?.startsWith("/uploads/")) } }));
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] }));

  // Uploaded files: never executed, never sniffed, cached for a long time (names are unique).
  const uploadHeaders = (res: express.Response) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  };
  if (inDb) {
    app.get("/uploads/:filename", async (req, res, next) => {
      uploadHeaders(res);
      res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
      if (await sendDbFile(req, res, "uploads", String(req.params.filename), { cache: true })) return;
      res.removeHeader("Cache-Control");
      next();
    });
  }
  app.use(
    "/uploads",
    express.static(env.uploadDir, {
      index: false,
      dotfiles: "deny",
      maxAge: "30d",
      immutable: true,
      setHeaders: uploadHeaders,
    }),
  );

  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    ok(res, { status: "ok", db: mongoose.connection.readyState === 1 ? "up" : "down", uptime: Math.round(process.uptime()) });
  });

  app.use("/api", apiLimiter);
  // Forms sent from the website: the only public routes that write (shared secret + their own rate limit).
  app.use("/api/public/submissions", publicSubmissionRoutes);
  app.use("/api/public", publicRoutes);

  app.use("/api", originGuard);
  app.use("/api/auth", authRoutes);

  // Everything below requires a session; each router adds its own permission checks.
  app.use("/api/dashboard", authenticate, dashboardRoutes);
  app.use("/api/pages", authenticate, pageRoutes);
  app.use("/api/sections", authenticate, sectionRoutes);
  app.use("/api/content-types", authenticate, contentTypeRoutes);
  app.use("/api/entries", authenticate, entryRoutes);
  app.use("/api/media", authenticate, mediaRoutes);
  app.use("/api/users", authenticate, userRoutes);
  app.use("/api/submissions", authenticate, submissionRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
