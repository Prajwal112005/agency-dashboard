import { useEffect, useState, FormEvent } from "react";
import { useParams } from "react-router-dom";
import Layout from "../components/Layout";
import ActivityFeed from "../components/ActivityFeed";
import TaskTable from "../components/TaskTable";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Project, Task, User as UserT, Priority } from "../types";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [developers, setDevelopers] = useState<UserT[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");

  async function load() {
    if (!id) return;
    const [p, t] = await Promise.all([api.get(`/projects/${id}`), api.get("/tasks", { params: { projectId: id } })]);
    setProject(p.data);
    setTasks(t.data);
    if (user?.role === "ADMIN" || user?.role === "PM") {
      const devs = await api.get("/users", { params: { role: "DEVELOPER" } });
      setDevelopers(devs.data);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function createTask(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    await api.post(`/tasks/project/${id}`, {
      title,
      description,
      assignedToId,
      priority,
      dueDate,
    });
    setTitle("");
    setDescription("");
    setAssignedToId("");
    setPriority("MEDIUM");
    setDueDate("");
    setShowForm(false);
    load();
  }

  if (!project) return null;

  const canManage = user?.role === "ADMIN" || (user?.role === "PM" && project.managerId === user.id);

  return (
    <Layout title={project.name}>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-body" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{project.description || "No description."}</div>
            <div className="mono-label" style={{ color: "var(--text-faint)", marginTop: 8 }}>
              {project.client?.name ?? "No client"} · managed by {project.manager?.name}
            </div>
          </div>
          {canManage && (
            <button className="btn ghost" onClick={() => setShowForm((s) => !s)}>
              {showForm ? "Cancel" : "+ New task"}
            </button>
          )}
        </div>
        {canManage && showForm && (
          <form onSubmit={createTask} className="panel-body" style={{ borderTop: "1px solid var(--border-soft)" }}>
            <div className="grid cols-4">
              <div className="field">
                <label>Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="field">
                <label>Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} required />
              </div>
              <div className="field">
                <label>Assignee</label>
                <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} required>
                  {developers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>
              <div className="field">
                <label>Due date</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
              </div>
            </div>
            <button className="btn" type="submit" style={{ marginTop: 12 }}>
              Create task
            </button>
          </form>
        )}
      </div>

      <div className="grid cols-2">
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Tasks</span>
          </div>
          <TaskTable tasks={tasks} showAssignee canChangeStatus onChanged={load} />
        </div>
        <ActivityFeed projectId={project.id} title="Activity on this project" />
      </div>
    </Layout>
  );
}
