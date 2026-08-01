const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Get ALL of a vendor's packaging options (including disabled ones) — used
// by the vendor's own management page, where they need to see and re-enable
// something they'd previously turned off.
async function getOptionsByVendor(vendorId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    const result = await request.query(`
      SELECT id, vendor_id, description, surcharge, is_enabled, updated_at
      FROM PackagingOptions
      WHERE vendor_id = @vendor_id
      ORDER BY id DESC
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

// Public: only the currently-enabled options for a vendor — this is what
// customers pick from on the stall page, cart, and checkout.
async function getEnabledOptionsByVendor(vendorId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    const result = await request.query(`
      SELECT id, description, surcharge
      FROM PackagingOptions
      WHERE vendor_id = @vendor_id AND is_enabled = 1
      ORDER BY surcharge ASC
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

// Used by checkout to verify a chosen option actually belongs to this
// vendor and is still enabled, and to get its current surcharge/description
// (in case the vendor changed it since the customer loaded the cart page).
async function getEnabledOptionById(optionId, vendorId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("id", sql.Int, optionId);
    request.input("vendor_id", sql.Int, vendorId);
    const result = await request.query(`
      SELECT id, description, surcharge
      FROM PackagingOptions
      WHERE id = @id AND vendor_id = @vendor_id AND is_enabled = 1
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

// Create a new packaging option for a vendor
async function createOption(vendorId, { description, surcharge, is_enabled }) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    request.input("description", sql.VarChar, description.trim());
    request.input("surcharge", sql.Decimal(6, 2), surcharge);
    request.input("is_enabled", sql.Bit, is_enabled === false ? 0 : 1);

    const result = await request.query(`
      INSERT INTO PackagingOptions (vendor_id, description, surcharge, is_enabled)
      VALUES (@vendor_id, @description, @surcharge, @is_enabled);
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

// Update an existing option. Scoped to vendor_id so a vendor can never
// edit another stall's packaging options even by guessing an id.
async function updateOption(optionId, vendorId, { description, surcharge, is_enabled }) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("id", sql.Int, optionId);
    request.input("vendor_id", sql.Int, vendorId);
    request.input("description", sql.VarChar, description.trim());
    request.input("surcharge", sql.Decimal(6, 2), surcharge);
    request.input("is_enabled", sql.Bit, is_enabled ? 1 : 0);

    const result = await request.query(`
      UPDATE PackagingOptions
      SET description = @description, surcharge = @surcharge, is_enabled = @is_enabled, updated_at = GETDATE()
      WHERE id = @id AND vendor_id = @vendor_id;
      SELECT @@ROWCOUNT AS affected;
    `);
    return result.recordset[0].affected > 0;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { console.error("Error closing connection:", err); }
    }
  }
}

// Soft-delete (disable) an option rather than hard-deleting it — same
// reasoning as MenuItems' soft delete: past orders may reference this via
// Orders.packaging_option_id (FK_Orders_PackagingOption), so removing the
// row outright would break historical order data.
async function disableOption(optionId, vendorId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("id", sql.Int, optionId);
    request.input("vendor_id", sql.Int, vendorId);

    const result = await request.query(`
      UPDATE PackagingOptions SET is_enabled = 0, updated_at = GETDATE()
      WHERE id = @id AND vendor_id = @vendor_id;
      SELECT @@ROWCOUNT AS affected;
    `);
    return result.recordset[0].affected > 0;
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
  getOptionsByVendor,
  getEnabledOptionsByVendor,
  getEnabledOptionById,
  createOption,
  updateOption,
  disableOption,
};
