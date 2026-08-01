const Joi = require("joi");

const packagingOptionSchema = Joi.object({
  description: Joi.string().min(3).max(255).required().messages({
    "string.min": "Description must be at least 3 characters.",
    "any.required": "Please describe this packaging option.",
  }),
  surcharge: Joi.number().min(0).max(99.99).precision(2).required().messages({
    "number.base": "Surcharge must be a number",
    "number.min": "Surcharge cannot be negative",
    "any.required": "Surcharge is required (enter 0 for no extra charge)",
  }),
  is_enabled: Joi.boolean().optional(), // defaults to true on create if omitted
});

function validatePackagingOption(req, res, next) {
  const { error } = packagingOptionSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errorMessage = error.details.map((d) => d.message).join(", ");
    return res.status(400).json({ error: errorMessage });
  }
  next();
}

module.exports = {
  validatePackagingOption,
};
