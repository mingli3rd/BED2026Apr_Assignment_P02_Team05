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

// --- Auth (login/logout, shared between vendor and patron) ---
const authController = require("./controllers/authController");
const { validateLogin } = require("./middlewares/loginValidation");
const { verifyVendorToken, verifyPatronToken } = require("./middlewares/authMiddleware");

// --- Stall Performance ---
const performanceController = require("./controllers/performanceController");

// --- Menu Management ---
const menuController = require("./controllers/menuController");
const { validateMenuItem } = require("./middlewares/menuValidation");

// --- Rental Agreements ---
const rentalController = require("./controllers/rentalController");

// --- Public Stall / Hawker Centre Browsing ---
const stallController = require("./controllers/stallController");

// --- Cart ---
const cartController = require("./controllers/cartController");
const { validateCartItem, validateCheckout } = require("./middlewares/cartValidation");

// --- Checkout / Orders ---
const checkoutController = require("./controllers/checkoutController");

// --- Image Uploads ---
const { uploadBannerImage, uploadMenuItemImage } = require("./config/upload");


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

// --- Serve uploaded vendor/menu images ---
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ===================== VENDOR ROUTES =====================
// uploadBannerImage runs first to parse the multipart form data
// (text fields + the banner file), process/auto-orient the image, then
// hand off to validation and the controller
app.post("/api/auth/vendor/register", ...uploadBannerImage, validateVendorRegister, vendorController.registerVendor);

// ===================== PATRON ROUTES =====================
app.post("/api/auth/patron/register", validatePatronRegister, patronController.registerPatron);

// ===================== AUTH ROUTES (LOGIN / LOGOUT — shared by vendor + patron) =====================
app.post("/api/auth/login", validateLogin, authController.login);
app.post("/api/auth/logout", authController.logout);
app.get("/api/auth/me", verifyVendorToken, authController.getCurrentVendor);
app.get("/api/auth/me/patron", verifyPatronToken, authController.getCurrentPatron);

// ===================== PROTECTED VENDOR ROUTES =====================
app.get("/api/vendor/dashboard", verifyVendorToken, vendorController.getDashboard);
app.get("/api/vendor/performance", verifyVendorToken, performanceController.getStallPerformance);
app.put("/api/vendor/orders/:id/status", verifyVendorToken, vendorController.updateOrderStatus);

// ===================== PROTECTED PATRON ROUTES =====================
app.get("/api/patron/orders", verifyPatronToken, patronController.getPatronOrders);

// ===================== MENU MANAGEMENT ROUTES (vendor-facing) =====================
app.get("/api/vendor/menu", verifyVendorToken, menuController.listMenuItems);
app.get("/api/vendor/menu/:id/cuisines", verifyVendorToken, menuController.getItemCuisines);
app.post("/api/vendor/menu", verifyVendorToken, ...uploadMenuItemImage, validateMenuItem, menuController.createMenuItem);
app.put("/api/vendor/menu/:id", verifyVendorToken, ...uploadMenuItemImage, validateMenuItem, menuController.updateMenuItem);
app.delete("/api/vendor/menu/:id", verifyVendorToken, menuController.deleteMenuItem);
app.get("/api/cuisines", verifyVendorToken, menuController.listCuisines);

// ===================== RENTAL AGREEMENT ROUTES =====================
app.get("/api/vendor/rental-agreements", verifyVendorToken, rentalController.listRentalAgreements);

// ===================== PUBLIC STALL / HAWKER CENTRE BROWSING (guests + patrons) =====================
app.get("/api/stalls", stallController.listStalls);
app.get("/api/stalls/:vendorId/menu", stallController.getStallMenu);
app.get("/api/hawker-centres", stallController.listHawkerCentres);
app.get("/api/hawker-centres/search", stallController.searchHawkerCentres);
app.get("/api/hawker-centres/:id/stalls", stallController.getHawkerCentreStalls);

// ===================== CART (logged-in patrons only — guests use localStorage) =====================
app.post("/api/cart", verifyPatronToken, validateCartItem, cartController.addToCart);
app.get("/api/cart", verifyPatronToken, cartController.getCart);
app.put("/api/cart/:id", verifyPatronToken, cartController.updateCartItem);
app.delete("/api/cart/:id", verifyPatronToken, cartController.removeCartItem);
app.delete("/api/cart", verifyPatronToken, cartController.clearCart);

// ===================== CHECKOUT / ORDERS (works for guests AND logged-in patrons) =====================
app.post("/api/orders", validateCheckout, checkoutController.createOrder);
app.post("/api/guest/checkout", validateCheckout, checkoutController.createOrder); // alias, same handler — explicit endpoint for guest checkout per spec
app.get("/api/guest/orders", checkoutController.getGuestOrders);

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