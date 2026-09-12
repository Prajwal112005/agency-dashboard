import { Router } from "express";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../auth/middleware";
import { asyncHandler, badRequest, forbidden, notFound } from "../errors";
import { createProjectSchema, updateProjectSchema } from "../validation/schemas";

const router = Router();
router.use(authenticate);

// Shared ownership check reused by every project/task route so the rule
// lives in exactly one place: Admin sees everything, a PM only ever sees
// projects they created, a Developer only ever sees projects they have a
// task on.
export async function assertProjectAccess(userId: string, role: string, projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw notFound("Project not found");

  if (role === "ADMIN") return project;
  if (role === "PM") {
    if (project.managerId !== userId) throw forbidden("This is not your project");
    return project;
  }
  // DEVELOPER
  const hasTask = await prisma.task.findFirst({
    where: { projectId, assignedToId: userId },
    select: { id: true },
  });
  if (!hasTask) throw forbidden("You have no tasks on this project");
  return project;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { id: userId, role } = req.user!;

    if (role === "ADMIN") {
      const projects = await prisma.project.findMany({
        include: { client: true, manager: { select: { id: true, name: true } }, _count: { select: { tasks: true } } },
        orderBy: { createdAt: "desc" },
      });
      return res.json(projects);
    }

    if (role === "PM") {
      const projects = await prisma.project.findMany({
        where: { managerId: userId },
        include: { client: true, manager: { select: { id: true, name: true } }, _count: { select: { tasks: true } } },
        orderBy: { createdAt: "desc" },
      });
      return res.json(projects);
    }

    // DEVELOPER: only projects containing a task assigned to them.
    const projects = await prisma.project.findMany({
      where: { tasks: { some: { assignedToId: userId } } },
      include: { client: true, manager: { select: { id: true, name: true } }, _count: { select: { tasks: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(projects);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const project = await assertProjectAccess(req.user!.id, req.user!.role, req.params.id);
    const full = await prisma.project.findUnique({
      where: { id: project.id },
      include: { client: true, manager: { select: { id: true, name: true } } },
    });
    res.json(full);
  })
);

router.post(
  "/",
  authorize("ADMIN", "PM"),
  asyncHandler(async (req, res) => {
    const data = createProjectSchema.parse(req.body);
    // A PM creating a project always becomes its manager. Admin may assign
    // any PM as manager via managerId; if omitted, Admin becomes the
    // manager themself.
    let managerId = req.user!.id;
    if (req.user!.role === "ADMIN" && data.managerId) {
      const pm = await prisma.user.findUnique({ where: { id: data.managerId } });
      if (!pm || pm.role !== "PM") {
        return res.status(400).json({ error: { code: "BAD_REQUEST", message: "managerId must belong to a Project Manager" } });
      }
      managerId = pm.id;
    }

    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        clientId: data.clientId,
        managerId,
      },
    });
    res.status(201).json(project);
  })
);

router.patch("/:id", authorize("ADMIN", "PM"), asyncHandler(async (req, res) => {
  const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound("Project not found");
  await assertProjectAccess(req.user!.id, req.user!.role, existing.id);
  const data = updateProjectSchema.parse(req.body);
  let managerId = existing.managerId;
  if (req.user!.role === "PM") {
    managerId = req.user!.id;
  } else if (data.managerId) {
    const manager = await prisma.user.findUnique({ where: { id: data.managerId } });
    if (!manager || manager.role !== "PM") throw badRequest("managerId must belong to a Project Manager");
    managerId = manager.id;
  }
  const project = await prisma.project.update({
    where: { id: existing.id },
    data: { name: data.name, description: data.description, clientId: data.clientId, managerId },
    include: { client: true, manager: { select: { id: true, name: true } } },
  });
  res.json(project);
}));

router.delete("/:id", authorize("ADMIN", "PM"), asyncHandler(async (req, res) => {
  const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound("Project not found");
  await assertProjectAccess(req.user!.id, req.user!.role, existing.id);
  await prisma.project.delete({ where: { id: existing.id } });
  res.status(204).send();
}));

export default router;
