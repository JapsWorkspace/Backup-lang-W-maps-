const Barangay = require("../models/Barangay");
const ReliefRequest = require("../models/ReliefRequest");
const Audit = require("../models/Audit");
const sendReliefRequestEmail = require("../utils/sendReliefRequestEmail");

const generateRequestNo = async () => {
  const year = new Date().getFullYear();
  const prefix = `RR-${year}`;

  const latest = await ReliefRequest.findOne({
    requestNo: { $regex: `^${prefix}-` },
  }).sort({ createdAt: -1 });

  let nextNumber = 1;

  if (latest?.requestNo) {
    const parts = latest.requestNo.split("-");
    const lastSeq = Number(parts[2]);
    if (!Number.isNaN(lastSeq)) {
      nextNumber = lastSeq + 1;
    }
  }

  return `${prefix}-${String(nextNumber).padStart(4, "0")}`;
};

const sanitizeRow = (row = {}) => ({
  evacPlaceId: row.evacPlaceId || null,
  evacuationCenterName: String(row.evacuationCenterName || "").trim(),
  households: Number(row.households || 0),
  families: Number(row.families || 0),
  male: Number(row.male || 0),
  female: Number(row.female || 0),
  lgbtq: Number(row.lgbtq || 0),
  pwd: Number(row.pwd || 0),
  pregnant: Number(row.pregnant || 0),
  senior: Number(row.senior || 0),
  requestedFoodPacks: Number(row.requestedFoodPacks || 0),
});

const isNonNegativeNumber = (value) =>
  typeof value === "number" && !Number.isNaN(value) && value >= 0;

const validateRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return "At least one evacuation center row is required.";
  }

  for (const row of rows) {
    if (!row.evacuationCenterName) {
      return "Each row must have an evacuation center name.";
    }

    const numberFields = [
      "households",
      "families",
      "male",
      "female",
      "lgbtq",
      "pwd",
      "pregnant",
      "senior",
      "requestedFoodPacks",
    ];

    for (const field of numberFields) {
      if (!isNonNegativeNumber(row[field])) {
        return `Invalid value for ${field} in one of the rows.`;
      }
    }
  }

  return null;
};

