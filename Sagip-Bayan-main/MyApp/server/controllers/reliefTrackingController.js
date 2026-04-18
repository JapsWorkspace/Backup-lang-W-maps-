const ReliefRequest = require('../models/ReliefRequest');
const ReliefRelease = require('../models/ReliefRelease');
const Barangay = require('../models/Barangay');
const User = require('../models/User');

async function getReliefTracking(req, res) {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: 'Not logged in' });
    }

    const user = await User.findById(req.session.userId);
    const isDRRMO = user?.role === 'drrmo';

    /* ================= DRRMO VIEW ================= */
    if (isDRRMO) {
      const requests = await ReliefRequest.find({
        isArchived: false
      }).sort({ createdAt: -1 });

      return res.json(requests);
    }

    /* ================= BARANGAY VIEW ================= */
    const barangay = await Barangay.findById(req.session.userId);
    if (!barangay) {
      return res.status(404).json({ message: 'Barangay not found' });
    }

    const requests = await ReliefRequest.find({
      barangayId: barangay._id,
      isArchived: false
    }).sort({ createdAt: -1 });

    const requestIds = requests.map((r) => r._id);

    const releases = await ReliefRelease.find({
      reliefRequestId: { $in: requestIds },
      isArchived: false
    }).sort({ createdAt: -1 });

    res.json({
      rows: requests,
      releases
    });
  } catch (err) {
    console.error('Get Relief Tracking Error:', err);
    res.status(500).json({ message: err.message });
  }
}

const updateReliefRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await ReliefRequest.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.json({
      message: 'Relief request updated successfully',
      request: updated
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
module.exports = { getReliefTracking, updateReliefRequest };