import bcrypt from "bcryptjs";
import { ROLE_PERMISSIONS } from "../../config/permissions.js";
import { ApiError } from "../../utils/ApiError.js";
import { signSession } from "../../utils/jwt.js";
import { User } from "../users/user.model.js";
import { hashPassword, toPublicUser, verifyPassword } from "../users/user.service.js";

// Compared against when the e-mail is unknown, so response time does not reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync("unknown-account", 12);

export async function login(email: string, password: string) {
  const user = await User.findOne({ email }).select("+passwordHash");
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw ApiError.unauthorized("E-mail ou mot de passe incorrect");
  if (!user.active) throw ApiError.forbidden("Ce compte est désactivé. Contactez un administrateur.");

  user.lastLoginAt = new Date();
  await user.save();

  return {
    token: signSession({ sub: String(user._id), tv: user.tokenVersion }),
    user: { ...toPublicUser(user.toObject()), permissions: ROLE_PERMISSIONS[user.role] },
  };
}

export async function getProfile(userId: string) {
  const user = await User.findById(userId).lean();
  if (!user) throw ApiError.unauthorized();
  return { ...toPublicUser(user), permissions: ROLE_PERMISSIONS[user.role] };
}

export async function updateProfile(userId: string, name: string) {
  const user = await User.findByIdAndUpdate(userId, { name }, { new: true }).lean();
  if (!user) throw ApiError.unauthorized();
  return { ...toPublicUser(user), permissions: ROLE_PERMISSIONS[user.role] };
}

/** Changing the password invalidates every other session and returns a fresh one. */
export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) throw ApiError.unauthorized();
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw ApiError.badRequest("Le mot de passe actuel est incorrect");
  }
  user.passwordHash = await hashPassword(newPassword);
  user.tokenVersion += 1;
  await user.save();
  return signSession({ sub: String(user._id), tv: user.tokenVersion });
}
