(function () {
  const toastStack = document.getElementById("toast");
  const accountInput = document.getElementById("accountSelect");
  const sidebar = document.getElementById("sidebarNav");
  const backdrop = document.getElementById("sidebarBackdrop");
  const toggleBtn = document.getElementById("sidebarToggle");
  const closeBtn = document.getElementById("sidebarClose");
  const jsonDrawer = document.getElementById("jsonDrawer");
  const jsonBackdrop = document.getElementById("jsonDrawerBackdrop");
  const jsonClose = document.getElementById("jsonDrawerClose");
  const jsonTitle = document.getElementById("jsonDrawerTitle");
  const jsonBody = document.getElementById("jsonDrawerBody");
  const jsonCopy = document.getElementById("jsonCopyBtn");

  const isDesktop = () => window.innerWidth >= 1024;

  function setMobileSidebar(open) {
    if (!sidebar) return;
    sidebar.classList.toggle("is-open", open);
    backdrop?.classList.toggle("is-open", open);
    document.body.classList.toggle("overflow-hidden", open && !isDesktop());
  }

  function setCollapsed(collapsed) {
    document.documentElement.classList.toggle("sidebar-collapsed", collapsed);
    try {
      localStorage.setItem("rb.sidebarCollapsed", collapsed ? "1" : "0");
    } catch (e) {}
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    }
  }

  function isCollapsed() {
    return document.documentElement.classList.contains("sidebar-collapsed");
  }

  toggleBtn?.addEventListener("click", () => {
    if (isDesktop()) {
      setCollapsed(!isCollapsed());
      return;
    }
    const open = !sidebar?.classList.contains("is-open");
    setMobileSidebar(open);
  });

  closeBtn?.addEventListener("click", () => setMobileSidebar(false));
  backdrop?.addEventListener("click", () => setMobileSidebar(false));

  window.addEventListener("resize", () => {
    if (isDesktop()) setMobileSidebar(false);
  });

  window.openJsonDrawer = function (title, content) {
    if (!jsonDrawer) return;
    if (jsonTitle) jsonTitle.textContent = title || "API response";
    if (jsonBody) {
      jsonBody.textContent =
        typeof content === "string" ? content : JSON.stringify(content, null, 2);
    }
    jsonDrawer.classList.add("is-open");
    jsonDrawer.setAttribute("aria-hidden", "false");
    jsonBackdrop?.classList.add("is-open");
    document.body.classList.add("overflow-hidden");
  };

  function closeJsonDrawer() {
    jsonDrawer?.classList.remove("is-open");
    jsonDrawer?.setAttribute("aria-hidden", "true");
    jsonBackdrop?.classList.remove("is-open");
    const actionOpen = document
      .getElementById("actionDrawer")
      ?.classList.contains("is-open");
    if (!sidebar?.classList.contains("is-open") && !actionOpen) {
      document.body.classList.remove("overflow-hidden");
    }
  }

  jsonClose?.addEventListener("click", closeJsonDrawer);
  jsonBackdrop?.addEventListener("click", closeJsonDrawer);

  jsonCopy?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(jsonBody?.textContent || "");
      showToast("Copied to clipboard", "success");
    } catch (e) {
      showToast("Copy failed", "error");
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (jsonDrawer?.classList.contains("is-open")) {
      closeJsonDrawer();
      return;
    }
    setMobileSidebar(false);
  });

  window.showToast = function (message, kind) {
    if (!toastStack) return;
    let type = "info";
    if (kind === true || kind === "error") type = "error";
    else if (kind === false || kind === "success") type = "success";
    else if (kind === "info" || kind === "success" || kind === "error") type = kind;

    const el = document.createElement("div");
    el.className = "toast-item " + type;
    el.textContent = message;
    toastStack.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 220);
    }, 3400);
  };

  window.getSelectedAccountId = function () {
    return accountInput?.value || "agent_one";
  };

  window.copyText = async function (text) {
    const value = String(text || "");
    if (!value) return false;
    try {
      await navigator.clipboard.writeText(value);
      showToast("Copied", "success");
      return true;
    } catch (e) {
      try {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showToast("Copied", "success");
        return true;
      } catch (err) {
        showToast("Copy failed", "error");
        return false;
      }
    }
  };

  const COPY_ICON =
    '<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8 8h10a2 2 0 012 2v10a2 2 0 01-2 2H8a2 2 0 01-2-2V10a2 2 0 012-2z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 16H5a2 2 0 01-2-2V5a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';

  window.renderCopyable = function (value, escapeHtmlFn) {
    const escape =
      escapeHtmlFn ||
      function (str) {
        return String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      };
    const text = value == null ? "" : String(value);
    if (!text) return '<span class="text-slate-400">—</span>';
    return (
      '<span class="copyable-value inline-flex max-w-full items-center gap-1.5 align-middle">' +
      '<span class="copyable-text min-w-0 truncate font-mono text-[12px] leading-5 text-slate-800" title="' +
      escape(text) +
      '">' +
      escape(text) +
      "</span>" +
      '<button type="button" class="copy-btn inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700" data-copy="' +
      escape(text) +
      '" title="Copy" aria-label="Copy value">' +
      COPY_ICON +
      "</button></span>"
    );
  };

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".copy-btn");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    window.copyText(btn.getAttribute("data-copy") || "");
  });

  window.askSystemConfirm = function (options = {}) {
    return new Promise((resolve) => {
      const modal = document.getElementById("confirmModal");
      const modalBackdrop = document.getElementById("modalBackdrop");
      const titleEl = document.getElementById("confirmTitle");
      const messageEl = document.getElementById("confirmMessage");
      const okBtn = document.getElementById("confirmOkBtn");

      if (!modal || !okBtn) {
        resolve(
          window.confirm(options.message || options.title || "Are you sure?")
        );
        return;
      }

      if (titleEl) titleEl.textContent = options.title || "Confirm";
      if (messageEl) messageEl.textContent = options.message || "";
      okBtn.textContent = options.confirmLabel || "Confirm";
      okBtn.className = options.danger
        ? "inline-flex h-9 items-center justify-center rounded-lg bg-rose-600 px-3.5 text-sm font-semibold text-white hover:bg-rose-700"
        : "inline-flex h-9 items-center justify-center rounded-lg bg-brand-600 px-3.5 text-sm font-semibold text-white hover:bg-brand-700";

      window.__systemConfirmResolve = resolve;
      modalBackdrop?.classList.add("is-open");
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("overflow-hidden");
    });
  };
})();
