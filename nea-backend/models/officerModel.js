const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Get full officer record by email, including password_hash, for login.
// NOTE: updated to match the teammate's Officers table (no badge_number
// column — that was only in the old placeholder NEAOfficers table).
async function getOfficerAuthByEmail(email) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("email", sql.VarChar, email);
    const result = await request.query(`
      SELECT id, name, email, password_hash, role
      FROM Officers
      WHERE email = @email
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

// Get officer by ID (basic info, no password hash)
async function getOfficerById(id) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("id", sql.Int, id);
    const result = await request.query(`
      SELECT id, name, email, role FROM Officers WHERE id = @id
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

module.exports = {
  getOfficerAuthByEmail,
  getOfficerById,
};