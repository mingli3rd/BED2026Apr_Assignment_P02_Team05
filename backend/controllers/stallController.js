const stallMenuModel = require("../models/stallMenuModel");

async function listStalls(req, res) {
  try {
    const vendors = await stallMenuModel.getApprovedVendors();
    res.status(200).json(vendors);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading stalls" });
  }
}

async function getStallMenu(req, res) {
  try {
    const vendor = await stallMenuModel.getVendorInfo(req.params.vendorId);
    if (!vendor) {
      return res.status(404).json({ error: "Stall not found" });
    }
    const menu = await stallMenuModel.getActiveMenuByVendor(req.params.vendorId);
    res.status(200).json({ vendor, menu });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading stall menu" });
  }
}

module.exports = {
  listStalls,
  getStallMenu,
};