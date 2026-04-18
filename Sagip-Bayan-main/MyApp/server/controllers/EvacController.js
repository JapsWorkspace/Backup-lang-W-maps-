const mongoose = require("mongoose");
const Place = require("../models/EvacPlace.js");
const EHistory = require("../models/EvacHistory.js");
const BarangayStock = require("../models/BarangayStock");
const BarangayStockTransaction = require("../models/BarangayStockTransaction");

// Sanitize input
// Sanitize input
const sanitizeText = (value) => {
  return String(value || "").replace(/<[^>]*>?/gm, "").trim();
};

const toNumber = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
};

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value === "true" || value === "1";
  }
  return Boolean(value);
};

const buildHistoryMeta = (
  req,
  place = null,
  fallbackBarangayId = null,
  fallbackBarangayName = ""
) => {
  return {
    barangayId: place?.barangayId || fallbackBarangayId || req.session?.userId || null,
    barangayName:
      sanitizeText(place?.barangayName) ||
      sanitizeText(fallbackBarangayName) ||
      sanitizeText(req.session?.barangayName || req.session?.username),
    performedBy: sanitizeText(req.session?.username || "unknown"),
    performedByRole: sanitizeText(req.session?.role || ""),
  };
};

// CREATE PLACE
const createPlace = async (req, res) => {
  try {
    const {
      name,
      location,
      barangayId,
      barangayName,
      barangay,
      latitude,
      longitude,
      capacityIndividual,
      capacityFamily,
      bedCapacity,
      floorArea,
      femaleCR,
      maleCR,
      commonCR,
      potableWater,
      nonPotableWater,
      foodPackCapacity,
      isPermanent,
      isCovidFacility,
      remarks,
    } = req.body;

    const finalBarangayId =
      barangayId || (req.session?.role === "barangay" ? req.session.userId : null);

    const finalBarangayName =
      sanitizeText(barangayName) ||
      sanitizeText(barangay) ||
      (req.session?.role === "barangay"
        ? sanitizeText(req.session?.barangayName || req.session?.username)
        : "");

    if (
      !sanitizeText(name) ||
      !sanitizeText(location) ||
      !finalBarangayId ||
      !finalBarangayName ||
      latitude === undefined ||
      longitude === undefined ||
      capacityIndividual === undefined ||
      capacityFamily === undefined
    ) {
      return res.status(400).json({
        message:
          "Missing required fields: name, location, barangayId, barangayName, latitude, longitude, capacityIndividual, capacityFamily",
      });
    }

    // Convert numeric values
    const latNum = Number(latitude);
    const lngNum = Number(longitude);

    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return res.status(400).json({
        message: "Invalid coordinates",
      });
    }

    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({
        message: "Coordinates out of valid range",
      });
    }

    const newPlace = new Place({
      name: sanitizeText(name),
      location: sanitizeText(location),
      barangayId: finalBarangayId,
      barangayName: finalBarangayName,
      latitude: latNum,
      longitude: lngNum,
      capacityIndividual: toNumber(capacityIndividual, 0),
      capacityFamily: toNumber(capacityFamily, 0),
      bedCapacity: toNumber(bedCapacity, 0),
      floorArea: toNumber(floorArea, 0),
      femaleCR: toBoolean(femaleCR),
      maleCR: toBoolean(maleCR),
      commonCR: toBoolean(commonCR),
      potableWater: toBoolean(potableWater),
      nonPotableWater: toBoolean(nonPotableWater),
      foodPackCapacity: toNumber(foodPackCapacity, 0),
      isPermanent: toBoolean(isPermanent),
      isCovidFacility: toBoolean(isCovidFacility),
      remarks: sanitizeText(remarks),
      capacityStatus: "available",
    });

    await newPlace.save();

    await EHistory.create({
      action: "ADD",
      placeName: newPlace.name,
      details: `Added ${newPlace.name} in ${newPlace.barangayName} with individual capacity ${newPlace.capacityIndividual}`,
      ...buildHistoryMeta(req, newPlace, finalBarangayId, finalBarangayName),
    });

    res.status(201).json({
      message: "Place created successfully",
      place: newPlace,
    });
  } catch (error) {
    console.error("Create Place Error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        message: "An active evacuation place with the same name already exists in this barangay",
      });
    }

    res.status(500).json({ message: "Server error" });
  }
};

