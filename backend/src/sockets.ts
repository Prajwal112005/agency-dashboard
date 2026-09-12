import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyAccessToken } from "./auth/jwt";
import { prisma } from "./prisma";
import { Role } from "@prisma/client";
import { config } from "./config";

interface SocketUser {
  id: string;
  role: Role;
}

declare module "socket.io" {
  interface Socket {
    user?: SocketUser;
  }
}

let io: Server;

// userId -> number of live socket connections (a user can have several tabs
// open; presence should only flip "offline" once the last one disconnects).
const presence = new Map<string, number>();

export function initSockets(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.corsOrigin, credentials: true },
  });

  // Auth happens on the socket handshake, the same access token the REST
  // API uses. Sockets never trust a role/userId sent by the client after
  // connecting — everything downstream reads from socket.user.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Missing access token"));
    try {
      const payload = verifyAccessToken(token);
      socket.user = { id: payload.sub, role: payload.role };
      next();
    } catch {
      next(new Error("Invalid or expired access token"));
    }
  });

  io.on("connection", (socket: Socket) => handleConnection(socket));

  return io;
}

async function handleConnection(socket: Socket) {
  const user = socket.user!;

  // Every user has a personal room for direct notifications, and admins
  // additionally get a firehose room so the global admin feed does not
  // require joining every individual project room.
  socket.join(`user:${user.id}`);
  if (user.role === "ADMIN") socket.join("admin:activity");

  presence.set(user.id, (presence.get(user.id) ?? 0) + 1);
  if (presence.get(user.id) === 1) broadcastPresence();

  // Developers join TASK rooms, never project rooms. A project can contain
  // tasks assigned to multiple developers, so joining the project room would
  // leak other developers' activity. PMs/Admins may join project rooms after
  // a fresh server-side ownership check.
  if (user.role === "DEVELOPER") {
    const tasks = await prisma.task.findMany({
      where: { assignedToId: user.id },
      select: { id: true },
    });
    tasks.forEach((t) => socket.join(`task:${t.id}`));
  }

  socket.on("join:project", async (projectId: string, ack?: (ok: boolean) => void) => {
    if (user.role === "DEVELOPER") {
      const tasks = await prisma.task.findMany({
        where: { projectId, assignedToId: user.id },
        select: { id: true },
      });
      tasks.forEach((t) => socket.join(`task:${t.id}`));
      ack?.(tasks.length > 0);
      return;
    }
    const allowed = await canAccessProject(user, projectId);
    if (allowed) socket.join(`project:${projectId}`);
    ack?.(allowed);
  });

  socket.on("join:task", async (taskId: string, ack?: (ok: boolean) => void) => {
    if (user.role !== "DEVELOPER") {
      ack?.(false);
      return;
    }
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { assignedToId: true } });
    const allowed = task?.assignedToId === user.id;
    if (allowed) socket.join(`task:${taskId}`);
    ack?.(allowed);
  });

  socket.on("leave:project", (projectId: string) => {
    socket.leave(`project:${projectId}`);
  });

  socket.on("disconnect", () => {
    const count = (presence.get(user.id) ?? 1) - 1;
    if (count <= 0) {
      presence.delete(user.id);
      broadcastPresence();
    } else {
      presence.set(user.id, count);
    }
  });
}

async function canAccessProject(user: SocketUser, projectId: string): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return false;
  if (user.role === "PM") return project.managerId === user.id;
  // Developer: allowed only if they have a task on this project.
  const task = await prisma.task.findFirst({
    where: { projectId, assignedToId: user.id },
    select: { id: true },
  });
  return !!task;
}

function broadcastPresence() {
  io.to("admin:activity").emit("presence:count", { onlineUsers: presence.size });
}

// --- Emit helpers used by services/activityService.ts -----------------

export function emitActivity(projectId: string, taskId: string, activity: unknown) {
  // PMs receive project activity; Developers receive only their task's
  // activity; Admins receive the global stream. There is deliberately no
  // developer subscription to a project-wide room.
  io.to(`project:${projectId}`).to(`task:${taskId}`).to("admin:activity").emit("activity:new", activity);
}

export function syncTaskRoom(taskId: string, previousAssigneeId?: string | null, assigneeId?: string | null) {
  if (!io) return;
  if (previousAssigneeId && previousAssigneeId !== assigneeId) {
    io.in(`user:${previousAssigneeId}`).socketsLeave(`task:${taskId}`);
  }
  if (assigneeId) {
    io.in(`user:${assigneeId}`).socketsJoin(`task:${taskId}`);
  }
}

export function emitNotification(userId: string, notification: unknown) {
  io.to(`user:${userId}`).emit("notification:new", notification);
}

export function getOnlineUserCount(): number {
  return presence.size;
}
