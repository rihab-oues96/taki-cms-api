import { Schema, model } from "mongoose";

const entrySchema = new Schema(
  {
    type: { type: String, required: true, trim: true },
    slug: { type: String, trim: true },
    order: { type: Number, default: 0 },
    visible: { type: Boolean, default: true },
    /** Denormalised from data[titleField] for search and listings. */
    title: { type: String, default: "" },
    data: { type: Schema.Types.Mixed, default: {} },
    draft: { type: Schema.Types.Mixed, default: null },
    draftUpdatedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedByName: { type: String, default: "" },
  },
  { timestamps: true, minimize: false },
);

entrySchema.index({ type: 1, order: 1 });
entrySchema.index({ type: 1, visible: 1, order: 1 });
// A slug is unique inside its type; entries without slug are ignored by the index.
entrySchema.index({ type: 1, slug: 1 }, { unique: true, partialFilterExpression: { slug: { $type: "string" } } });
entrySchema.index({ updatedAt: -1 });

export const Entry = model("Entry", entrySchema);
