const IncidentModel = require("../models/Incident");
const HistoryModel = require("../models/History");
const UserModel = require("../models/User");
const cloudinary = require("../config/cloudinary");

const DUPLICATE_INCIDENT_RADIUS_METERS = 100;
const DUPLICATE_INCIDENT_WINDOW_HOURS = 24;
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
  "on_process",
  "on-process",
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
  return sanitizeText(value, max).replace(/[^A-Za-z0-9\s,.-]/g, "");
}

function sanitizeAlphaNumericText(value, max = 120) {
  return sanitizeText(value, max).replace(/[^A-Za-z0-9\s-]/g, "");
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

const PUBLIC_INCIDENT_STATUSES = ["reported", "on process", "resolved"];
const PUBLIC_INCIDENT_STATUS_QUERY = [/^reported$/i, /^on[ _-]+process$/i, /^resolved$/i];

function isPublicIncidentStatus(status) {
  return PUBLIC_INCIDENT_STATUSES.includes(normalizeStatus(status));
}

function isPublicIncident(incident) {
  return isPublicIncidentStatus(incident?.status);
}

function normalizeIncidentType(type) {
  const clean = sanitizeText(type, 60).toLowerCase();
  if (clean.includes("flood")) return "flood";
  if (clean.includes("fire")) return "fire";
  if (clean.includes("earthquake")) return "earthquake";
  if (clean.includes("typhoon") || clean.includes("storm")) return "typhoon";
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
    return "Multiple nearby barangays have reported flooding. Please stay alert.";
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
  const point = { latitude, longitude };
  const box = buildCoordinateBox(
    latitude,
    longitude,
    DUPLICATE_INCIDENT_RADIUS_METERS
  );
  const since = new Date(
    Date.now() - DUPLICATE_INCIDENT_WINDOW_HOURS * 60 * 60 * 1000
  );

  const candidates = await IncidentModel.find({
    type: { $regex: new RegExp(`^${escapeRegex(type)}$`, "i") },
    status: { $in: DUPLICATE_ACTIVE_STATUSES },
    createdAt: { $gte: since },
    latitude: { $gte: box.minLat, $lte: box.maxLat },
    longitude: { $gte: box.minLng, $lte: box.maxLng },
  })
    .sort({ createdAt: -1 })
    .select("_id type status latitude longitude location createdAt");

  return candidates.find(
    (incident) =>
      distanceMeters(point, {
        latitude: incident.latitude,
        longitude: incident.longitude,
      }) <= DUPLICATE_INCIDENT_RADIUS_METERS
  );
}

async function addNotification(userId, notification) {
  if (!userId) return;

  const dedupeKey = sanitizeText(notification.dedupeKey, 180);
  const filter = dedupeKey
    ? { _id: userId, "notifications.dedupeKey": { $ne: dedupeKey } }
    : { _id: userId };

  await UserModel.updateOne(filter, {
    $push: {
      notifications: {
        type: normalizeNotificationType(notification.type),
        message: notification.message,
        title: notification.title || "",
        sourceLabel: notification.sourceLabel || "",
        source: notification.source || "",
        official: Boolean(notification.official),
        notificationType: notification.notificationType || "normal",
        soundType: notification.soundType || "notification",
        incidentId: notification.incidentId || null,
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
        read: false,
        createdAt: new Date(),
      },
    },
  });
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
      status: { $in: PUBLIC_INCIDENT_STATUS_QUERY },
      barangay: { $ne: "" },
      createdAt: { $gte: since },
    }).select("_id type district barangay latitude longitude createdAt");

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
          status: { $in: PUBLIC_INCIDENT_STATUS_QUERY },
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
      : {
          status: {
            $in: PUBLIC_INCIDENT_STATUS_QUERY,
          },
        };

    const incidents = await IncidentModel.find(filter).sort({ createdAt: -1 });
    const publicIncidents = includeAll
      ? incidents
      : incidents.filter((incident) => isPublicIncidentStatus(incident?.status));

    console.log("[incident/getIncidents] public fetch:", {
      includeAll,
      requestedStatus: status || "",
      fetched: incidents.length,
      returned: publicIncidents.length,
      statuses: [...new Set(incidents.map((incident) => incident?.status || ""))],
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
    const allowedTypes = new Set(["flood", "typhoon", "fire", "earthquake"]);
    const allowedLevels = new Set(["low", "medium", "high", "critical"]);

    const latitude =
      req.body.latitude !== undefined && req.body.latitude !== ""
        ? Number(req.body.latitude)
        : null;

    const longitude =
      req.body.longitude !== undefined && req.body.longitude !== ""
        ? Number(req.body.longitude)
        : null;

    if (!type || !allowedTypes.has(type.toLowerCase())) {
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
      type,
      latitude,
      longitude,
    });

    if (duplicateIncident) {
      return res.status(409).json({
        code: "DUPLICATE_INCIDENT",
        title: "Similar Incident Already Reported",
        message:
          "An incident with the same category has already been reported near this area. Please check existing reports instead.",
        duplicate: {
          id: duplicateIncident._id,
          type: duplicateIncident.type,
          status: duplicateIncident.status,
          latitude: duplicateIncident.latitude,
          longitude: duplicateIncident.longitude,
          location: duplicateIncident.location,
          createdAt: duplicateIncident.createdAt,
        },
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
      type,
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
      status: "reported",
    });

    const incident = await newIncident.save();

    console.log("Incident registered:", incident);

    await HistoryModel.create({
      action: "ADD",
      placeName: incident.location,
      details: incident.description,
    });

    await notifyUsersInSameBarangay({
      incident,
      excludeUsername: "",
      excludePhone: "",
    });
    await notifyNearbyRepeatedIncidents(incident);
    await notifyBarangayIncidentDangerThreshold(incident);

    return res.status(201).json({
      message: "Incident created successfully",
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
    const previousIncident = await IncidentModel.findById(req.params.id).select("status");

    const updatedIncident = await IncidentModel.findByIdAndUpdate(
      req.params.id,
      { status: nextStatus || status },
      { new: true }
    );

    if (!updatedIncident) {
      return res.status(404).json({ message: "Incident not found" });
    }

    await HistoryModel.create({
      action: "STATUS_UPDATE",
      placeName: updatedIncident.location,
      details: `Updated to ${nextStatus || status}`,
    });

    if (
      isPublicIncidentStatus(nextStatus) &&
      !isPublicIncidentStatus(previousIncident?.status)
    ) {
      await notifyUsersInSameBarangay({
        incident: updatedIncident,
        excludeUsername: updatedIncident.usernames,
        excludePhone: updatedIncident.phone,
      });
      await notifyNearbyRepeatedIncidents(updatedIncident);
      await notifyBarangayIncidentDangerThreshold(updatedIncident);
    }

    res.json(updatedIncident);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update status" });
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
      if (item._id === "reported" || item._id === "" || item._id === null) {
        result.reported += item.count;
      } else if (item._id === "onProcess") {
        result.onProcess = item.count;
      } else if (item._id === "resolved") {
        result.resolved = item.count;
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
  deleteIncident,
  getIncidentStats,
  getIncidentTypeStats,
  getTrend,
};
