const express = require('express');
const { getAuditLogs } = require('../controllers/auditController.js');

const router = express.Router();

router.get('/', getAuditLogs);

module.exports = router;
