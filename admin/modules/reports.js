// ═══════════════════════════════════════════════════
// BUSINESS ERP — reports.js
// GST Auditor Reports, Sales & Financial Analytics
// ═══════════════════════════════════════════════════

window.renderReportsModule = async function (tabKey, container) {
  const isSales = tabKey === 'sales_report' || tabKey === 'rpt_sales_analytics';
  const isGst = !isSales;

  container.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;">
      <div class="sub-tabs-bar">
        <button class="sub-tab ${isGst ? 'active' : ''}" data-rptsub="gstTab">📑 Auditor GST Outward Report</button>
        <button class="sub-tab ${isSales ? 'active' : ''}" data-rptsub="salesTab">📊 Sales Analytics</button>
      </div>

      <div class="sub-content-area" id="rptSubContent">
        <!-- Loaded dynamically -->
      </div>
    </div>
  `;

  const buttons = container.querySelectorAll(".sub-tab");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.rptsub;
      let key = 'rpt_auditor_gst';
      if (target === "gstTab") { key = 'rpt_auditor_gst'; loadGSTReportSubTab(); }
      else if (target === "salesTab") { key = 'rpt_sales_analytics'; loadSalesReportSubTab(); }

      try { history.replaceState(null, '', `#${key}`); } catch (e) {}
      document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
      document.querySelector(`.nav-item[data-tab="${key}"]`)?.classList.add("active");
    });
  });

  if (isSales) loadSalesReportSubTab();
  else loadGSTReportSubTab();
};

if (window.registerModuleRoute) {
  window.registerModuleRoute(
    [
      'reports', 'gst_report', 'sales_report', 'audit',
      'rpt_auditor_gst', 'rpt_sales_analytics'
    ],
    window.renderReportsModule
  );
}

// ── SubTab 1: GST Auditor Report ──
async function loadGSTReportSubTab() {
  const subContent = document.getElementById("rptSubContent");
  const compId = selectedCompanyId || "all";
  const start = today();

  subContent.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;max-width:100%;">
        <div>
          <h3 style="font-size:16px;font-weight:600;color:var(--text1);">📑 GST Outward Supplies Report for Auditors</h3>
          <p style="font-size:13px;color:var(--text3);">Report-only view summarizing Taxable Value, CGST, SGST, IGST for GST filing.</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:100%;">
          <input type="date" id="gstStart" class="form-input" style="width:auto;max-width:100%;" value="${start}">
          <span style="color:var(--text3);">to</span>
          <input type="date" id="gstEnd" class="form-input" style="width:auto;max-width:100%;" value="${start}">
          <button class="btn btn-primary" id="gstFilterBtn" style="white-space:nowrap;">Generate Report</button>
        </div>
      </div>

      <!-- GST TOTALS SUMMARY BAR -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:12px;margin-bottom:20px;" id="gstSummaryGrid">
        <div class="stat-card blue">Loading summary...</div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Company GSTIN</th>
              <th>Customer Name</th>
              <th>Customer/dealer GSTIN</th>
              <th>Taxable Amount</th>
              <th>CGST</th>
              <th>SGST</th>
              <th>IGST</th>
              <th>Grand Total</th>
            </tr>
          </thead>
          <tbody id="gstTableBody">
            <tr><td colspan="9" style="text-align:center;padding:20px;"><div class="spinner"></div> Fetching GST data...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  async function fetchGstReport() {
    const sDate = document.getElementById("gstStart")?.value || today();
    const eDate = document.getElementById("gstEnd")?.value || today();

    try {
      const res = await fetch(`${API_BASE}/reports?action=gst-report&company_id=${compId}&start_date=${sDate}&end_date=${eDate}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          showToast("Session expired or unauthorized. Please login again.", "error");
          setTimeout(() => window.location.replace("/admin"), 1500);
          return;
        }
        showToast(data.error || "Failed to load GST report.", "error");
        const tbody = document.getElementById("gstTableBody");
        if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--danger);">${esc(data.error || 'Server error')}</td></tr>`;
        return;
      }
      if (!data.success) return;

      const t = data.totals || { totalTaxable: 0, totalCGST: 0, totalSGST: 0, totalIGST: 0, totalTax: 0, totalGrand: 0 };
      const summaryEl = document.getElementById("gstSummaryGrid");
      if (summaryEl) {
        summaryEl.innerHTML = `
        <div class="stat-card blue">
          <div class="stat-value" style="font-size:16px;">${formatCurrency(t.totalTaxable)}</div>
          <div class="stat-label">Taxable Value</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-value" style="font-size:16px;">${formatCurrency(t.totalCGST)}</div>
          <div class="stat-label">CGST Total</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-value" style="font-size:16px;">${formatCurrency(t.totalSGST)}</div>
          <div class="stat-label">SGST Total</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-value" style="font-size:16px;">${formatCurrency(t.totalIGST)}</div>
          <div class="stat-label">IGST Total</div>
        </div>
        <div class="stat-card green">
          <div class="stat-value" style="font-size:16px;">${formatCurrency(t.totalGrand)}</div>
          <div class="stat-label">Gross Value</div>
        </div>
      `;
      }

      const tbody = document.getElementById("gstTableBody");
      if (!tbody) return;
      if (!data.rows || data.rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text3);">No GST records in this date range.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.rows.map(r => {
        const hasGstin = r.customer_gstin && r.customer_gstin.trim() !== '' && r.customer_gstin.toLowerCase() !== 'unregistered';
        return `
        <tr>
          <td>${formatDate(r.sale_date)}</td>
          <td><span class="badge badge-purple">${esc(r.company_gstin || 'N/A')}</span></td>
          <td style="font-weight:600;color:var(--text1);">${esc(r.customer_name || 'Counter Sale')}</td>
          <td>${hasGstin ? `<span class="badge badge-purple">${esc(r.customer_gstin)}</span>` : 'N/A'}</td>
          <td style="font-weight:500;">${formatCurrency(r.taxable_amount)}</td>
          <td style="color:var(--primary-light);">${formatCurrency(r.cgst)}</td>
          <td style="color:var(--primary-light);">${formatCurrency(r.sgst)}</td>
          <td style="color:var(--warning);">${formatCurrency(r.igst)}</td>
          <td style="font-weight:700;color:var(--success);">${formatCurrency(r.grand_total)}</td>
        </tr>
      `;
      }).join("");

    } catch (err) {
      showToast("Fetch GST report error: " + err.message, "error");
    }
  }

  on("gstFilterBtn", "click", fetchGstReport);
  fetchGstReport();
}

// ── SubTab 2: Sales Analytics ──
async function loadSalesReportSubTab() {
  const subContent = document.getElementById("rptSubContent");
  subContent.innerHTML = `
    <div class="card">
      <h3 style="font-size:16px;font-weight:600;color:var(--text1);margin-bottom:12px;">📊 Sales Analytics & Performance</h3>
      <p style="font-size:13px;color:var(--text3);">Analytical views by product, company location, and payment modes.</p>
    </div>
  `;
}
