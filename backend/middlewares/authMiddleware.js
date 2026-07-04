const jwt = require("jsonwebtoken");

// Verifies the JWT stored in the "token" cookie.
// If valid, attaches the decoded payload to req.vendor and calls next().
// If missing/invalid, responds with 401 and stops the request from proceeding.
function verifyVendorToken(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated. Please log in." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "vendor") {
      return res.status(403).json({ error: "Access denied. Vendor account required." });
    }

    req.vendor = decoded; // { id, email, role }
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ error: "Session expired or invalid. Please log in again." });
  }
}

module.exports = {
  verifyVendorToken,
};
