import { Schema, model } from "mongoose";

/**
 * One editable block of a page (hero, call-to-action, footer…).
 * `content` is what the website shows; `draft` holds unpublished edits.
 * `fields` describes the shape of both so the editor can be generated.
 */
const sectionSchema = new Schema(
  {
    page: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    order: { type: Number, default: 0 },
    visible: { type: Boolean, default: true },
    /** Restricted sections hold sensitive settings and need `settings:manage`. */
    restricted: { type: Boolean, default: false },
    fields: { type: [Schema.Types.Mixed], default: [] },
    content: { type: Schema.Types.Mixed, default: {} },
    draft: { type: Schema.Types.Mixed, default: null },
    draftUpdatedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedByName: { type: String, default: "" },
  },
  { timestamps: true, minimize: false },
);

sectionSchema.index({ page: 1, key: 1 }, { unique: true });
sectionSchema.index({ page: 1, order: 1 });
sectionSchema.index({ updatedAt: -1 });

export const Section = model("Section", sectionSchema);
