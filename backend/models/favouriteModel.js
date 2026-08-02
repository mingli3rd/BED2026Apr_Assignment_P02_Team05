const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Add a stall to a patron's favourites (no-op if already favourited,
// thanks to the UNIQUE constraint)
async function addFavourite(patronId, vendorId) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("patron_id", sql.Int, patronId);
    request.input("vendor_id", sql.Int, vendorId);
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM PatronFavourites WHERE patron_id = @patron_id AND vendor_id = @vendor_id)
      INSERT INTO PatronFavourites (patron_id, vendor_id) VALUES (@patron_id, @vendor_id)
    `);
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Remove a stall from a patron's favourites
async function removeFavourite(patronId, vendorId) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("patron_id", sql.Int, patronId);
    request.input("vendor_id", sql.Int, vendorId);
    await request.query(`
      DELETE FROM PatronFavourites WHERE patron_id = @patron_id AND vendor_id = @vendor_id
    `);
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Get just the vendor IDs a patron has favourited (lightweight — used to
// mark which stalls show a filled heart icon while browsing)
async function getFavouriteVendorIds(patronId) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("patron_id", sql.Int, patronId);
    const result = await request.query(`
      SELECT vendor_id FROM PatronFavourites WHERE patron_id = @patron_id
    `);
    return result.recordset.map((row) => row.vendor_id);
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Get a patron's favourite stalls with full details (for the Favourites page)
async function getFavouritesByPatron(patronId) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("patron_id", sql.Int, patronId);
    const result = await request.query(`
      SELECT
        v.id,
        v.business_name,
        v.stall_number,
        v.banner_image,
        hc.name AS hawker_centre_name,
        hc.cover_image AS hawker_centre_cover_image,
        pf.created_at AS favourited_at,
        ISNULL(AVG(CAST(f.rating AS FLOAT)), 0) AS avg_rating,
        COUNT(f.id) AS review_count
      FROM PatronFavourites pf
      JOIN Vendors v ON pf.vendor_id = v.id
      LEFT JOIN HawkerCentres hc ON v.hawker_centre_id = hc.id
      LEFT JOIN Feedback f ON f.vendor_id = v.id
      WHERE pf.patron_id = @patron_id
      GROUP BY v.id, v.business_name, v.stall_number, v.banner_image, hc.name, hc.cover_image, pf.created_at
      ORDER BY pf.created_at DESC
    `);
    return result.recordset;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

module.exports = {
  addFavourite,
  removeFavourite,
  getFavouriteVendorIds,
  getFavouritesByPatron,
};
