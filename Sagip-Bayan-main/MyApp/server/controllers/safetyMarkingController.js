const SafetyDebugLocation = require("../models/SafetyDebugLocation");
const UserModel = require("../models/User");
const mongoose = require("mongoose");
const jaenGeoJSON = require("../../screens/data/jaen.json");

const JAEN_BOUNDS = {
  north: 15.42,
  south: 15.28,
  east: 121.05,
  west: 120.85,
};

const JAEN_DEBUG_POINTS = [
  { latitude: 15.3383, longitude: 120.9141 },
  { latitude: 15.3278, longitude: 120.9196 },
  { latitude: 15.3489, longitude: 120.9272 },
  { latitude: 15.3612, longitude: 120.9064 },
  { latitude: 15.3136, longitude: 120.9325 },
  { latitude: 15.3774, longitude: 120.9188 },
  { latitude: 15.3349, longitude: 120.9481 },
  { latitude: 15.3921, longitude: 120.9367 },
  { latitude: 15.3228, longitude: 120.8994 },
  { latitude: 15.3679, longitude: 120.9576 },
  { latitude: 15.3197, longitude: 120.9653 },
  { latitude: 15.4092, longitude: 120.8918 },
];

function sanitizeText(value, maxLength = 120) {
  return String(value || "")
    .replace(/[<>$]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeSafetyStatus(value) {
  const normalized = String(value || "SAFE").trim().toUpperCase();
  if (normalized === "SAFE" || normalized === "NOT_SAFE") return normalized;
  if (normalized === "UNSAFE" || normalized === "NOT SAFE") return "NOT_SAFE";
  return "UNKNOWN";
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isInsideJaen(latitude, longitude) {
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    latitude < JAEN_BOUNDS.south ||
    latitude > JAEN_BOUNDS.north ||
    longitude < JAEN_BOUNDS.west ||
    longitude > JAEN_BOUNDS.east
  ) {
    return false;
  }

  return isPointInsideGeoJson(latitude, longitude, jaenGeoJSON);
}

function pointInRing(latitude, longitude, ring) {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i]?.[0]);
    const yi = Number(ring[i]?.[1]);
    const xj = Number(ring[j]?.[0]);
    const yj = Number(ring[j]?.[1]);

    const intersects =
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi || Number.EPSILON) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

function isPointInsidePolygon(latitude, longitude, polygon) {
  const outerRing = polygon?.[0];
  if (!Array.isArray(outerRing) || !pointInRing(latitude, longitude, outerRing)) {
    return false;
  }

  const holes = polygon.slice(1);
  return !holes.some((hole) => pointInRing(latitude, longitude, hole));
}

function isPointInsideGeoJson(latitude, longitude, data) {
  return (data?.features || []).some((feature) => {
    const geometry = feature?.geometry;
    if (geometry?.type === "Polygon") {
      return isPointInsidePolygon(latitude, longitude, geometry.coordinates);
    }
    if (geometry?.type === "MultiPolygon") {
      return geometry.coordinates.some((polygon) =>
        isPointInsidePolygon(latitude, longitude, polygon)
      );
    }
    return false;
  });
}

function normalizeMarkerUserId(marker) {
  return String(marker?.userId || "").trim();
}

function hashString(value) {
  return String(value || "debug-user").split("").reduce((hash, char) => {
    const nextHash = (hash << 5) - hash + char.charCodeAt(0);
    return nextHash | 0;
  }, 0);
}

function roundCoordinate(value) {
  return Number(value.toFixed(6));
}

function generateSeededJaenDebugLocation(userId) {
  const seed = Math.abs(hashString(userId));
  const point = JAEN_DEBUG_POINTS[seed % JAEN_DEBUG_POINTS.length] || JAEN_DEBUG_POINTS[0];
  const offsetSeed = Math.abs(hashString(`${userId}:offset`));
  const candidate = {
    latitude: roundCoordinate(point.latitude + ((offsetSeed % 7) - 3) * 0.00012),
    longitude: roundCoordinate(
      point.longitude + ((Math.floor(offsetSeed / 7) % 7) - 3) * 0.00012
    ),
  };

  if (isInsideJaen(candidate.latitude, candidate.longitude)) return candidate;

  return (
    JAEN_DEBUG_POINTS.find((item) => isInsideJaen(item.latitude, item.longitude)) ||
    JAEN_DEBUG_POINTS[0]
  );
}

