import { Schema, model, type InferSchemaType } from "mongoose";
import { ROLES } from "../../config/permissions.js";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: "marketing" },
    active: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, active: 1 });

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
