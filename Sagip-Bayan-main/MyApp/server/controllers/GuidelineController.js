// controllers/GuidelineController.js
const PostingGuideline = require("../models/Guidelines");
const UserModel = require("../models/User");
const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");

const GUIDELINE_NOTIFICATION_LOOKBACK_DAYS = 30;

function sanitizeText(value, max = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeGuidelineStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (["publish", "posted", "active", "public", "live"].includes(status)) {
    return "published";
  }
  return ["draft", "published", "archived"].includes(status) ? status : "draft";
}

function normalizeGuidelinePayload(payload = {}) {
  const nextPayload = { ...payload };
  const publishedValue = nextPayload.published ?? nextPayload.isPublished;

  if (nextPayload.status !== undefined) {
    nextPayload.status = normalizeGuidelineStatus(nextPayload.status);
  } else if (
    publishedValue === true ||
    String(publishedValue || "").trim().toLowerCase() === "true"
  ) {
    nextPayload.status = "published";
  }

  delete nextPayload.published;
  delete nextPayload.isPublished;

  return nextPayload;
}

function getRequestUserId(req) {
  return (
    req.user?._id ||
    req.session?.userId ||
    req.query?.userId ||
    req.body?.userId ||
    req.headers["x-user-id"] ||
    null
  );
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ""));
}

function buildPublishedGuidelineNotification(guideline) {
  const title = sanitizeText(guideline?.title, 120) || "Untitled guideline";
  const dedupeKey = `guideline:${guideline._id}:published`;

  return {
    type: "guideline",
    title: "New Guideline Posted",
    message: `MDRRMO posted a new guideline: ${title}`,
    target: "all",
    source: "mdrrmo",
    notificationType: "normal",
    soundType: "notification",
    guidelineId: guideline._id,
    sourceLabel: "MDRRMO",
    official: true,
    dedupeKey,
    actionable: false,
    read: false,
    isRead: false,
    createdAt: guideline.publishedNotificationSentAt || guideline.updatedAt || new Date(),
  };
}

