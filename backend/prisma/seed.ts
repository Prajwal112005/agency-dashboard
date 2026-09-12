import { PrismaClient, Priority, TaskStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  console.log("Seeding...");

  const password = await hash("Password123!");

  const admin = await prisma.user.create({
    data: { email: "admin@agency.dev", passwordHash: password, name: "Alex Admin", role: "ADMIN" },
  });

  const pm1 = await prisma.user.create({
    data: { email: "priya.pm@agency.dev", passwordHash: password, name: "Priya Shah", role: "PM" },
  });
  const pm2 = await prisma.user.create({
    data: { email: "marcus.pm@agency.dev", passwordHash: password, name: "Marcus Lee", role: "PM" },
  });

  const dev1 = await prisma.user.create({
    data: { email: "ravi.dev@agency.dev", passwordHash: password, name: "Ravi Kumar", role: "DEVELOPER" },
  });
  const dev2 = await prisma.user.create({
    data: { email: "sofia.dev@agency.dev", passwordHash: password, name: "Sofia Costa", role: "DEVELOPER" },
  });
  const dev3 = await prisma.user.create({
    data: { email: "wei.dev@agency.dev", passwordHash: password, name: "Wei Zhang", role: "DEVELOPER" },
  });
  const dev4 = await prisma.user.create({
    data: { email: "amara.dev@agency.dev", passwordHash: password, name: "Amara Obi", role: "DEVELOPER" },
  });

  const clientA = await prisma.client.create({ data: { name: "Northwind Retail", contactEmail: "ops@northwind.example" } });
  const clientB = await prisma.client.create({ data: { name: "Bluepeak Finance", contactEmail: "contact@bluepeak.example" } });
  const clientC = await prisma.client.create({ data: { name: "Solara Health", contactEmail: "hello@solara.example" } });

  const projectAlpha = await prisma.project.create({
    data: { name: "Northwind Storefront Revamp", description: "Rebuild the e-commerce storefront", clientId: clientA.id, managerId: pm1.id },
  });
  const projectBeta = await prisma.project.create({
    data: { name: "Bluepeak Client Portal", description: "Self-service portal for account holders", clientId: clientB.id, managerId: pm1.id },
  });
  const projectGamma = await prisma.project.create({
    data: { name: "Solara Patient App", description: "Mobile app for appointment scheduling", clientId: clientC.id, managerId: pm2.id },
  });

  type Seed = { title: string; description: string; assignedToId: string; status: TaskStatus; priority: Priority; dueDate: Date };

  const alphaTasks: Seed[] = [
    { title: "Set up product catalog API", description: "Work item for set up product catalog api.", assignedToId: dev1.id, status: "DONE", priority: "HIGH", dueDate: daysFromNow(-10) },
    { title: "Build checkout flow", description: "Work item for build checkout flow.", assignedToId: dev1.id, status: "IN_PROGRESS", priority: "CRITICAL", dueDate: daysFromNow(3) },
    { title: "Integrate payment gateway", description: "Work item for integrate payment gateway.", assignedToId: dev2.id, status: "TODO", priority: "CRITICAL", dueDate: daysFromNow(5) },
    { title: "Migrate legacy product images", description: "Work item for migrate legacy product images.", assignedToId: dev2.id, status: "TODO", priority: "LOW", dueDate: daysFromNow(-2) }, // overdue
    { title: "Responsive nav redesign", description: "Work item for responsive nav redesign.", assignedToId: dev1.id, status: "IN_REVIEW", priority: "MEDIUM", dueDate: daysFromNow(1) },
    { title: "Add cart persistence", description: "Work item for add cart persistence.", assignedToId: dev2.id, status: "TODO", priority: "MEDIUM", dueDate: daysFromNow(9) },
  ];

  const betaTasks: Seed[] = [
    { title: "Design portal information architecture", description: "Work item for design portal information architecture.", assignedToId: dev3.id, status: "DONE", priority: "MEDIUM", dueDate: daysFromNow(-14) },
    { title: "Build statements viewer", description: "Work item for build statements viewer.", assignedToId: dev3.id, status: "IN_PROGRESS", priority: "HIGH", dueDate: daysFromNow(4) },
    { title: "Add two-factor login", description: "Work item for add two-factor login.", assignedToId: dev4.id, status: "TODO", priority: "CRITICAL", dueDate: daysFromNow(-1) }, // overdue
    { title: "Wire up support-ticket form", description: "Work item for wire up support-ticket form.", assignedToId: dev4.id, status: "TODO", priority: "LOW", dueDate: daysFromNow(12) },
    { title: "Accessibility audit", description: "Work item for accessibility audit.", assignedToId: dev3.id, status: "IN_REVIEW", priority: "MEDIUM", dueDate: daysFromNow(2) },
  ];

  const gammaTasks: Seed[] = [
    { title: "Appointment booking flow", description: "Work item for appointment booking flow.", assignedToId: dev1.id, status: "TODO", priority: "HIGH", dueDate: daysFromNow(6) },
    { title: "Push notification service", description: "Work item for push notification service.", assignedToId: dev2.id, status: "IN_PROGRESS", priority: "MEDIUM", dueDate: daysFromNow(8) },
    { title: "Clinician directory search", description: "Work item for clinician directory search.", assignedToId: dev3.id, status: "TODO", priority: "MEDIUM", dueDate: daysFromNow(10) },
    { title: "HIPAA compliance review", description: "Work item for hipaa compliance review.", assignedToId: dev4.id, status: "IN_REVIEW", priority: "CRITICAL", dueDate: daysFromNow(0) },
    { title: "Onboarding walkthrough screens", description: "Work item for onboarding walkthrough screens.", assignedToId: dev1.id, status: "DONE", priority: "LOW", dueDate: daysFromNow(-7) },
  ];

  async function createTasksWithHistory(projectId: string, seeds: Seed[]) {
    for (const s of seeds) {
      const task = await prisma.task.create({
        data: {
          projectId,
          title: s.title,
          description: s.description,
          assignedToId: s.assignedToId,
          status: s.status,
          priority: s.priority,
          dueDate: s.dueDate,
          isOverdue: s.dueDate < new Date() && s.status !== "DONE",
        },
      });

      // Backfill a small, plausible activity trail so the feed isn't empty
      // on first run, and an assignment notification for the assignee.
      await prisma.activityLog.create({
        data: {
          taskId: task.id,
          projectId,
          actorId: task.assignedToId!,
          oldStatus: "TODO",
          newStatus: task.status,
        },
      });

      await prisma.notification.create({
        data: {
          userId: task.assignedToId!,
          type: "TASK_ASSIGNED",
          message: `You were assigned to "${task.title}"`,
          taskId: task.id,
        },
      });
    }
  }

  await createTasksWithHistory(projectAlpha.id, alphaTasks);
  await createTasksWithHistory(projectBeta.id, betaTasks);
  await createTasksWithHistory(projectGamma.id, gammaTasks);

  console.log("Seed complete.");
  console.log("Login with any of these (password: Password123!):");
  console.log(`  Admin:      ${admin.email}`);
  console.log(`  PM:         ${pm1.email}, ${pm2.email}`);
  console.log(`  Developer:  ${dev1.email}, ${dev2.email}, ${dev3.email}, ${dev4.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
