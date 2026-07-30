const performanceModel = require("../models/performanceModel");

const ALLOWED_DAYS = [7, 30, 90];
const DEFAULT_DAYS = 7;

// Get the full stall performance dashboard for the logged-in vendor
// req.vendor is attached by the verifyVendorToken middleware
async function getStallPerformance(req, res) {
  try {
    const vendorId = req.vendor.id;

    const requestedDays = parseInt(req.query.days, 10);
    const days = ALLOWED_DAYS.includes(requestedDays) ? requestedDays : DEFAULT_DAYS;

    // Run these one at a time rather than with Promise.all.
    // mssql shares a single global connection pool across calls to
    // sql.connect(), so running them in parallel causes a race where
    // one function's connection.close() closes the shared pool while
    // the others are still mid-query (ECONNCLOSED).
    const sales = await performanceModel.getSalesSummary(vendorId, days);
    const topItems = await performanceModel.getTopSellingItems(vendorId);
    const feedback = await performanceModel.getFeedbackSummary(vendorId);
    const complaints = await performanceModel.getComplaintsSummary(vendorId);

    res.status(200).json({
      sales,
      top_items: topItems,
      feedback,
      complaints,
    });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading stall performance data" });
  }
}

module.exports = {
  getStallPerformance,
};