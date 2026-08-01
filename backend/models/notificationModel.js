const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Generic notification creator. Reusable by any feature - complaints today,
// order notifications or queue updates later - so every feature writes to
// the Notifications table the same way instead of duplicating insert logic.
async function createNotification({ vendorId = null, patronId = null, guestIdentifier = null, type, referenceId = null, message }) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    request.input("patron_id", sql.Int, patronId);
    request.input("guest_identifier", sql.VarChar, guestIdentifier);
    request.input("type", sql.VarChar, type);
    request.input("reference_id", sql.Int, referenceId);
    request.input("message", sql.VarChar, message);

    await request.query(`
      INSERT INTO Notifications (vendor_id, patron_id, guest_identifier, type, reference_id, message)
      VALUES (@vendor_id, @patron_id, @guest_identifier, @type, @reference_id, @message);
    `);
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { console.error("Error closing connection:", err); }
    }
  }
}

// Get a vendor's notifications, newest first
async function getNotificationsByVendor(vendorId, unreadOnly) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    const result = await request.query(`
      SELECT id, type, reference_id, message, is_read, created_at
      FROM Notifications
      WHERE vendor_id = @vendor_id
      ${unreadOnly ? "AND is_read = 0" : ""}
      ORDER BY created_at DESC
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

// Count of unread notifications for a vendor - powers the dashboard bell badge
async function getUnreadCountByVendor(vendorId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    const result = await request.query(`
      SELECT COUNT(*) AS unread_count
      FROM Notifications
      WHERE vendor_id = @vendor_id AND is_read = 0
    `);
    return result.recordset[0].unread_count;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { console.error("Error closing connection:", err); }
    }
  }
}

// Mark one notification as read (scoped to the owning vendor)
async function markNotificationRead(notificationId, vendorId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("id", sql.Int, notificationId);
    request.input("vendor_id", sql.Int, vendorId);
    const result = await request.query(`
      UPDATE Notifications SET is_read = 1
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

// Mark all of a vendor's notifications as read (the "Mark all read" button)
async function markAllNotificationsRead(vendorId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    await request.query(`
      UPDATE Notifications SET is_read = 1 WHERE vendor_id = @vendor_id AND is_read = 0;
    `);
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
  createNotification,
  getNotificationsByVendor,
  getUnreadCountByVendor,
  markNotificationRead,
  markAllNotificationsRead,
};
