
/* =========================================================
   DIVI-64 // BLACKLIST MAINFRAME
   Executive Black Interface — V1.1
   Local browser storage; no real server authentication.
   ========================================================= */

(() => {
  "use strict";

  const STORAGE_KEY = "D64_BLACKLIST_MAINFRAME_V1";
  const SESSION_KEY = "D64_BLACKLIST_SESSION_V1";

  const $ = (id) => document.getElementById(id);

  const CATEGORIES = [
    { id: "CAT-01", name: "Security Violation", severity: "HIGH" },
    { id: "CAT-02", name: "Unauthorized Access", severity: "HIGH" },
    { id: "CAT-03", name: "Breach of Protocol", severity: "MEDIUM" },
    { id: "CAT-04", name: "Abuse of Authority", severity: "HIGH" },
    { id: "CAT-05", name: "Operational Misconduct", severity: "MEDIUM" },
    { id: "CAT-06", name: "Information Disclosure", severity: "HIGH" },
    { id: "CAT-07", name: "Falsification of Records", severity: "HIGH" },
    { id: "CAT-08", name: "Dereliction of Duty", severity: "MEDIUM" },
    { id: "CAT-09", name: "Unauthorized Transfer", severity: "MEDIUM" },
    { id: "CAT-10", name: "Repeated Noncompliance", severity: "MEDIUM" },
    { id: "CAT-11", name: "Interference with Operations", severity: "HIGH" },
    { id: "CAT-12", name: "Executive Directive Violation", severity: "CRITICAL" },
    { id: "CAT-13", name: "Security Threat", severity: "CRITICAL" },
    { id: "CAT-14", name: "Administrative Review", severity: "LOW" },
    { id: "CAT-15", name: "Other / Unclassified", severity: "UNASSESSED" }
  ];

  const DEFAULT_STATE = {
    records: [],
    appeals: [],
    audit: [],
    archives: [],
    counter: 0
  };

  let state = loadState();
  let session = null;
  let currentPage = "dashboard";
  let selectedRecordId = null;
  let selectedAppealId = null;
  let registryView = "table";
  let cipherMode = "text";

  /* =======================================================
     STORAGE AND UTILITIES
     ======================================================= */

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return structuredClone(DEFAULT_STATE);

      const parsed = JSON.parse(saved);

      return {
        records: Array.isArray(parsed.records) ? parsed.records : [],
        appeals: Array.isArray(parsed.appeals) ? parsed.appeals : [],
        audit: Array.isArray(parsed.audit) ? parsed.audit : [],
        archives: Array.isArray(parsed.archives) ? parsed.archives : [],
        counter: Number(parsed.counter) || 0
      };
    } catch (error) {
      console.error("Unable to load local data:", error);
      return structuredClone(DEFAULT_STATE);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.error("Unable to save local data:", error);
      alert("No se han podido guardar los datos. Comprueba el almacenamiento del navegador.");
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function makeId(prefix) {
    state.counter += 1;
    const suffix = Date.now().toString(36).toUpperCase();
    return `${prefix}-${suffix}-${String(state.counter).padStart(4, "0")}`;
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function categoryById(id) {
    return CATEGORIES.find((category) => category.id === id) || {
      id: id || "CAT-15",
      name: "Other / Unclassified",
      severity: "UNASSESSED"
    };
  }

  function currentAuthority() {
    return session?.authority || "SYSTEM";
  }

  function setMessage(id, message, type = "") {
    const element = $(id);
    if (!element) return;
    element.textContent = message;
    element.className = `message ${type}`.trim();
  }

  function auditEvent(action, details = "") {
    state.audit.unshift({
      id: makeId("AUD"),
      timestamp: nowISO(),
      authority: currentAuthority(),
      action,
      details
    });

    state.audit = state.audit.slice(0, 1000);
    saveState();
  }

  function getRecord(id) {
    return state.records.find((record) => record.id === id);
  }

  function getAppeal(id) {
    return state.appeals.find((appeal) => appeal.id === id);
  }

  function recordLabel(record) {
    return `${record.id} — ${record.subject}`;
  }

  function statusClass(status) {
    return String(status || "")
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  function statusTag(status) {
    return `<span class="status ${escapeHTML(statusClass(status))}">${escapeHTML(status || "UNKNOWN")}</span>`;
  }

  function categoryOptions(selected = "") {
    return CATEGORIES.map((category) => `
      <option value="${category.id}" ${category.id === selected ? "selected" : ""}>
        ${category.id} — ${escapeHTML(category.name)}
      </option>
    `).join("");
  }

  function updateCategorySelects() {
    ["record-category", "transfer-category"].forEach((id) => {
      const select = $(id);
      if (!select) return;
      const previous = select.value;
      select.innerHTML = categoryOptions(previous);
    });
  }

  function showElement(id, visible) {
    const element = $(id);
    if (element) element.classList.toggle("hidden", !visible);
  }

  function showLogin() {
    showElement("login-screen", true);
    showElement("app", false);
  }

  function showApp() {
    showElement("login-screen", false);
    showElement("app", true);
    if ($("session-authority")) {
      $("session-authority").textContent = session.authority;
    }
    if ($("session-clearance")) {
      $("session-clearance").textContent =
        session.authority === "COS" ? "CL-OMNI · LOCAL" : "CL-5 · LOCAL";
    }
  }

  /* =======================================================
     LOGIN
     This is a local UI selector, not secure authentication.
     ======================================================= */

  function login(event) {
    event.preventDefault();

    const username = ($("username")?.value || "").trim().toUpperCase();
    const password = $("password")?.value || "";

    if (!["CO", "COS"].includes(username) || !password.trim()) {
      setMessage("login-error", "Introduce CO o COS y una contraseña no vacía.", "error");
      return;
    }

    session = {
      authority: username,
      createdAt: nowISO()
    };

    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (_) {
      // The session may still work for this page.
    }

    setMessage("login-error", "");
    auditEvent("SESSION_OPENED", `${username} opened the local interface.`);
    showApp();
    renderAll();
    navigate("dashboard");
  }

  function restoreSession() {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (!saved) return false;

      const parsed = JSON.parse(saved);
      if (!["CO", "COS"].includes(parsed.authority)) return false;

      session = parsed;
      return true;
    } catch (_) {
      return false;
    }
  }

  function logout() {
    if (session) {
      auditEvent("SESSION_CLOSED", `${session.authority} closed the local interface.`);
    }

    session = null;

    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (_) {}

    showLogin();
  }

  /* =======================================================
     NAVIGATION
     ======================================================= */

  const PAGE_INFO = {
    dashboard: {
      title: "Command Dashboard",
      eyebrow: "EXECUTIVE OVERVIEW",
      description: "Estado del registro y actividad."
    },
    registry: {
      title: "Blacklist Registry",
      eyebrow: "PERSONNEL CONTROL",
      description: "Expedientes, propuestas y estados registrados."
    },
    cipher: {
      title: "D64-EC Encoder",
      eyebrow: "EXECUTIVE COMMUNICATION",
      description: "Codificación de texto y transferencia de propuestas."
    },
    appeals: {
      title: "Appeals & Review",
      eyebrow: "INDEPENDENT REVIEW",
      description: "Solicitudes, justificaciones y resoluciones."
    },
    archives: {
      title: "Archives",
      eyebrow: "RECORD RETENTION",
      description: "Expedientes archivados localmente."
    },
    audit: {
      title: "Audit Log",
      eyebrow: "SYSTEM TRACE",
      description: "Registro local de acciones y eventos."
    },
    admin: {
      title: "Administration",
      eyebrow: "EXECUTIVE CONTROLS",
      description: "Catálogo, exportación de datos y controles locales."
    }
  };

  function navigate(page) {
    if (!PAGE_INFO[page]) return;

    currentPage = page;

    document.querySelectorAll(".page").forEach((element) => {
      element.classList.add("hidden");
    });

    showElement(`page-${page}`, true);

    document.querySelectorAll("[data-page]").forEach((button) => {
      button.classList.toggle("active", button.dataset.page === page);
    });

    const info = PAGE_INFO[page];
    $("page-title").textContent = info.title;
    $("page-eyebrow").textContent = info.eyebrow;
    $("page-description").textContent = info.description;

    renderPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderPage(page) {
    switch (page) {
      case "dashboard":
        renderDashboard();
        break;
      case "registry":
        renderRegistry();
        break;
      case "cipher":
        renderCipherMode();
        break;
      case "appeals":
        renderAppeals();
        break;
      case "archives":
        renderArchives();
        break;
      case "audit":
        renderAudit();
        break;
      case "admin":
        renderAdmin();
        break;
    }
  }

  /* =======================================================
     DASHBOARD
     ======================================================= */

  function renderDashboard() {
    $("metric-total").textContent = state.records.length;

    $("metric-active").textContent = state.records.filter(
      (record) => record.status === "ACTIVE"
    ).length;

    $("metric-pending").textContent = state.records.filter(
      (record) => record.status === "PENDING"
    ).length;

    $("metric-appeals").textContent = state.appeals.filter(
      (appeal) => appeal.status === "OPEN"
    ).length;

    const proposals = state.records.filter(
      (record) => record.status === "PENDING"
    ).slice(0, 5);

    $("dashboard-proposals").innerHTML = proposals.length
      ? proposals.map((record) => `
          <div class="activity-item">
            <h3>${escapeHTML(record.id)} — ${escapeHTML(record.subject)}</h3>
            <p>${escapeHTML(categoryById(record.category).name)}</p>
            <div class="meta">${formatDate(record.createdAt)}</div>
            <button class="text-button" data-open-record="${escapeHTML(record.id)}">
              OPEN RECORD ↗
            </button>
          </div>
        `).join("")
      : '<div class="empty">No hay propuestas pendientes.</div>';

    const activity = state.audit.slice(0, 6);

    $("dashboard-activity").innerHTML = activity.length
      ? activity.map((event) => `
          <div class="activity-item">
            <h3>${escapeHTML(event.action)}</h3>
            <p>${escapeHTML(event.details)}</p>
            <div class="meta">${escapeHTML(event.authority)} · ${formatDate(event.timestamp)}</div>
          </div>
        `).join("")
      : '<div class="empty">Sin actividad registrada.</div>';

    $("console-preview").textContent = [
      "DIVI-64 // BLACKLIST MAINFRAME",
      "INTERFACE STATUS: ONLINE",
      "STORAGE: LOCAL BROWSER",
      `AUTHORITY: ${currentAuthority()}`,
      `RECORDS: ${state.records.length}`,
      `REVIEWS: ${state.appeals.length}`,
      `AUDIT EVENTS: ${state.audit.length}`,
      "REMOTE SERVER: NOT CONNECTED",
      "AUTHENTICATION: NOT SECURE"
    ].join("\n");
  }

  /* =======================================================
     REGISTRY
     ======================================================= */

  function renderRegistry() {
    updateCategorySelects();

    const search = ($("registry-search")?.value || "").trim().toLowerCase();
    const status = $("registry-status")?.value || "";

    const records = state.records.filter((record) => {
      const category = categoryById(record.category);
      const haystack = [
        record.id,
        record.subject,
        record.reason,
        record.status,
        category.name,
        category.id
      ].join(" ").toLowerCase();

      return (!search || haystack.includes(search)) &&
        (!status || record.status === status);
    });

    $("registry-table-body").innerHTML = records.length
      ? records.map((record) => {
          const category = categoryById(record.category);
          return `
            <tr>
              <td>${escapeHTML(record.id)}</td>
              <td>${escapeHTML(record.subject)}</td>
              <td>${escapeHTML(category.id)}</td>
              <td><span class="severity">${escapeHTML(category.severity)}</span></td>
              <td>${statusTag(record.status)}</td>
              <td>${formatDate(record.createdAt)}</td>
              <td>
                <button class="secondary-button" data-open-record="${escapeHTML(record.id)}">
                  OPEN
                </button>
              </td>
            </tr>
          `;
        }).join("")
      : '<tr><td colspan="7">No hay expedientes que coincidan.</td></tr>';

    $("registry-card-container").innerHTML = records.length
      ? records.map((record) => {
          const category = categoryById(record.category);
          return `
            <article class="record-card">
              <div class="eyebrow">${escapeHTML(record.id)}</div>
              <h3>${escapeHTML(record.subject)}</h3>
              <p>${escapeHTML(category.name)}</p>
              <p>Severity: ${escapeHTML(category.severity)}</p>
              ${statusTag(record.status)}
              <p>${formatDate(record.createdAt)}</p>
              <button class="primary-button" data-open-record="${escapeHTML(record.id)}">
                OPEN RECORD
              </button>
            </article>
          `;
        }).join("")
      : '<div class="empty">No hay expedientes que coincidan.</div>';

    showElement("registry-table-container", registryView === "table");
    showElement("registry-card-container", registryView === "cards");

    $("table-view-button").classList.toggle("active", registryView === "table");
    $("card-view-button").classList.toggle("active", registryView === "cards");

    renderRecordDetail();
    updateReviewRecordSelect();
  }

  function renderRecordDetail() {
    const record = getRecord(selectedRecordId);

    if (!record) {
      showElement("record-detail", false);
      return;
    }

    const category = categoryById(record.category);
    const relatedAppeals = state.appeals.filter(
      (appeal) => appeal.recordId === record.id
    );

    $("record-detail").innerHTML = `
      <div class="panel-head">
        <div>
          <p class="eyebrow">RECORD DETAIL</p>
          <h2>${escapeHTML(record.subject)}</h2>
          <p class="muted">${escapeHTML(record.id)}</p>
        </div>
        <button class="secondary-button" data-close-record>CLOSE DETAIL</button>
      </div>

      <div>
        ${statusTag(record.status)}
        <span class="severity">${escapeHTML(category.severity)}</span>
      </div>

      <div class="detail-grid">
        <div class="detail-field">
          <small>Category</small>
          <p>${escapeHTML(category.id)} — ${escapeHTML(category.name)}</p>
        </div>
        <div class="detail-field">
          <small>Created</small>
          <p>${formatDate(record.createdAt)}</p>
        </div>
        <div class="detail-field">
          <small>Reason</small>
          <p>${escapeHTML(record.reason)}</p>
        </div>
        <div class="detail-field">
          <small>Evidence</small>
          <p>${escapeHTML(record.evidence)}</p>
        </div>
        <div class="detail-field">
          <small>Justification</small>
          <p>${escapeHTML(record.justification)}</p>
        </div>
        <div class="detail-field">
          <small>Submitted by</small>
          <p>${escapeHTML(record.createdBy || "UNKNOWN")}</p>
        </div>
      </div>

      <div class="buttons">
        <button class="primary-button" data-appeal-record="${escapeHTML(record.id)}">
          REQUEST APPEAL
        </button>
        <button class="secondary-button" data-review-record="${escapeHTML(record.id)}">
          REQUEST REVIEW
        </button>
        ${record.status === "PENDING" ? `
          <button class="secondary-button" data-resolve-record="${escapeHTML(record.id)}" data-decision="approve">
            APPROVE PROPOSAL
          </button>
          <button class="danger-button" data-resolve-record="${escapeHTML(record.id)}" data-decision="reject">
            REJECT PROPOSAL
          </button>
        ` : ""}
        ${record.status === "ACTIVE" ? `
          <button class="secondary-button" data-archive-record="${escapeHTML(record.id)}">
            ARCHIVE RECORD
          </button>
        ` : ""}
      </div>

      <h3>Linked requests (${relatedAppeals.length})</h3>
      ${relatedAppeals.length ? relatedAppeals.map((appeal) => `
        <div class="activity-item">
          <h3>${escapeHTML(appeal.id)} · ${escapeHTML(appeal.type)}</h3>
          <p>${escapeHTML(appeal.reason)}</p>
          <div class="meta">${escapeHTML(appeal.status)} · ${formatDate(appeal.createdAt)}</div>
          <button class="text-button" data-open-appeal="${escapeHTML(appeal.id)}">
            OPEN REQUEST ↗
          </button>
        </div>
      `).join("") : '<p class="muted">No hay solicitudes vinculadas.</p>'}
    `;

    showElement("record-detail", true);
  }

  function createRecord(event) {
    event.preventDefault();

    const subject = $("record-subject").value.trim();
    const reason = $("record-reason").value.trim();
    const evidence = $("record-evidence").value.trim();
    const justification = $("record-justification").value.trim();

    if (!subject || !reason || !evidence || !justification) {
      setMessage("record-form-message", "Completa todos los campos obligatorios.", "error");
      return;
    }

    const record = {
      id: makeId("BL"),
      category: $("record-category").value,
      subject,
      reason,
      evidence,
      justification,
      status: "PENDING",
      createdAt: nowISO(),
      createdBy: currentAuthority(),
      updatedAt: nowISO(),
      history: []
    };

    state.records.unshift(record);
    auditEvent("PROPOSAL_CREATED", `${record.id}: ${record.subject}`);
    saveState();

    $("record-form").reset();
    updateCategorySelects();
    showElement("record-form-panel", false);
    setMessage("record-form-message", "Propuesta enviada.", "success");

    selectedRecordId = record.id;
    renderAll();
    navigate("registry");
    renderRecordDetail();
  }

  function resolveProposal(id, decision) {
    const record = getRecord(id);
    if (!record || record.status !== "PENDING") return;

    const approved = decision === "approve";
    const message = approved
      ? `¿Aprobar la propuesta ${record.id}?`
      : `¿Rechazar la propuesta ${record.id}?`;

    if (!confirm(message)) return;

    record.status = approved ? "ACTIVE" : "CLOSED";
    record.updatedAt = nowISO();
    record.history.push({
      action: approved ? "APPROVED" : "REJECTED",
      by: currentAuthority(),
      at: nowISO()
    });

    auditEvent(
      approved ? "PROPOSAL_APPROVED" : "PROPOSAL_REJECTED",
      `${record.id}: ${record.subject}`
    );

    saveState();
    renderAll();
    renderRecordDetail();
  }

  function archiveRecord(id) {
    const record = getRecord(id);
    if (!record || record.status !== "ACTIVE") return;

    if (!confirm(`¿Archivar el expediente ${record.id}?`)) return;

    record.status = "ARCHIVED";
    record.updatedAt = nowISO();

    state.archives.unshift({
      recordId: record.id,
      archivedAt: nowISO(),
      archivedBy: currentAuthority()
    });

    auditEvent("RECORD_ARCHIVED", `${record.id}: ${record.subject}`);
    saveState();
    renderAll();
    renderRecordDetail();
  }

  /* =======================================================
     APPEALS AND REVIEWS
     ======================================================= */

  function updateReviewRecordSelect() {
    const select = $("review-record-id");
    if (!select) return;

    const previous = select.value;
    const records = state.records.filter(
      (record) => record.status !== "ARCHIVED"
    );

    select.innerHTML = records.map((record) => `
      <option value="${escapeHTML(record.id)}">
        ${escapeHTML(recordLabel(record))}
      </option>
    `).join("");

    if (selectedRecordId && getRecord(selectedRecordId)) {
      select.value = selectedRecordId;
    } else if (records.some((record) => record.id === previous)) {
      select.value = previous;
    }

    if (!records.length) {
      select.innerHTML = '<option value="">No hay expedientes disponibles</option>';
    }
  }

  function startReview(recordId, type) {
    updateReviewRecordSelect();

    if (recordId && getRecord(recordId)) {
      $("review-record-id").value = recordId;
    }

    $("review-type").value = type || "APPEAL";
    setMessage("review-form-message", "");
    showElement("review-form-panel", true);
    showElement("appeal-detail", false);
    navigate("appeals");

    $("review-form-panel").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function createReview(event) {
    event.preventDefault();

    const recordId = $("review-record-id").value;
    const record = getRecord(recordId);
    const reason = $("review-reason").value.trim();
    const evidence = $("review-evidence").value.trim();
    const type = $("review-type").value;

    if (!record) {
      setMessage("review-form-message", "Selecciona un expediente válido.", "error");
      return;
    }

    if (reason.length < 8) {
      setMessage("review-form-message", "Explica el motivo con algo más de detalle.", "error");
      return;
    }

    const appeal = {
      id: makeId(type === "APPEAL" ? "APL" : "REV"),
      recordId,
      type,
      reason,
      evidence,
      status: "OPEN",
      createdAt: nowISO(),
      createdBy: currentAuthority(),
      resolution: "",
      resolvedAt: null,
      resolvedBy: null
    };

    state.appeals.unshift(appeal);

    if (record.status === "ACTIVE" && type === "APPEAL") {
      record.status = "UNDER APPEAL";
      record.updatedAt = nowISO();
    }

    auditEvent(`${type}_SUBMITTED`, `${appeal.id} linked to ${recordId}`);
    saveState();

    $("review-form").reset();
    showElement("review-form-panel", false);
    setMessage("review-form-message", "Solicitud enviada.", "success");

    renderAll();
    navigate("appeals");
    openAppeal(appeal.id);
  }

  function renderAppeals() {
    updateReviewRecordSelect();

    const openCount = state.appeals.filter(
      (appeal) => appeal.status === "OPEN"
    ).length;

    $("review-count").textContent = `${state.appeals.length} REQUESTS`;

    const sorted = [...state.appeals].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    $("appeals-list").innerHTML = sorted.length
      ? sorted.map((appeal) => {
          const record = getRecord(appeal.recordId);
          return `
            <article class="review-item">
              <div class="panel-head">
                <div>
                  <p class="eyebrow">${escapeHTML(appeal.type)}</p>
                  <h3>${escapeHTML(appeal.id)}</h3>
                </div>
                ${statusTag(appeal.status)}
              </div>
              <p><b>Record:</b> ${escapeHTML(record ? record.subject : appeal.recordId)}</p>
              <p>${escapeHTML(appeal.reason)}</p>
              <div class="meta">
                ${escapeHTML(appeal.createdBy)} · ${formatDate(appeal.createdAt)}
              </div>
              <button class="secondary-button" data-open-appeal="${escapeHTML(appeal.id)}">
                OPEN REQUEST
              </button>
            </article>
          `;
        }).join("")
      : '<div class="empty">No hay solicitudes de revisión o apelación.</div>';

    if ($("review-count")) {
      $("review-count").textContent = `${state.appeals.length} REQUESTS · ${openCount} OPEN`;
    }
  }

  function openAppeal(id) {
    const appeal = getAppeal(id);
    if (!appeal) return;

    selectedAppealId = id;
    const record = getRecord(appeal.recordId);

    $("appeal-detail").innerHTML = `
      <div class="panel-head">
        <div>
          <p class="eyebrow">REQUEST DETAIL</p>
          <h2>${escapeHTML(appeal.id)}</h2>
        </div>
        <button class="secondary-button" data-close-appeal>CLOSE DETAIL</button>
      </div>

      <div class="detail-grid">
        <div class="detail-field">
          <small>Type</small>
          <p>${escapeHTML(appeal.type)}</p>
        </div>
        <div class="detail-field">
          <small>Status</small>
          <p>${escapeHTML(appeal.status)}</p>
        </div>
        <div class="detail-field">
          <small>Linked record</small>
          <p>${escapeHTML(record ? recordLabel(record) : appeal.recordId)}</p>
        </div>
        <div class="detail-field">
          <small>Submitted</small>
          <p>${formatDate(appeal.createdAt)}</p>
        </div>
        <div class="detail-field">
          <small>Reason</small>
          <p>${escapeHTML(appeal.reason)}</p>
        </div>
        <div class="detail-field">
          <small>Additional information</small>
          <p>${escapeHTML(appeal.evidence || "No additional information.")}</p>
        </div>
        ${appeal.resolution ? `
          <div class="detail-field">
            <small>Resolution</small>
            <p>${escapeHTML(appeal.resolution)}</p>
          </div>
          <div class="detail-field">
            <small>Resolved by / at</small>
            <p>${escapeHTML(appeal.resolvedBy || "UNKNOWN")} · ${formatDate(appeal.resolvedAt)}</p>
          </div>
        ` : ""}
      </div>

      ${appeal.status === "OPEN" ? `
        <label for="resolution-input">Review decision / resolution</label>
        <textarea id="resolution-input" placeholder="Justificación obligatoria de la decisión…"></textarea>
        <div class="buttons">
          <button class="primary-button" data-resolve-appeal="${escapeHTML(id)}" data-result="ACCEPTED">
            ACCEPT REQUEST
          </button>
          <button class="danger-button" data-resolve-appeal="${escapeHTML(id)}" data-result="REJECTED">
            REJECT REQUEST
          </button>
        </div>
        <p id="resolution-message" class="message"></p>
      ` : ""}
    `;

    showElement("appeal-detail", true);
    $("appeal-detail").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function resolveAppeal(id, result) {
    const appeal = getAppeal(id);
    if (!appeal || appeal.status !== "OPEN") return;

    const resolution = ($("resolution-input")?.value || "").trim();

    if (resolution.length < 5) {
      setMessage("resolution-message", "Escribe una resolución justificada.", "error");
      return;
    }

    if (!confirm(`¿Confirmar decisión ${result} para ${appeal.id}?`)) return;

    appeal.status = result;
    appeal.resolution = resolution;
    appeal.resolvedAt = nowISO();
    appeal.resolvedBy = currentAuthority();

    const record = getRecord(appeal.recordId);

    if (record && record.status === "UNDER APPEAL") {
      const anotherOpenAppeal = state.appeals.some(
        (item) => item.id !== appeal.id &&
          item.recordId === record.id &&
          item.type === "APPEAL" &&
          item.status === "OPEN"
      );

      if (!anotherOpenAppeal) {
        record.status = result === "ACCEPTED" ? "CLOSED" : "ACTIVE";
        record.updatedAt = nowISO();
      }
    }

    auditEvent("REVIEW_RESOLVED", `${appeal.id}: ${result}`);
    saveState();
    renderAll();
    openAppeal(id);
  }

  /* =======================================================
     D64-EC ENCODER / DECODER
     ======================================================= */

  function utf8Encode(text) {
    return new TextEncoder().encode(text);
  }

  function utf8Decode(bytes) {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      new Uint8Array(bytes)
    );
  }

  function bytesToBase64(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  function base64ToBytes(text) {
    const binary = atob(text.trim());
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }

  function encodeText(text, format) {
    const bytes = utf8Encode(text);

    if (format === "decimal") {
      return Array.from(bytes)
        .map((byte) => String(byte).padStart(3, "0"))
        .join(" ");
    }

    if (format === "hex") {
      return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, "0").toUpperCase())
        .join(" ");
    }

    if (format === "base64") {
      return bytesToBase64(bytes);
    }

    throw new Error("Formato desconocido.");
  }

  function decodeText(text, format) {
    if (format === "decimal") {
      const parts = text.trim().split(/[\s,;]+/).filter(Boolean);

      if (!parts.length) return "";

      const bytes = parts.map((part) => {
        if (!/^\d{1,3}$/.test(part)) {
          throw new Error(`Código decimal inválido: ${part}`);
        }

        const value = Number(part);
        if (value < 0 || value > 255) {
          throw new Error(`Valor fuera de rango: ${part}`);
        }

        return value;
      });

      return utf8Decode(bytes);
    }

    if (format === "hex") {
      const cleaned = text.trim().replace(/[\s,:;-]+/g, "");

      if (!cleaned) return "";
      if (!/^(?:[0-9a-fA-F]{2})+$/.test(cleaned)) {
        throw new Error("Hexadecimal inválido: utiliza pares de dígitos.");
      }

      const bytes = cleaned.match(/.{2}/g).map(
        (part) => parseInt(part, 16)
      );

      return utf8Decode(bytes);
    }

    if (format === "base64") {
      if (!text.trim()) return "";
      return utf8Decode(base64ToBytes(text));
    }

    throw new Error("Formato desconocido.");
  }

  function runEncode() {
    try {
      $("cipher-output").value = encodeText(
        $("cipher-input").value,
        $("cipher-format").value
      );

      setMessage("cipher-message", "Codificación completada.", "success");
    } catch (error) {
      setMessage("cipher-message", error.message, "error");
    }
  }

  function runDecode() {
    try {
      $("cipher-output").value = decodeText(
        $("cipher-input").value,
        $("cipher-format").value
      );

      setMessage("cipher-message", "Decodificación completada.", "success");
    } catch (error) {
      setMessage("cipher-message", error.message, "error");
    }
  }

  function renderCipherMode() {
    showElement("cipher-text-mode", cipherMode === "text");
    showElement("cipher-proposal-mode", cipherMode === "proposal");

    document.querySelectorAll("[data-cipher-mode]").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.cipherMode === cipherMode
      );
    });
  }

  function createTransfer(event) {
    event.preventDefault();

    const payload = {
      format: "D64-BL-TRANSFER",
      version: "1.1",
      recordId: $("transfer-record-id").value.trim() || null,
      category: $("transfer-category").value,
      subject: $("transfer-subject").value.trim(),
      reason: $("transfer-reason").value.trim(),
      evidence: $("transfer-evidence").value.trim(),
      justification: $("transfer-justification").value.trim(),
      createdAt: nowISO()
    };

    const encoded = bytesToBase64(utf8Encode(JSON.stringify(payload)));
    $("transfer-output").value = `D64BL1:${encoded}`;
    setMessage("transfer-message", "Bloque generado. No contiene una firma autenticada.", "success");
  }

  function importTransfer() {
    const input = $("transfer-import-input").value.trim();

    if (!input) {
      setMessage("transfer-message", "Pega un bloque de transferencia.", "error");
      return;
    }

    try {
      const encoded = input.startsWith("D64BL1:")
        ? input.slice("D64BL1:".length).trim()
        : input;

      const payload = JSON.parse(utf8Decode(base64ToBytes(encoded)));

      if (payload.format !== "D64-BL-TRANSFER") {
        throw new Error("El bloque no tiene el formato D64-BL-TRANSFER.");
      }

      if (!payload.subject || !payload.reason || !payload.justification) {
        throw new Error("El bloque no contiene los campos obligatorios.");
      }

      const category = CATEGORIES.some(
        (item) => item.id === payload.category
      ) ? payload.category : "CAT-15";

      const record = {
        id: makeId("BL"),
        category,
        subject: String(payload.subject).slice(0, 120),
        reason: String(payload.reason),
        evidence: String(payload.evidence || "Imported without evidence details."),
        justification: String(payload.justification),
        status: "PENDING",
        createdAt: nowISO(),
        createdBy: currentAuthority(),
        updatedAt: nowISO(),
        importedFrom: payload.recordId || null,
        history: []
      };

      state.records.unshift(record);
      auditEvent("TRANSFER_IMPORTED", `${record.id} imported as a pending proposal.`);
      saveState();

      $("transfer-import-input").value = "";
      renderAll();
      setMessage("transfer-message", `Importación correcta: ${record.id}. Queda pendiente de revisión.`, "success");
    } catch (error) {
      setMessage("transfer-message", `No se pudo importar: ${error.message}`, "error");
    }
  }

  async function copyText(text, messageId) {
    if (!text) {
      setMessage(messageId, "No hay contenido para copiar.", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setMessage(messageId, "Copiado al portapapeles.", "success");
    } catch (_) {
      const temporary = document.createElement("textarea");
      temporary.value = text;
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.appendChild(temporary);
      temporary.select();

      const copied = document.execCommand("copy");
      temporary.remove();

      setMessage(
        messageId,
        copied ? "Copiado al portapapeles." : "No se pudo copiar; selecciona el texto manualmente.",
        copied ? "success" : "error"
      );
    }
  }

  /* =======================================================
     AUDIT LOG
     ======================================================= */

  function renderAudit() {
    const search = ($("audit-search")?.value || "").trim().toLowerCase();

    const events = state.audit.filter((event) => {
      const haystack = [
        event.id,
        event.action,
        event.details,
        event.authority
      ].join(" ").toLowerCase();

      return !search || haystack.includes(search);
    });

    $("audit-list").innerHTML = events.length
      ? events.map((event) => `
          <article class="audit-item">
            <div class="panel-head">
              <h3>${escapeHTML(event.action)}</h3>
              <span class="tag">${escapeHTML(event.id)}</span>
            </div>
            <p>${escapeHTML(event.details)}</p>
            <div class="meta">${escapeHTML(event.authority)} · ${formatDate(event.timestamp)}</div>
          </article>
        `).join("")
      : '<div class="empty">No hay eventos que coincidan.</div>';

    $("full-console").textContent = [
      "DIVI-64 // LOCAL AUDIT CONSOLE",
      `SESSION AUTHORITY: ${currentAuthority()}`,
      `TOTAL EVENTS: ${state.audit.length}`,
      `DISPLAYED: ${events.length}`,
      "NOTICE: LOCAL EVENTS CAN BE MODIFIED BY THE BROWSER OWNER.",
      "",
      ...events.slice(0, 100).map((event) =>
        `[${formatDate(event.timestamp)}] ${event.authority} :: ${event.action} :: ${event.details}`
      )
    ].join("\n");
  }

  /* =======================================================
     ARCHIVES
     ======================================================= */

  function renderArchives() {
    const search = ($("archives-search")?.value || "").trim().toLowerCase();

    const archivedRecords = state.records.filter(
      (record) => record.status === "ARCHIVED"
    );

    const filtered = archivedRecords.filter((record) => {
      return [
        record.id,
        record.subject,
        record.category,
        record.reason
      ].join(" ").toLowerCase().includes(search);
    });

    $("archives-list").innerHTML = filtered.length
      ? filtered.map((record) => `
          <article class="review-item">
            <div class="panel-head">
              <div>
                <p class="eyebrow">${escapeHTML(record.id)}</p>
                <h3>${escapeHTML(record.subject)}</h3>
              </div>
              ${statusTag(record.status)}
            </div>
            <p>${escapeHTML(categoryById(record.category).name)}</p>
            <div class="meta">${formatDate(record.updatedAt || record.createdAt)}</div>
            <div class="buttons">
              <button class="secondary-button" data-open-record="${escapeHTML(record.id)}">
                VIEW RECORD
              </button>
              ${session?.authority === "COS" ? `
                <button class="primary-button" data-restore-record="${escapeHTML(record.id)}">
                  RESTORE
                </button>
              ` : ""}
            </div>
          </article>
        `).join("")
      : '<div class="empty">No hay archivos que coincidan.</div>';
  }

  function restoreRecord(id) {
    if (session?.authority !== "COS") {
      alert("Esta acción local está reservada a COS.");
      return;
    }

    const record = getRecord(id);
    if (!record || record.status !== "ARCHIVED") return;

    if (!confirm(`¿Restaurar ${record.id} como ACTIVE?`)) return;

    record.status = "ACTIVE";
    record.updatedAt = nowISO();

    auditEvent("RECORD_RESTORED", `${record.id} restored from archive.`);
    saveState();
    renderAll();
  }

  /* =======================================================
     ADMINISTRATION
     ======================================================= */

  function renderAdmin() {
    showElement("override-panel", false);
  }

  function showCatalog() {
    $("admin-output").innerHTML = `
      <h3>Official category catalog</h3>
      <div class="table-wrap panel">
        <table>
          <thead>
            <tr><th>ID</th><th>CATEGORY</th><th>DEFAULT SEVERITY</th></tr>
          </thead>
          <tbody>
            ${CATEGORIES.map((category) => `
              <tr>
                <td>${escapeHTML(category.id)}</td>
                <td>${escapeHTML(category.name)}</td>
                <td>${escapeHTML(category.severity)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function exportData() {
    const payload = {
      format: "D64-BL-MAINFRAME-EXPORT",
      version: "1.1",
      exportedAt: nowISO(),
      records: state.records,
      appeals: state.appeals,
      audit: state.audit,
      archives: state.archives,
      counter: state.counter
    };

    const blob = new Blob(
      [JSON.stringify(payload, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `D64_BLACKLIST_EXPORT_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    auditEvent("DATA_EXPORT_CREATED", "A local JSON export was generated.");
    $("admin-output").innerHTML = "<p class='message success'>Exportación generada. Guarda el archivo en un lugar seguro.</p>";
  }

  function executeOverride(event) {
    event.preventDefault();

    if (session?.authority !== "COS") {
      setMessage("override-message", "Acción disponible únicamente para la sesión COS local.", "error");
      return;
    }

    if (!$("override-confirmation").checked) {
      setMessage("override-message", "Marca la casilla de confirmación.", "error");
      return;
    }

    const id = $("override-record").value.trim();
    const action = $("override-action").value;
    const reason = $("override-reason").value.trim();
    const record = getRecord(id);

    if (!record) {
      setMessage("override-message", "No existe un expediente con ese ID.", "error");
      return;
    }

    if (!reason) {
      setMessage("override-message", "La justificación es obligatoria.", "error");
      return;
    }

    if (!confirm(`COS OVERRIDE\n\nExpediente: ${id}\nAcción: ${action}\n\n¿Confirmar?`)) {
      return;
    }

    const previousStatus = record.status;

    const statusMap = {
      CLOSE: "CLOSED",
      REOPEN: "ACTIVE",
      SUSPEND: "UNDER APPEAL",
      RESTORE: "ACTIVE"
    };

    if (!statusMap[action]) {
      setMessage("override-message", "Acción desconocida.", "error");
      return;
    }

    record.status = statusMap[action];
    record.updatedAt = nowISO();

    record.history = Array.isArray(record.history) ? record.history : [];
    record.history.push({
      action: `COS_OVERRIDE_${action}`,
      previousStatus,
      newStatus: record.status,
      reason,
      by: currentAuthority(),
      at: nowISO()
    });

    auditEvent(
      "COS_EXECUTIVE_OVERRIDE",
      `${record.id}: ${previousStatus} → ${record.status}. Reason: ${reason}`
    );

    saveState();
    $("override-form").reset();
    setMessage("override-message", `Cambio local aplicado: ${record.status}.`, "success");

    renderAll();
    renderRecordDetail();
  }

  /* =======================================================
     EVENT HANDLERS
     ======================================================= */

  function bindEvents() {
    $("login-form").addEventListener("submit", login);
    $("logout-button").addEventListener("click", logout);

    document.addEventListener("click", (event) => {
      const pageButton = event.target.closest("[data-page]");
      if (pageButton) {
        event.preventDefault();
        navigate(pageButton.dataset.page);
        return;
      }

      const openRecordButton = event.target.closest("[data-open-record]");
      if (openRecordButton) {
        selectedRecordId = openRecordButton.dataset.openRecord;
        navigate("registry");
        renderRecordDetail();
        $("record-detail").scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      const appealButton = event.target.closest("[data-appeal-record]");
      if (appealButton) {
        selectedRecordId = appealButton.dataset.appealRecord;
        startReview(selectedRecordId, "APPEAL");
        return;
      }

      const reviewButton = event.target.closest("[data-review-record]");
      if (reviewButton) {
        selectedRecordId = reviewButton.dataset.reviewRecord;
        startReview(selectedRecordId, "REVIEW");
        return;
      }

      const resolveRecordButton = event.target.closest("[data-resolve-record]");
      if (resolveRecordButton) {
        resolveProposal(
          resolveRecordButton.dataset.resolveRecord,
          resolveRecordButton.dataset.decision
        );
        return;
      }

      const archiveButton = event.target.closest("[data-archive-record]");
      if (archiveButton) {
        archiveRecord(archiveButton.dataset.archiveRecord);
        return;
      }

      const openAppealButton = event.target.closest("[data-open-appeal]");
      if (openAppealButton) {
        navigate("appeals");
        openAppeal(openAppealButton.dataset.openAppeal);
        return;
      }

      const resolveAppealButton = event.target.closest("[data-resolve-appeal]");
      if (resolveAppealButton) {
        resolveAppeal(
          resolveAppealButton.dataset.resolveAppeal,
          resolveAppealButton.dataset.result
        );
        return;
      }

      const restoreButton = event.target.closest("[data-restore-record]");
      if (restoreButton) {
        restoreRecord(restoreButton.dataset.restoreRecord);
        return;
      }

      if (event.target.closest("[data-close-record]")) {
        selectedRecordId = null;
        showElement("record-detail", false);
        return;
      }

      if (event.target.closest("[data-close-appeal]")) {
        selectedAppealId = null;
        showElement("appeal-detail", false);
      }
    });

    $("new-record-button").addEventListener("click", () => {
      showElement("record-form-panel", true);
      $("record-form-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    $("cancel-record-button").addEventListener("click", () => {
      showElement("record-form-panel", false);
    });

    $("record-form").addEventListener("submit", createRecord);

    $("registry-search").addEventListener("input", renderRegistry);
    $("registry-status").addEventListener("change", renderRegistry);

    $("table-view-button").addEventListener("click", () => {
      registryView = "table";
      renderRegistry();
    });

    $("card-view-button").addEventListener("click", () => {
      registryView = "cards";
      renderRegistry();
    });

    $("new-review-button").addEventListener("click", () => startReview(null, "APPEAL"));

    $("cancel-review-button").addEventListener("click", () => {
      showElement("review-form-panel", false);
    });

    $("review-form").addEventListener("submit", createReview);

    document.querySelectorAll("[data-cipher-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        cipherMode = button.dataset.cipherMode;
        renderCipherMode();
      });
    });

    $("encode-button").addEventListener("click", runEncode);
    $("decode-button").addEventListener("click", runDecode);

    $("cipher-clear-button").addEventListener("click", () => {
      $("cipher-input").value = "";
      $("cipher-output").value = "";
      setMessage("cipher-message", "");
    });

    $("cipher-copy-button").addEventListener("click", () => {
      copyText($("cipher-output").value, "cipher-message");
    });

    $("transfer-form").addEventListener("submit", createTransfer);

    $("transfer-copy-button").addEventListener("click", () => {
      copyText($("transfer-output").value, "transfer-message");
    });

    $("import-transfer-button").addEventListener("click", importTransfer);

    $("audit-search").addEventListener("input", renderAudit);
    $("archives-search").addEventListener("input", renderArchives);

    $("console-clear-button").addEventListener("click", renderAudit);
    $("view-catalog-button").addEventListener("click", showCatalog);
    $("generate-update-button").addEventListener("click", exportData);

    $("override-open-button").addEventListener("click", () => {
      if (session?.authority !== "COS") {
        alert("Executive Override está reservado a COS en esta interfaz local.");
        return;
      }

      showElement("override-panel", true);
      $("override-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    $("override-form").addEventListener("submit", executeOverride);
  }

  /* =======================================================
     INITIALIZATION
     ======================================================= */

  function renderAll() {
    renderDashboard();
    renderRegistry();
    renderAppeals();
    renderArchives();
    renderAudit();
  }

  function initialize() {
    if ($("current-date")) {
      $("current-date").textContent = new Date().toLocaleDateString("es-ES");
    }

    updateCategorySelects();
    bindEvents();

    if (restoreSession()) {
      showApp();
      renderAll();
      navigate("dashboard");
    } else {
      showLogin();
    }
  }

  initialize();
})();
