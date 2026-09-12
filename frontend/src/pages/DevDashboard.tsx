import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import ActivityFeed from "../components/ActivityFeed";
import TaskTable from "../components/TaskTable";
import { api } from "../lib/api";
import { Task } from "../types";

export default function DevDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);

  async function load() {
    const res = await api.get("/dashboard/developer");
    setTasks(res.data.tasks);
  }

  useEffect(() => {
    load();
  }, []);

  const openCount = tasks.filter((t) => t.status !== "DONE").length;
  const overdueCount = tasks.filter((t) => t.isOverdue && t.status !== "DONE").length;

  return (
    <Layout title="My work">
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <div className="panel stat">
          <div className="stat-value">{tasks.length}</div>
          <div className="stat-label">Assigned tasks</div>
        </div>
        <div className="panel stat">
          <div className="stat-value">{openCount}</div>
          <div className="stat-label">Still open</div>
        </div>
        <div className="panel stat">
          <div className="stat-value amber">{overdueCount}</div>
          <div className="stat-label">Overdue</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <span className="panel-title">Sorted by priority, then due date</span>
        </div>
        <TaskTable tasks={tasks} showProject canChangeStatus onChanged={load} />
      </div>

      <ActivityFeed title="Activity on your tasks" />
    </Layout>
  );
}
