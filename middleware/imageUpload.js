const fs = require("fs");
const multer = require("multer");
const path = require("path");

const imagesDir = path.join(__dirname, "..", "tmp", "images");

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, imagesDir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const allowedMimeTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]);

const fileFilter = (_req, file, cb) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    cb(new Error("Only JPEG, JPG, PNG, GIF, or WEBP images are allowed"));
    return;
  }

  cb(null, true);
};

const imageUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

module.exports = imageUpload;
