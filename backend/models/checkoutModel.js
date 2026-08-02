const sql = require("mssql");
const dbConfig = require("../dbConfig");

const PACKAGING_FEE_PER_ITEM = 0.30;

// Mock payment gateway. Real bank integration is handled by another team
// (per the assignment's case study), so this simulates a response instead.
// force_fail lets the checkout UI deliberately demo the failure state
// without relying on random chance.
function mockPaymentGateway(paymentMethod, forceFail) {
  if (forceFail) {
    return { success: false, message: "Payment declined. Please check your payment details and try again." };
  }
  return { success: true, message: "Payment approved." };
}

// Takes a flat cart array and groups it by vendor_id — this is the "handle
// separate orders for different vendors" logic. Each group becomes one
// Orders row, even though the customer checked out once.
function groupCartByVendor(cartItems) {
  const groups = {};
  for (const item of cartItems) {
    if (!groups[item.vendor_id]) {
      groups[item.vendor_id] = [];
    }
    groups[item.vendor_id].push(item);
  }
  return groups;
}

// Looks up a specific packaging option, verifying it belongs to this vendor
// and is still enabled (the vendor may have changed/disabled it between
// the customer loading the cart page and checking out).
async function getEnabledPackagingOption(connection, optionId, vendorId) {
  const request = connection.request();
  request.input("id", sql.Int, optionId);
  request.input("vendor_id", sql.Int, vendorId);
  const result = await request.query(`
    SELECT id, description, surcharge FROM PackagingOptions
    WHERE id = @id AND vendor_id = @vendor_id AND is_enabled = 1
  `);
  return result.recordset[0] || null;
}

// Works out the packaging type/description/fee for one vendor's order group.
//
// The $0.30/item fee is the standard takeaway packaging charge and always
// applies. Choosing an eco-friendly option ADDS that option's own per-item
// surcharge on top — it doesn't replace the base fee, since the base fee
// covers takeaway packaging generally and the eco surcharge is specifically
// for choosing the sustainable option.
function resolvePackaging(items, requestedOptionId, packagingOption) {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const standardFee = itemCount * PACKAGING_FEE_PER_ITEM;

  if (requestedOptionId && packagingOption) {
    const ecoFeePerItem = PACKAGING_FEE_PER_ITEM + Number(packagingOption.surcharge);
    return {
      packaging_type: "eco",
      packaging_description: packagingOption.description,
      packaging_option_id: packagingOption.id,
      packaging_fee: itemCount * ecoFeePerItem,
    };
  }

  // Either the customer chose standard, or they asked for an eco option
  // that's no longer available (deleted/disabled between page load and
  // checkout) — fall back to standard rather than silently failing the
  // whole order.
  return {
    packaging_type: "standard",
    packaging_description: "Standard packaging",
    packaging_option_id: null,
    packaging_fee: standardFee,
  };
}

// Inserts directly using the connection already in use in createOrdersFromCart,
// rather than calling notificationModel.createNotification() separately —
// keeps everything for one checkout on one connection, one request at a time.
async function pushOrderNotification(connection, vendorId, orderId, message) {
  const request = connection.request();
  request.input("vendor_id", sql.Int, vendorId);
  request.input("type", sql.VarChar, "new_order");
  request.input("reference_id", sql.Int, orderId);
  request.input("message", sql.VarChar, message);
  await request.query(`
    INSERT INTO Notifications (vendor_id, type, reference_id, message)
    VALUES (@vendor_id, @type, @reference_id, @message)
  `);
}

