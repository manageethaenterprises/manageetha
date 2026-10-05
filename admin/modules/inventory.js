// ═══════════════════════════════════════════════════
// BUSINESS ERP — inventory.js
// Universal Suppliers, Product Catalog, Low Stock Reorder POs, Purchase Orders, Stock Receipts
// ═══════════════════════════════════════════════════

window.renderInventoryModule = async function (tabKey, container) {
  const isToday = tabKey === 'inv_today_tasks' || tabKey === 'inv_tasks';
  const isSuppliers = tabKey === 'inv_suppliers' || tabKey === 'suppliers';
  const isProd = tabKey === 'inv_inventory' || tabKey === 'inventory' || tabKey === 'products';
  const isReceipt = tabKey === 'inv_stock_receipt' || tabKey === 'stock';
  const isReorder = tabKey === 'inv_purchase_order' || tabKey === 'reorder' || tabKey === 'po';
  const isBranchTransfer = tabKey === 'inv_branch_transfer' || tabKey === 'branch_transfer' || tabKey === 'transfers';
  const isHsn = tabKey === 'inv_hsn' || tabKey === 'hsn_master' || tabKey === 'hsn';
  const isPayables = tabKey === 'inv_payables' || tabKey === 'payables';
  const isReports = tabKey === 'inv_reports' || tabKey === 'reports';

  const isDefaultProd = !isToday && !isSuppliers && !isReceipt && !isReorder && !isBranchTransfer && !isReports && !isHsn && !isPayables;

  container.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;">
      <div class="sub-tabs-bar">
        <button class="sub-tab ${isToday ? 'active' : ''}" data-tabkey="inv_today_tasks">📋 Today Tasks</button>
        <button class="sub-tab ${isSuppliers ? 'active' : ''}" data-tabkey="inv_suppliers">🚚 Suppliers</button>
        <button class="sub-tab ${(isProd || isDefaultProd) ? 'active' : ''}" data-tabkey="inv_inventory">📦 Inventory</button>
        <button class="sub-tab ${isBranchTransfer ? 'active' : ''}" data-tabkey="inv_branch_transfer">🚚 Transport bw branches</button>
        <button class="sub-tab ${isReorder ? 'active' : ''}" data-tabkey="inv_purchase_order">📝 Purchase Order / Reorder</button>
        <button class="sub-tab ${isReceipt ? 'active' : ''}" data-tabkey="inv_stock_receipt">📥 Purchase / Stock Receipt</button>
        <button class="sub-tab ${isPayables ? 'active' : ''}" data-tabkey="inv_payables">💳 Supplier Payables & Interest</button>
        <button class="sub-tab ${isHsn ? 'active' : ''}" data-tabkey="inv_hsn">🏷️ HSN Master / GST Rates</button>
        <button class="sub-tab ${isReports ? 'active' : ''}" data-tabkey="inv_reports">📊 Reports</button>
      </div>

      <div class="sub-content-area" id="invSubContent">
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

  const subArea = document.getElementById("invSubContent");
  if (isToday) {
    if (window.renderTodayTasksModule) await window.renderTodayTasksModule('inv_today_tasks', subArea);
    else loadProductsSubTab();
  }
  else if (isSuppliers) loadSuppliersSubTab();
  else if (isBranchTransfer) loadBranchTransferSubTab();
  else if (isReceipt) loadStockReceiptSubTab();
  else if (isReorder) loadReorderSubTab();
  else if (isPayables) loadPayablesSubTab();
  else if (isHsn) loadHsnMasterSubTab();
  else if (isReports) loadInventoryReportsSubTab();
  else loadProductsSubTab();
};

if (window.registerModuleRoute) {
  window.registerModuleRoute(
    [
      'inventory', 'products', 'reorder', 'po', 'stock', 'suppliers',
      'inv_today_tasks', 'inv_suppliers', 'inv_inventory', 'inv_branch_transfer', 'branch_transfer', 'transfers',
      'inv_stock_receipt', 'inv_purchase_order', 'inv_payables', 'payables', 'inv_hsn', 'hsn_master', 'hsn', 'inv_reports'
    ],
    window.renderInventoryModule
  );
}

// ── Global Helper: Get Active Company ID Scoped by Role ──
function getActiveCompId() {
  const userObj = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
  const userRole = (userObj?.role || '').toLowerCase();
  const isSuperAdmin = (userRole === 'superadmin');

  if (!isSuperAdmin) {
    return userObj?.company_id ? parseInt(userObj.company_id) : 1;
  }
  if (selectedCompanyId && selectedCompanyId !== 'all') {
    return parseInt(selectedCompanyId);
  }
  return 'all';
}

// ── Global Helper: Custom Confirmation Modal ──
function showConfirmModal({ title = "Confirm Action", message, icon = "⚠️", confirmText = "Confirm", confirmClass = "btn-danger", onConfirm }) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px);";

  overlay.innerHTML = `
    <div class="modal-box" style="max-width:440px;width:100%;background:var(--bg-primary, #ffffff);border-radius:12px;padding:24px;border:1px solid var(--border, #e2e8f0);box-shadow:0 20px 25px -5px rgba(0,0,0,0.3), 0 10px 10px -5px rgba(0,0,0,0.1);">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
        <div style="width:42px;height:42px;border-radius:50%;background:rgba(239, 68, 68, 0.12);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">
          ${icon}
        </div>
        <h3 style="font-size:16px;font-weight:700;color:var(--text1, #0f172a);margin:0;">${esc(title)}</h3>
      </div>
      <p style="font-size:13.5px;color:var(--text2, #475569);margin:0 0 20px 0;line-height:1.5;">
        ${esc(message)}
      </p>
      <div style="display:flex;justify-content:flex-end;gap:10px;">
        <button type="button" class="btn btn-secondary cancelConfirmBtn" style="padding:8px 16px;font-size:13px;">Cancel</button>
        <button type="button" class="btn ${confirmClass} okConfirmBtn" style="padding:8px 18px;font-size:13px;font-weight:600;">${esc(confirmText)}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector(".cancelConfirmBtn").addEventListener("click", close);

  overlay.querySelector(".okConfirmBtn").addEventListener("click", async () => {
    const okBtn = overlay.querySelector(".okConfirmBtn");
    if (okBtn && okBtn.disabled) return;
    const origHtml = okBtn ? okBtn.innerHTML : "OK";
    if (okBtn) {
      okBtn.disabled = true;
      okBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Processing...`;
    }
    try {
      if (onConfirm) await onConfirm();
      close();
    } catch (err) {
      if (okBtn) {
        okBtn.disabled = false;
        okBtn.innerHTML = origHtml;
      }
    }
  });
}

// ── Global Helper: Companies Dropdown Options ──
async function getCompaniesOptionsHtml(selectedId = null) {
  let list = window.currentCompanies || [];
  if (!list || list.length === 0) {
    try {
      const res = await fetch(`${API_BASE}/super?action=companies-list`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.companies) {
        list = data.companies;
        window.currentCompanies = list;
      }
    } catch (e) {}
  }
  if (!list || list.length === 0) return `<option value="1">Default Company</option>`;
  const activeId = selectedId || (selectedCompanyId !== 'all' ? selectedCompanyId : list[0]?.id);
  return list.map(c => `<option value="${c.id}" ${c.id == activeId ? 'selected' : ''}>${esc(c.name)}</option>`).join("");
}

async function getCompaniesList() {
  let list = window.currentCompanies || [];
  if (!list || list.length === 0) {
    try {
      const res = await fetch(`${API_BASE}/super?action=companies-list`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.companies && data.companies.length > 0) {
        list = data.companies;
        window.currentCompanies = list;
      }
    } catch (e) {}
  }
  if (!list || list.length === 0) {
    list = [{ id: 1, name: "Main Company Branch" }];
  }
  return list;
}

