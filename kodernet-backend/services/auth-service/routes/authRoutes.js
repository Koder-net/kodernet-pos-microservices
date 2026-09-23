const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

const VALID_ROLES = ["ADMIN", "MANAGER", "CASHIER", "TECHNICIAN", "DRIVER"];

function sanitizeUser(user) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    username: user.username,
    role: user.role.toLowerCase(),
    active: user.active,
    branchId: user.branchId,
    branches:
      user.branches?.map((item) => ({
        branchId: item.branchId,
        isDefault: item.isDefault
      })) || [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role.toLowerCase(),
      tenantId: user.tenantId,
      branchId: user.branchId
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1h"
    }
  );
}

/*
 * LOGIN
 * Tenant is identified using tenantSlug.
 */
router.post("/login", async (req, res) => {
  try {
    const { tenantSlug, username, pin, password } = req.body;
    const credential = pin ?? password;

    if (!tenantSlug || !username || !credential) {
      return res.status(400).json({
        message: "Tenant, username, and PIN/password are required."
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: {
        slug: String(tenantSlug).toLowerCase()
      }
    });

    if (!tenant || !tenant.active) {
      return res.status(401).json({
        message: "Invalid credentials or inactive account."
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        tenantId_username: {
          tenantId: tenant.id,
          username
        }
      },
      include: {
        branches: true
      }
    });

    if (!user || !user.active) {
      return res.status(401).json({
        message: "Invalid credentials or inactive account."
      });
    }

    const valid = await bcrypt.compare(
      String(credential),
      user.passwordHash
    );

    if (!valid) {
      return res.status(401).json({
        message: "Invalid credentials or inactive account."
      });
    }

    return res.json({
      message: "Login successful.",
      token: signToken(user),
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Unable to process login."
    });
  }
});

/*
 * CURRENT USER
 */
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: {
        id: req.user.sub,
        tenantId: req.user.tenantId
      },
      include: {
        branches: true
      }
    });

    if (!user || !user.active) {
      return res.status(401).json({
        message: "User account is no longer active."
      });
    }

    res.json({
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to retrieve current user."
    });
  }
});

/*
 * LIST USERS
 * Admin can only see users from their own tenant.
 */
router.get(
  "/users",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        where: {
          tenantId: req.user.tenantId
        },
        orderBy: {
          createdAt: "desc"
        },
        include: {
          branches: true
        }
      });

      res.json({
        users: users.map(sanitizeUser)
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Unable to retrieve users."
      });
    }
  }
);

/*
 * CREATE USER
 * New users automatically belong to the
 * authenticated administrator's tenant.
 */
router.post(
  "/users",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const {
        username,
        pin,
        password,
        role,
        branchId,
        branchIds = [],
        defaultBranchId
      } = req.body;

      const credential = pin ?? password;

      if (!username || !credential || !role) {
        return res.status(400).json({
          message: "Username, PIN/password, and role are required."
        });
      }

      const normalizedRole = String(role).toUpperCase();

      if (!VALID_ROLES.includes(normalizedRole)) {
        return res.status(400).json({
          message: `Invalid role. Allowed roles: ${VALID_ROLES.map((r) =>
            r.toLowerCase()
          ).join(", ")}.`
        });
      }

      const existing = await prisma.user.findUnique({
        where: {
          tenantId_username: {
            tenantId: req.user.tenantId,
            username
          }
        }
      });

      if (existing) {
        return res.status(409).json({
          message: "Username is already in use in this tenant."
        });
      }

      const requestedBranches = [
        ...new Set([
          ...(branchId ? [branchId] : []),
          ...branchIds
        ])
      ];

      const chosenDefault =
        defaultBranchId || requestedBranches[0] || null;

      if (
        chosenDefault &&
        !requestedBranches.includes(chosenDefault)
      ) {
        requestedBranches.push(chosenDefault);
      }

      const passwordHash = await bcrypt.hash(
        String(credential),
        Number(process.env.BCRYPT_ROUNDS || 12)
      );

      const user = await prisma.user.create({
        data: {
          tenantId: req.user.tenantId,
          username,
          passwordHash,
          role: normalizedRole,
          branchId: chosenDefault,
          branches: requestedBranches.length
            ? {
                create: requestedBranches.map((id) => ({
                  branchId: id,
                  isDefault: id === chosenDefault
                }))
              }
            : undefined
        },
        include: {
          branches: true
        }
      });

      res.status(201).json({
        message: "User created successfully.",
        user: sanitizeUser(user)
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Unable to create user."
      });
    }
  }
);

/*
 * UPDATE USER
 * Admin can only update users from their own tenant.
 */
