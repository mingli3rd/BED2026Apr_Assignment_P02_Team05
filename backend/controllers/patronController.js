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

// Get order history for the logged-in patron ("My Orders" page).
// req.patron is attached by the verifyPatronToken middleware.
async function getPatronOrders(req, res) {
  try {
    const patron = await patronModel.getPatronById(req.patron.id);

    if (!patron) {
      return res.status(404).json({ error: "Patron not found" });
    }

    const orders = await patronModel.getOrdersByPatron(req.patron.id);

    res.status(200).json({
      patron,
      welcome_message: `Welcome back, ${patron.name}!`,
      orders,
    });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading order history" });
  }
}

module.exports = {
  registerPatron,
  getPatronOrders,
};