const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Get a vendor's full hygiene grade history, newest first, directly from the main database.
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
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }
    }
  }
}

module.exports = {
  getGradeHistoryByVendor,
};