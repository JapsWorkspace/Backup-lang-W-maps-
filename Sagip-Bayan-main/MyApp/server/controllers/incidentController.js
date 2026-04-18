const IncidentModel = require("../models/Incident");
const HistoryModel = require("../models/History");
const cloudinary = require("../config/cloudinary");

// ✅ Get all incidents
const getIncidents = async (req, res) => {
  try {
    const incidents = await IncidentModel.find().sort({ createdAt: -1 });
    res.json(incidents);
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
    
  }
};

// ✅ Register Incident (WITH IMAGE SUPPORT)
const registerIncident = async (req, res) => {
  try {
    if (!req.body) req.body = {};

    let imageData = null;

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { folder: "evacuation_app/incidents" },
          (err, result) => {
            if (err) return reject(err);
            resolve(result);
          }
        ).end(req.file.buffer);
      });

      imageData = {
        fileName: req.file.originalname,
        fileUrl: result.secure_url,
        public_id: result.public_id, // 🔥 important for delete later
      };
    }

    const newIncident = new IncidentModel({
      type: req.body.type || "",
      level: req.body.level || "",
      location: req.body.location || "",
      description: req.body.description || "",
      latitude: req.body.latitude ? Number(req.body.latitude) : null,
      longitude: req.body.longitude ? Number(req.body.longitude) : null,
      image: imageData,
      usernames: req.body.usernames || null,
      phone: req.body.phone || null,
      status: "reported" // ✅ default status
    });

    const incident = await newIncident.save();

    console.log("Incident registered:", incident);

    // Save to history
    await HistoryModel.create({
      action: "ADD",
      placeName: incident.location,
      details: incident.description,
    });

    return res.status(201).json({
      message: "Incident created successfully",
      incident,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ✅ Update status
const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const updatedIncident = await IncidentModel.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!updatedIncident) {
      return res.status(404).json({ message: "Incident not found" });
    }

    // Save to history
    await HistoryModel.create({
      action: "STATUS_UPDATE",
      placeName: updatedIncident.location,
      details: `Updated to ${status}`,
    });

    res.json(updatedIncident);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update status" });
  }
};

// ✅ Delete incident
const deleteIncident = async (req, res) => {
  try {
    const deleted = await IncidentModel.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Incident not found" });
    }

    // Save to history
    await HistoryModel.create({
      action: "DELETE",
      placeName: deleted.location,
      details: deleted.description,
    });

    res.json({ message: "Incident deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete incident" });
  }
};

// ✅ Analytics (STATUS COUNTS)
const getIncidentStats = async (req, res) => {
  try {
    const stats = await IncidentModel.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    let result = {
      reported: 0,
      onProcess: 0,
      resolved: 0,
      total: 0
    };

    stats.forEach(item => {
      if (item._id === "reported" || item._id === "" || item._id === null) {
        result.reported += item.count;
      } else if (item._id === "onProcess") {
        result.onProcess = item.count;
      } else if (item._id === "resolved") {
        result.resolved = item.count;
      }
    });

    // Calculate total after summing all statuses
    result.total = result.reported + result.onProcess + result.resolved;

    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};
// Get count of incidents per type
const getIncidentTypeStats = async (req, res) => {
  try {
    const stats = await IncidentModel.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 }
        }
      }
    ]);

    // Format as key-value object
    const result = {};
    stats.forEach(item => {
      result[item._id || "Unknown"] = item.count;
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch type stats" });
  }
};

const getTrend = async (req, res) => {
  try {
    const data = await IncidentModel.aggregate([
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d", //"%Y-%m-%d"
              date: "$createdAt",
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



module.exports = {
  getIncidents,
  registerIncident,
  updateStatus,
  deleteIncident,
  getIncidentStats,
  getIncidentTypeStats,
  getTrend
};