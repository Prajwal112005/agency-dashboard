import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../auth/middleware";
import { asyncHandler, forbidden, notFound } from "../errors";
import { createTaskSchema, updateTaskSchema, updateTaskStatusSchema, taskFilterSchema } from "../validation/schemas";
import { assertProjectAccess } from "./projects";
import { recordStatusChange, notifyTaskAssigned, priorityWeight } from "../services/activityService";
import { syncTaskRoom } from "../sockets";

const router = Router();
router.use(authenticate);

// GET /api/tasks?status=&priority=&dueFrom=&dueTo=&projectId=
// Filters are plain URL query params on purpose (per spec: shareable URLs).
// Role scoping is layered on top of the filters, never replacing them.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filters = taskFilterSchema.parse(req.query);
    const { id: userId, role } = req.user!;

    const where: Prisma.TaskWhereInput = {
      status: filters.status,
      priority: filters.priority,
      projectId: filters.projectId,
      dueDate: {
        gte: filters.dueFrom,
        lte: filters.dueTo,
      },
    };

    if (role === "PM") {
      where.project = { managerId: userId };
    } else if (role === "DEVELOPER") {
      where.assignedToId = userId;
    }
    // ADMIN: no extra scoping — sees everything matching the filters.

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: "asc" }],
    });

    res.json(tasks);
  })
);

router.post(
  "/project/:projectId",
  authorize("ADMIN", "PM"),
  asyncHandler(async (req, res) => {
    await assertProjectAccess(req.user!.id, req.user!.role, req.params.projectId);
    const data = createTaskSchema.parse(req.body);

    const assignee = await prisma.user.findUnique({ where: { id: data.assignedToId }, select: { role: true } });
    if (!assignee || assignee.role !== "DEVELOPER") throw forbidden("Tasks can only be assigned to Developers");

    const task = await prisma.task.create({
      data: {
        projectId: req.params.projectId,
        title: data.title,
        description: data.description,
        assignedToId: data.assignedToId,
        priority: data.priority,
        dueDate: data.dueDate,
      },
    });

    if (task.assignedToId) await notifyTaskAssigned(task);
    res.status(201).json(task);
  })
);

router.patch(
  "/:id",
  authorize("ADMIN", "PM"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Task not found");
    await assertProjectAccess(req.user!.id, req.user!.role, existing.projectId);

    const data = updateTaskSchema.parse(req.body);
    if (data.assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: data.assignedToId }, select: { role: true } });
      if (!assignee || assignee.role !== "DEVELOPER") throw forbidden("Tasks can only be assigned to Developers");
    }

    const task = await prisma.task.update({
      where: { id: existing.id },
      data: {
        title: data.title,
        description: data.description,
        assignedToId: data.assignedToId,
        priority: data.priority,
        dueDate: data.dueDate,
      },
    });

    if (data.assignedToId !== undefined && data.assignedToId !== existing.assignedToId) {
      syncTaskRoom(task.id, existing.assignedToId, task.assignedToId);
    }
    if (data.assignedToId && data.assignedToId !== existing.assignedToId) {
      await notifyTaskAssigned(task);
    }

    res.json(task);
  })
);

// Status transitions are the one action a Developer can also perform, but
// only on their own task — enforced below, not just hidden client-side.
router.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const { id: userId, role } = req.user!;
    const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Task not found");

    if (role === "DEVELOPER") {
      if (existing.assignedToId !== userId) {
        throw forbidden("You can only update tasks assigned to you");
      }
    } else {
      await assertProjectAccess(userId, role, existing.projectId);
    }

    const { status } = updateTaskStatusSchema.parse(req.body);
    if (status === existing.status) return res.json(existing);

    const task = await prisma.task.update({
      where: { id: existing.id },
      data: { status, isOverdue: status === "DONE" ? false : existing.isOverdue },
    });

    await recordStatusChange(task, userId, existing.status, status);
    res.json(task);
  })
);

// Helper export used by dashboard route for sorting developer's task list.
export { priorityWeight };
export default router;
