const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Create a new feedback entry (rating + optional comment) for a vendor
async function createFeedback(patronId, vendorId, rating, comment) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("patron_id", sql.Int, patronId);
    request.input("vendor_id", sql.Int, vendorId);
    request.input("rating", sql.Int, rating);
    request.input("comment", sql.VarChar, comment || null);

    const result = await request.query(`
      INSERT INTO Feedback (vendor_id, patron_id, rating, comment)
      VALUES (@vendor_id, @patron_id, @rating, @comment);
      SELECT SCOPE_IDENTITY() AS id;
    `);
    return result.recordset[0].id;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { console.error("Error closing connection:", err); }
    }
  }
}

// Get every vendor this patron has actually ordered from (so the feedback
// page only offers to review stalls they've genuinely eaten at)
async function getOrderedVendorsByPatron(patronId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("patron_id", sql.Int, patronId);
    const result = await request.query(`
      SELECT DISTINCT v.id AS vendor_id, v.business_name
      FROM Orders o
      JOIN Vendors v ON o.vendor_id = v.id
      WHERE o.patron_id = @patron_id
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

// Get all feedback this patron has submitted, newest first
async function getFeedbackByPatron(patronId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("patron_id", sql.Int, patronId);
    const result = await request.query(`
      SELECT f.id, f.vendor_id, v.business_name, f.rating, f.comment, f.created_at
      FROM Feedback f
      JOIN Vendors v ON f.vendor_id = v.id
      WHERE f.patron_id = @patron_id
      ORDER BY f.created_at DESC
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
  createFeedback,
  getOrderedVendorsByPatron,
  getFeedbackByPatron,
};