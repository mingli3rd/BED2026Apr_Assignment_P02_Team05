const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Add an item to a patron's persisted cart, along with any selected add-ons
async function addToCart(patronId, { menu_item_id, vendor_id, quantity, add_on_ids }) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);

    const insertRequest = connection.request();
    insertRequest.input("patron_id", sql.Int, patronId);
    insertRequest.input("menu_item_id", sql.Int, menu_item_id);
    insertRequest.input("vendor_id", sql.Int, vendor_id);
    insertRequest.input("quantity", sql.Int, quantity);

    const insertResult = await insertRequest.query(`
      INSERT INTO CartItems (patron_id, menu_item_id, vendor_id, quantity)
      VALUES (@patron_id, @menu_item_id, @vendor_id, @quantity);
      SELECT SCOPE_IDENTITY() AS id;
    `);
    const cartItemId = insertResult.recordset[0].id;

    if (add_on_ids && add_on_ids.length > 0) {
      for (const addOnId of add_on_ids) {
        const linkRequest = connection.request();
        linkRequest.input("cart_item_id", sql.Int, cartItemId);
        linkRequest.input("add_on_id", sql.Int, addOnId);
        await linkRequest.query(`
          INSERT INTO CartItemAddOns (cart_item_id, add_on_id) VALUES (@cart_item_id, @add_on_id)
        `);
      }
    }

    return cartItemId;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { console.error("Error closing connection:", err); }
    }
  }
}

// Get a patron's full persisted cart (mainly used for future "load my cart on
// another device" support — the site's own UI relies on localStorage today)
async function getCartByPatron(patronId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("patron_id", sql.Int, patronId);
    const result = await request.query(`
      SELECT ci.id, ci.menu_item_id, ci.vendor_id, ci.quantity, mi.name, mi.price, v.business_name AS vendor_name
      FROM CartItems ci
      JOIN MenuItems mi ON ci.menu_item_id = mi.id
      JOIN Vendors v ON ci.vendor_id = v.id
      WHERE ci.patron_id = @patron_id
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

// Update the quantity of a cart item (only if it belongs to this patron)
async function updateQuantity(cartItemId, patronId, quantity) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("id", sql.Int, cartItemId);
    request.input("patron_id", sql.Int, patronId);
    request.input("quantity", sql.Int, quantity);
    await request.query(`
      UPDATE CartItems SET quantity = @quantity WHERE id = @id AND patron_id = @patron_id
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

// Remove a single item from the cart (only if it belongs to this patron)
async function removeCartItem(cartItemId, patronId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("id", sql.Int, cartItemId);
    request.input("patron_id", sql.Int, patronId);
    await request.query(`
      DELETE FROM CartItems WHERE id = @id AND patron_id = @patron_id
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

// Clear a patron's entire cart (called after successful checkout)
async function clearCart(patronId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("patron_id", sql.Int, patronId);
    await request.query(`DELETE FROM CartItems WHERE patron_id = @patron_id`);
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
  addToCart,
  getCartByPatron,
  updateQuantity,
  removeCartItem,
  clearCart,
};