// controllers/GuidelineController.js
const PostingGuideline = require("../models/Guidelines");
const UserModel = require("../models/User");
const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");

function sanitizeText(value, max = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
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

async function notifyPublishedGuideline(guideline) {
  if (String(guideline?.status || "").toLowerCase() !== "published") return;

  const title = sanitizeText(guideline?.title, 120) || "Untitled guideline";
  const dedupeKey = `guideline:${guideline._id}:published`;

  await UserModel.updateMany(
    {
      isArchived: { $ne: true },
      "notifications.dedupeKey": { $ne: dedupeKey },
    },
    {
      $push: {
        notifications: {
          type: "drrmo_guideline",
          message: `A new MDRRMO advisory has been published: ${title}.`,
          dedupeKey,
          actionable: false,
          read: false,
          createdAt: new Date(),
        },
      },
    }
  );
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
      ...req.body,
      attachments,
    });

    await notifyPublishedGuideline(guideline);

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
    const wasPublished = String(guideline.status || "").toLowerCase() === "published";
    Object.assign(guideline, req.body);

    await guideline.save();
    const isPublished = String(guideline.status || "").toLowerCase() === "published";
    if (!wasPublished && isPublished) {
      await notifyPublishedGuideline(guideline);
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
