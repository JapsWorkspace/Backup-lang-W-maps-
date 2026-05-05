const Donation = require("../models/Donation");
require("../models/DonationNeed");

const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");

const VALID_STATUSES = [
  "pending",
  "accepted",
  "received",
  "not_received",
  "resubmitted",
  "in_transit",
  "delivered",
  "rejected",
];

function sanitizeText(value, max = 500) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function toNumber(value, fallback = 0) {
  if (value === "" || value === null || value === undefined) return fallback;

  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getRequestUserId(req) {
  return (
    req.user?._id ||
    req.session?.userId ||
    req.body?.donorUserId ||
    req.query?.userId ||
    null
  );
}

function toObjectIdOrNull(value) {
  return mongoose.Types.ObjectId.isValid(String(value || "")) ? value : null;
}

function normalizeStatus(value) {
  return sanitizeText(value, 40).toLowerCase();
}

function collectUploadedFiles(req) {
  return Array.isArray(req.files)
    ? req.files
    : req.files
    ? Object.values(req.files).flat()
    : [];
}

async function uploadPhoto(file) {
  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder: "evacuation_app/donations" },
        (err, uploadResult) => {
          if (err) return reject(err);
          resolve(uploadResult);
        }
      )
      .end(file.buffer);
  });

  return {
    fileName: file.originalname,
    fileUrl: result.secure_url,
    public_id: result.public_id,
  };
}

function normalizeDonationForResponse(donationDoc) {
  const donation = donationDoc?.toObject
    ? donationDoc.toObject({ virtuals: true })
    : { ...(donationDoc || {}) };

  donation.inventoryType = "monetary";
  donation.donationType = "monetary";
  donation.category = "money";
  donation.quantity = 0;
  donation.unit = "";
  donation.itemName = "";
  donation.condition = "";
  donation.usageDuration = "";
  donation.requiresExpiration = false;
  donation.expirationDate = null;

  return donation;
}

async function findMatchesForDonation() {
  return [];
}

async function createDonation(req, res) {
  try {
    const files = collectUploadedFiles(req);
    const photos = await Promise.all(files.slice(0, 4).map(uploadPhoto));

    const amount = toNumber(req.body.amount, 0);

    const referenceNumber = sanitizeText(
      req.body.referenceNumber ||
        req.body.gcashReferenceNumber ||
        req.body.reference,
      120
    );

    const donorName = sanitizeText(
      req.body.donorName || req.body.sourceName || req.body.name,
      120
    );

    const donorPhone = sanitizeText(
      req.body.donorPhone || req.body.phone,
      40
    );

    const donorEmail = sanitizeText(
      req.body.donorEmail || req.body.email,
      120
    ).toLowerCase();

    if (!donorName) {
      return res.status(400).json({
        message: "Donor name is required.",
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        message: "A valid GCash donation amount is required.",
      });
    }

    if (!referenceNumber) {
      return res.status(400).json({
        message: "GCash reference number is required.",
      });
    }

    if (!photos.length) {
      return res.status(400).json({
        message: "GCash receipt/screenshot proof is required.",
      });
    }

    const requestUserId = toObjectIdOrNull(getRequestUserId(req));

    const donation = await Donation.create({
      inventoryType: "monetary",
      donationType: "monetary",
      category: "money",

      itemName: "",
      quantity: 0,
      unit: "",

      description:
        sanitizeText(req.body.description, 1000) ||
        "GCash monetary donation.",

      amount,

      sourceType: "external",

      condition: "",
      usageDuration: "",
      expirationDate: null,
      requiresExpiration: false,

      paymentMethod: "gcash",
      referenceNumber,
      gcashReferenceNumber: referenceNumber,
      gcashSender: sanitizeText(req.body.gcashSender, 120),

      bankName: "",
      bankAccountNumber: "",
      transferReferenceNumber: "",
      cashInstructions: "",

      donorUserId: requestUserId,
      donorName,
      donorPhone,
      donorEmail,
      contactInfo: sanitizeText(
        req.body.contactInfo || donorPhone || donorEmail,
        240
      ),

      fulfillmentMethod: "drop_off",
      location: "",
      barangay: "",
      latitude: null,
      longitude: null,

      photos,

      status: "pending",

      history: [
        {
          status: "pending",
          message: "Donation submitted for MDRRMO review.",
          createdAt: new Date(),
          actorId: requestUserId,
        },
      ],
    });

    res.status(201).json({
      donation: normalizeDonationForResponse(donation),
      matches: [],
    });
  } catch (err) {
    console.error("Create donation error:", err);
    res.status(500).json({
      message: "Failed to submit donation.",
      error: err.message,
    });
  }
}

