const express = require("express");
const sql = require("mssql");
const dotenv = require("dotenv");
const path = require("path");
const cookieParser = require("cookie-parser");

// Load environment variables
dotenv.config();

// --- Vendor ---
const vendorController = require("./controllers/vendorController");
const { validateVendorRegister } = require("./middlewares/vendorValidation");

// --- Patron ---
const patronController = require("./controllers/patronController");
const { validatePatronRegister } = require("./middlewares/patronValidation");

// --- Auth (login/logout) ---
const authController = require("./controllers/authController");
const { validateLogin } = require("./middlewares/loginValidation");
const { verifyVendorToken } = require("./middlewares/authMiddleware");

const performanceController = require("./controllers/performanceController");

// --- Menu Management ---
const menuController = require("./controllers/menuController");
const { validateMenuItem } = require("./middlewares/menuValidation");


// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware (Parsing request bodies)
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies
app.use(cookieParser()); // Parse cookies (needed to read the JWT auth cookie)
// --- Add other general middleware here (e.g., logging, security headers) ---

// --- Serve static files from the 'frontend' directory ---
// backend/ and frontend/ are sibling folders, so we go up one level from
// backend, then into frontend, to serve index.html, css, js, etc.
app.use(express.static(path.join(__dirname, "..", "frontend")));

// ===================== VENDOR ROUTES =====================
app.post("/api/auth/vendor/register", validateVendorRegister, vendorController.registerVendor);

// ===================== PATRON ROUTES =====================
app.post("/api/auth/patron/register", validatePatronRegister, patronController.registerPatron);

// ===================== AUTH ROUTES (LOGIN / LOGOUT) =====================
app.post("/api/auth/login", validateLogin, authController.loginVendor);
app.post("/api/auth/logout", authController.logout);

// ===================== PROTECTED VENDOR ROUTES =====================
// verifyVendorToken checks the JWT cookie before allowing access
app.get("/api/vendor/dashboard", verifyVendorToken, vendorController.getDashboard);
app.get("/api/auth/me", verifyVendorToken, authController.getCurrentVendor);


app.get("/api/vendor/performance", verifyVendorToken, performanceController.getStallPerformance);

// ===================== MENU MANAGEMENT ROUTES =====================
app.get("/api/vendor/menu", verifyVendorToken, menuController.listMenuItems);
app.get("/api/vendor/menu/:id/cuisines", verifyVendorToken, menuController.getItemCuisines);
app.post("/api/vendor/menu", verifyVendorToken, validateMenuItem, menuController.createMenuItem);
app.put("/api/vendor/menu/:id", verifyVendorToken, validateMenuItem, menuController.updateMenuItem);
app.delete("/api/vendor/menu/:id", verifyVendorToken, menuController.deleteMenuItem);
app.get("/api/cuisines", verifyVendorToken, menuController.listCuisines);

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`→ http://localhost:${port}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Server is gracefully shutting down");
  await sql.close();
  console.log("Database connections closed");
  process.exit(0);
});