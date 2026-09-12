import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { ActivityEvent } from "../types";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Props {
  projectId?: string; // if provided, scopes the feed to that project
  title?: string;
}

export default function ActivityFeed({ projectId, title = "Live activity" }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const lastSeenRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      const res = await api.get("/activity", { params: projectId ? { projectId } : {} });
      if (cancelled) return;
      setEvents(res.data);
      lastSeenRef.current = res.data[0]?.createdAt ?? new Date().toISOString();
    }
    loadInitial();

    const socket = getSocket();
    if (!socket) return;

    if (projectId) socket.emit("join:project", projectId);

    function upsert(event: ActivityEvent) {
      if (projectId && event.projectId !== projectId) return;
      setEvents((prev) => {
        if (prev.some((e) => e.id === event.id)) return prev;
        return [event, ...prev].slice(0, 40);
      });
      lastSeenRef.current = event.createdAt;
    }

    async function catchUp() {
      if (!lastSeenRef.current) return;
      const res = await api.get("/activity", { params: { since: lastSeenRef.current, ...(projectId ? { projectId } : {}) } });
      const missed: ActivityEvent[] = res.data;
      if (missed.length === 0) return;
      setEvents((prev) => {
        const merged = [...missed, ...prev];
        const seen = new Set<string>();
        return merged.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true))).slice(0, 40);
      });
      lastSeenRef.current = missed[0].createdAt;
    }

    const handleActivity = (event: ActivityEvent) => {
      if (projectId && event.projectId !== projectId) return;
      upsert(event);
    };
    socket.on("activity:new", handleActivity);
    // Reconnection (e.g. laptop was asleep, network blip) is exactly the
    // "offline user" case from the spec — fetch anything missed from the DB.
    socket.on("connect", catchUp);
    if (socket.connected) void catchUp();

    return () => {
      cancelled = true;
      socket.off("activity:new", handleActivity);
      socket.off("connect", catchUp);
      if (projectId) socket.emit("leave:project", projectId);
    };
  }, [projectId]);

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">{title}</span>
      </div>
      <div>
        {events.length === 0 && <div className="empty-state">No activity yet.</div>}
        {events.map((e) => (
          <div className="feed-item" key={e.id}>
            <span className="feed-time">{timeAgo(e.createdAt)}</span>
            <span className="feed-text">
              <strong>{e.actor.name}</strong> moved <strong>{e.task.title}</strong>{" "}
              <span className="feed-arrow">
                {e.oldStatus} → {e.newStatus}
              </span>
              {e.project?.name ? <span style={{ color: "var(--text-faint)" }}> · {e.project.name}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
