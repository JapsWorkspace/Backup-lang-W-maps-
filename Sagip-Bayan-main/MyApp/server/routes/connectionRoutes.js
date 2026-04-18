const express = require("express");
const router = express.Router();

const connectionController = require("../controllers/connectionController");

/* =========================
   CONNECTION MANAGEMENT
========================= */

router.post("/create/:id", connectionController.createConnection);
router.post("/join/:id", connectionController.joinConnection);

/* =========================
   FETCH CONNECTION DATA
========================= */


/* =========================
   FETCH CONNECTION DATA
========================= */

router.get("/members/:id", connectionController.getConnectionMembers);
router.get("/user/:id", connectionController.getUserConnections);
router.get("/:connectionId", connectionController.getConnectionById);

/* =========================
   SAFETY STATUS
========================= */

router.get("/:connectionId", connectionController.getConnectionById);

/* =========================
   SAFETY STATUS
========================= */

router.put("/safe/:id", connectionController.markSafe);
router.put("/not-safe/:id", connectionController.markNotSafe);

/* =========================
   APPROVAL FLOW
========================= */

// ✅ Creator approves a pending member
router.put(
  "/approve/:connectionId/:memberId/:userId",
  connectionController.approveMember
);

// ✅ Creator rejects a pending member
router.put(
  "/reject/:connectionId/:memberId/:userId",
  connectionController.rejectMember
);

/* =========================
   LEAVE / DELETE CONNECTION
========================= */

// ✅ MEMBER leaves a connection (creator is BLOCKED inside controller)
router.delete(
  "/leave/:userId/:connectionId",
  connectionController.leaveConnection
);

// ✅ CREATOR deletes the entire connection
router.delete(
  "/delete/:connectionId/:userId",
  connectionController.deleteConnection
);

// ✅ CREATOR kicks an existing member
router.put(
  "/kick/:connectionId/:memberId/:userId",
  connectionController.kickMember
);

module.exports = router;
