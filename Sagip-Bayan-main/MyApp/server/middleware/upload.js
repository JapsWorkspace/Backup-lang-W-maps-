const multer = require("multer");
const path = require("path");
const fs = require("fs");

// =======================
// ✅ Proof uploads
// =======================
const proofDir = path.join(__dirname, "../uploads/proofs");
if (!fs.existsSync(proofDir)) {
  fs.mkdirSync(proofDir, { recursive: true });
}

const proofStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, proofDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const cleanName = String(file.originalname || "proof-file").replace(
      /[^a-zA-Z0-9.\-_]/g,
      "_"
    );

    cb(null, `${uniqueSuffix}-${cleanName}`);
  },
});

const proofFileFilter = (req, file, cb) => {
  const allowedExt = /\.(jpeg|jpg|png|pdf)$/i;
  const originalname = String(file.originalname || "").toLowerCase();
  const mimetype = String(file.mimetype || "").toLowerCase();

  const isAllowedExt = allowedExt.test(originalname);
  const isAllowedMime =
    mimetype.startsWith("image/") || mimetype === "application/pdf";

  if (isAllowedExt || isAllowedMime) {
    return cb(null, true);
  }

  return cb(new Error("Only images and PDF files are allowed for proofs"), false);
};

// =======================
// ✅ Guideline uploads
// =======================
const uploadGuideline = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mimetype = String(file.mimetype || "").toLowerCase();
    const originalname = String(file.originalname || "").toLowerCase();

    const isImageMime = mimetype.startsWith("image/");
    const isImageExt = /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(originalname);

    if (!isImageMime && !isImageExt) {
      return cb(new Error("Only image files are allowed"), false);
    }

    return cb(null, true);
  },
});

// =======================
// ✅ Proof uploader
// =======================
const uploadProof = multer({
  storage: proofStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: proofFileFilter,
});

// =======================
// ✅ Avatar upload
// =======================
const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mimetype = String(file.mimetype || "").toLowerCase();
    const originalname = String(file.originalname || "").toLowerCase();

    const isImageMime = mimetype.startsWith("image/");
    const isImageExt = /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(originalname);

    if (!isImageMime && !isImageExt) {
      return cb(new Error("Only image files allowed"), false);
    }

    return cb(null, true);
  },
});

// =======================
// ✅ Incident image upload
// Android/emulator-safe:
// - higher file size limit
// - accepts common mobile image formats
// - checks MIME and extension
// =======================
const uploadIncidentImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mimetype = String(file.mimetype || "").toLowerCase();
    const originalname = String(file.originalname || "").toLowerCase();

    const isImageMime = mimetype.startsWith("image/");
    const isImageExt = /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(originalname);

    if (!isImageMime && !isImageExt) {
      return cb(new Error("Only image files allowed"), false);
    }

    return cb(null, true);
  },
});

const uploadDonationPhotos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 4 },
  fileFilter: (req, file, cb) => {
    const mimetype = String(file.mimetype || "").toLowerCase();
    const originalname = String(file.originalname || "").toLowerCase();

    const isImageMime = mimetype.startsWith("image/");
    const isImageExt = /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(originalname);

    if (!isImageMime && !isImageExt) {
      return cb(new Error("Only image files allowed for donation photos"), false);
    }

    return cb(null, true);
  },
});

// =======================
// 🛠 Debug helpers
// =======================
uploadGuideline.debugMiddleware = (req, res, next) => {
  console.log("Guideline files:", req.files || req.file);
  console.log("Body:", req.body);
  next();
};

uploadProof.debugMiddleware = (req, res, next) => {
  console.log("Proof files:", req.files || req.file);
  console.log("Body:", req.body);
  next();
};

uploadAvatar.debugMiddleware = (req, res, next) => {
  console.log("Avatar file:", req.file);
  console.log("Body:", req.body);
  next();
};

uploadIncidentImage.debugMiddleware = (req, res, next) => {
  console.log("Incident file:", req.file);
  console.log("Body:", req.body);
  next();
};

// =======================
// ✅ Export
// =======================
module.exports = {
  uploadGuideline,
  uploadProof,
  uploadAvatar,
  uploadIncidentImage,
  uploadDonationPhotos,
};
