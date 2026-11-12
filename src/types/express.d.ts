import type { Permission, Role } from "../config/permissions.js";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: readonly Permission[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
