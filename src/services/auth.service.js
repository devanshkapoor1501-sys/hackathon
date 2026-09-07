import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, RefreshToken, OrganizationMember } from '../models/index.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { randomId, sha256 } from '../utils/security.js';

const publicUser = user => ({
  id: user._id.toString(), email: user.email, name: user.name,
  accountRole: user.accountRole || 'applicant',
  emailVerified: Boolean(user.emailVerifiedAt)
});

export class AuthService {
  async register(input) {
    const email = input.email.trim().toLowerCase();
    if (await User.exists({ email })) throw new AppError(409, 'EMAIL_IN_USE', 'An account already exists for this email');
    const verificationToken = randomId('verify_');
    const user = await User.create({
      email,
      name: input.name.trim(),
      passwordHash: await bcrypt.hash(input.password, 12),
      emailVerificationTokenHash: sha256(verificationToken)
    });
    await OrganizationMember.updateMany({ invitedEmail: email, status: 'invited' }, { $set: { userId: user._id, status: 'active' }, $unset: { invitedEmail: 1 } });
    return { user: publicUser(user), verificationToken: env.NODE_ENV === 'production' ? undefined : verificationToken };
  }

  async login(input, context = {}) {
    const user = await User.findOne({ email: input.email.trim().toLowerCase() }).select('+passwordHash');
    if (!user || user.status !== 'active' || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    return this.issueSession(user, context);
  }

  async issueSession(user, context = {}, familyId = randomId('fam_')) {
    const refreshJti = randomId('rt_');
    const accessToken = jwt.sign({ sub: user._id.toString(), type: 'access' }, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL });
    const refreshToken = jwt.sign({ sub: user._id.toString(), type: 'refresh', jti: refreshJti, familyId }, env.JWT_REFRESH_SECRET, { expiresIn: `${env.REFRESH_TOKEN_DAYS}d` });
    await RefreshToken.create({
      userId: user._id,
      familyId,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86400000),
      userAgent: context.userAgent,
      ip: context.ip
    });
    return { user: publicUser(user), accessToken, refreshToken };
  }

  async refresh(rawToken, context = {}) {
    let payload;
    try { payload = jwt.verify(rawToken, env.JWT_REFRESH_SECRET); }
    catch { throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired'); }
    const tokenHash = sha256(rawToken);
    const stored = await RefreshToken.findOne({ tokenHash });
    if (!stored || stored.revokedAt) {
      if (payload.familyId) await RefreshToken.updateMany({ familyId: payload.familyId, revokedAt: null }, { revokedAt: new Date() });
      throw new AppError(401, 'TOKEN_REUSE_DETECTED', 'Refresh token reuse detected');
    }
    const user = await User.findById(payload.sub);
    if (!user || user.status !== 'active') throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Account is unavailable');
    const session = await this.issueSession(user, context, stored.familyId);
    stored.revokedAt = new Date();
    stored.replacedByHash = sha256(session.refreshToken);
    await stored.save();
    return session;
  }

  async logout(rawToken) {
    if (rawToken) await RefreshToken.updateOne({ tokenHash: sha256(rawToken), revokedAt: null }, { revokedAt: new Date() });
  }

  async forgotPassword(email) {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return {};
    const resetToken = randomId('reset_');
    user.passwordResetTokenHash = sha256(resetToken);
    user.passwordResetExpiresAt = new Date(Date.now() + 3600000);
    await user.save();
    return { resetToken: env.NODE_ENV === 'production' ? undefined : resetToken };
  }

  async resetPassword(token, password) {
    const user = await User.findOne({ passwordResetTokenHash: sha256(token), passwordResetExpiresAt: { $gt: new Date() } });
    if (!user) throw new AppError(400, 'INVALID_RESET_TOKEN', 'Reset token is invalid or expired');
    user.passwordHash = await bcrypt.hash(password, 12);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();
    await RefreshToken.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
  }

  async verifyEmail(token) {
    const user = await User.findOne({ emailVerificationTokenHash: sha256(token) });
    if (!user) throw new AppError(400, 'INVALID_VERIFICATION_TOKEN', 'Verification token is invalid');
    user.emailVerifiedAt = new Date();
    user.emailVerificationTokenHash = undefined;
    await user.save();
  }
}

export const authService = new AuthService();
