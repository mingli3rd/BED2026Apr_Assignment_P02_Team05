const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Total revenue and order count for a vendor, plus a daily sales trend
// over the last `days` days (default 7)
async function getSalesSummary(vendorId, days = 7) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);

    // Overall totals (completed orders only, so pending/cancelled don't skew revenue)
    const totalsQuery = `
      SELECT
        COUNT(*) AS total_orders,
        ISNULL(SUM(total_amount), 0) AS total_revenue
      FROM Orders
      WHERE vendor_id = @vendor_id AND order_status = 'completed'
    `;
    const totalsResult = await request.query(totalsQuery);

    // Daily sales trend for the last `days` days (for the line chart)
    const trendRequest = connection.request();
    trendRequest.input("vendor_id", sql.Int, vendorId);
    trendRequest.input("days", sql.Int, days);
    const trendQuery = `
      SELECT
        CAST(created_at AS DATE) AS order_date,
        SUM(total_amount) AS daily_revenue,
        COUNT(*) AS daily_orders
      FROM Orders
      WHERE vendor_id = @vendor_id
        AND order_status = 'completed'
        AND created_at >= DATEADD(DAY, -@days, GETDATE())
      GROUP BY CAST(created_at AS DATE)
      ORDER BY order_date ASC
    `;
    const trendResult = await trendRequest.query(trendQuery);

    // The query above only returns rows for days that actually had
    // completed orders. Fill in the missing days with 0 revenue so the
    // chart always shows a full, evenly-spaced span instead of
    // silently compressing down to just the days with sales.
    const dailyTrend = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0]; // "YYYY-MM-DD"

      const match = trendResult.recordset.find((row) => {
        const rowDateStr = new Date(row.order_date).toISOString().split("T")[0];
        return rowDateStr === dateStr;
      });

      dailyTrend.push({
        order_date: dateStr,
        daily_revenue: match ? match.daily_revenue : 0,
        daily_orders: match ? match.daily_orders : 0,
      });
    }

    return {
      total_orders: totalsResult.recordset[0].total_orders,
      total_revenue: totalsResult.recordset[0].total_revenue,
      daily_trend: dailyTrend,
    };
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Top-selling menu items by quantity sold, for a vendor
async function getTopSellingItems(vendorId) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);

    const query = `
      SELECT
        mi.name,
        SUM(oi.quantity) AS total_quantity,
        SUM(oi.subtotal) AS total_revenue
      FROM OrderItems oi
      JOIN MenuItems mi ON oi.menu_item_id = mi.id
      JOIN Orders o ON oi.order_id = o.id
      WHERE mi.vendor_id = @vendor_id AND o.order_status = 'completed'
      GROUP BY mi.name
      ORDER BY total_quantity DESC
    `;
    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Average rating and rating distribution (count of 1-star, 2-star, etc.) for a vendor
async function getFeedbackSummary(vendorId) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);

    const avgQuery = `
      SELECT
        COUNT(*) AS total_reviews,
        ISNULL(AVG(CAST(rating AS FLOAT)), 0) AS avg_rating
      FROM Feedback
      WHERE vendor_id = @vendor_id
    `;
    const avgResult = await request.query(avgQuery);

    const distRequest = connection.request();
    distRequest.input("vendor_id", sql.Int, vendorId);
    const distQuery = `
      SELECT rating, COUNT(*) AS count
      FROM Feedback
      WHERE vendor_id = @vendor_id
      GROUP BY rating
    `;
    const distResult = await distRequest.query(distQuery);

    // Fill in zero counts for any star rating with no reviews, so the chart
    // always has all 5 bars instead of skipping missing ratings
    const distribution = [1, 2, 3, 4, 5].map((star) => {
      const match = distResult.recordset.find((r) => r.rating === star);
      return { rating: star, count: match ? match.count : 0 };
    });

    // Recent comments for the feedback list on the dashboard
    const recentRequest = connection.request();
    recentRequest.input("vendor_id", sql.Int, vendorId);
    const recentQuery = `
      SELECT TOP 5 rating, comment, created_at
      FROM Feedback
      WHERE vendor_id = @vendor_id AND comment IS NOT NULL
      ORDER BY created_at DESC
    `;
    const recentResult = await recentRequest.query(recentQuery);

    return {
      total_reviews: avgResult.recordset[0].total_reviews,
      avg_rating: avgResult.recordset[0].avg_rating,
      distribution,
      recent_comments: recentResult.recordset,
    };
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Complaint counts by status, plus the most recent complaints
async function getComplaintsSummary(vendorId) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);

    const countsQuery = `
      SELECT status, COUNT(*) AS count
      FROM Complaints
      WHERE vendor_id = @vendor_id
      GROUP BY status
    `;
    const countsResult = await request.query(countsQuery);

    const recentRequest = connection.request();
    recentRequest.input("vendor_id", sql.Int, vendorId);
    const recentQuery = `
      SELECT TOP 5 description, status, created_at
      FROM Complaints
      WHERE vendor_id = @vendor_id
      ORDER BY created_at DESC
    `;
    const recentResult = await recentRequest.query(recentQuery);

    return {
      by_status: countsResult.recordset,
      recent_complaints: recentResult.recordset,
    };
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

module.exports = {
  getSalesSummary,
  getTopSellingItems,
  getFeedbackSummary,
  getComplaintsSummary,
};
