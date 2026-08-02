const sql = require("mssql");
const dbConfig = require("../dbConfig");

// List all approved vendors (for the stall picker on the browse page).
// Optionally filtered by hawker_centre_id or location, for the location filter.
async function getApprovedVendors(hawkerCentreId, location, search) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();

    let query = `
      SELECT
        v.id, v.business_name, v.stall_number, v.banner_image,
        hc.id AS hawker_centre_id, hc.name AS hawker_centre_name, hc.location,
        ISNULL(AVG(CAST(f.rating AS FLOAT)), 0) AS avg_rating,
        COUNT(f.id) AS review_count
      FROM Vendors v
      LEFT JOIN HawkerCentres hc ON v.hawker_centre_id = hc.id
      LEFT JOIN Feedback f ON f.vendor_id = v.id
      WHERE v.approval_status = 'approved'
    `;

    if (hawkerCentreId) {
      request.input("hawker_centre_id", sql.Int, hawkerCentreId);
      query += ` AND v.hawker_centre_id = @hawker_centre_id`;
    }

    if (location) {
      request.input("location", sql.VarChar, location);
      query += ` AND hc.location = @location`;
    }

    if (search) {
      request.input("search", sql.VarChar, `%${search}%`);
      query += ` AND v.business_name LIKE @search`;
    }

    query += ` GROUP BY v.id, v.business_name, v.stall_number, v.banner_image, hc.id, hc.name, hc.location`;
    query += ` ORDER BY v.business_name ASC`;

    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Search hawker centres by name and/or location, with a count of how many
// approved stalls are currently at each — this powers the "Find a Stall"
// directory's search results.
async function searchHawkerCentres(search, location) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();

    let query = `
      SELECT
        hc.id,
        hc.name,
        hc.location,
        hc.cover_image,
        COUNT(v.id) AS stall_count
      FROM HawkerCentres hc
      LEFT JOIN Vendors v ON v.hawker_centre_id = hc.id AND v.approval_status = 'approved'
      WHERE 1 = 1
    `;

    if (search) {
      request.input("search", sql.VarChar, `%${search}%`);
      query += ` AND (hc.name LIKE @search OR hc.location LIKE @search)`;
    }

    if (location) {
      request.input("location", sql.VarChar, location);
      query += ` AND hc.location = @location`;
    }

    query += ` GROUP BY hc.id, hc.name, hc.location, hc.cover_image ORDER BY hc.name ASC`;

    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Get a single hawker centre's info (for the header of the "stalls in this
// centre" page)
async function getHawkerCentreById(hawkerCentreId) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("id", sql.Int, hawkerCentreId);
    const result = await request.query(`
      SELECT id, name, location, cover_image FROM HawkerCentres WHERE id = @id
    `);
    return result.recordset[0] || null;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// List all hawker centres (for populating the location filter dropdown)
async function getHawkerCentres() {
  try {
    const connection = await sql.connect(dbConfig);
    const result = await connection.request().query(`
      SELECT id, name, location, cover_image FROM HawkerCentres ORDER BY location, name
    `);
    return result.recordset;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Get a vendor's basic info (for the stall page header)
async function getVendorInfo(vendorId) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    const result = await request.query(`
      SELECT
        v.id, v.business_name, v.stall_number, v.banner_image,
        ISNULL(AVG(CAST(f.rating AS FLOAT)), 0) AS avg_rating,
        COUNT(f.id) AS review_count
      FROM Vendors v
      LEFT JOIN Feedback f ON f.vendor_id = v.id
      WHERE v.id = @vendor_id AND v.approval_status = 'approved'
      GROUP BY v.id, v.business_name, v.stall_number, v.banner_image
    `);
    return result.recordset[0] || null;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Get a vendor's active menu items, each with its available add-ons nested in
async function getActiveMenuByVendor(vendorId) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);

    const itemsResult = await request.query(`
      SELECT id, name, price, category, image
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
  }
}

module.exports = {
  getApprovedVendors,
  getHawkerCentres,
  searchHawkerCentres,
  getHawkerCentreById,
  getVendorInfo,
  getActiveMenuByVendor,
};
