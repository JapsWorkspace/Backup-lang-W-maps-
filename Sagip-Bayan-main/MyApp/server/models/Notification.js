const mongoose = require("mongoose");

const notificationUserActionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    role: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false, strict: false }
);

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      default: "system",
      trim: true,
      lowercase: true,
      index: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    module: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ["normal", "high"],
      default: "normal",
      trim: true,
      lowercase: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      index: true,
    },
    referenceModel: {
      type: String,
      default: "",
      trim: true,
    },
    recipientUser: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      index: true,
    },
    recipientUserModel: {
      type: String,
      enum: ["UserStaff", "Barangay", null],
      default: null,
      trim: true,
    },
    recipientRole: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      index: true,
    },
    recipientBarangay: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    senderUser: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    senderRole: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    senderName: {
      type: String,
      default: "",
      trim: true,
    },
    link: {
      type: String,
      default: "",
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    readBy: {
      type: [notificationUserActionSchema],
      default: [],
    },
    archivedBy: {
      type: [notificationUserActionSchema],
      default: [],
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    strict: false,
    collection: "notifications",
  }
);

notificationSchema.index({ recipientUser: 1, recipientRole: 1, createdAt: -1 });

module.exports =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);
