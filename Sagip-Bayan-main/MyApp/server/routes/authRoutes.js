const express = require('express');
const authController = require('../controllers/authController');
const { requireAdmin } = require('../middleware/adminMiddleware');
const router = express.Router();

router.get('/init', authController.initAdmin);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/barangay-options', authController.getAvailableBarangays);

router.get('/all', requireAdmin, authController.getAllAccounts);          // admin list
router.put('/update/:id', requireAdmin, authController.updateAccount);   // update any account
router.put('/archive/:id', requireAdmin, authController.archiveAccount);
router.get('/archived', requireAdmin, authController.getArchivedAccounts);
router.put('/restore/:id', requireAdmin, authController.restoreAccount);
router.get('/admin/logs', requireAdmin, authController.getAdminLogs);

module.exports = router;
