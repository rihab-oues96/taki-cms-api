import { Schema, model } from "mongoose";

/** A repeatable kind of content (articles, FAQ, testimonials…) and the shape of its entries. */
const contentTypeSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    label: { type: String, required: true, trim: true },
    singular: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    fields: { type: [Schema.Types.Mixed], default: [] },
    /** Field shown as the entry's name in lists. */
    titleField: { type: String, required: true },
    subtitleField: { type: String, default: "" },
    imageField: { type: String, default: "" },
    /** Entries of this type have their own URL on the website. */
    hasSlug: { type: Boolean, default: false },
    /** Public path of an entry's page; `:slug` is replaced. Empty when entries have no page. */
    previewPath: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const ContentType = model("ContentType", contentTypeSchema);
