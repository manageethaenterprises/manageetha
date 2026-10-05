// ═══════════════════════════════════════════════════
// BUSINESS ERP — services.js
// Complete Service Jobs Management, Warranty Lookup, Payments, Parts Cart & Mechanics
// ═══════════════════════════════════════════════════

window.renderServicesModule = async function (tabKey, container) {
  const activeTab = tabKey || 'svc_get_details';

  container.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);border-radius:12px;border:1px solid var(--border);">
      <div class="sub-tabs-bar" style="display:flex;gap:4px;overflow-x:auto;padding:8px 12px;background:var(--bg-secondary);border-bottom:1px solid var(--border);">
        <button class="sub-tab ${activeTab === 'svc_today_tasks' ? 'active' : ''}" data-tabkey="svc_today_tasks">📋 Today Tasks</button>
        <button class="sub-tab ${activeTab === 'svc_get_details' || activeTab === 'service' ? 'active' : ''}" data-tabkey="svc_get_details">🔍 Get Details & Warranty Check</button>
        <button class="sub-tab ${activeTab === 'svc_warranty' ? 'active' : ''}" data-tabkey="svc_warranty">🛡️ Warranty Services</button>
        <button class="sub-tab ${activeTab === 'svc_paid' ? 'active' : ''}" data-tabkey="svc_paid">💰 Paid Services</button>
        <button class="sub-tab ${activeTab === 'svc_mechanics' || activeTab === 'mechanics' ? 'active' : ''}" data-tabkey="svc_mechanics">🔧 Mechanics & Staff</button>
        <button class="sub-tab ${activeTab === 'svc_payments' ? 'active' : ''}" data-tabkey="svc_payments">💸 Payments & Spare Parts</button>
        <button class="sub-tab ${activeTab === 'svc_receipts' ? 'active' : ''}" data-tabkey="svc_receipts">🧾 Service Receipts</button>
        <button class="sub-tab ${activeTab === 'svc_replacement' ? 'active' : ''}" data-tabkey="svc_replacement">🔄 Warranty Replacement</button>
      </div>

      <div class="sub-content-area" id="srvSubContent" style="padding:20px;">
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

  const subArea = document.getElementById("srvSubContent");
  if (activeTab === 'svc_today_tasks') {
    if (window.renderTodayTasksModule) await window.renderTodayTasksModule('svc_today_tasks', subArea);
    else loadJobsSubTab(activeTab);
  }
  else if (activeTab === 'svc_get_details' || activeTab === 'service') loadGetDetailsSubTab();
  else if (activeTab === 'svc_mechanics' || activeTab === 'mechanics') loadMechanicsSubTab();
  else if (activeTab === 'svc_payments') loadPaymentsSubTab();
  else if (activeTab === 'svc_receipts') loadServiceReceiptsSubTab();
  else loadJobsSubTab(activeTab);
};

if (window.registerModuleRoute) {
  window.registerModuleRoute(
    [
      'service', 'service_jobs', 'mechanics',
      'svc_today_tasks', 'svc_get_details', 'svc_warranty',
      'svc_paid', 'svc_mechanics', 'svc_payments', 'svc_receipts', 'svc_replacement'
    ],
    window.renderServicesModule
  );
}

// ── SubTab 1: Get Details & Warranty Eligibility Check via Barcode / DC / Invoice / Serial No ──
function loadGetDetailsSubTab() {
  const subContent = document.getElementById("srvSubContent");

  subContent.innerHTML = `
    <div style="max-width:900px;margin:0 auto;">
      <div style="text-align:center;margin-bottom:24px;">
        <h2 style="font-size:20px;font-weight:700;color:var(--text1);margin-bottom:6px;">🔍 Equipment Service & Warranty Eligibility Lookup</h2>
        <p style="font-size:13px;color:var(--text3);margin:0;">Scan Machine Serial Barcode or enter Invoice / Delivery Challana Number (DC) to check 1-Year Warranty eligibility</p>
      </div>

      <div style="background:var(--bg-secondary);padding:20px;border-radius:12px;border:2px solid var(--primary);margin-bottom:24px;box-shadow:0 4px 12px rgba(0,0,0,0.04);">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <div style="position:relative;flex:1;min-width:260px;">
            <input type="text" id="svcLookupInp" class="form-input" placeholder="Scan Barcode / Enter Invoice No, DC No, or Machine Serial No..." style="font-weight:700;font-size:14px;padding-left:38px;height:44px;border-color:var(--primary);" autocomplete="off">
            <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:18px;">📷</span>
          </div>
          <button type="button" class="btn btn-primary" id="svcLookupBtn" style="height:44px;padding:0 24px;font-weight:700;font-size:14px;background:linear-gradient(135deg,var(--primary),#2563eb);">⚡ Search & Check Warranty</button>
        </div>
      </div>

      <div id="warrantyResultArea" style="display:none;"></div>
    </div>
  `;

  const lookupInp = document.getElementById("svcLookupInp");
  const lookupBtn = document.getElementById("svcLookupBtn");

  const runLookup = async () => {
    const q = lookupInp.value.trim();
    if (!q) return showToast("Please scan or enter an Invoice No, DC No, or Machine Serial No", "error");

    setButtonLoading(lookupBtn, true, "Checking...");
    const resArea = document.getElementById("warrantyResultArea");
    resArea.style.display = "block";
    resArea.innerHTML = `<div style="text-align:center;padding:30px;"><div class="spinner"></div><p style="margin-top:10px;color:var(--text2);font-weight:600;">Searching sales records & calculating warranty eligibility...</p></div>`;

    try {
      const res = await fetch(`${API_BASE}/services?action=lookup-warranty&query=${encodeURIComponent(q)}`, { headers: authHeaders() });
      const data = await res.json();

      if (!data.success) {
        resArea.innerHTML = `<div class="card" style="background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;padding:16px;">❌ ${esc(data.error || "Lookup failed")}</div>`;
        return;
      }

      const d = data.details || {};
      const isEligible = data.warranty_eligible;
      const days = d.days_elapsed;

      resArea.innerHTML = `
        <div class="card" style="background:${isEligible ? '#f0fdf4' : '#fffbe6'};border:2px solid ${isEligible ? '#bbf7d0' : '#fef3c7'};padding:20px;border-radius:12px;">
          <!-- WARRANTY BADGE BANNER -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid ${isEligible ? '#dcfce7' : '#fef08a'};">
            <div>
              <span class="badge ${isEligible ? 'badge-success' : 'badge-warning'}" style="font-size:14px;padding:6px 12px;font-weight:700;">
                ${isEligible ? '🟢 ELIGIBLE FOR FREE WARRANTY SERVICE' : '🔴 WARRANTY EXPIRED / CHARGED SERVICE'}
              </span>
              <div style="font-size:13px;color:${isEligible ? '#166534' : '#b45309'};margin-top:6px;font-weight:600;">
                ${esc(data.warranty_message)}
              </div>
            </div>
            ${days !== null && days !== undefined ? `
              <div style="text-align:right;">
                <div style="font-size:20px;font-weight:800;color:${isEligible ? '#15803d' : '#d97706'};">${days} Days</div>
                <div style="font-size:11px;color:var(--text3);">Since Purchase Date (1 Year = 365 Days)</div>
              </div>
            ` : ''}
          </div>

          <!-- DETAILS GRID -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
            <div style="background:var(--bg-primary);padding:12px;border-radius:8px;border:1px solid var(--border);">
              <div style="font-size:11px;color:var(--text3);text-transform:uppercase;font-weight:700;margin-bottom:4px;">👤 Customer Details</div>
              <div style="font-size:14px;font-weight:700;color:var(--text1);">${esc(d.customer_name || 'Walk-in / Unknown Customer')}</div>
              ${d.customer_phone ? `<div style="font-size:12px;color:var(--text2);margin-top:2px;">📞 ${esc(d.customer_phone)}</div>` : ''}
              ${d.village ? `<div style="font-size:12px;color:var(--text3);margin-top:2px;">📍 ${esc(d.village)}, ${esc(d.mandal || '')}</div>` : ''}
            </div>

            <div style="background:var(--bg-primary);padding:12px;border-radius:8px;border:1px solid var(--border);">
              <div style="font-size:11px;color:var(--text3);text-transform:uppercase;font-weight:700;margin-bottom:4px;">📦 Machine & Purchase Info</div>
              <div style="font-size:14px;font-weight:700;color:var(--text1);">${esc(d.product_name || 'Equipment')}</div>
              <div style="font-size:12px;color:var(--primary);font-weight:700;margin-top:2px;">⚙️ Chassis/Serial: ${esc(d.serial_number || q)}</div>
              ${d.purchase_date ? `<div style="font-size:12px;color:var(--text2);margin-top:2px;">📅 Purchase Date: ${esc(d.purchase_date)} (${d.challan_number ? `DC: #${d.challan_number}` : ''})</div>` : ''}
            </div>
          </div>

          <!-- BOOKING ACTION BUTTON -->
          <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button class="btn btn-primary" id="bookDirectJobBtn" style="font-weight:700;padding:10px 20px;background:linear-gradient(135deg,#16a34a,#15803d);">
              ${isEligible ? '🛡️ Book Free Warranty Service Job' : '💰 Book Paid Repair / Service Job'}
            </button>
          </div>
        </div>
      `;

      document.getElementById("bookDirectJobBtn")?.addEventListener("click", () => {
        openBookJobModal({
          service_type: isEligible ? 'warranty' : 'paid',
          warranty_eligible: isEligible,
          customer_id: d.customer_id,
          customer_name: d.customer_name,
          customer_phone: d.customer_phone,
          product_id: d.product_id,
          sale_id: d.sale_id,
          serial_number: d.serial_number || q,
          barcode_ref: q
        });
      });

    } catch (err) {
      resArea.innerHTML = `<div class="card" style="background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;padding:16px;">Error: ${esc(err.message)}</div>`;
    } finally {
      setButtonLoading(lookupBtn, false);
    }
  };

  if (lookupInp) {
    lookupInp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        runLookup();
      }
    });
    setTimeout(() => lookupInp.focus(), 200);
  }

  if (lookupBtn) lookupBtn.addEventListener("click", runLookup);
}

