const LS_KEY = "glf_demo_state_v2";
const SESSION_KEY = "glf_demo_session";
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const TODAY = new Date();

const $ = (id) => document.getElementById(id);
const trustedHtml = (value) => ({ __trustedHtml: String(value) });
const storage = createSafeStorage("localStorage");
const sessionStore = createSafeStorage("sessionStorage");
const money = (value) =>
  Number(value || 0).toLocaleString("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = (value) => Number(value || 0).toLocaleString("es-EC");

const state = loadState();
let currentView = "dashboard";
let currentContractId = state.contracts[0]?.["CÓDIGO EXPEDIENTE"] || "";
let googleToken = null;
let localDirectoryHandle = null;

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("glf:login-success", () => {
  renderSafely();
});
window.addEventListener("error", (event) => {
  const errorBox = $("loginError");
  if (errorBox && $("appShell")?.hidden !== false) {
    errorBox.hidden = false;
    errorBox.textContent = "No se pudo inicializar el sistema. Abre la aplicación desde el acceso local recomendado o recarga la página.";
  }
  console.error(event.error || event.message);
});

function loadState() {
  const seed = window.GLF_SEED_DATA || { contracts: [], documentIndex: [], documentCatalog: [] };
  const saved = safeJsonParse(storage.getItem(LS_KEY));
  if (saved?.contracts?.length) {
    return {
      ...saved,
      fileLog: Array.isArray(saved.fileLog) ? saved.fileLog : [],
      driveFolders: Array.isArray(saved.driveFolders) ? saved.driveFolders : [],
      googleClientId: saved.googleClientId || storage.getItem("glf_google_client_id") || "",
      alertsEmail: saved.alertsEmail || storage.getItem("glf_alerts_email") || "",
    };
  }

  const contracts = (seed.contracts || []).map((item, index) => normalizeContract(item, index));
  return {
    generatedAt: new Date().toISOString(),
    sourceWorkbook: seed.sourceWorkbook,
    contracts,
    documentIndex: seed.documentIndex || [],
    documentCatalog: seed.documentCatalog || [],
    deliverables: seed.deliverables || [],
    guarantees: seed.guarantees || [],
    iddValidations: seed.iddValidations || [],
    catalogs: seed.catalogs || {},
    fileLog: [],
    driveFolders: [],
    googleClientId: storage.getItem("glf_google_client_id") || "",
    alertsEmail: storage.getItem("glf_alerts_email") || "",
  };
}

function saveState() {
  try {
    storage.setItem(LS_KEY, JSON.stringify(state));
  } catch (error) {
    alert("No se pudo guardar el estado local. Puede que el navegador tenga almacenamiento lleno o bloqueado.");
    console.error(error);
  }
}

function normalizeContract(raw, index) {
  const amount = Number(raw["MONTO USD"] || 0);
  const mode = raw["NIVEL / RUTA"] || raw["NIVEL_CARPETA (ruta digital)"]?.split("-")?.[4] || calculateLevel(amount);
  const institution = raw["INST."] || "GLF";
  const code =
    raw["CÓDIGO EXPEDIENTE"] ||
    raw["NIVEL_CARPETA (ruta digital)"] ||
    `GLF-GOB-001-2026-${mode}-${institution}-${String(index + 1).padStart(2, "0")}`;
  return {
    ...raw,
    "CÓDIGO EXPEDIENTE": code,
    "INST.": institution,
    "NIVEL / RUTA": mode,
    "MONTO USD": amount,
    "ESTADO": raw["ESTADO"] || "BORRADOR",
    "MON.": raw["MON."] || "USD",
    createdInPilot: false,
  };
}

function init() {
  setupLogin();
  setupNavigation();
  setupDialogs();
  setupFilters();
  setupEditContract();
  setupDriveTools();
  setupReports();
  setupManual();
  setupEmailAlerts();
  hydrateSelectors();
  if (hasActiveSession()) {
    openAuthenticatedApp();
  }
}

function setupLogin() {
  $("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    attemptLogin();
  });
  $("loginSubmitBtn").addEventListener("click", (event) => {
    event.preventDefault();
    attemptLogin();
  });
  $("logoutBtn").addEventListener("click", () => {
    sessionStore.removeItem(SESSION_KEY);
    googleToken = null;
    $("appShell").hidden = true;
    $("appShell").style.display = "none";
    $("loginScreen").hidden = false;
    $("loginScreen").removeAttribute("hidden");
    $("loginScreen").style.display = "grid";
  });
  ["click", "keydown", "mousemove"].forEach((eventName) =>
    window.addEventListener(eventName, refreshSession, { passive: true }),
  );
}

function attemptLogin() {
  const user = $("username").value.trim().toUpperCase();
  const pass = $("password").value.trim().toUpperCase();
  if (user === "ADMIN" && pass === "DEMO") {
    sessionStore.setItem(SESSION_KEY, JSON.stringify({ user, startedAt: Date.now(), lastSeenAt: Date.now() }));
    $("loginError").hidden = true;
    openAuthenticatedApp();
  } else {
    $("loginError").textContent = "Usuario o contraseña incorrectos.";
    $("loginError").hidden = false;
  }
}

function openAuthenticatedApp() {
  $("loginScreen").hidden = true;
  $("loginScreen").style.display = "none";
  $("appShell").hidden = false;
  $("appShell").removeAttribute("hidden");
  $("appShell").style.display = "grid";
  refreshSession();
  renderSafely();
}

function renderSafely() {
  try {
    renderAll();
  } catch (error) {
    console.error(error);
    $("viewTitle").textContent = "Sistema iniciado";
    alert("El acceso fue correcto, pero hubo un problema al cargar algunos datos. Voy a revisar el módulo afectado.");
  }
}

function hasActiveSession() {
  const session = safeJsonParse(sessionStore.getItem(SESSION_KEY));
  return Boolean(session?.startedAt && Date.now() - Number(session.startedAt) < SESSION_MAX_AGE_MS);
}

function refreshSession() {
  const session = safeJsonParse(sessionStore.getItem(SESSION_KEY));
  if (!session?.startedAt) return;
  if (Date.now() - Number(session.startedAt) > SESSION_MAX_AGE_MS) {
    sessionStore.removeItem(SESSION_KEY);
    googleToken = null;
    $("appShell").hidden = true;
    $("appShell").style.display = "none";
    $("loginScreen").hidden = false;
    $("loginScreen").removeAttribute("hidden");
    $("loginScreen").style.display = "grid";
    return;
  }
  session.lastSeenAt = Date.now();
  sessionStore.setItem(SESSION_KEY, JSON.stringify(session));
}

