// ═══════════════════════════════════════════════════
// BUSINESS ERP — accountant.js
// Capital Management (Locked by Superadmin toggle), Operating Expenses, Business Loans
// ═══════════════════════════════════════════════════

window.renderAccountantModule = async function (tabKey, container) {
  // Clean up any lingering modals on tab switch
  const oldModal = document.getElementById("assetLiabilityModal");
  if (oldModal) oldModal.remove();

  const isToday = tabKey === 'acc_today_tasks' || tabKey === 'acc_tasks';
  const isCap = tabKey === 'acc_capital' || tabKey === 'capital';
  const isLoan = tabKey === 'acc_loans' || tabKey === 'loans';
  const isExp = tabKey === 'acc_expenses' || tabKey === 'expenses';
  const isAssetsLiab = tabKey === 'acc_assets_liabilities' || tabKey === 'assets_liabilities';
  const isSet = tabKey === 'acc_settings' || tabKey === 'settings';
  const isReports = tabKey === 'rpt_auditor_gst' || tabKey === 'reports';

  const isDefaultExp = !isToday && !isCap && !isLoan && !isExp && !isAssetsLiab && !isSet && !isReports;

  container.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;">
      <div class="sub-tabs-bar">
        <button class="sub-tab ${isToday ? 'active' : ''}" data-tabkey="acc_today_tasks">📋 Today Tasks</button>
        <button class="sub-tab ${isCap ? 'active' : ''}" data-tabkey="acc_capital">💰 Set Capital</button>
        <button class="sub-tab ${isLoan ? 'active' : ''}" data-tabkey="acc_loans">🏦 Loans / Contra</button>
        <button class="sub-tab ${(isExp || isDefaultExp) ? 'active' : ''}" data-tabkey="acc_expenses">💸 Expenses</button>
        <button class="sub-tab ${isAssetsLiab ? 'active' : ''}" data-tabkey="acc_assets_liabilities">🏛️ Assets & Liabilities</button>
        <button class="sub-tab ${isSet ? 'active' : ''}" data-tabkey="acc_settings">⚙️ Settings</button>
        <button class="sub-tab ${isReports ? 'active' : ''}" data-tabkey="rpt_auditor_gst">📊 Reports</button>
      </div>

      <div style="padding:24px;" id="accSubContent">
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

  const subArea = document.getElementById("accSubContent");
  if (isToday) {
    if (window.renderTodayTasksModule) await window.renderTodayTasksModule('acc_today_tasks', subArea);
    else loadExpensesSubTab();
  }
  else if (isCap) loadCapitalSubTab();
  else if (isLoan) loadLoansSubTab();
  else if (isAssetsLiab) loadAssetsLiabilitiesSubTab();
  else if (isSet) loadSettingsSubTab();
  else if (isReports) {
    if (window.renderReportsModule) await window.renderReportsModule('rpt_auditor_gst', subArea);
    else loadExpensesSubTab();
  }
  else loadExpensesSubTab();
};

if (window.registerModuleRoute) {
  window.registerModuleRoute(
    [
      'accountant', 'expenses', 'capital', 'loans', 'assets_liabilities',
      'acc_today_tasks', 'acc_capital', 'acc_loans', 'acc_assets_liabilities',
      'acc_expenses', 'acc_settings', 'rpt_auditor_gst'
    ],
    window.renderAccountantModule
  );
}

