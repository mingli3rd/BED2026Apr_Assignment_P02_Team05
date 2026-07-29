const express = require("express");
const sql = require("mssql");
const dotenv = require("dotenv");
const path = require("path");
const cookieParser = require("cookie-parser");
const cors = require("cors");

// Load environment variables
dotenv.config();

const neaAuthController = require("./controllers/neaAuthController");
const inspectionController = require("./controllers/inspectionController");
const { verifyOfficerToken } = require("./middlewares/neaAuthMiddleware");

const app = express();
const port = process.env.NEA_PORT || 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// This service runs on a different port/host than the main hawker hub app
// (which lives on PORT, typically 3000), so cross-origin requests need
// CORS explicitly enabled. `credentials: true` is required for the
// nea_token cookie to be sent/received across origins.
app.use(
  cors({
    origin: process.env.MAIN_APP_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

// --- Serve the NEA officer portal's own front-end ---
app.use(express.static(path.join(__dirname, "..", "nea-frontend")));

// ===================== NEA OFFICER AUTH =====================
app.post("/api/nea/auth/login", neaAuthController.login);
app.post("/api/nea/auth/logout", neaAuthController.logout);
app.get("/api/nea/auth/me", verifyOfficerToken, neaAuthController.getCurrentOfficer);

// ===================== INSPECTIONS (officer-only) =====================
app.get("/api/nea/vendors", verifyOfficerToken, inspectionController.listVendorsForInspection);
app.post("/api/nea/inspections", verifyOfficerToken, inspectionController.recordInspection);
app.get("/api/nea/inspections/mine", verifyOfficerToken, inspectionController.getMyInspections);
app.get("/api/nea/vendors/:vendorId/grades", verifyOfficerToken, inspectionController.getVendorGradeHistory);

// ===================== PUBLIC HYGIENE GRADES =====================
// No auth — consumed cross-origin by the main hawker hub site.
// - /hygiene-grades         -> every approved vendor's current grade (patron badges/filter)
// - /vendors/:id/grades     -> one vendor's full grade history (vendor's own Hygiene page)
app.get("/api/nea/public/hygiene-grades", inspectionController.getPublicHygieneGrades);
app.get("/api/nea/public/vendors/:vendorId/grades", inspectionController.getVendorGradeHistory);

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