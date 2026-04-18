const express = require('express');
const router = express.Router();
const controller = require('../controllers/barangayController');

router.get('/me', controller.getMe);
router.get('/', controller.getBarangays);

module.exports = router;