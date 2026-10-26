require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const { listAccounts, getAccount } = require("./config/accounts");
const { modules, getModule } = require("./config/modules");
const { summarizeValue, prepareDetailForView } = require("./lib/records");
const apiRouter = require("./routes/api");
const accountsRouter = require("./routes/accounts");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "roomboss-dev-secret",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  if (!req.session.accountId) {
    req.session.accountId = "agent_one";
  }
  let current = getAccount(req.session.accountId);
  if (!current || current.id !== req.session.accountId) {
    // Active account may have been removed; fall back to first available
    current = getAccount(null);
    req.session.accountId = current.id;
  }
  res.locals.accounts = listAccounts();
  res.locals.modules = modules;
  res.locals.modulesConfig = modules.map((m) => ({
    id: m.id,
    name: m.name,
    shortName: m.shortName,
    description: m.description,
    action: m.action,
    path: m.path,
    method: m.method,
    danger: Boolean(m.danger),
    fields: m.fields || [],
  }));
  res.locals.currentAccountId = current.id;
  res.locals.currentAccount = {
    id: current.id,
    label: current.label,
    shortLabel: current.shortLabel || current.label,
    initials: current.initials || "RB",
    description: current.description,
    host: current.baseUrl.replace(/^https?:\/\//, ""),
  };
  res.locals.currentPath = req.path;
  res.locals.summarizeValue = summarizeValue;
  next();
});

app.use("/api", apiRouter);
app.use("/api/accounts", accountsRouter);

app.get("/", (req, res) => {
  const first = modules[0];
  res.redirect(first ? `/modules/${first.id}` : "/modules/list-hotels");
});

app.get("/modules/:id", (req, res) => {
  const module = getModule(req.params.id);
  if (!module) {
    return res.status(404).render("error", {
      title: "Not found",
      message: "That module does not exist.",
    });
  }
  // Query/list modules: drop cached rows when the user returns to the page so
  // empty/default filters never sit above a previous query's results.
  // Create Booking keeps its session list so successive creates accumulate.
  if (
    module.action !== "create" &&
    req.session.moduleResults &&
    req.session.moduleResults[module.id]
  ) {
    delete req.session.moduleResults[module.id];
  }
  const stored = req.session.moduleResults?.[module.id];
  res.render("module", {
    title: module.name,
    module,
    hasCachedResults: Boolean(stored?.records?.length),
  });
});

app.get("/modules/:id/records/:recordId", (req, res) => {
  const module = getModule(req.params.id);
  if (!module) {
    return res.status(404).render("error", {
      title: "Not found",
      message: "That module does not exist.",
    });
  }

  const stored = req.session.moduleResults?.[module.id];
  if (!stored) {
    return res.status(404).render("error", {
      title: "No results loaded",
      message:
        "Run the listing first, then open a record from the results table.",
    });
  }

  const record = stored.records.find(
    (r) => String(r.id) === String(req.params.recordId)
  );
  if (!record) {
    return res.status(404).render("error", {
      title: "Record not found",
      message: "This record is not in the current result set. Re-run the listing.",
    });
  }

  const viewDetail = prepareDetailForView(record.detail || {});
  const scalarEntries = [];
  const collectionEntries = [];

  Object.entries(viewDetail).forEach(([key, value]) => {
    const entry = {
      key,
      value,
      isArray: Array.isArray(value),
      isObject:
        value !== null && typeof value === "object" && !Array.isArray(value),
      display: summarizeValue(value),
    };
    if (entry.isArray || entry.isObject) collectionEntries.push(entry);
    else scalarEntries.push(entry);
  });

  const isDemo =
    Boolean(record.isDemo) ||
    /\bdemo\b/i.test(String(record.title || "")) ||
    /\bdemo\b/i.test(String(record.detail?.hotelName || ""));

  const COPYABLE_KEYS = new Set([
    "hotelId",
    "roomTypeId",
    "ratePlanId",
    "locationCode",
    "countryCode",
    "bookingId",
    "customId",
    "roomId",
  ]);

  const showHotelActions = module.id === "list-hotels";
  const hotelActionRecord = showHotelActions
    ? {
        hotelId: viewDetail.hotelId || record.row?.hotelId || record.id || "",
        hotelName:
          viewDetail.hotelName || record.row?.hotelName || record.title || "",
        locationCode:
          viewDetail.locationCode || record.row?.locationCode || "",
        countryCode: viewDetail.countryCode || record.row?.countryCode || "",
        currencyCode:
          viewDetail.currencyCode || record.row?.currencyCode || "",
        vendorType: viewDetail.vendorType || record.row?.vendorType || "",
        roomTypes: Array.isArray(viewDetail.roomTypes)
          ? viewDetail.roomTypes
          : [],
      }
    : null;

  res.render("detail", {
    title: `${module.recordLabel || "Record"} · ${record.title}`,
    module,
    record: { ...record, detail: viewDetail },
    scalarEntries,
    collectionEntries,
    fetchedAt: stored.fetchedAt,
    account: stored.account,
    isDemo,
    showHotelActions,
    hotelActionRecord,
    isCopyableKey: (key) => COPYABLE_KEYS.has(key),
  });
});

app.listen(PORT, () => {
  console.log(`RoomBoss Portal running at http://localhost:${PORT}`);
});