async function getUniqueActiveDebugMarkers() {
  const markers = await SafetyDebugLocation.find({ debugMode: true })
    .sort({ updatedAt: -1 })
    .lean();

  const markerUserIds = markers
    .map((marker) => normalizeMarkerUserId(marker))
    .filter((userId) => mongoose.Types.ObjectId.isValid(userId));
  const shareEnabledUsers = await UserModel.find({
    _id: { $in: markerUserIds },
    shareSafetyLocation: true,
  })
    .select("_id")
    .lean();
  const shareEnabledIds = new Set(shareEnabledUsers.map((item) => String(item._id)));

  const seen = new Set();
  const duplicateIds = [];
  const uniqueMarkers = [];

  markers.forEach((marker) => {
    const userId = normalizeMarkerUserId(marker);
    const isValidMarker =
      userId &&
      shareEnabledIds.has(userId) &&
      isInsideJaen(marker.latitude, marker.longitude);

    if (!isValidMarker) {
      duplicateIds.push(marker._id);
      return;
    }

    if (seen.has(userId)) {
      duplicateIds.push(marker._id);
      return;
    }

    seen.add(userId);
    uniqueMarkers.push({
      ...marker,
      userId,
    });
  });

  if (duplicateIds.length) {
    await SafetyDebugLocation.updateMany(
      { _id: { $in: duplicateIds } },
      {
        $set: {
          debugMode: false,
          updatedAt: new Date(),
        },
      }
    );
    console.log("[debug-markers] disabled duplicate/invalid markers:", duplicateIds.length);
  }

  return uniqueMarkers;
}

exports.upsertDebugLocation = async (req, res) => {
  try {
    const userId = sanitizeText(req.body?.userId, 80);
    let latitude = toNumber(req.body?.latitude);
    let longitude = toNumber(req.body?.longitude);

    console.log("[debug-markers] POST received:", {
      userId,
      username: req.body?.username,
      latitude,
      longitude,
      safetyStatus: req.body?.safetyStatus,
    });

    if (!userId) {
      return res.status(400).json({ message: "userId is required." });
    }

    const user = await UserModel.findById(userId).select("shareSafetyLocation");

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.shareSafetyLocation !== true) {
      await SafetyDebugLocation.findOneAndUpdate(
        { userId },
        {
          $set: {
            debugMode: false,
            updatedAt: new Date(),
          },
        },
        { new: true }
      );

      return res.status(403).json({
        message: "Debug Mode is ON, but location sharing is disabled.",
        shareSafetyLocation: false,
      });
    }

    let locationAdjusted = false;

    if (!isInsideJaen(latitude, longitude)) {
      const fallback = generateSeededJaenDebugLocation(userId);
      latitude = fallback.latitude;
      longitude = fallback.longitude;
      locationAdjusted = true;
    }

    if (locationAdjusted) {
      console.log("[debug-markers] adjusted debug coordinate inside Jaen:", {
        userId,
        latitude,
        longitude,
      });
    }

    const marker = await SafetyDebugLocation.findOneAndUpdate(
      { userId },
      {
        $set: {
          userId,
          username: sanitizeText(req.body?.username, 80) || "User",
          avatar: sanitizeText(req.body?.avatar || req.body?.profileImage, 500),
          latitude,
          longitude,
          safetyStatus: normalizeSafetyStatus(req.body?.safetyStatus),
          debugMode: true,
          updatedAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    ).lean();

    await getUniqueActiveDebugMarkers();

    console.log("[debug-markers] saved marker:", {
      userId: marker.userId,
      username: marker.username,
      latitude: marker.latitude,
      longitude: marker.longitude,
      debugMode: marker.debugMode,
      locationAdjusted,
    });

    return res.status(200).json({
      message: "Debug location saved.",
      marker,
    });
  } catch (err) {
    console.error("[safety-marking] upsert debug location failed:", err);
    return res.status(500).json({
      message: "Failed to save debug location.",
      error: err.message,
    });
  }
};

exports.getDebugLocations = async (_req, res) => {
  try {
    const insideJaenMarkers = await getUniqueActiveDebugMarkers();

    console.log(
      `[debug-markers] GET returning ${insideJaenMarkers.length} markers:`,
      insideJaenMarkers.map((marker) => String(marker.userId))
    );

    return res.status(200).json({
      markers: insideJaenMarkers,
    });
  } catch (err) {
    console.error("[safety-marking] fetch debug locations failed:", err);
    return res.status(500).json({
      message: "Failed to fetch debug locations.",
      error: err.message,
    });
  }
};

exports.turnOffDebugLocation = async (req, res) => {
  try {
    const userId = sanitizeText(req.body?.userId || req.params?.userId, 80);

    console.log("[debug-markers] OFF received:", { userId });

    if (!userId) {
      return res.status(400).json({ message: "userId is required." });
    }

    await SafetyDebugLocation.findOneAndUpdate(
      { userId },
      {
        $set: {
          debugMode: false,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    return res.status(200).json({
      message: "Debug location turned off.",
    });
  } catch (err) {
    console.error("[safety-marking] turn off debug location failed:", err);
    return res.status(500).json({
      message: "Failed to turn off debug location.",
      error: err.message,
    });
  }
};