// ── SubTab 2: Service Jobs Register (Warranty & Paid Services Table) ──
async function loadJobsSubTab(activeTabKey = "svc_get_details") {
  const subContent = document.getElementById("srvSubContent");
  const userObj = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null) || JSON.parse(localStorage.getItem('erp_user') || '{}');
  const isSuperAdmin = userObj && (userObj.role === 'superadmin' || userObj.username === 'superadmin');
  const compId = isSuperAdmin ? (selectedCompanyId || 'all') : (userObj?.company_id || selectedCompanyId || 'all');

  let tabTitle = "Service Jobs Register (Warranty & Paid Repairs)";
  let filterType = "all";
  if (activeTabKey === "svc_warranty") {
    tabTitle = "🛡️ Free Warranty Repairs Register (1-Year Coverage)";
    filterType = "warranty";
  } else if (activeTabKey === "svc_paid") {
    tabTitle = "💰 Paid Repair & General Maintenance Services";
    filterType = "paid";
  } else if (activeTabKey === "svc_replacement") {
    tabTitle = "🔄 Warranty Replacement & Claim Claims";
    filterType = "replacement";
  } else if (activeTabKey === "svc_receipts") {
    tabTitle = "🧾 Service Invoices & Receipts";
  }

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">${tabTitle}</h3>
      <button class="btn btn-primary" id="addJobBtn" style="font-weight:700;">+ Book New Service Job</button>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Job No</th>
            <th>Customer & Phone</th>
            <th>Equipment / Serial No</th>
            <th>Service Type</th>
            <th>Complaint</th>
            <th>Mechanic</th>
            <th>Service Charge</th>
            <th>Spare Parts Cost</th>
            <th>Total Cost</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="jobsTableBody">
          <tr><td colspan="11" style="text-align:center;padding:20px;"><div class="spinner"></div> Loading service jobs...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 4px;flex-wrap:wrap;gap:8px;">
      <div id="jobsInfo"></div>
      <div id="jobsPagination" class="pagination"></div>
    </div>
  `;

  on("addJobBtn", "click", () => openBookJobModal());

  async function fetchJobs() {
    try {
      const res = await fetch(`${API_BASE}/services?action=job-list&company_id=${compId}&type=${filterType}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success || !data.jobs) return;

      window.renderPaginatedTable({
        data: data.jobs,
        pageSize: 10,
        currentPage: 1,
        tbody: "jobsTableBody",
        paginationContainer: "jobsPagination",
        infoContainer: "jobsInfo",
        renderRow: (j) => {
          const isWarranty = j.service_type === 'warranty' || j.warranty_eligible;
          const statusColors = {
            'open': 'badge-warning',
            'in_progress': 'badge-info',
            'repaired': 'badge-purple',
            'delivered': 'badge-success',
            'cancelled': 'badge-danger'
          };
          return `
            <tr>
              <td><span class="badge badge-purple" style="font-family:monospace;font-weight:700;">${esc(j.job_number)}</span></td>
              <td>
                <div style="font-weight:600;color:var(--text1);">${esc(j.customer_name_ref || j.customer_name || 'Walk-in Customer')}</div>
              </td>
              <td>
                <div style="font-size:12px;font-weight:600;">${esc(j.product_name || 'Machine')}</div>
                ${j.serial_number ? `<div style="font-size:11px;color:var(--primary);font-family:monospace;font-weight:700;">⚙️ ${esc(j.serial_number)}</div>` : ''}
              </td>
              <td>
                <span class="badge ${isWarranty ? 'badge-success' : 'badge-warning'}">
                  ${isWarranty ? '🛡️ WARRANTY' : '💰 PAID'}
                </span>
              </td>
              <td><div style="max-width:180px;font-size:12px;">${esc(j.complaint)}</div></td>
              <td>${esc(j.mechanic_name || 'Unassigned')}</td>
              <td>${formatCurrency(j.labor_charge || 0)}</td>
              <td>${formatCurrency(j.total_parts_cost || 0)}</td>
              <td style="font-weight:700;color:var(--success);">${formatCurrency(j.grand_total || 0)}</td>
              <td>
                <span class="badge ${statusColors[j.status] || 'badge-secondary'}" style="text-transform:uppercase;">
                  ${esc((j.status || 'open').replace('_', ' '))}
                </span>
              </td>
              <td>
                <div style="display:flex;gap:4px;flex-wrap:wrap;">
                  <button class="btn btn-sm btn-outline-primary viewCartBtn" data-id="${j.id}" title="Manage Parts Cart & GST Breakdown">🛒 Cart & GST</button>
                  <button class="btn btn-sm btn-outline-info updateStatusBtn" data-id="${j.id}" title="Update Job Status">Status</button>
                  <button class="btn btn-sm btn-outline printJobSheetBtn" data-id="${j.id}" title="Print Job Sheet for Mechanic">📄 Sheet</button>
                  <button class="btn btn-sm btn-outline printInvoiceBtn" data-id="${j.id}" title="Print Invoice / Receipt">🧾 Invoice</button>
                  ${isSuperAdmin ? `<button class="btn btn-sm btn-outline-danger deleteJobBtn" data-id="${j.id}" title="Delete Job">🗑️ Delete</button>` : ''}
                </div>
              </td>
            </tr>
          `;
        },
        onRender: () => {
          const tbody = document.getElementById("jobsTableBody");
          if (!tbody) return;

          tbody.querySelectorAll(".viewCartBtn").forEach(btn => {
            btn.addEventListener("click", () => openPartsCartModal(btn.dataset.id, fetchJobs));
          });

          tbody.querySelectorAll(".updateStatusBtn").forEach(btn => {
            btn.addEventListener("click", () => openUpdateStatusModal(btn.dataset.id, fetchJobs));
          });

          tbody.querySelectorAll(".printJobSheetBtn").forEach(btn => {
            btn.addEventListener("click", () => printJobSheet(btn.dataset.id));
          });

          tbody.querySelectorAll(".printInvoiceBtn").forEach(btn => {
            btn.addEventListener("click", () => printJobInvoice(btn.dataset.id));
          });

          tbody.querySelectorAll(".deleteJobBtn").forEach(btn => {
            btn.addEventListener("click", () => confirmDeleteJob(btn.dataset.id, fetchJobs));
          });
        }
      });

    } catch (err) {
      showToast("Fetch jobs error: " + err.message, "error");
    }
  }

  fetchJobs();
}

