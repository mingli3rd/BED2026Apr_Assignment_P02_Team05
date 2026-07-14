const jwt = require("jsonwebtoken");

function verifyOfficerToken(req, res, next) {
  const token = req.cookies.nea_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated. Please log in." });
  }

  try {
    const decoded = jwt.verify(token, process.env.NEA_JWT_SECRET);

    if (decoded.role !== "nea_officer") {
      return res.status(403).json({ error: "Access denied. NEA officer account required." });
    }

    req.officer = decoded; // { id, email, role }
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ error: "Session expired or invalid. Please log in again." });
  }
}

module.exports = {
  verifyOfficerToken,
};