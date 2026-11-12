import type { AuthUser } from "../../types/express.js";
import { logger } from "../../utils/logger.js";
import { Activity, type ACTIVITY_ACTIONS, type ACTIVITY_TARGETS } from "./activity.model.js";

/** Audit trail shown on the dashboard. Logging must never break the request it describes. */
export async function logActivity(
  actor: AuthUser,
  action: (typeof ACTIVITY_ACTIONS)[number],
  targetType: (typeof ACTIVITY_TARGETS)[number],
  targetId: string,
  label: string,
  context = "",
): Promise<void> {
  try {
    await Activity.create({ user: actor.id, userName: actor.name, action, targetType, targetId, label: label.slice(0, 300), context });
    logger.info({ user: actor.email, action, targetType, targetId }, "activity");
  } catch (err) {
    logger.warn({ err }, "Could not record activity");
  }
}

export async function recentActivity(limit = 12) {
  const rows = await Activity.find().sort({ createdAt: -1 }).limit(limit).lean();
  return rows.map((a) => ({
    id: String(a._id),
    userName: a.userName,
    action: a.action,
    targetType: a.targetType,
    targetId: a.targetId,
    label: a.label,
    context: a.context,
    createdAt: a.createdAt,
  }));
}
