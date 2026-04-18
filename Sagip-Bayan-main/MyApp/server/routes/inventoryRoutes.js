const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { uploadProof } = require('../middleware/upload');
const { requireLogin, requireAdminOrDrrmo } = require('../middleware/adminMiddleware');


router.get('/categories', inventoryController.getInventoryCategories);
// =========================
// ANALYTICS
// =========================
router.get('/analytics/summary', inventoryController.getInventorySummary);
router.get('/analytics/category-stats', inventoryController.getInventoryCategoryStats);
router.get('/analytics/source-stats', inventoryController.getInventorySourceStats);
router.get('/analytics/recent-trend', inventoryController.getInventoryRecentTrend);


// =========================
// INVENTORY CRUD
// =========================

// Add new inventory item
router.post(
  '/',
  uploadProof.array('proofFiles', 5),
  inventoryController.addInventory
);

// Get all active inventory items
router.get('/', requireAdminOrDrrmo, inventoryController.getInventory);

// Get archived inventory items
router.get('/archived', requireAdminOrDrrmo, inventoryController.getArchivedInventory);

// Unarchive inventory item
router.put('/archived/:id/restore', requireAdminOrDrrmo, inventoryController.unarchiveInventory);

// Permanent delete archived inventory item
router.delete('/archived/:id/permanent', requireAdminOrDrrmo, inventoryController.permanentDeleteInventory);


// Update inventory item
router.put(
  '/:id',
  uploadProof.array('proofFiles', 5),
  inventoryController.updateInventory
);

// Archive inventory item
router.delete('/:id', inventoryController.deleteInventory);

module.exports = router;
