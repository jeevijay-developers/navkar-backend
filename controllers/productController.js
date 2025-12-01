const fs = require("fs/promises");
const XLSX = require("xlsx");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const asyncHandler = require("../utils/asyncHandler");
const {
  uploadFromPath,
  uploadFromUrl,
  deleteImageByPublicId,
} = require("../utils/cloudinary");

const normalizeRow = (row) => {
  const normalized = {};
  Object.entries(row).forEach(([key, value]) => {
    if (typeof key === "string") {
      normalized[key.trim().toLowerCase()] =
        typeof value === "string" ? value.trim() : value;
    }
  });
  return normalized;
};

const requiredRowFields = [
  "product name",
  "material of construction",
  "cap type",
  "image url",
  "size label",
];

const variantFields = [
  "brimful capacity",
  "neck size",
  "total height",
  "diameter",
  "label height",
  "standard weight",
];

const buildVariantFromRow = (row) => ({
  sizeLabel: row["size label"],
  brimfulCapacity: row["brimful capacity"] || "N/A",
  neckSize: row["neck size"] || "N/A",
  totalHeight: row["total height"] || "N/A",
  diameter: row["diameter"] || "N/A",
  labelHeight: row["label height"] || "N/A",
  standardWeight: row["standard weight"] || "N/A",
});

const summarizeBulkResult = (bulkResult = {}) => {
  if (!bulkResult) {
    return { inserted: 0, updated: 0, matched: 0 };
  }

  if (typeof bulkResult.getInsertedIds === "function") {
    return {
      inserted: bulkResult.upsertedCount || 0,
      updated: bulkResult.modifiedCount || 0,
      matched: bulkResult.matchedCount || 0,
    };
  }

  return {
    inserted:
      bulkResult.upsertedCount ||
      bulkResult.nUpserted ||
      bulkResult.insertedCount ||
      0,
    updated:
      bulkResult.modifiedCount ||
      bulkResult.nModified ||
      bulkResult.updatedCount ||
      0,
    matched: bulkResult.matchedCount || bulkResult.nMatched || 0,
  };
};

const parseVariantsField = (variants) => {
  if (!Object.prototype.hasOwnProperty.call({ variants }, "variants")) {
    return undefined;
  }

  if (variants === undefined) {
    return undefined;
  }

  if (Array.isArray(variants)) {
    return variants;
  }

  if (typeof variants === "string") {
    const trimmed = variants.trim();

    if (!trimmed) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(trimmed);

      if (!Array.isArray(parsed)) {
        throw new Error("Variants must be provided as an array");
      }

      return parsed;
    } catch (error) {
      throw new Error("Variants must be a valid JSON array string");
    }
  }

  throw new Error("Variants must be an array or JSON array string");
};

const prepareProductPayload = (body = {}) => {
  const payload = { ...body };

  if (Object.prototype.hasOwnProperty.call(payload, "variants")) {
    const parsedVariants = parseVariantsField(payload.variants);

    if (parsedVariants === undefined) {
      delete payload.variants;
    } else {
      payload.variants = parsedVariants;
    }
  }

  return payload;
};

const uploadImageAsset = async ({ filePath, remoteUrl, productName }) => {
  if (filePath) {
    return uploadFromPath(filePath, productName);
  }

  if (remoteUrl) {
    return uploadFromUrl(remoteUrl, productName);
  }

  return null;
};

const collectBulkStats = async (opMeta, failedOpIndexes) => {
  await Promise.all(
    opMeta.map(async ({ newPublicId, oldPublicId }, index) => {
      if (failedOpIndexes.has(index)) {
        await deleteImageByPublicId(newPublicId);
        return;
      }

      if (oldPublicId) {
        await deleteImageByPublicId(oldPublicId);
      }
    })
  );
};

