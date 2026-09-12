export type Role = "ADMIN" | "PM" | "DEVELOPER";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Client {
  id: string;
  name: string;
  contactEmail: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  clientId: string | null;
  client?: Client | null;
  managerId: string;
  manager?: { id: string; name: string };
  createdAt: string;
  _count?: { tasks: number };
}

export interface Task {
  id: string;
  projectId: string;
  project?: { id: string; name: string };
  title: string;
  description: string;
  assignedToId: string;
  assignedTo?: { id: string; name: string };
  status: TaskStatus;
  priority: Priority;
  dueDate: string;
  isOverdue: boolean;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  taskId: string;
  task: { id: string; title: string };
  projectId: string;
  project?: { id: string; name: string };
  actorId: string;
  actor: { id: string; name: string };
  oldStatus: TaskStatus;
  newStatus: TaskStatus;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: "TASK_ASSIGNED" | "TASK_IN_REVIEW";
  message: string;
  taskId: string | null;
  isRead: boolean;
  createdAt: string;
}