async function getDonations(req, res) {
  try {
    const filter = {
      donationType: "monetary",
      category: "money",
    };

    const status = normalizeStatus(req.query.status);
    if (status) {
      filter.status = status;
    }

    if (req.query.userId && toObjectIdOrNull(req.query.userId)) {
      filter.donorUserId = req.query.userId;
    }

    const donations = await Donation.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(200, toNumber(req.query.limit, 100)));

    res.json(donations.map(normalizeDonationForResponse));
  } catch (err) {
    console.error("Get donations error:", err);
    res.status(500).json({
      message: "Failed to fetch donations.",
    });
  }
}

async function getMyDonations(req, res) {
  try {
    const userId = toObjectIdOrNull(req.params.userId);

    if (!userId) {
      return res.status(400).json({
        message: "Valid userId is required.",
      });
    }

    const donations = await Donation.find({
      donorUserId: userId,
      donationType: "monetary",
    })
      .sort({ createdAt: -1 })
      .limit(Math.min(200, toNumber(req.query.limit, 100)));

    res.json(donations.map(normalizeDonationForResponse));
  } catch (err) {
    console.error("Get my donations error:", err);
    res.status(500).json({
      message: "Failed to fetch donation history.",
    });
  }
}

async function getDonationById(req, res) {
  try {
    const donation = await Donation.findById(req.params.id);

    if (!donation) {
      return res.status(404).json({
        message: "Donation not found.",
      });
    }

    res.json(normalizeDonationForResponse(donation));
  } catch (err) {
    console.error("Get donation by id error:", err);
    res.status(500).json({
      message: "Failed to fetch donation.",
    });
  }
}

async function updateDonationStatus(req, res) {
  try {
    const status = normalizeStatus(req.body.status);

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        message: "Invalid donation status.",
      });
    }

    const donation = await Donation.findById(req.params.id);

    if (!donation) {
      return res.status(404).json({
        message: "Donation not found.",
      });
    }

    donation.status = status;
    donation.adminNotes = sanitizeText(
      req.body.adminNotes ?? donation.adminNotes,
      1000
    );

    if (status === "received") {
      donation.receivedBy =
        sanitizeText(req.session?.username, 120) || "drrmo";
      donation.receivedAt = new Date();
      donation.notReceivedBy = "";
      donation.notReceivedAt = null;
    }

    if (status === "not_received") {
      donation.notReceivedBy =
        sanitizeText(req.session?.username, 120) || "drrmo";
      donation.notReceivedAt = new Date();
      donation.receivedBy = "";
      donation.receivedAt = null;
    }

    donation.history.push({
      status,
      message:
        sanitizeText(req.body.message, 240) ||
        `Donation marked as ${status}.`,
      createdAt: new Date(),
      actorId: toObjectIdOrNull(getRequestUserId(req)),
    });

    await donation.save();

    res.json(normalizeDonationForResponse(donation));
  } catch (err) {
    console.error("Update donation status error:", err);
    res.status(500).json({
      message: "Failed to update donation status.",
    });
  }
}