exports.createProduct = asyncHandler(async (req, res) => {
  let payload;

  try {
    payload = prepareProductPayload(req.body);
  } catch (error) {
    res.status(400).json({ message: error.message });
    return;
  }

  const imageSource = req.file?.path || payload.imageUrl;

  if (!imageSource) {
    res.status(400).json({ message: "Product image is required" });
    return;
  }

  let uploadResult;

  try {
    uploadResult = await uploadImageAsset({
      filePath: req.file?.path,
      remoteUrl: !req.file ? payload.imageUrl : undefined,
      productName: payload.name,
    });
  } catch (error) {
    res.status(400).json({
      message: `Failed to upload product image: ${
        error.message || "Unknown error"
      }`,
    });
    return;
  }

  if (!uploadResult) {
    res.status(400).json({ message: "Product image could not be processed" });
    return;
  }

  payload.imageUrl = uploadResult.url;
  payload.imagePublicId = uploadResult.publicId;

  try {
    const product = await Product.create(payload);
    res.status(201).json(product);
  } catch (error) {
    await deleteImageByPublicId(uploadResult.publicId);
    throw error;
  }
});

exports.getProducts = asyncHandler(async (_req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  res.json(products);
});

exports.getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ message: "Invalid product id supplied" });
    return;
  }

  const product = await Product.findById(id);

  if (!product) {
    res.status(404).json({ message: "Product not found" });
    return;
  }

  res.json(product);
});

exports.updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ message: "Invalid product id supplied" });
    return;
  }

  const existingProduct = await Product.findById(id);

  if (!existingProduct) {
    res.status(404).json({ message: "Product not found" });
    return;
  }

  let payload;

  try {
    payload = prepareProductPayload(req.body);
  } catch (error) {
    res.status(400).json({ message: error.message });
    return;
  }

  let uploadResult = null;
  const hasFileUpload = Boolean(req.file);
  const hasRemoteImage =
    !hasFileUpload &&
    typeof payload.imageUrl === "string" &&
    payload.imageUrl.trim();
  const shouldUploadRemote =
    hasRemoteImage && payload.imageUrl.trim() !== existingProduct.imageUrl;

  if (hasFileUpload || shouldUploadRemote) {
    try {
      uploadResult = await uploadImageAsset({
        filePath: req.file?.path,
        remoteUrl: shouldUploadRemote ? payload.imageUrl : undefined,
        productName: payload.name || existingProduct.name,
      });
    } catch (error) {
      res.status(400).json({
        message: `Failed to upload product image: ${
          error.message || "Unknown error"
        }`,
      });
      return;
    }
  }

  if (uploadResult) {
    payload.imageUrl = uploadResult.url;
    payload.imagePublicId = uploadResult.publicId;
  } else {
    delete payload.imageUrl;
  }

  let updatedProduct;

  try {
    updatedProduct = await Product.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
  } catch (error) {
    if (uploadResult) {
      await deleteImageByPublicId(uploadResult.publicId);
    }
    throw error;
  }

  if (!updatedProduct) {
    if (uploadResult) {
      await deleteImageByPublicId(uploadResult.publicId);
    }
    res.status(404).json({ message: "Product not found" });
    return;
  }

  if (uploadResult && existingProduct.imagePublicId) {
    await deleteImageByPublicId(existingProduct.imagePublicId);
  }

  res.json(updatedProduct);
});

exports.deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ message: "Invalid product id supplied" });
    return;
  }

  const product = await Product.findById(id);

  if (!product) {
    res.status(404).json({ message: "Product not found" });
    return;
  }

  await product.deleteOne();

  if (product.imagePublicId) {
    await deleteImageByPublicId(product.imagePublicId);
  }

  res.json({ message: "Product deleted successfully" });
});

