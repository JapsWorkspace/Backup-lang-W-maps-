const mongoose = require('mongoose');
const ReliefRequest = require('../models/ReliefRequest');
const ReliefRelease = require('../models/ReliefRelease');
const InventoryItem = require('../models/InventoryItem');
const InventoryLog = require('../models/InventoryLog');
const Audit = require('../models/Audit');
const BarangayStock = require('../models/BarangayStock');
const BarangayStockTransaction = require('../models/BarangayStockTransaction');

const normalizeString = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const generateReleaseNo = async (session = null) => {
  const year = new Date().getFullYear();
  const prefix = `RL-${year}`;

  const latest = await ReliefRelease.findOne({
    releaseNo: { $regex: `^${prefix}-` }
  })
    .sort({ createdAt: -1 })
    .session(session);

  let nextNumber = 1;

  if (latest?.releaseNo) {
    const parts = latest.releaseNo.split('-');
    const lastSeq = Number(parts[2]);
    if (!Number.isNaN(lastSeq)) {
      nextNumber = lastSeq + 1;
    }
  }

  return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
};

const validateReleaseItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return 'At least one release item is required.';
  }

  for (const item of items) {
    const itemName = normalizeString(item.itemName);
    const category = normalizeString(item.category).toLowerCase();
    const quantityReleased = toNumber(item.quantityReleased);
    const unit = normalizeString(item.unit);

    if (!itemName) {
      return 'Each release item must have an item name.';
    }

    if (!category) {
      return `Category is required for item "${itemName}".`;
    }

    if (quantityReleased <= 0) {
      return `Quantity released must be greater than 0 for item "${itemName}".`;
    }

    if (!unit) {
      return `Unit is required for item "${itemName}".`;
    }
  }

  return null;
};

/* GET REQUESTS READY FOR RELEASE */
const getApprovedRequestsForRelease = async (req, res) => {
  try {
    const requests = await ReliefRequest.find({
      status: { $in: ['approved', 'partially_released'] },
      isArchived: false
    }).sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error('Get Approved Requests For Release Error:', err);
    res.status(500).json({ message: err.message });
  }
};

