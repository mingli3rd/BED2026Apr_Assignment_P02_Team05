const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Update a patron's name and phone number (email/password not editable here)
async function updateProfile(patronId, name, phone) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("id", sql.Int, patronId);
    request.input("name", sql.VarChar, name.trim());
    request.input("phone", sql.VarChar, phone || null);
    await request.query(`
      UPDATE Patrons SET name = @name, phone = @phone WHERE id = @id
    `);
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

module.exports = {
  updateProfile,
};
