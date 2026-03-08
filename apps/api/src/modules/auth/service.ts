import { prisma } from "../../lib/prisma.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { createAuthToken, verifyAuthToken } from "../../lib/token.js";

class AuthError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
  }
}

type AuthUser = {
  id: string;
  email: string;
  fullName: string;
};

function toAuthUser(user: { id: string; email: string; fullName: string }): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export { AuthError };

export const authService = {
  async register(email: string, fullName: string, password: string) {
    const normalizedEmail = normalizeEmail(email);
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existing) {
      throw new AuthError("Email already registered", 409);
    }

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        fullName: fullName.trim(),
        passwordHash: hashPassword(password)
      }
    });

    return {
      user: toAuthUser(user),
      token: createAuthToken(user.id)
    };
  },

  async login(email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new AuthError("Invalid email or password", 401);
    }

    return {
      user: toAuthUser(user),
      token: createAuthToken(user.id)
    };
  },

  async me(token: string) {
    const payload = verifyAuthToken(token);

    if (!payload) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, fullName: true }
    });

    return user ? toAuthUser(user) : null;
  }
};
