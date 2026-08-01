const express = require("express");
const sql = require("mssql");
const dotenv = require("dotenv");
const path = require("path");
const cookieParser = require("cookie-parser");
const cors = require("cors");

dotenv.config();

const neaAuthController = require("./controllers/neaAuthController");
const inspectionController = require("./controllers/inspectionController");
const { verifyOfficerToken } = require("./middlewares/neaAuthMiddleware");

const app = express();
const port = process.env.NEA_PORT || 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  cors({
    origin: process.env.MAIN_APP_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

// --- Serve the NEA officer portal's own front-end ---
// Serve the NEA officer portal's own front-end
app.use(express.static(path.join(__dirname, "..", "nea-frontend")));

// ===================== NEA OFFICER AUTH =====================
app.post("/api/nea/auth/login", neaAuthController.login);
app.post("/api/nea/auth/logout", neaAuthController.logout);
app.get("/api/nea/auth/me", verifyOfficerToken, neaAuthController.getCurrentOfficer);

// ===================== STALLS (for the schedule form's dropdown) =====================
app.get("/api/nea/vendors", verifyOfficerToken, inspectionController.listVendorsForInspection);

// ===================== PUBLIC HYGIENE GRADES =====================
// No auth — consumed cross-origin by the main hawker hub site.
// - /hygiene-grades         -> every approved vendor's current grade (patron badges/filter)
// - /vendors/:id/grades     -> one vendor's full grade history (vendor's own Hygiene page)
app.get("/api/nea/public/hygiene-grades", inspectionController.getPublicHygieneGrades);
app.get("/api/nea/public/vendors/:vendorId/grades", inspectionController.getVendorGradeHistory);
// ===================== HCMP-30: SCHEDULE INSPECTION =====================
app.post("/api/nea/inspections", verifyOfficerToken, inspectionController.scheduleInspection);
app.get("/api/nea/inspections/upcoming", verifyOfficerToken, inspectionController.listUpcomingInspections);

// ===================== HCMP-31: CONDUCT & LOG INSPECTION =====================
app.put("/api/nea/inspections/:id/result", verifyOfficerToken, inspectionController.logInspectionResult);

// ===================== MY INSPECTIONS (history) =====================
app.get("/api/nea/inspections/mine", verifyOfficerToken, inspectionController.getMyInspections);

app.listen(port, () => {
  console.log(`NEA service running on port ${port}`);
  console.log(`-> http://localhost:${port}`);
});

process.on("SIGINT", async () => {
  console.log("NEA service is gracefully shutting down");
  await sql.close();
  console.log("Database connections closed");
  process.exit(0);
});