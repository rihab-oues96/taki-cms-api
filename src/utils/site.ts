import { env } from "../config/env.js";
import { logger } from "./logger.js";

/**
 * Tells the public website that published content changed so it drops its cache.
 * Never throws: if the site is unreachable the content still expires on its own.
 */
export async function revalidateSite(reason: string): Promise<void> {
  try {
    const res = await fetch(`${env.siteUrl}/api/revalidate`, {
      method: "POST",
      headers: { "x-revalidate-secret": env.SITE_REVALIDATE_SECRET },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) logger.warn({ status: res.status, reason }, "Website revalidation was refused");
  } catch (err) {
    logger.warn({ err: (err as Error).message, reason }, "Website revalidation failed (site unreachable)");
  }
}
