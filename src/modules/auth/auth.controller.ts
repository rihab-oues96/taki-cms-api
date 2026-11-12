import type { CookieOptions, Request, Response } from "express";
import { env } from "../../config/env.js";
import { currentUser } from "../../middleware/auth.js";
import { ok } from "../../utils/response.js";
import * as service from "./auth.service.js";

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: "lax",
  path: "/",
};

function setSession(res: Response, token: string) {
  // Session cookie lifetime follows the JWT (default 8h); the JWT expiry is the authority.
  res.cookie(env.COOKIE_NAME, token, { ...cookieOptions, maxAge: 12 * 60 * 60 * 1000 });
}

export async function login(req: Request, res: Response) {
  const { token, user } = await service.login(req.body.email, req.body.password);
  setSession(res, token);
  ok(res, user);
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(env.COOKIE_NAME, cookieOptions);
  ok(res, { loggedOut: true });
}

export async function me(req: Request, res: Response) {
  ok(res, await service.getProfile(currentUser(req).id));
}

export async function updateProfile(req: Request, res: Response) {
  ok(res, await service.updateProfile(currentUser(req).id, req.body.name));
}

export async function changePassword(req: Request, res: Response) {
  const token = await service.changePassword(currentUser(req).id, req.body.currentPassword, req.body.newPassword);
  setSession(res, token);
  ok(res, { changed: true });
}
