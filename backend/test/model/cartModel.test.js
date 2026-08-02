const cartController = require("../../controllers/cartController");
const cartModel = require("../../models/cartModel");

jest.mock("../../models/cartModel");

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe("cartController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("addToCart", () => {
    it("should add an item to the cart and return 201 with its new id", async () => {
      cartModel.addToCart.mockResolvedValue(42);

      const req = { patron: { id: 1 }, body: { menu_item_id: 10, quantity: 2 } };
      const res = mockRes();

      await cartController.addToCart(req, res);

      expect(cartModel.addToCart).toHaveBeenCalledWith(1, req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: 42, message: "Item added to cart" });
    });

    it("should return 500 if the model throws", async () => {
      cartModel.addToCart.mockRejectedValue(new Error("DB error"));

      const req = { patron: { id: 1 }, body: { menu_item_id: 10, quantity: 2 } };
      const res = mockRes();

      await cartController.addToCart(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Error adding item to cart" });
    });
  });

  describe("getCart", () => {
    it("should return the patron's cart items with 200", async () => {
      const mockItems = [{ id: 1, name: "Chicken Rice", quantity: 2 }];
      cartModel.getCartByPatron.mockResolvedValue(mockItems);

      const req = { patron: { id: 1 } };
      const res = mockRes();

      await cartController.getCart(req, res);

      expect(cartModel.getCartByPatron).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockItems);
    });

    it("should return an empty array with 200 for an empty cart", async () => {
      cartModel.getCartByPatron.mockResolvedValue([]);

      const req = { patron: { id: 1 } };
      const res = mockRes();

      await cartController.getCart(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    it("should return 500 if the model throws", async () => {
      cartModel.getCartByPatron.mockRejectedValue(new Error("DB error"));

      const req = { patron: { id: 1 } };
      const res = mockRes();

      await cartController.getCart(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Error loading cart" });
    });
  });

  describe("updateCartItem", () => {
    it("should update the quantity and return 200", async () => {
      cartModel.updateQuantity.mockResolvedValue(true);

      const req = { params: { id: "5" }, patron: { id: 1 }, body: { quantity: 3 } };
      const res = mockRes();

      await cartController.updateCartItem(req, res);

      expect(cartModel.updateQuantity).toHaveBeenCalledWith("5", 1, 3);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "Cart item updated" });
    });

    it("should return 400 and not call the model when quantity is 0", async () => {
      const req = { params: { id: "5" }, patron: { id: 1 }, body: { quantity: 0 } };
      const res = mockRes();

      await cartController.updateCartItem(req, res);

      expect(cartModel.updateQuantity).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Quantity must be at least 1" });
    });

    it("should return 400 when quantity is negative", async () => {
      const req = { params: { id: "5" }, patron: { id: 1 }, body: { quantity: -1 } };
      const res = mockRes();

      await cartController.updateCartItem(req, res);

      expect(cartModel.updateQuantity).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 when quantity is missing", async () => {
      const req = { params: { id: "5" }, patron: { id: 1 }, body: {} };
      const res = mockRes();

      await cartController.updateCartItem(req, res);

      expect(cartModel.updateQuantity).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 500 if the model throws", async () => {
      cartModel.updateQuantity.mockRejectedValue(new Error("DB error"));

      const req = { params: { id: "5" }, patron: { id: 1 }, body: { quantity: 2 } };
      const res = mockRes();

      await cartController.updateCartItem(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Error updating cart item" });
    });
  });

  describe("removeCartItem", () => {
    it("should remove the item and return 200", async () => {
      cartModel.removeCartItem.mockResolvedValue(true);

      const req = { params: { id: "5" }, patron: { id: 1 } };
      const res = mockRes();

      await cartController.removeCartItem(req, res);

      expect(cartModel.removeCartItem).toHaveBeenCalledWith("5", 1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "Item removed from cart" });
    });

    it("should return 500 if the model throws", async () => {
      cartModel.removeCartItem.mockRejectedValue(new Error("DB error"));

      const req = { params: { id: "5" }, patron: { id: 1 } };
      const res = mockRes();

      await cartController.removeCartItem(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Error removing cart item" });
    });
  });

  describe("clearCart", () => {
    it("should clear the cart and return 200", async () => {
      cartModel.clearCart.mockResolvedValue(true);

      const req = { patron: { id: 1 } };
      const res = mockRes();

      await cartController.clearCart(req, res);

      expect(cartModel.clearCart).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "Cart cleared" });
    });

    it("should return 500 if the model throws", async () => {
      cartModel.clearCart.mockRejectedValue(new Error("DB error"));

      const req = { patron: { id: 1 } };
      const res = mockRes();

      await cartController.clearCart(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Error clearing cart" });
    });
  });
});