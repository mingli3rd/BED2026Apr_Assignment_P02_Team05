const Joi = require("joi");

const cartItemSchema = Joi.object({
  menu_item_id: Joi.number().integer().required(),
  vendor_id: Joi.number().integer().required(),
  quantity: Joi.number().integer().min(1).max(50).required(),
  add_on_ids: Joi.array().items(Joi.number().integer()).optional(),
});

function validateCartItem(req, res, next) {
  const { error } = cartItemSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errorMessage = error.details.map((d) => d.message).join(", ");
    return res.status(400).json({ error: errorMessage });
  }
  next();
}

const checkoutSchema = Joi.object({
  cart_items: Joi.array()
    .items(
      Joi.object({
        menu_item_id: Joi.number().integer().required(),
        vendor_id: Joi.number().integer().required(),
        vendor_name: Joi.string().optional(),
        name: Joi.string().required(),
        category: Joi.string().optional(),
        image: Joi.string().allow(null, "").optional(),
        price: Joi.number().positive().required(),
        quantity: Joi.number().integer().min(1).required(),
        add_ons: Joi.array()
          .items(
            Joi.object({
              id: Joi.number().integer().required(),
              name: Joi.string().required(),
              extra_price: Joi.number().min(0).required(),
            })
          )
          .optional(),
      })
    )
    .min(1)
    .required()
    .messages({
      "array.min": "Your cart is empty. Add items before checking out.",
    }),
  payment_method: Joi.string().valid("cash", "nets", "paynow").required().messages({
    "any.only": "Please select a valid payment method.",
    "any.required": "Please select a payment method.",
  }),
  force_fail: Joi.boolean().optional(),
  guest_email: Joi.string().email().allow("").optional().messages({
    "string.email": "Please enter a valid email address.",
  }),
});

function validateCheckout(req, res, next) {
  const { error } = checkoutSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errorMessage = error.details.map((d) => d.message).join(", ");
    return res.status(400).json({ error: errorMessage });
  }
  next();
}

module.exports = {
  validateCartItem,
  validateCheckout,
};