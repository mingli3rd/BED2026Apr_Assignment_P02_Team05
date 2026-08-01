const checkoutModel = require("../models/checkoutModel");
const jwt = require("jsonwebtoken");

// Optionally identify a logged-in patron from the cookie, without requiring
// one — this endpoint supports guest checkout, so we don't use
// verifyPatronToken here (that would reject guests with a 401).
function getOptionalPatronId(req) {
  const token = req.cookies.token;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.role === "patron" ? decoded.id : null;
  } catch (error) {
    return null; // invalid/expired token — treat as guest rather than erroring
  }
}

async function createOrder(req, res) {
  try {
    const { cart_items, payment_method, force_fail, guest_email, vendor_options } = req.body;
    const patronId = getOptionalPatronId(req);

    // vendor_options is keyed by vendor_id: { [vendor_id]: { packaging_option_id: number|null, special_request: "..." } }
    // Sent by the cart/checkout pages — see cart-store.js's per-vendor
    // packaging choice + special request storage. Defaults to {} so
    // existing clients that don't send it still work (falls back to
    // standard packaging, no special request).
    const result = await checkoutModel.createOrdersFromCart(
      patronId,
      cart_items,
      payment_method,
      force_fail,
      guest_email,
      vendor_options || {}
    );

    if (!result.success) {
      // Payment failed — nothing was written, cart stays intact client-side
      return res.status(402).json({ error: result.message });
    }

    res.status(201).json({
      message: result.message,
      orders: result.orders,
      is_guest: !patronId,
    });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error processing your order" });
  }
}

// Guest order tracking: given a list of order IDs (tracked client-side in
// sessionStorage right after checkout), returns their current status.
// No authentication — guests have no account to check against. This is a
// deliberate tradeoff for guest checkout; it relies on order IDs not being
// easily guessable in sequence, which is acceptable for this project's
// scope but is NOT the same security guarantee as a logged-in patron's
// order history (which is scoped strictly to their own patron_id).
async function getGuestOrders(req, res) {
  try {
    const idsParam = req.query.order_ids;
    if (!idsParam) {
      return res.status(400).json({ error: "order_ids query parameter is required" });
    }

    const orderIds = idsParam
      .split(",")
      .map((id) => parseInt(id.trim()))
      .filter((id) => !isNaN(id));

    if (orderIds.length === 0) {
      return res.status(400).json({ error: "No valid order IDs provided" });
    }

    const orders = await checkoutModel.getOrdersByIds(orderIds);
    res.status(200).json(orders);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading orders" });
  }
}

module.exports = {
  createOrder,
  getGuestOrders,
};
