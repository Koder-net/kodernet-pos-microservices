const jwt = require("jsonwebtoken");


function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication token required" });
  }

  const token = authorization.substring("Bearer ".length).trim();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.sub,
      username: decoded.username,
      role: String(decoded.role || "").toLowerCase(),
      tenantId: decoded.tenantId,
      branchId: decoded.branchId || null
    };

    if (!req.user.id || !req.user.tenantId) {
      return res.status(401).json({ message: "Invalid authentication token" });
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function authorizeRoles(...allowedRoles) {
  const normalizedRoles = allowedRoles.map((role) => role.toLowerCase());

  return (req, res, next) => {
    if (!req.user || !normalizedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  authorizeRoles
};