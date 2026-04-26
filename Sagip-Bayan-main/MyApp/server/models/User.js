const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  fname: String,
  lname: String,
  username: { type: String, unique: true },
  password: String,
  email: { type: String, unique: true },
  dateOfBirth: Date,
  phone: String,
  address: String,
  
  location: {
  lat: Number,
  lng: Number,
  updatedAt: Date,
  share: {
    type: Boolean,
    default: true
  }
},

    connections: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Connection"
  }],
  notifications: [
  {
    type: {
      type: String, // e.g. "KICKED"
      required: true,
    },

    message: {
      type: String,
      required: true,
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
    },

    actorUsername: {
      type: String,
      default: "",
    },

    actorAvatar: {
      type: String,
      default: "",
    },

    connectionCode: {
      type: String,
      default: "",
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

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
],


  safetyStatus: {
    type: String,
    enum: ["SAFE", "NOT_SAFE", "UNKNOWN"],
    default: "UNKNOWN"
  },

  safetyMessage: {
    type: String,
    default: ""
  },

  safetyUpdatedAt: {
    type: Date,
    default: null
  },

  isVerified: {
    type: Boolean,
    default: false,
  },

  verificationToken: String,
  verificationTokenExpires: Date,
  otp: String,
  otpExpires: Date,

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
  default: ""
  },
  avatarPublicId: String,

  deleteAfter: {
    type: Date,
    default: null,
  },
  twoFactorEnabled: { type: Boolean, default: false },
}, { timestamps: true });

const UserModel = mongoose.model("User", userSchema);

module.exports = UserModel;
