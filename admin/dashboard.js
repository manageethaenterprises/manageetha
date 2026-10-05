// ═══════════════════════════════════════════════════
// BUSINESS ERP DASHBOARD — dashboard.js
// Core: Auth, Tab Routing, Company Switcher, Utilities
// ═══════════════════════════════════════════════════

const API_BASE = "/api";
let activeTab = null;
let currentUser = null;
let currentMenus = [];
let currentCompanies = [];
let selectedCompanyId = localStorage.getItem("selectedCompanyId") || "all"; // superadmin context

// ═══════════════ HELPERS ═══════════════

function getToken() { return localStorage.getItem("erp_token"); }
function getUser() {
  try { return JSON.parse(localStorage.getItem("erp_user")); } catch { return null; }
}

function authHeaders() {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token && token !== "null" && token !== "undefined") {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function esc(str) {
  if (!str) return "";
  const d = document.createElement("div");
  d.textContent = String(str);
  return d.innerHTML;
}

function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  return "₹" + num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function today() { return new Date().toISOString().split("T")[0]; }

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
  "Other / International"
];
window.INDIAN_STATES = INDIAN_STATES;

const GST_STATE_MAP = {
  "37": "Andhra Pradesh",
  "12": "Arunachal Pradesh",
  "18": "Assam",
  "10": "Bihar",
  "22": "Chhattisgarh",
  "30": "Goa",
  "24": "Gujarat",
  "06": "Haryana",
  "02": "Himachal Pradesh",
  "20": "Jharkhand",
  "29": "Karnataka",
  "32": "Kerala",
  "23": "Madhya Pradesh",
  "27": "Maharashtra",
  "14": "Manipur",
  "17": "Meghalaya",
  "15": "Mizoram",
  "13": "Nagaland",
  "21": "Odisha",
  "03": "Punjab",
  "08": "Rajasthan",
  "11": "Sikkim",
  "33": "Tamil Nadu",
  "36": "Telangana",
  "16": "Tripura",
  "09": "Uttar Pradesh",
  "05": "Uttarakhand",
  "19": "West Bengal",
  "35": "Andaman and Nicobar Islands",
  "04": "Chandigarh",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "07": "Delhi",
  "01": "Jammu and Kashmir",
  "38": "Ladakh",
  "31": "Lakshadweep",
  "34": "Puducherry"
};
window.GST_STATE_MAP = GST_STATE_MAP;

function generateIndianStateOptionsHtml(selectedVal, companyStateName = "") {
  const compStateNorm = (companyStateName || "").trim().toLowerCase();
  const selNorm = (selectedVal || companyStateName || "").trim().toLowerCase();

  return INDIAN_STATES.map(state => {
    const stNorm = state.trim().toLowerCase();
    const isSameState = compStateNorm && stNorm === compStateNorm;
    const isSelected = selNorm ? (stNorm === selNorm) : isSameState;
    const label = isSameState ? `${state} (Same State - Intra State)` : state;
    return `<option value="${esc(state)}" ${isSelected ? 'selected' : ''}>${esc(label)}</option>`;
  }).join("");
}
window.generateIndianStateOptionsHtml = generateIndianStateOptionsHtml;

function on(id, event, handler) {
  const el = typeof id === "string" ? document.getElementById(id) : id;
  if (el) el.addEventListener(event, handler);
}

// ═══════════════ TOAST NOTIFICATIONS ═══════════════

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = "max-width:480px;word-break:break-word;white-space:pre-wrap;box-shadow:0 10px 25px rgba(0,0,0,0.3);line-height:1.4;font-size:13px;padding:12px 16px;";
  container.appendChild(toast);
  const duration = (type === "error" || (message && message.length > 40)) ? 10000 : 4000;
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, duration);
}

// ═══════════════ CONFIRM MODAL ═══════════════

