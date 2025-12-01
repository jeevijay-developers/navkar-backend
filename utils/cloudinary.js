const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const axios = require("axios");
const cloudinary = require("../config/cloudinary");

const baseFolder = process.env.CLOUDINARY_FOLDER || "navkar/products";
const uploadTransformation = [
  {
    fetch_format: "auto",
    quality: "auto",
  },
];

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
  resource_type: "image",
  transformation: uploadTransformation,
  use_filename: true,
  unique_filename: true,
  overwrite: false,
  ...overrides,
});

const downloadRemoteImage = async (imageUrl) => {
  const response = await axios.get(imageUrl, {
    responseType: "arraybuffer",
    timeout: 15000,
    headers: {
      "User-Agent": "NavkarUploader/1.0",
    },
  });

  const urlExtension = (() => {
    try {
      const parsed = new URL(imageUrl);
      const ext = path.extname(parsed.pathname);
      return ext || ".tmp";
    } catch (_error) {
      return ".tmp";
    }
  })();

  const tempPath = path.join(
    os.tmpdir(),
    `navkar-remote-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}${urlExtension}`
  );

  await fs.writeFile(tempPath, response.data);
  return tempPath;
};

const uploadFromPath = async (filePath, folderSuffix) => {
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
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
};

const uploadFromUrl = async (imageUrl, folderSuffix) => {
  if (!imageUrl) {
    return null;
  }
  const tempPath = await downloadRemoteImage(imageUrl);
  return uploadFromPath(tempPath, folderSuffix);
};

const deleteImageByPublicId = async (publicId) => {
  if (!publicId) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (error) {
    console.error(
      "Failed to delete Cloudinary asset:",
      publicId,
      error.message
    );
  }
};

module.exports = {
  uploadFromPath,
  uploadFromUrl,
  deleteImageByPublicId,
};
