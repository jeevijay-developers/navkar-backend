const fs = require("fs/promises");
const path = require("path");
const cloudinary = require("../config/cloudinary");

const baseFolder = process.env.CLOUDINARY_QUOTATION_FOLDER || "navkar/quotations";

const sanitizeFolderPart = (value) =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-");

const resolveFolder = (suffix) => {
  if (!suffix) {
    return baseFolder;
  }
  return `${baseFolder}/${sanitizeFolderPart(suffix)}`;
};

const buildUploadOptions = (folderSuffix, overrides = {}) => ({
  folder: resolveFolder(folderSuffix),
  resource_type: "raw",
  use_filename: true,
  unique_filename: true,
  overwrite: false,
  ...overrides,
});

const uploadPDFFromPath = async (filePath, folderSuffix = "") => {
  if (!filePath) {
    return null;
  }

  try {
    const result = await cloudinary.uploader.upload(
      filePath,
      buildUploadOptions(folderSuffix)
    );

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    console.error("Failed to upload PDF to Cloudinary:", error.message);
    throw error;
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
};

const deletePDFByPublicId = async (publicId) => {
  if (!publicId) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
  } catch (error) {
    console.error(
      "Failed to delete Cloudinary PDF asset:",
      publicId,
      error.message
    );
  }
};

module.exports = {
  uploadPDFFromPath,
  deletePDFByPublicId,
};

