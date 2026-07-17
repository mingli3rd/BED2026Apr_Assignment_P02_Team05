const feedbackModel = require("../models/feedbackModel");

// Submit feedback for a vendor
async function submitFeedback(req, res) {
  try {
    const { vendor_id, rating, comment } = req.body;
    const feedbackId = await feedbackModel.createFeedback(req.patron.id, vendor_id, rating, comment);
    res.status(201).json({ id: feedbackId, message: "Thank you for your feedback!" });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error submitting feedback" });
  }
}

// List vendors this patron has ordered from (for the "leave feedback" list)
async function getOrderedVendors(req, res) {
  try {
    const vendors = await feedbackModel.getOrderedVendorsByPatron(req.patron.id);
    res.status(200).json(vendors);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading your stalls" });
  }
}

// List feedback this patron has already submitted
async function getMyFeedback(req, res) {
  try {
    const feedback = await feedbackModel.getFeedbackByPatron(req.patron.id);
    res.status(200).json(feedback);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading your feedback" });
  }
}

module.exports = {
  submitFeedback,
  getOrderedVendors,
  getMyFeedback,
};