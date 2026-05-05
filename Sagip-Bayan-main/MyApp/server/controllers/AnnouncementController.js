const mongoose = require("mongoose");
const Announcement = require("../models/Announcement");
const UserModel = require("../models/User");
const cloudinary = require("../config/cloudinary");

const ANNOUNCEMENT_NOTIFICATION_LOOKBACK_DAYS = 30;

function sanitizeText(value, max = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeAnnouncementStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (["publish", "posted", "active", "public", "live"].includes(status)) {
    return "published";
  }
  return ["draft", "published", "archived"].includes(status) ? status : "draft";
}

function normalizeAnnouncementPayload(payload = {}) {
  const nextPayload = { ...payload };
  const publishedValue = nextPayload.published ?? nextPayload.isPublished;

  if (nextPayload.status !== undefined) {
    nextPayload.status = normalizeAnnouncementStatus(nextPayload.status);
  } else if (
    publishedValue === true ||
    String(publishedValue || "").trim().toLowerCase() === "true"
  ) {
    nextPayload.status = "published";
  }

  delete nextPayload.published;
  delete nextPayload.isPublished;
  delete nextPayload.viewedBy;
  delete nextPayload.likedBy;
  delete nextPayload.views;

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

function toClientAnnouncement(announcement, userId = null, includeUserLists = false) {
  const raw =
    typeof announcement?.toObject === "function"
      ? announcement.toObject({ virtuals: true })
      : announcement || {};

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

function buildPublishedAnnouncementNotification(announcement) {
  const title = sanitizeText(announcement?.title, 120) || "Untitled announcement";
  const dedupeKey = `announcement:${announcement._id}:published`;

  return {
    type: "announcement",
    title: "New MDRRMO Announcement",
    message: `MDRRMO posted a new announcement: ${title}`,
    target: "all",
    source: "mdrrmo",
    notificationType: "normal",
    soundType: "notification",
    announcementId: announcement._id,
    sourceLabel: "MDRRMO",
    official: true,
    dedupeKey,
    actionable: false,
    read: false,
    isRead: false,
    createdAt: announcement.publishedNotificationSentAt || announcement.updatedAt || new Date(),
  };
}

async function ensureAnnouncementNotificationsForUser(userId, announcements = []) {
  if (!isValidObjectId(userId) || !Array.isArray(announcements) || !announcements.length) {
    return;
  }

  const cutoff = new Date(
    Date.now() - ANNOUNCEMENT_NOTIFICATION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  );
  const recentPublishedAnnouncements = announcements.filter((announcement) => {
    const status = String(announcement?.status || "").toLowerCase();
    const timestamp = new Date(
      announcement?.publishedNotificationSentAt ||
        announcement?.updatedAt ||
        announcement?.createdAt ||
        0
    ).getTime();

    return status === "published" && !Number.isNaN(timestamp) && timestamp >= cutoff.getTime();
  });

  if (!recentPublishedAnnouncements.length) {
    return;
  }

  const user = await UserModel.findById(userId).select("notifications");
  if (!user) {
    console.log("[notifications] announcement sync skipped", {
      reason: "user_not_found",
      userId: String(userId),
    });
    return;
  }

  const existingDedupeKeys = new Set(
    (user.notifications || [])
      .map((item) => String(item?.dedupeKey || ""))
      .filter(Boolean)
  );
  const missingNotifications = recentPublishedAnnouncements
    .filter((announcement) => {
      const dedupeKey = `announcement:${announcement._id}:published`;
      return !existingDedupeKeys.has(dedupeKey);
    })
    .map(buildPublishedAnnouncementNotification);

  console.log("[notifications] announcement sync check", {
    userId: String(userId),
    publishedAnnouncements: recentPublishedAnnouncements.length,
    missingAnnouncementNotifications: missingNotifications.length,
  });

  if (!missingNotifications.length) {
    return;
  }

  user.notifications.push(...missingNotifications);
  await user.save();

  console.log("[notifications] announcement notification created:", {
    userId: String(userId),
    count: missingNotifications.length,
  });
  console.log("[notifications] notification type", "announcement");
}

async function notifyPublishedAnnouncement(announcement, action = "published") {
  if (String(announcement?.status || "").toLowerCase() !== "published") return;
  if (announcement?.publishedNotificationSent) {
    console.log("[announcements] shouldNotify:", false, {
      reason: "already_sent",
      announcementId: String(announcement._id),
      title: announcement.title,
      status: announcement.status,
    });
    return;
  }

  const dedupeKey = `announcement:${announcement._id}:published`;
  const notification = buildPublishedAnnouncementNotification(announcement);

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

  announcement.publishedNotificationSent = true;
  announcement.publishedNotificationSentAt = new Date();
  await announcement.save();

  console.log("[notifications] announcement notification created:", {
    announcementId: String(announcement._id),
    action,
    title: notification.message,
    status: announcement.status,
    matched: result?.matchedCount,
    modified: result?.modifiedCount,
  });
  console.log("[notifications] notification type", "announcement");
}

async function uploadAnnouncementFiles(files = []) {
  return Promise.all(
    files.map(
      (file) =>
        new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              { folder: "evacuation_app/announcements" },
              (err, result) => {
                if (err) return reject(err);

                resolve({
                  fileName: file.originalname,
                  fileUrl: result.secure_url,
                  public_id: result.public_id,
                });
              }
            )
            .end(file.buffer);
        })
    )
  );
}

