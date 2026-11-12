import bcrypt from "bcryptjs";
import type { AuthUser } from "../../types/express.js";
import { ApiError } from "../../utils/ApiError.js";
import { escapeRegex } from "../../utils/text.js";
import { User } from "./user.model.js";
import type { CreateUserInput, UpdateUserInput } from "./user.validators.js";

const BCRYPT_ROUNDS = 12;

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

type UserLike = { _id: unknown; name: string; email: string; role: string; active: boolean; lastLoginAt?: Date | null; createdAt?: Date; updatedAt?: Date };

export function toPublicUser(u: UserLike) {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    lastLoginAt: u.lastLoginAt ?? null,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

/** Only a super admin may create, edit or promote to a super admin account. */
function assertCanManage(actor: AuthUser, targetRole: string) {
  if (targetRole === "super_admin" && actor.role !== "super_admin") {
    throw ApiError.forbidden("Seul un super administrateur peut gérer ce compte");
  }
}

async function assertNotLastSuperAdmin(userId: string) {
  const others = await User.countDocuments({ role: "super_admin", active: true, _id: { $ne: userId } });
  if (others === 0) throw ApiError.conflict("Il doit rester au moins un super administrateur actif");
}

export async function listUsers(filter: { search?: string; role?: string }) {
  const query: Record<string, unknown> = {};
  if (filter.role) query.role = filter.role;
  if (filter.search) {
    const rx = new RegExp(escapeRegex(filter.search), "i");
    query.$or = [{ name: rx }, { email: rx }];
  }
  const users = await User.find(query).sort({ createdAt: 1 }).lean();
  return users.map(toPublicUser);
}

export async function createUser(actor: AuthUser, input: CreateUserInput) {
  assertCanManage(actor, input.role);
  if (await User.exists({ email: input.email })) throw ApiError.conflict("Un compte utilise déjà cet e-mail");
  const user = await User.create({
    name: input.name,
    email: input.email,
    role: input.role,
    active: input.active,
    passwordHash: await hashPassword(input.password),
  });
  return toPublicUser(user.toObject());
}

export async function updateUser(actor: AuthUser, id: string, input: UpdateUserInput) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound("Utilisateur introuvable");
  assertCanManage(actor, user.role);
  if (input.role) assertCanManage(actor, input.role);

  const isSelf = actor.id === id;
  if (isSelf && input.active === false) throw ApiError.badRequest("Vous ne pouvez pas désactiver votre propre compte");
  if (isSelf && input.role && input.role !== user.role) throw ApiError.badRequest("Vous ne pouvez pas modifier votre propre rôle");

  const losesSuperAdmin = user.role === "super_admin" && ((input.role && input.role !== "super_admin") || input.active === false);
  if (losesSuperAdmin) await assertNotLastSuperAdmin(id);

  if (input.email && input.email !== user.email && (await User.exists({ email: input.email }))) {
    throw ApiError.conflict("Un compte utilise déjà cet e-mail");
  }

  if (input.name !== undefined) user.name = input.name;
  if (input.email !== undefined) user.email = input.email;
  if (input.role !== undefined && input.role !== user.role) {
    user.role = input.role;
    user.tokenVersion += 1;
  }
  if (input.active !== undefined && input.active !== user.active) {
    user.active = input.active;
    user.tokenVersion += 1; // signs the account out everywhere
  }
  await user.save();
  return toPublicUser(user.toObject());
}

export async function resetPassword(actor: AuthUser, id: string, password: string) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound("Utilisateur introuvable");
  assertCanManage(actor, user.role);
  user.passwordHash = await hashPassword(password);
  if (actor.id !== id) user.tokenVersion += 1;
  await user.save();
  return toPublicUser(user.toObject());
}

export async function deleteUser(actor: AuthUser, id: string) {
  if (actor.id === id) throw ApiError.badRequest("Vous ne pouvez pas supprimer votre propre compte");
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound("Utilisateur introuvable");
  assertCanManage(actor, user.role);
  if (user.role === "super_admin") await assertNotLastSuperAdmin(id);
  await user.deleteOne();
  return toPublicUser(user.toObject());
}
