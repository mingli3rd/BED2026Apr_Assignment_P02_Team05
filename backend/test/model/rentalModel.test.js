const rentalModel = require("../../models/rentalModel");
const sql = require("mssql");

jest.mock("mssql");

describe("rentalModel", () => {
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

  describe("getAgreementsByVendor", () => {
    it("should return agreements with the document path field", async () => {
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [] })
        .mockResolvedValueOnce({
        recordset: [
          {
            id: 1,
            start_date: "2026-01-01",
            end_date: "2026-12-31",
            monthly_rent: 900,
            status: "active",
            notes: null,
            document_path: "rental-agreements/example.pdf",
            created_at: "2026-01-01",
            days_until_expiry: 180,
          },
        ],
      });

      const agreements = await rentalModel.getAgreementsByVendor(7);

      expect(sql.connect).toHaveBeenCalled();
      expect(mockRequest.query).toHaveBeenCalledTimes(2);
      expect(agreements[0].document_path).toBe("rental-agreements/example.pdf");
      expect(mockConnection.close).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateLatestAgreementDocument", () => {
    it("should update the newest agreement document path", async () => {
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [] })
        .mockResolvedValueOnce({ recordset: [{ affected: 1 }] });

      const result = await rentalModel.updateLatestAgreementDocument(7, "rental-agreements/example.pdf");

      expect(sql.connect).toHaveBeenCalled();
      expect(mockRequest.input).toHaveBeenCalledWith("vendor_id", sql.Int, 7);
      expect(mockRequest.input).toHaveBeenCalledWith("document_path", sql.VarChar, "rental-agreements/example.pdf");
      expect(result).toBe(true);
      expect(mockConnection.close).toHaveBeenCalledTimes(1);
    });
  });
});