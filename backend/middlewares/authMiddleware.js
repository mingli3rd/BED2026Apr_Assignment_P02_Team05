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

// NEW: Optional auth for routes that must work for BOTH logged-in patrons
// and guests (e.g. submitting a complaint). Unlike verifyPatronToken, this
// never blocks the request - it just attaches req.patron when a valid
// patron cookie happens to be present, and silently continues otherwise.
function attachPatronIfPresent(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return next(); // no cookie at all - proceed as guest
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role === "patron") {
      req.patron = decoded; // { id, email, role }
    }
    // if it's a vendor token, or anything else, just ignore it and continue as guest
  } catch (error) {
    // expired/invalid token - don't error out, just treat as guest
  }
  next();
}

module.exports = {
  verifyVendorToken,
  verifyPatronToken,
  attachPatronIfPresent,
};
