const Donation = require("../models/Donation");
const DonationNeed = require("../models/DonationNeed");
const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");

const VALID_STATUSES = ["pending", "accepted", "in_transit", "delivered", "rejected"];
const URGENCY_SCORE = { critical: 4, high: 3, medium: 2, low: 1 };

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

async function findMatchesForDonation(donation) {
  if (donation.donationType !== "non_monetary") return [];

  const filter = {
    isActive: true,
    category: donation.category,
  };

  const needs = await DonationNeed.find(filter);
  return needs
    .map((need) => {
      const sameBarangay =
        donation.barangay &&
        need.barangay &&
        donation.barangay.toLowerCase() === need.barangay.toLowerCase();
      const nameHit =
        donation.itemName &&
        need.itemName &&
        need.itemName.toLowerCase().includes(donation.itemName.toLowerCase());
      const score =
        (URGENCY_SCORE[need.urgency] || 0) * 10 +
        (sameBarangay ? 8 : 0) +
        (nameHit ? 4 : 0) +
        Math.min(5, need.remainingQuantity || 0);

      return { need, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ need, score }) => ({ ...need.toObject({ virtuals: true }), matchScore: score }));
}

async function createDonation(req, res) {
  try {
    const donationType = sanitizeText(req.body.donationType || req.body.type, 40);
    const normalizedType =
      donationType === "monetary" ? "monetary" : donationType === "non_monetary" ? "non_monetary" : "";

    if (!normalizedType) {
      return res.status(400).json({ message: "donationType must be monetary or non_monetary." });
    }

    const files = Array.isArray(req.files) ? req.files : req.files ? Object.values(req.files).flat() : [];
    const photos = await Promise.all(files.slice(0, 4).map(uploadPhoto));

    const amount = toNumber(req.body.amount, 0);
    const quantity = toNumber(req.body.quantity, 0);

    if (normalizedType === "monetary" && amount <= 0) {
      return res.status(400).json({ message: "Amount is required for monetary donations." });
    }

    if (normalizedType === "non_monetary" && quantity <= 0) {
      return res.status(400).json({ message: "Quantity is required for non-monetary donations." });
    }

    const donation = await Donation.create({
      donationType: normalizedType,
      category: normalizedType === "monetary" ? "money" : sanitizeText(req.body.category, 40) || "other",
      itemName: sanitizeText(req.body.itemName || req.body.name, 120),
      quantity,
      unit: sanitizeText(req.body.unit, 30) || "pcs",
      description: sanitizeText(req.body.description, 1000),
      amount,
      paymentMethod: sanitizeText(req.body.paymentMethod || req.body.method, 80),
      referenceNumber: sanitizeText(req.body.referenceNumber || req.body.reference, 120),
      gcashReferenceNumber: sanitizeText(req.body.gcashReferenceNumber, 120),
      gcashSender: sanitizeText(req.body.gcashSender, 120),
      bankName: sanitizeText(req.body.bankName, 120),
      bankAccountNumber: sanitizeText(req.body.bankAccountNumber, 120),
      transferReferenceNumber: sanitizeText(req.body.transferReferenceNumber, 120),
      cashInstructions: sanitizeText(req.body.cashInstructions, 500),
      donorUserId: toObjectIdOrNull(getRequestUserId(req)),
      donorName: sanitizeText(req.body.donorName, 120),
      donorPhone: sanitizeText(req.body.donorPhone || req.body.phone, 40),
      donorEmail: sanitizeText(req.body.donorEmail || req.body.email, 120).toLowerCase(),
      contactInfo: sanitizeText(req.body.contactInfo, 240),
      fulfillmentMethod:
        sanitizeText(req.body.fulfillmentMethod, 40) === "pickup" ? "pickup" : "drop_off",
      location: sanitizeText(req.body.location, 240),
      barangay: sanitizeText(req.body.barangay, 100),
      latitude: req.body.latitude ? toNumber(req.body.latitude, null) : null,
      longitude: req.body.longitude ? toNumber(req.body.longitude, null) : null,
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

    const matches = await findMatchesForDonation(donation);
    if (matches.length) {
      donation.matchedNeedIds = matches.map((need) => need._id);
      await donation.save();
    }

    res.status(201).json({ donation, matches });
  } catch (err) {
    console.error("Create donation error:", err);
    res.status(500).json({ message: "Failed to submit donation.", error: err.message });
  }
}

async function getDonations(req, res) {
  try {
    const filter = {};
    if (req.query.type) filter.donationType = req.query.type;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.location) filter.location = new RegExp(sanitizeText(req.query.location, 120), "i");
    if (req.query.barangay) filter.barangay = new RegExp(`^${sanitizeText(req.query.barangay, 100)}$`, "i");
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

    const donations = await Donation.find({ donorUserId: userId })
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
  try {
    const need = await DonationNeed.create({
      category: sanitizeText(req.body.category, 40),
      itemName: sanitizeText(req.body.itemName, 120),
      quantityNeeded: toNumber(req.body.quantityNeeded, 0),
      quantityFulfilled: toNumber(req.body.quantityFulfilled, 0),
      urgency: sanitizeText(req.body.urgency, 40) || "medium",
      targetType: sanitizeText(req.body.targetType, 40),
      targetId: toObjectIdOrNull(req.body.targetId),
      targetName: sanitizeText(req.body.targetName, 160),
      barangay: sanitizeText(req.body.barangay, 100),
      description: sanitizeText(req.body.description, 1000),
      isActive: req.body.isActive !== false,
    });

    res.status(201).json(need);
  } catch (err) {
    res.status(400).json({ message: "Failed to create donation need.", error: err.message });
  }
}

async function getNeeds(req, res) {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.barangay) filter.barangay = new RegExp(`^${sanitizeText(req.query.barangay, 100)}$`, "i");
  if (req.query.active !== "false") filter.isActive = true;

  const needs = await DonationNeed.find(filter).sort({ urgency: -1, createdAt: -1 });
  res.json(needs);
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
