import { Priority, Task, TaskStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { emitActivity, emitNotification, syncTaskRoom } from "../sockets";

// Records a status change to the (append-only) activity log, then fans out
// the two real-time side-effects it can trigger: the live feed event, and
// (when the new status is IN_REVIEW) a notification to the project's PM.
export async function recordStatusChange(
  task: Task,
  actorId: string,
  oldStatus: TaskStatus,
  newStatus: TaskStatus
) {
  const activity = await prisma.activityLog.create({
    data: {
      taskId: task.id,
      projectId: task.projectId,
      actorId,
      oldStatus,
      newStatus,
    },
    include: {
      actor: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
  });

  emitActivity(task.projectId, task.id, activity);

  if (newStatus === "IN_REVIEW" && oldStatus !== "IN_REVIEW") {
    const project = await prisma.project.findUnique({ where: { id: task.projectId } });
    if (project) {
      const notification = await prisma.notification.create({
        data: {
          userId: project.managerId,
          type: "TASK_IN_REVIEW",
          message: `Task "${task.title}" moved to In Review`,
          taskId: task.id,
        },
      });
      emitNotification(project.managerId, notification);
    }
  }

  return activity;
}

export async function notifyTaskAssigned(task: Task) {
  if (!task.assignedToId) return;
  const notification = await prisma.notification.create({
    data: {
      userId: task.assignedToId,
      type: "TASK_ASSIGNED",
      message: `You were assigned to "${task.title}"`,
      taskId: task.id,
    },
  });
  emitNotification(task.assignedToId, notification);
  syncTaskRoom(task.id, null, task.assignedToId);
}

export function priorityWeight(p: Priority): number {
  return { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[p];
}
