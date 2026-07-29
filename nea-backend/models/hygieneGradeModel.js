const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Get a vendor's full hygiene grade history, newest first.
// Matches the teammate's schema (issued_date / expiry_date columns,
// Inspections.conducted_at for the inspection date) — aliased back to
// valid_from / valid_to / inspection_date in the SELECT so nothing
// downstream (API response shape, front-end code) needs to change.
async function getGradeHistoryByVendor(vendorId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
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
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { console.error("Error closing connection:", err); }
    }
  }
}

// Get every vendor's CURRENT (most recent) hygiene grade — used by the
// public, no-auth endpoint that the main hawker hub site's patron-facing
// pages fetch from cross-origin.
async function getCurrentGradesForAllVendors() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request().query(`
      SELECT
        v.id AS vendor_id,
        v.business_name,
        hg.grade,
        hg.issued_date AS valid_from,
        hg.expiry_date AS valid_to
      FROM Vendors v
      OUTER APPLY (
        SELECT TOP 1 grade, issued_date, expiry_date
        FROM HygieneGrades
        WHERE vendor_id = v.id
        ORDER BY issued_date DESC
      ) hg
      WHERE v.approval_status = 'approved'
      ORDER BY v.business_name
    `);
    return result.recordset;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { console.error("Error closing connection:", err); }
    }
  }
}

module.exports = {
  getGradeHistoryByVendor,
  getCurrentGradesForAllVendors,
};