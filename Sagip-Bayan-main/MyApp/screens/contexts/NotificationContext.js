import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../../lib/api";
import { UserContext } from "../UserContext";

const MESSAGE_META = {
  connection_request: {
    title: "Join request",
    icon: "person-add-outline",
  },
  connection_request_sent: {
    title: "Request sent",
    icon: "paper-plane-outline",
  },
  connection_approved: {
    title: "Connection approved",
    icon: "checkmark-circle-outline",
  },
  connection_rejected: {
    title: "Request rejected",
    icon: "close-circle-outline",
  },
  connection_joined: {
    title: "Connection joined",
    icon: "person-add-outline",
  },
  connection_kicked: {
    title: "Connection removed",
    icon: "person-remove-outline",
  },
  connection_left: {
    title: "Member left",
    icon: "exit-outline",
  },
  safety_safe: {
    title: "Marked safe",
    icon: "shield-checkmark-outline",
  },
  safety_not_safe: {
    title: "Needs help",
    icon: "alert-circle-outline",
  },
  nearby_incident: {
    title: "Nearby incident",
    icon: "warning-outline",
    sourceLabel: "Incident Alert",
    official: true,
  },
  nearby_repeated_incident: {
    title: "Nearby incident warning",
    icon: "alert-circle-outline",
    sourceLabel: "Incident Alert",
    official: true,
  },
  drrmo_guideline: {
    title: "DRRMO guideline uploaded",
    icon: "megaphone-outline",
    sourceLabel: "DRRMO",
    official: true,
  },
  system: {
    title: "System update",
    icon: "notifications-outline",
  },
};

export const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  addNotification: () => {},
  markAllRead: () => {},
  clearNotifications: () => {},
  refreshNotifications: () => {},
  resolveJoinRequest: () => {},
  notificationsVersion: 0,
});

function normalizeType(type) {
  return String(type || "system").toLowerCase().trim();
}

function normalizeServerNotification(item) {
  const type = normalizeType(item?.type);
  const meta = MESSAGE_META[type] || MESSAGE_META.system;
  const connectionId = item?.connectionId || null;
  const actorUserId = item?.actorUserId || null;
  const handledAt = item?.handledAt || null;
  const inferredActionable =
    type === "connection_request" &&
    Boolean(connectionId) &&
    Boolean(actorUserId) &&
    !handledAt;

  return {
    id: String(item?._id || item?.id || `${type}-${item?.createdAt || Date.now()}`),
    type,
    title: item?.title || meta.title,
    message: item?.message || "There is a new safety update.",
    icon: item?.icon || meta.icon,
    sourceLabel: item?.sourceLabel || meta.sourceLabel || null,
    official: Boolean(item?.official ?? meta.official),
    read: Boolean(item?.read),
    createdAt: item?.createdAt || new Date().toISOString(),
    connectionId,
    actorUserId,
    actorName: item?.actorName || "",
    actorUsername: item?.actorUsername || "",
    actorAvatar: item?.actorAvatar || "",
    connectionCode: item?.connectionCode || "",
    actionable: (Boolean(item?.actionable) || inferredActionable) && !handledAt,
    handledAt,
  };
}

export function NotificationProvider({ children }) {
  const { user } = useContext(UserContext) || {};
  const [serverNotifications, setServerNotifications] = useState([]);
  const [localNotifications, setLocalNotifications] = useState([]);
  const [notificationsVersion, setNotificationsVersion] = useState(0);

  const addNotification = useCallback((event) => {
    const type = normalizeType(event?.type);
    const meta = MESSAGE_META[type] || MESSAGE_META.system;

    const notification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      title: event?.title || meta.title,
      message: event?.message || "There is a new safety update.",
      icon: event?.icon || meta.icon,
      sourceLabel: event?.sourceLabel || meta.sourceLabel || null,
      official: Boolean(event?.official ?? meta.official),
      read: false,
      createdAt: new Date().toISOString(),
      connectionId: event?.connectionId || null,
      actorUserId: event?.actorUserId || null,
      actorName: event?.actorName || "",
      actorUsername: event?.actorUsername || "",
      actorAvatar: event?.actorAvatar || "",
      connectionCode: event?.connectionCode || "",
      actionable: Boolean(event?.actionable),
      handledAt: event?.handledAt || null,
    };

    setLocalNotifications((prev) => [notification, ...prev].slice(0, 30));
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!user?._id) {
      setServerNotifications([]);
      return;
    }

    try {
      const res = await api.get(`/user/${user._id}/notifications`);
      const items = Array.isArray(res.data)
        ? res.data.map(normalizeServerNotification)
        : [];
      setServerNotifications(items);
      setNotificationsVersion((prev) => prev + 1);
    } catch (err) {
      console.log("[notifications] fetch failed:", err?.message);
    }
  }, [user?._id]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    setLocalNotifications([]);
  }, [user?._id]);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshNotifications();
    }, 10000);

    return () => clearInterval(interval);
  }, [refreshNotifications]);

  const markAllRead = useCallback(async () => {
    setLocalNotifications((prev) => prev.map((item) => ({ ...item, read: true })));

    if (!user?._id) {
      setServerNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      return;
    }

    try {
      await api.put(`/user/${user._id}/notifications/read-all`);
      await refreshNotifications();
    } catch (err) {
      console.log("[notifications] mark read failed:", err?.message);
    }
  }, [refreshNotifications, user?._id]);

  const clearNotifications = useCallback(async () => {
    setLocalNotifications([]);

    if (!user?._id) {
      setServerNotifications([]);
      return;
    }

    try {
      await api.delete(`/user/${user._id}/notifications`);
      setServerNotifications([]);
    } catch (err) {
      console.log("[notifications] clear failed:", err?.message);
    }
  }, [user?._id]);

  const resolveJoinRequest = useCallback(
    async ({ notification, action }) => {
      if (!user?._id || !notification?.connectionId || !notification?.actorUserId) {
        throw new Error("Missing request details.");
      }

      const endpoint =
        action === "accept"
          ? `/connection/approve/${notification.connectionId}/${notification.actorUserId}/${user._id}`
          : `/connection/reject/${notification.connectionId}/${notification.actorUserId}/${user._id}`;

      const response = await api.put(endpoint);
      await refreshNotifications();
      return response?.data;
    },
    [refreshNotifications, user?._id]
  );

  const notifications = useMemo(() => {
    return [...serverNotifications, ...localNotifications]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 30);
  }, [localNotifications, serverNotifications]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount: notifications.filter((item) => !item.read).length,
      addNotification,
      markAllRead,
      clearNotifications,
      refreshNotifications,
      resolveJoinRequest,
      notificationsVersion,
    }),
    [
      addNotification,
      clearNotifications,
      markAllRead,
      notifications,
      refreshNotifications,
      resolveJoinRequest,
      notificationsVersion,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
