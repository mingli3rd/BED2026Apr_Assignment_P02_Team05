const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Get a vendor's full hygiene grade history, newest first, directly from the main database.
async function getGradeHistoryByVendor(vendorId) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    const result = await request.query(`
      SELECT
        hg.id,
        hg.grade,
        hg.issued_date AS valid_from,
        hg.expiry_date AS valid_to,
        i.score,
        i.remarks,
        i.conducted_at AS inspection_date
      FROM HygieneGrades hg
      JOIN Inspections i ON hg.inspection_id = i.id
      WHERE hg.vendor_id = @vendor_id
      ORDER BY hg.issued_date DESC
    `);
    return result.recordset;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Get just a vendor's single most recent hygiene grade — used by the public
// stall page badge, so it doesn't need the full history, and doesn't
// depend on the separate NEA service being up (this reads the same
// HygieneGrades/Inspections tables directly, since they live in the same
// database as the rest of the app).
async function getCurrentGradeByVendor(vendorId) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    const result = await request.query(`
      SELECT TOP 1
        hg.grade,
        hg.issued_date AS valid_from,
        hg.expiry_date AS valid_to
      FROM HygieneGrades hg
      WHERE hg.vendor_id = @vendor_id
      ORDER BY hg.issued_date DESC
    `);
    return result.recordset[0] || null;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

module.exports = {
  getGradeHistoryByVendor,
  getCurrentGradeByVendor,
};