let modalResolve = null;
function confirmDialog(title, message) {
  return new Promise((resolve) => {
    modalResolve = resolve;
    document.getElementById("modalHeader").textContent = title;
    document.getElementById("modalBody").textContent = message;
    document.getElementById("modalOverlay").style.display = "flex";
  });
}
on("modalConfirm", "click", () => {
  document.getElementById("modalOverlay").style.display = "none";
  if (modalResolve) modalResolve(true);
});
on("modalCancel", "click", () => {
  document.getElementById("modalOverlay").style.display = "none";
  if (modalResolve) modalResolve(false);
});

// ═══════════════ PAGINATION RENDERER ═══════════════

function renderPagination(container, currentPage, totalPages, onPageChange) {
  if (totalPages <= 1) { container.innerHTML = ""; return; }
  let html = "";
  html += `<button ${currentPage === 1 ? "disabled" : ""} data-page="${currentPage - 1}">‹ Prev</button>`;
  
  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

  if (start > 1) html += `<button data-page="1">1</button>`;
  if (start > 2) html += `<button disabled>…</button>`;

  for (let i = start; i <= end; i++) {
    html += `<button class="${i === currentPage ? "active" : ""}" data-page="${i}">${i}</button>`;
  }

  if (end < totalPages - 1) html += `<button disabled>…</button>`;
  if (end < totalPages) html += `<button data-page="${totalPages}">${totalPages}</button>`;

  html += `<button ${currentPage === totalPages ? "disabled" : ""} data-page="${currentPage + 1}">Next ›</button>`;
  container.innerHTML = html;

  container.querySelectorAll("button[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = parseInt(btn.dataset.page);
      if (page >= 1 && page <= totalPages) onPageChange(page);
    });
  });
}

window.renderPagination = renderPagination;

window.sortDataArray = function(arr, sortKey, sortDir = "asc") {
  if (!Array.isArray(arr) || !sortKey) return arr;
  const multiplier = sortDir === "desc" ? -1 : 1;
  return [...arr].sort((a, b) => {
    let valA = a[sortKey];
    let valB = b[sortKey];

    if (valA === null || valA === undefined) valA = "";
    if (valB === null || valB === undefined) valB = "";

    const numA = Number(valA);
    const numB = Number(valB);
    if (!isNaN(numA) && !isNaN(numB) && String(valA).trim() !== "" && String(valB).trim() !== "") {
      return (numA - numB) * multiplier;
    }

    const strA = String(valA).toLowerCase();
    const strB = String(valB).toLowerCase();
    if (strA < strB) return -1 * multiplier;
    if (strA > strB) return 1 * multiplier;
    return 0;
  });
};

window.attachTableSorting = function(tableOrSelector, onSort) {
  const table = typeof tableOrSelector === 'string' ? document.getElementById(tableOrSelector) || document.querySelector(tableOrSelector) : tableOrSelector;
  if (!table) return;
  const ths = table.querySelectorAll("thead th[data-sort-key]");
  ths.forEach(th => {
    th.style.cursor = "pointer";
    th.style.userSelect = "none";
    th.title = "Click to sort by " + (th.textContent.trim().replace(/[↕️🔼🔽]/g, ''));

    if (!th.dataset.sortListenerAttached) {
      th.dataset.sortListenerAttached = "true";
      th.addEventListener("click", () => {
        const key = th.dataset.sortKey;
        const currentDir = th.dataset.sortDir || "asc";
        const newDir = currentDir === "asc" ? "desc" : "asc";

        ths.forEach(otherTh => {
          delete otherTh.dataset.sortDir;
          const oldIcon = otherTh.querySelector(".sort-icon");
          if (oldIcon) oldIcon.remove();
        });

        th.dataset.sortDir = newDir;
        let icon = th.querySelector(".sort-icon");
        if (!icon) {
          icon = document.createElement("span");
          icon.className = "sort-icon";
          icon.style.marginLeft = "4px";
          icon.style.fontSize = "11px";
          th.appendChild(icon);
        }
        icon.textContent = newDir === "asc" ? " 🔼" : " 🔽";

        if (typeof onSort === "function") {
          onSort(key, newDir);
        }
      });
    }
  });
};

