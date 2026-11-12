import { mkdir } from "node:fs/promises";
import { connectDb, disconnectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { logger } from "./utils/logger.js";

async function main() {
  await mkdir(env.uploadDir, { recursive: true });
  await mkdir(env.privateUploadDir, { recursive: true });
  await connectDb();

  const server = createApp().listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.fatal({ err }, "Server failed to start");
  process.exit(1);
});