// ── Global Helper: Add/Edit Supplier Modal ──
// ── Global Helper: Add/Edit Supplier Modal ──
async function openSupplierModal(supplierObj = null, onSuccessCallback = null) {
  const isEdit = !!supplierObj;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(2px);";

  const compOptionsHtml = await getCompaniesOptionsHtml(supplierObj?.company_id);
  const homeState = (typeof currentUser !== 'undefined' && currentUser?.company_state) ? currentUser.company_state : "Andhra Pradesh";
  const supState = supplierObj?.supply_state || homeState;

  let initialContacts = [];
  if (supplierObj?.contacts_json) {
    try {
      initialContacts = typeof supplierObj.contacts_json === 'string' ? JSON.parse(supplierObj.contacts_json) : supplierObj.contacts_json;
    } catch(e){}
  }
  if (!Array.isArray(initialContacts) || initialContacts.length === 0) {
    if (supplierObj?.contact_person || supplierObj?.email || supplierObj?.phone) {
      initialContacts = [{
        name: supplierObj.contact_person || '',
        designation: supplierObj.designation || 'Primary Contact',
        email: supplierObj.email || '',
        phone: supplierObj.phone || ''
      }];
    } else {
      initialContacts = [{ name: '', designation: '', email: '', phone: '' }];
    }
  }

  const opBalDateVal = supplierObj?.opening_balance_date ? (typeof supplierObj.opening_balance_date === 'string' ? supplierObj.opening_balance_date.split('T')[0] : supplierObj.opening_balance_date) : '';

  overlay.innerHTML = `
    <div class="modal-box" style="max-width:820px;width:95%;background:var(--bg-primary);border-radius:14px;border:1px solid var(--border);box-shadow:0 20px 40px rgba(0,0,0,0.25);overflow:hidden;display:flex;flex-direction:column;max-height:90vh;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding:16px 22px;background:var(--bg-secondary,#f1f5f9);">
        <div>
          <h3 style="font-size:16.5px;font-weight:700;color:var(--text1);margin:0;display:flex;align-items:center;gap:8px;">
            ${isEdit ? '✏️ Edit Universal Supplier' : '🚚 Add New Universal Supplier'}
          </h3>
          <div style="font-size:12px;color:var(--text3);margin-top:2px;">Register supplier profile, banking credentials, credit terms & opening balance ledger entry.</div>
        </div>
        <button type="button" class="btn btn-sm btn-outline closeSupModal" style="border-radius:50%;width:30px;height:30px;padding:0;display:flex;align-items:center;justify-content:center;font-size:16px;">&times;</button>
      </div>

      <form id="supplierForm" style="display:flex;flex-direction:column;flex:1;overflow:hidden;margin:0;">
        <div class="modal-body" style="padding:20px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:18px;">
          
          <!-- 🏢 CARD 1: GENERAL & LEGAL DETAILS -->
          <div style="background:var(--bg-card,#f8fafc);border:1px solid var(--border);border-radius:10px;padding:16px 18px;">
            <h4 style="font-size:13.5px;font-weight:700;color:var(--primary);margin:0 0 14px 0;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border);padding-bottom:8px;">
              🏢 General & Legal Details
            </h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 16px;">
              <div class="form-group" style="grid-column: span 2;">
                <label class="form-label" style="font-weight:600;font-size:12px;">Target Company Branch</label>
                <select id="supCompanyId" class="form-select">
                  <option value="">-- All Companies (Universal Supplier) --</option>
                  ${compOptionsHtml}
                </select>
              </div>

              <div class="form-group" style="grid-column: span 2;">
                <label class="form-label" style="font-weight:600;font-size:12px;">Supplier Legal Name *</label>
                <input type="text" id="supLegalName" class="form-input" required value="${esc(supplierObj?.legal_name || '')}" placeholder="e.g. Sonalika Motors Pvt Ltd">
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight:600;font-size:12px;">Trade Name</label>
                <input type="text" id="supTradeName" class="form-input" value="${esc(supplierObj?.trade_name || '')}" placeholder="e.g. Sonalika Agros">
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight:600;font-size:12px;">GSTIN / UIN</label>
                <input type="text" id="supGstin" class="form-input" value="${esc(supplierObj?.gstin || '')}" placeholder="e.g. 37AHMPH1933C1Z7">
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight:600;font-size:12px;">Supply State (Supplier Location) *</label>
                <select id="supSupplyState" class="form-select">
                  ${typeof generateIndianStateOptionsHtml === 'function' ? generateIndianStateOptionsHtml(supState, supState) : `<option value="${esc(supState)}" selected>${esc(supState)}</option>`}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight:600;font-size:12px;">Credit Terms Description</label>
                <input type="text" id="supCredit" class="form-input" value="${esc(supplierObj?.credit_terms || 'Immediate')}" placeholder="e.g. 30 Days Net / Credit Line">
              </div>

              <div class="form-group" style="grid-column: span 2;">
                <label class="form-label" style="font-weight:600;font-size:12px;">Office / Billing Address</label>
                <textarea id="supAddress" class="form-input" rows="2" placeholder="Plot 45, Industrial Estate, Rajahmundry, AP">${esc(supplierObj?.address || '')}</textarea>
              </div>
            </div>
          </div>

          <!-- 🏦 CARD 2: BANK ACCOUNT & FINANCIAL CREDIT TERMS -->
          <div style="background:var(--bg-card,#f8fafc);border:1px solid var(--border);border-radius:10px;padding:16px 18px;">
            <h4 style="font-size:13.5px;font-weight:700;color:var(--primary);margin:0 0 14px 0;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border);padding-bottom:8px;">
              🏦 Supplier Bank Account & Financial Credit Terms
            </h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 16px;">
              <div class="form-group">
                <label class="form-label" style="font-weight:600;font-size:12px;">Bank Name</label>
                <input type="text" id="supBankName" class="form-input" value="${esc(supplierObj?.bank_name || '')}" placeholder="e.g. State Bank of India">
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight:600;font-size:12px;">Account Number</label>
                <input type="text" id="supBankAccountNo" class="form-input" value="${esc(supplierObj?.bank_account_no || '')}" placeholder="e.g. 38492019482">
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight:600;font-size:12px;">IFSC Code</label>
                <input type="text" id="supBankIfsc" class="form-input" value="${esc(supplierObj?.bank_ifsc || '')}" placeholder="e.g. SBIN0001234">
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight:600;font-size:12px;">Branch Name / City</label>
                <input type="text" id="supBankBranch" class="form-input" value="${esc(supplierObj?.bank_branch || '')}" placeholder="e.g. Main Branch, Rajahmundry">
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight:600;font-size:12px;">Credit Limit Allowed (₹)</label>
                <input type="number" step="any" id="supCreditLimit" class="form-input" value="${supplierObj?.credit_limit !== undefined ? supplierObj.credit_limit : 0}" placeholder="0.00">
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight:600;font-size:12px;">Credit Period (Days)</label>
                <input type="number" id="supCreditPeriodDays" class="form-input" value="${supplierObj?.credit_period_days !== undefined ? supplierObj.credit_period_days : 0}" placeholder="e.g. 30">
              </div>

              <div class="form-group" style="grid-column: span 2;">
                <label class="form-label" style="font-weight:600;font-size:12px;">Credit Interest Rate (% p.a.)</label>
                <input type="number" step="any" id="supCreditInterestRate" class="form-input" value="${supplierObj?.credit_interest_rate !== undefined ? supplierObj.credit_interest_rate : 0}" placeholder="0.00">
              </div>
            </div>
          </div>

          <!-- ⚖️ CARD 3: OPENING BALANCE ENTRY & DOCUMENT UPLOAD -->
          <div style="background:var(--bg-card,#f8fafc);border:1px solid var(--border);border-radius:10px;padding:16px 18px;">
            <h4 style="font-size:13.5px;font-weight:700;color:var(--primary);margin:0 0 14px 0;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border);padding-bottom:8px;">
              ⚖️ Opening Balance Entry & Document Upload
            </h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 16px;">
              <div class="form-group">
                <label class="form-label" style="font-weight:600;font-size:12px;">Opening Balance Amount (₹)</label>
                <input type="number" step="any" id="supOpeningBalance" class="form-input" value="${supplierObj?.opening_balance !== undefined ? supplierObj.opening_balance : 0}" placeholder="0.00">
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight:600;font-size:12px;">Balance Type</label>
                <select id="supOpeningBalanceType" class="form-select">
                  <option value="payable" ${(!supplierObj?.opening_balance_type || supplierObj?.opening_balance_type === 'payable') ? 'selected' : ''}>To Pay / Payable (Company owes Supplier)</option>
                  <option value="advance" ${supplierObj?.opening_balance_type === 'advance' ? 'selected' : ''}>Advance Paid (Supplier owes Company)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight:600;font-size:12px;">Opening Balance Date</label>
                <input type="date" id="supOpeningBalanceDate" class="form-input" value="${esc(opBalDateVal)}">
              </div>

              <div class="form-group" style="grid-column: span 2;">
                <label class="form-label" style="font-weight:600;font-size:12px;">Opening Balance Notes / Ledger Reference</label>
                <textarea id="supOpeningBalanceNotes" class="form-input" rows="2" placeholder="e.g. Closing ledger balance verified per statement dated March 31st">${esc(supplierObj?.opening_balance_notes || '')}</textarea>
              </div>

              <div class="form-group" style="grid-column: span 2;">
                <label class="form-label" style="font-weight:600;font-size:12px;">Attach Opening Balance Document / Statement (PDF / Image)</label>
                <input type="file" id="supOpeningBalanceDocFile" class="form-input" accept=".pdf,image/*,.doc,.docx">
                <input type="hidden" id="supOpeningBalanceDocBase64" value="${esc(supplierObj?.opening_balance_doc || '')}">
                <div id="supOpeningBalanceDocPreview"></div>
              </div>
            </div>
          </div>

          <!-- 👤 CARD 4: CONTACT PERSONS & EMAIL DIRECTORY -->
          <div style="background:var(--bg-card,#f8fafc);border:1px solid var(--border);border-radius:10px;padding:16px 18px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:8px;">
              <h4 style="font-size:13.5px;font-weight:700;color:var(--text1);margin:0;display:flex;align-items:center;gap:8px;">
                👤 Contact Persons & Multiple Email Directory
              </h4>
              <button type="button" class="btn btn-xs btn-outline" id="addContactRowBtn">+ Add Contact Person</button>
            </div>

            <div id="supContactsList" style="display:flex;flex-direction:column;gap:8px;"></div>
          </div>

        </div>

        <div style="padding:14px 22px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:12px;background:var(--bg-secondary,#f8fafc);">
          <button type="button" class="btn btn-secondary closeSupModal">Cancel</button>
          <button type="submit" class="btn btn-primary" style="padding:8px 22px;font-weight:700;">💾 ${isEdit ? 'Update Supplier' : 'Save Supplier'}</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelectorAll(".closeSupModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

  // Setup Document Attachment Preview & File Reader
  const docFileInput = overlay.querySelector("#supOpeningBalanceDocFile");
  const docBase64Input = overlay.querySelector("#supOpeningBalanceDocBase64");
  const docPreviewContainer = overlay.querySelector("#supOpeningBalanceDocPreview");

  if (supplierObj?.opening_balance_doc && docPreviewContainer) {
    docPreviewContainer.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <span class="badge badge-purple">📄 Opening Balance Attachment Available</span>
        <button type="button" class="btn btn-xs btn-outline" id="viewExistingDocBtn">👁️ View Attachment</button>
        <button type="button" class="btn btn-xs btn-danger" id="clearExistingDocBtn">🗑️ Clear Attachment</button>
      </div>
    `;
    docPreviewContainer.querySelector("#viewExistingDocBtn")?.addEventListener("click", () => {
      const w = window.open();
      w.document.write(`<iframe src="${supplierObj.opening_balance_doc}" style="width:100%;height:100%;border:none;"></iframe>`);
    });
    docPreviewContainer.querySelector("#clearExistingDocBtn")?.addEventListener("click", () => {
      docBase64Input.value = "";
      if (docFileInput) docFileInput.value = "";
      docPreviewContainer.innerHTML = "";
    });
  }

  if (docFileInput) {
    docFileInput.addEventListener("change", function(e) {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        alert("File size exceeds 10MB limit. Please select a smaller document.");
        docFileInput.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = function(evt) {
        docBase64Input.value = evt.target.result;
        if (docPreviewContainer) {
          docPreviewContainer.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
              <span class="badge badge-success">📄 ${esc(file.name)} (${(file.size / 1024).toFixed(1)} KB) Attached</span>
              <button type="button" class="btn btn-xs btn-outline" id="viewNewDocBtn">👁️ View</button>
              <button type="button" class="btn btn-xs btn-danger" id="clearNewDocBtn">🗑️ Clear</button>
            </div>
          `;
          docPreviewContainer.querySelector("#viewNewDocBtn")?.addEventListener("click", () => {
            const w = window.open();
            w.document.write(`<iframe src="${evt.target.result}" style="width:100%;height:100%;border:none;"></iframe>`);
          });
          docPreviewContainer.querySelector("#clearNewDocBtn")?.addEventListener("click", () => {
            docBase64Input.value = "";
            docFileInput.value = "";
            docPreviewContainer.innerHTML = "";
          });
        }
      };
      reader.readAsDataURL(file);
    });
  }

  const contactsListContainer = overlay.querySelector("#supContactsList");

  function renderContactRow(c = { name: '', designation: '', email: '', phone: '' }) {
    const rowDiv = document.createElement("div");
    rowDiv.style.cssText = "display:grid;grid-template-columns:1fr 1fr 1.2fr 1fr 30px;gap:8px;align-items:center;background:var(--bg-card,#f8fafc);padding:8px 10px;border-radius:6px;border:1px solid var(--border);";
    rowDiv.innerHTML = `
      <input type="text" class="form-input c-name" placeholder="Name" value="${esc(c.name || '')}" style="padding:4px 8px;font-size:12px;">
      <input type="text" class="form-input c-desig" placeholder="Designation" value="${esc(c.designation || '')}" style="padding:4px 8px;font-size:12px;">
      <input type="email" class="form-input c-email" placeholder="Email Address" value="${esc(c.email || '')}" style="padding:4px 8px;font-size:12px;">
      <input type="text" class="form-input c-phone" placeholder="Phone Number" value="${esc(c.phone || '')}" style="padding:4px 8px;font-size:12px;">
      <button type="button" class="btn btn-xs btn-danger removeContactRowBtn" style="padding:2px 6px;">&times;</button>
    `;
    rowDiv.querySelector(".removeContactRowBtn").addEventListener("click", () => {
      if (contactsListContainer.children.length <= 1) return alert("At least 1 contact person row is required.");
      rowDiv.remove();
    });
    contactsListContainer.appendChild(rowDiv);
  }

  initialContacts.forEach(c => renderContactRow(c));

  overlay.querySelector("#addContactRowBtn").addEventListener("click", () => renderContactRow());

  overlay.querySelector("#supplierForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn && submitBtn.disabled) return;
    const origHtml = submitBtn ? submitBtn.innerHTML : "Save Supplier";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving...`;
    }

    const contactRows = [];
    contactsListContainer.querySelectorAll("div").forEach(div => {
      const name = div.querySelector(".c-name")?.value.trim() || "";
      const desig = div.querySelector(".c-desig")?.value.trim() || "";
      const email = div.querySelector(".c-email")?.value.trim() || "";
      const phone = div.querySelector(".c-phone")?.value.trim() || "";
      if (name || email || phone || desig) {
        contactRows.push({ name, designation: desig, email, phone });
      }
    });

    const primaryContact = contactRows[0] || {};

    const payload = {
      id: supplierObj?.id,
      company_id: overlay.querySelector("#supCompanyId").value || null,
      legal_name: overlay.querySelector("#supLegalName").value.trim(),
      trade_name: overlay.querySelector("#supTradeName").value.trim() || null,
      gstin: overlay.querySelector("#supGstin").value.trim() || null,
      supply_state: overlay.querySelector("#supSupplyState").value || "Andhra Pradesh",
      address: overlay.querySelector("#supAddress").value.trim() || null,
      contact_person: primaryContact.name || null,
      designation: primaryContact.designation || null,
      email: primaryContact.email || null,
      phone: primaryContact.phone || null,
      credit_terms: overlay.querySelector("#supCredit").value.trim() || "Immediate",
      contacts_json: contactRows,

      // Bank & Finance details
      bank_name: overlay.querySelector("#supBankName")?.value.trim() || null,
      bank_account_no: overlay.querySelector("#supBankAccountNo")?.value.trim() || null,
      bank_ifsc: overlay.querySelector("#supBankIfsc")?.value.trim() || null,
      bank_branch: overlay.querySelector("#supBankBranch")?.value.trim() || null,
      credit_limit: parseFloat(overlay.querySelector("#supCreditLimit")?.value) || 0,
      credit_period_days: parseInt(overlay.querySelector("#supCreditPeriodDays")?.value, 10) || 0,
      credit_interest_rate: parseFloat(overlay.querySelector("#supCreditInterestRate")?.value) || 0,

      // Opening balance details
      opening_balance: parseFloat(overlay.querySelector("#supOpeningBalance")?.value) || 0,
      opening_balance_type: overlay.querySelector("#supOpeningBalanceType")?.value || 'payable',
      opening_balance_date: overlay.querySelector("#supOpeningBalanceDate")?.value || null,
      opening_balance_notes: overlay.querySelector("#supOpeningBalanceNotes")?.value.trim() || null,
      opening_balance_doc: overlay.querySelector("#supOpeningBalanceDocBase64")?.value || null
    };

    const actionName = isEdit ? "supplier-update" : "supplier-create";

    try {
      const res = await fetch(`${API_BASE}/inventory?action=${actionName}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Supplier saved successfully!", "success");
        overlay.remove();
        if (onSuccessCallback) onSuccessCallback(data.supplier);
      } else showToast(data.error || "Failed to save supplier", "error");
    } catch (err) {
      showToast("Error saving supplier: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    }
  });
}

function openSupplierViewModal(supplierObj) {
  if (!supplierObj) return;

  let contacts = [];
  if (supplierObj.contacts_json) {
    try { contacts = typeof supplierObj.contacts_json === 'string' ? JSON.parse(supplierObj.contacts_json) : supplierObj.contacts_json; } catch(e){}
  }
  if (!Array.isArray(contacts) || contacts.length === 0) {
    contacts = [{
      name: supplierObj.contact_person || 'N/A',
      designation: supplierObj.designation || 'Primary Contact',
      email: supplierObj.email || 'N/A',
      phone: supplierObj.phone || 'N/A'
    }];
  }

  const contactsRowsHtml = contacts.map((c, idx) => `
    <tr>
      <td style="text-align:center;">${idx + 1}</td>
      <td style="font-weight:700;color:var(--text1);">${esc(c.name || '—')}</td>
      <td>${esc(c.designation || '—')}</td>
      <td style="color:var(--primary);font-weight:600;"><a href="mailto:${esc(c.email)}" style="color:inherit;">${esc(c.email || '—')}</a></td>
      <td style="font-weight:600;"><a href="tel:${esc(c.phone)}" style="color:inherit;">${esc(c.phone || '—')}</a></td>
    </tr>
  `).join("");

  const opBalDateStr = supplierObj.opening_balance_date ? (typeof supplierObj.opening_balance_date === 'string' ? supplierObj.opening_balance_date.split('T')[0] : supplierObj.opening_balance_date) : '—';
  const opBalTypeBadge = supplierObj.opening_balance_type === 'advance' ? '<span class="badge badge-success">Advance Paid</span>' : '<span class="badge badge-warning">Payable / Due</span>';

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px);";

  overlay.innerHTML = `
    <div class="modal-box" style="max-width:780px;width:95%;background:var(--bg-primary);border-radius:12px;padding:24px;border:1px solid var(--border);max-height:92vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:16px;">
        <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">🏢 Supplier Profile — ${esc(supplierObj.legal_name)}</h3>
        <button class="btn btn-sm btn-outline closeSupViewModal">&times;</button>
      </div>

      <!-- BASIC DETAILS -->
      <h4 style="font-size:13.5px;font-weight:700;color:var(--primary);margin:0 0 8px 0;">🏢 General & Location Info</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:var(--bg-card,#f8fafc);padding:14px;border-radius:8px;border:1px solid var(--border);margin-bottom:16px;font-size:13px;line-height:1.6;">
        <div><strong>Legal Name:</strong> ${esc(supplierObj.legal_name)}</div>
        <div><strong>Trade Name:</strong> ${esc(supplierObj.trade_name || '—')}</div>
        <div><strong>Company Branch:</strong> ${esc(supplierObj.company_name || 'Universal (All Companies)')}</div>
        <div><strong>GSTIN / UIN:</strong> <span class="badge badge-purple">${esc(supplierObj.gstin || 'N/A')}</span></div>
        <div><strong>Supply State (Location):</strong> <span class="badge badge-outline" style="font-weight:700;">${esc(supplierObj.supply_state || 'Andhra Pradesh')}</span></div>
        <div><strong>Credit Terms:</strong> ${esc(supplierObj.credit_terms || 'Immediate')}</div>
        <div style="grid-column:span 2;"><strong>Office Address:</strong> ${esc(supplierObj.address || '—')}</div>
      </div>

      <!-- BANK ACCOUNT & FINANCE DETAILS -->
      <h4 style="font-size:13.5px;font-weight:700;color:var(--primary);margin:0 0 8px 0;">🏦 Supplier Bank Account & Financial Credit Details</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:var(--bg-card,#f8fafc);padding:14px;border-radius:8px;border:1px solid var(--border);margin-bottom:16px;font-size:13px;line-height:1.6;">
        <div><strong>Bank Name:</strong> ${esc(supplierObj.bank_name || '—')}</div>
        <div><strong>Account Number:</strong> <span style="font-family:monospace;font-weight:700;">${esc(supplierObj.bank_account_no || '—')}</span></div>
        <div><strong>IFSC Code:</strong> <span class="badge badge-neutral" style="font-family:monospace;font-weight:700;">${esc(supplierObj.bank_ifsc || '—')}</span></div>
        <div><strong>Branch Name:</strong> ${esc(supplierObj.bank_branch || '—')}</div>
        <div><strong>Credit Limit Allowed:</strong> <span style="font-weight:700;color:var(--success);">${formatCurrency(supplierObj.credit_limit || 0)}</span></div>
        <div><strong>Credit Period:</strong> <span style="font-weight:700;">${supplierObj.credit_period_days || 0} Days</span></div>
        <div style="grid-column:span 2;"><strong>Credit Interest Rate:</strong> <span style="font-weight:700;">${supplierObj.credit_interest_rate || 0}% p.a.</span></div>
      </div>

      <!-- OPENING BALANCE DETAILS -->
      <h4 style="font-size:13.5px;font-weight:700;color:var(--primary);margin:0 0 8px 0;">⚖️ Opening Balance Entry & Document</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:var(--bg-card,#f8fafc);padding:14px;border-radius:8px;border:1px solid var(--border);margin-bottom:16px;font-size:13px;line-height:1.6;">
        <div><strong>Opening Balance Amount:</strong> <span style="font-weight:700;font-size:14px;">${formatCurrency(supplierObj.opening_balance || 0)}</span> ${opBalTypeBadge}</div>
        <div><strong>Balance Date:</strong> ${opBalDateStr}</div>
        <div style="grid-column:span 2;"><strong>Notes / Reference:</strong> ${esc(supplierObj.opening_balance_notes || '—')}</div>
        <div style="grid-column:span 2;">
          <strong>Opening Balance Document:</strong>
          ${supplierObj.opening_balance_doc ? `
            <button type="button" class="btn btn-xs btn-outline" id="viewSupOpeningDocBtn" style="margin-left:8px;">📄 View Attached Document</button>
          ` : '<span style="color:var(--text3);margin-left:8px;">No document attached</span>'}
        </div>
      </div>

      <h4 style="font-size:14px;font-weight:700;color:var(--text1);margin-bottom:8px;">👥 Contact Persons & Email Directory</h4>
      <div class="table-container" style="max-height:220px;overflow-y:auto;margin-bottom:20px;">
        <table class="data-table" style="width:100%;font-size:12px;">
          <thead>
            <tr>
              <th style="width:30px;text-align:center;">#</th>
              <th>Contact Name</th>
              <th>Designation</th>
              <th>Email Address</th>
              <th>Phone Number</th>
            </tr>
          </thead>
          <tbody>
            ${contactsRowsHtml}
          </tbody>
        </table>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;">
        <button type="button" class="btn btn-primary" id="printSupProfileBtn">🖨️ Print Supplier Profile</button>
        <button type="button" class="btn btn-secondary closeSupViewModal">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelectorAll(".closeSupViewModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

  if (supplierObj.opening_balance_doc) {
    overlay.querySelector("#viewSupOpeningDocBtn")?.addEventListener("click", () => {
      const w = window.open();
      w.document.write(`<iframe src="${supplierObj.opening_balance_doc}" style="width:100%;height:100%;border:none;"></iframe>`);
    });
  }

  overlay.querySelector("#printSupProfileBtn").addEventListener("click", () => {
    printSupplierProfile(supplierObj);
  });
}

function printSupplierProfile(s) {
  const printWin = window.open("", "_blank", "width=850,height=950");
  if (!printWin) return alert("Please allow popups to print Supplier Profile.");

  let contacts = [];
  if (s.contacts_json) {
    try { contacts = typeof s.contacts_json === 'string' ? JSON.parse(s.contacts_json) : s.contacts_json; } catch(e){}
  }
  if (!Array.isArray(contacts) || contacts.length === 0) {
    contacts = [{
      name: s.contact_person || 'N/A',
      designation: s.designation || 'Primary Contact',
      email: s.email || 'N/A',
      phone: s.phone || 'N/A'
    }];
  }

  const contactsRowsHtml = contacts.map((c, idx) => `
    <tr>
      <td style="text-align:center;">${idx + 1}</td>
      <td style="font-weight:bold;">${esc(c.name || '—')}</td>
      <td>${esc(c.designation || '—')}</td>
      <td>${esc(c.email || '—')}</td>
      <td>${esc(c.phone || '—')}</td>
    </tr>
  `).join("");

  const opBalDateStr = s.opening_balance_date ? (typeof s.opening_balance_date === 'string' ? s.opening_balance_date.split('T')[0] : s.opening_balance_date) : '—';
  const opBalTypeStr = s.opening_balance_type === 'advance' ? 'Advance Paid' : 'Payable / Due';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Supplier Profile - ${esc(s.legal_name)}</title>
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body { font-family: 'Arial', sans-serif; font-size: 13px; color: #000; padding: 20px; }
        .card { border: 2px solid #334155; border-radius: 8px; padding: 20px; }
        .header { border-bottom: 2px solid #334155; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
        .title { font-size: 20px; font-weight: 900; color: #1e293b; text-transform: uppercase; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; font-size: 13px; }
        .sec-title { font-size: 14px; font-weight: bold; margin-top: 14px; margin-bottom: 6px; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 12px; }
        th { background: #f1f5f9; text-align: left; }
        @media print { .no-print { display: none !important; } }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom:16px;text-align:right;">
        <button onclick="window.print()" style="background:#2563eb;color:#fff;border:none;padding:10px 22px;border-radius:6px;font-weight:bold;cursor:pointer;">🖨️ Print Profile</button>
      </div>
      <div class="card">
        <div class="header">
          <div>
            <div class="title">${esc(s.legal_name)}</div>
            <div style="font-size:13px;color:#475569;">${esc(s.trade_name || '')}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:bold;">GSTIN: ${esc(s.gstin || 'N/A')}</div>
            <div>Company Branch: ${esc(s.company_name || 'Universal')}</div>
          </div>
        </div>

        <div class="sec-title">🏢 General & Location Info</div>
        <div class="grid">
          <div><b>Supply State (Location):</b> ${esc(s.supply_state || 'Andhra Pradesh')}</div>
          <div><b>Credit Terms:</b> ${esc(s.credit_terms || 'Immediate')}</div>
          <div style="grid-column:span 2;"><b>Office / Billing Address:</b> ${esc(s.address || '—')}</div>
        </div>

        <div class="sec-title">🏦 Bank Account & Financial Details</div>
        <div class="grid">
          <div><b>Bank Name:</b> ${esc(s.bank_name || '—')}</div>
          <div><b>Account Number:</b> ${esc(s.bank_account_no || '—')}</div>
          <div><b>IFSC Code:</b> ${esc(s.bank_ifsc || '—')}</div>
          <div><b>Branch Name:</b> ${esc(s.bank_branch || '—')}</div>
          <div><b>Credit Limit Allowed:</b> ${formatCurrency(s.credit_limit || 0)}</div>
          <div><b>Credit Period / Interest:</b> ${s.credit_period_days || 0} Days (${s.credit_interest_rate || 0}% p.a.)</div>
        </div>

        <div class="sec-title">⚖️ Opening Balance Entry</div>
        <div class="grid">
          <div><b>Opening Balance Amount:</b> ${formatCurrency(s.opening_balance || 0)} (${opBalTypeStr})</div>
          <div><b>Balance Date:</b> ${opBalDateStr}</div>
          <div style="grid-column:span 2;"><b>Notes:</b> ${esc(s.opening_balance_notes || '—')}</div>
        </div>

        <div class="sec-title">👥 Contact Persons & Email Directory</div>
        <table>
          <thead>
            <tr>
              <th style="width:30px;">#</th>
              <th>Contact Name</th>
              <th>Designation</th>
              <th>Email Address</th>
              <th>Phone Number</th>
            </tr>
          </thead>
          <tbody>
            ${contactsRowsHtml}
          </tbody>
        </table>
      </div>
    </body>
    </html>
  `;

  printWin.document.write(html);
  printWin.document.close();
}

// ── SubTab 1: Products Master ──
async function loadProductsSubTab() {
  const subContent = document.getElementById("invSubContent");
  const compId = getActiveCompId();

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <div>
        <h3 style="font-size:16px;font-weight:600;color:var(--text1);margin:0;">Product Catalog Master</h3>
        <div style="font-size:12px;color:var(--text3);margin-top:2px;">Manage products, pricing, minimum reorder thresholds, and assigned suppliers.</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <input type="text" id="prodSearchInp" class="form-input" placeholder="🔍 Search SKU, product, brand, model, supplier, HSN..." style="padding:6px 12px;font-size:12.5px;border-radius:6px;width:280px;">
        <button class="btn btn-secondary" id="dlTemplateHeaderBtn">📄 Download Template</button>
        <button class="btn btn-secondary" id="importExcelBtn">📥 Import Excel / CSV</button>
        <button class="btn btn-primary" id="addProdBtn">+ Add New Product</button>
      </div>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th data-sort-key="sku">SKU</th>
            <th data-sort-key="name">Product Name</th>
            <th data-sort-key="brand">Brand / Model</th>
            <th data-sort-key="serial_no">Serial No.</th>
            <th data-sort-key="supplier_name">Assigned Supplier</th>
            <th data-sort-key="hsn_sac">HSN/SAC</th>
            <th data-sort-key="gst_rate">GST %</th>
            <th data-sort-key="purchase_rate">Pur Rate (Excl / Incl)</th>
            <th data-sort-key="transport_expenses">Transport Exp</th>
            <th data-sort-key="selling_percentage">Selling %</th>
            <th data-sort-key="selling_rate">Selling Price (Excl)</th>
            <th data-sort-key="mrp">MRP (Incl Tax)</th>
            <th data-sort-key="current_stock">In Stock</th>
            <th data-sort-key="weight">Weight</th>
            <th data-sort-key="rack_no">Rack No.</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="prodTableBody">
          <tr><td colspan="16" style="text-align:center;padding:20px;"><div class="spinner"></div> Loading product catalog...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 4px;flex-wrap:wrap;gap:8px;">
      <div id="prodInfo"></div>
      <div id="prodPagination" class="pagination"></div>
    </div>

    <!-- PRODUCT MODAL -->
    <div class="modal-overlay" id="prodModal" style="display:none;">
      <div class="modal-box" style="max-width:700px;">
        <div class="modal-header">
          <h3 id="prodModalTitle">📦 Add Product to Inventory</h3>
          <button class="modal-close" id="prodModalClose">&times;</button>
        </div>
        <form id="prodForm">
          <input type="hidden" id="pEditingId" value="">
          <div class="modal-body">
            <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group" style="grid-column: span 2;">
                <label class="form-label">Product Name *</label>
                <input type="text" id="pName" class="form-input" required placeholder="Power Tiller 13HP">
              </div>

              <div class="form-group" style="grid-column: span 2;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <label class="form-label" style="margin:0;">Assigned Universal Supplier / dealer</label>
                  <button type="button" class="btn btn-sm btn-outline" id="quickAddSupInProdBtn">+ Add New Supplier</button>
                </div>
                <select id="pSupplierId" class="form-select">
                  <option value="">-- Select Supplier (Optional) --</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">SKU Code (Auto-generated if empty)</label>
                <input type="text" id="pSku" class="form-input" placeholder="Auto (e.g. SKU-001)">
              </div>
              <div class="form-group">
                <label class="form-label">Brand</label>
                <input type="text" id="pBrand" class="form-input" placeholder="Shrachi">
              </div>
              <div class="form-group">
                <label class="form-label">Model</label>
                <input type="text" id="pModel" class="form-input" placeholder="Virat 13hp">
              </div>
              <div class="form-group">
                <label class="form-label">Product Serial No.</label>
                <input type="text" id="pSerialNo" class="form-input" placeholder="e.g. SN-8894102">
              </div>
              <div class="form-group">
                <label class="form-label">HSN / SAC Code</label>
                <input type="text" id="pHsn" class="form-input" placeholder="84328020">
              </div>
              <div class="form-group">
                <label class="form-label">GST Rate (%) *</label>
                <input type="number" step="0.01" id="pGst" class="form-input" value="18" required>
              </div>
              <div class="form-group">
                <label class="form-label">Purchase Rate (Excl. Tax ₹) *</label>
                <input type="number" step="0.01" id="pPurRate" class="form-input" required placeholder="100000">
              </div>
              <div class="form-group">
                <label class="form-label">Purchase Rate (Incl. Tax ₹)</label>
                <input type="number" step="0.01" id="pPurRateIncl" class="form-input" placeholder="118000">
              </div>
              <div class="form-group">
                <label class="form-label">Transport Expenses (₹)</label>
                <input type="number" step="0.01" id="pTransportExp" class="form-input" value="0" placeholder="2000">
              </div>
              <div class="form-group">
                <label class="form-label">Selling Percentage (%)</label>
                <input type="number" step="0.01" id="pSellingPct" class="form-input" value="100" placeholder="100">
              </div>
              <div class="form-group">
                <label class="form-label">Selling Price Excl. Tax (₹)</label>
                <input type="number" step="0.01" id="pSellRate" class="form-input" placeholder="200000">
              </div>
              <div class="form-group">
                <label class="form-label">MRP Incl. Tax (₹)</label>
                <input type="number" step="0.01" id="pMrp" class="form-input" placeholder="236000">
              </div>
              <div class="form-group">
                <label class="form-label">Current Stock Qty</label>
                <input type="number" id="pStock" class="form-input" value="10">
              </div>
              <div class="form-group">
                <label class="form-label">Min Reorder Stock</label>
                <input type="number" id="pMinStock" class="form-input" value="5">
              </div>
              <div class="form-group">
                <label class="form-label">Product Weight (kg)</label>
                <input type="number" step="0.001" id="pWeight" class="form-input" placeholder="e.g. 1.5">
              </div>
              <div class="form-group">
                <label class="form-label">Rack / Shelf Location</label>
                <input type="text" id="pRack" class="form-input" placeholder="Shed A-1">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="prodModalCancel">Cancel</button>
            <button type="submit" class="btn btn-primary" id="prodModalSubmitBtn">💾 Save Product</button>
          </div>
        </form>
      </div>
    </div>
  `;

  let currentProductsList = [];

  function autoCalcFormRates() {
    const prExcl = parseFloat(document.getElementById("pPurRate")?.value || 0);
    const gst = parseFloat(document.getElementById("pGst")?.value || 0);
    let prIncl = parseFloat(document.getElementById("pPurRateIncl")?.value || 0);
    const transport = parseFloat(document.getElementById("pTransportExp")?.value || 0);
    const sellPct = parseFloat(document.getElementById("pSellingPct")?.value || 0);

    const activeId = document.activeElement ? document.activeElement.id : "";

    if (activeId === "pPurRate" || activeId === "pGst" || activeId === "" || activeId === "pPurRateIncl") {
      if (activeId !== "pPurRateIncl" || !prIncl) {
        prIncl = Math.round(prExcl * (1 + gst / 100) * 100) / 100;
        const el = document.getElementById("pPurRateIncl");
        if (el) el.value = prIncl || '';
      }
    }

    let finalSellingExcl = parseFloat(document.getElementById("pSellRate")?.value || 0);

    if (activeId === "pPurRate" || activeId === "pGst" || activeId === "pPurRateIncl" || activeId === "pTransportExp" || activeId === "pSellingPct" || activeId === "") {
      const baseCostExcl = prExcl + transport;
      if (sellPct > 0) {
        finalSellingExcl = Math.round((baseCostExcl * (1 + sellPct / 100)) * 100) / 100;
      } else {
        finalSellingExcl = Math.round(baseCostExcl * 100) / 100;
      }
      if (document.getElementById("pSellRate")) document.getElementById("pSellRate").value = finalSellingExcl || '';
    }

    // MRP (Incl Tax) is automatically calculated on Selling Price (Excl) with relevant GST % of that product if user has not manually entered/overridden MRP
    const mrpEl = document.getElementById("pMrp");
    if (activeId === "pMrp") {
      if (mrpEl) {
        mrpEl.dataset.userOverridden = mrpEl.value.trim() !== "" ? "true" : "false";
      }
    }

    const isMrpEnteredByUser = mrpEl && mrpEl.dataset.userOverridden === "true" && mrpEl.value.trim() !== "";
    const currentSellingExcl = parseFloat(document.getElementById("pSellRate")?.value || 0);

    if (!isMrpEnteredByUser && currentSellingExcl > 0) {
      const finalMrpIncl = Math.round((currentSellingExcl * (1 + gst / 100)) * 100) / 100;
      if (mrpEl) {
        mrpEl.value = finalMrpIncl || '';
      }
    }
  }

  ["pPurRate", "pGst", "pPurRateIncl", "pTransportExp", "pSellingPct", "pSellRate", "pMrp"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", autoCalcFormRates);
  });

  // Populate supplier select in modal
  async function populateSuppliersDropdown(selectedSupId = null) {
    try {
      const res = await fetch(`${API_BASE}/inventory?action=suppliers-list`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.suppliers) {
        const sel = document.getElementById("pSupplierId");
        if (sel) {
          sel.innerHTML = `<option value="">-- Select Supplier (Optional) --</option>` +
            data.suppliers.map(s => `<option value="${s.id}" ${selectedSupId == s.id ? 'selected' : ''}>${esc(s.legal_name)} ${s.trade_name ? `(${esc(s.trade_name)})` : ''}</option>`).join("");
        }
      }
    } catch (e) {}
  }

  async function fetchProducts() {
    try {
      const res = await fetch(`${API_BASE}/inventory?action=products&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      currentProductsList = data.products || [];
      const tbody = document.getElementById("prodTableBody");
      if (!tbody) return;

      window.renderPaginatedTable({
        data: currentProductsList,
        pageSize: 10,
        currentPage: 1,
        tbody: "prodTableBody",
        paginationContainer: "prodPagination",
        infoContainer: "prodInfo",
        renderRow: (p) => `
          <tr>
            <td><span class="badge badge-purple">${esc(p.sku || 'SKU-' + p.id)}</span></td>
            <td style="font-weight:600;color:var(--text1);">${esc(p.name)}</td>
            <td>${esc(p.brand || '—')} / ${esc(p.model || '—')}</td>
            <td><span class="badge badge-neutral" style="font-family:monospace;font-weight:600;">${esc(p.serial_no || '—')}</span></td>
            <td><span class="badge badge-outline" style="font-weight:600;">${esc(p.supplier_name || 'Unassigned')}</span></td>
            <td>${esc(p.hsn_sac || '—')}</td>
            <td>${p.gst_rate}%</td>
            <td>
              <div>${formatCurrency(p.purchase_rate)}</div>
              ${p.purchase_rate_incl_tax ? `<div style="font-size:11px;color:var(--text3);">Incl: ${formatCurrency(p.purchase_rate_incl_tax)}</div>` : ''}
            </td>
            <td>${formatCurrency(p.transport_expenses || 0)}</td>
            <td><span class="badge badge-outline">${p.selling_percentage || 0}%</span></td>
            <td style="font-weight:600;color:var(--text1);">${formatCurrency(p.selling_rate)}</td>
            <td style="font-weight:600;color:var(--success);">${formatCurrency(p.mrp || p.selling_rate)}</td>
            <td>
              <span class="badge ${p.current_stock <= p.min_stock ? 'badge-danger' : 'badge-success'}">
                ${p.current_stock} ${esc(p.unit_of_measure || 'NOS')}
              </span>
            </td>
            <td>${p.weight ? `${parseFloat(p.weight)} kg` : '—'}</td>
            <td>${esc(p.rack_no || '—')}</td>
            <td>
              <div style="display:flex;gap:6px;">
                <button class="btn btn-sm btn-outline editProdBtn" data-id="${p.id}">✏️ Edit</button>
                <button class="btn btn-sm btn-danger deleteProdBtn" data-id="${p.id}">🗑️ Delete</button>
              </div>
            </td>
          </tr>
        `,
        onRender: () => {
          const tb = document.getElementById("prodTableBody");
          if (!tb) return;

          tb.querySelectorAll(".editProdBtn").forEach(btn => {
            btn.addEventListener("click", () => {
              const p = currentProductsList.find(x => x.id == btn.dataset.id);
              if (!p) return;
              document.getElementById("pEditingId").value = p.id;
              document.getElementById("pName").value = p.name || '';
              document.getElementById("pSku").value = p.sku || '';
              document.getElementById("pBrand").value = p.brand || '';
              document.getElementById("pModel").value = p.model || '';
              if (document.getElementById("pSerialNo")) document.getElementById("pSerialNo").value = p.serial_no || '';
              document.getElementById("pHsn").value = p.hsn_sac || '';
              document.getElementById("pGst").value = p.gst_rate || '18';
              document.getElementById("pPurRate").value = p.purchase_rate || '';
              document.getElementById("pPurRateIncl").value = p.purchase_rate_incl_tax || '';
              document.getElementById("pTransportExp").value = p.transport_expenses || '0';
              document.getElementById("pSellingPct").value = p.selling_percentage !== undefined ? p.selling_percentage : '100';
              document.getElementById("pSellRate").value = p.selling_rate || '';
              const mrpEl = document.getElementById("pMrp");
              if (mrpEl) {
                mrpEl.value = p.mrp || '';
                mrpEl.dataset.userOverridden = "false";
              }
              document.getElementById("pStock").value = p.current_stock || '0';
              document.getElementById("pMinStock").value = p.min_stock || '5';
              document.getElementById("pWeight").value = p.weight !== undefined ? p.weight : '';
              document.getElementById("pRack").value = p.rack_no || '';
              document.getElementById("prodModalTitle").textContent = "✏️ Edit Product Details";
              document.getElementById("prodModalSubmitBtn").textContent = "💾 Update Product";

              populateSuppliersDropdown(p.supplier_id);
              autoCalcFormRates();
              document.getElementById("prodModal").style.display = "flex";
            });
          });

          tb.querySelectorAll(".deleteProdBtn").forEach(btn => {
            btn.addEventListener("click", async () => {
              const p = currentProductsList.find(x => x.id == btn.dataset.id);
              if (!confirm(`Are you sure you want to delete product '${p?.name || 'Item'}' from inventory catalog?`)) return;
              if (btn.disabled) return;
              const origHtml = btn.innerHTML;
              btn.disabled = true;
              btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
              try {
                const r = await fetch(`${API_BASE}/inventory?action=product-delete&id=${btn.dataset.id}`, {
                  method: "POST",
                  headers: authHeaders()
                });
                const d = await r.json();
                if (d.success) {
                  showToast(d.message || "Product deleted", "success");
                  fetchProducts();
                } else {
                  showToast(d.error || "Failed to delete product", "error");
                  btn.disabled = false;
                  btn.innerHTML = origHtml;
                }
              } catch (err) {
                showToast("Delete product error: " + err.message, "error");
                btn.disabled = false;
                btn.innerHTML = origHtml;
              }
            });
          });
        }
      });

    } catch (err) {
      showToast("Fetch products error: " + err.message, "error");
    }
  }

  on("dlTemplateHeaderBtn", "click", () => {
    window.downloadProductImportTemplate();
  });

  on("importExcelBtn", "click", () => {
    openProductImportModal(() => fetchProducts());
  });

  on("addProdBtn", "click", () => {
    document.getElementById("prodForm").reset();
    const mrpEl = document.getElementById("pMrp");
    if (mrpEl) mrpEl.dataset.userOverridden = "false";
    document.getElementById("pEditingId").value = "";
    document.getElementById("prodModalTitle").textContent = "📦 Add Product to Inventory";
    document.getElementById("prodModalSubmitBtn").textContent = "💾 Save Product";
    populateSuppliersDropdown();
    autoCalcFormRates();
    document.getElementById("prodModal").style.display = "flex";
  });

  on("quickAddSupInProdBtn", "click", () => {
    openSupplierModal(null, (newSup) => {
      populateSuppliersDropdown().then(() => {
        const sel = document.getElementById("pSupplierId");
        if (sel && newSup) sel.value = newSup.id;
      });
    });
  });

  on("prodModalClose", "click", () => { document.getElementById("prodModal").style.display = "none"; });
  on("prodModalCancel", "click", () => { document.getElementById("prodModal").style.display = "none"; });

  on("prodForm", "submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn && submitBtn.disabled) return;
    const origHtml = submitBtn ? submitBtn.innerHTML : "💾 Save Product";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving...`;
    }

    const editingId = document.getElementById("pEditingId").value;
    const targetCompId = (!selectedCompanyId || selectedCompanyId === "all") ? (typeof currentCompanies !== 'undefined' && currentCompanies[0]?.id ? currentCompanies[0].id : 1) : selectedCompanyId;
    const payload = {
      id: editingId || undefined,
      company_id: targetCompId,
      name: document.getElementById("pName").value.trim(),
      supplier_id: document.getElementById("pSupplierId").value || null,
      sku: document.getElementById("pSku").value.trim(),
      brand: document.getElementById("pBrand").value.trim(),
      model: document.getElementById("pModel").value.trim(),
      serial_no: document.getElementById("pSerialNo") ? document.getElementById("pSerialNo").value.trim() : "",
      hsn_sac: document.getElementById("pHsn").value.trim(),
      gst_rate: document.getElementById("pGst").value,
      purchase_rate: document.getElementById("pPurRate").value,
      purchase_rate_incl_tax: document.getElementById("pPurRateIncl").value,
      transport_expenses: document.getElementById("pTransportExp").value,
      selling_percentage: document.getElementById("pSellingPct").value,
      selling_rate: document.getElementById("pSellRate").value,
      mrp: document.getElementById("pMrp").value,
      current_stock: document.getElementById("pStock").value,
      min_stock: document.getElementById("pMinStock").value,
      weight: document.getElementById("pWeight") ? document.getElementById("pWeight").value : 0,
      rack_no: document.getElementById("pRack").value.trim(),
    };

    const action = editingId ? "product-update" : "product-create";

    try {
      const res = await fetch(`${API_BASE}/inventory?action=${action}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Product saved successfully", "success");
        document.getElementById("prodModal").style.display = "none";
        fetchProducts();
      } else showToast(data.error || "Failed to save product", "error");
    } catch (err) {
      showToast("Error: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    }
  });

  fetchProducts();
}

function openProductImportModal(onSuccessCallback) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(2px);";

  overlay.innerHTML = `
    <div class="modal-box" style="max-width:950px;width:95%;background:var(--bg-primary);border-radius:12px;padding:22px;border:1px solid var(--border);box-shadow:0 20px 40px rgba(0,0,0,0.3);max-height:92vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:14px;">
        <h3 style="font-size:17px;font-weight:700;color:var(--text1);margin:0;">📥 Import Products via CSV / Excel</h3>
        <button class="btn btn-sm btn-outline closeImpModal" style="padding:2px 8px;">&times;</button>
      </div>

      <div style="background:var(--bg-card, #f8fafc);padding:12px 16px;border-radius:8px;border:1px solid var(--border);margin-bottom:14px;font-size:12.5px;color:var(--text2);line-height:1.4;">
        Upload a product catalog spreadsheet file (.csv). Products are mapped by <strong>Product Name</strong> and <strong>Model</strong> to update existing stock or create new items automatically.<br>
        <button type="button" class="btn btn-xs btn-outline" id="dlModalTemplateBtn" style="margin-top:6px;">📄 Download Sample CSV Template</button>
      </div>

      <!-- CSV FILE DROPZONE -->
      <div class="form-group" style="margin-bottom:16px;">
        <label class="form-label" style="font-weight:700;font-size:13px;color:var(--primary);margin-bottom:8px;display:block;">📁 Select / Drag CSV File *</label>
        <div id="csvDropzone" style="border:2.5px dashed #3b82f6;background:#eff6ff;border-radius:12px;padding:22px 16px;text-align:center;cursor:pointer;position:relative;transition:all 0.2s ease-in-out;">
          <input type="file" id="csvFileInput" accept=".csv,.txt,.xlsx" style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;cursor:pointer;z-index:2;">
          <div style="font-size:36px;margin-bottom:4px;">📂</div>
          <div style="font-size:14px;font-weight:700;color:#1e40af;margin-bottom:2px;" id="csvFileTitle">Click Here to Browse or Drag & Drop CSV File</div>
          <div style="font-size:12px;color:#3b82f6;font-weight:600;" id="csvFileName">Supported file formats: .csv, .txt, .xlsx</div>
        </div>
      </div>

      <!-- PARSED PREVIEW AREA -->
      <div id="invPreviewArea" style="display:none;margin-top:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h4 style="font-size:14px;font-weight:700;color:var(--text1);margin:0;">📊 Parsed Products Preview</h4>
          <span style="font-size:12px;color:var(--text3);" id="invPreviewCountBadge"></span>
        </div>

        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%;max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;">
          <table class="data-table" style="font-size:11.5px;width:100%;min-width:900px;margin:0;">
            <thead>
              <tr style="background:var(--bg-secondary);position:sticky;top:0;z-index:3;">
                <th>SKU</th>
                <th>Product Name</th>
                <th>Brand / Model</th>
                <th>Assigned Supplier</th>
                <th>HSN/SAC</th>
                <th>GST %</th>
                <th>Pur Rate (Excl/Incl)</th>
                <th>Transport Exp</th>
                <th>Selling %</th>
                <th>Selling Price (Excl)</th>
                <th>MRP (Incl Tax)</th>
                <th>Initial Stock</th>
                <th>Rack No.</th>
              </tr>
            </thead>
            <tbody id="invPreviewTbody">
            </tbody>
          </table>
        </div>

        <div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center;background:var(--bg-card);padding:12px 16px;border-radius:8px;border:1px solid var(--border);flex-wrap:wrap;gap:10px;">
          <div style="font-size:13px;font-weight:600;color:var(--text2);" id="invSummaryStats"></div>
          <div style="display:flex;gap:10px;">
            <button type="button" class="btn btn-secondary closeImpModal">Cancel</button>
            <button type="button" id="confirmInvImportBtn" class="btn btn-primary" style="padding:8px 22px;font-weight:700;">🚀 Confirm & Import Products Now</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelectorAll(".closeImpModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

  const dlBtn = overlay.querySelector("#dlModalTemplateBtn");
  if (dlBtn) {
    dlBtn.addEventListener("click", () => window.downloadProductImportTemplate());
  }

  const dropzone = overlay.querySelector("#csvDropzone");
  const fileInp = overlay.querySelector("#csvFileInput");
  const fileTitle = overlay.querySelector("#csvFileTitle");
  const fileName = overlay.querySelector("#csvFileName");
  let parsedProducts = [];

  function parseCsvLine(text) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (inQuotes && text[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else { cur += c; }
    }
    result.push(cur.trim());
    return result;
  }

  fileInp.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (fileTitle) fileTitle.textContent = `✅ Selected: ${file.name}`;
    if (fileName) fileName.textContent = `Size: ${(file.size / 1024).toFixed(1)} KB | Ready to import`;
    if (dropzone) {
      dropzone.style.borderColor = "#22c55e";
      dropzone.style.background = "#f0fdf4";
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const rawText = evt.target.result;
      const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) return alert("CSV file contains no data rows.");

      const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
      parsedProducts = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]).map(c => c.replace(/^["']|["']$/g, ""));
        if (cols.length === 0 || !cols[0]) continue;

        const rowObj = {};
        headers.forEach((h, idx) => { rowObj[h] = cols[idx] || ""; });

        const prodName = rowObj["productname"] || rowObj["name"] || rowObj["product_name"] || rowObj["item"] || cols[1] || cols[0];
        if (!prodName) continue;

        const brand = rowObj["brand"] || rowObj["brandname"] || null;
        const model = rowObj["model"] || rowObj["modelname"] || rowObj["spec"] || null;
        const supName = rowObj["assignedsupplier"] || rowObj["suppliername"] || rowObj["supplier"] || rowObj["dealer"] || rowObj["vendor"] || rowObj["assigned_supplier"] || rowObj["legalname"] || rowObj["legal_name"] || null;
        const gstRate = parseFloat(rowObj["gstrate"] || rowObj["gst"] || 18);
        const purRateExcl = parseFloat(rowObj["purchaserateexcltax"] || rowObj["purchaserateexcl"] || rowObj["purchaserate"] || rowObj["purchase_rate"] || 0);
        let purRateIncl = parseFloat(rowObj["purchaserateincltax"] || rowObj["purchaserateincl"] || 0);
        if (!purRateIncl && purRateExcl > 0) {
          purRateIncl = Math.round(purRateExcl * (1 + gstRate / 100) * 100) / 100;
        }

        const transportExp = parseFloat(rowObj["transportexpenses"] || rowObj["transport_expenses"] || rowObj["transport"] || 0);
        const sellPct = parseFloat(rowObj["sellingpercentage"] || rowObj["selling_percentage"] || rowObj["sellingpct"] || 0);
        
        let sellRateExcl = parseFloat(rowObj["sellingpriceexcltax"] || rowObj["sellingpricemrpexcltax"] || rowObj["sellingpriceexcl"] || rowObj["sellingprice"] || rowObj["sellingrate"] || 0);
        if (!sellRateExcl && purRateExcl > 0) {
          const baseCostExcl = purRateExcl + transportExp;
          sellRateExcl = sellPct > 0 ? Math.round((baseCostExcl * (1 + sellPct / 100)) * 100) / 100 : Math.round(baseCostExcl * 100) / 100;
        }

        let mrpIncl = parseFloat(rowObj["mrpincltax"] || rowObj["mrpincl"] || rowObj["mrp"] || 0);
        if (!mrpIncl && sellRateExcl > 0) {
          mrpIncl = Math.round(sellRateExcl * (1 + gstRate / 100) * 100) / 100;
        }

        parsedProducts.push({
          company: rowObj["company"] || rowObj["companyname"] || null,
          sku: (rowObj["sku"] || rowObj["skucode"] || "").trim() || null,
          name: prodName.trim(),
          brand: brand ? brand.trim() : null,
          model: model ? model.trim() : null,
          serial_no: (rowObj["productserialno"] || rowObj["serialno"] || rowObj["serial"] || "").trim() || null,
          supplier_name: supName ? supName.trim() : null,
          hsn_sac: (rowObj["hsnsac"] || rowObj["hsn"] || rowObj["hsncode"] || "").trim() || null,
          gst_rate: gstRate,
          weight: parseFloat(rowObj["weight"] || rowObj["weightkg"] || 0),
          purchase_rate: purRateExcl,
          purchase_rate_incl_tax: purRateIncl,
          transport_expenses: transportExp,
          selling_percentage: sellPct,
          selling_rate: sellRateExcl,
          mrp: mrpIncl,
          current_stock: parseInt(rowObj["initialstock"] || rowObj["currentstock"] || rowObj["stock"] || rowObj["quantity"] || rowObj["qty"] || 0, 10),
          min_stock: parseInt(rowObj["minstock"] || rowObj["minreorderstock"] || 5, 10),
          rack_no: (rowObj["rackno"] || rowObj["rack"] || "").trim() || null
        });
      }

      if (parsedProducts.length === 0) return alert("No valid product rows parsed from CSV.");
      renderParsedPreview(parsedProducts);
    };
    reader.readAsText(file);
  });

  function renderParsedPreview(products) {
    const previewArea = overlay.querySelector("#invPreviewArea");
    const tbody = overlay.querySelector("#invPreviewTbody");
    const statsDiv = overlay.querySelector("#invSummaryStats");
    const countBadge = overlay.querySelector("#invPreviewCountBadge");

    let totalStock = 0;
    let totalValue = 0;

    tbody.innerHTML = products.map((p, idx) => {
      totalStock += p.current_stock;
      totalValue += (p.current_stock * (p.purchase_rate_incl_tax || p.purchase_rate));

      return `
        <tr>
          <td><span class="badge badge-purple">${esc(p.sku || 'SKU-' + (idx + 1))}</span></td>
          <td style="font-weight:600;color:var(--text1);">${esc(p.name)}</td>
          <td>${esc(p.brand || '—')} / ${esc(p.model || '—')}</td>
          <td>
            <span class="badge ${p.supplier_name ? 'badge-outline' : 'badge-warning'}" style="font-weight:600;">
              ${esc(p.supplier_name || '⚠️ Auto-Detect / Unassigned')}
            </span>
          </td>
          <td>${esc(p.hsn_sac || '—')}</td>
          <td>${p.gst_rate}%</td>
          <td>
            <div>${formatCurrency(p.purchase_rate)}</div>
            ${p.purchase_rate_incl_tax ? `<div style="font-size:11px;color:var(--text3);">Incl: ${formatCurrency(p.purchase_rate_incl_tax)}</div>` : ''}
          </td>
          <td>${formatCurrency(p.transport_expenses || 0)}</td>
          <td><span class="badge badge-outline">${p.selling_percentage || 0}%</span></td>
          <td style="font-weight:600;color:var(--text1);">${formatCurrency(p.selling_rate)}</td>
          <td style="font-weight:600;color:var(--success);">${formatCurrency(p.mrp)}</td>
          <td><span class="badge badge-success">${p.current_stock} NOS</span></td>
          <td>${esc(p.rack_no || '—')}</td>
        </tr>
      `;
    }).join("");

    if (countBadge) countBadge.textContent = `${products.length} Products Parsed`;
    if (statsDiv) {
      statsDiv.innerHTML = `📦 <strong>Total Products:</strong> ${products.length} | 📊 <strong>Total Initial Stock:</strong> ${totalStock} units | 💰 <strong>Est. Purchase Value:</strong> ${formatCurrency(totalValue)}`;
    }

    if (previewArea) previewArea.style.display = "block";
  }

  overlay.querySelector("#confirmInvImportBtn").addEventListener("click", async () => {
    if (parsedProducts.length === 0) return alert("No valid product rows parsed to import.");

    const btn = overlay.querySelector("#confirmInvImportBtn");
    btn.disabled = true;
    btn.textContent = "⏳ Importing & Matching Products...";

    try {
      const targetCompId = (!selectedCompanyId || selectedCompanyId === "all") ? (typeof currentCompanies !== 'undefined' && currentCompanies[0]?.id ? currentCompanies[0].id : 1) : selectedCompanyId;
      const res = await fetch(`${API_BASE}/inventory?action=bulk-create`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ company_id: targetCompId, products: parsedProducts })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `Successfully imported ${parsedProducts.length} products!`, "success");
        overlay.remove();
        if (onSuccessCallback) onSuccessCallback();
      } else {
        const errMsg = (data.details && (data.error === "Server error" || !data.error)) ? data.details : (data.error || data.details || "Failed to import products");
        showToast(errMsg, "error");
        btn.disabled = false;
        btn.textContent = "🚀 Confirm & Import Products Now";
      }
    } catch (err) {
      showToast("Error importing products: " + err.message, "error");
      btn.disabled = false;
      btn.textContent = "🚀 Confirm & Import Products Now";
    }
  });
}

// ═══════════════════════════════════════════════════
// DOWNLOAD IMPORT CSV / EXCEL TEMPLATE HELPER
// ═══════════════════════════════════════════════════

function getCompanyNamesForTemplate() {
  const userObj = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
  const userRole = (userObj?.role || '').toLowerCase();
  const isSuperAdmin = (userRole === 'superadmin');
  const compList = window.currentCompanies || (typeof currentCompanies !== 'undefined' ? currentCompanies : []) || [];
  const activeCompId = (typeof getActiveCompId === 'function') ? getActiveCompId() : 'all';

  if (isSuperAdmin && activeCompId === 'all') {
    if (compList.length > 0) {
      return compList.map(c => c.name || `Company ${c.id}`);
    }
    return ["Manaswini Enterprises", "Universal Motors"];
  }

  if (activeCompId !== 'all') {
    const found = compList.find(c => c.id == activeCompId);
    if (found?.name) return [found.name];
  }

  if (userObj?.company_name) return [userObj.company_name];
  if (compList.length > 0) return [compList[0].name];
  return ["Manaswini Enterprises"];
}

window.downloadProductImportTemplate = function() {
  const headers = [
    "Company", "Product Name", "Brand", "Model", "Product Serial No", "Supplier Name", 
    "HSN/SAC", "GST Rate", "Weight (kg)", "Purchase Rate Excl Tax", "Purchase Rate Incl Tax", 
    "Transport Expenses", "Selling Percentage", "Selling Price Excl Tax", 
    "MRP Incl Tax", "Initial Stock", "Min Stock", "Rack No"
  ];
  
  const compNames = getCompanyNamesForTemplate();
  const baseSamples = [
    ["Power Tiller 13HP", "Shrachi", "Virat 13hp", "SN-10928374", "Sonalika Motors", "84328020", "5", "145.5", "100000", "118000", "2000", "100", "", "", "10", "5", "Shed A-1"],
    ["Rotavator Blade 42T", "Shaktiman", "SRV-42", "SN-44918239", "Universal Spares", "84328020", "5", "1.2", "4500", "5310", "190", "50", "", "", "50", "15", "Rack B-3"]
  ];

  const sampleRows = [];
  compNames.forEach((compName, idx) => {
    const baseRow = baseSamples[idx % baseSamples.length];
    sampleRows.push([compName, ...baseRow]);
  });

  let csvContent = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";
  sampleRows.forEach(row => {
    csvContent += row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",") + "\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "products_import_template.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (typeof showToast === "function") showToast("Import template downloaded successfully!", "success");
};

// ── SubTab 2: Universal Suppliers Master ──
async function loadSuppliersSubTab() {
  const subContent = document.getElementById("invSubContent");
  const compOptionsHtml = await getCompaniesOptionsHtml();

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <div>
        <h3 style="font-size:16px;font-weight:600;color:var(--text1);margin:0;">🚚 Universal dealers & Suppliers Master</h3>
        <div style="font-size:12px;color:var(--text3);margin-top:2px;">Manage global suppliers separated by company branches with contact person & multiple email directories.</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <select id="supCompanyFilter" class="form-select" style="max-width:200px;font-size:12.5px;padding:6px 10px;">
          <option value="all">-- All Companies --</option>
          ${compOptionsHtml}
        </select>
        <input type="text" id="supSearchInp" class="form-input" placeholder="🔍 Search legal name, GSTIN, location, contact, email..." style="padding:6px 12px;font-size:12.5px;border-radius:6px;width:280px;">
        <button class="btn btn-primary" id="addSupMainBtn">+ Register New Universal Supplier</button>
      </div>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th data-sort-key="company_name">Company Branch</th>
            <th data-sort-key="legal_name">Legal / Trade Name</th>
            <th data-sort-key="gstin">GSTIN</th>
            <th data-sort-key="supply_state">Location State</th>
            <th data-sort-key="contact_person">Contact & Emails</th>
            <th data-sort-key="bank_name">Bank & Credit Info</th>
            <th data-sort-key="opening_balance">Opening Balance</th>
            <th data-sort-key="address">Office Address</th>
            <th style="min-width:140px;text-align:center;">Actions</th>
          </tr>
        </thead>
        <tbody id="supTableBody">
          <tr><td colspan="9" style="text-align:center;padding:20px;"><div class="spinner"></div> Fetching universal suppliers...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 4px;flex-wrap:wrap;gap:8px;">
      <div id="supInfo"></div>
      <div id="supPagination" class="pagination"></div>
    </div>
  `;

  let allSuppliersList = [];
  let sortKey = 'legal_name';
  let sortDir = 'asc';

  async function fetchSuppliers() {
    try {
      const res = await fetch(`${API_BASE}/inventory?action=suppliers-list`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      allSuppliersList = data.suppliers || [];
      renderSuppliersTable();
    } catch (err) {
      showToast("Fetch suppliers error: " + err.message, "error");
    }
  }

  function renderSuppliersTable() {
    const tbody = document.getElementById("supTableBody");
    const pagEl = document.getElementById("supPagination");
    const infoEl = document.getElementById("supInfo");
    if (!tbody) return;

    const searchTerm = (document.getElementById("supSearchInp")?.value || "").toLowerCase().trim();
    const compFilter = document.getElementById("supCompanyFilter")?.value || "all";

    let filtered = allSuppliersList.filter(s => {
      if (compFilter !== "all") {
        if (s.company_id && s.company_id != compFilter) return false;
      }
      if (!searchTerm) return true;

      let contactsStr = "";
      if (s.contacts_json) {
        try {
          const arr = typeof s.contacts_json === 'string' ? JSON.parse(s.contacts_json) : s.contacts_json;
          if (Array.isArray(arr)) {
            contactsStr = arr.map(c => `${c.name || ''} ${c.designation || ''} ${c.email || ''} ${c.phone || ''}`).join(" ");
          }
        } catch(e){}
      }

      const compositeStr = [
        s.legal_name, s.trade_name, s.gstin, s.supply_state, s.company_name,
        s.contact_person, s.designation, s.email, s.phone, s.address, s.credit_terms,
        s.bank_name, s.bank_account_no, s.bank_ifsc, s.bank_branch, s.opening_balance_notes, contactsStr
      ].map(v => (v || "").toLowerCase()).join(" ");

      return compositeStr.includes(searchTerm);
    });

    filtered = window.sortDataArray(filtered, sortKey, sortDir);

    window.renderPaginatedTable({
      data: filtered,
      pageSize: 10,
      currentPage: 1,
      tbody: tbody,
      paginationContainer: pagEl,
      infoContainer: infoEl,
      renderRow: (item, index) => {
        let contactsHtml = '—';
        let contacts = [];
        if (item.contacts_json) {
          try { contacts = typeof item.contacts_json === 'string' ? JSON.parse(item.contacts_json) : item.contacts_json; } catch(e){}
        }
        if (Array.isArray(contacts) && contacts.length > 0) {
          const primary = contacts[0] || {};
          const extraCount = contacts.length > 1 ? ` <span class="badge badge-purple" style="font-size:10px;padding:1px 4px;">+${contacts.length - 1} more</span>` : '';
          contactsHtml = `
            <div style="font-weight:700;color:var(--text1);">${esc(primary.name || item.contact_person || '—')}${extraCount}</div>
            <div style="font-size:11px;color:var(--text3);">${esc(primary.designation || item.designation || 'Primary')}</div>
            ${primary.email ? `<div style="font-size:11px;color:var(--primary);"><a href="mailto:${esc(primary.email)}" style="color:inherit;">✉️ ${esc(primary.email)}</a></div>` : ''}
          `;
        } else if (item.contact_person || item.email) {
          contactsHtml = `
            <div style="font-weight:700;color:var(--text1);">${esc(item.contact_person || '—')}</div>
            <div style="font-size:11px;color:var(--text3);">${esc(item.designation || 'Primary Contact')}</div>
            ${item.email ? `<div style="font-size:11px;color:var(--primary);"><a href="mailto:${esc(item.email)}" style="color:inherit;">✉️ ${esc(item.email)}</a></div>` : ''}
          `;
        }

        const bankCreditHtml = (item.bank_account_no || item.bank_name || item.credit_limit) ? `
          <div style="font-weight:600;font-size:12px;color:var(--text1);">${esc(item.bank_name || 'Bank Acc')}</div>
          ${item.bank_account_no ? `<div style="font-size:11px;font-family:monospace;color:var(--text2);">${esc(item.bank_account_no)}</div>` : ''}
          ${item.credit_limit ? `<div style="font-size:11px;color:var(--success);font-weight:600;">Limit: ${formatCurrency(item.credit_limit)}</div>` : ''}
        ` : '<span style="color:var(--text3);">—</span>';

        const opBalBadge = (item.opening_balance && parseFloat(item.opening_balance) !== 0) ? `
          <div style="font-weight:700;color:var(--text1);">${formatCurrency(item.opening_balance)}</div>
          <div style="font-size:11px;margin-top:2px;">
            <span class="badge ${item.opening_balance_type === 'advance' ? 'badge-success' : 'badge-warning'}">
              ${item.opening_balance_type === 'advance' ? 'Advance Paid' : 'Payable'}
            </span>
            ${item.opening_balance_doc ? ' <span title="Document attached" style="cursor:pointer;">📄</span>' : ''}
          </div>
        ` : '<span style="color:var(--text3);">₹0.00</span>';

        return `
          <tr>
            <td><span class="badge badge-outline" style="font-weight:600;">${esc(item.company_name || 'Universal (All)')}</span></td>
            <td>
              <div style="font-weight:700;color:var(--text1);">${esc(item.legal_name)}</div>
              ${item.trade_name ? `<div style="font-size:11px;color:var(--text3);">Trade: ${esc(item.trade_name)}</div>` : ''}
            </td>
            <td><span class="badge badge-purple">${esc(item.gstin || 'N/A')}</span></td>
            <td><span class="badge badge-outline" style="font-weight:600;background:var(--bg-card);">${esc(item.supply_state || 'Andhra Pradesh')}</span></td>
            <td>${contactsHtml}</td>
            <td>${bankCreditHtml}</td>
            <td>${opBalBadge}</td>
            <td style="font-size:12px;max-width:180px;white-space:normal;line-height:1.3;">${esc(item.address || '—')}</td>
            <td style="text-align:center;">
              <div style="display:inline-flex;gap:4px;justify-content:center;">
                <button class="btn btn-xs btn-info viewSupBtn" data-id="${item.id}" title="View Details & Print Profile">👁️ View</button>
                <button class="btn btn-xs btn-outline editSupBtn" data-id="${item.id}">✏️ Edit</button>
                <button class="btn btn-xs btn-danger deleteSupBtn" data-id="${item.id}">🗑️ Delete</button>
              </div>
            </td>
          </tr>
        `;
      }
    });

    tbody.querySelectorAll(".viewSupBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const sup = allSuppliersList.find(x => x.id == btn.dataset.id);
        if (sup) openSupplierViewModal(sup);
      });
    });

    tbody.querySelectorAll(".editSupBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const sup = allSuppliersList.find(x => x.id == btn.dataset.id);
        if (sup) openSupplierModal(sup, () => fetchSuppliers());
      });
    });

    tbody.querySelectorAll(".deleteSupBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const sup = allSuppliersList.find(x => x.id == btn.dataset.id);
        if (!confirm(`Are you sure you want to delete supplier '${sup?.legal_name || 'dealer'}'?`)) return;
        if (btn.disabled) return;
        const origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
        try {
          const r = await fetch(`${API_BASE}/inventory?action=supplier-delete&id=${btn.dataset.id}`, {
            method: "POST",
            headers: authHeaders()
          });
          const d = await r.json();
          if (d.success) {
            showToast(d.message || "Supplier deleted", "success");
            fetchSuppliers();
          } else {
            showToast(d.error || "Failed to delete supplier", "error");
            btn.disabled = false;
            btn.innerHTML = origHtml;
          }
        } catch (err) {
          showToast("Delete error: " + err.message, "error");
          btn.disabled = false;
          btn.innerHTML = origHtml;
        }
      });
    });
  }

  window.attachTableSorting(document.querySelector("#invSubContent table"), (key, dir) => {
    sortKey = key;
    sortDir = dir;
    renderSuppliersTable();
  });

  on("supSearchInp", "input", renderSuppliersTable);
  on("supCompanyFilter", "change", renderSuppliersTable);
  on("addSupMainBtn", "click", () => {
    openSupplierModal(null, () => fetchSuppliers());
  });

  fetchSuppliers();
}

// ── SubTab: Inter-Branch Stock Transfers ──
async function loadBranchTransferSubTab() {
  const subContent = document.getElementById("invSubContent");
  const compId = getActiveCompId();

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <div>
        <h3 style="font-size:16px;font-weight:600;color:var(--text1);margin:0;">🚚 Inter-Branch Stock Transfers (Transport bw Branches)</h3>
        <p style="font-size:12px;color:var(--text3);margin-top:2px;">Move inventory between company branches. Track transport charges, vehicle details, driver info, and receipt documentation.</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <input type="text" id="transferSearchInp" class="form-input" placeholder="🔍 Search Transfer Code, branch, product, vehicle, driver..." style="padding:6px 12px;font-size:12.5px;border-radius:6px;width:280px;">
        <button class="btn btn-primary" id="openDispatchModalBtn">🚚 + Dispatch Stock to Branch</button>
      </div>
    </div>

    <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap;">
      <label style="font-size:13px;font-weight:600;color:var(--text2);">Filter Status:</label>
      <select id="transferStatusFilter" class="form-select" style="max-width:180px;">
        <option value="all">All Statuses</option>
        <option value="in_transit">🚚 In Transit</option>
        <option value="received">✅ Received</option>
        <option value="cancelled">❌ Cancelled</option>
      </select>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th data-sort-key="transfer_code">Transfer Code</th>
            <th data-sort-key="from_company_name">From Branch</th>
            <th data-sort-key="to_company_name">To Branch</th>
            <th data-sort-key="product_name">Product & Model</th>
            <th data-sort-key="quantity">Qty</th>
            <th data-sort-key="vehicle_no">Transport & Vehicle Info</th>
            <th>Receipt Details</th>
            <th data-sort-key="status">Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="transferTableBody">
          <tr><td colspan="9" style="text-align:center;padding:20px;"><div class="spinner"></div> Loading inter-branch transfers...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 4px;flex-wrap:wrap;gap:8px;">
      <div id="transferInfo"></div>
      <div id="transferPagination" class="pagination"></div>
    </div>
  `;

  let transfersList = [];
  let sortKey = 'dispatched_at';
  let sortDir = 'desc';

  async function fetchTransfers() {
    try {
      const statusFilter = document.getElementById("transferStatusFilter")?.value || "all";
      const res = await fetch(`${API_BASE}/inventory?action=inter-branch-list&company_id=${compId}&status=${statusFilter}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      transfersList = data.transfers || [];
      renderTransfersTable();
    } catch (err) {
      showToast("Fetch branch transfers error: " + err.message, "error");
    }
  }

  function renderTransfersTable() {
    const tbody = document.getElementById("transferTableBody");
    const pagEl = document.getElementById("transferPagination");
    const infoEl = document.getElementById("transferInfo");
    if (!tbody) return;

    const searchTerm = (document.getElementById("transferSearchInp")?.value || "").toLowerCase().trim();

    let filtered = transfersList.filter(t => {
      if (!searchTerm) return true;
      const trfCode = t.transfer_code || t.transfer_number || `TRF-${String(t.id).padStart(4, '0')}`;
      const compStr = [
        trfCode, t.from_company_name, t.to_company_name, t.product_name, t.brand, t.model,
        t.vehicle_no, t.vehicle_details, t.driver_name, t.driver_info, t.driver_phone, t.status
      ].map(v => (v || "").toLowerCase()).join(" ");

      return compStr.includes(searchTerm);
    });

    filtered = window.sortDataArray(filtered, sortKey, sortDir);

    window.renderPaginatedTable({
      data: filtered,
      pageSize: 10,
      currentPage: 1,
      tbody: tbody,
      paginationContainer: pagEl,
      infoContainer: infoEl,
      renderRow: (t) => {
        let statusBadge = `<span class="badge badge-warning">🚚 In Transit</span>`;
        if (t.status === 'received') statusBadge = `<span class="badge badge-success">✅ Received</span>`;
        if (t.status === 'cancelled') statusBadge = `<span class="badge badge-danger">❌ Cancelled</span>`;

        const trfCode = t.transfer_code || t.transfer_number || `TRF-${String(t.id).padStart(4, '0')}`;

        const userObj = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
        const userRole = (userObj?.role || '').toLowerCase();
        const isSuperAdmin = (userRole === 'superadmin');

        let activeCompId = null;
        if (isSuperAdmin) {
          if (selectedCompanyId && selectedCompanyId !== 'all') {
            activeCompId = parseInt(selectedCompanyId);
          }
        } else {
          if (userObj?.company_id) {
            activeCompId = parseInt(userObj.company_id);
          } else if (selectedCompanyId && selectedCompanyId !== 'all') {
            activeCompId = parseInt(selectedCompanyId);
          }
        }

        const fromCompId = parseInt(t.from_company_id);
        const toCompId = parseInt(t.to_company_id);

        const isSourceBranch = (activeCompId !== null && fromCompId === activeCompId);
        const isDestBranch = (activeCompId !== null && toCompId === activeCompId);

        let canReceive = false;
        if (t.status === 'in_transit') {
          if (isDestBranch || (isSuperAdmin && activeCompId === null)) {
            canReceive = true;
          }
        }

        let canCancel = false;
        if (t.status === 'in_transit') {
          if (isSourceBranch || (isSuperAdmin && activeCompId === null)) {
            canCancel = true;
          }
        }

        const canDelete = isSuperAdmin;

        return `
          <tr>
            <td><span class="badge badge-purple" style="font-size:12px;font-weight:700;">${esc(trfCode)}</span></td>
            <td style="font-weight:600;color:var(--text1);">${esc(t.from_company_name || 'Branch #' + t.from_company_id)}</td>
            <td style="font-weight:600;color:var(--primary);">${esc(t.to_company_name || 'Branch #' + t.to_company_id)}</td>
            <td>
              <div style="font-weight:600;color:var(--text1);">${esc(t.product_name)}</div>
              <div style="font-size:11px;color:var(--text3);">${t.brand ? esc(t.brand) : ''} ${t.model ? `(${esc(t.model)})` : ''}</div>
            </td>
            <td><span class="badge badge-purple" style="font-size:13px;font-weight:700;">${t.quantity} NOS</span></td>
            <td>
              <div style="font-size:12px;"><strong>Veh:</strong> ${esc(t.vehicle_no || t.vehicle_details || 'N/A')}</div>
              <div style="font-size:11px;color:var(--text3);">Driver: ${esc(t.driver_name || t.driver_info || 'N/A')} ${t.driver_phone ? `(${esc(t.driver_phone)})` : ''}</div>
              <div style="font-size:11px;color:var(--success);">Charges: ${formatCurrency(t.transport_charges || 0)}</div>
              <div style="font-size:10px;color:var(--text3);">${t.dispatched_at ? new Date(t.dispatched_at).toLocaleString() : (t.created_at ? new Date(t.created_at).toLocaleString() : '')}</div>
            </td>
            <td>
              ${t.status === 'received' ? `
                <div style="font-size:12px;"><strong>Rec. Veh:</strong> ${esc(t.receiving_vehicle_no || t.receiving_vehicle_details || 'Same')}</div>
                <div style="font-size:10px;color:var(--text3);">${t.received_at ? new Date(t.received_at).toLocaleString() : ''}</div>
                ${t.receipt_image ? `<button class="btn btn-sm btn-outline viewReceiptBtn" data-id="${t.id}" style="font-size:10px;padding:2px 6px;margin-top:2px;">📎 View Receipt</button>` : ''}
              ` : '<span style="color:var(--text3);font-size:12px;">— Pending —</span>'}
            </td>
            <td>${statusBadge}</td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="btn btn-sm btn-primary printChallanBtn" data-id="${t.id}" title="Print Transport Delivery Challan">🖨️ Print Challan</button>
                ${canReceive ? `<button class="btn btn-sm btn-success receiveStockBtn" data-id="${t.id}">📥 Receive</button>` : ''}
                ${canCancel ? `<button class="btn btn-sm btn-warning cancelTransferBtn" data-id="${t.id}">❌ Cancel</button>` : ''}
                ${canDelete ? `<button class="btn btn-sm btn-danger deleteTransferBtn" data-id="${t.id}">🗑️ Delete</button>` : ''}
              </div>
            </td>
          </tr>
        `;
      }
    });

    tbody.querySelectorAll(".printChallanBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = transfersList.find(x => x.id == btn.dataset.id);
        if (item) printTransferChallan(item);
      });
    });

    tbody.querySelectorAll(".receiveStockBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = transfersList.find(x => x.id == btn.dataset.id);
        if (item) openReceiveTransferModal(item, () => fetchTransfers());
      });
    });

    tbody.querySelectorAll(".cancelTransferBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = transfersList.find(x => x.id == btn.dataset.id);
        const trfCode = item?.transfer_code || item?.transfer_number || `TRF-${btn.dataset.id}`;
        
        showConfirmModal({
          title: "Cancel Branch Transfer",
          message: `Are you sure you want to cancel transfer '${trfCode}'? Stock will be automatically restored back to the source branch.`,
          icon: "❌",
          confirmText: "Yes, Cancel Transfer",
          confirmClass: "btn-warning",
          onConfirm: async () => {
            try {
              const res = await fetch(`${API_BASE}/inventory?action=inter-branch-cancel&id=${item.id}&transfer_id=${item.id}`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({ id: item.id, transfer_id: item.id })
              });
              const d = await res.json();
              if (d.success) {
                showToast(d.message || "Transfer cancelled successfully", "success");
                fetchTransfers();
              } else showToast(d.error || "Cancel failed", "error");
            } catch (e) {
              showToast("Cancel error: " + e.message, "error");
            }
          }
        });
      });
    });

    tbody.querySelectorAll(".deleteTransferBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = transfersList.find(x => x.id == btn.dataset.id);
        const trfCode = item?.transfer_code || item?.transfer_number || `TRF-${btn.dataset.id}`;

        showConfirmModal({
          title: "Delete Transfer Record",
          message: `Are you sure you want to permanently DELETE transfer record '${trfCode}'? This action cannot be undone.`,
          icon: "🗑️",
          confirmText: "Yes, Delete Record",
          confirmClass: "btn-danger",
          onConfirm: async () => {
            try {
              const res = await fetch(`${API_BASE}/inventory?action=inter-branch-delete&id=${item.id}&transfer_id=${item.id}`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({ id: item.id, transfer_id: item.id })
              });
              const d = await res.json();
              if (d.success) {
                showToast(d.message || "Transfer record deleted successfully", "success");
                fetchTransfers();
              } else showToast(d.error || "Delete failed", "error");
            } catch (e) {
              showToast("Delete error: " + e.message, "error");
            }
          }
        });
      });
    });

    tbody.querySelectorAll(".viewReceiptBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = transfersList.find(x => x.id == btn.dataset.id);
        if (item && item.receipt_image) {
          const w = window.open("");
          w.document.write(`<title>Receipt - ${item.transfer_code || item.transfer_number}</title><div style="text-align:center;padding:20px;"><img src="${item.receipt_image}" style="max-width:100%;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);" /></div>`);
        }
      });
    });
  }

  window.attachTableSorting(document.querySelector("#invSubContent table"), (key, dir) => {
    sortKey = key;
    sortDir = dir;
    renderTransfersTable();
  });

  on("transferStatusFilter", "change", () => fetchTransfers());
  on("transferSearchInp", "input", renderTransfersTable);
  on("openDispatchModalBtn", "click", () => {
    openDispatchTransferModal(() => fetchTransfers());
  });

  fetchTransfers();
}

function printTransferChallan(t) {
  const printWin = window.open("", "_blank", "width=920,height=1000");
  if (!printWin) return alert("Please allow popups to print Transport Delivery Challan.");

  const transferCode = t.transfer_code || t.transfer_number || `TRF-${String(t.id).padStart(4, '0')}`;
  
  const matchedFromComp = (window.currentCompanies || []).find(c => c.id == t.from_company_id) || {};
  const matchedToComp = (window.currentCompanies || []).find(c => c.id == t.to_company_id) || {};

  const compName = t.from_company_name || matchedFromComp.name || 'MANASWINI ENTERPRISES';
  const compGstin = (t.from_company_gstin && t.from_company_gstin !== 'null') ? t.from_company_gstin : (matchedFromComp.gstin || '37AZEPN5306R1ZS');
  const compPhone = (t.from_company_phone && t.from_company_phone !== 'null') ? t.from_company_phone : (matchedFromComp.phone || '9846123456');
  const compAddress = (t.from_company_address && t.from_company_address !== 'null') ? t.from_company_address : (matchedFromComp.address || 'D.No. 26-1-34/11, H.O. : RAMACHANDRAPURAM, B.O. : DIWANCHERUVU, Rajahmundry');
  const compHsn = matchedFromComp.hsn_code || t.from_company_hsn || '';

  const toName = t.to_company_name || matchedToComp.name || `Branch #${t.to_company_id}`;
  const toGstin = (t.to_company_gstin && t.to_company_gstin !== 'null') ? t.to_company_gstin : (matchedToComp.gstin || '—');
  const toPhone = (t.to_company_phone && t.to_company_phone !== 'null') ? t.to_company_phone : (matchedToComp.phone || '—');
  const toAddress = (t.to_company_address && t.to_company_address !== 'null') ? t.to_company_address : (matchedToComp.address || '—');

  const vehicleNo = t.vehicle_no || t.vehicle_details || "N/A";
  const driverInfo = t.driver_name || t.driver_info || "N/A";
  const transportCharges = parseFloat(t.transport_charges || 0).toLocaleString('en-IN', {minimumFractionDigits: 2});
  const dispatchDate = (t.dispatched_at || t.created_at || t.dispatch_date_time) ? new Date(t.dispatched_at || t.created_at || t.dispatch_date_time).toLocaleString() : new Date().toLocaleString();

  function getCleanHsn(it) {
    const raw = it?.hsn_sac || it?.hsn_code || t.hsn_code || compHsn || t.hsn_sac;
    if (!raw || raw === 'null' || raw === 'undefined' || raw === '—' || raw === 'NULL') return compHsn || '—';
    return String(raw).trim();
  }

  const items = Array.isArray(t.items) && t.items.length > 0 ? t.items : [{
    product_name: t.product_name,
    brand: t.brand,
    model: t.model,
    hsn_code: getCleanHsn(t),
    quantity: t.quantity || 1,
    gst_rate: t.gst_rate || 18,
    unit_price: t.unit_price || t.rate || 0,
    total: t.total_amount || t.amount || ((t.unit_price || 0) * (t.quantity || 1))
  }];

  const totalQty = items.reduce((acc, i) => acc + (parseInt(i.quantity) || 1), 0);
  const totalVal = items.reduce((acc, i) => acc + (parseFloat(i.total) || 0), 0);

  const itemRowsHtml = items.map((it, idx) => `
    <tr>
      <td style="text-align:center;">${idx + 1}</td>
      <td>
        <div style="font-weight:bold;font-size:13px;">${esc(it.product_name || it.description || 'Stock Item')}</div>
        ${(it.brand || it.model) ? `<div style="font-size:11px;color:#475569;margin-top:2px;">Brand/Model: ${esc(it.brand || '—')} ${it.model ? `(${esc(it.model)})` : ''}</div>` : ''}
        ${it.serial_number ? `<div style="font-size:11px;color:#15803d;margin-top:2px;font-weight:bold;">⚙️ Chassis / Serial No: <span style="background:#e0f2fe;color:#0369a1;padding:1px 6px;border-radius:3px;font-family:monospace;font-size:12px;">${esc(it.serial_number)}</span></div>` : ''}
      </td>
      <td style="text-align:center;font-weight:bold;">${esc(getCleanHsn(it))}</td>
      <td style="text-align:center;font-weight:bold;">${it.quantity}</td>
      <td style="text-align:center;">${it.gst_rate || 18}%</td>
      <td style="text-align:right;font-weight:bold;">${formatCurrency(it.total || 0)}</td>
    </tr>
  `).join("");

  function renderSingleDC(copyTitle, isConsigneeCopy = false) {
    const headerCompName = isConsigneeCopy ? toName : compName;
    const headerGstin = isConsigneeCopy ? (toGstin !== '—' ? toGstin : compGstin) : compGstin;
    const headerPhone = isConsigneeCopy ? (toPhone !== '—' ? toPhone : compPhone) : compPhone;
    const headerAddress = isConsigneeCopy ? (toAddress !== '—' ? toAddress : compAddress) : compAddress;

    return `
      <div class="dc-container">
        <div style="display:flex;justify-content:space-between;align-items:center;background:${isConsigneeCopy ? '#eff6ff' : '#f0fdf4'};border-bottom:1px solid ${isConsigneeCopy ? '#2563eb' : '#15803d'};padding:2px 6px;margin-bottom:6px;">
          <span style="font-weight:bold;font-size:11px;color:${isConsigneeCopy ? '#1d4ed8' : '#15803d'};">${copyTitle}</span>
          <span style="font-size:10px;font-style:italic;">Inter-Branch Transport Document</span>
        </div>

        <div class="dc-header">
          <span class="gst-badge">GST No. : ${esc(headerGstin)}</span>
          <span class="phone-badge">Cell : ${esc(headerPhone)}</span>
          <div class="dc-title" style="color:${isConsigneeCopy ? '#1d4ed8' : '#15803d'};">TRANSFER DC FOR INTERBRANCH</div>
          <div class="company-name" style="color:${isConsigneeCopy ? '#1d4ed8' : '#15803d'};">${esc(headerCompName)}</div>
          <div class="comp-info">${esc(headerAddress)}</div>
          ${isConsigneeCopy ? `<div style="font-size:11px;font-weight:bold;color:#1e40af;margin-top:3px;">DESTINATION BRANCH / CONSIGNEE COPY</div>` : ''}
        </div>

        <div class="two-col-grid">
          <!-- LEFT BOX: DESTINATION BRANCH (CONSIGNEE) DETAILS -->
          <div class="col-box">
            <div style="font-weight:bold;text-decoration:underline;margin-bottom:6px;color:${isConsigneeCopy ? '#1d4ed8' : '#15803d'};">
              ${isConsigneeCopy ? 'Consignee / Destination Branch Details' : 'Destination Branch (Receiver)'}
            </div>
            <div class="info-row"><span class="info-label">Branch Name :</span><span class="info-val" style="font-weight:bold;color:#0f172a;">${esc(toName)}</span></div>
            <div class="info-row"><span class="info-label">GSTIN / UIN :</span><span class="info-val" style="font-weight:bold;color:#15803d;">${esc(toGstin)}</span></div>
            <div class="info-row"><span class="info-label">Address :</span><span class="info-val">${esc(toAddress)}</span></div>
            <div class="info-row"><span class="info-label">Contact Cell :</span><span class="info-val">${esc(toPhone)}</span></div>
            ${isConsigneeCopy ? `<div class="info-row"><span class="info-label">Dispatched From :</span><span class="info-val" style="font-weight:bold;color:#0f172a;">${esc(compName)}</span></div>` : ''}
            <div class="info-row"><span class="info-label">Dispatch Purpose :</span><span class="info-val" style="font-weight:bold;color:#0369a1;">Inter-Branch Stock Movement</span></div>
          </div>

          <!-- RIGHT BOX: TRANSFER CHALLAN & DISPATCH DETAILS -->
          <div class="col-box">
            <div class="info-row"><span class="info-label">Transfer DC No. :</span><span class="info-val" style="color:#b91c1c;font-size:14px;font-weight:bold;">${esc(transferCode)}</span></div>
            <div class="info-row"><span class="info-label">Dispatch Date :</span><span class="info-val">${dispatchDate}</span></div>
            <div class="info-row"><span class="info-label">Transfer Status :</span><span class="info-val" style="font-weight:bold;text-transform:uppercase;color:#15803d;">${esc(t.status || 'Dispatched')}</span></div>

            <div style="margin-top:6px;border-top:1px solid #15803d;padding-top:4px;">
              <div style="font-weight:bold;font-size:11px;">TYPE OF SUPPLY :</div>
              <div class="supply-grid">
                <div><span class="chk-box">✓</span>Inter-Branch Transfer</div>
                <div><span class="chk-box"></span>Direct Sale</div>
                <div><span class="chk-box"></span>Sub Dealer</div>
                <div><span class="chk-box"></span>Dealer Sale</div>
              </div>

              <div style="font-weight:bold;font-size:11px;margin-top:4px;">MOVEMENT TYPE :</div>
              <div class="supply-grid">
                <div><span class="chk-box">✓</span>Internal Transfer</div>
                <div><span class="chk-box"></span>Stock Return</div>
              </div>

              <div class="info-row" style="margin-top:4px;"><span class="info-label">Transporter Name :</span><span class="info-val">${esc(driverInfo)}</span></div>
              <div class="info-row"><span class="info-label">Vehicle No :</span><span class="info-val" style="font-weight:bold;">${esc(vehicleNo)}</span></div>
            </div>
          </div>
        </div>

        <!-- GOODS TABLE -->
        <table class="items-table">
          <thead>
            <tr>
              <th style="width:40px;">S.No.</th>
              <th>Description of Goods</th>
              <th style="width:90px;">HSN Code</th>
              <th style="width:50px;">Qty</th>
              <th style="width:80px;">GST Rate%</th>
              <th style="width:110px;">Amount Rs.</th>
            </tr>
          </thead>
          <tbody>
            ${itemRowsHtml}
            <tr style="font-weight:bold;background:#f0fdf4;">
              <td colspan="3" style="text-align:right;">TOTAL TRANSFER AMOUNT:</td>
              <td style="text-align:center;">${totalQty}</td>
              <td></td>
              <td style="text-align:right;">${formatCurrency(totalVal)}</td>
            </tr>
          </tbody>
        </table>

        <!-- TRANSPORT / MOVEMENT STATUS BAR -->
        <div style="border:1px solid #15803d;padding:8px;background:#f0fdf4;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;font-weight:bold;font-size:12px;">
          <div>Total Transfer Value: ${formatCurrency(totalVal)}</div>
          <div style="color:#0369a1;">Transport Charges: ₹${transportCharges}</div>
          <div style="color:#15803d;">
            ✅ INTER-BRANCH STOCK MOVEMENT
          </div>
        </div>

        <!-- FOOTER & SIGNATURE DETAILS -->
        <div class="footer-grid">
          <div>
            <div style="font-weight:bold;margin-bottom:4px;">${isConsigneeCopy ? 'Destination Branch' : 'Source Branch'} : ${esc(headerCompName)}</div>
            <div>Dispatch Notes: <b>${esc(t.dispatch_notes || 'Stock transferred for inter-branch inventory movement.')}</b></div>
            <div style="margin-top:6px;">Mail ID : contact@manaswini.com</div>
            <div style="margin-top:16px;font-weight:bold;">Receiver Signature (Destination Branch)</div>
          </div>

          <div class="sign-box">
            <div>For <b>${esc(headerCompName)}</b></div>
            <div style="margin-top:35px;">Authorised Signatory</div>
          </div>
        </div>
      </div>
    `;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Transfer Delivery Challan - ${esc(transferCode)}</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        body { font-family: 'Arial', sans-serif; font-size: 12px; color: #000; background: #fff; margin: 0; padding: 10px; }
        .dc-container { border: 2px solid #15803d; border-radius: 4px; padding: 10px; max-width: 800px; margin: 0 auto 20px auto; background: #fff; page-break-inside: avoid; }
        .dc-header { text-align: center; position: relative; border-bottom: 2px solid #15803d; padding-bottom: 6px; margin-bottom: 8px; }
        .dc-title { font-size: 18px; font-weight: 900; letter-spacing: 1px; color: #15803d; text-align: center; text-transform: uppercase; margin-bottom: 4px; }
        .company-name { font-size: 22px; font-weight: 900; color: #15803d; margin: 2px 0; text-transform: uppercase; }
        .comp-info { font-size: 11px; font-weight: bold; color: #222; }
        .phone-badge { position: absolute; right: 0; top: 0; font-weight: bold; font-size: 12px; }
        .gst-badge { position: absolute; left: 0; top: 0; font-weight: bold; font-size: 12px; }
        
        .two-col-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #15803d; margin-bottom: 8px; }
        .col-box { padding: 6px 10px; }
        .col-box:first-child { border-right: 1px solid #15803d; }

        .info-row { display: flex; margin-bottom: 4px; font-size: 12px; }
        .info-label { width: 140px; font-weight: bold; }
        .info-val { flex: 1; border-bottom: 1px dotted #666; font-weight: 600; min-height: 16px; }

        .supply-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 4px 0; font-size: 11px; }
        .chk-box { display: inline-block; width: 12px; height: 12px; border: 1px solid #000; text-align: center; line-height: 10px; font-weight: bold; margin-right: 4px; }

        table.items-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        table.items-table th, table.items-table td { border: 1px solid #15803d; padding: 6px 8px; font-size: 12px; }
        table.items-table th { background: #f0fdf4; color: #15803d; font-weight: bold; text-transform: uppercase; }

        .footer-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #15803d; padding: 8px; font-size: 11px; }
        .sign-box { text-align: right; font-weight: bold; display: flex; flex-direction: column; justify-content: space-between; height: 70px; }

        @media print {
          body { padding: 0; }
          .dc-container { border: 2px solid #000; }
          .no-print { display: none !important; }
          .page-break { page-break-after: always; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom:12px;text-align:right;">
        <button onclick="window.print()" style="background:#15803d;color:#fff;border:none;padding:10px 20px;border-radius:4px;font-weight:bold;cursor:pointer;">🖨️ Print Transfer Delivery Challan (Both Copies)</button>
      </div>

      <!-- PAGE 1: ORIGINAL SOURCE BRANCH COPY -->
      ${renderSingleDC('ORIGINAL FOR SOURCE BRANCH (CONSIGNOR)', false)}

      <div class="page-break"></div>

      <!-- PAGE 2: DESTINATION BRANCH COPY -->
      ${renderSingleDC('DUPLICATE FOR DESTINATION BRANCH (CONSIGNEE)', true)}
    </body>
    </html>
  `;

  printWin.document.write(html);
  printWin.document.close();
}

// Helper to check if two company objects belong to the same company family/group or share GSTIN
function isSameCompanyBranch(c1, c2) {
  if (!c1 || !c2) return false;
  if (c1.id == c2.id) return false;

  const root1 = c1.parent_company_id ? parseInt(c1.parent_company_id) : parseInt(c1.id);
  const root2 = c2.parent_company_id ? parseInt(c2.parent_company_id) : parseInt(c2.id);

  if (root1 === root2) return true;

  if (c1.parent_company_id && parseInt(c1.parent_company_id) === parseInt(c2.id)) return true;
  if (c2.parent_company_id && parseInt(c2.parent_company_id) === parseInt(c1.id)) return true;

  const g1 = (c1.gstin || '').trim().toLowerCase();
  const g2 = (c2.gstin || '').trim().toLowerCase();
  if (g1 && g2 && g1 === g2) return true;

  return false;
}

async function openDispatchTransferModal(onSuccessCallback) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(2px);";

  const companiesList = await getCompaniesList();
  const currentCompId = (selectedCompanyId && selectedCompanyId !== 'all') ? parseInt(selectedCompanyId) : companiesList[0]?.id;

  overlay.innerHTML = `
    <div class="modal-box" style="max-width:720px;width:95%;background:var(--bg-primary);border-radius:12px;padding:24px 28px;border:1px solid var(--border);box-shadow:0 20px 40px rgba(0,0,0,0.3);max-height:92vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:16px;">
        <h3 style="font-size:17px;font-weight:700;color:var(--text1);margin:0;">🚚 Dispatch Stock to Another Branch</h3>
        <button class="btn btn-sm btn-outline closeDispModal" style="padding:4px 10px;font-size:16px;line-height:1;">&times;</button>
      </div>

      <div id="dtSameCompanyWarning" style="display:none;margin-bottom:12px;padding:10px 14px;background:var(--warning-bg, #fffbe6);border:1px solid var(--warning-border, #ffe58f);border-radius:6px;font-size:12.5px;color:var(--warning-text, #873800);line-height:1.4;">
      </div>

      <form id="dispatchTransferForm">
        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px 16px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" style="font-size:12.5px;margin-bottom:4px;font-weight:600;">From Source Branch *</label>
            <select id="dtFromComp" class="form-select" style="padding:7px 10px;font-size:13.5px;" required>
              ${companiesList.map(c => `<option value="${c.id}" ${c.id == currentCompId ? 'selected' : ''}>${esc(c.name)}</option>`).join("")}
            </select>
          </div>

          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" style="font-size:12.5px;margin-bottom:4px;font-weight:600;">To Destination Branch *</label>
            <select id="dtToComp" class="form-select" style="padding:7px 10px;font-size:13.5px;" required>
            </select>
          </div>

          <div class="form-group" style="grid-column: span 2;margin-bottom:0;">
            <label class="form-label" style="font-size:12.5px;margin-bottom:4px;font-weight:600;">Select Product from Source Stock *</label>
            <select id="dtProdSelect" class="form-select" style="padding:7px 10px;font-size:13.5px;" required>
              <option value="">-- Loading products... --</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" style="font-size:12.5px;margin-bottom:4px;font-weight:600;">Transfer Quantity *</label>
            <input type="number" min="1" id="dtQty" class="form-input" style="padding:7px 10px;font-size:13.5px;" required placeholder="e.g. 5">
          </div>

          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" style="font-size:12.5px;margin-bottom:4px;font-weight:600;">Transport Expenses (₹)</label>
            <input type="number" step="0.01" id="dtCharges" class="form-input" style="padding:7px 10px;font-size:13.5px;" value="0" placeholder="e.g. 500">
          </div>

          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" style="font-size:12.5px;margin-bottom:4px;font-weight:600;">Dispatch Vehicle No. *</label>
            <input type="text" id="dtVehicleNo" class="form-input" style="padding:7px 10px;font-size:13.5px;" required placeholder="e.g. KA-01-AB-1234">
          </div>

          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" style="font-size:12.5px;margin-bottom:4px;font-weight:600;">Driver Name</label>
            <input type="text" id="dtDriverName" class="form-input" style="padding:7px 10px;font-size:13.5px;" placeholder="e.g. Ramesh Kumar">
          </div>

          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" style="font-size:12.5px;margin-bottom:4px;font-weight:600;">Driver Phone No.</label>
            <input type="text" id="dtDriverPhone" class="form-input" style="padding:7px 10px;font-size:13.5px;" placeholder="e.g. 9876543210">
          </div>

          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" style="font-size:12.5px;margin-bottom:4px;font-weight:600;">Waybill / Transport Notes</label>
            <input type="text" id="dtNotes" class="form-input" style="padding:7px 10px;font-size:13.5px;" placeholder="Optional transport notes...">
          </div>
        </div>

        <div style="margin-top:20px;display:flex;justify-content:flex-end;gap:12px;">
          <button type="button" class="btn btn-secondary closeDispModal" style="padding:8px 18px;font-size:13.5px;">Cancel</button>
          <button type="submit" id="dispatchSubmitBtn" class="btn btn-primary" style="padding:8px 20px;font-size:13.5px;font-weight:600;">🚚 Dispatch & Deduct Stock</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelectorAll(".closeDispModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

  const fromSel = overlay.querySelector("#dtFromComp");
  const toSel = overlay.querySelector("#dtToComp");
  const prodSel = overlay.querySelector("#dtProdSelect");
  const submitBtn = overlay.querySelector("#dispatchSubmitBtn");
  const warningDiv = overlay.querySelector("#dtSameCompanyWarning");

  function syncDestinationDropdown() {
    const fromId = parseInt(fromSel.value);
    const fromComp = companiesList.find(c => c.id == fromId);

    const validDestinations = companiesList.filter(c => isSameCompanyBranch(fromComp, c));

    if (validDestinations.length === 0) {
      toSel.innerHTML = `<option value="">-- No other branch in this company --</option>`;
      toSel.disabled = true;
      if (submitBtn) submitBtn.disabled = true;
      if (warningDiv) {
        warningDiv.style.display = "block";
        warningDiv.innerHTML = `⚠️ <strong>Note:</strong> Stock transfer is only permitted between branches of the same company (same parent group or GSTIN/HSN). <em>${esc(fromComp?.name || 'Selected company')}</em> has no other registered branches.`;
      }
    } else {
      toSel.disabled = false;
      if (submitBtn) submitBtn.disabled = false;
      if (warningDiv) warningDiv.style.display = "none";
      toSel.innerHTML = validDestinations.map(c => `<option value="${c.id}">${esc(c.name)} ${c.city ? `(${esc(c.city)})` : ''}</option>`).join("");
    }
  }

  async function loadSourceProducts() {
    const fromId = fromSel.value;
    prodSel.innerHTML = `<option value="">-- Loading products... --</option>`;
    try {
      const res = await fetch(`${API_BASE}/inventory?action=products&company_id=${fromId}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.products) {
        if (data.products.length === 0) {
          prodSel.innerHTML = `<option value="">-- No products found in this branch --</option>`;
        } else {
          prodSel.innerHTML = `<option value="">-- Select Product --</option>` +
            data.products.map(p => `<option value="${p.id}">[Stock: ${p.current_stock}] ${esc(p.name)} ${p.brand ? `(${esc(p.brand)})` : ''} - ${esc(p.model || 'No model')}</option>`).join("");
        }
      }
    } catch (e) {
      prodSel.innerHTML = `<option value="">Error loading products</option>`;
    }
  }

  syncDestinationDropdown();
  loadSourceProducts();

  fromSel.addEventListener("change", () => {
    syncDestinationDropdown();
    loadSourceProducts();
  });

  overlay.querySelector("#dispatchTransferForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn && submitBtn.disabled) return;
    const origHtml = submitBtn ? submitBtn.innerHTML : "Dispatch & Deduct Stock";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Dispatching...`;
    }

    const fromComp = fromSel.value;
    const toComp = toSel.value;
    if (fromComp == toComp) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origHtml; }
      return alert("Source branch and destination branch must be different!");
    }

    const prodId = prodSel.value;
    if (!prodId) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origHtml; }
      return alert("Please select a product to transfer.");
    }

    const payload = {
      from_company_id: fromComp,
      to_company_id: toComp,
      product_id: prodId,
      quantity: overlay.querySelector("#dtQty").value,
      transport_charges: overlay.querySelector("#dtCharges").value,
      vehicle_no: overlay.querySelector("#dtVehicleNo").value.trim(),
      driver_name: overlay.querySelector("#dtDriverName").value.trim(),
      driver_phone: overlay.querySelector("#dtDriverPhone").value.trim(),
      notes: overlay.querySelector("#dtNotes").value.trim()
    };

    try {
      const res = await fetch(`${API_BASE}/inventory?action=inter-branch-dispatch`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const d = await res.json();
      if (d.success) {
        showToast(d.message || "Stock dispatched successfully!", "success");
        overlay.remove();
        if (onSuccessCallback) onSuccessCallback();
      } else {
        showToast(d.error || "Dispatch failed", "error");
      }
    } catch (err) {
      showToast("Dispatch error: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    }
  });
}

function openReceiveTransferModal(transferObj, onSuccessCallback) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;";

  overlay.innerHTML = `
    <div class="modal-box" style="max-width:550px;width:100%;background:var(--bg-primary);border-radius:12px;padding:24px;border:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:16px;">
        <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">📥 Receive Stock at Destination Branch</h3>
        <button class="btn btn-sm btn-outline closeRecModal">&times;</button>
      </div>

      <div style="background:var(--bg-card, #f8fafc);padding:12px;border-radius:8px;border:1px solid var(--border);margin-bottom:16px;font-size:13px;">
        <div><strong>Transfer Code:</strong> <span class="badge badge-purple">${esc(transferObj.transfer_code)}</span></div>
        <div style="margin-top:4px;"><strong>From:</strong> ${esc(transferObj.from_company_name || 'Branch')} ➔ <strong>To:</strong> ${esc(transferObj.to_company_name || 'Branch')}</div>
        <div style="margin-top:4px;"><strong>Item:</strong> ${esc(transferObj.product_name)} | <strong>Qty:</strong> ${transferObj.quantity}</div>
        <div style="margin-top:4px;color:var(--text3);font-size:11px;">Dispatched Vehicle: ${esc(transferObj.vehicle_no || 'N/A')}</div>
      </div>

      <form id="receiveTransferForm">
        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label">Receiving Vehicle No. / Transport Info</label>
          <input type="text" id="rtRecVehicleNo" class="form-input" value="${esc(transferObj.vehicle_no || '')}" placeholder="e.g. KA-01-AB-1234">
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label">Attach Receipt Photo / Document (Optional)</label>
          <input type="file" id="rtReceiptFile" class="form-input" accept="image/*,.pdf">
          <input type="hidden" id="rtReceiptBase64" value="">
        </div>

        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label">Receiving Notes / Quality Check</label>
          <textarea id="rtRecNotes" class="form-input" rows="2" placeholder="e.g. Received all items in good condition"></textarea>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button type="button" class="btn btn-secondary closeRecModal">Cancel</button>
          <button type="submit" class="btn btn-success">📥 Confirm Receipt & Add Stock</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelectorAll(".closeRecModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

  const fileInp = overlay.querySelector("#rtReceiptFile");
  fileInp.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      overlay.querySelector("#rtReceiptBase64").value = evt.target.result;
    };
    reader.readAsDataURL(file);
  });

  overlay.querySelector("#receiveTransferForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn && submitBtn.disabled) return;
    const origHtml = submitBtn ? submitBtn.innerHTML : "📥 Confirm Receipt & Add Stock";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Receiving...`;
    }

    const payload = {
      id: transferObj.id,
      transfer_id: transferObj.id,
      receiving_vehicle_no: overlay.querySelector("#rtRecVehicleNo").value.trim(),
      receiving_vehicle_details: overlay.querySelector("#rtRecVehicleNo").value.trim(),
      receipt_image: overlay.querySelector("#rtReceiptBase64").value || null,
      receipt_attachment_url: overlay.querySelector("#rtReceiptBase64").value || null,
      receiving_notes: overlay.querySelector("#rtRecNotes").value.trim()
    };

    try {
      const res = await fetch(`${API_BASE}/inventory?action=inter-branch-receive&id=${transferObj.id}&transfer_id=${transferObj.id}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const d = await res.json();
      if (d.success) {
        showToast(d.message || "Stock received and catalog updated!", "success");
        overlay.remove();
        if (onSuccessCallback) onSuccessCallback();
      } else {
        showToast(d.error || "Receive failed", "error");
      }
    } catch (err) {
      showToast("Receive error: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    }
  });
}

// ── SubTab 3: Low Stock Alerts & Combined Reorder PO Creation ──
async function loadReorderSubTab() {
  const subContent = document.getElementById("invSubContent");
  const compId = getActiveCompId();
  const userObj = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
  const userRole = (userObj?.role || '').toLowerCase();
  const isSuper = userRole === 'superadmin' || userObj?.username === 'superadmin';
  const isStoreAdmin = userRole === 'storeadmin';
  const canDelete = isSuper || isStoreAdmin;

  subContent.innerHTML = `
    <!-- TOP SECTION: LOW STOCK ALERTS -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <div>
        <h3 style="font-size:16px;font-weight:600;color:var(--text1);margin:0;">⚠️ Low Stock Alerts & Interactive Reorder Check</h3>
        <p style="font-size:13px;color:var(--text3);margin-top:2px;">Products below minimum threshold requiring fresh stock order. Auto-groups products by supplier into single POs.</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        <input type="text" id="lowStockSearchInp" class="form-input" placeholder="🔍 Search low stock products..." style="padding:6px 12px;font-size:12.5px;border-radius:6px;width:240px;">
        <button class="btn btn-primary" id="openReorderPOWizardBtn">⚡ Generate Reorder Purchase Orders</button>
      </div>
    </div>

    <div class="table-container" style="margin-bottom:28px;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Product Name</th>
            <th>Brand / Model</th>
            <th>Current Stock</th>
            <th>Min Level</th>
            <th>Assigned Supplier</th>
            <th>Rack Location</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody id="reorderTableBody">
          <tr><td colspan="7" style="text-align:center;padding:20px;"><div class="spinner"></div> Checking inventory...</td></tr>
        </tbody>
      </table>
    </div>

    <hr style="margin:28px 0;border:none;border-top:1px dashed var(--border);">

    <!-- BOTTOM SECTION: GENERATED PURCHASE ORDERS MASTER REGISTER -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <div>
        <h3 style="font-size:16px;font-weight:600;color:var(--text1);margin:0;display:flex;align-items:center;gap:8px;">
          📜 Generated Purchase Orders (PO) Register & History
        </h3>
        <div style="font-size:12px;color:var(--text3);margin-top:2px;">View, inspect items, edit status/amounts, print vouchers, or delete purchase orders.</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        <input type="text" id="poSearchInp" class="form-input" placeholder="🔍 Search PO #, supplier, company..." style="padding:6px 12px;font-size:12.5px;border-radius:6px;width:240px;">
        <button class="btn btn-sm btn-outline" id="refreshPoListBtn">🔄 Refresh PO List</button>
      </div>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>PO Number</th>
            <th>Order Date</th>
            <th>Purchasing Entity</th>
            <th>Supplier</th>
            <th>Items Count</th>
            <th>Total Amount</th>
            <th>Status</th>
            <th style="min-width:210px;text-align:center;">Actions</th>
          </tr>
        </thead>
        <tbody id="poTableBody">
          <tr><td colspan="8" style="text-align:center;padding:20px;"><div class="spinner"></div> Fetching purchase orders...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  let lowStockProductsList = [];
  let currentPOList = [];

  function renderReorderTable(filterText = "") {
    const tbody = document.getElementById("reorderTableBody");
    if (!tbody) return;

    const query = filterText.toLowerCase().trim();
    const list = query ? lowStockProductsList.filter(p => {
      const name = String(p.name || "").toLowerCase();
      const brand = String(p.brand || "").toLowerCase();
      const model = String(p.model || "").toLowerCase();
      const sup = String(p.supplier_name || "").toLowerCase();
      return name.includes(query) || brand.includes(query) || model.includes(query) || sup.includes(query);
    }) : lowStockProductsList;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--success);font-weight:600;">${query ? 'No matching low stock products.' : '✅ All stock levels are sufficient! No reorders needed.'}</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(p => {
      const hasActivePO = !!p.active_po;
      const poBadge = hasActivePO ? `
        <span class="badge badge-info" style="font-size:11.5px;padding:5px 10px;font-weight:600;" title="PO ${esc(p.active_po.po_number)} generated on ${formatDate(p.active_po.order_date)}">
          ⏳ PO Generated (${esc(p.active_po.po_number)})
        </span>
      ` : `
        <button class="btn btn-sm btn-primary autoCreateSinglePOBtn" data-prodid="${p.id}">
          ⚡ Reorder PO
        </button>
      `;

      return `
        <tr>
          <td style="font-weight:600;color:var(--text1);">${esc(p.name)}</td>
          <td>${esc(p.brand || '—')} / ${esc(p.model || '—')}</td>
          <td><span class="badge badge-danger" style="font-size:13px;">${p.current_stock}</span></td>
          <td>${p.min_stock}</td>
          <td>
            <span class="badge ${p.supplier_name ? 'badge-outline' : 'badge-warning'}" style="font-weight:600;">
              ${esc(p.supplier_name || '⚠️ Unassigned Supplier')}
            </span>
          </td>
          <td>${esc(p.rack_no || '—')}</td>
          <td>${poBadge}</td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll(".autoCreateSinglePOBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const single = lowStockProductsList.filter(x => x.id == btn.dataset.prodid);
        openReorderPOGeneratorModal(single);
      });
    });
  }

  async function fetchReorderItems() {
    try {
      const res = await fetch(`${API_BASE}/inventory?action=reorder-check&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      lowStockProductsList = data.low_stock || [];
      const searchInp = document.getElementById("lowStockSearchInp");
      renderReorderTable(searchInp ? searchInp.value : "");
    } catch (err) {
      showToast("Reorder check error: " + err.message, "error");
    }
  }

  function renderPOTable(filterText = "") {
    const tbody = document.getElementById("poTableBody");
    if (!tbody) return;

    const query = filterText.toLowerCase().trim();
    const list = query ? currentPOList.filter(po => {
      const poNum = String(po.po_number || "").toLowerCase();
      const sup = String(po.supplier_name || "").toLowerCase();
      const comp = String(po.company_name || "").toLowerCase();
      const st = String(po.status || "").toLowerCase();
      return poNum.includes(query) || sup.includes(query) || comp.includes(query) || st.includes(query);
    }) : currentPOList;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text3);">${query ? 'No matching purchase orders found.' : 'No purchase orders created yet.'}</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(po => `
      <tr>
        <td><span class="badge badge-purple" style="font-size:12px;font-weight:700;">${esc(po.po_number)}</span></td>
        <td>${formatDate(po.order_date)}</td>
        <td style="font-weight:600;">${esc(po.company_name || 'All Companies')}</td>
        <td style="font-weight:700;color:var(--text1);">${esc(po.supplier_name || 'Unassigned Supplier')}</td>
        <td style="font-weight:600;">${po.item_count || 1} Items</td>
        <td style="font-weight:700;color:var(--success);">${formatCurrency(po.total_amount)}</td>
        <td><span class="badge badge-warning">${esc(po.status ? po.status.toUpperCase() : 'CREATED')}</span></td>
        <td>
          <div style="display:flex;gap:6px;justify-content:center;">
            <button class="btn btn-sm btn-info viewPoBtn" data-id="${po.id}">👁️ View</button>
            <button class="btn btn-sm btn-outline editPoBtn" data-id="${po.id}">✏️ Edit</button>
            <button class="btn btn-sm btn-primary printPoBtn" data-id="${po.id}">🖨️ Print</button>
            ${canDelete ? `<button class="btn btn-sm btn-danger deletePoBtn" data-id="${po.id}">🗑️ Delete</button>` : ''}
          </div>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll(".viewPoBtn").forEach(btn => {
      btn.addEventListener("click", () => openPODetailsModal(btn.dataset.id));
    });

    tbody.querySelectorAll(".printPoBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        try {
          const res = await fetch(`${API_BASE}/inventory?action=po-details&id=${btn.dataset.id}`, { headers: authHeaders() });
          const data = await res.json();
          if (data.success) printPurchaseOrder(data.po, data.items);
          else showToast("Failed to fetch PO details for printing", "error");
        } catch (e) { showToast("Print error: " + e.message, "error"); }
      });
    });

    tbody.querySelectorAll(".editPoBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const po = currentPOList.find(x => x.id == btn.dataset.id);
        if (po) openEditPOModal(po, () => { fetchPOList(); fetchReorderItems(); });
      });
    });

    tbody.querySelectorAll(".deletePoBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const po = currentPOList.find(x => x.id == btn.dataset.id);
        if (!confirm(`Are you sure you want to delete Purchase Order #${po?.po_number || btn.dataset.id}?\nDeleting this PO will enable re-ordering for its items.`)) return;
        try {
          const r = await fetch(`${API_BASE}/inventory?action=po-delete&id=${btn.dataset.id}`, {
            method: "POST",
            headers: authHeaders()
          });
          const d = await r.json();
          if (d.success) {
            showToast(d.message || "PO deleted successfully! Items can now be reordered.", "success");
            fetchPOList();
            fetchReorderItems();
          } else showToast(d.error || "Failed to delete PO", "error");
        } catch (err) {
          showToast("Delete PO error: " + err.message, "error");
        }
      });
    });
  }

  async function fetchPOList() {
    try {
      const res = await fetch(`${API_BASE}/inventory?action=po-list&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      currentPOList = data.purchase_orders || [];
      const searchInp = document.getElementById("poSearchInp");
      renderPOTable(searchInp ? searchInp.value : "");
    } catch (err) {
      showToast("PO fetch error: " + err.message, "error");
    }
  }

  document.getElementById("lowStockSearchInp")?.addEventListener("input", (e) => renderReorderTable(e.target.value));
  document.getElementById("poSearchInp")?.addEventListener("input", (e) => renderPOTable(e.target.value));

  on("openReorderPOWizardBtn", "click", () => {
    const itemsNeedingPo = lowStockProductsList.filter(p => !p.active_po);
    if (itemsNeedingPo.length === 0) {
      if (lowStockProductsList.length > 0) {
        return showToast("All low stock items already have active Purchase Orders generated!", "info");
      }
      return showToast("No low stock products to reorder", "info");
    }
    openReorderPOGeneratorModal(itemsNeedingPo);
  });

  on("refreshPoListBtn", "click", () => {
    fetchPOList();
    fetchReorderItems();
  });

  fetchPOList();
  fetchReorderItems();

  // Modal to select supplier, enter order quantities, and combine products into single PO per supplier
  async function openReorderPOGeneratorModal(productsToOrder) {
    try {
      let overlay = null;
      const userObj = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
      const userRole = (userObj?.role || '').toLowerCase();
      const isSuperAdminModal = (userRole === 'superadmin' || userObj?.username === 'superadmin');

      const compId = getActiveCompId();
      const compIdToUse = compId !== "all" ? parseInt(compId) : (currentCompanies[0]?.id || 1);
      const userCompObj = (window.currentCompanies || currentCompanies || []).find(c => c.id == compIdToUse) || (currentCompanies[0] || { name: 'Main Company' });
      const userCompName = userCompObj.name || 'Main Company';

      function getCompanyHomeState() {
        const selCompId = overlay?.querySelector("#poGenCompanyId")?.value || compIdToUse;
        const comp = (window.currentCompanies || currentCompanies || []).find(c => c.id == selCompId) || (currentCompanies[0] || {});
        return (comp.state || "").trim() || "Same State";
      }

      const initialHomeState = getCompanyHomeState();
      const sRes = await fetch(`${API_BASE}/inventory?action=suppliers-list`, { headers: authHeaders() });
      const sData = await sRes.json();
      const suppliersList = sData.suppliers || [];
      const compOptionsHtml = await getCompaniesOptionsHtml(compId !== 'all' ? compId : null);

      overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;";

      const rowsHtml = productsToOrder.map((p, idx) => {
        const defaultQty = Math.max(1, (p.min_stock * 2) - p.current_stock);
        const optionsHtml = `<option value="">-- Mandatory: Select Supplier * --</option>` +
          suppliersList.map(s => `<option value="${s.id}" ${p.supplier_id == s.id ? 'selected' : ''}>${esc(s.legal_name)}</option>`).join("");

        return `
          <tr data-prodid="${p.id}">
            <td style="text-align:center;">
              <input type="checkbox" class="poIncludeCheck" checked style="width:16px;height:16px;">
            </td>
            <td style="font-weight:700;color:var(--text1);">${esc(p.name)} (${esc(p.brand || '')})</td>
            <td>Stock: <span style="color:var(--danger);font-weight:bold;">${p.current_stock}</span> / Min: ${p.min_stock}</td>
            <td>
              <input type="number" min="1" class="form-input poOrderQty" value="${defaultQty}" style="width:90px;padding:4px 8px;font-weight:700;">
            </td>
            <td>
              <input type="number" step="0.01" class="form-input poUnitRate" value="${parseFloat(p.purchase_rate || 0).toFixed(2)}" style="width:100px;padding:4px 8px;">
            </td>
            <td>
              <select class="form-select poSupplierSel" style="min-width:200px;padding:4px 8px;font-weight:600;">
                ${optionsHtml}
              </select>
            </td>
          </tr>
        `;
      }).join("");

      overlay.innerHTML = `
        <div class="modal-content" style="background:var(--bg-primary);border-radius:12px;max-width:900px;width:100%;padding:24px;border:1px solid var(--border);max-height:90vh;overflow-y:auto;">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:16px;">
            <div>
              <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">📄 Generate Purchase Orders for Low Stock Items</h3>
              <div style="font-size:12px;color:var(--text3);margin-top:2px;">Select supplier for each item. Products for the same supplier will be automatically combined into a single PO!</div>
            </div>
            <button class="btn btn-sm btn-outline closeGenPOModal">&times;</button>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;background:var(--bg-secondary);padding:12px;border-radius:8px;">
            <div>
              <label class="form-label" style="font-weight:700;color:var(--text1);margin-bottom:4px;display:block;">Purchasing Entity / Company *</label>
              ${isSuperAdminModal ? `
                <select id="poGenCompanyId" class="form-select" style="font-weight:700;padding:8px;">
                  ${compOptionsHtml}
                </select>
              ` : `
                <div style="font-weight:700;padding:8px 12px;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;color:var(--text1);font-size:13.5px;display:flex;align-items:center;gap:6px;">
                  🏢 ${esc(userCompName)}
                  <input type="hidden" id="poGenCompanyId" value="${compIdToUse}">
                </div>
              `}
            </div>
            <div>
              <label class="form-label" style="font-weight:700;color:var(--text1);margin-bottom:4px;display:block;">Supply State (Supplier Location) *</label>
              <select id="poGenSupplyState" class="form-select" style="font-weight:700;padding:8px;">
                ${typeof generateIndianStateOptionsHtml === 'function' ? generateIndianStateOptionsHtml(initialHomeState, initialHomeState) : `<option value="${esc(initialHomeState)}" selected>${esc(initialHomeState)} (Same State - Intra State)</option>`}
              </select>
            </div>
          </div>

          <div style="margin-bottom:12px;max-height:450px;overflow-y:auto;" class="table-container">
            <table class="data-table" style="width:100%;">
              <thead>
                <tr>
                  <th style="width:40px;text-align:center;">Include</th>
                  <th>Product & Brand</th>
                  <th>Stock Info</th>
                  <th>Order Qty *</th>
                  <th>Unit Rate (₹)</th>
                  <th>Assigned Supplier *</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

          <div id="poGenSummaryBox" style="padding:12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;font-size:13px;">
            <!-- Computed dynamically -->
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;border-top:1px solid var(--border);padding-top:14px;">
            <button type="button" class="btn btn-secondary closeGenPOModal">Cancel</button>
            <button type="button" class="btn btn-primary" id="confirmGeneratePOsBtn">
              🚀 Generate Purchase Order(s) Grouped by Supplier
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      function updatePoGenSummary() {
        const rows = overlay.querySelectorAll("tbody tr");
        const selState = (overlay.querySelector("#poGenSupplyState")?.value || "").trim().toLowerCase();
        const activeHomeState = getCompanyHomeState();
        const compStateStr = activeHomeState.trim().toLowerCase();
        const isSameState = (!selState || selState === compStateStr || selState === "same state" || selState.includes("intra"));

        let totalTaxable = 0;
        let totalGst = 0;

        rows.forEach(tr => {
          const isChecked = tr.querySelector(".poIncludeCheck")?.checked;
          if (!isChecked) return;
          const pId = tr.dataset.prodid;
          const qty = parseFloat(tr.querySelector(".poOrderQty")?.value || 0);
          const rate = parseFloat(tr.querySelector(".poUnitRate")?.value || 0);

          const prod = productsToOrder.find(p => p.id == pId) || {};
          const gstRate = parseFloat(prod.gst_rate || 18);

          const lineTaxable = qty * rate;
          const lineTax = (lineTaxable * gstRate) / 100;
          totalTaxable += lineTaxable;
          totalGst += lineTax;
        });

        const grandTotalPO = totalTaxable + totalGst;
        const box = overlay.querySelector("#poGenSummaryBox");
        if (box) {
          if (isSameState) {
            const halfGst = totalGst / 2;
            box.innerHTML = `
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                <div>
                  <strong>Taxable Total:</strong> ${formatCurrency(totalTaxable)} &nbsp;|&nbsp;
                  <strong>CGST:</strong> <span style="color:var(--primary-light);font-weight:bold;">${formatCurrency(halfGst)}</span> &nbsp;|&nbsp;
                  <strong>SGST:</strong> <span style="color:var(--primary-light);font-weight:bold;">${formatCurrency(halfGst)}</span>
                </div>
                <div style="font-size:15px;font-weight:800;color:var(--success);">
                  Grand Total PO Amount (Inc. GST): ${formatCurrency(grandTotalPO)}
                </div>
              </div>
            `;
          } else {
            box.innerHTML = `
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                <div>
                  <strong>Taxable Total:</strong> ${formatCurrency(totalTaxable)} &nbsp;|&nbsp;
                  <strong>IGST (Other State):</strong> <span style="color:var(--warning);font-weight:bold;">${formatCurrency(totalGst)}</span>
                </div>
                <div style="font-size:15px;font-weight:800;color:var(--success);">
                  Grand Total PO Amount (Inc. GST): ${formatCurrency(grandTotalPO)}
                </div>
              </div>
            `;
          }
        }
      }

      updatePoGenSummary();

      overlay.querySelector("#poGenCompanyId")?.addEventListener("change", () => {
        const curHomeState = getCompanyHomeState();
        const stateSelect = overlay.querySelector("#poGenSupplyState");
        if (stateSelect && typeof generateIndianStateOptionsHtml === 'function') {
          const selVal = stateSelect.value;
          stateSelect.innerHTML = generateIndianStateOptionsHtml(selVal, curHomeState);
        }
        updatePoGenSummary();
      });

      overlay.querySelectorAll(".poIncludeCheck, .poOrderQty, .poUnitRate, .poSupplierSel").forEach(el => {
        el.addEventListener("input", updatePoGenSummary);
        el.addEventListener("change", updatePoGenSummary);
      });
      overlay.querySelector("#poGenSupplyState")?.addEventListener("change", updatePoGenSummary);

      overlay.querySelectorAll(".closeGenPOModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

      overlay.querySelector("#confirmGeneratePOsBtn").addEventListener("click", async () => {
        const btn = overlay.querySelector("#confirmGeneratePOsBtn");
        if (btn && btn.disabled) return;
        const origHtml = btn ? btn.innerHTML : "🚀 Generate Purchase Order(s) Grouped by Supplier";

        const rows = overlay.querySelectorAll("tbody tr");
        const groupedOrdersMap = {};
        let validationError = null;
        const supplyStateVal = overlay.querySelector("#poGenSupplyState")?.value || getCompanyHomeState();

        rows.forEach(tr => {
          const isChecked = tr.querySelector(".poIncludeCheck").checked;
          if (!isChecked) return;

          const pId = tr.dataset.prodid;
          const qty = parseInt(tr.querySelector(".poOrderQty").value || 0);
          const rate = parseFloat(tr.querySelector(".poUnitRate").value || 0);
          const supId = tr.querySelector(".poSupplierSel").value;
          const prodName = tr.querySelector("td:nth-child(2)").textContent.trim();

          if (!supId) {
            validationError = `Mandatory Supplier is required for product '${prodName}'! Please assign a supplier before creating PO.`;
            return;
          }

          if (qty <= 0) {
            validationError = `Valid Order Quantity required for '${prodName}'!`;
            return;
          }

          if (!groupedOrdersMap[supId]) groupedOrdersMap[supId] = { supplier_id: supId, supply_state: supplyStateVal, items: [] };
          groupedOrdersMap[supId].items.push({ product_id: pId, quantity: qty, rate: rate });
        });

        if (validationError) return alert(validationError);

        const ordersList = Object.values(groupedOrdersMap);
        if (ordersList.length === 0) return alert("Please select at least one product to generate PO!");

        if (btn) {
          btn.disabled = true;
          btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Generating POs...`;
        }

        try {
          const targetCompId = overlay.querySelector("#poGenCompanyId").value;
          const res = await fetch(`${API_BASE}/inventory?action=auto-create-po`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ company_id: targetCompId, orders: ordersList })
          });
          const data = await res.json();
          if (data.success) {
            showToast(data.message || "Purchase Orders created!", "success");
            overlay.remove();
            fetchReorderItems();
            fetchPOList();
          } else {
            showToast(data.error || "Failed to create PO", "error");
          }
        } catch (err) {
          showToast("Error creating PO: " + err.message, "error");
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
          }
        }
      });

    } catch (err) {
      showToast("Error opening PO wizard: " + err.message, "error");
    }
  }

  fetchReorderItems();
  fetchPOList();
}

// ── SubTab 4: Purchase Orders Master ──
async function loadInventoryPurchaseOrderSubTab() {
  const subContent = document.getElementById("invSubContent");
  const compId = selectedCompanyId || "all";

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <div>
        <h3 style="font-size:16px;font-weight:600;color:var(--text1);margin:0;">Purchase Orders (PO) Master</h3>
        <div style="font-size:12px;color:var(--text3);margin-top:2px;">View, inspect items, delete, or print purchase orders.</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        <input type="text" id="poSearchInp" class="form-input" placeholder="🔍 Search PO number, supplier, entity, status..." style="padding:6px 12px;font-size:12.5px;border-radius:6px;width:280px;">
      </div>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th data-sort-key="po_number">PO Number</th>
            <th data-sort-key="order_date">Order Date</th>
            <th data-sort-key="company_name">Purchasing Entity</th>
            <th data-sort-key="supplier_name">Supplier</th>
            <th data-sort-key="item_count">Items Count</th>
            <th data-sort-key="total_amount">Total Amount</th>
            <th data-sort-key="status">Status</th>
            <th style="min-width:140px;text-align:center;">Actions</th>
          </tr>
        </thead>
        <tbody id="poTableBody">
          <tr><td colspan="8" style="text-align:center;padding:20px;"><div class="spinner"></div> Fetching purchase orders...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 4px;flex-wrap:wrap;gap:8px;">
      <div id="poInfo"></div>
      <div id="poPagination" class="pagination"></div>
    </div>
  `;

  let currentPOList = [];
  let sortKey = 'order_date';
  let sortDir = 'desc';

  async function fetchPOList() {
    try {
      const res = await fetch(`${API_BASE}/inventory?action=po-list&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      currentPOList = data.purchase_orders || [];
      renderPOTable();
    } catch (err) {
      showToast("PO fetch error: " + err.message, "error");
    }
  }

  function renderPOTable() {
    const tbody = document.getElementById("poTableBody");
    const pagEl = document.getElementById("poPagination");
    const infoEl = document.getElementById("poInfo");
    if (!tbody) return;

    const searchTerm = (document.getElementById("poSearchInp")?.value || "").toLowerCase().trim();

    let filtered = currentPOList.filter(po => {
      if (!searchTerm) return true;
      const compStr = [po.po_number, po.company_name, po.supplier_name, po.status, po.order_date].map(v => (v || "").toLowerCase()).join(" ");
      return compStr.includes(searchTerm);
    });

    filtered = window.sortDataArray(filtered, sortKey, sortDir);

    window.renderPaginatedTable({
      data: filtered,
      pageSize: 10,
      currentPage: 1,
      tbody: tbody,
      paginationContainer: pagEl,
      infoContainer: infoEl,
      renderRow: (po) => `
        <tr>
          <td><span class="badge badge-purple">${esc(po.po_number)}</span></td>
          <td>${formatDate(po.order_date)}</td>
          <td style="font-weight:600;">${esc(po.company_name || 'All Companies')}</td>
          <td style="font-weight:700;color:var(--text1);">${esc(po.supplier_name || 'Unassigned Supplier')}</td>
          <td style="font-weight:600;">${po.item_count || 1} Items</td>
          <td style="font-weight:700;color:var(--success);">${formatCurrency(po.total_amount)}</td>
          <td><span class="badge badge-warning">${esc(po.status ? po.status.toUpperCase() : 'CREATED')}</span></td>
          <td style="text-align:center;">
            <div style="display:inline-flex;gap:4px;justify-content:center;">
              <button class="btn btn-xs btn-info viewPoBtn" data-id="${po.id}">👁️ View</button>
              <button class="btn btn-xs btn-outline editPoBtn" data-id="${po.id}">✏️ Edit</button>
              <button class="btn btn-xs btn-primary printPoBtn" data-id="${po.id}">🖨️ Print</button>
              <button class="btn btn-xs btn-danger deletePoBtn" data-id="${po.id}">🗑️ Delete</button>
            </div>
          </td>
        </tr>
      `
    });

    tbody.querySelectorAll(".viewPoBtn").forEach(btn => {
      btn.addEventListener("click", () => openPODetailsModal(btn.dataset.id));
    });

    tbody.querySelectorAll(".printPoBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        try {
          const res = await fetch(`${API_BASE}/inventory?action=po-details&id=${btn.dataset.id}`, { headers: authHeaders() });
          const data = await res.json();
          if (data.success) printPurchaseOrder(data.po, data.items);
          else showToast("Failed to fetch PO details for printing", "error");
        } catch (e) { showToast("Print error: " + e.message, "error"); }
      });
    });

    tbody.querySelectorAll(".editPoBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const po = currentPOList.find(x => x.id == btn.dataset.id);
        if (po) openEditPOModal(po, () => fetchPOList());
      });
    });

    tbody.querySelectorAll(".deletePoBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const po = currentPOList.find(x => x.id == btn.dataset.id);
        if (!confirm(`Are you sure you want to delete Purchase Order #${po?.po_number || btn.dataset.id}?`)) return;
        if (btn.disabled) return;
        const origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
        try {
          const r = await fetch(`${API_BASE}/inventory?action=po-delete&id=${btn.dataset.id}`, {
            method: "POST",
            headers: authHeaders()
          });
          const d = await r.json();
          if (d.success) {
            showToast(d.message || "PO deleted successfully!", "success");
            fetchPOList();
          } else {
            showToast(d.error || "Failed to delete PO", "error");
            btn.disabled = false;
            btn.innerHTML = origHtml;
          }
        } catch (err) {
          showToast("Delete PO error: " + err.message, "error");
          btn.disabled = false;
          btn.innerHTML = origHtml;
        }
      });
    });
  }

  window.attachTableSorting(document.querySelector("#invSubContent table"), (key, dir) => {
    sortKey = key;
    sortDir = dir;
    renderPOTable();
  });

  on("poSearchInp", "input", renderPOTable);

  fetchPOList();
}

// ── Shared Purchase Order Modals & Utilities ──
async function openEditPOModal(po, onSuccess) {
  try {
    const sRes = await fetch(`${API_BASE}/inventory?action=suppliers-list`, { headers: authHeaders() });
    const sData = await sRes.json();
    const suppliersList = sData.suppliers || [];
    const compOptionsHtml = await getCompaniesOptionsHtml(po.company_id);

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;";

    const optionsHtml = `<option value="">-- Select Supplier --</option>` +
      suppliersList.map(s => `<option value="${s.id}" ${po.supplier_id == s.id ? 'selected' : ''}>${esc(s.legal_name)}</option>`).join("");

    const expDateVal = po.expected_date ? po.expected_date.split('T')[0] : '';

    overlay.innerHTML = `
      <div class="modal-box" style="max-width:500px;width:100%;background:var(--bg-primary);border-radius:12px;padding:24px;border:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:16px;">
          <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">✏️ Edit Purchase Order #${esc(po.po_number)}</h3>
          <button class="btn btn-sm btn-outline closeEditPoModal">&times;</button>
        </div>

        <form id="editPoForm">
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">Purchasing Entity / Company *</label>
            <select id="editPoCompanyId" class="form-select">${compOptionsHtml}</select>
          </div>

          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">Assigned Supplier *</label>
            <select id="editPoSupplierId" class="form-select">${optionsHtml}</select>
          </div>

          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">PO Status</label>
            <select id="editPoStatus" class="form-select">
              <option value="created" ${po.status === 'created' ? 'selected' : ''}>CREATED</option>
              <option value="sent" ${po.status === 'sent' ? 'selected' : ''}>SENT TO SUPPLIER</option>
              <option value="partially_received" ${po.status === 'partially_received' ? 'selected' : ''}>PARTIALLY RECEIVED</option>
              <option value="received" ${po.status === 'received' ? 'selected' : ''}>RECEIVED / COMPLETED</option>
              <option value="cancelled" ${po.status === 'cancelled' ? 'selected' : ''}>CANCELLED</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">Total PO Amount (₹)</label>
            <input type="number" step="0.01" id="editPoTotalAmount" class="form-input" value="${po.total_amount || 0}">
          </div>

          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">Expected Delivery Date</label>
            <input type="date" id="editPoExpDate" class="form-input" value="${expDateVal}">
          </div>

          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label">Remarks / Notes</label>
            <input type="text" id="editPoNotes" class="form-input" value="${esc(po.notes || '')}">
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" class="btn btn-secondary closeEditPoModal">Cancel</button>
            <button type="submit" class="btn btn-primary">💾 Update Purchase Order</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelectorAll(".closeEditPoModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

    overlay.querySelector("#editPoForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector("button[type='submit']");
      if (submitBtn && submitBtn.disabled) return;
      const origHtml = submitBtn ? submitBtn.innerHTML : "💾 Update Purchase Order";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Updating...`;
      }

      const payload = {
        id: po.id,
        company_id: overlay.querySelector("#editPoCompanyId").value,
        supplier_id: overlay.querySelector("#editPoSupplierId").value || null,
        status: overlay.querySelector("#editPoStatus").value,
        total_amount: overlay.querySelector("#editPoTotalAmount").value,
        expected_date: overlay.querySelector("#editPoExpDate").value || null,
        notes: overlay.querySelector("#editPoNotes").value.trim()
      };

      try {
        const res = await fetch(`${API_BASE}/inventory?action=po-update`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || "PO updated!", "success");
          overlay.remove();
          if (onSuccess) onSuccess();
        } else showToast(data.error || "Failed to update PO", "error");
      } catch (err) {
        showToast("Error updating PO: " + err.message, "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origHtml;
        }
      }
    });

  } catch (err) {
    showToast("Error opening edit PO modal: " + err.message, "error");
  }
}

async function openPODetailsModal(poId) {
  try {
    const res = await fetch(`${API_BASE}/inventory?action=po-details&id=${poId}`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.success) return showToast("Failed to fetch PO details", "error");

    const po = data.po;
    const items = data.items || [];

    let totalTaxable = 0;
    let totalGst = 0;

    (items || []).forEach(i => {
      const qty = parseInt(i.quantity || 1, 10);
      const rateExcl = parseFloat(i.rate || 0);
      totalTaxable += (qty * rateExcl);
    });

    const poTotal = parseFloat(po.total_amount || 0);
    const impliedGstTotal = poTotal > totalTaxable ? (poTotal - totalTaxable) : 0;
    const impliedGstRate = totalTaxable > 0 ? ((impliedGstTotal / totalTaxable) * 100) : 0;

    const itemsRowsHtml = items.map((i, idx) => {
      const qty = parseInt(i.quantity || 1, 10);
      const rateExcl = parseFloat(i.rate || 0);
      const taxable = qty * rateExcl;

      let gstRate = parseFloat(i.gst_rate || 0);
      if (gstRate <= 0 && impliedGstRate > 0) {
        gstRate = Math.round(impliedGstRate * 100) / 100;
      }
      const gstAmt = (taxable * gstRate) / 100;
      const totalIncl = taxable + gstAmt;

      totalGst += gstAmt;

      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td style="font-weight:700;color:var(--text1);">${esc(i.product_name || 'Product')}</td>
          <td>${esc(i.brand || '—')} / ${esc(i.model || '—')}</td>
          <td style="font-weight:700;text-align:center;">${qty} NOS</td>
          <td style="text-align:right;">${formatCurrency(rateExcl)}</td>
          <td style="text-align:center;font-weight:600;">${gstRate}%</td>
          <td style="text-align:right;">${formatCurrency(gstAmt)}</td>
          <td style="font-weight:700;color:var(--success);text-align:right;">${formatCurrency(totalIncl)}</td>
        </tr>
      `;
    }).join("");

    const grandTotal = poTotal > 0 ? poTotal : (totalTaxable + totalGst);

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;";

    overlay.innerHTML = `
      <div class="modal-content" style="background:var(--bg-primary);border-radius:12px;max-width:850px;width:100%;padding:24px;border:1px solid var(--border);max-height:90vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:16px;">
          <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">📄 Purchase Order Details — ${esc(po.po_number)}</h3>
          <button class="btn btn-sm btn-outline closePoDetailModal">&times;</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:var(--bg-secondary);padding:12px;border-radius:8px;margin-bottom:16px;font-size:13px;">
          <div><strong>Supplier:</strong> ${esc(po.supplier_name || 'Unassigned')}</div>
          <div><strong>Order Date:</strong> ${formatDate(po.order_date)}</div>
          <div><strong>Phone:</strong> ${esc(po.supplier_phone || '—')}</div>
          <div><strong>Total Amount:</strong> <span style="color:var(--success);font-weight:bold;">${formatCurrency(grandTotal)}</span></div>
        </div>

        <div class="table-container" style="max-height:300px;overflow-y:auto;margin-bottom:16px;">
          <table class="data-table" style="width:100%;">
            <thead>
              <tr>
                <th style="width:30px;text-align:center;">#</th>
                <th>Product Name</th>
                <th>Brand / Model</th>
                <th style="text-align:center;">Order Qty</th>
                <th style="text-align:right;">Rate Excl Tax (₹)</th>
                <th style="text-align:center;">GST %</th>
                <th style="text-align:right;">GST Amt (₹)</th>
                <th style="text-align:right;">Total Incl Tax (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRowsHtml}
            </tbody>
          </table>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px;">
          <div style="flex:1;">
            <button type="button" class="btn btn-primary" id="printFromPoDetailBtn">🖨️ Print Purchase Order</button>
          </div>
          <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:12px 16px;width:300px;font-size:13px;line-height:1.6;">
            <div style="display:flex;justify-content:space-between;color:var(--text2);">
              <span>Subtotal (Excl Tax):</span>
              <span style="font-weight:600;color:var(--text1);">${formatCurrency(totalTaxable)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;color:var(--text2);margin-top:4px;">
              <span>GST Total:</span>
              <span style="font-weight:700;color:var(--primary, #4338ca);">${formatCurrency(totalGst)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:800;color:var(--success);margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);">
              <span>Total PO Value:</span>
              <span>${formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;">
          <button type="button" class="btn btn-secondary closePoDetailModal">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelectorAll(".closePoDetailModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

    overlay.querySelector("#printFromPoDetailBtn").addEventListener("click", () => {
      printPurchaseOrder(po, items);
    });

  } catch (err) {
    showToast("Error displaying PO details: " + err.message, "error");
  }
}

function printPurchaseOrder(po, items) {
  const printWin = window.open("", "_blank", "width=900,height=1000");
  if (!printWin) return alert("Please allow popups to print Purchase Order.");

  const compName = po.company_name || (typeof currentCompanies !== 'undefined' && currentCompanies[0]?.name ? currentCompanies[0].name : "BUSINESS ERP ENTERPRISES");
  const compAddr = po.company_address || "Main Road, Commercial Complex";
  const compPhone = po.company_phone || "+91 9848012345";
  const compEmail = po.company_email || "purchases@company.com";
  const compGstin = po.company_gstin || "37AAAAA0000A1Z5";

  let totalTaxable = 0;
  let totalGst = 0;

  (items || []).forEach(i => {
    const qty = parseInt(i.quantity || 1, 10);
    const rateExcl = parseFloat(i.rate || 0);
    totalTaxable += (qty * rateExcl);
  });

  const poTotal = parseFloat(po.total_amount || 0);
  const impliedGstTotal = poTotal > totalTaxable ? (poTotal - totalTaxable) : 0;
  const impliedGstRate = totalTaxable > 0 ? ((impliedGstTotal / totalTaxable) * 100) : 0;

  const itemRowsHtml = (items || []).map((i, idx) => {
    const qty = parseInt(i.quantity || 1, 10);
    const rateExcl = parseFloat(i.rate || 0);
    const taxable = qty * rateExcl;

    let gstRate = parseFloat(i.gst_rate || 0);
    if (gstRate <= 0 && impliedGstRate > 0) {
      gstRate = Math.round(impliedGstRate * 100) / 100;
    }
    const gstAmt = (taxable * gstRate) / 100;
    const totalIncl = taxable + gstAmt;

    totalGst += gstAmt;

    return `
      <tr>
        <td style="text-align:center;padding:8px;border:1px solid #cbd5e1;">${idx + 1}</td>
        <td style="padding:8px;border:1px solid #cbd5e1;font-weight:bold;">${esc(i.product_name || 'Product')}</td>
        <td style="padding:8px;border:1px solid #cbd5e1;">${esc(i.sku || '—')}</td>
        <td style="padding:8px;border:1px solid #cbd5e1;">${esc(i.brand || '—')} / ${esc(i.model || '—')}</td>
        <td style="text-align:center;padding:8px;border:1px solid #cbd5e1;font-weight:bold;">${qty} NOS</td>
        <td style="text-align:right;padding:8px;border:1px solid #cbd5e1;">₹${rateExcl.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        <td style="text-align:center;padding:8px;border:1px solid #cbd5e1;font-weight:600;">${gstRate}%</td>
        <td style="text-align:right;padding:8px;border:1px solid #cbd5e1;">₹${gstAmt.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        <td style="text-align:right;padding:8px;border:1px solid #cbd5e1;font-weight:bold;">₹${totalIncl.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
      </tr>
    `;
  }).join("");

  const grandTotal = poTotal > 0 ? poTotal : (totalTaxable + totalGst);

  const htmlDoc = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Purchase Order - ${esc(po.po_number)}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; font-size: 13px; line-height: 1.4; }
        .header-box { border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
        .company-title { font-size: 22px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin: 0 0 4px 0; }
        .po-title-badge { font-size: 24px; font-weight: 800; color: #4338ca; text-transform: uppercase; text-align: right; margin: 0; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; }
        .info-card h4 { margin: 0 0 6px 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 16px; }
        th { background: #f1f5f9; padding: 8px; font-size: 11px; text-transform: uppercase; border: 1px solid #cbd5e1; font-weight: 700; color: #334155; }
        .summary-card { width: 340px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; font-size: 13px; line-height: 1.6; margin-left: auto; margin-top: 12px; margin-bottom: 16px; }
        .signatures { display: flex; justify-content: space-between; margin-top: 60px; padding-top: 20px; border-top: 1px dashed #cbd5e1; }
        .sig-box { text-align: center; width: 220px; }
        .sig-line { border-top: 1px solid #334155; margin-top: 40px; padding-top: 4px; font-weight: bold; font-size: 12px; }
        @media print {
          .no-print { display: none !important; }
          body { padding: 0; }
          @page { size: A4 portrait; margin: 12mm; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom:16px;text-align:right;">
        <button onclick="window.print()" style="background:#4338ca;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-weight:bold;font-size:14px;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
          🖨️ Print Purchase Order
        </button>
      </div>

      <div class="header-box">
        <div>
          <h1 class="company-title">${esc(compName)}</h1>
          <div>${esc(compAddr)}</div>
          <div>Phone: ${esc(compPhone)} | Email: ${esc(compEmail)}</div>
          <div><strong>GSTIN:</strong> ${esc(compGstin)}</div>
        </div>
        <div style="text-align:right;">
          <h2 class="po-title-badge">PURCHASE ORDER</h2>
          <div style="font-weight:bold;font-size:14px;color:#334155;">PO #: ${esc(po.po_number)}</div>
          <div>Date: ${formatDate(po.order_date)}</div>
          <div>Status: <strong>${esc((po.status || 'CREATED').toUpperCase())}</strong></div>
        </div>
      </div>

      <div class="grid-2">
        <div class="info-card">
          <h4>dealer / SUPPLIER DETAILS</h4>
          <div style="font-size:14px;font-weight:bold;color:#0f172a;">${esc(po.supplier_name || 'Universal Supplier')}</div>
          ${po.supplier_trade_name ? `<div>Trade Name: ${esc(po.supplier_trade_name)}</div>` : ''}
          <div>GSTIN: <strong>${esc(po.supplier_gstin || 'N/A')}</strong></div>
          <div>Phone: ${esc(po.supplier_phone || '—')}</div>
          <div>Address: ${esc(po.supplier_address || '—')}</div>
          <div>Contact Person: ${esc(po.supplier_contact || '—')}</div>
        </div>
        <div class="info-card">
          <h4>DELIVERY & ORDER CONTEXT</h4>
          <div>Purchasing Entity: <strong>${esc(compName)}</strong></div>
          <div>Expected Delivery Date: <strong>${po.expected_date ? formatDate(po.expected_date) : 'ASAP'}</strong></div>
          <div>Payment / Credit Terms: Immediate / Standard</div>
          <div>Notes / Remarks: ${esc(po.notes || 'Official Purchase Order')}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:30px;">#</th>
            <th style="text-align:left;">Item Name</th>
            <th style="text-align:left;">SKU</th>
            <th style="text-align:left;">Brand / Model</th>
            <th style="text-align:center;">Order Qty</th>
            <th style="text-align:right;">Unit Rate Excl Tax (₹)</th>
            <th style="text-align:center;">GST %</th>
            <th style="text-align:right;">GST Amt (₹)</th>
            <th style="text-align:right;">Total Incl Tax (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${itemRowsHtml}
        </tbody>
      </table>

      <div class="summary-card">
        <div style="display:flex;justify-content:space-between;color:#475569;margin-bottom:6px;">
          <span>Subtotal (Taxable Amount):</span>
          <span style="font-weight:600;color:#0f172a;">₹${totalTaxable.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
        </div>
        <div style="display:flex;justify-content:space-between;color:#475569;margin-bottom:6px;">
          <span>GST Total:</span>
          <span style="font-weight:700;color:#4338ca;">₹${totalGst.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;color:#15803d;padding-top:10px;border-top:2px solid #cbd5e1;margin-top:6px;">
          <span>Total Purchase Order Value:</span>
          <span>₹${grandTotal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
        </div>
      </div>

      <div style="margin-top:20px;font-size:11px;color:#64748b;">
        <strong>Terms & Conditions:</strong><br>
        1. Goods must be delivered as per agreed specifications and lead times.<br>
        2. Original Tax Invoice and delivery challan must accompany the consignment.<br>
        3. Subject to quality inspection and approval upon physical receipt.
      </div>

      <div class="signatures">
        <div class="sig-box">
          <div class="sig-line">Supplier Acceptance Signature</div>
        </div>
        <div class="sig-box">
          <div class="sig-line">For ${esc(compName)}<br>(Authorized Signatory)</div>
        </div>
      </div>
    </body>
    </html>
  `;

  printWin.document.write(htmlDoc);
  printWin.document.close();
}

// ── SubTab 5: Stock Receipt & Purchase Entry ──
async function loadStockReceiptSubTab() {
  const subContent = document.getElementById("invSubContent");
  const compId = selectedCompanyId || "all";

  const compIdToUse = compId !== "all" ? parseInt(compId) : (currentCompanies[0]?.id || 1);
  const activeComp = (window.currentCompanies || currentCompanies || []).find(c => c.id == compIdToUse) || (currentCompanies[0] || {});
  const homeState = (activeComp.state || "").trim() || "Same State";

  subContent.innerHTML = `
    <!-- TOP TOOLBAR: MULTI-PURCHASE & BULK EXCEL IMPORT -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;background:var(--bg-card, #f8fafc);padding:14px 18px;border-radius:10px;border:1px solid var(--border);">
      <div>
        <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">📥 Stock Receipts & Purchase Entry Master</h3>
        <div style="font-size:12px;color:var(--text3);margin-top:2px;">Record single or multi-item purchase entries, attach supplier invoices, and import bulk purchase Excel/CSVs.</div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" id="dlPurchaseTemplateBtn">📄 Download Template CSV</button>
        <button class="btn btn-secondary btn-sm" id="importPurchaseExcelBtn">📥 Import Excel / CSV</button>
        <button class="btn btn-primary btn-sm" id="openMultiPurchaseBtn">📝 + Multi-Product Purchase Entry</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:350px minmax(0, 1fr);gap:20px;align-items:start;">
      <!-- LEFT: STOCK RECEIPT FORM -->
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="font-size:15px;font-weight:600;color:var(--text1);margin:0;">⚡ Fast Single-Item Entry</h3>
        </div>

        <div class="card" style="background:var(--bg-primary);border:1px solid var(--border);">
          <form id="stockReceiptForm">
            <div class="form-group">
              <label class="form-label">Select Product *</label>
              <select id="srProdId" class="form-select" required></select>
            </div>

            <div class="form-group">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <label class="form-label" style="margin:0;">Select Supplier / dealer *</label>
                <button type="button" class="btn btn-sm btn-outline" id="quickAddSupInReceiptBtn">+ Quick Add Supplier</button>
              </div>
              <select id="srSupplierId" class="form-select" required></select>
            </div>

            <div class="form-group">
              <label class="form-label">Supply State (Supplier Location) *</label>
              <select id="srSupplyState" class="form-select">
                ${typeof generateIndianStateOptionsHtml === 'function' ? generateIndianStateOptionsHtml(homeState, homeState) : `<option value="${esc(homeState)}" selected>${esc(homeState)} (Same State - Intra State)</option>`}
              </select>
            </div>

            <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;">
              <div class="form-group">
                <label class="form-label">Quantity Received (+) *</label>
                <input type="number" id="srQty" class="form-input" required placeholder="50" min="1">
              </div>

              <div class="form-group">
                <label class="form-label">Purchase Rate / Unit (₹)</label>
                <input type="number" step="0.01" id="srPurRate" class="form-input" placeholder="e.g. 450">
              </div>
            </div>

            <div id="srGstPreviewBox" style="font-size:12px;padding:8px 10px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;margin:6px 0;display:none;"></div>

            <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;">
              <div class="form-group">
                <label class="form-label">Supplier Bill / Inv #</label>
                <input type="text" id="srBillNo" class="form-input" placeholder="INV-2026-9921">
              </div>

              <div class="form-group">
                <label class="form-label">Supplier Billed Amount (₹)</label>
                <input type="number" step="0.01" id="srBilledAmt" class="form-input" placeholder="Total bill amount">
              </div>
            </div>

            <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;">
              <div class="form-group">
                <label class="form-label">Paid Amount (₹)</label>
                <input type="number" step="0.01" id="srPaidAmt" class="form-input" placeholder="0.00">
              </div>

              <div class="form-group">
                <label class="form-label">Interest Rate (%)</label>
                <input type="number" step="0.01" id="srInterestRate" class="form-input" placeholder="0.00">
              </div>
            </div>

            <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;">
              <div class="form-group">
                <label class="form-label">Interest Frequency</label>
                <select id="srInterestFreq" class="form-select">
                  <option value="monthly">Monthly</option>
                  <option value="daily">Daily</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Payment Due Date</label>
                <input type="date" id="srDueDate" class="form-input">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Attach Supplier Bill / Invoice File</label>
              <input type="file" id="srBillFile" class="form-input" accept="image/*,.pdf">
              <div id="srBillDocPreview" style="font-size:11px;color:var(--text3);margin-top:2px;"></div>
            </div>

            <div class="form-group">
              <label class="form-label">Stock Receipt Notes / Remarks</label>
              <input type="text" id="srNotes" class="form-input" placeholder="Fresh delivery lorry challan #1029">
            </div>

            <button type="submit" class="btn btn-primary" style="width:100%;margin-top:12px;">
              💾 Record Purchase & Increment Stock
            </button>
          </form>
        </div>
      </div>

      <!-- RIGHT: RECENT STOCK RECEIPTS & PURCHASES LOG -->
      <div style="min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px;">
          <h3 style="font-size:16px;font-weight:600;color:var(--text1);margin:0;">📜 Stock Receipts & Purchase Entry Log</h3>
          <input type="text" id="receiptSearchInp" class="form-input" placeholder="🔍 Search Date, Bill No, Supplier, Product..." style="padding:4px 10px;font-size:12px;border-radius:6px;width:240px;">
        </div>
        <div class="table-container" style="max-height:550px;overflow:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th data-sort-key="purchase_date">Date</th>
                <th data-sort-key="purchase_invoice_no">Bill #</th>
                <th data-sort-key="supplier_name">Supplier</th>
                <th data-sort-key="product_name">Product & Qty</th>
                <th data-sort-key="grand_total">Billed Amount</th>
                <th>Bill Doc</th>
                <th style="min-width:130px;text-align:center;">Actions</th>
              </tr>
            </thead>
            <tbody id="receiptsLogTableBody">
              <tr><td colspan="7" style="text-align:center;padding:20px;"><div class="spinner"></div> Loading purchase log...</td></tr>
            </tbody>
          </table>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 4px;flex-wrap:wrap;gap:8px;">
          <div id="receiptInfo"></div>
          <div id="receiptPagination" class="pagination"></div>
        </div>
      </div>
    </div>
  `;

  let currentReceiptsList = [];
  let loadedSuppliersList = [];
  let uploadedBillDocBase64 = null;
  let sortKey = 'purchase_date';
  let sortDir = 'desc';

  const billFileInp = document.getElementById("srBillFile");
  if (billFileInp) {
    billFileInp.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        uploadedBillDocBase64 = evt.target.result;
        document.getElementById("srBillDocPreview").textContent = `Attached: ${file.name} (${Math.round(file.size/1024)} KB)`;
      };
      reader.readAsDataURL(file);
    });
  }

  let loadedProductsList = [];

  function updateSrGstCalculation() {
    const pId = document.getElementById("srProdId")?.value;
    const qty = parseFloat(document.getElementById("srQty")?.value || 0);
    const rate = parseFloat(document.getElementById("srPurRate")?.value || 0);
    const selectedState = (document.getElementById("srSupplyState")?.value || "").trim().toLowerCase();
    const activeCompState = (homeState).trim().toLowerCase();
    const box = document.getElementById("srGstPreviewBox");

    if (!box) return;

    if (!pId || qty <= 0 || rate <= 0) {
      box.style.display = "none";
      return;
    }

    const prod = loadedProductsList.find(p => p.id == pId) || {};
    const gstRate = parseFloat(prod.gst_rate || 18);
    const taxable = qty * rate;
    const totalGst = (taxable * gstRate) / 100;
    const isSameState = (!selectedState || selectedState === activeCompState || selectedState === "same state" || selectedState.includes("intra"));

    if (isSameState) {
      const halfGst = totalGst / 2;
      const halfRate = gstRate / 2;
      box.innerHTML = `
        <div style="font-weight:700;color:var(--text1);margin-bottom:2px;">GST Breakdown (Same State - Intra State):</div>
        <div>Taxable Value: <b>₹${taxable.toFixed(2)}</b></div>
        <div>CGST (${halfRate}%): <b style="color:var(--primary-light);">₹${halfGst.toFixed(2)}</b> &nbsp;|&nbsp; SGST (${halfRate}%): <b style="color:var(--primary-light);">₹${halfGst.toFixed(2)}</b></div>
        <div style="font-weight:700;color:var(--success);margin-top:2px;">Total Billed: ₹${(taxable + totalGst).toFixed(2)}</div>
      `;
    } else {
      box.innerHTML = `
        <div style="font-weight:700;color:var(--text1);margin-bottom:2px;">GST Breakdown (Other State - Inter State):</div>
        <div>Taxable Value: <b>₹${taxable.toFixed(2)}</b></div>
        <div>IGST (${gstRate}%): <b style="color:var(--warning);">₹${totalGst.toFixed(2)}</b></div>
        <div style="font-weight:700;color:var(--success);margin-top:2px;">Total Billed: ₹${(taxable + totalGst).toFixed(2)}</div>
      `;
    }
    box.style.display = "block";

    const billedInp = document.getElementById("srBilledAmt");
    if (billedInp && (!billedInp.value || billedInp.dataset.autoupdated === "true")) {
      billedInp.value = (taxable + totalGst).toFixed(2);
      billedInp.dataset.autoupdated = "true";
    }
  }

  // Populate Products & Suppliers dropdowns
  async function loadDropdowns() {
    try {
      const pRes = await fetch(`${API_BASE}/inventory?action=products&company_id=${compId}`, { headers: authHeaders() });
      const pData = await pRes.json();
      const srProdId = document.getElementById("srProdId");
      if (srProdId && pData.success && pData.products) {
        loadedProductsList = pData.products;
        srProdId.innerHTML = pData.products.map(p => `<option value="${p.id}">${esc(p.name)} (${esc(p.brand || '')}) - Stock: ${p.current_stock}</option>`).join("");
        updateSrGstCalculation();
      }

      const sRes = await fetch(`${API_BASE}/inventory?action=suppliers-list`, { headers: authHeaders() });
      const sData = await sRes.json();
      const srSupplierId = document.getElementById("srSupplierId");
      if (srSupplierId && sData.success && sData.suppliers) {
        loadedSuppliersList = sData.suppliers;
        srSupplierId.innerHTML = `<option value="">-- Select Supplier / dealer * --</option>` +
          sData.suppliers.map(s => `<option value="${s.id}">${esc(s.legal_name)} ${s.trade_name ? `(${esc(s.trade_name)})` : ''}</option>`).join("");
      }
    } catch (e) {}
  }

  on("srSupplierId", "change", () => {
    const sId = document.getElementById("srSupplierId")?.value;
    if (sId && loadedSuppliersList) {
      const found = loadedSuppliersList.find(s => s.id == sId);
      if (found && found.supply_state) {
        const stSel = document.getElementById("srSupplyState");
        if (stSel) {
          stSel.value = found.supply_state;
          updateSrGstCalculation();
        }
      }
    }
  });

  ["srProdId", "srQty", "srPurRate", "srSupplyState"].forEach(id => {
    on(id, "input", updateSrGstCalculation);
    on(id, "change", updateSrGstCalculation);
  });
  on("srBilledAmt", "input", () => {
    const billedInp = document.getElementById("srBilledAmt");
    if (billedInp) billedInp.dataset.autoupdated = "false";
  });

  async function fetchReceiptsLog() {
    try {
      const res = await fetch(`${API_BASE}/inventory?action=stock-receipts-list&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      currentReceiptsList = data.receipts || [];
      renderReceiptsLogTable();
    } catch (err) {
      showToast("Fetch receipt log error: " + err.message, "error");
    }
  }

  function renderReceiptsLogTable() {
    const tbody = document.getElementById("receiptsLogTableBody");
    const pagEl = document.getElementById("receiptPagination");
    const infoEl = document.getElementById("receiptInfo");
    if (!tbody) return;

    const searchTerm = (document.getElementById("receiptSearchInp")?.value || "").toLowerCase().trim();

    let filtered = currentReceiptsList.filter(r => {
      if (!searchTerm) return true;
      const compStr = [r.purchase_invoice_no, r.supplier_name, r.product_name, r.purchase_date].map(v => (v || "").toLowerCase()).join(" ");
      return compStr.includes(searchTerm);
    });

    filtered = window.sortDataArray(filtered, sortKey, sortDir);

    window.renderPaginatedTable({
      data: filtered,
      pageSize: 10,
      currentPage: 1,
      tbody: tbody,
      paginationContainer: pagEl,
      infoContainer: infoEl,
      renderRow: (r) => {
        let docBtn = '—';
        try {
          const docs = typeof r.attachments_json === 'string' ? JSON.parse(r.attachments_json || "[]") : (r.attachments_json || []);
          if (Array.isArray(docs) && docs.length > 0 && docs[0]) {
            const token = encodeURIComponent(getToken() || localStorage.getItem("erp_token") || "");
            const viewUrl = `${API_BASE}/inventory?action=view-doc&id=${r.id}&token=${token}`;
            docBtn = `<a href="${viewUrl}" target="_blank" class="btn btn-xs btn-outline">📎 View Bill</a>`;
          }
        } catch (e) {}

        return `
          <tr>
            <td>${formatDate(r.purchase_date || r.created_at)}</td>
            <td><span class="badge badge-purple">${esc(r.purchase_invoice_no || 'N/A')}</span></td>
            <td style="font-weight:600;color:var(--text1);">${esc(r.supplier_name || 'Direct')}</td>
            <td>
              <div style="font-weight:600;">${esc(r.product_name || 'Product')}</div>
              <div style="font-size:11px;color:var(--success);font-weight:700;">+${r.quantity || 0} NOS</div>
            </td>
            <td style="font-weight:700;color:var(--text1);">${formatCurrency(r.grand_total || r.total_amount)}</td>
            <td>${docBtn}</td>
            <td style="white-space:nowrap;min-width:130px;text-align:center;">
              <div style="display:inline-flex;gap:4px;justify-content:center;">
                <button class="btn btn-xs btn-outline editReceiptBtn" data-id="${r.id}" style="padding:4px 8px;font-size:12px;">✏️ Edit</button>
                <button class="btn btn-xs btn-danger deleteReceiptBtn" data-id="${r.id}" style="padding:4px 8px;font-size:12px;">🗑️ Delete</button>
              </div>
            </td>
          </tr>
        `;
      }
    });

    tbody.querySelectorAll(".editReceiptBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const r = currentReceiptsList.find(x => x.id == btn.dataset.id);
        if (r) openEditReceiptModal(r, () => fetchReceiptsLog());
      });
    });

    tbody.querySelectorAll(".deleteReceiptBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const r = currentReceiptsList.find(x => x.id == btn.dataset.id);
        if (!confirm(`Are you sure you want to delete purchase entry Bill #${r?.purchase_invoice_no || 'N/A'}? This will also adjust inventory stock.`)) return;
        if (btn.disabled) return;
        const origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
        try {
          const res = await fetch(`${API_BASE}/inventory?action=stock-receipt-delete&id=${btn.dataset.id}`, {
            method: "POST",
            headers: authHeaders()
          });
          const d = await res.json();
          if (d.success) {
            showToast(d.message || "Entry deleted", "success");
            fetchReceiptsLog();
            loadDropdowns();
          } else {
            showToast(d.error || "Failed to delete entry", "error");
            btn.disabled = false;
            btn.innerHTML = origHtml;
          }
        } catch (err) {
          showToast("Delete entry error: " + err.message, "error");
          btn.disabled = false;
          btn.innerHTML = origHtml;
        }
      });
    });
  }

  const tableHeader = document.querySelector("#receiptsLogTableBody")?.closest("table");
  if (tableHeader) {
    window.attachTableSorting(tableHeader, (key, dir) => {
      sortKey = key;
      sortDir = dir;
      renderReceiptsLogTable();
    });
  }

  on("receiptSearchInp", "input", renderReceiptsLogTable);

  async function openEditReceiptModal(r, onSuccess) {
    try {
      const sRes = await fetch(`${API_BASE}/inventory?action=suppliers-list`, { headers: authHeaders() });
      const sData = await sRes.json();
      const suppliersList = sData.suppliers || [];

      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;";

      const optionsHtml = `<option value="">-- Select Supplier --</option>` +
        suppliersList.map(s => `<option value="${s.id}" ${r.supplier_id == s.id ? 'selected' : ''}>${esc(s.legal_name)}</option>`).join("");

      overlay.innerHTML = `
        <div class="modal-box" style="max-width:500px;width:100%;background:var(--bg-primary);border-radius:12px;padding:24px;border:1px solid var(--border);">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:16px;">
            <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">✏️ Edit Purchase Receipt Entry</h3>
            <button class="btn btn-sm btn-outline closeEditRecModal">&times;</button>
          </div>

          <form id="editRecForm">
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label">Supplier Bill / Invoice Number</label>
              <input type="text" id="editRecBillNo" class="form-input" value="${esc(r.purchase_invoice_no || '')}">
            </div>

            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label">Supplier / dealer</label>
              <select id="editRecSupplierId" class="form-select">${optionsHtml}</select>
            </div>

            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label">Total Billed Amount (₹)</label>
              <input type="number" step="0.01" id="editRecTotalAmount" class="form-input" value="${r.grand_total || r.total_amount || 0}">
            </div>

            <div style="display:flex;justify-content:flex-end;gap:10px;">
              <button type="button" class="btn btn-secondary closeEditRecModal">Cancel</button>
              <button type="submit" class="btn btn-primary">💾 Update Entry</button>
            </div>
          </form>
        </div>
      `;

      document.body.appendChild(overlay);
      overlay.querySelectorAll(".closeEditRecModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

      overlay.querySelector("#editRecForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector("button[type='submit']");
        if (submitBtn && submitBtn.disabled) return;
        const origHtml = submitBtn ? submitBtn.innerHTML : "💾 Update Entry";
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Updating...`;
        }

        const payload = {
          id: r.id,
          purchase_invoice_no: overlay.querySelector("#editRecBillNo").value.trim(),
          supplier_id: overlay.querySelector("#editRecSupplierId").value || null,
          grand_total: overlay.querySelector("#editRecTotalAmount").value
        };

        try {
          const res = await fetch(`${API_BASE}/inventory?action=stock-receipt-update`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (data.success) {
            showToast(data.message || "Entry updated!", "success");
            overlay.remove();
            if (onSuccess) onSuccess();
          } else showToast(data.error || "Failed to update entry", "error");
        } catch (err) {
          showToast("Error updating entry: " + err.message, "error");
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origHtml;
          }
        }
      });

    } catch (err) {
      showToast("Error opening edit modal: " + err.message, "error");
    }
  }

  on("quickAddSupInReceiptBtn", "click", () => {
    openSupplierModal(null, (newSup) => {
      loadDropdowns().then(() => {
        const sel = document.getElementById("srSupplierId");
        if (sel && newSup) sel.value = newSup.id;
      });
    });
  });

  on("stockReceiptForm", "submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn && submitBtn.disabled) return;
    const origHtml = submitBtn ? submitBtn.innerHTML : "📥 Save Purchase Entry";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving Entry...`;
    }

    const payload = {
      product_id: document.getElementById("srProdId").value,
      supplier_id: document.getElementById("srSupplierId").value || null,
      supply_state: document.getElementById("srSupplyState")?.value || "Andhra Pradesh",
      quantity: document.getElementById("srQty").value,
      purchase_rate: document.getElementById("srPurRate").value || null,
      bill_no: document.getElementById("srBillNo").value.trim(),
      billed_amount: document.getElementById("srBilledAmt").value || null,
      paid_amount: document.getElementById("srPaidAmt")?.value || null,
      interest_rate: document.getElementById("srInterestRate")?.value || 0,
      interest_frequency: document.getElementById("srInterestFreq")?.value || "monthly",
      due_date: document.getElementById("srDueDate")?.value || null,
      bill_doc: uploadedBillDocBase64,
      notes: document.getElementById("srNotes").value.trim()
    };

    try {
      const res = await fetch(`${API_BASE}/inventory?action=stock-receipt`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "success");
        document.getElementById("stockReceiptForm").reset();
        uploadedBillDocBase64 = null;
        document.getElementById("srBillDocPreview").textContent = "";
        loadDropdowns();
        fetchReceiptsLog();
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

  on("dlPurchaseTemplateBtn", "click", () => downloadPurchaseEntryTemplateCSV());
  on("importPurchaseExcelBtn", "click", () => openPurchaseImportModal(() => fetchReceiptsLog()));
  on("openMultiPurchaseBtn", "click", () => openMultiPurchaseEntryModal(() => fetchReceiptsLog()));

  loadDropdowns();
  fetchReceiptsLog();
}

// ═══════════════════════════════════════════════════
// INLINE QUICK ADD NEW PRODUCT MODAL
// ═══════════════════════════════════════════════════
function openQuickAddProductModal(onProductCreated) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px);";

  const compId = getActiveCompId();
  const targetCompId = (compId && compId !== 'all') ? compId : 1;

  overlay.innerHTML = `
    <div class="modal-box" style="max-width:550px;width:100%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;">
      <div class="modal-header">
        <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">✨ Add New Product to Inventory</h3>
        <button class="modal-close closeQpModal">&times;</button>
      </div>

      <form id="quickAddProductForm" style="display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;">
        <div class="modal-body">
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px 14px;">
            <div class="form-group" style="grid-column: span 2;margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:3px;">Product Name *</label>
              <input type="text" id="qpName" class="form-input" required placeholder="e.g. Engine Oil 15W40 5L" style="padding:6px 10px;font-size:13px;">
            </div>

            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:3px;">Brand</label>
              <input type="text" id="qpBrand" class="form-input" placeholder="e.g. Castrol" style="padding:6px 10px;font-size:13px;">
            </div>

            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:3px;">Model / Spec</label>
              <input type="text" id="qpModel" class="form-input" placeholder="e.g. CRB Turbo" style="padding:6px 10px;font-size:13px;">
            </div>

            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:3px;">HSN / SAC Code</label>
              <input type="text" id="qpHsn" class="form-input" placeholder="e.g. 84328020" style="padding:6px 10px;font-size:13px;">
            </div>

            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:3px;">GST Rate (%) *</label>
              <input type="number" step="0.01" id="qpGst" class="form-input" value="18" required style="padding:6px 10px;font-size:13px;">
            </div>

            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:3px;">Weight (kg)</label>
              <input type="number" step="0.001" id="qpWeight" class="form-input" placeholder="e.g. 12.5" style="padding:6px 10px;font-size:13px;">
            </div>

            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:3px;">Purchase Rate (Excl. Tax ₹) *</label>
              <input type="number" step="0.01" id="qpPurRate" class="form-input" required placeholder="e.g. 1250" style="padding:6px 10px;font-size:13px;">
            </div>

            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:3px;">Selling Price (Incl. Tax ₹)</label>
              <input type="number" step="0.01" id="qpSelling" class="form-input" placeholder="e.g.  " style="padding:6px 10px;font-size:13px;">
            </div>

            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:3px;">Unit of Measure</label>
              <select id="qpUnit" class="form-select" style="padding:6px 10px;font-size:13px;">
                <option value="NOS">NOS (Numbers)</option>
                <option value="KG">KG (Kilograms)</option>
                <option value="SET">SET</option>
                <option value="LTR">LTR (Liters)</option>
                <option value="MTR">MTR (Meters)</option>
                <option value="BOX">BOX</option>
              </select>
            </div>

            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:3px;">Min Stock Threshold</label>
              <input type="number" id="qpMinStock" class="form-input" value="5" style="padding:6px 10px;font-size:13px;">
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary closeQpModal" style="padding:7px 16px;font-size:13px;">Cancel</button>
          <button type="submit" class="btn btn-primary" style="padding:7px 18px;font-size:13px;font-weight:600;">✨ Add Product to Inventory</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelectorAll(".closeQpModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

  overlay.querySelector("#quickAddProductForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn && submitBtn.disabled) return;
    const origHtml = submitBtn ? submitBtn.innerHTML : "Add Product to Inventory";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Creating Product...`;
    }

    const payload = {
      company_id: targetCompId,
      name: overlay.querySelector("#qpName").value.trim(),
      brand: overlay.querySelector("#qpBrand").value.trim() || null,
      model: overlay.querySelector("#qpModel").value.trim() || null,
      hsn_sac: overlay.querySelector("#qpHsn").value.trim() || null,
      unit_of_measure: overlay.querySelector("#qpUnit").value,
      gst_rate: parseFloat(overlay.querySelector("#qpGst").value || 18),
      weight: parseFloat(overlay.querySelector("#qpWeight").value || 0),
      purchase_rate: parseFloat(overlay.querySelector("#qpPurRate").value || 0),
      purchase_rate_incl_tax: Math.round(parseFloat(overlay.querySelector("#qpPurRate").value || 0) * (1 + parseFloat(overlay.querySelector("#qpGst").value || 18)/100) * 100) / 100,
      selling_rate: parseFloat(overlay.querySelector("#qpSelling").value || 0),
      mrp: parseFloat(overlay.querySelector("#qpSelling").value || 0),
      initial_stock: 0,
      current_stock: 0,
      min_stock: parseInt(overlay.querySelector("#qpMinStock").value || 5, 10)
    };

    try {
      const res = await fetch(`${API_BASE}/inventory?action=product-create`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.product) {
        showToast(data.message || "Product created successfully!", "success");
        overlay.remove();
        if (onProductCreated) onProductCreated(data.product);
      } else {
        showToast(data.error || "Failed to create product", "error");
      }
    } catch (err) {
      showToast("Error creating product: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    }
  });
}

async function getSuppliersList(cId) {
  try {
    const compId = cId || (typeof getActiveCompId === 'function' ? getActiveCompId() : 1) || 1;
    const targetCompId = (compId && compId !== 'all') ? compId : 1;
    let list = [];
    const res = await fetch(`${API_BASE}/inventory?action=suppliers-list&company_id=${targetCompId}`, { headers: authHeaders() });
    const d = await res.json();
    if (d.success && Array.isArray(d.suppliers) && d.suppliers.length > 0) {
      list = d.suppliers;
    } else {
      const vRes = await fetch(`${API_BASE}/employees?action=dealers-list&company_id=${targetCompId}`, { headers: authHeaders() });
      const vData = await vRes.json();
      if (vData.success && Array.isArray(vData.dealers)) {
        list = vData.dealers;
      }
    }
    return list;
  } catch (e) {
    console.warn("getSuppliersList error:", e.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════
// MULTI-PRODUCT PURCHASE ENTRY MODAL
// ═══════════════════════════════════════════════════
async function openMultiPurchaseEntryModal(onSuccessCallback) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const compId = getActiveCompId();
  const targetCompId = (compId && compId !== 'all') ? compId : 1;
  const suppliers = await getSuppliersList(targetCompId);
  let loadedProducts = [];

  try {
    const res = await fetch(`${API_BASE}/inventory?action=products&company_id=${targetCompId}`, { headers: authHeaders() });
    const d = await res.json();
    if (d.success) loadedProducts = d.products || [];
  } catch (e) {}

  overlay.innerHTML = `
    <div class="modal-box" style="max-width:940px;width:98%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;">
      <div class="modal-header">
        <h3 style="font-size:17px;font-weight:700;color:var(--text1);margin:0;">📝 Multi-Product Purchase Entry & Stock Receipt</h3>
        <button class="modal-close closeMpModal">&times;</button>
      </div>

      <form id="multiPurchaseForm" style="display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;">
        <div class="modal-body" style="padding:20px;overflow-y:auto;flex:1;">
          <div class="form-grid" style="grid-template-columns:1.5fr 1fr 1fr 1fr;gap:10px 14px;margin-bottom:10px;background:var(--bg-primary);padding:14px;border-radius:10px;border:1px solid var(--border);">
            <div class="form-group" style="margin-bottom:0;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <label class="form-label" style="font-size:12px;font-weight:600;margin:0;">Select Primary Supplier *</label>
                <button type="button" class="btn btn-xs btn-outline" id="mpQuickSupBtn" style="padding:1px 6px;font-size:11px;">+ New</button>
              </div>
              <select id="mpSupplierId" class="form-select" style="padding:6px 10px;font-size:13px;" required>
                <option value="">-- Select Supplier --</option>
                ${suppliers.map(s => `<option value="${s.id}">${esc(s.legal_name)} ${s.trade_name ? `(${esc(s.trade_name)})` : ''}</option>`).join("")}
              </select>
            </div>

            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:4px;">Supplier Invoice / Bill No.</label>
              <input type="text" id="mpBillNo" class="form-input" placeholder="e.g. INV-2026-881" style="padding:6px 10px;font-size:13px;">
            </div>

            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:4px;">Invoice Date</label>
              <input type="date" id="mpDate" class="form-input" style="padding:6px 10px;font-size:13px;" value="${new Date().toISOString().split('T')[0]}">
            </div>

            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:4px;">Attach Supplier Invoice PDF/Image</label>
              <input type="file" id="mpFileInp" class="form-input" style="padding:4px 8px;font-size:12px;" accept="image/*,.pdf">
              <input type="hidden" id="mpFileBase64" value="">
            </div>
          </div>

          <!-- PAYMENT & INTEREST SETTINGS -->
          <div class="form-grid" style="grid-template-columns:1fr 1fr 1fr 1fr;gap:10px 14px;margin-bottom:14px;background:var(--bg-card, #f8fafc);padding:12px 14px;border-radius:8px;border:1px solid var(--border);">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:11.5px;font-weight:600;margin-bottom:3px;">Paid Amount (₹)</label>
              <input type="number" step="0.01" id="mpPaidAmt" class="form-input" placeholder="Leave blank if fully paid" style="padding:5px 8px;font-size:12.5px;">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:11.5px;font-weight:600;margin-bottom:3px;">Interest Rate (%)</label>
              <input type="number" step="0.01" id="mpInterestRate" class="form-input" placeholder="e.g. 1.5" style="padding:5px 8px;font-size:12.5px;">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:11.5px;font-weight:600;margin-bottom:3px;">Interest Frequency</label>
              <select id="mpInterestFreq" class="form-select" style="padding:5px 8px;font-size:12.5px;">
                <option value="monthly">Monthly</option>
                <option value="daily">Daily</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:11.5px;font-weight:600;margin-bottom:3px;">Payment Due Date</label>
              <input type="date" id="mpDueDate" class="form-input" style="padding:5px 8px;font-size:12.5px;">
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h4 style="font-size:14px;font-weight:700;color:var(--text1);margin:0;">📦 Purchase Items List</h4>
            <button type="button" class="btn btn-xs btn-outline" id="mpAddQuickProdHeaderBtn" style="font-size:12px;">✨ + Create New Product in Catalog</button>
          </div>

          <div class="table-container" style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-bottom:12px;">
            <table class="data-table" style="font-size:12.5px;">
              <thead>
                <tr style="background:var(--bg-secondary);">
                  <th style="width:40px;">#</th>
                  <th style="min-width:220px;">Product Name & Model</th>
                  <th style="width:120px;">Serial No.</th>
                  <th style="width:80px;">Qty</th>
                  <th style="width:110px;">Pur Rate (Excl ₹)</th>
                  <th style="width:80px;">GST %</th>
                  <th style="width:100px;">Transport (₹)</th>
                  <th style="width:120px;">Line Total (₹)</th>
                  <th style="width:40px;text-align:center;">Action</th>
                </tr>
              </thead>
              <tbody id="mpItemsTableBody">
              </tbody>
            </table>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <button type="button" class="btn btn-secondary btn-sm" id="mpAddRowBtn">+ Add Item Row</button>
            <div style="font-size:13px;font-weight:700;color:var(--text1);background:var(--bg-secondary);padding:8px 14px;border-radius:6px;border:1px solid var(--border);">
              Grand Total Billed: <span id="mpGrandTotalText" style="color:var(--primary);font-size:15px;margin-left:6px;">₹0.00</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary closeMpModal" style="padding:8px 18px;">Cancel</button>
          <button type="submit" class="btn btn-primary" style="padding:8px 22px;font-weight:600;">📥 Save Purchase Entry & Increment Stock</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelectorAll(".closeMpModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

  overlay.querySelector("#mpQuickSupBtn").addEventListener("click", () => {
    openSupplierModal(null, (newSup) => {
      if (newSup) {
        suppliers.push(newSup);
        const sel = overlay.querySelector("#mpSupplierId");
        sel.innerHTML = `<option value="">-- Select Supplier --</option>` +
          suppliers.map(s => `<option value="${s.id}">${esc(s.legal_name)} ${s.trade_name ? `(${esc(s.trade_name)})` : ''}</option>`).join("");
        sel.value = newSup.id;
      }
    });
  });

  const fileInp = overlay.querySelector("#mpFileInp");
  fileInp.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      overlay.querySelector("#mpFileBase64").value = evt.target.result;
    };
    reader.readAsDataURL(file);
  });

  const tbody = overlay.querySelector("#mpItemsTableBody");
  let itemRowIndex = 0;

  function renderProductOptionsHtml(selectedProdId = null) {
    return `<option value="">-- Select Product --</option>` +
      loadedProducts.map(p => `<option value="${p.id}" data-rate="${p.purchase_rate || 0}" data-gst="${p.gst_rate || 18}" data-serial="${esc(p.serial_no || '')}" ${p.id == selectedProdId ? 'selected' : ''}>${esc(p.name)} ${p.brand ? `(${esc(p.brand)})` : ''} - ${esc(p.model || 'No model')}</option>`).join("");
  }

  function addRow(initialProdId = null, initialQty = 1, initialRate = '', initialGst = 18, initialSerial = '') {
    itemRowIndex++;
    const tr = document.createElement("tr");
    tr.id = `mpRow_${itemRowIndex}`;
    tr.innerHTML = `
      <td>${tbody.children.length + 1}</td>
      <td>
        <div style="display:flex;gap:6px;align-items:center;">
          <select class="form-select mpProdSel" style="padding:4px 8px;font-size:12px;flex:1;" required>
            ${renderProductOptionsHtml(initialProdId)}
          </select>
          <button type="button" class="btn btn-xs btn-outline mpInlineAddProdBtn" title="Create New Product" style="padding:2px 6px;">+ New</button>
        </div>
      </td>
      <td><input type="text" class="form-input mpSerialNo" value="${esc(initialSerial)}" placeholder="Serial No" style="padding:4px 6px;font-size:12px;"></td>
      <td><input type="number" min="1" class="form-input mpQty" value="${initialQty}" required style="padding:4px 6px;font-size:12px;"></td>
      <td><input type="number" step="0.01" class="form-input mpRate" value="${initialRate}" required placeholder="0.00" style="padding:4px 6px;font-size:12px;"></td>
      <td><input type="number" step="0.01" class="form-input mpGst" value="${initialGst}" required style="padding:4px 6px;font-size:12px;"></td>
      <td><input type="number" step="0.01" class="form-input mpTransport" value="0" style="padding:4px 6px;font-size:12px;"></td>
      <td class="mpLineTotal" style="font-weight:700;color:var(--text1);vertical-align:middle;">₹0.00</td>
      <td style="text-align:center;"><button type="button" class="btn btn-xs btn-danger mpDelRowBtn" style="padding:2px 6px;">&times;</button></td>
    `;

    tbody.appendChild(tr);

    const prodSel = tr.querySelector(".mpProdSel");
    const qtyInp = tr.querySelector(".mpQty");
    const rateInp = tr.querySelector(".mpRate");
    const gstInp = tr.querySelector(".mpGst");
    const transportInp = tr.querySelector(".mpTransport");
    const totalTd = tr.querySelector(".mpLineTotal");

    function calcRowTotal() {
      const q = parseFloat(qtyInp.value || 0);
      const r = parseFloat(rateInp.value || 0);
      const g = parseFloat(gstInp.value || 0);
      const t = parseFloat(transportInp.value || 0);
      const tot = (q * r * (1 + g / 100)) + t;
      totalTd.textContent = `₹${tot.toFixed(2)}`;
      calcGrandTotal();
    }

    prodSel.addEventListener("change", () => {
      const opt = prodSel.options[prodSel.selectedIndex];
      if (opt && opt.value) {
        if (!rateInp.value || rateInp.value == 0) rateInp.value = opt.dataset.rate || 0;
        gstInp.value = opt.dataset.gst || 18;
      }
      calcRowTotal();
    });

    [qtyInp, rateInp, gstInp, transportInp].forEach(inp => inp.addEventListener("input", calcRowTotal));

    tr.querySelector(".mpInlineAddProdBtn").addEventListener("click", () => {
      openQuickAddProductModal((newP) => {
        loadedProducts.push(newP);
        tbody.querySelectorAll(".mpProdSel").forEach(sel => {
          const val = sel.value;
          sel.innerHTML = renderProductOptionsHtml(val);
        });
        prodSel.value = newP.id;
        rateInp.value = newP.purchase_rate || 0;
        gstInp.value = newP.gst_rate || 18;
        calcRowTotal();
      });
    });

    tr.querySelector(".mpDelRowBtn").addEventListener("click", () => {
      if (tbody.children.length <= 1) return alert("At least 1 item row required.");
      tr.remove();
      calcGrandTotal();
    });

    calcRowTotal();
  }

  function calcGrandTotal() {
    let grand = 0;
    tbody.querySelectorAll("tr").forEach(tr => {
      const q = parseFloat(tr.querySelector(".mpQty")?.value || 0);
      const r = parseFloat(tr.querySelector(".mpRate")?.value || 0);
      const g = parseFloat(tr.querySelector(".mpGst")?.value || 0);
      const t = parseFloat(tr.querySelector(".mpTransport")?.value || 0);
      grand += (q * r * (1 + g / 100)) + t;
    });
    overlay.querySelector("#mpGrandTotalText").textContent = `₹${grand.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
  }

  // Add initial row
  addRow();

  overlay.querySelector("#mpAddRowBtn").addEventListener("click", () => addRow());
  overlay.querySelector("#mpAddQuickProdHeaderBtn").addEventListener("click", () => {
    openQuickAddProductModal((newP) => {
      loadedProducts.push(newP);
      tbody.querySelectorAll(".mpProdSel").forEach(sel => {
        const val = sel.value;
        sel.innerHTML = renderProductOptionsHtml(val);
      });
      addRow(newP.id, 1, newP.purchase_rate || 0, newP.gst_rate || 18);
    });
  });

  overlay.querySelector("#multiPurchaseForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn && submitBtn.disabled) return;
    const origHtml = submitBtn ? submitBtn.innerHTML : "📦 Record All Purchase Items & Update Inventory";

    const supId = overlay.querySelector("#mpSupplierId").value;
    if (!supId) return alert("Please select a primary supplier.");

    const items = [];
    tbody.querySelectorAll("tr").forEach(tr => {
      const prodId = tr.querySelector(".mpProdSel").value;
      if (prodId) {
        items.push({
          product_id: prodId,
          serial_no: tr.querySelector(".mpSerialNo") ? tr.querySelector(".mpSerialNo").value.trim() : null,
          quantity: tr.querySelector(".mpQty").value,
          rate: tr.querySelector(".mpRate").value,
          gst_rate: tr.querySelector(".mpGst").value,
          transport_expenses: tr.querySelector(".mpTransport").value
        });
      }
    });

    if (items.length === 0) return alert("Please select at least 1 product.");

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving Entries...`;
    }

    const payload = {
      company_id: targetCompId,
      supplier_id: supId,
      bill_no: overlay.querySelector("#mpBillNo").value.trim(),
      purchase_date: overlay.querySelector("#mpDate").value,
      paid_amount: overlay.querySelector("#mpPaidAmt")?.value || null,
      interest_rate: overlay.querySelector("#mpInterestRate")?.value || 0,
      interest_frequency: overlay.querySelector("#mpInterestFreq")?.value || "monthly",
      due_date: overlay.querySelector("#mpDueDate")?.value || null,
      bill_doc: overlay.querySelector("#mpFileBase64").value || null,
      items
    };

    try {
      const res = await fetch(`${API_BASE}/inventory?action=multi-purchase-entry`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const d = await res.json();
      if (d.success) {
        showToast(d.message || "Multi-product purchase entry recorded!", "success");
        overlay.remove();
        if (onSuccessCallback) onSuccessCallback();
      } else {
        showToast(d.error || "Purchase entry failed", "error");
      }
    } catch (err) {
      showToast("Purchase error: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    }
  });
}

// ═══════════════════════════════════════════════════
// DOWNLOAD PURCHASE ENTRY CSV TEMPLATE
// ═══════════════════════════════════════════════════
window.downloadPurchaseEntryTemplateCSV = function() {
  const headers = [
    "Company", "Supplier Name", "Invoice No", "Invoice Date", "Product Name", "Brand", "Model", "Product Serial No",
    "HSN Code", "Weight (kg)", "Unit", "GST Rate (%)", "Purchase Rate Excl", "Quantity", "Transport Exp", "Selling Price",
    "Paid Amount", "Interest Rate (%)", "Interest Frequency (daily/monthly/yearly)", "Due Date"
  ];

  const compNames = getCompanyNamesForTemplate();
  const basePurchaseSamples = [
    ["Universal Spares", "INV-2026-001", "2026-09-23", "Engine Oil 15W40 5L", "Castrol", "CRB Turbo", "SN-9918231", "84328020", "5.0", "NOS", "5", "1250", "10", "500", " ", "5000", "1.5", "monthly", "2026-10-23"],
    ["Sonalika Motors", "INV-2026-002", "2026-09-23", "Power Tiller 13HP", "Shrachi", "Virat 13hp", "SN-10928374", "84328020", "145.5", "NOS", "5", "100000", "2", "2000", " ", "50000", "12", "yearly", "2027-03-23"]
  ];

  const sampleRows = [];
  compNames.forEach((compName, idx) => {
    const baseRow = basePurchaseSamples[idx % basePurchaseSamples.length];
    sampleRows.push([compName, ...baseRow]);
  });

  let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n";
  sampleRows.forEach(row => {
    csvContent += row.map(val => `"${val}"`).join(",") + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "Purchase_Entry_Template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Purchase Entry CSV Template downloaded!", "success");
};

// ═══════════════════════════════════════════════════
// BULK PURCHASE IMPORT VIA CSV/EXCEL MODAL
// ═══════════════════════════════════════════════════
function openPurchaseImportModal(onSuccessCallback) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(2px);";

  const compId = getActiveCompId();
  const targetCompId = (compId && compId !== 'all') ? compId : 1;

  overlay.innerHTML = `
    <div class="modal-box" style="max-width:850px;width:95%;background:var(--bg-primary);border-radius:12px;padding:22px;border:1px solid var(--border);box-shadow:0 20px 40px rgba(0,0,0,0.3);max-height:92vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:14px;">
        <h3 style="font-size:17px;font-weight:700;color:var(--text1);margin:0;">📥 Import Purchase Entries via CSV / Excel</h3>
        <button class="btn btn-sm btn-outline closePiModal" style="padding:2px 8px;">&times;</button>
      </div>

      <div style="background:var(--bg-card, #f8fafc);padding:12px 16px;border-radius:8px;border:1px solid var(--border);margin-bottom:14px;font-size:12.5px;color:var(--text2);line-height:1.4;">
        Upload a purchase entry spreadsheet file (.csv). Rows will be grouped by <strong>Company</strong>, <strong>Supplier Name</strong> and <strong>Invoice No</strong>.<br>
        <button type="button" class="btn btn-xs btn-outline" id="piDlTemplateInModalBtn" style="margin-top:6px;">📄 Download Sample CSV Template</button>
      </div>

      <div class="form-group" style="margin-bottom:14px;">
        <label class="form-label" style="font-size:12.5px;font-weight:600;">Select Purchase Entry CSV File *</label>
        <input type="file" id="piCsvFile" class="form-input" accept=".csv,.txt,.xlsx" style="padding:6px 10px;font-size:13px;">
      </div>

      <div id="piPreviewArea" style="display:none;">
        <h4 style="font-size:14px;font-weight:700;color:var(--text1);margin-bottom:8px;">📊 Spreadsheet Parsed Preview & Invoice Documents</h4>
        <div id="piGroupsContainer" style="display:flex;flex-direction:column;gap:14px;max-height:360px;overflow-y:auto;padding-right:4px;">
        </div>

        <div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center;background:var(--bg-card);padding:10px 14px;border-radius:8px;border:1px solid var(--border);">
          <div style="font-size:13px;font-weight:600;color:var(--text2);" id="piSummaryStats"></div>
          <button type="button" id="confirmPiImportBtn" class="btn btn-primary" style="padding:8px 20px;font-weight:600;">📥 Confirm & Process Bulk Purchase Entries</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelectorAll(".closePiModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

  overlay.querySelector("#piDlTemplateInModalBtn").addEventListener("click", () => downloadPurchaseEntryTemplateCSV());

  const fileInp = overlay.querySelector("#piCsvFile");
  let parsedGroups = [];

  fileInp.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const rawText = evt.target.result;
      const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) return alert("CSV file contains no data rows.");

      const parseCsvLine = (text) => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
          const c = text[i];
          if (c === '"') {
            if (inQuotes && text[i + 1] === '"') { cur += '"'; i++; }
            else { inQuotes = !inQuotes; }
          } else if (c === ',' && !inQuotes) {
            result.push(cur.trim());
            cur = '';
          } else { cur += c; }
        }
        result.push(cur.trim());
        return result;
      };

      const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
      const groupsMap = {};

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]).map(c => c.replace(/^["']|["']$/g, ""));
        if (cols.length === 0 || !cols[0]) continue;

        const rowObj = {};
        headers.forEach((h, idx) => { rowObj[h] = cols[idx] || ""; });

        const compName = rowObj["company"] || rowObj["companyname"] || null;
        const supName = rowObj["suppliername"] || rowObj["supplier"] || rowObj["dealer"] || "Direct Supplier";
        const invNo = rowObj["invoiceno"] || rowObj["billno"] || rowObj["invoice"] || "INV-BULK";
        const key = `${compName || 'Default'}::${supName}::${invNo}`;

        if (!groupsMap[key]) {
          groupsMap[key] = {
            company_name: compName,
            supplier_name: supName,
            bill_no: invNo,
            supplier_name: supName,
            bill_no: invNo,
            invoice_date: rowObj["invoicedate"] || rowObj["date"] || new Date().toISOString().split('T')[0],
            paid_amount: (rowObj["paidamount"] || rowObj["paid"]) !== undefined && (rowObj["paidamount"] || rowObj["paid"]) !== '' ? parseFloat(rowObj["paidamount"] || rowObj["paid"]) : undefined,
            interest_rate: parseFloat(rowObj["interestrate"] || rowObj["interest"] || 0),
            interest_frequency: rowObj["interestfrequency"] || rowObj["frequency"] || 'monthly',
            due_date: rowObj["duedate"] || rowObj["due"] || null,
            invoice_doc: null,
            items: []
          };
        }

        const pName = rowObj["productname"] || rowObj["name"] || rowObj["item"] || cols[3] || cols[0];
        if (!pName) continue;

        groupsMap[key].items.push({
          product_name: pName,
          brand: rowObj["brand"] || null,
          model: rowObj["model"] || null,
          serial_no: rowObj["productserialno"] || rowObj["serialno"] || rowObj["serial"] || null,
          hsn_sac: rowObj["hsncode"] || rowObj["hsn"] || null,
          weight: parseFloat(rowObj["weight"] || rowObj["weightkg"] || 0),
          unit_of_measure: rowObj["unit"] || "NOS",
          gst_rate: parseFloat(rowObj["gstrate"] || rowObj["gst"] || 18),
          purchase_rate: parseFloat(rowObj["purchaserateexcl"] || rowObj["purchaserate"] || rowObj["rate"] || 0),
          quantity: parseInt(rowObj["quantity"] || rowObj["qty"] || 1, 10),
          transport_expenses: parseFloat(rowObj["transportexp"] || rowObj["transport"] || 0),
          selling_price: parseFloat(rowObj["sellingprice"] || rowObj["mrp"] || 0)
        });
      }

      parsedGroups = Object.values(groupsMap);
      if (parsedGroups.length === 0) return alert("No valid rows parsed from CSV.");

      renderParsedPreview(parsedGroups);
    };
    reader.readAsText(file);
  });

  function renderParsedPreview(groups) {
    const previewArea = overlay.querySelector("#piPreviewArea");
    const container = overlay.querySelector("#piGroupsContainer");
    const statsDiv = overlay.querySelector("#piSummaryStats");

    let totalItems = 0;
    let totalGrand = 0;

    container.innerHTML = groups.map((g, gIdx) => {
      let gTotal = 0;
      const rowsHtml = g.items.map(item => {
        const lineTot = (item.quantity * item.purchase_rate * (1 + item.gst_rate / 100)) + item.transport_expenses;
        gTotal += lineTot;
        totalItems++;
        return `
          <tr>
            <td style="font-weight:600;color:var(--text1);white-space:nowrap;">${esc(item.product_name)}</td>
            <td style="white-space:nowrap;">${esc(item.brand || '—')} / ${esc(item.model || '—')}</td>
            <td>${esc(item.hsn_sac || '—')}</td>
            <td style="white-space:nowrap;"><span class="badge badge-purple">${item.quantity} ${esc(item.unit_of_measure)}</span></td>
            <td style="white-space:nowrap;">₹${item.purchase_rate.toFixed(2)}</td>
            <td>${item.gst_rate}%</td>
            <td style="font-weight:700;color:var(--text1);white-space:nowrap;">₹${lineTot.toFixed(2)}</td>
          </tr>
        `;
      }).join("");

      totalGrand += gTotal;

      return `
        <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;padding:12px 16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
            <div>
              <span class="badge badge-primary" style="font-size:12px;font-weight:700;">🚚 ${esc(g.supplier_name)}</span>
              <span style="font-size:12px;color:var(--text2);margin-left:8px;">Invoice: <strong>${esc(g.bill_no)}</strong> | Date: ${g.invoice_date}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <label style="font-size:11.5px;font-weight:600;color:var(--text2);white-space:nowrap;">📎 Invoice Doc:</label>
              <input type="file" class="piGroupDocInp" data-gidx="${gIdx}" accept="image/*,.pdf" style="font-size:11px;max-width:200px;">
            </div>
          </div>

          <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%;margin-bottom:10px;border-radius:6px;border:1px solid var(--border);">
            <table class="data-table" style="font-size:11.5px;width:100%;min-width:600px;margin:0;">
              <thead>
                <tr style="background:var(--bg-secondary);">
                  <th>Product Name</th>
                  <th>Brand / Model</th>
                  <th>HSN</th>
                  <th>Qty</th>
                  <th>Pur Rate (Excl)</th>
                  <th>GST %</th>
                  <th>Line Total</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(170px, 1fr));gap:10px;padding:10px 12px;background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border);">
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text2);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.4px;">PAID AMOUNT (₹)</label>
              <input type="number" class="form-input piPaidAmtInp" data-gidx="${gIdx}" value="${g.paid_amount !== undefined && g.paid_amount !== null && !isNaN(g.paid_amount) ? g.paid_amount : '0.00'}" step="0.01" min="0" placeholder="0.00" style="padding:6px 10px;font-size:12.5px;width:100%;box-sizing:border-radius:6px;background:var(--bg-primary);">
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text2);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.4px;">INTEREST RATE (%)</label>
              <input type="number" class="form-input piIntRateInp" data-gidx="${gIdx}" value="${g.interest_rate !== undefined && g.interest_rate !== null && !isNaN(g.interest_rate) ? g.interest_rate : '0.00'}" step="0.01" min="0" placeholder="0.00" style="padding:6px 10px;font-size:12.5px;width:100%;box-sizing:border-radius:6px;background:var(--bg-primary);">
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text2);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.4px;">INTEREST FREQUENCY</label>
              <select class="form-input piIntFreqInp" data-gidx="${gIdx}" style="padding:6px 10px;font-size:12.5px;width:100%;box-sizing:border-radius:6px;background:var(--bg-primary);">
                <option value="monthly" ${(g.interest_frequency || 'monthly').toLowerCase() === 'monthly' ? 'selected' : ''}>Monthly</option>
                <option value="daily" ${(g.interest_frequency || '').toLowerCase() === 'daily' ? 'selected' : ''}>Daily</option>
                <option value="yearly" ${(g.interest_frequency || '').toLowerCase() === 'yearly' ? 'selected' : ''}>Yearly</option>
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text2);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.4px;">PAYMENT DUE DATE</label>
              <input type="date" class="form-input piDueDateInp" data-gidx="${gIdx}" value="${g.due_date || ''}" style="padding:6px 10px;font-size:12.5px;width:100%;box-sizing:border-radius:6px;background:var(--bg-primary);">
            </div>
          </div>

          <div style="text-align:right;font-size:12.5px;font-weight:700;color:var(--success);margin-top:8px;">
            Subtotal Invoice Total: ₹${gTotal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}
          </div>
        </div>
      `;
    }).join("");

    const uniqueSuppliersCount = new Set(groups.map(g => (g.supplier_name || '').toString().trim().toLowerCase())).size;
    statsDiv.innerHTML = `Suppliers: <strong>${uniqueSuppliersCount}</strong> (${groups.length} Invoices) | Total Items: <strong>${totalItems}</strong> | Grand Billed: <strong style="color:var(--primary);">₹${totalGrand.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</strong>`;
    previewArea.style.display = "block";

    container.querySelectorAll(".piGroupDocInp").forEach(inp => {
      inp.addEventListener("change", (evt) => {
        const gIdx = evt.target.dataset.gidx;
        const file = evt.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (eRes) => {
          parsedGroups[gIdx].invoice_doc = eRes.target.result;
        };
        reader.readAsDataURL(file);
      });
    });

    const syncGroupFields = () => {
      overlay.querySelectorAll(".piPaidAmtInp").forEach(inp => {
        const gIdx = parseInt(inp.dataset.gidx, 10);
        if (parsedGroups[gIdx]) parsedGroups[gIdx].paid_amount = parseFloat(inp.value) || 0;
      });
      overlay.querySelectorAll(".piIntRateInp").forEach(inp => {
        const gIdx = parseInt(inp.dataset.gidx, 10);
        if (parsedGroups[gIdx]) parsedGroups[gIdx].interest_rate = parseFloat(inp.value) || 0;
      });
      overlay.querySelectorAll(".piIntFreqInp").forEach(inp => {
        const gIdx = parseInt(inp.dataset.gidx, 10);
        if (parsedGroups[gIdx]) parsedGroups[gIdx].interest_frequency = inp.value;
      });
      overlay.querySelectorAll(".piDueDateInp").forEach(inp => {
        const gIdx = parseInt(inp.dataset.gidx, 10);
        if (parsedGroups[gIdx]) parsedGroups[gIdx].due_date = inp.value || null;
      });
    };

    container.querySelectorAll(".piPaidAmtInp, .piIntRateInp, .piIntFreqInp, .piDueDateInp").forEach(inp => {
      inp.addEventListener("change", syncGroupFields);
      inp.addEventListener("input", syncGroupFields);
    });
  }

  overlay.querySelector("#confirmPiImportBtn").addEventListener("click", async () => {
    if (!parsedGroups || parsedGroups.length === 0) return alert("No parsed groups to import.");

    const btn = overlay.querySelector("#confirmPiImportBtn");
    if (btn && btn.disabled) return;
    const origHtml = btn ? btn.innerHTML : "Confirm & Import Purchase Entries";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Importing Entries...`;
    }

    // Final sync using overlay querySelectorAll (scope-safe!)
    overlay.querySelectorAll(".piPaidAmtInp").forEach(inp => {
      const gIdx = parseInt(inp.dataset.gidx, 10);
      if (parsedGroups[gIdx]) parsedGroups[gIdx].paid_amount = parseFloat(inp.value) || 0;
    });
    overlay.querySelectorAll(".piIntRateInp").forEach(inp => {
      const gIdx = parseInt(inp.dataset.gidx, 10);
      if (parsedGroups[gIdx]) parsedGroups[gIdx].interest_rate = parseFloat(inp.value) || 0;
    });
    overlay.querySelectorAll(".piIntFreqInp").forEach(inp => {
      const gIdx = parseInt(inp.dataset.gidx, 10);
      if (parsedGroups[gIdx]) parsedGroups[gIdx].interest_frequency = inp.value;
    });
    overlay.querySelectorAll(".piDueDateInp").forEach(inp => {
      const gIdx = parseInt(inp.dataset.gidx, 10);
      if (parsedGroups[gIdx]) parsedGroups[gIdx].due_date = inp.value || null;
    });

    try {
      const res = await fetch(`${API_BASE}/inventory?action=bulk-purchase-import`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ company_id: targetCompId, supplier_groups: parsedGroups })
      });
      const d = await res.json();
      if (d.success) {
        showToast(d.message || "Bulk purchase import completed successfully!", "success");
        overlay.remove();
        if (onSuccessCallback) onSuccessCallback();
      } else {
        const errMsg = (d.details && (d.error === "Server error" || !d.error)) ? d.details : (d.error || d.details || "Bulk import failed");
        showToast(errMsg, "error");
      }
    } catch (err) {
      showToast("Import error: " + err.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  });
}


// ═══════════════ SUBTAB 6: INVENTORY & STOCK ANALYTICS REPORTS ═══════════════
async function loadInventoryReportsSubTab() {
  const subContent = document.getElementById("invSubContent");
  if (!subContent) return;
  const compId = selectedCompanyId || "all";

  let activeReportType = "current-stock";
  let activeReportData = [];
  let activeReportSummary = {};

  const reportOptions = [
    { key: "current-stock", name: "📦 Current Stock", desc: "Real-time stock levels, rack locations & low stock alerts" },
    { key: "stock-valuation", name: "💰 Stock Valuation", desc: "Total asset value at purchase cost vs selling price & potential gross margins" },
    { key: "low-stock", name: "⚠️ Low-Stock / Reorder", desc: "Products below minimum threshold requiring fresh stock orders" },
    { key: "product-movement", name: "🔄 Product Movement", desc: "Inward stock receipts vs outward sales movement audit log" },
    { key: "purchase-register", name: "📜 Purchase Register", desc: "Comprehensive log of all supplier bills, purchase invoices & attachments" },
    { key: "supplier-purchase", name: "🏭 Supplier-Wise Purchase", desc: "Aggregated purchase volume, total spend & invoice breakdown by supplier" },
    { key: "product-purchase", name: "🏷️ Product-Wise Purchase", desc: "Total quantities & total expenditure breakdown by product" },
    { key: "serial-history", name: "🔢 Serial-Number History", desc: "Traceability audit trail of serialized equipment & batch numbers" },
    { key: "stock-adjustments", name: "⚖️ Stock Adjustments", desc: "Manual stock corrections, damages, returns & audit adjustments" },
    { key: "dead-slow-stock", name: "🐢 Dead / Slow-Moving", desc: "Items with zero or low movement in last 30/60/90 days tying up capital" }
  ];

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
      <div>
        <h3 style="font-size:18px;font-weight:700;color:var(--text1);margin:0;">📊 Inventory Analytics & Executive Reports</h3>
        <p style="font-size:13px;color:var(--text3);margin-top:2px;">Generate real-time reports for stock levels, valuations, movements, purchases & slow-moving inventory.</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="btn btn-outline btn-sm" id="printInvReportBtn">🖨️ Print Report</button>
        <button class="btn btn-primary btn-sm" id="exportInvReportCsvBtn">📥 Export CSV</button>
      </div>
    </div>

    <!-- REPORT TYPE SELECTOR PILLS GRID -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:8px;margin-bottom:20px;">
      ${reportOptions.map(r => `
        <button class="btn inv-report-pill ${r.key === activeReportType ? 'btn-primary' : 'btn-outline'}" data-repkey="${r.key}" style="justify-content:flex-start;text-align:left;padding:8px 12px;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${r.name}
        </button>
      `).join('')}
    </div>

    <!-- CONTROLS & SEARCH BAR -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:12px;flex-wrap:wrap;background:var(--bg-secondary);padding:12px 16px;border-radius:8px;border:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <label style="font-size:13px;font-weight:600;color:var(--text1);">Filter Report:</label>
        <input type="text" id="invReportSearchInput" class="form-input" placeholder="🔍 Search SKU, Product, Supplier..." style="width:240px;height:34px;font-size:13px;">
        <div id="extraReportFilters" style="display:flex;gap:8px;align-items:center;"></div>
      </div>
      <div id="invReportBadgeCount" style="font-size:13px;font-weight:600;color:var(--text2);">
        Loading data...
      </div>
    </div>

    <!-- SUMMARY KPI CARDS CONTAINER -->
    <div id="invReportKpiContainer" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;margin-bottom:20px;">
      <!-- KPI cards rendered dynamically -->
    </div>

    <!-- REPORT TABLE CONTAINER -->
    <div id="invReportPrintArea">
      <div style="display:none;" id="invReportPrintHeader">
        <h2 style="font-size:18px;margin-bottom:4px;" id="invReportPrintTitle">Inventory Report</h2>
        <p style="font-size:12px;color:#666;margin-bottom:16px;" id="invReportPrintSub">Generated on ${new Date().toLocaleDateString('en-IN')}</p>
      </div>
      <div class="table-container">
        <table class="data-table" id="invReportTable">
          <thead id="invReportTHead">
            <!-- Headers rendered dynamically -->
          </thead>
          <tbody id="invReportTBody">
            <tr><td colspan="10" style="text-align:center;padding:30px;"><div class="spinner"></div> Fetching report data...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Bind report pill switcher events
  subContent.querySelectorAll(".inv-report-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      subContent.querySelectorAll(".inv-report-pill").forEach(b => {
        b.classList.remove("btn-primary");
        b.classList.add("btn-outline");
      });
      btn.classList.remove("btn-outline");
      btn.classList.add("btn-primary");
      activeReportType = btn.dataset.repkey;
      fetchReportData();
    });
  });

  const searchInp = document.getElementById("invReportSearchInput");
  if (searchInp) {
    searchInp.addEventListener("input", () => renderTableAndKpis());
  }

  const printBtn = document.getElementById("printInvReportBtn");
  if (printBtn) {
    printBtn.addEventListener("click", () => {
      const repObj = reportOptions.find(o => o.key === activeReportType);
      const headerTitle = document.getElementById("invReportPrintTitle");
      const headerSub = document.getElementById("invReportPrintSub");
      if (headerTitle) headerTitle.textContent = `${repObj?.name || 'Inventory Report'} — ${selectedCompanyId === 'all' ? 'All Companies' : 'Company Report'}`;
      if (headerSub) headerSub.textContent = `Generated on: ${new Date().toLocaleString('en-IN')} | Search Filter: "${searchInp?.value || 'None'}"`;

      const printArea = document.getElementById("invReportPrintArea");
      if (!printArea) return;
      const printContents = printArea.innerHTML;
      const printWin = window.open('', '', 'height=700,width=900');
      printWin.document.write('<html><head><title>Print Report</title>');
      printWin.document.write('<style>body{font-family:sans-serif;padding:20px;color:#000;} table{width:100%;border-collapse:collapse;margin-top:10px;} th,td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:left;} th{background:#f5f5f5;font-weight:bold;} .badge{padding:2px 6px;border-radius:4px;font-size:11px;font-weight:bold;display:inline-block;}</style>');
      printWin.document.write('</head><body>');
      printWin.document.write(printContents);
      printWin.document.write('</body></html>');
      printWin.document.close();
      printWin.focus();
      setTimeout(() => { printWin.print(); printWin.close(); }, 500);
    });
  }

  const exportBtn = document.getElementById("exportInvReportCsvBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => exportReportToCsv());
  }

  async function fetchReportData() {
    const tbody = document.getElementById("invReportTBody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:30px;"><div class="spinner"></div> Fetching report data...</td></tr>`;

    const extraFilterDiv = document.getElementById("extraReportFilters");
    if (extraFilterDiv) {
      if (activeReportType === "dead-slow-stock") {
        extraFilterDiv.innerHTML = `
          <label style="font-size:12px;font-weight:600;">Inactive Days:</label>
          <select id="slowStockDaysSel" class="form-input" style="height:32px;font-size:12px;padding:2px 8px;">
            <option value="30">30+ Days</option>
            <option value="60">60+ Days</option>
            <option value="90">90+ Days</option>
            <option value="180">180+ Days</option>
          </select>
        `;
        document.getElementById("slowStockDaysSel")?.addEventListener("change", () => fetchReportData());
      } else {
        extraFilterDiv.innerHTML = ``;
      }
    }

    const daysVal = document.getElementById("slowStockDaysSel")?.value || 30;

    try {
      const res = await fetch(`${API_BASE}/inventory?action=inventory-reports&type=${activeReportType}&company_id=${compId}&days=${daysVal}`, {
        headers: authHeaders()
      });
      const data = await res.json();
      if (!data.success) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--danger);">Error: ${data.error || 'Failed to load report'}</td></tr>`;
        return;
      }

      activeReportData = data.data || [];
      activeReportSummary = data.summary || {};

      renderTableAndKpis();
    } catch (err) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--danger);">Error: ${err.message}</td></tr>`;
    }
  }

  function renderTableAndKpis() {
    const q = (searchInp?.value || '').toLowerCase().trim();
    let filtered = activeReportData;
    if (q) {
      filtered = activeReportData.filter(r => {
        return (r.name && r.name.toLowerCase().includes(q)) ||
               (r.product_name && r.product_name.toLowerCase().includes(q)) ||
               (r.sku && r.sku.toLowerCase().includes(q)) ||
               (r.legal_name && r.legal_name.toLowerCase().includes(q)) ||
               (r.supplier_name && r.supplier_name.toLowerCase().includes(q)) ||
               (r.brand && r.brand.toLowerCase().includes(q)) ||
               (r.purchase_invoice_no && r.purchase_invoice_no.toLowerCase().includes(q));
      });
    }

    const badgeCount = document.getElementById("invReportBadgeCount");
    if (badgeCount) badgeCount.textContent = `Showing ${filtered.length} of ${activeReportData.length} records`;

    renderKpiCards(filtered);
    renderTableRows(filtered);
  }

  function renderKpiCards(records) {
    const kpiDiv = document.getElementById("invReportKpiContainer");
    if (!kpiDiv) return;

    if (activeReportType === "current-stock") {
      let totQty = 0, totVal = 0, lowCount = 0;
      records.forEach(r => {
        totQty += (r.current_stock || 0);
        totVal += (r.current_stock || 0) * parseFloat(r.purchase_rate || 0);
        if ((r.current_stock || 0) <= (r.min_stock || 0)) lowCount++;
      });
      kpiDiv.innerHTML = `
        <div class="kpi-card" style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text3);font-weight:600;">Total Active SKUs</div>
          <div style="font-size:22px;font-weight:700;color:var(--text1);margin-top:4px;">${records.length}</div>
        </div>
        <div class="kpi-card" style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text3);font-weight:600;">Total Physical Quantity</div>
          <div style="font-size:22px;font-weight:700;color:var(--primary);margin-top:4px;">${totQty} <span style="font-size:13px;">NOS</span></div>
        </div>
        <div class="kpi-card" style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text3);font-weight:600;">Total Stock Cost Value</div>
          <div style="font-size:22px;font-weight:700;color:var(--success);margin-top:4px;">${formatCurrency(totVal)}</div>
        </div>
        <div class="kpi-card" style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text3);font-weight:600;">Low Stock Alerts</div>
          <div style="font-size:22px;font-weight:700;color:var(--warning);margin-top:4px;">${lowCount} SKUs</div>
        </div>
      `;
    } else if (activeReportType === "stock-valuation") {
      let costVal = 0, retailVal = 0, margin = 0;
      records.forEach(r => {
        costVal += (r.cost_valuation || 0);
        retailVal += (r.retail_valuation || 0);
        margin += (r.potential_margin || 0);
      });
      const marginPct = costVal > 0 ? ((margin / costVal) * 100).toFixed(2) : 0;
      kpiDiv.innerHTML = `
        <div class="kpi-card" style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text3);font-weight:600;">Cost Valuation (Purchase)</div>
          <div style="font-size:22px;font-weight:700;color:var(--text1);margin-top:4px;">${formatCurrency(costVal)}</div>
        </div>
        <div class="kpi-card" style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text3);font-weight:600;">Retail Valuation (Selling)</div>
          <div style="font-size:22px;font-weight:700;color:var(--success);margin-top:4px;">${formatCurrency(retailVal)}</div>
        </div>
        <div class="kpi-card" style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text3);font-weight:600;">Potential Gross Margin</div>
          <div style="font-size:22px;font-weight:700;color:var(--primary);margin-top:4px;">${formatCurrency(margin)}</div>
        </div>
        <div class="kpi-card" style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text3);font-weight:600;">Overall Margin %</div>
          <div style="font-size:22px;font-weight:700;color:var(--purple);margin-top:4px;">${marginPct}%</div>
        </div>
      `;
    } else if (activeReportType === "low-stock") {
      let defQty = 0, estCost = 0;
      records.forEach(r => {
        const def = Math.max(0, (r.min_stock || 0) - (r.current_stock || 0));
        defQty += def;
        estCost += def * parseFloat(r.purchase_rate || 0);
      });
      kpiDiv.innerHTML = `
        <div class="kpi-card" style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text3);font-weight:600;">Items Needing Reorder</div>
          <div style="font-size:22px;font-weight:700;color:var(--danger);margin-top:4px;">${records.length} SKUs</div>
        </div>
        <div class="kpi-card" style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text3);font-weight:600;">Total Deficit Units</div>
          <div style="font-size:22px;font-weight:700;color:var(--warning);margin-top:4px;">${defQty} NOS</div>
        </div>
        <div class="kpi-card" style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text3);font-weight:600;">Est. Reorder Budget Needed</div>
          <div style="font-size:22px;font-weight:700;color:var(--primary);margin-top:4px;">${formatCurrency(estCost)}</div>
        </div>
      `;
    } else if (activeReportType === "purchase-register") {
      let totAmt = 0;
      records.forEach(r => totAmt += parseFloat(r.grand_total || r.total_amount || 0));
      kpiDiv.innerHTML = `
        <div class="kpi-card" style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text3);font-weight:600;">Total Purchase Invoices</div>
          <div style="font-size:22px;font-weight:700;color:var(--text1);margin-top:4px;">${records.length} Bills</div>
        </div>
        <div class="kpi-card" style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text3);font-weight:600;">Total Purchase Expenditure</div>
          <div style="font-size:22px;font-weight:700;color:var(--success);margin-top:4px;">${formatCurrency(totAmt)}</div>
        </div>
      `;
    } else if (activeReportType === "supplier-purchase") {
      let totSpend = 0, totBills = 0;
      records.forEach(r => {
        totSpend += parseFloat(r.total_spend || 0);
        totBills += parseInt(r.total_bills || 0, 10);
      });
      kpiDiv.innerHTML = `
        <div class="kpi-card" style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text3);font-weight:600;">Active Suppliers</div>
          <div style="font-size:22px;font-weight:700;color:var(--text1);margin-top:4px;">${records.length} dealers</div>
        </div>
        <div class="kpi-card" style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text3);font-weight:600;">Total Billed Orders</div>
          <div style="font-size:22px;font-weight:700;color:var(--primary);margin-top:4px;">${totBills} POs</div>
        </div>
        <div class="kpi-card" style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text3);font-weight:600;">Total dealer Expenditure</div>
          <div style="font-size:22px;font-weight:700;color:var(--success);margin-top:4px;">${formatCurrency(totSpend)}</div>
        </div>
      `;
    } else if (activeReportType === "dead-slow-stock") {
      let totCap = 0, totUnits = 0;
      records.forEach(r => {
        totCap += parseFloat(r.tied_capital || 0);
        totUnits += (r.current_stock || 0);
      });
      kpiDiv.innerHTML = `
        <div class="kpi-card" style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text3);font-weight:600;">Slow / Dead SKUs</div>
          <div style="font-size:22px;font-weight:700;color:var(--danger);margin-top:4px;">${records.length} SKUs</div>
        </div>
        <div class="kpi-card" style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text3);font-weight:600;">Slow Inventory Quantity</div>
          <div style="font-size:22px;font-weight:700;color:var(--warning);margin-top:4px;">${totUnits} NOS</div>
        </div>
        <div class="kpi-card" style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text3);font-weight:600;">Tied-Up Capital</div>
          <div style="font-size:22px;font-weight:700;color:var(--danger);margin-top:4px;">${formatCurrency(totCap)}</div>
        </div>
      `;
    } else {
      kpiDiv.innerHTML = `
        <div class="kpi-card" style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text3);font-weight:600;">Total Records</div>
          <div style="font-size:22px;font-weight:700;color:var(--text1);margin-top:4px;">${records.length} Entries</div>
        </div>
      `;
    }
  }

  function renderTableRows(records) {
    const thead = document.getElementById("invReportTHead");
    const tbody = document.getElementById("invReportTBody");
    if (!thead || !tbody) return;

    if (records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--text3);">No records found matching current report criteria.</td></tr>`;
      return;
    }

    if (activeReportType === "current-stock") {
      thead.innerHTML = `
        <tr>
          <th>SKU</th>
          <th>Product Name</th>
          <th>Brand / Model</th>
          <th>Assigned Supplier</th>
          <th>In Stock</th>
          <th>Min Level</th>
          <th>Rack Location</th>
          <th>Status</th>
        </tr>
      `;
      tbody.innerHTML = records.map(r => {
        let statusBadge = '<span class="badge badge-success">In Stock</span>';
        if (r.current_stock <= 0) statusBadge = '<span class="badge badge-danger">Out of Stock</span>';
        else if (r.current_stock <= r.min_stock) statusBadge = '<span class="badge badge-warning">Low Stock</span>';

        return `
          <tr>
            <td><span class="badge badge-purple">${esc(r.sku || '—')}</span></td>
            <td style="font-weight:600;color:var(--text1);">${esc(r.name)}</td>
            <td>${esc(r.brand || '—')} / ${esc(r.model || '—')}</td>
            <td>${esc(r.supplier_name || 'Unassigned')}</td>
            <td style="font-weight:700;color:var(--text1);">${r.current_stock || 0} ${esc(r.unit || 'NOS')}</td>
            <td>${r.min_stock || 0}</td>
            <td>${esc(r.rack_no || '—')}</td>
            <td>${statusBadge}</td>
          </tr>
        `;
      }).join('');
    } else if (activeReportType === "stock-valuation") {
      thead.innerHTML = `
        <tr>
          <th>SKU</th>
          <th>Product Name</th>
          <th>In Stock</th>
          <th>Purchase Rate (₹)</th>
          <th>Selling Price (₹)</th>
          <th>Cost Valuation (₹)</th>
          <th>Retail Valuation (₹)</th>
          <th>Potential Margin (₹)</th>
          <th>Margin %</th>
        </tr>
      `;
      tbody.innerHTML = records.map(r => `
        <tr>
          <td><span class="badge badge-purple">${esc(r.sku || '—')}</span></td>
          <td style="font-weight:600;color:var(--text1);">${esc(r.name)}</td>
          <td>${r.current_stock || 0}</td>
          <td>${formatCurrency(r.purchase_rate)}</td>
          <td>${formatCurrency(r.selling_price)}</td>
          <td style="font-weight:600;">${formatCurrency(r.cost_valuation)}</td>
          <td style="font-weight:600;color:var(--success);">${formatCurrency(r.retail_valuation)}</td>
          <td style="font-weight:700;color:var(--primary);">${formatCurrency(r.potential_margin)}</td>
          <td><span class="badge badge-outline" style="font-weight:700;">${r.margin_percentage}%</span></td>
        </tr>
      `).join('');
    } else if (activeReportType === "low-stock") {
      thead.innerHTML = `
        <tr>
          <th>SKU</th>
          <th>Product Name</th>
          <th>Brand / Model</th>
          <th>Current Stock</th>
          <th>Min Threshold</th>
          <th>Deficit Qty</th>
          <th>Assigned Supplier</th>
          <th>Est. Reorder Cost</th>
        </tr>
      `;
      tbody.innerHTML = records.map(r => {
        const def = Math.max(0, (r.min_stock || 0) - (r.current_stock || 0));
        const estCost = def * parseFloat(r.purchase_rate || 0);
        return `
          <tr>
            <td><span class="badge badge-purple">${esc(r.sku || '—')}</span></td>
            <td style="font-weight:600;color:var(--text1);">${esc(r.name)}</td>
            <td>${esc(r.brand || '—')}</td>
            <td><span class="badge badge-danger">${r.current_stock || 0}</span></td>
            <td>${r.min_stock || 0}</td>
            <td style="font-weight:700;color:var(--warning);">+${def} NOS</td>
            <td>${esc(r.supplier_name || 'Unassigned')}</td>
            <td style="font-weight:700;color:var(--text1);">${formatCurrency(estCost)}</td>
          </tr>
        `;
      }).join('');
    } else if (activeReportType === "product-movement") {
      thead.innerHTML = `
        <tr>
          <th>Date & Time</th>
          <th>Product Name</th>
          <th>SKU</th>
          <th>Type</th>
          <th>Quantity</th>
          <th>Notes / Reference</th>
          <th>Performed By</th>
        </tr>
      `;
      tbody.innerHTML = records.map(r => {
        const isInc = r.transaction_type === 'receipt' || r.transaction_type === 'in';
        return `
          <tr>
            <td>${formatDate(r.created_at)}</td>
            <td style="font-weight:600;color:var(--text1);">${esc(r.product_name || 'Product')}</td>
            <td><span class="badge badge-purple">${esc(r.sku || '—')}</span></td>
            <td><span class="badge ${isInc ? 'badge-success' : 'badge-warning'}">${(r.transaction_type || 'movement').toUpperCase()}</span></td>
            <td style="font-weight:700;color:${isInc ? 'var(--success)' : 'var(--danger)'};">${isInc ? '+' : '-'}${Math.abs(r.quantity || 0)}</td>
            <td>${esc(r.notes || '—')}</td>
            <td>${esc(r.user_name || 'System')}</td>
          </tr>
        `;
      }).join('');
    } else if (activeReportType === "purchase-register") {
      thead.innerHTML = `
        <tr>
          <th>Date</th>
          <th>Bill / Invoice #</th>
          <th>Supplier</th>
          <th>Company</th>
          <th>Items Count</th>
          <th>Grand Total Amount</th>
          <th>Bill Attachment</th>
        </tr>
      `;
      tbody.innerHTML = records.map(r => {
        let docBtn = '—';
        try {
          const docs = typeof r.attachments_json === 'string' ? JSON.parse(r.attachments_json || "[]") : (r.attachments_json || []);
          if (Array.isArray(docs) && docs.length > 0 && docs[0]) {
            const token = encodeURIComponent(getToken() || localStorage.getItem("erp_token") || "");
            const viewUrl = `${API_BASE}/inventory?action=view-doc&id=${r.id}&token=${token}`;
            docBtn = `<a href="${viewUrl}" target="_blank" class="btn btn-xs btn-outline">📎 View Bill</a>`;
          }
        } catch (e) {}

        return `
          <tr>
            <td>${formatDate(r.purchase_date || r.created_at)}</td>
            <td><span class="badge badge-purple">${esc(r.purchase_invoice_no || 'N/A')}</span></td>
            <td style="font-weight:600;color:var(--text1);">${esc(r.supplier_name || 'Direct')}</td>
            <td>${esc(r.company_name || 'Default')}</td>
            <td>${r.items_count || 1} Products</td>
            <td style="font-weight:700;color:var(--success);">${formatCurrency(r.grand_total || r.total_amount)}</td>
            <td>${docBtn}</td>
          </tr>
        `;
      }).join('');
    } else if (activeReportType === "supplier-purchase") {
      thead.innerHTML = `
        <tr>
          <th>Supplier Legal Name</th>
          <th>Trade Name</th>
          <th>GSTIN</th>
          <th>Phone</th>
          <th>Total Purchase Bills</th>
          <th>Total Spend (₹)</th>
          <th>Avg Bill Value (₹)</th>
        </tr>
      `;
      tbody.innerHTML = records.map(r => `
        <tr>
          <td style="font-weight:600;color:var(--text1);">${esc(r.legal_name)}</td>
          <td>${esc(r.trade_name || '—')}</td>
          <td>${esc(r.gstin || 'Unregistered')}</td>
          <td>${esc(r.phone || '—')}</td>
          <td><span class="badge badge-outline">${r.total_bills || 0} Bills</span></td>
          <td style="font-weight:700;color:var(--success);">${formatCurrency(r.total_spend)}</td>
          <td>${formatCurrency(r.avg_bill_value)}</td>
        </tr>
      `).join('');
    } else if (activeReportType === "product-purchase") {
      thead.innerHTML = `
        <tr>
          <th>SKU</th>
          <th>Product Name</th>
          <th>Brand</th>
          <th>Times Purchased</th>
          <th>Total Qty Bought</th>
          <th>Avg Purchase Rate</th>
          <th>Total Expenditure</th>
        </tr>
      `;
      tbody.innerHTML = records.map(r => `
        <tr>
          <td><span class="badge badge-purple">${esc(r.sku || '—')}</span></td>
          <td style="font-weight:600;color:var(--text1);">${esc(r.product_name)}</td>
          <td>${esc(r.brand || '—')}</td>
          <td>${r.total_purchases_count || 0}</td>
          <td style="font-weight:600;">${r.total_qty_purchased || 0} NOS</td>
          <td>${formatCurrency(r.avg_rate)}</td>
          <td style="font-weight:700;color:var(--success);">${formatCurrency(r.total_spend)}</td>
        </tr>
      `).join('');
    } else if (activeReportType === "serial-history") {
      thead.innerHTML = `
        <tr>
          <th>Date</th>
          <th>Product Name</th>
          <th>SKU</th>
          <th>Type</th>
          <th>Quantity</th>
          <th>Serial / Batch Data</th>
          <th>Handled By</th>
        </tr>
      `;
      tbody.innerHTML = records.map(r => `
        <tr>
          <td>${formatDate(r.created_at)}</td>
          <td style="font-weight:600;color:var(--text1);">${esc(r.product_name)}</td>
          <td><span class="badge badge-purple">${esc(r.sku || '—')}</span></td>
          <td><span class="badge badge-outline">${(r.transaction_type || 'log').toUpperCase()}</span></td>
          <td>${r.quantity || 0}</td>
          <td><code style="font-size:12px;background:var(--bg-primary);padding:2px 6px;border-radius:4px;">${esc(r.serial_numbers_json || r.notes || '—')}</code></td>
          <td>${esc(r.user_name || 'System')}</td>
        </tr>
      `).join('');
    } else if (activeReportType === "stock-adjustments") {
      thead.innerHTML = `
        <tr>
          <th>Date</th>
          <th>Product Name</th>
          <th>SKU</th>
          <th>Adjustment Type</th>
          <th>Adjusted Qty</th>
          <th>Notes / Reason</th>
          <th>Adjusted By</th>
        </tr>
      `;
      tbody.innerHTML = records.map(r => `
        <tr>
          <td>${formatDate(r.created_at)}</td>
          <td style="font-weight:600;color:var(--text1);">${esc(r.product_name)}</td>
          <td><span class="badge badge-purple">${esc(r.sku || '—')}</span></td>
          <td><span class="badge badge-warning">${(r.transaction_type || 'adjustment').toUpperCase()}</span></td>
          <td style="font-weight:700;color:var(--danger);">${r.quantity || 0}</td>
          <td>${esc(r.notes || '—')}</td>
          <td>${esc(r.user_name || 'Admin')}</td>
        </tr>
      `).join('');
    } else if (activeReportType === "dead-slow-stock") {
      thead.innerHTML = `
        <tr>
          <th>SKU</th>
          <th>Product Name</th>
          <th>Brand / Model</th>
          <th>Supplier</th>
          <th>Current Stock</th>
          <th>Purchase Rate (₹)</th>
          <th>Tied-Up Capital (₹)</th>
          <th>Last Movement</th>
        </tr>
      `;
      tbody.innerHTML = records.map(r => `
        <tr>
          <td><span class="badge badge-purple">${esc(r.sku || '—')}</span></td>
          <td style="font-weight:600;color:var(--text1);">${esc(r.name)}</td>
          <td>${esc(r.brand || '—')}</td>
          <td>${esc(r.supplier_name || 'Unassigned')}</td>
          <td style="font-weight:700;color:var(--warning);">${r.current_stock || 0} NOS</td>
          <td>${formatCurrency(r.purchase_rate)}</td>
          <td style="font-weight:700;color:var(--danger);">${formatCurrency(r.tied_capital)}</td>
          <td>${r.last_movement_date ? formatDate(r.last_movement_date) : '⚠️ No Recent Movement'}</td>
        </tr>
      `).join('');
    }
  }

  function exportReportToCsv() {
    if (!activeReportData || activeReportData.length === 0) {
      showToast("No data to export", "warning");
      return;
    }
    const headers = Object.keys(activeReportData[0]).filter(k => typeof activeReportData[0][k] !== 'object');
    let csv = headers.join(",") + "\n";
    activeReportData.forEach(row => {
      csv += headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(",") + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `inventory_report_${activeReportType}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showToast("CSV Export downloaded!", "success");
  }

  fetchReportData();
}

// ═══════════════════════════════════════════════════
// SUB-TAB: HSN Master & GST Rates Management
// ═══════════════════════════════════════════════════
async function loadHsnMasterSubTab() {
  const subContent = document.getElementById("invSubContent");
  if (!subContent) return;

  subContent.innerHTML = `
    <div style="padding:20px;">
      <!-- Header Bar -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
        <div>
          <h2 style="font-size:20px;font-weight:700;color:var(--text1,#0f172a);margin:0 0 4px 0;display:flex;align-items:center;gap:8px;">
            🏷️ HSN / SAC Codes & GST Rates Master
          </h2>
          <p style="font-size:13px;color:var(--text2,#64748b);margin:0;">
            Superadmin Management screen for standardized HSN/SAC codes and default GST percentage rates.
          </p>
        </div>
        <button class="btn btn-primary" id="addHsnBtn" style="display:inline-flex;align-items:center;gap:6px;font-weight:600;padding:8px 16px;">
          <span>➕</span> Add New HSN Code
        </button>
      </div>

      <!-- Summary Stats Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px;margin-bottom:20px;">
        <div class="card" style="padding:16px;background:var(--bg-card,#fff);border-radius:10px;border:1px solid var(--border,#e2e8f0);">
          <div style="font-size:12px;font-weight:600;color:var(--text3,#94a3b8);text-transform:uppercase;">Total Registered HSN</div>
          <div style="font-size:24px;font-weight:800;color:var(--text1,#0f172a);margin-top:4px;" id="statTotalHsn">0</div>
        </div>
        <div class="card" style="padding:16px;background:var(--bg-card,#fff);border-radius:10px;border:1px solid var(--border,#e2e8f0);">
          <div style="font-size:12px;font-weight:600;color:var(--text3,#94a3b8);text-transform:uppercase;">Active HSN Codes</div>
          <div style="font-size:24px;font-weight:800;color:#10b981;margin-top:4px;" id="statActiveHsn">0</div>
        </div>
        <div class="card" style="padding:16px;background:var(--bg-card,#fff);border-radius:10px;border:1px solid var(--border,#e2e8f0);">
          <div style="font-size:12px;font-weight:600;color:var(--text3,#94a3b8);text-transform:uppercase;">18% GST Bracket</div>
          <div style="font-size:24px;font-weight:800;color:#6366f1;margin-top:4px;" id="stat18Gst">0</div>
        </div>
        <div class="card" style="padding:16px;background:var(--bg-card,#fff);border-radius:10px;border:1px solid var(--border,#e2e8f0);">
          <div style="font-size:12px;font-weight:600;color:var(--text3,#94a3b8);text-transform:uppercase;">12% GST Bracket</div>
          <div style="font-size:24px;font-weight:800;color:#3b82f6;margin-top:4px;" id="stat12Gst">0</div>
        </div>
      </div>

      <!-- Controls & Filter -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:12px;flex-wrap:wrap;">
        <div style="position:relative;min-width:280px;max-width:400px;flex:1;">
          <input type="text" id="hsnSearchInput" class="form-input" placeholder="🔍 Search HSN Code or Description..." style="padding-left:34px;width:100%;">
          <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:14px;color:var(--text3);">🔍</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <select id="hsnRateFilter" class="form-select" style="min-width:140px;">
            <option value="all">All GST Rates</option>
            <option value="0">0% GST</option>
            <option value="5">5% GST</option>
            <option value="12">12% GST</option>
            <option value="18">18% GST</option>
            <option value="28">28% GST</option>
          </select>
        </div>
      </div>

      <!-- HSN Table -->
      <div class="table-container" style="background:var(--bg-card,#fff);border-radius:10px;border:1px solid var(--border,#e2e8f0);overflow:hidden;">
        <table class="data-table" style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:var(--bg-subtle,#f8fafc);border-bottom:1px solid var(--border,#e2e8f0);">
              <th style="padding:12px 16px;text-align:left;font-size:13px;font-weight:600;color:var(--text2);">HSN / SAC Code</th>
              <th style="padding:12px 16px;text-align:left;font-size:13px;font-weight:600;color:var(--text2);">Description / Category</th>
              <th style="padding:12px 16px;text-align:center;font-size:13px;font-weight:600;color:var(--text2);">GST Rate (%)</th>
              <th style="padding:12px 16px;text-align:center;font-size:13px;font-weight:600;color:var(--text2);">Status</th>
              <th style="padding:12px 16px;text-align:center;font-size:13px;font-weight:600;color:var(--text2);">Last Updated</th>
              <th style="padding:12px 16px;text-align:right;font-size:13px;font-weight:600;color:var(--text2);">Actions</th>
            </tr>
          </thead>
          <tbody id="hsnTableBody">
            <tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text3);">Loading HSN codes...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  let hsnList = [];

  async function fetchHsnList() {
    try {
      const res = await fetch(`${API_BASE}/inventory?action=hsn-list`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load HSN codes");

      hsnList = data.hsn_codes || [];
      updateStats(hsnList);
      renderTable();
    } catch (err) {
      showToast("Error: " + err.message, "error");
    }
  }

  function updateStats(list) {
    document.getElementById("statTotalHsn").textContent = list.length;
    document.getElementById("statActiveHsn").textContent = list.filter(h => h.is_active).length;
    document.getElementById("stat18Gst").textContent = list.filter(h => parseFloat(h.gst_rate) === 18).length;
    document.getElementById("stat12Gst").textContent = list.filter(h => parseFloat(h.gst_rate) === 12).length;
  }

  function renderTable() {
    const tbody = document.getElementById("hsnTableBody");
    if (!tbody) return;

    const query = (document.getElementById("hsnSearchInput")?.value || "").trim().toLowerCase();
    const rateFilter = document.getElementById("hsnRateFilter")?.value || "all";

    const filtered = hsnList.filter(h => {
      const matchQuery = !query || h.code.toLowerCase().includes(query) || (h.description && h.description.toLowerCase().includes(query));
      const matchRate = rateFilter === "all" || Math.abs(parseFloat(h.gst_rate) - parseFloat(rateFilter)) < 0.01;
      return matchQuery && matchRate;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text3);">No HSN / SAC codes found. Click <strong>+ Add New HSN Code</strong> to register one.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(h => {
      const updatedStr = h.updated_at ? new Date(h.updated_at).toLocaleDateString() : '—';
      return `
        <tr style="border-bottom:1px solid var(--border,#e2e8f0);">
          <td style="padding:12px 16px;font-weight:700;font-family:monospace;color:var(--text1,#0f172a);">
            <span class="badge badge-purple" style="font-size:13px;padding:4px 8px;">${esc(h.code)}</span>
          </td>
          <td style="padding:12px 16px;color:var(--text2,#334155);max-width:300px;">
            ${esc(h.description || 'Standard Goods/Services HSN Code')}
          </td>
          <td style="padding:12px 16px;text-align:center;">
            <span class="badge badge-success" style="font-size:13px;font-weight:700;">${parseFloat(h.gst_rate || 0)}%</span>
          </td>
          <td style="padding:12px 16px;text-align:center;">
            <span class="badge ${h.is_active ? 'badge-success' : 'badge-danger'}">
              ${h.is_active ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td style="padding:12px 16px;text-align:center;font-size:12px;color:var(--text3);">
            ${updatedStr}
          </td>
          <td style="padding:12px 16px;text-align:right;">
            <button class="btn btn-sm btn-secondary editHsnBtn" data-id="${h.id}" style="margin-right:6px;">✏️ Edit</button>
            <button class="btn btn-sm btn-danger deleteHsnBtn" data-id="${h.id}">🗑️ Delete</button>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll(".editHsnBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = hsnList.find(h => h.id == btn.dataset.id);
        if (item) showHsnModal(item);
      });
    });

    tbody.querySelectorAll(".deleteHsnBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = hsnList.find(h => h.id == btn.dataset.id);
        if (item) {
          showConfirmModal({
            title: "Delete HSN Code",
            message: `Are you sure you want to delete HSN Code "${item.code}"?`,
            confirmText: "Delete HSN",
            onConfirm: async () => {
              try {
                const res = await fetch(`${API_BASE}/inventory?action=delete-hsn&id=${item.id}`, {
                  method: "POST",
                  headers: authHeaders()
                });
                const data = await res.json();
                if (data.success) {
                  showToast("HSN Code deleted!", "success");
                  fetchHsnList();
                } else throw new Error(data.error);
              } catch (err) {
                showToast(err.message, "error");
              }
            }
          });
        }
      });
    });
  }

  document.getElementById("addHsnBtn").addEventListener("click", () => showHsnModal(null));
  document.getElementById("hsnSearchInput").addEventListener("input", renderTable);
  document.getElementById("hsnRateFilter").addEventListener("change", renderTable);

  await fetchHsnList();

  function showHsnModal(hsnObj) {
    const isEdit = !!hsnObj;
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px);";

    overlay.innerHTML = `
      <div class="modal-box" style="max-width:480px;width:100%;background:var(--bg-card,#fff);border-radius:12px;padding:24px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
          <h3 style="font-size:18px;font-weight:700;color:var(--text1,#0f172a);margin:0;">
            ${isEdit ? '✏️ Edit HSN / SAC Code' : '➕ Add New HSN / SAC Code'}
          </h3>
          <button class="modal-close" id="hsnModalClose" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text3);">&times;</button>
        </div>
        <form id="hsnForm">
          <input type="hidden" id="hsnId" value="${hsnObj?.id || ''}">
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">HSN / SAC Code *</label>
            <input type="text" id="hsnCodeInput" class="form-input" style="width:100%;font-weight:700;" placeholder="e.g. 84328020" value="${esc(hsnObj?.code || '')}" required>
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">Default GST Rate (%) *</label>
            <select id="hsnGstRateInput" class="form-select" style="width:100%;font-weight:700;">
              <option value="0" ${hsnObj?.gst_rate == 0 ? 'selected' : ''}>0% (Exempt)</option>
              <option value="5" ${hsnObj?.gst_rate == 5 ? 'selected' : ''}>5% GST</option>
              <option value="12" ${hsnObj?.gst_rate == 12 ? 'selected' : ''}>12% GST</option>
              <option value="18" ${!hsnObj || hsnObj?.gst_rate == 18 ? 'selected' : ''}>18% GST (Standard)</option>
              <option value="28" ${hsnObj?.gst_rate == 28 ? 'selected' : ''}>28% GST (Luxury / High)</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">Description / Category Details</label>
            <textarea id="hsnDescInput" class="form-input" style="width:100%;height:70px;resize:vertical;" placeholder="e.g. Agricultural Machinery & Implements Parts">${esc(hsnObj?.description || '')}</textarea>
          </div>
          <div class="form-group" style="margin-bottom:20px;display:flex;align-items:center;gap:8px;">
            <input type="checkbox" id="hsnActiveInput" ${!hsnObj || hsnObj.is_active ? 'checked' : ''} style="width:16px;height:16px;">
            <label for="hsnActiveInput" style="font-size:13px;font-weight:600;color:var(--text1);cursor:pointer;">Active HSN Code for Products</label>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" class="btn btn-secondary" id="hsnModalCancel">Cancel</button>
            <button type="submit" class="btn btn-primary" style="font-weight:600;">Save HSN Code</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    overlay.querySelector("#hsnModalClose").addEventListener("click", closeModal);
    overlay.querySelector("#hsnModalCancel").addEventListener("click", closeModal);

    overlay.querySelector("#hsnForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector("button[type='submit']");
      if (submitBtn && submitBtn.disabled) return;
      const origHtml = submitBtn ? submitBtn.innerHTML : "Save HSN Code";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving...`;
      }

      const payload = {
        id: document.getElementById("hsnId").value || null,
        code: document.getElementById("hsnCodeInput").value.trim(),
        gst_rate: parseFloat(document.getElementById("hsnGstRateInput").value),
        description: document.getElementById("hsnDescInput").value.trim(),
        is_active: document.getElementById("hsnActiveInput").checked
      };

      try {
        const res = await fetch(`${API_BASE}/inventory?action=save-hsn`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || "HSN Code saved!", "success");
          closeModal();
          fetchHsnList();
        } else {
          showToast(data.error || "Failed to save HSN Code", "error");
        }
      } catch (err) {
        showToast("Error: " + err.message, "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origHtml;
        }
      }
    });
  }
}

// ═══════════════════════════════════════════════════
// SUBTAB: SUPPLIER PAYABLES & INTEREST TRACKER
// ═══════════════════════════════════════════════════
async function loadPayablesSubTab() {
  const subContent = document.getElementById("invSubContent");
  const compId = getActiveCompId();

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <div>
        <h3 style="font-size:16px;font-weight:600;color:var(--text1);margin:0;">💳 Supplier Payables & Interest Tracker</h3>
        <div style="font-size:12px;color:var(--text3);margin-top:2px;">Track outstanding supplier balances, auto-calculate interest (daily/monthly/yearly), and record payments.</div>
      </div>
      <button class="btn btn-secondary btn-sm" id="refreshPayablesBtn">🔄 Refresh Data</button>
    </div>

    <!-- STATS CARDS -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;margin-bottom:20px;">
      <div class="card" style="padding:14px 18px;border-left:4px solid #ef4444;">
        <div style="font-size:12px;color:var(--text3);font-weight:600;text-transform:uppercase;">Total Net Pending</div>
        <div style="font-size:22px;font-weight:800;color:#ef4444;margin-top:4px;" id="statNetPayable">₹0.00</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">Principal + Accrued Interest</div>
      </div>
      <div class="card" style="padding:14px 18px;border-left:4px solid #f59e0b;">
        <div style="font-size:12px;color:var(--text3);font-weight:600;text-transform:uppercase;">Accrued Interest</div>
        <div style="font-size:22px;font-weight:800;color:#f59e0b;margin-top:4px;" id="statInterestAccrued">₹0.00</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">Based on Rate & Frequency</div>
      </div>
      <div class="card" style="padding:14px 18px;border-left:4px solid #3b82f6;">
        <div style="font-size:12px;color:var(--text3);font-weight:600;text-transform:uppercase;">Total Pending Principal</div>
        <div style="font-size:22px;font-weight:800;color:#3b82f6;margin-top:4px;" id="statPendingPrincipal">₹0.00</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">Unpaid Billed Principal</div>
      </div>
      <div class="card" style="padding:14px 18px;border-left:4px solid #10b981;">
        <div style="font-size:12px;color:var(--text3);font-weight:600;text-transform:uppercase;">Total Paid to Suppliers</div>
        <div style="font-size:22px;font-weight:800;color:#10b981;margin-top:4px;" id="statTotalPaid">₹0.00</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">Settled Purchases</div>
      </div>
    </div>

    <!-- FILTERS -->
    <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:center;background:var(--bg-card);padding:12px 16px;border-radius:8px;border:1px solid var(--border);">
      <input type="text" id="payablesSearchInput" class="form-input" placeholder="🔍 Search Supplier, Bill #..." style="max-width:260px;font-size:13px;">
      <select id="payablesStatusFilter" class="form-select" style="max-width:180px;font-size:13px;">
        <option value="all">All Statuses</option>
        <option value="unpaid" selected>Pending / Unpaid / Partial</option>
        <option value="paid">Fully Paid</option>
      </select>
    </div>

    <!-- TABLE -->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date / Bill #</th>
            <th>Supplier Name</th>
            <th>Grand Total</th>
            <th>Paid</th>
            <th>Pending Principal</th>
            <th>Interest Config</th>
            <th>Days Elapsed</th>
            <th>Accrued Interest</th>
            <th>Net Payable</th>
            <th>Status</th>
            <th style="text-align:center;">Actions</th>
          </tr>
        </thead>
        <tbody id="payablesTableBody">
          <tr><td colspan="11" style="text-align:center;padding:20px;"><div class="spinner"></div> Fetching supplier payables...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  let payablesData = [];

  async function fetchPayables() {
    try {
      const targetCompId = (compId && compId !== 'all') ? compId : 1;
      const res = await fetch(`${API_BASE}/inventory?action=payables-list&company_id=${targetCompId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) {
        showToast(data.error || "Failed to load payables", "error");
        return;
      }
      payablesData = data.payables || [];
      renderPayablesTable();
    } catch (err) {
      showToast("Error loading payables: " + err.message, "error");
    }
  }

  function renderPayablesTable() {
    const search = (document.getElementById("payablesSearchInput")?.value || "").toLowerCase();
    const statusFilter = document.getElementById("payablesStatusFilter")?.value || "unpaid";

    let filtered = payablesData.filter(p => {
      const matchSearch = !search ||
        (p.supplier_legal_name || '').toLowerCase().includes(search) ||
        (p.supplier_trade_name || '').toLowerCase().includes(search) ||
        (p.purchase_invoice_no || '').toLowerCase().includes(search);

      let matchStatus = true;
      if (statusFilter === 'unpaid') {
        matchStatus = p.payment_status !== 'paid' && parseFloat(p.pending_amount || 0) > 0;
      } else if (statusFilter === 'paid') {
        matchStatus = p.payment_status === 'paid' || parseFloat(p.pending_amount || 0) <= 0;
      }

      return matchSearch && matchStatus;
    });

    // Compute Stat Totals
    let totNet = 0, totInterest = 0, totPending = 0, totPaid = 0;
    payablesData.forEach(p => {
      totNet += parseFloat(p.net_payable || 0);
      totInterest += parseFloat(p.accrued_interest || 0);
      totPending += parseFloat(p.pending_amount || 0);
      totPaid += parseFloat(p.paid_amount || 0);
    });

    if (document.getElementById("statNetPayable")) document.getElementById("statNetPayable").textContent = `₹${totNet.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    if (document.getElementById("statInterestAccrued")) document.getElementById("statInterestAccrued").textContent = `₹${totInterest.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    if (document.getElementById("statPendingPrincipal")) document.getElementById("statPendingPrincipal").textContent = `₹${totPending.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    if (document.getElementById("statTotalPaid")) document.getElementById("statTotalPaid").textContent = `₹${totPaid.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

    const tbody = document.getElementById("payablesTableBody");
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--text3);">No matching supplier payables found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const pDate = p.purchase_date ? new Date(p.purchase_date).toLocaleDateString('en-IN') : '—';
      const statusBadge = p.payment_status === 'paid' ? '<span class="badge badge-success">Paid</span>' :
                          (p.payment_status === 'partial' ? '<span class="badge badge-warning">Partial</span>' :
                          '<span class="badge badge-danger">Unpaid</span>');

      const freqLabel = p.interest_frequency ? p.interest_frequency.charAt(0).toUpperCase() + p.interest_frequency.slice(1) : 'Monthly';
      const intRateDisplay = parseFloat(p.interest_rate || 0) > 0 ? `${p.interest_rate}% / ${freqLabel}` : '<span style="color:var(--text3);">0%</span>';
      const daysElapsed = p.days_elapsed !== undefined ? p.days_elapsed : 0;
      const accruedInt = parseFloat(p.accrued_interest || 0);
      const netPay = parseFloat(p.net_payable || 0);
      const pending = parseFloat(p.pending_amount || 0);

      return `
        <tr>
          <td>
            <div style="font-weight:700;color:var(--text1);">${esc(p.purchase_invoice_no || 'Bill #' + p.id)}</div>
            <div style="font-size:11px;color:var(--text3);">${pDate}</div>
          </td>
          <td>
            <div style="font-weight:700;color:var(--primary);">${esc(p.supplier_legal_name || 'Direct Supplier')}</div>
            ${p.supplier_phone ? `<div style="font-size:11px;color:var(--text3);">📞 ${esc(p.supplier_phone)}</div>` : ''}
          </td>
          <td style="font-weight:600;">₹${parseFloat(p.grand_total || p.total_amount || 0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
          <td style="color:var(--success);font-weight:600;">₹${parseFloat(p.paid_amount || 0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
          <td style="color:#ef4444;font-weight:700;">₹${pending.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
          <td><span class="badge badge-outline" style="font-size:11px;">${intRateDisplay}</span></td>
          <td><span class="badge badge-purple" style="font-size:11px;">${daysElapsed} days</span></td>
          <td style="color:#f59e0b;font-weight:700;">₹${accruedInt.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
          <td style="color:var(--primary);font-weight:800;font-size:13.5px;">₹${netPay.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
          <td>${statusBadge}</td>
          <td style="text-align:center;">
            <div style="display:flex;gap:6px;justify-content:center;">
              ${pending > 0 ? `<button class="btn btn-xs btn-success paySupplierBtn" data-id="${p.id}" style="white-space:nowrap;padding:4px 8px;">💳 Pay</button>` : ''}
              <button class="btn btn-xs btn-outline editInterestBtn" data-id="${p.id}" style="white-space:nowrap;padding:4px 8px;" title="Set Interest Rate & Frequency">⚙️ Interest</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll(".paySupplierBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const purchase = payablesData.find(x => x.id == id);
        if (purchase) openRecordPaymentModal(purchase, fetchPayables);
      });
    });

    tbody.querySelectorAll(".editInterestBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const purchase = payablesData.find(x => x.id == id);
        if (purchase) openInterestConfigModal(purchase, fetchPayables);
      });
    });
  }

  document.getElementById("refreshPayablesBtn")?.addEventListener("click", fetchPayables);
  document.getElementById("payablesSearchInput")?.addEventListener("input", renderPayablesTable);
  document.getElementById("payablesStatusFilter")?.addEventListener("change", renderPayablesTable);

  await fetchPayables();
}

// ── Modal: Record Payment to Supplier ──
function openRecordPaymentModal(purchase, onSuccess) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px);";

  const pending = parseFloat(purchase.pending_amount || 0);
  const interest = parseFloat(purchase.accrued_interest || 0);
  const netPay = parseFloat(purchase.net_payable || 0);

  overlay.innerHTML = `
    <div class="modal-box" style="max-width:480px;width:100%;background:var(--bg-primary);border-radius:12px;padding:22px;border:1px solid var(--border);box-shadow:0 20px 30px rgba(0,0,0,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:14px;">
        <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">💳 Record Supplier Payment</h3>
        <button class="modal-close closePayModal">&times;</button>
      </div>

      <div style="background:var(--bg-card,#f8fafc);padding:12px;border-radius:8px;border:1px solid var(--border);margin-bottom:14px;font-size:12.5px;">
        <div>Supplier: <strong>${esc(purchase.supplier_legal_name || 'Direct Supplier')}</strong></div>
        <div>Bill No: <strong>${esc(purchase.purchase_invoice_no || 'Bill #' + purchase.id)}</strong></div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;padding-top:6px;border-top:1px dashed var(--border);">
          <span>Pending Principal: <strong>₹${pending.toFixed(2)}</strong></span>
          <span>Accrued Interest: <strong style="color:#f59e0b;">₹${interest.toFixed(2)}</strong></span>
        </div>
        <div style="margin-top:4px;font-size:13.5px;font-weight:800;color:var(--primary);text-align:right;">
          Total Payable: ₹${netPay.toFixed(2)}
        </div>
      </div>

      <form id="recordPaymentForm">
        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-size:12px;font-weight:600;">Payment Amount (₹) *</label>
          <input type="number" step="0.01" id="payAmtInput" class="form-input" value="${pending.toFixed(2)}" max="${netPay.toFixed(2)}" required style="font-size:14px;font-weight:700;">
        </div>

        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" style="font-size:12px;font-weight:600;">Payment Mode</label>
            <select id="payModeInput" class="form-select">
              <option value="bank">Bank Transfer / NEFT / RTGS</option>
              <option value="upi">UPI / GPay / PhonePe</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" style="font-size:12px;font-weight:600;">Payment Date</label>
            <input type="date" id="payDateInput" class="form-input" value="${new Date().toISOString().split('T')[0]}">
          </div>
        </div>

        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label" style="font-size:12px;font-weight:600;">Payment Notes / Reference No.</label>
          <input type="text" id="payNotesInput" class="form-input" placeholder="e.g. UTR Ref #9982319023">
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button type="button" class="btn btn-secondary closePayModal">Cancel</button>
          <button type="submit" class="btn btn-success" style="font-weight:700;">✅ Confirm Payment</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelectorAll(".closePayModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

  overlay.querySelector("#recordPaymentForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn && submitBtn.disabled) return;
    const origHtml = submitBtn ? submitBtn.innerHTML : "✅ Confirm Payment";

    const amount = parseFloat(overlay.querySelector("#payAmtInput").value || 0);
    if (amount <= 0) return alert("Payment amount must be greater than 0.");

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Recording Payment...`;
    }

    const payload = {
      purchase_id: purchase.id,
      amount,
      payment_mode: overlay.querySelector("#payModeInput").value,
      payment_date: overlay.querySelector("#payDateInput").value,
      notes: overlay.querySelector("#payNotesInput").value.trim()
    };

    try {
      const res = await fetch(`${API_BASE}/inventory?action=record-purchase-payment`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Payment recorded successfully!", "success");
        overlay.remove();
        if (onSuccess) onSuccess();
      } else {
        showToast(data.error || "Failed to record payment", "error");
      }
    } catch (err) {
      showToast("Error recording payment: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    }
  });
}

// ── Modal: Configure Purchase Interest Rate & Frequency ──
function openInterestConfigModal(purchase, onSuccess) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px);";

  overlay.innerHTML = `
    <div class="modal-box" style="max-width:440px;width:100%;background:var(--bg-primary);border-radius:12px;padding:22px;border:1px solid var(--border);box-shadow:0 20px 30px rgba(0,0,0,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:14px;">
        <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">⚙️ Configure Interest Settings</h3>
        <button class="modal-close closeIntModal">&times;</button>
      </div>

      <div style="background:var(--bg-card,#f8fafc);padding:10px 12px;border-radius:8px;border:1px solid var(--border);margin-bottom:14px;font-size:12px;color:var(--text2);">
        Bill #: <strong>${esc(purchase.purchase_invoice_no || 'Bill #' + purchase.id)}</strong> | Supplier: <strong>${esc(purchase.supplier_legal_name || 'Direct Supplier')}</strong>
      </div>

      <form id="interestConfigForm">
        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-size:12px;font-weight:600;">Interest Rate (%) *</label>
          <input type="number" step="0.01" id="cfgIntRate" class="form-input" value="${purchase.interest_rate || 0}" required placeholder="e.g. 1.5">
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-size:12px;font-weight:600;">Interest Frequency *</label>
          <select id="cfgIntFreq" class="form-select" required>
            <option value="monthly" ${(purchase.interest_frequency || 'monthly') === 'monthly' ? 'selected' : ''}>Monthly (Per Month %)</option>
            <option value="daily" ${(purchase.interest_frequency) === 'daily' ? 'selected' : ''}>Daily (Per Day %)</option>
            <option value="yearly" ${(purchase.interest_frequency) === 'yearly' ? 'selected' : ''}>Yearly (Per Annum %)</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label" style="font-size:12px;font-weight:600;">Payment Due Date</label>
          <input type="date" id="cfgDueDate" class="form-input" value="${purchase.due_date ? new Date(purchase.due_date).toISOString().split('T')[0] : ''}">
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button type="button" class="btn btn-secondary closeIntModal">Cancel</button>
          <button type="submit" class="btn btn-primary" style="font-weight:600;">💾 Save Interest Config</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelectorAll(".closeIntModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

  overlay.querySelector("#interestConfigForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn && submitBtn.disabled) return;
    const origHtml = submitBtn ? submitBtn.innerHTML : "💾 Save Interest Config";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving...`;
    }

    const payload = {
      purchase_id: purchase.id,
      interest_rate: parseFloat(overlay.querySelector("#cfgIntRate").value || 0),
      interest_frequency: overlay.querySelector("#cfgIntFreq").value,
      due_date: overlay.querySelector("#cfgDueDate").value || null
    };

    try {
      const res = await fetch(`${API_BASE}/inventory?action=update-purchase-interest`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Interest configuration updated!", "success");
        overlay.remove();
        if (onSuccess) onSuccess();
      } else {
        showToast(data.error || "Failed to update interest", "error");
      }
    } catch (err) {
      showToast("Error updating interest: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    }
  });
}

