const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

// Only allow real image files, and cap size to keep uploads reasonable
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, or WebP images are allowed."));
  }
};

// Builds a two-step middleware for a given form field + destination subfolder:
//   1. multer reads the upload into memory (not straight to disk)
//   2. sharp processes it — auto-rotates based on EXIF orientation data
//      (phone photos are often stored "sideways" with a rotation tag rather
//      than actually rotated pixels; browsers don't reliably honor that tag
//      consistently), bakes the correct rotation into the actual pixels,
//      strips the metadata, resizes, and re-encodes as a compressed JPEG
//      before writing to disk.
function createImageUploadMiddleware(fieldName, subfolder) {
  const memoryUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: imageFileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max upload size
  });

  return [
    memoryUpload.single(fieldName),
    async (req, res, next) => {
      if (!req.file) {
        return next(); // no file uploaded — let the controller's own "required" check handle it
      }

      try {
        const dir = path.join(__dirname, "..", "uploads", subfolder);
        fs.mkdirSync(dir, { recursive: true });

        const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
        const destPath = path.join(dir, filename);

        await sharp(req.file.buffer)
          .rotate() // no arguments = auto-orient using the image's own EXIF data, then strip it
          .resize({ width: 800, withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(destPath);

        // Controllers read req.file.filename to build the stored path —
        // overwrite it with our generated name so nothing downstream changes
        req.file.filename = filename;
        next();
      } catch (error) {
        console.error("Image processing error:", error);
        res.status(500).json({ error: "Error processing uploaded image" });
      }
    },
  ];
}

const uploadBannerImage = createImageUploadMiddleware("banner_image", "banners");
const uploadMenuItemImage = createImageUploadMiddleware("image", "menu-items");

module.exports = {
  uploadBannerImage,
  uploadMenuItemImage,
};