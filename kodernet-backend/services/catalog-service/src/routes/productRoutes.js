const express = require("express");
const mongoose = require("mongoose");

const Product = require("../models/Product");
const Category = require("../models/Category");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

async function getNextSku(tenantId, categoryId) {
  const category = await Category.findOne({
    _id: categoryId,
    tenantId
  });

  if (!category) {
    const error = new Error("Category not found");
    error.status = 404;
    throw error;
  }

  const prefix =
    category.name
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 4)
      .toUpperCase() || "CAT";

  const existing = await Product.find({
    tenantId,
    sku: new RegExp(`^${prefix}-\\d+$`, "i")
  })
    .select("sku")
    .lean();

  let highest = 0;
  for (const item of existing) {
    const match = item.sku.match(/-(\d+)$/);
    if (match) highest = Math.max(highest, Number(match[1]));
  }

  return `${prefix}-${String(highest + 1).padStart(4, "0")}`;
}

router.get("/", authenticateToken, async (req, res, next) => {
  try {
    const filter = { tenantId: req.user.tenantId };

    if (req.query.active !== undefined) {
      filter.active = req.query.active === "true";
    }

    if (req.query.categoryId) {
      if (!mongoose.isValidObjectId(req.query.categoryId)) {
        return res.status(400).json({ message: "Invalid categoryId" });
      }
      filter.categoryId = req.query.categoryId;
    }

    // Basic text search over English and Sinhala product names.
    if (req.query.search) {
      const escaped = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { nameSi: { $regex: escaped, $options: "i" } },
        { sku: { $regex: escaped, $options: "i" } },
        { barcode: { $regex: escaped, $options: "i" } }
      ];
    }

    const products = await Product.find(filter)
      .populate("categoryId", "name nameSi icon")
      .sort({ name: 1 });

    res.json(products);
  } catch (error) {
    next(error);
  }
});

router.get("/barcode/:barcode", authenticateToken, async (req, res, next) => {
  try {
    const product = await Product.findOne({
      tenantId: req.user.tenantId,
      barcode: req.params.barcode
    }).populate("categoryId", "name nameSi icon");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

router.get(
  "/next-sku/:categoryId",
  authenticateToken,
  authorizeRoles("admin", "manager"),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const sku = await getNextSku(
        req.user.tenantId,
        req.params.categoryId
      );

      res.json({ sku });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin", "manager"),
  async (req, res, next) => {
    try {
      const {
        name,
        nameSi,
        sku,
        barcode,
        categoryId,
        unit,
        retailPrice,
        wholesalePrice,
        minWholesaleQty,
        lowStockThreshold,
        image,
        gallery,
        attributes,
        active
      } = req.body;

      if (!name || retailPrice === undefined || !categoryId) {
        return res.status(400).json({
          message: "name, retailPrice and categoryId are required"
        });
      }

      if (!mongoose.isValidObjectId(categoryId)) {
        return res.status(400).json({ message: "Invalid categoryId" });
      }

      const category = await Category.findOne({
        _id: categoryId,
        tenantId: req.user.tenantId
      });

      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      const finalSku =
        sku && String(sku).trim()
          ? String(sku).trim()
          : await getNextSku(req.user.tenantId, categoryId);

      if (barcode && !/^[0-9A-Za-z._-]{3,100}$/.test(barcode)) {
        return res.status(400).json({ message: "Invalid barcode format" });
      }

      const product = await Product.create({
        tenantId: req.user.tenantId,
        name,
        nameSi,
        sku: finalSku,
        barcode: barcode || null,
        categoryId,
        unit,
        retailPrice,
        wholesalePrice,
        minWholesaleQty,
        lowStockThreshold,
        image,
        gallery,
        attributes,
        active
      });

      res.status(201).json(product);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          message: "SKU or barcode already exists for this tenant"
        });
      }
      next(error);
    }
  }
);

router.get("/:id", authenticateToken, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    }).populate("categoryId", "name nameSi icon");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "manager"),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      const allowedFields = [
        "name",
        "nameSi",
        "sku",
        "barcode",
        "categoryId",
        "unit",
        "retailPrice",
        "wholesalePrice",
        "minWholesaleQty",
        "lowStockThreshold",
        "image",
        "gallery",
        "attributes",
        "active"
      ];

      const updates = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }

      if (updates.categoryId) {
        if (!mongoose.isValidObjectId(updates.categoryId)) {
          return res.status(400).json({ message: "Invalid categoryId" });
        }

        const category = await Category.findOne({
          _id: updates.categoryId,
          tenantId: req.user.tenantId
        });

        if (!category) {
          return res.status(404).json({ message: "Category not found" });
        }
      }

      if (updates.barcode && !/^[0-9A-Za-z._-]{3,100}$/.test(updates.barcode)) {
        return res.status(400).json({ message: "Invalid barcode format" });
      }

      const product = await Product.findOneAndUpdate(
        { _id: req.params.id, tenantId: req.user.tenantId },
        updates,
        { new: true, runValidators: true }
      );

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json(product);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          message: "SKU or barcode already exists for this tenant"
        });
      }
      next(error);
    }
  }
);

router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "manager"),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      const product = await Product.findOneAndUpdate(
        { _id: req.params.id, tenantId: req.user.tenantId },
        { active: false },
        { new: true }
      );

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json({
        message: "Product deactivated successfully",
        product
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/:id/images", authenticateToken, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    }).select("image gallery");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({
      mainImage: product.image,
      gallery: product.gallery
    });
  } catch (error) {
    next(error);
  }
});

router.put(
  "/:id/gallery",
  authenticateToken,
  authorizeRoles("admin", "manager"),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      if (!Array.isArray(req.body.urls)) {
        return res.status(400).json({ message: "urls must be an array" });
      }

      const invalidUrl = req.body.urls.some(
        (url) => typeof url !== "string" || url.length > 2048
      );

      if (invalidUrl) {
        return res.status(400).json({ message: "Gallery contains an invalid URL" });
      }

      const product = await Product.findOneAndUpdate(
        { _id: req.params.id, tenantId: req.user.tenantId },
        { gallery: req.body.urls },
        { new: true, runValidators: true }
      ).select("image gallery");

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json(product);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;