// ── SubTab 1: Operating Expenses ──
async function loadExpensesSubTab() {
  const subContent = document.getElementById("accSubContent");
  const compId = selectedCompanyId || "all";

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;max-width:100%;">
      <div>
        <h3 style="font-size:16px;font-weight:600;color:var(--text1);margin:0;">Operating Expense Register</h3>
        <div style="font-size:12px;color:var(--text3);margin-top:2px;">Track office, operational, and inventory purchase dealer bills. Printable expense vouchers supported.</div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;max-width:100%;">
        <button class="btn btn-secondary" id="printExpBtn" style="white-space:nowrap;">🖨️ Print Expenses Register</button>
        <button class="btn btn-primary" id="addExpBtn" style="white-space:nowrap;">+ Record Expense</button>
      </div>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Receipt #</th>
            <th>Company</th>
            <th>Date</th>
            <th>Category</th>
            <th>Receiver / dealer</th>
            <th>Amount</th>
            <th>Payment Mode</th>
            <th>Description</th>
            <th style="min-width:130px;text-align:center;">Actions</th>
          </tr>
        </thead>
        <tbody id="expTableBody">
          <tr><td colspan="9" style="text-align:center;padding:20px;"><div class="spinner"></div> Loading expenses...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;flex-wrap:wrap;gap:8px;">
      <div id="expInfo"></div>
      <div id="expPagination" class="pagination"></div>
    </div>

    <!-- EXPENSE MODAL -->
    <div class="modal-overlay" id="expModal" style="display:none;">
      <div class="modal-box" style="max-width:520px;">
        <div class="modal-header">
          <h3 id="expModalTitle">Record New Expense</h3>
          <button class="modal-close" id="expModalClose">&times;</button>
        </div>
        <form id="expForm">
          <input type="hidden" id="eEditingId" value="">
          <div class="modal-body" style="padding:20px 24px;">
            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label" style="display:block;margin-bottom:6px;font-weight:600;font-size:12px;color:var(--text2);border:none;">CATEGORY *</label>
              <select id="eCategory" class="form-select" required style="width:100%;">
                <option value="Lead Incentives">Lead Incentives 🎁</option>
                <option value="Inventory Purchase">Inventory Purchase 📦</option>
                <option value="Loading and Unloading Charges">Loading & Unloading Charges 🏗️</option>
                <option value="Material Transport Charges">Material Transport Charges 🚚</option>
                <option value="Rent">Rent & Maintenance 🏢</option>
                <option value="Electricity">Electricity & Utilities ⚡</option>
                <option value="Tea & Snacks">Tea & Office Refreshments ☕</option>
                <option value="Travel">Travel & Conveyance 🚗</option>
                <option value="Stationery">Stationery & Supplies ✏️</option>
                <option value="Internet & Phone">Internet & Phone 🌐</option>
                <option value="Miscellaneous">Miscellaneous 📋</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label" style="display:block;margin-bottom:6px;font-weight:600;font-size:12px;color:var(--text2);border:none;">AMOUNT (₹) *</label>
              <input type="number" step="0.01" id="eAmount" class="form-input" required placeholder="1500" style="width:100%;">
            </div>
            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label" style="display:block;margin-bottom:6px;font-weight:600;font-size:12px;color:var(--text2);border:none;">RECEIVER / dealer</label>
              <input type="text" id="edealer" class="form-input" placeholder="e.g. Universal Supplier / Landlord" style="width:100%;">
            </div>
            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label" style="display:block;margin-bottom:6px;font-weight:600;font-size:12px;color:var(--text2);border:none;">PAYMENT MODE</label>
              <select id="eMode" class="form-select" style="width:100%;">
                <option value="cash">Cash 💵</option>
                <option value="upi">UPI / GPay 📱</option>
                <option value="bank">Bank Transfer 🏦</option>
              </select>
            </div>
            <div class="form-group" id="eBankGroup" style="display:none;margin-bottom:14px;">
              <label class="form-label" style="display:block;margin-bottom:6px;font-weight:600;font-size:12px;color:var(--text2);border:none;">COMPANY BANK ACCOUNT</label>
              <select id="eBankAccount" class="form-select" style="width:100%;"></select>
            </div>
            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label" style="display:block;margin-bottom:6px;font-weight:600;font-size:12px;color:var(--text2);border:none;">DESCRIPTION / REMARKS</label>
              <textarea id="eDesc" class="form-input" rows="3" placeholder="Details..." style="width:100%;resize:vertical;"></textarea>
            </div>
          </div>
          <div class="modal-footer" style="padding:14px 24px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;background:var(--bg-secondary);">
            <button type="button" class="btn btn-secondary" id="expModalCancel">Cancel</button>
            <button type="submit" class="btn btn-primary" id="expModalSaveBtn">Save Expense</button>
          </div>
        </form>
      </div>
    </div>
  `;

  let currentExpensesList = [];

  async function fetchExpenses() {
    try {
      const res = await fetch(`${API_BASE}/accountant?action=expenses-list&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      currentExpensesList = data.expenses || [];
      const tbody = document.getElementById("expTableBody");
      if (!tbody) return;
      if (currentExpensesList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text3);">No expenses recorded.</td></tr>`;
        if (document.getElementById("expInfo")) document.getElementById("expInfo").innerHTML = "";
        if (document.getElementById("expPagination")) document.getElementById("expPagination").innerHTML = "";
        return;
      }

      const loggedUser = getUser() || {};
      const isSuperAdmin = loggedUser.role === "superadmin";

      window.renderPaginatedTable({
        data: currentExpensesList,
        pageSize: 10,
        currentPage: 1,
        tbody: "expTableBody",
        paginationContainer: "expPagination",
        infoContainer: "expInfo",
        renderRow: (e) => `
          <tr>
            <td><span class="badge badge-purple">${esc(e.receipt_number)}</span></td>
            <td style="font-weight:600;">${esc(e.company_name || 'All Companies')}</td>
            <td>${formatDate(e.expense_date)}</td>
            <td><span class="badge badge-outline" style="font-weight:600;">${esc(e.category)}</span></td>
            <td style="font-weight:700;color:var(--text1);">${esc(e.dealer_receiver || '—')}</td>
            <td style="font-weight:700;color:var(--danger);">${formatCurrency(e.amount)}</td>
            <td><span class="badge badge-warning">${esc((e.payment_mode || 'cash').toUpperCase())}</span></td>
            <td>${esc(e.description || '—')}</td>
            <td style="white-space:nowrap;min-width:130px;text-align:center;">
              ${isSuperAdmin ? `
              <div style="display:inline-flex;gap:4px;justify-content:center;">
                <button class="btn btn-xs btn-outline editExpBtn" data-id="${e.id}">✏️ Edit</button>
                <button class="btn btn-xs btn-danger deleteExpBtn" data-id="${e.id}">🗑️ Delete</button>
              </div>
              ` : `<span style="color:var(--text3);font-size:12px;">—</span>`}
            </td>
          </tr>
        `,
        onRender: () => {
          if (isSuperAdmin) {
            tbody.querySelectorAll(".editExpBtn").forEach(btn => {
              btn.addEventListener("click", () => {
                const exp = currentExpensesList.find(x => x.id == btn.dataset.id);
                if (exp) {
                  document.getElementById("eEditingId").value = exp.id;
                  document.getElementById("expModalTitle").textContent = `Edit Expense #${exp.receipt_number}`;
                  document.getElementById("eCategory").value = exp.category || "Inventory Purchase";
                  document.getElementById("eAmount").value = exp.amount || "";
                  document.getElementById("edealer").value = exp.dealer_receiver || "";
                  document.getElementById("eMode").value = exp.payment_mode || "cash";
                  document.getElementById("eDesc").value = exp.description || "";
                  document.getElementById("expModal").style.display = "flex";
                }
              });
            });

            tbody.querySelectorAll(".deleteExpBtn").forEach(btn => {
              btn.addEventListener("click", async () => {
                const expId = btn.dataset.id;
                const exp = currentExpensesList.find(x => x.id == expId);
                if (!confirm(`Are you sure you want to delete expense record #${exp?.receipt_number || expId} for ${formatCurrency(exp?.amount || 0)}?`)) return;

                if (btn.disabled) return;
                const origHtml = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

                try {
                  const res = await fetch(`${API_BASE}/accountant?action=expense-delete&id=${expId}`, {
                    method: "POST",
                    headers: authHeaders()
                  });
                  const d = await res.json();
                  if (d.success) {
                    showToast(d.message || "Expense deleted!", "success");
                    fetchExpenses();
                  } else {
                    showToast(d.error || "Failed to delete expense", "error");
                    btn.disabled = false;
                    btn.innerHTML = origHtml;
                  }
                } catch (err) {
                  showToast("Delete expense error: " + err.message, "error");
                  btn.disabled = false;
                  btn.innerHTML = origHtml;
                }
              });
            });
          }
        }
      });

    } catch (err) {
      showToast("Fetch expenses error: " + err.message, "error");
    }
  }

  on("printExpBtn", "click", () => {
    if (currentExpensesList.length === 0) return showToast("No expenses to print", "info");
    printExpensesReport(currentExpensesList);
  });

  function printExpensesReport(expenses) {
    const printWin = window.open("", "_blank", "width=950,height=1000");
    if (!printWin) return alert("Please allow popups to print expenses.");

    const compName = (typeof currentCompanies !== 'undefined' && currentCompanies[0]?.name) ? currentCompanies[0].name : "BUSINESS ERP ENTERPRISES";
    let totalAmt = 0;
    expenses.forEach(e => totalAmt += parseFloat(e.amount || 0));

    const rowsHtml = expenses.map((e, idx) => `
      <tr>
        <td style="text-align:center;padding:8px;border:1px solid #cbd5e1;">${idx + 1}</td>
        <td style="padding:8px;border:1px solid #cbd5e1;font-family:monospace;font-weight:bold;">${esc(e.receipt_number)}</td>
        <td style="padding:8px;border:1px solid #cbd5e1;">${formatDate(e.expense_date)}</td>
        <td style="padding:8px;border:1px solid #cbd5e1;">${esc(e.company_name || compName)}</td>
        <td style="padding:8px;border:1px solid #cbd5e1;font-weight:bold;">${esc(e.category)}</td>
        <td style="padding:8px;border:1px solid #cbd5e1;">${esc(e.dealer_receiver || '—')}</td>
        <td style="padding:8px;border:1px solid #cbd5e1;">${esc((e.payment_mode || 'cash').toUpperCase())}</td>
        <td style="padding:8px;border:1px solid #cbd5e1;font-size:11px;">${esc(e.description || '—')}</td>
        <td style="text-align:right;padding:8px;border:1px solid #cbd5e1;font-weight:bold;color:#b91c1c;">₹${parseFloat(e.amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
      </tr>
    `).join("");

    const htmlDoc = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Company Operating Expenses Register</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; font-size: 13px; line-height: 1.4; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
          .title { font-size: 22px; font-weight: 800; text-transform: uppercase; margin: 0; color: #0f172a; }
          .subtitle { font-size: 14px; font-weight: 700; color: #dc2626; text-transform: uppercase; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; margin-bottom: 16px; }
          th { background: #f1f5f9; padding: 8px; font-size: 11px; text-transform: uppercase; border: 1px solid #cbd5e1; font-weight: 700; color: #334155; }
          .summary-card { background: #fef2f2; border: 1px solid #fecaca; padding: 12px 16px; border-radius: 6px; text-align: right; font-size: 16px; font-weight: 800; color: #991b1b; }
          .signatures { display: flex; justify-content: space-between; margin-top: 60px; padding-top: 20px; border-top: 1px dashed #cbd5e1; }
          .sig-box { text-align: center; width: 220px; }
          .sig-line { border-top: 1px solid #334155; margin-top: 40px; padding-top: 4px; font-weight: bold; font-size: 12px; }
          @media print {
            .no-print { display: none !important; }
            body { padding: 0; }
            @page { size: A4 landscape; margin: 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom:16px;text-align:right;">
          <button onclick="window.print()" style="background:#dc2626;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-weight:bold;font-size:14px;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
            🖨️ Print Expenses Register
          </button>
        </div>

        <div class="header">
          <div>
            <h1 class="title">${esc(compName)}</h1>
            <div class="subtitle">Company Operating & Purchase Expenses Register</div>
            <div style="font-size:11px;color:#64748b;margin-top:4px;">Generated on ${new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:bold;font-size:13px;">Total Expenses Recorded: ${expenses.length}</div>
            <div style="font-weight:800;font-size:18px;color:#b91c1c;margin-top:4px;">₹${totalAmt.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:30px;">#</th>
              <th>Receipt #</th>
              <th>Date</th>
              <th>Company</th>
              <th>Category</th>
              <th>dealer / Receiver</th>
              <th>Mode</th>
              <th>Description / Remarks</th>
              <th style="text-align:right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="summary-card">
          Grand Total Operating Expenses: ₹${totalAmt.toLocaleString('en-IN', {minimumFractionDigits: 2})}
        </div>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-line">Prepared By (Accountant)</div>
          </div>
          <div class="sig-box">
            <div class="sig-line">For ${esc(compName)}<br>(Approved Signatory)</div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWin.document.write(htmlDoc);
    printWin.document.close();
  }

  on("addExpBtn", "click", () => {
    if (document.getElementById("eEditingId")) document.getElementById("eEditingId").value = "";
    if (document.getElementById("expModalTitle")) document.getElementById("expModalTitle").textContent = "Record New Expense";
    document.getElementById("expForm").reset();
    document.getElementById("expModal").style.display = "flex";
  });
  on("expModalClose", "click", () => { document.getElementById("expModal").style.display = "none"; });
  on("expModalCancel", "click", () => { document.getElementById("expModal").style.display = "none"; });

  const eModeSel = document.getElementById("eMode");
  const eBankGroup = document.getElementById("eBankGroup");
  if (eModeSel && eBankGroup) {
    eModeSel.addEventListener("change", () => {
      if (eModeSel.value === "bank" || eModeSel.value === "upi") {
        eBankGroup.style.display = "block";
        if (window.populateBankAccountDropdown) {
          window.populateBankAccountDropdown("eBankAccount", compId);
        }
      } else {
        eBankGroup.style.display = "none";
      }
    });
  }

  on("expForm", "submit", async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById("expModalSaveBtn") || e.target.querySelector('button[type="submit"]');
    if (saveBtn && saveBtn.disabled) return;
    const origHtml = saveBtn ? saveBtn.innerHTML : "Save Expense";
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving Expense...`;
    }

    const editingId = document.getElementById("eEditingId")?.value;
    const actionName = editingId ? "expense-update" : "expense-create";
    const payModeVal = document.getElementById("eMode").value;

    const payload = {
      id: editingId || undefined,
      company_id: currentCompanies[0]?.id || 1,
      category: document.getElementById("eCategory").value,
      amount: document.getElementById("eAmount").value,
      dealer_receiver: document.getElementById("edealer").value.trim(),
      payment_mode: payModeVal,
      bank_account_id: (payModeVal === "bank" || payModeVal === "upi") ? (document.getElementById("eBankAccount")?.value || null) : null,
      description: document.getElementById("eDesc").value.trim(),
    };

    try {
      const res = await fetch(`${API_BASE}/accountant?action=${actionName}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Expense saved successfully", "success");
        document.getElementById("expModal").style.display = "none";
        document.getElementById("expForm").reset();
        if (document.getElementById("eEditingId")) document.getElementById("eEditingId").value = "";
        fetchExpenses();
      } else showToast(data.error, "error");
    } catch (err) {
      showToast("Error: " + err.message, "error");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = origHtml;
      }
    }
  });

  fetchExpenses();
}

// ── SubTab 2: Working Capital ──
async function loadCapitalSubTab() {
  const subContent = document.getElementById("accSubContent");
  const compId = selectedCompanyId || "all";

  subContent.innerHTML = `
    <div style="max-width:700px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:16px;font-weight:600;color:var(--text1);">Company Working Capital Log</h3>
        <button class="btn btn-primary" id="updateCapBtn">+ Set Capital Amount</button>
      </div>

      <div class="card" style="background:var(--bg-primary);margin-bottom:20px;">
        <div style="font-size:13px;color:var(--text3);">
          💡 <strong>Superadmin Control Policy:</strong> If capital editing is turned OFF by Superadmin in Superpanel, Accountants cannot alter this value.
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Old Capital</th>
              <th>New Capital</th>
              <th>Reason</th>
              <th>Auditor Report</th>
              <th>Updated By</th>
            </tr>
          </thead>
          <tbody id="capTableBody">
            <tr><td colspan="6" style="text-align:center;padding:20px;"><div class="spinner"></div> Fetching capital history...</td></tr>
          </tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;flex-wrap:wrap;gap:8px;">
        <div id="capInfo"></div>
        <div id="capPagination" class="pagination"></div>
      </div>
    </div>

    <!-- CAPITAL MODAL -->
    <div class="modal-overlay" id="capModal" style="display:none;">
      <div class="modal-box">
        <div class="modal-header">
          <h3>Set Company Capital</h3>
          <button class="modal-close" id="capModalClose">&times;</button>
        </div>
        <form id="capForm">
          <div class="form-group">
            <label class="form-label">New Capital Amount (₹) *</label>
            <input type="number" step="0.01" id="cNewValue" class="form-input" required placeholder="500000">
          </div>
          <div class="form-group">
            <label class="form-label">Reason for Change</label>
            <input type="text" id="cReason" class="form-input" placeholder="e.g. Fresh promoter infusion">
          </div>
          <div class="form-group" style="margin-top:10px;">
            <label class="form-label" style="font-weight:700;color:var(--primary);">📁 Auditor Report File (PDF / Image / Doc) *</label>
            <input type="file" id="cAuditorReport" class="form-input" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" required>
            <div style="font-size:11px;color:var(--text3);margin-top:4px;">Mandatory: Upload official Auditor Report document approving capital change.</div>
          </div>
          <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" class="btn btn-secondary" id="capModalCancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Update Capital</button>
          </div>
        </form>
      </div>
    </div>
  `;

  async function fetchCapital() {
    try {
      const res = await fetch(`${API_BASE}/accountant?action=capital-get&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      const tbody = document.getElementById("capTableBody");
      if (!tbody) return;
      if (data.capital_history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3);">No capital entries logged.</td></tr>`;
        if (document.getElementById("capInfo")) document.getElementById("capInfo").innerHTML = "";
        if (document.getElementById("capPagination")) document.getElementById("capPagination").innerHTML = "";
        return;
      }

      window.renderPaginatedTable({
        data: data.capital_history,
        pageSize: 10,
        currentPage: 1,
        tbody: "capTableBody",
        paginationContainer: "capPagination",
        infoContainer: "capInfo",
        renderRow: (c) => `
          <tr>
            <td>${formatDate(c.effective_date)}</td>
            <td>${formatCurrency(c.old_value)}</td>
            <td style="font-weight:700;color:var(--success);">${formatCurrency(c.new_value)}</td>
            <td>${esc(c.reason || '—')}</td>
            <td>
              ${c.auditor_report_attachment ? `
                <a href="${esc(c.auditor_report_attachment)}" target="_blank" class="btn btn-xs btn-outline" style="font-size:11px;padding:2px 8px;display:inline-flex;align-items:center;gap:4px;" title="View Auditor Report">
                  📄 View Report
                </a>
              ` : '<span style="color:var(--text3);font-size:12px;">—</span>'}
            </td>
            <td>${esc(c.changed_by_user || 'Admin')}</td>
          </tr>
        `
      });

    } catch (err) {
      showToast("Fetch capital error: " + err.message, "error");
    }
  }

  on("updateCapBtn", "click", () => { document.getElementById("capModal").style.display = "flex"; });
  on("capModalClose", "click", () => { document.getElementById("capModal").style.display = "none"; });
  on("capModalCancel", "click", () => { document.getElementById("capModal").style.display = "none"; });

  on("capForm", "submit", async (e) => {
    e.preventDefault();
    const fileInp = document.getElementById("cAuditorReport");
    const file = fileInp?.files[0];
    if (!file) {
      return showToast("Auditor Report file upload is mandatory!", "error");
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn && submitBtn.disabled) return;
    const origHtml = submitBtn ? submitBtn.innerHTML : "Update Capital";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Updating Capital...`;
    }

    try {
      const fileBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
      });

      const payload = {
        company_id: currentCompanies[0]?.id || 1,
        new_value: document.getElementById("cNewValue").value,
        reason: document.getElementById("cReason").value.trim(),
        auditor_report: fileBase64
      };

      const res = await fetch(`${API_BASE}/accountant?action=capital-set`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "success");
        document.getElementById("capModal").style.display = "none";
        document.getElementById("capForm").reset();
        fetchCapital();
      } else showToast(data.error, "error");
    } catch (err) {
      showToast("Error: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    }
  });

  fetchCapital();
}

// ── SubTab 3: Business Loans ──
async function loadLoansSubTab() {
  const subContent = document.getElementById("accSubContent");
  const compId = selectedCompanyId || "all";

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h3 style="font-size:16px;font-weight:600;color:var(--text1);">Business Loans & EMI Schedules</h3>
      <button class="btn btn-primary" id="addLoanBtn">+ Record Business Loan</button>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Lender Bank</th>
            <th>Type</th>
            <th>Principal Amount</th>
            <th>Interest %</th>
            <th>Tenure (Months)</th>
            <th>Monthly EMI</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="loanTableBody">
          <tr><td colspan="7" style="text-align:center;padding:20px;"><div class="spinner"></div> Loading loans...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- LOAN MODAL -->
    <div class="modal-overlay" id="loanModal" style="display:none;">
      <div class="modal-box">
        <div class="modal-header">
          <h3>Record Business Loan</h3>
          <button class="modal-close" id="loanModalClose">&times;</button>
        </div>
        <form id="loanForm">
          <div class="form-group">
            <label class="form-label">Lender Name / Bank *</label>
            <input type="text" id="lName" class="form-input" required placeholder="HDFC Bank / Bajaj Finance">
          </div>
          <div class="form-group">
            <label class="form-label">Principal Amount (₹) *</label>
            <input type="number" step="0.01" id="lPrincipal" class="form-input" required placeholder="1000000">
          </div>
          <div class="form-group">
            <label class="form-label">Annual Interest Rate (%)</label>
            <input type="number" step="0.01" id="lRate" class="form-input" value="12">
          </div>
          <div class="form-group">
            <label class="form-label">Tenure (Months)</label>
            <input type="number" id="lTenure" class="form-input" value="24">
          </div>
          <div class="form-group">
            <label class="form-label">Monthly EMI Amount (₹)</label>
            <input type="number" step="0.01" id="lEmi" class="form-input" placeholder="47000">
          </div>
          <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" class="btn btn-secondary" id="loanModalCancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Loan</button>
          </div>
        </form>
      </div>
    </div>
  `;

  async function fetchLoans() {
    try {
      const res = await fetch(`${API_BASE}/accountant?action=loans-list&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      const tbody = document.getElementById("loanTableBody");
      if (!tbody) return;
      if (data.loans.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text3);">No business loans recorded.</td></tr>`;
        if (document.getElementById("loanInfo")) document.getElementById("loanInfo").innerHTML = "";
        if (document.getElementById("loanPagination")) document.getElementById("loanPagination").innerHTML = "";
        return;
      }

      window.renderPaginatedTable({
        data: data.loans,
        pageSize: 10,
        currentPage: 1,
        tbody: "loanTableBody",
        paginationContainer: "loanPagination",
        infoContainer: "loanInfo",
        renderRow: (l) => `
          <tr>
            <td style="font-weight:600;color:var(--text1);">${esc(l.lender_name)}</td>
            <td>${esc(l.loan_type || 'Business Loan')}</td>
            <td style="font-weight:600;color:var(--warning);">${formatCurrency(l.principal_amount)}</td>
            <td>${l.interest_rate}%</td>
            <td>${l.tenure_months} months</td>
            <td style="font-weight:600;color:var(--danger);">${formatCurrency(l.emi_amount)}</td>
            <td><span class="badge badge-success">${esc(l.status.toUpperCase())}</span></td>
          </tr>
        `
      });

    } catch (err) {
      showToast("Fetch loans error: " + err.message, "error");
    }
  }

  on("addLoanBtn", "click", () => { document.getElementById("loanModal").style.display = "flex"; });
  on("loanModalClose", "click", () => { document.getElementById("loanModal").style.display = "none"; });
  on("loanModalCancel", "click", () => { document.getElementById("loanModal").style.display = "none"; });

  on("loanForm", "submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn && submitBtn.disabled) return;
    const origHtml = submitBtn ? submitBtn.innerHTML : "Save Loan";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving Loan...`;
    }

    const payload = {
      company_id: currentCompanies[0]?.id || 1,
      lender_name: document.getElementById("lName").value.trim(),
      principal_amount: document.getElementById("lPrincipal").value,
      interest_rate: document.getElementById("lRate").value,
      tenure_months: document.getElementById("lTenure").value,
      emi_amount: document.getElementById("lEmi").value,
    };

    try {
      const res = await fetch(`${API_BASE}/accountant?action=loan-create`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "success");
        document.getElementById("loanModal").style.display = "none";
        fetchLoans();
      } else showToast(data.error, "error");
    } catch (err) {
      showToast("Error: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    }
  });

  fetchLoans();
}

// ── SubTab 5: Bank Accounts & Financial Settings ──
async function loadSettingsSubTab() {
  const subContent = document.getElementById("accSubContent");
  let compId = selectedCompanyId || "all";
  const userObj = (typeof getUser === "function" ? getUser() : null) || JSON.parse(localStorage.getItem("erp_user") || "{}");
  const isSuper = userObj && (userObj.role === "superadmin" || userObj.username === "superadmin");

  subContent.innerHTML = `
    <div style="display:flex;justify-space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
      <div>
        <h3 style="font-size:18px;font-weight:700;color:var(--text1);margin:0;display:flex;align-items:center;gap:8px;">
          🏦 Bank Accounts & Financial Settings
        </h3>
        <div style="font-size:12px;color:var(--text3);margin-top:4px;">
          Manage company master bank accounts, opening & live balances, IFSC details, and primary account designations.
        </div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        ${isSuper ? `
          <select id="setCompFilter" class="form-select" style="max-width:200px;font-size:12px;">
            <option value="all">📊 All Companies</option>
            ${(window.currentCompanies || currentCompanies || []).map(c => `<option value="${c.id}" ${c.id == compId ? 'selected' : ''}>🏢 ${esc(c.name)}</option>`).join("")}
          </select>
        ` : ''}
        <button class="btn btn-primary" id="addBankAccBtn" style="font-weight:600;">
          + Add New Bank Account
        </button>
      </div>
    </div>

    <!-- BANK ACCOUNTS LIST CONTAINER -->
    <div id="bankAccountsContainer">
      <div style="text-align:center;padding:40px;color:var(--text3);"><div class="spinner"></div> Loading bank accounts...</div>
    </div>

    <!-- DATALIST FOR INDIAN BANKS -->
    <datalist id="indianBankList">
      <option value="State Bank of India (SBI)">
      <option value="HDFC Bank">
      <option value="ICICI Bank">
      <option value="Axis Bank">
      <option value="Punjab National Bank (PNB)">
      <option value="Canara Bank">
      <option value="Bank of Baroda (BOB)">
      <option value="Union Bank of India">
      <option value="Kotak Mahindra Bank">
      <option value="IndusInd Bank">
      <option value="Yes Bank">
      <option value="Federal Bank">
      <option value="IDFC FIRST Bank">
      <option value="Indian Overseas Bank">
      <option value="UCO Bank">
    </datalist>

    <!-- BANK ACCOUNT MODAL (ADD / EDIT) -->
    <div class="modal-overlay" id="bankAccModal" style="display:none;position:fixed;inset:0;background:rgba(15, 23, 42, 0.75);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:999999;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;">
      <div class="modal-box" style="max-width:580px;width:100%;max-height:90vh;display:flex;flex-direction:column;background:var(--bg-secondary, #ffffff);border:1px solid var(--border, #cbd5e1);border-radius:14px;box-shadow:0 25px 60px rgba(0,0,0,0.4);overflow:hidden;position:relative;margin:auto;">
        <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border, #cbd5e1);background:var(--bg1, #f8fafc);flex-shrink:0;">
          <h3 id="bankAccModalTitle" style="margin:0;font-size:16px;font-weight:700;color:var(--text1);">Add New Bank Account</h3>
          <button class="modal-close" id="bankAccModalClose" style="background:none;border:none;font-size:22px;font-weight:bold;cursor:pointer;color:var(--text2);">&times;</button>
        </div>
        <form id="bankAccForm" style="padding:20px;overflow-y:auto;flex:1;min-height:0;display:flex;flex-direction:column;gap:14px;">
          <input type="hidden" id="bEditingId" value="">
          ${isSuper ? `
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="display:block;font-weight:600;font-size:12px;margin-bottom:4px;">Target Company *</label>
              <select id="bCompanyId" class="form-select" required>
                ${(window.currentCompanies || currentCompanies || []).map(c => `<option value="${c.id}">🏢 ${esc(c.name)}</option>`).join("")}
              </select>
            </div>
          ` : ''}
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="display:block;font-weight:600;font-size:12px;margin-bottom:4px;">Bank Name *</label>
              <input type="text" id="bBankName" list="indianBankList" class="form-input" required placeholder="e.g. HDFC Bank / SBI">
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="display:block;font-weight:600;font-size:12px;margin-bottom:4px;">Account Label / Holder Name</label>
              <input type="text" id="bAccountName" class="form-input" placeholder="e.g. Primary Operations Account">
            </div>
          </div>
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="display:block;font-weight:600;font-size:12px;margin-bottom:4px;">Account Number *</label>
              <input type="text" id="bAccountNumber" class="form-input" required placeholder="e.g. 50100234567890">
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="display:block;font-weight:600;font-size:12px;margin-bottom:4px;">IFSC Code *</label>
              <input type="text" id="bIfscCode" class="form-input" required placeholder="e.g. HDFC0001234" style="text-transform:uppercase;">
            </div>
          </div>
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="display:block;font-weight:600;font-size:12px;margin-bottom:4px;">Branch Name</label>
              <input type="text" id="bBranchName" class="form-input" placeholder="e.g. Main Branch, MG Road">
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="display:block;font-weight:600;font-size:12px;margin-bottom:4px;">Account Type</label>
              <select id="bAccountType" class="form-select">
                <option value="Current">Current Account</option>
                <option value="Savings">Savings Account</option>
                <option value="Overdraft">Overdraft (OD) Account</option>
                <option value="Cash Credit">Cash Credit (CC) Account</option>
              </select>
            </div>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label" style="display:block;font-weight:600;font-size:12px;margin-bottom:4px;">Branch Address / Details</label>
            <input type="text" id="bBranchAddress" class="form-input" placeholder="Full address or location notes">
          </div>
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="display:block;font-weight:600;font-size:12px;margin-bottom:4px;">Opening Balance (₹)</label>
              <input type="number" step="0.01" id="bOpeningBalance" class="form-input" value="0.00" placeholder="0.00">
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="display:block;font-weight:600;font-size:12px;margin-bottom:4px;">Current / Live Balance (₹)</label>
              <input type="number" step="0.01" id="bCurrentBalance" class="form-input" value="0.00" placeholder="0.00">
            </div>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label" style="display:block;font-weight:600;font-size:12px;margin-bottom:4px;">UPI VPA / QR ID (Optional)</label>
            <input type="text" id="bUpiId" class="form-input" placeholder="e.g. business@okaxis">
          </div>
          <div class="form-group" style="display:flex;align-items:center;gap:8px;margin-top:4px;">
            <input type="checkbox" id="bIsPrimary" style="width:16px;height:16px;cursor:pointer;">
            <label for="bIsPrimary" style="cursor:pointer;font-weight:600;color:var(--text1);font-size:13px;">⭐ Set as Primary Bank Account for this Company</label>
          </div>
          <div style="margin-top:8px;display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" class="btn btn-secondary" id="bankAccModalCancel">Cancel</button>
            <button type="submit" class="btn btn-primary" id="bankAccSaveBtn">💾 Save Bank Account</button>
          </div>
        </form>
      </div>
    </div>

    <!-- ADJUST BALANCE MODAL -->
    <div class="modal-overlay" id="adjustBalModal" style="display:none;position:fixed;inset:0;background:rgba(15, 23, 42, 0.75);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:999999;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;">
      <div class="modal-box" style="max-width:480px;width:100%;max-height:90vh;display:flex;flex-direction:column;background:var(--bg-secondary, #ffffff);border:1px solid var(--border, #cbd5e1);border-radius:14px;box-shadow:0 25px 60px rgba(0,0,0,0.4);overflow:hidden;position:relative;margin:auto;">
        <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border, #cbd5e1);background:var(--bg1, #f8fafc);flex-shrink:0;">
          <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--text1);">⚖️ Adjust Bank Account Balance</h3>
          <button class="modal-close" id="adjBalModalClose" style="background:none;border:none;font-size:22px;font-weight:bold;cursor:pointer;color:var(--text2);">&times;</button>
        </div>
        <form id="adjustBalForm" style="padding:20px;overflow-y:auto;flex:1;min-height:0;display:flex;flex-direction:column;gap:14px;">
          <input type="hidden" id="adjAccId" value="">
          <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;border:1px solid var(--border);font-size:13px;">
            <div style="font-weight:700;color:var(--primary);" id="adjAccNameText">Bank Account</div>
            <div style="margin-top:4px;color:var(--text2);">Current Recorded Balance: <strong style="color:var(--success);font-size:15px;" id="adjCurrentBalText">₹0.00</strong></div>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label" style="display:block;font-weight:600;font-size:12px;margin-bottom:4px;">Adjustment Mode</label>
            <select id="adjMode" class="form-select">
              <option value="set">Directly Set New Balance (₹)</option>
              <option value="add">Add / Credit Amount to Balance (+ ₹)</option>
              <option value="subtract">Subtract / Debit Amount from Balance (- ₹)</option>
            </select>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label" id="adjValLabel" style="display:block;font-weight:600;font-size:12px;margin-bottom:4px;">New Target Balance (₹) *</label>
            <input type="number" step="0.01" id="adjValInput" class="form-input" required placeholder="0.00" style="font-size:16px;font-weight:700;">
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label" style="display:block;font-weight:600;font-size:12px;margin-bottom:4px;">Reason / Notes for Balance Adjustment *</label>
            <input type="text" id="adjReasonInput" class="form-input" required placeholder="e.g. Bank statement reconciliation / Opening balance fix">
          </div>
          <div style="margin-top:8px;display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" class="btn btn-secondary" id="adjBalModalCancel">Cancel</button>
            <button type="submit" class="btn btn-primary">⚖️ Save Adjusted Balance</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Dynamic filter for superadmin
  const compFilter = document.getElementById("setCompFilter");
  if (compFilter) {
    compFilter.addEventListener("change", () => {
      compId = compFilter.value;
      fetchBankAccounts();
    });
  }

  let bankAccountsList = [];

  async function fetchBankAccounts() {
    const container = document.getElementById("bankAccountsContainer");
    if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3);"><div class="spinner"></div> Loading bank accounts...</div>`;

    try {
      const res = await fetch(`${API_BASE}/accountant?action=bank-accounts-list&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) {
        container.innerHTML = `<div class="alert alert-danger">${esc(data.error || 'Failed to fetch bank accounts')}</div>`;
        return;
      }

      bankAccountsList = data.bank_accounts || [];

      if (bankAccountsList.length === 0) {
        container.innerHTML = `
          <div style="text-align:center;padding:48px 20px;background:var(--bg-secondary);border:1px dashed var(--border);border-radius:12px;">
            <div style="font-size:40px;margin-bottom:12px;">🏦</div>
            <h4 style="font-size:16px;font-weight:700;color:var(--text1);margin-bottom:6px;">No Bank Accounts Configured</h4>
            <p style="font-size:13px;color:var(--text3);max-width:400px;margin:0 auto 16px auto;">
              Add your company bank accounts to manage balances and select them in Delivery Challans, Sales Returns, Expenses, and Receipts.
            </p>
            <button class="btn btn-primary" id="firstAddBankBtn">+ Add First Bank Account</button>
          </div>
        `;
        on("firstAddBankBtn", "click", () => openBankModal(null));
        return;
      }

      let gridHtml = `<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(340px, 1fr));gap:16px;">`;
      bankAccountsList.forEach(b => {
        const isPri = b.is_primary;
        const curBal = parseFloat(b.current_balance || 0);
        const openBal = parseFloat(b.opening_balance || 0);
        const maskedAcc = b.account_number ? `•••• •••• ${b.account_number.slice(-4)}` : '••••';
        const maskedIfsc = b.ifsc_code ? `${b.ifsc_code.slice(0, 4)}••••` : '••••';

        gridHtml += `
          <div class="card" style="position:relative;border:1px solid ${isPri ? 'var(--primary)' : 'var(--border)'};background:var(--bg-primary);box-shadow:0 4px 12px rgba(0,0,0,0.05);padding:18px;border-radius:12px;display:flex;flex-direction:column;justify-space-between;">
            <div>
              ${isPri ? `
                <div style="position:absolute;top:12px;right:12px;background:var(--primary);color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:12px;letter-spacing:0.5px;text-transform:uppercase;">
                  ⭐ Primary Bank
                </div>
              ` : ''}

              <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                <div style="width:42px;height:42px;border-radius:10px;background:rgba(99, 102, 241, 0.12);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">
                  🏦
                </div>
                <div style="flex:1;min-width:0;">
                  <h4 style="font-size:15px;font-weight:700;color:var(--text1);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(b.bank_name)}</h4>
                  <div style="font-size:12px;color:var(--text3);margin-top:1px;">${esc(b.account_name || 'Operating Account')} • <span class="badge badge-secondary" style="font-size:10px;padding:2px 6px;">${esc(b.account_type || 'Current')}</span></div>
                </div>
              </div>

              <!-- Masked Box with View Details button -->
              <div style="background:var(--bg-secondary);padding:12px 14px;border-radius:10px;border:1px solid var(--border);margin-bottom:14px;position:relative;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <div style="font-size:11px;color:var(--text3);text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">ACCOUNT NUMBER</div>
                  <button type="button" class="btn btn-xs btn-outline show-bank-details-btn" data-id="${b.id}" style="padding:2px 8px;font-size:11px;border-radius:4px;background:var(--bg1);">
                    👁️ Show Details
                  </button>
                </div>
                <div style="font-size:16px;font-weight:800;color:var(--text1);font-family:monospace;letter-spacing:1px;margin:4px 0 8px 0;">${maskedAcc}</div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;color:var(--text2);border-top:1px dashed var(--border);padding-top:8px;">
                  <div>IFSC: <strong style="color:var(--text1);font-family:monospace;">${maskedIfsc}</strong></div>
                  <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Branch: <strong style="color:var(--text1);">${esc(b.branch_name || 'N/A')}</strong></div>
                </div>
                ${b.upi_id ? `<div style="font-size:11px;color:var(--primary);margin-top:6px;">📱 UPI: <strong>${esc(b.upi_id)}</strong></div>` : ''}
                ${b.company_name ? `<div style="font-size:11px;color:var(--text3);margin-top:4px;">🏢 Company: <strong>${esc(b.company_name)}</strong></div>` : ''}
              </div>

              <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:14px;padding:0 4px;">
                <div>
                  <div style="font-size:11px;color:var(--text3);">Opening Balance</div>
                  <div style="font-size:13px;font-weight:600;color:var(--text2);">${formatCurrency(openBal)}</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:11px;color:var(--primary);font-weight:700;">CURRENT BALANCE</div>
                  <div style="font-size:20px;font-weight:800;color:${curBal >= 0 ? 'var(--success)' : 'var(--danger)'};">${formatCurrency(curBal)}</div>
                </div>
              </div>
            </div>

            <div style="display:flex;gap:6px;border-top:1px solid var(--border);padding-top:12px;margin-top:4px;flex-wrap:wrap;">
              <button class="btn btn-sm btn-secondary upload-stmt-btn" data-id="${b.id}" style="flex:1;font-size:11.5px;padding:6px 8px;white-space:nowrap;">
                📄 Statement
              </button>
              <button class="btn btn-sm btn-outline adjust-bal-btn" data-id="${b.id}" data-name="${esc(b.bank_name)} (${esc(b.account_number.slice(-4))})" data-bal="${curBal}" style="flex:1;font-size:11.5px;padding:6px 8px;white-space:nowrap;">
                ⚖️ Adjust
              </button>
              <button class="btn btn-sm btn-secondary edit-bank-btn" data-id="${b.id}" style="font-size:11.5px;padding:6px 10px;">
                ✏️ Edit
              </button>
              <button class="btn btn-sm btn-outline delete-bank-btn" data-id="${b.id}" style="color:var(--danger);border-color:var(--danger);font-size:11.5px;padding:6px 10px;">
                🗑️
              </button>
            </div>
          </div>
        `;
      });
      gridHtml += `</div>`;

      container.innerHTML = gridHtml;

      // Attach card button listeners
      container.querySelectorAll(".show-bank-details-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const acc = bankAccountsList.find(a => a.id == btn.dataset.id);
          if (acc) openBankDetailsModal(acc);
        });
      });

      container.querySelectorAll(".upload-stmt-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const acc = bankAccountsList.find(a => a.id == btn.dataset.id);
          if (acc) openBankStatementModal(acc);
        });
      });

      container.querySelectorAll(".edit-bank-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const accId = btn.dataset.id;
          const acc = bankAccountsList.find(a => a.id == accId);
          if (acc) openBankModal(acc);
        });
      });

      container.querySelectorAll(".adjust-bal-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          openAdjustBalModal(btn.dataset.id, btn.dataset.name, btn.dataset.bal);
        });
      });

      container.querySelectorAll(".delete-bank-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const accId = btn.dataset.id;
          if (!confirm("Are you sure you want to delete this bank account?")) return;
          if (btn.disabled) return;
          const origHtml = btn.innerHTML;
          btn.disabled = true;
          btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

          try {
            const res = await fetch(`${API_BASE}/accountant?action=bank-account-delete&id=${accId}`, {
              method: "POST",
              headers: authHeaders()
            });
            const data = await res.json();
            if (data.success) {
              showToast(data.message, "success");
              fetchBankAccounts();
            } else {
              showToast(data.error, "error");
              btn.disabled = false;
              btn.innerHTML = origHtml;
            }
          } catch (e) {
            showToast(e.message, "error");
            btn.disabled = false;
            btn.innerHTML = origHtml;
          }
        });
      });

    } catch (err) {
      console.error("fetchBankAccounts error:", err);
      container.innerHTML = `<div class="alert alert-danger">Error loading bank accounts: ${esc(err.message)}</div>`;
    }
  }

  // Modal: View Unmasked Bank Details
  function openBankDetailsModal(acc) {
    let modal = document.getElementById("bankDetailsModal");
    if (modal) modal.remove();

    modal = document.createElement("div");
    modal.id = "bankDetailsModal";
    modal.className = "modal-overlay";
    modal.style.position = "fixed";
    modal.style.inset = "0";
    modal.style.background = "rgba(15, 23, 42, 0.75)";
    modal.style.backdropFilter = "blur(4px)";
    modal.style.webkitBackdropFilter = "blur(4px)";
    modal.style.zIndex = "999999";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.padding = "16px";
    modal.style.boxSizing = "border-box";

    modal.innerHTML = `
      <div class="modal-box" style="max-width:480px;width:100%;max-height:90vh;display:flex;flex-direction:column;background:var(--bg-secondary, #ffffff);border:1px solid var(--border, #cbd5e1);border-radius:14px;box-shadow:0 25px 60px rgba(0,0,0,0.4);overflow:hidden;position:relative;margin:auto;">
        <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border, #cbd5e1);background:var(--bg1, #f8fafc);flex-shrink:0;">
          <h4 style="margin:0;font-size:16px;font-weight:700;color:var(--text1);display:flex;align-items:center;gap:8px;">
            🏦 Bank Account Details
          </h4>
          <span class="close-modal" id="closeBankDetailsBtn" style="cursor:pointer;font-size:22px;font-weight:bold;line-height:1;">&times;</span>
        </div>

        <div style="padding:20px;overflow-y:auto;flex:1;min-height:0;display:flex;flex-direction:column;gap:14px;">
          <div style="display:flex;align-items:center;gap:12px;background:var(--bg1);padding:12px;border-radius:10px;border:1px solid var(--border);">
            <div style="font-size:32px;">🏦</div>
            <div>
              <div style="font-size:16px;font-weight:700;color:var(--text1);">${esc(acc.bank_name)}</div>
              <div style="font-size:12px;color:var(--text3);">${esc(acc.account_name || 'Operating Account')} • ${esc(acc.account_type || 'Current')} Account</div>
              ${acc.company_name ? `<div style="font-size:11px;color:var(--primary);margin-top:2px;">🏢 ${esc(acc.company_name)}</div>` : ''}
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;">
            <div style="background:var(--bg2);padding:12px;border-radius:8px;border:1px solid var(--border);">
              <div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;">FULL ACCOUNT NUMBER</div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
                <div style="font-size:18px;font-weight:800;color:var(--text1);font-family:monospace;letter-spacing:1px;">${esc(acc.account_number)}</div>
                <button type="button" class="btn btn-sm btn-secondary copy-btn" data-val="${esc(acc.account_number)}" style="font-size:11px;padding:3px 8px;">📋 Copy</button>
              </div>
            </div>

            <div style="background:var(--bg2);padding:12px;border-radius:8px;border:1px solid var(--border);">
              <div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;">IFSC CODE</div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
                <div style="font-size:16px;font-weight:800;color:var(--text1);font-family:monospace;letter-spacing:1px;">${esc(acc.ifsc_code)}</div>
                <button type="button" class="btn btn-sm btn-secondary copy-btn" data-val="${esc(acc.ifsc_code)}" style="font-size:11px;padding:3px 8px;">📋 Copy</button>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div style="background:var(--bg2);padding:10px;border-radius:8px;border:1px solid var(--border);">
                <div style="font-size:11px;color:var(--text3);font-weight:600;">BRANCH NAME</div>
                <div style="font-size:13px;font-weight:700;color:var(--text1);margin-top:2px;">${esc(acc.branch_name || 'N/A')}</div>
              </div>
              <div style="background:var(--bg2);padding:10px;border-radius:8px;border:1px solid var(--border);">
                <div style="font-size:11px;color:var(--text3);font-weight:600;">BRANCH ADDRESS</div>
                <div style="font-size:12px;color:var(--text2);margin-top:2px;">${esc(acc.branch_address || 'N/A')}</div>
              </div>
            </div>

            ${acc.upi_id ? `
              <div style="background:var(--bg2);padding:12px;border-radius:8px;border:1px solid var(--border);">
                <div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;">UPI ID / VPA</div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
                  <div style="font-size:14px;font-weight:700;color:var(--primary);">${esc(acc.upi_id)}</div>
                  <button type="button" class="btn btn-sm btn-secondary copy-btn" data-val="${esc(acc.upi_id)}" style="font-size:11px;padding:3px 8px;">📋 Copy</button>
                </div>
              </div>
            ` : ''}

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px;">
              <div style="background:#f8fafc;padding:12px;border-radius:8px;border:1px solid var(--border);">
                <div style="font-size:11px;color:var(--text3);">OPENING BALANCE</div>
                <div style="font-size:15px;font-weight:700;color:var(--text1);margin-top:2px;">${formatCurrency(parseFloat(acc.opening_balance || 0))}</div>
              </div>
              <div style="background:#f0fdf4;padding:12px;border-radius:8px;border:1px solid #bbf7d0;">
                <div style="font-size:11px;color:#16a34a;font-weight:700;">CURRENT LIVE BALANCE</div>
                <div style="font-size:18px;font-weight:800;color:#16a34a;margin-top:2px;">${formatCurrency(parseFloat(acc.current_balance || 0))}</div>
              </div>
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;margin-top:10px;">
            <button type="button" class="btn btn-secondary" id="dismissBankDetailsBtn">Close</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    const close = () => {
      modal.remove();
      document.body.style.overflow = "";
    };
    modal.querySelector("#closeBankDetailsBtn").addEventListener("click", close);
    modal.querySelector("#dismissBankDetailsBtn").addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

    modal.querySelectorAll(".copy-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        navigator.clipboard.writeText(btn.dataset.val);
        showToast("Copied to clipboard!", "success");
      });
    });
  }

  // Modal: Bank Statement Upload & History
  function openBankStatementModal(acc) {
    let modal = document.getElementById("bankStatementModal");
    if (modal) modal.remove();

    modal = document.createElement("div");
    modal.id = "bankStatementModal";
    modal.className = "modal-overlay";
    modal.style.position = "fixed";
    modal.style.inset = "0";
    modal.style.background = "rgba(15, 23, 42, 0.75)";
    modal.style.backdropFilter = "blur(8px)";
    modal.style.webkitBackdropFilter = "blur(8px)";
    modal.style.zIndex = "999999";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.padding = "16px";
    modal.style.boxSizing = "border-box";

    modal.innerHTML = `
      <div class="modal-box" style="max-width:680px;width:100%;max-height:92vh;display:flex;flex-direction:column;background:var(--bg-secondary, #ffffff);border:1px solid var(--border, #cbd5e1);border-radius:14px;box-shadow:0 25px 60px rgba(0,0,0,0.4);overflow:hidden;position:relative;margin:auto;">
        <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border, #cbd5e1);background:var(--bg1, #f8fafc);flex-shrink:0;">
          <h4 style="margin:0;font-size:16px;font-weight:700;color:var(--text1);">
            📄 Bank Statements — ${esc(acc.bank_name)} (${esc(acc.account_number.slice(-4))})
          </h4>
          <span class="close-modal" id="closeBankStmtBtn" style="cursor:pointer;font-size:22px;font-weight:bold;line-height:1;">&times;</span>
        </div>

        <div style="padding:20px;overflow-y:auto;flex:1;min-height:0;display:flex;flex-direction:column;gap:18px;">
          <!-- Upload Box -->
          <div style="border:1px solid var(--border);border-radius:10px;padding:16px;background:var(--bg1);">
            <div style="font-size:13px;font-weight:700;color:var(--text1);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
              📤 Upload New Bank Statement Document
            </div>

            <form id="stmtUploadForm">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                <div class="form-group" style="margin:0;">
                  <label style="display:block;font-size:11px;font-weight:600;margin-bottom:3px;color:var(--text2);">Statement Period From</label>
                  <input type="date" class="form-control" id="stmtFromDate" style="font-size:12px;">
                </div>
                <div class="form-group" style="margin:0;">
                  <label style="display:block;font-size:11px;font-weight:600;margin-bottom:3px;color:var(--text2);">Statement Period To</label>
                  <input type="date" class="form-control" id="stmtToDate" style="font-size:12px;">
                </div>
              </div>

              <div class="form-group" style="margin-bottom:10px;">
                <label style="display:block;font-size:11px;font-weight:600;margin-bottom:3px;color:var(--text2);">Select Statement File (PDF, Excel, CSV, Image) *</label>
                <input type="file" class="form-control" id="stmtFileInput" accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg" required style="font-size:12px;">
              </div>

              <div class="form-group" style="margin-bottom:12px;">
                <label style="display:block;font-size:11px;font-weight:600;margin-bottom:3px;color:var(--text2);">Remarks / Notes (Optional)</label>
                <input type="text" class="form-control" id="stmtNotesInput" placeholder="e.g. Q3 October 2026 Bank Reconciliation Statement" style="font-size:12px;">
              </div>

              <div style="display:flex;justify-content:flex-end;">
                <button type="submit" class="btn btn-primary btn-sm" id="uploadStmtSubmitBtn">
                  📤 Upload Statement
                </button>
              </div>
            </form>
          </div>

          <!-- History Table -->
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text1);margin-bottom:8px;">📋 Uploaded Statements History</div>
            <div class="table-container" style="max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;">
              <table class="data-table" style="font-size:12px;">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>File Name</th>
                    <th>Uploaded Date</th>
                    <th>Uploaded By</th>
                    <th style="text-align:center;">Action</th>
                  </tr>
                </thead>
                <tbody id="bankStmtsTableBody">
                  <tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3);"><div class="spinner"></div> Loading statements...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    const close = () => {
      modal.remove();
      document.body.style.overflow = "";
    };
    modal.querySelector("#closeBankStmtBtn").addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

    async function loadStatements() {
      const tbody = modal.querySelector("#bankStmtsTableBody");
      try {
        const res = await fetch(`${API_BASE}/accountant?action=bank-statements-list&bank_account_id=${acc.id}`, { headers: authHeaders() });
        const data = await res.json();
        if (data.success && data.statements) {
          if (data.statements.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3);">No uploaded bank statements found.</td></tr>`;
            return;
          }

          tbody.innerHTML = data.statements.map(s => {
            const periodStr = (s.statement_period_from || s.statement_period_to)
              ? `${s.statement_period_from ? s.statement_period_from.split('T')[0] : 'Start'} to ${s.statement_period_to ? s.statement_period_to.split('T')[0] : 'End'}`
              : '—';
            const dateStr = s.uploaded_at ? s.uploaded_at.split('T')[0] : '—';

            return `
              <tr>
                <td><strong style="color:var(--text1);">${periodStr}</strong></td>
                <td>
                  <div style="font-weight:600;">${esc(s.file_name)}</div>
                  ${s.notes ? `<div style="font-size:10px;color:var(--text3);">${esc(s.notes)}</div>` : ''}
                </td>
                <td>${dateStr}</td>
                <td>${esc(s.uploaded_by_name || 'System')}</td>
                <td style="text-align:center;white-space:nowrap;">
                  <a href="${s.file_url}" target="_blank" download="${esc(s.file_name)}" class="btn btn-xs btn-secondary" style="padding:2px 6px;margin-right:4px;" title="View or Download File">👁️ View</a>
                  <button type="button" class="btn btn-xs btn-danger delete-stmt-btn" data-id="${s.id}" style="padding:2px 6px;" title="Delete Statement">🗑️</button>
                </td>
              </tr>
            `;
          }).join("");

          tbody.querySelectorAll(".delete-stmt-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
              if (!confirm("Delete this statement record?")) return;
              try {
                const r = await fetch(`${API_BASE}/accountant?action=bank-statement-delete&id=${btn.dataset.id}`, {
                  method: "POST",
                  headers: authHeaders()
                });
                const d = await r.json();
                if (d.success) {
                  showToast(d.message, "success");
                  loadStatements();
                } else showToast(d.error || "Delete failed", "error");
              } catch (e) { showToast(e.message, "error"); }
            });
          });
        }
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--danger);">Error loading statements: ${esc(err.message)}</td></tr>`;
      }
    }

    loadStatements();

    modal.querySelector("#stmtUploadForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fileInput = modal.querySelector("#stmtFileInput");
      if (!fileInput.files || fileInput.files.length === 0) {
        showToast("Please choose a statement file to upload", "warning");
        return;
      }

      const submitBtn = modal.querySelector("#uploadStmtSubmitBtn");
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Uploading...`;

      const file = fileInput.files[0];
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const fileUrl = evt.target.result;
        const payload = {
          bank_account_id: acc.id,
          statement_period_from: modal.querySelector("#stmtFromDate").value || null,
          statement_period_to: modal.querySelector("#stmtToDate").value || null,
          file_name: file.name,
          file_url: fileUrl,
          notes: modal.querySelector("#stmtNotesInput").value.trim() || null
        };

        try {
          const res = await fetch(`${API_BASE}/accountant?action=bank-statement-upload`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify(payload)
          });
          const d = await res.json();
          if (d.success) {
            showToast(d.message, "success");
            modal.querySelector("#stmtUploadForm").reset();
            loadStatements();
          } else showToast(d.error || "Upload failed", "error");
        } catch (err) {
          showToast("Upload error: " + err.message, "error");
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `📤 Upload Statement`;
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // Modal open/close helpers
  function openBankModal(acc = null) {
    const modal = document.getElementById("bankAccModal");
    const form = document.getElementById("bankAccForm");
    form.reset();
    document.getElementById("bEditingId").value = acc ? acc.id : "";
    document.getElementById("bankAccModalTitle").textContent = acc ? "✏️ Edit Bank Account" : "➕ Add New Bank Account";

    if (acc) {
      if (document.getElementById("bCompanyId")) document.getElementById("bCompanyId").value = acc.company_id || 1;
      document.getElementById("bBankName").value = acc.bank_name || '';
      document.getElementById("bAccountName").value = acc.account_name || '';
      document.getElementById("bAccountNumber").value = acc.account_number || '';
      document.getElementById("bIfscCode").value = acc.ifsc_code || '';
      document.getElementById("bBranchName").value = acc.branch_name || '';
      document.getElementById("bBranchAddress").value = acc.branch_address || '';
      document.getElementById("bAccountType").value = acc.account_type || 'Current';
      document.getElementById("bOpeningBalance").value = acc.opening_balance || '0.00';
      document.getElementById("bCurrentBalance").value = acc.current_balance || '0.00';
      document.getElementById("bUpiId").value = acc.upi_id || '';
      document.getElementById("bIsPrimary").checked = !!acc.is_primary;
    } else {
      if (document.getElementById("bCompanyId")) {
        document.getElementById("bCompanyId").value = compId !== "all" ? compId : (currentCompanies[0]?.id || 1);
      }
    }
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  function closeBankModal() {
    const modal = document.getElementById("bankAccModal");
    if (modal) modal.style.display = "none";
    document.body.style.overflow = "";
  }

  function openAdjustBalModal(id, name, bal) {
    document.getElementById("adjAccId").value = id;
    document.getElementById("adjAccNameText").textContent = name;
    document.getElementById("adjCurrentBalText").textContent = formatCurrency(bal);
    document.getElementById("adjValInput").value = bal;
    document.getElementById("adjReasonInput").value = "";
    const modal = document.getElementById("adjustBalModal");
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  function closeAdjustModal() {
    const modal = document.getElementById("adjustBalModal");
    if (modal) modal.style.display = "none";
    document.body.style.overflow = "";
  }

  on("addBankAccBtn", "click", () => openBankModal(null));
  on("bankAccModalClose", "click", closeBankModal);
  on("bankAccModalCancel", "click", closeBankModal);
  document.getElementById("bankAccModal")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("bankAccModal")) closeBankModal();
  });

  on("adjBalModalClose", "click", closeAdjustModal);
  on("adjBalModalCancel", "click", closeAdjustModal);
  document.getElementById("adjustBalModal")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("adjustBalModal")) closeAdjustModal();
  });

  // Handle Bank Account Form Submit
  on("bankAccForm", "submit", async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById("bankAccSaveBtn") || e.target.querySelector('button[type="submit"]');
    if (submitBtn && submitBtn.disabled) return;
    const origHtml = submitBtn ? submitBtn.innerHTML : "💾 Save Bank Account";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving Bank Account...`;
    }

    const editId = document.getElementById("bEditingId").value;
    const action = editId ? "bank-account-update" : "bank-account-create";

    const payload = {
      id: editId || undefined,
      company_id: document.getElementById("bCompanyId") ? parseInt(document.getElementById("bCompanyId").value) : (compId !== "all" ? parseInt(compId) : 1),
      bank_name: document.getElementById("bBankName").value.trim(),
      account_name: document.getElementById("bAccountName").value.trim(),
      account_number: document.getElementById("bAccountNumber").value.trim(),
      ifsc_code: document.getElementById("bIfscCode").value.trim().toUpperCase(),
      branch_name: document.getElementById("bBranchName").value.trim(),
      branch_address: document.getElementById("bBranchAddress").value.trim(),
      account_type: document.getElementById("bAccountType").value,
      opening_balance: document.getElementById("bOpeningBalance").value,
      current_balance: document.getElementById("bCurrentBalance").value,
      upi_id: document.getElementById("bUpiId").value.trim(),
      is_primary: document.getElementById("bIsPrimary").checked
    };

    try {
      const res = await fetch(`${API_BASE}/accountant?action=${action}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "success");
        closeBankModal();
        fetchBankAccounts();
      } else showToast(data.error, "error");
    } catch (err) {
      showToast("Error saving bank account: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    }
  });

  // Handle Adjust Balance Form Submit
  on("adjustBalForm", "submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn && submitBtn.disabled) return;
    const origHtml = submitBtn ? submitBtn.innerHTML : "⚖️ Save Adjusted Balance";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving Balance...`;
    }

    const accId = document.getElementById("adjAccId").value;
    const mode = document.getElementById("adjMode").value;
    const val = document.getElementById("adjValInput").value;
    const reason = document.getElementById("adjReasonInput").value.trim();

    const payload = {
      id: accId,
      reason: reason
    };

    if (mode === "set") payload.new_balance = val;
    else {
      payload.adjustment_type = mode;
      payload.adjustment_amount = val;
    }

    try {
      const res = await fetch(`${API_BASE}/accountant?action=bank-account-adjust-balance`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "success");
        closeAdjustModal();
        fetchBankAccounts();
      } else showToast(data.error, "error");
    } catch (err) {
      showToast("Error adjusting balance: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    }
  });

  fetchBankAccounts();
}

