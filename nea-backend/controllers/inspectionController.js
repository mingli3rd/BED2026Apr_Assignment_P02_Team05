const inspectionModel = require("../models/inspectionModel");
const hygieneGradeModel = require("../models/hygieneGradeModel");

// List all stalls, for the officer to pick from when logging a new inspection
async function listVendorsForInspection(req, res) {
  try {
    const vendors = await inspectionModel.getAllVendorsForInspection();
    res.status(200).json(vendors);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading stalls" });
  }
}

// Record a new inspection (auto-generates the resulting hygiene grade)
async function recordInspection(req, res) {
  try {
    const { vendor_id, score, remarks } = req.body;

    if (!vendor_id || score === undefined || score === null) {
      return res.status(400).json({ error: "vendor_id and score are required." });
    }

    if (score < 0 || score > 100) {
      return res.status(400).json({ error: "Score must be between 0 and 100." });
    }

    const result = await inspectionModel.createInspection(vendor_id, req.officer.id, score, remarks);

    res.status(201).json({
      message: `Inspection recorded. Hygiene grade issued: ${result.grade}`,
      ...result,
    });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error recording inspection" });
  }
}

// Get this officer's own inspection history
async function getMyInspections(req, res) {
  try {
    const inspections = await inspectionModel.getInspectionsByOfficer(req.officer.id);
    res.status(200).json(inspections);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading inspections" });
  }
}

// Get a specific vendor's full hygiene grade history.
// Used by BOTH the officer route (auth-protected) and the public route
// (no auth) — same handler, since the data is the same either way.
async function getVendorGradeHistory(req, res) {
  try {
    const history = await hygieneGradeModel.getGradeHistoryByVendor(req.params.vendorId);
    res.status(200).json(history);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading grade history" });
  }
}

// Public: current hygiene grade for every approved stall (no auth — this
// is meant to be consumed by the main hawker hub site's public pages)
async function getPublicHygieneGrades(req, res) {
  try {
    const grades = await hygieneGradeModel.getCurrentGradesForAllVendors();
    res.status(200).json(grades);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading hygiene grades" });
  }
}

module.exports = {
  listVendorsForInspection,
  recordInspection,
  getMyInspections,
  getVendorGradeHistory,
  getPublicHygieneGrades,
};