// ── SubTab 3: Payments & Spare Parts Page (with GST Reconciliation & Parts Cart) ──
async function loadPaymentsSubTab() {
  const subContent = document.getElementById("srvSubContent");
  const userObj = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null) || JSON.parse(localStorage.getItem('erp_user') || '{}');
  const isSuperAdmin = userObj && (userObj.role === 'superadmin' || userObj.username === 'superadmin');
  const compId = isSuperAdmin ? (selectedCompanyId || 'all') : (userObj?.company_id || selectedCompanyId || 'all');

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <div>
        <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">💸 Payments, Spare Parts Cart & GST Reconciliation</h3>
        <p style="font-size:12px;color:var(--text3);margin:2px 0 0 0;">Add/remove spare parts dynamically, reconcile GST per part & overall, collect payments and print invoices</p>
      </div>
      <button class="btn btn-primary" id="addJobBtnPayments" style="font-weight:700;">+ Book New Service Job</button>
    </div>

    <!-- OVERALL GST RECONCILIATION SUMMARY BAR -->
    <div id="overallGstBar" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:12px;margin-bottom:20px;">
      <div style="background:var(--bg-secondary);padding:12px;border-radius:10px;border:1px solid var(--border);">
        <div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;">📦 Parts Base Total</div>
        <div id="totPartsBase" style="font-size:16px;font-weight:800;color:var(--text1);margin-top:2px;">₹0.00</div>
      </div>
      <div style="background:var(--bg-secondary);padding:12px;border-radius:10px;border:1px solid var(--border);">
        <div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;">📊 Total Parts GST</div>
        <div id="totPartsGst" style="font-size:16px;font-weight:800;color:var(--primary);margin-top:2px;">₹0.00</div>
      </div>
      <div style="background:var(--bg-secondary);padding:12px;border-radius:10px;border:1px solid var(--border);">
        <div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;">🔧 Service Charges</div>
        <div id="totLabor" style="font-size:16px;font-weight:800;color:var(--text1);margin-top:2px;">₹0.00</div>
      </div>
      <div style="background:var(--bg-secondary);padding:12px;border-radius:10px;border:1px solid var(--border);">
        <div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;">💳 Revenue Total</div>
        <div id="totGrand" style="font-size:16px;font-weight:800;color:var(--success);margin-top:2px;">₹0.00</div>
      </div>
      <div style="background:var(--bg-secondary);padding:12px;border-radius:10px;border:1px solid var(--border);">
        <div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;">🟢 Payments Collected</div>
        <div id="totPaid" style="font-size:16px;font-weight:800;color:var(--success);margin-top:2px;">₹0.00</div>
      </div>
      <div style="background:var(--bg-secondary);padding:12px;border-radius:10px;border:1px solid var(--border);">
        <div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;">🔴 Pending Balance</div>
        <div id="totPending" style="font-size:16px;font-weight:800;color:var(--danger);margin-top:2px;">₹0.00</div>
      </div>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Job No</th>
            <th>Equipment / Serial No</th>
            <th>Service Type</th>
            <th>Mechanic</th>
            <th>Spare Parts Cost</th>
            <th>Parts GST</th>
            <th>Service Charge</th>
            <th>Total Cost</th>
            <th>Paid</th>
            <th>Pending</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="paymentsTableBody">
          <tr><td colspan="12" style="text-align:center;padding:20px;"><div class="spinner"></div> Loading service jobs and GST reconciliation...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 4px;flex-wrap:wrap;gap:8px;">
      <div id="paymentsInfo"></div>
      <div id="paymentsPagination" class="pagination"></div>
    </div>
  `;

  on("addJobBtnPayments", "click", () => openBookJobModal());

  async function fetchPaymentsJobs() {
    try {
      const res = await fetch(`${API_BASE}/services?action=job-list&company_id=${compId}&type=all`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success || !data.jobs) return;

      // Calculate overall GST reconciliation metrics
      let sumPartsBase = 0;
      let sumPartsGst = 0;
      let sumLabor = 0;
      let sumGrand = 0;
      let sumPaid = 0;
      let sumPending = 0;

      data.jobs.forEach(j => {
        sumPartsBase += parseFloat(j.total_parts_cost || 0);
        sumPartsGst += parseFloat(j.gst_amount || 0);
        sumLabor += parseFloat(j.labor_charge || 0);
        sumGrand += parseFloat(j.grand_total || 0);
        sumPaid += parseFloat(j.paid_amount || 0);
        sumPending += Math.max(0, parseFloat(j.grand_total || 0) - parseFloat(j.paid_amount || 0));
      });

      document.getElementById("totPartsBase").innerText = `₹${sumPartsBase.toFixed(2)}`;
      document.getElementById("totPartsGst").innerText = `₹${sumPartsGst.toFixed(2)}`;
      document.getElementById("totLabor").innerText = `₹${sumLabor.toFixed(2)}`;
      document.getElementById("totGrand").innerText = `₹${sumGrand.toFixed(2)}`;
      document.getElementById("totPaid").innerText = `₹${sumPaid.toFixed(2)}`;
      document.getElementById("totPending").innerText = `₹${sumPending.toFixed(2)}`;

      window.renderPaginatedTable({
        data: data.jobs,
        pageSize: 10,
        currentPage: 1,
        tbody: "paymentsTableBody",
        paginationContainer: "paymentsPagination",
        infoContainer: "paymentsInfo",
        renderRow: (j) => {
          const isWarranty = j.service_type === 'warranty' || j.warranty_eligible;
          const paidAmt = parseFloat(j.paid_amount || 0);
          const grandTot = parseFloat(j.grand_total || 0);
          const pendAmt = Math.max(0, grandTot - paidAmt);
          
          let payBadge = `<span class="badge badge-danger">UNPAID</span>`;
          if (pendAmt <= 0.01 && grandTot > 0) payBadge = `<span class="badge badge-success">PAID</span>`;
          else if (paidAmt > 0) payBadge = `<span class="badge badge-warning">PARTIAL</span>`;

          return `
            <tr>
              <td>
                <span class="badge badge-purple" style="font-family:monospace;font-weight:700;">${esc(j.job_number)}</span>
                <div style="font-size:11px;color:var(--text3);">${esc(j.customer_name_ref || j.customer_name || 'Walk-in')}</div>
              </td>
              <td>
                <div style="font-size:12px;font-weight:600;">${esc(j.product_name || 'Equipment')}</div>
                ${j.serial_number ? `<div style="font-size:11px;color:var(--primary);font-family:monospace;font-weight:700;">⚙️ ${esc(j.serial_number)}</div>` : ''}
              </td>
              <td>
                <span class="badge ${isWarranty ? 'badge-success' : 'badge-warning'}">
                  ${isWarranty ? '🛡️ WARRANTY' : '💰 PAID'}
                </span>
              </td>
              <td>${esc(j.mechanic_name || 'Unassigned')}</td>
              <td>${formatCurrency(j.total_parts_cost || 0)}</td>
              <td style="color:var(--primary);font-weight:600;">${formatCurrency(j.gst_amount || 0)}</td>
              <td>${formatCurrency(j.labor_charge || 0)}</td>
              <td style="font-weight:700;color:var(--text1);">${formatCurrency(grandTot)}</td>
              <td style="font-weight:700;color:var(--success);">${formatCurrency(paidAmt)}</td>
              <td style="font-weight:700;color:${pendAmt > 0 ? 'var(--danger)' : 'var(--text3)'};">${formatCurrency(pendAmt)}</td>
              <td>${payBadge}</td>
              <td>
                <div style="display:flex;gap:4px;flex-wrap:wrap;">
                  <button class="btn btn-sm btn-primary openCartModalBtn" data-id="${j.id}" title="View Cart, Add/Remove Parts & Per-Part GST">🛒 Cart & GST</button>
                  <button class="btn btn-sm btn-success makePaymentBtn" data-id="${j.id}" title="Make Service Payment">💳 Pay</button>
                  <button class="btn btn-sm btn-outline printJobSheetBtn" data-id="${j.id}" title="Print Mechanic Job Sheet">📄 Sheet</button>
                  <button class="btn btn-sm btn-outline printInvoiceBtn" data-id="${j.id}" title="Print Tax Invoice">🧾 Invoice</button>
                  ${isSuperAdmin ? `<button class="btn btn-sm btn-outline-danger deleteJobBtn" data-id="${j.id}" title="Delete Job">🗑️ Delete</button>` : ''}
                </div>
              </td>
            </tr>
          `;
        },
        onRender: () => {
          const tbody = document.getElementById("paymentsTableBody");
          if (!tbody) return;

          tbody.querySelectorAll(".openCartModalBtn").forEach(btn => {
            btn.addEventListener("click", () => openPartsCartModal(btn.dataset.id, fetchPaymentsJobs));
          });

          tbody.querySelectorAll(".makePaymentBtn").forEach(btn => {
            btn.addEventListener("click", () => openMakePaymentModal(btn.dataset.id, fetchPaymentsJobs));
          });

          tbody.querySelectorAll(".printJobSheetBtn").forEach(btn => {
            btn.addEventListener("click", () => printJobSheet(btn.dataset.id));
          });

          tbody.querySelectorAll(".printInvoiceBtn").forEach(btn => {
            btn.addEventListener("click", () => printJobInvoice(btn.dataset.id));
          });

          tbody.querySelectorAll(".deleteJobBtn").forEach(btn => {
            btn.addEventListener("click", () => confirmDeleteJob(btn.dataset.id, fetchPaymentsJobs));
          });
        }
      });

    } catch (err) {
      showToast("Fetch payments jobs error: " + err.message, "error");
    }
  }

  fetchPaymentsJobs();
}

// ── Modal: Parts Cart & Per-Part GST Reconciliation ──
async function openPartsCartModal(jobId, onSuccess) {
  try {
    const res = await fetch(`${API_BASE}/services?action=job-details&id=${jobId}`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.success || !data.job) return showToast("Failed to fetch job details", "error");

    const j = data.job;
    const parts = data.parts || [];

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;";

    let totalBaseParts = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalPartsGst = 0;
    let totalPartsGrand = 0;

    parts.forEach(p => {
      const base = p.quantity * parseFloat(p.unit_price || 0);
      const cgst = parseFloat(p.cgst || 0);
      const sgst = parseFloat(p.sgst || 0);
      const igst = parseFloat(p.igst || 0);
      const gstSum = cgst + sgst + igst;
      const tot = parseFloat(p.total || base + gstSum);

      totalBaseParts += base;
      totalCgst += cgst;
      totalSgst += sgst;
      totalPartsGst += gstSum;
      totalPartsGrand += tot;
    });

    const lCharge = parseFloat(j.labor_charge || 0);
    const grandTot = parseFloat(j.grand_total || (lCharge + totalPartsGrand));

    overlay.innerHTML = `
      <div class="modal-content" style="background:var(--bg-primary);border-radius:12px;max-width:880px;width:100%;padding:24px;border:1px solid var(--border);max-height:90vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:16px;">
          <div>
            <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">🛒 Service Spare Parts Cart & Per-Part GST Reconciliation</h3>
            <div style="font-size:12px;color:var(--text3);margin-top:2px;">Job <strong style="font-family:monospace;color:var(--primary);">#${esc(j.job_number)}</strong> (${esc(j.customer_name_ref || j.customer_name || 'Walk-in')})</div>
          </div>
          <button class="btn btn-sm btn-outline closeCartModal">&times;</button>
        </div>

        <!-- RECONCILIATION SUMMARY BANNER -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px;margin-bottom:16px;">
          <div style="background:var(--bg-secondary);padding:10px;border-radius:8px;border:1px solid var(--border);">
            <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;">Parts Base</div>
            <div style="font-size:14px;font-weight:800;color:var(--text1);">₹${totalBaseParts.toFixed(2)}</div>
          </div>
          <div style="background:var(--bg-secondary);padding:10px;border-radius:8px;border:1px solid var(--border);">
            <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;">CGST Total</div>
            <div style="font-size:14px;font-weight:800;color:var(--primary);">₹${totalCgst.toFixed(2)}</div>
          </div>
          <div style="background:var(--bg-secondary);padding:10px;border-radius:8px;border:1px solid var(--border);">
            <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;">SGST Total</div>
            <div style="font-size:14px;font-weight:800;color:var(--primary);">₹${totalSgst.toFixed(2)}</div>
          </div>
          <div style="background:var(--bg-secondary);padding:10px;border-radius:8px;border:1px solid var(--border);">
            <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;">Service Charge</div>
            <div style="font-size:14px;font-weight:800;color:var(--text1);">₹${lCharge.toFixed(2)}</div>
          </div>
          <div style="background:var(--bg-secondary);padding:10px;border-radius:8px;border:1px solid var(--border);">
            <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;">Grand Total</div>
            <div style="font-size:14px;font-weight:800;color:var(--success);">₹${grandTot.toFixed(2)}</div>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <h4 style="font-size:14px;font-weight:700;margin:0;color:var(--text1);">📦 Installed Parts Cart (${parts.length} items)</h4>
          <button class="btn btn-sm btn-primary" id="addPartToCartBtn" style="font-weight:700;">➕ Add Spare Part to Cart</button>
        </div>

        <!-- PER-PART GST RECONCILIATION TABLE -->
        <div class="table-container" style="margin-bottom:16px;">
          <table class="data-table" style="font-size:12px;">
            <thead>
              <tr>
                <th>#</th>
                <th>Spare Part Name</th>
                <th>HSN</th>
                <th style="text-align:center;">Qty</th>
                <th style="text-align:right;">Unit Price</th>
                <th style="text-align:right;">Base Total</th>
                <th style="text-align:right;">GST Rate</th>
                <th style="text-align:right;">CGST</th>
                <th style="text-align:right;">SGST</th>
                <th style="text-align:right;">Total Amount</th>
                <th style="text-align:center;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${parts.length === 0 ? `
                <tr><td colspan="11" style="text-align:center;padding:20px;color:var(--text3);">🛒 No spare parts added to this service cart yet. Click <strong>+ Add Spare Part to Cart</strong> to add items.</td></tr>
              ` : parts.map((p, idx) => {
                const base = p.quantity * parseFloat(p.unit_price || 0);
                const cgst = parseFloat(p.cgst || 0);
                const sgst = parseFloat(p.sgst || 0);
                const tot = parseFloat(p.total || base + cgst + sgst);
                return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td style="font-weight:600;color:var(--text1);">${esc(p.part_name)}</td>
                    <td>${esc(p.hsn || '—')}</td>
                    <td style="text-align:center;font-weight:700;">${p.quantity}</td>
                    <td style="text-align:right;">₹${parseFloat(p.unit_price || 0).toFixed(2)}</td>
                    <td style="text-align:right;">₹${base.toFixed(2)}</td>
                    <td style="text-align:right;">${p.gst_rate || 0}%</td>
                    <td style="text-align:right;">₹${cgst.toFixed(2)}</td>
                    <td style="text-align:right;">₹${sgst.toFixed(2)}</td>
                    <td style="text-align:right;font-weight:700;color:var(--success);">₹${tot.toFixed(2)}</td>
                    <td style="text-align:center;">
                      <button class="btn btn-sm btn-outline-danger removeCartItemBtn" data-id="${p.id}" title="Remove Part from Cart">🗑️ Remove</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button class="btn btn-secondary closeCartModal">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelectorAll(".closeCartModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

    overlay.querySelector("#addPartToCartBtn").addEventListener("click", () => {
      openAddPartModal(jobId, () => {
        overlay.remove();
        openPartsCartModal(jobId, onSuccess);
        if (onSuccess) onSuccess();
      });
    });

    overlay.querySelectorAll(".removeCartItemBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to remove this spare part from the service cart?")) return;
        try {
          const rRes = await fetch(`${API_BASE}/services?action=spare-part-delete&id=${btn.dataset.id}`, {
            method: "POST",
            headers: authHeaders()
          });
          const rData = await rRes.json();
          if (rData.success) {
            showToast(rData.message, "success");
            overlay.remove();
            openPartsCartModal(jobId, onSuccess);
            if (onSuccess) onSuccess();
          } else showToast(rData.error, "error");
        } catch (e) {
          showToast("Remove part error: " + e.message, "error");
        }
      });
    });

  } catch (err) {
    showToast("Error opening cart: " + err.message, "error");
  }
}

// ── SubTab 4: Service Receipts Log ──
async function loadServiceReceiptsSubTab() {
  const subContent = document.getElementById("srvSubContent");
  const userObj = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null) || JSON.parse(localStorage.getItem('erp_user') || '{}');
  const isSuperAdmin = userObj && (userObj.role === 'superadmin' || userObj.username === 'superadmin');
  const compId = isSuperAdmin ? (selectedCompanyId || 'all') : (userObj?.company_id || selectedCompanyId || 'all');

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">🧾 Service Receipts & Payment Logs</h3>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Receipt No</th>
            <th>Date & Time</th>
            <th>Job No</th>
            <th>Customer</th>
            <th>Payment Mode</th>
            <th>Amount Paid</th>
            <th>Notes / Cashier</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="receiptsTableBody">
          <tr><td colspan="8" style="text-align:center;padding:20px;"><div class="spinner"></div> Loading service receipts...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 4px;flex-wrap:wrap;gap:8px;">
      <div id="receiptsInfo"></div>
      <div id="receiptsPagination" class="pagination"></div>
    </div>
  `;

  async function fetchReceipts() {
    try {
      const res = await fetch(`${API_BASE}/services?action=service-payments-list&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success || !data.payments) return;

      window.renderPaginatedTable({
        data: data.payments,
        pageSize: 10,
        currentPage: 1,
        tbody: "receiptsTableBody",
        paginationContainer: "receiptsPagination",
        infoContainer: "receiptsInfo",
        renderRow: (r) => `
          <tr>
            <td><span class="badge badge-purple" style="font-family:monospace;font-weight:700;">${esc(r.receipt_number || 'RCP-SVC')}</span></td>
            <td style="font-size:12px;">${r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : '—'}</td>
            <td><span class="badge badge-info">${esc(r.job_number || 'JOB')}</span></td>
            <td>
              <div style="font-weight:600;color:var(--text1);">${esc(r.customer_name || 'Walk-in')}</div>
              ${r.customer_phone ? `<div style="font-size:11px;color:var(--text3);">${esc(r.customer_phone)}</div>` : ''}
            </td>
            <td><span class="badge badge-secondary" style="text-transform:uppercase;">${esc(r.payment_mode || 'cash')}</span></td>
            <td style="font-weight:700;color:var(--success);">${formatCurrency(r.amount || 0)}</td>
            <td style="font-size:12px;">${esc(r.notes || '—')}</td>
            <td>
              <div style="display:flex;gap:4px;">
                <button class="btn btn-sm btn-outline printReceiptSingleBtn" data-jobid="${r.job_id}" title="Print Receipt">🧾 Print</button>
                ${isSuperAdmin ? `<button class="btn btn-sm btn-outline-danger deletePaymentBtn" data-id="${r.id}" title="Delete Payment Receipt">🗑️ Delete</button>` : ''}
              </div>
            </td>
          </tr>
        `,
        onRender: () => {
          const tbody = document.getElementById("receiptsTableBody");
          if (!tbody) return;

          tbody.querySelectorAll(".printReceiptSingleBtn").forEach(btn => {
            btn.addEventListener("click", () => printJobInvoice(btn.dataset.jobid));
          });

          tbody.querySelectorAll(".deletePaymentBtn").forEach(btn => {
            btn.addEventListener("click", () => confirmDeleteServicePayment(btn.dataset.id, fetchReceipts));
          });
        }
      });

    } catch (err) {
      showToast("Fetch receipts error: " + err.message, "error");
    }
  }

  fetchReceipts();
}

// ── Quick Modal: Book Service Job ──
async function openBookJobModal(prefillData = {}) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;";

  const userObj = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null) || JSON.parse(localStorage.getItem('erp_user') || '{}');
  const isSuperAdmin = userObj && (userObj.role === 'superadmin' || userObj.username === 'superadmin');
  const userCompanyId = userObj?.company_id;

  let companiesList = [];
  if (isSuperAdmin) {
    companiesList = (typeof currentCompanies !== 'undefined' && currentCompanies) ? currentCompanies : [];
  }

  let mechanicsList = [];
  try {
    const compId = isSuperAdmin ? (selectedCompanyId || 'all') : (userCompanyId || 'all');
    const mRes = await fetch(`${API_BASE}/services?action=mechanics-list&company_id=${compId}`, { headers: authHeaders() });
    const mData = await mRes.json();
    if (mData.success) mechanicsList = mData.mechanics || [];
  } catch (e) {}

  const isWarrantyPrefill = prefillData.service_type === 'warranty' || prefillData.warranty_eligible === true;

  overlay.innerHTML = `
    <div class="modal-content" style="background:var(--bg-primary);border-radius:12px;max-width:560px;width:100%;padding:24px;border:1px solid var(--border);box-shadow:0 20px 25px -5px rgba(0,0,0,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:16px;">
        <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">🔧 Book New Service Job</h3>
        <button class="btn btn-sm btn-outline closeJobModal">&times;</button>
      </div>

      <form id="jobBookingForm">
        ${isSuperAdmin ? `
        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label" style="font-weight:700;color:var(--primary);">🏢 Select Company *</label>
          <select id="jbCompanyId" class="form-select" required style="border-color:var(--primary);font-weight:600;">
            <option value="">-- Select Company --</option>
            ${companiesList.map(c => `<option value="${c.id}" ${(selectedCompanyId && selectedCompanyId !== 'all' && parseInt(selectedCompanyId) === c.id) ? 'selected' : ''}>${esc(c.name)}${c.gstin ? ' (' + c.gstin + ')' : ''}</option>`).join('')}
          </select>
        </div>
        ` : ''}

        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div class="form-group">
            <label class="form-label">Service Type *</label>
            <select id="jbType" class="form-select" required>
              <option value="warranty" ${isWarrantyPrefill ? 'selected' : ''}>Free Warranty Repair 🛡️</option>
              <option value="paid" ${!isWarrantyPrefill ? 'selected' : ''}>Paid Service / Repair 💳</option>
              <option value="replacement">Warranty Replacement 🔄</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Chassis / Machine Serial No *</label>
            <input type="text" id="jbSerial" class="form-input" value="${esc(prefillData.serial_number || '')}" placeholder="e.g. Machine Serial #8812" style="font-weight:700;font-family:monospace;" required>
          </div>
        </div>

        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div class="form-group">
            <label class="form-label">Customer Name</label>
            <input type="text" id="jbCustName" class="form-input" value="${esc(prefillData.customer_name || '')}" placeholder="Customer Name">
          </div>
          <div class="form-group">
            <label class="form-label">Customer Phone</label>
            <input type="text" id="jbCustPhone" class="form-input" value="${esc(prefillData.customer_phone || '')}" placeholder="+91 Phone Number">
          </div>
        </div>

        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label">Complaint / Problem Description *</label>
          <textarea id="jbComplaint" class="form-input" rows="2" required placeholder="Describe symptoms (e.g. Engine noise, oil leak, blade replacement)..."></textarea>
        </div>

        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label">Assign Mechanic / Technician</label>
          <select id="jbMechId" class="form-select">
            <option value="">-- Unassigned --</option>
            ${mechanicsList.map(m => `<option value="${m.id}">${esc(m.name)} (${esc(m.specialization || 'General')})</option>`).join("")}
          </select>
        </div>

        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
          <div class="form-group">
            <label class="form-label">Service / Labor Charge (₹)</label>
            <input type="number" step="0.01" id="jbLabor" class="form-input" value="${isWarrantyPrefill ? '0' : '300.00'}" placeholder="0.00">
          </div>
          <div class="form-group">
            <label class="form-label">Initial Spare Parts Cost (₹)</label>
            <input type="number" step="0.01" id="jbParts" class="form-input" value="0.00" placeholder="0.00">
          </div>
        </div>

        <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px;">
          <button type="button" class="btn btn-secondary closeJobModal">Cancel</button>
          <button type="submit" id="jbSubmitBtn" class="btn btn-primary" style="font-weight:700;">🔧 Confirm & Book Job</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelectorAll(".closeJobModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

  overlay.querySelector("#jobBookingForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = overlay.querySelector("#jbSubmitBtn");
    setButtonLoading(btn, true, "Booking...");

    let resolvedCompanyId;
    if (isSuperAdmin) {
      const compSel = overlay.querySelector("#jbCompanyId");
      resolvedCompanyId = compSel ? parseInt(compSel.value) : null;
      if (!resolvedCompanyId) {
        showToast("Please select a company", "error");
        setButtonLoading(btn, false);
        return;
      }
    } else {
      resolvedCompanyId = userCompanyId;
    }

    const payload = {
      company_id: resolvedCompanyId,
      service_type: overlay.querySelector("#jbType").value,
      warranty_eligible: overlay.querySelector("#jbType").value === 'warranty',
      serial_number: overlay.querySelector("#jbSerial").value.trim(),
      customer_id: prefillData.customer_id || null,
      customer_name: overlay.querySelector("#jbCustName").value.trim(),
      customer_phone: overlay.querySelector("#jbCustPhone").value.trim(),
      product_id: prefillData.product_id || null,
      sale_id: prefillData.sale_id || null,
      complaint: overlay.querySelector("#jbComplaint").value.trim(),
      mechanic_id: overlay.querySelector("#jbMechId").value || null,
      labor_charge: overlay.querySelector("#jbLabor").value,
      parts_cost: overlay.querySelector("#jbParts").value,
      barcode_ref: prefillData.barcode_ref || overlay.querySelector("#jbSerial").value.trim()
    };

    try {
      const res = await fetch(`${API_BASE}/services?action=job-create`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.job) {
        showToast(data.message, "success");
        overlay.remove();
        
        // Print Mechanic Job Sheet immediately after creation!
        printJobSheet(data.job.id);
        
        if (window.switchTab) window.switchTab("svc_payments");
      } else showToast(data.error || "Failed to create job", "error");
    } catch (err) {
      showToast("Error booking job: " + err.message, "error");
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

// ── Modal: Add Spare Part (with GST & Inventory deduct) ──
async function openAddPartModal(jobId, onSuccess) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;";

  const userObj = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null) || JSON.parse(localStorage.getItem('erp_user') || '{}');
  const isSuperAdmin = userObj && (userObj.role === 'superadmin' || userObj.username === 'superadmin');

  let productsList = [];
  try {
    const compId = isSuperAdmin ? (selectedCompanyId || 'all') : (userObj?.company_id || 'all');
    const pRes = await fetch(`${API_BASE}/inventory?action=products&company_id=${compId}`, { headers: authHeaders() });
    const pData = await pRes.json();
    if (pData.success) productsList = pData.products || [];
  } catch (e) {}

  overlay.innerHTML = `
    <div class="modal-content" style="background:var(--bg-primary);border-radius:12px;max-width:520px;width:100%;padding:24px;border:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:16px;">
        <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">➕ Add Spare Part (with GST)</h3>
        <button class="btn btn-sm btn-outline closePartModal">&times;</button>
      </div>

      <form id="addPartForm">
        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label">Select Inventory Product / Spare Part</label>
          <select id="spProdSelect" class="form-select">
            <option value="">-- Custom Non-Inventory Spare Part --</option>
            ${productsList.map(p => `<option value="${p.id}" data-price="${p.selling_rate || 0}" data-hsn="${p.hsn_code || ''}" data-gst="${p.gst_rate || 18}">${esc(p.name)} (Stock: ${p.current_stock || 0}) - ₹${parseFloat(p.selling_rate || 0).toFixed(2)}</option>`).join("")}
          </select>
        </div>

        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label">Spare Part Name *</label>
          <input type="text" id="spName" class="form-input" required placeholder="e.g. Oil Seal / Rotary Blade / Spark Plug">
        </div>

        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div class="form-group">
            <label class="form-label">Quantity *</label>
            <input type="number" min="1" id="spQty" class="form-input" value="1" required>
          </div>
          <div class="form-group">
            <label class="form-label">Unit Price (₹) *</label>
            <input type="number" step="0.01" id="spPrice" class="form-input" value="0.00" required>
          </div>
        </div>

        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div class="form-group">
            <label class="form-label">GST Rate (%) *</label>
            <select id="spGstRate" class="form-select" required>
              <option value="0">0% (GST Exempt)</option>
              <option value="5">5% GST</option>
              <option value="12">12% GST</option>
              <option value="18" selected>18% GST</option>
              <option value="28">28% GST</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">HSN / SAC Code</label>
            <input type="text" id="spHsn" class="form-input" placeholder="e.g. 8432">
          </div>
        </div>

        <div id="spGstPreview" style="background:var(--bg-secondary);padding:10px;border-radius:8px;border:1px solid var(--border);margin-bottom:12px;font-size:12px;display:flex;justify-content:space-between;align-items:center;">
          <div>Base: <strong id="spBaseTxt">₹0.00</strong> | GST: <strong id="spGstTxt">₹0.00</strong></div>
          <div>Total: <strong id="spTotalTxt" style="color:var(--success);font-size:14px;">₹0.00</strong></div>
        </div>

        <div class="form-group" style="background:var(--bg-secondary);padding:8px 12px;border-radius:6px;border:1px solid var(--border);margin-bottom:12px;">
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--text1);cursor:pointer;margin:0;">
            <input type="checkbox" id="spDeductStock" checked style="accent-color:var(--primary);">
            Auto-deduct quantity from Inventory Stock
          </label>
        </div>

        <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px;">
          <button type="button" class="btn btn-secondary closePartModal">Cancel</button>
          <button type="submit" id="spSubmitBtn" class="btn btn-primary" style="font-weight:700;">➕ Add Spare Part</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelectorAll(".closePartModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

  const prodSel = overlay.querySelector("#spProdSelect");
  const qtyInp = overlay.querySelector("#spQty");
  const priceInp = overlay.querySelector("#spPrice");
  const gstSel = overlay.querySelector("#spGstRate");

  const calcPreview = () => {
    const q = parseFloat(qtyInp.value || 0);
    const p = parseFloat(priceInp.value || 0);
    const g = parseFloat(gstSel.value || 0);
    const base = q * p;
    const gstAmt = (base * g) / 100;
    const tot = base + gstAmt;

    overlay.querySelector("#spBaseTxt").innerText = `₹${base.toFixed(2)}`;
    overlay.querySelector("#spGstTxt").innerText = `₹${gstAmt.toFixed(2)}`;
    overlay.querySelector("#spTotalTxt").innerText = `₹${tot.toFixed(2)}`;
  };

  [qtyInp, priceInp, gstSel].forEach(inp => inp?.addEventListener("input", calcPreview));

  if (prodSel) {
    prodSel.addEventListener("change", () => {
      const opt = prodSel.options[prodSel.selectedIndex];
      if (prodSel.value) {
        overlay.querySelector("#spName").value = opt.text.split(" (Stock:")[0];
        overlay.querySelector("#spPrice").value = opt.dataset.price || "0.00";
        if (opt.dataset.hsn) overlay.querySelector("#spHsn").value = opt.dataset.hsn;
        if (opt.dataset.gst) overlay.querySelector("#spGstRate").value = opt.dataset.gst;
        calcPreview();
      }
    });
  }

  overlay.querySelector("#addPartForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = overlay.querySelector("#spSubmitBtn");
    setButtonLoading(btn, true, "Adding...");

    const payload = {
      job_id: jobId,
      product_id: overlay.querySelector("#spProdSelect").value || null,
      part_name: overlay.querySelector("#spName").value.trim(),
      quantity: overlay.querySelector("#spQty").value,
      unit_price: overlay.querySelector("#spPrice").value,
      gst_rate: overlay.querySelector("#spGstRate").value,
      hsn: overlay.querySelector("#spHsn").value.trim(),
      from_inventory: overlay.querySelector("#spDeductStock").checked
    };

    try {
      const res = await fetch(`${API_BASE}/services?action=add-spare-part`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "success");
        overlay.remove();
        if (onSuccess) onSuccess();
      } else showToast(data.error, "error");
    } catch (err) {
      showToast("Error adding spare part: " + err.message, "error");
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

// ── Modal: Make Service Payment (like DC Payments) ──
async function openMakePaymentModal(jobId, onSuccess) {
  try {
    const res = await fetch(`${API_BASE}/services?action=job-details&id=${jobId}`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.success || !data.job) return showToast("Failed to fetch job details", "error");

    const j = data.job;
    const grandTot = parseFloat(j.grand_total || 0);
    const paidAmt = parseFloat(j.paid_amount || 0);
    const pendAmt = Math.max(0, grandTot - paidAmt);

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;";

    overlay.innerHTML = `
      <div class="modal-content" style="background:var(--bg-primary);border-radius:12px;max-width:500px;width:100%;padding:24px;border:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:16px;">
          <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">💳 Collect Service Payment</h3>
          <button class="btn btn-sm btn-outline closePayModal">&times;</button>
        </div>

        <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;border:1px solid var(--border);margin-bottom:16px;font-size:13px;">
          <div>Job Sheet: <strong style="font-family:monospace;color:var(--primary);">${esc(j.job_number)}</strong> (${esc(j.customer_name_ref || j.customer_name || 'Walk-in')})</div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;font-weight:700;">
            <span>Total Bill: ₹${grandTot.toFixed(2)}</span>
            <span>Paid: ₹${paidAmt.toFixed(2)}</span>
            <span style="color:var(--danger);">Balance: ₹${pendAmt.toFixed(2)}</span>
          </div>
        </div>

        <form id="servicePaymentForm">
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
            <div class="form-group">
              <label class="form-label">Payment Date *</label>
              <input type="date" id="payDate" class="form-input" value="${new Date().toISOString().slice(0, 10)}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Payment Amount (₹) *</label>
              <input type="number" step="0.01" id="payAmt" class="form-input" value="${pendAmt.toFixed(2)}" max="${pendAmt.toFixed(2)}" style="font-weight:700;color:var(--success);font-size:16px;" required>
            </div>
          </div>

          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
            <div class="form-group">
              <label class="form-label">Payment Mode *</label>
              <select id="payMode" class="form-select" required>
                <option value="cash" selected>💵 Cash</option>
                <option value="upi">📱 PhonePe / GPay / UPI</option>
                <option value="bank_transfer">🏦 Net Banking / RTGS / NEFT</option>
                <option value="cheque">📄 Cheque / Demand Draft</option>
                <option value="card">💳 Debit / Credit Card</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Ref / Cheque No / UPI ID</label>
              <input type="text" id="payRef" class="form-input" placeholder="Txn Ref No / Cheque No">
            </div>
          </div>

          <div class="form-group" style="margin-bottom:10px;">
            <label class="form-label">Cashier / Payment Notes</label>
            <input type="text" id="payNotes" class="form-input" placeholder="e.g. Service charge & parts payment received in full">
          </div>

          <div style="margin-top:20px;display:flex;justify-content:flex-end;gap:8px;">
            <button type="button" class="btn btn-secondary closePayModal">Cancel</button>
            <button type="submit" id="paySubmitBtn" class="btn btn-success" style="font-weight:700;padding:10px 20px;">💳 Record Payment & Print Receipt</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelectorAll(".closePayModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

    overlay.querySelector("#servicePaymentForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = overlay.querySelector("#paySubmitBtn");
      setButtonLoading(btn, true, "Processing...");

      const payload = {
        job_id: jobId,
        payment_date: overlay.querySelector("#payDate").value,
        amount: overlay.querySelector("#payAmt").value,
        payment_mode: overlay.querySelector("#payMode").value,
        transaction_ref: overlay.querySelector("#payRef").value.trim(),
        notes: overlay.querySelector("#payNotes").value.trim()
      };

      try {
        const pRes = await fetch(`${API_BASE}/services?action=add-service-payment`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload)
        });
        const pData = await pRes.json();
        if (pData.success) {
          showToast(pData.message, "success");
          overlay.remove();
          printJobInvoice(jobId);
          if (onSuccess) onSuccess();
        } else showToast(pData.error, "error");
      } catch (err) {
        showToast("Payment error: " + err.message, "error");
      } finally {
        setButtonLoading(btn, false);
      }
    });

  } catch (err) {
    showToast("Error opening payment modal: " + err.message, "error");
  }
}

// ── Modal: Update Job Status ──
async function openUpdateStatusModal(jobId, onSuccess) {
  try {
    const res = await fetch(`${API_BASE}/services?action=job-details&id=${jobId}`, { headers: authHeaders() });
    const data = await res.json();
    const j = data.job || {};

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;";

    overlay.innerHTML = `
      <div class="modal-content" style="background:var(--bg-primary);border-radius:12px;max-width:480px;width:100%;padding:24px;border:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:16px;">
          <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">⚙️ Update Repair Status</h3>
          <button class="btn btn-sm btn-outline closeStatusModal">&times;</button>
        </div>

        <form id="updateStatusForm">
          <div class="form-group" style="margin-bottom:10px;">
            <label class="form-label">Service Status *</label>
            <select id="stStatus" class="form-select" required>
              <option value="open" ${j.status === 'open' ? 'selected' : ''}>Open / Received ⏳</option>
              <option value="in_progress" ${j.status === 'in_progress' ? 'selected' : ''}>In Progress 🔧</option>
              <option value="repaired" ${j.status === 'repaired' ? 'selected' : ''}>Repaired & Tested ✅</option>
              <option value="delivered" ${j.status === 'delivered' ? 'selected' : ''}>Delivered to Customer 🚚</option>
              <option value="cancelled" ${j.status === 'cancelled' ? 'selected' : ''}>Cancelled ❌</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom:10px;">
            <label class="form-label">Service / Labor Charge (₹)</label>
            <input type="number" step="0.01" id="stLabor" class="form-input" value="${parseFloat(j.labor_charge || 0).toFixed(2)}">
          </div>

          <div class="form-group" style="margin-bottom:10px;">
            <label class="form-label">Technician Diagnosis / Cause</label>
            <input type="text" id="stDiagnosis" class="form-input" value="${esc(j.diagnosis || '')}" placeholder="e.g. Damaged spark plug replaced">
          </div>

          <div class="form-group" style="margin-bottom:10px;">
            <label class="form-label">Technician Remarks & Notes</label>
            <textarea id="stRemarks" class="form-input" rows="2" placeholder="Notes for customer receipt...">${esc(j.technician_remarks || '')}</textarea>
          </div>

          <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px;">
            <button type="button" class="btn btn-secondary closeStatusModal">Cancel</button>
            <button type="submit" id="stSubmitBtn" class="btn btn-primary" style="font-weight:700;">Save Status Update</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelectorAll(".closeStatusModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

    overlay.querySelector("#updateStatusForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = overlay.querySelector("#stSubmitBtn");
      setButtonLoading(btn, true, "Saving...");

      const payload = {
        id: jobId,
        status: overlay.querySelector("#stStatus").value,
        labor_charge: overlay.querySelector("#stLabor").value,
        diagnosis: overlay.querySelector("#stDiagnosis").value.trim(),
        technician_remarks: overlay.querySelector("#stRemarks").value.trim()
      };

      try {
        const uRes = await fetch(`${API_BASE}/services?action=job-update-status`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload)
        });
        const uData = await uRes.json();
        if (uData.success) {
          showToast(uData.message, "success");
          overlay.remove();
          if (onSuccess) onSuccess();
        } else showToast(uData.error, "error");
      } catch (err) {
        showToast("Error: " + err.message, "error");
      } finally {
        setButtonLoading(btn, false);
      }
    });

  } catch (err) {
    showToast("Fetch job status error: " + err.message, "error");
  }
}

// ── Printable: Mechanic Job Sheet (Full A4 Page height, no grand total row) ──
async function printJobSheet(jobId) {
  try {
    const res = await fetch(`${API_BASE}/services?action=job-details&id=${jobId}`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.success || !data.job) return showToast("Failed to fetch job details", "error");

    const j = data.job;
    const parts = data.parts || [];
    const isWarranty = j.service_type === 'warranty' || j.warranty_eligible;

    const printWin = window.open('', '_blank', 'width=850,height=950');
    if (!printWin) return showToast("Please allow popups to print job sheet", "warning");

    const formattedDate = new Date(j.created_at).toLocaleDateString('en-IN');

    // Fill table to 18 total rows so it stretches full A4 height
    const totalRowsNeeded = 18;
    const blankRowsCount = Math.max(0, totalRowsNeeded - parts.length);
    let blankRowsHtml = '';
    for (let i = 0; i < blankRowsCount; i++) {
      blankRowsHtml += `<tr><td style="height:26px;">&nbsp;</td><td></td><td></td><td></td><td></td></tr>`;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Mechanic Job Sheet - #${j.job_number}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 10px; color: #0f172a; background: #fff; line-height: 1.4; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; }
          .header h1 { margin: 0; font-size: 22px; color: #0f172a; font-weight: 800; letter-spacing: 0.5px; }
          .header p { margin: 2px 0; font-size: 11px; color: #64748b; font-weight: 600; letter-spacing: 1px; }
          .badge-banner { text-align: center; margin-top: 6px; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
          .badge-warranty { background: #dcfce7; color: #15803d; border: 1.5px solid #86efac; }
          .badge-paid { background: #fef3c7; color: #b45309; border: 1.5px solid #fde047; }
          .meta-row { display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; margin-bottom: 12px; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
          .section-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
          .box { background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 12px; }
          .box-title { font-weight: 800; font-size: 10px; text-transform: uppercase; color: #475569; margin-bottom: 4px; letter-spacing: 0.5px; }
          table.job-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          table.job-table th { background: #f1f5f9; padding: 8px; text-align: left; border: 1px solid #cbd5e1; font-weight: 700; color: #334155; }
          table.job-table td { padding: 6px 8px; border: 1px solid #cbd5e1; }
          .sig-row { display: flex; justify-content: space-between; margin-top: 30px; font-size: 11px; font-weight: bold; page-break-inside: avoid; }
          .sig-box { text-align: center; width: 220px; border-top: 1px dashed #64748b; padding-top: 6px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${esc(j.company_name || 'MANASWINI ENTERPRISES')}</h1>
          <p>AUTHORIZED SERVICE & REPAIR CENTER</p>
          <div class="badge-banner">
            <span class="${isWarranty ? 'badge badge-warranty' : 'badge badge-paid'}">
              ${isWarranty ? '🛡️ FREE WARRANTY REPAIR VOUCHER' : '💰 PAID SERVICE REPAIR VOUCHER'}
            </span>
          </div>
        </div>

        <div class="meta-row">
          <div>JOB SHEET NO: <span style="font-family:monospace;font-size:14px;color:#0284c7;">#${esc(j.job_number)}</span></div>
          <div>DATE: ${formattedDate}</div>
        </div>

        <div class="section-grid">
          <div class="box">
            <div class="box-title">👤 CUSTOMER DETAILS</div>
            <div><strong>Name:</strong> ${esc(j.customer_name_ref || j.customer_name || 'Walk-in Customer')}</div>
            <div><strong>Phone:</strong> ${esc(j.customer_phone_ref || j.customer_phone || '—')}</div>
          </div>
          <div class="box">
            <div class="box-title">⚙️ EQUIPMENT & TECHNICIAN INFO</div>
            <div><strong>Equipment:</strong> ${esc(j.product_name || 'Machine')}</div>
            <div><strong>Chassis / Serial No:</strong> <span style="font-family:monospace;font-weight:700;">${esc(j.serial_number || '—')}</span></div>
            <div><strong>Assigned Mechanic:</strong> ${esc(j.mechanic_name || 'Unassigned')}</div>
          </div>
        </div>

        <div class="box" style="margin-bottom:12px;">
          <div class="box-title">📋 REPORTED COMPLAINT & ISSUES</div>
          <div style="font-size:13px;font-weight:600;">${esc(j.complaint)}</div>
        </div>

        <table class="job-table">
          <thead>
            <tr>
              <th>Description / Spare Part Name</th>
              <th style="text-align:center;width:60px;">Qty</th>
              <th style="text-align:right;width:110px;">Unit Price</th>
              <th style="text-align:right;width:80px;">GST %</th>
              <th style="text-align:right;width:120px;">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            ${parts.map(p => `
              <tr>
                <td>${esc(p.part_name)}</td>
                <td style="text-align:center;">${p.quantity}</td>
                <td style="text-align:right;">₹${parseFloat(p.unit_price || 0).toFixed(2)}</td>
                <td style="text-align:right;">${p.gst_rate || 0}%</td>
                <td style="text-align:right;">₹${parseFloat(p.total || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
            ${blankRowsHtml}
          </tbody>
        </table>

        <div class="sig-row">
          <div class="sig-box">Customer Signature</div>
          <div class="sig-box">Technician / Authorized Signature</div>
        </div>

        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `);
    printWin.document.close();
  } catch (err) {
    showToast("Print job sheet error: " + err.message, "error");
  }
}

// ── Printable: Tax Invoice / Final Receipt ──
async function printJobInvoice(jobId) {
  try {
    const res = await fetch(`${API_BASE}/services?action=job-details&id=${jobId}`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.success || !data.job) return showToast("Failed to fetch job details", "error");

    const j = data.job;
    const parts = data.parts || [];
    const payments = data.payments || [];

    const printWin = window.open('', '_blank', 'width=850,height=900');
    if (!printWin) return showToast("Please allow popups to print invoice", "warning");

    const isWarranty = j.service_type === 'warranty' || j.warranty_eligible;
    const grandTot = parseFloat(j.grand_total || 0);
    const paidAmt = parseFloat(j.paid_amount || 0);
    const pendAmt = Math.max(0, grandTot - paidAmt);

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Service Invoice - #${j.job_number}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 30px; color: #1e293b; background: #fff; line-height: 1.5; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 22px; color: #0f172a; font-weight: 800; }
          .header p { margin: 2px 0; font-size: 12px; color: #64748b; }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
          .badge-warranty { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
          .badge-paid { background: #fef3c7; color: #b45309; border: 1px solid #fde047; }
          .meta-grid { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 15px; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0; }
          .section-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
          .box { background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 12px; }
          .box-title { font-weight: bold; font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          th { background: #f1f5f9; padding: 8px; text-align: left; border: 1px solid #cbd5e1; }
          td { padding: 8px; border: 1px solid #e2e8f0; }
          .tot-row td { font-weight: bold; background: #f8fafc; }
          .footer { text-align: center; margin-top: 40px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${esc(j.company_name || 'MANASWINI ENTERPRISES')}</h1>
          <p>AUTHORIZED SERVICE & REPAIR CENTER TAX INVOICE</p>
          <div style="margin-top:10px;">
            <span class="${isWarranty ? 'badge badge-warranty' : 'badge badge-paid'}">
              ${isWarranty ? '🛡️ FREE WARRANTY REPAIR' : '💰 PAID SERVICE INVOICE'}
            </span>
          </div>
        </div>

        <div class="meta-grid">
          <div><strong>SERVICE INVOICE NO:</strong> <span style="font-family:monospace;font-size:14px;color:#0284c7;">#${esc(j.job_number)}</span></div>
          <div><strong>DATE:</strong> ${new Date(j.created_at).toLocaleDateString('en-IN')}</div>
          <div><strong>PAYMENT STATUS:</strong> <span style="text-transform:uppercase;font-weight:bold;color:${pendAmt <= 0.01 ? '#15803d' : '#b45309'};">${esc(j.payment_status || 'unpaid')}</span></div>
        </div>

        <div class="section-grid">
          <div class="box">
            <div class="box-title">👤 Customer Details</div>
            <div><strong>Name:</strong> ${esc(j.customer_name_ref || j.customer_name || 'Walk-in Customer')}</div>
            <div><strong>Phone:</strong> ${esc(j.customer_phone_ref || j.customer_phone || '—')}</div>
          </div>
          <div class="box">
            <div class="box-title">⚙️ Equipment & Technician Info</div>
            <div><strong>Equipment:</strong> ${esc(j.product_name || 'Machine')}</div>
            <div><strong>Chassis / Serial No:</strong> <span style="font-family:monospace;">${esc(j.serial_number || '—')}</span></div>
            <div><strong>Assigned Mechanic:</strong> ${esc(j.mechanic_name || 'Unassigned')}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description / Spare Part Name</th>
              <th>HSN</th>
              <th style="text-align:center;">Qty</th>
              <th style="text-align:right;">Unit Price</th>
              <th style="text-align:right;">GST Rate</th>
              <th style="text-align:right;">GST Amt</th>
              <th style="text-align:right;">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            ${parts.map(p => {
              const base = p.quantity * parseFloat(p.unit_price || 0);
              const gst = parseFloat(p.cgst || 0) + parseFloat(p.sgst || 0) + parseFloat(p.igst || 0);
              return `
                <tr>
                  <td>${esc(p.part_name)}</td>
                  <td>${esc(p.hsn || '—')}</td>
                  <td style="text-align:center;">${p.quantity}</td>
                  <td style="text-align:right;">₹${parseFloat(p.unit_price || 0).toFixed(2)}</td>
                  <td style="text-align:right;">${p.gst_rate || 0}%</td>
                  <td style="text-align:right;">₹${gst.toFixed(2)}</td>
                  <td style="text-align:right;">₹${parseFloat(p.total || base + gst).toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
            <tr>
              <td colspan="6" style="text-align:right;font-weight:600;">Spare Parts Subtotal:</td>
              <td style="text-align:right;font-weight:600;">₹${parseFloat(j.total_parts_cost || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td colspan="6" style="text-align:right;font-weight:600;">Total GST Amount:</td>
              <td style="text-align:right;font-weight:600;">₹${parseFloat(j.gst_amount || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td colspan="6" style="text-align:right;font-weight:600;">Labor / Service Charges:</td>
              <td style="text-align:right;font-weight:600;">₹${parseFloat(j.labor_charge || 0).toFixed(2)}</td>
            </tr>
            <tr class="tot-row">
              <td colspan="6" style="text-align:right;">GRAND TOTAL:</td>
              <td style="text-align:right;color:#0f172a;font-size:14px;">₹${grandTot.toFixed(2)}</td>
            </tr>
            <tr>
              <td colspan="6" style="text-align:right;color:#15803d;font-weight:bold;">Total Amount Paid:</td>
              <td style="text-align:right;color:#15803d;font-weight:bold;">₹${paidAmt.toFixed(2)}</td>
            </tr>
            <tr class="tot-row">
              <td colspan="6" style="text-align:right;color:${pendAmt > 0 ? '#dc2626' : '#15803d'};">REMAINING BALANCE DUE:</td>
              <td style="text-align:right;color:${pendAmt > 0 ? '#dc2626' : '#15803d'};font-size:14px;">₹${pendAmt.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        ${payments.length > 0 ? `
          <div style="margin-top:20px;">
            <div style="font-weight:bold;font-size:11px;text-transform:uppercase;color:#64748b;margin-bottom:6px;">💳 Payment History & Receipts</div>
            <table>
              <thead>
                <tr>
                  <th>Receipt No</th>
                  <th>Date</th>
                  <th>Payment Mode</th>
                  <th>Ref No</th>
                  <th style="text-align:right;">Amount Paid</th>
                </tr>
              </thead>
              <tbody>
                ${payments.map(py => `
                  <tr>
                    <td>${esc(py.receipt_number || 'RCP')}</td>
                    <td>${py.created_at ? new Date(py.created_at).toLocaleDateString('en-IN') : '—'}</td>
                    <td style="text-transform:uppercase;">${esc(py.payment_mode || 'cash')}</td>
                    <td>${esc(py.transaction_ref || '—')}</td>
                    <td style="text-align:right;font-weight:bold;color:#15803d;">₹${parseFloat(py.amount || 0).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        <div class="footer">
          <p>Thank you for choosing ${esc(j.company_name || 'MANASWINI ENTERPRISES')} Service Center!</p>
        </div>

        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `);
    printWin.document.close();
  } catch (err) {
    showToast("Print invoice error: " + err.message, "error");
  }
}

// ── Superadmin Delete Helper Functions ──
async function confirmDeleteJob(jobId, refreshFn) {
  if (!confirm("⚠️ Are you sure you want to delete this Service Job? All associated parts and payment receipts will be permanently removed. This action CANNOT be undone.")) return;
  try {
    const res = await fetch(`${API_BASE}/services?action=job-delete&id=${jobId}`, {
      method: "POST",
      headers: authHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, "success");
      if (refreshFn) refreshFn();
    } else showToast(data.error, "error");
  } catch (err) {
    showToast("Delete error: " + err.message, "error");
  }
}

async function confirmDeleteServicePayment(payId, refreshFn) {
  if (!confirm("⚠️ Are you sure you want to delete this Service Payment Receipt? This action CANNOT be undone.")) return;
  try {
    const res = await fetch(`${API_BASE}/services?action=delete-service-payment&id=${payId}`, {
      method: "POST",
      headers: authHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, "success");
      if (refreshFn) refreshFn();
    } else showToast(data.error, "error");
  } catch (err) {
    showToast("Delete error: " + err.message, "error");
  }
}

async function confirmDeleteMechanic(mechId, refreshFn) {
  if (!confirm("⚠️ Are you sure you want to delete this Mechanic?")) return;
  try {
    const res = await fetch(`${API_BASE}/services?action=mechanic-delete&id=${mechId}`, {
      method: "POST",
      headers: authHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, "success");
      if (refreshFn) refreshFn();
    } else showToast(data.error, "error");
  } catch (err) {
    showToast("Delete error: " + err.message, "error");
  }
}

// ── SubTab: Mechanics Master ──
async function loadMechanicsSubTab() {
  const subContent = document.getElementById("srvSubContent");
  const userObj = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null) || JSON.parse(localStorage.getItem('erp_user') || '{}');
  const isSuperAdmin = userObj && (userObj.role === 'superadmin' || userObj.username === 'superadmin');
  const compId = isSuperAdmin ? (selectedCompanyId || 'all') : (userObj?.company_id || 'all');

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h3 style="font-size:16px;font-weight:700;color:var(--text1);">Mechanics & Service Technicians Master</h3>
      <button class="btn btn-primary" id="addMechBtn" style="font-weight:700;">+ Add Mechanic</button>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Mechanic Name</th>
            <th>Phone Number</th>
            <th>Role</th>
            <th>Specialization</th>
            <th>Status</th>
            ${isSuperAdmin ? `<th>Actions</th>` : ''}
          </tr>
        </thead>
        <tbody id="mechTableBody">
          <tr><td colspan="${isSuperAdmin ? 6 : 5}" style="text-align:center;padding:20px;"><div class="spinner"></div> Loading mechanics...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 4px;flex-wrap:wrap;gap:8px;">
      <div id="mechInfo"></div>
      <div id="mechPagination" class="pagination"></div>
    </div>
  `;

  async function fetchMechanics() {
    try {
      const res = await fetch(`${API_BASE}/services?action=mechanics-list&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success || !data.mechanics) return;

      window.renderPaginatedTable({
        data: data.mechanics,
        pageSize: 10,
        currentPage: 1,
        tbody: "mechTableBody",
        paginationContainer: "mechPagination",
        infoContainer: "mechInfo",
        renderRow: (m) => `
          <tr>
            <td style="font-weight:600;color:var(--text1);">${esc(m.name)}</td>
            <td>${esc(m.phone || '—')}</td>
            <td>${esc(m.role || 'Mechanic')}</td>
            <td>${esc(m.specialization || 'General Repair')}</td>
            <td><span class="badge badge-success">Active</span></td>
            ${isSuperAdmin ? `
              <td>
                <button class="btn btn-sm btn-outline-danger deleteMechBtn" data-id="${m.id}" title="Delete Mechanic">🗑️ Delete</button>
              </td>
            ` : ''}
          </tr>
        `,
        onRender: () => {
          const tbody = document.getElementById("mechTableBody");
          if (!tbody) return;

          tbody.querySelectorAll(".deleteMechBtn").forEach(btn => {
            btn.addEventListener("click", () => confirmDeleteMechanic(btn.dataset.id, fetchMechanics));
          });
        }
      });

    } catch (err) {
      showToast("Fetch mechanics error: " + err.message, "error");
    }
  }

  on("addMechBtn", "click", () => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;";

    const mechCompaniesList = isSuperAdmin ? ((typeof currentCompanies !== 'undefined' && currentCompanies) ? currentCompanies : []) : [];

    overlay.innerHTML = `
      <div class="modal-content" style="background:var(--bg-primary);border-radius:12px;max-width:460px;width:100%;padding:24px;border:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:16px;">
          <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">👨‍🔧 Add New Mechanic</h3>
          <button class="btn btn-sm btn-outline closeMModal">&times;</button>
        </div>

        <form id="newMechForm">
          ${isSuperAdmin ? `
          <div class="form-group" style="margin-bottom:10px;">
            <label class="form-label" style="font-weight:700;color:var(--primary);">🏢 Select Company *</label>
            <select id="nmCompanyId" class="form-select" required style="border-color:var(--primary);font-weight:600;">
              <option value="">-- Select Company --</option>
              ${mechCompaniesList.map(c => `<option value="${c.id}" ${(selectedCompanyId && selectedCompanyId !== 'all' && parseInt(selectedCompanyId) === c.id) ? 'selected' : ''}>${esc(c.name)}${c.gstin ? ' (' + c.gstin + ')' : ''}</option>`).join('')}
            </select>
          </div>
          ` : ''}

          <div class="form-group" style="margin-bottom:10px;">
            <label class="form-label">Mechanic Full Name *</label>
            <input type="text" id="nmName" class="form-input" required placeholder="e.g. Raju Technician">
          </div>
          <div class="form-group" style="margin-bottom:10px;">
            <label class="form-label">Phone Number</label>
            <input type="text" id="nmPhone" class="form-input" placeholder="+91 9876543210">
          </div>
          <div class="form-group" style="margin-bottom:10px;">
            <label class="form-label">Specialization</label>
            <input type="text" id="nmSpec" class="form-input" placeholder="e.g. Rotavarter Engines, Wiring, Hydraulic">
          </div>
          <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px;">
            <button type="button" class="btn btn-secondary closeMModal">Cancel</button>
            <button type="submit" id="nmSubmitBtn" class="btn btn-primary" style="font-weight:700;">Save Mechanic</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelectorAll(".closeMModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

    overlay.querySelector("#newMechForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = overlay.querySelector("#nmSubmitBtn");
      setButtonLoading(btn, true, "Saving...");

      let mechCompanyId;
      if (isSuperAdmin) {
        const compSel = overlay.querySelector("#nmCompanyId");
        mechCompanyId = compSel ? parseInt(compSel.value) : null;
        if (!mechCompanyId) {
          showToast("Please select a company", "error");
          setButtonLoading(btn, false);
          return;
        }
      } else {
        mechCompanyId = userObj?.company_id;
      }

      const payload = {
        company_id: mechCompanyId,
        name: overlay.querySelector("#nmName").value.trim(),
        phone: overlay.querySelector("#nmPhone").value.trim(),
        specialization: overlay.querySelector("#nmSpec").value.trim(),
      };

      try {
        const res = await fetch(`${API_BASE}/services?action=mechanic-create`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, "success");
          overlay.remove();
          fetchMechanics();
        } else showToast(data.error, "error");
      } catch (err) {
        showToast("Error: " + err.message, "error");
      } finally {
        setButtonLoading(btn, false);
      }
    });
  });

  fetchMechanics();
}
