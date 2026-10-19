// ═══════════════════════════════════════════════════
// BUSINESS ERP — reports.js
// Auditor Financial Transactions Ledger & Sales Analytics
// ═══════════════════════════════════════════════════

window.renderReportsModule = async function (tabKey, container) {
  const reportsTabs = [
    { key: 'rpt_auditor_gst', label: 'Auditor & Financial Transactions', icon: '📑', aliases: ['gstTab', 'gst_report', 'audit', 'transactions'] },
    { key: 'rpt_sales_analytics', label: 'Sales Analytics & Performance', icon: '📊', aliases: ['salesTab', 'sales_report'] }
  ];

  const subBar = window.renderModuleSubTabsBar(reportsTabs, tabKey);
  if (!subBar.activeKey) {
    container.innerHTML = subBar.html;
    return;
  }

  const effectiveKey = subBar.activeKey;

  container.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;border:none;background:transparent;box-shadow:none;">
      ${subBar.html}
      <div class="sub-content-area" id="rptSubContent">
        <!-- Loaded dynamically -->
      </div>
    </div>
  `;

  const buttons = container.querySelectorAll(".sub-tab");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.tabkey;
      if (key && window.switchTab) {
        window.switchTab(key);
      }
    });
  });

  if (effectiveKey === 'rpt_sales_analytics') loadSalesReportSubTab();
  else loadGSTReportSubTab();
};

if (window.registerModuleRoute) {
  window.registerModuleRoute(
    [
      'reports', 'gst_report', 'sales_report', 'audit', 'transactions',
      'rpt_auditor_gst', 'rpt_sales_analytics'
    ],
    window.renderReportsModule
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SUBTAB 1: AUDITOR & FINANCIAL TRANSACTIONS LEDGER (ALL MODULES)
// Covers: Sales, Services, Expenses, Salaries Given, and Purchases
// ═════════════════════════════════════════════════════════════════════════════

async function loadGSTReportSubTab() {
  const subContent = document.getElementById("rptSubContent");
  if (!subContent) return;

  const compId = (typeof selectedCompanyId !== "undefined" && selectedCompanyId) ? selectedCompanyId : "all";
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  subContent.innerHTML = `
    <div style="padding: 18px 16px;">
      <!-- TOP BANNER & ACTION HEADER -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px;margin-bottom:20px;">
        <div style="max-width:720px;">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <h3 style="font-size:19px;font-weight:700;color:var(--text1);margin:0;letter-spacing:-0.3px;">
              📑 Auditor & Financial Transactions Ledger
            </h3>
            <span class="badge badge-purple" style="font-size:11px;font-weight:600;padding:3px 8px;">
              All Modules Audit Trail
            </span>
          </div>
          <p style="font-size:13px;color:var(--text3);margin-top:6px;line-height:1.5;">
            Unified financial audit trail tracking inward and outward transactions across <strong>Sales</strong>, <strong>Services</strong>, <strong>Expenses</strong>, <strong>Salaries Given</strong>, and <strong>Purchases</strong> with complete GST compliance.
          </p>
        </div>

        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" id="auditorExportCsvBtn" style="display:inline-flex;align-items:center;gap:6px;font-weight:600;">
            <span>📥</span> Export CSV
          </button>
          <button class="btn btn-secondary btn-sm" id="auditorPrintBtn" style="display:inline-flex;align-items:center;gap:6px;font-weight:600;">
            <span>🖨️</span> Print Report
          </button>
        </div>
      </div>

      <!-- RESPONSIVE FILTER PANEL -->
      <div class="reports-filter-panel">
        <!-- Row 1: Quick Preset Buttons & Search Input -->
        <div class="reports-filter-row">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;">Quick Filter:</span>
            <div class="reports-preset-group">
              <button type="button" class="reports-preset-btn date-preset-btn" data-preset="today">Today</button>
              <button type="button" class="reports-preset-btn date-preset-btn" data-preset="week">This Week</button>
              <button type="button" class="reports-preset-btn date-preset-btn active" data-preset="month">This Month</button>
              <button type="button" class="reports-preset-btn date-preset-btn" data-preset="fy">This FY</button>
            </div>
          </div>

          <div style="flex:1;max-width:340px;min-width:220px;">
            <input type="text" id="auditorSearchInput" class="form-input" placeholder="🔎 Search ref, party, GSTIN, mode..." style="width:100%;font-size:13px;height:38px;padding:6px 12px;">
          </div>
        </div>

        <!-- Row 2: Date Pickers, Module Selector, Flow Selector & Generate Button -->
        <div class="reports-filter-row" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;">
          <div class="reports-inputs-group">
            <div style="display:flex;align-items:center;gap:6px;">
              <label style="font-size:12px;color:var(--text3);font-weight:600;margin:0;">From:</label>
              <input type="date" id="auditorStart" class="form-input" style="height:36px;font-size:12.5px;padding:4px 8px;">
            </div>

            <div style="display:flex;align-items:center;gap:6px;">
              <label style="font-size:12px;color:var(--text3);font-weight:600;margin:0;">To:</label>
              <input type="date" id="auditorEnd" class="form-input" style="height:36px;font-size:12.5px;padding:4px 8px;">
            </div>

            <select id="auditorModuleSelect" class="form-select" style="height:36px;font-size:12.5px;font-weight:600;min-width:160px;">
              <option value="all">🌐 All Modules</option>
              <option value="sales">🛒 Sales (Inward)</option>
              <option value="services">🔧 Services (Inward)</option>
              <option value="expenses">💸 Expenses (Outward)</option>
              <option value="salaries">👥 Salaries Given (Outward)</option>
              <option value="purchases">📦 Purchases (Stock)</option>
            </select>

            <select id="auditorFlowSelect" class="form-select" style="height:36px;font-size:12.5px;min-width:140px;">
              <option value="all">↕️ All Flows</option>
              <option value="inward">🟢 Inward Only (Receipts)</option>
              <option value="outward">🔴 Outward Only (Payouts)</option>
            </select>
          </div>

          <div>
            <button class="btn btn-primary" id="auditorFilterBtn" style="height:36px;padding:6px 18px;font-weight:600;display:inline-flex;align-items:center;gap:6px;">
              <span>🔍</span> Generate Report
            </button>
          </div>
        </div>
      </div>

      <!-- AUDITOR SUMMARY METRIC CARDS -->
      <div class="reports-kpi-grid" id="auditorSummaryCards">
        <!-- Rendered dynamically -->
        <div class="report-kpi-card blue">
          <div class="report-kpi-header"><span class="report-kpi-title">Loading...</span><span class="report-kpi-icon">⏳</span></div>
          <div class="report-kpi-value">...</div>
          <div class="report-kpi-sub">Fetching totals</div>
        </div>
      </div>

      <!-- INTERACTIVE MODULE FILTER CHIPS -->
      <div class="module-chips-container" id="modulePillsWrap">
        <!-- Rendered dynamically -->
      </div>

      <!-- TABLE COUNT HEADER -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:12.5px;color:var(--text3);">
        <span id="auditorRecordCount" style="font-weight:600;">Showing 0 transactions</span>
        <span style="font-size:11.5px;color:var(--text3);">💡 Click any column or use the search box to find vouchers quickly</span>
      </div>

      <!-- TRANSACTIONS TABLE CONTAINER -->
      <div class="reports-table-wrap">
        <div style="overflow-x:auto;max-width:100%;">
          <table class="data-table" id="auditorTable" style="margin:0;">
            <thead>
              <tr>
                <th style="min-width:100px;">Date</th>
                <th style="min-width:90px;">Module</th>
                <th style="min-width:110px;">Ref / Voucher</th>
                <th style="min-width:180px;">Party / Payee</th>
                <th style="min-width:130px;">Branch</th>
                <th style="min-width:125px;">Party GSTIN</th>
                <th style="min-width:115px;text-align:right;">Inward (₹)</th>
                <th style="min-width:115px;text-align:right;">Outward (₹)</th>
                <th style="min-width:110px;text-align:right;">Taxable (₹)</th>
                <th style="min-width:95px;text-align:right;">GST (₹)</th>
                <th style="min-width:95px;">Mode</th>
                <th style="min-width:90px;">Status</th>
              </tr>
            </thead>
            <tbody id="auditorTableBody">
              <tr>
                <td colspan="12" style="text-align:center;padding:36px;color:var(--text3);">
                  <div class="spinner" style="margin-bottom:8px;"></div>
                  Loading all financial transactions...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TABLE PAGINATION CONTROLS -->
      <div id="auditorPagination" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-top:16px;font-size:13px;color:var(--text3);">
      </div>
    </div>
  `;

  const startInp = document.getElementById("auditorStart");
  const endInp = document.getElementById("auditorEnd");
  if (startInp) startInp.value = firstDayOfMonth;
  if (endInp) endInp.value = todayStr;

  // Preset buttons handler
  const presetBtns = subContent.querySelectorAll(".date-preset-btn");
  presetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      presetBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const p = btn.dataset.preset;
      const curr = new Date();
      if (p === "today") {
        startInp.value = todayStr;
        endInp.value = todayStr;
      } else if (p === "week") {
        const d = new Date(curr);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(d.setDate(diff));
        startInp.value = startOfWeek.toISOString().split("T")[0];
        endInp.value = todayStr;
      } else if (p === "month") {
        startInp.value = firstDayOfMonth;
        endInp.value = todayStr;
      } else if (p === "fy") {
        const yr = curr.getMonth() >= 3 ? curr.getFullYear() : curr.getFullYear() - 1;
        startInp.value = `${yr}-04-01`;
        endInp.value = `${yr + 1}-03-31`;
      }
      fetchTransactions();
    });
  });

  let rawTransactions = [];
  let currentPage = 1;
  const pageSize = 25;
  let activeModuleChip = "all";

  async function fetchTransactions() {
    const sDate = startInp?.value || firstDayOfMonth;
    const eDate = endInp?.value || todayStr;
    const mod = document.getElementById("auditorModuleSelect")?.value || "all";
    const flow = document.getElementById("auditorFlowSelect")?.value || "all";
    const tbody = document.getElementById("auditorTableBody");

    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:32px;"><div class="spinner"></div> Fetching transactions across modules...</td></tr>`;
    }

    try {
      const url = `${API_BASE}/reports?action=auditor-transactions&company_id=${compId}&start_date=${sDate}&end_date=${eDate}&module=${mod}&flow=${flow}`;
      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load auditor transactions");
      }

      rawTransactions = data.rows || [];
      renderSummaryCards(data.totals || {});
      renderModulePills(data.moduleSummaries || {});
      currentPage = 1;
      renderTransactionsTable();

    } catch (err) {
      console.error("Auditor transactions error:", err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:26px;color:var(--danger);">${esc(err.message)}</td></tr>`;
      }
    }
  }

  function renderSummaryCards(t) {
    const container = document.getElementById("auditorSummaryCards");
    if (!container) return;

    const inAmt = t.totalInward || 0;
    const outAmt = t.totalOutward || 0;
    const net = t.netFlow || (inAmt - outAmt);
    const tax = t.totalTax || 0;
    const taxable = t.totalTaxable || 0;

    container.innerHTML = `
      <div class="report-kpi-card green">
        <div class="report-kpi-header">
          <span class="report-kpi-title" style="color:#10b981;">🟢 Inflow / Inward</span>
          <span class="report-kpi-icon" style="color:#10b981;">📥</span>
        </div>
        <div class="report-kpi-value" style="color:#10b981;">${formatCurrency(inAmt)}</div>
        <div class="report-kpi-sub">
          <span>Sales & Services Collections</span>
        </div>
      </div>

      <div class="report-kpi-card red">
        <div class="report-kpi-header">
          <span class="report-kpi-title" style="color:#ef4444;">🔴 Outflow / Outward</span>
          <span class="report-kpi-icon" style="color:#ef4444;">📤</span>
        </div>
        <div class="report-kpi-value" style="color:#ef4444;">${formatCurrency(outAmt)}</div>
        <div class="report-kpi-sub">
          <span>Expenses, Salaries & Stock</span>
        </div>
      </div>

      <div class="report-kpi-card ${net >= 0 ? 'emerald' : 'amber'}">
        <div class="report-kpi-header">
          <span class="report-kpi-title" style="color:${net >= 0 ? '#10b981' : '#f59e0b'};">⚖️ Net Cash Flow</span>
          <span class="report-kpi-icon" style="color:${net >= 0 ? '#10b981' : '#f59e0b'};">💼</span>
        </div>
        <div class="report-kpi-value" style="color:${net >= 0 ? '#10b981' : '#f59e0b'};">${formatCurrency(net)}</div>
        <div class="report-kpi-sub">
          <span>Inward less Outward Net</span>
        </div>
      </div>

      <div class="report-kpi-card purple">
        <div class="report-kpi-header">
          <span class="report-kpi-title" style="color:#a855f7;">📑 GST / Tax Collected</span>
          <span class="report-kpi-icon" style="color:#a855f7;">🏛️</span>
        </div>
        <div class="report-kpi-value" style="color:#a855f7;">${formatCurrency(tax)}</div>
        <div class="report-kpi-sub" style="font-size:11px;">
          <span>CGST: ${formatCurrency(t.totalCGST || 0)}</span> • <span>SGST: ${formatCurrency(t.totalSGST || 0)}</span>
        </div>
      </div>

      <div class="report-kpi-card blue">
        <div class="report-kpi-header">
          <span class="report-kpi-title" style="color:#3b82f6;">📊 Taxable Base</span>
          <span class="report-kpi-icon" style="color:#3b82f6;">📈</span>
        </div>
        <div class="report-kpi-value" style="color:#3b82f6;">${formatCurrency(taxable)}</div>
        <div class="report-kpi-sub">
          <span>${t.totalTransactions || 0} Total Records Tracked</span>
        </div>
      </div>
    `;
  }

  function renderModulePills(ms) {
    const wrap = document.getElementById("modulePillsWrap");
    if (!wrap) return;

    const chips = [
      { key: "all", label: "🌐 All", count: rawTransactions.length },
      { key: "sales", label: "🛒 Sales", count: ms.sales?.count || 0, total: ms.sales?.total || 0 },
      { key: "services", label: "🔧 Services", count: ms.services?.count || 0, total: ms.services?.total || 0 },
      { key: "expenses", label: "💸 Expenses", count: ms.expenses?.count || 0, total: ms.expenses?.total || 0 },
      { key: "salaries", label: "👥 Salaries Given", count: ms.salaries?.count || 0, total: ms.salaries?.total || 0 },
      { key: "purchases", label: "📦 Purchases", count: ms.purchases?.count || 0, total: ms.purchases?.total || 0 }
    ];

    wrap.innerHTML = chips.map(c => {
      const isActive = activeModuleChip === c.key;
      return `
        <button type="button" class="module-chip ${isActive ? 'active' : ''}" data-mod="${c.key}">
          <span>${c.label}</span>
          <span class="module-chip-count">${c.count}</span>
          ${c.total ? `<span style="font-size:11px;opacity:0.9;">(${formatCurrency(c.total)})</span>` : ''}
        </button>
      `;
    }).join("");

    wrap.querySelectorAll(".module-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        activeModuleChip = btn.dataset.mod;
        wrap.querySelectorAll(".module-chip").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentPage = 1;
        renderTransactionsTable();
      });
    });
  }

  function getModuleBadge(mod) {
    switch (mod) {
      case "sales": return `<span class="badge" style="background:rgba(59,130,246,0.15);color:#3b82f6;border:1px solid rgba(59,130,246,0.3);">🛒 Sales</span>`;
      case "services": return `<span class="badge" style="background:rgba(6,182,212,0.15);color:#06b6d4;border:1px solid rgba(6,182,212,0.3);">🔧 Service</span>`;
      case "expenses": return `<span class="badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);">💸 Expense</span>`;
      case "salaries": return `<span class="badge" style="background:rgba(168,85,247,0.15);color:#a855f7;border:1px solid rgba(168,85,247,0.3);">👥 Salary</span>`;
      case "purchases": return `<span class="badge" style="background:rgba(99,102,241,0.15);color:#6366f1;border:1px solid rgba(99,102,241,0.3);">📦 Stock</span>`;
      default: return `<span class="badge">${esc(mod)}</span>`;
    }
  }

  function renderTransactionsTable() {
    const tbody = document.getElementById("auditorTableBody");
    const countEl = document.getElementById("auditorRecordCount");
    const searchVal = (document.getElementById("auditorSearchInput")?.value || "").toLowerCase().trim();

    let list = rawTransactions;

    // Filter by quick chip if not 'all'
    if (activeModuleChip !== "all") {
      list = list.filter(r => r.module === activeModuleChip);
    }

    // Filter by live search
    if (searchVal) {
      list = list.filter(r =>
        (r.ref_no || "").toLowerCase().includes(searchVal) ||
        (r.party_name || "").toLowerCase().includes(searchVal) ||
        (r.party_gstin || "").toLowerCase().includes(searchVal) ||
        (r.payment_mode || "").toLowerCase().includes(searchVal) ||
        (r.company_name || "").toLowerCase().includes(searchVal) ||
        (r.description || "").toLowerCase().includes(searchVal) ||
        (r.module || "").toLowerCase().includes(searchVal)
      );
    }

    if (countEl) countEl.textContent = `Showing ${list.length} of ${rawTransactions.length} transactions`;

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:34px;color:var(--text3);">No transactions found matching your criteria.</td></tr>`;
      renderPaginationControls(0, 1);
      return;
    }

    // Pagination slice
    const totalPages = Math.ceil(list.length / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const startIdx = (currentPage - 1) * pageSize;
    const paged = list.slice(startIdx, startIdx + pageSize);

    tbody.innerHTML = paged.map(r => {
      const inAmt = parseFloat(r.amount_in || 0);
      const outAmt = parseFloat(r.amount_out || 0);
      const taxable = parseFloat(r.taxable_amount || 0);
      const gstAmt = parseFloat(r.tax_amount || 0);

      const hasGstin = r.party_gstin && r.party_gstin.trim() !== "—" && r.party_gstin.trim() !== "" && r.party_gstin.toLowerCase() !== "unregistered";

      return `
        <tr>
          <td style="white-space:nowrap;font-size:12.5px;font-weight:500;">${formatDate(r.transaction_date)}</td>
          <td>${getModuleBadge(r.module)}</td>
          <td style="font-family:monospace;font-size:12px;font-weight:700;color:var(--text1);">${esc(r.ref_no)}</td>
          <td>
            <div style="font-weight:600;color:var(--text1);font-size:13px;">${esc(r.party_name || 'N/A')}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px;">${esc(r.description || '')}</div>
          </td>
          <td style="font-size:12px;color:var(--text2);">${esc(r.company_name || '—')}</td>
          <td>
            ${hasGstin ? `<span class="badge badge-purple" style="font-family:monospace;font-size:11px;">${esc(r.party_gstin)}</span>` : '<span style="color:var(--text3);font-size:11px;">—</span>'}
          </td>
          <td style="text-align:right;font-weight:700;color:var(--success);font-size:13px;">
            ${inAmt > 0 ? formatCurrency(inAmt) : '—'}
          </td>
          <td style="text-align:right;font-weight:700;color:var(--danger);font-size:13px;">
            ${outAmt > 0 ? formatCurrency(outAmt) : '—'}
          </td>
          <td style="text-align:right;font-size:12px;color:var(--text2);">
            ${taxable > 0 ? formatCurrency(taxable) : '—'}
          </td>
          <td style="text-align:right;font-size:12px;font-weight:600;color:var(--primary);">
            ${gstAmt > 0 ? formatCurrency(gstAmt) : '₹0.00'}
          </td>
          <td style="font-size:12px;">
            <span class="badge" style="background:var(--bg-secondary);border:1px solid var(--border);">${esc(r.payment_mode || 'Cash')}</span>
          </td>
          <td>
            <span class="badge ${r.payment_status === 'paid' || r.payment_status === 'completed' || r.payment_status === 'approved' ? 'badge-success' : 'badge-warning'}">
              ${esc(r.payment_status || 'completed')}
            </span>
          </td>
        </tr>
      `;
    }).join("");

    renderPaginationControls(list.length, totalPages);
  }

  function renderPaginationControls(totalItems, totalPages) {
    const pag = document.getElementById("auditorPagination");
    if (!pag) return;

    if (totalItems <= pageSize) {
      pag.innerHTML = `<span>Showing all ${totalItems} entries</span>`;
      return;
    }

    pag.innerHTML = `
      <span>Showing <strong>${(currentPage - 1) * pageSize + 1}</strong> to <strong>${Math.min(currentPage * pageSize, totalItems)}</strong> of <strong>${totalItems}</strong> entries</span>
      <div style="display:flex;gap:6px;align-items:center;">
        <button class="btn btn-xs btn-secondary" id="auditorPrevBtn" ${currentPage === 1 ? 'disabled' : ''}>← Previous</button>
        <span style="font-weight:600;padding:2px 8px;font-size:12px;">Page ${currentPage} of ${totalPages}</span>
        <button class="btn btn-xs btn-secondary" id="auditorNextBtn" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>
      </div>
    `;

    document.getElementById("auditorPrevBtn")?.addEventListener("click", () => {
      if (currentPage > 1) { currentPage--; renderTransactionsTable(); }
    });
    document.getElementById("auditorNextBtn")?.addEventListener("click", () => {
      if (currentPage < totalPages) { currentPage++; renderTransactionsTable(); }
    });
  }

  // Filter Listeners
  on("auditorFilterBtn", "click", fetchTransactions);
  on("auditorModuleSelect", "change", () => {
    activeModuleChip = document.getElementById("auditorModuleSelect")?.value || "all";
    fetchTransactions();
  });
  on("auditorFlowSelect", "change", fetchTransactions);
  on("auditorSearchInput", "input", () => { currentPage = 1; renderTransactionsTable(); });

  // Export CSV
  on("auditorExportCsvBtn", "click", () => {
    if (!rawTransactions || rawTransactions.length === 0) {
      showToast("No transactions available to export.", "warning");
      return;
    }

    const headers = [
      "Date", "Module", "Flow", "Ref No", "Party Name", "Party GSTIN",
      "Company Name", "Company GSTIN", "Inward Amount", "Outward Amount",
      "Taxable Value", "CGST", "SGST", "IGST", "Total GST", "Payment Mode", "Status", "Description"
    ];

    let csvContent = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";

    rawTransactions.forEach(r => {
      const row = [
        r.transaction_date || "",
        r.module || "",
        r.flow_type || "",
        r.ref_no || "",
        r.party_name || "",
        r.party_gstin || "",
        r.company_name || "",
        r.company_gstin || "",
        r.amount_in || 0,
        r.amount_out || 0,
        r.taxable_amount || 0,
        r.cgst || 0,
        r.sgst || 0,
        r.igst || 0,
        r.tax_amount || 0,
        r.payment_mode || "",
        r.payment_status || "",
        r.description || ""
      ];
      csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Auditor_Financial_Transactions_${startInp.value}_to_${endInp.value}.csv`;
    link.click();
    showToast("Auditor transactions exported to CSV!", "success");
  });

  // Print Handler
  on("auditorPrintBtn", "click", () => { window.print(); });

  // Initial load
  fetchTransactions();
}

// ═════════════════════════════════════════════════════════════════════════════
// SUBTAB 2: SALES ANALYTICS & ADVANCED PERFORMANCE DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════

async function loadSalesReportSubTab() {
  const subContent = document.getElementById("rptSubContent");
  if (!subContent) return;

  const compId = (typeof selectedCompanyId !== "undefined" && selectedCompanyId) ? selectedCompanyId : "all";
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  subContent.innerHTML = `
    <div style="padding: 18px 16px;">
      <!-- TOP BANNER & ACTION HEADER -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px;margin-bottom:20px;">
        <div style="max-width:720px;">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <h3 style="font-size:19px;font-weight:700;color:var(--text1);margin:0;letter-spacing:-0.3px;">
              📊 Sales Analytics & Performance Dashboard
            </h3>
            <span class="badge badge-success" style="font-size:11px;font-weight:600;padding:3px 8px;">
              Real-Time BI
            </span>
          </div>
          <p style="font-size:13px;color:var(--text3);margin-top:6px;line-height:1.5;">
            Performance metrics across revenue, order volume, product velocity, company branch contribution, and retail vs dealer channels.
          </p>
        </div>

        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" id="exportSalesAnalyticsCsvBtn" style="display:inline-flex;align-items:center;gap:6px;font-weight:600;">
            <span>📥</span> Export Sales CSV
          </button>
        </div>
      </div>

      <!-- RESPONSIVE FILTER PANEL -->
      <div class="reports-filter-panel">
        <div class="reports-filter-row">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;">Period:</span>
            <div class="reports-preset-group">
              <button type="button" class="reports-preset-btn sales-preset-btn" data-preset="today">Today</button>
              <button type="button" class="reports-preset-btn sales-preset-btn" data-preset="7d">Last 7 Days</button>
              <button type="button" class="reports-preset-btn sales-preset-btn active" data-preset="month">This Month</button>
              <button type="button" class="reports-preset-btn sales-preset-btn" data-preset="quarter">This Quarter</button>
              <button type="button" class="reports-preset-btn sales-preset-btn" data-preset="year">This Year</button>
            </div>
          </div>

          <div class="reports-inputs-group">
            <div style="display:flex;align-items:center;gap:6px;">
              <label style="font-size:12px;color:var(--text3);font-weight:600;margin:0;">From:</label>
              <input type="date" id="salesAnalyticsStart" class="form-input" style="height:36px;font-size:12.5px;padding:4px 8px;">
            </div>

            <div style="display:flex;align-items:center;gap:6px;">
              <label style="font-size:12px;color:var(--text3);font-weight:600;margin:0;">To:</label>
              <input type="date" id="salesAnalyticsEnd" class="form-input" style="height:36px;font-size:12.5px;padding:4px 8px;">
            </div>

            <button class="btn btn-primary" id="salesAnalyticsFilterBtn" style="height:36px;padding:6px 18px;font-weight:600;display:inline-flex;align-items:center;gap:6px;">
              <span>🔍</span> Generate Analytics
            </button>
          </div>
        </div>
      </div>

      <!-- 6 EXECUTIVE KPI CARDS GRID -->
      <div class="reports-kpi-grid" id="salesKpiCards">
        <div class="report-kpi-card blue">
          <div class="report-kpi-header"><span class="report-kpi-title">Loading...</span><span class="report-kpi-icon">⏳</span></div>
          <div class="report-kpi-value">...</div>
          <div class="report-kpi-sub">Fetching sales data</div>
        </div>
      </div>

      <!-- 2x2 ANALYTICS WIDGETS GRID -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(340px, 1fr));gap:18px;margin-bottom:24px;">
        <!-- Widget 1: Payment Mode Breakdown -->
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:18px;box-shadow:var(--shadow-sm);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <div style="font-size:14px;font-weight:700;color:var(--text1);display:flex;align-items:center;gap:6px;">
              💳 Revenue by Payment Mode
            </div>
            <span style="font-size:11px;color:var(--text3);">Cash, UPI, Bank, Finance</span>
          </div>
          <div id="paymentModeWidget" style="display:flex;flex-direction:column;gap:12px;">
            <div style="text-align:center;padding:24px;color:var(--text3);">Loading payment modes...</div>
          </div>
        </div>

        <!-- Widget 2: Channel Breakdown (Retail Customer vs Dealer) -->
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:18px;box-shadow:var(--shadow-sm);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <div style="font-size:14px;font-weight:700;color:var(--text1);display:flex;align-items:center;gap:6px;">
              👥 Customer vs Dealer Channels
            </div>
            <span style="font-size:11px;color:var(--text3);">B2C vs B2B Distribution</span>
          </div>
          <div id="channelWidget" style="display:flex;flex-direction:column;gap:14px;">
            <div style="text-align:center;padding:24px;color:var(--text3);">Loading channel distribution...</div>
          </div>
        </div>

        <!-- Widget 3: Top Selling Products -->
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:18px;box-shadow:var(--shadow-sm);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <div style="font-size:14px;font-weight:700;color:var(--text1);display:flex;align-items:center;gap:6px;">
              🏆 Top Selling Products & Models
            </div>
            <span style="font-size:11px;color:var(--text3);">By Revenue & Quantity</span>
          </div>
          <div id="topProductsWidget" style="display:flex;flex-direction:column;gap:10px;">
            <div style="text-align:center;padding:24px;color:var(--text3);">Loading top products...</div>
          </div>
        </div>

        <!-- Widget 4: Branch & Location Distribution -->
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:18px;box-shadow:var(--shadow-sm);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <div style="font-size:14px;font-weight:700;color:var(--text1);display:flex;align-items:center;gap:6px;">
              🏢 Branch & Location Contribution
            </div>
            <span style="font-size:11px;color:var(--text3);">Multi-Company Performance</span>
          </div>
          <div id="branchWidget" style="display:flex;flex-direction:column;gap:12px;">
            <div style="text-align:center;padding:24px;color:var(--text3);">Loading branch performance...</div>
          </div>
        </div>
      </div>

      <!-- DAILY SALES VELOCITY TIMELINE -->
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:18px;margin-bottom:24px;box-shadow:var(--shadow-sm);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <div style="font-size:14px;font-weight:700;color:var(--text1);display:flex;align-items:center;gap:6px;">
            📈 Daily Sales Trend & Velocity
          </div>
          <span style="font-size:11px;color:var(--text3);">Chronological sales progression</span>
        </div>
        <div id="dailyTrendWidget">
          <div style="text-align:center;padding:24px;color:var(--text3);">Loading sales timeline...</div>
        </div>
      </div>

      <!-- RECENT SALES ORDERS TABLE -->
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
          <h4 style="font-size:15px;font-weight:700;color:var(--text1);margin:0;">🛒 Sales Registry in Period</h4>
          <div style="font-size:12px;color:var(--text3);" id="salesRegistryCount">Showing recent sales</div>
        </div>

        <div class="reports-table-wrap">
          <div style="overflow-x:auto;max-width:100%;">
            <table class="data-table" style="margin:0;">
              <thead>
                <tr>
                  <th style="min-width:100px;">Date</th>
                  <th style="min-width:110px;">Invoice / Order</th>
                  <th style="min-width:180px;">Customer / Dealer</th>
                  <th style="min-width:95px;">Channel</th>
                  <th style="min-width:130px;">Branch</th>
                  <th style="min-width:95px;">Payment Mode</th>
                  <th style="min-width:95px;">Payment Status</th>
                  <th style="min-width:120px;text-align:right;">Grand Total (₹)</th>
                </tr>
              </thead>
              <tbody id="salesAnalyticsTableBody">
                <tr><td colspan="8" style="text-align:center;padding:26px;color:var(--text3);">Loading sales orders...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  const startInp = document.getElementById("salesAnalyticsStart");
  const endInp = document.getElementById("salesAnalyticsEnd");
  if (startInp) startInp.value = firstOfMonth;
  if (endInp) endInp.value = todayStr;

  // Preset buttons handler
  const presetBtns = subContent.querySelectorAll(".sales-preset-btn");
  presetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      presetBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const p = btn.dataset.preset;
      const curr = new Date();
      if (p === "today") {
        startInp.value = todayStr;
        endInp.value = todayStr;
      } else if (p === "7d") {
        const d7 = new Date(curr);
        d7.setDate(d7.getDate() - 7);
        startInp.value = d7.toISOString().split("T")[0];
        endInp.value = todayStr;
      } else if (p === "month") {
        startInp.value = firstOfMonth;
        endInp.value = todayStr;
      } else if (p === "quarter") {
        const qMonth = Math.floor(curr.getMonth() / 3) * 3;
        startInp.value = new Date(curr.getFullYear(), qMonth, 1).toISOString().split("T")[0];
        endInp.value = todayStr;
      } else if (p === "year") {
        startInp.value = `${curr.getFullYear()}-01-01`;
        endInp.value = todayStr;
      }
      fetchSalesAnalytics();
    });
  });

  let cachedAnalytics = null;

  async function fetchSalesAnalytics() {
    const sDate = startInp?.value || firstOfMonth;
    const eDate = endInp?.value || todayStr;

    try {
      const url = `${API_BASE}/reports?action=sales-analytics&company_id=${compId}&start_date=${sDate}&end_date=${eDate}`;
      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load sales analytics");
      }

      cachedAnalytics = data;
      renderKPIs(data.kpis || {});
      renderPaymentModes(data.paymentModes || [], data.kpis?.totalRevenue || 0);
      renderChannels(data.partyTypeBreakdown || {}, data.kpis?.totalRevenue || 0);
      renderTopProducts(data.topProducts || []);
      renderBranches(data.companyBreakdown || [], data.kpis?.totalRevenue || 0);
      renderDailyTimeline(data.dailyTrend || []);
      renderSalesTable(data.recentSales || []);

    } catch (err) {
      console.error("Sales analytics error:", err);
      showToast("Error loading sales analytics: " + err.message, "error");
    }
  }

  function renderKPIs(k) {
    const el = document.getElementById("salesKpiCards");
    if (!el) return;

    el.innerHTML = `
      <div class="report-kpi-card blue">
        <div class="report-kpi-header">
          <span class="report-kpi-title" style="color:#3b82f6;">💰 Total Revenue</span>
          <span class="report-kpi-icon" style="color:#3b82f6;">📈</span>
        </div>
        <div class="report-kpi-value" style="color:#3b82f6;">${formatCurrency(k.totalRevenue || 0)}</div>
        <div class="report-kpi-sub">
          <span>Taxable: ${formatCurrency(k.totalTaxable || 0)}</span>
        </div>
      </div>

      <div class="report-kpi-card green">
        <div class="report-kpi-header">
          <span class="report-kpi-title" style="color:#10b981;">📦 Products Sold</span>
          <span class="report-kpi-icon" style="color:#10b981;">🏷️</span>
        </div>
        <div class="report-kpi-value" style="color:#10b981;">${k.totalUnitsSold || 0} Units</div>
        <div class="report-kpi-sub">
          <span>Across ${k.totalOrders || 0} Invoices</span>
        </div>
      </div>

      <div class="report-kpi-card purple">
        <div class="report-kpi-header">
          <span class="report-kpi-title" style="color:#a855f7;">🧾 Total Orders</span>
          <span class="report-kpi-icon" style="color:#a855f7;">📋</span>
        </div>
        <div class="report-kpi-value" style="color:#a855f7;">${k.totalOrders || 0}</div>
        <div class="report-kpi-sub">
          <span>AOV: ${formatCurrency(k.avgOrderValue || 0)}</span>
        </div>
      </div>

      <div class="report-kpi-card emerald">
        <div class="report-kpi-header">
          <span class="report-kpi-title" style="color:#14b8a6;">💳 Collected Cash/Bank</span>
          <span class="report-kpi-icon" style="color:#14b8a6;">✅</span>
        </div>
        <div class="report-kpi-value" style="color:#14b8a6;">${formatCurrency(k.totalPaid || 0)}</div>
        <div class="report-kpi-sub">
          <span>Immediate Realized</span>
        </div>
      </div>

      <div class="report-kpi-card amber">
        <div class="report-kpi-header">
          <span class="report-kpi-title" style="color:#f59e0b;">⏳ Receivables / Pending</span>
          <span class="report-kpi-icon" style="color:#f59e0b;">🕒</span>
        </div>
        <div class="report-kpi-value" style="color:#f59e0b;">${formatCurrency(k.totalPending || 0)}</div>
        <div class="report-kpi-sub">
          <span>Uncollected Balance</span>
        </div>
      </div>

      <div class="report-kpi-card red">
        <div class="report-kpi-header">
          <span class="report-kpi-title" style="color:#ef4444;">🏛️ GST Collected</span>
          <span class="report-kpi-icon" style="color:#ef4444;">📑</span>
        </div>
        <div class="report-kpi-value" style="color:#ef4444;">${formatCurrency(k.totalTax || 0)}</div>
        <div class="report-kpi-sub">
          <span>CGST + SGST + IGST</span>
        </div>
      </div>
    `;
  }

  function renderPaymentModes(modes, totalRev) {
    const el = document.getElementById("paymentModeWidget");
    if (!el) return;

    if (!modes || modes.length === 0) {
      el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text3);">No payment mode data in this period.</div>`;
      return;
    }

    const colors = ["#3b82f6", "#10b981", "#a855f7", "#f59e0b", "#ec4899", "#64748b"];

    el.innerHTML = modes.map((m, idx) => {
      const color = colors[idx % colors.length];
      const pct = m.percentage || 0;
      return `
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;font-size:12.5px;">
            <span style="font-weight:600;color:var(--text1);">${esc(m.mode)} <span style="font-size:11px;color:var(--text3);">(${m.count} orders)</span></span>
            <span style="font-weight:700;color:${color};">${formatCurrency(m.total)} <small style="color:var(--text3);font-weight:normal;">(${pct}%)</small></span>
          </div>
          <div style="width:100%;height:8px;background:var(--bg-secondary);border-radius:6px;overflow:hidden;border:1px solid var(--border);">
            <div style="width:${Math.min(100, Math.max(2, pct))}%;height:100%;background:${color};border-radius:6px;transition:width 0.4s ease;"></div>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderChannels(pt, totalRev) {
    const el = document.getElementById("channelWidget");
    if (!el) return;

    const custRev = pt.customer?.revenue || 0;
    const custCount = pt.customer?.count || 0;
    const dealRev = pt.dealer?.revenue || 0;
    const dealCount = pt.dealer?.count || 0;

    const totalChannelRev = custRev + dealRev;
    const custPct = totalChannelRev > 0 ? ((custRev / totalChannelRev) * 100).toFixed(1) : 0;
    const dealPct = totalChannelRev > 0 ? ((dealRev / totalChannelRev) * 100).toFixed(1) : 0;

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:8px;">
        <div style="padding:14px;background:var(--bg-secondary);border-radius:10px;border:1px solid var(--border);text-align:center;">
          <div style="font-size:11.5px;color:var(--primary);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">🛒 Retail (B2C)</div>
          <div style="font-size:18px;font-weight:800;color:var(--text1);margin-top:6px;">${formatCurrency(custRev)}</div>
          <div style="font-size:11.5px;color:var(--text3);margin-top:2px;">${custCount} customers (${custPct}%)</div>
        </div>
        <div style="padding:14px;background:var(--bg-secondary);border-radius:10px;border:1px solid var(--border);text-align:center;">
          <div style="font-size:11.5px;color:#a855f7;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">🏢 Dealer (B2B)</div>
          <div style="font-size:18px;font-weight:800;color:var(--text1);margin-top:6px;">${formatCurrency(dealRev)}</div>
          <div style="font-size:11.5px;color:var(--text3);margin-top:2px;">${dealCount} dealers (${dealPct}%)</div>
        </div>
      </div>

      <div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:6px;">
          <span>Retail Share: <strong>${custPct}%</strong></span>
          <span>Dealer Share: <strong>${dealPct}%</strong></span>
        </div>
        <div style="width:100%;height:10px;background:var(--bg-secondary);border-radius:6px;overflow:hidden;display:flex;border:1px solid var(--border);">
          <div style="width:${custPct}%;height:100%;background:#3b82f6;"></div>
          <div style="width:${dealPct}%;height:100%;background:#a855f7;"></div>
        </div>
      </div>
    `;
  }

  function renderTopProducts(products) {
    const el = document.getElementById("topProductsWidget");
    if (!el) return;

    if (!products || products.length === 0) {
      el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text3);">No itemized product sales recorded in this period.</div>`;
      return;
    }

    el.innerHTML = products.slice(0, 6).map((p, idx) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:11px;font-weight:700;background:var(--primary);color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${idx + 1}</span>
          <div>
            <div style="font-weight:600;font-size:13px;color:var(--text1);">${esc(p.name)}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px;">${esc(p.category || 'General')} • ${esc(p.model || '')}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:700;color:var(--success);font-size:13px;">${formatCurrency(p.revenue)}</div>
          <div style="font-size:11px;color:var(--text3);">${p.quantity} Units Sold</div>
        </div>
      </div>
    `).join("");
  }

  function renderBranches(branches, totalRev) {
    const el = document.getElementById("branchWidget");
    if (!el) return;

    if (!branches || branches.length === 0) {
      el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text3);">No branch breakdown data available.</div>`;
      return;
    }

    el.innerHTML = branches.map(b => {
      const pct = b.percentage || 0;
      return `
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;font-size:12.5px;">
            <span style="font-weight:600;color:var(--text1);">🏢 ${esc(b.company)}</span>
            <span style="font-weight:700;color:var(--primary);">${formatCurrency(b.total)} <small style="color:var(--text3);font-weight:normal;">(${b.count} orders)</small></span>
          </div>
          <div style="width:100%;height:8px;background:var(--bg-secondary);border-radius:6px;overflow:hidden;border:1px solid var(--border);">
            <div style="width:${Math.min(100, Math.max(2, pct))}%;height:100%;background:#06b6d4;border-radius:6px;"></div>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderDailyTimeline(trend) {
    const el = document.getElementById("dailyTrendWidget");
    if (!el) return;

    if (!trend || trend.length === 0) {
      el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text3);">No daily trend data available for this range.</div>`;
      return;
    }

    const maxRev = Math.max(...trend.map(t => t.revenue || 0), 1);

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(105px, 1fr));gap:10px;">
        ${trend.slice(-14).map(t => {
          const heightPct = Math.min(100, Math.max(12, ((t.revenue || 0) / maxRev) * 100));
          return `
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:10px 8px;text-align:center;display:flex;flex-direction:column;justify-content:space-between;min-height:100px;">
              <div style="font-size:11px;color:var(--text3);font-weight:600;">${formatDate(t.date).slice(0, 6)}</div>
              <div style="height:44px;display:flex;align-items:flex-end;justify-content:center;margin:6px 0;">
                <div style="width:22px;height:${heightPct}%;background:linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%);border-radius:4px;" title="${formatCurrency(t.revenue)} (${t.orders} orders)"></div>
              </div>
              <div style="font-size:11.5px;font-weight:700;color:var(--text1);">${formatCurrency(t.revenue)}</div>
              <div style="font-size:10px;color:var(--text3);">${t.orders} ord</div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderSalesTable(sales) {
    const tbody = document.getElementById("salesAnalyticsTableBody");
    const countEl = document.getElementById("salesRegistryCount");
    if (!tbody) return;

    if (countEl) countEl.textContent = `Showing latest ${sales.length} orders`;

    if (!sales || sales.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:26px;color:var(--text3);">No sales recorded in selected timeframe.</td></tr>`;
      return;
    }

    tbody.innerHTML = sales.map(s => `
      <tr>
        <td style="font-size:12.5px;white-space:nowrap;font-weight:500;">${formatDate(s.sale_date)}</td>
        <td style="font-family:monospace;font-size:12px;font-weight:700;color:var(--text1);">SALE-${s.id}</td>
        <td style="font-weight:600;color:var(--text1);">${esc(s.customer_name || 'Counter Sale')}</td>
        <td>
          <span class="badge ${s.party_type === 'dealer' ? 'badge-purple' : 'badge-primary'}" style="font-size:11px;">
            ${s.party_type === 'dealer' ? '🏢 Dealer' : '👤 Retail'}
          </span>
        </td>
        <td style="font-size:12px;color:var(--text2);">${esc(s.company_name || '—')}</td>
        <td style="font-size:12px;"><span class="badge" style="background:var(--bg-secondary);">${esc(s.payment_mode || 'Cash')}</span></td>
        <td>
          <span class="badge ${s.payment_status === 'paid' || s.payment_status === 'completed' ? 'badge-success' : 'badge-warning'}">
            ${esc(s.payment_status || 'completed')}
          </span>
        </td>
        <td style="text-align:right;font-weight:700;color:var(--success);font-size:13px;">
          ${formatCurrency(s.grand_total || 0)}
        </td>
      </tr>
    `).join("");
  }

  // Filter Listeners
  on("salesAnalyticsFilterBtn", "click", fetchSalesAnalytics);

  // Export Sales CSV
  on("exportSalesAnalyticsCsvBtn", "click", () => {
    if (!cachedAnalytics || !cachedAnalytics.recentSales || cachedAnalytics.recentSales.length === 0) {
      showToast("No sales data to export.", "warning");
      return;
    }

    const headers = ["ID", "Date", "Customer / Dealer", "Channel", "Branch", "Payment Mode", "Payment Status", "Taxable", "Tax", "Paid", "Pending", "Grand Total"];
    let csvContent = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";

    cachedAnalytics.recentSales.forEach(s => {
      const row = [
        s.id || "",
        s.sale_date || "",
        s.customer_name || "",
        s.party_type || "customer",
        s.company_name || "",
        s.payment_mode || "",
        s.payment_status || "",
        s.taxable_amount || 0,
        s.tax_amount || 0,
        s.paid_amount || 0,
        s.pending_amount || 0,
        s.grand_total || 0
      ];
      csvContent += row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Sales_Analytics_${startInp.value}_to_${endInp.value}.csv`;
    link.click();
    showToast("Sales analytics exported to CSV!", "success");
  });

  // Initial load
  fetchSalesAnalytics();
}
