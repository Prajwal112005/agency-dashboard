import jwt from "jsonwebtoken";
import crypto from "crypto";
import { config } from "../config";
import { Role } from "@prisma/client";

export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, { expiresIn: config.jwt.accessTtl });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
}

// Refresh tokens are opaque random strings, not JWTs — we store (a hash of)
// them in the DB per user so they can be individually revoked/rotated. This
// is why "refreshing" also requires a DB round trip, unlike the stateless
// access token.
export function generateOpaqueToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

export function hashOpaqueToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshExpiryDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + config.jwt.refreshTtlDays);
  return d;
}
