const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Converts an inspection score into a letter grade
function scoreToGrade(score) {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  return "D";
}

// Records a new inspection and automatically issues the resulting hygiene
// grade, valid for 180 days from the inspection date.
async function createInspection(vendorId, officerId, score, remarks) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);

    const inspectionRequest = connection.request();
    inspectionRequest.input("vendor_id", sql.Int, vendorId);
    inspectionRequest.input("officer_id", sql.Int, officerId);
    inspectionRequest.input("score", sql.Int, score);
    inspectionRequest.input("remarks", sql.VarChar, remarks || null);

    const inspectionResult = await inspectionRequest.query(`
      INSERT INTO Inspections (vendor_id, officer_id, score, remarks)
      VALUES (@vendor_id, @officer_id, @score, @remarks);
      SELECT SCOPE_IDENTITY() AS id;
    `);
    const inspectionId = inspectionResult.recordset[0].id;

    const grade = scoreToGrade(score);

    const gradeRequest = connection.request();
    gradeRequest.input("vendor_id", sql.Int, vendorId);
    gradeRequest.input("inspection_id", sql.Int, inspectionId);
    gradeRequest.input("grade", sql.Char(1), grade);

    await gradeRequest.query(`
      INSERT INTO HygieneGrades (vendor_id, inspection_id, grade, valid_from, valid_to)
      VALUES (@vendor_id, @inspection_id, @grade, CAST(GETDATE() AS DATE), DATEADD(DAY, 180, CAST(GETDATE() AS DATE)))
    `);

    return { inspection_id: inspectionId, grade };
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { console.error("Error closing connection:", err); }
    }
  }
}

// Get all inspections carried out by a given officer, newest first
async function getInspectionsByOfficer(officerId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("officer_id", sql.Int, officerId);
    const result = await request.query(`
      SELECT i.id, i.vendor_id, v.business_name, i.inspection_date, i.score, i.remarks
      FROM Inspections i
      JOIN Vendors v ON i.vendor_id = v.id
      WHERE i.officer_id = @officer_id
      ORDER BY i.inspection_date DESC
    `);
    return result.recordset;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { console.error("Error closing connection:", err); }
    }
  }
}

// Get every stall registered on the platform (for the officer's inspection list)
async function getAllVendorsForInspection() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request().query(`
      SELECT id, business_name, stall_number, approval_status FROM Vendors ORDER BY business_name
    `);
    return result.recordset;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { console.error("Error closing connection:", err); }
    }
  }
}

module.exports = {
  createInspection,
  getInspectionsByOfficer,
  getAllVendorsForInspection,
};