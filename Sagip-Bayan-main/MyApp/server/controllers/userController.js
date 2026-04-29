const UserModel = require("../models/User");
const crypto = require("crypto");
const sendVerificationEmail = require("../utils/sendVerificationEmail");
const sendOTP = require("../utils/sendOTP");
const cloudinary = require("../config/cloudinary");
const bcrypt = require("bcryptjs");

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeText(value, max = 120) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function sanitizeUsername(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 30);
}

function sanitizePhone(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .replace(/^63/, "")
    .replace(/^0+/, "")
    .slice(0, 10);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function buildFullAddress({ district, barangay, street }) {
  return [street, barangay, district, "Jaen, Nueva Ecija"].filter(Boolean).join(", ");
}

/* =========================
   REGISTER
========================= */
const registerUser = async (req, res) => {
  try {
    const {
      fname,
      lname,
      username,
      password,
      email,
      phone,
      barangay,
      street,
      streetAddress,
      address,
    } = req.body || {};

    if (!fname || !lname || !username || !password || !email || !phone) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const cleanEmail = normalizeEmail(email);
    const cleanUsername = sanitizeUsername(username);
    const cleanPhone = sanitizePhone(phone);
    const cleanBarangay = sanitizeText(barangay, 80);
    const cleanStreet = sanitizeText(street || streetAddress, 160);
    const cleanAddress =
      buildFullAddress({
        district: "",
        barangay: cleanBarangay,
        street: cleanStreet,
      }) || sanitizeText(address, 220);

    const existingEmailUser = await UserModel.findOne({ email: cleanEmail });
    if (existingEmailUser) {
      return res.status(400).json({
        error: "EMAIL_EXISTS",
        message: "Email already exists",
      });
    }

    const existingUsernameUser = await UserModel.findOne({
      username: { $regex: new RegExp(`^${escapeRegex(cleanUsername)}$`, "i") },
    });

    if (existingUsernameUser) {
      return res.status(400).json({
        error: "USERNAME_EXISTS",
        message: "Username already exists",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters",
      });
    }

    if (cleanPhone.length !== 10) {
      return res.status(400).json({
        error: "Phone number must contain exactly 10 digits",
      });
    }

    if (!cleanBarangay) {
      return res.status(400).json({
        error: "Barangay is required",
      });
    }

    if (!cleanStreet) {
      return res.status(400).json({
        error: "Street / address details are required",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const newUser = new UserModel({
      ...req.body,
      fname: sanitizeText(fname, 60),
      lname: sanitizeText(lname, 60),
      username: cleanUsername,
      email: cleanEmail,
      phone: cleanPhone,
      phoneNumber: cleanPhone,
      barangay: cleanBarangay,
      street: cleanStreet,
      streetAddress: cleanStreet,
      address: cleanAddress,
      password: hashedPassword,
      isVerified: false,
      verificationToken,
      verificationTokenExpires: Date.now() + 24 * 60 * 60 * 1000,
    });

    const user = await newUser.save();

    const baseUrl = process.env.BASE_URL || "http://localhost:8000";
    const verificationLink = `${baseUrl}/user/verify/${verificationToken}`;

    let emailSent = false;

    try {
      await sendVerificationEmail(user.email, verificationLink, user.fname);
      emailSent = true;
    } catch (emailErr) {
      console.error("Verification email failed:", emailErr);
    }

    return res.status(201).json({
      message: emailSent
        ? "Registration successful. Please verify your email."
        : "Registration successful, but verification email could not be sent yet.",
      emailSent,
      userId: user._id,
    });
  } catch (err) {
    console.error("REGISTER USER ERROR:", err);

    if (err?.code === 11000) {
      const duplicateField = Object.keys(err.keyPattern || {})[0];

      if (duplicateField === "email") {
        return res.status(400).json({
          error: "EMAIL_EXISTS",
          message: "Email already exists",
        });
      }

      if (duplicateField === "username") {
        return res.status(400).json({
          error: "USERNAME_EXISTS",
          message: "Username already exists",
        });
      }

      return res.status(400).json({
        error: "DUPLICATE_FIELD",
        message: "A unique field already exists",
      });
    }

    return res.status(500).json({ error: "Registration failed" });
  }
};

/* =========================
   VERIFY EMAIL
========================= */
const verifyEmail = (req, res) => {
  const { token } = req.params;

  UserModel.findOne({
    verificationToken: token,
    verificationTokenExpires: { $gt: Date.now() },
  })
    .then((user) => {
      if (!user) {
        return res.status(400).send("Invalid or expired verification link");
      }

      user.isVerified = true;
      user.verificationToken = undefined;
      user.verificationTokenExpires = undefined;
      return user.save();
    })
    .then(() => {
      res.send("Email verified successfully. You can now log in.");
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send("Verification error");
    });
};

/* =========================
   USERS
========================= */
const getUsers = (req, res) => {
  UserModel.find()
    .then((users) => res.json(users))
    .catch((err) => {
      console.log(err);
      res.status(500).json({ error: "Internal Server Error" });
    });
};

/* =========================
   LOGIN
========================= */
const loginUser = async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }

  try {
    const normalizedUsername = String(username).trim();
    const user =
      (await UserModel.findOne({ username: normalizedUsername })) ||
      (await UserModel.findOne({
        username: { $regex: new RegExp(`^${escapeRegex(normalizedUsername)}$`, "i") },
      }));

    if (!user) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    if (user.isArchived) {
      user.isArchived = false;
      user.archivedAt = null;
      user.deleteAfter = null;
    }

    if (user.twoFactorEnabled) {
      await user.save();
      return res.json({
        twoFactor: true,
        userId: user._id,
        email: user.email,
        restored: true,
      });
    }

    await user.save();

    res.json({
      twoFactor: false,
      user,
      restored: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   UPDATE USER
========================= */
const updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const body = req.body || {};

    const existingUser = await UserModel.findById(userId);
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const updateData = {};

    if (body.fname !== undefined) {
      updateData.fname = sanitizeText(body.fname, 60);
    }

    if (body.lname !== undefined) {
      updateData.lname = sanitizeText(body.lname, 60);
    }

    if (body.username !== undefined) {
      const cleanUsername = sanitizeUsername(body.username);
      if (!cleanUsername) {
        return res.status(400).json({ message: "Invalid username." });
      }

      const usernameOwner = await UserModel.findOne({
        _id: { $ne: userId },
        username: { $regex: new RegExp(`^${escapeRegex(cleanUsername)}$`, "i") },
      });

      if (usernameOwner) {
        return res.status(400).json({ message: "Username is already taken." });
      }

      updateData.username = cleanUsername;
    }

    if (body.email !== undefined) {
      const cleanEmail = normalizeEmail(body.email);
      if (!cleanEmail) {
        return res.status(400).json({ message: "Invalid email." });
      }

      const emailOwner = await UserModel.findOne({
        _id: { $ne: userId },
        email: cleanEmail,
      });

      if (emailOwner) {
        return res.status(400).json({ message: "Email is already in use." });
      }

      updateData.email = cleanEmail;
    }

    if (body.phone !== undefined || body.phoneNumber !== undefined) {
      const rawPhone = body.phoneNumber ?? body.phone;
      const cleanPhone = sanitizePhone(rawPhone);

      if (rawPhone && cleanPhone.length !== 10) {
        return res.status(400).json({
          message: "Phone number must contain exactly 10 digits.",
        });
      }

      updateData.phone = cleanPhone;
      updateData.phoneNumber = cleanPhone;
    }

    const district =
      body.district !== undefined
        ? sanitizeText(body.district, 80)
        : existingUser.district || "";

    const barangay =
      body.barangay !== undefined
        ? sanitizeText(body.barangay, 80)
        : existingUser.barangay || "";

    const street =
      body.street !== undefined
        ? sanitizeText(body.street, 160)
        : body.streetAddress !== undefined
          ? sanitizeText(body.streetAddress, 160)
          : existingUser.street || existingUser.streetAddress || "";

    if (body.district !== undefined) updateData.district = district;
    if (body.barangay !== undefined) updateData.barangay = barangay;
    if (body.street !== undefined || body.streetAddress !== undefined) {
      updateData.street = street;
      updateData.streetAddress = street;
    }

    if (
      body.address !== undefined ||
      body.district !== undefined ||
      body.barangay !== undefined ||
      body.street !== undefined ||
      body.streetAddress !== undefined
    ) {
      updateData.address = buildFullAddress({
        district,
        barangay,
        street,
      });
    }

    if (body.password) {
      if (String(body.password).length < 8) {
        return res.status(400).json({
          message: "Password must be at least 8 characters.",
        });
      }
      updateData.password = await bcrypt.hash(body.password, 10);
    }

    const user = await UserModel.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    const {
      password,
      otp,
      otpExpires,
      verificationToken,
      verificationTokenExpires,
      ...safeUser
    } = user.toObject();

    return res.json(safeUser);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/* =========================
   UPDATE LOCATION
========================= */
const updateLocation = async (req, res) => {
  try {
    const userId = req.params.id;
    const { lat, lng } = req.body;
    console.log("📍 Location update:", userId, lat, lng);

    if (!userId) {
      return res.status(400).json({ message: "Missing user id" });
    }

    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({
        message: "Latitude and longitude must be numbers",
      });
    }

    await UserModel.findByIdAndUpdate(
      userId,
      {
        location: {
          lat,
          lng,
          updatedAt: new Date(),
          share: true,
        },
      },
      { new: true }
    );

    res.json({ message: "Location updated successfully" });
  } catch (err) {
    console.error("Update location error:", err);
    res.status(500).json({ message: "Failed to update location" });
  }
};

/* =========================
   OTP
========================= */
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const sendOtp = (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  UserModel.findOne({ email })
    .then((user) => {
      if (!user) {
        return Promise.reject({ status: 404, message: "Email not found" });
      }

      const otp = generateOTP();
      user.otp = otp;
      user.otpExpires = Date.now() + 5 * 60 * 1000;
      return user.save().then(() => sendOTP(email, otp));
    })
    .then(() => {
      res.json({ message: "OTP sent successfully" });
    })
    .catch((err) => {
      console.error(err);
      res.status(err.status || 500).json({
        message: err.message || "Server error",
      });
    });
};

const verifyOtp = (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  UserModel.findOne({ email })
    .then((user) => {
      if (!user) throw { status: 404, message: "User not found" };
      if (user.otp !== otp) throw { status: 400, message: "Invalid OTP" };
      if (user.otpExpires < Date.now()) throw { status: 400, message: "OTP expired" };

      user.otp = null;
      user.otpExpires = null;
      return user.save();
    })
    .then(() => {
      res.json({ message: "OTP verified" });
    })
    .catch((error) => {
      console.error(error);
      if (error.status && error.message) {
        return res.status(error.status).json({ message: error.message });
      }
      res.status(500).json({ message: "Server error" });
    });
};

const verifyEmailForReset = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await UserModel.findOne({ email }).select(
      "_id email fname lname username"
    );

    if (!user) {
      return res.status(404).json({ exists: false, message: "Email not found" });
    }

    return res.json({
      exists: true,
      user,
    });
  } catch (err) {
    console.error("Verify reset email error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   ARCHIVE / RESTORE / TWO FACTOR
========================= */
const archiveUser = (req, res) => {
  const userId = req.params.id;
  const deleteAfter = new Date();
  deleteAfter.setMonth(deleteAfter.getMonth() + 6);

  UserModel.findByIdAndUpdate(
    userId,
    {
      isArchived: true,
      archivedAt: new Date(),
      deleteAfter,
    },
    { new: true }
  )
    .then((user) => {
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({
        message:
          "Your account has been archived. It will be permanently deleted after 6 months.",
      });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    });
};

const restoreUser = (req, res) => {
  const userId = req.params.id;

  UserModel.findByIdAndUpdate(
    userId,
    {
      isArchived: false,
      archivedAt: null,
      deleteAfter: null,
    },
    { new: true }
  )
    .then((user) => {
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ message: "Account restored successfully" });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    });
};

const toggleTwoFactor = (req, res) => {
  const { id } = req.params;
  const { enabled } = req.body;

  if (typeof enabled !== "boolean") {
    return res.status(400).json({ message: "enabled must be true or false" });
  }

  UserModel.findByIdAndUpdate(
    id,
    { twoFactorEnabled: enabled },
    { new: true }
  )
    .then((user) => {
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({
        message: `Two-Factor Authentication ${enabled ? "enabled" : "disabled"}`,
        twoFactorEnabled: user.twoFactorEnabled,
      });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    });
};

const getUserById = async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id)
      .select("-password -otp -otpExpires");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const getUserNotifications = async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id).select("notifications");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const notifications = Array.isArray(user.notifications)
      ? [...user.notifications].sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        )
      : [];

    return res.json(notifications);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

const markNotificationsRead = async (req, res) => {
  try {
    const user = await UserModel.findByIdAndUpdate(
      req.params.id,
      { $set: { "notifications.$[].read": true } },
      { new: true }
    ).select("notifications");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ message: "Notifications marked as read." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

const clearNotifications = async (req, res) => {
  try {
    const user = await UserModel.findByIdAndUpdate(
      req.params.id,
      { $set: { notifications: [] } },
      { new: true }
    ).select("_id");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ message: "Notifications cleared." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const existingUser = await UserModel.findById(req.params.id);

    if (existingUser?.avatarPublicId) {
      await cloudinary.uploader.destroy(existingUser.avatarPublicId);
    }

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: "evacuation_app/avatars" },
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      ).end(req.file.buffer);
    });

    const user = await UserModel.findByIdAndUpdate(
      req.params.id,
      {
        avatar: result.secure_url,
        avatarPublicId: result.public_id,
      },
      { new: true }
    );

    res.json({
      avatar: result.secure_url,
      user,
    });
  } catch (err) {
    console.error("AVATAR UPLOAD ERROR:", err);
    res.status(500).json({ message: "Avatar upload failed" });
  }
};

const registerNotificationToken = async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const platform = String(req.body?.platform || "").trim();
    const deviceId = String(req.body?.deviceId || "").trim();

    if (!token) {
      return res.status(400).json({ message: "Notification token is required." });
    }

    const user = await UserModel.findByIdAndUpdate(
      req.params.id,
      { $pull: { notificationTokens: { token } } },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    user.notificationTokens.push({
      token,
      platform,
      deviceId,
      updatedAt: new Date(),
    });
    await user.save();

    return res.json({
      ok: true,
      message: "Notification token registered",
      tokenCount: user.notificationTokens.length,
    });
  } catch (err) {
    console.error("Register notification token error:", err);
    return res.status(500).json({ message: "Failed to register notification token." });
  }
};

module.exports = {
  registerUser,
  verifyEmail,
  getUsers,
  updateUser,
  verifyEmailForReset,
  sendOtp,
  verifyOtp,
  archiveUser,
  restoreUser,
  toggleTwoFactor,
  loginUser,
  updateLocation,
  getUserById,
  uploadAvatar,
  getUserNotifications,
  markNotificationsRead,
  clearNotifications,
  registerNotificationToken,
};
