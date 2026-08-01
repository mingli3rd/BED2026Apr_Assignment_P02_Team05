const sql = require("mssql");
const dbConfig = require("../dbConfig");

// HCMP-30: Schedule Inspection — creates the row with status 'scheduled',
// no score/remarks/conducted_at yet. The UQ_Inspections_Vendor_Date unique
// index (vendor_id, scheduled_date) stops double-booking the same stall
// on the same day at the database level.
async function scheduleInspection(vendorId, officerId, scheduledDate) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    request.input("officer_id", sql.Int, officerId);
    request.input("scheduled_date", sql.Date, scheduledDate);

    const result = await request.query(`
      INSERT INTO Inspections (vendor_id, officer_id, scheduled_date, status)
      OUTPUT INSERTED.*
      VALUES (@vendor_id, @officer_id, @scheduled_date, 'scheduled')
    `);
    return result.recordset[0];
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { console.error("Error closing connection:", err); }
    }
  }
}

// For the Conduct & Log page — this officer's own inspections still
// awaiting a result, oldest scheduled date first.
async function getUpcomingInspectionsByOfficer(officerId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("officer_id", sql.Int, officerId);
    const result = await request.query(`
      SELECT i.id, i.vendor_id, v.business_name, v.stall_number, i.scheduled_date
      FROM Inspections i
      JOIN Vendors v ON i.vendor_id = v.id
      WHERE i.officer_id = @officer_id AND i.status = 'scheduled'
      ORDER BY i.scheduled_date ASC
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

// Look up one inspection — used to check ownership/status before letting
// an officer log a result against it.
async function getInspectionById(inspectionId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("inspection_id", sql.Int, inspectionId);
    const result = await request.query(`
      SELECT id, vendor_id, officer_id, scheduled_date, status, score, remarks, conducted_at
      FROM Inspections
      WHERE id = @inspection_id
    `);
    return result.recordset[0] || null;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { console.error("Error closing connection:", err); }
    }
  }
}

// HCMP-31: Conduct & Log Inspection — records score + remarks against a
// previously scheduled inspection and flips its status to 'completed'.
// No grade is issued here (that's HCMP-32, a separate later step).
async function logInspectionResult(inspectionId, score, remarks) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("inspection_id", sql.Int, inspectionId);
    request.input("score", sql.Int, score);
    request.input("remarks", sql.VarChar(500), remarks || null);

    const result = await request.query(`
      UPDATE Inspections
      SET score = @score, remarks = @remarks, status = 'completed', conducted_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE id = @inspection_id
    `);
    return result.recordset[0] || null;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { console.error("Error closing connection:", err); }
    }
  }
}

// "My Inspections" history — every inspection this officer has touched,
// both scheduled (not yet conducted) and completed, newest scheduled_date
// first.
async function getInspectionsByOfficer(officerId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("officer_id", sql.Int, officerId);
    const result = await request.query(`
      SELECT i.id, i.vendor_id, v.business_name, i.status,
             i.scheduled_date, i.conducted_at, i.score, i.remarks
      FROM Inspections i
      JOIN Vendors v ON i.vendor_id = v.id
      WHERE i.officer_id = @officer_id
      ORDER BY i.scheduled_date DESC
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

// Get every stall registered on the platform (for the officer's schedule form)
async function getAllVendorsForInspection() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request().query(`
      SELECT id, business_name, stall_number, approval_status FROM Vendors ORDER BY business_name
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
  scheduleInspection,
  getUpcomingInspectionsByOfficer,
  getInspectionById,
  logInspectionResult,
  getInspectionsByOfficer,
  getAllVendorsForInspection,
};