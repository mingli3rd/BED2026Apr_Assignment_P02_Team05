const checkoutController = require("../../controllers/checkoutController");
const checkoutModel = require("../../models/checkoutModel");
const jwt = require("jsonwebtoken");

jest.mock("../../models/checkoutModel");
jest.mock("jsonwebtoken");

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe("checkoutController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  describe("createOrder", () => {
    const cartItems = [{ vendor_id: 1, menu_item_id: 10, name: "Chicken Rice", price: 4.5, quantity: 1 }];

    it("should create an order for a logged-in patron and report is_guest: false", async () => {
      jwt.verify.mockReturnValue({ id: 7, role: "patron" });
      checkoutModel.createOrdersFromCart.mockResolvedValue({
        success: true,
        message: "Payment approved.",
        orders: [{ order_id: 100, total: 4.5 }],
      });

      const req = {
        cookies: { token: "valid.patron.token" },
        body: { cart_items: cartItems, payment_method: "card", force_fail: false, guest_email: null },
      };
      const res = mockRes();

      await checkoutController.createOrder(req, res);

      expect(checkoutModel.createOrdersFromCart).toHaveBeenCalledWith(
        7,
        cartItems,
        "card",
        false,
        null,
        {}
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: "Payment approved.",
        orders: [{ order_id: 100, total: 4.5 }],
        is_guest: false,
      });
    });

    it("should create an order for a guest (no cookie) and report is_guest: true", async () => {
      checkoutModel.createOrdersFromCart.mockResolvedValue({
        success: true,
        message: "Payment approved.",
        orders: [{ order_id: 101, total: 4.5 }],
      });

      const req = {
        cookies: {},
        body: { cart_items: cartItems, payment_method: "card", guest_email: "guest@example.com" },
      };
      const res = mockRes();

      await checkoutController.createOrder(req, res);

      expect(checkoutModel.createOrdersFromCart).toHaveBeenCalledWith(
        null,
        cartItems,
        "card",
        undefined,
        "guest@example.com",
        {}
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ is_guest: true })
      );
    });

    it("should treat an invalid/expired token as a guest rather than erroring", async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error("jwt expired");
      });
      checkoutModel.createOrdersFromCart.mockResolvedValue({
        success: true,
        message: "Payment approved.",
        orders: [],
      });

      const req = {
        cookies: { token: "expired.token" },
        body: { cart_items: cartItems, payment_method: "card" },
      };
      const res = mockRes();

      await checkoutController.createOrder(req, res);

      expect(checkoutModel.createOrdersFromCart).toHaveBeenCalledWith(
        null,
        cartItems,
        "card",
        undefined,
        undefined,
        {}
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ is_guest: true }));
    });

    it("should not treat a vendor token as a patron (checkout is a patron-only concept)", async () => {
      jwt.verify.mockReturnValue({ id: 3, role: "vendor" });
      checkoutModel.createOrdersFromCart.mockResolvedValue({
        success: true,
        message: "Payment approved.",
        orders: [],
      });

      const req = {
        cookies: { token: "vendor.token" },
        body: { cart_items: cartItems, payment_method: "card" },
      };
      const res = mockRes();

      await checkoutController.createOrder(req, res);

      expect(checkoutModel.createOrdersFromCart).toHaveBeenCalledWith(
        null, // patronId should be null, not the vendor's id
        cartItems,
        "card",
        undefined,
        undefined,
        {}
      );
    });

    it("should return 402 and not treat it as an error when payment fails", async () => {
      checkoutModel.createOrdersFromCart.mockResolvedValue({
        success: false,
        message: "Payment declined. Please check your payment details and try again.",
        orders: [],
      });

      const req = {
        cookies: {},
        body: { cart_items: cartItems, payment_method: "card", force_fail: true },
      };
      const res = mockRes();

      await checkoutController.createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith({
        error: "Payment declined. Please check your payment details and try again.",
      });
    });

    it("should default vendor_options to {} when not provided", async () => {
      checkoutModel.createOrdersFromCart.mockResolvedValue({ success: true, message: "ok", orders: [] });

      const req = {
        cookies: {},
        body: { cart_items: cartItems, payment_method: "card" }, // no vendor_options
      };
      const res = mockRes();

      await checkoutController.createOrder(req, res);

      expect(checkoutModel.createOrdersFromCart).toHaveBeenCalledWith(
        null,
        cartItems,
        "card",
        undefined,
        undefined,
        {}
      );
    });

    it("should pass vendor_options through unchanged when provided", async () => {
      checkoutModel.createOrdersFromCart.mockResolvedValue({ success: true, message: "ok", orders: [] });

      const vendorOptions = { 1: { packaging_option_id: 5, special_request: "no chilli" } };
      const req = {
        cookies: {},
        body: { cart_items: cartItems, payment_method: "card", vendor_options: vendorOptions },
      };
      const res = mockRes();

      await checkoutController.createOrder(req, res);

      expect(checkoutModel.createOrdersFromCart).toHaveBeenCalledWith(
        null,
        cartItems,
        "card",
        undefined,
        undefined,
        vendorOptions
      );
    });

    it("should return 500 if the model throws", async () => {
      checkoutModel.createOrdersFromCart.mockRejectedValue(new Error("DB down"));

      const req = { cookies: {}, body: { cart_items: cartItems, payment_method: "card" } };
      const res = mockRes();

      await checkoutController.createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Error processing your order" });
    });
  });

  describe("getGuestOrders", () => {
    it("should return 400 if order_ids is missing", async () => {
      const req = { query: {} };
      const res = mockRes();

      await checkoutController.getGuestOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "order_ids query parameter is required" });
      expect(checkoutModel.getOrdersByIds).not.toHaveBeenCalled();
    });

    it("should return 400 if all provided order IDs are invalid", async () => {
      const req = { query: { order_ids: "abc,def" } };
      const res = mockRes();

      await checkoutController.getGuestOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "No valid order IDs provided" });
      expect(checkoutModel.getOrdersByIds).not.toHaveBeenCalled();
    });

    it("should filter out invalid IDs and only pass the valid ones through", async () => {
      checkoutModel.getOrdersByIds.mockResolvedValue([{ order_id: 1 }, { order_id: 2 }]);

      const req = { query: { order_ids: "1, abc, 2" } };
      const res = mockRes();

      await checkoutController.getGuestOrders(req, res);

      expect(checkoutModel.getOrdersByIds).toHaveBeenCalledWith([1, 2]);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([{ order_id: 1 }, { order_id: 2 }]);
    });

    it("should return 500 if the model throws", async () => {
      checkoutModel.getOrdersByIds.mockRejectedValue(new Error("Query failed"));

      const req = { query: { order_ids: "1,2" } };
      const res = mockRes();

      await checkoutController.getGuestOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Error loading orders" });
    });
  });
});