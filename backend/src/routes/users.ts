import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../auth/middleware";
import { asyncHandler, badRequest, conflict, notFound } from "../errors";
import { createUserSchema, updateUserSchema } from "../validation/schemas";

const router = Router();
router.use(authenticate);

router.get("/", authorize("ADMIN", "PM"), asyncHandler(async (req, res) => {
  const role = req.query.role as "ADMIN" | "PM" | "DEVELOPER" | undefined;
  const users = await prisma.user.findMany({
    where: role ? { role } : req.user!.role === "ADMIN" ? {} : { role: { in: ["PM", "DEVELOPER"] } },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { name: "asc" },
  });
  res.json(users);
}));

router.post("/", authorize("ADMIN"), asyncHandler(async (req, res) => {
  const data = createUserSchema.parse(req.body);
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw conflict("A user with this email already exists");
  const user = await prisma.user.create({
    data: { ...data, passwordHash: await bcrypt.hash(data.password, 12) },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  res.status(201).json(user);
}));

router.patch("/:id", authorize("ADMIN"), asyncHandler(async (req, res) => {
  const data = updateUserSchema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound("User not found");
  if (data.email && data.email !== existing.email) {
    const duplicate = await prisma.user.findUnique({ where: { email: data.email } });
    if (duplicate) throw conflict("A user with this email already exists");
  }
  if (data.role && data.role !== existing.role) {
    const [managedProjects, assignedTasks] = await Promise.all([
      prisma.project.count({ where: { managerId: existing.id } }),
      prisma.task.count({ where: { assignedToId: existing.id } }),
    ]);
    if (managedProjects || assignedTasks) {
      throw badRequest("Role cannot be changed while the user owns projects or is assigned to tasks");
    }
  }
  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: {
      name: data.name, email: data.email, role: data.role,
      ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 12) } : {}),
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  res.json(updated);
}));

router.delete("/:id", authorize("ADMIN"), asyncHandler(async (req, res) => {
  if (req.params.id === req.user!.id) throw badRequest("You cannot delete your own account");
  const existing = await prisma.user.findUnique({ where: { id: req.params.id }, include: { managedProjects: { select: { id: true } }, assignedTasks: { select: { id: true } }, _count: { select: { activityEvents: true, notifications: true } } } });
  if (!existing) throw notFound("User not found");
  if (existing.managedProjects.length || existing.assignedTasks.length || existing._count.activityEvents || existing._count.notifications) {
    throw badRequest("User cannot be deleted while they own projects, tasks, or audit/notification history");
  }
  await prisma.user.delete({ where: { id: existing.id } });
  res.status(204).send();
}));

export default router;
