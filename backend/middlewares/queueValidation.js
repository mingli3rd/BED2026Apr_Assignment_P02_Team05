const Joi = require("joi");

const queueJoinSchema = Joi.object({
  vendor_id: Joi.number().integer().required(),
  guest_identifier: Joi.string().max(100).optional(),
});

function validateQueueJoin(req, res, next) {
  const { error } = queueJoinSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errorMessage = error.details.map((d) => d.message).join(", ");
    return res.status(400).json({ error: errorMessage });
  }
  if (!req.patron && !req.body.guest_identifier) {
    return res.status(400).json({ error: "guest_identifier is required when not logged in." });
  }
  next();
}

module.exports = {
  validateQueueJoin,
};
