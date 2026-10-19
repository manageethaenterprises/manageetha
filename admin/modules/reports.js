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
    <div class="card" style="padding:0;overflow:hidden;">
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
  const start = today();

  subContent.innerHTML = `
    <div class="card" style="margin: 16px; padding: 20px;">
      <!-- HEADER -->
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:22px;">📑</span>
            <h3 style="font-size:18px;font-weight:700;color:var(--text1);margin:0;">Auditor & Financial Transactions Ledger</h3>
            <span class="badge badge-purple" style="font-size:11px;">All Modules Audit Trail</span>
          </div>
          <p style="font-size:13px;color:var(--text3);margin-top:4px;">
            Complete inward & outward financial transactions across <strong>Sales</strong>, <strong>Services</strong>, <strong>Expenses</strong>, <strong>Salaries Given</strong>, and <strong>Purchases</strong> with GST breakdown.
          </p>
        </div>

        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" id="auditorExportCsvBtn" title="Download report as CSV spreadsheet">
            📥 Export CSV
          </button>
          <button class="btn btn-secondary btn-sm" id="auditorPrintBtn" title="Print this audit report">
            🖨️ Print
          </button>
        </div>
      </div>

      <!-- FILTER CONTROLS BAR -->
      <div style="background:var(--bg-secondary);padding:14px 16px;border-radius:12px;border:1px solid var(--border);margin-bottom:20px;">
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;">
          <!-- Quick Date Presets -->
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
            <span style="font-size:12px;font-weight:600;color:var(--text3);margin-right:2px;">Quick:</span>
            <button type="button" class="btn btn-xs btn-outline date-preset-btn" data-preset="today">Today</button>
            <button type="button" class="btn btn-xs btn-outline date-preset-btn" data-preset="week">This Week</button>
            <button type="button" class="btn btn-xs btn-outline date-preset-btn active" data-preset="month">This Month</button>
            <button type="button" class="btn btn-xs btn-outline date-preset-btn" data-preset="fy">This FY</button>
          </div>

          <!-- Date Range & Module Filters -->
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:6px;">
              <label style="font-size:12px;color:var(--text3);margin:0;">From:</label>
              <input type="date" id="auditorStart" class="form-input" style="width:135px;padding:5px 8px;font-size:12.5px;">
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <label style="font-size:12px;color:var(--text3);margin:0;">To:</label>
              <input type="date" id="auditorEnd" class="form-input" style="width:135px;padding:5px 8px;font-size:12.5px;">
            </div>

            <!-- Module Filter -->
            <select id="auditorModuleSelect" class="form-select" style="width:160px;padding:5px 8px;font-size:12.5px;font-weight:600;">
              <option value="all">🌐 All Modules</option>
              <option value="sales">🛒 Sales (Inward)</option>
              <option value="services">🔧 Services (Inward)</option>
              <option value="expenses">💸 Expenses (Outward)</option>
              <option value="salaries">👥 Salaries Given (Outward)</option>
              <option value="purchases">📦 Purchases (Stock)</option>
            </select>

            <!-- Flow Filter -->
            <select id="auditorFlowSelect" class="form-select" style="width:140px;padding:5px 8px;font-size:12.5px;">
              <option value="all">↕️ All Flows</option>
              <option value="inward">🟢 Inward Only</option>
              <option value="outward">🔴 Outward Only</option>
            </select>

            <button class="btn btn-primary btn-sm" id="auditorFilterBtn" style="white-space:nowrap;padding:6px 14px;">
              🔍 Generate
            </button>
          </div>
        </div>
      </div>

      <!-- AUDIT SUMMARY METRICS CARDS -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:14px;margin-bottom:20px;" id="auditorSummaryCards">
        <div class="stat-card blue"><div class="stat-value" style="font-size:15px;">...</div><div class="stat-label">Loading Summary</div></div>
      </div>

      <!-- MODULE PILLS BREAKDOWN BAR -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px;padding:8px 12px;background:var(--bg-secondary);border-radius:10px;border:1px solid var(--border);" id="modulePillsWrap">
        <!-- Injected dynamically -->
      </div>

      <!-- LIVE SEARCH & TABLE WRAPPER -->
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
        <div style="position:relative;flex:1;max-width:360px;">
          <input type="text" id="auditorSearchInput" class="form-input" placeholder="🔎 Filter by Ref #, Party, GSTIN, Mode..." style="padding-left:12px;font-size:13px;">
        </div>
        <div style="font-size:12px;color:var(--text3);" id="auditorRecordCount">
          Showing 0 transactions
        </div>
      </div>

      <!-- DATA TABLE -->
      <div class="table-container" style="border:1px solid var(--border);border-radius:10px;overflow-x:auto;">
        <table class="data-table" id="auditorTable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Module</th>
              <th>Ref / Voucher</th>
              <th>Party / Payee</th>
              <th>Branch / Company</th>
              <th>Party GSTIN</th>
              <th style="text-align:right;">Inward (₹)</th>
              <th style="text-align:right;">Outward (₹)</th>
              <th style="text-align:right;">Taxable (₹)</th>
              <th style="text-align:right;">GST (₹)</th>
              <th>Payment Mode</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="auditorTableBody">
            <tr>
              <td colspan="12" style="text-align:center;padding:30px;color:var(--text3);">
                <div class="spinner" style="margin-bottom:8px;"></div>
                Fetching all transactions across modules...
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- TABLE PAGINATION -->
      <div id="auditorPagination" style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;font-size:13px;color:var(--text3);"></div>
    </div>
  `;

  // Set default date range to Current Month
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  const startInp = document.getElementById("auditorStart");
  const endInp = document.getElementById("auditorEnd");
  if (startInp) startInp.value = firstDayOfMonth;
  if (endInp) endInp.value = todayStr;

  // Preset buttons handler
  const presetBtns = subContent.querySelectorAll(".date-preset-btn");
  presetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      presetBtns.forEach(b => b.classList.remove("active", "btn-primary"));
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

  async function fetchTransactions() {
    const sDate = startInp?.value || firstDayOfMonth;
    const eDate = endInp?.value || todayStr;
    const mod = document.getElementById("auditorModuleSelect")?.value || "all";
    const flow = document.getElementById("auditorFlowSelect")?.value || "all";
    const tbody = document.getElementById("auditorTableBody");

    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:26px;"><div class="spinner"></div> Loading transactions...</td></tr>`;
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
      renderTransactionsTable();

    } catch (err) {
      console.error("Auditor transactions error:", err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:20px;color:var(--danger);">${esc(err.message)}</td></tr>`;
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
      <div class="stat-card green" style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;font-weight:700;color:var(--success);text-transform:uppercase;">🟢 Total Inflow / Inward</span>
          <span style="font-size:16px;">📥</span>
        </div>
        <div class="stat-value" style="font-size:19px;color:var(--success);margin-top:4px;">${formatCurrency(inAmt)}</div>
        <div class="stat-label" style="font-size:11.5px;color:var(--text3);margin-top:2px;">Sales & Service Collections</div>
      </div>

      <div class="stat-card red" style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;font-weight:700;color:var(--danger);text-transform:uppercase;">🔴 Total Outflow / Outward</span>
          <span style="font-size:16px;">📤</span>
        </div>
        <div class="stat-value" style="font-size:19px;color:var(--danger);margin-top:4px;">${formatCurrency(outAmt)}</div>
        <div class="stat-label" style="font-size:11.5px;color:var(--text3);margin-top:2px;">Expenses, Salaries & Purchases</div>
      </div>

      <div class="stat-card ${net >= 0 ? 'emerald' : 'amber'}" style="background:${net >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)'};border:1px solid ${net >= 0 ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)'};">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;font-weight:700;color:${net >= 0 ? 'var(--success)' : 'var(--warning)'};text-transform:uppercase;">⚖️ Net Cash Flow</span>
          <span style="font-size:16px;">💼</span>
        </div>
        <div class="stat-value" style="font-size:19px;color:${net >= 0 ? 'var(--success)' : 'var(--warning)'};margin-top:4px;">${formatCurrency(net)}</div>
        <div class="stat-label" style="font-size:11.5px;color:var(--text3);margin-top:2px;">Inward less Outward</div>
      </div>

      <div class="stat-card purple" style="background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;font-weight:700;color:var(--primary);text-transform:uppercase;">📑 Total Tax / GST</span>
          <span style="font-size:16px;">🏛️</span>
        </div>
        <div class="stat-value" style="font-size:19px;color:var(--primary);margin-top:4px;">${formatCurrency(tax)}</div>
        <div class="stat-label" style="font-size:11px;color:var(--text3);margin-top:2px;">CGST: ${formatCurrency(t.totalCGST || 0)} | SGST: ${formatCurrency(t.totalSGST || 0)}</div>
      </div>

      <div class="stat-card blue" style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;font-weight:700;color:var(--info, #3b82f6);text-transform:uppercase;">📊 Taxable Base</span>
          <span style="font-size:16px;">📈</span>
        </div>
        <div class="stat-value" style="font-size:19px;color:var(--info, #3b82f6);margin-top:4px;">${formatCurrency(taxable)}</div>
        <div class="stat-label" style="font-size:11.5px;color:var(--text3);margin-top:2px;">${t.totalTransactions || 0} Total Records</div>
      </div>
    `;
  }

  function renderModulePills(ms) {
    const wrap = document.getElementById("modulePillsWrap");
    if (!wrap) return;

    const pills = [
      { key: "sales", label: "🛒 Sales", count: ms.sales?.count || 0, total: ms.sales?.total || 0, color: "#3b82f6" },
      { key: "services", label: "🔧 Services", count: ms.services?.count || 0, total: ms.services?.total || 0, color: "#06b6d4" },
      { key: "expenses", label: "💸 Expenses", count: ms.expenses?.count || 0, total: ms.expenses?.total || 0, color: "#f59e0b" },
      { key: "salaries", label: "👥 Salaries Given", count: ms.salaries?.count || 0, total: ms.salaries?.total || 0, color: "#a855f7" },
      { key: "purchases", label: "📦 Purchases", count: ms.purchases?.count || 0, total: ms.purchases?.total || 0, color: "#6366f1" }
    ];

    wrap.innerHTML = `
      <span style="font-size:12px;font-weight:600;color:var(--text3);margin-right:4px;">Quick Module Filter:</span>
      ${pills.map(p => `
        <button type="button" class="btn btn-xs module-pill-btn" data-mod="${p.key}" style="border:1px solid var(--border);background:var(--bg-card);font-size:11.5px;padding:3px 9px;">
          <strong>${p.label}</strong>: <span style="color:${p.color};font-weight:700;">${p.count}</span> (${formatCurrency(p.total)})
        </button>
      `).join("")}
      <button type="button" class="btn btn-xs module-pill-btn" data-mod="all" style="border:1px solid var(--border);font-size:11.5px;padding:3px 9px;">
        Clear Module Filter
      </button>
    `;

    wrap.querySelectorAll(".module-pill-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const mKey = btn.dataset.mod;
        const selectEl = document.getElementById("auditorModuleSelect");
        if (selectEl) {
          selectEl.value = mKey;
          fetchTransactions();
        }
      });
    });
  }

  function getModuleBadge(mod) {
    switch (mod) {
      case "sales": return `<span class="badge badge-primary" style="background:#3b82f6;color:#fff;">🛒 Sales</span>`;
      case "services": return `<span class="badge badge-info" style="background:#06b6d4;color:#fff;">🔧 Service</span>`;
      case "expenses": return `<span class="badge badge-warning" style="background:#f59e0b;color:#fff;">💸 Expense</span>`;
      case "salaries": return `<span class="badge badge-purple" style="background:#a855f7;color:#fff;">👥 Salary</span>`;
      case "purchases": return `<span class="badge badge-secondary" style="background:#6366f1;color:#fff;">📦 Stock</span>`;
      default: return `<span class="badge">${esc(mod)}</span>`;
    }
  }

  function renderTransactionsTable() {
    const tbody = document.getElementById("auditorTableBody");
    const countEl = document.getElementById("auditorRecordCount");
    const searchVal = (document.getElementById("auditorSearchInput")?.value || "").toLowerCase().trim();

    let list = rawTransactions;
    if (searchVal) {
      list = list.filter(r =>
        (r.ref_no || "").toLowerCase().includes(searchVal) ||
        (r.party_name || "").toLowerCase().includes(searchVal) ||
        (r.party_gstin || "").toLowerCase().includes(searchVal) ||
        (r.payment_mode || "").toLowerCase().includes(searchVal) ||
        (r.company_name || "").toLowerCase().includes(searchVal) ||
        (r.module || "").toLowerCase().includes(searchVal)
      );
    }

    if (countEl) countEl.textContent = `Showing ${list.length} of ${rawTransactions.length} transactions`;

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:30px;color:var(--text3);">No transactions found matching your criteria.</td></tr>`;
      renderPaginationControls(0, 1);
      return;
    }

    // Pagination slice
    const totalPages = Math.ceil(list.length / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const startIdx = (currentPage - 1) * pageSize;
    const paged = list.slice(startIdx, startIdx + pageSize);

    tbody.innerHTML = paged.map(r => {
      const isInward = r.flow_type === "inward";
      const inAmt = parseFloat(r.amount_in || 0);
      const outAmt = parseFloat(r.amount_out || 0);
      const taxable = parseFloat(r.taxable_amount || 0);
      const gstAmt = parseFloat(r.tax_amount || 0);

      const hasGstin = r.party_gstin && r.party_gstin.trim() !== "—" && r.party_gstin.trim() !== "" && r.party_gstin.toLowerCase() !== "unregistered";

      return `
        <tr>
          <td style="white-space:nowrap;font-size:12.5px;">${formatDate(r.transaction_date)}</td>
          <td>${getModuleBadge(r.module)}</td>
          <td style="font-family:monospace;font-size:12px;font-weight:600;color:var(--text1);">${esc(r.ref_no)}</td>
          <td>
            <div style="font-weight:600;color:var(--text1);font-size:13px;">${esc(r.party_name || 'N/A')}</div>
            <div style="font-size:11px;color:var(--text3);">${esc(r.description || '')}</div>
          </td>
          <td style="font-size:12px;color:var(--text2);">${esc(r.company_name || '—')}</td>
          <td>${hasGstin ? `<span class="badge badge-purple" style="font-family:monospace;">${esc(r.party_gstin)}</span>` : '<span style="color:var(--text3);font-size:11px;">Unregistered</span>'}</td>
          <td style="text-align:right;font-weight:700;color:var(--success);font-size:13px;">
            ${inAmt > 0 ? formatCurrency(inAmt) : '—'}
          </td>
          <td style="text-align:right;font-weight:700;color:var(--danger);font-size:13px;">
            ${outAmt > 0 ? formatCurrency(outAmt) : '—'}
          </td>
          <td style="text-align:right;font-size:12px;color:var(--text2);">
            ${taxable > 0 ? formatCurrency(taxable) : '—'}
          </td>
          <td style="text-align:right;font-size:12px;color:var(--primary);">
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
      <div style="display:flex;gap:6px;">
        <button class="btn btn-xs btn-secondary" id="auditorPrevBtn" ${currentPage === 1 ? 'disabled' : ''}>← Previous</button>
        <span style="font-weight:600;padding:4px 8px;">Page ${currentPage} of ${totalPages}</span>
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

  // Filter and Search Event Listeners
  on("auditorFilterBtn", "click", fetchTransactions);
  on("auditorModuleSelect", "change", fetchTransactions);
  on("auditorFlowSelect", "change", fetchTransactions);
  on("auditorSearchInput", "input", () => { currentPage = 1; renderTransactionsTable(); });

  // Export CSV Handler
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
  on("auditorPrintBtn", "click", () => {
    window.print();
  });

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
    <div class="card" style="margin: 16px; padding: 20px;">
      <!-- HEADER -->
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:22px;">📊</span>
            <h3 style="font-size:18px;font-weight:700;color:var(--text1);margin:0;">Sales Analytics & Performance Dashboard</h3>
            <span class="badge badge-success" style="font-size:11px;">Real-Time Business Intelligence</span>
          </div>
          <p style="font-size:13px;color:var(--text3);margin-top:4px;">
            Comprehensive performance analytics by revenue volume, payment modes, product velocity, branch locations, and retail vs dealer channels.
          </p>
        </div>

        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" id="exportSalesAnalyticsCsvBtn" title="Download sales analysis as CSV">
            📥 Export Sales CSV
          </button>
        </div>
      </div>

      <!-- FILTER CONTROLS BAR -->
      <div style="background:var(--bg-secondary);padding:14px 16px;border-radius:12px;border:1px solid var(--border);margin-bottom:22px;">
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;">
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
            <span style="font-size:12px;font-weight:600;color:var(--text3);margin-right:2px;">Period:</span>
            <button type="button" class="btn btn-xs btn-outline sales-preset-btn" data-preset="today">Today</button>
            <button type="button" class="btn btn-xs btn-outline sales-preset-btn" data-preset="7d">Last 7 Days</button>
            <button type="button" class="btn btn-xs btn-outline sales-preset-btn active" data-preset="month">This Month</button>
            <button type="button" class="btn btn-xs btn-outline sales-preset-btn" data-preset="quarter">This Quarter</button>
            <button type="button" class="btn btn-xs btn-outline sales-preset-btn" data-preset="year">This Year</button>
          </div>

          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:6px;">
              <label style="font-size:12px;color:var(--text3);margin:0;">From:</label>
              <input type="date" id="salesAnalyticsStart" class="form-input" style="width:135px;padding:5px 8px;font-size:12.5px;">
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <label style="font-size:12px;color:var(--text3);margin:0;">To:</label>
              <input type="date" id="salesAnalyticsEnd" class="form-input" style="width:135px;padding:5px 8px;font-size:12.5px;">
            </div>
            <button class="btn btn-primary btn-sm" id="salesAnalyticsFilterBtn" style="white-space:nowrap;padding:6px 14px;">
              🔍 Generate
            </button>
          </div>
        </div>
      </div>

      <!-- KPI METRIC CARDS GRID -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:14px;margin-bottom:24px;" id="salesKpiCards">
        <div class="stat-card blue"><div class="stat-value" style="font-size:15px;">...</div><div class="stat-label">Loading KPIs</div></div>
      </div>

      <!-- 2x2 ANALYTICS WIDGETS GRID -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(360px, 1fr));gap:18px;margin-bottom:24px;">
        <!-- Widget 1: Payment Modes Breakdown -->
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <div style="font-size:14px;font-weight:700;color:var(--text1);display:flex;align-items:center;gap:6px;">
              💳 Revenue by Payment Mode
            </div>
            <span style="font-size:11px;color:var(--text3);">Cash, UPI, Bank, Finance</span>
          </div>
          <div id="paymentModeWidget" style="display:flex;flex-direction:column;gap:10px;">
            <div style="text-align:center;padding:20px;color:var(--text3);">Loading payment modes...</div>
          </div>
        </div>

        <!-- Widget 2: Channel Breakdown (Retail Customer vs Dealer) -->
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <div style="font-size:14px;font-weight:700;color:var(--text1);display:flex;align-items:center;gap:6px;">
              👥 Customer vs Dealer Channels
            </div>
            <span style="font-size:11px;color:var(--text3);">B2C vs B2B Distribution</span>
          </div>
          <div id="channelWidget" style="display:flex;flex-direction:column;gap:12px;">
            <div style="text-align:center;padding:20px;color:var(--text3);">Loading channel distribution...</div>
          </div>
        </div>

        <!-- Widget 3: Top Selling Products -->
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <div style="font-size:14px;font-weight:700;color:var(--text1);display:flex;align-items:center;gap:6px;">
              🏆 Top Selling Products & Models
            </div>
            <span style="font-size:11px;color:var(--text3);">By Revenue & Quantity</span>
          </div>
          <div id="topProductsWidget" style="display:flex;flex-direction:column;gap:8px;">
            <div style="text-align:center;padding:20px;color:var(--text3);">Loading top products...</div>
          </div>
        </div>

        <!-- Widget 4: Branch & Location Distribution -->
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <div style="font-size:14px;font-weight:700;color:var(--text1);display:flex;align-items:center;gap:6px;">
              🏢 Branch & Location Contribution
            </div>
            <span style="font-size:11px;color:var(--text3);">Multi-Company Performance</span>
          </div>
          <div id="branchWidget" style="display:flex;flex-direction:column;gap:10px;">
            <div style="text-align:center;padding:20px;color:var(--text3);">Loading branch performance...</div>
          </div>
        </div>
      </div>

      <!-- DAILY SALES TREND TIMELINE -->
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <div style="font-size:14px;font-weight:700;color:var(--text1);display:flex;align-items:center;gap:6px;">
            📈 Daily Sales Trend & Velocity
          </div>
          <span style="font-size:11px;color:var(--text3);">Chronological sales progression</span>
        </div>
        <div id="dailyTrendWidget">
          <div style="text-align:center;padding:20px;color:var(--text3);">Loading sales timeline...</div>
        </div>
      </div>

      <!-- RECENT SALES ORDERS TABLE -->
      <div style="margin-top:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
          <h4 style="font-size:15px;font-weight:700;color:var(--text1);margin:0;">🛒 Sales Registry in Period</h4>
          <div style="font-size:12px;color:var(--text3);" id="salesRegistryCount">Showing recent sales</div>
        </div>

        <div class="table-container" style="border:1px solid var(--border);border-radius:10px;overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice / Order</th>
                <th>Customer / Dealer</th>
                <th>Channel</th>
                <th>Branch</th>
                <th>Payment Mode</th>
                <th>Payment Status</th>
                <th style="text-align:right;">Grand Total (₹)</th>
              </tr>
            </thead>
            <tbody id="salesAnalyticsTableBody">
              <tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text3);">Loading sales orders...</td></tr>
            </tbody>
          </table>
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
      presetBtns.forEach(b => b.classList.remove("active", "btn-primary"));
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
      <div class="stat-card blue" style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;font-weight:700;color:var(--primary);text-transform:uppercase;">💰 Total Revenue</span>
          <span style="font-size:16px;">📈</span>
        </div>
        <div class="stat-value" style="font-size:19px;color:var(--primary);margin-top:4px;">${formatCurrency(k.totalRevenue || 0)}</div>
        <div class="stat-label" style="font-size:11.5px;color:var(--text3);margin-top:2px;">Taxable: ${formatCurrency(k.totalTaxable || 0)}</div>
      </div>

      <div class="stat-card green" style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;font-weight:700;color:var(--success);text-transform:uppercase;">📦 Products Sold</span>
          <span style="font-size:16px;">🏷️</span>
        </div>
        <div class="stat-value" style="font-size:19px;color:var(--success);margin-top:4px;">${k.totalUnitsSold || 0} Units</div>
        <div class="stat-label" style="font-size:11.5px;color:var(--text3);margin-top:2px;">Across ${k.totalOrders || 0} Invoices</div>
      </div>

      <div class="stat-card purple" style="background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;font-weight:700;color:var(--primary);text-transform:uppercase;">🧾 Total Orders</span>
          <span style="font-size:16px;">📋</span>
        </div>
        <div class="stat-value" style="font-size:19px;color:var(--primary);margin-top:4px;">${k.totalOrders || 0}</div>
        <div class="stat-label" style="font-size:11.5px;color:var(--text3);margin-top:2px;">AOV: ${formatCurrency(k.avgOrderValue || 0)}</div>
      </div>

      <div class="stat-card emerald" style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;font-weight:700;color:var(--success);text-transform:uppercase;">💳 Collected Cash/Bank</span>
          <span style="font-size:16px;">✅</span>
        </div>
        <div class="stat-value" style="font-size:19px;color:var(--success);margin-top:4px;">${formatCurrency(k.totalPaid || 0)}</div>
        <div class="stat-label" style="font-size:11.5px;color:var(--text3);margin-top:2px;">Immediate Collections</div>
      </div>

      <div class="stat-card amber" style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;font-weight:700;color:var(--warning);text-transform:uppercase;">⏳ Receivables / Pending</span>
          <span style="font-size:16px;">🕒</span>
        </div>
        <div class="stat-value" style="font-size:19px;color:var(--warning);margin-top:4px;">${formatCurrency(k.totalPending || 0)}</div>
        <div class="stat-label" style="font-size:11.5px;color:var(--text3);margin-top:2px;">Uncollected Balance</div>
      </div>

      <div class="stat-card red" style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;font-weight:700;color:var(--danger);text-transform:uppercase;">🏛️ GST Collected</span>
          <span style="font-size:16px;">📑</span>
        </div>
        <div class="stat-value" style="font-size:19px;color:var(--danger);margin-top:4px;">${formatCurrency(k.totalTax || 0)}</div>
        <div class="stat-label" style="font-size:11.5px;color:var(--text3);margin-top:2px;">CGST + SGST + IGST</div>
      </div>
    `;
  }

  function renderPaymentModes(modes, totalRev) {
    const el = document.getElementById("paymentModeWidget");
    if (!el) return;

    if (!modes || modes.length === 0) {
      el.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text3);">No payment mode data in period.</div>`;
      return;
    }

    const colors = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#64748b"];

    el.innerHTML = modes.map((m, idx) => {
      const color = colors[idx % colors.length];
      const pct = m.percentage || 0;
      return `
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-size:12.5px;">
            <span style="font-weight:600;color:var(--text1);">${esc(m.mode)} (${m.count} orders)</span>
            <span style="font-weight:700;color:${color};">${formatCurrency(m.total)} <small style="color:var(--text3);font-weight:normal;">(${pct}%)</small></span>
          </div>
          <div style="width:100%;height:8px;background:var(--bg-card);border-radius:6px;overflow:hidden;border:1px solid var(--border);">
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
        <div style="padding:12px;background:var(--bg-card);border-radius:10px;border:1px solid var(--border);text-align:center;">
          <div style="font-size:12px;color:var(--primary);font-weight:700;text-transform:uppercase;">🛒 Direct Retail (B2C)</div>
          <div style="font-size:17px;font-weight:800;color:var(--text1);margin-top:4px;">${formatCurrency(custRev)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">${custCount} customers (${custPct}%)</div>
        </div>
        <div style="padding:12px;background:var(--bg-card);border-radius:10px;border:1px solid var(--border);text-align:center;">
          <div style="font-size:12px;color:var(--purple, #a855f7);font-weight:700;text-transform:uppercase;">🏢 Dealer / B2B</div>
          <div style="font-size:17px;font-weight:800;color:var(--text1);margin-top:4px;">${formatCurrency(dealRev)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">${dealCount} dealers (${dealPct}%)</div>
        </div>
      </div>

      <div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:4px;">
          <span>Retail: ${custPct}%</span>
          <span>Dealer: ${dealPct}%</span>
        </div>
        <div style="width:100%;height:10px;background:var(--bg-card);border-radius:6px;overflow:hidden;display:flex;">
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
      el.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text3);">No itemized product sales recorded in this period.</div>`;
      return;
    }

    el.innerHTML = products.slice(0, 6).map((p, idx) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--bg-card);border-radius:8px;border:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:11px;font-weight:700;background:var(--primary);color:#fff;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${idx + 1}</span>
          <div>
            <div style="font-weight:600;font-size:13px;color:var(--text1);">${esc(p.name)}</div>
            <div style="font-size:11px;color:var(--text3);">${esc(p.category || 'General')} • ${esc(p.model || '')}</div>
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
      el.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text3);">No branch breakdown data.</div>`;
      return;
    }

    el.innerHTML = branches.map(b => {
      const pct = b.percentage || 0;
      return `
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-size:12.5px;">
            <span style="font-weight:600;color:var(--text1);">🏢 ${esc(b.company)}</span>
            <span style="font-weight:700;color:var(--primary);">${formatCurrency(b.total)} <small style="color:var(--text3);">(${b.count} orders)</small></span>
          </div>
          <div style="width:100%;height:8px;background:var(--bg-card);border-radius:6px;overflow:hidden;border:1px solid var(--border);">
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
      el.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text3);">No daily trend data available for this range.</div>`;
      return;
    }

    const maxRev = Math.max(...trend.map(t => t.revenue || 0), 1);

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(95px, 1fr));gap:8px;">
        ${trend.slice(-14).map(t => {
          const heightPct = Math.min(100, Math.max(12, ((t.revenue || 0) / maxRev) * 100));
          return `
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:8px 6px;text-align:center;display:flex;flex-direction:column;justify-content:space-between;">
              <div style="font-size:10.5px;color:var(--text3);font-weight:600;">${formatDate(t.date).slice(0, 6)}</div>
              <div style="height:44px;display:flex;align-items:flex-end;justify-content:center;margin:6px 0;">
                <div style="width:20px;height:${heightPct}%;background:linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%);border-radius:4px;" title="${formatCurrency(t.revenue)} (${t.orders} orders)"></div>
              </div>
              <div style="font-size:11px;font-weight:700;color:var(--text1);">${formatCurrency(t.revenue)}</div>
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
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text3);">No sales recorded in selected timeframe.</td></tr>`;
      return;
    }

    tbody.innerHTML = sales.map(s => `
      <tr>
        <td style="font-size:12.5px;white-space:nowrap;">${formatDate(s.sale_date)}</td>
        <td style="font-family:monospace;font-size:12px;font-weight:600;">SALE-${s.id}</td>
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

  // Filter event listeners
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
