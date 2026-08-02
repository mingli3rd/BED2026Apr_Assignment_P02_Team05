const queueModel = require("../models/queueModel");

// --- Customer-facing ---

// Works for both guests and logged-in patrons — req.patron is only set if
// attachPatronIfPresent found a valid patron cookie (same pattern as complaints).
async function joinQueue(req, res) {
  try {
    const { vendor_id, guest_identifier } = req.body;
    const patronId = req.patron ? req.patron.id : null;

    const result = await queueModel.joinQueue(vendor_id, patronId, guest_identifier);

    if (result.error === "not_found") {
      return res.status(404).json({ error: "This stall has not enabled the digital queue." });
    }
    if (result.error === "closed") {
      return res.status(409).json({ error: "This stall is not currently accepting queue entries." });
    }
    if (result.error === "duplicate") {
      return res.status(409).json({ error: "You already have an active queue ticket for this stall." });
    }

    res.status(201).json({
      message: "You have joined the queue.",
      entry: result.entry,
      position: result.position,
      estimated_wait_minutes: (result.position - 1) * 5,
    });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error joining the queue" });
  }
}

async function getMyStatus(req, res) {
  try {
    const { vendorId } = req.params;
    const { patron_id, guest_identifier } = req.query;

    if (!patron_id && !guest_identifier) {
      return res.status(400).json({ error: "patron_id or guest_identifier query param is required." });
    }

    const data = await queueModel.getMyEntry(vendorId, patron_id, guest_identifier);
    if (!data) {
      return res.status(404).json({ error: "No queue entry found for this customer at this stall." });
    }
    res.status(200).json(data);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error fetching queue status" });
  }
}

async function cancelEntry(req, res) {
  try {
    const { patron_id, guest_identifier } = req.body;
    const result = await queueModel.cancelEntry(req.params.entryId, patron_id, guest_identifier);

    if (result.error === "not_found") return res.status(404).json({ error: "Queue entry not found." });
    if (result.error === "forbidden") return res.status(403).json({ error: "You can only cancel your own queue entry." });
    if (result.error === "not_waiting") return res.status(409).json({ error: "This ticket can no longer be cancelled." });

    res.status(200).json({ message: "Queue entry cancelled." });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error cancelling queue entry" });
  }
}

// --- Vendor-facing ---

async function getMyQueue(req, res) {
  try {
    const data = await queueModel.getVendorQueueList(req.vendor.id);
    if (!data.status) {
      return res.status(200).json({ set_up: false });
    }
    res.status(200).json({ set_up: true, status: data.status, entries: data.entries });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading your queue" });
  }
}

// Vendor: turn on the digital queue for the first time (creates the
// QueueStatus row) — for stalls that don't have one yet
async function enableQueue(req, res) {
  try {
    const existing = await queueModel.getStatusByVendor(req.vendor.id);
    if (existing) {
      return res.status(409).json({ error: "Digital queue is already set up for your stall." });
    }
    const status = await queueModel.createStatusRow(req.vendor.id);
    res.status(201).json({ message: "Digital queue enabled.", status });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error enabling the digital queue" });
  }
}

async function callNext(req, res) {
  try {
    const result = await queueModel.callNext(req.vendor.id);
    if (result.empty) {
      return res.status(200).json({ message: "No customers waiting. Queue is now empty." });
    }
    res.status(200).json({ message: "Advanced to next customer.", now_serving_entry: result.now_serving_entry });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error advancing the queue" });
  }
}

async function setPaused(req, res) {
  try {
    const { is_paused } = req.body;
    await queueModel.setPaused(req.vendor.id, is_paused);
    res.status(200).json({ message: `Queue ${is_paused ? "paused" : "resumed"}.` });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error updating queue pause state" });
  }
}

async function setOpen(req, res) {
  try {
    const { is_open } = req.body;
    await queueModel.setOpen(req.vendor.id, is_open);
    res.status(200).json({ message: `Queue ${is_open ? "opened" : "closed"}.` });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error updating queue open state" });
  }
}

// Public: lets the stall page check whether this vendor has a digital
// queue set up at all, its current open/paused state, and how many
// people are currently waiting — so a customer can see the queue length
// before deciding whether to join. No auth — same reasoning as the
// packaging options list.
async function getPublicStatus(req, res) {
  try {
    const summary = await queueModel.getPublicSummary(req.params.vendorId);
    if (!summary) {
      return res.status(200).json({ exists: false });
    }
    res.status(200).json({
      exists: true,
      is_open: Boolean(summary.is_open),
      is_paused: Boolean(summary.is_paused),
      now_serving: summary.now_serving,
      waiting_count: summary.waiting_count,
    });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading queue status" });
  }
}

// Public: a customer's active tickets across every stall they've joined —
// powers the site-wide "My Queue" nav widget in main.js.
async function getMyActiveEntries(req, res) {
  try {
    const { patron_id, guest_identifier } = req.query;
    if (!patron_id && !guest_identifier) {
      return res.status(400).json({ error: "patron_id or guest_identifier is required." });
    }
    const entries = await queueModel.getActiveEntriesForCustomer(patron_id, guest_identifier);
    res.status(200).json(entries);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: "Error loading your queue tickets" });
  }
}

module.exports = {
  joinQueue,
  getMyStatus,
  cancelEntry,
  getMyQueue,
  enableQueue,
  callNext,
  setPaused,
  setOpen,
  getPublicStatus,
  getMyActiveEntries,
};
