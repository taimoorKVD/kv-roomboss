(function () {
  const accountInput = document.getElementById("accountSelect");
  const accountBtn = document.getElementById("accountSwitchBtn");
  const accountMenu = document.getElementById("accountSwitchMenu");
  const accountList = document.getElementById("accountMenuList");
  const accountLabel = document.getElementById("accountSwitchLabel");
  const accountAvatar = document.getElementById("accountSwitchAvatar");
  const headerAccountName = document.getElementById("headerAccountName");
  const addBtn = document.getElementById("accountAddBtn");

  const modalBackdrop = document.getElementById("modalBackdrop");
  const formModal = document.getElementById("accountFormModal");
  const confirmModal = document.getElementById("confirmModal");
  const form = document.getElementById("accountForm");
  const formTitle = document.getElementById("accountFormTitle");
  const formStatus = document.getElementById("accountFormStatus");
  const formId = document.getElementById("accountFormId");
  const formName = document.getElementById("accountFormName");
  const formUsername = document.getElementById("accountFormUsername");
  const formPassword = document.getElementById("accountFormPassword");
  const formPasswordToggle = document.getElementById("accountFormPasswordToggle");
  const formBaseUrl = document.getElementById("accountFormBaseUrl");
  const formDescription = document.getElementById("accountFormDescription");
  const testBtn = document.getElementById("accountTestBtn");
  const saveBtn = document.getElementById("accountSaveBtn");
  const confirmTitle = document.getElementById("confirmTitle");
  const confirmMessage = document.getElementById("confirmMessage");
  const confirmOkBtn = document.getElementById("confirmOkBtn");
  const confirmCancelBtn = document.getElementById("confirmCancelBtn");

  let accounts = [];
  let editingId = null;
  let confirmAction = null;
  let revealed = {};

  if (!accountMenu || !accountList) return;

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setAccountMenu(open) {
    accountMenu.classList.toggle("hidden", !open);
    accountBtn?.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function openModal(modal) {
    modalBackdrop?.classList.add("is-open");
    modal?.classList.add("is-open");
    modal?.setAttribute("aria-hidden", "false");
    document.body.classList.add("overflow-hidden");
  }

  function settleSystemConfirm(result) {
    if (typeof window.__systemConfirmResolve !== "function") return;
    const resolve = window.__systemConfirmResolve;
    window.__systemConfirmResolve = null;
    resolve(Boolean(result));
  }

  function closeModals() {
    modalBackdrop?.classList.remove("is-open");
    formModal?.classList.remove("is-open");
    confirmModal?.classList.remove("is-open");
    formModal?.setAttribute("aria-hidden", "true");
    confirmModal?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("overflow-hidden");
    confirmAction = null;
    settleSystemConfirm(false);
  }

  function setFormStatus(text, kind) {
    if (!formStatus) return;
    formStatus.textContent = text || "";
    formStatus.className =
      "text-sm " +
      (kind === "error"
        ? "text-rose-600"
        : kind === "ok"
          ? "text-emerald-700"
          : "text-slate-500");
  }

  const SPINNER =
    '<span class="btn-spinner inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-90" aria-hidden="true"></span>';

  function setButtonLoading(btn, loading, loadingLabel, idleLabel) {
    if (!btn) return;
    if (loading) {
      if (!btn.dataset.idleHtml) btn.dataset.idleHtml = btn.innerHTML;
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
      btn.innerHTML =
        SPINNER +
        '<span>' +
        (loadingLabel || "Please wait…") +
        "</span>";
      btn.classList.add("opacity-90", "cursor-wait");
    } else {
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
      btn.innerHTML = idleLabel || btn.dataset.idleHtml || btn.innerHTML;
      btn.classList.remove("opacity-90", "cursor-wait");
    }
  }

  function setFormBusy(busy) {
    if (!form) return;
    form.querySelectorAll("input, textarea, select, button").forEach((el) => {
      if (el.id === "accountSaveBtn" || el.id === "accountTestBtn") return;
      if (el.hasAttribute("data-close-modal")) {
        el.disabled = busy;
        return;
      }
      el.disabled = busy;
    });
    document.querySelectorAll("#accountFormModal [data-close-modal]").forEach((el) => {
      el.disabled = busy;
    });
  }

  function maskSecret(value) {
    const text = String(value || "");
    if (!text) return "—";
    if (text.length <= 2) return "•".repeat(text.length);
    return "•".repeat(Math.min(text.length, 10));
  }

  function renderAccounts() {
    const currentId = accountInput?.value;
    accountList.innerHTML = accounts
      .map((acc) => {
        const active = acc.id === currentId;
        const showPass = !!revealed[acc.id];
        return (
          '<li class="border-b border-slate-800/80 last:border-b-0">' +
          '<div class="account-option-row px-2.5 py-2 ' +
          (active ? "bg-brand-600/15" : "") +
          '">' +
          '<button type="button" class="account-switch flex w-full items-start gap-2.5 rounded-lg px-1 py-1 text-left transition hover:bg-slate-800/80" data-account-id="' +
          escapeHtml(acc.id) +
          '">' +
          '<span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ' +
          (active ? "bg-brand-600 text-white" : "bg-slate-800 text-slate-300") +
          '">' +
          escapeHtml(acc.initials || "AC") +
          "</span>" +
          '<span class="min-w-0 flex-1">' +
          '<span class="flex items-center gap-2">' +
          '<span class="truncate text-sm font-semibold text-white">' +
          escapeHtml(acc.shortLabel || acc.label) +
          "</span>" +
          (active
            ? '<svg class="h-3.5 w-3.5 shrink-0 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
            : "") +
          "</span>" +
          '<span class="mt-0.5 block truncate font-mono text-[10px] text-slate-500">' +
          escapeHtml(acc.host || acc.baseUrl) +
          "</span>" +
          '<span class="mt-1.5 block space-y-0.5 font-mono text-[10px] text-slate-400">' +
          '<span class="block truncate">user: ' +
          escapeHtml(acc.username || "—") +
          "</span>" +
          '<span class="block truncate">pass: ' +
          (showPass
            ? escapeHtml(acc.password || "—")
            : escapeHtml(maskSecret(acc.password))) +
          "</span>" +
          "</span>" +
          "</span></button>" +
          '<div class="mt-1.5 flex items-center gap-1 px-1">' +
          '<button type="button" class="account-reveal rounded px-1.5 py-1 text-[10px] font-semibold text-slate-400 hover:bg-slate-800 hover:text-white" data-reveal-id="' +
          escapeHtml(acc.id) +
          '">' +
          (showPass ? "Hide" : "Show") +
          "</button>" +
          '<button type="button" class="account-edit rounded px-1.5 py-1 text-[10px] font-semibold text-slate-400 hover:bg-slate-800 hover:text-white" data-edit-id="' +
          escapeHtml(acc.id) +
          '">Edit</button>' +
          '<button type="button" class="account-delete rounded px-1.5 py-1 text-[10px] font-semibold text-rose-300 hover:bg-slate-800 hover:text-rose-200" data-delete-id="' +
          escapeHtml(acc.id) +
          '">Remove</button>' +
          "</div></div></li>"
        );
      })
      .join("");
  }

  async function loadAccounts() {
    const res = await fetch("/api/accounts?secrets=1");
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Failed to load accounts");
    accounts = data.accounts || [];
    if (data.currentAccountId && accountInput) {
      accountInput.value = data.currentAccountId;
    }
    renderAccounts();
  }

  function openCreateForm() {
    editingId = null;
    form?.reset();
    formId.value = "";
    formBaseUrl.value = "https://api.roomboss.com";
    formPassword.type = "password";
    formPasswordToggle.textContent = "Show";
    formTitle.textContent = "Add account";
    setFormStatus("");
    setAccountMenu(false);
    openModal(formModal);
    setTimeout(() => formName?.focus(), 50);
  }

  function openEditForm(id) {
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;
    editingId = id;
    formId.value = acc.id;
    formName.value = acc.shortLabel || acc.label || "";
    formUsername.value = acc.username || "";
    formPassword.value = acc.password || "";
    formBaseUrl.value = acc.baseUrl || "https://api.roomboss.com";
    formDescription.value = acc.description || "";
    formPassword.type = "password";
    formPasswordToggle.textContent = "Show";
    formTitle.textContent = "Edit account";
    setFormStatus("");
    setAccountMenu(false);
    openModal(formModal);
  }

  function formPayload() {
    return {
      id: formId.value || undefined,
      shortLabel: formName.value.trim(),
      label: formName.value.trim(),
      username: formUsername.value.trim(),
      password: formPassword.value,
      baseUrl: formBaseUrl.value.trim(),
      description: formDescription.value.trim(),
    };
  }

  async function switchAccount(accountId) {
    if (!accountId || accountId === accountInput?.value) {
      setAccountMenu(false);
      return;
    }
    try {
      accountBtn.disabled = true;
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Could not switch account");
      setAccountMenu(false);
      showToast("Switching to " + (data.account?.label || accountId) + "…", "info");
      window.location.reload();
    } catch (err) {
      accountBtn.disabled = false;
      showToast(err.message || "Account switch failed", "error");
    }
  }

  async function testCredentials() {
    if (!form?.reportValidity()) return false;
    const payload = formPayload();
    setFormStatus("Testing with RoomBoss…");
    setButtonLoading(testBtn, true, "Testing…", "Test with RoomBoss");
    if (saveBtn) saveBtn.disabled = true;
    try {
      const res = await fetch("/api/accounts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        setFormStatus(data.error || "Credentials incorrect", "error");
        showToast(data.error || "Credentials incorrect", "error");
        return false;
      }
      setFormStatus(data.message || "Credentials verified", "ok");
      showToast(data.message || "Credentials verified", "success");
      return true;
    } catch (err) {
      setFormStatus(err.message || "Test failed", "error");
      showToast(err.message || "Test failed", "error");
      return false;
    } finally {
      setButtonLoading(testBtn, false, null, "Test with RoomBoss");
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  async function saveAccount() {
    if (!form?.reportValidity()) return;
    setFormBusy(true);
    setButtonLoading(saveBtn, true, "Saving…", "Save account");
    if (testBtn) testBtn.disabled = true;
    setFormStatus("Verifying & saving account…");
    try {
      const payload = formPayload();
      const url = editingId
        ? "/api/accounts/" + encodeURIComponent(editingId)
        : "/api/accounts";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        setFormStatus(data.error || "Save failed", "error");
        showToast(data.error || "Save failed", "error");
        return;
      }
      setFormStatus(data.message || "Account saved", "ok");
      showToast(data.message || "Account saved", "success");
      closeModals();
      await loadAccounts();
      if (editingId && editingId === accountInput?.value) {
        const acc = accounts.find((a) => a.id === editingId);
        if (acc) {
          if (accountLabel) accountLabel.textContent = acc.shortLabel || acc.label;
          if (accountAvatar) accountAvatar.textContent = acc.initials || "AC";
          if (headerAccountName)
            headerAccountName.textContent = acc.shortLabel || acc.label;
        }
      }
    } catch (err) {
      setFormStatus(err.message || "Save failed", "error");
      showToast(err.message || "Save failed", "error");
    } finally {
      setFormBusy(false);
      setButtonLoading(saveBtn, false, null, "Save account");
      if (testBtn) testBtn.disabled = false;
    }
  }

  function askRemove(id) {
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;
    confirmTitle.textContent = "Remove account";
    confirmMessage.textContent =
      'Remove "' +
      (acc.shortLabel || acc.label) +
      '"? This cannot be undone. If it is the active account, the system will switch to another account.';
    confirmOkBtn.textContent = "Remove";
    confirmOkBtn.className =
      "inline-flex h-9 items-center rounded-lg bg-rose-600 px-3.5 text-sm font-semibold text-white hover:bg-rose-700";
    confirmAction = async () => {
      setButtonLoading(confirmOkBtn, true, "Removing…", "Remove");
      confirmCancelBtn.disabled = true;
      try {
        const res = await fetch("/api/accounts/" + encodeURIComponent(id), {
          method: "DELETE",
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Remove failed");
        showToast(data.message || "Account removed", "success");
        closeModals();
        if (data.refresh) {
          window.location.reload();
          return;
        }
        await loadAccounts();
      } catch (err) {
        showToast(err.message || "Remove failed", "error");
      } finally {
        setButtonLoading(confirmOkBtn, false, null, "Remove");
        confirmCancelBtn.disabled = false;
      }
    };
    setAccountMenu(false);
    openModal(confirmModal);
  }

  accountBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = accountMenu.classList.contains("hidden");
    setAccountMenu(open);
  });

  document.addEventListener("click", (e) => {
    if (accountMenu.classList.contains("hidden")) return;
    if (accountMenu.contains(e.target) || accountBtn?.contains(e.target)) return;
    if (e.target.closest(".sys-modal") || e.target.closest(".modal-backdrop")) return;
    setAccountMenu(false);
  });

  accountList.addEventListener("click", (e) => {
    const reveal = e.target.closest("[data-reveal-id]");
    if (reveal) {
      e.stopPropagation();
      const id = reveal.getAttribute("data-reveal-id");
      revealed[id] = !revealed[id];
      renderAccounts();
      return;
    }
    const edit = e.target.closest("[data-edit-id]");
    if (edit) {
      e.stopPropagation();
      openEditForm(edit.getAttribute("data-edit-id"));
      return;
    }
    const del = e.target.closest("[data-delete-id]");
    if (del) {
      e.stopPropagation();
      askRemove(del.getAttribute("data-delete-id"));
      return;
    }
    const switchBtn = e.target.closest(".account-switch");
    if (switchBtn) {
      e.stopPropagation();
      switchAccount(switchBtn.getAttribute("data-account-id"));
    }
  });

  addBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openCreateForm();
  });

  formPasswordToggle?.addEventListener("click", () => {
    const show = formPassword.type === "password";
    formPassword.type = show ? "text" : "password";
    formPasswordToggle.textContent = show ? "Hide" : "Show";
  });

  testBtn?.addEventListener("click", () => testCredentials());
  saveBtn?.addEventListener("click", () => saveAccount());

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", closeModals);
  });
  modalBackdrop?.addEventListener("click", closeModals);
  confirmCancelBtn?.addEventListener("click", closeModals);
  confirmOkBtn?.addEventListener("click", async () => {
    if (typeof window.__systemConfirmResolve === "function") {
      const resolve = window.__systemConfirmResolve;
      window.__systemConfirmResolve = null;
      modalBackdrop?.classList.remove("is-open");
      confirmModal?.classList.remove("is-open");
      confirmModal?.setAttribute("aria-hidden", "true");
      document.body.classList.remove("overflow-hidden");
      resolve(true);
      return;
    }
    if (typeof confirmAction === "function") await confirmAction();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModals();
  });

  loadAccounts().catch((err) => {
    showToast(err.message || "Could not load accounts", "error");
  });
})();
