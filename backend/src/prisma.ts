import { PrismaClient } from "@prisma/client";

// Single shared PrismaClient instance for the whole process (recommended
// pattern — avoids exhausting the Postgres connection pool in dev with
// hot-reload, and keeps query logging centralized).
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
