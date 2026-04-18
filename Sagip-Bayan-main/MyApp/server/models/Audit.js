const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema({
  barangayId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Barangay',
    required: true
  },

  barangayName: String,
  category: String,
  peopleRange: String,
  status: String, 
  actionBy: String, 

  actionAt: {
    type: Date,
    default: Date.now
  }
});

const AuditModel = mongoose.model('Audit', auditSchema);
module.exports = AuditModel;