function setupNavigation() {
  document.querySelectorAll(".nav-link").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });
}

function showView(view) {
  currentView = view;
  document.querySelectorAll(".nav-link").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  $(`${view}View`).classList.add("active");
  const titles = {
    dashboard: "Dashboard ejecutivo",
    registry: "Registro maestro",
    expediente: "Expediente contractual",
    calendar: "Calendario contractual",
    drive: "Drive y archivos",
    reports: "Reportería",
    settings: "Configuración",
  };
  $("viewTitle").textContent = titles[view];
  $("exportDashboardPdfBtn").hidden = view !== "dashboard";
}

function setupDialogs() {
  const dialog = $("newProcessDialog");
  $("newProcessBtn").addEventListener("click", () => dialog.showModal());
  $("closeDialogBtn").addEventListener("click", () => dialog.close());
  $("cancelNewProcessBtn").addEventListener("click", () => dialog.close());
  $("newProcessForm").addEventListener("submit", createNewProcess);
}

function setupFilters() {
  ["searchInput", "institutionFilter", "levelFilter"].forEach((id) => $(id).addEventListener("input", renderRegistry));
  $("calendarMonth").value = toMonthValue(new Date());
  $("calendarMonth").addEventListener("input", renderCalendar);
  $("calendarTypeFilter").addEventListener("input", renderCalendar);
}

function setupReports() {
  $("exportDashboardPdfBtn").addEventListener("click", downloadPortfolioPdf);
  $("downloadUpdatedExcelBtn").addEventListener("click", downloadUpdatedExcel);
  $("downloadUpdatedExcelBtnDrive").addEventListener("click", downloadUpdatedExcel);
  $("downloadPortfolioPdfBtn").addEventListener("click", downloadPortfolioPdf);
  $("downloadContractPdfBtn").addEventListener("click", downloadContractPdf);
  $("downloadRegistryXlsxBtn").addEventListener("click", downloadUpdatedExcel);
  $("downloadComplianceXlsxBtn").addEventListener("click", () =>
    downloadWorkbook("matriz-cumplimiento", buildComplianceRows()),
  );
  $("downloadDueAlertsExcelBtn").addEventListener("click", () => downloadWorkbook("avisos-vencimiento", buildDueAlerts()));
  $("downloadDueAlertsExcelBtnReports").addEventListener("click", () => downloadWorkbook("avisos-vencimiento", buildDueAlerts()));
}

function setupManual() {
  $("openManualBtn").addEventListener("click", () => $("manualDialog").showModal());
  $("closeManualBtn").addEventListener("click", () => $("manualDialog").close());
}

function setupEmailAlerts() {
  $("alertsEmailInput").value = state.alertsEmail || "";
  $("saveAlertsEmailBtn").addEventListener("click", () => {
    state.alertsEmail = $("alertsEmailInput").value.trim();
    storage.setItem("glf_alerts_email", state.alertsEmail);
    saveState();
    alert("Correo de avisos guardado.");
  });
  $("sendDueEmailBtn").addEventListener("click", prepareDueAlertsEmail);
  $("sendDueEmailBtnSettings").addEventListener("click", prepareDueAlertsEmail);
}

