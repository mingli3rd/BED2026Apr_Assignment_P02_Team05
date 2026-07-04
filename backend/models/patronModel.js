const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Check if an email is already registered
async function findUserByEmail(email) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const query = "SELECT id, email FROM Patrons WHERE email = @email";
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

// Create new patron account
async function createPatron(patronData) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const query = `
      INSERT INTO Patrons (name, email, phone, password_hash, role)
      VALUES (@name, @email, @phone, @password_hash, @role);
      SELECT SCOPE_IDENTITY() AS id;
    `;
    const request = connection.request();
    request.input("name", sql.VarChar, patronData.name);
    request.input("email", sql.VarChar, patronData.email);
    request.input("phone", sql.VarChar, patronData.phone || null);
    request.input("password_hash", sql.VarChar, patronData.password_hash);
    request.input("role", sql.VarChar, "patron");

    const result = await request.query(query);

    const newPatronId = result.recordset[0].id;
    return await getPatronById(newPatronId);
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

// Get patron by ID (used to return the created record without the password hash)
async function getPatronById(id) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const query = `
      SELECT id, name, email, phone, role, created_at
      FROM Patrons
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
  createPatron,
  getPatronById,
};