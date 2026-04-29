const IncidentModel = require("../models/Incident");
const HistoryModel = require("../models/History");
const UserModel = require("../models/User");
const cloudinary = require("../config/cloudinary");

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
  return String(status || "").trim().toLowerCase();
}

function isAcceptedIncident(incident) {
  return normalizeStatus(incident?.status) === "accepted";
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
    if (!isAcceptedIncident(incident)) return;

    const barangay = sanitizeText(incident?.barangay, 80);
    if (!barangay) return;

    const cleanExcludeUsername = sanitizeText(excludeUsername, 60).toLowerCase();
    const cleanExcludePhone = sanitizePhone(excludePhone);

    const users = await UserModel.find({
      barangay: { $regex: new RegExp(`^${escapeRegex(barangay)}$`, "i") },
      isArchived: { $ne: true },
    }).select("_id fname lname username phone barangay notifications avatar");

    if (!users.length) {
      console.log("[incident notify] No users found in barangay:", barangay);
      return;
    }

    const notificationType = normalizeNotificationType("nearby_incident");
    const message =
      "An incident has been reported in your barangay. Please stay alert.";

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

      return !sameUsername && !samePhone;
    });

    if (!notifyTargets.length) {
      console.log("[incident notify] Users found, but all excluded as reporter match.");
      return;
    }

    await Promise.all(
      notifyTargets.map((user) =>
        addNotification(user._id, {
          type: notificationType,
          message,
          dedupeKey: `incident:${incident._id}:barangay:${barangay.toLowerCase()}`,
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
    if (!isAcceptedIncident(incident)) return;

    const type = sanitizeText(incident?.type, 60).toLowerCase();
    const barangay = sanitizeText(incident?.barangay, 80);
    if (!type || !barangay) return;

    const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const recent = await IncidentModel.aggregate([
      {
        $match: {
          status: "accepted",
          type: { $regex: new RegExp(`^${escapeRegex(type)}$`, "i") },
          barangay: { $ne: "" },
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: { $toLower: "$barangay" },
          barangay: { $first: "$barangay" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gte: 1 } } },
    ]);

    const totalReports = recent.reduce((sum, item) => sum + item.count, 0);
    const barangayCount = recent.length;
    if (totalReports < 5 || totalReports > 10 || barangayCount < 2) return;

    const barangays = recent.map((item) => item.barangay).filter(Boolean);
    const users = await UserModel.find({
      barangay: {
        $in: barangays.map((name) => new RegExp(`^${escapeRegex(name)}$`, "i")),
      },
      isArchived: { $ne: true },
    }).select("_id barangay");

    const windowKey = `${type}:${Math.floor(Date.now() / (6 * 60 * 60 * 1000))}`;
    const message = `${barangayCount} barangays have reported the same incident nearby. Please stay alert.`;

    await Promise.all(
      users.map((user) =>
        addNotification(user._id, {
          type: "nearby_repeated_incident",
          message,
          dedupeKey: `nearby-repeated:${windowKey}`,
          actionable: false,
        })
      )
    );
  } catch (err) {
    console.error("Nearby repeated incident notification error:", err);
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
        ? { status }
        : {}
      : { status: "accepted" };

    const incidents = await IncidentModel.find(filter).sort({ createdAt: -1 });
    res.json(incidents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ✅ Register Incident (WITH IMAGE SUPPORT + STRUCTURED ADDRESS)
const registerIncident = async (req, res) => {
  try {
    if (!req.body) req.body = {};

    const uploadedFiles = Array.isArray(req.files)
      ? req.files
      : req.files
        ? Object.values(req.files).flat()
        : req.file
          ? [req.file]
          : [];
    const imageItems = await Promise.all(uploadedFiles.map(uploadIncidentFile));
    const imageData = imageItems[0] || null;

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

    if (nextStatus === "accepted") {
      await notifyUsersInSameBarangay({
        incident: updatedIncident,
        excludeUsername: updatedIncident.usernames,
        excludePhone: updatedIncident.phone,
      });
      await notifyNearbyRepeatedIncidents(updatedIncident);
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
