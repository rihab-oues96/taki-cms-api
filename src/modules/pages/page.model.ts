import { Schema, model } from "mongoose";

/** A website page (or the special "global" group) that sections are organised under. */
const pageSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    label: { type: String, required: true, trim: true },
    /** Public path on the website, used for "view" and "preview" links. */
    path: { type: String, default: "/" },
    description: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

pageSchema.index({ order: 1 });

export const Page = model("Page", pageSchema);
