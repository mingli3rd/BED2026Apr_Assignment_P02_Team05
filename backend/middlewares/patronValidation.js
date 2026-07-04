const Joi = require("joi");

const patronRegisterSchema = Joi.object({
  name: Joi.string().min(1).max(100).required().messages({
    "string.base": "Name must be a string",
    "string.empty": "Name cannot be empty",
    "string.min": "Name must be at least 1 character long",
    "string.max": "Name cannot exceed 100 characters",
    "any.required": "Name is required",
  }),
  email: Joi.string().email().required().messages({
    "string.email": "Email must be a valid email address",
    "string.empty": "Email cannot be empty",
    "any.required": "Email is required",
  }),
  phone: Joi.string().pattern(/^[0-9+\s-]{7,20}$/).allow("").optional().messages({
    "string.pattern.base": "Phone number must be 7-20 digits (numbers, spaces, + and - allowed)",
  }),
  password: Joi.string().pattern(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/).required().messages({
    "string.pattern.base": "Password must be at least 8 characters long and contain letters and numbers",
    "string.empty": "Password cannot be empty",
    "any.required": "Password is required",
  }),
  confirm_password: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Password confirmation does not match password",
    "any.required": "Password confirmation is required",
  }),
});

function validatePatronRegister(req, res, next) {
  const { error } = patronRegisterSchema.validate(req.body, { abortEarly: false });

  if (error) {
    const errorMessage = error.details
      .map((detail) => detail.message)
      .join(", ");
    return res.status(400).json({ error: errorMessage });
  }

  next();
}

module.exports = {
  validatePatronRegister,
};