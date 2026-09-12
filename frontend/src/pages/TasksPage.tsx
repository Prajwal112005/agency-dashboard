import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import TaskTable from "../components/TaskTable";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useQueryFilters } from "../hooks/useQueryFilters";
import { Task } from "../types";

export default function TasksPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useQueryFilters();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await api.get("/tasks", { params: filters });
    setTasks(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.priority, filters.dueFrom, filters.dueTo, filters.projectId]);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
  }

  return (
    <Layout title={user?.role === "DEVELOPER" ? "All my tasks" : "Tasks"}>
      <div className="filters-row">
        <div className="field">
          <label>Status</label>
          <select value={filters.status ?? ""} onChange={(e) => setFilters({ status: e.target.value || undefined })}>
            <option value="">Any</option>
            <option value="TODO">TODO</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="IN_REVIEW">IN_REVIEW</option>
            <option value="DONE">DONE</option>
          </select>
        </div>
        <div className="field">
          <label>Priority</label>
          <select
            value={filters.priority ?? ""}
            onChange={(e) => setFilters({ priority: e.target.value || undefined })}
          >
            <option value="">Any</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </div>
        <div className="field">
          <label>Due from</label>
          <input
            type="date"
            value={filters.dueFrom ?? ""}
            onChange={(e) => setFilters({ dueFrom: e.target.value || undefined })}
          />
        </div>
        <div className="field">
          <label>Due to</label>
          <input
            type="date"
            value={filters.dueTo ?? ""}
            onChange={(e) => setFilters({ dueTo: e.target.value || undefined })}
          />
        </div>
        <button className="btn ghost" onClick={copyLink} type="button">
          Copy filtered link
        </button>
      </div>

      <div className="panel">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : (
          <TaskTable
            tasks={tasks}
            showProject
            showAssignee={user?.role !== "DEVELOPER"}
            canChangeStatus
            onChanged={load}
          />
        )}
      </div>
    </Layout>
  );
}
