(function () {
  const form = document.getElementById("moduleForm");
  if (!form) return;

  const moduleId = form.dataset.moduleId;
  const runBtn = document.getElementById("runBtn");
  const statusLine = document.getElementById("statusLine");
  const resultsPanel = document.getElementById("resultsPanel");
  const resultsMeta = document.getElementById("resultsMeta");
  const resultsContent = document.getElementById("resultsContent");
  const openRawBtn = document.getElementById("openRawBtn");
  const searchInput = document.getElementById("searchInput");
  const pageSizeSelect = document.getElementById("pageSizeSelect");
  const demoFilterGroup = document.getElementById("demoFilterGroup");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  const pageNumbers = document.getElementById("pageNumbers");
  const pageSummary = document.getElementById("pageSummary");

  let lastRawPayload = null;
  let quietLoad = false;

  const state = {
    page: 1,
    pageSize: Number(pageSizeSelect?.value || 10),
    q: "",
    demo: "all",
    columns: [],
    recordLabel: "Record",
  };

  let searchTimer = null;

  function setStatus(text, kind) {
    statusLine.textContent = text || "";
    statusLine.className =
      "text-sm " +
      (kind === "error"
        ? "text-rose-600"
        : kind === "ok"
          ? "text-emerald-700"
          : "text-slate-500");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function columnLabels(columns, sampleRow) {
    if (columns && columns.length) return columns;
    if (!sampleRow) return [];
    return Object.keys(sampleRow).map((key) => ({
      key,
      label: key,
      copyable: isCopyableKey(key),
    }));
  }

  function isCopyableKey(key) {
    return [
      "hotelId",
      "roomTypeId",
      "ratePlanId",
      "locationCode",
      "countryCode",
      "bookingId",
      "customId",
      "roomId",
    ].includes(key);
  }

  function isDemoItem(item) {
    if (item?.isDemo) return true;
    const name = String(item?.row?.hotelName || item?.title || "");
    return /\bdemo\b/i.test(name);
  }

  function hotelField(item, key) {
    const rowVal = item?.row?.[key];
    if (rowVal != null && String(rowVal).trim() !== "") return String(rowVal);
    const detailVal = item?.detail?.[key];
    if (detailVal != null && String(detailVal).trim() !== "") {
      return String(detailVal);
    }
    return "";
  }

  function hotelNameHtml(item, name) {
    const demo = isDemoItem(item);
    const type = hotelField(item, "vendorType");
    const currency = hotelField(item, "currencyCode");
    const country = hotelField(item, "countryCode");

    let html =
      '<div class="hotel-name-cell">' +
      '<div class="flex flex-wrap items-center gap-1.5">' +
      '<span class="font-semibold ' +
      (demo ? "text-amber-900" : "text-slate-900") +
      '" title="' +
      escapeHtml(name) +
      '">' +
      escapeHtml(name) +
      "</span>";

    if (demo) {
      html +=
        '<span class="shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Demo</span>';
    }
    html += "</div>";

    if (type || currency || country) {
      html += '<div class="mt-1.5 flex flex-wrap gap-1">';
      if (type) {
        html +=
          '<span class="hotel-meta-badge hotel-meta-badge--type" title="Type">' +
          escapeHtml(type) +
          "</span>";
      }
      if (currency) {
        html +=
          '<span class="hotel-meta-badge hotel-meta-badge--currency" title="Currency">' +
          escapeHtml(currency) +
          "</span>";
      }
      if (country) {
        html +=
          '<span class="hotel-meta-badge hotel-meta-badge--country" title="Country">' +
          escapeHtml(country.toUpperCase()) +
          "</span>";
      }
      html += "</div>";
    }

    html += "</div>";
    return html;
  }

  function hotelRecordPayload(item) {
    const detail = item.detail || {};
    return {
      hotelId: item.row?.hotelId || detail.hotelId || item.id || "",
      hotelName: item.row?.hotelName || detail.hotelName || item.title || "",
      locationCode: item.row?.locationCode || detail.locationCode || "",
      countryCode: item.row?.countryCode || detail.countryCode || "",
      currencyCode: item.row?.currencyCode || detail.currencyCode || "",
      roomTypes: Array.isArray(detail.roomTypes) ? detail.roomTypes : [],
    };
  }

  function hotelActionsHtml(item) {
    if (moduleId !== "list-hotels") {
      const href =
        "/modules/" + moduleId + "/records/" + encodeURIComponent(item.id);
      return (
        '<a href="' +
        escapeHtml(href) +
        '" class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 transition hover:bg-brand-50">View detail</a>'
      );
    }

    const payload = escapeHtml(JSON.stringify(hotelRecordPayload(item)));
    const href =
      "/modules/" + moduleId + "/records/" + encodeURIComponent(item.id);
    return (
      '<div class="hotel-menu relative inline-flex justify-end">' +
      '<button type="button" class="hotel-menu-trigger" aria-haspopup="menu" aria-expanded="false" aria-label="Hotel actions" title="Actions">' +
      '<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">' +
      '<circle cx="10" cy="4" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="10" cy="16" r="1.5"/>' +
      "</svg></button>" +
      '<div class="hotel-menu-panel" role="menu">' +
      '<button type="button" role="menuitem" class="hotel-menu-item" data-hotel-action="list-available" data-record="' +
      payload +
      '">Check availability</button>' +
      '<button type="button" role="menuitem" class="hotel-menu-item" data-hotel-action="list-rate-plans" data-record="' +
      payload +
      '">Check rates</button>' +
      '<button type="button" role="menuitem" class="hotel-menu-item" data-hotel-action="create-booking" data-record="' +
      payload +
      '">Create booking</button>' +
      '<a role="menuitem" class="hotel-menu-item" href="' +
      escapeHtml(href) +
      '">View detail</a>' +
      "</div></div>"
    );
  }

  function closeAllHotelMenus() {
    resultsContent.querySelectorAll(".hotel-menu.is-open").forEach((menu) => {
      menu.classList.remove("is-open");
      menu
        .querySelector(".hotel-menu-trigger")
        ?.setAttribute("aria-expanded", "false");
    });
  }

  function statusBadgeClass(value) {
    const raw = String(value || "")
      .trim()
      .toLowerCase();
    if (raw === "active" || raw === "yes") return "status-badge--active";
    if (raw === "inactive" || raw === "no") return "status-badge--inactive";
    if (raw === "cancelled" || raw === "canceled") return "status-badge--cancelled";
    if (raw === "failed" || raw === "error") return "status-badge--failed";
    return "status-badge--neutral";
  }

  function statusBadgeHtml(value) {
    const label = String(value || "").trim() || "—";
    if (label === "—") {
      return '<span class="text-slate-400">—</span>';
    }
    return (
      '<span class="status-badge ' +
      statusBadgeClass(label) +
      '">' +
      escapeHtml(label) +
      "</span>"
    );
  }

  function cellHtml(col, value) {
    if (col.key === "status") {
      return statusBadgeHtml(value);
    }
    if (col.copyable || isCopyableKey(col.key)) {
      return window.renderCopyable
        ? window.renderCopyable(value, escapeHtml)
        : escapeHtml(value || "");
    }
    return (
      '<span class="block truncate" title="' +
      escapeHtml(value || "") +
      '">' +
      escapeHtml(value || "") +
      "</span>"
    );
  }

  function setRawPayload(data, hasRows) {
    lastRawPayload = data;
    if (openRawBtn) {
      // Only offer "View raw" when the query actually returned rows.
      openRawBtn.classList.toggle("hidden", data == null || !hasRows);
    }
  }

  function syncDemoFilterUi() {
    if (!demoFilterGroup) return;
    demoFilterGroup.querySelectorAll(".demo-filter-btn").forEach((btn) => {
      const active = btn.getAttribute("data-demo") === state.demo;
      btn.className =
        "demo-filter-btn rounded-md px-2.5 py-1.5 text-xs font-semibold transition " +
        (active
          ? state.demo === "demo"
            ? "bg-amber-500 text-white shadow-sm"
            : "bg-brand-600 text-white shadow-sm"
          : "text-slate-600 hover:text-slate-900");
    });
  }

  syncDemoFilterUi();

  document.addEventListener("click", (e) => {
    if (e.target.closest(".hotel-menu")) return;
    closeAllHotelMenus();
  });

  openRawBtn?.addEventListener("click", () => {
    if (lastRawPayload == null) return;
    window.openJsonDrawer(
      "Raw API response",
      typeof lastRawPayload === "string"
        ? lastRawPayload
        : JSON.stringify(lastRawPayload, null, 2)
    );
  });

  function renderListing(listing, meta) {
    resultsPanel.classList.remove("hidden");
    state.columns = listing.columns || state.columns;
    state.recordLabel = listing.recordLabel || state.recordLabel;

    const pagination = listing.pagination || {};
    state.page = pagination.page || 1;
    state.pageSize = pagination.pageSize || state.pageSize;
    state.q = pagination.q || "";
    state.demo = pagination.demo || state.demo || "all";

    if (searchInput && document.activeElement !== searchInput) {
      searchInput.value = state.q;
    }
    if (pageSizeSelect) pageSizeSelect.value = String(state.pageSize);
    syncDemoFilterUi();

    const items = listing.items || [];
    const metaColKeys = new Set(["vendorType", "currencyCode", "countryCode"]);
    const cols = columnLabels(state.columns, items[0]?.row).filter(
      (c) => !metaColKeys.has(c.key)
    );

    if (!items.length) {
      const total = Number(pagination.total || 0);
      const emptyTitle = state.q || state.demo !== "all"
        ? "No matching records"
        : "No results";
      const emptyHelp = state.q || state.demo !== "all"
        ? "Try another search term or re-run the query."
        : total === 0
          ? "Nothing usable came back for this query."
          : "Try another search term or re-run the query.";
      resultsContent.innerHTML =
        '<div class="flex flex-col items-center justify-center px-5 py-14 text-center">' +
        '<p class="text-sm font-medium text-slate-700">' + emptyTitle + "</p>" +
        '<p class="mt-1 text-sm text-slate-500">' + emptyHelp + "</p>" +
        "</div>";
    } else {
      let html =
        '<div class="desk-table overflow-x-auto"><table class="min-w-full divide-y divide-slate-200 text-left text-sm">' +
        '<thead class="bg-slate-50"><tr>';
      cols.forEach((c) => {
        html +=
          '<th scope="col" class="whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">' +
          escapeHtml(c.label || c.key) +
          "</th>";
      });
      html +=
        '<th scope="col" class="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Actions</th></tr></thead><tbody class="divide-y divide-slate-100 bg-white">';

      items.forEach((item) => {
        const href =
          "/modules/" + moduleId + "/records/" + encodeURIComponent(item.id);
        const demo = isDemoItem(item);
        html +=
          '<tr class="group ' +
          (demo ? "demo-row " : "") +
          'hover:bg-brand-50/40" data-href="' +
          escapeHtml(href) +
          '">';
        cols.forEach((c) => {
          const val = item.row?.[c.key] ?? "";
          const isName = c.key === "hotelName" || c.key === "name";
          html +=
            '<td class="' +
            (isName ? "min-w-[14rem] max-w-[22rem]" : "max-w-[240px]") +
            ' px-4 py-2.5 text-slate-700">';
          if (isName && moduleId === "list-hotels") {
            html += hotelNameHtml(item, val);
          } else if (isName && demo) {
            html +=
              '<span class="inline-flex max-w-full items-center gap-2">' +
              '<span class="truncate font-semibold text-amber-900" title="' +
              escapeHtml(val) +
              '">' +
              escapeHtml(val) +
              "</span>" +
              '<span class="shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Demo</span>' +
              "</span>";
          } else {
            html += cellHtml(c, val);
          }
          html += "</td>";
        });
        html +=
          '<td class="px-4 py-2.5 text-right">' +
          hotelActionsHtml(item) +
          "</td></tr>";
      });
      html += "</tbody></table></div>";

      html += '<div class="mobile-cards divide-y divide-slate-100">';
      items.forEach((item) => {
        const demo = isDemoItem(item);
        html +=
          '<article class="space-y-2.5 px-4 py-3.5 ' +
          (demo ? "demo-card" : "") +
          '">';
        if (demo) {
          html +=
            '<span class="inline-flex rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Demo</span>';
        }
        cols.slice(0, 5).forEach((c) => {
          const isName = c.key === "hotelName" || c.key === "name";
          html +=
            '<div class="flex items-start justify-between gap-3 text-sm"><span class="shrink-0 pt-0.5 text-slate-500">' +
            escapeHtml(c.label || c.key) +
            '</span><span class="min-w-0 text-right">';
          if (isName && moduleId === "list-hotels") {
            html += hotelNameHtml(item, item.row?.[c.key] ?? "");
          } else {
            html += cellHtml(c, item.row?.[c.key] ?? "");
          }
          html += "</span></div>";
        });
        html +=
          '<div class="pt-1">' + hotelActionsHtml(item) + "</div></article>";
      });
      html += "</div>";

      resultsContent.innerHTML = html;

      resultsContent.querySelectorAll("tr[data-href]").forEach((tr) => {
        tr.addEventListener("click", (e) => {
          if (e.target.closest("a, .copy-btn, button, .hotel-menu")) return;
          window.location.href = tr.getAttribute("data-href");
        });
      });

      resultsContent.querySelectorAll(".hotel-menu-trigger").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const menu = btn.closest(".hotel-menu");
          const willOpen = !menu.classList.contains("is-open");
          closeAllHotelMenus();
          if (willOpen) {
            menu.classList.add("is-open");
            btn.setAttribute("aria-expanded", "true");
          }
        });
      });

      resultsContent.querySelectorAll("[data-hotel-action]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const action = btn.getAttribute("data-hotel-action");
          let record = {};
          try {
            record = JSON.parse(btn.getAttribute("data-record") || "{}");
          } catch (err) {
            record = {};
          }
          closeAllHotelMenus();
          if (window.openHotelActionDrawer) {
            window.openHotelActionDrawer(action, record);
          } else {
            showToast("Action drawer is not available", "error");
          }
        });
      });
    }

    const total = pagination.total || 0;
    const from = pagination.from || 0;
    const to = pagination.to || 0;
    const totalPages = pagination.totalPages || 1;

    pageSummary.textContent =
      total === 0
        ? "0 records"
        : "Showing " +
          from +
          "–" +
          to +
          " of " +
          total +
          " " +
          (state.recordLabel || "record").toLowerCase() +
          "(s)";

    prevPageBtn.disabled = state.page <= 1;
    nextPageBtn.disabled = state.page >= totalPages;

    pageNumbers.innerHTML = "";
    const windowSize = 5;
    let start = Math.max(1, state.page - Math.floor(windowSize / 2));
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);

    for (let p = start; p <= end; p++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = String(p);
      btn.className =
        "min-w-[2rem] rounded-lg px-2.5 py-1.5 text-sm font-medium " +
        (p === state.page
          ? "bg-brand-600 text-white"
          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50");
      btn.addEventListener("click", () => loadResults(p));
      pageNumbers.appendChild(btn);
    }

    const bits = [];
    if (meta?.account?.label) bits.push(meta.account.label);
    if (meta?.fetchedAt) bits.push(new Date(meta.fetchedAt).toLocaleString());
    if (state.q) bits.push('"' + state.q + '"');
    if (state.demo === "demo") bits.push("Demo only");
    if (state.demo === "hide") bits.push("Demo hidden");
    resultsMeta.textContent = bits.join(" · ") || "Results ready";
  }

  async function loadResults(page) {
    if (page) state.page = page;
    setStatus("Updating list…");
    try {
      const params = new URLSearchParams({
        page: String(state.page),
        pageSize: String(state.pageSize),
        q: state.q || "",
        demo: state.demo || "all",
      });
      const res = await fetch(
        "/api/results/" + moduleId + "?" + params.toString()
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Could not load results");

      if (data.empty) {
        if (form.dataset.autoload === "1") {
          quietLoad = true;
          form.requestSubmit();
          return;
        }
        resultsPanel.classList.add("hidden");
        setStatus("");
        return;
      }

      renderListing(data.listing, {
        account: data.account,
        fetchedAt: data.fetchedAt,
      });
      setStatus("Ready", "ok");
      quietLoad = false;
    } catch (err) {
      setStatus(err.message || "Failed to load results", "error");
      if (!quietLoad) showToast(err.message || "Failed to load results", true);
      quietLoad = false;
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (form.dataset.danger === "1") {
      const ask =
        window.askSystemConfirm ||
        ((opts) => Promise.resolve(window.confirm(opts.message || opts.title)));
      const ok = await ask({
        title: "Cancel booking",
        message:
          "Are you sure you want to cancel this booking? This cannot be undone from here.",
        confirmLabel: "Cancel booking",
        danger: true,
      });
      if (!ok) return;
    }

    const formData = new FormData(form);
    const body = Object.fromEntries(formData.entries());
    body.accountId =
      (window.getSelectedAccountId && window.getSelectedAccountId()) ||
      "agent_one";
    body.pageSize = state.pageSize;
    body.demo = state.demo || "all";

    runBtn.disabled = true;
    setStatus("Calling RoomBoss…");
    resultsPanel.classList.remove("hidden");
    if (!resultsContent.querySelector("table")) {
      resultsContent.innerHTML =
        '<div class="flex items-center justify-center gap-2 px-5 py-14 text-sm text-slate-500">' +
        '<span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600"></span>' +
        "Loading hotels…" +
        "</div>";
    }

    try {
      const res = await fetch("/api/run/" + moduleId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      setRawPayload(
        payload.data ?? payload,
        !!payload.ok && (payload.listing?.items || []).length > 0
      );

      if (!payload.ok) {
        const apiError =
          payload.error ||
          payload.data?.failureMessage ||
          payload.data?.message ||
          payload.data?.errorMessage ||
          (typeof payload.data === "string" ? payload.data : "") ||
          "Request failed (" + (payload.status || res.status) + ")";
        setStatus(apiError, "error");
        if (!quietLoad) showToast(apiError, true);
        resultsContent.innerHTML =
          '<div class="px-5 py-10 text-center text-sm text-rose-600">' +
          escapeHtml(apiError) +
          "</div>";
        return;
      }

      state.page = 1;
      state.q = "";
      if (searchInput) searchInput.value = "";
      renderListing(payload.listing, {
        account: payload.account,
        fetchedAt: new Date().toISOString(),
      });
      setStatus(
        "Done — " + (payload.listing?.pagination?.total || 0) + " record(s)",
        "ok"
      );
      if (!quietLoad) {
        showToast(
          "Loaded " + (payload.listing?.pagination?.total || 0) + " record(s)"
        );
      }
    } catch (err) {
      setStatus(err.message || "Something went wrong", "error");
      if (!quietLoad) showToast(err.message || "Request failed", true);
    } finally {
      runBtn.disabled = false;
      quietLoad = false;
    }
  });

  // Reset: native type="reset" only restores the inputs; the results panel
  // (and the session-cached results) still reflected the previous filters.
  form.addEventListener("reset", () => {
    // Let the browser restore default values first.
    setTimeout(async () => {
      state.page = 1;
      state.q = "";
      if (searchInput) searchInput.value = "";
      setRawPayload(null, false);

      if (form.dataset.autoload === "1") {
        // Autoload modules show default results on page load; do the same here.
        quietLoad = true;
        form.requestSubmit();
        return;
      }

      resultsPanel.classList.add("hidden");
      resultsContent.innerHTML = "";
      resultsMeta.textContent = "Load a query to populate this table.";
      setStatus("");
      try {
        await fetch("/api/results/" + moduleId, { method: "DELETE" });
      } catch (e) {
        /* ignore: UI already cleared */
      }
    }, 0);
  });

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.q = searchInput.value.trim();
        state.page = 1;
        loadResults(1);
      }, 280);
    });
  }

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", () => {
      state.pageSize = Number(pageSizeSelect.value) || 10;
      state.page = 1;
      loadResults(1);
    });
  }

  demoFilterGroup?.querySelectorAll(".demo-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.getAttribute("data-demo") || "all";
      if (next === state.demo) return;
      state.demo = next;
      state.page = 1;
      syncDemoFilterUi();
      loadResults(1);
    });
  });

  prevPageBtn?.addEventListener("click", () => {
    if (state.page > 1) loadResults(state.page - 1);
  });

  nextPageBtn?.addEventListener("click", () => {
    loadResults(state.page + 1);
  });

  if (moduleId === "create-booking") {
    const given = form.querySelector('[name="guestGivenName"]');
    const family = form.querySelector('[name="guestFamilyName"]');
    const email = form.querySelector('[name="guestEmail"]');
    if (given && !given.value) given.value = "Peter";
    if (family && !family.value) family.value = "parker";
    if (email && !email.value) {
      email.value =
        "peter_parker_" + String(Math.floor(Math.random() * 1e9)) + "@gmail.com";
    }
    // Rate plan ID stays empty — user must paste from availability / rate plans.
  }

  if (form.dataset.autoload === "1") {
    quietLoad = true;
    if (form.dataset.hasCache === "1") {
      loadResults(1);
    } else {
      form.requestSubmit();
    }
  } else if (form.dataset.hasCache === "1") {
    loadResults(1);
  }
})();
