const menuModel = require("../models/menuModel");

// List all menu items for the logged-in vendor
async function listMenuItems(req, res) {
  try {
    const items = await menuModel.getMenuItemsByVendor(req.vendor.id);
    res.status(200).json(items);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading menu items" });
  }
}

// Get the cuisine IDs for one menu item (used to pre-fill the edit form)
async function getItemCuisines(req, res) {
  try {
    const cuisineIds = await menuModel.getCuisineIdsForItem(req.params.id);
    res.status(200).json({ cuisine_ids: cuisineIds });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading item cuisines" });
  }
}

// Create a new menu item
async function createMenuItem(req, res) {
  try {
    const { name, price, category, cuisine_ids } = req.body;
    const vendorId = req.vendor.id;

    // Reject duplicate item names for this vendor
    const isDuplicate = await menuModel.findDuplicateByName(vendorId, name);
    if (isDuplicate) {
      return res.status(409).json({ error: "You already have a menu item with this name." });
    }

    const newItemId = await menuModel.createMenuItem(vendorId, { name, price, category, cuisine_ids });
    res.status(201).json({ id: newItemId, message: "Menu item created successfully" });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error creating menu item" });
  }
}

// Update an existing menu item
async function updateMenuItem(req, res) {
  try {
    const { name, price, category, cuisine_ids } = req.body;
    const vendorId = req.vendor.id;
    const itemId = req.params.id;

    // Reject duplicate item names for this vendor (excluding the item being edited)
    const isDuplicate = await menuModel.findDuplicateByName(vendorId, name, itemId);
    if (isDuplicate) {
      return res.status(409).json({ error: "You already have a menu item with this name." });
    }

    await menuModel.updateMenuItem(itemId, vendorId, { name, price, category, cuisine_ids });
    res.status(200).json({ message: "Menu item updated successfully" });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error updating menu item" });
  }
}

// Delete a menu item
async function deleteMenuItem(req, res) {
  try {
    const deleted = await menuModel.deleteMenuItem(req.params.id, req.vendor.id);

    if (!deleted) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    res.status(200).json({ message: "Menu item deleted successfully" });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error deleting menu item" });
  }
}

// List all available cuisines (for populating the checkbox list in the UI)
async function listCuisines(req, res) {
  try {
    const cuisines = await menuModel.getAllCuisines();
    res.status(200).json(cuisines);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading cuisines" });
  }
}

module.exports = {
  listMenuItems,
  getItemCuisines,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  listCuisines,
};