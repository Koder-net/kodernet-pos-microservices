const jwt = require('jsonwebtoken');

/**
 * Basic JWT authentication middleware.
 * Expects an Authorization header in the form: "Bearer <token>"
 *
 * On success, attaches the decoded token payload to req.user.
 * This middleware can be reused by other protected routes/services
 * that need to verify a KODERNET-issued JWT.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token is required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.user = decoded;
    next();
  });
}

/**
 * Basic role-based authorization middleware.
 * Usage: authorizeRoles('admin', 'manager')
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  authorizeRoles,
};
