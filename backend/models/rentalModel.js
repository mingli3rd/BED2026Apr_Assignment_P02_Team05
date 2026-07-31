const sql = require("mssql");
const dbConfig = require("../dbConfig");

async function hasAgreementDocumentColumn(connection) {
  const result = await connection.request().query(`
    SELECT COL_LENGTH('dbo.RentalAgreements', 'agreement_document') AS column_length
  `);

  return result.recordset[0]?.column_length !== null;
}

// Get all rental agreements for a vendor, newest first, with days until
// expiry computed directly in SQL so the app doesn't need to do date math
// on every row in JS.
async function getAgreementsByVendor(vendorId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const hasDocumentColumn = await hasAgreementDocumentColumn(connection);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);

    const documentSelect = hasDocumentColumn ? "agreement_document AS document_path," : "NULL AS document_path,";

    const query = `
      SELECT
        id,
        start_date,
        end_date,
        monthly_rent,
        status,
        notes,
        ${documentSelect}
        created_at,
        DATEDIFF(DAY, CAST(GETDATE() AS DATE), end_date) AS days_until_expiry
      FROM RentalAgreements
      WHERE vendor_id = @vendor_id
      ORDER BY end_date DESC
    `;
    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }
    }
  }
}

async function getLatestAgreementByVendor(vendorId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const hasDocumentColumn = await hasAgreementDocumentColumn(connection);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);

    const documentSelect = hasDocumentColumn ? "agreement_document AS document_path," : "NULL AS document_path,";

    const result = await request.query(`
      SELECT TOP (1)
        id,
        start_date,
        end_date,
        monthly_rent,
        status,
        notes,
        ${documentSelect}
        created_at,
        DATEDIFF(DAY, CAST(GETDATE() AS DATE), end_date) AS days_until_expiry
      FROM RentalAgreements
      WHERE vendor_id = @vendor_id
      ORDER BY created_at DESC, id DESC
    `);

    return result.recordset[0] || null;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }
    }
  }
}

async function updateLatestAgreementDocument(vendorId, documentPath) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const hasDocumentColumn = await hasAgreementDocumentColumn(connection);

    if (!hasDocumentColumn) {
      throw new Error("Rental agreement document storage is not configured.");
    }

    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    request.input("document_path", sql.VarChar, documentPath);

    const result = await request.query(`
      WITH latest_agreement AS (
        SELECT TOP (1) id
        FROM RentalAgreements
        WHERE vendor_id = @vendor_id
        ORDER BY created_at DESC, id DESC
      )
      UPDATE RentalAgreements
      SET agreement_document = @document_path
      FROM RentalAgreements
      INNER JOIN latest_agreement ON RentalAgreements.id = latest_agreement.id;

      SELECT @@ROWCOUNT AS affected;
    `);

    return result.recordset[0]?.affected > 0;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }
    }
  }
}

module.exports = {
  getAgreementsByVendor,
  getLatestAgreementByVendor,
  updateLatestAgreementDocument,
};