function setupEditContract() {
  const form = $("editContractForm");
  form.addEventListener("submit", saveEditedContract);
  $("resetEditContractBtn").addEventListener("click", populateEditContractForm);
  $("goEditDataBtn").addEventListener("click", () => {
    showView("expediente");
    populateEditContractForm();
    $("editContractForm").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function setupDriveTools() {
  $("googleClientId").value = state.googleClientId || "";
  $("saveGoogleConfigBtn").addEventListener("click", () => {
    state.googleClientId = $("googleClientId").value.trim();
    storage.setItem("glf_google_client_id", state.googleClientId);
    saveState();
    toast("Configuración Google guardada.");
  });
  $("connectDriveBtn").addEventListener("click", connectGoogleDrive);
  $("createDriveFolderBtn").addEventListener("click", createDriveFolder);
  $("chooseLocalFolderBtn").addEventListener("click", chooseLocalFolder);
  $("saveLocalSnapshotBtn").addEventListener("click", saveLocalSnapshot);
  $("saveFilesLocalBtn").addEventListener("click", saveFilesToLocalFolder);
}

function hydrateSelectors() {
  const institutions = unique(state.contracts.map((x) => x["INST."]).filter(Boolean));
  const levels = unique(state.contracts.map((x) => x["NIVEL / RUTA"]).filter(Boolean)).concat(["N4"]).filter(Boolean);
  fillSelect($("institutionFilter"), ["Todas las instituciones", ...institutions]);
  fillSelect($("levelFilter"), ["Todos los niveles", ...unique(levels)]);
  fillSelect($("contractSelect"), state.contracts.map((c) => c["CÓDIGO EXPEDIENTE"]), false);
  $("contractSelect").onchange = (event) => {
    currentContractId = event.target.value;
    renderExpediente();
    populateEditContractForm();
  };
  fillSelect(document.querySelector("[name='institution']"), institutions);
  fillSelect(document.querySelector("[name='type']"), state.catalogs.types || ["Bien", "Servicio", "Consultoría"]);
  fillSelect(document.querySelector("[name='status']"), ["BORRADOR", "PRECONTRACTUAL", "EN PROCESO", "VIGENTE", "TERMINADO", "SUSPENDIDO"], false);
  fillSelect(document.querySelector("[name='idd']"), ["Pendiente", "Sí", "No", "N/A"], false);
  fillSelect(document.querySelector("[name='board']"), ["N/A", "Pendiente", "Sí", "No"], false);
  fillSelect(document.querySelector("[name='level']"), ["N1", "N2", "N3", "N4", "DIR", "CONV"], false);
  populateEditContractForm();
}

function fillSelect(select, values, preserveFirst = true) {
  select.innerHTML = "";
  values.forEach((value, index) => {
    const option = document.createElement("option");
    option.value = preserveFirst && index === 0 && /^(Todas|Todos)/.test(String(value)) ? "" : value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function renderAll() {
  renderDashboard();
  renderRegistry();
  renderExpediente();
  renderCalendar();
  renderCompliance();
  renderDrive();
}

function renderDashboard() {
  const total = state.contracts.length;
  const amount = state.contracts.reduce((sum, x) => sum + Number(x["MONTO USD"] || 0), 0);
  const dir = state.contracts.filter((x) => x["NIVEL / RUTA"] === "DIR").length;
  const alerts = buildAlerts();
  const iddPending = state.iddValidations.filter((x) => String(x["RESULTADO IDD"] || "").includes("Pendiente")).length;
  $("kpiGrid").innerHTML = [
    kpi("Contratos/procesos", number(total), "Registro maestro importado"),
    kpi("Monto portafolio", money(amount), "Suma de procesos con monto"),
    kpi("Procesos DIR", number(dir), "Contratación directa"),
    kpi("Seguimientos", number(alerts.length), "Acciones requeridas"),
  ].join("");
  $("stateChart").innerHTML = buildStateBars();
  $("alertsList").innerHTML = alerts.length ? alerts.slice(0, 8).map(alertItem).join("") : emptyState("Sin acciones pendientes.");
  $("alertCount").textContent = alerts.length;
  $("recentTable").innerHTML = tableHtml(
    ["Código", "Institución", "Nivel", "Proveedor", "Monto", "Estado"],
    state.contracts.slice(0, 8).map((c) => [
      c["CÓDIGO EXPEDIENTE"],
      c["INST."],
      c["NIVEL / RUTA"],
      c["PROVEEDOR / CONTRATISTA"] || "Por definir",
      money(c["MONTO USD"]),
      c["ESTADO"],
    ]),
  );
  renderDueAlerts();
}

function kpi(label, value, note) {
  return `<article class="kpi-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`;
}

function buildStateBars() {
  const groups = groupBy(state.contracts, (x) => x["ESTADO"] || "SIN ESTADO");
  const max = Math.max(...Object.values(groups).map((items) => items.length), 1);
  return Object.entries(groups)
    .map(([label, items]) => {
      const total = items.reduce((sum, x) => sum + Number(x["MONTO USD"] || 0), 0);
      const width = clamp((items.length / max) * 100, 0, 100);
      return `<div class="bar-row"><strong>${escapeHtml(label)}</strong><div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div><span>${items.length} · ${escapeHtml(money(total))}</span></div>`;
    })
    .join("");
}

function renderRegistry() {
  const query = $("searchInput").value.trim().toLowerCase();
  const institution = $("institutionFilter").value;
  const level = $("levelFilter").value;
  const filtered = state.contracts.filter((c) => {
    const text = [c["CÓDIGO EXPEDIENTE"], c["PROVEEDOR / CONTRATISTA"], c["OBJETO DEL CONTRATO"]]
      .join(" ")
      .toLowerCase();
    return (!query || text.includes(query)) && (!institution || c["INST."] === institution) && (!level || c["NIVEL / RUTA"] === level);
  });
  $("registryTable").innerHTML = tableHtml(
    ["Código", "Inst.", "Tipo", "Objeto", "Proveedor", "Monto", "Nivel", "Estado", "IDD", "No objeción"],
    filtered.map((c) => [
      trustedHtml(actionLink(c["CÓDIGO EXPEDIENTE"])),
      c["INST."],
      c["TIPO"] || "N/D",
      truncate(c["OBJETO DEL CONTRATO"], 90),
      c["PROVEEDOR / CONTRATISTA"] || "Por definir",
      money(c["MONTO USD"]),
      trustedHtml(levelPill(c["NIVEL / RUTA"])),
      c["ESTADO"] || "Borrador",
      c["IDD APROBADO"] || "Pendiente",
      c["NO OBJECIÓN JUNTA"] || "N/A",
    ]),
  );
  document.querySelectorAll("[data-open-contract]").forEach((link) =>
    link.addEventListener("click", () => {
      currentContractId = link.dataset.openContract;
      $("contractSelect").value = currentContractId;
      showView("expediente");
      renderExpediente();
    }),
  );
}

function renderExpediente() {
  const contract = getCurrentContract();
  if (!contract) return;
  $("contractDetail").innerHTML = `
    <dl>
      <dt>Código</dt><dd>${escapeHtml(contract["CÓDIGO EXPEDIENTE"])}</dd>
      <dt>Objeto</dt><dd>${escapeHtml(contract["OBJETO DEL CONTRATO"] || "Sin objeto registrado")}</dd>
      <dt>Proveedor</dt><dd>${escapeHtml(contract["PROVEEDOR / CONTRATISTA"] || "Por definir")}</dd>
      <dt>Institución</dt><dd>${escapeHtml(contract["INST."])}</dd>
      <dt>Nivel</dt><dd>${levelPill(contract["NIVEL / RUTA"])}</dd>
      <dt>Monto</dt><dd>${escapeHtml(money(contract["MONTO USD"]))}</dd>
      <dt>Estado</dt><dd>${escapeHtml(contract["ESTADO"] || "Borrador")}</dd>
      <dt>Responsable</dt><dd>${escapeHtml(contract["RESP. TÉCNICO"] || "Por definir")}</dd>
      <dt>Vencimiento</dt><dd>${escapeHtml(formatDate(contract["F.VENCIM."]) || "Sin fecha")}</dd>
    </dl>`;
  renderChecklist(contract);
  renderIdd(contract);
  renderGuarantees(contract);
  populateEditContractForm();
}

function populateEditContractForm() {
  const form = $("editContractForm");
  const contract = getCurrentContract();
  if (!form || !contract) return;
  form.elements.object.value = contract["OBJETO DEL CONTRATO"] || "";
  form.elements.provider.value = contract["PROVEEDOR / CONTRATISTA"] || "";
  form.elements.amount.value = Number(contract["MONTO USD"] || 0);
  form.elements.status.value = contract["ESTADO"] || "BORRADOR";
  form.elements.idd.value = contract["IDD APROBADO"] || "Pendiente";
  form.elements.board.value = contract["NO OBJECIÓN JUNTA"] || "N/A";
  form.elements.startDate.value = toDateInputValue(contract["F.INICIO"]);
  form.elements.endDate.value = toDateInputValue(contract["F.VENCIM."]);
  form.elements.technicalLead.value = contract["RESP. TÉCNICO"] || "";
  form.elements.level.value = contract["NIVEL / RUTA"] || calculateLevel(Number(contract["MONTO USD"] || 0));
  form.elements.legalNotes.value = contract["OBSERVACIONES LEGALES"] || "";
}

function saveEditedContract(event) {
  event.preventDefault();
  const contract = getCurrentContract();
  if (!contract) return;
  const form = event.target;
  const amount = Number(form.elements.amount.value || 0);
  if (!Number.isFinite(amount) || amount < 0) {
    alert("Ingresa un monto válido.");
    return;
  }
  contract["OBJETO DEL CONTRATO"] = form.elements.object.value.trim();
  contract["PROVEEDOR / CONTRATISTA"] = form.elements.provider.value.trim() || "Por definir";
  contract["MONTO USD"] = amount;
  contract["ESTADO"] = form.elements.status.value;
  contract["IDD APROBADO"] = form.elements.idd.value;
  contract["NO OBJECIÓN JUNTA"] = form.elements.board.value;
  contract["F.INICIO"] = form.elements.startDate.value || null;
  contract["F.VENCIM."] = form.elements.endDate.value || null;
  contract["RESP. TÉCNICO"] = form.elements.technicalLead.value.trim() || "Por definir";
  contract["NIVEL / RUTA"] = form.elements.level.value || calculateLevel(amount);
  contract["OBSERVACIONES LEGALES"] = form.elements.legalNotes.value.trim();
  contract["ACTUALIZADO EN APP"] = new Date().toISOString();
  saveState();
  renderAll();
  alert("Cambios guardados. El Excel actualizado incluirá esta información.");
}

function renderChecklist(contract) {
  const index = findIndexRow(contract["CÓDIGO EXPEDIENTE"]);
  const docs = state.documentCatalog.length ? state.documentCatalog : defaultDocs();
  const completed = docs.filter((doc) => isDocComplete(index, doc)).length;
  const ratio = docs.length ? completed / docs.length : 0;
  $("checklistBadge").textContent = ratio === 1 ? "Completo" : ratio >= 0.65 ? "Pendientes" : "Crítico";
  $("checklistBadge").className = `pill ${ratio === 1 ? "ok" : ratio >= 0.65 ? "warning" : "danger"}`;
  $("documentChecklist").innerHTML = docs
    .map((doc) => {
      const status = isDocComplete(index, doc);
      const na = String(status).toUpperCase() === "N/A";
      return `<div class="check-item"><span class="check-dot ${status ? (na ? "na" : "ok") : ""}">${status ? (na ? "—" : "✓") : "!"}</span><div><strong>${escapeHtml(doc.label)}</strong><small>${status ? "Consta en expediente" : "Pendiente de carga o validación"}</small></div><span class="${status ? "pill ok" : "pill danger"}">${status ? "OK" : "Falta"}</span></div>`;
    })
    .join("");
}

function renderIdd(contract) {
  const items = state.iddValidations.filter((x) => x["EXPEDIENTE VINCULADO"] === contract["CÓDIGO EXPEDIENTE"]);
  $("iddPanel").innerHTML = items.length
    ? items.map((x) => `<div class="list-item"><strong>${escapeHtml(x["RESULTADO IDD"] || "Pendiente")}</strong><small>${escapeHtml(x["PROVEEDOR / INSTITUCIÓN"] || "Proveedor por definir")} · ${escapeHtml(x["ESTADO VIGENCIA"] || "Sin estado")} · ${escapeHtml(x["ALERTAS ACTIVAS"] || "")}</small></div>`).join("")
    : emptyState("No hay IDD vinculado para este expediente.");
}

function renderGuarantees(contract) {
  const code = contract["CÓDIGO EXPEDIENTE"];
  const items = state.guarantees.filter((x) => x["CÓDIGO EXPEDIENTE"] === code || (!x["CÓDIGO EXPEDIENTE"] && x["INST."] === contract["INST."])).slice(0, 6);
  $("guaranteesPanel").innerHTML = items.length
    ? items.map((x) => `<div class="list-item"><strong>${escapeHtml(x["TIPO GARANTÍA"] || "Garantía")}</strong><small>Póliza: ${escapeHtml(x["PÓLIZA"] || "Por ingresar")} · ${escapeHtml(x["SEMÁFORO"] || "Sin semáforo")}</small></div>`).join("")
    : emptyState("No hay garantías vinculadas para este expediente.");
}

function renderCompliance() {
  $("complianceTable").innerHTML = tableHtml(
    ["Expediente", "Institución", "Nivel", "Docs completos", "Total docs", "Semáforo"],
    buildComplianceRows().map((x) => [x.expediente, x.institucion, x.nivel, x.completos, x.total, x.semaforo]),
  );
}

function renderDueAlerts() {
  const alerts = buildDueAlerts();
  $("dueAlertsList").innerHTML = alerts.length
    ? alerts
        .slice(0, 10)
        .map(
          (x) =>
            `<div class="list-item"><strong>${escapeHtml(x.tipo)} · ${escapeHtml(x.expediente)}</strong><small>${escapeHtml(x.detalle)} · Vence: ${escapeHtml(x.vencimiento || "Sin fecha")} · ${escapeHtml(x.proveedor || "Proveedor por definir")}</small></div>`,
        )
        .join("")
    : emptyState("No hay procesos por vencer en 7 días ni vencidos sin archivos registrados.");
}

function buildDueAlerts() {
  return state.contracts
    .map((contract) => {
      const due = parseDate(contract["F.VENCIM."]);
      if (!due) return null;
      const days = daysBetween(new Date(), due);
      const code = contract["CÓDIGO EXPEDIENTE"];
      const hasUploadedInfo = state.fileLog.some((file) => file.target === code);
      if (days >= 0 && days <= 7) {
        return {
          tipo: "Por vencer",
          expediente: code,
          institucion: contract["INST."],
          proveedor: contract["PROVEEDOR / CONTRATISTA"],
          vencimiento: formatDate(due),
          dias: days,
          detalle: `Faltan ${days} día(s) para el vencimiento del plazo.`,
          estado: contract["ESTADO"] || "",
          monto: contract["MONTO USD"] || 0,
        };
      }
      if (days < 0 && !hasUploadedInfo) {
        return {
          tipo: "Vencido sin información",
          expediente: code,
          institucion: contract["INST."],
          proveedor: contract["PROVEEDOR / CONTRATISTA"],
          vencimiento: formatDate(due),
          dias: days,
          detalle: `El plazo venció hace ${Math.abs(days)} día(s) y no registra archivos cargados en el prototipo.`,
          estado: contract["ESTADO"] || "",
          monto: contract["MONTO USD"] || 0,
        };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => a.dias - b.dias);
}

function prepareDueAlertsEmail() {
  const alerts = buildDueAlerts();
  if (!alerts.length) {
    alert("No hay avisos por vencimiento para enviar.");
    return;
  }
  const to = state.alertsEmail || $("alertsEmailInput")?.value?.trim() || "";
  const subject = "GLF - Avisos de vencimiento de procesos";
  const body = [
    "Estimado/a,",
    "",
    "El Sistema Prototipo de Adquisiciones identificó los siguientes procesos que requieren seguimiento:",
    "",
    ...alerts.map(
      (x, index) =>
        `${index + 1}. ${x.tipo} | ${x.expediente} | ${x.detalle} | Vencimiento: ${x.vencimiento} | Proveedor: ${x.proveedor || "Por definir"}`,
    ),
    "",
    "Por favor revisar el expediente correspondiente y cargar o actualizar la información requerida.",
    "",
    "Mensaje generado automáticamente por el prototipo GLF.",
  ].join("\n");
  window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function renderCalendar() {
  const selectedMonth = parseMonthValue($("calendarMonth").value) || new Date();
  const typeFilter = $("calendarTypeFilter").value;
  const events = buildCalendarEvents().filter((event) => !typeFilter || event.type === typeFilter);
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const todayKey = dateKey(new Date());
  const heads = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d) => `<div class="calendar-head">${d}</div>`);
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = dateKey(date);
    const dayEvents = events.filter((event) => dateKey(event.date) === key);
    const classes = ["calendar-day", date.getMonth() !== month ? "muted" : "", key === todayKey ? "today" : ""].filter(Boolean).join(" ");
    cells.push(`<div class="${classes}">
      <div class="calendar-date"><span>${date.getDate()}</span><small>${dayEvents.length || ""}</small></div>
      ${dayEvents.slice(0, 3).map(calendarEventHtml).join("")}
    </div>`);
  }
  $("calendarGrid").innerHTML = [...heads, ...cells].join("");
  const upcoming = events
    .filter((event) => daysBetween(new Date(), event.date) >= 0 && daysBetween(new Date(), event.date) <= 90)
    .sort((a, b) => a.date - b.date)
    .slice(0, 12);
  $("upcomingCount").textContent = upcoming.length;
  $("upcomingEvents").innerHTML = upcoming.length
    ? upcoming.map((event) => `<div class="list-item"><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(event.type)} · ${escapeHtml(formatDate(event.date))} · ${escapeHtml(event.code || "")}</small></div>`).join("")
    : emptyState("No hay eventos próximos en los siguientes 90 días.");
}

function calendarEventHtml(event) {
  const days = daysBetween(new Date(), event.date);
  const status = days < 0 ? "risk" : days <= 30 ? "warning" : "info";
  return `<span class="calendar-event ${status}" title="${escapeAttr(event.title)}">${escapeHtml(event.type)} · ${escapeHtml(truncate(event.title, 22))}</span>`;
}

function buildCalendarEvents() {
  const events = [];
  state.contracts.forEach((contract) => {
    const code = contract["CÓDIGO EXPEDIENTE"];
    addEventIfDate(events, contract["F.INICIO"], "Contrato", `Inicio: ${code}`, code);
    addEventIfDate(events, contract["F.VENCIM."], "Contrato", `Vencimiento: ${code}`, code);
  });
  state.iddValidations.forEach((idd) => {
    const issued = parseDate(idd["FECHA IDD"]);
    const due = parseDate(idd["FECHA VENCIM. (automática)"]) || (issued ? addDays(issued, 365) : null);
    addEventIfDate(events, due, "IDD", `Vence IDD: ${idd["EXPEDIENTE VINCULADO"] || "sin expediente"}`, idd["EXPEDIENTE VINCULADO"]);
    addEventIfDate(events, issued, "IDD", `Fecha IDD: ${idd["EXPEDIENTE VINCULADO"] || "sin expediente"}`, idd["EXPEDIENTE VINCULADO"]);
  });
  state.guarantees.forEach((guarantee) => {
    addEventIfDate(events, guarantee["VENC./COND."], "Garantía", `${guarantee["TIPO GARANTÍA"] || "Garantía"}: ${guarantee["CÓDIGO EXPEDIENTE"] || ""}`, guarantee["CÓDIGO EXPEDIENTE"]);
  });
  state.deliverables.forEach((deliverable) => {
    addEventIfDate(events, deliverable["F.PLANIFICADA"], "Entregable", `${deliverable["ENTREGABLE / ACTIVIDAD"] || "Entregable"}: ${deliverable["CÓDIGO EXPEDIENTE"] || ""}`, deliverable["CÓDIGO EXPEDIENTE"]);
  });
  return events.filter((event) => event.date instanceof Date && !Number.isNaN(event.date.valueOf()));
}

function addEventIfDate(events, rawDate, type, title, code) {
  const date = parseDate(rawDate);
  if (!date) return;
  events.push({ date, type, title, code });
}

function renderDrive() {
  $("driveStatusBadge").textContent = googleToken ? "Drive conectado" : "Drive no conectado";
  $("driveStatusBadge").className = `status-badge ${googleToken ? "ok" : "neutral"}`;
  $("googleAuthState").textContent = googleToken ? "Conectado" : "Pendiente";
  $("googleAuthState").className = `status-badge ${googleToken ? "ok" : "neutral"}`;
  $("localFolderState").textContent = localDirectoryHandle ? "Carpeta autorizada" : "Sin carpeta";
  $("localFolderState").className = `status-badge ${localDirectoryHandle ? "ok" : "neutral"}`;
  $("driveFolders").innerHTML = state.driveFolders.length
    ? state.driveFolders.map((x) => `<div class="list-item"><strong>${escapeHtml(x.name)}</strong><small>${escapeHtml(x.id || "Carpeta local")} · ${escapeHtml(x.createdAt)}</small></div>`).join("")
    : emptyState("Aún no hay carpetas registradas.");
  $("fileLog").innerHTML = state.fileLog.length
    ? state.fileLog.slice(-8).reverse().map((x) => `<div class="list-item"><strong>${escapeHtml(x.name)}</strong><small>${escapeHtml(x.target)} · ${escapeHtml(x.savedAt)}</small></div>`).join("")
    : emptyState("Aún no hay archivos copiados o registrados.");
}

function createNewProcess(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const amount = Number(form.get("amount"));
  if (!Number.isFinite(amount) || amount < 0) {
    alert("Ingresa un monto válido.");
    return;
  }
  const institution = sanitizeCodePart(form.get("institution"));
  const forced = form.get("mode") === "DIR" || form.get("mode") === "CONV" ? form.get("mode") : "";
  const level = forced || calculateLevel(amount);
  const seq = state.contracts.filter((x) => x["INST."] === institution).length + 1;
  const code = `GLF-GOB-001-2026-${level}-${institution}-${String(seq).padStart(2, "0")}`;
  state.contracts.unshift({
    "CÓDIGO EXPEDIENTE": code,
    "INST.": institution,
    TIPO: form.get("type"),
    "OBJETO DEL CONTRATO": form.get("object"),
    "INSTRUMENTO": "Por definir",
    "PROVEEDOR / CONTRATISTA": form.get("provider") || "Por definir",
    "MONTO USD": amount,
    "MON.": "USD",
    FUENTE: "GLF",
    ESTADO: "BORRADOR",
    "F.INICIO": form.get("startDate") || null,
    "F.VENCIM.": form.get("endDate") || null,
    "NIVEL / RUTA": level,
    "NIVEL_CARPETA (ruta digital)": code,
    "RESP. TÉCNICO": form.get("technicalLead") || "Por definir",
    "IDD APROBADO": "Pendiente",
    "CAUSAL DIR": level === "DIR" ? "Pendiente" : "N/A",
    "NO OBJECIÓN JUNTA": level === "DIR" && amount > 20000 ? "Pendiente" : "N/A",
    createdInPilot: true,
  });
  currentContractId = code;
  saveState();
  hydrateSelectors();
  renderAll();
  event.target.reset();
  $("newProcessDialog").close();
  showView("expediente");
}

function calculateLevel(amount) {
  if (amount < 2000) return "N1";
  if (amount <= 5000) return "N2";
  if (amount <= 100000) return "N3";
  return "N4";
}

function buildAlerts() {
  const alerts = [];
  state.contracts.forEach((c) => {
    const code = c["CÓDIGO EXPEDIENTE"];
    const level = c["NIVEL / RUTA"];
    if (level === "DIR" && (!c["CAUSAL DIR"] || String(c["CAUSAL DIR"]).includes("Pendiente") || c["CAUSAL DIR"] === "— N/A")) {
      alerts.push({ type: "DIR", title: "DIR sin causal documentada", detail: code });
    }
    if (level === "DIR" && Number(c["MONTO USD"] || 0) > 20000 && String(c["NO OBJECIÓN JUNTA"] || "").includes("Pendiente")) {
      alerts.push({ type: "Junta", title: "DIR > USD 20.000 sin no objeción", detail: code });
    }
    if (String(c["IDD APROBADO"] || "").includes("Pendiente")) {
      alerts.push({ type: "IDD", title: "IDD pendiente antes de adjudicar", detail: code });
    }
  });
  state.iddValidations.forEach((x) => {
    if (String(x["ESTADO VIGENCIA"] || "").includes("🔴")) alerts.push({ type: "IDD", title: "IDD vencido o pendiente", detail: x["EXPEDIENTE VINCULADO"] });
  });
  state.guarantees.forEach((x) => {
    if (String(x["SEMÁFORO"] || "").includes("🔴")) alerts.push({ type: "Garantía", title: "Garantía vencida", detail: x["CÓDIGO EXPEDIENTE"] || x["INST."] });
  });
  return alerts;
}

function buildComplianceRows() {
  const docs = state.documentCatalog.length ? state.documentCatalog : defaultDocs();
  return state.contracts.map((contract) => {
    const idx = findIndexRow(contract["CÓDIGO EXPEDIENTE"]);
    const completed = docs.filter((doc) => isDocComplete(idx, doc)).length;
    return {
      expediente: contract["CÓDIGO EXPEDIENTE"],
      institucion: contract["INST."],
      nivel: contract["NIVEL / RUTA"],
      completos: completed,
      total: docs.length,
      semaforo: completed === docs.length ? "Completo" : completed >= Math.ceil(docs.length * 0.65) ? "Pendientes" : "Crítico",
    };
  });
}

function findIndexRow(code) {
  return state.documentIndex.find((x) => x["CÓDIGO EXPEDIENTE"] === code);
}

function isDocComplete(indexRow, doc) {
  if (!indexRow) return false;
  const cleanLabel = doc.label.replace(/\s+/g, " ").trim();
  const matchingKey = Object.keys(indexRow).find((key) => key.replace(/\s+/g, " ").trim() === cleanLabel || key.includes(cleanLabel.split(" ")[0]));
  const value = matchingKey ? indexRow[matchingKey] : null;
  return value === "X" || value === "N/A";
}

function defaultDocs() {
  return ["Solicitud", "TDR/ET", "Proformas", "Informe selección", "Registro proveedor", "IDD/DDHH", "Contrato", "Garantías", "Factura"].map((label, i) => ({ key: `d${i}`, label }));
}

async function connectGoogleDrive() {
  const clientId = $("googleClientId").value.trim() || state.googleClientId;
  if (!clientId) {
    alert("Primero pega el OAuth Client ID de Google Cloud. Puedo guiarte para crearlo.");
    return;
  }
  if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(clientId)) {
    alert("El Client ID no parece válido. Debe terminar en .apps.googleusercontent.com.");
    return;
  }
  if (!window.google?.accounts?.oauth2) {
    alert("No se pudo cargar Google Identity Services. Revisa conexión a internet.");
    return;
  }
  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GOOGLE_SCOPE,
    callback: (response) => {
      if (response.error) return alert(`Error Google: ${response.error}`);
      googleToken = response.access_token;
      renderDrive();
    },
  });
  tokenClient.requestAccessToken({ prompt: "consent" });
}

async function createDriveFolder() {
  const name = sanitizeFileName($("driveFolderName").value.trim() || getCurrentContract()?.["CÓDIGO EXPEDIENTE"]);
  if (!name) return;
  if (!googleToken) {
    state.driveFolders.push({ name, id: "pendiente-oauth", createdAt: new Date().toLocaleString("es-EC") });
    saveState();
    renderDrive();
    toast("Carpeta registrada localmente. Con OAuth activo se creará en Drive.");
    return;
  }
  try {
    const response = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${googleToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder" }),
    });
    const folder = await response.json();
    if (!response.ok) throw new Error(folder.error?.message || "No se pudo crear la carpeta.");
    state.driveFolders.push({ name, id: folder.id, createdAt: new Date().toLocaleString("es-EC") });
    saveState();
    renderDrive();
  } catch (error) {
    alert(`Error al crear carpeta en Drive: ${error.message}`);
  }
}

async function chooseLocalFolder() {
  if (!window.showDirectoryPicker) {
    alert("Tu navegador no permite escoger carpetas locales. Usa Chrome o Edge actualizado.");
    return;
  }
  localDirectoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
  renderDrive();
}

async function saveLocalSnapshot() {
  if (!localDirectoryHandle) return alert("Primero escoge una carpeta local de Google Drive.");
  try {
    const handle = await localDirectoryHandle.getFileHandle(`glf-respaldo-${Date.now()}.json`, { create: true });
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(state, null, 2));
    await writable.close();
    state.fileLog.push({ name: handle.name, target: "Carpeta local Google Drive", savedAt: new Date().toLocaleString("es-EC") });
    saveState();
    renderDrive();
  } catch (error) {
    alert(`No se pudo guardar el respaldo local: ${error.message}`);
  }
}

async function saveFilesToLocalFolder() {
  if (!localDirectoryHandle) return alert("Primero escoge una carpeta local de Google Drive.");
  const files = Array.from($("fileInput").files || []);
  if (!files.length) return alert("Selecciona uno o más archivos.");
  const contract = getCurrentContract();
  try {
    const folder = await localDirectoryHandle.getDirectoryHandle(sanitizeFileName(contract["CÓDIGO EXPEDIENTE"]), { create: true });
    for (const file of files) {
      if (file.size > 50 * 1024 * 1024) {
        alert(`El archivo ${file.name} supera 50 MB y se omitió.`);
        continue;
      }
      const safeName = sanitizeFileName(file.name);
      const handle = await folder.getFileHandle(safeName, { create: true });
      const writable = await handle.createWritable();
      await writable.write(file);
      await writable.close();
      state.fileLog.push({ name: safeName, target: contract["CÓDIGO EXPEDIENTE"], savedAt: new Date().toLocaleString("es-EC") });
    }
    saveState();
    renderDrive();
  } catch (error) {
    alert(`No se pudieron copiar los archivos: ${error.message}`);
  }
}

function downloadPortfolioPdf() {
  if (!window.jspdf?.jsPDF) {
    const alerts = buildAlerts().slice(0, 12);
    return downloadSimplePdf("GLF_reporte_portafolio.pdf", "GLF - Reporte ejecutivo de adquisiciones", [
      `Generado: ${new Date().toLocaleString("es-EC")}`,
      `Contratos/procesos: ${state.contracts.length}`,
      `Monto portafolio: ${money(state.contracts.reduce((sum, x) => sum + Number(x["MONTO USD"] || 0), 0))}`,
      `Procesos DIR: ${state.contracts.filter((x) => x["NIVEL / RUTA"] === "DIR").length}`,
      "",
      "Acciones requeridas:",
      ...alerts.map((x) => `- ${x.type}: ${x.title} (${x.detail || "Sin expediente"})`),
      "",
      "Procesos:",
      ...state.contracts.slice(0, 30).map((c) => `${c["CÓDIGO EXPEDIENTE"]} | ${c["INST."]} | ${c["NIVEL / RUTA"]} | ${money(c["MONTO USD"])} | ${c["ESTADO"]}`),
    ]);
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text("GLF - Reporte ejecutivo de adquisiciones", 14, 16);
  doc.setFontSize(10);
  doc.text(`Generado: ${new Date().toLocaleString("es-EC")}`, 14, 23);
  doc.autoTable({
    startY: 30,
    head: [["Código", "Institución", "Nivel", "Proveedor", "Monto", "Estado"]],
    body: state.contracts.map((c) => [
      c["CÓDIGO EXPEDIENTE"],
      c["INST."],
      c["NIVEL / RUTA"],
      c["PROVEEDOR / CONTRATISTA"] || "Por definir",
      money(c["MONTO USD"]),
      c["ESTADO"],
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 159, 154] },
  });
  doc.save("GLF_reporte_portafolio.pdf");
}

function downloadContractPdf() {
  const c = getCurrentContract();
  if (!window.jspdf?.jsPDF) {
    return downloadSimplePdf(`${sanitizeFileName(c["CÓDIGO EXPEDIENTE"])}.pdf`, "GLF - Ficha de expediente contractual", [
      `Código: ${c["CÓDIGO EXPEDIENTE"]}`,
      `Objeto: ${c["OBJETO DEL CONTRATO"] || ""}`,
      `Institución: ${c["INST."]}`,
      `Nivel: ${c["NIVEL / RUTA"]}`,
      `Proveedor: ${c["PROVEEDOR / CONTRATISTA"] || "Por definir"}`,
      `Monto: ${money(c["MONTO USD"])}`,
      `Estado: ${c["ESTADO"]}`,
      `IDD: ${c["IDD APROBADO"] || "Pendiente"}`,
      `Causal DIR: ${c["CAUSAL DIR"] || "N/A"}`,
      `No objeción Junta: ${c["NO OBJECIÓN JUNTA"] || "N/A"}`,
    ]);
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(15);
  doc.text("GLF - Ficha de expediente contractual", 14, 16);
  doc.setFontSize(10);
  doc.text(c["CÓDIGO EXPEDIENTE"], 14, 24);
  doc.autoTable({
    startY: 32,
    body: [
      ["Objeto", c["OBJETO DEL CONTRATO"] || ""],
      ["Institución", c["INST."]],
      ["Nivel", c["NIVEL / RUTA"]],
      ["Proveedor", c["PROVEEDOR / CONTRATISTA"] || "Por definir"],
      ["Monto", money(c["MONTO USD"])],
      ["Estado", c["ESTADO"]],
      ["IDD", c["IDD APROBADO"] || "Pendiente"],
      ["Causal DIR", c["CAUSAL DIR"] || "N/A"],
      ["No objeción Junta", c["NO OBJECIÓN JUNTA"] || "N/A"],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 159, 154] },
  });
  doc.save(`${sanitizeFileName(c["CÓDIGO EXPEDIENTE"])}.pdf`);
}

function downloadUpdatedExcel() {
  const sheets = [
    { name: "Registro maestro", rows: state.contracts },
    { name: "Cumplimiento", rows: buildComplianceRows() },
    { name: "Avisos vencimiento", rows: buildDueAlerts() },
    { name: "Archivos registrados", rows: state.fileLog },
    { name: "Carpetas Drive", rows: state.driveFolders },
  ];
  if (!window.XLSX) {
    return downloadExcelCompatibleHtml(`GLF_excel_actualizado_${dateKey(new Date())}.xls`, sheets);
  }
  const wb = XLSX.utils.book_new();
  sheets.forEach((sheet) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet.rows), sheet.name));
  XLSX.writeFile(wb, `GLF_excel_actualizado_${dateKey(new Date())}.xlsx`);
}

