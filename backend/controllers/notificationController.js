const notificationModel = require("../models/notificationModel");

// Vendor: fetch own notifications (used to populate the dashboard bell panel)
async function getMyNotifications(req, res) {
  try {
    const unreadOnly = req.query.unread_only === "true";
    const notifications = await notificationModel.getNotificationsByVendor(req.vendor.id, unreadOnly);
    res.status(200).json(notifications);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading notifications" });
  }
}

// Vendor: unread count only - lightweight, polled often for the badge
async function getUnreadCount(req, res) {
  try {
    const count = await notificationModel.getUnreadCountByVendor(req.vendor.id);
    res.status(200).json({ unread_count: count });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading notification count" });
  }
}

async function markAsRead(req, res) {
  try {
    const updated = await notificationModel.markNotificationRead(req.params.id, req.vendor.id);
    if (!updated) {
      return res.status(404).json({ error: "Notification not found." });
    }
    res.status(200).json({ message: "Notification marked as read." });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error updating notification" });
  }
}

async function markAllAsRead(req, res) {
  try {
    await notificationModel.markAllNotificationsRead(req.vendor.id);
    res.status(200).json({ message: "All notifications marked as read." });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error updating notifications" });
  }
}

// Customer: fetch own notifications (patron or guest) — used by the stall
// page to poll for queue_update alerts. No auth required for guests, so
// this route is public; identity comes from query params instead of a cookie.
async function getMyCustomerNotifications(req, res) {
  try {
    const { patron_id, guest_identifier, unread_only } = req.query;
    if (!patron_id && !guest_identifier) {
      return res.status(400).json({ error: "patron_id or guest_identifier is required." });
    }
    const notifications = await notificationModel.getNotificationsForCustomer(patron_id, guest_identifier, unread_only === "true");
    res.status(200).json(notifications);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading notifications" });
  }
}

async function markCustomerNotificationAsRead(req, res) {
  try {
    const { patron_id, guest_identifier } = req.body;
    const updated = await notificationModel.markNotificationReadForCustomer(req.params.id, patron_id, guest_identifier);
    if (!updated) {
      return res.status(404).json({ error: "Notification not found." });
    }
    res.status(200).json({ message: "Notification marked as read." });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error updating notification" });
  }
}

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getMyCustomerNotifications,
  markCustomerNotificationAsRead,
};
