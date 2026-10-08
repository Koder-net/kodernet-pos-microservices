const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
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

    description: {
      type: String,
      trim: true,
      default: ""
    },
    icon: {
      type: String,
      trim: true,
      default: ""
    },

    
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null
    },

    
    sortOrder: {
      type: Number,
      default: 0
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

categorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);