const bcrypt = require("bcrypt");
const vendorModel = require("../models/vendorModel");

// Register a new vendor account
async function registerVendor(req, res) {
  try {
    const { business_name, email, phone, password, hawker_centre_id, stall_number } = req.body;

    // The banner image is required — multer (uploadBannerImage middleware)
    // runs before this controller and populates req.file if one was sent
    if (!req.file) {
      return res.status(400).json({ error: "A stall banner image is required." });
    }

    // Check if the email is already registered
    const existingUser = await vendorModel.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Hash the password before storing it
    const password_hash = await bcrypt.hash(password, 10);

    // Store the path relative to the uploads folder (not the full disk path)
    const banner_image = `banners/${req.file.filename}`;

    const newVendor = await vendorModel.createVendor({
      business_name,
      email,
      phone,
      password_hash,
      hawker_centre_id,
      stall_number,
      banner_image,
    });

    // TODO: Send confirmation email (mock for now, nodemailer later)
    console.log(`[MOCK EMAIL] Confirmation sent to ${email}`);

    res.status(201).json(newVendor);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error registering vendor" });
  }
}

// Converts a timestamp into a short relative string like "10 mins ago"
function formatTimeAgo(dateValue) {
  const now = new Date();
  const then = new Date(dateValue);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

// Get dashboard data for the logged-in vendor (protected route)
// req.vendor is attached by the verifyVendorToken middleware
async function getDashboard(req, res) {
  try {
    const vendor = await vendorModel.getVendorById(req.vendor.id);

    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    const overview = await vendorModel.getVendorOverview(req.vendor.id);

    // Reshape the recent orders into the format the dashboard UI expects
    const recentOrders = overview.recent_orders.map((order) => ({
      id: `ORD-${order.order_id}`,
      order_id: order.order_id, // raw numeric id, needed for the status update dropdown
      item: order.items || "(no items recorded)",
      customer: order.customer,
      status: order.order_status,
      time: formatTimeAgo(order.created_at),
    }));

    res.status(200).json({
      vendor,
      summary: {
        message: `Welcome back, ${vendor.business_name}!`,
        pending_orders: overview.pending_orders,
        menu_items: overview.menu_items,
        avg_rating: Number(overview.avg_rating.toFixed(1)),
        today_revenue: overview.today_revenue,
      },
      recent_orders: recentOrders,
    });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading dashboard" });
  }
}

const ALLOWED_ORDER_STATUSES = ["pending", "preparing", "completed", "cancelled"];

// Update the status of one of this vendor's orders (e.g. pending -> completed)
async function updateOrderStatus(req, res) {
  try {
    const { status } = req.body;
    const orderId = req.params.id;

    if (!ALLOWED_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${ALLOWED_ORDER_STATUSES.join(", ")}` });
    }

    const updated = await vendorModel.updateOrderStatus(orderId, req.vendor.id, status);

    if (!updated) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.status(200).json({ message: "Order status updated" });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error updating order status" });
  }
}

module.exports = {
  registerVendor,
  getDashboard,
  updateOrderStatus,
};