import { FormEvent, useEffect, useState } from "react";
import Layout from "../components/Layout";
import { api } from "../lib/api";
import { Client, User } from "../types";

export default function AdminManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [tab, setTab] = useState<"users" | "clients">("users");
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "DEVELOPER" as User["role"] });
  const [clientForm, setClientForm] = useState({ name: "", contactEmail: "" });
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<string | null>(null);

  async function load() {
    const [u, c] = await Promise.all([api.get("/users", { params: { role: undefined } }), api.get("/clients")]);
    setUsers(u.data); setClients(c.data);
  }
  useEffect(() => { load(); }, []);

  async function saveUser(e: FormEvent) {
    e.preventDefault();
    if (editingUser) await api.patch(`/users/${editingUser}`, userForm);
    else await api.post("/users", userForm);
    setEditingUser(null); setUserForm({ name: "", email: "", password: "", role: "DEVELOPER" }); load();
  }
  async function removeUser(id: string) {
    if (!confirm("Delete this user?")) return;
    await api.delete(`/users/${id}`); load();
  }
  async function saveClient(e: FormEvent) {
    e.preventDefault();
    if (editingClient) await api.patch(`/clients/${editingClient}`, clientForm);
    else await api.post("/clients", clientForm);
    setEditingClient(null); setClientForm({ name: "", contactEmail: "" }); load();
  }
  async function removeClient(id: string) {
    if (!confirm("Delete this client? Projects will lose their client link.")) return;
    await api.delete(`/clients/${id}`); load();
  }

  return <Layout title="Administration">
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      <button className={`btn ${tab === "users" ? "" : "ghost"}`} onClick={() => setTab("users")}>Users</button>
      <button className={`btn ${tab === "clients" ? "" : "ghost"}`} onClick={() => setTab("clients")}>Clients</button>
    </div>
    {tab === "users" ? <>
      <form className="panel panel-body" onSubmit={saveUser} style={{ marginBottom: 16 }}>
        <div className="grid cols-4">
          <div className="field"><label>Name</label><input value={userForm.name} onChange={e => setUserForm({...userForm,name:e.target.value})} required /></div>
          <div className="field"><label>Email</label><input type="email" value={userForm.email} onChange={e => setUserForm({...userForm,email:e.target.value})} required /></div>
          <div className="field"><label>Password</label><input type="password" value={userForm.password} onChange={e => setUserForm({...userForm,password:e.target.value})} minLength={8} required={!editingUser} /></div>
          <div className="field"><label>Role</label><select value={userForm.role} onChange={e => setUserForm({...userForm,role:e.target.value as User["role"]})}><option>ADMIN</option><option>PM</option><option>DEVELOPER</option></select></div>
        </div>
        <button className="btn" style={{ marginTop: 12 }}>{editingUser ? "Save user" : "Create user"}</button>{editingUser && <button type="button" className="btn ghost" style={{marginLeft:8}} onClick={() => {setEditingUser(null);setUserForm({name:"",email:"",password:"",role:"DEVELOPER"})}}>Cancel</button>}
      </form>
      <div className="panel"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th /></tr></thead><tbody>{users.map(u => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td style={{textAlign:"right"}}><button className="btn ghost" onClick={() => {setEditingUser(u.id);setUserForm({name:u.name,email:u.email,password:"",role:u.role})}}>Edit</button> <button className="btn ghost" onClick={() => removeUser(u.id)}>Delete</button></td></tr>)}</tbody></table></div>
    </> : <>
      <form className="panel panel-body" onSubmit={saveClient} style={{ marginBottom: 16 }}>
        <div className="grid cols-2"><div className="field"><label>Name</label><input value={clientForm.name} onChange={e => setClientForm({...clientForm,name:e.target.value})} required /></div><div className="field"><label>Contact email</label><input type="email" value={clientForm.contactEmail} onChange={e => setClientForm({...clientForm,contactEmail:e.target.value})} /></div></div>
        <button className="btn" style={{marginTop:12}}>{editingClient ? "Save client" : "Create client"}</button>{editingClient && <button type="button" className="btn ghost" style={{marginLeft:8}} onClick={() => {setEditingClient(null);setClientForm({name:"",contactEmail:""})}}>Cancel</button>}
      </form>
      <div className="panel"><table><thead><tr><th>Name</th><th>Contact</th><th /></tr></thead><tbody>{clients.map(c => <tr key={c.id}><td>{c.name}</td><td>{c.contactEmail || "—"}</td><td style={{textAlign:"right"}}><button className="btn ghost" onClick={() => {setEditingClient(c.id);setClientForm({name:c.name,contactEmail:c.contactEmail || ""})}}>Edit</button> <button className="btn ghost" onClick={() => removeClient(c.id)}>Delete</button></td></tr>)}</tbody></table></div>
    </>}
  </Layout>;
}
