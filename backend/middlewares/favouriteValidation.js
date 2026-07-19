const Joi = require("joi");

const favouriteSchema = Joi.object({
  vendor_id: Joi.number().integer().required(),
});

function validateFavourite(req, res, next) {
  const { error } = favouriteSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
}

const profileUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(100).required().messages({
    "string.empty": "Name cannot be empty",
    "any.required": "Name is required",
  }),
  phone: Joi.string().pattern(/^[0-9+\s-]{7,20}$/).allow("").optional().messages({
    "string.pattern.base": "Phone number must be 7-20 digits (numbers, spaces, + and - allowed)",
  }),
});

function validateProfileUpdate(req, res, next) {
  const { error } = profileUpdateSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errorMessage = error.details.map((d) => d.message).join(", ");
    return res.status(400).json({ error: errorMessage });
  }
  next();
}

module.exports = {
  validateFavourite,
  validateProfileUpdate,
};
