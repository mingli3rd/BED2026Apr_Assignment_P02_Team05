const stallMenuModel = require("../models/stallMenuModel");

async function listStalls(req, res) {
  try {
    const { hawker_centre_id, location, search } = req.query;
    const vendors = await stallMenuModel.getApprovedVendors(hawker_centre_id, location, search);
    res.status(200).json(vendors);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading stalls" });
  }
}

// Search/filter hawker centres (used by the "Find a Stall" directory page)
async function searchHawkerCentres(req, res) {
  try {
    const { search, location } = req.query;
    const centres = await stallMenuModel.searchHawkerCentres(search, location);
    res.status(200).json(centres);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading hawker centres" });
  }
}

// Plain unfiltered list of all hawker centres (used to populate the
// location filter dropdown's options)
async function listHawkerCentres(req, res) {
  try {
    const centres = await stallMenuModel.getHawkerCentres();
    res.status(200).json(centres);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading hawker centres" });
  }
}

// Get one hawker centre's info, plus its list of approved stalls
async function getHawkerCentreStalls(req, res) {
  try {
    const centre = await stallMenuModel.getHawkerCentreById(req.params.id);
    if (!centre) {
      return res.status(404).json({ error: "Hawker centre not found" });
    }
    const stalls = await stallMenuModel.getApprovedVendors(req.params.id);
    res.status(200).json({ centre, stalls });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading hawker centre stalls" });
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
  searchHawkerCentres,
  listHawkerCentres,
  getHawkerCentreStalls,
  getStallMenu,
};