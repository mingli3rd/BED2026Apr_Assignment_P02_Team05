const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Get all rental agreements for a vendor, newest first, with days until
// expiry computed directly in SQL so the app doesn't need to do date math
// on every row in JS.
async function getAgreementsByVendor(vendorId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);

    const query = `
      SELECT
        id,
        start_date,
        end_date,
        monthly_rent,
        status,
        notes,
        created_at,
        DATEDIFF(DAY, CAST(GETDATE() AS DATE), end_date) AS days_until_expiry
      FROM RentalAgreements
      WHERE vendor_id = @vendor_id
      ORDER BY end_date DESC
    `;
    const result = await request.query(query);
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
  getAgreementsByVendor,
};