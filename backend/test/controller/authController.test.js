const authController = require("../../controllers/authController");
const vendorModel = require("../../models/vendorModel");
const patronModel = require("../../models/patronModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

jest.mock("../../models/vendorModel");
jest.mock("../../models/patronModel");
jest.mock("bcrypt");
jest.mock("jsonwebtoken");

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  };
}

describe("authController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    jwt.sign.mockReturnValue("fake.jwt.token");
  });

  describe("login", () => {
    const mockVendor = {
      id: 1,
      email: "vendor@example.com",
      password_hash: "hashed",
      business_name: "Chicken Rice Stall",
      approval_status: "approved",
    };

    const mockPatron = {
      id: 2,
      email: "patron@example.com",
      password_hash: "hashed",
      name: "Jane Doe",
    };

    it("should log in a vendor with correct credentials", async () => {
      vendorModel.getVendorAuthByEmail.mockResolvedValue(mockVendor);
      bcrypt.compare.mockResolvedValue(true);

      const req = { body: { email: "vendor@example.com", password: "correct" } };
      const res = mockRes();

      await authController.login(req, res);

      expect(vendorModel.getVendorAuthByEmail).toHaveBeenCalledWith("vendor@example.com");
      expect(patronModel.getPatronAuthByEmail).not.toHaveBeenCalled(); // vendor matched first, no fallback needed
      expect(res.cookie).toHaveBeenCalledWith("token", "fake.jwt.token", expect.objectContaining({ httpOnly: true }));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Login successful",
        vendor: {
          id: mockVendor.id,
          business_name: mockVendor.business_name,
          email: mockVendor.email,
          role: "vendor",
        },
      });
    });

    it("should return 401 for a vendor with wrong password", async () => {
      vendorModel.getVendorAuthByEmail.mockResolvedValue(mockVendor);
      bcrypt.compare.mockResolvedValue(false);

      const req = { body: { email: "vendor@example.com", password: "wrong" } };
      const res = mockRes();

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid email or password" });
    });

    it("should return 403 if the vendor's account is still pending approval", async () => {
      vendorModel.getVendorAuthByEmail.mockResolvedValue({ ...mockVendor, approval_status: "pending" });
      bcrypt.compare.mockResolvedValue(true);

      const req = { body: { email: "vendor@example.com", password: "correct" } };
      const res = mockRes();

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "Your account is still pending approval." });
    });

    it("should return 403 if the vendor's account was rejected", async () => {
      vendorModel.getVendorAuthByEmail.mockResolvedValue({ ...mockVendor, approval_status: "rejected" });
      bcrypt.compare.mockResolvedValue(true);

      const req = { body: { email: "vendor@example.com", password: "correct" } };
      const res = mockRes();

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "Your account application was not approved." });
    });

    it("should log in a patron with correct credentials when no vendor matches", async () => {
      vendorModel.getVendorAuthByEmail.mockResolvedValue(null);
      patronModel.getPatronAuthByEmail.mockResolvedValue(mockPatron);
      bcrypt.compare.mockResolvedValue(true);

      const req = { body: { email: "patron@example.com", password: "correct" } };
      const res = mockRes();

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Login successful",
        patron: {
          id: mockPatron.id,
          name: mockPatron.name,
          email: mockPatron.email,
          role: "patron",
        },
      });
    });

    it("should return 401 for a patron with wrong password", async () => {
      vendorModel.getVendorAuthByEmail.mockResolvedValue(null);
      patronModel.getPatronAuthByEmail.mockResolvedValue(mockPatron);
      bcrypt.compare.mockResolvedValue(false);

      const req = { body: { email: "patron@example.com", password: "wrong" } };
      const res = mockRes();

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid email or password" });
    });

    it("should return 401 with a generic message when no account matches either table", async () => {
      vendorModel.getVendorAuthByEmail.mockResolvedValue(null);
      patronModel.getPatronAuthByEmail.mockResolvedValue(null);

      const req = { body: { email: "nobody@example.com", password: "whatever" } };
      const res = mockRes();

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid email or password" });
    });

    it("should only check the Vendors table when expected_role is 'vendor', even if a patron with that email exists", async () => {
      vendorModel.getVendorAuthByEmail.mockResolvedValue(null);

      const req = {
        body: { email: "shared@example.com", password: "whatever", expected_role: "vendor" },
      };
      const res = mockRes();

      await authController.login(req, res);

      expect(vendorModel.getVendorAuthByEmail).toHaveBeenCalledWith("shared@example.com");
      expect(patronModel.getPatronAuthByEmail).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should only check the Patrons table when expected_role is 'patron', even if a vendor with that email exists", async () => {
      patronModel.getPatronAuthByEmail.mockResolvedValue(null);

      const req = {
        body: { email: "shared@example.com", password: "whatever", expected_role: "patron" },
      };
      const res = mockRes();

      await authController.login(req, res);

      expect(vendorModel.getVendorAuthByEmail).not.toHaveBeenCalled();
      expect(patronModel.getPatronAuthByEmail).toHaveBeenCalledWith("shared@example.com");
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should set a 30-day persistent cookie when remember_me is true", async () => {
      vendorModel.getVendorAuthByEmail.mockResolvedValue(mockVendor);
      bcrypt.compare.mockResolvedValue(true);

      const req = { body: { email: "vendor@example.com", password: "correct", remember_me: true } };
      const res = mockRes();

      await authController.login(req, res);

      expect(jwt.sign).toHaveBeenCalledWith(expect.any(Object), "test-secret", { expiresIn: "30d" });
      expect(res.cookie).toHaveBeenCalledWith(
        "token",
        "fake.jwt.token",
        expect.objectContaining({ maxAge: 30 * 24 * 60 * 60 * 1000 })
      );
    });

    it("should set a session cookie (no maxAge) when remember_me is false or omitted", async () => {
      vendorModel.getVendorAuthByEmail.mockResolvedValue(mockVendor);
      bcrypt.compare.mockResolvedValue(true);

      const req = { body: { email: "vendor@example.com", password: "correct" } };
      const res = mockRes();

      await authController.login(req, res);

      expect(jwt.sign).toHaveBeenCalledWith(expect.any(Object), "test-secret", { expiresIn: "1d" });
      const cookieCallArgs = res.cookie.mock.calls[0][2];
      expect(cookieCallArgs.maxAge).toBeUndefined();
    });

    it("should return 500 if a database error occurs", async () => {
      vendorModel.getVendorAuthByEmail.mockRejectedValue(new Error("DB down"));

      const req = { body: { email: "vendor@example.com", password: "correct" } };
      const res = mockRes();

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Error logging in" });
    });
  });

  describe("logout", () => {
    it("should clear the auth cookie and return 200", () => {
      const req = {};
      const res = mockRes();

      authController.logout(req, res);

      expect(res.clearCookie).toHaveBeenCalledWith("token");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "Logged out successfully" });
    });
  });

  describe("getCurrentVendor", () => {
    it("should return the logged-in vendor's basic info from req.vendor", () => {
      const req = { vendor: { id: 1, email: "vendor@example.com", role: "vendor" } };
      const res = mockRes();

      authController.getCurrentVendor(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        vendor: { id: 1, email: "vendor@example.com", role: "vendor" },
      });
    });
  });

  describe("getCurrentPatron", () => {
    it("should return the logged-in patron's basic info from req.patron", () => {
      const req = { patron: { id: 2, email: "patron@example.com", role: "patron" } };
      const res = mockRes();

      authController.getCurrentPatron(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        patron: { id: 2, email: "patron@example.com", role: "patron" },
      });
    });
  });

  describe("getSession", () => {
    it("should return guest when there is no token cookie", () => {
      const req = { cookies: {} };
      const res = mockRes();

      authController.getSession(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ role: "guest", user: null });
    });

    it("should return vendor session info for a valid vendor token", () => {
      jwt.verify.mockReturnValue({ id: 1, email: "vendor@example.com", role: "vendor" });

      const req = { cookies: { token: "valid.vendor.token" } };
      const res = mockRes();

      authController.getSession(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        role: "vendor",
        user: { id: 1, email: "vendor@example.com", role: "vendor" },
      });
    });

    it("should return patron session info for a valid patron token", () => {
      jwt.verify.mockReturnValue({ id: 2, email: "patron@example.com", role: "patron" });

      const req = { cookies: { token: "valid.patron.token" } };
      const res = mockRes();

      authController.getSession(req, res);

      expect(res.json).toHaveBeenCalledWith({
        role: "patron",
        user: { id: 2, email: "patron@example.com", role: "patron" },
      });
    });

    it("should return guest if the token decodes to an unrecognized role", () => {
      jwt.verify.mockReturnValue({ id: 3, email: "x@example.com", role: "admin" });

      const req = { cookies: { token: "weird.token" } };
      const res = mockRes();

      authController.getSession(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ role: "guest", user: null });
    });

    it("should return guest (not throw) if the token is invalid or expired", () => {
      jwt.verify.mockImplementation(() => {
        throw new Error("jwt expired");
      });

      const req = { cookies: { token: "expired.token" } };
      const res = mockRes();

      authController.getSession(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ role: "guest", user: null });
    });
  });
});