const mongoose = require("mongoose");

const historySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["ADD", "STATUS_UPDATE", "DELETE"],
      required: true,
    },
    placeName: {
      type: String,
      required: false,
    },
    details: String,
  },
  { timestamps: true }
);

const HistoryModel = mongoose.model('History', historySchema);
module.exports = HistoryModel;
