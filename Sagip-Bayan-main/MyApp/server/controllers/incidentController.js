const IncidentModel = require("../models/Incident");
const HistoryModel = require("../models/History");
const UserModel = require("../models/User");
const cloudinary = require("../config/cloudinary");
const mongoose = require("mongoose");

const DUPLICATE_INCIDENT_RADIUS_METERS = 200;
const INCIDENT_USER_ALERT_RADIUS_METERS = 1000;
const INCIDENT_USER_ALERT_RECENT_HOURS = 24;
const INCIDENT_CLUSTER_RECENT_HOURS = 6;
const INCIDENT_CLUSTER_RADIUS_METERS = 3500;
const INCIDENT_CLUSTER_THRESHOLDS = [
  { count: 10, level: "danger" },
  { count: 8, level: "warning" },
  { count: 5, level: "caution" },
];
const BARANGAY_DANGER_THRESHOLDS = [
  { count: 10, level: "severe" },
  { count: 6, level: "danger" },
  { count: 3, level: "caution" },
];
const DUPLICATE_ACTIVE_STATUSES = [
  "pending",
  "reported",
  "on process",
  "in progress",
  "ongoing",
  "active",
  "approved",
];
const DUPLICATE_CLOSED_STATUSES = [
  "resolved",
  "closed",
  "cancelled",
  "canceled",
  "rejected",
  "dismissed",
  "invalid",
];

