const ReliefRequest = require('../models/ReliefRequest');
const Audit = require('../models/Audit');

/* GET PENDING RELIEF REQUESTS */
const getPendingRequests = async (req, res) => {
  try {
    const requests = await ReliefRequest.find({
      status: 'pending',
      isArchived: false
    }).sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error('Get Pending Requests Error:', err);
    res.status(500).json({ message: err.message });
  }
};

/* APPROVE OR REJECT REQUEST */
const updateReliefStatus = async (req, res) => {
  try {
    const username = req.session?.username || req.session?.userId || '';
    const { action, remarks } = req.body;

    const request = await ReliefRequest.findById(req.params.requestId);
    if (!request || request.isArchived) {
      return res.status(404).json({ message: 'Relief request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        message: 'Only pending requests can be updated here.'
      });
    }

    if (action === 'accept') {
      request.status = 'approved';
      request.approvedBy = String(username);
      request.approvedAt = new Date();

      if (remarks) {
        request.remarks = String(remarks).trim();
      }

      await request.save();

      await Audit.create({
        barangayId: request.barangayId,
        barangayName: request.barangayName,
        category: 'relief_request',
        peopleRange: `Food packs requested: ${request.totals.requestedFoodPacks}`,
        status: 'approved',
        actionBy: 'drrmo'
      });

      return res.json({
        message: 'Relief request approved successfully.',
        request
      });
    }

    if (action === 'cancel' || action === 'reject') {
      request.status = 'rejected';
      request.rejectedBy = String(username);
      request.rejectedAt = new Date();
      request.rejectionReason = remarks ? String(remarks).trim() : '';

      await request.save();

      await Audit.create({
        barangayId: request.barangayId,
        barangayName: request.barangayName,
        category: 'relief_request',
        peopleRange: `Food packs requested: ${request.totals.requestedFoodPacks}`,
        status: 'rejected',
        actionBy: 'drrmo'
      });

      return res.json({
        message: 'Relief request rejected successfully.',
        request
      });
    }

    return res.status(400).json({
      message: 'Invalid action. Use accept or reject.'
    });
  } catch (err) {
    console.error('Update Relief Status Error:', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getPendingRequests,
  updateReliefStatus
};