// Creates one Order (+ OrderItems + OrderItemAddOns) per vendor group,
// after a successful mock payment. patronId may be null for guest checkout.
// vendorOptions is keyed by vendor_id: { [vendor_id]: { packaging_type, special_request } }
async function createOrdersFromCart(patronId, cartItems, paymentMethod, forceFail, guestEmail, vendorOptions = {}) {
  const paymentResult = mockPaymentGateway(paymentMethod, forceFail);

  if (!paymentResult.success) {
    // Nothing is written to the database on a failed payment — the cart
    // stays intact on the client so the customer can retry.
    return { success: false, message: paymentResult.message, orders: [] };
  }

  const groups = groupCartByVendor(cartItems);
  const createdOrders = [];

  try {
    const connection = await sql.connect(dbConfig);

    for (const vendorId of Object.keys(groups)) {
      const items = groups[vendorId];
      const options = vendorOptions[vendorId] || {};

      const itemsSubtotal = items.reduce((sum, item) => {
        const addOnsTotal = (item.add_ons || []).reduce((s, a) => s + Number(a.extra_price), 0);
        return sum + (Number(item.price) + addOnsTotal) * item.quantity;
      }, 0);

      const packagingOption = options.packaging_option_id
        ? await getEnabledPackagingOption(connection, options.packaging_option_id, vendorId)
        : null;
      const packaging = resolvePackaging(items, options.packaging_option_id, packagingOption);
      const orderTotal = itemsSubtotal + packaging.packaging_fee;

      const specialRequest = (options.special_request || "").trim().slice(0, 500) || null;
      const includeCutlery = options.include_cutlery !== false; // defaults to true (include cutlery) unless explicitly opted out

      // Look up the vendor's business name for the response summary
      const vendorRequest = connection.request();
      vendorRequest.input("vendor_id", sql.Int, vendorId);
      const vendorResult = await vendorRequest.query(`SELECT business_name FROM Vendors WHERE id = @vendor_id`);
      const vendorName = vendorResult.recordset[0]?.business_name || "Unknown Stall";

      // Create the Order
      const orderRequest = connection.request();
      orderRequest.input("vendor_id", sql.Int, vendorId);
      orderRequest.input("patron_id", sql.Int, patronId || null);
      orderRequest.input("order_status", sql.VarChar, "pending");
      orderRequest.input("total_amount", sql.Decimal(8, 2), orderTotal);
      orderRequest.input("payment_method", sql.VarChar, paymentMethod);
      orderRequest.input("payment_status", sql.VarChar, "success");
      orderRequest.input("packaging_fee", sql.Decimal(6, 2), packaging.packaging_fee);
      orderRequest.input("packaging_type", sql.VarChar, packaging.packaging_type);
      orderRequest.input("packaging_description", sql.VarChar, packaging.packaging_description);
      orderRequest.input("packaging_option_id", sql.Int, packaging.packaging_option_id);
      orderRequest.input("special_request", sql.VarChar, specialRequest);
      orderRequest.input("include_cutlery", sql.Bit, includeCutlery ? 1 : 0);
      orderRequest.input("guest_email", sql.VarChar, guestEmail || null);

      const orderResult = await orderRequest.query(`
        INSERT INTO Orders (
          vendor_id, patron_id, order_status, total_amount, payment_method, payment_status,
          packaging_fee, packaging_type, packaging_description, packaging_option_id, special_request, include_cutlery, guest_email
        )
        VALUES (
          @vendor_id, @patron_id, @order_status, @total_amount, @payment_method, @payment_status,
          @packaging_fee, @packaging_type, @packaging_description, @packaging_option_id, @special_request, @include_cutlery, @guest_email
        );
        SELECT SCOPE_IDENTITY() AS id;
      `);
      const orderId = orderResult.recordset[0].id;

      // Create each OrderItem, and its selected add-ons
      for (const item of items) {
        const addOnsTotal = (item.add_ons || []).reduce((s, a) => s + Number(a.extra_price), 0);
        const lineSubtotal = (Number(item.price) + addOnsTotal) * item.quantity;

        const itemRequest = connection.request();
        itemRequest.input("order_id", sql.Int, orderId);
        itemRequest.input("menu_item_id", sql.Int, item.menu_item_id);
        itemRequest.input("quantity", sql.Int, item.quantity);
        itemRequest.input("subtotal", sql.Decimal(8, 2), lineSubtotal);

        const itemResult = await itemRequest.query(`
          INSERT INTO OrderItems (order_id, menu_item_id, quantity, subtotal)
          VALUES (@order_id, @menu_item_id, @quantity, @subtotal);
          SELECT SCOPE_IDENTITY() AS id;
        `);
        const orderItemId = itemResult.recordset[0].id;

        for (const addOn of item.add_ons || []) {
          const addOnRequest = connection.request();
          addOnRequest.input("order_item_id", sql.Int, orderItemId);
          addOnRequest.input("add_on_id", sql.Int, addOn.id);
          addOnRequest.input("add_on_name", sql.VarChar, addOn.name);
          addOnRequest.input("add_on_price", sql.Decimal(6, 2), addOn.extra_price);
          await addOnRequest.query(`
            INSERT INTO OrderItemAddOns (order_item_id, add_on_id, add_on_name, add_on_price)
            VALUES (@order_item_id, @add_on_id, @add_on_name, @add_on_price)
          `);
        }
      }

      // Push a real-time notification to the vendor as soon as their order lands
      const itemsSummary = items.map((item) => `${item.quantity}x ${item.name}`).join(", ");
      const orderMessage = specialRequest
        ? `New order #${orderId}: ${itemsSummary} — Note: "${specialRequest}"`
        : `New order #${orderId}: ${itemsSummary}`;
      await pushOrderNotification(connection, vendorId, orderId, orderMessage);

      createdOrders.push({
        order_id: orderId,
        vendor_name: vendorName,
        subtotal: itemsSubtotal,
        packaging_fee: packaging.packaging_fee,
        packaging_type: packaging.packaging_type,
        packaging_description: packaging.packaging_description,
        special_request: specialRequest,
        include_cutlery: includeCutlery,
        total: orderTotal,
      });
    }

    return { success: true, message: paymentResult.message, orders: createdOrders };
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Fetch specific orders by ID, for guest order tracking within the same
// browser session. There's no patron_id check here (guests have no login),
// so this relies on order IDs being hard to guess sequentially — an
// acceptable tradeoff for a school project's guest-checkout flow, but
// worth flagging: this is NOT the same security guarantee as a logged-in
// patron's order history, which is scoped to their own patron_id.
async function getOrdersByIds(orderIds) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();

    // Build a parameterised IN clause safely (no string concatenation of user input)
    const idParams = orderIds.map((id, index) => {
      request.input(`id${index}`, sql.Int, id);
      return `@id${index}`;
    });

    const query = `
      SELECT
        o.id AS order_id,
        o.order_status,
        o.total_amount,
        o.payment_status,
        o.packaging_type,
        o.packaging_description,
        o.special_request,
        o.include_cutlery,
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
      WHERE o.id IN (${idParams.join(", ")})
      ORDER BY o.created_at DESC
    `;
    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

module.exports = {
  createOrdersFromCart,
  getOrdersByIds,
  groupCartByVendor,
  resolvePackaging,
};
