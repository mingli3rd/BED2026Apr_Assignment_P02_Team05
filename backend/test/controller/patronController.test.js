const patronController = require("../../controllers/patronController");
const patronModel = require("../../models/patronModel");
const bcrypt = require("bcrypt");

// Mock the dependencies
jest.mock("../../models/patronModel");
jest.mock("bcrypt");

describe("patronController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // 1. registerPatron
  // ==========================================
  describe("registerPatron", () => {
    it("should successfully register a new patron and return 201", async () => {
      const mockHashedPassword = "hashedpassword123";
      const mockNewPatron = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        phone: "12345678",
      };

      // Set up mocks
      patronModel.findUserByEmail.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue(mockHashedPassword);
      patronModel.createPatron.mockResolvedValue(mockNewPatron);

      const req = {
        body: {
          name: "John Doe",
          email: "john@example.com",
          phone: "12345678",
          password: "plainpassword123",
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await patronController.registerPatron(req, res);

      expect(patronModel.findUserByEmail).toHaveBeenCalledWith("john@example.com");
      expect(bcrypt.hash).toHaveBeenCalledWith("plainpassword123", 10);
      expect(patronModel.createPatron).toHaveBeenCalledWith({
        name: "John Doe",
        email: "john@example.com",
        phone: "12345678",
        password_hash: mockHashedPassword,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockNewPatron);
    });

    it("should return 409 if the email is already registered", async () => {
      patronModel.findUserByEmail.mockResolvedValue({ id: 1, email: "existing@example.com" });

      const req = {
        body: {
          email: "existing@example.com",
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await patronController.registerPatron(req, res);

      expect(patronModel.findUserByEmail).toHaveBeenCalledWith("existing@example.com");
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(patronModel.createPatron).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: "Email already registered" });
    });

    it("should handle errors and return a 500 status response", async () => {
      patronModel.findUserByEmail.mockRejectedValue(new Error("Database failure"));

      const req = {
        body: {
          email: "john@example.com",
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await patronController.registerPatron(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Error registering patron" });
    });
  });

  // ==========================================
  // 2. getPatronOrders
  // ==========================================
  describe("getPatronOrders", () => {
    it("should return patron data, welcome message, and order history with 200", async () => {
      const mockPatron = { id: 1, name: "John Doe" };
      const mockOrders = [
        { id: 101, total_amount: 15.5 },
        { id: 102, total_amount: 22.0 },
      ];

      patronModel.getPatronById.mockResolvedValue(mockPatron);
      patronModel.getOrdersByPatron.mockResolvedValue(mockOrders);

      const req = {
        patron: { id: 1 },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await patronController.getPatronOrders(req, res);

      expect(patronModel.getPatronById).toHaveBeenCalledWith(1);
      expect(patronModel.getOrdersByPatron).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        patron: mockPatron,
        welcome_message: "Welcome back, John Doe!",
        orders: mockOrders,
      });
    });

    it("should return 404 if patron is not found", async () => {
      patronModel.getPatronById.mockResolvedValue(null);

      const req = {
        patron: { id: 999 },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await patronController.getPatronOrders(req, res);

      expect(patronModel.getPatronById).toHaveBeenCalledWith(999);
      expect(patronModel.getOrdersByPatron).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Patron not found" });
    });

    it("should handle errors and return a 500 status response", async () => {
      patronModel.getPatronById.mockRejectedValue(new Error("Database error"));

      const req = {
        patron: { id: 1 },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await patronController.getPatronOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Error loading order history" });
    });
  });
});