import { Priority, TaskStatus } from "../types";

const STATUS_COLOR: Record<TaskStatus, string> = {
  TODO: "var(--text-faint)",
  IN_PROGRESS: "var(--accent)",
  IN_REVIEW: "var(--signal-violet)",
  DONE: "var(--signal-green)",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className="status-cell">
      <span className="status-stripe" style={{ background: STATUS_COLOR[status] }} />
      <span className="mono-label" style={{ color: STATUS_COLOR[status] }}>
        {status}
      </span>
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`pill priority-${priority}`}>{priority}</span>;
}

export function OverdueBadge() {
  return <span className="pill overdue">OVERDUE</span>;
}