const createAnnouncement = async (req, res) => {
  try {
    const attachments = await uploadAnnouncementFiles(req.files || []);
    const announcement = await Announcement.create({
      ...normalizeAnnouncementPayload(req.body),
      attachments,
    });

    const savedStatus = String(announcement.status || "").toLowerCase().trim();
    if (savedStatus === "published") {
      await notifyPublishedAnnouncement(announcement, "published");
    }

    res
      .status(201)
      .json(toClientAnnouncement(announcement, getRequestUserId(req), true));
  } catch (err) {
    console.error("Error creating announcement:", err);
    res.status(400).json({ error: err.message });
  }
};

const getAnnouncements = async (req, res) => {
  try {
    const { status, category, includeAll } = req.query;
    const filter = String(includeAll || "false") === "true" ? {} : { status: "published" };
    const userId = getRequestUserId(req);

    if (status) filter.status = normalizeAnnouncementStatus(status);
    if (category && category !== "all") filter.category = category;

    const announcements = await Announcement.find(filter).sort({
      createdAt: -1,
      updatedAt: -1,
    });

    if (filter.status === "published" && isValidObjectId(userId)) {
      await ensureAnnouncementNotificationsForUser(userId, announcements);
    }

    res
      .status(200)
      .json(
        announcements.map((item) =>
          toClientAnnouncement(item, userId, filter.status !== "published")
        )
      );
  } catch (err) {
    console.error("Error fetching announcements:", err);
    res.status(500).json({ error: err.message });
  }
};

const getAnnouncementById = async (req, res) => {
  try {
    const userId = getRequestUserId(req);
    const filter = { _id: req.params.id };

    if (String(req.query.includeAll || "false") !== "true") {
      filter.status = "published";
    }

    const announcement = await Announcement.findOne(filter);
    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    res.json(toClientAnnouncement(announcement, userId));
  } catch (err) {
    console.error("Error fetching announcement:", err);
    res.status(500).json({ error: err.message });
  }
};

const updateAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    let remainingAttachments = announcement.attachments || [];

    if (req.body.removeImages) {
      const removeList = JSON.parse(req.body.removeImages);

      await Promise.all(
        removeList
          .filter((item) => item?.public_id)
          .map((item) => cloudinary.uploader.destroy(item.public_id))
      );

      remainingAttachments = remainingAttachments.filter(
        (file) => !removeList.some((item) => item.public_id === file.public_id)
      );
    }

    const newAttachments = await uploadAnnouncementFiles(req.files || []);
    announcement.attachments = [...remainingAttachments, ...newAttachments];

    const previousStatus = String(announcement.status || "").toLowerCase().trim();
    Object.assign(announcement, normalizeAnnouncementPayload(req.body));
    await announcement.save();

    const nextStatus = String(announcement.status || "").toLowerCase().trim();
    if (
      previousStatus !== "published" &&
      nextStatus === "published" &&
      !announcement.publishedNotificationSent
    ) {
      await notifyPublishedAnnouncement(announcement, "published");
    }

    res.json(toClientAnnouncement(announcement, getRequestUserId(req), true));
  } catch (err) {
    console.error("Error updating announcement:", err);
    res.status(400).json({ error: err.message });
  }
};

const deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    if (announcement.attachments?.length) {
      await Promise.all(
        announcement.attachments
          .filter((file) => file?.public_id)
          .map((file) => cloudinary.uploader.destroy(file.public_id))
      );
    }

    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ message: "Announcement deleted successfully" });
  } catch (err) {
    console.error("Error deleting announcement:", err);
    res.status(500).json({ error: err.message });
  }
};

const incrementViews = async (req, res) => {
  try {
    const userId = getRequestUserId(req);
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: "Valid userId is required to count a view." });
    }

    const announcement = await Announcement.findOneAndUpdate(
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

    const existing = announcement || (await Announcement.findById(req.params.id));
    if (!existing || String(existing.status || "").toLowerCase() !== "published") {
      return res.status(404).json({ message: "Announcement not found" });
    }

    existing.views = existing.viewedBy?.length || 0;
    await existing.save();

    res.json(toClientAnnouncement(existing, userId));
  } catch (err) {
    console.error("Error recording announcement view:", err);
    res.status(500).json({ error: err.message });
  }
};

const toggleLike = async (req, res) => {
  try {
    const userId = getRequestUserId(req);
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: "Valid userId is required to like a post." });
    }

    const announcement = await Announcement.findOne({
      _id: req.params.id,
      status: "published",
    });

    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    const liked = announcement.likedBy.some((id) => String(id) === String(userId));
    if (liked) {
      announcement.likedBy = announcement.likedBy.filter(
        (id) => String(id) !== String(userId)
      );
    } else {
      announcement.likedBy.addToSet(userId);
    }

    await announcement.save();
    res.json(toClientAnnouncement(announcement, userId));
  } catch (err) {
    console.error("Error toggling announcement like:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  incrementViews,
  toggleLike,
};
