const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Check if an email is already registered
async function findUserByEmail(email) {
  try {
    const connection = await sql.connect(dbConfig);
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
  }
}

// Create new vendor account
async function createVendor(vendorData) {
  try {
    const connection = await sql.connect(dbConfig);
    const query = `
      INSERT INTO Vendors (business_name, email, phone, password_hash, role, hawker_centre_id, stall_number, approval_status, banner_image)
      VALUES (@business_name, @email, @phone, @password_hash, @role, @hawker_centre_id, @stall_number, @approval_status, @banner_image);
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
    request.input("banner_image", sql.VarChar, vendorData.banner_image || null);

    const result = await request.query(query);

    const newVendorId = result.recordset[0].id;
    return await getVendorById(newVendorId);
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Get vendor by ID (used to return the created record without the password hash)
async function getVendorById(id) {
  try {
    const connection = await sql.connect(dbConfig);
    const query = `
      SELECT id, business_name, email, phone, role, hawker_centre_id, stall_number, approval_status, banner_image, created_at
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
  }
}

// Get full vendor record by email, including password_hash, for login authentication
async function getVendorAuthByEmail(email) {
  try {
    const connection = await sql.connect(dbConfig);
    const query = `
      SELECT id, business_name, email, password_hash, role, approval_status
      FROM Vendors
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
  }
}

// Get the authenticated vendor's stall profile details (including menu and
// add-ons) without requiring approval_status = approved.
async function getVendorStallProfile(vendorId) {
  try {
    const connection = await sql.connect(dbConfig);

    const vendorRequest = connection.request();
    vendorRequest.input("vendor_id", sql.Int, vendorId);
    const vendorResult = await vendorRequest.query(`
      SELECT
        v.id,
        v.business_name,
        v.stall_number,
        v.banner_image,
        ISNULL(AVG(CAST(f.rating AS FLOAT)), 0) AS avg_rating,
        COUNT(f.id) AS review_count
      FROM Vendors v
      LEFT JOIN Feedback f ON f.vendor_id = v.id
      WHERE v.id = @vendor_id
      GROUP BY v.id, v.business_name, v.stall_number, v.banner_image
    `);

    if (vendorResult.recordset.length === 0) {
      return null;
    }

    const menuRequest = connection.request();
    menuRequest.input("vendor_id", sql.Int, vendorId);
    const menuResult = await menuRequest.query(`
      SELECT id, name, price, category, image, created_at
      FROM MenuItems
      WHERE vendor_id = @vendor_id AND is_active = 1
      ORDER BY created_at ASC, id ASC
    `);

    const addOnsRequest = connection.request();
    addOnsRequest.input("vendor_id", sql.Int, vendorId);
    const addOnsResult = await addOnsRequest.query(`
      SELECT mia.menu_item_id, ao.id, ao.name, ao.extra_price
      FROM MenuItemAddOns mia
      JOIN AddOns ao ON mia.add_on_id = ao.id
      JOIN MenuItems mi ON mia.menu_item_id = mi.id
      WHERE mi.vendor_id = @vendor_id
    `);

    const menu = menuResult.recordset.map((item) => ({
      ...item,
      add_ons: addOnsResult.recordset
        .filter((row) => row.menu_item_id === item.id)
        .map((row) => ({ id: row.id, name: row.name, extra_price: row.extra_price })),
    }));

    return {
      vendor: vendorResult.recordset[0],
      menu,
    };
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

async function updateVendorBanner(vendorId, bannerImagePath) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    request.input("banner_image", sql.VarChar, bannerImagePath);

    const result = await request.query(`
      UPDATE Vendors
      SET banner_image = @banner_image
      WHERE id = @vendor_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    return result.recordset[0].affected > 0;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Get all orders for one vendor, newest first, with item summaries and
// customer names resolved for the vendor orders page.
async function getOrdersByVendor(vendorId) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);

    const result = await request.query(`
      SELECT
        o.id AS order_id,
        ROW_NUMBER() OVER (ORDER BY o.created_at ASC, o.id ASC) AS vendor_order_number,
        o.order_status,
        o.total_amount,
        o.payment_method,
        o.payment_status,
        o.packaging_fee,
        o.packaging_type,
        o.packaging_description,
        o.special_request,
        o.include_cutlery,
        o.created_at,
        ISNULL(p.name, 'Guest') AS customer,
        ISNULL(p.email, o.guest_email) AS customer_email,
        STUFF((
          SELECT ', ' + mi.name + CASE WHEN oi.quantity > 1 THEN ' x' + CAST(oi.quantity AS VARCHAR) ELSE '' END
          FROM OrderItems oi
          JOIN MenuItems mi ON oi.menu_item_id = mi.id
          WHERE oi.order_id = o.id
          FOR XML PATH('')
        ), 1, 2, '') AS items
      FROM Orders o
      LEFT JOIN Patrons p ON o.patron_id = p.id
      WHERE o.vendor_id = @vendor_id
      ORDER BY o.created_at DESC, o.id DESC
    `);

    return result.recordset;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Get real overview stats for the vendor dashboard: pending order count,
// menu item count, average rating, today's revenue, and the 5 most recent
// orders (with item names, customer name, packaging, and special request resolved).
async function getVendorOverview(vendorId) {
  try {
    const connection = await sql.connect(dbConfig);

    // Pending order count
    const pendingRequest = connection.request();
    pendingRequest.input("vendor_id", sql.Int, vendorId);
    const pendingResult = await pendingRequest.query(`
      SELECT COUNT(*) AS pending_orders
      FROM Orders
      WHERE vendor_id = @vendor_id AND order_status = 'pending'
    `);

    // Menu item count (only active items — soft-deleted ones shouldn't count)
    const menuRequest = connection.request();
    menuRequest.input("vendor_id", sql.Int, vendorId);
    const menuResult = await menuRequest.query(`
      SELECT COUNT(*) AS menu_items
      FROM MenuItems
      WHERE vendor_id = @vendor_id AND is_active = 1
    `);

    // Average rating across all feedback
    const ratingRequest = connection.request();
    ratingRequest.input("vendor_id", sql.Int, vendorId);
    const ratingResult = await ratingRequest.query(`
      SELECT ISNULL(AVG(CAST(rating AS FLOAT)), 0) AS avg_rating
      FROM Feedback
      WHERE vendor_id = @vendor_id
    `);

    // Today's revenue (completed orders only, placed today)
    const revenueRequest = connection.request();
    revenueRequest.input("vendor_id", sql.Int, vendorId);
    const revenueResult = await revenueRequest.query(`
      SELECT ISNULL(SUM(total_amount), 0) AS today_revenue
      FROM Orders
      WHERE vendor_id = @vendor_id
        AND order_status = 'completed'
        AND CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)
    `);

    // 5 most recent orders, with item names concatenated, customer
    // resolved to the patron's name (or "Guest" if patron_id is NULL),
    // and the packaging choice + special request for this order
    const ordersRequest = connection.request();
    ordersRequest.input("vendor_id", sql.Int, vendorId);
    const ordersResult = await ordersRequest.query(`
      SELECT TOP 5
        o.id AS order_id,
        ROW_NUMBER() OVER (ORDER BY o.created_at ASC, o.id ASC) AS vendor_order_number,
        o.order_status,
        o.created_at,
        o.packaging_type,
        o.packaging_description,
        o.special_request,
        o.include_cutlery,
        ISNULL(p.name, 'Guest') AS customer,
        STUFF((
          SELECT ', ' + mi.name + CASE WHEN oi.quantity > 1 THEN ' x' + CAST(oi.quantity AS VARCHAR) ELSE '' END
          FROM OrderItems oi
          JOIN MenuItems mi ON oi.menu_item_id = mi.id
          WHERE oi.order_id = o.id
          FOR XML PATH('')
        ), 1, 2, '') AS items
      FROM Orders o
      LEFT JOIN Patrons p ON o.patron_id = p.id
      WHERE o.vendor_id = @vendor_id
      ORDER BY o.created_at DESC
    `);

    return {
      pending_orders: pendingResult.recordset[0].pending_orders,
      menu_items: menuResult.recordset[0].menu_items,
      avg_rating: ratingResult.recordset[0].avg_rating,
      today_revenue: revenueResult.recordset[0].today_revenue,
      recent_orders: ordersResult.recordset,
    };
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Update an order's status — only allowed if the order actually belongs
// to this vendor (checked via WHERE ... AND vendor_id = @vendor_id), so a
// vendor can never touch another stall's orders even by guessing an ID
async function updateOrderStatus(orderId, vendorId, newStatus) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("id", sql.Int, orderId);
    request.input("vendor_id", sql.Int, vendorId);
    request.input("status", sql.VarChar, newStatus);

    const result = await request.query(`
      UPDATE Orders SET order_status = @status WHERE id = @id AND vendor_id = @vendor_id;
      SELECT @@ROWCOUNT AS affected;
    `);
    return result.recordset[0].affected > 0;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

module.exports = {
  findUserByEmail,
  createVendor,
  getVendorById,
  getVendorAuthByEmail,
  getVendorStallProfile,
  updateVendorBanner,
  getOrdersByVendor,
  getVendorOverview,
  updateOrderStatus,
};