router.patch(
  "/users/:id",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        username,
        pin,
        password,
        role,
        active,
        branchId,
        branchIds,
        defaultBranchId
      } = req.body;

      const existing = await prisma.user.findFirst({
        where: {
          id,
          tenantId: req.user.tenantId
        },
        include: {
          branches: true
        }
      });

      if (!existing) {
        return res.status(404).json({
          message: "User not found."
        });
      }

      const data = {};

      if (username !== undefined) {
        const duplicate = await prisma.user.findFirst({
          where: {
            tenantId: req.user.tenantId,
            username,
            NOT: {
              id
            }
          }
        });

        if (duplicate) {
          return res.status(409).json({
            message: "Username is already in use in this tenant."
          });
        }

        data.username = username;
      }

      if (role !== undefined) {
        const normalizedRole = String(role).toUpperCase();

        if (!VALID_ROLES.includes(normalizedRole)) {
          return res.status(400).json({
            message: "Invalid role."
          });
        }

        data.role = normalizedRole;
      }

      if (active !== undefined) {
        data.active = Boolean(active);
      }

      const credential = pin ?? password;

      if (credential !== undefined) {
        data.passwordHash = await bcrypt.hash(
          String(credential),
          Number(process.env.BCRYPT_ROUNDS || 12)
        );
      }

      let branchesToSet = null;

      if (Array.isArray(branchIds)) {
        branchesToSet = [...new Set(branchIds)];
      } else if (branchId !== undefined) {
        branchesToSet = branchId ? [branchId] : [];
      }

      if (defaultBranchId !== undefined) {
        if (defaultBranchId && !branchesToSet) {
          branchesToSet = existing.branches.map(
            (item) => item.branchId
          );
        }

        if (
          defaultBranchId &&
          branchesToSet &&
          !branchesToSet.includes(defaultBranchId)
        ) {
          branchesToSet.push(defaultBranchId);
        }

        data.branchId = defaultBranchId || null;
      } else if (branchId !== undefined) {
        data.branchId = branchId || null;
      }

      const updated = await prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: {
            id
          },
          data
        });

        if (branchesToSet !== null) {
          await tx.userBranch.deleteMany({
            where: {
              userId: id
            }
          });

          if (branchesToSet.length) {
            const defaultId =
              data.branchId || branchesToSet[0];

            await tx.userBranch.createMany({
              data: branchesToSet.map((branch) => ({
                userId: id,
                branchId: branch,
                isDefault: branch === defaultId
              }))
            });
          }
        }

        return tx.user.findUnique({
          where: {
            id
          },
          include: {
            branches: true
          }
        });
      });

      res.json({
        message: "User updated successfully.",
        user: sanitizeUser(updated)
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Unable to update user."
      });
    }
  }
);

/*
 * ACTIVATE / DEACTIVATE USER
 * Admin can only modify users from their own tenant.
 */
router.patch(
  "/users/:id/status",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const { active } = req.body;

      if (typeof active !== "boolean") {
        return res.status(400).json({
          message: "active must be true or false."
        });
      }

      if (
        req.user.sub === req.params.id &&
        active === false
      ) {
        return res.status(400).json({
          message:
            "The current administrator cannot deactivate their own account."
        });
      }

      const existing = await prisma.user.findFirst({
        where: {
          id: req.params.id,
          tenantId: req.user.tenantId
        }
      });

      if (!existing) {
        return res.status(404).json({
          message: "User not found."
        });
      }

      const user = await prisma.user.update({
        where: {
          id: req.params.id
        },
        data: {
          active
        },
        include: {
          branches: true
        }
      });

      res.json({
        message: active
          ? "User activated successfully."
          : "User deactivated successfully.",
        user: sanitizeUser(user)
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Unable to update user status."
      });
    }
  }
);

/*
 * CHANGE USER CREDENTIALS
 * Admin can only change credentials for users
 * belonging to their own tenant.
 */
router.patch(
  "/users/:id/credentials",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const credential =
        req.body.pin ?? req.body.password;

      if (!credential) {
        return res.status(400).json({
          message: "New PIN/password is required."
        });
      }

      const existing = await prisma.user.findFirst({
        where: {
          id: req.params.id,
          tenantId: req.user.tenantId
        }
      });

      if (!existing) {
        return res.status(404).json({
          message: "User not found."
        });
      }

      const passwordHash = await bcrypt.hash(
        String(credential),
        Number(process.env.BCRYPT_ROUNDS || 12)
      );

      await prisma.user.update({
        where: {
          id: req.params.id
        },
        data: {
          passwordHash
        }
      });

      res.json({
        message: "Credentials updated successfully."
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Unable to update credentials."
      });
    }
  }
);

module.exports = router;