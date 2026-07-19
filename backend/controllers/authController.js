const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const vendorModel = require("../models/vendorModel");
const patronModel = require("../models/patronModel");

async function login(req, res) {
  try {
    const { email, password, remember_me, expected_role } = req.body;

    const shouldCheckVendor = !expected_role || expected_role === "vendor";
    const shouldCheckPatron = !expected_role || expected_role === "patron";

    if (shouldCheckVendor) {
      const vendor = await vendorModel.getVendorAuthByEmail(email);

      if (vendor) {
        const passwordMatches = await bcrypt.compare(password, vendor.password_hash);
        if (!passwordMatches) {
          return res.status(401).json({ error: "Invalid email or password" });
        }

        if (vendor.approval_status === "pending") {
          return res.status(403).json({ error: "Your account is still pending approval." });
        }
        if (vendor.approval_status === "rejected") {
          return res.status(403).json({ error: "Your account application was not approved." });
        }

        return issueToken(res, {
          id: vendor.id,
          email: vendor.email,
          role: "vendor",
        }, remember_me, {
          id: vendor.id,
          business_name: vendor.business_name,
          email: vendor.email,
          role: "vendor",
        });
      }
    }

    if (shouldCheckPatron) {
      const patron = await patronModel.getPatronAuthByEmail(email);

      if (patron) {
        const passwordMatches = await bcrypt.compare(password, patron.password_hash);
        if (!passwordMatches) {
          return res.status(401).json({ error: "Invalid email or password" });
        }

        return issueToken(res, {
          id: patron.id,
          email: patron.email,
          role: "patron",
        }, remember_me, {
          id: patron.id,
          name: patron.name,
          email: patron.email,
          role: "patron",
        });
      }
    }

    // No match in the table(s) we were allowed to check — same generic
    // message either way, so we don't reveal whether an email exists
    return res.status(401).json({ error: "Invalid email or password" });

  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error logging in" });
  }
}

// Signs a JWT for the given payload and sets it as an HTTP-only cookie.
function issueToken(res, tokenPayload, rememberMe, responseUser) {
  const expiresIn = rememberMe ? "30d" : "1d";
  const maxAgeMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn });

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: maxAgeMs,
  });

  const responseKey = tokenPayload.role === "vendor" ? "vendor" : "patron";
  res.status(200).json({
    message: "Login successful",
    [responseKey]: responseUser,
  });
}

// Log out: clear the auth cookie (works the same for both roles)
function logout(req, res) {
  res.clearCookie("token");
  res.status(200).json({ message: "Logged out successfully" });
}

// Returns the currently logged-in vendor's basic info.
function getCurrentVendor(req, res) {
  res.status(200).json({
    vendor: {
      id: req.vendor.id,
      email: req.vendor.email,
      role: req.vendor.role,
    },
  });
}

// Returns the currently logged-in patron's basic info.
function getCurrentPatron(req, res) {
  res.status(200).json({
    patron: {
      id: req.patron.id,
      email: req.patron.email,
      role: req.patron.role,
    },
  });
}

module.exports = {
  login,
  logout,
  getCurrentVendor,
  getCurrentPatron,
};