const HistoryModel = require("../models/History");

/* =========================
   GET HISTORY (BY PLACE / CONNECTION)
========================= */

const getHistory = async (req, res) => {
  try {
    const { placeName } = req.params;

    if (!placeName) {
      return res.status(400).json({
        message: "placeName is required to fetch history"
      });
    }

    const histories = await HistoryModel.find({ placeName })
      .sort({ createdAt: -1 });

    res.json(histories);
  } catch (err) {
    console.error("Get history error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/* =========================
   REGISTER HISTORY
========================= */

const registerHistory = async (req, res) => {
  try {
    const { action, placeName, details } = req.body;

    if (!action || !placeName) {
      return res.status(400).json({
        message: "action and placeName are required"
      });
    }

    const newHistory = new HistoryModel({
      action,
      placeName,
      details
    });

    const savedHistory = await newHistory.save();
    res.json(savedHistory);
  } catch (err) {
    console.error("Register history error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  getHistory,
  registerHistory
};