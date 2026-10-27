
/* ============================================================
   DIVI-64 // BLACKLIST MAINFRAME
   Application logic
   ============================================================

   IMPORTANT:
   - This frontend uses browser-local storage.
   - Browser-local storage is NOT a secure database.
   - Client-side roles are NOT secure authorization.
   - Do not enter real confidential personnel information.
   - Production authentication, shared storage and trusted audit
     require a protected backend.
   ============================================================ */

"use strict";

(() => {
  const STORAGE_KEY = "D64_BLACKLIST_MAINFRAME_V1";
  const SESSION_KEY = "D64_BLACKLIST_SESSION_V1";
  const SCHEMA_VERSION = 1;

  const CATEGORIES = [
    { id: "CAT-01", name: "Incumplimiento administrativo", severity: "BAJA" },
    { id: "CAT-02", name: "Acceso no autorizado", severity: "MEDIA" },
    { id: "CAT-03", name: "Incumplimiento de directivas", severity: "MEDIA" },
    { id: "CAT-04", name: "Uso indebido de credenciales", severity: "ALTA" },
    { id: "CAT-05", name: "Manipulación de registros", severity: "ALTA" },
    { id: "CAT-06", name: "Incidente de seguridad", severity: "ALTA" },
    { id: "CAT-07", name: "Divulgación no autorizada", severity: "ALTA" },
    { id: "CAT-08", name: "Conflicto de autoridad", severity: "MEDIA" },
    { id: "CAT-09", name: "Incumplimiento de protocolo", severity: "MEDIA" },
    { id: "CAT-10", name: "Interferencia operativa", severity: "ALTA" },
    { id: "CAT-11", name: "Falsificación documental", severity: "ALTA" },
    { id: "CAT-12", name: "Incidente crítico", severity: "CRÍTICA" },
    { id: "CAT-13", name: "Abuso de privilegios", severity: "CRÍTICA" },
    { id: "CAT-14", name: "Incumplimiento de resolución", severity: "ALTA" },
    { id: "CAT-15", name: "Revisión extraordinaria", severity: "POR DETERMINAR" }
  ];

  const STATES = [
    "CREATED",
    "PENDING REVIEW",
    "ACTIVE",
    "UNDER APPEAL",
    "REVIEW RESOLVED",
    "CLOSED",
    "ARCHIVED"
  ];

  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const nowISO = () => new Date().toISOString();

  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  };

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);

  const safeText = (value) => String(value ?? "").trim();

  function createInitialState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      records: [],
      proposals: [],
      appeals: [],
      audit: [],
      archives: [],
      overrides: [],
      counters: { 2026: 0 }
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createInitialState();

      const parsed = JSON.parse(raw);

      if (
        !parsed ||
        parsed.schemaVersion !== SCHEMA_VERSION ||
        !Array.isArray(parsed.records) ||
        !Array.isArray(parsed.proposals) ||
        !Array.isArray(parsed.appeals) ||
        !Array.isArray(parsed.audit)
      ) {
        console.warn("[D64] Stored data could not be validated.");
        return createInitialState();
      }

      parsed.archives ??= [];
      parsed.overrides ??= [];
      parsed.counters ??= { 2026: 0 };

      return parsed;
    } catch (error) {
      console.error("[D64] Could not load local data:", error);
      return createInitialState();
    }
  }

  let state = loadState();
  let session = null;
  let currentPage = "dashboard";
  let registryView = "table";
  let selectedRecordId = null;
  let selectedAppealId = null;
  let cipherMode = "text";

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.error("[D64] Local save failed:", error);
      notify("No se pudieron guardar los datos en este navegador.", "error");
      return false;
    }
  }

  function notify(message, type = "info") {
    const target =
      $("record-form-message") ||
      $("transfer-message") ||
      $("login-error");

    if (target) {
      target.textContent = message;
      target.className = `form-message ${type}`;
      target.setAttribute("role", "status");
    } else {
      console.info(`[D64] ${message}`);
    }
  }

  function addAudit(action, details = {}) {
    state.audit.unshift({
      id: makeId("AUD"),
      timestamp: nowISO(),
      actor: session?.username || "LOCAL SYSTEM",
      authority: session?.authority || "UNAUTHENTICATED",
      action,
      recordId: details.recordId || null,
      previousState: details.previousState || null,
      newState: details.newState || null,
      justification: details.justification || "",
      result: details.result || "RECORDED",
      linkedReview: details.linkedReview || null
    });

    // This is a local history, not a tamper-proof audit log.
    if (state.audit.length > 3000) {
      state.audit.length = 3000;
    }
  }

  function makeId(prefix = "D64") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random()
      .toString(36).slice(2, 8).toUpperCase()}`;
  }

  function generateRecordId() {
    const year = new Date().getFullYear();
    state.counters[year] = (state.counters[year] || 0) + 1;

    return `D64-BL-${year}-${String(state.counters[year]).padStart(4, "0")}`;
  }

  function getRole() {
    return session?.authority || null;
  }

  function isCOS() {
    return getRole() === "COS";
  }

  function isCO() {
    return getRole() === "CO";
  }

  function canReview() {
    return isCOS();
  }

  function setMessage(id, message, type = "info") {
    const target = $(id);
    if (!target) return;

    target.textContent = message;
    target.className = `form-message ${type}`;
    target.setAttribute("role", "status");
  }

  function setHidden(element, hidden) {
    if (!element) return;
    element.hidden = hidden;
    element.classList.toggle("hidden", hidden);
  }

  /* ==========================================================
     LOCAL INTERFACE SESSION
     ==========================================================

     This is a UI-only session selector, NOT authentication.
     It does not verify passwords and must not protect real data.
     A production login must be verified by a backend.
     ========================================================== */

  function restoreSession() {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (!saved) return false;

      const parsed = JSON.parse(saved);
      if (!parsed || !["CO", "COS"].includes(parsed.authority)) {
        return false;
      }

      session = parsed;
      return true;
    } catch {
      return false;
    }
  }

  function startLocalSession(username, authority) {
    session = {
      username,
      authority,
      clearance: authority === "COS" ? "CL-OMNI" : "CL-5",
      startedAt: nowISO(),
      mode: "LOCAL UI SESSION — NOT AUTHENTICATED"
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

    if (authority === "COS") {
      addAudit("LOCAL_INTERFACE_SESSION_STARTED", {
        justification: "COS interface session selected locally."
      });
    } else {
      addAudit("LOCAL_INTERFACE_SESSION_STARTED", {
        justification: "CO interface session selected locally."
      });
    }

    persist();
    showApplication();
  }

  function showApplication() {
    setHidden($("login-screen"), true);
    setHidden($("app"), false);

    if ($("session-authority")) {
      $("session-authority").textContent = session?.authority || "LOCAL";
    }

    if ($("session-clearance")) {
      $("session-clearance").textContent =
        `${session?.clearance || "UNVERIFIED"} · LOCAL`;
    }

    if ($("system-status")) {
      $("system-status").textContent = "LOCAL STORAGE";
    }

    if ($("current-date")) {
      $("current-date").textContent = formatDate(nowISO());
    }

    renderAll();
    navigate("dashboard");

    console.warn(
      "[D64] Local interface session only. No authentication or secure authorization is active."
    );
  }

  function showLogin() {
    setHidden($("app"), true);
    setHidden($("login-screen"), false);
  }

  function handleLogin(event) {
    event.preventDefault();

    const username = safeText($("username")?.value);
    const password = $("password")?.value || "";

    if (!username || !password) {
      setMessage("login-error", "Introduce un usuario y una contraseña para continuar.", "error");
      return;
    }

    const normalized = username.toUpperCase();

    if (!["CO", "COS"].includes(normalized)) {
      setMessage(
        "login-error",
        "Esta interfaz local solo permite seleccionar CO o COS. La autenticación real aún requiere un backend.",
        "error"
      );
      return;
    }

    // Password is intentionally NOT stored or verified.
    // This only opens the local UI and provides no real security.
    setMessage(
      "login-error",
      "Sesión local de interfaz: la contraseña no se ha verificado. No uses credenciales reales.",
      "warning"
    );

    startLocalSession(normalized, normalized);
  }

  function logout() {
    if (session) {
      addAudit("LOCAL_INTERFACE_SESSION_ENDED", {
        justification: "Local interface session ended."
      });
      persist();
    }

    session = null;
    sessionStorage.removeItem(SESSION_KEY);
    showLogin();
  }

  /* ==========================================================
     NAVIGATION
     ========================================================== */

  const PAGE_META = {
    dashboard: {
      title: "Dashboard",
      eyebrow: "Executive overview",
      description: "Resumen operativo del registro y de las revisiones pendientes."
    },
    registry: {
      title: "Blacklist Registry",
      eyebrow: "Registry management",
      description: "Consulta, registra y revisa expedientes del sistema."
    },
    cipher: {
      title: "D64-EC Encoder",
      eyebrow: "Encoding / transfer",
      description: "Codificación reversible de texto e intercambio de propuestas."
    },
    audit: {
      title: "Audit Log",
      eyebrow: "Event trace",
      description: "Historial local de acciones registradas por la interfaz."
    },
    archives: {
      title: "Archives",
      eyebrow: "Record preservation",
      description: "Expedientes archivados y exportaciones locales."
    },
    admin: {
      title: "Administration",
      eyebrow: "System administration",
      description: "Catálogo, exportación de cambios y herramientas ejecutivas."
    },
    appeals: {
      title: "Appeals & Review",
      eyebrow: "Independent review",
      description: "Revisión de apelaciones y propuestas pendientes de decisión."
    }
  };

  function navigate(page) {
    if (!PAGE_META[page]) return;

    currentPage = page;

    $$(".nav-item[data-page], #main-navigation [data-page]").forEach((button) => {
      const active = button.dataset.page === page;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });

    $$("[id^='page-']").forEach((element) => {
      const name = element.id.slice("page-".length);
      setHidden(element, name !== page);
    });

    const meta = PAGE_META[page];

    if ($("page-title")) $("page-title").textContent = meta.title;
    if ($("page-eyebrow")) $("page-eyebrow").textContent = meta.eyebrow;
    if ($("page-description")) $("page-description").textContent = meta.description;

    renderPage(page);
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
      case "audit":
        renderAudit();
        renderConsole();
        break;
      case "archives":
        renderArchives();
        break;
      case "admin":
        renderCatalog();
        break;
      case "appeals":
        renderAppeals();
        renderProposalsForReview();
        break;
    }
  }

  /* ==========================================================
     CATEGORIES
     ========================================================== */

  function getCategory(categoryId) {
    return CATEGORIES.find((item) => item.id === categoryId) || {
      id: categoryId || "UNCLASSIFIED",
      name: "Categoría no reconocida",
      severity: "POR DETERMINAR"
    };
  }

  function fillCategorySelect(select) {
    if (!select) return;

    const current = select.value;

    select.innerHTML =
      `<option value="">Seleccionar categoría...</option>` +
      CATEGORIES.map((category) => {
        const label = `${category.id} · ${category.name} — ${category.severity}`;
        return `<option value="${escapeHTML(category.id)}">${escapeHTML(label)}</option>`;
      }).join("");

    if (CATEGORIES.some((category) => category.id === current)) {
      select.value = current;
    }
  }

  function initialiseCategorySelects() {
    [
      $("record-category"),
      $("transfer-category")
    ].forEach(fillCategorySelect);
  }

  /* ==========================================================
     RECORD CREATION AND LIFECYCLE
     ========================================================== */

  function readRecordForm() {
    const categoryId = safeText($("record-category")?.value);
    const subject = safeText($("record-subject")?.value);
    const reason = safeText($("record-reason")?.value);
    const evidence = safeText($("record-evidence")?.value);
    const justification = safeText($("record-justification")?.value);

    const missing = [];

    if (!categoryId) missing.push("categoría");
    if (!subject) missing.push("persona o identificador");
    if (!reason) missing.push("motivo");
    if (!evidence) missing.push("referencia de evidencia/documento");
    if (!justification) missing.push("justificación formal");

    if (missing.length) {
      throw new Error(`Campos obligatorios pendientes: ${missing.join(", ")}.`);
    }

    const category = getCategory(categoryId);

    if (category.severity === "POR DETERMINAR") {
      // CAT-15 must not be automatically activated.
      return {
        category,
        subject,
        reason,
        evidence,
        justification,
        classificationRequired: true
      };
    }

    return {
      category,
      subject,
      reason,
      evidence,
      justification,
      classificationRequired: false
    };
  }

  function handleRecordSubmit(event) {
    event.preventDefault();

    if (!session) {
      setMessage("record-form-message", "No hay una sesión local activa.", "error");
      return;
    }

    let formData;

    try {
      formData = readRecordForm();
    } catch (error) {
      setMessage("record-form-message", error.message, "error");
      return;
    }

    const proposal = {
      proposalId: makeId("PROP"),
      recordId: generateRecordId(),
      categoryId: formData.category.id,
      categoryName: formData.category.name,
      severity: formData.category.severity,
      subject: formData.subject,
      reason: formData.reason,
      evidence: formData.evidence,
      justification: formData.justification,
      createdAt: nowISO(),
      createdBy: session.username,
      createdByAuthority: session.authority,
      status: "PENDING REVIEW",
      classificationRequired: formData.classificationRequired,
      source: "LOCAL FORM"
    };

    state.proposals.unshift(proposal);

    addAudit("RECORD_PROPOSAL_CREATED", {
      recordId: proposal.recordId,
      newState: "PENDING REVIEW",
      justification: proposal.justification
    });

    persist();

    $("record-form")?.reset();
    setHidden($("record-form-panel"), true);

    setMessage(
      "record-form-message",
      `Propuesta ${proposal.recordId} creada y pendiente de revisión. No se ha activado ningún expediente.`,
      "success"
    );

    renderAll();
    navigate("registry");
  }

  function activateProposal(proposalId) {
    if (!canReview()) {
      notify("Solo una sesión COS puede revisar propuestas. Esta sesión local no constituye autorización real.", "error");
      return;
    }

    const proposal = state.proposals.find((item) => item.proposalId === proposalId);
    if (!proposal) return;

    if (proposal.status !== "PENDING REVIEW") {
      notify("La propuesta ya no está pendiente de revisión.", "error");
      return;
    }

    if (proposal.classificationRequired) {
      notify("CAT-15 requiere clasificación formal antes de cualquier activación.", "error");
      return;
    }

    const record = {
      id: proposal.recordId,
      categoryId: proposal.categoryId,
      categoryName: proposal.categoryName,
      severity: proposal.severity,
      subject: proposal.subject,
      reason: proposal.reason,
      evidence: proposal.evidence,
      justification: proposal.justification,
      status: "ACTIVE",
      createdAt: proposal.createdAt,
      activatedAt: nowISO(),
      createdBy: proposal.createdBy,
      approvedBy: session.username,
      history: [{
        timestamp: nowISO(),
        action: "ACTIVATED",
        actor: session.username,
        reason: "Local interface review."
      }]
    };

    state.records.unshift(record);
    proposal.status = "APPROVED";
    proposal.reviewedAt = nowISO();
    proposal.reviewedBy = session.username;

    addAudit("PROPOSAL_APPROVED_AND_ACTIVATED", {
      recordId: record.id,
      previousState: "PENDING REVIEW",
      newState: "ACTIVE",
      justification: "Local interface review; backend approval not verified."
    });

    persist();
    renderAll();
  }

  function rejectProposal(proposalId) {
    if (!canReview()) {
      notify("Solo COS puede rechazar propuestas en esta interfaz local.", "error");
      return;
    }

    const proposal = state.proposals.find((item) => item.proposalId === proposalId);
    if (!proposal || proposal.status !== "PENDING REVIEW") return;

    const reason = prompt("Justificación formal del rechazo:");
    if (!reason || !reason.trim()) {
      notify("Se requiere una justificación para rechazar la propuesta.", "error");
      return;
    }

    proposal.status = "REJECTED";
    proposal.reviewedAt = nowISO();
    proposal.reviewedBy = session.username;
    proposal.rejectionReason = reason.trim();

    addAudit("PROPOSAL_REJECTED", {
      recordId: proposal.recordId,
      previousState: "PENDING REVIEW",
      newState: "REJECTED",
      justification: reason.trim()
    });

    persist();
    renderAll();
  }

  function changeRecordState(recordId, nextState) {
    if (!canReview()) {
      notify("La decisión de estado requiere una sesión COS en esta interfaz.", "error");
      return;
    }

    if (!STATES.includes(nextState)) {
      notify("Estado no reconocido.", "error");
      return;
    }

    const record = state.records.find((item) => item.id === recordId);
    if (!record) return;

    const allowed = {
      "ACTIVE": ["UNDER APPEAL", "CLOSED", "SUSPENDED"],
      "UNDER APPEAL": ["REVIEW RESOLVED"],
      "REVIEW RESOLVED": ["ACTIVE", "CLOSED"],
      "CLOSED": ["ARCHIVED"],
      "ARCHIVED": []
    };

    const actualAllowed = allowed[record.status] || [];

    if (!actualAllowed.includes(nextState)) {
      notify(`Transición no permitida: ${record.status} → ${nextState}.`, "error");
      return;
    }

    const justification = prompt("Introduce la justificación de la decisión:");
    if (!justification || !justification.trim()) {
      notify("La justificación es obligatoria.", "error");
      return;
    }

    const previousState = record.status;
    record.status = nextState;
    record.history ??= [];
    record.history.push({
      timestamp: nowISO(),
      action: "STATE_CHANGED",
      actor: session.username,
      previousState,
      newState: nextState,
      reason: justification.trim()
    });

    if (nextState === "ARCHIVED") {
      state.archives.unshift({
        archiveId: makeId("ARC"),
        recordId: record.id,
        archivedAt: nowISO(),
        archivedBy: session.username,
        reason: justification.trim()
      });
    }

    addAudit("RECORD_STATE_CHANGED", {
      recordId,
      previousState,
      newState: nextState,
      justification: justification.trim()
    });

    persist();
    renderAll();
  }

  function viewRecord(recordId) {
    selectedRecordId = recordId;
    const record = state.records.find((item) => item.id === recordId);
    if (!record) return;

    const target = $("record-detail");
    if (!target) {
      alert(
        `${record.id}\n${record.subject}\n${record.categoryName}\n${record.status}\n\n${record.reason}`
      );
      return;
    }

    target.innerHTML = `
      <div class="panel-header">
        <div>
          <div class="eyebrow">Record detail</div>
          <h3 class="panel-title">${escapeHTML(record.id)}</h3>
        </div>
        <button class="btn btn-small" type="button" data-action="close-detail">Cerrar</button>
      </div>
      <div class="panel-body">
        <div class="detail-grid">
          ${detailField("Identificador", record.subject)}
          ${detailField("Estado", record.status)}
          ${detailField("Categoría", `${record.categoryId} · ${record.categoryName}`)}
          ${detailField("Gravedad", record.severity)}
          ${detailField("Motivo", record.reason, true)}
          ${detailField("Evidencia / documento", record.evidence, true)}
          ${detailField("Justificación", record.justification, true)}
          ${detailField("Creado por", record.createdBy)}
          ${detailField("Aprobado por", record.approvedBy || "—")}
        </div>
        <div class="section-heading"><h3>Historial del expediente</h3></div>
        <div class="activity-list">
          ${(record.history || []).map((item) => `
            <div class="activity-item">
              <span class="activity-marker"></span>
              <div class="activity-content">
                <div class="activity-title">${escapeHTML(item.action)}</div>
                <div class="activity-meta">${escapeHTML(formatDate(item.timestamp))} · ${escapeHTML(item.actor || "—")}</div>
                <div class="activity-meta">${escapeHTML(item.reason || "")}</div>
              </div>
            </div>
          `).join("") || `<div class="empty-state">Sin historial disponible.</div>`}
        </div>
        ${renderRecordActions(record)}
      </div>
    `;

    setHidden(target, false);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function detailField(label, value, full = false) {
    return `
      <div class="detail-field ${full ? "full" : ""}">
        <span class="meta-label">${escapeHTML(label)}</span>
        <div class="meta-value">${escapeHTML(value || "—")}</div>
      </div>
    `;
  }

  function renderRecordActions(record) {
    if (!isCOS()) {
      return `<p class="activity-meta">La sesión CO no dispone de controles de decisión en esta interfaz.</p>`;
    }

    const buttons = [];

    if (record.status === "ACTIVE") {
      buttons.push(`<button class="btn btn-danger btn-small" data-action="record-state" data-id="${escapeHTML(record.id)}" data-state="CLOSED">Cerrar expediente</button>`);
    }

    if (record.status === "CLOSED") {
      buttons.push(`<button class="btn btn-small" data-action="record-state" data-id="${escapeHTML(record.id)}" data-state="ARCHIVED">Archivar</button>`);
    }

    if (record.status === "REVIEW RESOLVED") {
      buttons.push(`<button class="btn btn-small" data-action="record-state" data-id="${escapeHTML(record.id)}" data-state="ACTIVE">Restaurar estado activo</button>`);
      buttons.push(`<button class="btn btn-danger btn-small" data-action="record-state" data-id="${escapeHTML(record.id)}" data-state="CLOSED">Cerrar expediente</button>`);
    }

    return buttons.length ? `<div class="form-actions">${buttons.join("")}</div>` : "";
  }

  /* ==========================================================
     REGISTRY RENDERING
     ========================================================== */

  function getVisibleRecords() {
    const query = safeText($("registry-search")?.value).toLowerCase();
    const status = $("registry-status")?.value || "";

    return state.records.filter((record) => {
      const searchable = [
        record.id,
        record.subject,
        record.categoryId,
        record.categoryName,
        record.reason,
        record.evidence,
        record.status
      ].join(" ").toLowerCase();

      return (!query || searchable.includes(query)) &&
        (!status || record.status === status);
    });
  }

  function renderRegistry() {
    const records = getVisibleRecords();

    const tableBody = $("registry-table-body");
    if (tableBody) {
      tableBody.innerHTML = records.map((record) => `
        <tr>
          <td><span class="record-id">${escapeHTML(record.id)}</span></td>
          <td><span class="record-subject">${escapeHTML(record.subject)}</span></td>
          <td>${escapeHTML(record.categoryId)}<br><span class="activity-meta">${escapeHTML(record.categoryName)}</span></td>
          <td><span class="severity-badge ${severityClass(record.severity)}">${escapeHTML(record.severity)}</span></td>
          <td><span class="status-badge ${statusClass(record.status)}">${escapeHTML(record.status)}</span></td>
          <td>${escapeHTML(formatDate(record.createdAt))}</td>
          <td><button class="btn btn-small" data-action="view-record" data-id="${escapeHTML(record.id)}">Abrir</button></td>
        </tr>
      `).join("") || `
        <tr><td colspan="7"><div class="empty-state">No hay expedientes que coincidan con la búsqueda.</div></td></tr>
      `;
    }

    const cards = $("registry-card-container");
    if (cards) {
      cards.innerHTML = records.map((record) => `
        <article class="record-card">
          <div class="record-card-header">
            <div>
              <span class="record-id">${escapeHTML(record.id)}</span>
              <h3>${escapeHTML(record.subject)}</h3>
            </div>
            <span class="status-badge ${statusClass(record.status)}">${escapeHTML(record.status)}</span>
          </div>
          <p>${escapeHTML(record.reason)}</p>
          <div class="record-card-meta">
            <div><span class="meta-label">Categoría</span><span class="meta-value">${escapeHTML(record.categoryId)}</span></div>
            <div><span class="meta-label">Gravedad</span><span class="severity-badge ${severityClass(record.severity)}">${escapeHTML(record.severity)}</span></div>
            <div><span class="meta-label">Fecha</span><span class="meta-value">${escapeHTML(formatDate(record.createdAt))}</span></div>
            <div><span class="meta-label">Referencia</span><span class="meta-value">${escapeHTML(record.evidence)}</span></div>
          </div>
          <div class="record-card-actions">
            <button class="btn btn-small" data-action="view-record" data-id="${escapeHTML(record.id)}">Abrir expediente</button>
          </div>
        </article>
      `).join("") || `<div class="empty-state">No hay expedientes que coincidan con la búsqueda.</div>`;
    }

    setHidden($("registry-table-container"), registryView !== "table");
    setHidden(cards, registryView !== "cards");
  }

  function severityClass(severity) {
    return ({
      "BAJA": "severity-low",
      "MEDIA": "severity-medium",
      "ALTA": "severity-high",
      "CRÍTICA": "severity-critical",
      "POR DETERMINAR": "severity-high"
    })[severity] || "";
  }

  function statusClass(status) {
    return ({
      "ACTIVE": "status-active",
      "PENDING REVIEW": "status-pending",
      "UNDER APPEAL": "status-appeal",
      "REVIEW RESOLVED": "status-resolved",
      "CLOSED": "status-closed",
      "ARCHIVED": "status-closed",
      "CREATED": "status-pending",
      "APPROVED": "status-resolved",
      "REJECTED": "status-active"
    })[status] || "";
  }

  /* ==========================================================
     DASHBOARD
     ========================================================== */

  function renderDashboard() {
    const active = state.records.filter((item) => item.status === "ACTIVE").length;
    const pending = state.proposals.filter((item) => item.status === "PENDING REVIEW").length;
    const appeals = state.appeals.filter((item) => item.status === "UNDER REVIEW").length;

    if ($("metric-total")) $("metric-total").textContent = state.records.length;
    if ($("metric-active")) $("metric-active").textContent = active;
    if ($("metric-pending")) $("metric-pending").textContent = pending;
    if ($("metric-appeals")) $("metric-appeals").textContent = appeals;

    const proposalTarget = $("dashboard-proposals");
    if (proposalTarget) {
      const items = state.proposals
        .filter((item) => item.status === "PENDING REVIEW")
        .slice(0, 5);

      proposalTarget.innerHTML = items.map((item) => `
        <div class="proposal-item">
          <span class="activity-marker yellow"></span>
          <div class="activity-content">
            <div class="activity-title">${escapeHTML(item.recordId)} · ${escapeHTML(item.subject)}</div>
            <div class="activity-meta">${escapeHTML(item.categoryId)} · ${escapeHTML(item.severity)} · ${escapeHTML(formatDate(item.createdAt))}</div>
            <div class="activity-meta">${escapeHTML(item.status)}</div>
            ${isCOS() ? `
              <div class="form-actions">
                <button class="btn btn-primary btn-small" data-action="approve-proposal" data-id="${escapeHTML(item.proposalId)}">Aprobar</button>
                <button class="btn btn-danger btn-small" data-action="reject-proposal" data-id="${escapeHTML(item.proposalId)}">Rechazar</button>
              </div>
            ` : ""}
          </div>
        </div>
      `).join("") || `<div class="empty-state">No hay propuestas pendientes.</div>`;
    }

    const activityTarget = $("dashboard-activity");
    if (activityTarget) {
      activityTarget.innerHTML = state.audit.slice(0, 6).map((event) => `
        <div class="activity-item">
          <span class="activity-marker ${event.result === "RECORDED" ? "" : "yellow"}"></span>
          <div class="activity-content">
            <div class="activity-title">${escapeHTML(event.action)}</div>
            <div class="activity-meta">${escapeHTML(formatDate(event.timestamp))} · ${escapeHTML(event.actor)}</div>
            <div class="activity-meta">${escapeHTML(event.recordId || "SYSTEM EVENT")}</div>
          </div>
        </div>
      `).join("") || `<div class="empty-state">Todavía no hay eventos registrados.</div>`;
    }

    renderConsolePreview();
  }

  function renderConsolePreview() {
    const target = $("console-preview");
    if (!target) return;

    const lines = [
      "[D64] BLACKLIST MAINFRAME",
      `[SYS] MODE: LOCAL BROWSER STORAGE`,
      `[AUTH] AUTHENTICATION: NOT VERIFIED`,
      `[DATA] RECORDS: ${state.records.length}`,
      `[QUEUE] PENDING PROPOSALS: ${state.proposals.filter((item) => item.status === "PENDING REVIEW").length}`,
      `[AUDIT] LOCAL EVENTS: ${state.audit.length}`,
      "[WARN] LOCAL DATA IS NOT SHARED OR TAMPER-PROOF"
    ];

    target.textContent = lines.join("\n");
  }

  /* ==========================================================
     D64-EC: REVERSIBLE TEXT BYTE ENCODING
     ==========================================================

     Each UTF-8 byte is represented as three decimal digits.
     This preserves Unicode, accents, spaces and line breaks.
     It is an encoding, NOT encryption or a security signature.
     ========================================================== */

  function encodeText(text) {
    const bytes = new TextEncoder().encode(text);
    return Array.from(bytes, (byte) => String(byte).padStart(3, "0")).join(" ");
  }

  function decodeText(encoded) {
    const trimmed = encoded.trim();
    if (!trimmed) return "";

    const tokens = trimmed.split(/\s+/);
    const bytes = [];

    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index];

      if (!/^\d{3}$/.test(token)) {
        throw new Error(`Código inválido en la posición ${index + 1}: "${token}". Se esperaba un código de tres cifras.`);
      }

      const value = Number(token);

      if (value < 0 || value > 255) {
        throw new Error(`Código fuera de rango en la posición ${index + 1}: "${token}". El rango permitido es 000–255.`);
      }

      bytes.push(value);
    }

    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
    } catch {
      throw new Error("La secuencia no contiene texto UTF-8 válido. Comprueba los códigos y su orden.");
    }
  }

  function handleEncode() {
    const input = $("cipher-input");
    const output = $("cipher-output");
    if (!input || !output) return;

    try {
      output.value = encodeText(input.value);
      setMessage("cipher-message", "Codificación completada. Este formato no es cifrado criptográfico.", "success");
    } catch (error) {
      setMessage("cipher-message", error.message, "error");
    }
  }

  function handleDecode() {
    const input = $("cipher-input");
    const output = $("cipher-output");
    if (!input || !output) return;

    try {
      output.value = decodeText(input.value);
      setMessage("cipher-message", "Decodificación completada.", "success");
    } catch (error) {
      setMessage("cipher-message", error.message, "error");
    }
  }

  function clearCipher() {
    if ($("cipher-input")) $("cipher-input").value = "";
    if ($("cipher-output")) $("cipher-output").value = "";
    setMessage("cipher-message", "", "info");
  }

  async function copyText(text, messageId) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const temporary = document.createElement("textarea");
        temporary.value = text;
        temporary.style.position = "fixed";
        temporary.style.opacity = "0";
        document.body.appendChild(temporary);
        temporary.select();

        const copied = document.execCommand("copy");
        temporary.remove();

        if (!copied) throw new Error("Copia no disponible");
      }

      setMessage(messageId, "Contenido copiado.", "success");
    } catch {
      setMessage(messageId, "No se pudo copiar automáticamente. Selecciona y copia el texto manualmente.", "error");
    }
  }

  function renderCipherMode() {
    $$("[data-cipher-mode]").forEach((button) => {
      const active = button.dataset.cipherMode === cipherMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    const textPanel = $("cipher-text-mode");
    const proposalPanel = $("cipher-proposal-mode");

    setHidden(textPanel, cipherMode !== "text");
    setHidden(proposalPanel, cipherMode !== "proposal");
  }

  function createProposalTransfer(event) {
    event.preventDefault();

    if (!session) {
      setMessage("transfer-message", "No hay una sesión local activa.", "error");
      return;
    }

    const categoryId = safeText($("transfer-category")?.value);
    const subject = safeText($("transfer-subject")?.value);
    const reason = safeText($("transfer-reason")?.value);
    const evidence = safeText($("transfer-evidence")?.value);
    const justification = safeText($("transfer-justification")?.value);

    if (!categoryId || !subject || !reason || !evidence || !justification) {
      setMessage(
        "transfer-message",
        "Completa categoría, identificador, motivo, referencia documental y justificación.",
        "error"
      );
      return;
    }

    const category = getCategory(categoryId);

    const payload = {
      format: "D64-BLACKLIST-PROPOSAL",
      version: 1,
      transferId: makeId("XFER"),
      createdAt: nowISO(),
      origin: {
        username: session.username,
        authority: session.authority
      },
      proposal: {
        categoryId,
        categoryName: category.name,
        severity: category.severity,
        subject,
        reason,
        evidence,
        justification,
        classificationRequired: category.severity === "POR DETERMINAR"
      },
      securityNotice: "TRANSFER PACKAGE IS NOT A CRYPTOGRAPHIC SIGNATURE"
    };

    const encoded = btoa(
      new TextEncoder().encode(JSON.stringify(payload))
        .reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    const block = [
      "-----BEGIN D64 PROPOSAL-----",
      encoded.match(/.{1,76}/g)?.join("\n") || encoded,
      "-----END D64 PROPOSAL-----"
    ].join("\n");

    if ($("transfer-output")) $("transfer-output").value = block;

    addAudit("PROPOSAL_TRANSFER_GENERATED", {
      justification: `Transfer ${payload.transferId} generated locally.`
    });

    persist();

    setMessage(
      "transfer-message",
      "Bloque generado. Copiarlo no verifica la identidad del emisor ni aprueba la propuesta.",
      "success"
    );

    renderAll();
  }

  function parseProposalTransfer(raw) {
    const match = raw.match(
      /-----BEGIN D64 PROPOSAL-----([\s\S]*?)-----END D64 PROPOSAL-----/
    );

    if (!match) {
      throw new Error("No se ha encontrado un bloque D64 PROPOSAL válido.");
    }

    const encoded = match[1].replace(/\s+/g, "");

    if (!encoded || !/^[A-Za-z0-9+/=]+$/.test(encoded)) {
      throw new Error("El bloque contiene caracteres no válidos.");
    }

    let decoded;

    try {
      const binary = atob(encoded);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error("No se pudo decodificar el bloque transferido.");
    }

    let payload;

    try {
      payload = JSON.parse(decoded);
    } catch {
      throw new Error("El contenido decodificado no es un objeto JSON válido.");
    }

    if (
      payload.format !== "D64-BLACKLIST-PROPOSAL" ||
      payload.version !== 1 ||
      !payload.proposal
    ) {
      throw new Error("Formato o versión de propuesta no reconocidos.");
    }

    const p = payload.proposal;
    const category = getCategory(p.categoryId);

    if (!CATEGORIES.some((item) => item.id === p.categoryId)) {
      throw new Error("La categoría recibida no pertenece al catálogo actual.");
    }

    for (const field of ["subject", "reason", "evidence", "justification"]) {
      if (typeof p[field] !== "string" || !p[field].trim()) {
        throw new Error(`Campo obligatorio ausente o inválido: ${field}.`);
      }
    }

    return {
      payload,
      proposal: {
        categoryId: category.id,
        categoryName: category.name,
        severity: category.severity,
        subject: p.subject,
        reason: p.reason,
        evidence: p.evidence,
        justification: p.justification,
        classificationRequired: category.severity === "POR DETERMINAR"
      }
    };
  }

  function importProposalTransfer() {
    const raw = safeText($("transfer-import-input")?.value);

    if (!raw) {
      setMessage("transfer-message", "Pega primero el bloque que deseas importar.", "error");
      return;
    }

    if (!session) {
      setMessage("transfer-message", "No hay una sesión local activa.", "error");
      return;
    }

    try {
      const parsed = parseProposalTransfer(raw);
      const payload = parsed.payload;

      const duplicate = state.proposals.some((item) =>
        item.transferId && item.transferId === payload.transferId
      );

      if (duplicate) {
        throw new Error("Esta transferencia ya se ha importado en este navegador.");
      }

      const proposal = {
        proposalId: makeId("PROP"),
        recordId: generateRecordId(),
        transferId: payload.transferId,
        ...parsed.proposal,
        createdAt: payload.createdAt || nowISO(),
        importedAt: nowISO(),
        createdBy: payload.origin?.username || "EXTERNAL ORIGIN",
        createdByAuthority: payload.origin?.authority || "UNVERIFIED",
        importedBy: session.username,
        status: "PENDING REVIEW",
        source: "TRANSFER IMPORT",
        originVerified: false
      };

      state.proposals.unshift(proposal);

      addAudit("PROPOSAL_TRANSFER_IMPORTED", {
        recordId: proposal.recordId,
        newState: "PENDING REVIEW",
        justification: "Imported transfer. Origin is unverified."
      });

      persist();
      renderAll();

      if ($("transfer-import-input")) $("transfer-import-input").value = "";

      setMessage(
        "transfer-message",
        `Propuesta ${proposal.recordId} importada y pendiente de revisión. Emisor no verificado; importación no equivale a aprobación.`,
        "success"
      );
    } catch (error) {
      setMessage("transfer-message", error.message, "error");
    }
  }

  /* ==========================================================
     APPEALS
     ========================================================== */

  function createAppeal(recordId) {
    const record = state.records.find((item) => item.id === recordId);

    if (!record || record.status !== "ACTIVE") {
      notify("Solo se puede presentar una apelación sobre un expediente activo.", "error");
      return;
    }

    const reason = prompt("Motivo de la apelación:");
    if (!reason || !reason.trim()) {
      notify("La apelación requiere una justificación.", "error");
      return;
    }

    const appeal = {
      appealId: makeId("APL"),
      recordId,
      reason: reason.trim(),
      createdAt: nowISO(),
      createdBy: session.username,
      status: "UNDER REVIEW",
      resolution: null
    };

    const previousState = record.status;
    record.status = "UNDER APPEAL";
    record.history ??= [];
    record.history.push({
      timestamp: nowISO(),
      action: "APPEAL_FILED",
      actor: session.username,
      previousState,
      newState: "UNDER APPEAL",
      reason: reason.trim()
    });

    state.appeals.unshift(appeal);

    addAudit("APPEAL_FILED", {
      recordId,
      previousState,
      newState: "UNDER APPEAL",
      justification: reason.trim(),
      linkedReview: appeal.appealId
    });

    persist();
    renderAll();
    navigate("appeals");
  }

  function resolveAppeal(appealId, decision) {
    if (!canReview()) {
      notify("Solo COS puede resolver apelaciones en esta interfaz local.", "error");
      return;
    }

    const appeal = state.appeals.find((item) => item.appealId === appealId);
    if (!appeal || appeal.status !== "UNDER REVIEW") return;

    const justification = prompt("Justificación formal de la resolución:");
    if (!justification || !justification.trim()) {
      notify("La resolución requiere una justificación.", "error");
      return;
    }

    const record = state.records.find((item) => item.id === appeal.recordId);
    if (!record) {
      notify("No se encuentra el expediente vinculado.", "error");
      return;
    }

    const previousState = record.status;

    appeal.status = "RESOLVED";
    appeal.resolution = decision;
    appeal.resolutionText = justification.trim();
    appeal.resolvedAt = nowISO();
    appeal.resolvedBy = session.username;

    record.status = decision === "UPHOLD" ? "CLOSED" : "REVIEW RESOLVED";
    record.history ??= [];
    record.history.push({
      timestamp: nowISO(),
      action: "APPEAL_RESOLVED",
      actor: session.username,
      previousState,
      newState: record.status,
      reason: justification.trim()
    });

    addAudit("APPEAL_RESOLVED", {
      recordId: record.id,
      previousState,
      newState: record.status,
      justification: justification.trim(),
      linkedReview: appeal.appealId
    });

    persist();
    renderAll();
  }

  function renderAppeals() {
    const target = $("appeals-list");
    if (!target) return;

    target.innerHTML = state.appeals.map((appeal) => `
      <div class="appeal-item">
        <div class="appeal-item-header">
          <h3>${escapeHTML(appeal.appealId)} · ${escapeHTML(appeal.recordId)}</h3>
          <span class="status-badge ${appeal.status === "UNDER REVIEW" ? "status-pending" : "status-resolved"}">${escapeHTML(appeal.status)}</span>
        </div>
        <p>${escapeHTML(appeal.reason)}</p>
        <div class="activity-meta">${escapeHTML(formatDate(appeal.createdAt))} · ${escapeHTML(appeal.createdBy)}</div>
        ${appeal.status === "UNDER REVIEW" && isCOS() ? `
          <div class="form-actions">
            <button class="btn btn-primary btn-small" data-action="resolve-appeal" data-id="${escapeHTML(appeal.appealId)}" data-decision="OVERTURN">Estimar apelación</button>
            <button class="btn btn-danger btn-small" data-action="resolve-appeal" data-id="${escapeHTML(appeal.appealId)}" data-decision="UPHOLD">Desestimar apelación</button>
          </div>
        ` : ""}
        ${appeal.resolutionText ? `<p><strong>Resolución:</strong> ${escapeHTML(appeal.resolutionText)}</p>` : ""}
      </div>
    `).join("") || `<div class="empty-state">No hay apelaciones registradas.</div>`;
  }

  function renderProposalsForReview() {
    const target = $("appeal-detail");
    if (!target) return;

    const pending = state.proposals.filter((item) => item.status === "PENDING REVIEW");

    target.innerHTML = `
      <div class="panel-header">
        <div>
          <h3 class="panel-title">Propuestas pendientes</h3>
          <div class="panel-subtitle">Revisión de propuestas y transferencias importadas</div>
        </div>
      </div>
      <div class="proposal-list">
        ${pending.map((item) => `
          <div class="proposal-item">
            <span class="activity-marker yellow"></span>
            <div class="activity-content">
              <div class="activity-title">${escapeHTML(item.recordId)} · ${escapeHTML(item.subject)}</div>
              <div class="activity-meta">${escapeHTML(item.categoryId)} · ${escapeHTML(item.severity)}</div>
              <div class="activity-meta">${escapeHTML(item.reason)}</div>
              <div class="activity-meta">Origen: ${escapeHTML(item.createdBy)} · No verificado</div>
              ${item.classificationRequired ? `<p class="message error">Clasificación obligatoria antes de cualquier decisión.</p>` : ""}
              ${isCOS() ? `
                <div class="form-actions">
                  <button class="btn btn-primary btn-small" data-action="approve-proposal" data-id="${escapeHTML(item.proposalId)}">Aprobar</button>
                  <button class="btn btn-danger btn-small" data-action="reject-proposal" data-id="${escapeHTML(item.proposalId)}">Rechazar</button>
                </div>
              ` : ""}
            </div>
          </div>
        `).join("") || `<div class="empty-state">No hay propuestas pendientes de revisión.</div>`}
      </div>
    `;
  }

  /* ==========================================================
     AUDIT
     ========================================================== */

  function renderAudit() {
    const target = $("audit-list");
    if (!target) return;

    const query = safeText($("audit-search")?.value).toLowerCase();

    const entries = state.audit.filter((event) => {
      const text = [
        event.id,
        event.action,
        event.actor,
        event.authority,
        event.recordId,
        event.justification,
        event.previousState,
        event.newState
      ].join(" ").toLowerCase();

      return !query || text.includes(query);
    });

    target.innerHTML = entries.map((event) => `
      <div class="audit-item">
        <div class="audit-timestamp">${escapeHTML(formatDate(event.timestamp))}</div>
        <div class="audit-main">
          <div class="audit-action">${escapeHTML(event.action)}</div>
          <div class="audit-description">
            Actor: ${escapeHTML(event.actor)} · Autoridad seleccionada: ${escapeHTML(event.authority)}
          </div>
          <div class="audit-description">
            Expediente: ${escapeHTML(event.recordId || "—")} ·
            Estado: ${escapeHTML(event.previousState || "—")} → ${escapeHTML(event.newState || "—")}
          </div>
          ${event.justification ? `<div class="audit-description">Justificación: ${escapeHTML(event.justification)}</div>` : ""}
          ${event.linkedReview ? `<div class="audit-description">Revisión vinculada: ${escapeHTML(event.linkedReview)}</div>` : ""}
        </div>
      </div>
    `).join("") || `<div class="empty-state">No hay eventos que coincidan con la búsqueda.</div>`;
  }

  function renderConsole() {
    const target = $("full-console");
    if (!target) return;

    const lines = [
      `[${formatDate(nowISO())}] D64 BLACKLIST MAINFRAME`,
      `[INFO] Session mode: ${session?.mode || "NO SESSION"}`,
      `[INFO] Selected authority: ${session?.authority || "NONE"}`,
      `[INFO] Record count: ${state.records.length}`,
      `[INFO] Proposal queue: ${state.proposals.filter((item) => item.status === "PENDING REVIEW").length}`,
      `[INFO] Appeal queue: ${state.appeals.filter((item) => item.status === "UNDER REVIEW").length}`,
      `[INFO] Audit entries: ${state.audit.length}`,
      "[WARN] Browser-local data is editable by the device owner.",
      "[WARN] No backend authentication, global synchronization or immutable audit."
    ];

    target.textContent = lines.join("\n");
  }

  /* ==========================================================
     ARCHIVES
     ========================================================== */

  function renderArchives() {
    const target = $("archives-list");
    if (!target) return;

    const archived = state.records.filter((record) => record.status === "ARCHIVED");

    target.innerHTML = archived.map((record) => `
      <div class="archive-item">
        <div class="archive-icon">ARC</div>
        <div class="archive-content">
          <h3>${escapeHTML(record.id)} · ${escapeHTML(record.subject)}</h3>
          <p>${escapeHTML(record.categoryName)} · ${escapeHTML(formatDate(record.createdAt))}</p>
        </div>
        <button class="btn btn-small" data-action="view-record" data-id="${escapeHTML(record.id)}">Consultar</button>
      </div>
    `).join("") || `<div class="empty-state">No hay expedientes archivados.</div>`;
  }

  function exportLocalData() {
    const exportObject = {
      format: "D64-BLACKLIST-LOCAL-EXPORT",
      version: 1,
      exportedAt: nowISO(),
      notice: "Local export; not a verified or signed official update.",
      state
    };

    const blob = new Blob(
      [JSON.stringify(exportObject, null, 2)],
      { type: "application/json;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `D64-BLACKLIST-LOCAL-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    addAudit("LOCAL_DATA_EXPORT_CREATED", {
      justification: "A local JSON export was generated."
    });

    persist();
    renderAll();
  }

  /* ==========================================================
     ADMINISTRATION / EXECUTIVE OVERRIDE
     ========================================================== */

  function renderCatalog() {
    const target = $("admin-output");
    if (!target) return;

    target.innerHTML = `
      <div class="panel-header">
        <div>
          <h3 class="panel-title">Catálogo oficial de categorías</h3>
          <div class="panel-subtitle">${CATEGORIES.length} categorías definidas en el frontend</div>
        </div>
      </div>
      <div class="catalog-list">
        ${CATEGORIES.map((category) => `
          <div class="catalog-item">
            <span class="catalog-code">${escapeHTML(category.id)}</span>
            <div>
              <div class="catalog-name">${escapeHTML(category.name)}</div>
              <div class="catalog-description">Gravedad: ${escapeHTML(category.severity)}</div>
            </div>
            <span class="severity-badge ${severityClass(category.severity)}">${escapeHTML(category.severity)}</span>
          </div>
        `).join("")}
      </div>
      <div class="panel-footer">
        <button class="btn btn-primary" data-action="export-update">Generar exportación local</button>
      </div>
    `;
  }

  function openOverride() {
    if (!isCOS()) {
      notify("Executive Override requiere una sesión COS seleccionada. Esta comprobación local no es seguridad real.", "error");
      return;
    }

    setHidden($("override-panel"), false);
  }

  function executeOverride(event) {
    event.preventDefault();

    if (!isCOS()) {
      setMessage("override-message", "Acceso denegado: la interfaz no reconoce una sesión COS.", "error");
      return;
    }

    const recordId = safeText($("override-record")?.value);
    const action = safeText($("override-action")?.value);
    const reason = safeText($("override-reason")?.value);
    const confirmation = safeText($("override-confirmation")?.value);

    if (!recordId || !action || !reason || !confirmation) {
      setMessage("override-message", "Todos los campos son obligatorios.", "error");
      return;
    }

    if (confirmation !== "CONFIRM") {
      setMessage("override-message", 'Escribe exactamente CONFIRM en el campo de confirmación.', "error");
      return;
    }

    const record = state.records.find((item) => item.id === recordId);
    if (!record) {
      setMessage("override-message", "No se encuentra el expediente indicado.", "error");
      return;
    }

    const previousState = record.status;
    const actionMap = {
      SUSPEND: "UNDER APPEAL",
      RESTORE: "ACTIVE",
      CLOSE: "CLOSED",
      REOPEN: "ACTIVE"
    };

    const nextState = actionMap[action];

    if (!nextState) {
      setMessage("override-message", "Acción no reconocida.", "error");
      return;
    }

    if (previousState === "ARCHIVED") {
      setMessage("override-message", "Los expedientes archivados no pueden modificarse con esta herramienta local.", "error");
      return;
    }

    record.status = nextState;
    record.history ??= [];
    record.history.push({
      timestamp: nowISO(),
      action: `LOCAL_OVERRIDE_${action}`,
      actor: session.username,
      previousState,
      newState: nextState,
      reason
    });

    const overrideEvent = {
      id: makeId("OVR"),
      timestamp: nowISO(),
      actor: session.username,
      recordId,
      action,
      previousState,
      newState: nextState,
      reason
    };

    state.overrides.unshift(overrideEvent);

    addAudit("LOCAL_EXECUTIVE_OVERRIDE", {
      recordId,
      previousState,
      newState: nextState,
      justification: reason
    });

    persist();
    renderAll();

    setMessage(
      "override-message",
      `Cambio local aplicado: ${previousState} → ${nextState}. No constituye una orden autenticada por un servidor.`,
      "success"
    );
  }

  /* ==========================================================
     GLOBAL EVENT HANDLERS
     ========================================================== */

  function bindEvents() {
    $("login-form")?.addEventListener("submit", handleLogin);
    $("logout-button")?.addEventListener("click", logout);

    $("record-form")?.addEventListener("submit", handleRecordSubmit);
    $("transfer-form")?.addEventListener("submit", createProposalTransfer);
    $("override-form")?.addEventListener("submit", executeOverride);

    $("registry-search")?.addEventListener("input", renderRegistry);
    $("registry-status")?.addEventListener("change", renderRegistry);
    $("audit-search")?.addEventListener("input", renderAudit);
    $("archives-search")?.addEventListener("input", filterArchives);

    $("new-record-button")?.addEventListener("click", () => {
      setHidden($("record-form-panel"), false);
      $("record-form-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    $("cancel-record-button")?.addEventListener("click", () => {
      setHidden($("record-form-panel"), true);
    });

    $("table-view-button")?.addEventListener("click", () => {
      registryView = "table";
      $("table-view-button")?.classList.add("active");
      $("card-view-button")?.classList.remove("active");
      renderRegistry();
    });

    $("card-view-button")?.addEventListener("click", () => {
      registryView = "cards";
      $("card-view-button")?.classList.add("active");
      $("table-view-button")?.classList.remove("active");
      renderRegistry();
    });

    $("encode-button")?.addEventListener("click", handleEncode);
    $("decode-button")?.addEventListener("click", handleDecode);
    $("cipher-clear-button")?.addEventListener("click", clearCipher);

    $("cipher-copy-button")?.addEventListener("click", () => {
      copyText($("cipher-output")?.value || "", "cipher-message");
    });

    $("transfer-copy-button")?.addEventListener("click", () => {
      copyText($("transfer-output")?.value || "", "transfer-message");
    });

    $("import-transfer-button")?.addEventListener("click", importProposalTransfer);

    $("view-catalog-button")?.addEventListener("click", () => {
      renderCatalog();
      $("admin-output")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    $("generate-update-button")?.addEventListener("click", exportLocalData);
    $("override-open-button")?.addEventListener("click", openOverride);
    $("console-clear-button")?.addEventListener("click", renderConsole);

    $$("[data-page]").forEach((button) => {
      button.addEventListener("click", () => {
        const page = button.dataset.page;
        if (page) navigate(page);
      });
    });

    $$("[data-cipher-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        cipherMode = button.dataset.cipherMode;
        renderCipherMode();
      });
    });

    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;

      const { action, id, state: nextState, decision } = button.dataset;

      switch (action) {
        case "view-record":
          viewRecord(id);
          break;

        case "close-detail":
          setHidden($("record-detail"), true);
          break;

        case "approve-proposal":
          activateProposal(id);
          break;

        case "reject-proposal":
          rejectProposal(id);
          break;

        case "record-state":
          changeRecordState(id, nextState);
          break;

        case "resolve-appeal":
          resolveAppeal(id, decision);
          break;

        case "create-appeal":
          createAppeal(id);
          break;

        case "export-update":
          exportLocalData();
          break;
      }
    });
  }

  function filterArchives() {
    const target = $("archives-list");
    if (!target) return;

    renderArchives();

    const query = safeText($("archives-search")?.value).toLowerCase();
    if (!query) return;

    $$(".archive-item", target).forEach((item) => {
      item.hidden = !item.textContent.toLowerCase().includes(query);
    });
  }

  /* ==========================================================
     FULL RENDER
     ========================================================== */

  function renderAll() {
    renderDashboard();
    renderRegistry();
    renderAudit();
    renderConsole();
    renderArchives();
    renderCatalog();
    renderAppeals();
    renderProposalsForReview();
    renderCipherMode();

    if ($("metric-total")) {
      $("metric-total").textContent = state.records.length;
    }

    if ($("metric-active")) {
      $("metric-active").textContent =
        state.records.filter((item) => item.status === "ACTIVE").length;
    }

    if ($("metric-pending")) {
      $("metric-pending").textContent =
        state.proposals.filter((item) => item.status === "PENDING REVIEW").length;
    }

    if ($("metric-appeals")) {
      $("metric-appeals").textContent =
        state.appeals.filter((item) => item.status === "UNDER REVIEW").length;
    }
  }

  function initialise() {
    initialiseCategorySelects();
    bindEvents();

    // Populate the fixed catalog immediately.
    renderCatalog();

    // Restore only the local UI session, never an authenticated identity.
    if (restoreSession()) {
      showApplication();
    } else {
      showLogin();
    }

    console.info("[D64] Interface initialised.");
    console.info("[D64] This build does not provide secure authentication or shared backend storage.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise);
  } else {
    initialise();
  }
})();
