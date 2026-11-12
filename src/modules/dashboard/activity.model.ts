import { Schema, model } from "mongoose";

export const ACTIVITY_ACTIONS = ["create", "update", "publish", "delete", "show", "hide", "upload", "reorder"] as const;
export const ACTIVITY_TARGETS = ["section", "entry", "media", "user", "contentType", "submission"] as const;

const activitySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true },
    action: { type: String, enum: ACTIVITY_ACTIONS, required: true },
    targetType: { type: String, enum: ACTIVITY_TARGETS, required: true },
    targetId: { type: String, required: true },
    label: { type: String, required: true, maxlength: 300 },
    /** Where the item lives in the backoffice, e.g. a page key or a content type key. */
    context: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activitySchema.index({ createdAt: -1 });
// Keep six months of history.
activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180, name: "ttl" });

export const Activity = model("Activity", activitySchema);
