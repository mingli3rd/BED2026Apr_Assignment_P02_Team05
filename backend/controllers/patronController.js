const bcrypt = require("bcrypt");
const patronModel = require("../models/patronModel");

// Register a new patron account
async function registerPatron(req, res) {
  try {
    const { name, email, phone, password } = req.body;

    // Check if the email is already registered
    const existingUser = await patronModel.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Hash the password before storing it
    const password_hash = await bcrypt.hash(password, 10);

    const newPatron = await patronModel.createPatron({
      name,
      email,
      phone,
      password_hash,
    });

    // TODO: Send email verification link (mock for now, nodemailer later)
    console.log(`[MOCK EMAIL] Verification link sent to ${email}`);

    res.status(201).json(newPatron);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error registering patron" });
  }
}

module.exports = {
  registerPatron,
};