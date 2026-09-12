import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import ActivityFeed from "../components/ActivityFeed";
import TaskTable from "../components/TaskTable";
import { api } from "../lib/api";
import { Task } from "../types";

interface PmData {
  projectSummary: { id: string; name: string; taskCount: number }[];
  tasksByPriority: Record<string, Task[]>;
  upcomingThisWeek: Task[];
}

export default function PMDashboard() {
  const [data, setData] = useState<PmData | null>(null);

  async function load() {
    const res = await api.get("/dashboard/pm");
    setData(res.data);
  }

  useEffect(() => {
    load();
  }, []);

  if (!data) return null;

  return (
    <Layout title="Overview">
      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Your projects</span>
          </div>
          <div className="panel-body">
            {data.projectSummary.map((p) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", textDecoration: "none", color: "inherit" }}
              >
                <span>{p.name}</span>
                <span className="mono-label" style={{ color: "var(--text-muted)" }}>
                  {p.taskCount} tasks
                </span>
              </Link>
            ))}
            {data.projectSummary.length === 0 && <div className="empty-state">No projects yet.</div>}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Tasks by priority</span>
          </div>
          <div className="panel-body">
            {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((p) => (
              <div key={p} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <span className={`pill priority-${p}`}>{p}</span>
                <span>{data.tasksByPriority[p]?.length ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <span className="panel-title">Due this week</span>
        </div>
        <TaskTable tasks={data.upcomingThisWeek} showProject showAssignee onChanged={load} />
      </div>

      <ActivityFeed title="Activity on your projects" />
    </Layout>
  );
}
