import { Router } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../auth/middleware";
import { asyncHandler } from "../errors";

const router = Router();
router.use(authenticate);

// GET /api/activity?since=<ISO timestamp>
// This is the "I was offline, what did I miss" endpoint. It always reads
// from the ActivityLog table (never from an in-memory/socket buffer, which
// would be empty after a server restart or simply never have reached a
// client that was disconnected). Returns at most the last 20 events the
// user is allowed to see, newest first.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { id: userId, role } = req.user!;
    const since = req.query.since ? new Date(String(req.query.since)) : undefined;
    const projectId = req.query.projectId ? String(req.query.projectId) : undefined;

    const where: import("@prisma/client").Prisma.ActivityLogWhereInput = {
      ...(since ? { createdAt: { gt: since } } : {}),
      ...(projectId ? { projectId } : {}),
    };

    if (role === "PM") {
      where.project = { managerId: userId };
    } else if (role === "DEVELOPER") {
      where.task = { assignedToId: userId };
    }

    const events = await prisma.activityLog.findMany({
      where,
      include: {
        actor: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    res.json(events);
  })
);

export default router;