async function resubmitDonation(req, res) {
  try {
    const donation = await Donation.findById(req.params.id);

    if (!donation) {
      return res.status(404).json({
        message: "Donation not found.",
      });
    }

    if (normalizeStatus(donation.status) !== "not_received") {
      return res.status(400).json({
        message: "Only not received donations can be resubmitted.",
      });
    }

    const files = collectUploadedFiles(req);
    const photos = files.length
      ? await Promise.all(files.slice(0, 4).map(uploadPhoto))
      : donation.photos;

    const amount = toNumber(req.body.amount ?? donation.amount, 0);

    const referenceNumber = sanitizeText(
      req.body.referenceNumber ||
        req.body.gcashReferenceNumber ||
        req.body.reference ||
        donation.referenceNumber,
      120
    );

    const donorName = sanitizeText(
      req.body.donorName || donation.donorName,
      120
    );

    const donorPhone = sanitizeText(
      req.body.donorPhone || req.body.phone || donation.donorPhone,
      40
    );

    const donorEmail = sanitizeText(
      req.body.donorEmail || req.body.email || donation.donorEmail,
      120
    ).toLowerCase();

    if (!donorName) {
      return res.status(400).json({
        message: "Donor name is required.",
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        message: "A valid GCash donation amount is required.",
      });
    }

    if (!referenceNumber) {
      return res.status(400).json({
        message: "GCash reference number is required.",
      });
    }

    if (!photos?.length) {
      return res.status(400).json({
        message: "GCash receipt/screenshot proof is required.",
      });
    }

    const requestUserId =
      toObjectIdOrNull(getRequestUserId(req)) || donation.donorUserId || null;

    Object.assign(donation, {
      inventoryType: "monetary",
      donationType: "monetary",
      category: "money",

      itemName: "",
      quantity: 0,
      unit: "",

      description:
        sanitizeText(req.body.description, 1000) ||
        donation.description ||
        "GCash monetary donation.",

      amount,

      paymentMethod: "gcash",
      referenceNumber,
      gcashReferenceNumber: referenceNumber,

      donorUserId: requestUserId,
      donorName,
      donorPhone,
      donorEmail,
      contactInfo: sanitizeText(
        req.body.contactInfo || donorPhone || donorEmail,
        240
      ),

      fulfillmentMethod: "drop_off",
      location: "",
      barangay: "",
      latitude: null,
      longitude: null,

      photos,

      status: "resubmitted",
      wasResubmitted: true,
      resubmissionCount: Number(donation.resubmissionCount || 0) + 1,
      lastResubmittedAt: new Date(),

      notReceivedBy: "",
      notReceivedAt: null,
      receivedBy: "",
      receivedAt: null,
    });

    donation.history.push({
      status: "resubmitted",
      message:
        sanitizeText(req.body.message, 240) ||
        "Donation resubmitted for MDRRMO review.",
      createdAt: new Date(),
      actorId: requestUserId,
    });

    await donation.save();

    res.json({
      donation: normalizeDonationForResponse(donation),
      matches: [],
    });
  } catch (err) {
    console.error("Resubmit donation error:", err);
    res.status(500).json({
      message: "Failed to resubmit donation.",
    });
  }
}

async function assignDonation(req, res) {
  try {
    const donation = await Donation.findById(req.params.id);

    if (!donation) {
      return res.status(404).json({
        message: "Donation not found.",
      });
    }

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
      message: `Assigned to ${
        donation.assignment.targetName || donation.assignment.targetType
      }.`,
      createdAt: new Date(),
      actorId: toObjectIdOrNull(getRequestUserId(req)),
    });

    await donation.save();

    res.json(normalizeDonationForResponse(donation));
  } catch (err) {
    console.error("Assign donation error:", err);
    res.status(500).json({
      message: "Failed to assign donation.",
    });
  }
}

async function getMatches(req, res) {
  try {
    const donation = await Donation.findById(req.params.id);

    if (!donation) {
      return res.status(404).json({
        message: "Donation not found.",
      });
    }

    res.json(await findMatchesForDonation(donation));
  } catch (err) {
    console.error("Get matches error:", err);
    res.status(500).json({
      message: "Failed to match donation.",
    });
  }
}

async function createNeed(req, res) {
  res.status(410).json({
    message: "Donation needs are disabled for GCash-only donations.",
  });
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
  resubmitDonation,
  assignDonation,
  getMatches,
  createNeed,
  getNeeds,
};