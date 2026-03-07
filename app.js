(() => {
  "use strict";

  const STORAGE_KEY = "web-saver-links";
  const DEFAULT_LABELS = ["Work", "Personal", "News", "Docs", "Shop"];

  /* ── Helpers ─────────────────────────────────────────────── */

  /**
   * Return the Google S2 favicon URL for a given page URL.
   * Falls back to a generic globe emoji via a data URI on error.
   * @param {string} pageUrl
   * @returns {string}
   */
  function getFaviconUrl(pageUrl) {
    try {
      const { hostname } = new URL(pageUrl);
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
        hostname
      )}&sz=32`;
    } catch {
      return "";
    }
  }

  /**
   * Derive a display title from the URL when the user leaves the title blank.
   * @param {string} pageUrl
   * @returns {string}
   */
  function deriveTitle(pageUrl) {
    try {
      const url = new URL(pageUrl);
      return url.hostname.replace(/^www\./, "");
    } catch {
      return pageUrl;
    }
  }

  /* ── Storage ─────────────────────────────────────────────── */

  function loadLinks() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveLinks(links) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
    } catch {
      // Storage quota exceeded or unavailable (e.g. private browsing)
    }
  }

  /**
   * Collect all unique labels (defaults + user-created from saved links).
   * @returns {string[]}
   */
  function getAllLabels() {
    const userLabels = loadLinks()
      .map((l) => l.label)
      .filter((l) => l && !DEFAULT_LABELS.includes(l));
    return [...DEFAULT_LABELS, ...new Set(userLabels)];
  }

  /**
   * Setup a custom dropdown for a label input.
   * @param {HTMLInputElement} input
   * @param {HTMLElement} menuEl - the .dropdown-menu container
   * @returns {{ destroy: () => void }}
   */
  function setupDropdown(input, menuEl) {
    let activeIndex = -1;

    function render(filter = "") {
      const labels = getAllLabels().filter((l) =>
        l.toLowerCase().includes(filter.toLowerCase())
      );
      menuEl.innerHTML = "";
      if (labels.length === 0) {
        hide();
        return;
      }
      labels.forEach((label, i) => {
        const item = document.createElement("div");
        item.className = "dropdown-item";
        item.textContent = label;
        if (i === activeIndex) item.classList.add("dropdown-item--active");
        item.addEventListener("mousedown", (e) => {
          e.preventDefault(); // prevent input blur
          input.value = label;
          hide();
          input.dispatchEvent(new Event("input"));
        });
        menuEl.appendChild(item);
      });
    }

    function show() {
      activeIndex = -1;
      render(input.value);
      menuEl.classList.add("dropdown-menu--open");
    }

    function hide() {
      menuEl.classList.remove("dropdown-menu--open");
      activeIndex = -1;
    }

    function onFocus() {
      show();
    }

    function onBlur() {
      // Delay to allow mousedown on item to fire first
      setTimeout(hide, 120);
    }

    function onInput() {
      activeIndex = -1;
      render(input.value);
      if (!menuEl.classList.contains("dropdown-menu--open")) {
        menuEl.classList.add("dropdown-menu--open");
      }
    }

    function onKeydown(e) {
      const items = menuEl.querySelectorAll(".dropdown-item");
      if (!items.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
        render(input.value);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        render(input.value);
      } else if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        input.value = items[activeIndex].textContent;
        hide();
      } else if (e.key === "Escape") {
        hide();
      }
    }

    input.addEventListener("focus", onFocus);
    input.addEventListener("blur", onBlur);
    input.addEventListener("input", onInput);
    input.addEventListener("keydown", onKeydown);

    return {
      destroy() {
        input.removeEventListener("focus", onFocus);
        input.removeEventListener("blur", onBlur);
        input.removeEventListener("input", onInput);
        input.removeEventListener("keydown", onKeydown);
        hide();
      },
    };
  }

  /* ── Render ──────────────────────────────────────────────── */

  const linksList = document.getElementById("links-list");
  const emptyMessage = document.getElementById("empty-message");
  const filterContainer = document.getElementById("filter-container");
  const searchInput = document.getElementById("search-input");

  let currentFilter = "All";
  let currentSearch = "";

  searchInput.addEventListener("input", (e) => {
    currentSearch = e.target.value.toLowerCase().trim();
    renderLinks();
  });

  function renderFilterButtons(links) {
    const labels = new Set(links.map((l) => l.label).filter((l) => l));
    const sortedLabels = ["All", ...Array.from(labels).sort()];

    // Reset filter if active label no longer exists
    if (!sortedLabels.includes(currentFilter)) {
      currentFilter = "All";
    }

    filterContainer.innerHTML = "";

    // Hide if no labels (only "All")
    if (sortedLabels.length <= 1) {
      filterContainer.style.display = "none";
      return;
    }
    filterContainer.style.display = "flex";

    sortedLabels.forEach((label) => {
      const btn = document.createElement("button");
      btn.className = `filter-btn ${label === currentFilter ? "active" : ""}`;
      btn.textContent = label;
      btn.addEventListener("click", () => {
        currentFilter = label;
        renderLinks();
      });
      filterContainer.appendChild(btn);
    });
  }

  function renderLinks() {
    const allLinks = loadLinks();
    renderFilterButtons(allLinks);

    const links = allLinks.filter((link) => {
      const matchesFilter =
        currentFilter === "All" || link.label === currentFilter;
      const matchesSearch =
        !currentSearch ||
        link.title.toLowerCase().includes(currentSearch) ||
        link.url.toLowerCase().includes(currentSearch);
      return matchesFilter && matchesSearch;
    });

    linksList.innerHTML = "";

    if (links.length === 0) {
      emptyMessage.style.display = "block";
      if (currentFilter !== "All" || currentSearch) {
        emptyMessage.textContent = "No matches found";
      } else {
        emptyMessage.textContent = "No saved links yet";
      }
    } else {
      emptyMessage.style.display = "none";
    }

    links.forEach((link) => {
      const li = document.createElement("li");
      li.className = "link-item";
      li.dataset.id = link.id;
      li.setAttribute("role", "button");
      li.setAttribute("aria-label", `Open ${link.title}`);
      li.addEventListener("click", () => {
        if (li.dataset.editing) return;
        window.open(link.url, "_blank", "noopener,noreferrer");
      });

      const favicon = document.createElement("img");
      favicon.className = "favicon";
      favicon.alt = "";
      favicon.src = getFaviconUrl(link.url);
      favicon.onerror = () => {
        favicon.src =
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239ca3af'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3C/svg%3E";
      };

      const title = document.createElement("span");
      title.className = "link-title";
      title.textContent = link.title;

      const domain = document.createElement("span");
      domain.className = "link-domain";
      domain.textContent = deriveTitle(link.url);
      domain.title = link.url;

      const actions = document.createElement("div");
      actions.className = "link-actions";

      const openBtn = document.createElement("button");
      openBtn.className = "link-action link-action--open";
      openBtn.setAttribute("aria-label", `Open ${link.title}`);
      openBtn.title = "Open link";
      openBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
      openBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.open(link.url, "_blank", "noopener,noreferrer");
      });

      const editBtn = document.createElement("button");
      editBtn.className = "link-action link-action--edit";
      editBtn.setAttribute("aria-label", `Edit label for ${link.title}`);
      editBtn.title = "Edit label";
      editBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-1.42.59H8v-4a2 2 0 01.59-1.42l7.17-7.17"/><path d="M15 5l4 4"/><path d="M13.5 6.5l4 4"/></svg>`;
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showLabelEditor(li, link);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "link-action link-action--delete";
      deleteBtn.setAttribute("aria-label", `Delete ${link.title}`);
      deleteBtn.title = "Delete";
      deleteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`;
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteLink(link.id);
      });

      actions.appendChild(openBtn);
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      li.appendChild(favicon);
      li.appendChild(title);
      if (link.label) {
        const badge = document.createElement("span");
        badge.className = "link-badge";
        badge.textContent = link.label;
        li.appendChild(badge);
      }
      li.appendChild(domain);
      li.appendChild(actions);
      linksList.appendChild(li);
    });
  }

  /* ── CRUD ────────────────────────────────────────────────── */

  function addLink(url, customTitle, label) {
    const links = loadLinks();
    const entry = {
      id: crypto.randomUUID(),
      url,
      title: customTitle.trim() || deriveTitle(url),
      label: label.trim(),
      createdAt: Date.now(),
    };
    links.unshift(entry);
    saveLinks(links);
    renderLinks();
  }

  function deleteLink(id) {
    const links = loadLinks().filter((l) => l.id !== id);
    saveLinks(links);
    renderLinks();
  }

  function updateLabel(id, newLabel) {
    const links = loadLinks();
    const link = links.find((l) => l.id === id);
    if (link) {
      link.label = newLabel.trim();
      saveLinks(links);
      renderLinks();
    }
  }

  /**
   * Show an inline label editor inside a link item.
   * @param {HTMLElement} li - the link-item element
   * @param {object} link - the link data object
   */
  function showLabelEditor(li, link) {
    // Flag: prevent the card click from opening the URL
    li.dataset.editing = "true";

    // Build editor UI
    li.innerHTML = "";
    li.className = "link-item link-item--editing";

    const editorLabel = document.createElement("span");
    editorLabel.className = "label-editor__label";
    editorLabel.textContent = "Label:";

    const dropdownWrap = document.createElement("div");
    dropdownWrap.className = "dropdown-wrap dropdown-wrap--flex";

    const input = document.createElement("input");
    input.className = "label-editor__input";
    input.type = "text";
    input.value = link.label || "";
    input.placeholder = "Enter label…";

    const editorMenu = document.createElement("div");
    editorMenu.className = "dropdown-menu";

    dropdownWrap.appendChild(input);
    dropdownWrap.appendChild(editorMenu);

    const saveBtn = document.createElement("button");
    saveBtn.className = "label-editor__btn label-editor__btn--save";
    saveBtn.textContent = "Save";
    saveBtn.type = "button";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "label-editor__btn label-editor__btn--cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.type = "button";

    li.appendChild(editorLabel);
    li.appendChild(dropdownWrap);
    li.appendChild(saveBtn);
    li.appendChild(cancelBtn);

    // Wire up custom dropdown
    const editorDropdown = setupDropdown(input, editorMenu);

    // Focus input
    requestAnimationFrame(() => input.focus());

    function save() {
      editorDropdown.destroy();
      updateLabel(link.id, input.value);
    }

    function cancel() {
      editorDropdown.destroy();
      renderLinks();
    }

    saveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      save();
    });

    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      cancel();
    });

    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        save();
      } else if (e.key === "Escape") {
        cancel();
      }
    });

    // Prevent clicks inside editor from doing anything else
    li.addEventListener("click", (e) => e.stopPropagation(), { once: false });
  }

  /* ── Form handling ───────────────────────────────────────── */

  const form = document.getElementById("add-form");
  const urlInput = document.getElementById("url-input");
  const titleInput = document.getElementById("title-input");
  const labelInput = document.getElementById("label-input");
  const labelDropdown = document.getElementById("label-dropdown");
  const formError = document.getElementById("form-error");

  // Wire custom dropdown to form label input
  setupDropdown(labelInput, labelDropdown);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    formError.textContent = "";

    const rawUrl = urlInput.value.trim();
    if (!rawUrl) {
      formError.textContent = "Please enter a URL.";
      urlInput.focus();
      return;
    }

    let normalizedUrl = rawUrl;
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = "https://" + normalizedUrl;
    }

    try {
      new URL(normalizedUrl); // validate
    } catch {
      formError.textContent = "Please enter a valid URL.";
      urlInput.focus();
      return;
    }

    addLink(normalizedUrl, titleInput.value, labelInput.value);
    urlInput.value = "";
    titleInput.value = "";
    labelInput.value = "";
    urlInput.focus();
  });

  /* ── Auto-fill current tab URL (+  button) ────────────────── */

  const addCurrentBtn = document.getElementById("add-current-btn");

  if (addCurrentBtn) {
    addCurrentBtn.addEventListener("click", async () => {
      formError.textContent = "";
      try {
        if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const tab = tabs[0];
          if (tab && tab.url) {
            urlInput.value = tab.url;
            titleInput.value = tab.title || "";
            urlInput.focus();
          } else {
            formError.textContent = "Cannot get URL from this tab.";
          }
        } else {
          formError.textContent = "Extension API not available.";
        }
      } catch (err) {
        formError.textContent = "Failed to get current tab URL.";
        console.error(err);
      }
    });
  }

  /* ── Quick Save current page ─────────────────────────────── */

  const quickSaveBtn = document.getElementById("quick-save-btn");
  const quickSaveMsg = document.getElementById("quick-save-msg");

  /**
   * Show a temporary feedback message next to the quick-save button.
   * @param {string} text
   * @param {"success"|"error"} type
   */
  function showQuickMsg(text, type) {
    quickSaveMsg.textContent = text;
    quickSaveMsg.className = `quick-save__msg quick-save__msg--${type}`;
    clearTimeout(showQuickMsg._timer);
    showQuickMsg._timer = setTimeout(() => {
      quickSaveMsg.textContent = "";
      quickSaveMsg.className = "quick-save__msg";
    }, 2000);
  }

  if (quickSaveBtn) {
    quickSaveBtn.addEventListener("click", async () => {
      try {
        if (typeof chrome === "undefined" || !chrome.tabs || !chrome.tabs.query) {
          showQuickMsg("Extension API not available", "error");
          return;
        }

        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];

        if (!tab || !tab.url) {
          showQuickMsg("Cannot read this tab", "error");
          return;
        }

        // Skip chrome:// and edge:// internal pages
        if (/^(chrome|edge|about|chrome-extension):\/\//i.test(tab.url)) {
          showQuickMsg("Cannot save internal pages", "error");
          return;
        }

        // Check for duplicate
        const existing = loadLinks();
        if (existing.some((l) => l.url === tab.url)) {
          showQuickMsg("Already saved!", "error");
          return;
        }

        addLink(tab.url, tab.title || "", "");
        showQuickMsg("Saved ✓", "success");
      } catch (err) {
        showQuickMsg("Failed to save", "error");
        console.error(err);
      }
    });
  }

  /* ── Init ────────────────────────────────────────────────── */
  renderLinks();
})();
