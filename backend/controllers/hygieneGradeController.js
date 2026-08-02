const hygieneGradeModel = require("../models/hygieneGradeModel");

// Public: current hygiene grade for a stall (the badge next to the stall
// name). No auth — any customer/guest can see this. Returns
// { has_grade: false } rather than a 404 when a stall has no grade yet,
// since that's a normal, expected state, not an error.
async function getPublicCurrentGrade(req, res) {
  try {
    const grade = await hygieneGradeModel.getCurrentGradeByVendor(req.params.vendorId);
    if (!grade) {
      return res.status(200).json({ has_grade: false });
    }
    res.status(200).json({ has_grade: true, ...grade });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading hygiene grade" });
  }
}

// Public: full grade history for a stall, for the dropdown on the stall page.
async function getPublicGradeHistory(req, res) {
  try {
    const history = await hygieneGradeModel.getGradeHistoryByVendor(req.params.vendorId);
    res.status(200).json(history);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading hygiene grade history" });
  }
}

module.exports = {
  getPublicCurrentGrade,
  getPublicGradeHistory,
};