// GET ALL PLACES (ROLE-AWARE)
const getPlaces = async (req, res) => {
  try {
    const role = req.session?.role;
    const userId = req.session?.userId;
    const barangayName = sanitizeText(
      req.session?.barangayName || req.session?.username
    );

    let filter = { isArchived: false };

    if (role === "barangay") {
      filter.$or = [];

      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        filter.$or.push({ barangayId: userId });
      }

      if (barangayName) {
        filter.$or.push({ barangayName });
      }

      if (filter.$or.length === 0) {
        delete filter.$or;
      }
    }

    const places = await Place.find(filter).sort({ createdAt: -1 });
    res.json(places);
  } catch (err) {
    console.error("Get Places Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET HISTORY (ROLE-AWARE)
const getHistory = async (req, res) => {
  try {
    const role = req.session?.role;
    const userId = req.session?.userId;
    const barangayName = sanitizeText(
      req.session?.barangayName || req.session?.username
    );

    let filter = {};

    if (role === "barangay") {
      filter.$or = [];

      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        filter.$or.push({ barangayId: userId });
      }

      if (barangayName) {
        filter.$or.push({ barangayName });
      }

      if (filter.$or.length === 0) {
        delete filter.$or;
      }
    }

    const logs = await EHistory.find(filter).sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    console.error("Get History Error:", err);
    res.status(500).json({ message: "Failed to load history" });
  }
};

// UPDATE PLACE
const updatePlace = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await Place.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Place not found" });
    }

    const {
      name,
      location,
      barangayId,
      barangayName,
      barangay,
      latitude,
      longitude,
      capacityIndividual,
      capacityFamily,
      bedCapacity,
      floorArea,
      femaleCR,
      maleCR,
      commonCR,
      potableWater,
      nonPotableWater,
      foodPackCapacity,
      isPermanent,
      isCovidFacility,
      remarks,
    } = req.body;

    const finalBarangayName = sanitizeText(barangayName) || sanitizeText(barangay);

    existing.name = sanitizeText(name || existing.name);
    existing.location = sanitizeText(location || existing.location);

    if (barangayId) existing.barangayId = barangayId;
    if (finalBarangayName) existing.barangayName = finalBarangayName;

    if (latitude !== undefined) {
      const latNum = Number(latitude);
      if (Number.isNaN(latNum) || latNum < -90 || latNum > 90) {
        return res.status(400).json({ message: "Invalid latitude" });
      }
      existing.latitude = latNum;
    }

    if (longitude !== undefined) {
      const lngNum = Number(longitude);
      if (Number.isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
        return res.status(400).json({ message: "Invalid longitude" });
      }
      existing.longitude = lngNum;
    }

    if (capacityIndividual !== undefined) existing.capacityIndividual = toNumber(capacityIndividual, 0);
    if (capacityFamily !== undefined) existing.capacityFamily = toNumber(capacityFamily, 0);
    if (bedCapacity !== undefined) existing.bedCapacity = toNumber(bedCapacity, 0);
    if (floorArea !== undefined) existing.floorArea = toNumber(floorArea, 0);
    if (foodPackCapacity !== undefined) existing.foodPackCapacity = toNumber(foodPackCapacity, 0);

    if (femaleCR !== undefined) existing.femaleCR = toBoolean(femaleCR);
    if (maleCR !== undefined) existing.maleCR = toBoolean(maleCR);
    if (commonCR !== undefined) existing.commonCR = toBoolean(commonCR);
    if (potableWater !== undefined) existing.potableWater = toBoolean(potableWater);
    if (nonPotableWater !== undefined) existing.nonPotableWater = toBoolean(nonPotableWater);
    if (isPermanent !== undefined) existing.isPermanent = toBoolean(isPermanent);
    if (isCovidFacility !== undefined) existing.isCovidFacility = toBoolean(isCovidFacility);
    if (remarks !== undefined) existing.remarks = sanitizeText(remarks);

    await existing.save();

    await EHistory.create({
      action: "UPDATE",
      placeName: existing.name,
      details: `Updated details for ${existing.name}`,
      ...buildHistoryMeta(req, existing),
    });

    res.json({
      message: "Place updated successfully",
      place: existing,
    });
  } catch (err) {
    console.error("Update Place Error:", err);

    if (err.code === 11000) {
      return res.status(400).json({
        message: "An active evacuation place with the same name already exists in this barangay",
      });
    }

    res.status(500).json({ message: "Update failed" });
  }
};

// UPDATE CAPACITY STATUS
const updateCapacityStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { capacityStatus } = req.body;

    if (!["available", "limited", "full"].includes(capacityStatus)) {
      return res.status(400).json({ message: "Invalid capacity status" });
    }
    const updated = await Place.findByIdAndUpdate(
      id,
      {
        capacityStatus,

        femaleCR: Boolean(femaleCR),
        maleCR: Boolean(maleCR),
        commonCR: Boolean(commonCR),
        potableWater: Boolean(potableWater),
        nonPotableWater: Boolean(nonPotableWater),

        isPermanent: Boolean(isPermanent),
        isCovidFacility: Boolean(isCovidFacility),
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Place not found" });
    }

    await EHistory.create({
      action: "STATUS_UPDATE",
      placeName: updated.name,
      details: `Status changed to ${capacityStatus}`,
      ...buildHistoryMeta(req, updated),
    });

    res.json(updated);
  } catch (err) {
    console.error("Update Capacity Status Error:", err);
    res.status(500).json({ message: "Update failed" });
  }
};