/* BARANGAY SUBMIT RELIEF REQUEST */
const submitReliefRequest = async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const barangay = await Barangay.findById(req.session.userId);
    if (!barangay) {
      return res.status(404).json({ message: "Barangay not found" });
    }

    const disaster = String(req.body.disaster || "").trim();
    const remarks = String(req.body.remarks || "").trim();
    const requestDate = req.body.requestDate
      ? new Date(req.body.requestDate)
      : new Date();

    const rows = Array.isArray(req.body.rows)
      ? req.body.rows.map(sanitizeRow)
      : [];

    if (!disaster) {
      return res.status(400).json({ message: "Disaster is required." });
    }

    if (Number.isNaN(requestDate.getTime())) {
      return res.status(400).json({ message: "Invalid request date." });
    }

    const rowsError = validateRows(rows);
    if (rowsError) {
      return res.status(400).json({ message: rowsError });
    }

    const hasPendingRequest = await ReliefRequest.findOne({
      barangayId: barangay._id,
      status: { $in: ["pending", "approved", "partially_released", "released"] },
      isArchived: false,
    });

    if (hasPendingRequest) {
      return res.status(400).json({
        message: "You still have an active relief request.",
      });
    }

    const requestNo = await generateRequestNo();

    const reliefRequest = await ReliefRequest.create({
      requestNo,
      barangayId: barangay._id,
      barangayName: barangay.barangayName,
      disaster,
      requestDate,
      rows,
      remarks,
      status: "pending",
    });

    await Audit.create({
      barangayId: barangay._id,
      barangayName: barangay.barangayName,
      category: "relief_request",
      peopleRange: `Food packs requested: ${reliefRequest.totals.requestedFoodPacks}`,
      status: "requested",
      actionBy: "barangay",
    });

    let emailSent = false;

    try {
      await sendReliefRequestEmail(reliefRequest);
      emailSent = true;
    } catch (emailErr) {
      console.error("Relief request email failed:", emailErr);
    }

    const latestRequest = await ReliefRequest.findById(reliefRequest._id);

    res.status(201).json({
      message: emailSent
        ? "Relief request submitted successfully and email with PDF sent to DRRMO."
        : "Relief request submitted successfully, but email/PDF notification failed.",
      request: latestRequest || reliefRequest,
    });
  } catch (err) {
    console.error("Submit Relief Request Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* GET LOGGED-IN BARANGAY RELIEF REQUESTS */
const getMyReliefRequests = async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const requests = await ReliefRequest.find({
      barangayId: req.session.userId,
      isArchived: false,
    }).sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error("Get My Relief Requests Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* GET SINGLE BARANGAY RELIEF REQUEST */
const getMyReliefRequestById = async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const request = await ReliefRequest.findOne({
      _id: req.params.id,
      barangayId: req.session.userId,
      isArchived: false,
    });

    if (!request) {
      return res.status(404).json({ message: "Relief request not found" });
    }

    res.json(request);
  } catch (err) {
    console.error("Get My Relief Request By Id Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* BARANGAY UPDATE OWN REQUEST */
const updateOwnReliefRequest = async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const request = await ReliefRequest.findOne({
      _id: req.params.id,
      barangayId: req.session.userId,
      isArchived: false,
    });

    if (!request) {
      return res.status(404).json({ message: "Relief request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        message: "Only pending requests can be edited.",
      });
    }

    const disaster = String(req.body.disaster || "").trim();
    const remarks = String(req.body.remarks || "").trim();
    const requestDate = req.body.requestDate
      ? new Date(req.body.requestDate)
      : request.requestDate;

    const rows = Array.isArray(req.body.rows)
      ? req.body.rows.map(sanitizeRow)
      : [];

    if (!disaster) {
      return res.status(400).json({ message: "Disaster is required." });
    }

    if (Number.isNaN(requestDate.getTime())) {
      return res.status(400).json({ message: "Invalid request date." });
    }

    const rowsError = validateRows(rows);
    if (rowsError) {
      return res.status(400).json({ message: rowsError });
    }

    request.disaster = disaster;
    request.requestDate = requestDate;
    request.rows = rows;
    request.remarks = remarks;

    await request.save();

    await Audit.create({
      barangayId: request.barangayId,
      barangayName: request.barangayName,
      category: "relief_request",
      peopleRange: `Updated food packs requested: ${request.totals.requestedFoodPacks}`,
      status: "updated",
      actionBy: "barangay",
    });

    res.json({
      message: "Relief request updated successfully.",
      request,
    });
  } catch (err) {
    console.error("Update Own Relief Request Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* BARANGAY CANCEL OWN REQUEST */
const cancelOwnReliefRequest = async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const request = await ReliefRequest.findOne({
      _id: req.params.id,
      barangayId: req.session.userId,
      isArchived: false,
    });

    if (!request) {
      return res.status(404).json({ message: "Relief request not found" });
    }

    if (!["pending", "approved"].includes(request.status)) {
      return res.status(400).json({
        message: "Only pending or approved requests can be cancelled.",
      });
    }

    request.status = "cancelled";
    request.remarks = req.body.remarks
      ? String(req.body.remarks).trim()
      : request.remarks;

    await request.save();

    await Audit.create({
      barangayId: request.barangayId,
      barangayName: request.barangayName,
      category: "relief_request",
      peopleRange: `Food packs requested: ${request.totals.requestedFoodPacks}`,
      status: "cancelled",
      actionBy: "barangay",
    });

    res.json({
      message: "Relief request cancelled successfully.",
      request,
    });
  } catch (err) {
    console.error("Cancel Own Relief Request Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* BARANGAY MARK REQUEST AS RECEIVED */
const markReliefRequestReceived = async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const request = await ReliefRequest.findOne({
      _id: req.params.id,
      barangayId: req.session.userId,
      isArchived: false,
    });

    if (!request) {
      return res.status(404).json({ message: "Relief request not found" });
    }

    if (!["released", "partially_released"].includes(request.status)) {
      return res.status(400).json({
        message: "Only released requests can be marked as received.",
      });
    }

    request.status = "received";
    request.receivedAt = new Date();

    await request.save();

    await Audit.create({
      barangayId: request.barangayId,
      barangayName: request.barangayName,
      category: "relief_request",
      peopleRange: `Food packs requested: ${request.totals.requestedFoodPacks}`,
      status: "received",
      actionBy: "barangay",
    });

    res.json({
      message: "Relief request marked as received.",
      request,
    });
  } catch (err) {
    console.error("Mark Relief Request Received Error:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  submitReliefRequest,
  getMyReliefRequests,
  getMyReliefRequestById,
  updateOwnReliefRequest,
  cancelOwnReliefRequest,
  markReliefRequestReceived,
};