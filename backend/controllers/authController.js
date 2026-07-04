const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const vendorModel = require("../models/vendorModel");

// Log in a vendor: verify credentials, issue a JWT stored in an HTTP-only cookie
async function loginVendor(req, res) {
  try {
    const { email, password, remember_me } = req.body;

    // Look up the vendor record, including the password hash
    const vendor = await vendorModel.getVendorAuthByEmail(email);

    // Use a generic error message for both "no such user" and "wrong password"
    // so we don't reveal which emails are registered (basic security practice)
    if (!vendor) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const passwordMatches = await bcrypt.compare(password, vendor.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Block login if the vendor account hasn't been approved yet
    if (vendor.approval_status === "pending") {
      return res.status(403).json({ error: "Your account is still pending approval." });
    }

    if (vendor.approval_status === "rejected") {
      return res.status(403).json({ error: "Your account application was not approved." });
    }

    // Build the JWT payload (never include the password hash in the token)
    const payload = {
      id: vendor.id,
      email: vendor.email,
      role: vendor.role,
    };

    // "Remember me" extends the token/cookie lifetime from 1 day to 30 days
    const expiresIn = remember_me ? "30d" : "1d";
    const maxAgeMs = remember_me ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });

    // Store the token in an HTTP-only cookie so client-side JS can't read it (XSS protection)
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // only send over HTTPS in production
      sameSite: "lax",
      maxAge: maxAgeMs,
    });

    res.status(200).json({
      message: "Login successful",
      vendor: {
        id: vendor.id,
        business_name: vendor.business_name,
        email: vendor.email,
        role: vendor.role,
      },
    });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error logging in" });
  }
}

// Log out: clear the auth cookie
function logout(req, res) {
  res.clearCookie("token");
  res.status(200).json({ message: "Logged out successfully" });
}

// Returns the currently logged-in vendor's basic info.
// Protected by verifyVendorToken — if there's no valid cookie, that
// middleware already responds with 401 before this function even runs.
function getCurrentVendor(req, res) {
  res.status(200).json({
    vendor: {
      id: req.vendor.id,
      email: req.vendor.email,
      role: req.vendor.role,
    },
  });
}

module.exports = {
  loginVendor,
  logout,
  getCurrentVendor,
};