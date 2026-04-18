const multer = require("multer");
const path = require("path");
const fs = require("fs");

// =======================
// ✅ Proof uploads (still local)
// =======================
const proofDir = path.join(__dirname, "../uploads/proofs");
if (!fs.existsSync(proofDir)) fs.mkdirSync(proofDir, { recursive: true });

const proofStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, proofDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const proofFileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|pdf/;
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowed.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only images and PDF files are allowed for proofs"), false);
  }
};

// =======================
// ✅ Guideline uploads (Cloudinary-ready)
// =======================
const uploadGuideline = multer({
  storage: multer.memoryStorage(), // ✅ REQUIRED for Cloudinary
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image")) {
      return cb(new Error("Only image files are allowed"), false);
    }
    cb(null, true);
  },
});

// =======================
// ✅ Proof uploader
// =======================
const uploadProof = multer({
  storage: proofStorage,
  fileFilter: proofFileFilter,
});

// =======================
// 🛠 Debug helpers (optional)
// =======================
uploadGuideline.debugMiddleware = (req, res, next) => {
  console.log("Guideline files:", req.files);
  console.log("Body:", req.body);
  next();
};

uploadProof.debugMiddleware = (req, res, next) => {
  console.log("Proof files:", req.files);
  console.log("Body:", req.body);
  next();
};

const uploadAvatar = multer({
  storage: multer.memoryStorage(), // ✅ same as guidelines
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image")) {
      return cb(new Error("Only image files allowed"), false);
    }
    cb(null, true);
  },
});

const uploadIncidentImage = multer({
  storage: multer.memoryStorage(), // ✅ REQUIRED
  limits: { fileSize: 3 * 1024 * 1024 }, // optional (3MB)
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image")) {
      return cb(new Error("Only image files allowed"), false);
    }
    cb(null, true);
  },
});

// =======================
// ✅ Export
// =======================
module.exports = {
  uploadGuideline,
  uploadProof,
  uploadAvatar,
  uploadIncidentImage,
};