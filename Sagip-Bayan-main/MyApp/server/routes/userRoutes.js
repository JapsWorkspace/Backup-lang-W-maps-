const express = require("express");
const router = express.Router();
const path = require("path");
const { uploadAvatar } = require("../middleware/upload");


// ✅ CONTROLLERS
const userController = require("../controllers/userController");

// ✅ MODEL
const UserModel = require("../models/User");

/* =========================
   USER ROUTES
========================= */

router.get("/users", userController.getUsers);
router.post("/register", userController.registerUser);
router.put("/update/:id", userController.updateUser);
router.post("/login", userController.loginUser);

router.put("/archive/:id", userController.archiveUser);
router.put("/restore/:id", userController.restoreUser);

router.get("/verify/:token", userController.verifyEmail);

router.post("/send-otp", userController.sendOtp);
router.post("/verify-otp", userController.verifyOtp);

// ✅ ✅ ✅ FIXED LOCATION ROUTE
router.put("/location/:id", userController.updateLocation);

router.put("/twofactor/:id", userController.toggleTwoFactor);

router.get("/:id", userController.getUserById);


router.put(
  "/avatar/:id",
  uploadAvatar.single("avatar"),
  userController.uploadAvatar
);

module.exports = router;