// ═══════════════════════════════════════════════════
// SubTab: Assets & Liabilities Management
// ═══════════════════════════════════════════════════
async function loadAssetsLiabilitiesSubTab() {
  const subContent = document.getElementById("accSubContent");
  if (!subContent) return;

  // Cleanup open modals if switching views
  const oldModal = document.getElementById("assetLiabilityModal");
  if (oldModal) oldModal.remove();

  const compId = selectedCompanyId || "all";
  const userObj = (typeof getUser === "function" ? getUser() : null) || (typeof currentUser !== "undefined" && currentUser ? currentUser : null) || JSON.parse(localStorage.getItem("erp_user") || "{}");
  const userRole = (userObj?.role || '').toLowerCase();
  const allowedRoles = ['superadmin', 'super_admin', 'storeadmin', 'store_admin', 'accountant', 'admin', 'owner'];
  const canManage = allowedRoles.includes(userRole) || userObj?.username === 'superadmin';

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
      <div>
        <h3 style="font-size:16px;font-weight:600;color:var(--text1);margin:0;">🏛️ Company Assets & Liabilities Register</h3>
        <div style="font-size:12px;color:var(--text3);margin-top:2px;">Track Fixed Assets, Depreciation (%/Yr), Current Assets, Capital Accounts, Loans, & Current Liabilities per company.</div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-secondary" id="printAssetsBtn">🖨️ Print Statement</button>
        ${canManage ? `<button class="btn btn-primary" id="addAssetLiabBtn">+ Record Asset / Liability</button>` : ''}
      </div>
    </div>

    <!-- Summary KPI Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:14px;margin-bottom:20px;" id="assetKpiCards">
      <div class="card" style="padding:16px;border-left:4px solid #16a34a;background:var(--bg2);">
        <div style="font-size:12px;color:var(--text3);font-weight:600;">📈 TOTAL ASSETS (NET BOOK VALUE)</div>
        <div style="font-size:20px;font-weight:700;color:#16a34a;margin-top:4px;" id="kpiTotalAssets">₹0.00</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;" id="kpiAssetsSub">Net Value after Depreciation</div>
      </div>
      <div class="card" style="padding:16px;border-left:4px solid #d97706;background:var(--bg2);">
        <div style="font-size:12px;color:var(--text3);font-weight:600;">📉 ACCUMULATED DEPRECIATION</div>
        <div style="font-size:20px;font-weight:700;color:#d97706;margin-top:4px;" id="kpiAccumDep">₹0.00</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">Total Annual Asset Value Reductions</div>
      </div>
      <div class="card" style="padding:16px;border-left:4px solid #dc2626;background:var(--bg2);">
        <div style="font-size:12px;color:var(--text3);font-weight:600;">💳 TOTAL LIABILITIES & EQUITY</div>
        <div style="font-size:20px;font-weight:700;color:#dc2626;margin-top:4px;" id="kpiTotalLiabilities">₹0.00</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;" id="kpiLiabilitiesSub">Capital + Loans + Duties</div>
      </div>
      <div class="card" style="padding:16px;border-left:4px solid #2563eb;background:var(--bg2);">
        <div style="font-size:12px;color:var(--text3);font-weight:600;">⚖️ NET EQUITY / POSITION</div>
        <div style="font-size:20px;font-weight:700;color:#2563eb;margin-top:4px;" id="kpiNetWorth">₹0.00</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">Assets minus Liabilities</div>
      </div>
    </div>

    <!-- Filters Bar -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
      <div style="display:flex;gap:6px;" id="assetTypeFilters">
        <button class="btn btn-sm btn-primary filter-type-btn" data-type="all">All Entries</button>
        <button class="btn btn-sm btn-secondary filter-type-btn" data-type="asset">🟢 Assets</button>
        <button class="btn btn-sm btn-secondary filter-type-btn" data-type="liability">🔴 Liabilities</button>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <select class="form-control" id="assetCatFilter" style="width:200px;font-size:12px;">
          <option value="all">All Categories</option>
          <optgroup label="Assets">
            <option value="Fixed Assets">Fixed Assets</option>
            <option value="Current Assets">Current Assets</option>
            <option value="Investments">Investments</option>
            <option value="Other Assets">Other Assets</option>
          </optgroup>
          <optgroup label="Liabilities">
            <option value="Capital Account">Capital Account</option>
            <option value="Loans (Liability)">Loans (Liability)</option>
            <option value="Current Liabilities">Current Liabilities</option>
            <option value="Duties & Taxes">Duties & Taxes</option>
            <option value="Suspense A/c">Suspense A/c</option>
            <option value="Other Liabilities">Other Liabilities</option>
          </optgroup>
        </select>
        <input type="text" class="form-control" id="assetSearchInp" placeholder="🔍 Search particulars, ref #..." style="width:200px;font-size:12px;">
      </div>
    </div>

    <!-- Data Table -->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Company</th>
            <th>Particulars / Name</th>
            <th>Category</th>
            <th>As of / Purchase Date</th>
            <th style="text-align:right;">Purchase Cost (₹)</th>
            <th style="text-align:right;">Depreciation (%/Yr)</th>
            <th style="text-align:right;">Net Book Value (₹)</th>
            <th style="min-width:110px;text-align:center;">Actions</th>
          </tr>
        </thead>
        <tbody id="assetsTableBody">
          <tr><td colspan="9" style="text-align:center;padding:24px;"><div class="spinner"></div> Loading Assets & Liabilities...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  let currentItems = [];
  let currentSummary = {};
  let activeTypeFilter = "all";

  if (canManage) {
    document.getElementById("addAssetLiabBtn")?.addEventListener("click", () => {
      openAddAssetLiabilityModal(null, () => fetchAssetsLiabilities());
    });
  }

  document.getElementById("printAssetsBtn")?.addEventListener("click", () => {
    printAssetsLiabilitiesStatement(currentItems, currentSummary);
  });

  const typeBtns = subContent.querySelectorAll(".filter-type-btn");
  typeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      typeBtns.forEach(b => {
        b.classList.remove("btn-primary");
        b.classList.add("btn-secondary");
      });
      btn.classList.remove("btn-secondary");
      btn.classList.add("btn-primary");
      activeTypeFilter = btn.dataset.type;
      renderTable();
    });
  });

  document.getElementById("assetCatFilter")?.addEventListener("change", () => renderTable());
  document.getElementById("assetSearchInp")?.addEventListener("input", () => renderTable());

  async function fetchAssetsLiabilities() {
    try {
      const res = await fetch(`${API_BASE}/accountant?action=assets-liabilities-list&company_id=${compId}`, {
        headers: authHeaders()
      });
      const data = await res.json();
      if (data.success) {
        currentItems = data.items || [];
        currentSummary = data.summary || {};

        document.getElementById("kpiTotalAssets").innerText = formatCurrency(currentSummary.grand_total_assets || 0);
        document.getElementById("kpiAccumDep").innerText = formatCurrency(currentSummary.total_accumulated_depreciation || 0);
        document.getElementById("kpiTotalLiabilities").innerText = formatCurrency(currentSummary.grand_total_liabilities || 0);
        
        const netWorthEl = document.getElementById("kpiNetWorth");
        const netVal = currentSummary.net_worth || 0;
        netWorthEl.innerText = formatCurrency(netVal);
        netWorthEl.style.color = netVal >= 0 ? "#16a34a" : "#dc2626";

        renderTable();
      } else {
        showToast(data.error || "Failed to load assets & liabilities", "error");
      }
    } catch (err) {
      showToast("Error fetching assets & liabilities: " + err.message, "error");
    }
  }

  function renderTable() {
    const tbody = document.getElementById("assetsTableBody");
    if (!tbody) return;

    const catFilter = document.getElementById("assetCatFilter")?.value || "all";
    const q = (document.getElementById("assetSearchInp")?.value || "").toLowerCase().trim();

    const filtered = currentItems.filter(item => {
      if (activeTypeFilter !== "all" && item.type !== activeTypeFilter) return false;
      if (catFilter !== "all" && item.category !== catFilter) return false;
      if (q) {
        const titleMatch = (item.title || "").toLowerCase().includes(q);
        const refMatch = (item.reference_number || "").toLowerCase().includes(q);
        const catMatch = (item.category || "").toLowerCase().includes(q);
        const compMatch = (item.company_name || "").toLowerCase().includes(q);
        if (!titleMatch && !refMatch && !catMatch && !compMatch) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text3);">No asset or liability records found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(item => {
      const isAsset = item.type === 'asset';
      const badgeStyle = isAsset 
        ? `background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;` 
        : `background:#fef2f2;color:#dc2626;border:1px solid #fecaca;`;
      
      const dateStr = item.as_of_date ? item.as_of_date.split('T')[0] : '—';
      const costVal = parseFloat(item.purchase_cost || item.amount || 0);
      const depRate = parseFloat(item.depreciation_rate || 0);
      const accumDep = parseFloat(item.accumulated_depreciation || 0);
      const netVal = parseFloat(item.amount || 0);

      return `
        <tr>
          <td>
            <span style="display:inline-block;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;${badgeStyle}">
              ${isAsset ? '🟢 ASSET' : '🔴 LIABILITY'}
            </span>
          </td>
          <td style="font-weight:600;font-size:12px;">${esc(item.company_name || 'All Companies')}</td>
          <td>
            <div style="font-weight:700;color:var(--text1);font-size:13px;">${esc(item.title)}</div>
            ${item.description ? `<div style="font-size:11px;color:var(--text3);">${esc(item.description)}</div>` : ''}
          </td>
          <td><span class="badge" style="background:var(--bg2);color:var(--text2);font-weight:600;">${esc(item.category)}</span></td>
          <td style="font-size:12px;">${dateStr}</td>
          <td style="text-align:right;font-size:12px;">${formatCurrency(costVal)}</td>
          <td style="text-align:right;font-size:12px;">
            ${isAsset && depRate > 0 ? `
              <div style="font-weight:700;color:#d97706;">${depRate}% / Yr</div>
              <div style="font-size:10px;color:var(--text3);">- ${formatCurrency(accumDep)}</div>
            ` : '<span style="color:var(--text3);">—</span>'}
          </td>
          <td style="text-align:right;font-weight:700;font-size:13px;color:${isAsset ? '#16a34a' : '#dc2626'};">
            ${formatCurrency(netVal)}
          </td>
          <td style="text-align:center;">
            ${canManage ? `
              <button class="btn btn-sm btn-secondary edit-asset-btn" data-id="${item.id}" title="Edit Record">✏️</button>
              <button class="btn btn-sm btn-danger delete-asset-btn" data-id="${item.id}" title="Delete Record">🗑️</button>
            ` : `<span style="font-size:11px;color:var(--text3);">Read-Only</span>`}
          </td>
        </tr>
      `;
    }).join("");

    if (canManage) {
      tbody.querySelectorAll(".edit-asset-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const item = currentItems.find(i => i.id == btn.dataset.id);
          if (item) openAddAssetLiabilityModal(item, () => fetchAssetsLiabilities());
        });
      });

      tbody.querySelectorAll(".delete-asset-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const item = currentItems.find(i => i.id == btn.dataset.id);
          if (!item) return;
          if (!confirm(`Are you sure you want to delete "${item.title}" (${item.type.toUpperCase()})?`)) return;
          try {
            const res = await fetch(`${API_BASE}/accountant?action=delete-asset-liability&id=${item.id}`, {
              method: "POST",
              headers: authHeaders()
            });
            const d = await res.json();
            if (d.success) {
              showToast(d.message, "success");
              fetchAssetsLiabilities();
            } else {
              showToast(d.error || "Delete failed", "error");
            }
          } catch (e) {
            showToast("Delete error: " + e.message, "error");
          }
        });
      });
    }
  }

  fetchAssetsLiabilities();
}

