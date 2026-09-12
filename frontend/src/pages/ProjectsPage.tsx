import { useEffect, useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Client, Project } from "../types";

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");

  async function load() {
    const [p, c] = await Promise.all([api.get("/projects"), api.get("/clients")]);
    setProjects(p.data); setClients(c.data);
  }
  useEffect(() => { load(); }, []);

  function resetForm() { setName(""); setDescription(""); setClientId(""); setEditing(null); setShowForm(false); }

  async function saveProject(e: FormEvent) {
    e.preventDefault();
    const payload = { name, description, clientId: clientId || undefined };
    if (editing) await api.patch(`/projects/${editing}`, payload);
    else await api.post("/projects", payload);
    resetForm(); load();
  }

  async function removeProject(id: string) {
    if (!confirm("Delete this project and its tasks/activity?")) return;
    await api.delete(`/projects/${id}`); load();
  }

  function startEdit(p: Project) {
    setEditing(p.id); setName(p.name); setDescription(p.description || ""); setClientId(p.clientId || ""); setShowForm(true);
  }

  const canManage = user?.role === "ADMIN" || user?.role === "PM";
  return <Layout title={user?.role === "ADMIN" ? "Projects" : "My projects"}>
    {canManage && <div style={{ marginBottom: 16 }}>
      <button className="btn ghost" onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}>{showForm ? "Cancel" : "+ New project"}</button>
      {showForm && <form onSubmit={saveProject} className="panel" style={{ marginTop: 12, padding: 16 }}>
        <div className="grid cols-2">
          <div className="field"><label>Name</label><input value={name} onChange={e => setName(e.target.value)} required /></div>
          <div className="field"><label>Client</label><select value={clientId} onChange={e => setClientId(e.target.value)}><option value="">No client</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        </div>
        <div className="field" style={{ marginTop: 12 }}><label>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></div>
        <button className="btn" type="submit" style={{ marginTop: 12 }}>{editing ? "Save project" : "Create project"}</button>
      </form>}
    </div>}
    <div className="grid cols-3">
      {projects.map(p => <div key={p.id} className="panel" style={{ position: "relative" }}>
        <Link to={`/projects/${p.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
          <div className="panel-body"><div style={{ fontWeight: 600, marginBottom: 6 }}>{p.name}</div><div style={{ color: "var(--text-muted)", fontSize: 12.5, marginBottom: 10 }}>{p.client?.name ?? "No client"}</div><div className="mono-label" style={{ color: "var(--text-faint)" }}>{p._count?.tasks ?? 0} tasks · managed by {p.manager?.name}</div></div>
        </Link>
        {canManage && <div style={{ padding: "0 16px 16px", display: "flex", gap: 8 }}><button className="btn ghost" onClick={() => startEdit(p)}>Edit</button><button className="btn ghost" onClick={() => removeProject(p.id)}>Delete</button></div>}
      </div>)}
      {projects.length === 0 && <div className="empty-state">No projects yet.</div>}
    </div>
  </Layout>;
}
