const mongoose = require("mongoose");

const donationPhotoSchema = new mongoose.Schema(
  {
    fileName: { type: String, default: "", trim: true },
    fileUrl: { type: String, default: "", trim: true },
    public_id: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const assignmentSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ["evacuation_center", "barangay", "general"],
      default: "general",
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    targetName: { type: String, default: "", trim: true },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserStaff",
      default: null,
    },
    assignedAt: { type: Date, default: null },
    notes: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const donationSchema = new mongoose.Schema(
  {
    donationType: {
      type: String,
      enum: ["monetary"],
      required: true,
      index: true,
      default: "monetary",
    },
    category: {
      type: String,
      enum: [
        "money",
        "clothes",
        "food",
        "appliances",
        "furniture",
        "medicine",
        "essentials",
        "other",
      ],
      default: "other",
      index: true,
    },
    itemName: { type: String, default: "", trim: true },
    quantity: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: "pcs", trim: true },
    description: { type: String, default: "", trim: true },
    amount: { type: Number, default: 0, min: 0 },
    paymentMethod: { type: String, default: "GCash", trim: true },
    referenceNumber: { type: String, default: "", trim: true },
    gcashReferenceNumber: { type: String, default: "", trim: true },
    gcashSender: { type: String, default: "", trim: true },
    bankName: { type: String, default: "", trim: true },
    bankAccountNumber: { type: String, default: "", trim: true },
    transferReferenceNumber: { type: String, default: "", trim: true },
    cashInstructions: { type: String, default: "", trim: true },
    donorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    donorName: { type: String, default: "", trim: true },
    donorPhone: { type: String, default: "", trim: true },
    donorEmail: { type: String, default: "", trim: true, lowercase: true },
    contactInfo: { type: String, default: "", trim: true },
    fulfillmentMethod: {
      type: String,
      enum: ["pickup", "drop_off"],
      default: "drop_off",
    },
    location: { type: String, default: "", trim: true, index: true },
    barangay: { type: String, default: "", trim: true, index: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    photos: { type: [donationPhotoSchema], default: [] },
    status: {
      type: String,
      enum: ["pending", "accepted", "in_transit", "delivered", "rejected"],
      default: "pending",
      index: true,
    },
    assignment: { type: assignmentSchema, default: () => ({}) },
    matchedNeedIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DonationNeed",
      },
    ],
    adminNotes: { type: String, default: "", trim: true },
    history: {
      type: [
        {
          status: String,
          message: String,
          createdAt: { type: Date, default: Date.now },
          actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

donationSchema.index({ donationType: 1, category: 1, status: 1, barangay: 1 });
donationSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Donation", donationSchema);
