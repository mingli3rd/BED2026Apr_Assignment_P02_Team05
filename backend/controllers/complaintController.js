const complaintModel = require("../models/complaintModel");
const notificationModel = require("../models/notificationModel");

// Submit a complaint against a stall. Works for both logged-in patrons and
// guests - req.patron is only set if attachPatronIfPresent found a valid
// patron cookie, otherwise the complaint is filed with a null patron_id.
async function submitComplaint(req, res) {
  try {
    const { vendor_id, description } = req.body;
    const patronId = req.patron ? req.patron.id : null;

    const complaintId = await complaintModel.createComplaint(vendor_id, patronId, description);

    // Push a real-time notification to the vendor as soon as the complaint lands
    const preview = description.length > 80 ? `${description.slice(0, 80)}…` : description;
    await notificationModel.createNotification({
      vendorId: vendor_id,
      type: "complaint",
      referenceId: complaintId,
      message: `New complaint lodged: "${preview}"`,
    });

    res.status(201).json({ id: complaintId, message: "Your complaint has been submitted. The stall has been notified." });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error submitting complaint" });
  }
}

// Vendor: list complaints lodged against their own stall
async function getMyComplaints(req, res) {
  try {
    const complaints = await complaintModel.getComplaintsByVendor(req.vendor.id);
    res.status(200).json(complaints);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading complaints" });
  }
}

// Vendor: update a complaint's status (open -> investigating -> resolved)
async function updateComplaintStatus(req, res) {
  try {
    const { status } = req.body;
    const validStatuses = ["open", "investigating", "resolved"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Status must be one of: open, investigating, resolved." });
    }
    const updated = await complaintModel.updateComplaintStatus(req.params.id, req.vendor.id, status);
    if (!updated) {
      return res.status(404).json({ error: "Complaint not found." });
    }
    res.status(200).json({ message: "Complaint status updated." });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error updating complaint status" });
  }
}

module.exports = {
  submitComplaint,
  getMyComplaints,
  updateComplaintStatus,
};
