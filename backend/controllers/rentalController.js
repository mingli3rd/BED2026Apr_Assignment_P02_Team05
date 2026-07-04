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

    const notifications = classified
      .filter((a) => a.renewal_status === "expiring_soon" || (a.renewal_status === "expired" && a.status !== "terminated"))
      .map((a) => {
        if (a.renewal_status === "expiring_soon") {
          return {
            type: "warning",
            message: `Your rental agreement expires in ${a.days_until_expiry} day${a.days_until_expiry === 1 ? "" : "s"} (on ${new Date(a.end_date).toLocaleDateString("en-SG")}). Renew soon to avoid disruption.`,
          };
        }
        return {
          type: "danger",
          message: `Your rental agreement expired on ${new Date(a.end_date).toLocaleDateString("en-SG")}. Please follow up with your hawker centre operator.`,
        };
      });

    res.status(200).json({
      agreements: classified,
      notifications,
    });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading rental agreements" });
  }
}

module.exports = {
  listRentalAgreements,
};
