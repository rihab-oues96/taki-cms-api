import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

export async function connectDb(): Promise<void> {
  mongoose.set("strictQuery", true);
  mongoose.connection.on("error", (err) => logger.error({ err }, "MongoDB connection error"));
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  logger.info("MongoDB connected");
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
