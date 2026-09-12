import cron from "node-cron";
import { prisma } from "../prisma";
import { config } from "../config";

// Why node-cron over Bull/BullMQ:
// This job is a single, stateless, idempotent sweep ("flip isOverdue=true for
// any task whose dueDate has passed and isn't already flagged/Done") that
// runs on a fixed schedule with no per-job payload, no retries, and no need
// to distribute work across multiple worker processes. BullMQ earns its
// keep when you need a durable job *queue* — arbitrary jobs enqueued at
// runtime, retries with backoff, concurrency control, multiple workers
// pulling from Redis. None of that applies here, and pulling in Redis purely
// to schedule a five-line sweep would be infrastructure the app doesn't
// need. If the app later grows features like "send a reminder email queue"
// or "generate a PDF report," which involve business jobs enqueued per
// request with retry semantics, BullMQ would be the right upgrade for that,
// run alongside the cron.
export function startOverdueJob() {
  const task = cron.schedule(config.overdueCron, async () => {
    try {
      const result = await prisma.task.updateMany({
        where: {
          dueDate: { lt: new Date() },
          status: { not: "DONE" },
          isOverdue: false,
        },
        data: { isOverdue: true },
      });
      if (result.count > 0) {
        console.log(`[overdue-job] flagged ${result.count} task(s) as overdue`);
      }
    } catch (err) {
      console.error("[overdue-job] failed", err);
    }
  });

  task.start();
  console.log(`[overdue-job] scheduled with cron "${config.overdueCron}"`);
  return task;
}
