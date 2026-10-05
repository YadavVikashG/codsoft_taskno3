"use client";

import { Bell, CheckCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

type Notification = {
  id: string;
  kind: "profile_view";
  readAt: string | null;
  createdAt: string;
  actorId: string;
  actorName: string;
  actorHeadline: string;
};

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const response = await fetch("/api/notifications");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load notifications.");
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
  }

  useEffect(() => {
    void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load notifications."));
    const interval = window.setInterval(() => {
      void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not refresh notifications."));
    }, 30000);
    return () => window.clearInterval(interval);
  }, []);

  async function markRead(id?: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : { markAll: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update notifications.");
      setNotifications((current) => current.map((notification) => id && notification.id !== id
        ? notification
        : { ...notification, readAt: notification.readAt ?? new Date().toISOString() }));
      setUnreadCount((current) => id
        ? Math.max(0, current - (notifications.some((notification) => notification.id === id && !notification.readAt) ? 1 : 0))
        : 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update notifications.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="notification-center">
    <button className="notification-trigger" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} aria-expanded={open} onClick={() => { setOpen((current) => !current); if (!open) void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load notifications.")); }}>
      <Bell size={17} />
      {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
    {open && <section className="notification-popover" aria-label="Notifications">
      <header><strong>Notifications</strong>{unreadCount > 0 && <button onClick={() => void markRead()} disabled={busy}><CheckCheck size={14} />Mark all read</button>}</header>
      {error && <p className="notification-error" role="alert">{error}</p>}
      {notifications.length ? <div className="notification-list">{notifications.map((notification) => <button className={`notification-item${notification.readAt ? "" : " notification-unread"}`} key={notification.id} onClick={() => { if (!notification.readAt) void markRead(notification.id); }}>
        <span className="notification-avatar"><UserRound size={15} /></span>
        <span className="notification-copy"><strong>{notification.actorName} viewed your profile</strong><small>{notification.actorHeadline || "CareerHub member"} · {new Date(notification.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</small></span>
        {!notification.readAt && <i aria-label="Unread" />}
      </button>)}</div> : !error ? <p className="notification-empty">You’re all caught up.</p> : null}
    </section>}
  </div>;
}
