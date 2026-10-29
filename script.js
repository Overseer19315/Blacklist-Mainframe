
/* =========================================================
   DIVI-64 // BLACKLIST MAINFRAME
   Core System V1.2
   ========================================================= */

(() => {
  "use strict";

  const STORAGE_KEY = "D64_BLACKLIST_MAINFRAME_V1";
  const SESSION_KEY = "D64_BLACKLIST_SESSION_V1";

  const CREDENTIALS = {
    CO: "CO-19315",
    COS: "201322"
  };

  const $ = (id) => document.getElementById(id);

  const now = () => new Date().toISOString();

  const date = (value) => {
    if (!value) return "—";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? "—"
      : parsed.toLocaleString();
  };

  const uid = (prefix) =>
    `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36).slice(2, 6).toUpperCase()}`;

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const textValue = (id) => $(id)?.value.trim() || "";

  const setMessage = (id, message, error = false) => {
    const element = $(id);
    if (!element) return;
    element.textContent = message;
    element.style.color = error ? "#d96a73" : "#9dc3aa";
  };

  const severityLabel = (level) => {
    const labels = {
      1: "LEVEL 1 — LOW",
      2: "LEVEL 2 — MODERATE",
      3: "LEVEL 3 — HIGH",
      4: "LEVEL 4 — SEVERE",
      5: "LEVEL 5 — CRITICAL"
    };
    return labels[level] || "UNSPECIFIED";
  };

  const categoryLabel = (value) => ({
    conduct: "MISCONDUCT",
    security: "SECURITY VIOLATION",
    abuse: "ABUSE OF AUTHORITY",
    sabotage: "SABOTAGE",
    fraud: "FRAUD / DECEPTION",
    other: "OTHER"
  })[value] || value || "—";

  const appealGroundLabel = (value) => ({
    "new-evidence": "NEW EVIDENCE",
    "procedural-error": "PROCEDURAL ERROR",
    "incorrect-finding": "INCORRECT FINDING",
    "severity-dispute": "SEVERITY DISPUTE",
    other: "OTHER GROUNDS"
  })[value] || value || "—";

  const stateLabel = (state) => ({
    pending_authorization: "PENDING AUTHORIZATION",
    rejected: "REJECTED",
    under_review: "UNDER REVIEW",
    proposal_pending: "PROPOSAL PENDING COS",
    active: "ACTIVE",
    closed: "CLOSED",
    appeal_pending: "PENDING APPEAL AUTHORIZATION",
    under_appeal_review: "UNDER REVIEW FOR APPEAL",
    appeal_proposal_pending: "APPEAL PROPOSAL PENDING COS",
    appeal_denied: "APPEAL DENIED",
    appeal_upheld: "APPEAL UPHELD"
  })[state] || String(state || "UNKNOWN").replaceAll("_", " ").toUpperCase();

  function freshDatabase() {
    return {
      version: 12,
      requests: [],
      cases: [],
      appeals: [],
      proposals: [],
      audit: [],
      console: [],
      sequence: 0
    };
  }

  function loadDatabase() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return freshDatabase();

      const parsed = JSON.parse(raw);
      const defaults = freshDatabase();

      return {
        ...defaults,
        ...parsed,
        requests: Array.isArray(parsed.requests) ? parsed.requests : [],
        cases: Array.isArray(parsed.cases) ? parsed.cases : [],
        appeals: Array.isArray(parsed.appeals) ? parsed.appeals : [],
        proposals: Array.isArray(parsed.proposals) ? parsed.proposals : [],
        audit: Array.isArray(parsed.audit) ? parsed.audit : [],
        console: Array.isArray(parsed.console) ? parsed.console : []
      };
    } catch (error) {
      console.error("Database loading failed:", error);
      return freshDatabase();
    }
  }

  let db = loadDatabase();
  let session = null;
  let selectedRegistryView = "table";
  let selectedRequestId = null;
  let selectedReviewId = null;
  let selectedAppealId = null;
  let selectedAppealDetailId = null;
  let selectedArchiveId = null;

  function saveDatabase() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      return true;
    } catch (error) {
      console.error("Database saving failed:", error);
      alert("Unable to save records in this browser. Export your records if possible.");
      return false;
    }
  }

  function logEvent(event, details = {}) {
    const entry = {
      id: uid("AUD"),
      timestamp: now(),
      actor: session?.authority || "SYSTEM",
      event,
      details
    };

    db.audit.unshift(entry);
    db.audit = db.audit.slice(0, 3000);

    db.console.unshift(
      `[${date(entry.timestamp)}] ${entry.actor} :: ${event}`
    );
    db.console = db.console.slice(0, 1500);
  }

  function commit(event, details = {}) {
    logEvent(event, details);
    saveDatabase();
    renderAll();
  }

  function isCO() {
    return session?.authority === "CO";
  }

  function isCOS() {
    return session?.authority === "COS";
  }

  function requireCO() {
    if (!isCO()) {
      alert("This operation requires an active CO session.");
      return false;
    }
    return true;
  }

  function requireCOS() {
    if (!isCOS()) {
      alert("COS authority is required for this operation.");
      return false;
    }
    return true;
  }

  function findRequest(id) {
    return db.requests.find((item) => item.id === id);
  }

  function findCase(id) {
    return db.cases.find((item) => item.id === id);
  }

  function findAppeal(id) {
    return db.appeals.find((item) => item.id === id);
  }

  function findRecord(id) {
    return findCase(id) || findRequest(id) || findAppeal(id);
  }

  function updateSessionUI() {
    if ($("session-authority")) {
      $("session-authority").textContent = session?.authority || "AUTHORITY";
    }

    if ($("session-clearance")) {
      $("session-clearance").textContent =
        session?.authority === "COS" ? "CL-OMNI" :
        session?.authority === "CO" ? "CL-5" : "CL-0";
    }

    const cosOnly = [
      "override-open-button",
      "override-panel"
    ];

    cosOnly.forEach((id) => {
      const element = $(id);
      if (element) element.hidden = !isCOS();
    });

    document.querySelectorAll("[data-cos-only]").forEach((element) => {
      element.hidden = !isCOS();
    });

    document.querySelectorAll("[data-co-only]").forEach((element) => {
      element.hidden = !isCO();
    });
  }

  /* =======================================================
     LOGIN
     ======================================================= */

  function login(authority, password) {
    if (!Object.hasOwn(CREDENTIALS, authority) ||
        CREDENTIALS[authority] !== password) {
      setMessage("login-error", "ACCESS DENIED — INVALID CREDENTIALS", true);
      return;
    }

    session = {
      authority,
      startedAt: now()
    };

    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      console.warn("Session storage unavailable.");
    }

    $("login-screen").hidden = true;
    $("app").hidden = false;
    setMessage("login-error", "");

    logEvent("SESSION OPENED", { authority });
    saveDatabase();
    updateSessionUI();
    renderAll();
    showPage("dashboard");
  }

  function logout() {
    if (session) {
      logEvent("SESSION TERMINATED", {
        authority: session.authority
      });
      saveDatabase();
    }

    session = null;

    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (error) {
      console.warn("Session storage unavailable.");
    }

    $("app").hidden = true;
    $("login-screen").hidden = false;
    $("password").value = "";
    setMessage("login-error", "");
  }

  $("login-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    login(textValue("username").toUpperCase(), textValue("password"));
  });

  $("logout-button")?.addEventListener("click", logout);

  /* =======================================================
     NAVIGATION
     ======================================================= */

  function showPage(name) {
    document.querySelectorAll(".page-section").forEach((section) => {
      section.classList.toggle("active", section.id === `page-${name}`);
    });

    document.querySelectorAll(".nav-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.page === name);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => showPage(button.dataset.page));
  });

  /* =======================================================
     BLACKLIST REQUEST SUBMISSION
     ======================================================= */

  $("new-record-button")?.addEventListener("click", () => {
    if (!requireCO() && !requireCOS()) return;
    $("record-form-panel").hidden = false;
    $("record-form-panel").scrollIntoView({ behavior: "smooth" });
  });

  $("cancel-record-button")?.addEventListener("click", () => {
    $("record-form-panel").hidden = true;
    $("record-form").reset();
    setMessage("record-form-message", "");
  });

  $("record-form")?.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!session) return;
    if (!isCO() && !isCOS()) return;

    const category = textValue("record-category");
    const subject = textValue("record-subject");
    const severity = Number(textValue("record-severity"));
    const reason = textValue("record-reason");
    const evidence = textValue("record-evidence");
    const justification = textValue("record-justification");

    if (!category || !subject || !reason || !justification ||
        !Number.isInteger(severity) || severity < 1 || severity > 5) {
      setMessage("record-form-message", "Complete all required fields.", true);
      return;
    }

    const request = {
      id: uid("BLR"),
      type: "blacklist_request",
      category,
      subject,
      severity,
      reason,
      evidence,
      justification,
      submittedBy: session.authority,
      createdAt: now(),
      updatedAt: now(),
      state: "pending_authorization",
      reviewHistory: [],
      verdictHistory: [],
      appealIds: []
    };

    db.requests.unshift(request);

    commit("BLACKLIST REQUEST SUBMITTED", {
      requestId: request.id,
      subject,
      severity,
      state: request.state
    });

    $("record-form").reset();
    $("record-form-panel").hidden = true;
    setMessage("record-form-message", "Request submitted.");
    showPage("requests");
    openRequest(request.id);
  });

  /* =======================================================
     DECODER / PROPOSAL GENERATION
     ======================================================= */

  function encodeText(text, format) {
    if (format === "decimal") {
      return [...new TextEncoder().encode(text)]
        .map((byte) => String(byte).padStart(3, "0"))
        .join(" ");
    }

    if (format === "hex") {
      return [...new TextEncoder().encode(text)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(" ");
    }

    if (format === "base64") {
      const bytes = new TextEncoder().encode(text);
      let binary = "";
      bytes.forEach((byte) => binary += String.fromCharCode(byte));
      return btoa(binary);
    }

    throw new Error("Unknown encoding format.");
  }

  function decodeText(text, format) {
    if (format === "decimal") {
      const values = text.trim().split(/\s+/).filter(Boolean).map(Number);
      if (!values.length || values.some((n) =>
        !Number.isInteger(n) || n < 0 || n > 255)) {
        throw new Error("Invalid decimal byte sequence.");
      }
      return new TextDecoder().decode(new Uint8Array(values));
    }

    if (format === "hex") {
      const clean = text.replace(/\s+/g, "");
      if (!clean || clean.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(clean)) {
        throw new Error("Invalid hexadecimal sequence.");
      }

      const bytes = new Uint8Array(clean.match(/.{2}/g).map((byte) =>
        parseInt(byte, 16)
      ));
      return new TextDecoder().decode(bytes);
    }

    if (format === "base64") {
      const binary = atob(text.trim());
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }

    throw new Error("Unknown encoding format.");
  }

  $("encode-button")?.addEventListener("click", () => {
    try {
      $("cipher-output").value =
        encodeText(textValue("cipher-input"), $("cipher-format").value);
      setMessage("cipher-message", "Encoding completed.");
    } catch (error) {
      setMessage("cipher-message", error.message, true);
    }
  });

  $("decode-button")?.addEventListener("click", () => {
    try {
      $("cipher-output").value =
        decodeText(textValue("cipher-input"), $("cipher-format").value);
      setMessage("cipher-message", "Decoding completed.");
    } catch (error) {
      setMessage("cipher-message", error.message, true);
    }
  });

  $("cipher-clear-button")?.addEventListener("click", () => {
    $("cipher-input").value = "";
    $("cipher-output").value = "";
    setMessage("cipher-message", "");
  });

  async function copyText(value, messageId) {
    if (!value) {
      setMessage(messageId, "Nothing to copy.", true);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setMessage(messageId, "Copied to clipboard.");
    } catch (error) {
      const temporary = document.createElement("textarea");
      temporary.value = value;
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.appendChild(temporary);
      temporary.select();

      const copied = document.execCommand("copy");
      temporary.remove();

      setMessage(
        messageId,
        copied ? "Copied to clipboard." : "Copy failed. Select and copy manually.",
        !copied
      );
    }
  }

  $("cipher-copy-button")?.addEventListener("click", () =>
    copyText($("cipher-output").value, "cipher-message")
  );

  const PROPOSAL_TYPES = {
    "authorize-review": "AUTHORIZE FORMAL REVIEW",
    "reject-request": "REJECT REQUEST",
    "issue-blacklist": "ISSUE BLACKLIST",
    "reject-blacklist": "REJECT BLACKLIST",
    "authorize-appeal-review": "AUTHORIZE APPEAL REVIEW",
    "uphold-appeal": "UPHOLD APPEAL",
    "deny-appeal": "DENY APPEAL"
  };

  $("proposal-form")?.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!requireCO()) return;

    const recordId = textValue("proposal-record-id");
    const type = textValue("proposal-type");
    const analysis = textValue("proposal-analysis");
    const recommendation = textValue("proposal-recommendation");
    const record = findRecord(recordId);

    if (!record) {
      setMessage("proposal-message", "Record not found. Check the exact ID.", true);
      return;
    }

    if (!PROPOSAL_TYPES[type] || !analysis || !recommendation) {
      setMessage("proposal-message", "Complete all proposal fields.", true);
      return;
    }

    if (!isValidProposalTarget(record, type)) return;

    const proposal = {
      id: uid("PROP"),
      recordId,
      type,
      analysis,
      recommendation,
      createdBy: session.authority,
      createdAt: now(),
      state: "pending_cos_decision"
    };

    db.proposals.unshift(proposal);

    record.reviewHistory ||= [];
    record.reviewHistory.push({
      timestamp: now(),
      actor: session.authority,
      action: "PROPOSAL SUBMITTED",
      proposalId: proposal.id,
      type
    });

    const output = [
      "DIVI-64 // EXECUTIVE PROPOSAL",
      "----------------------------------------",
      `PROPOSAL ID: ${proposal.id}`,
      `RECORD ID: ${record.id}`,
      `SUBMITTED BY: ${session.authority}`,
      `SUBMITTED AT: ${date(proposal.createdAt)}`,
      `PROPOSED ACTION: ${PROPOSAL_TYPES[type]}`,
      `SUBJECT: ${record.subject || "—"}`,
      `SEVERITY: ${record.severity ? severityLabel(record.severity) : "N/A"}`,
      "----------------------------------------",
      "CO ANALYSIS:",
      analysis,
      "",
      "RECOMMENDATION & JUSTIFICATION:",
      recommendation,
      "----------------------------------------",
      "STATUS: AWAITING COS DECISION",
      "NOTICE: THIS DOCUMENT IS A PROPOSAL, NOT A FINAL VERDICT."
    ].join("\n");

    proposal.output = output;
    $("proposal-output").value = output;

    commit("CO PROPOSAL SUBMITTED", {
      proposalId: proposal.id,
      recordId,
      proposedAction: type
    });

    setMessage("proposal-message", `Proposal ${proposal.id} generated.`);
  });

  function isValidProposalTarget(record, type) {
    const isAppeal = record.type === "appeal";

    const allowed = {
      "authorize-review": !isAppeal && record.state === "pending_authorization",
      "reject-request": !isAppeal && record.state === "pending_authorization",
      "issue-blacklist": !isAppeal && record.state === "under_review",
      "reject-blacklist": !isAppeal && record.state === "under_review",
      "authorize-appeal-review": isAppeal && record.state === "appeal_pending",
      "uphold-appeal": isAppeal && record.state === "under_appeal_review",
      "deny-appeal": isAppeal && record.state === "under_appeal_review"
    };

    if (!allowed[type]) {
      setMessage(
        "proposal-message",
        "This action does not match the record's current state.",
        true
      );
      return false;
    }

    return true;
  }

  $("proposal-copy-button")?.addEventListener("click", () =>
    copyText($("proposal-output").value, "proposal-message")
  );

  $("proposal-export-button")?.addEventListener("click", () => {
    const content = $("proposal-output").value;
    if (!content) {
      setMessage("proposal-message", "Generate a proposal first.", true);
      return;
    }
    downloadText("D64-proposal.txt", content);
    setMessage("proposal-message", "Proposal exported.");
  });

  /* =======================================================
     COS DECISION ENGINE
     ======================================================= */

  function authorizeReview(requestId) {
    if (!requireCOS()) return;

    const request = findRequest(requestId);
    if (!request || request.state !== "pending_authorization") {
      alert("This request is no longer awaiting authorization.");
      return;
    }

    request.state = "under_review";
    request.updatedAt = now();
    request.reviewHistory.push({
      timestamp: now(),
      actor: session.authority,
      action: "REVIEW AUTHORIZED"
    });

    commit("REVIEW AUTHORIZED", { requestId });
  }

  function rejectRequest(requestId) {
    if (!requireCOS()) return;

    const request = findRequest(requestId);
    if (!request || request.state !== "pending_authorization") {
      alert("This request is no longer awaiting authorization.");
      return;
    }

    const reason = prompt("Enter the reason for rejecting this request:");
    if (reason === null) return;
    if (!reason.trim()) {
      alert("A reason is required.");
      return;
    }

    request.state = "rejected";
    request.updatedAt = now();
    request.rejectionReason = reason.trim();
    request.verdictHistory.push({
      timestamp: now(),
      actor: session.authority,
      verdict: "REQUEST REJECTED",
      reason: reason.trim()
    });

    commit("REQUEST REJECTED", {
      requestId,
      reason: reason.trim()
    });
  }

  function finalizeBlacklist(requestId, outcome) {
    if (!requireCOS()) return;

    const request = findRequest(requestId);
    if (!request || request.state !== "under_review") {
      alert("This request is not under review.");
      return;
    }

    const verdict = outcome === "issue" ? "BLACKLIST ISSUED" : "REQUEST REJECTED";
    const reason = prompt(`Enter the final verdict justification (${verdict}):`);
    if (reason === null) return;
    if (!reason.trim()) {
      alert("A final justification is required.");
      return;
    }

    request.updatedAt = now();
    request.verdictHistory.push({
      timestamp: now(),
      actor: session.authority,
      verdict,
      reason: reason.trim()
    });

    if (outcome === "issue") {
      request.state = "active";

      const existing = findCase(request.id);
      if (!existing) {
        db.cases.unshift({
          ...request,
          type: "blacklist_case",
          issuedAt: now(),
          issuedBy: session.authority,
          finalJustification: reason.trim(),
          state: "active"
        });
      }
    } else {
      request.state = "rejected";
      request.rejectionReason = reason.trim();
    }

    commit(verdict, {
      requestId,
      subject: request.subject,
      reason: reason.trim()
    });
  }

  function authorizeAppeal(appealId) {
    if (!requireCOS()) return;

    const appeal = findAppeal(appealId);
    if (!appeal || appeal.state !== "appeal_pending") {
      alert("This appeal is not awaiting authorization.");
      return;
    }

    appeal.state = "under_appeal_review";
    appeal.updatedAt = now();
    appeal.history.push({
      timestamp: now(),
      actor: session.authority,
      action: "APPEAL REVIEW AUTHORIZED"
    });

    commit("APPEAL REVIEW AUTHORIZED", { appealId });
  }

  function decideAppeal(appealId, outcome) {
    if (!requireCOS()) return;

    const appeal = findAppeal(appealId);
    if (!appeal || appeal.state !== "under_appeal_review") {
      alert("This appeal is not under review.");
      return;
    }

    const caseRecord = findCase(appeal.originalCaseId);
    if (!caseRecord) {
      alert("Original case could not be found.");
      return;
    }

    const upheld = outcome === "uphold";
    const verdict = upheld ? "APPEAL UPHELD" : "APPEAL DENIED";
    const reason = prompt(`Enter the final appeal verdict justification (${verdict}):`);

    if (reason === null) return;
    if (!reason.trim()) {
      alert("A final justification is required.");
      return;
    }

    appeal.state = upheld ? "closed" : "appeal_denied";
    appeal.verdict = verdict;
    appeal.verdictReason = reason.trim();
    appeal.decidedBy = session.authority;
    appeal.decidedAt = now();
    appeal.updatedAt = now();

    appeal.history.push({
      timestamp: now(),
      actor: session.authority,
      action: verdict,
      reason: reason.trim()
    });

    if (upheld) {
      caseRecord.state = "closed";
      caseRecord.closedAt = now();
      caseRecord.closureReason = "Appeal upheld: " + reason.trim();
    }

    commit(verdict, {
      appealId,
      originalCaseId: appeal.originalCaseId,
      reason: reason.trim()
    });
  }

  /* =======================================================
     REQUEST DETAILS AND ACTIONS
     ======================================================= */

  function openRequest(id) {
    const request = findRequest(id);
    if (!request) return;

    selectedRequestId = id;

    const container = $("request-detail");
    if (!container) return;

    container.hidden = false;
    container.innerHTML = `
      <div class="panel-heading">
        <div>
          <p class="eyebrow">REQUEST DOSSIER</p>
          <h3>${escapeHTML(request.id)}</h3>
        </div>
        <span class="status-chip ${request.state === "rejected" ? "rejected" : "pending"}">
          ${escapeHTML(stateLabel(request.state))}
        </span>
      </div>

      <dl>
        <dt>SUBJECT</dt><dd>${escapeHTML(request.subject)}</dd>
        <dt>CATEGORY</dt><dd>${escapeHTML(categoryLabel(request.category))}</dd>
        <dt>SEVERITY</dt><dd>${escapeHTML(severityLabel(request.severity))}</dd>
        <dt>GROUNDS</dt><dd>${escapeHTML(request.reason)}</dd>
        <dt>EVIDENCE</dt><dd>${escapeHTML(request.evidence || "No evidence provided")}</dd>
        <dt>JUSTIFICATION</dt><dd>${escapeHTML(request.justification)}</dd>
        <dt>SUBMITTED BY</dt><dd>${escapeHTML(request.submittedBy)}</dd>
        <dt>CREATED</dt><dd>${escapeHTML(date(request.createdAt))}</dd>
      </dl>

      <div class="form-actions" id="request-action-buttons"></div>
      <h3 style="margin-top:22px">Review & Verdict History</h3>
      <div class="activity-list">
        ${(request.reviewHistory || []).concat(request.verdictHistory || []).map(item => `
          <div class="activity-item">
            <strong>${escapeHTML(item.action || item.verdict || "EVENT")}</strong>
            <small>${escapeHTML(item.actor || "SYSTEM")} · ${escapeHTML(date(item.timestamp))}</small>
            ${item.reason ? `<small>${escapeHTML(item.reason)}</small>` : ""}
          </div>
        `).join("") || '<div class="empty-state">NO HISTORY YET</div>'}
      </div>
    `;

    const actions = container.querySelector("#request-action-buttons");

    if (request.state === "pending_authorization" && isCOS()) {
      actions.append(
        actionButton("AUTHORIZE REVIEW", () => authorizeReview(id), "primary-button"),
        actionButton("REJECT REQUEST", () => rejectRequest(id), "subtle-button")
      );
    }

    if (request.state === "under_review" && isCOS()) {
      actions.append(
        actionButton("ISSUE BLACKLIST", () => finalizeBlacklist(id, "issue"), "primary-button"),
        actionButton("REJECT REQUEST", () => finalizeBlacklist(id, "reject"), "subtle-button")
      );
    }

    container.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function actionButton(label, callback, className = "secondary-button") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", callback);
    return button;
  }

  /* =======================================================
     APPEAL SUBMISSION AND HISTORY
     ======================================================= */

  $("new-review-button")?.addEventListener("click", () => {
    if (!session) return;
    $("review-form-panel").hidden = false;
    $("review-form-panel").scrollIntoView({ behavior: "smooth" });
  });

  $("cancel-review-button")?.addEventListener("click", () => {
    $("review-form-panel").hidden = true;
    $("review-form").reset();
    setMessage("review-form-message", "");
  });

  $("review-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!session) return;

    const originalCaseId = textValue("review-record-id");
    const appealType = textValue("review-type");
    const reason = textValue("review-reason");
    const evidence = textValue("review-evidence");
    const originalCase = findCase(originalCaseId);

    if (!originalCase) {
      setMessage("review-form-message", "Original active blacklist case not found.", true);
      return;
    }

    if (originalCase.state !== "active") {
      setMessage("review-form-message", "Only an active case can receive a new appeal.", true);
      return;
    }

    if (!appealType || !reason) {
      setMessage("review-form-message", "Complete the required fields.", true);
      return;
    }

    const previousAppeals = db.appeals.filter((appeal) =>
      appeal.originalCaseId === originalCaseId
    );

    const previousDenied = previousAppeals.some((appeal) =>
      appeal.state === "appeal_denied"
    );

    const appeal = {
      id: uid("APL"),
      type: "appeal",
      originalCaseId,
      appealNumber: previousAppeals.length + 1,
      category: appealType,
      reason,
      evidence,
      submittedBy: session.authority,
      createdAt: now(),
      updatedAt: now(),
      state: "appeal_pending",
      history: [{
        timestamp: now(),
        actor: session.authority,
        action: previousDenied
          ? "REAPPEAL SUBMITTED"
          : "APPEAL SUBMITTED"
      }]
    };

    db.appeals.unshift(appeal);
    originalCase.appealIds ||= [];
    originalCase.appealIds.push(appeal.id);

    commit(previousDenied ? "REAPPEAL SUBMITTED" : "APPEAL SUBMITTED", {
      appealId: appeal.id,
      originalCaseId,
      appealNumber: appeal.appealNumber
    });

    $("review-form").reset();
    $("review-form-panel").hidden = true;
    setMessage("review-form-message", `Appeal ${appeal.id} submitted.`);
    openAppeal(appeal.id);
  });

  function openAppeal(id) {
    const appeal = findAppeal(id);
    if (!appeal) return;

    selectedAppealDetailId = id;

    const container = $("appeal-detail");
    if (!container) return;

    const originalCase = findCase(appeal.originalCaseId);

    container.hidden = false;
    container.innerHTML = `
      <div class="panel-heading">
        <div>
          <p class="eyebrow">APPEAL DOSSIER · ${escapeHTML(appeal.appealNumber)}</p>
          <h3>${escapeHTML(appeal.id)}</h3>
        </div>
        <span class="status-chip ${appeal.state === "closed" ? "closed" : "pending"}">
          ${escapeHTML(stateLabel(appeal.state))}
        </span>
      </div>

      <dl>
        <dt>ORIGINAL CASE</dt><dd>${escapeHTML(appeal.originalCaseId)}</dd>
        <dt>SUBJECT</dt><dd>${escapeHTML(originalCase?.subject || "Unknown")}</dd>
        <dt>APPEAL GROUNDS</dt><dd>${escapeHTML(appealGroundLabel(appeal.category))}</dd>
        <dt>APPEAL STATEMENT</dt><dd>${escapeHTML(appeal.reason)}</dd>
        <dt>SUPPORTING EVIDENCE</dt><dd>${escapeHTML(appeal.evidence || "None supplied")}</dd>
        <dt>SUBMITTED BY</dt><dd>${escapeHTML(appeal.submittedBy)}</dd>
        <dt>SUBMITTED</dt><dd>${escapeHTML(date(appeal.createdAt))}</dd>
        <dt>VERDICT</dt><dd>${escapeHTML(appeal.verdict || "PENDING")}</dd>
        <dt>VERDICT REASON</dt><dd>${escapeHTML(appeal.verdictReason || "—")}</dd>
      </dl>

      <div class="form-actions" id="appeal-action-buttons"></div>

      <h3 style="margin-top:22px">Appeal Chronology</h3>
      <div class="activity-list">
        ${(appeal.history || []).map(item => `
          <div class="activity-item">
            <strong>${escapeHTML(item.action)}</strong>
            <small>${escapeHTML(item.actor)} · ${escapeHTML(date(item.timestamp))}</small>
            ${item.reason ? `<small>${escapeHTML(item.reason)}</small>` : ""}
          </div>
        `).join("")}
      </div>
    `;

    const actions = container.querySelector("#appeal-action-buttons");

    if (appeal.state === "appeal_pending" && isCOS()) {
      actions.append(
        actionButton("AUTHORIZE APPEAL REVIEW", () => authorizeAppeal(id), "primary-button"),
        actionButton("REJECT APPEAL REVIEW", () => rejectAppealBeforeReview(id), "subtle-button")
      );
    }

    if (appeal.state === "under_appeal_review" && isCOS()) {
      actions.append(
        actionButton("UPHOLD APPEAL", () => decideAppeal(id, "uphold"), "primary-button"),
        actionButton("DENY APPEAL", () => decideAppeal(id, "deny"), "subtle-button")
      );
    }

    container.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function rejectAppealBeforeReview(id) {
    if (!requireCOS()) return;

    const appeal = findAppeal(id);
    if (!appeal || appeal.state !== "appeal_pending") return;

    const reason = prompt("Reason for rejecting appeal review authorization:");
    if (reason === null) return;
    if (!reason.trim()) {
      alert("A reason is required.");
      return;
    }

    appeal.state = "appeal_denied";
    appeal.verdict = "APPEAL REVIEW NOT AUTHORIZED";
    appeal.verdictReason = reason.trim();
    appeal.decidedBy = session.authority;
    appeal.decidedAt = now();
    appeal.updatedAt = now();
    appeal.history.push({
      timestamp: now(),
      actor: session.authority,
      action: "APPEAL REVIEW NOT AUTHORIZED",
      reason: reason.trim()
    });

    commit("APPEAL REVIEW AUTHORIZATION REJECTED", {
      appealId: id,
      reason: reason.trim()
    });
  }

  /* =======================================================
     TRANSFER TOOLS
     ======================================================= */

  $("transfer-form")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const transfer = {
      schema: "D64-CASE-TRANSFER-1",
      recordId: textValue("transfer-record-id"),
      category: textValue("transfer-category"),
      subject: textValue("transfer-subject"),
      reason: textValue("transfer-reason"),
      evidence: textValue("transfer-evidence"),
      justification: textValue("transfer-justification"),
      exportedAt: now(),
      exportedBy: session?.authority || "UNAUTHENTICATED"
    };

    $("transfer-output").value = JSON.stringify(transfer, null, 2);
    setMessage("transfer-message", "Transfer data generated.");
  });

  $("transfer-copy-button")?.addEventListener("click", () =>
    copyText($("transfer-output").value, "transfer-message")
  );

  $("import-transfer-button")?.addEventListener("click", () => {
    try {
      const data = JSON.parse(textValue("transfer-import-input"));

      if (!data || data.schema !== "D64-CASE-TRANSFER-1" ||
          typeof data.recordId !== "string" ||
          typeof data.subject !== "string") {
        throw new Error("Unsupported transfer format.");
      }

      $("transfer-record-id").value = data.recordId;
      $("transfer-category").value = data.category || "";
      $("transfer-subject").value = data.subject || "";
      $("transfer-reason").value = data.reason || "";
      $("transfer-evidence").value = data.evidence || "";
      $("transfer-justification").value = data.justification || "";

      setMessage("transfer-message", "Transfer data imported into the form. It has not been registered.");
    } catch (error) {
      setMessage("transfer-message", "Invalid transfer data.", true);
    }
  });

  /* =======================================================
     REGISTRY VIEW
     ======================================================= */

  function renderRegistry() {
    const query = textValue("registry-search").toLowerCase();
    const status = $("registry-status")?.value || "all";

    const records = db.cases.filter((item) => {
      const matchesQuery = [
        item.id, item.subject, item.reason, item.category
      ].join(" ").toLowerCase().includes(query);

      const matchesStatus = status === "all" ||
        (status === "active" && item.state === "active") ||
        (status === "closed" && item.state === "closed");

      return matchesQuery && matchesStatus;
    });

    if ($("registry-table-body")) {
      $("registry-table-body").innerHTML = records.map((record) => `
        <tr>
          <td>${escapeHTML(record.id)}</td>
          <td>${escapeHTML(record.subject)}</td>
          <td>${escapeHTML(severityLabel(record.severity))}</td>
          <td><span class="status-chip ${record.state === "active" ? "active" : "closed"}">${escapeHTML(stateLabel(record.state))}</span></td>
          <td>${escapeHTML(date(record.updatedAt || record.issuedAt))}</td>
          <td><button class="secondary-button" data-open-case="${escapeHTML(record.id)}" type="button">OPEN</button></td>
        </tr>
      `).join("") || emptyRow(6, "NO MATCHING RECORDS");
    }

    if ($("registry-card-container")) {
      $("registry-card-container").innerHTML = records.map((record) => `
        <article class="record-card">
          <p class="eyebrow">${escapeHTML(record.id)}</p>
          <h3>${escapeHTML(record.subject)}</h3>
          <div class="card-meta">
            <span class="status-chip active">${escapeHTML(severityLabel(record.severity))}</span>
            <span class="status-chip">${escapeHTML(stateLabel(record.state))}</span>
          </div>
          <p>${escapeHTML(record.reason)}</p>
          <button class="secondary-button" data-open-case="${escapeHTML(record.id)}" type="button">OPEN DOSSIER</button>
        </article>
      `).join("") || '<div class="empty-state">NO MATCHING RECORDS</div>';
    }
  }

  function openCase(id) {
    const record = findCase(id);
    if (!record) return;

    selectedRegistryView = "table";

    const container = $("record-detail");
    container.hidden = false;

    container.innerHTML = `
      <div class="panel-heading">
        <div>
          <p class="eyebrow">OFFICIAL CASE DOSSIER</p>
          <h3>${escapeHTML(record.id)}</h3>
        </div>
        <span class="status-chip ${record.state === "active" ? "active" : "closed"}">
          ${escapeHTML(stateLabel(record.state))}
        </span>
      </div>
      <dl>
        <dt>SUBJECT</dt><dd>${escapeHTML(record.subject)}</dd>
        <dt>CATEGORY</dt><dd>${escapeHTML(categoryLabel(record.category))}</dd>
        <dt>SEVERITY</dt><dd>${escapeHTML(severityLabel(record.severity))}</dd>
        <dt>GROUNDS</dt><dd>${escapeHTML(record.reason)}</dd>
        <dt>EVIDENCE</dt><dd>${escapeHTML(record.evidence || "—")}</dd>
        <dt>JUSTIFICATION</dt><dd>${escapeHTML(record.justification || "—")}</dd>
        <dt>ISSUED BY</dt><dd>${escapeHTML(record.issuedBy || "—")}</dd>
        <dt>ISSUED</dt><dd>${escapeHTML(date(record.issuedAt))}</dd>
        <dt>CLOSED</dt><dd>${escapeHTML(date(record.closedAt))}</dd>
        <dt>CLOSURE REASON</dt><dd>${escapeHTML(record.closureReason || "—")}</dd>
      </dl>
      <div class="form-actions">
        <button id="case-export-button" class="secondary-button" type="button">EXPORT DOSSIER</button>
        ${record.state === "active" ? '<button id="case-appeal-button" class="secondary-button" type="button">SUBMIT APPEAL</button>' : ""}
      </div>
    `;

    $("case-export-button")?.addEventListener("click", () =>
      downloadText(`${record.id}.json`, JSON.stringify(record, null, 2))
    );

    $("case-appeal-button")?.addEventListener("click", () => {
      $("review-record-id").value = record.id;
      $("review-form-panel").hidden = false;
      showPage("appeals");
      $("review-form-panel").scrollIntoView({ behavior: "smooth" });
    });

    container.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.addEventListener("click", (event) => {
    const caseButton = event.target.closest("[data-open-case]");
    if (caseButton) openCase(caseButton.dataset.openCase);

    const requestButton = event.target.closest("[data-open-request]");
    if (requestButton) openRequest(requestButton.dataset.openRequest);

    const appealButton = event.target.closest("[data-open-appeal]");
    if (appealButton) openAppeal(appealButton.dataset.openAppeal);
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedRegistryView = button.dataset.view;

      document.querySelectorAll("[data-view]").forEach((item) =>
        item.classList.toggle("active", item === button)
      );

      $("registry-table-container").hidden = selectedRegistryView !== "table";
      $("registry-card-container").hidden = selectedRegistryView !== "cards";
      renderRegistry();
    });
  });

  $("registry-search")?.addEventListener("input", renderRegistry);
  $("registry-status")?.addEventListener("change", renderRegistry);

  /* =======================================================
     REQUEST QUEUE AND REVIEW CHAMBER
     ======================================================= */

  function renderRequests() {
    const query = textValue("requests-search").toLowerCase();
    const filter = $("requests-filter")?.value || "all";

    const requests = db.requests.filter((item) => {
      const matches = `${item.id} ${item.subject} ${item.reason}`.toLowerCase().includes(query);
      const stateMatches = filter === "all" ||
        (filter === "pending" && item.state === "pending_authorization") ||
        (filter === "authorized" && ["under_review", "active"].includes(item.state)) ||
        (filter === "rejected" && item.state === "rejected");
      return matches && stateMatches;
    });

    $("requests-table-body").innerHTML = requests.map((request) => `
      <tr>
        <td>${escapeHTML(request.id)}</td>
        <td>${escapeHTML(request.subject)}</td>
        <td>${escapeHTML(severityLabel(request.severity))}</td>
        <td>${escapeHTML(request.submittedBy)}</td>
        <td><span class="status-chip ${request.state === "rejected" ? "rejected" : request.state === "under_review" ? "review" : "pending"}">${escapeHTML(stateLabel(request.state))}</span></td>
        <td><button class="secondary-button" data-open-request="${escapeHTML(request.id)}" type="button">OPEN</button></td>
      </tr>
    `).join("") || emptyRow(6, "NO REQUESTS FOUND");
  }

  function renderReviews() {
    const reviews = db.requests.filter((request) =>
      ["under_review", "proposal_pending"].includes(request.state)
    );

    $("review-count").textContent = db.requests.filter((request) =>
      request.state === "under_review"
    ).length;

    $("review-proposal-count").textContent = db.proposals.filter((proposal) =>
      proposal.state === "pending_cos_decision"
    ).length;

    $("reviews-table-body").innerHTML = reviews.map((request) => `
      <tr>
        <td>${escapeHTML(request.id)}</td>
        <td>${escapeHTML(request.subject)}</td>
        <td>${escapeHTML(severityLabel(request.severity))}</td>
        <td>${escapeHTML(request.submittedBy)}</td>
        <td>${escapeHTML(stateLabel(request.state))}</td>
        <td><button class="secondary-button" data-open-request="${escapeHTML(request.id)}" type="button">OPEN</button></td>
      </tr>
    `).join("") || emptyRow(6, "NO CASES UNDER REVIEW");
  }

  $("requests-search")?.addEventListener("input", renderRequests);
  $("requests-filter")?.addEventListener("change", renderRequests);

  /* =======================================================
     APPEALS LIST
     ======================================================= */

  function renderAppeals() {
    const query = textValue("appeals-search").toLowerCase();
    const filter = $("appeals-filter")?.value || "all";

    const appeals = db.appeals.filter((appeal) => {
      const matches = `${appeal.id} ${appeal.originalCaseId} ${appeal.reason}`.toLowerCase().includes(query);
      const matchesFilter = filter === "all" ||
        (filter === "pending" && appeal.state === "appeal_pending") ||
        (filter === "under-review" && appeal.state === "under_appeal_review") ||
        (filter === "closed" && ["closed", "appeal_denied"].includes(appeal.state));

      return matches && matchesFilter;
    });

    $("appeals-table-body").innerHTML = appeals.map((appeal) => `
      <tr>
        <td>${escapeHTML(appeal.id)}</td>
        <td>${escapeHTML(appeal.originalCaseId)}</td>
        <td>${escapeHTML(appealGroundLabel(appeal.category))}</td>
        <td><span class="status-chip ${appeal.state === "closed" ? "closed" : appeal.state === "under_appeal_review" ? "review" : "pending"}">${escapeHTML(stateLabel(appeal.state))}</span></td>
        <td>${escapeHTML(date(appeal.createdAt))}</td>
        <td><button class="secondary-button" data-open-appeal="${escapeHTML(appeal.id)}" type="button">OPEN</button></td>
      </tr>
    `).join("") || emptyRow(6, "NO APPEALS FOUND");

    $("appeals-list").innerHTML = appeals.length
      ? ""
      : '<div class="empty-state">NO APPEALS FOUND</div>';

    $("appeal-pending-count").textContent = db.appeals.filter((item) =>
      item.state === "appeal_pending"
    ).length;

    $("appeal-review-count").textContent = db.appeals.filter((item) =>
      item.state === "under_appeal_review"
    ).length;

    $("appeal-closed-count").textContent = db.appeals.filter((item) =>
      ["closed", "appeal_denied"].includes(item.state)
    ).length;
  }

  $("appeals-search")?.addEventListener("input", renderAppeals);
  $("appeals-filter")?.addEventListener("change", renderAppeals);

  /* =======================================================
     ARCHIVES
     ======================================================= */

  function renderArchives() {
    const query = textValue("archives-search").toLowerCase();
    const filter = $("archives-category")?.value || "all";

    const records = [
      ...db.requests.filter((item) => item.state === "rejected").map((item) => ({
        ...item, archiveType: "REJECTED REQUEST", archiveId: item.id
      })),
      ...db.cases.filter((item) => item.state === "closed").map((item) => ({
        ...item, archiveType: "CLOSED CASE", archiveId: item.id
      })),
      ...db.appeals.filter((item) => ["closed", "appeal_denied"].includes(item.state)).map((item) => ({
        ...item, archiveType: "CLOSED APPEAL", archiveId: item.id
      }))
    ].filter((item) => {
      const matchesQuery = `${item.archiveId} ${item.subject || ""} ${item.originalCaseId || ""}`.toLowerCase().includes(query);

      const matchesFilter = filter === "all" ||
        (filter === "closed" && item.archiveType === "CLOSED CASE") ||
        (filter === "rejected" && item.archiveType === "REJECTED REQUEST") ||
        (filter === "appeals" && item.archiveType === "CLOSED APPEAL");

      return matchesQuery && matchesFilter;
    });

    $("archives-table-body").innerHTML = records.map((record) => `
      <tr>
        <td>${escapeHTML(record.archiveId)}</td>
        <td>${escapeHTML(record.subject || record.originalCaseId || "—")}</td>
        <td>${escapeHTML(record.archiveType)}</td>
        <td>${escapeHTML(record.verdict || record.rejectionReason || record.closureReason || record.state)}</td>
        <td>${escapeHTML(date(record.closedAt || record.decidedAt || record.updatedAt))}</td>
        <td><button class="secondary-button" data-open-archive="${escapeHTML(record.archiveId)}" type="button">OPEN</button></td>
      </tr>
    `).join("") || emptyRow(6, "NO ARCHIVED RECORDS");

    $("archives-list").innerHTML = "";
  }

  $("archives-search")?.addEventListener("input", renderArchives);
  $("archives-category")?.addEventListener("change", renderArchives);

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-archive]");
    if (!button) return;

    const record = findRecord(button.dataset.openArchive);
    if (!record) return;

    selectedArchiveId = record.id;
    const container = $("archives-list");
    container.innerHTML = `
      <article class="panel">
        <p class="eyebrow">ARCHIVED DOSSIER</p>
        <h3>${escapeHTML(record.id)}</h3>
        <pre class="console-output">${escapeHTML(JSON.stringify(record, null, 2))}</pre>
        <button class="secondary-button" id="archive-export-button" type="button">EXPORT JSON</button>
      </article>
    `;

    $("archive-export-button")?.addEventListener("click", () =>
      downloadText(`${record.id}.json`, JSON.stringify(record, null, 2))
    );
  });

  /* =======================================================
     AUDIT TRAIL
     ======================================================= */

  function renderAudit() {
    const query = textValue("audit-search").toLowerCase();

    const events = db.audit.filter((item) =>
      `${item.id} ${item.actor} ${item.event} ${JSON.stringify(item.details)}`
        .toLowerCase().includes(query)
    );

    $("audit-list").innerHTML = events.map((item) => `
      <div class="activity-item">
        <strong>${escapeHTML(item.event)}</strong>
        <small>${escapeHTML(item.actor)} · ${escapeHTML(date(item.timestamp))} · ${escapeHTML(item.id)}</small>
        <small>${escapeHTML(JSON.stringify(item.details || {}))}</small>
      </div>
    `).join("") || '<div class="empty-state">NO AUDIT EVENTS FOUND</div>';

    $("full-console").textContent = db.console.join("\n") || "No session activity.";
  }

  $("audit-search")?.addEventListener("input", renderAudit);

  $("console-clear-button")?.addEventListener("click", () => {
    if (!session) return;
    if (!confirm("Clear the console display? Audit records will remain unchanged.")) return;

    db.console = [];
    commit("CONSOLE DISPLAY CLEARED", {});
  });

  /* =======================================================
     ADMINISTRATION
     ======================================================= */

  $("view-catalog-button")?.addEventListener("click", () => {
    $("admin-output").textContent = [
      "DIVI-64 // STATUS CATALOGUE",
      "",
      "REQUEST STATES",
      "- PENDING AUTHORIZATION",
      "- UNDER REVIEW",
      "- REJECTED",
      "- ACTIVE",
      "- CLOSED",
      "",
      "APPEAL STATES",
      "- PENDING APPEAL AUTHORIZATION",
      "- UNDER REVIEW FOR APPEAL",
      "- APPEAL DENIED",
      "- APPEAL UPHELD",
      "",
      "AUTHORITY",
      "- CO: REVIEW AND PROPOSALS",
      "- COS: AUTHORIZATION AND FINAL VERDICTS",
      "",
      "SEVERITY",
      ...[1, 2, 3, 4, 5].map((level) => `- ${severityLabel(level)}`)
    ].join("\n");
  });

  $("generate-update-button")?.addEventListener("click", () => {
    if (!session) return;

    const report = {
      generatedAt: now(),
      generatedBy: session.authority,
      totalRequests: db.requests.length,
      activeCases: db.cases.filter((item) => item.state === "active").length,
      closedCases: db.cases.filter((item) => item.state === "closed").length,
      pendingRequests: db.requests.filter((item) => item.state === "pending_authorization").length,
      underReview: db.requests.filter((item) => item.state === "under_review").length,
      totalAppeals: db.appeals.length,
      pendingAppeals: db.appeals.filter((item) => item.state === "appeal_pending").length,
      appealsUnderReview: db.appeals.filter((item) => item.state === "under_appeal_review").length,
      proposals: db.proposals.length
    };

    $("admin-output").textContent = JSON.stringify(report, null, 2);
    downloadText("D64-system-report.json", JSON.stringify(report, null, 2));
    commit("SYSTEM REPORT GENERATED", { generatedBy: session.authority });
  });

  $("override-open-button")?.addEventListener("click", () => {
    if (!requireCOS()) return;
    $("override-panel").hidden = !$("override-panel").hidden;
  });

  $("override-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!requireCOS()) return;

    const recordId = textValue("override-record");
    const action = textValue("override-action");
    const reason = textValue("override-reason");
    const confirmation = textValue("override-confirmation");

    if (confirmation !== "D64 OVERRIDE") {
      setMessage("override-message", 'Confirmation must be exactly: D64 OVERRIDE', true);
      return;
    }

    if (!reason || !action) {
      setMessage("override-message", "Action and reason are required.", true);
      return;
    }

    const record = findRecord(recordId);
    if (!record) {
      setMessage("override-message", "Record not found.", true);
      return;
    }

    const previousState = record.state;

    if (action === "reopen") {
      if (record.type === "appeal") {
        record.state = "appeal_pending";
      } else {
        record.state = "active";
      }
    } else if (action === "close") {
      record.state = "closed";
      record.closedAt = now();
      record.closureReason = reason;
    } else if (action === "return-review") {
      if (record.type === "appeal") {
        record.state = "under_appeal_review";
      } else {
        record.state = "under_review";
      }
    } else {
      setMessage("override-message", "Unsupported action.", true);
      return;
    }

    record.updatedAt = now();

    commit("EXECUTIVE OVERRIDE", {
      recordId,
      previousState,
      newState: record.state,
      action,
      reason
    });

    $("override-form").reset();
    setMessage("override-message", "Override recorded.");
  });

  /* =======================================================
     DASHBOARD AND METRICS
     ======================================================= */

  function renderDashboard() {
    $("metric-total").textContent = db.cases.length;
    $("metric-active").textContent = db.cases.filter((item) => item.state === "active").length;
    $("metric-pending").textContent = db.requests.filter((item) =>
      item.state === "pending_authorization"
    ).length;
    $("metric-appeals").textContent = db.appeals.filter((item) =>
      !["closed", "appeal_denied"].includes(item.state)
    ).length;

    $("nav-request-count").textContent = db.requests.filter((item) =>
      item.state === "pending_authorization"
    ).length;

    $("nav-review-count").textContent = db.requests.filter((item) =>
      item.state === "under_review"
    ).length;

    $("nav-appeal-count").textContent = db.appeals.filter((item) =>
      ["appeal_pending", "under_appeal_review"].includes(item.state)
    ).length;

    const queue = [
      ...db.requests.filter((item) => item.state === "pending_authorization"),
      ...db.appeals.filter((item) => item.state === "appeal_pending")
    ].slice(0, 7);

    $("dashboard-proposals").innerHTML = queue.map((item) => `
      <div class="record-item">
        <div>
          <strong>${escapeHTML(item.id)}</strong>
          <small>${escapeHTML(item.subject || item.originalCaseId || "Appeal")} · ${escapeHTML(stateLabel(item.state))}</small>
        </div>
        <span class="status-chip pending">${escapeHTML(item.type === "appeal" ? "APPEAL" : severityLabel(item.severity))}</span>
      </div>
    `).join("") || '<div class="empty-state">NO PENDING RECORDS</div>';

    $("dashboard-activity").innerHTML = db.audit.slice(0, 7).map((item) => `
      <div class="activity-item">
        <strong>${escapeHTML(item.event)}</strong>
        <small>${escapeHTML(item.actor)} · ${escapeHTML(date(item.timestamp))}</small>
      </div>
    `).join("") || '<div class="empty-state">NO RECENT ACTIVITY</div>';

    $("console-preview").textContent = db.console.slice(0, 10).join("\n") ||
      "DIVI-64 MAINFRAME\nAwaiting session activity...";
  }

  function emptyRow(columns, message) {
    return `<tr><td colspan="${columns}"><div class="empty-state">${escapeHTML(message)}</div></td></tr>`;
  }

  function downloadText(filename, content) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function renderAll() {
    renderDashboard();
    renderRegistry();
    renderRequests();
    renderReviews();
    renderAppeals();
    renderArchives();
    renderAudit();
    updateSessionUI();

    if (selectedRequestId && findRequest(selectedRequestId)) {
      // Keep the selected request details current after a decision.
      // Do not change pages during a render.
    }
  }

  /* =======================================================
     CLOCK AND STARTUP
     ======================================================= */

  function updateClock() {
    const clock = $("systemClock");
    if (clock) {
      clock.textContent = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    }
  }

  updateClock();
  setInterval(updateClock, 1000);

  try {
    const storedSession = sessionStorage.getItem(SESSION_KEY);
    if (storedSession) {
      const parsed = JSON.parse(storedSession);
      if (Object.hasOwn(CREDENTIALS, parsed.authority)) {
        session = parsed;
        $("login-screen").hidden = true;
        $("app").hidden = false;
        updateSessionUI();
      }
    }
  } catch (error) {
    session = null;
  }

  renderAll();

  if (session) showPage("dashboard");
})();
