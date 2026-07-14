const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Get a vendor's full hygiene grade history, newest first
async function getGradeHistoryByVendor(vendorId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    const result = await request.query(`
      SELECT hg.id, hg.grade, hg.valid_from, hg.valid_to, i.score, i.remarks, i.inspection_date
      FROM HygieneGrades hg
      JOIN Inspections i ON hg.inspection_id = i.id
      WHERE hg.vendor_id = @vendor_id
      ORDER BY hg.valid_from DESC
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

// Get every vendor's CURRENT (most recent, still-valid) hygiene grade —
// used for a public-facing "hygiene grades" directory
async function getCurrentGradesForAllVendors() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request().query(`
      SELECT
        v.id AS vendor_id,
        v.business_name,
        hg.grade,
        hg.valid_from,
        hg.valid_to
      FROM Vendors v
      OUTER APPLY (
        SELECT TOP 1 grade, valid_from, valid_to
        FROM HygieneGrades
        WHERE vendor_id = v.id
        ORDER BY valid_from DESC
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