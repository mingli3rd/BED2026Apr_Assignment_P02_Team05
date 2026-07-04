const express = require("express");
const sql = require("mssql");
const dotenv = require("dotenv");
const path = require("path");
// Load environment variables
dotenv.config();

const vendorController = require("./controllers/vendorController");
const { validateVendorRegister } = require("./middlewares/vendorValidation"); // import Vendor Validation Middleware

const patronController = require("./controllers/patronController");
const { validatePatronRegister } = require("./middlewares/patronValidation");

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware (Parsing request bodies)
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies
// --- Add other general middleware here (e.g., logging, security headers) ---

// --- Serve static files from the 'public' directory ---
// When a request comes in for a static file (like /index.html, /styles.css, /script.js),
// Express will look for it in the 'public' folder relative to the project root.
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Routes for vendor auth
// Apply middleware *before* the controller function for routes that need it
app.post("/api/auth/vendor/register", validateVendorRegister, vendorController.registerVendor);
app.post("/api/auth/patron/register", validatePatronRegister, patronController.registerPatron);


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