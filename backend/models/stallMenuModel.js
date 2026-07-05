const sql = require("mssql");
const dbConfig = require("../dbConfig");

// List all approved vendors (for the stall picker on the browse page)
async function getApprovedVendors() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request().query(`
      SELECT id, business_name, stall_number
      FROM Vendors
      WHERE approval_status = 'approved'
      ORDER BY business_name ASC
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

// Get a vendor's basic info (for the stall page header)
async function getVendorInfo(vendorId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    const result = await request.query(`
      SELECT id, business_name, stall_number
      FROM Vendors
      WHERE id = @vendor_id AND approval_status = 'approved'
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

// Get a vendor's active menu items, each with its available add-ons nested in
async function getActiveMenuByVendor(vendorId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);

    const itemsResult = await request.query(`
      SELECT id, name, price, category
      FROM MenuItems
      WHERE vendor_id = @vendor_id AND is_active = 1
      ORDER BY category, name
    `);

    const items = itemsResult.recordset;

    // Fetch add-ons for all items in one query, then group them in JS
    const addOnsRequest = connection.request();
    addOnsRequest.input("vendor_id", sql.Int, vendorId);
    const addOnsResult = await addOnsRequest.query(`
      SELECT mia.menu_item_id, ao.id, ao.name, ao.extra_price
      FROM MenuItemAddOns mia
      JOIN AddOns ao ON mia.add_on_id = ao.id
      JOIN MenuItems mi ON mia.menu_item_id = mi.id
      WHERE mi.vendor_id = @vendor_id
    `);

    return items.map((item) => ({
      ...item,
      add_ons: addOnsResult.recordset
        .filter((row) => row.menu_item_id === item.id)
        .map((row) => ({ id: row.id, name: row.name, extra_price: row.extra_price })),
    }));
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
  getApprovedVendors,
  getVendorInfo,
  getActiveMenuByVendor,
};