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
  },
  { timestamps: true }
);

incidentSchema.index({ status: 1, createdAt: -1 });
incidentSchema.index({ status: 1, barangay: 1, type: 1, createdAt: -1 });
incidentSchema.index({ status: 1, type: 1, createdAt: -1, latitude: 1, longitude: 1 });

const IncidentModel = mongoose.model("Incident", incidentSchema);

module.exports = IncidentModel;
