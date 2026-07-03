const Joi = require("joi"); // Import Joi for validation

// Validation schema for vendor registration (used for POST)
const vendorRegisterSchema = Joi.object({
  business_name: Joi.string().min(1).max(100).required().messages({
    "string.base": "Business name must be a string",
    "string.empty": "Business name cannot be empty",
    "string.min": "Business name must be at least 1 character long",
    "string.max": "Business name cannot exceed 100 characters",
    "any.required": "Business name is required",
  }),
  email: Joi.string().email().required().messages({
    "string.email": "Email must be a valid email address",
    "string.empty": "Email cannot be empty",
    "any.required": "Email is required",
  }),
  phone: Joi.string().pattern(/^[0-9+\s-]{7,20}$/).required().messages({
    "string.pattern.base": "Phone number must be 7-20 digits (numbers, spaces, + and - allowed)",
    "string.empty": "Phone number cannot be empty",
    "any.required": "Phone number is required",
  }),
  password: Joi.string().pattern(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/).required().messages({
    "string.pattern.base": "Password must be at least 8 characters long and contain letters and numbers",
    "string.empty": "Password cannot be empty",
    "any.required": "Password is required",
  }),
  hawker_centre_id: Joi.number().integer().optional(),
  stall_number: Joi.string().max(20).optional(),
});

// Middleware to validate vendor registration data (for POST)
function validateVendorRegister(req, res, next) {
  // Validate the request body against the vendorRegisterSchema
  const { error } = vendorRegisterSchema.validate(req.body, { abortEarly: false }); // abortEarly: false collects all errors

  if (error) {
    // If validation fails, format the error messages and send a 400 response
    const errorMessage = error.details
      .map((detail) => detail.message)
      .join(", ");
    return res.status(400).json({ error: errorMessage });
  }

  // If validation succeeds, pass control to the next middleware/route handler
  next();
}

module.exports = {
  validateVendorRegister,
};