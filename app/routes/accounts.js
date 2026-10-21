const express = require("express");
const {
  listAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  testCredentials,
} = require("../config/accounts");

const router = express.Router();

router.get("/", (req, res) => {
  const includeSecrets = req.query.secrets === "1" || req.query.secrets === "true";
  return res.json({
    ok: true,
    accounts: listAccounts({ includeSecrets }),
    currentAccountId: req.session.accountId || null,
  });
});

router.post("/test", async (req, res) => {
  const result = await testCredentials(req.body || {});
  return res.status(result.ok ? 200 : 400).json(result);
});

router.post("/", async (req, res) => {
  try {
    const skipTest = Boolean(req.body?.skipTest);
    if (!skipTest) {
      const test = await testCredentials(req.body || {});
      if (!test.ok) {
        return res.status(400).json({
          ok: false,
          error: test.error || "Credential test failed",
          test,
        });
      }
    }
    const account = createAccount(req.body || {});
    return res.json({ ok: true, account, message: "Account created" });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const skipTest = Boolean(req.body?.skipTest);
    if (!skipTest) {
      const test = await testCredentials(req.body || {});
      if (!test.ok) {
        return res.status(400).json({
          ok: false,
          error: test.error || "Credential test failed",
          test,
        });
      }
    }
    const account = updateAccount(req.params.id, req.body || {});
    if (req.session.accountId === req.params.id) {
      req.session.moduleResults = {};
    }
    return res.json({ ok: true, account, message: "Account updated" });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

router.delete("/:id", (req, res) => {
  try {
    const removingCurrent = req.session.accountId === req.params.id;
    deleteAccount(req.params.id);
    if (removingCurrent) {
      const next = getAccount(null);
      req.session.accountId = next.id;
      req.session.moduleResults = {};
    }
    return res.json({
      ok: true,
      message: "Account removed",
      refresh: removingCurrent,
      currentAccountId: req.session.accountId,
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
