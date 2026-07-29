const patronModel = require("../models/patronModel");
const sql = require("mssql");

// Mock the mssql library
jest.mock("mssql");

describe("patronModel", () => {
  let mockRequest;
  let mockConnection;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up mock request and connection objects for mssql chaining
    mockRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn(),
    };

    mockConnection = {
      request: jest.fn().mockReturnValue(mockRequest),
      close: jest.fn().mockResolvedValue(undefined),
    };

    // Default sql.connect to return our mock connection
    sql.connect.mockResolvedValue(mockConnection);
  });

  // ==========================================
  // 1. findUserByEmail
  // ==========================================
  describe("findUserByEmail", () => {
    it("should return user record if email exists", async () => {
      const mockUser = { id: 1, email: "patron@example.com" };
      mockRequest.query.mockResolvedValueOnce({ recordset: [mockUser] });

      const result = await patronModel.findUserByEmail("patron@example.com");

      expect(sql.connect).toHaveBeenCalled();
      expect(mockRequest.input).toHaveBeenCalledWith("email", sql.VarChar, "patron@example.com");
      expect(mockConnection.close).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockUser);
    });

    it("should return null if email is not found", async () => {
      mockRequest.query.mockResolvedValueOnce({ recordset: [] });

      const result = await patronModel.findUserByEmail("nonexistent@example.com");

      expect(result).toBeNull();
      expect(mockConnection.close).toHaveBeenCalledTimes(1);
    });

    it("should throw error and close connection if query fails", async () => {
      mockRequest.query.mockRejectedValueOnce(new Error("Database Error"));

      await expect(patronModel.findUserByEmail("test@example.com")).rejects.toThrow("Database Error");
      expect(mockConnection.close).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================
  // 2. createPatron
  // ==========================================
  describe("createPatron", () => {
    it("should insert a new patron and return the created patron details", async () => {
      const patronData = {
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "98765432",
        password_hash: "hashed_pass_123",
      };

      const createdPatron = {
        id: 1,
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "98765432",
        role: "patron",
        created_at: "2026-03-01",
      };

      // 1st query: INSERT INTO Patrons -> returns SCOPE_IDENTITY id = 1
      // 2nd query: getPatronById -> returns the full patron record
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ id: 1 }] })
        .mockResolvedValueOnce({ recordset: [createdPatron] });

      const result = await patronModel.createPatron(patronData);

      expect(sql.connect).toHaveBeenCalledTimes(2); // Called once in createPatron, once in getPatronById
      expect(mockRequest.input).toHaveBeenCalledWith("name", sql.VarChar, patronData.name);
      expect(mockRequest.input).toHaveBeenCalledWith("email", sql.VarChar, patronData.email);
      expect(mockRequest.input).toHaveBeenCalledWith("phone", sql.VarChar, patronData.phone);
      expect(mockRequest.input).toHaveBeenCalledWith("password_hash", sql.VarChar, patronData.password_hash);
      expect(mockRequest.input).toHaveBeenCalledWith("role", sql.VarChar, "patron");
      expect(result).toEqual(createdPatron);
    });

    it("should pass null for phone if phone parameter is missing", async () => {
      const patronData = {
        name: "Jane Doe",
        email: "jane@example.com",
        password_hash: "hashed_pass_123",
      };

      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ id: 1 }] })
        .mockResolvedValueOnce({ recordset: [{ id: 1, name: "Jane Doe" }] });

      await patronModel.createPatron(patronData);

      expect(mockRequest.input).toHaveBeenCalledWith("phone", sql.VarChar, null);
    });
  });

  // ==========================================
  // 3. getPatronById
  // ==========================================
  describe("getPatronById", () => {
    it("should return patron details without password hash", async () => {
      const mockPatron = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        phone: "12345678",
        role: "patron",
        created_at: "2026-03-01",
      };

      mockRequest.query.mockResolvedValueOnce({ recordset: [mockPatron] });

      const result = await patronModel.getPatronById(1);

      expect(mockRequest.input).toHaveBeenCalledWith("id", sql.Int, 1);
      expect(result).toEqual(mockPatron);
      expect(mockConnection.close).toHaveBeenCalledTimes(1);
    });

    it("should return null if patron ID does not exist", async () => {
      mockRequest.query.mockResolvedValueOnce({ recordset: [] });

      const result = await patronModel.getPatronById(999);

      expect(result).toBeNull();
      expect(mockConnection.close).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================
  // 4. getPatronAuthByEmail
  // ==========================================
  describe("getPatronAuthByEmail", () => {
    it("should return patron authentication record including password hash", async () => {
      const mockAuthUser = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        password_hash: "secret_hash",
        role: "patron",
      };

      mockRequest.query.mockResolvedValueOnce({ recordset: [mockAuthUser] });

      const result = await patronModel.getPatronAuthByEmail("john@example.com");

      expect(mockRequest.input).toHaveBeenCalledWith("email", sql.VarChar, "john@example.com");
      expect(result).toEqual(mockAuthUser);
      expect(mockConnection.close).toHaveBeenCalledTimes(1);
    });

    it("should return null if patron authentication record is not found", async () => {
      mockRequest.query.mockResolvedValueOnce({ recordset: [] });

      const result = await patronModel.getPatronAuthByEmail("missing@example.com");

      expect(result).toBeNull();
    });
  });

  // ==========================================
  // 5. getOrdersByPatron
  // ==========================================
  describe("getOrdersByPatron", () => {
    it("should return formatted order history for a patron", async () => {
      const mockOrders = [
        {
          order_id: 101,
          order_status: "completed",
          total_amount: 15.5,
          created_at: "2026-03-01",
          vendor_id: 2,
          vendor_name: "Western Stall",
          banner_image: "image.jpg",
          items: "Chicken Chop x1, Iced Tea x2",
        },
      ];

      mockRequest.query.mockResolvedValueOnce({ recordset: mockOrders });

      const result = await patronModel.getOrdersByPatron(1);

      expect(mockRequest.input).toHaveBeenCalledWith("patron_id", sql.Int, 1);
      expect(mockConnection.close).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockOrders);
      expect(result[0].items).toBe("Chicken Chop x1, Iced Tea x2");
    });

    it("should throw error if order history query fails", async () => {
      mockRequest.query.mockRejectedValueOnce(new Error("Database error"));

      await expect(patronModel.getOrdersByPatron(1)).rejects.toThrow("Database error");
      expect(mockConnection.close).toHaveBeenCalledTimes(1);
    });
  });
});