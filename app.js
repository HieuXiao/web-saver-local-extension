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
   * Collect all unique labels sorted by recently used first.
   * @returns {string[]}
   */
  function getAllLabels() {
    const recentLabels = new Set(
      loadLinks()
        .map((l) => l.label)
        .filter((l) => l)
    );
    DEFAULT_LABELS.forEach((l) => recentLabels.add(l));
    return Array.from(recentLabels);
  }

  /**
   * Setup a custom dropdown for a label input.
   * @param {HTMLInputElement} input
   * @param {HTMLElement} menuEl - the .dropdown-menu container
   * @returns {{ destroy: () => void }}
   */
  function setupDropdown(input, menuEl) {
    let activeIndex = -1;
    // Move the menu up to the .popup root so it escapes hidden overflow of inner containers
    const popupEl = document.querySelector(".popup");
    if (menuEl.parentElement !== popupEl) {
      popupEl.appendChild(menuEl);
    }

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
          input.dispatchEvent(new CustomEvent("input", { detail: { fromDropdown: true } }));
        });
        menuEl.appendChild(item);
      });
    }

    function updatePosition() {
      // Calculate position relative to the popup container
      const inputRect = input.getBoundingClientRect();
      const popupRect = popupEl.getBoundingClientRect();
      
      const leftPos = inputRect.left - popupRect.left;
      
      // Calculate space below and above
      const spaceBelow = popupRect.bottom - inputRect.bottom;
      const spaceAbove = inputRect.top - popupRect.top;
      
      const maxDropdownHeight = 140; // max-height defined in CSS
      
      let topPos;
      
      // Only pop upwards if there is clearly not enough space BELOW and there is more space ABOVE
      if (spaceBelow < maxDropdownHeight && spaceAbove > spaceBelow) {
        // Pop upwards
        // Place bottom of dropdown just above the input top
        
        // We need to set bottom relative to popup height or top
        // To use 'top', it should be: input top relative to popup - dropdown height
        // But height might vary. To let auto height work up to max-height, we can set flex or max-height
        const availableHeightAbove = spaceAbove - 5;
        const actualMaxHeight = Math.min(maxDropdownHeight, availableHeightAbove);
        
        // Remove direct top if we are placing bottom upwards, but standard positioning uses top.
        // It's cleaner to reset top/bottom.
        menuEl.style.top = 'auto';
        menuEl.style.bottom = `${popupRect.bottom - inputRect.top + 2}px`;
        menuEl.style.maxHeight = `${actualMaxHeight}px`;
      } else {
        // Pop downwards (default)
        topPos = inputRect.bottom - popupRect.top + 2; 
        const availableHeightBelow = spaceBelow - 5;
        
        menuEl.style.bottom = 'auto';
        menuEl.style.top = `${topPos}px`;
        menuEl.style.maxHeight = `${Math.min(maxDropdownHeight, Math.max(80, availableHeightBelow))}px`; // Ensure at least 80px if squeezing
      }
      
      menuEl.style.left = `${leftPos}px`;
      menuEl.style.width = `${inputRect.width}px`;
    }

    function show() {
      activeIndex = -1;
      render(input.value);
      updatePosition();
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

    function onInput(e) {
      activeIndex = -1;
      render(input.value);
      if (e && e.detail && e.detail.fromDropdown) return;
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
    
    // Update position if the user scrolls the wrapper
    const listWrapper = document.querySelector(".links-list-wrapper");
    if (listWrapper) {
      listWrapper.addEventListener("scroll", updatePosition);
    }

    return {
      destroy() {
        input.removeEventListener("focus", onFocus);
        input.removeEventListener("blur", onBlur);
        input.removeEventListener("input", onInput);
        input.removeEventListener("keydown", onKeydown);
        if (listWrapper) {
          listWrapper.removeEventListener("scroll", updatePosition);
        }
        hide();
        // optionally remove menuEl from DOM
        menuEl.remove();
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
    }).sort((a, b) => a.title.localeCompare(b.title));

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

      const editTitleBtn = document.createElement("button");
      editTitleBtn.className = "link-action link-action--edit-title";
      editTitleBtn.setAttribute("aria-label", `Edit title for ${link.title}`);
      editTitleBtn.title = "Edit title";
      editTitleBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
      editTitleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showTitleEditor(li, link);
      });

      const editBtn = document.createElement("button");
      editBtn.className = "link-action link-action--edit";
      editBtn.setAttribute("aria-label", `Edit label for ${link.title}`);
      editBtn.title = "Edit label";
      editBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`;
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

      actions.appendChild(editTitleBtn);
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

  function updateTitle(id, newTitle) {
    const links = loadLinks();
    const link = links.find((l) => l.id === id);
    if (link) {
      link.title = newTitle.trim() || deriveTitle(link.url);
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

    // Wire up custom dropdown FIRST, so its Enter listener runs before our form submit listener
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

  /**
   * Show an inline title editor inside a link item.
   * @param {HTMLElement} li - the link-item element
   * @param {object} link - the link data object
   */
  function showTitleEditor(li, link) {
    li.dataset.editing = "true";

    li.innerHTML = "";
    li.className = "link-item link-item--editing";

    const editorLabel = document.createElement("span");
    editorLabel.className = "label-editor__label";
    editorLabel.textContent = "Title:";

    const input = document.createElement("input");
    input.className = "label-editor__input";
    input.type = "text";
    input.value = link.title || "";
    input.placeholder = "Enter title…";

    const saveBtn = document.createElement("button");
    saveBtn.className = "label-editor__btn label-editor__btn--save";
    saveBtn.textContent = "Save";
    saveBtn.type = "button";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "label-editor__btn label-editor__btn--cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.type = "button";

    li.appendChild(editorLabel);
    li.appendChild(input);
    li.appendChild(saveBtn);
    li.appendChild(cancelBtn);

    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });

    function save() {
      updateTitle(link.id, input.value);
    }

    function cancel() {
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
    addCurrentBtn.addEventListener("click", async (e) => {
      // If the user already pasted a URL, treat this button as a manual "Save" submit button
      if (urlInput && urlInput.value.trim() !== "") {
        e.preventDefault();
        form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
        return;
      }

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

        const labelVal = document.getElementById("label-input")?.value || "";
        addLink(tab.url, tab.title || "", labelVal);
        
        // Clear label input after quick saving
        const labelInputEl = document.getElementById("label-input");
        if (labelInputEl) labelInputEl.value = "";
        
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