window.renderPaginatedTable = function(optionsOrData, argRenderRow, argPageSize, argTbody, argPagContainer, argInfoContainer, argCurrentPage) {
  let opts = {};
  if (Array.isArray(optionsOrData)) {
    opts = {
      data: optionsOrData,
      renderRow: argRenderRow,
      pageSize: argPageSize || 10,
      tbody: argTbody,
      paginationContainer: argPagContainer,
      infoContainer: argInfoContainer,
      currentPage: argCurrentPage || 1
    };
  } else if (optionsOrData && typeof optionsOrData === "object") {
    opts = optionsOrData;
  }

  const {
    data = [],
    pageSize = 10,
    currentPage = 1,
    tbody,
    paginationContainer,
    infoContainer,
    renderRow,
    onRender
  } = opts;

  const tbodyEl = typeof tbody === "string" ? document.getElementById(tbody) || document.querySelector(tbody) : tbody;
  if (!tbodyEl) return;

  if (typeof renderRow !== "function") {
    console.error("renderPaginatedTable error: renderRow is not a function", renderRow);
    return;
  }

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const curPage = Math.max(1, Math.min(currentPage, totalPages));

  const startIdx = (curPage - 1) * pageSize;
  const endIdx = Math.min(totalItems, startIdx + pageSize);
  const pageItems = data.slice(startIdx, endIdx);

  if (totalItems === 0) {
    tbodyEl.innerHTML = `<tr><td colspan="100" style="text-align:center;padding:20px;color:var(--text3);">No records found.</td></tr>`;
    const pagEl = typeof paginationContainer === "string" ? document.getElementById(paginationContainer) || document.querySelector(paginationContainer) : paginationContainer;
    if (pagEl) pagEl.innerHTML = "";
    const infoEl = typeof infoContainer === "string" ? document.getElementById(infoContainer) || document.querySelector(infoContainer) : infoContainer;
    if (infoEl) infoEl.innerHTML = "";
    return;
  }

  tbodyEl.innerHTML = pageItems.map((item, i) => renderRow(item, startIdx + i)).join("");

  const infoEl = typeof infoContainer === "string" ? document.getElementById(infoContainer) || document.querySelector(infoContainer) : infoContainer;
  if (infoEl) {
    infoEl.innerHTML = `<span style="font-size:12px;color:var(--text3);font-weight:500;">Showing <strong>${startIdx + 1}</strong> to <strong>${endIdx}</strong> of <strong>${totalItems}</strong> entries</span>`;
  }

  const pagEl = typeof paginationContainer === "string" ? document.getElementById(paginationContainer) || document.querySelector(paginationContainer) : paginationContainer;
  if (pagEl) {
    renderPagination(pagEl, curPage, totalPages, (newPage) => {
      window.renderPaginatedTable({
        ...opts,
        currentPage: newPage
      });
    });
  }

  if (typeof onRender === "function") {
    onRender(pageItems, curPage);
  }
};

window.applyTablePagination = function(tableOrSelector, pageSize = 10, defaultPage = 1) {
  const table = typeof tableOrSelector === "string" ? document.querySelector(tableOrSelector) : tableOrSelector;
  if (!table) return;

  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  const allRows = Array.from(tbody.children).filter(r => r.tagName === "TR");
  if (allRows.length === 0) return;

  let container = table.parentElement.querySelector(".table-pagination-footer");
  if (!container) {
    container = document.createElement("div");
    container.className = "table-pagination-footer";
    container.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:12px 4px;flex-wrap:wrap;gap:8px;";
    container.innerHTML = `
      <div class="table-pagination-info" style="font-size:12px;color:var(--text3);"></div>
      <div class="pagination table-pagination-controls"></div>
    `;
    table.parentElement.appendChild(container);
  }

  const infoEl = container.querySelector(".table-pagination-info");
  const controlsEl = container.querySelector(".table-pagination-controls");

  function showPage(page) {
    const totalItems = allRows.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const curPage = Math.max(1, Math.min(page, totalPages));

    const startIdx = (curPage - 1) * pageSize;
    const endIdx = Math.min(totalItems, startIdx + pageSize);

    allRows.forEach((row, idx) => {
      if (idx >= startIdx && idx < endIdx) {
        row.style.display = "";
      } else {
        row.style.display = "none";
      }
    });

    if (infoEl) {
      infoEl.innerHTML = `<span style="font-size:12px;color:var(--text3);font-weight:500;">Showing <strong>${startIdx + 1}</strong> to <strong>${endIdx}</strong> of <strong>${totalItems}</strong> entries</span>`;
    }

    if (controlsEl) {
      renderPagination(controlsEl, curPage, totalPages, (newPage) => {
        showPage(newPage);
      });
    }
  }

  showPage(defaultPage);
};

