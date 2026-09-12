import { Router } from "express";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../auth/middleware";
import { asyncHandler } from "../errors";
import { createClientSchema, updateClientSchema } from "../validation/schemas";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    // Any authenticated role can see the client list (needed to label
    // projects) but only Admin can create/manage clients.
    const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
    res.json(clients);
  })
);

router.post(
  "/",
  authorize("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = createClientSchema.parse(req.body);
    const client = await prisma.client.create({
      data: { name: data.name, contactEmail: data.contactEmail || undefined },
    });
    res.status(201).json(client);
  })
);

router.patch("/:id", authorize("ADMIN"), asyncHandler(async (req, res) => {
  const data = updateClientSchema.parse(req.body);
  const existing = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Client not found" } });
  const client = await prisma.client.update({ where: { id: existing.id }, data });
  res.json(client);
}));

router.delete("/:id", authorize("ADMIN"), asyncHandler(async (req, res) => {
  const existing = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Client not found" } });
  await prisma.client.delete({ where: { id: existing.id } });
  res.status(204).send();
}));

export default router;
