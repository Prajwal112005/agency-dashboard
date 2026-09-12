import { Task, TaskStatus } from "../types";
import { StatusBadge, PriorityBadge, OverdueBadge } from "./Badges";
import { api } from "../lib/api";

const STATUS_OPTIONS: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface Props {
  tasks: Task[];
  showProject?: boolean;
  showAssignee?: boolean;
  canChangeStatus?: boolean;
  onChanged?: () => void;
}

export default function TaskTable({ tasks, showProject, showAssignee, canChangeStatus, onChanged }: Props) {
  async function changeStatus(taskId: string, status: TaskStatus) {
    await api.patch(`/tasks/${taskId}/status`, { status });
    onChanged?.();
  }

  if (tasks.length === 0) {
    return <div className="empty-state">No tasks match these filters.</div>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Task</th>
          {showProject && <th>Project</th>}
          {showAssignee && <th>Assignee</th>}
          <th>Priority</th>
          <th>Due</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((t) => (
          <tr key={t.id}>
            <td>{t.title}</td>
            {showProject && <td style={{ color: "var(--text-muted)" }}>{t.project?.name}</td>}
            {showAssignee && <td style={{ color: "var(--text-muted)" }}>{t.assignedTo?.name ?? "—"}</td>}
            <td>
              <PriorityBadge priority={t.priority} />
            </td>
            <td>
              <span className="mono-label">{formatDate(t.dueDate)}</span>{" "}
              {t.isOverdue && t.status !== "DONE" && <OverdueBadge />}
            </td>
            <td>
              {canChangeStatus ? (
                <select
                  value={t.status}
                  onChange={(e) => changeStatus(t.id, e.target.value as TaskStatus)}
                  className="mono-label"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <StatusBadge status={t.status} />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