// ═══════════════ AUTH CHECK ═══════════════

async function initDashboard() {
  const token = getToken();
  if (!token) { window.location.replace("/admin"); return; }

  try {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error("Session expired");
    }

    window.currentUser = currentUser = data.user;
    window.currentMenus = currentMenus = data.menus || [];
    window.currentCompanies = currentCompanies = data.companies || [];

    // Update stored user
    localStorage.setItem("erp_user", JSON.stringify(currentUser));

    // Render UI
    renderUserInfo();
    renderSidebar();
    renderCompanySwitcher();
    setDate();

    // Load modules
    loadModules();

    // Preserve active route across refresh
    const hashRoute = location.hash.replace(/^#/, '');
    const savedRoute = hashRoute || localStorage.getItem("currentRoute");
    if (savedRoute) {
      switchTab(savedRoute);
    } else if (currentUser.role !== "superadmin") {
      // Default dashboard for employees/staff is Today Tasks
      const todayTasksMenu = currentMenus.find(m => m.menu_key && m.menu_key.includes("today_tasks")) || currentMenus[0];
      if (todayTasksMenu) switchTab(todayTasksMenu.menu_key);
      else if (currentMenus.length > 0) switchTab(currentMenus[0].menu_key);
    } else if (currentMenus.length > 0) {
      switchTab(currentMenus[0].menu_key);
    }

    // Start activity heartbeat (keeps online status accurate)
    startHeartbeat();

  } catch (err) {
    console.error("Auth check failed:", err);
    localStorage.removeItem("erp_token");
    localStorage.removeItem("erp_user");
    window.location.replace("/admin");
  }
}

// ═══════════════ ACTIVITY HEARTBEAT ═══════════════

let heartbeatTimer = null;
function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  async function sendPing() {
    if (!getToken()) return;
    try {
      await fetch(`${API_BASE}/auth?action=heartbeat`, { headers: authHeaders() });
    } catch (e) {}
  }
  sendPing();
  heartbeatTimer = setInterval(sendPing, 60000); // Pulse every 60 seconds
}

// ═══════════════ RENDER USER INFO ═══════════════

function renderUserInfo() {
  const u = currentUser;
  if (!u) return;
  document.getElementById("userName").textContent = u.username;
  document.getElementById("userRole").textContent = u.role.replace(/_/g, " ");
  document.getElementById("headerAvatar").textContent = u.username.charAt(0).toUpperCase();

  // Update brand
  if (u.company_logo) {
    const logoBox = document.getElementById("logoBox");
    logoBox.innerHTML = `<img src="${u.company_logo}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;" alt="Logo">`;
  }
  document.getElementById("brandText").innerHTML = `${esc(u.company_name)}<span id="portalLabel">${esc(u.role.replace(/_/g, " "))}</span>`;
}

// ═══════════════ RENDER SIDEBAR MENUS ═══════════════

