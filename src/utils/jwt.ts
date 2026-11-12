import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export interface SessionPayload {
  sub: string;
  /** Bumped when the password changes or the account is deactivated: old sessions die. */
  tv: number;
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"], algorithm: "HS256" });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof decoded !== "object" || typeof decoded.sub !== "string" || typeof decoded.tv !== "number") return null;
    return { sub: decoded.sub, tv: decoded.tv };
  } catch {
    return null;
  }
}

/** Short-lived token that lets the website switch into preview (draft) mode. */
export function signPreview(userId: string): string {
  return jwt.sign({ sub: userId, aud: "preview" }, env.JWT_SECRET, { expiresIn: "5m", algorithm: "HS256" });
}

export function verifyPreview(token: string): boolean {
  try {
    jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"], audience: "preview" });
    return true;
  } catch {
    return false;
  }
}
