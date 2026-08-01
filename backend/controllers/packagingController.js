const packagingModel = require("../models/packagingModel");

// Vendor: list ALL of their own options (including disabled ones, so they
// can re-enable something later)
async function getMyOptions(req, res) {
  try {
    const options = await packagingModel.getOptionsByVendor(req.vendor.id);
    res.status(200).json(options);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading packaging options" });
  }
}

// Vendor: add a new packaging option
async function createMyOption(req, res) {
  try {
    const { description, surcharge, is_enabled } = req.body;
    const newId = await packagingModel.createOption(req.vendor.id, { description, surcharge, is_enabled });
    res.status(201).json({ id: newId, message: "Packaging option created" });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error creating packaging option" });
  }
}

// Vendor: update one of their own options
async function updateMyOption(req, res) {
  try {
    const { description, surcharge, is_enabled } = req.body;
    const updated = await packagingModel.updateOption(req.params.id, req.vendor.id, { description, surcharge, is_enabled });
    if (!updated) {
      return res.status(404).json({ error: "Packaging option not found" });
    }
    res.status(200).json({ message: "Packaging option updated" });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error updating packaging option" });
  }
}

// Vendor: disable (soft-delete) one of their own options
async function deleteMyOption(req, res) {
  try {
    const deleted = await packagingModel.disableOption(req.params.id, req.vendor.id);
    if (!deleted) {
      return res.status(404).json({ error: "Packaging option not found" });
    }
    res.status(200).json({ message: "Packaging option removed" });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error removing packaging option" });
  }
}

// Public: list a vendor's currently-enabled options — used by the stall
// page (badge), cart, and checkout. Always 200; an empty array just means
// this stall doesn't offer eco packaging, which is the normal case.
async function listPublicOptions(req, res) {
  try {
    const options = await packagingModel.getEnabledOptionsByVendor(req.params.vendorId);
    res.status(200).json(options.map((o) => ({ ...o, surcharge: Number(o.surcharge) })));
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading packaging options" });
  }
}

module.exports = {
  getMyOptions,
  createMyOption,
  updateMyOption,
  deleteMyOption,
  listPublicOptions,
};
