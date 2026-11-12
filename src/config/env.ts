import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

// Load .env without an extra dependency (Node >= 20.12).
const envFile = path.resolve(process.cwd(), ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const bool = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  COOKIE_NAME: z.string().default("taki_bo_session"),
  COOKIE_SECURE: bool,
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3001")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
  SITE_URL: z.string().url().default("http://localhost:3000"),
  SITE_REVALIDATE_SECRET: z.string().min(8),
  PREVIEW_SECRET: z.string().min(8),
  UPLOAD_DIR: z.string().default("uploads"),
  PRIVATE_UPLOAD_DIR: z.string().default("private-uploads"),
  FORMS_SECRET: z.string().min(16, "FORMS_SECRET must be at least 16 characters"),
  SEED_ADMIN_NAME: z.string().default("Super Admin"),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(10).optional(),
  SITE_PUBLIC_DIR: z.string().default("../taki-academy/public"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === "production",
  uploadDir: path.resolve(process.cwd(), parsed.data.UPLOAD_DIR),
  /** Files that must never be served statically (CVs sent with job applications). */
  privateUploadDir: path.resolve(process.cwd(), parsed.data.PRIVATE_UPLOAD_DIR),
  siteUrl: parsed.data.SITE_URL.replace(/\/$/, ""),
};
