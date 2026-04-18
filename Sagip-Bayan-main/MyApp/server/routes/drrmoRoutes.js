const express = require('express');
const router = express.Router();
const controller = require('../controllers/drrmoController');

router.get('/requests/pending', controller.getPendingRequests);
router.put('/requests/:requestId/status', controller.updateReliefStatus);

module.exports = router;