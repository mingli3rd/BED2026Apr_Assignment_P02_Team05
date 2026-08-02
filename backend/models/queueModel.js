const sql = require("mssql");
const dbConfig = require("../dbConfig");

const NOTIFY_THRESHOLD = 3; // notify a customer when they're this many places from the front

// --- Queue status (per-vendor open/paused/now_serving) ---

async function getStatusByVendor(vendorId) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    const result = await request.query(`SELECT * FROM QueueStatus WHERE vendor_id = @vendor_id`);
    return result.recordset[0] || null;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Sets up a fresh QueueStatus row for a vendor who doesn't have one yet
// (e.g. a newly registered stall) — defaults to open, unpaused.
async function createStatusRow(vendorId) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    await request.query(`
      INSERT INTO QueueStatus (vendor_id, is_open, is_paused, now_serving, updated_at)
      VALUES (@vendor_id, 1, 0, NULL, GETDATE())
    `);
    return await getStatusByVendor(vendorId);
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

async function setOpen(vendorId, isOpen) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    request.input("is_open", sql.Bit, isOpen ? 1 : 0);
    await request.query(`UPDATE QueueStatus SET is_open = @is_open, updated_at = GETDATE() WHERE vendor_id = @vendor_id`);
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

async function setPaused(vendorId, isPaused) {
  try {
    const connection = await sql.connect(dbConfig);
    const request = connection.request();
    request.input("vendor_id", sql.Int, vendorId);
    request.input("is_paused", sql.Bit, isPaused ? 1 : 0);
    await request.query(`UPDATE QueueStatus SET is_paused = @is_paused, updated_at = GETDATE() WHERE vendor_id = @vendor_id`);
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// --- Customer join / status / cancel ---

// Joins the queue for a vendor. patronId may be null for guests (guestIdentifier
// used instead). Rejects if the queue is closed or the customer already has
// an active (waiting/called) ticket for this stall.
async function joinQueue(vendorId, patronId, guestIdentifier) {
  try {
    const connection = await sql.connect(dbConfig);

    const statusResult = await connection.request()
      .input("vendor_id", sql.Int, vendorId)
      .query(`SELECT * FROM QueueStatus WHERE vendor_id = @vendor_id`);
    const status = statusResult.recordset[0];
    if (!status) {
      return { error: "not_found" };
    }
    if (!status.is_open) {
      return { error: "closed" };
    }
    if (status.is_paused) {
      return { error: "paused" };
    }

    const dupeResult = await connection.request()
      .input("vendor_id", sql.Int, vendorId)
      .input("patron_id", sql.Int, patronId || null)
      .input("guest_id", sql.VarChar, guestIdentifier || null)
      .query(`
        SELECT id FROM QueueEntries
        WHERE vendor_id = @vendor_id
          AND status = 'waiting'
          AND ((@patron_id IS NOT NULL AND patron_id = @patron_id) OR (@guest_id IS NOT NULL AND guest_identifier = @guest_id))
      `);
    if (dupeResult.recordset.length > 0) {
      return { error: "duplicate" };
    }

    const maxResult = await connection.request()
      .input("vendor_id", sql.Int, vendorId)
      .query(`SELECT ISNULL(MAX(queue_number), 0) AS max_number FROM QueueEntries WHERE vendor_id = @vendor_id`);
    const nextNumber = maxResult.recordset[0].max_number + 1;

    const insertResult = await connection.request()
      .input("vendor_id", sql.Int, vendorId)
      .input("patron_id", sql.Int, patronId || null)
      .input("guest_id", sql.VarChar, guestIdentifier || null)
      .input("queue_number", sql.Int, nextNumber)
      .query(`
        INSERT INTO QueueEntries (vendor_id, patron_id, guest_identifier, queue_number, status, joined_at, updated_at)
        OUTPUT INSERTED.*
        VALUES (@vendor_id, @patron_id, @guest_id, @queue_number, 'waiting', GETDATE(), GETDATE())
      `);
    const entry = insertResult.recordset[0];

    const posResult = await connection.request()
      .input("vendor_id", sql.Int, vendorId)
      .input("queue_number", sql.Int, entry.queue_number)
      .query(`
        SELECT COUNT(*) AS people_ahead FROM QueueEntries
        WHERE vendor_id = @vendor_id AND status IN ('waiting', 'called') AND queue_number < @queue_number
      `);

    return { entry, position: posResult.recordset[0].people_ahead + 1 };
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Fetches a customer's own live queue status for a vendor (for polling)
async function getMyEntry(vendorId, patronId, guestIdentifier) {
  try {
    const connection = await sql.connect(dbConfig);

    const entryResult = await connection.request()
      .input("vendor_id", sql.Int, vendorId)
      .input("patron_id", sql.Int, patronId || null)
      .input("guest_id", sql.VarChar, guestIdentifier || null)
      .query(`
        SELECT TOP 1 * FROM QueueEntries
        WHERE vendor_id = @vendor_id
          AND ((@patron_id IS NOT NULL AND patron_id = @patron_id) OR (@guest_id IS NOT NULL AND guest_identifier = @guest_id))
        ORDER BY id DESC
      `);
    const entry = entryResult.recordset[0];
    if (!entry) return null;

    const statusResult = await connection.request()
      .input("vendor_id", sql.Int, vendorId)
      .query(`SELECT * FROM QueueStatus WHERE vendor_id = @vendor_id`);
    const status = statusResult.recordset[0] || null;

    let peopleAhead = 0;
    if (entry.status === "waiting" || entry.status === "called") {
      const posResult = await connection.request()
        .input("vendor_id", sql.Int, vendorId)
        .input("queue_number", sql.Int, entry.queue_number)
        .query(`
          SELECT COUNT(*) AS people_ahead FROM QueueEntries
          WHERE vendor_id = @vendor_id AND status IN ('waiting', 'called') AND queue_number < @queue_number
        `);
      peopleAhead = posResult.recordset[0].people_ahead;
    }

    return {
      entry,
      position: entry.status === "served" || entry.status === "cancelled" ? null : peopleAhead + 1,
      now_serving: status ? status.now_serving : null,
      queue_open: status ? Boolean(status.is_open) : false,
      queue_paused: status ? Boolean(status.is_paused) : false,
    };
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Cancels a customer's own waiting ticket. Returns null if not found,
// "forbidden" if it belongs to someone else, "not_waiting" if it can't be
// cancelled anymore, or the cancelled entry on success.
async function cancelEntry(entryId, patronId, guestIdentifier) {
  try {
    const connection = await sql.connect(dbConfig);

    const entryResult = await connection.request()
      .input("id", sql.Int, entryId)
      .query(`SELECT * FROM QueueEntries WHERE id = @id`);
    const entry = entryResult.recordset[0];
    if (!entry) return { error: "not_found" };

    const isOwner =
      (patronId && entry.patron_id === Number(patronId)) ||
      (guestIdentifier && entry.guest_identifier === guestIdentifier);
    if (!isOwner) return { error: "forbidden" };
    if (entry.status !== "waiting") return { error: "not_waiting" };

    await connection.request()
      .input("id", sql.Int, entryId)
      .query(`UPDATE QueueEntries SET status = 'cancelled', updated_at = GETDATE() WHERE id = @id`);

    return { success: true };
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// --- Vendor management ---

// Live waiting/called list for the vendor dashboard, with patron names resolved
async function getVendorQueueList(vendorId) {
  try {
    const connection = await sql.connect(dbConfig);

    const statusResult = await connection.request()
      .input("vendor_id", sql.Int, vendorId)
      .query(`SELECT * FROM QueueStatus WHERE vendor_id = @vendor_id`);
    const status = statusResult.recordset[0] || null;

    const entriesResult = await connection.request()
      .input("vendor_id", sql.Int, vendorId)
      .query(`
        SELECT qe.*, p.name AS patron_name
        FROM QueueEntries qe
        LEFT JOIN Patrons p ON p.id = qe.patron_id
        WHERE qe.vendor_id = @vendor_id AND qe.status = 'waiting'
        ORDER BY qe.queue_number ASC
      `);

    return { status, entries: entriesResult.recordset };
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Marks whoever is currently "called" as served, promotes the next
// "waiting" entry to "called", updates now_serving, and pushes queue_update
// notifications to the newly-called customer and anyone now within
// NOTIFY_THRESHOLD places of the front. Uses one connection for the whole
// operation, inserting notifications directly rather than calling out to
// notificationModel.
async function callNext(vendorId) {
  try {
    const connection = await sql.connect(dbConfig);

    await connection.request()
      .input("vendor_id", sql.Int, vendorId)
      .query(`UPDATE QueueEntries SET status = 'served', updated_at = GETDATE() WHERE vendor_id = @vendor_id AND status = 'called'`);

    const nextResult = await connection.request()
      .input("vendor_id", sql.Int, vendorId)
      .query(`
        SELECT TOP 1 * FROM QueueEntries
        WHERE vendor_id = @vendor_id AND status = 'waiting'
        ORDER BY queue_number ASC
      `);

    if (nextResult.recordset.length === 0) {
      // Queue is now empty — still clear now_serving so the board doesn't
      // show a stale number
      await connection.request()
        .input("vendor_id", sql.Int, vendorId)
        .query(`UPDATE QueueStatus SET now_serving = NULL, updated_at = GETDATE() WHERE vendor_id = @vendor_id`);
      return { empty: true };
    }

    const nextEntry = nextResult.recordset[0];

    await connection.request()
      .input("id", sql.Int, nextEntry.id)
      .query(`UPDATE QueueEntries SET status = 'called', updated_at = GETDATE() WHERE id = @id`);

    await connection.request()
      .input("vendor_id", sql.Int, vendorId)
      .input("now_serving", sql.Int, nextEntry.queue_number)
      .query(`UPDATE QueueStatus SET now_serving = @now_serving, updated_at = GETDATE() WHERE vendor_id = @vendor_id`);

    // Notify the customer who was just called
    await insertNotification(connection, {
      patronId: nextEntry.patron_id,
      guestIdentifier: nextEntry.guest_identifier,
      referenceId: nextEntry.id,
      message: `It's your turn! Please head to the stall now (queue #${nextEntry.queue_number}).`,
    });

    // Notify anyone now exactly NOTIFY_THRESHOLD places from the front
    const upcomingResult = await connection.request()
      .input("vendor_id", sql.Int, vendorId)
      .query(`SELECT * FROM QueueEntries WHERE vendor_id = @vendor_id AND status = 'waiting' ORDER BY queue_number ASC`);

    const upcoming = upcomingResult.recordset;
    if (upcoming.length >= NOTIFY_THRESHOLD) {
      const targetEntry = upcoming[NOTIFY_THRESHOLD - 1];
      await insertNotification(connection, {
        patronId: targetEntry.patron_id,
        guestIdentifier: targetEntry.guest_identifier,
        referenceId: targetEntry.id,
        message: `You are ${NOTIFY_THRESHOLD} places away. Please make your way back to the stall.`,
      });
    }

    return { empty: false, now_serving_entry: nextEntry };
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// Inserts a customer-facing queue_update notification using the connection
// already open in callNext().
async function insertNotification(connection, { patronId, guestIdentifier, referenceId, message }) {
  await connection.request()
    .input("vendor_id", sql.Int, null)
    .input("patron_id", sql.Int, patronId || null)
    .input("guest_identifier", sql.VarChar, guestIdentifier || null)
    .input("type", sql.VarChar, "queue_update")
    .input("reference_id", sql.Int, referenceId || null)
    .input("message", sql.VarChar, message)
    .query(`
      INSERT INTO Notifications (vendor_id, patron_id, guest_identifier, type, reference_id, message)
      VALUES (@vendor_id, @patron_id, @guest_identifier, @type, @reference_id, @message)
    `);
}

// Public summary for the stall page: current status + how many people are
// currently waiting, so a customer can see the queue length before deciding
// whether to join at all.
async function getPublicSummary(vendorId) {
  try {
    const connection = await sql.connect(dbConfig);

    const statusResult = await connection.request()
      .input("vendor_id", sql.Int, vendorId)
      .query(`SELECT * FROM QueueStatus WHERE vendor_id = @vendor_id`);
    const status = statusResult.recordset[0];
    if (!status) return null;

    const countResult = await connection.request()
      .input("vendor_id", sql.Int, vendorId)
      .query(`SELECT COUNT(*) AS waiting_count FROM QueueEntries WHERE vendor_id = @vendor_id AND status = 'waiting'`);

    return { ...status, waiting_count: countResult.recordset[0].waiting_count };
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

// All of a customer's active (waiting/called) tickets across EVERY stall,
// for the site-wide "My Queue" nav widget.
async function getActiveEntriesForCustomer(patronId, guestIdentifier) {
  try {
    const connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("patron_id", sql.Int, patronId || null)
      .input("guest_id", sql.VarChar, guestIdentifier || null)
      .query(`
        SELECT
          qe.id,
          qe.vendor_id,
          v.business_name AS vendor_name,
          qe.queue_number,
          qe.status,
          qs.now_serving,
          (
            SELECT COUNT(*) FROM QueueEntries qe2
            WHERE qe2.vendor_id = qe.vendor_id AND qe2.status IN ('waiting', 'called') AND qe2.queue_number < qe.queue_number
          ) AS people_ahead
        FROM QueueEntries qe
        JOIN Vendors v ON v.id = qe.vendor_id
        LEFT JOIN QueueStatus qs ON qs.vendor_id = qe.vendor_id
        WHERE qe.status IN ('waiting', 'called')
          AND ((@patron_id IS NOT NULL AND qe.patron_id = @patron_id) OR (@guest_id IS NOT NULL AND qe.guest_identifier = @guest_id))
        ORDER BY qe.joined_at DESC
      `);
    return result.recordset;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

module.exports = {
  getStatusByVendor,
  createStatusRow,
  setOpen,
  setPaused,
  joinQueue,
  getMyEntry,
  cancelEntry,
  getVendorQueueList,
  callNext,
  getPublicSummary,
  getActiveEntriesForCustomer,
};
