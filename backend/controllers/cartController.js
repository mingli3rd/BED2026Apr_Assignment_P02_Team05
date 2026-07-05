const cartModel = require("../models/cartModel");

async function addToCart(req, res) {
  try {
    const cartItemId = await cartModel.addToCart(req.patron.id, req.body);
    res.status(201).json({ id: cartItemId, message: "Item added to cart" });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error adding item to cart" });
  }
}

async function getCart(req, res) {
  try {
    const items = await cartModel.getCartByPatron(req.patron.id);
    res.status(200).json(items);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading cart" });
  }
}

async function updateCartItem(req, res) {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: "Quantity must be at least 1" });
    }
    await cartModel.updateQuantity(req.params.id, req.patron.id, quantity);
    res.status(200).json({ message: "Cart item updated" });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error updating cart item" });
  }
}

async function removeCartItem(req, res) {
  try {
    await cartModel.removeCartItem(req.params.id, req.patron.id);
    res.status(200).json({ message: "Item removed from cart" });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error removing cart item" });
  }
}

async function clearCart(req, res) {
  try {
    await cartModel.clearCart(req.patron.id);
    res.status(200).json({ message: "Cart cleared" });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error clearing cart" });
  }
}

module.exports = {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart,
};