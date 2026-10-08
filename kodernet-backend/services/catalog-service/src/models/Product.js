const mongoose = require("mongoose");


const productSchema = new mongoose.Schema(
  {
    
    tenantId: {
      type: String,
      required: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },
    nameSi: {
      type: String,
      trim: true,
      default: ""
    },

    sku: {
      type: String,
      required: true,
      trim: true
    },
    barcode: {
      type: String,
      trim: true,
      default: null
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true
    },

    unit: {
      type: String,
      enum: ["unit", "cup", "bottle", "pack", "glass", "kg", "meter"],
      default: "unit"
    },

    retailPrice: {
      type: Number,
      required: true,
      min: 0
    },
    wholesalePrice: {
      type: Number,
      default: 0,
      min: 0
    },
    minWholesaleQty: {
      type: Number,
      default: 1,
      min: 1
    },

    lowStockThreshold: {
      type: Number,
      default: 0,
      min: 0
    },

    image: {
      type: String,
      trim: true,
      default: ""
    },
    gallery: {
      type: [String],
      default: []
    },

    attributes: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

productSchema.index({ tenantId: 1, sku: 1 }, { unique: true });
productSchema.index(
  { tenantId: 1, barcode: 1 },
  { unique: true, sparse: true }
);
productSchema.index({ tenantId: 1, categoryId: 1 });

module.exports = mongoose.model("Product", productSchema);