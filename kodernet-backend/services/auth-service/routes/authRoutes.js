const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const {
  authenticateToken,
  authorizeRoles
} = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

const VALID_ROLES = [
  "ADMIN",
  "MANAGER",
  "CASHIER",
  "TECHNICIAN",
  "DRIVER"
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

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

function isPrismaUniqueError(error) {
  return error?.code === "P2002";
}

function isPrismaNotFoundError(error) {
  return error?.code === "P2025";
}

function normalizeRole(role) {
  return String(role || "").trim().toUpperCase();
}

/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
|
| POST /api/auth/login
|
| Body:
| {
|   "tenantSlug": "kodernet",
|   "username": "admin",
|   "pin": "1234"
| }
|
*/

router.post("/login", async (req, res) => {
  try {
    const {
      tenantSlug,
      username,
      pin,
      password
    } = req.body;

    const credential = pin !== undefined ? pin : password;

    if (!tenantSlug || !username || !credential) {
      return res.status(400).json({
        message: "tenantSlug, username and PIN/password are required."
      });
    }

    const normalizedTenantSlug = String(tenantSlug)
      .trim()
      .toLowerCase();

    const tenant = await prisma.tenant.findUnique({
      where: {
        slug: normalizedTenantSlug
      }
    });

    if (!tenant || !tenant.active) {
      return res.status(401).json({
        message: "Invalid tenant or tenant is inactive."
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
        message: "Invalid username or account is inactive."
      });
    }

    const passwordMatches = await bcrypt.compare(
      String(credential),
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid username or PIN/password."
      });
    }

    const token = signToken(user);

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "An error occurred during login."
    });
  }
});

/*
|--------------------------------------------------------------------------
| CURRENT USER
|--------------------------------------------------------------------------
|
| GET /api/auth/me
|
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
        message: "User account is inactive or no longer exists."
      });
    }

    return res.status(200).json({
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(500).json({
      message: "An error occurred while retrieving the current user."
    });
  }
});

/*
|--------------------------------------------------------------------------
| LIST USERS / STAFF
|--------------------------------------------------------------------------
|
| GET /api/auth/users
|
| ADMIN only
|
*/