function renderSidebar() {
  const nav = document.getElementById("sidebarNav");
  nav.innerHTML = "";

  // Ensure inv_branch_transfer is present in currentMenus for users with inventory access
  const hasInv = currentMenus.some(m => m.category_key === 'inventory' || m.menu_key === 'inv_inventory');
  if ((currentUser.role === 'superadmin' || hasInv) && !currentMenus.some(m => m.menu_key === 'inv_branch_transfer')) {
    currentMenus.push({
      menu_key: 'inv_branch_transfer',
      menu_label: 'Transport bw Branches',
      icon: '🚚',
      category_key: 'inventory',
      category_label: 'INVENTORY MANAGEMENT',
      category_icon: '📦'
    });
  }

  if (currentUser.role === "superadmin") {
    // Superadmin sees all menus grouped by category
    const grouped = {};
    currentMenus.forEach((m) => {
      const catKey = m.category_key || "general";
      if (!grouped[catKey]) {
        grouped[catKey] = { label: m.category_label || catKey, icon: m.category_icon || "📋", items: [] };
      }
      grouped[catKey].items.push(m);
    });

    Object.entries(grouped).forEach(([catKey, cat]) => {
      nav.innerHTML += `<div class="nav-category" data-cat="${esc(catKey)}">${esc(cat.icon)} ${esc(cat.label)}</div>`;
      cat.items.forEach((m) => {
        const cleanKey = esc((m.menu_key || '').trim());
        nav.innerHTML += `
          <a href="#" class="nav-item" data-tab="${cleanKey}" data-cat="${esc(catKey)}" title="${esc(m.menu_label)}">
            <span class="nav-icon">${esc(m.icon)}</span>
            <span class="nav-item-text">${esc(m.menu_label)}</span>
          </a>`;
      });
    });
  } else {
    // Regular roles — show mapped menus (keep only 1 Today Tasks menu item)
    if (currentMenus.length === 0) {
      nav.innerHTML = `<div class="empty-state" style="padding:20px;"><p style="color:#64748b;font-size:12px;">No menus assigned to your role. Contact your administrator.</p></div>`;
      return;
    }

    const grouped = {};
    let seenTodayTasks = false;

    currentMenus.forEach((m) => {
      const isTodayTask = m.menu_label === "Today Tasks" || (m.menu_key && m.menu_key.includes("today_tasks"));
      if (isTodayTask) {
        if (seenTodayTasks) return; // Deduplicate Today Tasks
        seenTodayTasks = true;
      }

      const catKey = m.category_key || "general";
      if (!grouped[catKey]) {
        grouped[catKey] = { label: m.category_label || catKey, icon: m.category_icon || "📋", items: [] };
      }
      grouped[catKey].items.push(m);
    });

    Object.entries(grouped).forEach(([catKey, cat]) => {
      if (cat.items.length === 0) return;
      nav.innerHTML += `<div class="nav-category" data-cat="${esc(catKey)}">${esc(cat.icon)} ${esc(cat.label)}</div>`;
      cat.items.forEach((m) => {
        const cleanKey = esc((m.menu_key || '').trim());
        nav.innerHTML += `
          <a href="#" class="nav-item" data-tab="${cleanKey}" data-cat="${esc(catKey)}" title="${esc(m.menu_label)}">
            <span class="nav-icon">${esc(m.icon)}</span>
            <span class="nav-item-text">${esc(m.menu_label)}</span>
          </a>`;
      });
    });
  }

  // Add divider + logout
  nav.innerHTML += `<div class="nav-divider"></div>`;
  nav.innerHTML += `<a href="#" class="nav-item" id="navLogout" title="Logout"><span class="nav-icon">🚪</span> <span class="nav-item-text">Logout</span></a>`;

  // Attach click handlers
  nav.querySelectorAll(".nav-item[data-tab]").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      switchTab(item.dataset.tab);
    });
  });

  on("navLogout", "click", (e) => { e.preventDefault(); logout(); });
}

// ═══════════════ COMPANY SWITCHER (Superadmin) ═══════════════

function renderCompanySwitcher() {
  const switcher = document.getElementById("companySwitcher");
  const select = document.getElementById("companySelect");

  if (currentUser.role !== "superadmin" || currentCompanies.length === 0) {
    switcher.style.display = "none";
    return;
  }

  switcher.style.display = "block";
  let html = `<option value="all">📊 All Companies</option>`;

  // Group by parent
  const parents = currentCompanies.filter((c) => !c.parent_company_id);
  const children = currentCompanies.filter((c) => c.parent_company_id);

  parents.forEach((p) => {
    html += `<option value="${p.id}">${esc(p.name)}${p.gstin ? " (" + p.gstin + ")" : ""}</option>`;
    children
      .filter((c) => c.parent_company_id === p.id)
      .forEach((c) => {
        html += `<option value="${c.id}">&nbsp;&nbsp;↳ ${esc(c.name)}</option>`;
      });
  });

  select.innerHTML = html;
  select.value = selectedCompanyId;

  select.addEventListener("change", () => {
    selectedCompanyId = select.value;
    localStorage.setItem("selectedCompanyId", selectedCompanyId);
    // Refresh current tab data
    if (activeTab) switchTab(activeTab);
  });
}

