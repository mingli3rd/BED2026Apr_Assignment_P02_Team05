const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const officerModel = require("../models/officerModel");

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const officer = await officerModel.getOfficerAuthByEmail(email);

    if (!officer) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const passwordMatches = await bcrypt.compare(password, officer.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: officer.id, email: officer.email, role: "nea_officer" },
      process.env.NEA_JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("nea_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: "Login successful",
      officer: {
        id: officer.id,
        name: officer.name,
        email: officer.email,
        badge_number: officer.badge_number,
      },
    });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error logging in" });
  }
}

function logout(req, res) {
  res.clearCookie("nea_token");
  res.status(200).json({ message: "Logged out successfully" });
}

async function getCurrentOfficer(req, res) {
  res.status(200).json({
    officer: {
      id: req.officer.id,
      email: req.officer.email,
      role: req.officer.role,
    },
  });
}

module.exports = {
  login,
  logout,
  getCurrentOfficer,
};