const inspectionModel = require("../models/inspectionModel");
const hygieneGradeModel = require("../models/hygieneGradeModel");

// GET /api/nea/vendors — stall dropdown for the Schedule Inspection form
async function listVendorsForInspection(req, res) {
  try {
    const vendors = await inspectionModel.getAllVendorsForInspection();
    res.status(200).json(vendors);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading stalls" });
  }
}

// POST /api/nea/inspections — HCMP-30 Schedule Inspection
async function scheduleInspection(req, res) {
  try {
    const { vendor_id, scheduled_date } = req.body;

    if (!vendor_id || !scheduled_date) {
      return res.status(400).json({ error: "Stall and date are required." });
    }

    const inspection = await inspectionModel.scheduleInspection(vendor_id, req.officer.id, scheduled_date);
    res.status(201).json({ message: "Inspection scheduled successfully.", inspection });
  } catch (error) {
    // SQL Server unique-index violation (vendor_id, scheduled_date)
    if (error.number === 2601 || error.number === 2627) {
      return res.status(409).json({ error: "This stall already has an inspection scheduled for that date." });
    }
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error scheduling inspection" });
  }
}

// GET /api/nea/inspections/upcoming — feeds the Conduct & Log page's list
async function listUpcomingInspections(req, res) {
  try {
    const inspections = await inspectionModel.getUpcomingInspectionsByOfficer(req.officer.id);
    res.status(200).json(inspections);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading upcoming inspections" });
  }
}

// PUT /api/nea/inspections/:id/result — HCMP-31 Conduct & Log Inspection
async function logInspectionResult(req, res) {
  try {
    const { id } = req.params;
    const { score, remarks } = req.body;

    if (score === undefined || score === null || isNaN(score) || score < 0 || score > 100) {
      return res.status(400).json({ error: "Score must be a number between 0 and 100." });
    }

    const inspection = await inspectionModel.getInspectionById(id);
    if (!inspection) {
      return res.status(404).json({ error: "Inspection not found." });
    }
    if (inspection.officer_id !== req.officer.id) {
      return res.status(403).json({ error: "You can only log results for inspections you scheduled." });
    }
    if (inspection.status === "completed") {
      return res.status(409).json({ error: "This inspection has already been logged." });
    }

    const updated = await inspectionModel.logInspectionResult(id, score, remarks);
    res.status(200).json({ message: "Inspection result logged successfully.", inspection: updated });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error logging inspection result" });
  }
}

// GET /api/nea/inspections/mine — "My Inspections" history page
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
  scheduleInspection,
  listUpcomingInspections,
  logInspectionResult,
  getMyInspections,
  getVendorGradeHistory,
  getPublicHygieneGrades,
};