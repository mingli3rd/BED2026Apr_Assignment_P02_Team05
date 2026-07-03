const bcrypt = require("bcrypt");
const vendorModel = require("../models/vendorModel");

// Register a new vendor account
async function registerVendor(req, res) {
  try {
    const { business_name, email, phone, password, hawker_centre_id, stall_number } = req.body;

    // Check if the email is already registered
    const existingUser = await vendorModel.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Hash the password before storing it
    const password_hash = await bcrypt.hash(password, 10);

    const newVendor = await vendorModel.createVendor({
      business_name,
      email,
      phone,
      password_hash,
      hawker_centre_id,
      stall_number,
    });

    // TODO: Send confirmation email (mock for now, nodemailer later)
    console.log(`[MOCK EMAIL] Confirmation sent to ${email}`);

    res.status(201).json(newVendor);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error registering vendor" });
  }
}

module.exports = {
  registerVendor,
};