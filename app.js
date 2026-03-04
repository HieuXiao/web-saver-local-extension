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

  function renderLinks() {
    const links = loadLinks();
    linksList.innerHTML = "";
    emptyMessage.style.display = links.length === 0 ? "block" : "none";

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

      const title = document.createElement("div");
      title.className = "link-title";
      title.textContent = link.title;

      const urlSpan = document.createElement("div");
      urlSpan.className = "link-url";
      urlSpan.textContent = link.url;

      info.appendChild(title);
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

  function addLink(url, customTitle) {
    const links = loadLinks();
    const entry = {
      id: crypto.randomUUID(),
      url,
      title: customTitle.trim() || deriveTitle(url),
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

    addLink(normalizedUrl, titleInput.value);
    urlInput.value = "";
    titleInput.value = "";
    urlInput.focus();
  });

  /* ── Init ────────────────────────────────────────────────── */
  renderLinks();
})();