exports.bulkUploadProducts = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "Please upload a CSV or XLSX file" });
    return;
  }

  const filePath = req.file.path;

  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!rows.length) {
      res.status(400).json({ message: "Uploaded file is empty" });
      return;
    }

    const groupedProducts = new Map();
    const invalidRows = [];

    for (let index = 0; index < rows.length; index += 1) {
      const originalRow = rows[index];
      const row = normalizeRow(originalRow);
      const missingFields = requiredRowFields.filter((field) => !row[field]);

      if (missingFields.length) {
        invalidRows.push({
          row: index + 2,
          reason: `Missing fields: ${missingFields.join(", ")}`,
        });
        // eslint-disable-next-line no-continue
        continue;
      }

      variantFields.forEach((field) => {
        if (!row[field]) {
          row[field] = "N/A";
        }
      });

      const key = `${row["product name"]}|${row["material of construction"]}|${row["cap type"]}|${row["image url"]}`;

      if (!groupedProducts.has(key)) {
        groupedProducts.set(key, {
          name: row["product name"],
          materialOfConstruction: row["material of construction"],
          capType: row["cap type"],
          imageSource: row["image url"],
          description: row["description"] || "",
          variants: [],
          sourceRows: [index + 2],
        });
      } else {
        groupedProducts.get(key).sourceRows.push(index + 2);
      }

      groupedProducts.get(key).variants.push(buildVariantFromRow(row));
    }

    if (!groupedProducts.size) {
      res.status(400).json({
        message: "No valid product rows were found in the uploaded file",
        invalidRows,
      });
      return;
    }

    const preparedProducts = [];
    const opMeta = [];
    const prepFailures = [];

    for (const productEntry of groupedProducts.values()) {
      const { imageSource, sourceRows, ...baseProduct } = productEntry;

      try {
        const uploadResult = await uploadImageAsset({
          remoteUrl: imageSource,
          productName: baseProduct.name,
        });

        if (!uploadResult) {
          throw new Error("Product image could not be processed");
        }

        const existingProduct = await Product.findOne({
          name: baseProduct.name,
        }).select("imagePublicId");

        preparedProducts.push({
          ...baseProduct,
          imageUrl: uploadResult.url,
          imagePublicId: uploadResult.publicId,
        });

        opMeta.push({
          name: baseProduct.name,
          rows: sourceRows,
          newPublicId: uploadResult.publicId,
          oldPublicId: existingProduct?.imagePublicId || null,
        });
      } catch (error) {
        prepFailures.push({
          product: baseProduct.name,
          rows: sourceRows,
          reason: error.message || "Image upload failed",
        });
      }
    }

    if (!preparedProducts.length) {
      res.status(400).json({
        message: "Bulk upload failed before inserting any products",
        invalidRows,
        failedProducts: prepFailures,
      });
      return;
    }

    const operations = preparedProducts.map((product) => ({
      updateOne: {
        filter: { name: product.name },
        update: { $set: product },
        upsert: true,
      },
    }));

    let bulkResult;
    const failedOpIndexes = new Set();
    let writeFailures = [];

    try {
      bulkResult = await Product.bulkWrite(operations, { ordered: false });
    } catch (error) {
      if (error?.writeErrors?.length) {
        writeFailures = error.writeErrors.map((writeErr) => {
          const opIndex = writeErr.index;
          failedOpIndexes.add(opIndex);
          const meta = opMeta[opIndex];
          return {
            product:
              meta?.name ||
              preparedProducts[opIndex]?.name ||
              `Operation ${opIndex}`,
            rows: meta?.rows || [],
            reason:
              writeErr.errmsg ||
              writeErr.err?.errmsg ||
              writeErr.err?.message ||
              writeErr.code ||
              writeErr.message ||
              "Unknown bulk write error",
            index: opIndex,
          };
        });

        bulkResult = error.result?.result ||
          error.result || {
            upsertedCount: 0,
            modifiedCount: 0,
          };
      } else {
        await Promise.all(
          opMeta.map(({ newPublicId }) => deleteImageByPublicId(newPublicId))
        );
        throw error;
      }
    }

    await collectBulkStats(opMeta, failedOpIndexes);

    const { inserted, updated, matched } = summarizeBulkResult(bulkResult);
    const failedProducts = [
      ...prepFailures,
      ...writeFailures.map(({ product, rows, reason }) => ({
        product,
        rows,
        reason,
      })),
    ];

    res.json({
      message: failedProducts.length
        ? "Bulk upload completed with some failures"
        : "Bulk upload processed successfully",
      summary: {
        totalRows: rows.length,
        validRows: rows.length - invalidRows.length,
        totalProducts: preparedProducts.length,
        inserted,
        updated,
        matched,
        failedProducts: failedProducts.length,
        skippedRows: invalidRows.length,
        failedProductDetails: failedProducts,
        skippedRowDetails: invalidRows,
      },
    });
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
});
