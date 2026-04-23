const fs = require("fs");
const path = require("path");
const multer = require("multer");
const env = require("../config/env");

const uploadsDir = path.join(__dirname, "..", "..", "uploads", "evidence");
fs.mkdirSync(uploadsDir, { recursive: true });

const localDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "") || ".bin";
    const safeBase = path
      .basename(file.originalname || "evidence", extension)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 50);

    cb(null, `${Date.now()}_${safeBase}${extension}`);
  },
});

const cloudMemoryStorage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const isAllowed = /^(image|video|audio)\//.test(file.mimetype || "");

  if (!isAllowed) {
    return cb(new Error("Unsupported file type. Use image, video, or audio."));
  }

  return cb(null, true);
};

const uploadEmergencyEvidence = multer({
  storage:
    env.storageProvider === "cloudinary"
      ? cloudMemoryStorage
      : localDiskStorage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 1,
  },
}).single("file");

module.exports = {
  uploadEmergencyEvidence,
};
