const Donation = require("../models/Donation");
const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");

const VALID_STATUSES = ["pending", "accepted", "in_transit", "delivered", "rejected"];

function sanitizeText(value, max = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function toNumber(value, fallback = 0) {
  if (value === "" || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getRequestUserId(req) {
  return req.user?._id || req.session?.userId || req.body?.donorUserId || req.query?.userId || null;
}

function toObjectIdOrNull(value) {
  return mongoose.Types.ObjectId.isValid(String(value || "")) ? value : null;
}

async function uploadPhoto(file) {
  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder: "evacuation_app/donations" },
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

async function findMatchesForDonation() {
  return [];
}

async function createDonation(req, res) {
  try {
    const files = Array.isArray(req.files) ? req.files : req.files ? Object.values(req.files).flat() : [];
    const photos = await Promise.all(files.slice(0, 1).map(uploadPhoto));
    const amount = toNumber(req.body.amount, 0);
    const referenceNumber = sanitizeText(
      req.body.referenceNumber || req.body.gcashReferenceNumber || req.body.reference,
      120
    );

    if (amount <= 0) {
      return res.status(400).json({ message: "A valid GCash donation amount is required." });
    }

    if (!referenceNumber) {
      return res.status(400).json({ message: "GCash reference number is required." });
    }

    if (!photos.length) {
      return res.status(400).json({ message: "GCash receipt/screenshot proof is required." });
    }

    const donation = await Donation.create({
      donationType: "monetary",
      category: "money",
      itemName: "",
      quantity: 0,
      unit: "",
      description: sanitizeText(req.body.description, 1000) || "GCash monetary donation.",
      amount,
      paymentMethod: "GCash",
      referenceNumber,
      gcashReferenceNumber: referenceNumber,
      gcashSender: sanitizeText(req.body.gcashSender, 120),
      bankName: "",
      bankAccountNumber: "",
      transferReferenceNumber: "",
      cashInstructions: "",
      donorUserId: toObjectIdOrNull(getRequestUserId(req)),
      donorName: sanitizeText(req.body.donorName, 120),
      donorPhone: sanitizeText(req.body.donorPhone || req.body.phone, 40),
      donorEmail: sanitizeText(req.body.donorEmail || req.body.email, 120).toLowerCase(),
      contactInfo: sanitizeText(req.body.contactInfo, 240),
      fulfillmentMethod: "drop_off",
      location: "",
      barangay: "",
      latitude: null,
      longitude: null,
      photos,
      history: [
        {
          status: "pending",
          message: "Donation submitted for MDRRMO review.",
          createdAt: new Date(),
          actorId: toObjectIdOrNull(getRequestUserId(req)),
        },
      ],
    });

    res.status(201).json({ donation, matches: [] });
  } catch (err) {
    console.error("Create donation error:", err);
    res.status(500).json({ message: "Failed to submit donation.", error: err.message });
  }
}

async function getDonations(req, res) {
  try {
    const filter = {};
    filter.donationType = "monetary";
    filter.category = "money";
    if (req.query.status) filter.status = req.query.status;
    if (req.query.userId && toObjectIdOrNull(req.query.userId)) {
      filter.donorUserId = req.query.userId;
    }

    const donations = await Donation.find(filter)
      .populate("matchedNeedIds")
      .sort({ createdAt: -1 })
      .limit(Math.min(200, toNumber(req.query.limit, 100)));

    res.json(donations);
  } catch (err) {
    console.error("Get donations error:", err);
    res.status(500).json({ message: "Failed to fetch donations." });
  }
}

async function getMyDonations(req, res) {
  try {
    const userId = toObjectIdOrNull(req.params.userId);
    if (!userId) {
      return res.status(400).json({ message: "Valid userId is required." });
    }

    const donations = await Donation.find({ donorUserId: userId, donationType: "monetary" })
      .populate("matchedNeedIds")
      .sort({ createdAt: -1 })
      .limit(Math.min(200, toNumber(req.query.limit, 100)));

    res.json(donations);
  } catch (err) {
    console.error("Get my donations error:", err);
    res.status(500).json({ message: "Failed to fetch donation history." });
  }
}

async function getDonationById(req, res) {
  try {
    const donation = await Donation.findById(req.params.id).populate("matchedNeedIds");
    if (!donation) return res.status(404).json({ message: "Donation not found." });
    res.json(donation);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch donation." });
  }
}

async function updateDonationStatus(req, res) {
  try {
    const status = sanitizeText(req.body.status, 40);
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid donation status." });
    }

    const donation = await Donation.findById(req.params.id);
    if (!donation) return res.status(404).json({ message: "Donation not found." });

    donation.status = status;
    donation.adminNotes = sanitizeText(req.body.adminNotes ?? donation.adminNotes, 1000);
    donation.history.push({
      status,
      message: sanitizeText(req.body.message, 240) || `Donation marked as ${status}.`,
      createdAt: new Date(),
      actorId: toObjectIdOrNull(getRequestUserId(req)),
    });
    await donation.save();

    res.json(donation);
  } catch (err) {
    console.error("Update donation status error:", err);
    res.status(500).json({ message: "Failed to update donation status." });
  }
}

async function assignDonation(req, res) {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation) return res.status(404).json({ message: "Donation not found." });

    donation.assignment = {
      targetType: sanitizeText(req.body.targetType, 40) || "general",
      targetId: toObjectIdOrNull(req.body.targetId),
      targetName: sanitizeText(req.body.targetName, 160),
      assignedBy: toObjectIdOrNull(getRequestUserId(req)),
      assignedAt: new Date(),
      notes: sanitizeText(req.body.notes, 500),
    };

    donation.history.push({
      status: donation.status,
      message: `Assigned to ${donation.assignment.targetName || donation.assignment.targetType}.`,
      createdAt: new Date(),
      actorId: toObjectIdOrNull(getRequestUserId(req)),
    });

    await donation.save();
    res.json(donation);
  } catch (err) {
    console.error("Assign donation error:", err);
    res.status(500).json({ message: "Failed to assign donation." });
  }
}

async function getMatches(req, res) {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation) return res.status(404).json({ message: "Donation not found." });
    res.json(await findMatchesForDonation(donation));
  } catch (err) {
    res.status(500).json({ message: "Failed to match donation." });
  }
}

async function createNeed(req, res) {
  res.status(410).json({ message: "Donation needs are disabled for GCash-only donations." });
}

async function getNeeds(req, res) {
  res.json([]);
}

module.exports = {
  createDonation,
  getDonations,
  getMyDonations,
  getDonationById,
  updateDonationStatus,
  assignDonation,
  getMatches,
  createNeed,
  getNeeds,
};