function downloadWorkbook(name, rows) {
  if (!window.XLSX) {
    return downloadExcelCompatibleHtml(`GLF_${name}.xls`, [{ name: "Datos", rows }]);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, `GLF_${name}.xlsx`);
}

function downloadExcelCompatibleHtml(filename, sheets) {
  const sections = sheets
    .map((sheet) => {
      const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
      const headers = unique(rows.flatMap((row) => Object.keys(row || {})));
      const table = rows.length
        ? `<table border="1"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows
            .map((row) => `<tr>${headers.map((h) => `<td>${escapeHtml(row?.[h] ?? "")}</td>`).join("")}</tr>`)
            .join("")}</tbody></table>`
        : "<p>Sin datos</p>";
      return `<h2>${escapeHtml(sheet.name)}</h2>${table}`;
    })
    .join("<br/>");
  const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body>${sections}</body></html>`;
  downloadBlob(filename, html, "application/vnd.ms-excel;charset=utf-8");
}

function downloadSimplePdf(filename, title, lines) {
  const safeLines = [title, "", ...lines].flatMap((line) => wrapPdfLine(String(line ?? ""), 92));
  const escaped = safeLines.map((line) => escapePdfText(line));
  const streamLines = ["BT", "/F1 11 Tf", "50 790 Td", "14 TL", ...escaped.map((line) => `(${line}) Tj T*`), "ET"];
  const stream = streamLines.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object) => {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  downloadBlob(filename, pdf, "application/pdf");
}

function wrapPdfLine(text, maxLength) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [""];
  const lines = [];
  for (let i = 0; i < normalized.length; i += maxLength) {
    lines.push(normalized.slice(i, i + maxLength));
  }
  return lines;
}

function escapePdfText(value) {
  return String(value).replace(/[^\x20-\x7EÁÉÍÓÚáéíóúÑñüÜ]/g, " ").replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function tableHtml(headers, rows) {
  return `<thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${renderCell(cell)}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;
}