const BARANGAY_BY_DISTRICT = {
  "District 1": [
    "Bagong Sikat",
    "Balbalino",
    "Banganan",
    "Langla",
    "Mabini",
    "Maligaya",
    "Santo Tomas South",
  ],
  "District 2": [
    "Imbunia",
    "Lambakin",
    "Marawa",
    "Naglabrahan",
    "San Josef",
    "San Roque",
    "Santo Tomas North",
  ],
  "District 3": [
    "Don Mariano Marcos",
    "Hilera",
    "Pinanggaan",
    "San Andres",
    "San Nicolas",
    "Ulanin-Pitak",
  ],
  "District 4": [
    "Calabasa",
    "Kasanglayan",
    "Pamacpacan",
    "Putlod",
    "Sapang",
  ],
};

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeText(value, max = 200) {
  return String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[<>{}[\]`$\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function sanitizePhone(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .replace(/^63/, "")
    .replace(/^0+/, "")
    .slice(0, 10);
}

function sanitizeIncidentText(value, max = 500) {
  return sanitizeText(value, max).replace(/[^A-Za-z0-9\s,.\-()/#]/g, "");
}

function sanitizeAlphaNumericText(value, max = 120) {
  return sanitizeText(value, max).replace(/[^A-Za-z0-9\s-]/g, "");
}

function toObjectIdOrNull(value) {
  return value && mongoose.Types.ObjectId.isValid(String(value))
    ? value
    : null;
}

function buildIncidentAddress({ district, barangay, street, location }) {
  const cleanDistrict = sanitizeText(district, 80);
  const cleanBarangay = sanitizeAlphaNumericText(barangay, 80);
  const cleanStreet = sanitizeIncidentText(street, 160);
  const cleanLocation = sanitizeIncidentText(location, 220);

  if (cleanStreet || cleanBarangay || cleanDistrict) {
    return [cleanStreet, cleanBarangay, cleanDistrict, "Jaen, Nueva Ecija"]
      .filter(Boolean)
      .join(", ");
  }

  return cleanLocation;
}

function normalizeNotificationType(type) {
  return String(type || "system").trim().toLowerCase();
}

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

const PUBLIC_INCIDENT_QUERY = {
  $or: [
    { isPublic: true },
    { forceApproved: true },
    { approvedByMDRRMO: true },
    { status: /^approved$/i },
  ],
};

function isPublicIncident(incident) {
  const status = normalizeStatus(incident?.status);

  return (
    incident?.isPublic === true ||
    incident?.forceApproved === true ||
    incident?.approvedByMDRRMO === true ||
    status === "approved"
  );
}

function normalizeIncidentType(type) {
  const clean = sanitizeText(type, 60).toLowerCase();
  if (clean.includes("flood")) return "flood";
  if (clean.includes("fire")) return "fire";
  if (clean.includes("earthquake")) return "earthquake";
  if (clean.includes("typhoon") || clean.includes("storm")) return "typhoon";
  if (clean.includes("accident") || clean.includes("collision")) return "accident";
  if (
    clean.includes("road_block") ||
    clean.includes("road block") ||
    clean.includes("blockage") ||
    clean.includes("obstruction")
  ) {
    return "road_block";
  }
  return clean || "incident";
}

function formatIncidentTypeLabel(type) {
  const category = normalizeIncidentType(type);
  return category
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ") || "Incident";
}

function getBarangayDangerThreshold(count) {
  return BARANGAY_DANGER_THRESHOLDS.find((item) => count >= item.count) || null;
}

function getIncidentClusterThreshold(count) {
  return INCIDENT_CLUSTER_THRESHOLDS.find((item) => count >= item.count) || null;
}

function toPlainObject(document) {
  return typeof document?.toObject === "function"
    ? document.toObject({ virtuals: true })
    : document;
}

function getNotificationStorageDebugInfo() {
  return {
    dbName: mongoose.connection?.name || "",
    notificationCollection: UserModel.collection?.name || "users",
    notificationPath: "users.notifications",
  };
}

function getDistrictBarangays(district) {
  return BARANGAY_BY_DISTRICT[sanitizeText(district, 80)] || [];
}

function uniqueNormalizedBarangays(barangays) {
  const seen = new Set();
  return barangays.filter((name) => {
    const key = sanitizeText(name, 80).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getIncidentClusterMessage(type, barangayCount) {
  const category = normalizeIncidentType(type);
  if (category === "flood") {
    return "Multiple nearby barangays have reported flooding. Stay alert.";
  }

  return `${barangayCount} barangays have reported the same incident nearby. Be careful.`;
}

function getBarangayDangerMessage(type) {
  switch (normalizeIncidentType(type)) {
    case "flood":
      return "Warning: Multiple flood reports have been recorded in your barangay. Avoid flooded areas and stay alert.";
    case "fire":
      return "Warning: Multiple fire reports have been recorded in your barangay. Stay away from affected areas.";
    case "earthquake":
      return "Warning: Multiple earthquake-related reports have been recorded in your barangay. Check your surroundings and stay alert.";
    case "typhoon":
      return "Warning: Multiple typhoon-related hazards have been reported in your barangay. Stay indoors if possible.";
    default:
      return "Warning: Multiple incidents have been reported in your barangay. Please stay alert.";
  }
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function distanceMeters(pointA, pointB) {
  if (!pointA || !pointB) return Number.POSITIVE_INFINITY;

  const lat1 = Number(pointA.latitude);
  const lon1 = Number(pointA.longitude);
  const lat2 = Number(pointB.latitude);
  const lon2 = Number(pointB.longitude);

  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) {
    return Number.POSITIVE_INFINITY;
  }

  const earthRadiusMeters = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildCoordinateBox(latitude, longitude, radiusMeters) {
  const latDelta = radiusMeters / 111320;
  const lngDelta =
    radiusMeters /
    (111320 * Math.max(Math.cos(toRadians(latitude)), 0.00001));

  return {
    minLat: latitude - latDelta,
    maxLat: latitude + latDelta,
    minLng: longitude - lngDelta,
    maxLng: longitude + lngDelta,
  };
}

async function findDuplicateIncident({ type, latitude, longitude }) {
  const normalizedType = normalizeIncidentType(type);
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (
    !normalizedType ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  const point = { latitude: lat, longitude: lng };
  const box = buildCoordinateBox(lat, lng, DUPLICATE_INCIDENT_RADIUS_METERS);

  const candidates = await IncidentModel.find({
    latitude: { $gte: box.minLat, $lte: box.maxLat },
    longitude: { $gte: box.minLng, $lte: box.maxLng },
    $or: [
      ...PUBLIC_INCIDENT_QUERY.$or,
      { status: { $in: DUPLICATE_ACTIVE_STATUSES } },
      { status: /^pending$/i },
      { status: /^reported$/i },
      { status: /^on[ _-]?process$/i },
      { status: /^in[ _-]?progress$/i },
      { status: /^ongoing$/i },
      { status: /^active$/i },
    ],
  })
    .sort({ createdAt: -1 })
    .select(
      "_id type status aiStatus isPublic forceApproved approvedByMDRRMO latitude longitude location createdAt"
    );

  return candidates.find(
    (incident) =>
      normalizeIncidentType(incident.type) === normalizedType &&
      !DUPLICATE_CLOSED_STATUSES.includes(normalizeStatus(incident.status)) &&
      (isPublicIncident(incident) ||
        DUPLICATE_ACTIVE_STATUSES.includes(normalizeStatus(incident.status))) &&
      distanceMeters(point, {
        latitude: incident.latitude,
        longitude: incident.longitude,
      }) <= DUPLICATE_INCIDENT_RADIUS_METERS
  );
}

async function verifyIncidentImageWithAI({ incident, image }) {
  const aiEndpoint = sanitizeText(process.env.INCIDENT_AI_VERIFY_URL, 300);

  if (!image?.fileUrl) {
    return {
      aiStatus: "rejected",
      score: 0,
      labels: [],
      reason: "No image evidence was uploaded.",
    };
  }

  if (!aiEndpoint) {
    return {
      aiStatus: "approved",
      score: 1,
      labels: [normalizeIncidentType(incident?.type)],
      reason: "Image evidence received and accepted by local AI verification fallback.",
    };
  }

  const fetch = require("node-fetch");
  const response = await fetch(aiEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.INCIDENT_AI_VERIFY_TOKEN
        ? { Authorization: `Bearer ${process.env.INCIDENT_AI_VERIFY_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({
      incidentId: String(incident?._id || ""),
      type: incident?.type,
      level: incident?.level,
      barangay: incident?.barangay,
      district: incident?.district,
      latitude: incident?.latitude,
      longitude: incident?.longitude,
      imageUrl: image.fileUrl,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "AI verification failed.");
  }

  const status = String(data?.aiStatus || data?.status || "")
    .trim()
    .toLowerCase();

  return {
    aiStatus: status === "approved" ? "approved" : "rejected",
    score: Number.isFinite(Number(data?.score)) ? Number(data.score) : null,
    labels: Array.isArray(data?.labels)
      ? data.labels.map((label) => sanitizeText(label, 80)).filter(Boolean)
      : [],
    reason: sanitizeText(data?.reason || data?.message, 500),
  };
}

async function publishIncidentIfPublic(incident, { excludeUsername = "", excludePhone = "" } = {}) {
  if (!isPublicIncident(incident)) return;

  await notifyUsersInSameBarangay({
    incident,
    excludeUsername,
    excludePhone,
  });
  await notifyNearbyRepeatedIncidents(incident);
  await notifyBarangayIncidentDangerThreshold(incident);
}

async function getIncidentReporterUserId(incident) {
  const reporterUserId = toObjectIdOrNull(incident?.reporterUserId);
  if (reporterUserId) return String(reporterUserId);

  const fallbackUserId = toObjectIdOrNull(incident?.userId);
  if (fallbackUserId) return String(fallbackUserId);

  const reportedBy = toObjectIdOrNull(incident?.reportedBy);
  return reportedBy ? String(reportedBy) : null;
}

function getIncidentApprovalDedupeKey(incidentId, reporterUserId) {
  return `incident-approved-${incidentId}-${reporterUserId}`;
}

async function hasIncidentApprovalNotification(incidentId, reporterUserId, dedupeKey) {
  const incidentObjectId = toObjectIdOrNull(incidentId);
  const reporterObjectId = toObjectIdOrNull(reporterUserId);

  if (!incidentObjectId || !reporterObjectId) return false;

  return Boolean(
    await UserModel.exists({
      _id: reporterObjectId,
      $or: [
        {
          notifications: {
            $elemMatch: {
              type: "incident_approved",
              referenceId: incidentObjectId,
              recipientUser: reporterObjectId,
            },
          },
        },
        {
          notifications: {
            $elemMatch: {
              type: "incident_approved",
              incidentId: incidentObjectId,
              targetUsers: reporterObjectId,
            },
          },
        },
        {
          notifications: {
            $elemMatch: {
              type: "incident_approved",
              dedupeKey,
            },
          },
        },
      ],
    })
  );
}

function emitIncidentApproved(req, incident, reporterUserId = null, notification = null) {
  const io = req.app.get("io");
  if (!io || !incident) return;

  const payload = toPlainObject(incident);
  const notificationPayload = notification ? toPlainObject(notification) : null;

  io.emit("incident:updated", payload);
  io.emit("incident:approved", payload);
  io.emit("incidentApproved", payload);

  if (reporterUserId) {
    const reporterRoom = String(reporterUserId);
    io.to(reporterRoom).emit("myIncidentApproved", payload);
    if (notificationPayload) {
      io.to(reporterRoom).emit("notification:new", notificationPayload);
    }
  }

  console.log("[incident socket emitted]", {
    id: String(payload?._id || ""),
    reporterUserId: reporterUserId ? String(reporterUserId) : "",
    events: [
      "incident:updated",
      "incident:approved",
      "incidentApproved",
      ...(reporterUserId ? ["myIncidentApproved"] : []),
      ...(notificationPayload ? ["notification:new"] : []),
    ],
  });
}

async function notifyReporterIncidentApproved(req, incident) {
  try {
    const reporterUserId = await getIncidentReporterUserId(incident);
    let notification = null;

    if (!reporterUserId) {
      console.log("[reporter approval notification skipped no reporter]", {
        incidentId: String(incident?._id || ""),
        reporterUserId: incident?.reporterUserId || null,
        userId: incident?.userId || null,
      });
      emitIncidentApproved(req, incident, null, null);
      return;
    }

    const dedupeKey = getIncidentApprovalDedupeKey(incident._id, reporterUserId);
    const alreadyNotified = await hasIncidentApprovalNotification(
      incident._id,
      reporterUserId,
      dedupeKey
    );

    if (alreadyNotified) {
      console.log("[reporter approval notification skipped duplicate]", {
        incidentId: String(incident._id),
        reporterUserId: String(reporterUserId),
        ...getNotificationStorageDebugInfo(),
      });
      emitIncidentApproved(req, incident, reporterUserId, null);
      return;
    }

    notification = await addNotification(reporterUserId, {
      type: "incident_approved",
      module: "incident",
      priority: "normal",
      title: "Incident Report Verified",
      message:
        "Your reported incident has been reviewed and verified by the MDRRMO. It has been approved as a valid incident and is now visible on the public map for community awareness.",
      referenceId: incident._id,
      referenceModel: "Incident",
      recipientUser: reporterUserId,
      recipientUserModel: "User",
      sourceLabel: "Incident Alert",
      source: "incident",
      official: true,
      notificationType: "normal",
      soundType: "notification",
      incidentId: incident._id,
      targetUsers: [reporterUserId],
      dedupeKey,
      actionable: false,
      metadata: {
        incidentId: incident._id,
        incidentType: incident.type || "",
        location: incident.location || "",
        approvalStatus: "approved",
      },
    });

    if (notification) {
      console.log("[reporter approval notification created]", {
        incidentId: String(incident._id),
        reporterUserId: String(reporterUserId),
        notificationId: String(notification._id || ""),
        ...getNotificationStorageDebugInfo(),
      });
    } else {
      console.log("[reporter approval notification skipped duplicate]", {
        incidentId: String(incident._id),
        reporterUserId: String(reporterUserId),
        reason: "dedupe_update_noop",
        ...getNotificationStorageDebugInfo(),
      });
    }

    emitIncidentApproved(req, incident, reporterUserId, notification);
  } catch (err) {
    console.error("[reporter approval notification error]", {
      incidentId: String(incident?._id || ""),
      reporterUserId: incident?.reporterUserId || null,
      userId: incident?.userId || null,
      message: err?.message || err,
      ...getNotificationStorageDebugInfo(),
    });
    emitIncidentApproved(req, incident, null, null);
  }
}

async function applyIncidentAIResult(incidentId, aiResult) {
  const aiStatus = aiResult.aiStatus === "approved" ? "approved" : "rejected";

  const incident = await IncidentModel.findByIdAndUpdate(
    incidentId,
    {
      aiStatus,
      isPublic: false,
      aiReview: {
        status: aiStatus,
        score: aiResult.score,
        labels: aiResult.labels || [],
        reason:
          aiResult.reason ||
          (aiStatus === "approved"
            ? "Approved by AI verification."
            : "Rejected by AI verification."),
        reviewedAt: new Date(),
      },
    },
    { new: true }
  );

  console.log("[ai result]", {
    id: String(incident?._id || incidentId),
    aiStatus,
    score: aiResult.score,
    reason: aiResult.reason || "",
  });
  console.log("[public status]", {
    id: String(incident?._id || incidentId),
    isPublic: incident?.isPublic === true,
    aiStatus: incident?.aiStatus,
    forceApproved: incident?.forceApproved === true,
    approvedByMDRRMO: incident?.approvedByMDRRMO === true,
  });

  return incident;
}

async function addNotification(userId, notification) {
  if (!userId) return;

  const notificationType = normalizeNotificationType(notification.type);
  const dedupeKey = sanitizeText(notification.dedupeKey, 180);
  const referenceId = toObjectIdOrNull(
    notification.referenceId ||
      notification.incidentId ||
      notification.guidelineId ||
      notification.announcementId
  );
  const recipientUser = toObjectIdOrNull(notification.recipientUser || userId);
  const notificationDoc = {
    _id: new mongoose.Types.ObjectId(),
    type: notificationType,
    module: notification.module || "",
    message: notification.message,
    title: notification.title || "",
    sourceLabel: notification.sourceLabel || "",
    source: notification.source || "",
    official: Boolean(notification.official),
    notificationType: notification.notificationType || "normal",
    priority: notification.priority || "normal",
    soundType: notification.soundType || "notification",
    incidentId: notification.incidentId || null,
    referenceId: referenceId || null,
    referenceModel: notification.referenceModel || "",
    recipientUser: recipientUser || null,
    recipientUserModel: notification.recipientUserModel || "",
    targetBarangays: Array.isArray(notification.targetBarangays)
      ? notification.targetBarangays
      : [],
    targetUsers: Array.isArray(notification.targetUsers)
      ? notification.targetUsers
      : [],
    connectionId: notification.connectionId || null,
    actorUserId: notification.actorUserId || null,
    actorName: notification.actorName || "",
    actorUsername: notification.actorUsername || "",
    actorAvatar: notification.actorAvatar || "",
    connectionCode: notification.connectionCode || "",
    actionable: Boolean(notification.actionable),
    handledAt: notification.handledAt || null,
    dedupeKey,
    metadata:
      notification.metadata && typeof notification.metadata === "object"
        ? notification.metadata
        : {},
    read: false,
    isRead: false,
    createdAt: new Date(),
  };
  const filter = dedupeKey
    ? { _id: userId, "notifications.dedupeKey": { $ne: dedupeKey } }
    : { _id: userId };

  const result = await UserModel.updateOne(filter, {
    $push: {
      notifications: notificationDoc,
    },
  });

  return result.modifiedCount > 0 ? notificationDoc : null;
}

async function notifyUsersInSameBarangay({ incident, excludeUsername, excludePhone }) {
  try {
    if (!isPublicIncident(incident)) return;
    const incidentCreatedAt = new Date(incident?.createdAt || Date.now());
    const oldestAllowed = Date.now() - INCIDENT_USER_ALERT_RECENT_HOURS * 60 * 60 * 1000;
    if (incidentCreatedAt.getTime() < oldestAllowed) return;

    const barangay = sanitizeText(incident?.barangay, 80);
    const incidentPoint = {
      latitude: Number(incident?.latitude),
      longitude: Number(incident?.longitude),
    };
    if (!barangay && !Number.isFinite(incidentPoint.latitude)) return;

    const cleanExcludeUsername = sanitizeText(excludeUsername, 60).toLowerCase();
    const cleanExcludePhone = sanitizePhone(excludePhone);

    const query = {
      isArchived: { $ne: true },
      $or: [],
    };

    if (barangay) {
      query.$or.push({
        barangay: { $regex: new RegExp(`^${escapeRegex(barangay)}$`, "i") },
      });
    }

    if (
      Number.isFinite(incidentPoint.latitude) &&
      Number.isFinite(incidentPoint.longitude)
    ) {
      const box = buildCoordinateBox(
        incidentPoint.latitude,
        incidentPoint.longitude,
        INCIDENT_USER_ALERT_RADIUS_METERS
      );
      query.$or.push({
        "location.lat": { $gte: box.minLat, $lte: box.maxLat },
        "location.lng": { $gte: box.minLng, $lte: box.maxLng },
      });
    }

    if (!query.$or.length) return;

    const users = await UserModel.find(query).select(
      "_id fname lname username phone barangay location notifications avatar"
    );

    if (!users.length) {
      console.log("[incident notify] No nearby users found:", barangay);
      return;
    }

    const notificationType = normalizeNotificationType("nearby_incident");
    const incidentType = formatIncidentTypeLabel(incident?.type);
    const message = barangay
      ? `${incidentType} reported in ${barangay}. Please be careful in your barangay and avoid risky areas.`
      : `${incidentType} reported nearby. Please be careful and avoid risky areas.`;

    const notifyTargets = users.filter((user) => {
      const userUsername = sanitizeText(user?.username, 60).toLowerCase();
      const userPhone = sanitizePhone(user?.phone);

      const sameUsername =
        cleanExcludeUsername &&
        userUsername &&
        userUsername === cleanExcludeUsername;

      const samePhone =
        cleanExcludePhone &&
        userPhone &&
        userPhone === cleanExcludePhone;

      if (sameUsername || samePhone) return false;

      const sameBarangay =
        barangay &&
        sanitizeText(user?.barangay, 80).toLowerCase() === barangay.toLowerCase();

      const userPoint = {
        latitude: Number(user?.location?.lat),
        longitude: Number(user?.location?.lng),
      };
      const closeByCoordinate =
        Number.isFinite(userPoint.latitude) &&
        Number.isFinite(userPoint.longitude) &&
        Number.isFinite(incidentPoint.latitude) &&
        Number.isFinite(incidentPoint.longitude) &&
        distanceMeters(incidentPoint, userPoint) <= INCIDENT_USER_ALERT_RADIUS_METERS;

      return sameBarangay || closeByCoordinate;
    });

    if (!notifyTargets.length) {
      console.log("[incident notify] Users found, but all excluded as reporter match.");
      return;
    }

    await Promise.all(
      notifyTargets.map((user) =>
        addNotification(user._id, {
          type: notificationType,
          title: "Incident reported in your barangay",
          message,
          sourceLabel: "Incident Alert",
          source: "incident",
          official: true,
          notificationType: "danger",
          soundType: "danger",
          incidentId: incident._id,
          targetBarangays: barangay ? [barangay] : [],
          targetUsers: [user._id],
          dedupeKey: `incident:${incident._id}:user:${user._id}`,
          actionable: false,
        })
      )
    );

    console.log(
      `[incident notify] Sent ${notifyTargets.length} nearby_incident notifications for barangay ${barangay}.`
    );
  } catch (err) {
    console.error("Nearby incident notification error:", err);
  }
}

async function notifyNearbyRepeatedIncidents(incident) {
  try {
    if (!isPublicIncident(incident)) return;

    const type = normalizeIncidentType(incident?.type);
    const barangay = sanitizeText(incident?.barangay, 80);
    const district = sanitizeText(incident?.district, 80);
    if (!type || !barangay) return;

    const since = new Date(
      Date.now() - INCIDENT_CLUSTER_RECENT_HOURS * 60 * 60 * 1000
    );
    const incidentPoint = {
      latitude: Number(incident?.latitude),
      longitude: Number(incident?.longitude),
    };
    const districtBarangays = getDistrictBarangays(district);
    const recentPublicReports = await IncidentModel.find({
      ...PUBLIC_INCIDENT_QUERY,
      barangay: { $ne: "" },
      createdAt: { $gte: since },
    }).select(
      "_id type district barangay latitude longitude aiStatus isPublic forceApproved approvedByMDRRMO createdAt"
    );

    const clusterReports = recentPublicReports.filter((candidate) => {
      if (!isPublicIncident(candidate)) return false;
      if (normalizeIncidentType(candidate?.type) !== type) return false;

      const candidateBarangay = sanitizeText(candidate?.barangay, 80);
      const candidateDistrict = sanitizeText(candidate?.district, 80);
      const sameBarangay =
        candidateBarangay.toLowerCase() === barangay.toLowerCase();
      const sameDistrict =
        district && candidateDistrict && candidateDistrict.toLowerCase() === district.toLowerCase();
      const listedNearby =
        districtBarangays.length &&
        districtBarangays.some(
          (name) => name.toLowerCase() === candidateBarangay.toLowerCase()
        );
      const candidatePoint = {
        latitude: Number(candidate?.latitude),
        longitude: Number(candidate?.longitude),
      };
      const closeByCoordinate =
        Number.isFinite(incidentPoint.latitude) &&
        Number.isFinite(incidentPoint.longitude) &&
        Number.isFinite(candidatePoint.latitude) &&
        Number.isFinite(candidatePoint.longitude) &&
        distanceMeters(incidentPoint, candidatePoint) <= INCIDENT_CLUSTER_RADIUS_METERS;

      return sameBarangay || sameDistrict || listedNearby || closeByCoordinate;
    });

    const totalReports = clusterReports.length;
    const threshold = getIncidentClusterThreshold(totalReports);
    if (!threshold) return;

    const previousThreshold = getIncidentClusterThreshold(Math.max(0, totalReports - 1));
    if (previousThreshold?.level === threshold.level) return;

    const clusterBarangays = uniqueNormalizedBarangays(
      clusterReports.map((item) => sanitizeText(item?.barangay, 80))
    );
    const barangayCount = clusterBarangays.length;
    if (barangayCount < 2) return;

    const affectedBarangays = uniqueNormalizedBarangays([
      ...clusterBarangays,
      ...districtBarangays,
    ]);
    const barangayGroupKey = clusterBarangays
      .map((name) => name.toLowerCase())
      .sort()
      .join("|");
    const dedupeKey = `incident-cluster:${type}:${barangayGroupKey}:${threshold.level}`;
    const users = await UserModel.find({
      barangay: {
        $in: affectedBarangays.map((name) => new RegExp(`^${escapeRegex(name)}$`, "i")),
      },
      isArchived: { $ne: true },
    }).select("_id barangay");

    if (!users.length) {
      console.log("[incident notify] No users found for incident cluster:", dedupeKey);
      return;
    }

    const message = getIncidentClusterMessage(type, barangayCount);

    await Promise.all(
      users.map((user) =>
        addNotification(user._id, {
          type: "nearby_repeated_incident",
          title: "Multiple incident reports nearby",
          message,
          sourceLabel: "Incident Alert",
          source: "incident",
          official: true,
          notificationType: "danger",
          soundType: "danger",
          incidentId: incident._id,
          targetBarangays: affectedBarangays,
          targetUsers: [user._id],
          dedupeKey,
          actionable: false,
        })
      )
    );

    console.log(
      `[incident notify] Cluster ${threshold.level} sent for ${type}: ${totalReports} public reports across ${barangayCount} barangays.`
    );
  } catch (err) {
    console.error("Nearby repeated incident notification error:", err);
  }
}

async function notifyBarangayIncidentDangerThreshold(incident) {
  try {
    if (!isPublicIncident(incident)) return;

    const barangay = sanitizeAlphaNumericText(incident?.barangay, 80);
    if (!barangay) return;

    const stats = await IncidentModel.aggregate([
      {
        $match: {
          ...PUBLIC_INCIDENT_QUERY,
          barangay: { $regex: new RegExp(`^${escapeRegex(barangay)}$`, "i") },
        },
      },
      {
        $group: {
          _id: { $toLower: "$type" },
          type: { $first: "$type" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const totalCount = stats.reduce((sum, item) => sum + Number(item.count || 0), 0);
    const threshold = getBarangayDangerThreshold(totalCount);
    if (!threshold) return;

    const previousThreshold = getBarangayDangerThreshold(Math.max(0, totalCount - 1));
    if (previousThreshold?.level === threshold.level) return;

    const dominant = stats[0] || {};
    const dominantType = normalizeIncidentType(dominant.type);
    const dedupeKey = `barangay-danger:${barangay.toLowerCase()}:${dominantType}:${threshold.level}`;

    const users = await UserModel.find({
      barangay: { $regex: new RegExp(`^${escapeRegex(barangay)}$`, "i") },
      isArchived: { $ne: true },
    }).select("_id barangay");

    if (!users.length) {
      console.log("[incident notify] No users found for barangay danger threshold:", barangay);
      return;
    }

    const message = getBarangayDangerMessage(dominantType);

    await Promise.all(
      users.map((user) =>
        addNotification(user._id, {
          type: "barangay_incident_danger",
          title: "Barangay danger warning",
          message,
          sourceLabel: "Incident Alert",
          source: "incident",
          official: true,
          notificationType: "danger",
          soundType: "danger",
          incidentId: incident._id,
          targetBarangays: [barangay],
          targetUsers: [user._id],
          dedupeKey,
          actionable: false,
        })
      )
    );

    console.log(
      `[incident notify] Barangay danger threshold ${threshold.level} reached for ${barangay}: ${totalCount} public reports, dominant ${dominantType}.`
    );
  } catch (err) {
    console.error("Barangay incident danger threshold notification error:", err);
  }
}

async function uploadIncidentFile(file) {
  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder: "evacuation_app/incidents" },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    ).end(file.buffer);
  });

  return {
    fileName: file.originalname,
    fileUrl: result.secure_url,
    public_id: result.public_id,
  };
}

// ✅ Get all incidents
const getIncidents = async (req, res) => {
  try {
    const includeAll = String(req.query.includeAll || "false") === "true";
    const status = sanitizeText(req.query.status, 40);
    const filter = includeAll
      ? status
        ? { status: new RegExp(`^${escapeRegex(status)}$`, "i") }
        : {}
      : PUBLIC_INCIDENT_QUERY;

    const incidents = await IncidentModel.find(filter).sort({ createdAt: -1 });
    const publicIncidents = includeAll
      ? incidents
      : incidents.filter((incident) => isPublicIncident(incident));

    console.log("[public status]", {
      route: "getIncidents",
      includeAll,
      requestedStatus: status || "",
      fetched: incidents.length,
      returned: publicIncidents.length,
      publicCount: publicIncidents.length,
      statuses: [...new Set(incidents.map((incident) => incident?.status || ""))],
      aiStatuses: [...new Set(incidents.map((incident) => incident?.aiStatus || ""))],
    });
    res.json(publicIncidents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ✅ Register Incident (WITH IMAGE SUPPORT + STRUCTURED ADDRESS)
const registerIncident = async (req, res) => {
  try {
    if (!req.body) req.body = {};

    const type = sanitizeText(req.body.type, 60);
    const incidentType = normalizeIncidentType(type);
    const level = sanitizeText(req.body.level, 40);
    const district = sanitizeAlphaNumericText(req.body.district, 80);
    const barangay = sanitizeAlphaNumericText(req.body.barangay, 80);
    const street = sanitizeIncidentText(req.body.street || req.body.streetAddress, 160);
    const location = buildIncidentAddress({
      district,
      barangay,
      street,
      location: req.body.location,
    });
    const description = sanitizeIncidentText(req.body.description, 1000);
    const usernames = sanitizeText(req.body.usernames, 60) || null;
    const phone = sanitizePhone(req.body.phone) || null;
    const userId = toObjectIdOrNull(req.body.userId || req.session?.userId);
    const reporterUserId = toObjectIdOrNull(
      req.body.reporterUserId || req.body.userId || req.session?.userId
    );
    const allowedTypes = new Set([
      "flood",
      "typhoon",
      "fire",
      "earthquake",
      "accident",
      "road_block",
    ]);
    const allowedLevels = new Set(["low", "medium", "high", "critical"]);

    const latitude =
      req.body.latitude !== undefined && req.body.latitude !== ""
        ? Number(req.body.latitude)
        : null;

    const longitude =
      req.body.longitude !== undefined && req.body.longitude !== ""
        ? Number(req.body.longitude)
        : null;

    if (!type || !allowedTypes.has(incidentType)) {
      return res.status(400).json({
        message: "A valid incident type is required.",
      });
    }

    if (!level || !allowedLevels.has(level.toLowerCase())) {
      return res.status(400).json({
        message: "A valid severity level is required.",
      });
    }

    if (!district) {
      return res.status(400).json({
        message: "District is required.",
      });
    }

    if (!barangay) {
      return res.status(400).json({
        message: "Barangay is required.",
      });
    }

    if (!street) {
      return res.status(400).json({
        message: "Street or landmark details are required.",
      });
    }

    if (!location) {
      return res.status(400).json({
        message: "Incident location is required.",
      });
    }

    if (!description || description.length < 5) {
      return res.status(400).json({
        message: "Description/reason must be at least 5 characters.",
      });
    }

    if (req.body.phone && !/^9\d{9}$/.test(phone)) {
      return res.status(400).json({
        message: "Contact number must be a valid 10-digit mobile number starting with 9.",
      });
    }

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180 ||
      (latitude === 0 && longitude === 0)
    ) {
      return res.status(400).json({
        message: "Valid incident coordinates are required.",
      });
    }

    const duplicateIncident = await findDuplicateIncident({
      type: incidentType,
      latitude,
      longitude,
    });

    if (duplicateIncident) {
      return res.status(409).json({
        code: "DUPLICATE_INCIDENT",
        title: "Similar Incident Already Reported",
        message:
          "A similar incident has already been reported in this area. Please check the existing report instead.",
      });
    }

    const uploadedFiles = Array.isArray(req.files)
      ? req.files
      : req.files
        ? Object.values(req.files).flat()
        : req.file
          ? [req.file]
          : [];
    const imageItems = await Promise.all(uploadedFiles.map(uploadIncidentFile));
    const imageData = imageItems[0] || null;

    const newIncident = new IncidentModel({
      type: incidentType,
      level,
      district,
      barangay,
      street,
      streetAddress: street,
      location,
      description,
      latitude,
      longitude,
      image: imageData,
      images: imageItems,
      usernames,
      phone,
      reporterUserId,
      userId,
      status: "reported",
      aiStatus: "pending",
      isPublic: false,
      forceApproved: false,
      approvedByMDRRMO: false,
    });

    const incident = await newIncident.save();

    console.log("[incident reporter saved]", {
      incidentId: String(incident._id),
      userId: incident.userId || null,
      reporterUserId: incident.reporterUserId || null,
      bodyUserId: req.body.userId || null,
      bodyReporterUserId: req.body.reporterUserId || null,
      sessionUserId: req.session?.userId || null,
    });

    if (!incident.userId && !incident.reporterUserId) {
      console.log("[incident reporter missing]", {
        incidentId: String(incident._id),
        bodyUserId: req.body.userId || null,
        bodyReporterUserId: req.body.reporterUserId || null,
        sessionUserId: req.session?.userId || null,
      });
    }

    console.log("[incident submit]", {
      id: String(incident._id),
      status: incident.status,
      aiStatus: incident.aiStatus,
      isPublic: incident.isPublic,
      type: incident.type,
      barangay: incident.barangay,
      userId: incident.userId ? String(incident.userId) : "",
      reporterUserId: incident.reporterUserId ? String(incident.reporterUserId) : "",
      images: imageItems.length,
    });
    console.log("[public status]", {
      id: String(incident._id),
      isPublic: incident.isPublic,
      aiStatus: incident.aiStatus,
      forceApproved: incident.forceApproved,
      approvedByMDRRMO: incident.approvedByMDRRMO,
    });

    await HistoryModel.create({
      action: "ADD",
      placeName: incident.location,
      details: incident.description,
    });

    try {
      const aiResult = await verifyIncidentImageWithAI({
        incident,
        image: imageData,
      });
      const verifiedIncident = await applyIncidentAIResult(incident._id, aiResult);
      if (verifiedIncident) {
        return res.status(201).json({
          message: "Your report is being verified by AI and MDRRMO. It will appear on the map once approved.",
          incident: verifiedIncident,
        });
      }
    } catch (aiErr) {
      console.error("[ai result]", {
        id: String(incident._id),
        aiStatus: "pending",
        error: aiErr?.message || aiErr,
      });
    }

    return res.status(201).json({
      message: "Your report is being verified by AI and MDRRMO. It will appear on the map once approved.",
      incident,
    });
  } catch (err) {
    console.error("Register incident error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ✅ Update status
const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const nextStatus = normalizeStatus(status);
    const previousIncident = await IncidentModel.findById(req.params.id).select(
      "status aiStatus isPublic forceApproved approvedByMDRRMO"
    );
    const isAdminApprovalStatus = nextStatus === "approved";

    const updatedIncident = await IncidentModel.findByIdAndUpdate(
      req.params.id,
      {
        status: isAdminApprovalStatus ? "approved" : nextStatus || status,
        ...(isAdminApprovalStatus
          ? { isPublic: true, approvedByMDRRMO: true, forceApproved: true }
          : {}),
      },
      { new: true }
    );

    if (!updatedIncident) {
      return res.status(404).json({ message: "Incident not found" });
    }

    await HistoryModel.create({
      action: isAdminApprovalStatus ? "MDRRMO_APPROVAL" : "STATUS_UPDATE",
      placeName: updatedIncident.location,
      details: `Updated to ${nextStatus || status}`,
    });

    if (isAdminApprovalStatus) {
      console.log("[verification update]", {
        incidentId: String(updatedIncident._id),
        requestedStatus: status,
        status: updatedIncident.status,
        isPublic: updatedIncident.isPublic,
        approvedByMDRRMO: updatedIncident.approvedByMDRRMO,
        forceApproved: updatedIncident.forceApproved,
        reporterUserId: updatedIncident.reporterUserId || null,
        userId: updatedIncident.userId || null,
        ...getNotificationStorageDebugInfo(),
      });
      console.log("[incident approval]", {
        id: String(updatedIncident._id),
        status: updatedIncident.status,
        isPublic: updatedIncident.isPublic,
        forceApproved: updatedIncident.forceApproved,
        approvedByMDRRMO: updatedIncident.approvedByMDRRMO,
      });
      console.log("[public status]", {
        id: String(updatedIncident._id),
        isPublic: updatedIncident.isPublic,
        aiStatus: updatedIncident.aiStatus,
        forceApproved: updatedIncident.forceApproved,
        approvedByMDRRMO: updatedIncident.approvedByMDRRMO,
      });
    }

    if (isPublicIncident(updatedIncident) && !isPublicIncident(previousIncident)) {
      await publishIncidentIfPublic(updatedIncident, {
        excludeUsername: updatedIncident.usernames,
        excludePhone: updatedIncident.phone,
      });
    }

    if (isAdminApprovalStatus && isPublicIncident(updatedIncident)) {
      await notifyReporterIncidentApproved(req, updatedIncident);
    }

    res.json(updatedIncident);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update status" });
  }
};

const updateAIStatus = async (req, res) => {
  try {
    const aiStatus = String(req.body.aiStatus || req.body.status || "")
      .trim()
      .toLowerCase();

    if (!["approved", "rejected"].includes(aiStatus)) {
      return res.status(400).json({ message: "aiStatus must be approved or rejected." });
    }

    const incident = await applyIncidentAIResult(req.params.id, {
      aiStatus,
      score: req.body.score == null ? null : Number(req.body.score),
      labels: Array.isArray(req.body.labels) ? req.body.labels : [],
      reason: sanitizeText(req.body.reason, 500),
    });

    if (!incident) {
      return res.status(404).json({ message: "Incident not found" });
    }

    await HistoryModel.create({
      action: "AI_STATUS_UPDATE",
      placeName: incident.location,
      details: `AI verification ${aiStatus}`,
    });

    res.json(incident);
  } catch (err) {
    console.error("Update AI status error:", err);
    res.status(500).json({ error: "Failed to update AI status" });
  }
};

const forceApproveIncident = async (req, res) => {
  try {
    const previousIncident = await IncidentModel.findById(req.params.id).select(
      "status aiStatus isPublic forceApproved approvedByMDRRMO"
    );

    const updatedIncident = await IncidentModel.findByIdAndUpdate(
      req.params.id,
      {
        forceApproved: true,
        approvedByMDRRMO: true,
        isPublic: true,
        status: "approved",
      },
      { new: true }
    );

    if (!updatedIncident) {
      return res.status(404).json({ message: "Incident not found" });
    }

    console.log("[incident approval]", {
      id: String(updatedIncident._id),
      status: updatedIncident.status,
      forceApproved: updatedIncident.forceApproved,
      isPublic: updatedIncident.isPublic,
      approvedByMDRRMO: updatedIncident.approvedByMDRRMO,
    });
    console.log("[verification update]", {
      incidentId: String(updatedIncident._id),
      status: updatedIncident.status,
      isPublic: updatedIncident.isPublic,
      approvedByMDRRMO: updatedIncident.approvedByMDRRMO,
      forceApproved: updatedIncident.forceApproved,
      reporterUserId: updatedIncident.reporterUserId || null,
      userId: updatedIncident.userId || null,
      ...getNotificationStorageDebugInfo(),
    });
    console.log("[public status]", {
      id: String(updatedIncident._id),
      isPublic: updatedIncident.isPublic,
      aiStatus: updatedIncident.aiStatus,
      forceApproved: updatedIncident.forceApproved,
      approvedByMDRRMO: updatedIncident.approvedByMDRRMO,
    });

    await HistoryModel.create({
      action: "MDRRMO_FORCE_APPROVE",
      placeName: updatedIncident.location,
      details: "Incident force approved by MDRRMO/Admin.",
    });

    if (isPublicIncident(updatedIncident) && !isPublicIncident(previousIncident)) {
      await publishIncidentIfPublic(updatedIncident, {
        excludeUsername: updatedIncident.usernames,
        excludePhone: updatedIncident.phone,
      });
    }

    if (isPublicIncident(updatedIncident)) {
      await notifyReporterIncidentApproved(req, updatedIncident);
    }

    res.json(updatedIncident);
  } catch (err) {
    console.error("Force approve incident error:", err);
    res.status(500).json({ error: "Failed to force approve incident" });
  }
};

const reverifyIncident = async (req, res) => {
  try {
    const incident = await IncidentModel.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ message: "Incident not found" });
    }

    await IncidentModel.findByIdAndUpdate(req.params.id, {
      aiStatus: "pending",
      isPublic: false,
      "aiReview.status": "pending",
      "aiReview.reviewedAt": new Date(),
    });

    const image = incident?.image?.fileUrl ? incident.image : incident?.images?.[0];
    const aiResult = await verifyIncidentImageWithAI({ incident, image });
    const verifiedIncident = await applyIncidentAIResult(incident._id, aiResult);

    res.json(verifiedIncident);
  } catch (err) {
    console.error("Reverify incident error:", err);
    res.status(500).json({ error: "Failed to re-verify incident" });
  }
};

// ✅ Delete incident
const deleteIncident = async (req, res) => {
  try {
    const deleted = await IncidentModel.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Incident not found" });
    }

    const publicIds = [
      deleted?.image?.public_id,
      ...((deleted?.images || []).map((item) => item?.public_id)),
    ].filter(Boolean);

    await Promise.all(
      [...new Set(publicIds)].map(async (publicId) => {
        try {
          await cloudinary.uploader.destroy(publicId);
        } catch (cloudinaryErr) {
          console.error("Cloudinary incident image delete failed:", cloudinaryErr);
        }
      })
    );

    await HistoryModel.create({
      action: "DELETE",
      placeName: deleted.location,
      details: deleted.description,
    });

    res.json({ message: "Incident deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete incident" });
  }
};

// ✅ Analytics (STATUS COUNTS)
const getIncidentStats = async (req, res) => {
  try {
    const stats = await IncidentModel.aggregate([
      {
        $match: PUBLIC_INCIDENT_QUERY,
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      reported: 0,
      onProcess: 0,
      resolved: 0,
      total: 0,
    };

    stats.forEach((item) => {
      const normalizedStatus = normalizeStatus(item._id);
      if (normalizedStatus === "reported" || normalizedStatus === "") {
        result.reported += item.count;
      } else if (normalizedStatus === "on process") {
        result.onProcess += item.count;
      } else if (normalizedStatus === "resolved") {
        result.resolved += item.count;
      }
    });

    result.total = result.reported + result.onProcess + result.resolved;

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};

// ✅ Get count of incidents per type
const getIncidentTypeStats = async (req, res) => {
  try {
    const stats = await IncidentModel.aggregate([
      {
        $match: PUBLIC_INCIDENT_QUERY,
      },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {};
    stats.forEach((item) => {
      result[item._id || "Unknown"] = item.count;
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch type stats" });
  }
};

const getTrend = async (req, res) => {
  try {
    const data = await IncidentModel.aggregate([
      {
        $match: PUBLIC_INCIDENT_QUERY,
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getIncidents,
  registerIncident,
  updateStatus,
  updateAIStatus,
  forceApproveIncident,
  reverifyIncident,
  deleteIncident,
  getIncidentStats,
  getIncidentTypeStats,
  getTrend,
};