// ═══════════════ TAB ROUTING & MODULE REGISTRY ═══════════════

window.moduleRoutes = window.moduleRoutes || {};

window.registerModuleRoute = function (keys, renderFn) {
  const routeKeys = Array.isArray(keys) ? keys : [keys];
  routeKeys.forEach((k) => {
    window.moduleRoutes[k] = renderFn;
  });

  if (activeTab && routeKeys.includes(activeTab)) {
    const contentArea = document.getElementById("contentArea");
    if (contentArea) {
      window.renderModuleTab(activeTab, contentArea);
    }
  }
};

window.renderModuleTab = async function (tabKey, container) {
  const handler = window.moduleRoutes[tabKey];
  if (typeof handler === "function") {
    await handler(tabKey, container);
  } else {
    container.innerHTML = `
      <div class="welcome-section">
        <div class="welcome-card">
          <h2>🚧 ${esc(tabKey)}</h2>
          <p>This module is under development. Coming soon!</p>
        </div>
      </div>`;
  }
};

function switchTab(tabKey) {
  if (!tabKey) return;
  const cleanKey = String(tabKey).trim();
  activeTab = cleanKey;
  localStorage.setItem("currentRoute", cleanKey);
  if (location.hash !== `#${cleanKey}`) {
    try { history.replaceState(null, '', `#${cleanKey}`); } catch (e) { location.hash = cleanKey; }
  }

  const contentArea = document.getElementById("contentArea");

  // Update sidebar active item & highlight active module category header
  document.querySelectorAll(".nav-item").forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".nav-category").forEach((el) => el.classList.remove("active-category"));

  let activeNav = document.querySelector(`.nav-item[data-tab="${cleanKey}"]`);
  if (!activeNav) {
    document.querySelectorAll(".nav-item[data-tab]").forEach(navEl => {
      const dt = (navEl.dataset.tab || "").trim();
      if (dt === cleanKey) activeNav = navEl;
    });
  }
  if (!activeNav && ['rpt_auditor_gst', 'rpt_sales_analytics', 'acc_reports', 'reports'].includes(cleanKey)) {
    activeNav = document.querySelector(`.nav-item[data-tab*="rpt_auditor_gst"]`) || 
                document.querySelector(`.nav-item[data-tab*="acc_reports"]`) || 
                document.querySelector(`.nav-item[data-tab="reports"]`);
  }

  if (activeNav) {
    activeNav.classList.add("active");

    const catKey = activeNav.dataset.cat;
    if (catKey) {
      const activeCat = document.querySelector(`.nav-category[data-cat="${catKey}"]`);
      if (activeCat) activeCat.classList.add("active-category");
    } else {
      let prev = activeNav.previousElementSibling;
      while (prev && !prev.classList.contains("nav-category")) {
        prev = prev.previousElementSibling;
      }
      if (prev && prev.classList.contains("nav-category")) {
        prev.classList.add("active-category");
      }
    }

    // Auto scroll active menu item into view in sidebarNav
    setTimeout(() => {
      activeNav.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
  }

  // Update page title neatly
  let displayTitle = "";
  if (activeNav) {
    displayTitle = activeNav.querySelector(".nav-item-text")?.textContent.trim() || activeNav.textContent.trim();
  } else {
    const knownTitles = {
      'rpt_auditor_gst': 'Account Reports',
      'rpt_sales_analytics': 'Account Reports',
      'acc_reports': 'Account Reports',
      'reports': 'Reports',
      'inv_reports': 'Inventory Reports',
      'hr_reports': 'HR Reports'
    };
    displayTitle = knownTitles[cleanKey] || cleanKey.replace(/^(sa_|acc_|inv_|hr_|sales_|svc_|rpt_)/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  document.getElementById("pageTitle").textContent = displayTitle;

  // Close mobile sidebar and overlay
  const sidebarEl = document.getElementById("sidebar");
  const overlayEl = document.getElementById("sidebarOverlay");
  if (sidebarEl) sidebarEl.classList.remove("open");
  if (overlayEl) overlayEl.classList.remove("open");

  // Show loading
  contentArea.innerHTML = `<div class="loading-spinner"><div class="spinner"></div> Loading...</div>`;

  // Route to module
  window.renderModuleTab(tabKey, contentArea);
}

window.addEventListener("hashchange", () => {
  const hashRoute = location.hash.replace(/^#/, '');
  if (hashRoute && hashRoute !== activeTab) {
    switchTab(hashRoute);
  }
});

// ═══════════════ LOAD MODULES ═══════════════

function loadModules() {
  // Load module scripts dynamically
  const scripts = [
    "/admin/modules/today-tasks.js",
    "/admin/modules/super-panel.js",
    "/admin/modules/hr.js",
    "/admin/modules/inventory.js",
    "/admin/modules/sales.js",
    "/admin/modules/services.js",
    "/admin/modules/accountant.js",
    "/admin/modules/marketing.js",
    "/admin/modules/reports.js",
  ];

  scripts.forEach((src) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (!existing) {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      document.head.appendChild(script);
    }
  });
}

// ═══════════════ DATE ═══════════════

function setDate() {
  const d = new Date();
  document.getElementById("topbarDate").textContent = d.toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

// ═══════════════ LOGOUT ═══════════════

function logout() {
  const token = getToken();
  if (token) {
    fetch(`${API_BASE}/auth?action=logout`, {
      method: "POST",
      headers: authHeaders(),
    }).catch(() => {});
  }
  localStorage.removeItem("erp_token");
  localStorage.removeItem("erp_user");
  localStorage.removeItem("currentRoute");
  window.location.replace("/admin");
}

window.addEventListener("pageshow", (event) => {
  if (event.persisted || !getToken()) {
    window.location.replace("/admin");
  }
});

window.addEventListener("beforeunload", () => {
  const token = getToken();
  if (token) {
    const data = new Blob([JSON.stringify({ token })], { type: 'application/json' });
    navigator.sendBeacon(`${API_BASE}/auth?action=logout`, data);
  }
});

// ═══════════════ THEME SWITCHER ═══════════════

function initTheme() {
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const savedTheme = localStorage.getItem("erp_theme") || "dark";

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("erp_theme", theme);
    if (themeToggleBtn) {
      const isDark = theme === "dark";
      themeToggleBtn.innerHTML = isDark
        ? '<span class="theme-icon">☀️</span><span class="theme-label">Light</span>'
        : '<span class="theme-icon">🌙</span><span class="theme-label">Dark</span>';
      themeToggleBtn.setAttribute("title", isDark ? "Switch to Light Mode" : "Switch to Dark Mode");
    }
  }

  applyTheme(savedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(newTheme);
    });
  }
}
initTheme();

// ═══════════════ SIDEBAR TOGGLE & ANYWHERE CLICK TO CLOSE ═══════════════

function initSidebarToggle() {
  const isCollapsed = localStorage.getItem("erp_sidebar_collapsed") === "true";
  if (isCollapsed && window.innerWidth > 1024) {
    document.body.classList.add("sidebar-collapsed");
  }

  const menuToggleBtn = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  function closeSidebar() {
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
  }

  if (menuToggleBtn) {
    menuToggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isMobile = window.innerWidth <= 1024;
      if (isMobile) {
        const willOpen = !sidebar.classList.contains("open");
        sidebar.classList.toggle("open", willOpen);
        if (overlay) overlay.classList.toggle("open", willOpen);
      } else {
        document.body.classList.toggle("sidebar-collapsed");
        const nowCollapsed = document.body.classList.contains("sidebar-collapsed");
        localStorage.setItem("erp_sidebar_collapsed", nowCollapsed ? "true" : "false");
      }
    });
  }

  // Close when clicking backdrop overlay or close icon
  if (overlay) overlay.addEventListener("click", closeSidebar);
  on("sidebarClose", "click", closeSidebar);

  // Close sidebar on anywhere click on page
  document.addEventListener("click", (e) => {
    if (sidebar && sidebar.classList.contains("open")) {
      if (!sidebar.contains(e.target) && menuToggleBtn && !menuToggleBtn.contains(e.target)) {
        closeSidebar();
      }
    }
  });
}
initSidebarToggle();

