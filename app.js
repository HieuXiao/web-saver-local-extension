(() => {
  "use strict";

  const STORAGE_KEY = "web-saver-links";

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

      const favicon = document.createElement("img");
      favicon.className = "favicon";
      favicon.alt = "";
      favicon.src = getFaviconUrl(link.url);
      favicon.onerror = () => {
        favicon.src =
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239ca3af'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3C/svg%3E";
      };

      const info = document.createElement("div");
      info.className = "link-info";

      const titleRow = document.createElement("div");
      titleRow.className = "link-header";

      const title = document.createElement("div");
      title.className = "link-title";
      title.textContent = link.title;

      titleRow.appendChild(title);

      if (link.label) {
        const labelEl = document.createElement("div");
        labelEl.className = "link-label";
        const labelText = document.createElement("span");
        labelText.textContent = link.label;
        labelEl.appendChild(labelText);
        titleRow.appendChild(labelEl);
      }

      const urlSpan = document.createElement("div");
      urlSpan.className = "link-url";
      urlSpan.textContent = link.url;
      urlSpan.title = link.url;

      info.appendChild(titleRow);
      info.appendChild(urlSpan);

      const actions = document.createElement("div");
      actions.className = "link-actions";

      const openBtn = document.createElement("button");
      openBtn.className = "btn btn-open";
      openBtn.textContent = "Open";
      openBtn.setAttribute("aria-label", `Open ${link.title}`);
      openBtn.addEventListener("click", () => {
        window.open(link.url, "_blank", "noopener,noreferrer");
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-delete";
      deleteBtn.textContent = "Delete";
      deleteBtn.setAttribute("aria-label", `Delete ${link.title}`);
      deleteBtn.addEventListener("click", () => deleteLink(link.id));

      actions.appendChild(openBtn);
      actions.appendChild(deleteBtn);

      li.appendChild(favicon);
      li.appendChild(info);
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

  /* ── Form handling ───────────────────────────────────────── */

  const form = document.getElementById("add-form");
  const urlInput = document.getElementById("url-input");
  const titleInput = document.getElementById("title-input");
  const labelInput = document.getElementById("label-input");
  const formError = document.getElementById("form-error");

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

  /* ── Auto-fill current tab URL ───────────────────────────── */

  const addCurrentBtn = document.getElementById("add-current-btn");

  if (addCurrentBtn) {
    addCurrentBtn.addEventListener("click", async () => {
      formError.textContent = "";
      try {
        // Check if Chrome extension API is available
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
          // Fallback for non-extension context (e.g., testing in browser)
          formError.textContent = "Extension API not available.";
        }
      } catch (err) {
        formError.textContent = "Failed to get current tab URL.";
        console.error(err);
      }
    });
  }

  /* ── Init ────────────────────────────────────────────────── */
  renderLinks();
})();
