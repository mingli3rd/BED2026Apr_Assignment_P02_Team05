const patronModel = require("../models/patronModel");
const profileModel = require("../models/profileModel");

// Get the logged-in patron's profile info
async function getProfile(req, res) {
  try {
    const patron = await patronModel.getPatronById(req.patron.id);
    if (!patron) {
      return res.status(404).json({ error: "Patron not found" });
    }
    res.status(200).json({ patron });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading profile" });
  }
}

// Update the logged-in patron's name/phone
async function updateProfile(req, res) {
  try {
    const { name, phone } = req.body;
    await profileModel.updateProfile(req.patron.id, name, phone);
    const patron = await patronModel.getPatronById(req.patron.id);
    res.status(200).json({ message: "Profile updated successfully", patron });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error updating profile" });
  }
}

module.exports = {
  getProfile,
  updateProfile,
};
