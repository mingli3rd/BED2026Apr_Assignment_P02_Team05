const Joi = require("joi");

const complaintSchema = Joi.object({
  vendor_id: Joi.number().integer().required(),
  description: Joi.string().min(10).max(500).required().messages({
    "string.min": "Please provide a bit more detail (at least 10 characters).",
    "string.max": "Complaint must be under 500 characters.",
    "any.required": "Please describe your complaint.",
  }),
});

function validateComplaint(req, res, next) {
  const { error } = complaintSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errorMessage = error.details.map((d) => d.message).join(", ");
    return res.status(400).json({ error: errorMessage });
  }
  next();
}

module.exports = {
  validateComplaint,
};
