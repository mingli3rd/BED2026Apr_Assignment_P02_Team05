const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Check if an email is already registered
async function findUserByEmail(email) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const query = "SELECT id, email FROM Vendors WHERE email = @email";
    const request = connection.request();
    request.input("email", sql.VarChar, email);
    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return null;
    }

    return result.recordset[0];
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

// Create new vendor account
async function createVendor(vendorData) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const query = `
      INSERT INTO Vendors (business_name, email, phone, password_hash, role, hawker_centre_id, stall_number, approval_status)
      VALUES (@business_name, @email, @phone, @password_hash, @role, @hawker_centre_id, @stall_number, @approval_status);
      SELECT SCOPE_IDENTITY() AS id;
    `;
    const request = connection.request();
    request.input("business_name", sql.VarChar, vendorData.business_name);
    request.input("email", sql.VarChar, vendorData.email);
    request.input("phone", sql.VarChar, vendorData.phone);
    request.input("password_hash", sql.VarChar, vendorData.password_hash);
    request.input("role", sql.VarChar, "vendor");
    request.input("hawker_centre_id", sql.Int, vendorData.hawker_centre_id || null);
    request.input("stall_number", sql.VarChar, vendorData.stall_number || null);
    request.input("approval_status", sql.VarChar, "pending");

    const result = await request.query(query);

    const newVendorId = result.recordset[0].id;
    return await getVendorById(newVendorId);
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

// Get vendor by ID (used to return the created record without the password hash)
async function getVendorById(id) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const query = `
      SELECT id, business_name, email, phone, role, hawker_centre_id, stall_number, approval_status, created_at
      FROM Vendors
      WHERE id = @id
    `;
    const request = connection.request();
    request.input("id", sql.Int, id);
    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return null;
    }

    return result.recordset[0];
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
  findUserByEmail,
  createVendor,
  getVendorById,
};