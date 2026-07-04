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

// Get full patron record by email, including password_hash, for login authentication
async function getPatronAuthByEmail(email) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const query = `
      SELECT id, name, email, password_hash, role
      FROM Patrons
      WHERE email = @email
    `;
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

// Get order history for a patron, with item names and vendor (stall) name
// resolved, newest first — used for the "My Orders" page.
async function getOrdersByPatron(patronId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("patron_id", sql.Int, patronId);

    const query = `
      SELECT
        o.id AS order_id,
        o.order_status,
        o.total_amount,
        o.created_at,
        v.business_name AS vendor_name,
        STUFF((
          SELECT ', ' + mi.name + CASE WHEN oi.quantity > 1 THEN ' x' + CAST(oi.quantity AS VARCHAR) ELSE '' END
          FROM OrderItems oi
          JOIN MenuItems mi ON oi.menu_item_id = mi.id
          WHERE oi.order_id = o.id
          FOR XML PATH('')
        ), 1, 2, '') AS items
      FROM Orders o
      JOIN Vendors v ON o.vendor_id = v.id
      WHERE o.patron_id = @patron_id
      ORDER BY o.created_at DESC
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
  findUserByEmail,
  createPatron,
  getPatronById,
  getPatronAuthByEmail,
  getOrdersByPatron,
};