const performanceController = require("../../controllers/performanceController");
const performanceModel = require("../../models/performanceModel");

// Mock the model module
jest.mock("../../models/performanceModel");

describe("performanceController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getStallPerformance", () => {
    it("should fetch all performance data and return a JSON response", async () => {
      // 1. Mock the 4 model return values
      const mockSales = { total_orders: 10, total_revenue: 150, daily_trend: [] };
      const mockTopItems = [{ name: "Chicken Rice", total_quantity: 5 }];
      const mockFeedback = { total_reviews: 2, avg_rating: 4.5 };
      const mockComplaints = { by_status: [], recent_complaints: [] };

      performanceModel.getSalesSummary.mockResolvedValue(mockSales);
      performanceModel.getTopSellingItems.mockResolvedValue(mockTopItems);
      performanceModel.getFeedbackSummary.mockResolvedValue(mockFeedback);
      performanceModel.getComplaintsSummary.mockResolvedValue(mockComplaints);

      // 2. Mock req with req.vendor.id defined
      const req = {
        vendor: { id: 1 },
        query: {},
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      // 3. Call the controller function
      await performanceController.getStallPerformance(req, res);

      // 4. Verify model calls with expected vendorId
      expect(performanceModel.getSalesSummary).toHaveBeenCalledWith(1, 7);
      expect(performanceModel.getTopSellingItems).toHaveBeenCalledWith(1);
      expect(performanceModel.getFeedbackSummary).toHaveBeenCalledWith(1);
      expect(performanceModel.getComplaintsSummary).toHaveBeenCalledWith(1);

      // 5. Verify HTTP Response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        sales: mockSales,
        top_items: mockTopItems,
        feedback: mockFeedback,
        complaints: mockComplaints,
      });
    });

    it("should handle errors and return a 500 status response", async () => {
      // Simulate a failure in one of the model calls
      performanceModel.getSalesSummary.mockRejectedValue(new Error("DB Connection Error"));

      const req = {
        vendor: { id: 1 },
        query: {},
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await performanceController.getStallPerformance(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Error loading stall performance data",
      });
    });

    it("should use the requested days filter when provided", async () => {
      const mockSales = { total_orders: 3, total_revenue: 45, daily_trend: [] };
      performanceModel.getSalesSummary.mockResolvedValue(mockSales);
      performanceModel.getTopSellingItems.mockResolvedValue([]);
      performanceModel.getFeedbackSummary.mockResolvedValue({ total_reviews: 0, avg_rating: 0 });
      performanceModel.getComplaintsSummary.mockResolvedValue({ by_status: [], recent_complaints: [] });

      const req = {
        vendor: { id: 1 },
        query: { days: "30" },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await performanceController.getStallPerformance(req, res);

      expect(performanceModel.getSalesSummary).toHaveBeenCalledWith(1, 30);
    });

    it("should fall back to the default when an unsupported days value is given", async () => {
      performanceModel.getSalesSummary.mockResolvedValue({ total_orders: 0, total_revenue: 0, daily_trend: [] });
      performanceModel.getTopSellingItems.mockResolvedValue([]);
      performanceModel.getFeedbackSummary.mockResolvedValue({ total_reviews: 0, avg_rating: 0 });
      performanceModel.getComplaintsSummary.mockResolvedValue({ by_status: [], recent_complaints: [] });

      const req = {
        vendor: { id: 1 },
        query: { days: "365" }, // not in ALLOWED_DAYS
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await performanceController.getStallPerformance(req, res);

      expect(performanceModel.getSalesSummary).toHaveBeenCalledWith(1, 7);
    });
  });
});

