const express = require('express');
const router = express.Router();
const controller = require('../controllers/reliefRequestController');

router.post('/', controller.submitReliefRequest);
router.get('/mine', controller.getMyReliefRequests);
router.get('/mine/:id', controller.getMyReliefRequestById);
router.put('/:id', controller.updateOwnReliefRequest);
router.put('/:id/cancel', controller.cancelOwnReliefRequest);
router.put('/:id/received', controller.markReliefRequestReceived);

module.exports = router;