function alertItem(alert) {
  return `<div class="list-item"><strong>${escapeHtml(alert.title)}</strong><small>${escapeHtml(alert.type)} · ${escapeHtml(alert.detail || "Sin expediente")}</small></div>`;
}

function emptyState(text) {
  return `<div class="list-item"><small>${escapeHtml(text)}</small></div>`;
}

function actionLink(code) {
  return `<button class="ghost-button" data-open-contract="${escapeAttr(code)}">${escapeHtml(code)}</button>`;
}

function levelPill(level) {
  const danger = level === "DIR" || level === "N4";
  return `<span class="pill ${danger ? "warning" : "ok"}">${escapeHtml(level || "N/D")}</span>`;
}

function getCurrentContract() {
  return state.contracts.find((x) => x["CÓDIGO EXPEDIENTE"] === currentContractId) || state.contracts[0];
}

function unique(values) {
  return [...new Set(values)].filter(Boolean);
}

function groupBy(items, getter) {
  return items.reduce((acc, item) => {
    const key = getter(item);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}

function truncate(text, length) {
  if (!text) return "";
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function toast(message) {
  console.info(message);
}

function renderCell(cell) {
  if (cell && typeof cell === "object" && "__trustedHtml" in cell) return cell.__trustedHtml;
  return escapeHtml(cell ?? "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function createSafeStorage(storageName) {
  const memory = new Map();
  try {
    const target = window[storageName];
    const testKey = `glf_storage_test_${Date.now()}`;
    target.setItem(testKey, "1");
    target.removeItem(testKey);
    return {
      getItem: (key) => target.getItem(key),
      setItem: (key, value) => target.setItem(key, value),
      removeItem: (key) => target.removeItem(key),
    };
  } catch {
    return {
      getItem: (key) => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => memory.set(key, String(value)),
      removeItem: (key) => memory.delete(key),
    };
  }
}

function sanitizeCodePart(value) {
  return String(value || "GLF")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .toUpperCase()
    .slice(0, 12) || "GLF";
}

function sanitizeFileName(value) {
  return String(value || "archivo")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140) || "archivo";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseDate(value) {
  if (!value || String(value).includes("Pendiente") || String(value).includes("Sin fecha")) return null;
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return stripTime(value);
  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + value);
    return stripTime(excelEpoch);
  }
  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return stripTime(new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])));
  const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashMatch) return stripTime(new Date(Number(slashMatch[3]), Number(slashMatch[2]) - 1, Number(slashMatch[1])));
  const parsed = new Date(text);
  return Number.isNaN(parsed.valueOf()) ? null : stripTime(parsed);
}

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const result = stripTime(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "";
  return date.toLocaleDateString("es-EC", { year: "numeric", month: "short", day: "2-digit" });
}

function daysBetween(from, to) {
  const start = stripTime(parseDate(from) || new Date());
  const end = stripTime(parseDate(to) || new Date());
  return Math.round((end - start) / 86400000);
}

function dateKey(value) {
  const date = parseDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toMonthValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toDateInputValue(value) {
  const date = parseDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseMonthValue(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}
