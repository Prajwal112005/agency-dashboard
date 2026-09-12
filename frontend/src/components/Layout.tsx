import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../lib/socket";
import NotificationBell from "./NotificationBell";

const NAV: Record<string, { to: string; label: string }[]> = {
  ADMIN: [
    { to: "/", label: "Overview" },
    { to: "/projects", label: "Projects" },
    { to: "/tasks", label: "All tasks" },
    { to: "/admin", label: "Administration" },
  ],
  PM: [
    { to: "/", label: "Overview" },
    { to: "/projects", label: "My projects" },
    { to: "/tasks", label: "Tasks" },
  ],
  DEVELOPER: [
    { to: "/", label: "My work" },
    { to: "/tasks", label: "All my tasks" },
  ],
};

export default function Layout({ title, children }: { title: string; children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    setConnected(socket.connected);
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    return () => {
      socket.off("connect");
      socket.off("disconnect");
    };
  }, []);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  if (!user) return null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">CONTROL ROOM</div>
          <div className="brand-sub">agency ops</div>
        </div>
        <nav>
          {NAV[user.role].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="who">{user.name}</div>
          <div className="who-role">{user.role}</div>
          <button className="logout-btn" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">{title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span className="conn-label">
              <span className={`conn-dot ${connected ? "live" : ""}`} />
              {connected ? "live" : "connecting…"}
            </span>
            <NotificationBell />
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