/* CREATE RELEASE AND DEDUCT INVENTORY */
const createReliefRelease = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const username = String(req.session?.username || req.session?.userId || '');

    const { reliefRequestId, items, remarks } = req.body;

    if (!reliefRequestId) {
      return res.status(400).json({ message: 'Relief request ID is required.' });
    }

    const releaseItems = Array.isArray(items)
      ? items.map((item) => ({
          inventoryItemId: item.inventoryItemId || null,
          itemName: normalizeString(item.itemName),
          category: normalizeString(item.category).toLowerCase(),
          quantityReleased: toNumber(item.quantityReleased),
          unit: normalizeString(item.unit),
          remarks: normalizeString(item.remarks)
        }))
      : [];

    const validationError = validateReleaseItems(releaseItems);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    session.startTransaction();

    const reliefRequest = await ReliefRequest.findById(reliefRequestId).session(session);

    if (!reliefRequest || reliefRequest.isArchived) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Relief request not found.' });
    }

    if (!['approved', 'partially_released'].includes(reliefRequest.status)) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Only approved or partially released requests can be released.'
      });
    }

    const preparedItems = [];

    for (const item of releaseItems) {
      let inventoryDoc = null;

      if (item.inventoryItemId) {
        inventoryDoc = await InventoryItem.findById(item.inventoryItemId).session(session);
      }

      if (!inventoryDoc) {
        inventoryDoc = await InventoryItem.findOne({
          isArchive: false,
          type: 'goods',
          name: item.itemName,
          category: item.category,
          unit: item.unit
        }).session(session);
      }

      if (!inventoryDoc) {
        await session.abortTransaction();
        return res.status(404).json({
          message: `Inventory item not found for "${item.itemName}".`
        });
      }

      const availableQty = Number(inventoryDoc.quantity || 0);

      if (availableQty < item.quantityReleased) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Insufficient stock for "${item.itemName}". Available: ${availableQty}, requested release: ${item.quantityReleased}.`
        });
      }

      preparedItems.push({
        inventoryDoc,
        inventoryItemId: inventoryDoc._id,
        itemName: inventoryDoc.name,
        category: normalizeString(item.category).toLowerCase(),
        quantityReleased: Number(item.quantityReleased),
        unit: inventoryDoc.unit,
        remarks: item.remarks
      });
    }

    // 1) DEDUCT FROM DRRMO INVENTORY + LOG
    for (const item of preparedItems) {
      item.inventoryDoc.quantity =
        Number(item.inventoryDoc.quantity || 0) - item.quantityReleased;

      await item.inventoryDoc.save({ session });

      await InventoryLog.create(
        [
          {
            inventoryItem: item.inventoryDoc._id,
            itemName: item.inventoryDoc.name,
            itemType: item.inventoryDoc.type,
            action: 'release',
            quantity: item.quantityReleased,
            amount: undefined,
            performedBy: username,
            remarks: `Released for relief request ${reliefRequest.requestNo}`
          }
        ],
        { session }
      );
    }

    // 2) CREATE RELIEF RELEASE ONLY
    const releaseNo = await generateReleaseNo(session);

    const [reliefRelease] = await ReliefRelease.create(
      [
        {
          reliefRequestId: reliefRequest._id,
          barangayId: reliefRequest.barangayId,
          barangayName: reliefRequest.barangayName,
          releaseNo,
          items: preparedItems.map((item) => ({
            inventoryItemId: item.inventoryItemId,
            itemName: item.itemName,
            category: item.category,
            quantityReleased: item.quantityReleased,
            unit: item.unit,
            remarks: item.remarks
          })),
          releaseStatus: 'released',
          releasedBy: username,
          releasedAt: new Date(),
          receivedAt: null,
          remarks: normalizeString(remarks)
        }
      ],
      { session }
    );

    const totalReleased = preparedItems.reduce(
      (sum, item) => sum + Number(item.quantityReleased || 0),
      0
    );

    const requestedTotal = Number(reliefRequest.totals?.requestedFoodPacks || 0);

    if (requestedTotal > 0 && totalReleased < requestedTotal) {
      reliefRequest.status = 'partially_released';
    } else {
      reliefRequest.status = 'released';
    }

    reliefRequest.releasedBy = username;
    reliefRequest.releasedAt = new Date();

    await reliefRequest.save({ session });

    await Audit.create(
      [
        {
          barangayId: reliefRequest.barangayId,
          barangayName: reliefRequest.barangayName,
          category: 'relief_release',
          peopleRange: `Released total quantity: ${totalReleased}`,
          status: reliefRequest.status,
          actionBy: 'drrmo'
        }
      ],
      { session }
    );

    await session.commitTransaction();

    res.status(201).json({
      message: 'Relief goods released successfully.',
      release: reliefRelease,
      request: reliefRequest
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('Create Relief Release Error:', err);
    res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

/* BARANGAY CONFIRMS RECEIPT */
const receiveReliefRelease = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const username = String(req.session?.username || req.session?.userId || '');
    const role = String(req.session?.role || '');
    const releaseId = req.params.id;

    if (!releaseId) {
      return res.status(400).json({ message: 'Release ID is required.' });
    }

    session.startTransaction();

    const reliefRelease = await ReliefRelease.findById(releaseId).session(session);

    if (!reliefRelease || reliefRelease.isArchived) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Relief release not found.' });
    }

    if (reliefRelease.releaseStatus === 'received') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'This release has already been received.' });
    }

    if (reliefRelease.releaseStatus !== 'released') {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Only released items can be marked as received.'
      });
    }

    // Optional ownership check for barangay users
    if (role === 'barangay') {
      if (String(reliefRelease.barangayId) !== String(req.session.userId)) {
        await session.abortTransaction();
        return res.status(403).json({
          message: 'You can only receive releases assigned to your barangay.'
        });
      }
    }

    // 1) UPDATE RELEASE STATUS
    reliefRelease.releaseStatus = 'received';
    reliefRelease.receivedAt = new Date();

    await reliefRelease.save({ session });

    // 2) ADD TO BARANGAY STOCK + CREATE TRANSACTIONS
    for (const item of reliefRelease.items || []) {
      let stockDoc = await BarangayStock.findOne({
        barangayId: reliefRelease.barangayId,
        itemName: item.itemName,
        category: item.category,
        unit: item.unit,
        isArchived: false
      }).session(session);

      if (stockDoc) {
        stockDoc.quantityAvailable =
          Number(stockDoc.quantityAvailable || 0) + Number(item.quantityReleased || 0);
        stockDoc.lastUpdatedBy = username;
        await stockDoc.save({ session });
      } else {
        const createdStocks = await BarangayStock.create(
          [
            {
              barangayId: reliefRelease.barangayId,
              barangayName: reliefRelease.barangayName,
              itemName: item.itemName,
              category: item.category,
              unit: item.unit,
              quantityAvailable: Number(item.quantityReleased || 0),
              lastUpdatedBy: username
            }
          ],
          { session }
        );

        stockDoc = createdStocks[0];
      }

      await BarangayStockTransaction.create(
        [
          {
            barangayId: reliefRelease.barangayId,
            barangayName: reliefRelease.barangayName,
            stockId: stockDoc._id,
            itemName: item.itemName,
            category: item.category,
            unit: item.unit,
            quantity: Number(item.quantityReleased || 0),
            transactionType: 'release_in',
            reliefReleaseId: reliefRelease._id,
            remarks: `Received from DRRMO release ${reliefRelease.releaseNo}`,
            performedBy: username
          }
        ],
        { session }
      );
    }

    // 3) OPTIONAL AUDIT
    await Audit.create(
      [
        {
          barangayId: reliefRelease.barangayId,
          barangayName: reliefRelease.barangayName,
          category: 'relief_receive',
          peopleRange: `Received release ${reliefRelease.releaseNo}`,
          status: 'received',
          actionBy: role === 'barangay' ? username : 'barangay'
        }
      ],
      { session }
    );

    await session.commitTransaction();

    res.json({
      message: 'Relief goods received successfully.',
      release: reliefRelease
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('Receive Relief Release Error:', err);
    res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

/* GET RELEASES FOR A REQUEST */
const getReleasesByRequest = async (req, res) => {
  try {
    const releases = await ReliefRelease.find({
      reliefRequestId: req.params.reliefRequestId,
      isArchived: false
    }).sort({ createdAt: -1 });

    res.json(releases);
  } catch (err) {
    console.error('Get Releases By Request Error:', err);
    res.status(500).json({ message: err.message });
  }
};

/* GET ALL RELEASES */
const getAllReliefReleases = async (req, res) => {
  try {
    const releases = await ReliefRelease.find({
      isArchived: false
    }).sort({ createdAt: -1 });

    res.json(releases);
  } catch (err) {
    console.error('Get All Relief Releases Error:', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getApprovedRequestsForRelease,
  createReliefRelease,
  receiveReliefRelease,
  getReleasesByRequest,
  getAllReliefReleases
};
