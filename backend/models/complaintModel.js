const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Create a new complaint against a vendor. patronId is null for guest complaints
// (Complaints.patron_id is nullable in the schema for exactly this reason).
async function createComplaint(vendorId, patronId, description) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    request.input("patron_id", sql.Int, patronId || null);
    request.input("description", sql.VarChar, description);

    const result = await request.query(`
      INSERT INTO Complaints (vendor_id, patron_id, description)
      VALUES (@vendor_id, @patron_id, @description);
      SELECT SCOPE_IDENTITY() AS id;
    `);
    return result.recordset[0].id;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// List complaints lodged against a vendor's stall, newest first (vendor dashboard use)
async function getComplaintsByVendor(vendorId) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    const result = await request.query(`
      SELECT c.id, c.description, c.status, c.created_at, p.name AS patron_name
      FROM Complaints c
      LEFT JOIN Patrons p ON c.patron_id = p.id
      WHERE c.vendor_id = @vendor_id
      ORDER BY c.created_at DESC
    `);
    return result.recordset;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Update a complaint's status. Scoped to vendor_id so a vendor can only
// ever update complaints filed against their own stall.
async function updateComplaintStatus(complaintId, vendorId, status) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("id", sql.Int, complaintId);
    request.input("vendor_id", sql.Int, vendorId);
    request.input("status", sql.VarChar, status);
    const result = await request.query(`
      UPDATE Complaints SET status = @status
      WHERE id = @id AND vendor_id = @vendor_id;
      SELECT @@ROWCOUNT AS affected;
    `);
    return result.recordset[0].affected > 0;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

module.exports = {
  createComplaint,
  getComplaintsByVendor,
  updateComplaintStatus,
};
