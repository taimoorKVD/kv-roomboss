(function () {
  const drawer = document.getElementById("actionDrawer");
  const backdrop = document.getElementById("actionDrawerBackdrop");
  const closeBtn = document.getElementById("actionDrawerClose");
  const titleEl = document.getElementById("actionDrawerTitle");
  const eyebrowEl = document.getElementById("actionDrawerEyebrow");
  const contextEl = document.getElementById("actionDrawerContext");
  const formEl = document.getElementById("actionDrawerForm");
  const submitBtn = document.getElementById("actionDrawerSubmit");
  const resetBtn = document.getElementById("actionDrawerReset");
  const statusEl = document.getElementById("actionDrawerStatus");
  const resultsWrap = document.getElementById("actionDrawerResults");
  const resultsBody = document.getElementById("actionDrawerResultsBody");
  const rawBtn = document.getElementById("actionDrawerRawBtn");
  const configEl = document.getElementById("modulesConfigData");

  if (!drawer || !formEl || !configEl) return;

  let modulesConfig = [];
  try {
    modulesConfig = JSON.parse(configEl.textContent || "[]");
  } catch (e) {
    modulesConfig = [];
  }

  let currentModule = null;
  let currentRecord = null;
  let lastRaw = null;
  let initialValues = {};

  const SPINNER =
    '<span class="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true"></span>';

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDateInput(date) {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function defaultDates() {
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 14);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 3);
    return {
      checkIn: formatDateInput(checkIn),
      checkOut: formatDateInput(checkOut),
    };
  }

  function normalizeLocation(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const lower = raw.toLowerCase();
    if (lower.includes("niseko")) return "niseko";
    if (lower.includes("hakuba")) return "hakuba";
    if (lower.includes("furano")) return "furano";
    if (lower.includes("tokyo")) return "tokyo";
    if (lower.includes("rusutsu")) return "rusutsu";
    if (lower.includes("kiroro")) return "kiroro";
    return lower;
  }

  function buildPrefill(moduleDef, record) {
    const dates = defaultDates();
    const hotelId = record.hotelId || "";
    const locationCode = normalizeLocation(record.locationCode);
    const firstRoom =
      Array.isArray(record.roomTypes) && record.roomTypes.length
        ? record.roomTypes[0]
        : null;

    const base = {
      hotelId,
      locationCode,
      countryCode: record.countryCode || "jp",
      rate: "ota",
      numberGuests: "1",
      numberAdults: "1",
      numberChildren: "0",
      numberInfants: "0",
      priceRetailMax: "0",
      checkIn: dates.checkIn,
      checkOut: dates.checkOut,
      customId:
        "JSE" +
        Date.now().toString(36).toUpperCase() +
        Math.random().toString(36).slice(2, 6).toUpperCase(),
      guestGivenName: "Peter",
      guestFamilyName: "parker",
      guestEmail:
        "peter_parker_" + String(Math.floor(Math.random() * 1e9)) + "@gmail.com",
      bookingExtent: "RESERVATION",
      roomTypeId: firstRoom?.roomTypeId || "",
      ratePlanId: "419079",
    };

    // Module field defaults fill gaps
    (moduleDef.fields || []).forEach((field) => {
      if (base[field.key] === undefined || base[field.key] === "") {
        if (field.default !== undefined && field.default !== "") {
          base[field.key] = field.default;
        }
      }
    });

    return base;
  }

  function fieldControl(field, value) {
    const id = "action-field-" + field.key;
    const required = field.required ? "required" : "";
    const val = value == null ? "" : String(value);

    if (field.type === "select" || field.type === "searchable-select") {
      const options = field.options || [];
      let html =
        '<select id="' +
        id +
        '" name="' +
        escapeHtml(field.key) +
        '" class="form-control" ' +
        required +
        ">";
      options.forEach((opt) => {
        const selected =
          String(opt.value) === String(val) ? " selected" : "";
        html +=
          '<option value="' +
          escapeHtml(opt.value) +
          '"' +
          selected +
          ">" +
          escapeHtml(opt.label) +
          "</option>";
      });
      // If prefilled value isn't in options, add it
      if (
        val &&
        !options.some((o) => String(o.value) === String(val))
      ) {
        html +=
          '<option value="' +
          escapeHtml(val) +
          '" selected>' +
          escapeHtml(val) +
          "</option>";
      }
      html += "</select>";
      return html;
    }

    const type =
      field.type === "date"
        ? "date"
        : field.type === "number"
          ? "number"
          : field.type === "email"
            ? "email"
            : "text";

    return (
      '<input id="' +
      id +
      '" name="' +
      escapeHtml(field.key) +
      '" type="' +
      type +
      '" value="' +
      escapeHtml(val) +
      '" class="form-control" ' +
      required +
      (typeof field.min !== "undefined" ? ' min="' + field.min + '"' : "") +
      ' autocomplete="off" />'
    );
  }

  function fieldSpanClass(field) {
    const fullKeys = {
      hotelId: true,
      locationCode: true,
      guestEmail: true,
      bookingExtent: true,
      customId: true,
      bookingId: true,
    };
    if (field.type === "searchable-select") return " action-field--full";
    if (fullKeys[field.key]) return " action-field--full";
    return "";
  }

  function renderForm(moduleDef, values) {
    formEl.innerHTML = (moduleDef.fields || [])
      .map((field) => {
        const value =
          values[field.key] !== undefined ? values[field.key] : field.default || "";
        return (
          '<div class="action-field' +
          fieldSpanClass(field) +
          '">' +
          '<label for="action-field-' +
          escapeHtml(field.key) +
          '" class="form-label">' +
          escapeHtml(field.label) +
          (field.required ? ' <span class="text-rose-500">*</span>' : "") +
          "</label>" +
          fieldControl(field, value) +
          (field.help
            ? '<p class="form-help">' + escapeHtml(field.help) + "</p>"
            : "") +
          "</div>"
        );
      })
      .join("");
  }

  function setStatus(text, kind) {
    if (!statusEl) return;
    statusEl.textContent = text || "";
    statusEl.className =
      "text-sm " +
      (kind === "error"
        ? "text-rose-600"
        : kind === "ok"
          ? "text-emerald-700"
          : "text-slate-500");
  }

  function setSubmitLoading(loading) {
    if (!submitBtn) return;
    if (loading) {
      if (!submitBtn.dataset.idle) submitBtn.dataset.idle = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = SPINNER + "<span>Runningâ€¦</span>";
    } else {
      submitBtn.disabled = false;
      submitBtn.innerHTML = submitBtn.dataset.idle || "Run";
    }
  }

  function resolveErrorMessage(payload) {
    if (payload?.error && String(payload.error).trim()) {
      return String(payload.error).trim();
    }
    const data = payload?.data;
    if (typeof data === "string" && data.trim()) return data.trim();
    if (data && typeof data === "object") {
      const candidates = [
        data.failureMessage,
        data.message,
        data.errorMessage,
        data.error,
        data.statusMessage,
      ];
      for (const value of candidates) {
        if (value != null && String(value).trim()) return String(value).trim();
      }
    }
    if (payload?.status) return "Request failed (HTTP " + payload.status + ")";
    return "Request failed";
  }

  function renderResults(payload) {
    resultsWrap.classList.remove("hidden");
    lastRaw = payload.data ?? payload;
    // Only offer "View raw" when the query actually returned rows.
    const hasRows = !!payload.ok && (payload.listing?.items || []).length > 0;
    rawBtn.classList.toggle("hidden", lastRaw == null || !hasRows);

    if (!payload.ok) {
      resultsBody.innerHTML =
        '<div class="px-4 py-8 text-center text-sm text-rose-600">' +
        escapeHtml(resolveErrorMessage(payload)) +
        "</div>";
      return;
    }

    const listing = payload.listing;
    const items = listing?.items || [];
    if (!items.length) {
      resultsBody.innerHTML =
        '<div class="px-4 py-8 text-center text-sm text-slate-500">No rows returned.</div>';
      return;
    }

    const cols =
      listing.columns && listing.columns.length
        ? listing.columns
        : Object.keys(items[0].row || {}).map((k) => ({ key: k, label: k }));

    let html =
      '<div class="overflow-x-auto"><table class="min-w-full divide-y divide-slate-200 text-left text-sm"><thead class="bg-slate-50"><tr>';
    cols.forEach((c) => {
      html +=
        '<th class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">' +
        escapeHtml(c.label || c.key) +
        "</th>";
    });
    html += "</tr></thead><tbody class=\"divide-y divide-slate-100\">";
    items.forEach((item) => {
      html += "<tr>";
      cols.forEach((c) => {
        const val = item.row?.[c.key] ?? "";
        let cell = escapeHtml(val);
        if (c.key === "status") {
          const raw = String(val || "").trim().toLowerCase();
          let kind = "neutral";
          if (raw === "active" || raw === "yes") kind = "active";
          else if (raw === "inactive" || raw === "cancelled / inactive" || raw === "no") kind = "inactive";
          else if (raw === "cancelled" || raw === "canceled") kind = "cancelled";
          else if (raw === "failed" || raw === "error") kind = "failed";
          cell =
            '<span class="status-badge status-badge--' +
            kind +
            '">' +
            escapeHtml(String(val || "â€”")) +
            "</span>";
        }
        html +=
          '<td class="max-w-[180px] truncate px-3 py-2 text-slate-700" title="' +
          escapeHtml(val) +
          '">' +
          cell +
          "</td>";
      });
      html += "</tr>";
    });
    html += "</tbody></table></div>";
    resultsBody.innerHTML = html;
  }

  function openDrawer(moduleId, record) {
    currentModule = modulesConfig.find((m) => m.id === moduleId);
    if (!currentModule) {
      showToast("Unknown module", "error");
      return;
    }
    currentRecord = record || {};
    initialValues = buildPrefill(currentModule, currentRecord);

    titleEl.textContent = currentModule.name;
    eyebrowEl.textContent = currentModule.shortName || "Hotel action";
    contextEl.innerHTML =
      '<div class="flex flex-wrap items-center gap-x-3 gap-y-1">' +
      '<span class="font-semibold text-slate-800">' +
      escapeHtml(currentRecord.hotelName || "Hotel") +
      "</span>" +
      (currentRecord.hotelId
        ? '<span class="font-mono text-[11px] text-slate-500">' +
          escapeHtml(currentRecord.hotelId) +
          "</span>"
        : "") +
      (currentRecord.locationCode
        ? '<span class="rounded bg-white px-1.5 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200">' +
          escapeHtml(currentRecord.locationCode) +
          "</span>"
        : "") +
      "</div>" +
      '<p class="mt-1 text-[11px] text-slate-500">' +
      escapeHtml(currentModule.description || "") +
      "</p>";

    renderForm(currentModule, initialValues);
    submitBtn.dataset.idle =
      currentModule.action === "create" ? "Create booking" : "Run query";
    submitBtn.innerHTML = submitBtn.dataset.idle;
    setStatus("");
    resultsWrap.classList.add("hidden");
    resultsBody.innerHTML = "";
    rawBtn.classList.add("hidden");

    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    backdrop?.classList.add("is-open");
    document.body.classList.add("overflow-hidden");
  }

  function closeDrawer() {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    backdrop?.classList.remove("is-open");
    document.body.classList.remove("overflow-hidden");
  }

  async function submitAction() {
    if (!currentModule) return;
    if (!formEl.reportValidity()) return;

    const formData = new FormData(formEl);
    const body = Object.fromEntries(formData.entries());
    body.accountId =
      (window.getSelectedAccountId && window.getSelectedAccountId()) ||
      "agent_one";
    body.pageSize = 25;
    if (typeof body.customId === "string") {
      body.customId = body.customId.trim();
      const refsKey = "rbUsedRefs";
      let usedRefs = [];
      try {
        usedRefs = JSON.parse(sessionStorage.getItem(refsKey) || "[]");
      } catch (e) {}
      if (body.customId && usedRefs.indexOf(body.customId) !== -1) {
        showToast(
          "Note: reference " + body.customId + " was already used in this session.",
          "info"
        );
      }
      if (body.customId && currentModule.action === "create") {
        usedRefs.push(body.customId);
        try {
          sessionStorage.setItem(refsKey, JSON.stringify(usedRefs.slice(-200)));
        } catch (e) {}
      }
    }

    setSubmitLoading(true);
    setStatus("Calling RoomBossâ€¦");
    resultsWrap.classList.add("hidden");

    try {
      const res = await fetch("/api/run/" + currentModule.id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      renderResults(payload);
      if (!payload.ok) {
        const message = resolveErrorMessage(payload);
        setStatus(message, "error");
        showToast(message, "error");
        return;
      }
      const total = payload.listing?.pagination?.total || 0;
      setStatus("Done â€” " + total + " record(s)", "ok");
      showToast(
        currentModule.action === "create"
          ? "Booking request completed"
          : "Loaded " + total + " record(s)",
        "success"
      );
    } catch (err) {
      setStatus(err.message || "Request failed", "error");
      showToast(err.message || "Request failed", "error");
    } finally {
      setSubmitLoading(false);
    }
  }

  closeBtn?.addEventListener("click", closeDrawer);
  backdrop?.addEventListener("click", closeDrawer);
  resetBtn?.addEventListener("click", () => {
    if (!currentModule) return;
    renderForm(currentModule, initialValues);
    // Clear results from the previous query so they don't contradict the reset form.
    lastRaw = null;
    rawBtn?.classList.add("hidden");
    resultsBody.innerHTML = "";
    resultsWrap.classList.add("hidden");
    setStatus("Form reset to hotel defaults");
  });
  submitBtn?.addEventListener("click", submitAction);
  rawBtn?.addEventListener("click", () => {
    if (lastRaw == null) return;
    window.openJsonDrawer(
      currentModule?.name + " Â· raw response",
      typeof lastRaw === "string" ? lastRaw : JSON.stringify(lastRaw, null, 2)
    );
  });

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !drawer.classList.contains("is-open")) return;
    if (document.getElementById("jsonDrawer")?.classList.contains("is-open")) {
      return;
    }
    closeDrawer();
  });

  window.openHotelActionDrawer = openDrawer;
})();