// Modal: Add/Edit Asset or Liability (with Particulars Dropdown + Custom Input & Depreciation Calculator)
function openAddAssetLiabilityModal(item = null, onSuccess = null) {
  let modal = document.getElementById("assetLiabilityModal");
  if (modal) modal.remove();

  const isEdit = !!item;
  const userObj = (typeof getUser === "function" ? getUser() : null) || (typeof currentUser !== "undefined" && currentUser ? currentUser : null) || JSON.parse(localStorage.getItem("erp_user") || "{}");
  const isSuperAdmin = userObj?.role === "superadmin" || userObj?.username === "superadmin";

  const compList = (window.currentCompanies && window.currentCompanies.length > 0) 
    ? window.currentCompanies 
    : (typeof currentCompanies !== 'undefined' ? currentCompanies : []);

  const selectedCompId = item ? item.company_id : (selectedCompanyId && selectedCompanyId !== "all" ? parseInt(selectedCompanyId) : (userObj.company_id || 1));

  modal = document.createElement("div");
  modal.id = "assetLiabilityModal";
  modal.className = "modal-overlay";
  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.background = "rgba(15, 23, 42, 0.75)";
  modal.style.backdropFilter = "blur(4px)";
  modal.style.webkitBackdropFilter = "blur(4px)";
  modal.style.zIndex = "999999";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.padding = "16px";
  modal.style.boxSizing = "border-box";

  const defaultType = item ? item.type : "asset";
  const defaultDate = item && item.as_of_date ? item.as_of_date.split('T')[0] : new Date().toISOString().split('T')[0];

  // Particulars Presets dictionary matching Tally Prime balance sheet structure
  const particularsPresets = {
    "Fixed Assets": [
      "Car",
      "Furniture",
      "House-1",
      "House-2",
      "Motor Cycles",
      "Ramachandrapuram Land",
      "Computers & Printers",
      "Plant & Machinery",
      "Office Equipment",
      "Power Tillers & Implements"
    ],
    "Current Assets": [
      "Closing Stock / Opening Stock",
      "Deposits (Asset)",
      "Loans & Advances (Asset)",
      "Sundry Debtors",
      "Cash-in-Hand",
      "Bank Accounts",
      "Receivable 2017-18",
      "TCS",
      "TDS"
    ],
    "Investments": [
      "Fixed Deposit (FD)",
      "Mutual Funds",
      "Government Bonds",
      "Shares & Securities"
    ],
    "Capital Account": [
      "NBSVV SATYANARAYNA MURTHY CAPITAL'S",
      "NBSVV SATYANARAYNA MURTHY",
      "Owner Equity Capital",
      "Partner Capital Account"
    ],
    "Loans (Liability)": [
      "Bank OD A/c",
      "Secured Loans",
      "Unsecured Loans",
      "Vehicle Loan",
      "Term Loan"
    ],
    "Current Liabilities": [
      "Duties & Taxes",
      "Sundry Creditors",
      "Audit Fee Payable",
      "Provision for Tax",
      "Salaries & Wages Payable",
      "GST Duty Payable"
    ],
    "Duties & Taxes": [
      "Output CGST",
      "Output SGST",
      "Output IGST",
      "TDS Payable",
      "TCS Payable",
      "Audit Fee Payable",
      "Provision for Tax"
    ],
    "Suspense A/c": [
      "Suspense Account",
      "Difference in opening balances"
    ]
  };

  modal.innerHTML = `
    <div class="modal-box" style="max-width:580px;width:100%;max-height:90vh;display:flex;flex-direction:column;background:var(--bg-secondary, #ffffff);border:1px solid var(--border, #cbd5e1);border-radius:14px;box-shadow:0 25px 60px rgba(0,0,0,0.4);overflow:hidden;position:relative;margin:auto;">
      <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border, #cbd5e1);background:var(--bg1, #f8fafc);flex-shrink:0;">
        <h4 style="margin:0;font-size:16px;font-weight:700;color:var(--text1);">
          ${isEdit ? '✏️ Edit Asset / Liability Entry' : '➕ Record Asset or Liability'}
        </h4>
        <span class="close-modal" id="closeAssetModalBtn" style="cursor:pointer;font-size:22px;font-weight:bold;line-height:1;">&times;</span>
      </div>

      <form id="assetLiabilityForm" style="padding:20px;overflow-y:auto;flex:1;min-height:0;display:flex;flex-direction:column;gap:14px;">
        <!-- Type Switcher -->
        <div class="form-group" style="margin-bottom:16px;">
          <label style="display:block;font-weight:600;font-size:13px;margin-bottom:6px;">Entry Type *</label>
          <div style="display:flex;gap:12px;">
            <label style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;border:2px solid #16a34a;border-radius:6px;cursor:pointer;background:#f0fdf4;font-weight:700;color:#16a34a;">
              <input type="radio" name="entry_type" value="asset" ${defaultType === 'asset' ? 'checked' : ''} style="accent-color:#16a34a;">
              🟢 ASSET
            </label>
            <label style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;border:2px solid #dc2626;border-radius:6px;cursor:pointer;background:#fef2f2;font-weight:700;color:#dc2626;">
              <input type="radio" name="entry_type" value="liability" ${defaultType === 'liability' ? 'checked' : ''} style="accent-color:#dc2626;">
              🔴 LIABILITY
            </label>
          </div>
        </div>

        <!-- Company Select -->
        <div class="form-group" style="margin-bottom:14px;">
          <label style="display:block;font-weight:600;font-size:12px;margin-bottom:4px;">Company *</label>
          <select class="form-control" name="company_id" required ${!isSuperAdmin && !isEdit ? 'disabled' : ''}>
            ${compList.map(c => `<option value="${c.id}" ${c.id == selectedCompId ? 'selected' : ''}>${esc(c.name)}</option>`).join("")}
          </select>
        </div>

        <!-- Category Dropdown -->
        <div class="form-group" style="margin-bottom:14px;">
          <label style="display:block;font-weight:600;font-size:12px;margin-bottom:4px;">Category *</label>
          <select class="form-control" name="category" id="modalAssetCategory" required>
          </select>
        </div>

        <!-- Particulars Dropdown + Custom Input -->
        <div class="form-group" style="margin-bottom:14px;">
          <label style="display:block;font-weight:600;font-size:12px;margin-bottom:4px;">Particulars / Title Name *</label>
          <select class="form-control" id="modalParticularsSelect" style="margin-bottom:6px;">
            <!-- Dynamic options -->
          </select>
          <input type="text" class="form-control" name="title" id="modalParticularsTitleInput" value="${esc(item?.title || '')}" placeholder="Type custom particulars name..." required>
        </div>

        <!-- As of / Acquisition Date -->
        <div class="form-group" style="margin-bottom:14px;">
          <label style="display:block;font-weight:600;font-size:12px;margin-bottom:4px;">As of / Acquisition Date *</label>
          <input type="date" class="form-control" name="as_of_date" id="modalAsOfDate" value="${defaultDate}" required>
        </div>

        <!-- DEPRECIATION SECTION (Shown for Assets / Fixed Assets) -->
        <div id="depreciationSection" style="border:1px solid #f59e0b;background:#fffbe6;padding:12px;border-radius:6px;margin-bottom:16px;">
          <div style="font-weight:700;font-size:12px;color:#b45309;margin-bottom:8px;">📉 ASSET DEPRECIATION CALCULATOR</div>
          
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
            <div class="form-group">
              <label style="display:block;font-weight:600;font-size:11px;margin-bottom:3px;color:#92400e;">Purchase / Original Cost (₹)</label>
              <input type="number" step="0.01" min="0" class="form-control" name="purchase_cost" id="modalPurchaseCost" value="${item?.purchase_cost !== undefined ? item.purchase_cost : (item?.amount || '')}" placeholder="0.00" style="font-size:12px;">
            </div>

            <div class="form-group">
              <label style="display:block;font-weight:600;font-size:11px;margin-bottom:3px;color:#92400e;">Depreciation Rate (% / Year)</label>
              <input type="number" step="0.01" min="0" max="100" class="form-control" name="depreciation_rate" id="modalDepRate" value="${item?.depreciation_rate !== undefined ? item.depreciation_rate : 0}" placeholder="e.g. 10%" style="font-size:12px;">
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;background:#fff;padding:8px 12px;border:1px solid #fcd34d;border-radius:4px;font-size:11px;">
            <div>
              <span style="color:var(--text3);">Calculated Accumulated Dep:</span>
              <strong style="color:#d97706;" id="calcAccumDepTxt">₹0.00</strong>
            </div>
            <div>
              <span style="color:var(--text3);">Computed Net Book Value:</span>
              <strong style="color:#16a34a;" id="calcNetValueTxt">₹0.00</strong>
            </div>
          </div>
          <input type="hidden" name="accumulated_depreciation" id="modalAccumDepInput" value="${item?.accumulated_depreciation || 0}">
        </div>

        <!-- Net Book Value / Total Amount -->
        <div class="form-group" style="margin-bottom:14px;">
          <label style="display:block;font-weight:700;font-size:12.5px;margin-bottom:4px;color:var(--text1);">
            Current Amount / Net Book Value (₹) *
          </label>
          <input type="number" step="0.01" class="form-control" name="amount" id="modalAmountInput" value="${item?.amount !== undefined ? item.amount : ''}" placeholder="0.00" style="font-size:14px;font-weight:700;" required>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">This value will be displayed on your Balance Sheet & Financial Statements.</div>
        </div>

        <!-- Reference / Account Number -->
        <div class="form-group" style="margin-bottom:14px;">
          <label style="display:block;font-weight:600;font-size:12px;margin-bottom:4px;">Reference / Account # (Optional)</label>
          <input type="text" class="form-control" name="reference_number" value="${esc(item?.reference_number || '')}" placeholder="e.g. DOC-9988, ACC-1234">
        </div>

        <!-- Description / Notes -->
        <div class="form-group" style="margin-bottom:16px;">
          <label style="display:block;font-weight:600;font-size:12px;margin-bottom:4px;">Description / Notes</label>
          <textarea class="form-control" name="description" rows="2" placeholder="Optional details...">${esc(item?.description || '')}</textarea>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button type="button" class="btn btn-secondary" id="cancelAssetModalBtn">Cancel</button>
          <button type="submit" class="btn btn-primary" id="saveAssetModalBtn">
            ${isEdit ? '💾 Update Record' : '➕ Save Record'}
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector("#assetLiabilityForm");
  const catSelect = modal.querySelector("#modalAssetCategory");
  const partSelect = modal.querySelector("#modalParticularsSelect");
  const partInput = modal.querySelector("#modalParticularsTitleInput");
  const typeRadios = modal.querySelectorAll("input[name='entry_type']");

  const depSection = modal.querySelector("#depreciationSection");
  const costInput = modal.querySelector("#modalPurchaseCost");
  const rateInput = modal.querySelector("#modalDepRate");
  const accumInput = modal.querySelector("#modalAccumDepInput");
  const amountInput = modal.querySelector("#modalAmountInput");
  const dateInput = modal.querySelector("#modalAsOfDate");
  const calcAccumDepTxt = modal.querySelector("#calcAccumDepTxt");
  const calcNetValueTxt = modal.querySelector("#calcNetValueTxt");

  function populateCategories(selectedType, currentCatVal = "") {
    let options = [];
    if (selectedType === "asset") {
      options = [
        "Fixed Assets",
        "Current Assets",
        "Investments",
        "Other Assets"
      ];
    } else {
      options = [
        "Capital Account",
        "Loans (Liability)",
        "Current Liabilities",
        "Duties & Taxes",
        "Suspense A/c",
        "Other Liabilities"
      ];
    }
    catSelect.innerHTML = options.map(o => `<option value="${o}" ${o === currentCatVal ? 'selected' : ''}>${o}</option>`).join("");
    populateParticularsDropdown(catSelect.value, item?.title || "");
    toggleDepreciationSection(selectedType);
  }

  function populateParticularsDropdown(catVal, currentTitle = "") {
    const list = particularsPresets[catVal] || [];
    let optsHtml = list.map(p => `<option value="${esc(p)}" ${p === currentTitle ? 'selected' : ''}>${esc(p)}</option>`).join("");
    optsHtml += `<option value="__custom__" ${(!list.includes(currentTitle) && currentTitle) ? 'selected' : ''}>➕ Add Custom Particulars...</option>`;
    
    partSelect.innerHTML = optsHtml;

    if (currentTitle && !list.includes(currentTitle)) {
      partSelect.value = "__custom__";
      partInput.style.display = "block";
      partInput.value = currentTitle;
    } else if (partSelect.value === "__custom__") {
      partInput.style.display = "block";
      if (!currentTitle) partInput.value = "";
    } else {
      partInput.style.display = "none";
      partInput.value = partSelect.value;
    }
  }

  function toggleDepreciationSection(selectedType) {
    if (selectedType === "asset") {
      depSection.style.display = "block";
    } else {
      depSection.style.display = "none";
      rateInput.value = 0;
      accumInput.value = 0;
    }
  }

  function calculateDepreciation() {
    const cost = parseFloat(costInput.value || 0);
    const rate = parseFloat(rateInput.value || 0);
    const acqDate = dateInput.value ? new Date(dateInput.value) : new Date();
    const today = new Date();

    let years = (today.getTime() - acqDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (isNaN(years) || years < 0) years = 0;
    if (years === 0 && rate > 0) years = 1;

    const annualDep = cost * (rate / 100);
    const accumDep = Math.min(cost, annualDep * (years > 0 ? Math.max(1, Math.floor(years)) : 1));
    const netVal = Math.max(0, cost - accumDep);

    accumInput.value = accumDep.toFixed(2);
    calcAccumDepTxt.innerText = formatCurrency(accumDep);
    calcNetValueTxt.innerText = formatCurrency(netVal);

    if (rate > 0 && cost > 0) {
      amountInput.value = netVal.toFixed(2);
    }
  }

  partSelect.addEventListener("change", () => {
    if (partSelect.value === "__custom__") {
      partInput.style.display = "block";
      partInput.value = "";
      partInput.focus();
    } else {
      partInput.style.display = "none";
      partInput.value = partSelect.value;
    }
  });

  catSelect.addEventListener("change", () => {
    populateParticularsDropdown(catSelect.value, item?.title || "");
  });

  typeRadios.forEach(r => {
    r.addEventListener("change", (e) => {
      populateCategories(e.target.value);
    });
  });

  costInput.addEventListener("input", calculateDepreciation);
  rateInput.addEventListener("input", calculateDepreciation);
  dateInput.addEventListener("change", calculateDepreciation);

  populateCategories(defaultType, item?.category || "");
  if (item) calculateDepreciation();

  const closeModal = () => modal.remove();
  modal.querySelector("#closeAssetModalBtn").addEventListener("click", closeModal);
  modal.querySelector("#cancelAssetModalBtn").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = modal.querySelector("#saveAssetModalBtn");
    
    const finalTitle = partSelect.value === "__custom__" ? partInput.value.trim() : (partInput.value || partSelect.value).trim();
    if (!finalTitle) {
      return showToast("Please specify a particulars / title name", "warning");
    }

    setButtonLoading(submitBtn, true, isEdit ? "Updating..." : "Saving...");

    const formData = new FormData(form);
    const payload = {
      id: isEdit ? item.id : undefined,
      company_id: parseInt(formData.get("company_id")),
      type: formData.get("entry_type"),
      category: formData.get("category"),
      title: finalTitle,
      amount: parseFloat(formData.get("amount") || 0),
      purchase_cost: parseFloat(formData.get("purchase_cost") || formData.get("amount") || 0),
      depreciation_rate: parseFloat(formData.get("depreciation_rate") || 0),
      depreciation_method: 'straight_line',
      accumulated_depreciation: parseFloat(formData.get("accumulated_depreciation") || 0),
      as_of_date: formData.get("as_of_date"),
      reference_number: formData.get("reference_number"),
      description: formData.get("description")
    };

    try {
      const res = await fetch(`${API_BASE}/accountant?action=save-asset-liability`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "success");
        closeModal();
        if (onSuccess) onSuccess();
      } else {
        showToast(data.error || "Failed to save entry", "error");
      }
    } catch (err) {
      showToast("Error saving record: " + err.message, "error");
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

// Print Assets & Liabilities Statement
function printAssetsLiabilitiesStatement(items, summary) {
  const printWin = window.open("", "_blank", "width=900,height=1000");
  if (!printWin) return showToast("Please allow popups to print statement", "warning");

  const compList = (window.currentCompanies && window.currentCompanies.length > 0) ? window.currentCompanies : [];
  const compIdToFind = selectedCompanyId && selectedCompanyId !== "all" ? parseInt(selectedCompanyId) : 1;
  const matchedComp = compList.find(c => c.id == compIdToFind) || compList[0] || {};
  const compName = matchedComp.name || 'Business ERP';

  const assetsList = items.filter(i => i.type === 'asset');
  const liabList = items.filter(i => i.type === 'liability');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Assets & Liabilities Statement - ${esc(compName)}</title>
      <style>
        body { font-family: sans-serif; font-size: 12px; margin: 20px; color: #000; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 16px; }
        .comp-title { font-size: 20px; font-weight: bold; }
        .doc-title { font-size: 16px; font-weight: bold; margin-top: 4px; color: #1e3a8a; }
        .grid-container { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .section-box { border: 1px solid #000; padding: 10px; }
        .section-title { font-size: 14px; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 5px 6px; font-size: 11px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f3f4f6; font-weight: bold; }
        .amount-col { text-align: right; font-weight: bold; }
        .total-row { border-top: 2px solid #000; border-bottom: 2px solid #000; font-weight: bold; font-size: 12px; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom:12px;text-align:right;">
        <button onclick="window.print()" style="background:#16a34a;color:#fff;border:none;padding:8px 16px;border-radius:4px;font-weight:bold;cursor:pointer;">🖨️ Print Statement</button>
      </div>

      <div class="header">
        <div class="comp-title">${esc(compName)}</div>
        <div class="doc-title">COMPANY ASSETS & LIABILITIES STATEMENT</div>
        <div style="font-size:11px;margin-top:2px;">As of Date: ${new Date().toLocaleDateString('en-IN')}</div>
      </div>

      <div class="grid-container">
        <!-- ASSETS SECTION -->
        <div class="section-box">
          <div class="section-title" style="color:#16a34a;">🟢 ASSETS</div>
          <table>
            <thead>
              <tr>
                <th>Particulars</th>
                <th>Category</th>
                <th class="amount-col">Net Value (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${assetsList.map(a => `
                <tr>
                  <td>
                    <b>${esc(a.title)}</b>
                    ${a.depreciation_rate > 0 ? `<div style="font-size:9.5px;color:#666;">(Cost: ${formatCurrency(a.purchase_cost || a.amount)}, Dep: ${a.depreciation_rate}%/Yr)</div>` : ''}
                  </td>
                  <td>${esc(a.category)}</td>
                  <td class="amount-col">${formatCurrency(a.amount || 0)}</td>
                </tr>
              `).join("")}
              ${summary.system_bank_balance > 0 ? `
                <tr style="background:#f0fdf4;">
                  <td><b>Live System Bank Balances</b></td>
                  <td>Current Assets</td>
                  <td class="amount-col">${formatCurrency(summary.system_bank_balance)}</td>
                </tr>
              ` : ''}
              <tr class="total-row">
                <td colspan="2">TOTAL ASSETS</td>
                <td class="amount-col" style="color:#16a34a;">${formatCurrency(summary.grand_total_assets || 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- LIABILITIES SECTION -->
        <div class="section-box">
          <div class="section-title" style="color:#dc2626;">🔴 LIABILITIES & CAPITAL</div>
          <table>
            <thead>
              <tr>
                <th>Particulars</th>
                <th>Category</th>
                <th class="amount-col">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${liabList.map(l => `
                <tr>
                  <td><b>${esc(l.title)}</b></td>
                  <td>${esc(l.category)}</td>
                  <td class="amount-col">${formatCurrency(l.amount || 0)}</td>
                </tr>
              `).join("")}
              ${summary.system_loan_balance > 0 ? `
                <tr style="background:#fef2f2;">
                  <td><b>Active System Loans</b></td>
                  <td>Loans (Liability)</td>
                  <td class="amount-col">${formatCurrency(summary.system_loan_balance)}</td>
                </tr>
              ` : ''}
              <tr class="total-row">
                <td colspan="2">TOTAL LIABILITIES & EQUITY</td>
                <td class="amount-col" style="color:#dc2626;">${formatCurrency(summary.grand_total_liabilities || 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style="margin-top:20px;padding:12px;border:1px solid #2563eb;background:#eff6ff;display:flex;justify-content:space-between;font-weight:bold;font-size:13px;">
        <div>NET EQUITY / ASSET POSITION:</div>
        <div style="color:${(summary.net_worth || 0) >= 0 ? '#16a34a' : '#dc2626'};">${formatCurrency(summary.net_worth || 0)}</div>
      </div>
    </body>
    </html>
  `;

  try { printWin.document.open(); } catch(e){}
  printWin.document.write(html);
  printWin.document.close();
}

