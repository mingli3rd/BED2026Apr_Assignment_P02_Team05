const Joi = require("joi");

const feedbackSchema = Joi.object({
  vendor_id: Joi.number().integer().required(),
  rating: Joi.number().integer().min(1).max(5).required().messages({
    "number.min": "Rating must be between 1 and 5 stars.",
    "number.max": "Rating must be between 1 and 5 stars.",
    "any.required": "Please select a star rating.",
  }),
  comment: Joi.string().max(500).allow("").optional(),
});

function validateFeedback(req, res, next) {
  const { error } = feedbackSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errorMessage = error.details.map((d) => d.message).join(", ");
    return res.status(400).json({ error: errorMessage });
  }
  next();
}

module.exports = {
  validateFeedback,
};