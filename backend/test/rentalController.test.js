const rentalController = require("../controllers/rentalController");
const rentalModel = require("../models/rentalModel");

jest.mock("../models/rentalModel");

describe("rentalController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("uploadLatestRentalAgreementDocument", () => {
    it("should return 400 when no file is uploaded", async () => {
      const req = { vendor: { id: 1 } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await rentalController.uploadLatestRentalAgreementDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Please choose a PDF, DOC, or DOCX file to upload." });
    });

    it("should upload the latest agreement document and return 200", async () => {
      rentalModel.getLatestAgreementByVendor.mockResolvedValue({
        id: 5,
        start_date: "2026-01-01",
        end_date: "2026-12-31",
        monthly_rent: 900,
        status: "active",
        notes: null,
        document_path: null,
        created_at: "2026-01-01",
        days_until_expiry: 180,
      });
      rentalModel.updateLatestAgreementDocument.mockResolvedValue(true);

      const req = {
        vendor: { id: 1 },
        file: { filename: "12345-agreement.pdf" },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await rentalController.uploadLatestRentalAgreementDocument(req, res);

      expect(rentalModel.getLatestAgreementByVendor).toHaveBeenCalledWith(1);
      expect(rentalModel.updateLatestAgreementDocument).toHaveBeenCalledWith(1, "rental-agreements/12345-agreement.pdf");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Rental agreement document uploaded successfully",
        }),
      );
    });

    it("should return 404 when no rental agreement exists", async () => {
      rentalModel.getLatestAgreementByVendor.mockResolvedValue(null);

      const req = {
        vendor: { id: 1 },
        file: { filename: "12345-agreement.pdf" },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await rentalController.uploadLatestRentalAgreementDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "No rental agreement was found for this vendor." });
    });
  });

  describe("listRentalAgreements", () => {
    it("should only warn for the most recent agreement, not historical expired ones", async () => {
      rentalModel.getAgreementsByVendor.mockResolvedValue([
        {
          id: 2,
          start_date: "2025-01-01",
          end_date: "2026-12-31",
          monthly_rent: 1200,
          status: "active",
          notes: null,
          document_path: null,
          created_at: "2025-01-01",
          days_until_expiry: 120,
        },
        {
          id: 1,
          start_date: "2024-01-01",
          end_date: "2024-12-31",
          monthly_rent: 1000,
          status: "active",
          notes: null,
          document_path: null,
          created_at: "2024-01-01",
          days_until_expiry: -200,
        },
      ]);

      const req = { vendor: { id: 1 } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await rentalController.listRentalAgreements(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: [],
        }),
      );
    });
  });
});