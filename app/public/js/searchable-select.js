(function () {
  function initSearchableSelect(root) {
    const trigger = root.querySelector(".searchable-select-trigger");
    const panel = root.querySelector(".searchable-select-panel");
    const search = root.querySelector(".searchable-select-search");
    const list = root.querySelector(".searchable-select-list");
    const empty = root.querySelector(".searchable-select-empty");
    const hidden = root.querySelector('input[type="hidden"]');
    const labelEl = root.querySelector(".searchable-select-label");
    const options = Array.from(root.querySelectorAll(".searchable-select-option"));

    function setOpen(open) {
      panel.classList.toggle("hidden", !open);
      root.classList.toggle("is-open", open);
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        search.value = "";
        filterOptions("");
        setTimeout(() => search.focus(), 0);
      }
    }

    function filterOptions(q) {
      const query = String(q || "").trim().toLowerCase();
      let visible = 0;
      options.forEach((opt) => {
        const label = (opt.getAttribute("data-label") || "").toLowerCase();
        const value = (opt.getAttribute("data-value") || "").toLowerCase();
        const match = !query || label.includes(query) || value.includes(query);
        opt.parentElement.classList.toggle("hidden", !match);
        if (match) visible += 1;
      });
      empty.classList.toggle("hidden", visible > 0);
      list.classList.toggle("hidden", visible === 0);
    }

    function selectOption(opt) {
      const value = opt.getAttribute("data-value") || "";
      const label = opt.getAttribute("data-label") || value;
      hidden.value = value;
      labelEl.textContent = label;
      options.forEach((o) => {
        const active = o === opt;
        o.classList.toggle("bg-brand-50", active);
        o.classList.toggle("font-semibold", active);
        o.classList.toggle("text-brand-800", active);
      });
      setOpen(false);
      hidden.dispatchEvent(new Event("change", { bubbles: true }));
    }

    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const open = panel.classList.contains("hidden");
      document.querySelectorAll("[data-searchable-select]").forEach((el) => {
        if (el !== root) {
          el.classList.remove("is-open");
          el.querySelector(".searchable-select-panel")?.classList.add("hidden");
          el.querySelector(".searchable-select-trigger")?.setAttribute("aria-expanded", "false");
        }
      });
      setOpen(open);
    });

    search.addEventListener("input", () => filterOptions(search.value));
    search.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.focus();
      }
    });

    options.forEach((opt) => {
      opt.addEventListener("click", (e) => {
        e.preventDefault();
        selectOption(opt);
      });
    });

    const form = root.closest("form");
    form?.addEventListener("reset", () => {
      setTimeout(() => {
        const initial = root.getAttribute("data-initial-value") || "";
        const match =
          options.find((o) => o.getAttribute("data-value") === initial) ||
          options[0];
        if (match) selectOption(match);
      }, 0);
    });

    root.setAttribute("data-initial-value", hidden.value);
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-searchable-select]")) return;
    document.querySelectorAll("[data-searchable-select]").forEach((el) => {
      el.classList.remove("is-open");
      el.querySelector(".searchable-select-panel")?.classList.add("hidden");
      el.querySelector(".searchable-select-trigger")?.setAttribute("aria-expanded", "false");
    });
  });

  document.querySelectorAll("[data-searchable-select]").forEach(initSearchableSelect);
})();
