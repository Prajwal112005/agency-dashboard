import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { asyncHandler, unauthorized } from "../errors";
import { loginSchema } from "../validation/schemas";
import { signAccessToken, generateOpaqueToken, hashOpaqueToken, refreshExpiryDate } from "../auth/jwt";
import { config } from "../config";
import { authenticate } from "../auth/middleware";

const router = Router();

function setRefreshCookie(res: import("express").Response, token: string) {
  res.cookie(config.cookie.name, token, {
    httpOnly: true, // never readable from JS — mitigates XSS token theft
    secure: config.cookie.secure,
    sameSite: config.nodeEnv === "production" ? "none" : "lax",
    maxAge: config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000,
    path: "/api/auth",
  });
}

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw unauthorized("Invalid email or password");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw unauthorized("Invalid email or password");

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = generateOpaqueToken();
    await prisma.refreshToken.create({
      data: { token: hashOpaqueToken(refreshToken), userId: user.id, expiresAt: refreshExpiryDate() },
    });

    setRefreshCookie(res, refreshToken);
    res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  })
);

// Rotates the refresh token on every use (revoke old, issue new) so a stolen
// cookie has a limited window and reuse is detectable.
router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[config.cookie.name];
    if (!token) throw unauthorized("Missing refresh token");

    const stored = await prisma.refreshToken.findUnique({ where: { token: hashOpaqueToken(token) } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw unauthorized("Refresh token is invalid or expired");
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) throw unauthorized();

    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

    const newRefreshToken = generateOpaqueToken();
    await prisma.refreshToken.create({
      data: { token: hashOpaqueToken(newRefreshToken), userId: user.id, expiresAt: refreshExpiryDate() },
    });
    setRefreshCookie(res, newRefreshToken);

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[config.cookie.name];
    if (token) {
      await prisma.refreshToken.updateMany({ where: { token: hashOpaqueToken(token) }, data: { revoked: true } });
    }
    res.clearCookie(config.cookie.name, { path: "/api/auth" });
    res.status(204).send();
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw unauthorized();
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  })
);

export default router;
