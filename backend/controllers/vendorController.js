const bcrypt = require("bcrypt");
const vendorModel = require("../models/vendorModel");
const hygieneGradeModel = require("../models/hygieneGradeModel");
const stallProfileSettingsModel = require("../models/stallProfileSettingsModel");

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
      id: `ORD-${order.vendor_order_number}`,
      order_number: order.vendor_order_number,
      order_id: order.order_id, // raw numeric id, needed for the status update dropdown
      item: order.items || "(no items recorded)",
      customer: order.customer,
      status: order.order_status,
      time: formatTimeAgo(order.created_at),
      packaging_type: order.packaging_type,
      packaging_description: order.packaging_description,
      special_request: order.special_request,
      include_cutlery: Boolean(order.include_cutlery),
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

// Get the full order list for this vendor, newest first.
async function listVendorOrders(req, res) {
  try {
    const orders = await vendorModel.getOrdersByVendor(req.vendor.id);

    const formattedOrders = orders.map((order) => ({
      order_id: order.order_id,
      order_number: order.vendor_order_number,
      order_label: `ORD-${order.vendor_order_number}`,
      customer: order.customer,
      customer_email: order.customer_email,
      items: order.items || "(no items recorded)",
      status: order.order_status,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      packaging_fee: Number(order.packaging_fee || 0),
      packaging_type: order.packaging_type,
      packaging_description: order.packaging_description,
      special_request: order.special_request,
      include_cutlery: Boolean(order.include_cutlery),
      total_amount: Number(order.total_amount || 0),
      created_at: order.created_at,
      time: formatTimeAgo(order.created_at),
    }));

    res.status(200).json({ orders: formattedOrders });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading vendor orders" });
  }
}

async function getStallProfile(req, res) {
  try {
    const profile = await vendorModel.getVendorStallProfile(req.vendor.id);

    if (!profile) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    const itemIds = profile.menu.map((item) => item.id);
    const settings = await stallProfileSettingsModel.getVendorSettings(req.vendor.id, itemIds);
    const menu = stallProfileSettingsModel.applySettingsToMenu(profile.menu, settings);

    res.status(200).json({
      vendor: profile.vendor,
      menu,
      settings,
    });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading stall profile" });
  }
}

// Get the logged-in vendor's full hygiene grade history from the main database.
async function getHygieneGradeHistory(req, res) {
  try {
    const history = await hygieneGradeModel.getGradeHistoryByVendor(req.vendor.id);
    res.status(200).json(history);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading grade history" });
  }
}

async function updateStallProfileSettings(req, res) {
  try {
    const profile = await vendorModel.getVendorStallProfile(req.vendor.id);

    if (!profile) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    const itemIds = profile.menu.map((item) => item.id);
    const settings = await stallProfileSettingsModel.saveVendorSettings(req.vendor.id, req.body || {}, itemIds);
    res.status(200).json({ message: "Stall profile settings updated", settings });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error updating stall profile settings" });
  }
}

async function updateStallBanner(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please upload a banner image." });
    }

    const bannerImage = `banners/${req.file.filename}`;
    const updated = await vendorModel.updateVendorBanner(req.vendor.id, bannerImage);

    if (!updated) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    res.status(200).json({ message: "Stall banner updated successfully", banner_image: bannerImage });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error updating stall banner" });
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
  listVendorOrders,
  getStallProfile,
  getHygieneGradeHistory,
  updateStallProfileSettings,
  updateStallBanner,
  updateOrderStatus,
};
