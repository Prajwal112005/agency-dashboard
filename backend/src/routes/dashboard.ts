import { Router } from "express";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../auth/middleware";
import { asyncHandler } from "../errors";
import { getOnlineUserCount } from "../sockets";
import { priorityWeight } from "../services/activityService";

const router = Router();
router.use(authenticate);

router.get(
  "/admin",
  authorize("ADMIN"),
  asyncHandler(async (_req, res) => {
    const [totalProjects, statusCounts, overdueCount] = await Promise.all([
      prisma.project.count(),
      prisma.task.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.task.count({ where: { isOverdue: true, status: { not: "DONE" } } }),
    ]);

    const tasksByStatus = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 } as Record<string, number>;
    statusCounts.forEach((s) => (tasksByStatus[s.status] = s._count._all));

    res.json({
      totalProjects,
      tasksByStatus,
      overdueCount,
      onlineUsers: getOnlineUserCount(),
    });
  })
);

router.get(
  "/pm",
  authorize("PM"),
  asyncHandler(async (req, res) => {
    const managerId = req.user!.id;
    const projects = await prisma.project.findMany({
      where: { managerId },
      include: { _count: { select: { tasks: true } } },
    });

    const projectIds = projects.map((p) => p.id);

    const tasks = await prisma.task.findMany({
      where: { projectId: { in: projectIds } },
      include: { assignedTo: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
    });

    const byPriority: Record<string, typeof tasks> = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] };
    tasks.forEach((t) => byPriority[t.priority].push(t));

    const now = new Date();
    const weekFromNow = new Date();
    weekFromNow.setDate(now.getDate() + 7);
    const upcomingThisWeek = tasks
      .filter((t) => t.dueDate >= now && t.dueDate <= weekFromNow && t.status !== "DONE")
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    res.json({
      projectSummary: projects.map((p) => ({ id: p.id, name: p.name, taskCount: p._count.tasks })),
      tasksByPriority: byPriority,
      upcomingThisWeek,
    });
  })
);

router.get(
  "/developer",
  authorize("DEVELOPER"),
  asyncHandler(async (req, res) => {
    const tasks = await prisma.task.findMany({
      where: { assignedToId: req.user!.id },
      include: { project: { select: { id: true, name: true } } },
    });

    const sorted = [...tasks].sort((a, b) => {
      const p = priorityWeight(a.priority) - priorityWeight(b.priority);
      if (p !== 0) return p;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });

    res.json({ tasks: sorted });
  })
);

export default router;
