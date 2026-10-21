const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");

function defaultAccounts() {
  return [
    {
      id: "agent_one",
      label: "AGENT ONE API",
      shortLabel: "Agent One",
      initials: "A1",
      description: "Booking folder credentials (production API)",
      username: process.env.AGENT_ONE_USERNAME || "AGENT_ONE_API",
      password: process.env.AGENT_ONE_PASSWORD || "",
      baseUrl: "https://api.roomboss.com",
    },
    {
      id: "jse",
      label: "JSE (ACC-JSE)",
      shortLabel: "JSE",
      initials: "JS",
      description: "Booking With ACC-JSE credentials (production API)",
      username: process.env.JSE_USERNAME || "JSE",
      password: process.env.JSE_PASSWORD || "",
      baseUrl: "https://api.roomboss.com",
    },
    {
      id: "staging",
      label: "Staging Demo",
      shortLabel: "Staging",
      initials: "ST",
      description: "agentDemo credentials (staging API)",
      username: process.env.STAGING_USERNAME || "agentDemo",
      password: process.env.STAGING_PASSWORD || "",
      baseUrl: "https://api.staging.roomboss.com",
    },
  ];
}

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    fs.writeFileSync(
      ACCOUNTS_FILE,
      JSON.stringify(defaultAccounts(), null, 2),
      "utf8"
    );
  }
}

function readAccounts() {
  ensureStore();
  try {
    const raw = fs.readFileSync(ACCOUNTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) {
      return defaultAccounts();
    }
    return parsed;
  } catch {
    return defaultAccounts();
  }
}

function writeAccounts(list) {
  ensureStore();
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(list, null, 2), "utf8");
}

function slugify(text) {
  return String(text || "account")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

function makeInitials(label) {
  const parts = String(label || "AC")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "AC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function normalizeAccount(input, existingId) {
  const shortLabel = String(input.shortLabel || input.label || "").trim();
  const label = String(input.label || shortLabel).trim();
  const username = String(input.username || "").trim();
  const password = String(input.password || "");
  let baseUrl = String(input.baseUrl || "https://api.roomboss.com").trim();
  if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);
  if (!/^https?:\/\//i.test(baseUrl)) {
    baseUrl = "https://" + baseUrl;
  }

  if (!shortLabel) throw new Error("Account name is required");
  if (!username) throw new Error("Username is required");
  if (!password) throw new Error("Password is required");
  if (!baseUrl) throw new Error("API base URL is required");

  const id =
    existingId ||
    slugify(input.id || shortLabel) ||
    `account_${Date.now()}`;

  return {
    id,
    label: label || shortLabel,
    shortLabel,
    initials: String(input.initials || makeInitials(shortLabel))
      .slice(0, 2)
      .toUpperCase(),
    description: String(input.description || "").trim(),
    username,
    password,
    baseUrl,
  };
}

function publicAccount(account, { includeSecrets = false } = {}) {
  const host = account.baseUrl.replace(/^https?:\/\//, "");
  const out = {
    id: account.id,
    label: account.label,
    shortLabel: account.shortLabel,
    initials: account.initials,
    description: account.description,
    baseUrl: account.baseUrl,
    host,
  };
  if (includeSecrets) {
    out.username = account.username;
    out.password = account.password;
  }
  return out;
}

function listAccounts(options = {}) {
  return readAccounts().map((a) => publicAccount(a, options));
}

function getAccount(id) {
  const list = readAccounts();
  return list.find((a) => a.id === id) || list[0] || defaultAccounts()[0];
}

function createAccount(input) {
  const list = readAccounts();
  let account = normalizeAccount(input);
  if (list.some((a) => a.id === account.id)) {
    account.id = `${account.id}_${Date.now().toString(36)}`;
  }
  list.push(account);
  writeAccounts(list);
  return publicAccount(account, { includeSecrets: true });
}

function updateAccount(id, input) {
  const list = readAccounts();
  const index = list.findIndex((a) => a.id === id);
  if (index < 0) throw new Error("Account not found");
  const account = normalizeAccount({ ...list[index], ...input }, id);
  list[index] = account;
  writeAccounts(list);
  return publicAccount(account, { includeSecrets: true });
}

function deleteAccount(id) {
  const list = readAccounts();
  if (list.length <= 1) {
    throw new Error("At least one account must remain");
  }
  const next = list.filter((a) => a.id !== id);
  if (next.length === list.length) throw new Error("Account not found");
  writeAccounts(next);
  return { id };
}

async function testCredentials({ username, password, baseUrl }) {
  const user = String(username || "").trim();
  const pass = String(password || "");
  let host = String(baseUrl || "https://api.roomboss.com").trim();
  if (host.endsWith("/")) host = host.slice(0, -1);
  if (!/^https?:\/\//i.test(host)) host = "https://" + host;

  if (!user || !pass) {
    return { ok: false, error: "Username and password are required" };
  }

  const auth = Buffer.from(`${user}:${pass}`).toString("base64");
  const url = `${host}/extws/hotel/v1/list?countryCode=jp&locationCode=niseko`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json, text/plain, */*",
      },
    });

    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        message: "Credentials verified with RoomBoss",
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        status: response.status,
        error: "Incorrect username or password",
      };
    }

    return {
      ok: false,
      status: response.status,
      error: `RoomBoss returned HTTP ${response.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message || "Could not reach RoomBoss API",
    };
  }
}

module.exports = {
  listAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  testCredentials,
  publicAccount,
};
