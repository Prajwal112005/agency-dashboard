import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import ActivityFeed from "../components/ActivityFeed";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";

interface AdminStats {
  totalProjects: number;
  tasksByStatus: Record<string, number>;
  overdueCount: number;
  onlineUsers: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  async function load() {
    const res = await api.get("/dashboard/admin");
    setStats(res.data);
  }

  useEffect(() => {
    load();
    // Live presence pushes straight into the "online users" stat — no
    // polling needed for that number either.
    const socket = getSocket();
    socket?.on("presence:count", ({ onlineUsers }: { onlineUsers: number }) => {
      setStats((prev) => (prev ? { ...prev, onlineUsers } : prev));
    });
    return () => {
      socket?.off("presence:count");
    };
  }, []);

  if (!stats) return null;

  const totalTasks = Object.values(stats.tasksByStatus).reduce((a, b) => a + b, 0);

  return (
    <Layout title="Overview">
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <div className="panel stat">
          <div className="stat-value">{stats.totalProjects}</div>
          <div className="stat-label">Total projects</div>
        </div>
        <div className="panel stat">
          <div className="stat-value">{totalTasks}</div>
          <div className="stat-label">Total tasks</div>
        </div>
        <div className="panel stat">
          <div className="stat-value amber">{stats.overdueCount}</div>
          <div className="stat-label">Overdue tasks</div>
        </div>
        <div className="panel stat">
          <div className="stat-value green">{stats.onlineUsers}</div>
          <div className="stat-label">Users online now</div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Tasks by status</span>
          </div>
          <div className="panel-body">
            {Object.entries(stats.tasksByStatus).map(([status, count]) => (
              <div key={status} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <span className="mono-label">{status}</span>
                <span>{count}</span>
              </div>
            ))}
          </div>
        </div>
        <ActivityFeed title="Activity across all projects" />
      </div>
    </Layout>
  );
}
