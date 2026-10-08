const express = require("express");
const mongoose = require("mongoose");

const Category = require("../models/Category");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

// List categories belonging only to the authenticated tenant.
router.get("/", authenticateToken, async (req, res, next) => {
  try {
    const filter = { tenantId: req.user.tenantId };

    if (req.query.active !== undefined) {
      filter.active = req.query.active === "true";
    }
    if (req.query.parentId) {
      if (!mongoose.isValidObjectId(req.query.parentId)) {
        return res.status(400).json({ message: "Invalid parentId" });
      }
      filter.parentId = req.query.parentId;
    }

    const categories = await Category.find(filter).sort({
      sortOrder: 1,
      name: 1
    });

    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// Create a category. Admins and managers can modify catalog structure.
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin", "manager"),
  async (req, res, next) => {
    try {
      const { name, nameSi, description, icon, parentId, sortOrder, active } =
        req.body;

      if (!name) {
        return res.status(400).json({ message: "name is required" });
      }

      if (parentId) {
        if (!mongoose.isValidObjectId(parentId)) {
          return res.status(400).json({ message: "Invalid parentId" });
        }

        const parent = await Category.findOne({
          _id: parentId,
          tenantId: req.user.tenantId
        });

        if (!parent) {
          return res.status(404).json({ message: "Parent category not found" });
        }
      }

      const category = await Category.create({
        tenantId: req.user.tenantId,
        name,
        nameSi,
        description,
        icon,
        parentId: parentId || null,
        sortOrder,
        active
      });

      res.status(201).json(category);
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ message: "A category with this name already exists" });
      }
      next(error);
    }
  }
);

// Get one category, but only if it belongs to the authenticated tenant.
router.get("/:id", authenticateToken, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    const category = await Category.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    });

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json(category);
  } catch (error) {
    next(error);
  }
});

// Update category fields while preserving tenant ownership.
router.patch(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "manager"),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const allowedFields = [
        "name",
        "nameSi",
        "description",
        "icon",
        "parentId",
        "sortOrder",
        "active"
      ];

      const updates = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      if (updates.parentId) {
        if (!mongoose.isValidObjectId(updates.parentId)) {
          return res.status(400).json({ message: "Invalid parentId" });
        }

        if (String(updates.parentId) === String(req.params.id)) {
          return res.status(400).json({ message: "A category cannot be its own parent" });
        }

        const parent = await Category.findOne({
          _id: updates.parentId,
          tenantId: req.user.tenantId
        });

        if (!parent) {
          return res.status(404).json({ message: "Parent category not found" });
        }
      }

      const category = await Category.findOneAndUpdate(
        { _id: req.params.id, tenantId: req.user.tenantId },
        updates,
        { new: true, runValidators: true }
      );

      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      res.json(category);
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ message: "A category with this name already exists" });
      }
      next(error);
    }
  }
);

// Soft-delete a category. It is rejected if products still reference it.
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "manager"),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const Product = require("../models/Product");

      const productCount = await Product.countDocuments({
        tenantId: req.user.tenantId,
        categoryId: req.params.id,
        active: true
      });

      if (productCount > 0) {
        return res.status(409).json({
          message: "Cannot delete a category containing active products"
        });
      }

      const category = await Category.findOneAndUpdate(
        { _id: req.params.id, tenantId: req.user.tenantId },
        { active: false },
        { new: true }
      );

      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      res.json({
        message: "Category deactivated successfully",
        category
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;