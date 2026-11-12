export const ROLES = ["super_admin", "admin", "marketing"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "content:read",
  "content:write",
  "content:publish",
  "content:delete",
  /** Create sections / content types and change their field definitions. */
  "content:structure",
  "media:read",
  "media:write",
  "media:delete",
  "users:read",
  "users:manage",
  /** Sensitive global settings (contact details, portals, SEO defaults…). */
  "settings:manage",
  "activity:read",
  /** Form submissions from the website (contact, pre-registration, job applications): personal data. */
  "submissions:read",
  /** Change the status and internal note of a submission, or delete it. */
  "submissions:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const CONTENT: Permission[] = ["content:read", "content:write", "content:publish", "content:delete"];
const MEDIA: Permission[] = ["media:read", "media:write", "media:delete"];
const SUBMISSIONS: Permission[] = ["submissions:read", "submissions:manage"];

/** Single source of truth for RBAC. The frontend receives the resolved list from /auth/me. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  admin: [...CONTENT, ...MEDIA, ...SUBMISSIONS, "users:read", "users:manage", "settings:manage", "activity:read"],
  marketing: [...CONTENT, ...MEDIA, "activity:read"],
};

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super administrateur",
  admin: "Administrateur",
  marketing: "Marketing",
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
