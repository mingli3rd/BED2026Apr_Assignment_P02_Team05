const favouriteModel = require("../models/favouriteModel");

async function addFavourite(req, res) {
  try {
    await favouriteModel.addFavourite(req.patron.id, req.body.vendor_id);
    res.status(201).json({ message: "Added to favourites" });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error adding favourite" });
  }
}

async function removeFavourite(req, res) {
  try {
    await favouriteModel.removeFavourite(req.patron.id, req.params.vendorId);
    res.status(200).json({ message: "Removed from favourites" });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error removing favourite" });
  }
}

async function getFavouriteIds(req, res) {
  try {
    const ids = await favouriteModel.getFavouriteVendorIds(req.patron.id);
    res.status(200).json({ vendor_ids: ids });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading favourites" });
  }
}

async function listFavourites(req, res) {
  try {
    const favourites = await favouriteModel.getFavouritesByPatron(req.patron.id);
    res.status(200).json(favourites);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading favourites" });
  }
}

module.exports = {
  addFavourite,
  removeFavourite,
  getFavouriteIds,
  listFavourites,
};
