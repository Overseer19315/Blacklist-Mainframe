
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // =====================================================
  // DIVI-64 // BLACKLIST MAINFRAME V1.1
  // Local interface controller
  // =====================================================

  const $ = id => document.getElementById(id);

  const STORAGE_KEY = "D64_BLACKLIST_MAINFRAME_V1";
  const SESSION_KEY = "D64_BLACKLIST_SESSION_V1";

  const CREDENTIALS = Object.freeze({
    COS: "201322",
    CO: "CO-19315"
  });

  const CATEGORIES = [
    "SECURITY BREACH",
    "UNAUTHORIZED ACCESS",
    "MISCONDUCT",
    "SABOTAGE",
    "ESPIONAGE",
    "POLICY VIOLATION",
    "OTHER"
  ];

  const PAGE_INFO = {
    dashboard: {
      eyebrow: "EXECUTIVE OVERVIEW",
      title: "Command Dashboard",
      description: "Estado del registro y actividad."
    },
    registry: {
      eyebrow: "PERSONNEL CONTROL",
      title: "Blacklist Registry",
      description: "Propuestas, expedientes y estados."
    },
    cipher: {
      eyebrow: "D64-EC / EXECUTIVE COMMUNICATION",
      title: "Communication Engine",
      description: "Codificación reversible y transferencia de propuestas."
    },
    appeals: {
      eyebrow: "INDEPENDENT REVIEW",
      title: "Appeals & Review",
      description: "Solicitudes, impugnaciones y decisiones."
    },
    archives: {
      eyebrow: "RECORD PRESERVATION",
      title: "Archives",
      description: "Copias locales del registro."
    },
    audit: {
      eyebrow: "SYSTEM TRACE",
      title: "Audit Log",
      description: "Historial local de operaciones."
    },
    admin: {
      eyebrow: "EXECUTIVE SYSTEMS",
      title: "Administration",
      description: "Herramientas de administración."
    }
  };

  let currentUser = null;
  let currentPage = "dashboard";
  let registryView = "table";
  let cipherMode = "text";
  let consoleLines = [];

  // =====================================================
  // DATA STORAGE
  // =====================================================

  function emptyState() {
    return {
      version: 1,
      records: [],
      appeals: [],
      audit: [],
      archives: [],
      createdAt: new Date().toISOString()
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();

      const parsed = JSON.parse(raw);

      return {
        ...emptyState(),
        ...parsed,
        records: Array.isArray(parsed.records) ? parsed.records : [],
        appeals: Array.isArray(parsed.appeals) ? parsed.appeals : [],
        audit: Array.isArray(parsed.audit) ? parsed.audit : [],
        archives: Array.isArray(parsed.archives) ? parsed.archives : []
      };
    } catch (error) {
      console.error("Storage read error:", error);
      return emptyState();
    }
  }

  let state = loadState();

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.error("Storage write error:", error);
      alert(
        "STORAGE ERROR // No se pudieron guardar los datos. " +
        "Comprueba el almacenamiento disponible del navegador."
      );
      return false;
    }
  }

  function makeId(prefix) {
    return prefix + "-" + Date.now().toString(36).toUpperCase() +
      "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function nextRecordId() {
    const year = new Date().getFullYear();
    const number = state.records.filter(record =>
      String(record.id).startsWith("D64-BL-" + year + "-")
    ).length + 1;

    return "D64-BL-" + year + "-" + String(number).padStart(4, "0");
  }

  function isCOS() {
    return currentUser === "COS";
  }

  function canReview() {
    return isCOS();
  }

  // =====================================================
  // SAFE HTML / HELPERS
  // =====================================================

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString();
  }

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = String(value ?? "");
  }

  function setMessage(id, message, isError = false) {
    const element = $(id);
    if (!element) return;

    element.textContent = message;
    element.classList.toggle("error", isError);
  }

  function addConsole(message) {
    const timestamp = new Date().toLocaleTimeString();

    consoleLines.unshift(
      "[" + timestamp + "] " + String(message)
    );

    consoleLines = consoleLines.slice(0, 80);
    renderConsole();
  }

  function renderConsole() {
    const text = consoleLines.join("\n") ||
      "DIVI-64 LOCAL INTERFACE READY";

    setText("console-preview", text);
    setText("full-console", text);
  }

  function logEvent(action, details = "") {
    state.audit.unshift({
      id: makeId("AUD"),
      timestamp: new Date().toISOString(),
      authority: currentUser || "SYSTEM",
      action,
      details: String(details)
    });

    state.audit = state.audit.slice(0, 2000);
    saveState();

    addConsole(action + " // " + details);
    renderAudit();
    renderDashboard();
  }

  function requireCOS() {
    if (isCOS()) return true;

    alert("ACCESS DENIED // COS authorization required.");
    return false;
  }

  // =====================================================
  // LOGIN / LOGOUT
  // =====================================================

  function login(event) {
    event.preventDefault();

    const username = $("username")?.value.trim().toUpperCase();
    const password = $("password")?.value;

    if (
      !username ||
      !Object.prototype.hasOwnProperty.call(CREDENTIALS, username) ||
      CREDENTIALS[username] !== password
    ) {
      setMessage("login-error", "ACCESS DENIED // INVALID CREDENTIALS", true);

      if ($("password")) $("password").value = "";
      return;
    }

    currentUser = username;

    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ username })
      );
    } catch (error) {
      console.warn("Session storage unavailable:", error);
    }

    if ($("password")) $("password").value = "";

    setMessage("login-error", "");
    $("login-screen")?.classList.add("hidden");
    $("app")?.classList.remove("hidden");

    updateSessionDisplay();
    logEvent("LOGIN", username + " opened the local interface");

    navigate("dashboard");
    renderAll();
  }

  function logout() {
    if (currentUser) {
      logEvent("LOGOUT", currentUser + " closed the interface");
    }

    currentUser = null;

    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (error) {
      console.warn(error);
    }

    $("app")?.classList.add("hidden");
    $("login-screen")?.classList.remove("hidden");

    setMessage("login-error", "");
    if ($("username")) $("username").value = "";
    if ($("password")) $("password").value = "";
  }

  function restoreSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;

      const session = JSON.parse(raw);
      const username = session.username;

      if (Object.prototype.hasOwnProperty.call(CREDENTIALS, username)) {
        currentUser = username;
        $("login-screen")?.classList.add("hidden");
        $("app")?.classList.remove("hidden");

        updateSessionDisplay();
        navigate("dashboard");
        renderAll();
        addConsole("SESSION RESTORED // " + username);
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch (error) {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }

  function updateSessionDisplay() {
    setText("session-authority", currentUser || "NONE");
    setText(
      "session-clearance",
      currentUser === "COS" ? "CL-OMNI · LOCAL" : "CL-5 · LOCAL"
    );
  }

  $("login-form")?.addEventListener("submit", login);
  $("logout-button")?.addEventListener("click", event => {
    event.preventDefault();
    logout();
  });

  // =====================================================
  // NAVIGATION
  // =====================================================

  function navigate(pageName) {
    if (!PAGE_INFO[pageName]) return;

    currentPage = pageName;

    document.querySelectorAll(".page").forEach(page => {
      page.classList.toggle("hidden", page.id !== "page-" + pageName);
    });

    document.querySelectorAll("[data-page]").forEach(button => {
      const active = button.dataset.page === pageName;
      button.classList.toggle("active", active);

      if (button.tagName === "BUTTON") {
        button.setAttribute("aria-current", active ? "page" : "false");
      }
    });

    const info = PAGE_INFO[pageName];

    setText("page-eyebrow", info.eyebrow);
    setText("page-title", info.title);
    setText("page-description", info.description);

    if (pageName === "dashboard") renderDashboard();
    if (pageName === "registry") renderRegistry();
    if (pageName === "cipher") renderCipherMode();
    if (pageName === "appeals") renderAppeals();
    if (pageName === "archives") renderArchives();
    if (pageName === "audit") renderAudit();
    if (pageName === "admin") renderAdmin();
  }

  document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      navigate(button.dataset.page);
    });
  });

  // =====================================================
  // DATE / CATEGORY SELECTS
  // =====================================================

  function populateCategories() {
    ["record-category", "transfer-category"].forEach(id => {
      const select = $(id);
      if (!select) return;

      select.innerHTML = "";

      CATEGORIES.forEach(category => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
      });
    });
  }

  function populateReviewRecords() {
    const select = $("review-record-id");
    if (!select) return;

    const previous = select.value;
    select.innerHTML = "";

    const available = state.records.filter(record =>
      record.status !== "CLOSED" && record.status !== "ARCHIVED"
    );

    if (!available.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No records available";
      select.appendChild(option);
      return;
    }

    available.forEach(record => {
      const option = document.createElement("option");
      option.value = record.id;
      option.textContent = record.id + " — " + record.subject;
      select.appendChild(option);
    });

    if (available.some(record => record.id === previous)) {
      select.value = previous;
    }
  }

  function updateDate() {
    setText("current-date", new Date().toLocaleDateString());
  }

  // =====================================================
  // DASHBOARD
  // =====================================================

  function renderDashboard() {
    const activeCount = state.records.filter(record =>
      record.status === "ACTIVE" || record.status === "UNDER APPEAL"
    ).length;

    const pendingCount = state.records.filter(record =>
      record.status === "PENDING REVIEW"
    ).length;

    const openReviews = state.appeals.filter(appeal =>
      appeal.status === "OPEN"
    ).length;

    setText("metric-total", state.records.length);
    setText("metric-active", activeCount);
    setText("metric-pending", pendingCount);
    setText("metric-appeals", openReviews);

    const proposalContainer = $("dashboard-proposals");

    const proposals = state.records.filter(record =>
      record.status === "PENDING REVIEW"
    );

    if (proposalContainer) {
      proposalContainer.classList.toggle("empty", proposals.length === 0);

      proposalContainer.innerHTML = proposals.length
        ? proposals.slice(0, 6).map(record => `
            <div class="activity-row">
              <strong>${escapeHTML(record.id)}</strong>
              <span>${escapeHTML(record.subject)}</span>
              <small>${escapeHTML(record.category)}</small>
            </div>
          `).join("")
        : "No hay propuestas pendientes.";
    }

    const activityContainer = $("dashboard-activity");

    if (activityContainer) {
      const recent = state.audit.slice(0, 7);

      activityContainer.innerHTML = recent.length
        ? recent.map(entry => `
            <div class="activity-row">
              <strong>${escapeHTML(entry.action)}</strong>
              <span>${escapeHTML(entry.authority)}</span>
              <small>${escapeHTML(formatDate(entry.timestamp))}</small>
            </div>
          `).join("")
        : '<p class="muted">No hay actividad registrada.</p>';
    }

    renderConsole();
  }

  // =====================================================
  // REGISTRY
  // =====================================================

  function showRecordForm(show) {
    $("record-form-panel")?.classList.toggle("hidden", !show);

    if (show) {
      $("record-form")?.reset();
      setMessage("record-form-message", "");
    }
  }

  $("new-record-button")?.addEventListener("click", () => {
    showRecordForm(true);
  });

  $("cancel-record-button")?.addEventListener("click", () => {
    showRecordForm(false);
  });

  function createProposal(event) {
    event.preventDefault();

    const subject = $("record-subject").value.trim();
    const category = $("record-category").value;
    const reason = $("record-reason").value.trim();
    const evidence = $("record-evidence").value.trim();
    const justification = $("record-justification").value.trim();

    if (!subject || !category || !reason || !evidence || !justification) {
      setMessage("record-form-message", "Complete todos los campos.", true);
      return;
    }

    const record = {
      id: nextRecordId(),
      subject,
      category,
      reason,
      evidence,
      justification,
      severity: "UNASSESSED",
      status: "PENDING REVIEW",
      author: currentUser,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    state.records.unshift(record);

    if (!saveState()) return;

    logEvent("PROPOSAL SUBMITTED", record.id + " // " + subject);

    setMessage(
      "record-form-message",
      "Propuesta registrada. Pendiente de revisión."
    );

    showRecordForm(false);
    renderAll();
    navigate("registry");
  }

  $("record-form")?.addEventListener("submit", createProposal);

  function getFilteredRecords() {
    const query = ($("registry-search")?.value || "").trim().toLowerCase();
    const status = $("registry-status")?.value || "";

    return state.records.filter(record => {
      const searchable = [
        record.id,
        record.subject,
        record.category,
        record.status,
        record.reason
      ].join(" ").toLowerCase();

      return (!query || searchable.includes(query)) &&
        (!status || record.status === status);
    });
  }

  function renderRegistry() {
    const records = getFilteredRecords();

    const tableContainer = $("registry-table-container");
    const cardContainer = $("registry-card-container");

    tableContainer?.classList.toggle("hidden", registryView !== "table");
    cardContainer?.classList.toggle("hidden", registryView !== "cards");

    $("table-view-button")?.classList.toggle("active", registryView === "table");
    $("card-view-button")?.classList.toggle("active", registryView === "cards");

    const tbody = $("registry-table-body");

    if (tbody) {
      tbody.innerHTML = records.length
        ? records.map(record => `
            <tr>
              <td>${escapeHTML(record.id)}</td>
              <td>${escapeHTML(record.subject)}</td>
              <td>${escapeHTML(record.category)}</td>
              <td>${escapeHTML(record.severity || "UNASSESSED")}</td>
              <td><span class="tag">${escapeHTML(record.status)}</span></td>
              <td>${escapeHTML(new Date(record.createdAt).toLocaleDateString())}</td>
              <td>
                <button class="secondary-button" data-view-record="${escapeHTML(record.id)}">VIEW</button>
              </td>
            </tr>
          `).join("")
        : '<tr><td colspan="7">No se encontraron expedientes.</td></tr>';
    }

    if (cardContainer) {
      cardContainer.innerHTML = records.length
        ? records.map(record => `
            <article class="panel">
              <p class="eyebrow">${escapeHTML(record.id)}</p>
              <h3>${escapeHTML(record.subject)}</h3>
              <p>${escapeHTML(record.category)}</p>
              <span class="tag">${escapeHTML(record.status)}</span>
              <p>${escapeHTML(record.reason)}</p>
              <button class="secondary-button" data-view-record="${escapeHTML(record.id)}">OPEN RECORD</button>
            </article>
          `).join("")
        : '<article class="panel">No se encontraron expedientes.</article>';
    }

    document.querySelectorAll("[data-view-record]").forEach(button => {
      button.addEventListener("click", () => {
        showRecordDetail(button.dataset.viewRecord);
      });
    });

    populateReviewRecords();
  }

  $("registry-search")?.addEventListener("input", renderRegistry);
  $("registry-status")?.addEventListener("change", renderRegistry);

  $("table-view-button")?.addEventListener("click", () => {
    registryView = "table";
    renderRegistry();
  });

  $("card-view-button")?.addEventListener("click", () => {
    registryView = "cards";
    renderRegistry();
  });

  function showRecordDetail(id) {
    const record = state.records.find(item => item.id === id);
    const panel = $("record-detail");

    if (!record || !panel) return;

    panel.classList.remove("hidden");

    panel.innerHTML = `
      <div class="panel-head">
        <div>
          <p class="eyebrow">RECORD DETAIL</p>
          <h2>${escapeHTML(record.id)}</h2>
        </div>
        <button id="close-record-detail" class="secondary-button">CLOSE</button>
      </div>

      <h3>${escapeHTML(record.subject)}</h3>
      <p><strong>Category:</strong> ${escapeHTML(record.category)}</p>
      <p><strong>Status:</strong> ${escapeHTML(record.status)}</p>
      <p><strong>Severity:</strong> ${escapeHTML(record.severity || "UNASSESSED")}</p>
      <p><strong>Reason:</strong><br>${escapeHTML(record.reason)}</p>
      <p><strong>Evidence:</strong><br>${escapeHTML(record.evidence)}</p>
      <p><strong>Justification:</strong><br>${escapeHTML(record.justification)}</p>
      <p><strong>Author:</strong> ${escapeHTML(record.author)}</p>
      <p><strong>Created:</strong> ${escapeHTML(formatDate(record.createdAt))}</p>

      <div class="buttons">
        ${
          canReview() && record.status === "PENDING REVIEW"
            ? `<button class="primary-button" id="approve-record">APPROVE</button>
               <button class="danger-button" id="reject-record">REJECT</button>`
            : ""
        }
        ${
          canReview() && record.status !== "CLOSED"
            ? `<button class="secondary-button" id="close-record">CLOSE RECORD</button>`
            : ""
        }
        ${
          canReview()
            ? `<button class="danger-button" id="delete-record">DELETE RECORD</button>`
            : ""
        }
      </div>

      <p id="detail-message" class="message"></p>
    `;

    $("close-record-detail")?.addEventListener("click", () => {
      panel.classList.add("hidden");
    });

    $("approve-record")?.addEventListener("click", () => {
      changeRecordStatus(record.id, "ACTIVE", "PROPOSAL APPROVED");
    });

    $("reject-record")?.addEventListener("click", () => {
      changeRecordStatus(record.id, "CLOSED", "PROPOSAL REJECTED");
    });

    $("close-record")?.addEventListener("click", () => {
      changeRecordStatus(record.id, "CLOSED", "RECORD CLOSED");
    });

    $("delete-record")?.addEventListener("click", () => {
      if (!requireCOS()) return;

      if (!confirm("¿Eliminar definitivamente este expediente local?")) return;

      state.records = state.records.filter(item => item.id !== record.id);

      saveState();
      logEvent("RECORD DELETED", record.id);

      panel.classList.add("hidden");
      renderAll();
    });
  }

  function changeRecordStatus(id, status, action) {
    if (!requireCOS()) return;

    const record = state.records.find(item => item.id === id);
    if (!record) return;

    record.status = status;
    record.updatedAt = new Date().toISOString();

    if (!saveState()) return;

    logEvent(action, id + " // " + status);
    renderAll();
    showRecordDetail(id);
  }

  // =====================================================
  // D64-EC TEXT ENCODER / DECODER
  // =====================================================

  function utf8Bytes(text) {
    return new TextEncoder().encode(text);
  }

  function encodeValue(text, format) {
    const bytes = utf8Bytes(text);

    if (format === "decimal") {
      return Array.from(bytes)
        .map(byte => String(byte).padStart(3, "0"))
        .join(" ");
    }

    if (format === "hex") {
      return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join(" ").toUpperCase();
    }

    let binary = "";
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary);
  }

  function decodeValue(text, format) {
    let bytes;

    if (format === "decimal") {
      const parts = text.trim().split(/\s+/).filter(Boolean);

      const values = parts.map(part => {
        if (!/^\d{1,3}$/.test(part)) throw new Error("Invalid decimal");
        const value = Number(part);
        if (value < 0 || value > 255) throw new Error("Out of range");
        return value;
      });

      bytes = new Uint8Array(values);
    } else if (format === "hex") {
      const cleaned = text.replace(/\s+/g, "");

      if (cleaned.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(cleaned)) {
        throw new Error("Invalid hex");
      }

      const values = cleaned.match(/.{2}/g) || [];
      bytes = new Uint8Array(values.map(pair => parseInt(pair, 16)));
    } else {
      const binary = atob(text.trim());
      bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    }

    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }

  function encodeText() {
    const input = $("cipher-input");
    const output = $("cipher-output");
    const format = $("cipher-format")?.value || "decimal";

    if (!input || !output) return;

    try {
      output.value = encodeValue(input.value, format);
      setMessage("cipher-message", "ENCODING COMPLETE");
      logEvent("D64-EC ENCODE", format);
    } catch (error) {
      setMessage("cipher-message", "ENCODING ERROR", true);
    }
  }

  function decodeText() {
    const input = $("cipher-input");
    const output = $("cipher-output");
    const format = $("cipher-format")?.value || "decimal";

    if (!input || !output) return;

    try {
      output.value = decodeValue(input.value, format);
      setMessage("cipher-message", "DECODING COMPLETE");
      logEvent("D64-EC DECODE", format);
    } catch (error) {
      setMessage(
        "cipher-message",
        "DECODING ERROR // Revisa el formato y la secuencia.",
        true
      );
    }
  }

  $("encode-button")?.addEventListener("click", event => {
    event.preventDefault();
    encodeText();
  });

  $("decode-button")?.addEventListener("click", event => {
    event.preventDefault();
    decodeText();
  });

  $("cipher-clear-button")?.addEventListener("click", () => {
    if ($("cipher-input")) $("cipher-input").value = "";
    if ($("cipher-output")) $("cipher-output").value = "";
    setMessage("cipher-message", "");
  });

  $("cipher-copy-button")?.addEventListener("click", async () => {
    const text = $("cipher-output")?.value || "";
    if (!text) return setMessage("cipher-message", "No hay salida que copiar.");

    try {
      await navigator.clipboard.writeText(text);
      setMessage("cipher-message", "OUTPUT COPIED");
    } catch {
      $("cipher-output").focus();
      $("cipher-output").select();
      setMessage("cipher-message", "Selecciona y copia el texto manualmente.");
    }
  });

  function renderCipherMode() {
    $("cipher-text-mode")?.classList.toggle("hidden", cipherMode !== "text");
    $("cipher-proposal-mode")?.classList.toggle("hidden", cipherMode !== "proposal");

    document.querySelectorAll("[data-cipher-mode]").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.cipherMode === cipherMode
      );
    });
  }

  document.querySelectorAll("[data-cipher-mode]").forEach(button => {
    button.addEventListener("click", () => {
      cipherMode = button.dataset.cipherMode;
      renderCipherMode();
    });
  });

  // =====================================================
  // PROPOSAL TRANSFER BLOCK
  // =====================================================

  function readTransferForm() {
    return {
      recordId: $("transfer-record-id").value.trim(),
      category: $("transfer-category").value,
      subject: $("transfer-subject").value.trim(),
      reason: $("transfer-reason").value.trim(),
      evidence: $("transfer-evidence").value.trim(),
      justification: $("transfer-justification").value.trim()
    };
  }

  $("transfer-form")?.addEventListener("submit", event => {
    event.preventDefault();

    const data = readTransferForm();

    if (!data.category || !data.subject || !data.reason ||
        !data.evidence || !data.justification) {
      setMessage("transfer-message", "Completa todos los campos.", true);
      return;
    }

    const payload = {
      format: "D64-BL-TRANSFER",
      version: 1,
      createdAt: new Date().toISOString(),
      origin: currentUser,
      record: data
    };

    $("transfer-output").value = JSON.stringify(payload, null, 2);
    setMessage("transfer-message", "TRANSFER BLOCK GENERATED");
    logEvent("TRANSFER BLOCK GENERATED", data.subject);
  });

  $("transfer-copy-button")?.addEventListener("click", async () => {
    const output = $("transfer-output");
    if (!output?.value) {
      setMessage("transfer-message", "No hay bloque que copiar.");
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setMessage("transfer-message", "TRANSFER BLOCK COPIED");
    } catch {
      output.focus();
      output.select();
      setMessage("transfer-message", "Selecciona y copia el bloque manualmente.");
    }
  });

  $("import-transfer-button")?.addEventListener("click", () => {
    let payload;

    try {
      payload = JSON.parse($("transfer-import-input").value);
    } catch {
      setMessage("transfer-message", "IMPORT ERROR // JSON inválido.", true);
      return;
    }

    if (
      payload.format !== "D64-BL-TRANSFER" ||
      !payload.record ||
      !payload.record.subject ||
      !payload.record.category ||
      !payload.record.reason
    ) {
      setMessage("transfer-message", "IMPORT ERROR // Formato no reconocido.", true);
      return;
    }

    const data = payload.record;

    if (!confirm("¿Importar la propuesta como pendiente de revisión?")) return;

    const record = {
      id: nextRecordId(),
      subject: String(data.subject),
      category: String(data.category),
      reason: String(data.reason),
      evidence: String(data.evidence || ""),
      justification: String(data.justification || ""),
      severity: "UNASSESSED",
      status: "PENDING REVIEW",
      author: currentUser,
      importedFrom: String(payload.origin || "UNKNOWN"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    state.records.unshift(record);

    if (!saveState()) return;

    logEvent("TRANSFER IMPORTED", record.id);
    setMessage("transfer-message", "IMPORTED // " + record.id);
    renderAll();
  });

  // =====================================================
  // APPEALS / REVIEWS
  // =====================================================

  function showReviewForm(show) {
    $("review-form-panel")?.classList.toggle("hidden", !show);
    if (show) {
      $("review-form")?.reset();
      populateReviewRecords();
      setMessage("review-form-message", "");
    }
  }

  $("new-review-button")?.addEventListener("click", () => {
    showReviewForm(true);
  });

  $("cancel-review-button")?.addEventListener("click", () => {
    showReviewForm(false);
  });

  $("review-form")?.addEventListener("submit", event => {
    event.preventDefault();

    const recordId = $("review-record-id").value;
    const type = $("review-type").value;
    const reason = $("review-reason").value.trim();
    const evidence = $("review-evidence").value.trim();

    if (!recordId || reason.length < 8) {
      setMessage("review-form-message", "Selecciona un expediente y explica la solicitud.", true);
      return;
    }

    const record = state.records.find(item => item.id === recordId);

    if (!record) {
      setMessage("review-form-message", "Expediente no encontrado.", true);
      return;
    }

    const appeal = {
      id: makeId("REV"),
      recordId,
      type,
      reason,
      evidence,
      status: "OPEN",
      submittedBy: currentUser,
      createdAt: new Date().toISOString(),
      decision: "",
      decidedBy: null,
      decidedAt: null
    };

    state.appeals.unshift(appeal);
    record.status = "UNDER APPEAL";
    record.updatedAt = new Date().toISOString();

    if (!saveState()) return;

    logEvent("REVIEW SUBMITTED", appeal.id + " // " + recordId);
    showReviewForm(false);
    renderAll();
  });

  function renderAppeals() {
    const container = $("appeals-list");
    if (!container) return;

    const query = $("audit-search")?.value?.trim().toLowerCase() || "";

    const appeals = state.appeals.filter(appeal => {
      const text = [
        appeal.id,
        appeal.recordId,
        appeal.type,
        appeal.reason,
        appeal.status,
        appeal.submittedBy
      ].join(" ").toLowerCase();

      return !query || text.includes(query);
    });

    setText("review-count", appeals.length + " REQUESTS");
    container.classList.toggle("empty", appeals.length === 0);

    container.innerHTML = appeals.length
      ? appeals.map(appeal => `
          <article class="panel">
            <p class="eyebrow">${escapeHTML(appeal.type)} // ${escapeHTML(appeal.id)}</p>
            <h3>${escapeHTML(appeal.recordId)}</h3>
            <span class="tag">${escapeHTML(appeal.status)}</span>
            <p>${escapeHTML(appeal.reason)}</p>
            ${appeal.evidence ? `<p><strong>Additional information:</strong><br>${escapeHTML(appeal.evidence)}</p>` : ""}
            <small>Submitted by ${escapeHTML(appeal.submittedBy)} · ${escapeHTML(formatDate(appeal.createdAt))}</small>
            ${
              appeal.status === "OPEN" && canReview()
                ? `<div class="buttons">
                     <button class="primary-button" data-decide-appeal="${escapeHTML(appeal.id)}" data-decision="UPHELD">UPHOLD RECORD</button>
                     <button class="secondary-button" data-decide-appeal="${escapeHTML(appeal.id)}" data-decision="REVERSED">REVERSE RECORD</button>
                   </div>`
                : ""
            }
            ${
              appeal.status !== "OPEN"
                ? `<p><strong>Decision:</strong> ${escapeHTML(appeal.decision || appeal.status)}</p>
                   <small>Reviewed by ${escapeHTML(appeal.decidedBy || "—")}</small>`
                : ""
            }
          </article>
        `).join("")
      : "<p>No hay solicitudes de revisión.</p>";

    container.querySelectorAll("[data-decide-appeal]").forEach(button => {
      button.addEventListener("click", () => {
        decideAppeal(button.dataset.decideAppeal, button.dataset.decision);
      });
    });

    populateReviewRecords();
  }

  function decideAppeal(id, decision) {
    if (!requireCOS()) return;

    const appeal = state.appeals.find(item => item.id === id);
    if (!appeal || appeal.status !== "OPEN") return;

    const record = state.records.find(item => item.id === appeal.recordId);

    const explanation = prompt(
      "Introduce la justificación de la decisión:"
    );

    if (!explanation || !explanation.trim()) return;

    appeal.status = "CLOSED";
    appeal.decision = decision;
    appeal.decisionReason = explanation.trim();
    appeal.decidedBy = currentUser;
    appeal.decidedAt = new Date().toISOString();

    if (record) {
      record.status = decision === "REVERSED"
        ? "CLOSED"
        : "REVIEW RESOLVED";

      record.updatedAt = new Date().toISOString();
    }

    if (!saveState()) return;

    logEvent("REVIEW DECIDED", id + " // " + decision);
    renderAll();
  }

  $("audit-search")?.addEventListener("input", () => {
    if (currentPage === "appeals") renderAppeals();
  });

  // =====================================================
  // AUDIT
  // =====================================================

  function renderAudit() {
    const container = $("audit-list");
    if (!container) return;

    const query = ($("audit-search")?.value || "").trim().toLowerCase();

    const entries = state.audit.filter(entry => {
      const text = [
        entry.id,
        entry.authority,
        entry.action,
        entry.details,
        entry.timestamp
      ].join(" ").toLowerCase();

      return !query || text.includes(query);
    });

    container.innerHTML = entries.length
      ? entries.map(entry => `
          <article class="activity-row">
            <strong>${escapeHTML(entry.action)}</strong>
            <span>${escapeHTML(entry.authority)}</span>
            <p>${escapeHTML(entry.details)}</p>
            <small>${escapeHTML(formatDate(entry.timestamp))}</small>
          </article>
        `).join("")
      : '<p class="muted">No hay eventos que coincidan.</p>';

    renderConsole();
  }

  $("audit-search")?.addEventListener("input", renderAudit);

  $("console-clear-button")?.addEventListener("click", () => {
    addConsole("CONSOLE REFRESHED");
    renderAudit();
  });

  // =====================================================
  // ARCHIVES
  // =====================================================

  function renderArchives() {
    const container = $("archives-list");
    if (!container) return;

    const query = ($("archives-search")?.value || "").trim().toLowerCase();

    const archives = state.archives.filter(archive =>
      [archive.id, archive.name, archive.createdAt]
        .join(" ").toLowerCase().includes(query)
    );

    container.innerHTML = archives.length
      ? archives.map(archive => `
          <article class="panel">
            <p class="eyebrow">${escapeHTML(archive.id)}</p>
            <h3>${escapeHTML(archive.name)}</h3>
            <p>${escapeHTML(formatDate(archive.createdAt))}</p>
            <p>${escapeHTML((archive.records || []).length)} records in snapshot</p>
            <div class="buttons">
              <button class="secondary-button" data-download-archive="${escapeHTML(archive.id)}">EXPORT</button>
              ${isCOS() ? `<button class="primary-button" data-restore-archive="${escapeHTML(archive.id)}">RESTORE</button>` : ""}
              ${isCOS() ? `<button class="danger-button" data-delete-archive="${escapeHTML(archive.id)}">DELETE</button>` : ""}
            </div>
          </article>
        `).join("")
      : '<p class="muted">No hay archivos guardados.</p>';

    container.querySelectorAll("[data-download-archive]").forEach(button => {
      button.addEventListener("click", () => {
        const archive = state.archives.find(item => item.id === button.dataset.downloadArchive);
        if (archive) downloadJSON(archive, archive.id + ".json");
      });
    });

    container.querySelectorAll("[data-restore-archive]").forEach(button => {
      button.addEventListener("click", () => restoreArchive(button.dataset.restoreArchive));
    });

    container.querySelectorAll("[data-delete-archive]").forEach(button => {
      button.addEventListener("click", () => deleteArchive(button.dataset.deleteArchive));
    });
  }

  $("archives-search")?.addEventListener("input", renderArchives);

  function createArchive(name = "") {
    if (!requireCOS()) return;

    const archiveName = name || prompt("Nombre para esta copia de seguridad:");
    if (!archiveName || !archiveName.trim()) return;

    const archive = {
      id: makeId("ARC"),
      name: archiveName.trim(),
      createdAt: new Date().toISOString(),
      createdBy: currentUser,
      records: JSON.parse(JSON.stringify(state.records)),
      appeals: JSON.parse(JSON.stringify(state.appeals)),
      audit: JSON.parse(JSON.stringify(state.audit))
    };

    state.archives.unshift(archive);

    if (!saveState()) return;

    logEvent("ARCHIVE CREATED", archive.id);
    renderAll();
  }

  function restoreArchive(id) {
    if (!requireCOS()) return;

    const archive = state.archives.find(item => item.id === id);
    if (!archive) return;

    if (!confirm("Restaurar esta copia reemplazará los registros y revisiones actuales. ¿Continuar?")) {
      return;
    }

    state.records = JSON.parse(JSON.stringify(archive.records || []));
    state.appeals = JSON.parse(JSON.stringify(archive.appeals || []));

    if (!saveState()) return;

    logEvent("ARCHIVE RESTORED", archive.id);
    renderAll();
  }

  function deleteArchive(id) {
    if (!requireCOS()) return;
    if (!confirm("¿Eliminar esta copia de seguridad?")) return;

    state.archives = state.archives.filter(item => item.id !== id);
    saveState();
    logEvent("ARCHIVE DELETED", id);
    renderArchives();
  }

  // =====================================================
  // ADMIN / EXPORT / CATALOG / OVERRIDE
  // =====================================================

  function renderAdmin() {
    const output = $("admin-output");
    if (!output) return;

    output.innerHTML = `
      <p class="muted">
        Current authority: <strong>${escapeHTML(currentUser || "NONE")}</strong>
      </p>
      <p class="muted">
        Records: ${state.records.length} · Reviews: ${state.appeals.length}
        · Archives: ${state.archives.length}
      </p>
    `;

    $("override-panel")?.classList.add("hidden");

    if (!isCOS()) {
      $("override-open-button")?.setAttribute("disabled", "disabled");
    } else {
      $("override-open-button")?.removeAttribute("disabled");
    }
  }

  $("view-catalog-button")?.addEventListener("click", () => {
    const output = $("admin-output");
    if (!output) return;

    output.innerHTML = `
      <h3>Official category catalog</h3>
      <ul>${CATEGORIES.map(category => `<li>${escapeHTML(category)}</li>`).join("")}</ul>
    `;
  });

  $("generate-update-button")?.addEventListener("click", () => {
    if (!requireCOS()) return;

    createArchive("MANUAL SNAPSHOT " + new Date().toLocaleString());

    const payload = {
      format: "D64-BL-MAINFRAME-EXPORT",
      version: 1,
      exportedAt: new Date().toISOString(),
      records: state.records,
      appeals: state.appeals,
      archives: state.archives,
      audit: state.audit
    };

    downloadJSON(payload, "D64-BLACKLIST-EXPORT.json");
    logEvent("GLOBAL EXPORT GENERATED", "JSON backup");
  });

  $("override-open-button")?.addEventListener("click", () => {
    if (!requireCOS()) return;

    $("override-panel")?.classList.toggle("hidden");
    populateOverrideRecords();
  });

  function populateOverrideRecords() {
    const input = $("override-record");
    if (!input) return;

    const datalistId = "override-record-options";
    let datalist = $(datalistId);

    if (!datalist) {
      datalist = document.createElement("datalist");
      datalist.id = datalistId;
      document.body.appendChild(datalist);
      input.setAttribute("list", datalistId);
    }

    datalist.innerHTML = state.records.map(record =>
      `<option value="${escapeHTML(record.id)}">${escapeHTML(record.subject)}</option>`
    ).join("");
  }

  $("override-form")?.addEventListener("submit", event => {
    event.preventDefault();

    if (!requireCOS()) return;

    if (!$("override-confirmation").checked) {
      setMessage("override-message", "Debes confirmar la operación.", true);
      return;
    }

    const id = $("override-record").value.trim();
    const action = $("override-action").value;
    const reason = $("override-reason").value.trim();

    const record = state.records.find(item => item.id === id);

    if (!record || !action || !reason) {
      setMessage("override-message", "Revisa el expediente y la justificación.", true);
      return;
    }

    const statusMap = {
      CLOSE: "CLOSED",
      REOPEN: "ACTIVE",
      SUSPEND: "UNDER APPEAL",
      RESTORE: "ACTIVE"
    };

    record.status = statusMap[action];
    record.updatedAt = new Date().toISOString();
    record.lastOverride = {
      action,
      reason,
      authority: currentUser,
      timestamp: new Date().toISOString()
    };

    if (!saveState()) return;

    logEvent("COS OVERRIDE", id + " // " + action + " // " + reason);
    setMessage("override-message", "OVERRIDE EXECUTED LOCALLY.");

    $("override-form").reset();
    renderAll();
  });

  // =====================================================
  // JSON DOWNLOAD / FULL EXPORT
  // =====================================================

  function downloadJSON(data, filename) {
    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // =====================================================
  // GLOBAL RENDER
  // =====================================================

  function renderAll() {
    updateDate();
    updateSessionDisplay();
    renderDashboard();
    renderRegistry();
    renderAppeals();
    renderArchives();
    renderAudit();
    renderAdmin();
    renderCipherMode();
    populateReviewRecords();
  }

  // =====================================================
  // INITIALIZATION
  // =====================================================

  populateCategories();
  updateDate();
  addConsole("MAINFRAME INITIALIZED");
  addConsole("STORAGE MODE // LOCAL BROWSER");
  addConsole("AUTHENTICATION MODE // LOCAL UI ONLY");

  $("app")?.classList.add("hidden");
  $("login-screen")?.classList.remove("hidden");

  restoreSession();

  console.log("DIVI-64 // BLACKLIST MAINFRAME V1.1 READY");
});
