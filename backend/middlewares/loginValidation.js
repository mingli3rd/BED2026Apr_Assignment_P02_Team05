const Joi = require("joi"); // Import Joi for validation

// Validation schema for login (used for POST)
const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email must be a valid email address",
    "string.empty": "Email cannot be empty",
    "any.required": "Email is required",
  }),
  password: Joi.string().required().messages({
    "string.empty": "Password cannot be empty",
    "any.required": "Password is required",
  }),
  remember_me: Joi.boolean().optional(),
  expected_role: Joi.string().valid("vendor", "patron").optional().messages({
    "any.only": "expected_role must be either 'vendor' or 'patron'",
  }),
});

// Middleware to validate login data (for POST)
function validateLogin(req, res, next) {
  const { error } = loginSchema.validate(req.body, { abortEarly: false });

  if (error) {
    const errorMessage = error.details
      .map((detail) => detail.message)
      .join(", ");
    return res.status(400).json({ error: errorMessage });
  }

  next();
}

module.exports = {
  validateLogin,
};