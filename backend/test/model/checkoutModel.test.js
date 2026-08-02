const sql = require("mssql");
const checkoutModel = require("../../models/checkoutModel");

jest.mock("mssql");

describe("checkoutModel", () => {
  let mockRequest;
  let mockConnection;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn(),
    };

    mockConnection = {
      request: jest.fn().mockReturnValue(mockRequest),
      close: jest.fn().mockResolvedValue(undefined),
    };

    sql.connect.mockResolvedValue(mockConnection);
  });

  // ==========================================
  // groupCartByVendor
  // ==========================================
  describe("groupCartByVendor", () => {
    it("should group cart items under their vendor_id", () => {
      const cart = [
        { vendor_id: 1, name: "Chicken Rice", quantity: 1 },
        { vendor_id: 2, name: "Iced Tea", quantity: 2 },
        { vendor_id: 1, name: "Char Siew", quantity: 1 },
      ];

      const groups = checkoutModel.groupCartByVendor(cart);

      expect(Object.keys(groups)).toHaveLength(2);
      expect(groups[1]).toHaveLength(2);
      expect(groups[2]).toHaveLength(1);
    });

    it("should return an empty object for an empty cart", () => {
      expect(checkoutModel.groupCartByVendor([])).toEqual({});
    });
  });

  // ==========================================
  // resolvePackaging
  // ==========================================
  describe("resolvePackaging", () => {
    const items = [
      { quantity: 2 }, // 2 items
      { quantity: 1 }, // 1 item
    ]; // itemCount = 3

    it("should charge the standard $0.30/item fee when no eco option is requested", () => {
      const result = checkoutModel.resolvePackaging(items, null, null);

      expect(result.packaging_type).toBe("standard");
      expect(result.packaging_fee).toBeCloseTo(3 * 0.3);
      expect(result.packaging_option_id).toBeNull();
    });

    it("should ADD the eco surcharge on top of the base fee, not replace it", () => {
      const packagingOption = { id: 5, description: "Biodegradable box", surcharge: 0.2 };

      const result = checkoutModel.resolvePackaging(items, 5, packagingOption);

      // Expected: itemCount * (base 0.30 + surcharge 0.20) = 3 * 0.50 = 1.50
      expect(result.packaging_type).toBe("eco");
      expect(result.packaging_fee).toBeCloseTo(1.5);
      expect(result.packaging_option_id).toBe(5);
      expect(result.packaging_description).toBe("Biodegradable box");
    });

    it("should fall back to standard packaging if an eco option was requested but is no longer available", () => {
      // requestedOptionId is truthy, but packagingOption is null (disabled/deleted)
      const result = checkoutModel.resolvePackaging(items, 5, null);

      expect(result.packaging_type).toBe("standard");
      expect(result.packaging_fee).toBeCloseTo(3 * 0.3);
      expect(result.packaging_option_id).toBeNull();
    });
  });

  // ==========================================
  // createOrdersFromCart
  // ==========================================
  describe("createOrdersFromCart", () => {
    const cartItems = [
      { vendor_id: 1, menu_item_id: 10, name: "Chicken Rice", price: 4.5, quantity: 2, add_ons: [] },
    ];

    it("should not write anything to the database if payment fails", async () => {
      const result = await checkoutModel.createOrdersFromCart(1, cartItems, "card", true, null, {});

      expect(sql.connect).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        message: "Payment declined. Please check your payment details and try again.",
        orders: [],
      });
    });

    it("should create one order for a single-vendor cart", async () => {
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ business_name: "Chicken Rice Stall" }] }) // vendor lookup
        .mockResolvedValueOnce({ recordset: [{ id: 100 }] }) // insert order -> new id
        .mockResolvedValueOnce({ recordset: [{ id: 500 }] }) // insert order item -> new id
        .mockResolvedValueOnce({}); // notification insert

      const result = await checkoutModel.createOrdersFromCart(1, cartItems, "card", false, null, {});

      expect(result.success).toBe(true);
      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].order_id).toBe(100);
      expect(result.orders[0].vendor_name).toBe("Chicken Rice Stall");
      expect(result.orders[0].subtotal).toBeCloseTo(9); // 4.50 * 2
      expect(result.orders[0].packaging_type).toBe("standard");
    });

    it("should create separate orders per vendor for a multi-vendor cart", async () => {
      const multiVendorCart = [
        { vendor_id: 1, menu_item_id: 10, name: "Chicken Rice", price: 4.5, quantity: 1, add_ons: [] },
        { vendor_id: 2, menu_item_id: 20, name: "Iced Tea", price: 1.5, quantity: 2, add_ons: [] },
      ];

      mockRequest.query
        // vendor 1
        .mockResolvedValueOnce({ recordset: [{ business_name: "Stall A" }] })
        .mockResolvedValueOnce({ recordset: [{ id: 101 }] })
        .mockResolvedValueOnce({ recordset: [{ id: 501 }] })
        .mockResolvedValueOnce({})
        // vendor 2
        .mockResolvedValueOnce({ recordset: [{ business_name: "Stall B" }] })
        .mockResolvedValueOnce({ recordset: [{ id: 102 }] })
        .mockResolvedValueOnce({ recordset: [{ id: 502 }] })
        .mockResolvedValueOnce({});

      const result = await checkoutModel.createOrdersFromCart(1, multiVendorCart, "card", false, null, {});

      expect(result.orders).toHaveLength(2);
      expect(result.orders.map((o) => o.vendor_name)).toEqual(["Stall A", "Stall B"]);
    });

    it("should default include_cutlery to true when not specified", async () => {
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ business_name: "Stall A" }] })
        .mockResolvedValueOnce({ recordset: [{ id: 100 }] })
        .mockResolvedValueOnce({ recordset: [{ id: 500 }] })
        .mockResolvedValueOnce({});

      const result = await checkoutModel.createOrdersFromCart(1, cartItems, "card", false, null, {});

      expect(result.orders[0].include_cutlery).toBe(true);
      expect(mockRequest.input).toHaveBeenCalledWith("include_cutlery", sql.Bit, 1);
    });

    it("should respect include_cutlery: false when explicitly opted out", async () => {
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ business_name: "Stall A" }] })
        .mockResolvedValueOnce({ recordset: [{ id: 100 }] })
        .mockResolvedValueOnce({ recordset: [{ id: 500 }] })
        .mockResolvedValueOnce({});

      const vendorOptions = { 1: { include_cutlery: false } };
      const result = await checkoutModel.createOrdersFromCart(1, cartItems, "card", false, null, vendorOptions);

      expect(result.orders[0].include_cutlery).toBe(false);
      expect(mockRequest.input).toHaveBeenCalledWith("include_cutlery", sql.Bit, 0);
    });

    it("should trim and truncate special_request to 500 characters", async () => {
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ business_name: "Stall A" }] })
        .mockResolvedValueOnce({ recordset: [{ id: 100 }] })
        .mockResolvedValueOnce({ recordset: [{ id: 500 }] })
        .mockResolvedValueOnce({});

      const longNote = "x".repeat(600);
      const vendorOptions = { 1: { special_request: `  ${longNote}  ` } };

      const result = await checkoutModel.createOrdersFromCart(1, cartItems, "card", false, null, vendorOptions);

      expect(result.orders[0].special_request).toHaveLength(500);
    });

    it("should support guest checkout with a null patron_id and a guest_email", async () => {
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ business_name: "Stall A" }] })
        .mockResolvedValueOnce({ recordset: [{ id: 100 }] })
        .mockResolvedValueOnce({ recordset: [{ id: 500 }] })
        .mockResolvedValueOnce({});

      await checkoutModel.createOrdersFromCart(null, cartItems, "card", false, "guest@example.com", {});

      expect(mockRequest.input).toHaveBeenCalledWith("patron_id", sql.Int, null);
      expect(mockRequest.input).toHaveBeenCalledWith("guest_email", sql.VarChar, "guest@example.com");
    });

    it("should throw if a database query fails", async () => {
      mockRequest.query.mockRejectedValueOnce(new Error("DB write failed"));

      await expect(
        checkoutModel.createOrdersFromCart(1, cartItems, "card", false, null, {})
      ).rejects.toThrow("DB write failed");
    });
  });

  // ==========================================
  // getOrdersByIds
  // ==========================================
  describe("getOrdersByIds", () => {
    it("should build a parameterised IN clause and return matching orders", async () => {
      const mockOrders = [
        { order_id: 1, order_status: "completed", vendor_name: "Stall A", items: "Chicken Rice x1" },
      ];
      mockRequest.query.mockResolvedValueOnce({ recordset: mockOrders });

      const result = await checkoutModel.getOrdersByIds([1, 2, 3]);

      expect(mockRequest.input).toHaveBeenCalledWith("id0", sql.Int, 1);
      expect(mockRequest.input).toHaveBeenCalledWith("id1", sql.Int, 2);
      expect(mockRequest.input).toHaveBeenCalledWith("id2", sql.Int, 3);
      expect(result).toEqual(mockOrders);
    });

    it("should throw if the query fails", async () => {
      mockRequest.query.mockRejectedValueOnce(new Error("Query failed"));

      await expect(checkoutModel.getOrdersByIds([1])).rejects.toThrow("Query failed");
    });
  });
});