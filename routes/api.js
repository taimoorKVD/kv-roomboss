const express = require("express");
const { getAccount } = require("../config/accounts");
const { getModule } = require("../config/modules");
const { normalizeResponse, filterAndPaginate } = require("../lib/records");

const router = express.Router();

function toRoomBossDate(value) {
  if (!value) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.replace(/-/g, "");
  }
  return value;
}

function buildQuery(module, body) {
  const params = new URLSearchParams();
  for (const field of module.fields) {
    let value = body[field.key];
    if (value === undefined || value === null || value === "") continue;
    if (field.type === "date") value = toRoomBossDate(String(value));
    params.set(field.key, String(value));
  }
  return params;
}

function enrichResponseForModule(data, body, module) {
  if (!module || !data || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }

  // cancelBooking often returns only { success, failureMessage }
  if (module.id === "cancel-booking" || module.action === "cancel") {
    if (data.bookingId || data.bookings || data.order) return data;
    const failed = data.success === false;
    return {
      ...data,
      bookingId: body?.bookingId || data.bookingId || "",
      status: failed ? "Failed" : "Cancelled",
      message:
        data.failureMessage ||
        data.message ||
        (failed
          ? "Cancellation failed"
          : "Booking cancelled successfully"),
    };
  }

  return data;
}

function storeResults(req, module, payload) {
  if (!req.session.moduleResults) req.session.moduleResults = {};
  const data = enrichResponseForModule(payload.data, req.body, module);
  const { records, raw } = normalizeResponse(data, module);
  const existing = req.session.moduleResults[module.id];

  // Create Booking: keep every successful create in this session (newest first).
  // List/query modules still replace the listing with the latest response.
  let nextRecords = records;
  let nextRaw = payload.data;
  if (module.action === "create" && existing?.records?.length) {
    const seen = new Set(records.map((r) => r.id));
    const prior = existing.records.filter((r) => !seen.has(r.id));
    nextRecords = records.concat(prior);
    nextRaw = {
      sessionCreates: true,
      latest: payload.data,
      previousCount: prior.length,
    };
  }

  req.session.moduleResults[module.id] = {
    moduleId: module.id,
    moduleName: module.name,
    account: payload.account,
    status: payload.status,
    fetchedAt: new Date().toISOString(),
    columns: module.columns || [],
    recordLabel: module.recordLabel || "Record",
    records: nextRecords,
    raw: nextRaw,
  };
  return req.session.moduleResults[module.id];
}

function extractApiError(data, fallback = "Request failed") {
  if (data == null) return fallback;
  if (typeof data === "string") {
    const text = data.trim();
    return text || fallback;
  }
  if (typeof data !== "object") return fallback;

  const candidates = [
    data.failureMessage,
    data.message,
    data.errorMessage,
    data.error,
    data.statusMessage,
    data.detail,
  ];
  for (const value of candidates) {
    if (value == null) continue;
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "object") {
      const nested = extractApiError(value, null);
      if (nested) return nested;
    }
  }

  if (data.data != null) {
    const nested = extractApiError(data.data, null);
    if (nested) return nested;
  }

  return fallback;
}

function isRoomBossSuccess(response, data) {
  if (!response.ok) return false;
  if (
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    data.success === false
  ) {
    return false;
  }
  return true;
}

router.post("/run/:moduleId", async (req, res) => {
  const module = getModule(req.params.moduleId);
  if (!module) {
    return res.status(404).json({ ok: false, error: "Unknown module" });
  }

  const accountId = req.body.accountId || req.session?.accountId || "agent_one";
  const account = getAccount(accountId);

  if (!account.password) {
    return res.status(400).json({
      ok: false,
      error: `Credentials for ${account.label} are not configured. Check your .env file.`,
    });
  }

  const missing = module.fields
    .filter((f) => f.required)
    .filter((f) => !req.body[f.key] && req.body[f.key] !== 0)
    .map((f) => f.label);

  if (missing.length) {
    return res.status(400).json({
      ok: false,
      error: `Please fill in: ${missing.join(", ")}`,
    });
  }

  const query = buildQuery(module, req.body);
  const url = `${account.baseUrl}${module.path}?${query.toString()}`;
  const auth = Buffer.from(`${account.username}:${account.password}`).toString(
    "base64"
  );

  try {
    const response = await fetch(url, {
      method: module.method,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json, text/plain, */*",
      },
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    const ok = isRoomBossSuccess(response, data);
    const payload = {
      ok,
      status: response.status,
      account: { id: account.id, label: account.label },
      module: { id: module.id, name: module.name, path: module.path },
      requestUrl: url,
      data,
      error: ok
        ? undefined
        : extractApiError(
            data,
            `Request failed (HTTP ${response.status})`
          ),
    };

    if (ok) {
      const stored = storeResults(req, module, payload);
      const pageSize = Number(req.body.pageSize) || 10;
      const page = filterAndPaginate(stored.records, {
        q: "",
        page: 1,
        pageSize,
        demo: req.body.demo || "all",
      });

      return res.json({
        ...payload,
        listing: {
          columns: stored.columns,
          recordLabel: stored.recordLabel,
          ...page,
        },
      });
    }

    const statusCode = response.ok ? 400 : response.status;
    return res.status(statusCode).json(payload);
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: err.message || "Failed to reach RoomBoss API",
    });
  }
});

router.delete("/results/:moduleId", (req, res) => {
  const module = getModule(req.params.moduleId);
  if (!module) {
    return res.status(404).json({ ok: false, error: "Unknown module" });
  }
  if (req.session.moduleResults) delete req.session.moduleResults[module.id];
  return res.json({ ok: true });
});

router.get("/results/:moduleId", (req, res) => {
  const module = getModule(req.params.moduleId);
  if (!module) {
    return res.status(404).json({ ok: false, error: "Unknown module" });
  }

  const stored = req.session.moduleResults?.[module.id];
  if (!stored) {
    return res.json({
      ok: true,
      empty: true,
      listing: {
        columns: module.columns || [],
        recordLabel: module.recordLabel || "Record",
        items: [],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 1,
          from: 0,
          to: 0,
          q: "",
          demo: "all",
        },
      },
    });
  }

  const page = filterAndPaginate(stored.records, {
    q: req.query.q || "",
    page: req.query.page || 1,
    pageSize: req.query.pageSize || 10,
    demo: req.query.demo || "all",
  });

  return res.json({
    ok: true,
    empty: false,
    fetchedAt: stored.fetchedAt,
    account: stored.account,
    listing: {
      columns: stored.columns,
      recordLabel: stored.recordLabel,
      ...page,
    },
  });
});

router.post("/account", (req, res) => {
  const { accountId } = req.body;
  if (!accountId) {
    return res.status(400).json({ ok: false, error: "accountId required" });
  }
  const account = getAccount(accountId);
  req.session.accountId = account.id;
  // Drop cached listings so the UI reloads fresh data for the new account
  req.session.moduleResults = {};
  return res.json({
    ok: true,
    refresh: true,
    account: {
      id: account.id,
      label: account.label,
      description: account.description,
      baseUrl: account.baseUrl,
    },
  });
});

module.exports = router;
