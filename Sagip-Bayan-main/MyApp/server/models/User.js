const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    connectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Connection",
      default: null,
    },

    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    actorName: {
      type: String,
      default: "",
      trim: true,
    },

    actorUsername: {
      type: String,
      default: "",
      trim: true,
    },

    actorAvatar: {
      type: String,
      default: "",
      trim: true,
    },

    connectionCode: {
      type: String,
      default: "",
      trim: true,
    },

    actionable: {
      type: Boolean,
      default: false,
    },

    handledAt: {
      type: Date,
      default: null,
    },

    read: {
      type: Boolean,
      default: false,
    },

    dedupeKey: {
      type: String,
      default: "",
      trim: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const locationSchema = new mongoose.Schema(
  {
    lat: {
      type: Number,
      default: null,
    },
    lng: {
      type: Number,
      default: null,
    },
    updatedAt: {
      type: Date,
      default: null,
    },
    share: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "",
    },

    fname: {
      type: String,
      trim: true,
      default: "",
    },

    lname: {
      type: String,
      trim: true,
      default: "",
    },

    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      lowercase: true,
    },

    dateOfBirth: {
      type: Date,
      default: null,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    phoneNumber: {
      type: String,
      trim: true,
      default: "",
    },

    address: {
      type: String,
      trim: true,
      default: "",
    },

    district: {
      type: String,
      trim: true,
      default: "",
    },

    barangay: {
      type: String,
      trim: true,
      default: "",
    },

    street: {
      type: String,
      trim: true,
      default: "",
    },

    streetAddress: {
      type: String,
      trim: true,
      default: "",
    },

    location: {
      type: locationSchema,
      default: () => ({
        lat: null,
        lng: null,
        updatedAt: null,
        share: true,
      }),
    },

    connections: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Connection",
      },
    ],

    notifications: {
      type: [notificationSchema],
      default: [],
    },

    safetyStatus: {
      type: String,
      enum: ["SAFE", "NOT_SAFE", "UNKNOWN"],
      default: "UNKNOWN",
    },

    safetyMessage: {
      type: String,
      default: "",
      trim: true,
    },

    safetyUpdatedAt: {
      type: Date,
      default: null,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    verificationToken: {
      type: String,
      default: "",
    },

    verificationTokenExpires: {
      type: Date,
      default: null,
    },

    otp: {
      type: String,
      default: "",
    },

    otpExpires: {
      type: Date,
      default: null,
    },

    isArchived: {
      type: Boolean,
      default: false,
    },

    archivedAt: {
      type: Date,
      default: null,
    },

    avatar: {
      type: String,
      default: "",
      trim: true,
    },

    avatarPublicId: {
      type: String,
      default: "",
      trim: true,
    },

    deleteAfter: {
      type: Date,
      default: null,
    },

    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },

    notificationTokens: {
      type: [
        {
          token: { type: String, required: true, trim: true },
          platform: { type: String, default: "", trim: true },
          deviceId: { type: String, default: "", trim: true },
          updatedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

userSchema.index({ barangay: 1, isArchived: 1 });
userSchema.index({ "notifications.dedupeKey": 1 });

const UserModel = mongoose.model("User", userSchema);

module.exports = UserModel;