// DELETE PLACE
const deletePlace = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Place.findByIdAndUpdate(
      id,
      {
        isArchived: true,
        archivedAt: new Date(),
      },
      { new: true }
    );

    if (!deleted) {
      return res.status(404).json({ message: "Place not found" });
    }

    await EHistory.create({
      action: "DELETE",
      placeName: deleted.name,
      details: "Place archived",
      ...buildHistoryMeta(req, deleted),
    });

    res.json({ message: "Place archived successfully" });
  } catch (err) {
    console.error("Delete Place Error:", err);
    res.status(500).json({ message: "Delete failed" });
  }
};

// ANALYTICS SUMMARY
const getAnalyticsSummary = async (req, res) => {
  try {
    const role = req.session?.role;
    const userId = req.session?.userId;
    const barangayName = sanitizeText(
      req.session?.barangayName || req.session?.username
    );

    let filter = { isArchived: false };

    if (role === "barangay") {
      filter.$or = [];

      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        filter.$or.push({ barangayId: userId });
      }

      if (barangayName) {
        filter.$or.push({ barangayName });
      }

      if (filter.$or.length === 0) {
        delete filter.$or;
      }
    }

    const places = await Place.find(filter);

    const totalPlaces = places.length;

    const statusCounts = places.reduce(
      (acc, p) => {
        const status = p.capacityStatus || "available";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { available: 0, limited: 0, full: 0 }
    );

    const totalIndividualCapacity = places.reduce(
      (sum, p) => sum + (p.capacityIndividual || 0),
      0
    );

    const totalFamilyCapacity = places.reduce(
      (sum, p) => sum + (p.capacityFamily || 0),
      0
    );

    const totalBedCapacity = places.reduce(
      (sum, p) => sum + (p.bedCapacity || 0),
      0
    );

    const permanentCount = places.filter((p) => p.isPermanent).length;
    const covidFacilities = places.filter((p) => p.isCovidFacility).length;

    res.json({
      totalPlaces,
      statusCounts,
      totalIndividualCapacity,
      totalFamilyCapacity,
      totalBedCapacity,
      permanentCount,
      covidFacilities,
    });
  } catch (error) {
    console.error("Get Analytics Summary Error:", error);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
};

// ALLOCATE STOCK TO EVAC PLACE
const allocateStockToPlace = async (req, res) => {
  try {
    const role = req.session?.role;

    if (role !== "barangay") {
      return res.status(403).json({
        message: "Only barangay accounts can allocate stock to evacuation places",
      });
    }

    const { id } = req.params;
    const { stockId, quantity } = req.body;
    const username = req.session?.username || "unknown";

    if (!stockId || !quantity) {
      return res.status(400).json({
        message: "Stock ID and quantity are required",
      });
    }

    const qty = Number(quantity);
    if (qty <= 0) {
      return res.status(400).json({
        message: "Quantity must be greater than 0",
      });
    }

    const place = await Place.findById(id);
    if (!place) {
      return res.status(404).json({ message: "Evac place not found" });
    }

    const stock = await BarangayStock.findById(stockId);
    if (!stock) {
      return res.status(404).json({ message: "Stock not found" });
    }

    // extra security: barangay can only allocate from its own stock
    const sessionBarangayId = req.session?.userId;
    if (sessionBarangayId && String(stock.barangayId) !== String(sessionBarangayId)) {
      return res.status(403).json({
        message: "You can only allocate stock from your own barangay storage",
      });
    }

    if (String(stock.barangayId) !== String(place.barangayId)) {
      return res.status(403).json({
        message: "Stock and evac place do not belong to the same barangay",
      });
    }

    if (stock.quantityAvailable < qty) {
      return res.status(400).json({
        message: `Insufficient stock. Available: ${stock.quantityAvailable}`,
      });
    }

    stock.quantityAvailable -= qty;
    stock.lastUpdatedBy = username;
    await stock.save();

    await BarangayStockTransaction.create({
      barangayId: stock.barangayId,
      barangayName: stock.barangayName,
      stockId: stock._id,
      itemName: stock.itemName,
      category: stock.category,
      unit: stock.unit,
      quantity: qty,
      transactionType: "allocation",
      evacPlaceId: place._id,
      evacPlaceName: place.name,
      remarks: `Allocated to evac place: ${place.name}`,
      performedBy: username,
    });

    await EHistory.create({
      action: "ALLOCATE",
      placeName: place.name,
      details: `Allocated ${qty} ${stock.unit || ""} of ${stock.itemName} to ${place.name}`,
      ...buildHistoryMeta(req, place),
    });

    res.json({
      message: "Stock allocated to evacuation place successfully",
    });
  } catch (err) {
    console.error("Allocate Stock Error:", err);
    res.status(500).json({ message: "Allocation failed" });
  }
};

module.exports = {
  createPlace,
  getPlaces,
  getHistory,
  updatePlace,
  updateCapacityStatus,
  deletePlace,
  getAnalyticsSummary,
  allocateStockToPlace,
};
