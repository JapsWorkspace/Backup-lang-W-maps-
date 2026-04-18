const Audit = require('../models/Audit.js');

const getAuditLogs = async (req, res) => {
  try {
    const logs = await Audit.find().sort({ actionAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load audit logs' });
  }
};
module.exports = {getAuditLogs};