function getPublishedNotificationTime(guideline) {
  const value =
    guideline?.publishedNotificationSentAt ||
    guideline?.updatedAt ||
    guideline?.createdAt ||
    null;
  const date = value ? new Date(value) : null;

  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function getGuidelineClearDedupeKey(item) {
  const type = String(item?.type || "").toLowerCase();

  if (item?.dedupeKey) return String(item.dedupeKey);

  const guidelineId =
    item?.guidelineId ||
    item?.metadata?.guidelineId ||
    item?.referenceId;

  if (type.includes("guideline") && guidelineId) {
    return `guideline:${String(guidelineId)}:published`;
  }

  return "";
}

async function ensureGuidelineNotificationsForUser(userId, guidelines = []) {
  if (!isValidObjectId(userId) || !Array.isArray(guidelines) || !guidelines.length) {
    return;
  }

  const cutoff = new Date(
    Date.now() - GUIDELINE_NOTIFICATION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  );
  const recentPublishedGuidelines = guidelines.filter((guideline) => {
    const status = String(guideline?.status || "").toLowerCase();
    const timestamp = new Date(
      guideline?.publishedNotificationSentAt || guideline?.updatedAt || guideline?.createdAt || 0
    ).getTime();

    return status === "published" && !Number.isNaN(timestamp) && timestamp >= cutoff.getTime();
  });

  if (!recentPublishedGuidelines.length) {
    return;
  }

  const user = await UserModel.findById(userId).select(
    "notifications notificationClearedAt clearedNotificationDedupeKeys"
  );
  if (!user) {
    console.log("[notifications] guideline sync skipped", {
      reason: "user_not_found",
      userId: String(userId),
    });
    return;
  }

  const clearedAt = user.notificationClearedAt
    ? new Date(user.notificationClearedAt)
    : null;
  const existingDedupeKeys = new Set(
    [
      ...(user.notifications || []).map(getGuidelineClearDedupeKey),
      ...(user.clearedNotificationDedupeKeys || []),
    ]
      .map((key) => String(key || ""))
      .filter(Boolean)
  );
  let skippedExistingOrCleared = 0;
  let skippedBeforeClear = 0;

  const missingNotifications = recentPublishedGuidelines
    .filter((guideline) => {
      const dedupeKey = `guideline:${guideline._id}:published`;
      if (existingDedupeKeys.has(dedupeKey)) {
        skippedExistingOrCleared += 1;
        return false;
      }

      if (clearedAt) {
        const publishedTime = getPublishedNotificationTime(guideline);
        if (publishedTime && publishedTime <= clearedAt) {
          skippedBeforeClear += 1;
          return false;
        }
      }

      return true;
    })
    .map(buildPublishedGuidelineNotification);

  console.log("[notifications] guideline sync check", {
    userId: String(userId),
    publishedGuidelines: recentPublishedGuidelines.length,
    notificationClearedAt: user.notificationClearedAt || null,
    clearedKeys: user.clearedNotificationDedupeKeys?.length || 0,
    missingGuidelineNotifications: missingNotifications.length,
    skippedExistingOrCleared,
    skippedBeforeClear,
  });

  if (!missingNotifications.length) {
    return;
  }

  user.notifications.push(...missingNotifications);
  await user.save();

  console.log("[notifications] guideline notification created:", {
    userId: String(userId),
    count: missingNotifications.length,
  });
  console.log("[notifications] notification type", "guideline");
}

function toClientGuideline(guideline, userId = null, includeUserLists = false) {
  const raw =
    typeof guideline?.toObject === "function"
      ? guideline.toObject({ virtuals: true })
      : guideline || {};

  const viewedBy = Array.isArray(raw.viewedBy) ? raw.viewedBy.map(String) : [];
  const likedBy = Array.isArray(raw.likedBy) ? raw.likedBy.map(String) : [];
  const currentUserId = userId ? String(userId) : "";

  return {
    ...raw,
    views: viewedBy.length || raw.views || 0,
    viewCount: viewedBy.length || raw.views || 0,
    likeCount: likedBy.length,
    viewedByCurrentUser: currentUserId ? viewedBy.includes(currentUserId) : false,
    likedByCurrentUser: currentUserId ? likedBy.includes(currentUserId) : false,
    viewedBy: includeUserLists ? raw.viewedBy : undefined,
    likedBy: includeUserLists ? raw.likedBy : undefined,
  };
}

async function notifyPublishedGuideline(guideline, action = "published") {
  if (String(guideline?.status || "").toLowerCase() !== "published") return;
  if (guideline?.publishedNotificationSent) {
    console.log("[guidelines] shouldNotify:", false, {
      reason: "already_sent",
      guidelineId: String(guideline._id),
      title: guideline.title,
      status: guideline.status,
    });
    return;
  }

  const dedupeKey = `guideline:${guideline._id}:published`;
  const notification = buildPublishedGuidelineNotification(guideline);

  const result = await UserModel.updateMany(
    {
      isArchived: { $ne: true },
      "notifications.dedupeKey": { $ne: dedupeKey },
    },
    {
      $push: {
        notifications: notification,
      },
    }
  );

  guideline.publishedNotificationSent = true;
  guideline.publishedNotificationSentAt = new Date();
  await guideline.save();

  console.log("[notifications] guideline notification created:", {
    guidelineId: String(guideline._id),
    action,
    title: notification.message,
    status: guideline.status,
    matched: result?.matchedCount,
    modified: result?.modifiedCount,
  });
  console.log("[notifications] notification type", "guideline");
}

// ✅ Create a new guideline
const createGuideline = async (req, res) => {
  try {
    const files = req.files || [];

    const attachments = await Promise.all(
      files.map(file => {
        return new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { folder: "evacuation_app/guidelines" },
            (err, result) => {
              if (err) return reject(err);

              resolve({
                fileName: file.originalname,
                fileUrl: result.secure_url,
                public_id: result.public_id,
              });
            }
          ).end(file.buffer);
        });
      })
    );

    const guideline = await PostingGuideline.create({
      ...normalizeGuidelinePayload(req.body),
      attachments,
    });

    const status = String(req.body.status || "").toLowerCase().trim();
    const savedStatus = status || String(guideline.status || "").toLowerCase().trim();
    const shouldNotify = savedStatus === "published" && !guideline.publishedNotificationSent;
    console.log("[guidelines] saved status:", {
      title: guideline.title,
      status: guideline.status,
    });
    console.log("[guidelines] shouldNotify:", shouldNotify);

    if (shouldNotify) {
      await notifyPublishedGuideline(guideline, "published");
    }

    return res.status(201).json(toClientGuideline(guideline, getRequestUserId(req), true));
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
};

