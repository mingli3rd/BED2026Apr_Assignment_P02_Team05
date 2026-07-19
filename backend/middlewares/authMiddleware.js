const jwt = require("jsonwebtoken");


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

// Verifies the JWT stored in the "token" cookie for patron-only routes.
// Mirrors verifyVendorToken, but requires role === "patron" and attaches
// the decoded payload to req.patron instead.
function verifyPatronToken(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated. Please log in." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "patron") {
      return res.status(403).json({ error: "Access denied. Patron account required." });
    }

    req.patron = decoded; // { id, email, role }
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ error: "Session expired or invalid. Please log in again." });
  }
}

module.exports = {
  verifyVendorToken,
  verifyPatronToken,
};