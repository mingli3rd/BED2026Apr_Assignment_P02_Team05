const sql = require("mssql");
const dbConfig = require("../dbConfig");

// NOTE ON CONNECTIONS: sql.connect(dbConfig) returns ONE shared, app-wide
// connection pool — every model file gets back the same instance, not a
// private connection of its own. Calling connection.close() here (as this
// file used to) tears down that shared pool for the ENTIRE app, not just
// this function's own query — so any other request still mid-query at
// that moment fails with a "Connection is closed"/aborted error. The pool
// should simply stay open for the app's lifetime; it's already closed
// exactly once, correctly, in app.js's SIGINT handler on shutdown.

// Add an item to a patron's persisted cart, along with any selected add-ons
async function addToCart(patronId, { menu_item_id, vendor_id, quantity, add_on_ids }) {
  try {
    const connection = await sql.connect(dbConfig);

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
  }
}

// Get a patron's full persisted cart (mainly used for future "load my cart on
// another device" support — the site's own UI relies on localStorage today)
async function getCartByPatron(patronId) {
  try {
    const connection = await sql.connect(dbConfig);
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
  }
}

// Update the quantity of a cart item (only if it belongs to this patron)
async function updateQuantity(cartItemId, patronId, quantity) {
  try {
    const connection = await sql.connect(dbConfig);
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
  }
}

// Remove a single item from the cart (only if it belongs to this patron)
async function removeCartItem(cartItemId, patronId) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("id", sql.Int, cartItemId);
    request.input("patron_id", sql.Int, patronId);
    await request.query(`
      DELETE FROM CartItems WHERE id = @id AND patron_id = @patron_id
    `);
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Clear a patron's entire cart (called after successful checkout)
async function clearCart(patronId) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("patron_id", sql.Int, patronId);
    await request.query(`DELETE FROM CartItems WHERE patron_id = @patron_id`);
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

module.exports = {
  addToCart,
  getCartByPatron,
  updateQuantity,
  removeCartItem,
  clearCart,
};
