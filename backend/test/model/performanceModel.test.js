const performanceModel = require("../../models/performanceModel");
const sql = require("mssql");

// Mock the mssql library completely
jest.mock("mssql");

describe("performanceModel", () => {
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
  // 1. getSalesSummary
  // ==========================================
  describe("getSalesSummary", () => {
    it("should fetch totals and trend, fill missing days, and close the connection", async () => {
      const vendorId = 1;

      // getSalesSummary executes two separate sql queries:
      // 1st query: overall totals
      // 2nd query: daily trend results
      mockRequest.query
        .mockResolvedValueOnce({
          recordset: [{ total_orders: 5, total_revenue: 150 }],
        })
        .mockResolvedValueOnce({
          recordset: [
            {
              order_date: new Date().toISOString(),
              daily_revenue: 150,
              daily_orders: 5,
            },
          ],
        });

      const result = await performanceModel.getSalesSummary(vendorId);

      expect(sql.connect).toHaveBeenCalled();
      expect(mockRequest.input).toHaveBeenCalledWith("vendor_id", sql.Int, vendorId);
      expect(mockRequest.query).toHaveBeenCalledTimes(2);
      expect(mockConnection.close).toHaveBeenCalledTimes(1);

      // Assert structure returned
      expect(result.total_orders).toBe(5);
      expect(result.total_revenue).toBe(150);
      expect(result.daily_trend).toHaveLength(7); // Must format to a full 7-day span
    });

    it("should throw error and close connection if a query fails", async () => {
      const errorMessage = "Database Error";
      sql.connect.mockRejectedValue(new Error(errorMessage));

      await expect(performanceModel.getSalesSummary(1)).rejects.toThrow(errorMessage);
    });
  });

  // ==========================================
  // 2. getTopSellingItems
  // ==========================================
  describe("getTopSellingItems", () => {
    it("should return top selling menu items for a vendor", async () => {
      const vendorId = 1;
      const mockTopItems = [
        { name: "Chicken Rice", total_quantity: 12, total_revenue: 60 },
        { name: "Iced Tea", total_quantity: 8, total_revenue: 16 },
      ];

      mockRequest.query.mockResolvedValueOnce({ recordset: mockTopItems });

      const result = await performanceModel.getTopSellingItems(vendorId);

      expect(sql.connect).toHaveBeenCalled();
      expect(mockRequest.input).toHaveBeenCalledWith("vendor_id", sql.Int, vendorId);
      expect(mockConnection.close).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Chicken Rice");
    });

    it("should throw error if query fails", async () => {
      mockRequest.query.mockRejectedValueOnce(new Error("Query failed"));

      await expect(performanceModel.getTopSellingItems(1)).rejects.toThrow("Query failed");
      expect(mockConnection.close).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================
  // 3. getFeedbackSummary
  // ==========================================
  describe("getFeedbackSummary", () => {
    it("should fetch ratings, distribution, and recent comments", async () => {
      const vendorId = 1;

      // getFeedbackSummary executes 3 queries in sequence:
      // 1. Average query
      // 2. Distribution query
      // 3. Recent comments query
      mockRequest.query
        .mockResolvedValueOnce({
          recordset: [{ total_reviews: 10, avg_rating: 4.2 }],
        })
        .mockResolvedValueOnce({
          recordset: [
            { rating: 5, count: 8 },
            { rating: 4, count: 2 },
          ],
        })
        .mockResolvedValueOnce({
          recordset: [{ rating: 5, comment: "Delicious!", created_at: "2026-03-01" }],
        });

      const result = await performanceModel.getFeedbackSummary(vendorId);

      expect(sql.connect).toHaveBeenCalled();
      expect(mockRequest.query).toHaveBeenCalledTimes(3);
      expect(mockConnection.close).toHaveBeenCalledTimes(1);

      expect(result.total_reviews).toBe(10);
      expect(result.avg_rating).toBe(4.2);
      expect(result.distribution).toHaveLength(5); // Must format to 5-star distribution array
      expect(result.recent_comments).toHaveLength(1);
    });
  });

  // ==========================================
  // 4. getComplaintsSummary
  // ==========================================
  describe("getComplaintsSummary", () => {
    it("should return complaints count by status and recent complaints", async () => {
      const vendorId = 1;

      // getComplaintsSummary executes 2 queries:
      // 1. Counts query
      // 2. Recent complaints query
      mockRequest.query
        .mockResolvedValueOnce({
          recordset: [{ status: "Pending", count: 1 }],
        })
        .mockResolvedValueOnce({
          recordset: [{ description: "Cold food", status: "Pending", created_at: "2026-03-01" }],
        });

      const result = await performanceModel.getComplaintsSummary(vendorId);

      expect(sql.connect).toHaveBeenCalled();
      expect(mockRequest.query).toHaveBeenCalledTimes(2);
      expect(mockConnection.close).toHaveBeenCalledTimes(1);

      expect(result.by_status).toHaveLength(1);
      expect(result.recent_complaints).toHaveLength(1);
      expect(result.recent_complaints[0].description).toBe("Cold food");
    });
  });
});