router.get(
  "/users",
  authenticateToken,
  authorizeRoles("admin"),
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

      return res.status(200).json({
        users: users.map(sanitizeUser)
      });
    } catch (error) {
      console.error("List users error:", error);

      return res.status(500).json({
        message: "An error occurred while retrieving users."
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| CREATE USER / STAFF
|--------------------------------------------------------------------------
|
| POST /api/auth/users
|
| ADMIN only
|
| Body:
| {
|   "username": "cashier01",
|   "pin": "1234",
|   "role": "cashier",
|   "branchId": "uuid",
|   "branchIds": ["uuid1", "uuid2"],
|   "defaultBranchId": "uuid1"
| }
|
*/

router.post(
  "/users",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const {
        username,
        pin,
        password,
        role,
        branchId,
        branchIds,
        defaultBranchId
      } = req.body;

      const credential = pin !== undefined ? pin : password;

      if (
        typeof username !== "string" ||
        !username.trim() ||
        credential === undefined ||
        credential === null ||
        String(credential).trim() === ""
      ) {
        return res.status(400).json({
          message: "username and PIN/password are required."
        });
      }

      const normalizedUsername = username.trim();

      const normalizedRole = normalizeRole(role);

      if (!VALID_ROLES.includes(normalizedRole)) {
        return res.status(400).json({
          message: `Invalid role. Allowed roles: ${VALID_ROLES.join(", ")}.`
        });
      }

      if (
        branchIds !== undefined &&
        !Array.isArray(branchIds)
      ) {
        return res.status(400).json({
          message: "branchIds must be an array."
        });
      }

      const existingUser = await prisma.user.findUnique({
        where: {
          tenantId_username: {
            tenantId: req.user.tenantId,
            username: normalizedUsername
          }
        }
      });

      if (existingUser) {
        return res.status(409).json({
          message: "A user with this username already exists in this tenant."
        });
      }

      /*
       * Build unique branch list.
       *
       * branchIds + branchId are combined.
       */
      const requestedBranches = new Set(
        Array.isArray(branchIds)
          ? branchIds.filter(Boolean)
          : []
      );

      if (branchId) {
        requestedBranches.add(branchId);
      }

      /*
       * Determine default branch.
       *
       * Priority:
       * 1. defaultBranchId
       * 2. branchId
       * 3. first branch
       */
      let chosenDefaultBranch =
        defaultBranchId ||
        branchId ||
        [...requestedBranches][0] ||
        null;

      /*
       * If a default branch was provided, make sure it
       * exists in the user's branch list.
       */
      if (chosenDefaultBranch) {
        requestedBranches.add(chosenDefaultBranch);
      }

      const branchesToCreate = [...requestedBranches];

      const rounds = Number(
        process.env.BCRYPT_ROUNDS || 12
      );

      const passwordHash = await bcrypt.hash(
        String(credential),
        rounds
      );

      const user = await prisma.user.create({
        data: {
          tenantId: req.user.tenantId,
          username: normalizedUsername,
          passwordHash,
          role: normalizedRole,
          active: true,
          branchId: chosenDefaultBranch,

          branches: {
            create: branchesToCreate.map((branch) => ({
              branchId: branch,
              isDefault: branch === chosenDefaultBranch
            }))
          }
        },

        include: {
          branches: true
        }
      });

      return res.status(201).json({
        message: "User created successfully.",
        user: sanitizeUser(user)
      });
    } catch (error) {
      console.error("Create user error:", error);

      if (isPrismaUniqueError(error)) {
        return res.status(409).json({
          message: "A user with this username already exists in this tenant."
        });
      }

      return res.status(500).json({
        message: "An error occurred while creating the user."
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| UPDATE USER / STAFF
|--------------------------------------------------------------------------
|
| PATCH /api/auth/users/:id
|
| ADMIN only
|
*/

router.patch(
  "/users/:id",
  authenticateToken,
  authorizeRoles("admin"),
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

      /*
       * First make sure the user belongs to the
       * authenticated admin's tenant.
       */
      const existingUser = await prisma.user.findFirst({
        where: {
          id,
          tenantId: req.user.tenantId
        },
        include: {
          branches: true
        }
      });

      if (!existingUser) {
        return res.status(404).json({
          message: "User not found."
        });
      }

      /*
       * Prevent an admin from removing their own
       * ADMIN role.
       */
      if (
        id === req.user.sub &&
        role !== undefined &&
        normalizeRole(role) !== "ADMIN"
      ) {
        return res.status(400).json({
          message: "You cannot remove your own ADMIN role."
        });
      }

      const data = {};

      /*
       * Username
       */
      if (username !== undefined) {
        if (
          typeof username !== "string" ||
          !username.trim()
        ) {
          return res.status(400).json({
            message: "Username cannot be empty."
          });
        }

        const normalizedUsername = username.trim();

        if (normalizedUsername !== existingUser.username) {
          const duplicateUser = await prisma.user.findUnique({
            where: {
              tenantId_username: {
                tenantId: req.user.tenantId,
                username: normalizedUsername
              }
            }
          });

          if (
            duplicateUser &&
            duplicateUser.id !== existingUser.id
          ) {
            return res.status(409).json({
              message:
                "A user with this username already exists in this tenant."
            });
          }
        }

        data.username = normalizedUsername;
      }

      /*
       * Role
       */
      if (role !== undefined) {
        const normalizedRole = normalizeRole(role);

        if (!VALID_ROLES.includes(normalizedRole)) {
          return res.status(400).json({
            message:
              `Invalid role. Allowed roles: ${VALID_ROLES.join(", ")}.`
          });
        }

        data.role = normalizedRole;
      }

      /*
       * Active status
       */
      if (active !== undefined) {
        if (typeof active !== "boolean") {
          return res.status(400).json({
            message: "active must be a boolean."
          });
        }

        if (
          id === req.user.sub &&
          active === false
        ) {
          return res.status(400).json({
            message: "You cannot deactivate your own account."
          });
        }

        data.active = active;
      }

      /*
       * Credential
       */
      const credential =
        pin !== undefined
          ? pin
          : password;

      if (credential !== undefined) {
        if (
          credential === null ||
          String(credential).trim() === ""
        ) {
          return res.status(400).json({
            message: "PIN/password cannot be empty."
          });
        }

        const rounds = Number(
          process.env.BCRYPT_ROUNDS || 12
        );

        data.passwordHash = await bcrypt.hash(
          String(credential),
          rounds
        );
      }

      /*
       * Branch management
       *
       * If branchIds is supplied, it becomes the
       * new branch list.
       *
       * branchId is also added when supplied.
       */
      let branchesToSet = null;

      if (
        branchIds !== undefined &&
        !Array.isArray(branchIds)
      ) {
        return res.status(400).json({
          message: "branchIds must be an array."
        });
      }

      if (
        Array.isArray(branchIds) ||
        branchId !== undefined ||
        defaultBranchId !== undefined
      ) {
        const branchSet = new Set();

        /*
         * New branchIds.
         */
        if (Array.isArray(branchIds)) {
          branchIds
            .filter(Boolean)
            .forEach((branch) => {
              branchSet.add(branch);
            });
        } else {
          /*
           * If branchIds wasn't supplied, preserve
           * the existing UserBranch records.
           */
          existingUser.branches.forEach((item) => {
            branchSet.add(item.branchId);
          });
        }

        /*
         * Legacy/single branchId.
         */
        if (branchId) {
          branchSet.add(branchId);
        }

        /*
         * Decide the default branch.
         *
         * Priority:
         * 1. explicitly supplied defaultBranchId
         * 2. explicitly supplied branchId
         * 3. existing branchId if still available
         * 4. first branch
         */
        let chosenDefaultBranch;

        if (defaultBranchId !== undefined) {
          chosenDefaultBranch =
            defaultBranchId || null;
        } else if (branchId !== undefined) {
          chosenDefaultBranch =
            branchId || null;
        } else if (
          existingUser.branchId &&
          branchSet.has(existingUser.branchId)
        ) {
          chosenDefaultBranch =
            existingUser.branchId;
        } else {
          chosenDefaultBranch =
            [...branchSet][0] || null;
        }

        /*
         * If a default branch exists, make sure it
         * is part of the branch list.
         */
        if (chosenDefaultBranch) {
          branchSet.add(chosenDefaultBranch);
        }

        branchesToSet = [...branchSet];

        /*
         * Keep User.branchId synchronized with
         * the default branch.
         */
        data.branchId = chosenDefaultBranch;
      }

      /*
       * Update user + branch assignments in one transaction.
       */
      const updatedUser = await prisma.$transaction(
        async (tx) => {
          /*
           * updateMany lets us explicitly keep the
           * tenant boundary in the database operation.
           */
          const updateResult = await tx.user.updateMany({
            where: {
              id,
              tenantId: req.user.tenantId
            },
            data
          });

          if (updateResult.count === 0) {
            throw Object.assign(
              new Error("User not found."),
              {
                code: "P2025"
              }
            );
          }

          /*
           * Replace branch assignments when branch
           * information was supplied.
           */
          if (branchesToSet !== null) {
            await tx.userBranch.deleteMany({
              where: {
                userId: id
              }
            });

            if (branchesToSet.length > 0) {
              await tx.userBranch.createMany({
                data: branchesToSet.map((branch) => ({
                  userId: id,
                  branchId: branch,
                  isDefault:
                    branch === data.branchId
                }))
              });
            }
          }

          return tx.user.findFirst({
            where: {
              id,
              tenantId: req.user.tenantId
            },
            include: {
              branches: true
            }
          });
        }
      );

      return res.status(200).json({
        message: "User updated successfully.",
        user: sanitizeUser(updatedUser)
      });
    } catch (error) {
      console.error("Update user error:", error);

      if (isPrismaUniqueError(error)) {
        return res.status(409).json({
          message:
            "A user with this username already exists in this tenant."
        });
      }

      if (isPrismaNotFoundError(error)) {
        return res.status(404).json({
          message: "User not found."
        });
      }

      return res.status(500).json({
        message: "An error occurred while updating the user."
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| UPDATE USER STATUS
|--------------------------------------------------------------------------
|
| PATCH /api/auth/users/:id/status
|
| ADMIN only
|
| Body:
| {
|   "active": false
| }
|
*/

router.patch(
  "/users/:id/status",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { active } = req.body;

      if (typeof active !== "boolean") {
        return res.status(400).json({
          message: "active must be a boolean."
        });
      }

      /*
       * Prevent admin from deactivating themselves.
       */
      if (
        id === req.user.sub &&
        active === false
      ) {
        return res.status(400).json({
          message: "You cannot deactivate your own account."
        });
      }

      /*
       * Tenant-scoped update.
       */
      const result = await prisma.user.updateMany({
        where: {
          id,
          tenantId: req.user.tenantId
        },
        data: {
          active
        }
      });

      if (result.count === 0) {
        return res.status(404).json({
          message: "User not found."
        });
      }

      const user = await prisma.user.findFirst({
        where: {
          id,
          tenantId: req.user.tenantId
        },
        include: {
          branches: true
        }
      });

      return res.status(200).json({
        message: active
          ? "User activated successfully."
          : "User deactivated successfully.",

        user: sanitizeUser(user)
      });
    } catch (error) {
      console.error("Update user status error:", error);

      return res.status(500).json({
        message:
          "An error occurred while updating the user status."
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| CHANGE USER CREDENTIALS
|--------------------------------------------------------------------------
|
| PATCH /api/auth/users/:id/credentials
|
| ADMIN only
|
| Body:
| {
|   "pin": "5678"
| }
|
*/

router.patch(
  "/users/:id/credentials",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const {
        pin,
        password
      } = req.body;

      const credential =
        pin !== undefined
          ? pin
          : password;

      if (
        credential === undefined ||
        credential === null ||
        String(credential).trim() === ""
      ) {
        return res.status(400).json({
          message: "PIN/password is required."
        });
      }

      /*
       * Verify the user belongs to the
       * authenticated admin's tenant.
       */
      const existingUser = await prisma.user.findFirst({
        where: {
          id,
          tenantId: req.user.tenantId
        }
      });

      if (!existingUser) {
        return res.status(404).json({
          message: "User not found."
        });
      }

      const rounds = Number(
        process.env.BCRYPT_ROUNDS || 12
      );

      const passwordHash = await bcrypt.hash(
        String(credential),
        rounds
      );

      /*
       * Tenant-scoped update.
       */
      const result = await prisma.user.updateMany({
        where: {
          id,
          tenantId: req.user.tenantId
        },
        data: {
          passwordHash
        }
      });

      if (result.count === 0) {
        return res.status(404).json({
          message: "User not found."
        });
      }

      const updatedUser = await prisma.user.findFirst({
        where: {
          id,
          tenantId: req.user.tenantId
        },
        include: {
          branches: true
        }
      });

      return res.status(200).json({
        message: "User credentials updated successfully.",
        user: sanitizeUser(updatedUser)
      });
    } catch (error) {
      console.error(
        "Update user credentials error:",
        error
      );

      return res.status(500).json({
        message:
          "An error occurred while updating user credentials."
      });
    }
  }
);

module.exports = router;