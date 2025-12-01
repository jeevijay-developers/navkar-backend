const mongoose = require("mongoose");

const VariantSchema = new mongoose.Schema(
  {
    sizeLabel: {
      type: String,
      required: true,
      trim: true,
    },
    brimfulCapacity: {
      type: String,
      required: true,
      trim: true,
    },
    neckSize: {
      type: String,
      required: true,
      trim: true,
    },
    totalHeight: {
      type: String,
      required: true,
      trim: true,
    },
    diameter: {
      type: String,
      required: true,
      trim: true,
    },
    labelHeight: {
      type: String,
      required: true,
      trim: true,
    },
    standardWeight: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    materialOfConstruction: {
      type: String,
      required: true,
      trim: true,
    },
    capType: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    imagePublicId: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    variants: {
      type: [VariantSchema],
      validate: {
        validator: (variants) => Array.isArray(variants) && variants.length > 0,
        message: "At least one variant is required",
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Product", ProductSchema);
