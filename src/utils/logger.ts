import { pino } from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : env.isProd ? "info" : "debug",
  redact: ["req.headers.cookie", "req.headers.authorization", "res.headers['set-cookie']"],
  ...(env.isProd
    ? {}
    : { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" } } }),
});
