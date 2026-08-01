const rentalModel = require("../models/rentalModel");

const EXPIRING_SOON_THRESHOLD_DAYS = 30;

// Classify an agreement's renewal urgency based on days until expiry.
// This is where the "notification system for upcoming expiry" logic lives —
// anything within the threshold, or already past its end date, is flagged.
function classifyAgreement(agreement) {
  if (agreement.days_until_expiry < 0) {
    return "expired";
  }
  if (agreement.days_until_expiry <= EXPIRING_SOON_THRESHOLD_DAYS) {
    return "expiring_soon";
  }
  return "active";
}

// List all rental agreements for the logged-in vendor, plus a notifications
// array for any agreement expiring soon or already expired.
async function listRentalAgreements(req, res) {
  try {
    const agreements = await rentalModel.getAgreementsByVendor(req.vendor.id);

    const classified = agreements.map((agreement) => ({
      ...agreement,
      renewal_status: classifyAgreement(agreement),
    }));

    const currentAgreement = classified[0];
    const notifications = [];

    if (currentAgreement && currentAgreement.status !== "terminated") {
      if (currentAgreement.renewal_status === "expiring_soon") {
        notifications.push({
          type: "warning",
          message: `Your rental agreement expires in ${currentAgreement.days_until_expiry} day${currentAgreement.days_until_expiry === 1 ? "" : "s"} (on ${new Date(currentAgreement.end_date).toLocaleDateString("en-SG")}). Renew soon to avoid disruption.`,
        });
      } else if (currentAgreement.renewal_status === "expired") {
        notifications.push({
          type: "danger",
          message: `Your rental agreement expired on ${new Date(currentAgreement.end_date).toLocaleDateString("en-SG")}. Please follow up with your hawker centre operator.`,
        });
      }
    }

    res.status(200).json({
      agreements: classified,
      notifications,
    });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading rental agreements" });
  }
}

async function uploadLatestRentalAgreementDocument(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please choose a PDF, DOC, or DOCX file to upload." });
    }

    const latestAgreement = await rentalModel.getLatestAgreementByVendor(req.vendor.id);

    if (!latestAgreement) {
      return res.status(404).json({ error: "No rental agreement was found for this vendor." });
    }

    const documentPath = `rental-agreements/${req.file.filename}`;
    const updated = await rentalModel.updateLatestAgreementDocument(req.vendor.id, documentPath);

    if (!updated) {
      return res.status(404).json({ error: "No rental agreement was updated." });
    }

    res.status(200).json({
      message: "Rental agreement document uploaded successfully",
      agreement: {
        ...latestAgreement,
        document_path: documentPath,
      },
    });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error updating rental agreement document" });
  }
}

module.exports = {
  listRentalAgreements,
  uploadLatestRentalAgreementDocument,
};
