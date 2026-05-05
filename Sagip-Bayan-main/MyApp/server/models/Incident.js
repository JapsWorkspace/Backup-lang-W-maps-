const mongoose = require("mongoose");

const incidentImageSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      default: "",
      trim: true,
    },
    fileUrl: {
      type: String,
      default: "",
      trim: true,
    },
    public_id: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const incidentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      default: "",
      trim: true,
    },

    level: {
      type: String,
      default: "",
      trim: true,
    },

    district: {
      type: String,
      default: "",
      trim: true,
    },

    barangay: {
      type: String,
      default: "",
      trim: true,
    },

    street: {
      type: String,
      default: "",
      trim: true,
    },

    streetAddress: {
      type: String,
      default: "",
      trim: true,
    },

    location: {
      type: String,
      default: "",
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    latitude: {
      type: Number,
      default: null,
    },

    longitude: {
      type: Number,
      default: null,
    },

    status: {
      type: String,
      default: "reported",
      trim: true,
    },

    aiStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      trim: true,
      index: true,
    },

    isPublic: {
      type: Boolean,
      default: false,
      index: true,
    },

    forceApproved: {
      type: Boolean,
      default: false,
      index: true,
    },

    approvedByMDRRMO: {
      type: Boolean,
      default: false,
      index: true,
    },

    aiReview: {
      status: { type: String, default: "", trim: true },
      score: { type: Number, default: null },
      reason: { type: String, default: "", trim: true },
      labels: { type: [String], default: [] },
      reviewedAt: { type: Date, default: null },
    },

    image: {
      type: incidentImageSchema,
      default: () => ({
        fileName: "",
        fileUrl: "",
        public_id: "",
      }),
    },

    images: {
      type: [incidentImageSchema],
      default: [],
    },

    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      index: { expires: 0 },
    },

    usernames: {
      type: String,
      default: "",
      trim: true,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
    },

    reporterUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

incidentSchema.index({ status: 1, createdAt: -1 });
incidentSchema.index({ status: 1, barangay: 1, type: 1, createdAt: -1 });
incidentSchema.index({ status: 1, type: 1, createdAt: -1, latitude: 1, longitude: 1 });
incidentSchema.index({ isPublic: 1, aiStatus: 1, forceApproved: 1, createdAt: -1 });

const IncidentModel = mongoose.model("Incident", incidentSchema);

module.exports = IncidentModel;
