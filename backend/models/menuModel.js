const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Get all menu items for a vendor, with their assigned cuisines concatenated
async function getMenuItemsByVendor(vendorId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);

    const query = `
      SELECT
        mi.id,
        mi.name,
        mi.price,
        mi.category,
        mi.created_at,
        STUFF((
          SELECT ', ' + c.name
          FROM MenuItemCuisines mic
          JOIN Cuisines c ON mic.cuisine_id = c.id
          WHERE mic.menu_item_id = mi.id
          FOR XML PATH('')
        ), 1, 2, '') AS cuisines
      FROM MenuItems mi
      WHERE mi.vendor_id = @vendor_id AND mi.is_active = 1
      ORDER BY mi.created_at DESC
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

// Get the cuisine IDs currently assigned to a menu item (used to pre-fill the edit form)
async function getCuisineIdsForItem(menuItemId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("menu_item_id", sql.Int, menuItemId);
    const result = await request.query(`
      SELECT cuisine_id FROM MenuItemCuisines WHERE menu_item_id = @menu_item_id
    `);
    return result.recordset.map((row) => row.cuisine_id);
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

// Check whether a menu item with this name already exists for this vendor
// (case-insensitive, trimmed). excludeId lets an update skip checking against itself.
async function findDuplicateByName(vendorId, name, excludeId = null) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    request.input("name", sql.VarChar, name.trim());
    request.input("exclude_id", sql.Int, excludeId);

    const query = `
      SELECT id FROM MenuItems
      WHERE vendor_id = @vendor_id
        AND is_active = 1
        AND LOWER(LTRIM(RTRIM(name))) = LOWER(@name)
        AND (@exclude_id IS NULL OR id != @exclude_id)
    `;
    const result = await request.query(query);
    return result.recordset.length > 0;
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

// Create a new menu item and link it to the given cuisines
async function createMenuItem(vendorId, itemData) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const insertRequest = connection.request();
    insertRequest.input("vendor_id", sql.Int, vendorId);
    insertRequest.input("name", sql.VarChar, itemData.name.trim());
    insertRequest.input("price", sql.Decimal(6, 2), itemData.price);
    insertRequest.input("category", sql.VarChar, itemData.category || null);

    const insertResult = await insertRequest.query(`
      INSERT INTO MenuItems (vendor_id, name, price, category)
      VALUES (@vendor_id, @name, @price, @category);
      SELECT SCOPE_IDENTITY() AS id;
    `);
    const newItemId = insertResult.recordset[0].id;

    // Link cuisines, if any were provided
    if (itemData.cuisine_ids && itemData.cuisine_ids.length > 0) {
      for (const cuisineId of itemData.cuisine_ids) {
        const linkRequest = connection.request();
        linkRequest.input("menu_item_id", sql.Int, newItemId);
        linkRequest.input("cuisine_id", sql.Int, cuisineId);
        await linkRequest.query(`
          INSERT INTO MenuItemCuisines (menu_item_id, cuisine_id)
          VALUES (@menu_item_id, @cuisine_id)
        `);
      }
    }

    return newItemId;
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

// Update an existing menu item and replace its cuisine links
async function updateMenuItem(menuItemId, vendorId, itemData) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);

    const updateRequest = connection.request();
    updateRequest.input("id", sql.Int, menuItemId);
    updateRequest.input("vendor_id", sql.Int, vendorId);
    updateRequest.input("name", sql.VarChar, itemData.name.trim());
    updateRequest.input("price", sql.Decimal(6, 2), itemData.price);
    updateRequest.input("category", sql.VarChar, itemData.category || null);

    await updateRequest.query(`
      UPDATE MenuItems
      SET name = @name, price = @price, category = @category
      WHERE id = @id AND vendor_id = @vendor_id
    `);

    // Replace cuisine links: delete existing, then re-insert the new set
    const deleteRequest = connection.request();
    deleteRequest.input("menu_item_id", sql.Int, menuItemId);
    await deleteRequest.query(`DELETE FROM MenuItemCuisines WHERE menu_item_id = @menu_item_id`);

    if (itemData.cuisine_ids && itemData.cuisine_ids.length > 0) {
      for (const cuisineId of itemData.cuisine_ids) {
        const linkRequest = connection.request();
        linkRequest.input("menu_item_id", sql.Int, menuItemId);
        linkRequest.input("cuisine_id", sql.Int, cuisineId);
        await linkRequest.query(`
          INSERT INTO MenuItemCuisines (menu_item_id, cuisine_id)
          VALUES (@menu_item_id, @cuisine_id)
        `);
      }
    }
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

// "Delete" a menu item (only if it belongs to this vendor). This is a soft
// delete — it sets is_active = 0 rather than removing the row — because a
// hard DELETE would violate the FK constraint on OrderItems for any item
// that has already been ordered, and would destroy historical order data.
async function deleteMenuItem(menuItemId, vendorId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("id", sql.Int, menuItemId);
    request.input("vendor_id", sql.Int, vendorId);

    const result = await request.query(`
      UPDATE MenuItems SET is_active = 0 WHERE id = @id AND vendor_id = @vendor_id;
      SELECT @@ROWCOUNT AS affected;
    `);
    return result.recordset[0].affected > 0;
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

// Get all available cuisines (used to populate the checkbox list in the UI)
async function getAllCuisines() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request().query(`SELECT id, name FROM Cuisines ORDER BY name ASC`);
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
  getMenuItemsByVendor,
  getCuisineIdsForItem,
  findDuplicateByName,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getAllCuisines,
};