on("logoutBtn", "click", logout);

// ═══════════════ GLOBAL BANK ACCOUNTS DROPDOWN HELPER ═══════════════
window.populateBankAccountDropdown = async function (selectElementOrId, companyId, selectedAccountId = null) {
  const selectEl = typeof selectElementOrId === "string" ? document.getElementById(selectElementOrId) : selectElementOrId;
  if (!selectEl) return [];

  const compId = companyId && companyId !== "all" ? companyId : (selectedCompanyId && selectedCompanyId !== "all" ? selectedCompanyId : "");
  selectEl.innerHTML = `<option value="">⏳ Loading bank accounts...</option>`;

  try {
    const url = `${API_BASE}/accountant?action=bank-accounts-list${compId ? `&company_id=${compId}` : ''}`;
    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json();
    const accounts = (data.success && data.bank_accounts) ? data.bank_accounts.filter(b => b.is_active !== false) : [];

    if (accounts.length === 0) {
      selectEl.innerHTML = `<option value="">-- No Bank Accounts Found (Set in Settings) --</option>`;
      return [];
    }

    let html = `<option value="">-- Select Bank Account --</option>`;
    accounts.forEach(b => {
      const isSel = selectedAccountId && (b.id == selectedAccountId);
      const isPriBadge = b.is_primary ? " ⭐ [Primary]" : "";
      const lastDigits = b.account_number.length > 4 ? `...${b.account_number.slice(-4)}` : b.account_number;
      const balStr = parseFloat(b.current_balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      
      html += `<option value="${b.id}" data-bank-name="${esc(b.bank_name)}" data-acc-no="${esc(b.account_number)}" ${isSel ? 'selected' : ''}>
        ${esc(b.bank_name)} - A/C ${esc(lastDigits)} (${esc(b.account_type || 'Acc')})${isPriBadge} — Bal: ₹${balStr}
      </option>`;
    });

    selectEl.innerHTML = html;
    return accounts;
  } catch (err) {
    console.error("Error fetching bank accounts for dropdown:", err);
    selectEl.innerHTML = `<option value="">-- Error loading bank accounts --</option>`;
    return [];
  }
};

// ═══════════════ GLOBAL COMPANIES DROPDOWN HELPER ═══════════════
window.getCompaniesOptionsHtml = async function (selectedId = null) {
  let list = window.currentCompanies || currentCompanies || [];
  if (!list || list.length === 0) {
    try {
      const res = await fetch(`${API_BASE}/super?action=companies-list`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.companies) {
        list = data.companies;
        window.currentCompanies = list;
        currentCompanies = list;
      }
    } catch (e) {}
  }
  if (!list || list.length === 0) return `<option value="1">Default Company</option>`;
  const activeId = selectedId || (selectedCompanyId !== 'all' ? selectedCompanyId : list[0]?.id);
  return list.map(c => `<option value="${c.id}" ${c.id == activeId ? 'selected' : ''}>${esc(c.name)}</option>`).join("");
};

window.getCompaniesList = async function () {
  let list = window.currentCompanies || currentCompanies || [];
  if (!list || list.length === 0) {
    try {
      const res = await fetch(`${API_BASE}/super?action=companies-list`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.companies) {
        list = data.companies;
        window.currentCompanies = list;
        currentCompanies = list;
      }
    } catch (e) {}
  }
  return list;
};

initDashboard();



