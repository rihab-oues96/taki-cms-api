import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { ROLE_PERMISSIONS, type Permission } from "../config/permissions.js";
import { User } from "../modules/users/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { verifySession } from "../utils/jwt.js";

/** Requires a valid session cookie and loads the (still active) user on every request. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token: unknown = req.cookies?.[env.COOKIE_NAME];
  const session = typeof token === "string" ? verifySession(token) : null;
  if (!session) throw ApiError.unauthorized();

  const user = await User.findById(session.sub).lean();
  if (!user || !user.active || user.tokenVersion !== session.tv) throw ApiError.unauthorized("Session expirée");

  req.user = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: ROLE_PERMISSIONS[user.role],
  };
  next();
}

/** Route guard: the user needs every listed permission. */
export function authorize(...required: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw ApiError.unauthorized();
    const missing = required.filter((p) => !req.user!.permissions.includes(p));
    if (missing.length) throw ApiError.forbidden();
    next();
  };
}

export function hasPermission(req: Request, permission: Permission): boolean {
  return Boolean(req.user?.permissions.includes(permission));
}

export function currentUser(req: Request) {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}
