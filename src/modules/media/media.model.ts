import { Schema, model } from "mongoose";

export const MEDIA_KINDS = ["image", "video", "document"] as const;

const mediaSchema = new Schema(
  {
    /** What content stores: `/uploads/<file>` (served by this API) or `/media/...` (shipped with the website). */
    url: { type: String, required: true, unique: true },
    /** `upload` = file stored by this API; `site` = static asset bundled with the website. */
    storage: { type: String, enum: ["upload", "site"], required: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    kind: { type: String, enum: MEDIA_KINDS, required: true },
    size: { type: Number, required: true },
    alt: { type: String, default: "", maxlength: 300 },
    folder: { type: String, default: "", maxlength: 80 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    uploadedByName: { type: String, default: "" },
  },
  { timestamps: true },
);

mediaSchema.index({ kind: 1, createdAt: -1 });
mediaSchema.index({ folder: 1 });
mediaSchema.index({ originalName: "text", alt: "text" });

export const Media = model("Media", mediaSchema);