// GET /published
const getPublishedGuidelines = async (req, res) => {
  try {
    const userId = getRequestUserId(req);
    const guidelines = await PostingGuideline.find({ status: "published" })
      .sort({ priorityLevel: -1, createdAt: -1 });

    res.json(guidelines.map((item) => toClientGuideline(item, userId)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// controllers/GuidelineController.js
const incrementViews = async (req, res) => {
  try {
    const userId = getRequestUserId(req);
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: "Valid userId is required to count a view." });
    }

    const guideline = await PostingGuideline.findOneAndUpdate(
      {
        _id: req.params.id,
        status: "published",
        viewedBy: { $ne: userId },
      },
      {
        $addToSet: { viewedBy: userId },
      },
      { new: true }
    );
    const existing = guideline || (await PostingGuideline.findById(req.params.id));
    if (!existing) return res.status(404).json({ message: "Guideline not found" });
    if (String(existing.status || "").toLowerCase() !== "published") {
      return res.status(404).json({ message: "Guideline not found" });
    }

    existing.views = existing.viewedBy?.length || 0;
    await existing.save();
    res.json(toClientGuideline(existing, userId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};


// ✅ Get all guidelines
const getGuidelines = async (req, res) => {
  try {
    const { status, category, includeAll } = req.query;
    const filter = String(includeAll || "false") === "true" ? {} : { status: "published" };
    const userId = getRequestUserId(req);

    if (status) filter.status = status;
    if (category) filter.category = category;

    const guidelines = await PostingGuideline.find(filter).sort({
      createdAt: -1,
      updatedAt: -1,
    });

    if (filter.status === "published" && isValidObjectId(userId)) {
      await ensureGuidelineNotificationsForUser(userId, guidelines);
    }

    res
      .status(200)
      .json((guidelines || []).map((item) => toClientGuideline(item, userId, filter.status !== "published")));
  } catch (err) {
    console.error("Error fetching guidelines:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get a single guideline by ID
const getGuidelineById = async (req, res) => {
  try {
    const userId = getRequestUserId(req);
    const filter = { _id: req.params.id };
    if (String(req.query.includeAll || "false") !== "true") {
      filter.status = "published";
    }

    const guideline = await PostingGuideline.findOne(filter)
      .populate("createdBy", "name email");

    if (!guideline) return res.status(404).json({ message: "Guideline not found" });
    res.json(toClientGuideline(guideline, userId));
  } catch (err) {
    console.error("Error fetching guideline:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Update a guideline
const updateGuideline = async (req, res) => {
  try {
    const guideline = await PostingGuideline.findById(req.params.id);
    if (!guideline) {
      return res.status(404).json({ message: "Guideline not found" });
    }

    // =======================
    // ✅ Handle deleted images
    // =======================
    let remainingAttachments = guideline.attachments || [];

    if (req.body.removeImages) {
      const removeList = JSON.parse(req.body.removeImages);

      // delete from Cloudinary
      await Promise.all(
        removeList.map(img =>
          cloudinary.uploader.destroy(img.public_id)
        )
      );

      // filter out removed images
      remainingAttachments = remainingAttachments.filter(
        img => !removeList.some(r => r.public_id === img.public_id)
      );
    }

    // =======================
    // ✅ Upload new images
    // =======================
    const newAttachments = await Promise.all(
      (req.files || []).map(file => {
        return new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { folder: "evacuation_app/guidelines" },
            (err, result) => {
              if (err) return reject(err);

              resolve({
                fileName: file.originalname,
                fileUrl: result.secure_url,
                public_id: result.public_id,
              });
            }
          ).end(file.buffer);
        });
      })
    );

    // =======================
    // ✅ Combine old + new
    // =======================
    guideline.attachments = [...remainingAttachments, ...newAttachments];

    // =======================
    // ✅ Update other fields
    // =======================
    const previousStatus = String(guideline.status || "").toLowerCase().trim();
    Object.assign(guideline, normalizeGuidelinePayload(req.body));

    await guideline.save();
    const status = String(req.body.status || "").toLowerCase().trim();
    const nextStatus = status || String(guideline.status || "").toLowerCase().trim();
    const shouldNotify =
      previousStatus !== "published" &&
      nextStatus === "published" &&
      !guideline.publishedNotificationSent;

    console.log("[guidelines] saved status:", {
      title: guideline.title,
      status: guideline.status,
    });
    console.log("[guidelines] shouldNotify:", shouldNotify);

    if (shouldNotify) {
      await notifyPublishedGuideline(guideline, "published");
    }

    res.json(toClientGuideline(guideline, getRequestUserId(req), true));
  } catch (err) {
    console.error("Error updating guideline:", err);
    res.status(400).json({ error: err.message });
  }
};

//Delete
const deleteGuideline = async (req, res) => {
  try {
    const guideline = await PostingGuideline.findById(req.params.id);

    if (!guideline) {
      return res.status(404).json({ message: "Guideline not found" });
    }

    // ✅ delete images from Cloudinary
    if (guideline.attachments?.length) {
      await Promise.all(
        guideline.attachments.map(file =>
          cloudinary.uploader.destroy(file.public_id)
        )
      );
    }

    await PostingGuideline.findByIdAndDelete(req.params.id);

    res.json({ message: "Guideline deleted successfully" });
  } catch (err) {
    console.error("Error deleting guideline:", err);
    res.status(500).json({ error: err.message });
  }
};

const toggleLike = async (req, res) => {
  try {
    const userId = getRequestUserId(req);
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: "Valid userId is required to like a post." });
    }

    const guideline = await PostingGuideline.findOne({
      _id: req.params.id,
      status: "published",
    });

    if (!guideline) {
      return res.status(404).json({ message: "Guideline not found" });
    }

    const liked = guideline.likedBy.some((id) => String(id) === String(userId));
    if (liked) {
      guideline.likedBy = guideline.likedBy.filter((id) => String(id) !== String(userId));
    } else {
      guideline.likedBy.addToSet(userId);
    }

    await guideline.save();
    res.json(toClientGuideline(guideline, userId));
  } catch (err) {
    console.error("Error toggling guideline like:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createGuideline,
  getGuidelines,
  getGuidelineById,
  updateGuideline,
  deleteGuideline,
  incrementViews,
  toggleLike,
};
