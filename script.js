
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // DIVI-64 // BLACKLIST MAINFRAME
  // Interface controller
  // ==========================================

  const $ = (id) => document.getElementById(id);

  const CONFIG = {
    storage: "D64_BLACKLIST_MAINFRAME_V1",
    session: "D64_BLACKLIST_SESSION_V1",
    credentials: {
      COS: "201322",
      CO: "CO-19315"
    }
  };

  const CATEGORIES = [
    "SECURITY BREACH",
    "MISCONDUCT",
    "UNAUTHORIZED ACCESS",
    "SABOTAGE",
    "ESPIONAGE",
    "OTHER"
  ];

  let currentUser = null;
  let selectedRecordId = null;

  function makeId() {
    const year = new Date().getFullYear();
    const records = state.records.filter(r => r.year === year);
    return `D64-BL-${year}-${String(records.length + 1).padStart(4, "0")}`;
  }

  function createDefaultState() {
    return {
      version: 1,
      records: [],
      appeals: [],
      audit: [],
      archives: [],
      proposals: [],
      settings: {
        systemName: "DIVI-64 // BLACKLIST MAINFRAME",
        publicationRequiresReview: true
      }
    };
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(CONFIG.storage);
      if (!saved) return createDefaultState();

      const parsed = JSON.parse(saved);
      return {
        ...createDefaultState(),
        ...parsed,
        records: Array.isArray(parsed.records) ? parsed.records : [],
        appeals: Array.isArray(parsed.appeals) ? parsed.appeals : [],
        audit: Array.isArray(parsed.audit) ? parsed.audit : [],
        archives: Array.isArray(parsed.archives) ? parsed.archives : [],
        proposals: Array.isArray(parsed.proposals) ? parsed.proposals : []
      };
    } catch (error) {
      console.error("MAINFRAME STORAGE ERROR:", error);
      return createDefaultState();
    }
  }

  let state = loadState();

  function saveState() {
    try {
      localStorage.setItem(CONFIG.storage, JSON.stringify(state));
      return true;
    } catch (error) {
      console.error("Unable to save MAINFRAME data:", error);
      alert("STORAGE ERROR // Could not save data on this device.");
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function logEvent(action, details = "") {
    state.audit.unshift({
      id: "AUD-" + Date.now(),
      timestamp: new Date().toISOString(),
      user: currentUser || "SYSTEM",
      action,
      details
    });

    state.audit = state.audit.slice(0, 1000);
    saveState();
    renderAudit();
  }

  // ==========================================
  // LOGIN
  // ==========================================

  function showLoginError(message) {
    const target = $("login-error") || $("loginStatus");
    if (target) target.textContent = message;
  }

  function login(event) {
    if (event) event.preventDefault();

    const usernameField = $("username");
    const passwordField = $("password");

    if (!usernameField || !passwordField) {
      showLoginError("SYSTEM ERROR // Login fields not found.");
      console.error("Login requires #username and #password.");
      return;
    }

    const username = usernameField.value.trim().toUpperCase();
    const password = passwordField.value;

    if (
      !Object.prototype.hasOwnProperty.call(
        CONFIG.credentials,
        username
      ) ||
      CONFIG.credentials[username] !== password
    ) {
      showLoginError("ACCESS DENIED // INVALID CREDENTIALS");
      passwordField.value = "";
      return;
    }

    currentUser = username;

    sessionStorage.setItem(
      CONFIG.session,
      JSON.stringify({ username })
    );

    showLoginError("");
    usernameField.value = "";
    passwordField.value = "";

    const loginScreen = $("login-screen");
    const app = $("app");

    if (loginScreen) loginScreen.classList.add("hidden");
    if (app) app.classList.remove("hidden");

    const headerUser = $("header-user");
    const headerClearance = $("header-clearance");

    if (headerUser) headerUser.textContent = username;
    if (headerClearance) {
      headerClearance.textContent =
        username === "COS" ? "CL-OMNI" : "CL-5";
    }

    logEvent("LOGIN", `${username} authenticated locally`);
    navigate("dashboard");
    renderAll();
  }

  function logout() {
    if (currentUser) {
      logEvent("LOGOUT", `${currentUser} ended the session`);
    }

    currentUser = null;
    sessionStorage.removeItem(CONFIG.session);

    const loginScreen = $("login-screen");
    const app = $("app");

    if (loginScreen) loginScreen.classList.remove("hidden");
    if (app) app.classList.add("hidden");

    showLoginError("");
  }

  const loginForm = $("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", login);
  }

  const logoutButton = $("logout-button");
  if (logoutButton) {
    logoutButton.addEventListener("click", logout);
  }

  // ==========================================
  // NAVIGATION
  // ==========================================

  function navigate(page) {
    const allowedPages = [
      "dashboard",
      "registry",
      "cipher",
      "audit",
      "archives",
      "admin",
      "appeals"
    ];

    if (!allowedPages.includes(page)) return;

    allowedPages.forEach(name => {
      const section = $("page-" + name);
      if (section) section.classList.toggle("hidden", name !== page);
    });

    document.querySelectorAll("[data-page]").forEach(button => {
      const active = button.dataset.page === page;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });

    if (page === "dashboard") renderDashboard();
    if (page === "registry") renderRegistry();
    if (page === "appeals") renderAppeals();
    if (page === "audit") renderAudit();
    if (page === "archives") renderArchives();
    if (page === "admin") renderAdmin();
  }

  document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      navigate(button.dataset.page);
    });
  });

  // ==========================================
  // DASHBOARD
  // ==========================================

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = String(value);
  }

  function renderDashboard() {
    setText("total-records", state.records.length);
    setText("total-appeals", state.appeals.length);
    setText("total-audit", state.audit.length);
    setText(
      "active-records",
      state.records.filter(r => r.status === "PUBLISHED").length
    );

    const dashboard = $("page-dashboard");
    if (!dashboard) return;

    const recent = [...state.records]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);

    const container =
      $("recent-records") ||
      dashboard.querySelector("[data-recent-records]");

    if (container) {
      container.innerHTML = recent.length
        ? recent.map(record => `
          <article class="record-row">
            <strong>${escapeHTML(record.id)}</strong>
            <span>${escapeHTML(record.subject)}</span>
            <span>${escapeHTML(record.status)}</span>
          </article>
        `).join("")
        : "<p>NO RECORDS // Registry is currently empty.</p>";
    }
  }

  // ==========================================
  // REGISTRY
  // ==========================================

  function renderRegistry() {
    const container =
      $("records-list") ||
      $("registry-list") ||
      $("record-list");

    if (!container) return;

    if (!state.records.length) {
      container.innerHTML = "<p>NO RECORDS FOUND.</p>";
      return;
    }

    container.innerHTML = state.records.map(record => `
      <article class="record-card">
        <div>
          <strong>${escapeHTML(record.id)}</strong>
          <span>${escapeHTML(record.status)}</span>
        </div>
        <h3>${escapeHTML(record.subject)}</h3>
        <p>${escapeHTML(record.category)}</p>
        <p>${escapeHTML(record.reason)}</p>
        <small>
          Created: ${escapeHTML(
            new Date(record.createdAt).toLocaleString()
          )}
          · Author: ${escapeHTML(record.author)}
        </small>
        <div class="record-actions">
          <button type="button" data-view-record="${escapeHTML(record.id)}">
            VIEW
          </button>
          ${
            currentUser === "COS"
              ? `<button type="button" data-delete-record="${escapeHTML(record.id)}">DELETE</button>`
              : ""
          }
          ${
            currentUser === "COS" && record.status !== "PUBLISHED"
              ? `<button type="button" data-publish-record="${escapeHTML(record.id)}">PUBLISH</button>`
              : ""
          }
        </div>
      </article>
    `).join("");

    container.querySelectorAll("[data-view-record]").forEach(button => {
      button.addEventListener("click", () => {
        selectedRecordId = button.dataset.viewRecord;
        showRecordDetail(selectedRecordId);
      });
    });

    container.querySelectorAll("[data-delete-record]").forEach(button => {
      button.addEventListener("click", () => {
        deleteRecord(button.dataset.deleteRecord);
      });
    });

    container.querySelectorAll("[data-publish-record]").forEach(button => {
      button.addEventListener("click", () => {
        publishRecord(button.dataset.publishRecord);
      });
    });
  }

  function showRecordDetail(id) {
    const record = state.records.find(item => item.id === id);
    if (!record) return;

    const detail = $("record-detail");
    if (detail) {
      detail.innerHTML = `
        <h3>${escapeHTML(record.id)}</h3>
        <p><strong>Subject:</strong> ${escapeHTML(record.subject)}</p>
        <p><strong>Category:</strong> ${escapeHTML(record.category)}</p>
        <p><strong>Status:</strong> ${escapeHTML(record.status)}</p>
        <p><strong>Reason:</strong> ${escapeHTML(record.reason)}</p>
        <p><strong>Evidence:</strong> ${escapeHTML(record.evidence || "N/A")}</p>
        <p><strong>Justification:</strong> ${escapeHTML(record.justification || "N/A")}</p>
      `;
    } else {
      alert(
        `${record.id}\n${record.subject}\n${record.category}\n\n${record.reason}`
      );
    }
  }

  function createRecord(event) {
    event.preventDefault();

    const form = $("record-form");
    if (!form) return;

    const data = new FormData(form);
    const get = name => String(data.get(name) || "").trim();

    const subject = get("subject");
    const category = get("category");
    const reason = get("reason");

    if (!subject || !category || !reason) {
      alert("RECORD ERROR // Complete all required fields.");
      return;
    }

    const year = new Date().getFullYear();

    const record = {
      id: makeId(),
      year,
      subject,
      category,
      reason,
      evidence: get("evidence"),
      justification: get("justification"),
      status: currentUser === "COS" ? "PUBLISHED" : "PENDING REVIEW",
      author: currentUser,
      createdAt: new Date().toISOString()
    };

    state.records.unshift(record);
    saveState();
    logEvent("RECORD CREATED", record.id);
    form.reset();

    renderAll();
    navigate("registry");
  }

  function deleteRecord(id) {
    if (currentUser !== "COS") {
      alert("ACCESS DENIED // COS authorization required.");
      return;
    }

    const record = state.records.find(item => item.id === id);
    if (!record) return;

    if (!confirm(`Delete record ${id}? This cannot be undone.`)) return;

    state.records = state.records.filter(item => item.id !== id);
    saveState();
    logEvent("RECORD DELETED", id);
    renderAll();
  }

  function publishRecord(id) {
    if (currentUser !== "COS") {
      alert("ACCESS DENIED // COS authorization required.");
      return;
    }

    const record = state.records.find(item => item.id === id);
    if (!record) return;

    record.status = "PUBLISHED";
    record.publishedAt = new Date().toISOString();

    saveState();
    logEvent("RECORD PUBLISHED", id);
    renderAll();
  }

  const recordForm = $("record-form");
  if (recordForm) {
    recordForm.addEventListener("submit", createRecord);
  }

  // ==========================================
  // APPEALS / REVIEW
  // ==========================================

  function renderAppeals() {
    const container =
      $("appeals-list") ||
      $("reviews-list") ||
      $("appeal-list");

    if (!container) return;

    container.innerHTML = state.appeals.length
      ? state.appeals.map(appeal => `
        <article class="appeal-card">
          <strong>${escapeHTML(appeal.id)}</strong>
          <p>Record: ${escapeHTML(appeal.recordId)}</p>
          <p>${escapeHTML(appeal.message)}</p>
          <p>Status: ${escapeHTML(appeal.status)}</p>
          <small>${escapeHTML(appeal.createdAt)}</small>
          ${
            currentUser === "COS"
              ? `<button type="button" data-review-appeal="${escapeHTML(appeal.id)}">MARK REVIEWED</button>`
              : ""
          }
        </article>
      `).join("")
      : "<p>NO APPEALS SUBMITTED.</p>";

    container.querySelectorAll("[data-review-appeal]").forEach(button => {
      button.addEventListener("click", () => {
        const appeal = state.appeals.find(
          item => item.id === button.dataset.reviewAppeal
        );
        if (!appeal || currentUser !== "COS") return;

        appeal.status = "REVIEWED";
        appeal.reviewedBy = currentUser;
        appeal.reviewedAt = new Date().toISOString();

        saveState();
        logEvent("APPEAL REVIEWED", appeal.id);
        renderAppeals();
      });
    });
  }

  function submitAppeal(event) {
    event.preventDefault();

    const form = $("appeal-form");
    if (!form) return;

    const data = new FormData(form);
    const recordId = String(data.get("record-id") || "").trim();
    const message = String(data.get("message") || "").trim();

    if (!recordId || !message) {
      alert("APPEAL ERROR // Complete the record ID and message.");
      return;
    }

    state.appeals.unshift({
      id: "APL-" + Date.now(),
      recordId,
      message,
      status: "PENDING",
      submittedBy: currentUser,
      createdAt: new Date().toISOString()
    });

    saveState();
    logEvent("APPEAL SUBMITTED", recordId);
    form.reset();
    renderAppeals();
  }

  const appealForm = $("appeal-form");
  if (appealForm) {
    appealForm.addEventListener("submit", submitAppeal);
  }

  // ==========================================
  // AUDIT LOG
  // ==========================================

  function renderAudit() {
    const container = $("audit-list") || $("audit-log");
    if (!container) return;

    container.innerHTML = state.audit.length
      ? state.audit.map(entry => `
        <article class="audit-row">
          <strong>${escapeHTML(entry.action)}</strong>
          <span>${escapeHTML(entry.user)}</span>
          <p>${escapeHTML(entry.details)}</p>
          <small>${escapeHTML(entry.timestamp)}</small>
        </article>
      `).join("")
      : "<p>NO AUDIT EVENTS.</p>";
  }

  // ==========================================
  // ARCHIVES
  // ==========================================

  function renderArchives() {
    const container = $("archives-list") || $("archive-list");
    if (!container) return;

    container.innerHTML = state.archives.length
      ? state.archives.map(archive => `
        <article class="archive-row">
          <strong>${escapeHTML(archive.name)}</strong>
          <p>${escapeHTML(archive.createdAt)}</p>
          <p>${escapeHTML(archive.description || "")}</p>
          <button type="button" data-restore-archive="${escapeHTML(archive.id)}">
            RESTORE
          </button>
        </article>
      `).join("")
      : "<p>NO ARCHIVES CREATED.</p>";

    container.querySelectorAll("[data-restore-archive]").forEach(button => {
      button.addEventListener("click", () => {
        if (currentUser !== "COS") {
          alert("ACCESS DENIED // COS authorization required.");
          return;
        }

        const archive = state.archives.find(
          item => item.id === button.dataset.restoreArchive
        );
        if (!archive) return;

        if (!confirm("Restore this archive? Current records may be replaced.")) {
          return;
        }

        state.records = JSON.parse(JSON.stringify(archive.records || []));
        saveState();
        logEvent("ARCHIVE RESTORED", archive.name);
        renderAll();
      });
    });
  }

  function createArchive() {
    if (currentUser !== "COS") {
      alert("ACCESS DENIED // COS authorization required.");
      return;
    }

    const name = prompt("Enter archive name:");
    if (!name || !name.trim()) return;

    state.archives.unshift({
      id: "ARC-" + Date.now(),
      name: name.trim(),
      description: "Registry snapshot",
      createdAt: new Date().toISOString(),
      records: JSON.parse(JSON.stringify(state.records))
    });

    saveState();
    logEvent("ARCHIVE CREATED", name.trim());
    renderArchives();
  }

  const archiveButton = $("create-archive-button");
  if (archiveButton) {
    archiveButton.addEventListener("click", createArchive);
  }

  // ==========================================
  // CIPHER / ENCODER / DECODER
  // ==========================================

  function encodeText() {
    const input = $("cipher-input");
    const output = $("cipher-output");
    const mode = $("cipher-mode");

    if (!input || !output) return;

    const text = input.value;
    const type = mode ? mode.value : "base64";

    try {
      if (type === "hex") {
        output.value = Array.from(
          new TextEncoder().encode(text)
        ).map(byte => byte.toString(16).padStart(2, "0")).join(" ");
      } else if (type === "decimal") {
        output.value = Array.from(
          new TextEncoder().encode(text)
        ).join(" ");
      } else {
        output.value = btoa(
          Array.from(new TextEncoder().encode(text))
            .map(byte => String.fromCharCode(byte))
            .join("")
        );
      }

      logEvent("TEXT ENCODED", `Mode: ${type}`);
    } catch (error) {
      output.value = "ENCODING ERROR";
      console.error(error);
    }
  }

  function decodeText() {
    const input = $("cipher-input");
    const output = $("cipher-output");
    const mode = $("cipher-mode");

    if (!input || !output) return;

    const text = input.value.trim();
    const type = mode ? mode.value : "base64";

    try {
      let bytes;

      if (type === "hex") {
        const cleaned = text.replace(/\s+/g, "");
        if (cleaned.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(cleaned)) {
          throw new Error("Invalid hexadecimal input");
        }

        bytes = new Uint8Array(
          cleaned.match(/.{2}/g)?.map(pair => parseInt(pair, 16)) || []
        );
      } else if (type === "decimal") {
        const values = text.split(/\s+/).filter(Boolean).map(Number);
        if (values.some(n => !Number.isInteger(n) || n < 0 || n > 255)) {
          throw new Error("Invalid decimal input");
        }
        bytes = new Uint8Array(values);
      } else {
        const binary = atob(text);
        bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      }

      output.value = new TextDecoder().decode(bytes);
      logEvent("TEXT DECODED", `Mode: ${type}`);
    } catch (error) {
      output.value = "DECODING ERROR // CHECK INPUT AND MODE";
    }
  }

  const encodeButton = $("encode-button");
  const decodeButton = $("decode-button");

  if (encodeButton) encodeButton.addEventListener("click", encodeText);
  if (decodeButton) decodeButton.addEventListener("click", decodeText);

  // ==========================================
  // TRANSFER / EXPORT / IMPORT
  // ==========================================

  function exportData() {
    if (currentUser !== "COS") {
      alert("ACCESS DENIED // COS authorization required.");
      return;
    }

    const payload = {
      system: "DIVI-64 // BLACKLIST MAINFRAME",
      exportedAt: new Date().toISOString(),
      records: state.records,
      appeals: state.appeals,
      archives: state.archives,
      audit: state.audit
    };

    const blob = new Blob(
      [JSON.stringify(payload, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "D64-BLACKLIST-EXPORT.json";
    link.click();
    URL.revokeObjectURL(url);

    logEvent("DATA EXPORTED", "JSON export");
  }

  function importData(event) {
    event.preventDefault();

    if (currentUser !== "COS") {
      alert("ACCESS DENIED // COS authorization required.");
      return;
    }

    const form = $("transfer-form");
    if (!form) return;

    const data = new FormData(form);
    const raw = String(
      data.get("transfer-data") ||
      data.get("data") ||
      ""
    ).trim();

    if (!raw) {
      alert("IMPORT ERROR // Paste a JSON export first.");
      return;
    }

    try {
      const imported = JSON.parse(raw);

      if (!Array.isArray(imported.records)) {
        throw new Error("Missing records array");
      }

      if (!confirm("Import records? This replaces the current registry.")) {
        return;
      }

      state.records = imported.records;
      if (Array.isArray(imported.appeals)) state.appeals = imported.appeals;
      if (Array.isArray(imported.archives)) state.archives = imported.archives;
      if (Array.isArray(imported.audit)) state.audit = imported.audit;

      saveState();
      logEvent("DATA IMPORTED", `${state.records.length} records`);
      form.reset();
      renderAll();
    } catch (error) {
      alert("IMPORT ERROR // Invalid or incompatible JSON.");
      console.error(error);
    }
  }

  const transferForm = $("transfer-form");
  if (transferForm) {
    transferForm.addEventListener("submit", importData);
  }

  const exportButton = $("export-button");
  if (exportButton) {
    exportButton.addEventListener("click", exportData);
  }

  // ==========================================
  // ADMINISTRATION
  // ==========================================

  function renderAdmin() {
    const userDisplay = $("admin-current-user");
    if (userDisplay) userDisplay.textContent = currentUser || "NONE";

    const overridePanel = $("override-panel");
    if (overridePanel) {
      overridePanel.classList.toggle("hidden", currentUser !== "COS");
    }

    document.querySelectorAll("[data-cos-only]").forEach(element => {
      element.classList.toggle("hidden", currentUser !== "COS");
    });
  }

  const overrideForm = $("override-form");
  if (overrideForm) {
    overrideForm.addEventListener("submit", event => {
      event.preventDefault();

      if (currentUser !== "COS") {
        alert("ACCESS DENIED // COS ONLY.");
        return;
      }

      const data = new FormData(overrideForm);
      const reason = String(data.get("reason") || "").trim();

      if (!reason) {
        alert("OVERRIDE DENIED // A reason is required.");
        return;
      }

      logEvent("COS OVERRIDE", reason);
      alert("OVERRIDE LOGGED LOCALLY.");
      overrideForm.reset();
    });
  }

  // ==========================================
  // RENDER
  // ==========================================

  function renderAll() {
    renderDashboard();
    renderRegistry();
    renderAppeals();
    renderAudit();
    renderArchives();
    renderAdmin();
  }

  // ==========================================
  // RESTORE SESSION / INITIAL STATE
  // ==========================================

  try {
    const savedSession = sessionStorage.getItem(CONFIG.session);

    if (savedSession) {
      const parsed = JSON.parse(savedSession);
      const username = parsed.username;

      if (
        username &&
        Object.prototype.hasOwnProperty.call(
          CONFIG.credentials,
          username
        )
      ) {
        currentUser = username;

        if ($("login-screen")) {
          $("login-screen").classList.add("hidden");
        }
        if ($("app")) {
          $("app").classList.remove("hidden");
        }

        setText("header-user", username);
        setText(
          "header-clearance",
          username === "COS" ? "CL-OMNI" : "CL-5"
        );

        navigate("dashboard");
        renderAll();
      }
    }
  } catch (error) {
    sessionStorage.removeItem(CONFIG.session);
    console.error("SESSION RESTORE ERROR:", error);
  }

  if (!currentUser) {
    if ($("login-screen")) $("login-screen").classList.remove("hidden");
    if ($("app")) $("app").classList.add("hidden");
  }

  console.log("DIVI-64 BLACKLIST MAINFRAME // SCRIPT LOADED");
});
