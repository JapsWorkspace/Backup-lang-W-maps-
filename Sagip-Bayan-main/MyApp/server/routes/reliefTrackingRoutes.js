const express = require('express');
const router = express.Router();
const controller = require('../controllers/reliefTrackingController');

router.get('/', controller.getReliefTracking);

module.exports = router;