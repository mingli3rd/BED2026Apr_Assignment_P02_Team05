const Joi = require("joi");

const menuItemSchema = Joi.object({
  name: Joi.string().min(1).max(100).required().messages({
    "string.empty": "Item name cannot be empty",
    "string.min": "Item name must be at least 1 character long",
    "string.max": "Item name cannot exceed 100 characters",
    "any.required": "Item name is required",
  }),
  price: Joi.number().positive().precision(2).max(9999.99).required().messages({
    "number.base": "Price must be a number",
    "number.positive": "Price must be greater than 0",
    "any.required": "Price is required",
  }),
  category: Joi.string().max(50).allow("").optional(),
  cuisine_ids: Joi.array().items(Joi.number().integer()).single().optional(),
});

function validateMenuItem(req, res, next) {
  const { error } = menuItemSchema.validate(req.body, { abortEarly: false });

  if (error) {
    const errorMessage = error.details.map((detail) => detail.message).join(", ");
    return res.status(400).json({ error: errorMessage });
  }

  next();
}

module.exports = {
  validateMenuItem,
};