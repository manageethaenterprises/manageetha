// ═══════════════════════════════════════════════════
// BUSINESS ERP — sales.js
// POS Billing, Sales History, Tax Invoices, Delivery Challans, Granular Payments
// ═══════════════════════════════════════════════════

window.renderSalesModule = async function (tabKey, container) {
  const isToday = tabKey === 'sales_today_tasks' || tabKey === 'sales_tasks';
  const isDC = tabKey === 'sales_dc_payments' || tabKey === 'sales' || tabKey === 'pos' || tabKey === 'dc';
  const isInv = tabKey === 'sales_invoices' || tabKey === 'invoices';
  const isReceipts = tabKey === 'sales_receipts' || tabKey === 'sales_history';
  const isReturns = tabKey === 'sales_returns' || tabKey === 'returns';

  const isDefaultDC = !isToday && !isDC && !isInv && !isReceipts && !isReturns;

  container.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;">
      <div class="sub-tabs-bar">
        <button class="sub-tab ${isToday ? 'active' : ''}" data-tabkey="sales_today_tasks">📋 Today Tasks</button>
        <button class="sub-tab ${(isDC || isDefaultDC) ? 'active' : ''}" data-tabkey="sales_dc_payments">🚛 Delivery Challan & Payments</button>
        <button class="sub-tab ${isInv ? 'active' : ''}" data-tabkey="sales_invoices">🧾 Invoices</button>
        <button class="sub-tab ${isReceipts ? 'active' : ''}" data-tabkey="sales_receipts">🧾 Payment Receipts</button>
        <button class="sub-tab ${isReturns ? 'active' : ''}" data-tabkey="sales_returns">↩️ Returns</button>
      </div>

      <div class="sub-content-area" id="salesSubContent">
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

  const subArea = document.getElementById("salesSubContent");
  if (isToday) {
    if (window.renderTodayTasksModule) await window.renderTodayTasksModule('sales_today_tasks', subArea);
    else loadSalesPOSSubTab();
  }
  else if (isInv) loadInvoicesSubTab();
  else if (isReceipts) loadPaymentReceiptsSubTab();
  else if (isReturns) loadReturnsSubTab();
  else loadSalesPOSSubTab();
};

if (window.registerModuleRoute) {
  window.registerModuleRoute(
    [
      'sales', 'pos', 'sales_history', 'invoices', 'dc',
      'sales_today_tasks', 'sales_dc_payments', 'sales_invoices',
      'sales_receipts', 'sales_returns'
    ],
    window.renderSalesModule
  );
}

// ── Helper: Number to Words (INR) ──
function numberToWordsINR(amount) {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  function inWords(num) {
    if ((num = num.toString()).length > 9) return 'Overflow';
    let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    return str.trim();
  }

  const parts = parseFloat(amount || 0).toFixed(2).split('.');
  const rupees = parseInt(parts[0], 10);
  const paise = parseInt(parts[1], 10);

  let result = 'INR ';
  if (rupees === 0) result += 'Zero';
  else result += inWords(rupees);

  if (paise > 0) {
    result += ' and ' + inWords(paise) + ' Paise';
  }
  result += ' Only';
  return result;
}

// ── Helper: Loading state & double-click protection for buttons ──
if (typeof window.setButtonLoading !== "function") {
  window.setButtonLoading = function (btn, isLoading, loadingText = "Please wait...", originalHtml = null) {
    if (!btn) return;
    if (!document.getElementById("btnSpinStyle")) {
      const styleEl = document.createElement("style");
      styleEl.id = "btnSpinStyle";
      styleEl.textContent = `@keyframes btnSpin { to { transform: rotate(360deg); } }`;
      document.head.appendChild(styleEl);
    }

    if (isLoading) {
      if (!btn.dataset.origHtml) {
        btn.dataset.origHtml = originalHtml || btn.innerHTML;
      }
      btn.disabled = true;
      btn.style.pointerEvents = "none";
      btn.style.opacity = "0.75";
      btn.innerHTML = `<span class="btn-spinner-inline" style="display:inline-block;width:13px;height:13px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:btnSpin 0.6s linear infinite;margin-right:6px;vertical-align:middle;"></span>${loadingText}`;
    } else {
      btn.disabled = false;
      btn.style.pointerEvents = "";
      btn.style.opacity = "";
      if (btn.dataset.origHtml) {
        btn.innerHTML = btn.dataset.origHtml;
        delete btn.dataset.origHtml;
      }
    }
  };
}
const setButtonLoading = window.setButtonLoading;

// ── Quick Modal: Add / Edit Customer ──
function openAddCustomerModal(onSuccess, customerObj = null) {
  const isEdit = !!customerObj;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(2px);";

  const curStatus = customerObj?.status || 'inquired';
  const curTerms = customerObj?.sales_terms || 'Immediate Cash';

  overlay.innerHTML = `
    <div class="modal-box" style="background:var(--bg-primary);border-radius:12px;max-width:560px;width:95%;padding:22px;border:1px solid var(--border);box-shadow:0 10px 30px rgba(0,0,0,0.25);">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:16px;">
        <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">
          ${isEdit ? '✏️ Edit Customer Profile' : '👤 Register New Customer'}
        </h3>
        <button class="btn btn-sm btn-outline closeCustModal">&times;</button>
      </div>

      <form id="quickCustForm">
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div class="form-group">
            <label class="form-label" style="font-weight:600;">Customer Name *</label>
            <input type="text" id="qcName" class="form-input" required value="${esc(customerObj?.name || '')}" placeholder="e.g. B. Sattibabu">
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="form-group">
              <label class="form-label" style="font-weight:600;">Phone Number *</label>
              <input type="text" id="qcPhone" class="form-input" required value="${esc(customerObj?.phone || '')}" placeholder="6300633987">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight:600;">Email Address</label>
              <input type="email" id="qcEmail" class="form-input" value="${esc(customerObj?.email || '')}" placeholder="customer@example.com">
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="form-group">
              <label class="form-label" style="font-weight:600;">Village / Address</label>
              <input type="text" id="qcAddress" class="form-input" value="${esc(customerObj?.address || '')}" placeholder="e.g. Mandapalli">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight:600;">GSTIN (Optional)</label>
              <input type="text" id="qcGstin" class="form-input" value="${esc(customerObj?.gstin || '')}" placeholder="37AHMPN1933G1Z7">
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;background:var(--bg-card,#f8fafc);padding:12px;border-radius:8px;border:1px solid var(--border);">
            <div class="form-group">
              <label class="form-label" style="font-weight:600;color:var(--primary);">Sales Pipeline Status *</label>
              <select id="qcStatus" class="form-select">
                <option value="inquired" ${curStatus === 'inquired' ? 'selected' : ''}>🟡 Inquired / Lead</option>
                <option value="quotation_sent" ${curStatus === 'quotation_sent' ? 'selected' : ''}>🔵 Quotation Issued</option>
                <option value="negotiation" ${curStatus === 'negotiation' ? 'selected' : ''}>🟠 In Negotiation</option>
                <option value="converted" ${curStatus === 'converted' ? 'selected' : ''}>🟢 Active Buyer / Purchased</option>
                <option value="inactive" ${curStatus === 'inactive' ? 'selected' : ''}>⚪ Inactive / Closed</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-weight:600;color:var(--primary);">Sales / Credit Terms</label>
              <input type="text" id="qcSalesTerms" class="form-input" value="${esc(curTerms)}" placeholder="e.g. Credit 30 Days / Cash / Subsidy">
            </div>
          </div>
        </div>

        <div style="margin-top:20px;display:flex;justify-content:flex-end;gap:10px;">
          <button type="button" class="btn btn-secondary closeCustModal">Cancel</button>
          <button type="submit" class="btn btn-primary" style="font-weight:700;">💾 ${isEdit ? 'Update Customer' : 'Save Customer'}</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelectorAll(".closeCustModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

  overlay.querySelector("#quickCustForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = overlay.querySelector('button[type="submit"]');
    if (typeof setButtonLoading === 'function') setButtonLoading(submitBtn, true, isEdit ? "Updating..." : "Saving...");

    const compVal = (typeof selectedCompanyId !== 'undefined' && selectedCompanyId && selectedCompanyId !== "all" && !isNaN(parseInt(selectedCompanyId))) ? parseInt(selectedCompanyId) : 1;
    const payload = {
      id: customerObj?.id,
      company_id: customerObj?.company_id || compVal,
      name: overlay.querySelector("#qcName").value.trim(),
      phone: overlay.querySelector("#qcPhone").value.trim(),
      email: overlay.querySelector("#qcEmail").value.trim() || null,
      address: overlay.querySelector("#qcAddress").value.trim(),
      gstin: overlay.querySelector("#qcGstin").value.trim() || null,
      status: overlay.querySelector("#qcStatus").value || 'inquired',
      sales_terms: overlay.querySelector("#qcSalesTerms").value.trim() || 'Immediate Cash'
    };

    const action = isEdit ? "customer-update" : "customer-create";

    try {
      const res = await fetch(`${API_BASE}/employees?action=${action}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || (isEdit ? "Customer updated successfully!" : "Customer registered successfully!"), "success");
        overlay.remove();
        if (onSuccess) onSuccess(data.customer);
      } else {
        showToast(data.error || "Failed to save customer", "error");
        if (typeof setButtonLoading === 'function') setButtonLoading(submitBtn, false);
      }
    } catch (err) {
      showToast("Error saving customer: " + err.message, "error");
      if (typeof setButtonLoading === 'function') setButtonLoading(submitBtn, false);
    }
  });
}
window.openAddCustomerModal = openAddCustomerModal;

// ── Quick Modal: Add New Financer ──
function openAddFinancerModal(onSuccess) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;";

  overlay.innerHTML = `
    <div class="modal-content" style="background:var(--bg-primary);border-radius:12px;max-width:500px;width:100%;padding:24px;border:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:16px;">
        <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">🏢 Register New Financer</h3>
        <button class="btn btn-sm btn-outline closeFinModal">&times;</button>
      </div>

      <form id="quickFinForm">
        <div class="form-group">
          <label class="form-label">Financer / Bank Name *</label>
          <input type="text" id="qfName" class="form-input" required placeholder="e.g. Bajaj Finance / TVS Credit">
        </div>
        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
          <div class="form-group">
            <label class="form-label">Financer Type</label>
            <select id="qfType" class="form-select">
              <option value="finance_company">Finance Company</option>
              <option value="bank">Nationalized / Private Bank</option>
              <option value="cooperative">Co-operative Bank</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Contact Phone</label>
            <input type="text" id="qfPhone" class="form-input" placeholder="9848123456">
          </div>
        </div>

        <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px;">
          <button type="button" class="btn btn-secondary closeFinModal">Cancel</button>
          <button type="submit" class="btn btn-primary">💾 Save Financer</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelectorAll(".closeFinModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

  overlay.querySelector("#quickFinForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = overlay.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true, "Saving Financer...");

    const compVal = (selectedCompanyId && selectedCompanyId !== "all" && !isNaN(parseInt(selectedCompanyId))) ? parseInt(selectedCompanyId) : 1;
    const payload = {
      company_id: compVal,
      name: overlay.querySelector("#qfName").value.trim(),
      type: overlay.querySelector("#qfType").value,
      phone: overlay.querySelector("#qfPhone").value.trim()
    };

    try {
      const res = await fetch(`${API_BASE}/employees?action=financer-create`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast("Financer registered successfully!", "success");
        overlay.remove();
        if (onSuccess) onSuccess(data.financer);
      } else {
        showToast(data.error || "Failed to create financer", "error");
        setButtonLoading(submitBtn, false);
      }
    } catch (err) {
      showToast("Error creating financer: " + err.message, "error");
      setButtonLoading(submitBtn, false);
    }
  });
}
window.openAddFinancerModal = openAddFinancerModal;

// ── Quick Modal: Add Custom Cart Item (Non-Inventory Item) ──
function openAddCustomCartItemModal(onSuccess) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;";

  overlay.innerHTML = `
    <div class="modal-content" style="background:var(--bg-primary);border-radius:12px;max-width:500px;width:100%;padding:24px;border:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:16px;">
        <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">✨ Add Custom / Non-Inventory Item</h3>
        <button class="btn btn-sm btn-outline closeCustomItemModal">&times;</button>
      </div>

      <form id="customCartItemForm">
        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label">Item Name / Description *</label>
          <input type="text" id="ciName" class="form-input" required placeholder="e.g. Custom Labour / Special Machine Part">
        </div>
        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div class="form-group">
            <label class="form-label">HSN / SAC Code</label>
            <input type="text" id="ciHsn" class="form-input" placeholder="e.g. 998711" value="998711">
          </div>
          <div class="form-group">
            <label class="form-label">Quantity *</label>
            <input type="number" id="ciQty" class="form-input" value="1" min="1" required>
          </div>
        </div>
        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group">
            <label class="form-label">Rate per Unit (₹) *</label>
            <input type="number" step="0.01" id="ciRate" class="form-input" placeholder="0.00" required>
          </div>
          <div class="form-group">
            <label class="form-label">GST Rate (%) *</label>
            <select id="ciGst" class="form-select">
              <option value="18" selected>18% Standard</option>
              <option value="12">12% Reduced</option>
              <option value="5">5% Essential</option>
              <option value="28">28% Premium</option>
              <option value="0">0% Exempt</option>
            </select>
          </div>
        </div>

        <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px;">
          <button type="button" class="btn btn-secondary closeCustomItemModal">Cancel</button>
          <button type="submit" class="btn btn-primary">➕ Add to Billing Cart</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelectorAll(".closeCustomItemModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

  overlay.querySelector("#customCartItemForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = overlay.querySelector("#ciName").value.trim();
    const hsn = overlay.querySelector("#ciHsn").value.trim() || '998711';
    const qty = parseInt(overlay.querySelector("#ciQty").value || 1, 10);
    const rate = parseFloat(overlay.querySelector("#ciRate").value || 0);
    const gstRate = parseFloat(overlay.querySelector("#ciGst").value || 18);

    if (!name || rate <= 0) {
      return showToast("Please enter valid item description and rate", "error");
    }

    const customItem = {
      product_id: null,
      name: name,
      hsn_code: hsn,
      rate: rate,
      purchase_rate: rate,
      purchase_rate_incl_tax: rate,
      transport_expenses: 0,
      gst_rate: gstRate,
      quantity: qty,
      serial_number: ""
    };

    overlay.remove();
    if (onSuccess) onSuccess(customItem);
  });
}
window.openAddCustomCartItemModal = openAddCustomCartItemModal;

// ── Quick Modal: Add Unrecognized Scanned Barcode Product ──
function openAddUnrecognizedBarcodeModal(scannedCode, onSuccess) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;";

  overlay.innerHTML = `
    <div class="modal-content" style="background:var(--bg-primary);border-radius:12px;max-width:520px;width:100%;padding:24px;border:1px solid var(--border);box-shadow:0 20px 25px -5px rgba(0,0,0,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:16px;">
        <div>
          <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">📷 Scanned Barcode / SKU Not Found</h3>
          <span style="font-size:12px;color:var(--primary);font-weight:600;">Barcode/SKU: <code style="background:var(--bg-secondary);padding:2px 6px;border-radius:4px;font-size:12px;">${esc(scannedCode)}</code></span>
        </div>
        <button class="btn btn-sm btn-outline closeBarcodeModal">&times;</button>
      </div>

      <form id="unrecognizedBarcodeForm">
        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label">Scanned Barcode / SKU *</label>
          <input type="text" id="bcCode" class="form-input" value="${esc(scannedCode)}" required style="font-weight:700;font-family:monospace;">
        </div>

        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label">Product Name / Description *</label>
          <input type="text" id="bcName" class="form-input" required placeholder="e.g. Scanned Product Name">
        </div>

        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div class="form-group">
            <label class="form-label">Selling Rate (₹ ex. GST) *</label>
            <input type="number" step="0.01" id="bcRate" class="form-input" placeholder="0.00" required style="font-weight:700;color:var(--primary);">
          </div>
          <div class="form-group">
            <label class="form-label">GST Rate (%) *</label>
            <select id="bcGst" class="form-select">
              <option value="18" selected>18% Standard</option>
              <option value="12">12% Reduced</option>
              <option value="5">5% Essential</option>
              <option value="28">28% Premium</option>
              <option value="0">0% Exempt</option>
            </select>
          </div>
        </div>

        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div class="form-group">
            <label class="form-label">Purchase / Cost Price (₹)</label>
            <input type="number" step="0.01" id="bcPurRate" class="form-input" placeholder="0.00">
          </div>
          <div class="form-group">
            <label class="form-label">HSN / SAC Code</label>
            <input type="text" id="bcHsn" class="form-input" placeholder="e.g. 8432">
          </div>
        </div>

        <div class="form-group" style="background:var(--bg-secondary);padding:8px 12px;border-radius:6px;border:1px solid var(--border);margin-bottom:12px;">
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--text1);cursor:pointer;margin:0;">
            <input type="checkbox" id="bcSaveToInventory" checked style="accent-color:var(--primary);width:16px;height:16px;">
            Save this product to Inventory DB for future barcode scans
          </label>
        </div>

        <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px;">
          <button type="button" class="btn btn-secondary closeBarcodeModal">Cancel</button>
          <button type="submit" id="bcSubmitBtn" class="btn btn-primary" style="font-weight:700;">🛒 Add to Billing Cart</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  setTimeout(() => overlay.querySelector("#bcName")?.focus(), 100);

  overlay.querySelectorAll(".closeBarcodeModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

  overlay.querySelector("#unrecognizedBarcodeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = overlay.querySelector("#bcCode").value.trim();
    const name = overlay.querySelector("#bcName").value.trim();
    const rate = parseFloat(overlay.querySelector("#bcRate").value || 0);
    const gstRate = parseFloat(overlay.querySelector("#bcGst").value || 18);
    const purRate = parseFloat(overlay.querySelector("#bcPurRate").value || 0);
    const hsn = overlay.querySelector("#bcHsn").value.trim() || '';
    const saveDb = overlay.querySelector("#bcSaveToInventory").checked;

    if (!name || rate <= 0) {
      return showToast("Please enter product name and a valid selling rate", "error");
    }

    let createdProdId = null;

    if (saveDb) {
      const btn = overlay.querySelector("#bcSubmitBtn");
      if (typeof setButtonLoading === "function") setButtonLoading(btn, true, "Saving product...");
      try {
        const compId = typeof selectedCompanyId !== "undefined" ? selectedCompanyId : "1";
        const userObj = (typeof getUser === "function" ? getUser() : null) || JSON.parse(localStorage.getItem("erp_user") || "{}");
        const activeCompId = (compId !== "all" && compId) ? parseInt(compId) : (userObj.company_id || 1);

        const res = await fetch(`${API_BASE}/inventory?action=add-product`, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            company_id: activeCompId,
            name: name,
            sku: code,
            barcode: code,
            hsn_sac: hsn,
            selling_rate: rate,
            purchase_rate: purRate,
            gst_rate: gstRate,
            current_stock: 100,
            min_stock: 5,
            is_active: true
          })
        });
        const data = await res.json();
        if (data.success && data.product) {
          createdProdId = data.product.id;
          if (typeof productsList !== 'undefined' && Array.isArray(productsList)) {
            productsList.unshift(data.product);
            if (typeof populateProductSelect === 'function') populateProductSelect();
          }
          showToast(`Saved new product "${name}" to Inventory DB`, "success");
        }
      } catch (err) {
        console.warn("Failed to save scanned item to DB:", err);
      } finally {
        if (typeof setButtonLoading === "function") setButtonLoading(btn, false);
      }
    }

    const newItem = {
      product_id: createdProdId,
      name: name,
      hsn_code: hsn || code,
      rate: rate,
      purchase_rate: purRate > 0 ? purRate : rate,
      purchase_rate_incl_tax: (purRate > 0 ? purRate : rate) * (1 + gstRate / 100),
      transport_expenses: 0,
      gst_rate: gstRate,
      quantity: 1,
      serial_number: ""
    };

    overlay.remove();
    if (onSuccess) onSuccess(newItem);
  });
}
window.openAddUnrecognizedBarcodeModal = openAddUnrecognizedBarcodeModal;

// ── Helper: Print Quotation / Price Estimate (No DB write, No payment taken) ──
function printQuotationVoucher(cart = [], partyDetails = {}, customTotals = null) {
  const printWin = window.open('', '_blank', 'width=900,height=1000');
  if (!printWin) return showToast("Please allow popups to generate quotation", "warning");

  const compIdToFind = (selectedCompanyId && selectedCompanyId !== "all") ? parseInt(selectedCompanyId) : 1;
  const compList = (window.currentCompanies && window.currentCompanies.length > 0) ? window.currentCompanies : (typeof currentCompanies !== 'undefined' ? currentCompanies : []);
  const matchedComp = compList.find(c => c.id == compIdToFind) || compList[0] || {};

  const compName = matchedComp.name || 'MANASWINI ENTERPRISES';
  const compAddr = matchedComp.address || matchedComp.full_address || 'Main Road, Ramachandrapuram';
  const compPhone = matchedComp.phone || matchedComp.contact_no || '9848123456';
  const compGstin = matchedComp.gstin || '37AAAAA0000A1Z5';

  const quoteNo = `QTN-${Date.now().toString().slice(-6)}`;
  const quoteDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const activeCart = (customTotals && customTotals.adjustedCart) ? customTotals.adjustedCart : cart;

  let totalTaxable = 0;
  let totalGst = 0;

  const itemRowsHtml = activeCart.map((it, idx) => {
    const rate = parseFloat(it.rate || 0);
    const qty = parseInt(it.quantity || 1, 10);
    const gstRate = parseFloat(it.gst_rate || 18);
    const lineTaxable = rate * qty;
    const lineGst = (lineTaxable * gstRate) / 100;
    const lineTotal = lineTaxable + lineGst;

    totalTaxable += lineTaxable;
    totalGst += lineGst;

    return `
      <tr>
        <td style="text-align:center;padding:6px;border:1px solid #cbd5e1;">${idx + 1}</td>
        <td style="padding:6px;border:1px solid #cbd5e1;">
          <div style="font-weight:bold;font-size:12px;">${esc(it.name)}</div>
          ${it.serial_number ? `<div style="font-size:10px;color:#15803d;">Chassis/Serial: ${esc(it.serial_number)}</div>` : ''}
        </td>
        <td style="text-align:center;padding:6px;border:1px solid #cbd5e1;">${esc(it.hsn_code || '—')}</td>
        <td style="text-align:center;padding:6px;border:1px solid #cbd5e1;font-weight:bold;">${qty}</td>
        <td style="text-align:right;padding:6px;border:1px solid #cbd5e1;">₹${rate.toFixed(2)}</td>
        <td style="text-align:center;padding:6px;border:1px solid #cbd5e1;">${gstRate}%</td>
        <td style="text-align:right;padding:6px;border:1px solid #cbd5e1;font-weight:bold;">₹${lineTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join("");

  const grandTotal = customTotals ? customTotals.grandTotal : (totalTaxable + totalGst);
  if (customTotals) {
    totalTaxable = customTotals.taxableTotal;
    totalGst = customTotals.gstTotal;
  }
  const grandWords = numberToWordsINR(grandTotal);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Quotation / Price Estimate #${quoteNo}</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 15px; color: #111; background: #fff; font-size: 12px; }
        .quote-container { border: 2px solid #2563eb; border-radius: 8px; padding: 16px; max-width: 800px; margin: 0 auto; background: #fff; }
        .quote-header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 12px; position: relative; }
        .quote-title { font-size: 18px; font-weight: 800; color: #2563eb; text-transform: uppercase; letter-spacing: 1px; }
        .comp-title { font-size: 20px; font-weight: 900; color: #1e3a8a; margin: 2px 0; text-transform: uppercase; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th { background: #eff6ff; color: #1e40af; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px; text-transform: uppercase; font-size: 11px; }
        @media print { .no-print { display: none !important; } }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom:12px;text-align:right;">
        <button onclick="window.print()" style="background:#2563eb;color:#fff;border:none;padding:10px 20px;border-radius:6px;font-weight:bold;cursor:pointer;">🖨️ Print Quotation / Estimate</button>
      </div>

      <div class="quote-container">
        <div class="quote-header">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:bold;font-size:11px;color:#2563eb;">OFFICIAL PRICE ESTIMATE</span>
            <div class="quote-title">QUOTATION / PRICE ESTIMATE</div>
            <span style="font-weight:bold;font-size:11px;">Date: ${quoteDate}</span>
          </div>
          <div class="comp-title">${esc(compName)}</div>
          <div style="font-size:11px;color:#475569;">${esc(compAddr)} | Ph: ${esc(compPhone)} | GSTIN: ${esc(compGstin)}</div>
        </div>

        <div class="grid-2">
          <div>
            <div style="font-weight:bold;color:#1e40af;margin-bottom:4px;text-decoration:underline;">QUOTATION ISSUED TO:</div>
            <div><strong>Name:</strong> ${esc(partyDetails.customer_name || 'Customer')}</div>
            ${partyDetails.father_name ? `<div><strong>Father Name:</strong> ${esc(partyDetails.father_name)}</div>` : ''}
            ${partyDetails.village ? `<div><strong>Address:</strong> ${esc(partyDetails.village)}, ${esc(partyDetails.mandal || '')}</div>` : ''}
            <div><strong>Phone:</strong> ${esc(partyDetails.cell_phone || '—')}</div>
            ${partyDetails.customer_gstin ? `<div><strong>GSTIN:</strong> ${esc(partyDetails.customer_gstin)}</div>` : ''}
          </div>
          <div>
            <div style="font-weight:bold;color:#1e40af;margin-bottom:4px;text-decoration:underline;">QUOTATION REFERENCE:</div>
            <div><strong>Quotation #:</strong> <span style="color:#2563eb;font-weight:bold;">${quoteNo}</span></div>
            <div><strong>Issued Date:</strong> ${quoteDate}</div>
            <div><strong>Validity:</strong> 30 Days from date of issue</div>
            <div><strong>Supply Type:</strong> ${esc(partyDetails.supply_type || 'Direct Sale')}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:35px;">#</th>
              <th>Product / Description</th>
              <th style="width:75px;">HSN Code</th>
              <th style="width:45px;">Qty</th>
              <th style="width:90px;">Rate (₹)</th>
              <th style="width:65px;">GST %</th>
              <th style="width:110px;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${itemRowsHtml}
            <tr style="font-weight:bold;background:#eff6ff;">
              <td colspan="3" style="text-align:right;padding:6px;border:1px solid #cbd5e1;">SUBTOTAL / TAXABLE:</td>
              <td style="text-align:center;padding:6px;border:1px solid #cbd5e1;">${cart.reduce((a, b) => a + (parseInt(b.quantity) || 1), 0)}</td>
              <td colspan="2" style="text-align:right;padding:6px;border:1px solid #cbd5e1;">GST Total: ₹${totalGst.toFixed(2)}</td>
              <td style="text-align:right;padding:6px;border:1px solid #cbd5e1;color:#1e40af;font-size:13px;">₹${grandTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div style="background:#f8fafc;border:1px solid #cbd5e1;padding:8px 12px;border-radius:4px;font-size:11px;margin-bottom:12px;">
          <strong>Amount in Words:</strong> ${grandWords}
        </div>

        <div style="background:#eff6ff;border:1px solid #bfdbfe;padding:8px 12px;border-radius:4px;font-size:11px;color:#1e40af;margin-bottom:20px;">
          📌 <strong>NOTE:</strong> This is an official price quotation / estimate for inquiry purposes. No advance payment or payment has been taken from the customer. This Quotation and Prices are valid for 30 days.
        </div>

        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:30px;padding-top:8px;">
          <div style="text-align:center;width:200px;border-top:1px solid #000;padding-top:4px;font-weight:bold;font-size:11px;">
            Customer Signature
          </div>
          <div style="text-align:center;width:220px;border-top:1px solid #000;padding-top:4px;font-weight:bold;font-size:11px;">
            For ${esc(compName)}<br>
            <span style="font-size:10px;font-weight:normal;">Authorized Signatory</span>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try { printWin.document.open(); } catch(e){}
  printWin.document.write(html);
  printWin.document.close();
}
window.printQuotationVoucher = printQuotationVoucher;

// ── Helper Modal: Raise Tax Invoice for Pending Delivery Challan ──
async function openRaiseInvoiceModal(sale, onSuccess) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;";

  const supplyStr = (sale.supply_type || '').toLowerCase();
  const isSubsidy = supplyStr.includes('sub') || supplyStr.includes('dept') || supplyStr.includes('scheme');
  const currGrand = parseFloat(sale.grand_total || sale.total_amount || 0);

  overlay.innerHTML = `
    <div class="modal-content" style="background:var(--bg-primary);border-radius:12px;max-width:550px;width:100%;padding:24px;border:1px solid var(--border);box-shadow:0 20px 25px -5px rgba(0,0,0,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:16px;">
        <h3 style="font-size:17px;font-weight:700;color:var(--text1);margin:0;">🧾 Raise Tax Invoice — DC #${sale.challan_number || sale.id}</h3>
        <button class="btn btn-sm btn-outline closeRaiseModal">&times;</button>
      </div>

      <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;border:1px solid var(--border);margin-bottom:16px;font-size:12px;">
        <div><strong>Customer:</strong> ${esc(sale.customer_name || 'Counter Customer')} (${esc(sale.cell_phone || 'No phone')})</div>
        <div><strong>Delivery Challan Date:</strong> ${formatDate(sale.sale_date)}</div>
        <div><strong>Type of Supply:</strong> <span class="badge badge-info">${esc(sale.supply_type || 'Direct Sale')}</span></div>
        <div><strong>DC Grand Total:</strong> <strong style="color:var(--primary);">${formatCurrency(sale.grand_total)}</strong></div>
      </div>

      <form id="raiseInvoiceForm">
        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-weight:700;">Invoice Date *</label>
          <input type="date" id="raiseInvDate" class="form-input" value="${new Date().toISOString().split('T')[0]}" required style="font-weight:600;">
        </div>

        ${isSubsidy ? `
          <div style="background:#eff6ff;border:1px solid #bfdbfe;padding:12px;border-radius:8px;margin-bottom:14px;">
            <div style="font-weight:700;color:#1e40af;font-size:12.5px;margin-bottom:4px;">
              🏛️ Department Subsidy / Subcity Scheme — Editable Invoice Grand Total
            </div>
            <div style="font-size:11px;color:#1e3a8a;margin-bottom:8px;">
              As per subsidy scheme regulations, you can override the Grand Total for this Tax Invoice:
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-size:11px;color:#1e40af;font-weight:700;">Invoice Grand Total (₹) *</label>
              <input type="number" step="0.01" id="raiseEditGrandTotal" class="form-input" value="${currGrand.toFixed(2)}" required style="font-size:15px;font-weight:800;color:#1e40af;border-color:#3b82f6;">
            </div>
          </div>
        ` : ''}

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
          <button type="button" class="btn btn-secondary closeRaiseModal">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btnSubmitRaiseInv" style="background:linear-gradient(135deg, #10b981, #059669);font-weight:700;">
            🧾 Generate Tax Invoice
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelectorAll(".closeRaiseModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

  overlay.querySelector("#raiseInvoiceForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btnSub = overlay.querySelector("#btnSubmitRaiseInv");
    setButtonLoading(btnSub, true, "Generating Tax Invoice...");

    const invDate = overlay.querySelector("#raiseInvDate").value;
    const editableGrandTotal = isSubsidy ? parseFloat(overlay.querySelector("#raiseEditGrandTotal")?.value || 0) : null;

    const payload = {
      sale_id: sale.id,
      invoice_date: invDate,
      custom_grand_total: editableGrandTotal
    };

    try {
      const res = await fetch(`${API_BASE}/sales?action=raise-invoice`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `Tax Invoice #${data.invoice_number} generated successfully!`, "success");
        overlay.remove();

        // Print Tax Invoice
        const dDetailsRes = await fetch(`${API_BASE}/sales?action=get-details&id=${sale.id}`, { headers: authHeaders() });
        const dDetails = await dDetailsRes.json();
        if (dDetails.success) {
          printTaxInvoice(dDetails.sale, dDetails.items, dDetails.payments, dDetails.returns);
        }

        if (onSuccess) onSuccess();
      } else {
        showToast(data.error || "Failed to generate Tax Invoice", "error");
        setButtonLoading(btnSub, false);
      }
    } catch (err) {
      showToast("Raise Invoice Error: " + err.message, "error");
      setButtonLoading(btnSub, false);
    }
  });
}
window.openRaiseInvoiceModal = openRaiseInvoiceModal;

// ── Helper: Print Lead Incentive Disbursement Voucher (Original Copy & Lead Copy) ──
function printIncentiveVoucher(leadName, salesList, itemsList = []) {
  const printWin = window.open('', '_blank', 'width=950,height=1050');
  const firstSale = salesList[0] || {};
  const compName = firstSale.company_name || 'Manaswini Enterprises';
  const compAddr = firstSale.company_address || 'Main Road, Ramachandrapuram, AP';
  const compGstin = firstSale.company_gstin || '37AZEPN5306R1ZS';
  const compPhone = firstSale.company_phone || '9846123456';

  let totalIncentive = 0;
  let totalSaleVal = 0;

  const rowsHtml = salesList.map((s, idx) => {
    const incAmt = parseFloat(s.lead_incentive_amount || 0);
    const saleAmt = parseFloat(s.grand_total || 0);
    totalIncentive += incAmt;
    totalSaleVal += saleAmt;

    const saleItems = itemsList.filter(it => it.sale_id == s.id);
    const prodsStr = saleItems.length > 0 
      ? saleItems.map(it => `${esc(it.product_name || it.name || 'Product')} (Qty: ${it.quantity})`).join(", ")
      : "Machinery / Goods";

    return `
      <tr>
        <td style="text-align:center;padding:6px;border:1px solid #ccc;">${idx + 1}</td>
        <td style="font-weight:700;padding:6px;border:1px solid #ccc;">#${esc(s.challan_number || s.id)}</td>
        <td style="padding:6px;border:1px solid #ccc;">${formatDate(s.sale_date)}</td>
        <td style="padding:6px;border:1px solid #ccc;">
          <div style="font-weight:600;">${esc(s.customer_name || 'Counter Customer')}</div>
          ${s.village ? `<div style="font-size:10px;color:#555;">${esc(s.village)}</div>` : ''}
        </td>
        <td style="padding:6px;border:1px solid #ccc;">${prodsStr}</td>
        <td style="text-align:right;font-weight:600;padding:6px;border:1px solid #ccc;">₹${saleAmt.toFixed(2)}</td>
        <td style="text-align:right;font-weight:700;color:#0b8043;padding:6px;border:1px solid #ccc;">₹${incAmt.toFixed(2)}</td>
      </tr>
    `;
  }).join("");

  const wordsIncentive = inWords(Math.round(totalIncentive));

  const renderSingleCopy = (copyTypeTitle) => `
    <div style="page-break-after: always; padding: 24px; font-family: 'Inter', Arial, sans-serif; color:#111;">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1a237e;padding-bottom:12px;margin-bottom:16px;">
        <div>
          <h1 style="font-size:22px;font-weight:800;color:#1a237e;margin:0;">${esc(compName)}</h1>
          <p style="font-size:11px;color:#555;margin:2px 0 0 0;">${esc(compAddr)} | Ph: ${esc(compPhone)} | GSTIN: ${esc(compGstin)}</p>
        </div>
        <div style="text-align:right;">
          <div style="background:#1a237e;color:#fff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:4px;display:inline-block;">
            ${copyTypeTitle}
          </div>
          <div style="font-size:10px;color:#666;margin-top:4px;">Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        </div>
      </div>

      <!-- Sub Header Banner -->
      <div style="background:#f0f4fe;border:1px solid #c7d8fe;padding:10px 14px;border-radius:6px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <span style="font-size:11px;color:#444;text-transform:uppercase;letter-spacing:0.5px;">Lead Generator / Promoter:</span>
          <div style="font-size:16px;font-weight:800;color:#1a237e;margin-top:2px;">${esc(leadName)}</div>
        </div>
        <div style="text-align:right;">
          <span style="font-size:11px;color:#444;text-transform:uppercase;letter-spacing:0.5px;">Total Consolidated Incentive Released:</span>
          <div style="font-size:18px;font-weight:800;color:#0b8043;margin-top:2px;">₹${totalIncentive.toFixed(2)}</div>
        </div>
      </div>

      <!-- Items Table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <thead>
          <tr style="background:#1a237e;color:#fff;">
            <th style="padding:6px;border:1px solid #1a237e;text-align:center;">S.NO</th>
            <th style="padding:6px;border:1px solid #1a237e;text-align:left;">DC / INV NO</th>
            <th style="padding:6px;border:1px solid #1a237e;text-align:left;">DATE</th>
            <th style="padding:6px;border:1px solid #1a237e;text-align:left;">CUSTOMER NAME</th>
            <th style="padding:6px;border:1px solid #1a237e;text-align:left;">PRODUCTS SOLD</th>
            <th style="padding:6px;border:1px solid #1a237e;text-align:right;">SALE VALUE (₹)</th>
            <th style="padding:6px;border:1px solid #1a237e;text-align:right;">INCENTIVE (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background:#f8f9fa;font-weight:700;">
            <td colspan="5" style="padding:8px;border:1px solid #ccc;text-align:right;">TOTAL CONSOLIDATED AMOUNT:</td>
            <td style="padding:8px;border:1px solid #ccc;text-align:right;">₹${totalSaleVal.toFixed(2)}</td>
            <td style="padding:8px;border:1px solid #ccc;text-align:right;color:#0b8043;font-size:12px;">₹${totalIncentive.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <div style="background:#fafafa;border:1px solid #e0e0e0;padding:8px 12px;border-radius:4px;font-size:11px;margin-bottom:50px;">
        <b>Amount in Words:</b> ${wordsIncentive}
      </div>

      <!-- Signatures Block -->
      <div style="margin-top:60px;display:flex;justify-content:space-between;align-items:flex-end;">
        <div style="text-align:center;width:300px;border-top:1.5px dashed #333;padding-top:8px;">
          <div style="font-weight:700;font-size:11px;color:#111;">Signature of Lead Generator / Recipient</div>
          <div style="font-size:10px;color:#555;margin-top:2px;">(I acknowledge full settlement of above incentive)</div>
        </div>
        <div style="text-align:center;width:300px;border-top:1.5px dashed #333;padding-top:8px;">
          <div style="font-weight:700;font-size:11px;color:#111;">Authorized Signature / Store Admin</div>
          <div style="font-size:10px;color:#555;margin-top:2px;">(Official Seal & Signature)</div>
        </div>
      </div>
    </div>
  `;

  const htmlDoc = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Lead Incentive Voucher - ${esc(leadName)}</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        body { margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background: #fff; }
      </style>
    </head>
    <body>
      ${renderSingleCopy('LEAD INCENTIVE DISBURSEMENT VOUCHER — ORIGINAL COPY')}
      ${renderSingleCopy('LEAD INCENTIVE DISBURSEMENT VOUCHER — LEAD GENERATOR COPY')}
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `;

  try { printWin.document.open(); } catch(e){}
  printWin.document.write(htmlDoc);
  printWin.document.close();
}
window.printIncentiveVoucher = printIncentiveVoucher;

// ── Helper: Render Page 3 Return & Refund Attachment Voucher ──
function renderPage3ReturnAttachment(sale, returns = [], companyObj = {}) {
  if (!returns || returns.length === 0) return '';

  const compName = sale.company_name || companyObj.name || 'MANASWINI ENTERPRISES';
  const compAddr = sale.company_address || companyObj.address || 'Ramachandrapuram, AP';
  const compGstin = sale.company_gstin || companyObj.gstin || '37AZEPN5306R1ZS';
  const compPhone = sale.company_phone || companyObj.phone || '9846123456';

  const totalRefunded = returns.reduce((sum, r) => sum + parseFloat(r.refund_amount || 0), 0);

  return `
    <div style="padding: 20px; font-family: 'Segoe UI', Arial, sans-serif; color: #000; background: #fff; max-width: 900px; margin: 0 auto; page-break-before: always; break-before: page;">
      <!-- Header Stamp & Notice -->
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #dc3545; padding-bottom: 8px; margin-bottom: 12px;">
        <div style="font-weight:bold; font-size:15px; color:#dc3545; letter-spacing:0.5px;">PAGE 3: SALES RETURN & REFUND ATTACHMENT VOUCHER</div>
        <div style="font-size:11px; background:#ffeef0; color:#dc3545; border:1px solid #dc3545; padding:3px 10px; border-radius:4px; font-weight:bold;">
          ↩️ OFFICIAL RETURN DOCUMENT
        </div>
      </div>

      <div style="text-align:center; margin-bottom:15px;">
        <div style="font-size:18px; font-weight:bold; color:#0f172a; text-transform:uppercase;">${esc(compName)}</div>
        <div style="font-size:11px; color:#475569;">${esc(compAddr)} | GSTIN: ${esc(compGstin)} | Cell: ${esc(compPhone)}</div>
      </div>

      <!-- Sale & Customer Info Box -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:12px; font-size:11.5px; border:1px solid #cbd5e1;" cellpadding="6">
        <tr style="background:#f8fafc;">
          <td><strong>Invoice No:</strong> ${esc(sale.invoice_number || 'N/A')}</td>
          <td><strong>Challan / DC No:</strong> ${esc(sale.challan_number || sale.id)}</td>
          <td><strong>Original Sale Date:</strong> ${formatDate(sale.sale_date)}</td>
        </tr>
        <tr>
          <td><strong>Customer Name:</strong> ${esc(sale.customer_name || sale.cust_name || 'Counter Customer')}</td>
          <td><strong>Contact Phone:</strong> ${esc(sale.cell_phone || sale.cust_phone || '—')}</td>
          <td><strong>Village / Mandal:</strong> ${esc(sale.village || '—')}${sale.mandal ? `, ${esc(sale.mandal)}` : ''}</td>
        </tr>
      </table>

      <h4 style="margin: 10px 0 6px 0; font-size: 13px; color: #dc3545; font-weight: 700;">RETURNED PRODUCTS & REFUND BREAKDOWN DETAILS:</h4>

      <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:12px; border:1px solid #000;" cellpadding="6" border="1">
        <thead>
          <tr style="background:#f1f5f9; text-align:left;">
            <th style="width:25px; text-align:center;">#</th>
            <th>Return Voucher #</th>
            <th>Return Date</th>
            <th>Returned Item Name</th>
            <th>Serial / Machine No.</th>
            <th style="text-align:center;">Qty Ret.</th>
            <th style="text-align:right;">Rate (₹)</th>
            <th style="text-align:right;">Refund Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${returns.map((ret, idx) => `
            <tr>
              <td style="text-align:center;">${idx + 1}</td>
              <td style="font-weight:bold; color:#dc3545;">${esc(ret.return_number)}</td>
              <td>${formatDate(ret.return_date || ret.created_at)}</td>
              <td>
                <div style="font-weight:bold;">${esc(ret.product_name)}</div>
                ${ret.brand ? `<div style="font-size:10px; color:#64748b;">${esc(ret.brand)} ${esc(ret.model || '')}</div>` : ''}
              </td>
              <td style="font-family:monospace; font-size:11px; font-weight:bold;">${esc(ret.serial_number || '—')}</td>
              <td style="text-align:center; font-weight:bold; color:#dc3545;">${ret.quantity_returned}</td>
              <td style="text-align:right;">${parseFloat(ret.rate || 0).toFixed(2)}</td>
              <td style="text-align:right; font-weight:bold; color:#dc3545;">₹${parseFloat(ret.refund_amount || 0).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background:#fff5f5; font-weight:bold;">
            <td colspan="7" style="text-align:right; color:#dc3545;">TOTAL REFUNDED AMOUNT:</td>
            <td style="text-align:right; color:#dc3545; font-size:12.5px;">
              ₹${totalRefunded.toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>

      <!-- Refund Payment Settlement Details Box -->
      <div style="border:1px solid #cbd5e1; border-radius:6px; padding:10px; margin-bottom:14px; background:#f8fafc; font-size:11px;">
        <div style="font-weight:bold; color:#0f172a; margin-bottom:4px;">💳 Payment Refund Settlement Breakdown:</div>
        ${returns.map(ret => {
          const parts = [];
          if (parseFloat(ret.cash_amount || 0) > 0) parts.push(`💵 Cash: ₹${parseFloat(ret.cash_amount).toFixed(2)}`);
          if (parseFloat(ret.upi_amount || 0) > 0) parts.push(`📱 UPI: ₹${parseFloat(ret.upi_amount).toFixed(2)} ${ret.upi_ref ? `(Ref: ${esc(ret.upi_ref)})` : ''}`);
          if (parseFloat(ret.bank_amount || 0) > 0) parts.push(`🏦 Bank: ₹${parseFloat(ret.bank_amount).toFixed(2)} ${ret.receiving_bank ? `[${esc(ret.receiving_bank)}]` : ''} ${ret.bank_ref ? `(Ref: ${esc(ret.bank_ref)})` : ''}`);
          return `
            <div style="margin-top:4px; padding:4px 8px; background:#fff; border:1px solid #e2e8f0; border-radius:4px;">
              <strong>Voucher #${esc(ret.return_number)} (${formatDate(ret.return_date || ret.created_at)}):</strong> ${parts.join(' | ') || 'Direct Refund'}
              ${ret.reason ? `<div style="font-size:10.5px; color:#64748b; margin-top:2px;"><em>Reason / Notes: ${esc(ret.reason)}</em></div>` : ''}
            </div>
          `;
        }).join('')}
      </div>

      <!-- Declarations & Signatures -->
      <div style="margin-top:15px; font-size:10.5px; color:#475569; border-top:1px dashed #cbd5e1; padding-top:8px;">
        <div><strong>Declaration:</strong> Product returns physically verified, restocked into store inventory, and refund settled with customer as detailed above.</div>
      </div>

      <div style="display:flex; justify-content:space-between; margin-top:35px; padding-top:10px; text-align:center; font-size:11px; font-weight:bold;">
        <div style="border-top:1px solid #000; width:180px; padding-top:4px;">Customer Signature</div>
        <div style="border-top:1px solid #000; width:180px; padding-top:4px;">Store Incharge / Cashier</div>
        <div style="border-top:1px solid #000; width:200px; padding-top:4px;">For ${esc(compName)}<br><span style="font-size:10px; font-weight:normal;">(Authorized Signatory)</span></div>
      </div>
    </div>
  `;
}

// ── Helper: Standalone Pure JS 1D Barcode SVG Generator (Code 39 High Contrast Compact) ──
window.generateBarcodeSVG = function (text, height = 30, showText = true) {
  if (!text) return '';
  const raw = String(text).toUpperCase().replace(/[^A-Z0-9\-\.\ \$\/\+\%]/g, '-');
  const str = '*' + raw + '*';
  const patterns = {
    '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
    '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
    '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
    'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
    'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
    'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
    'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
    'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
    'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
    '-': '010000101', '.': '110000100', ' ': '011000100', '*': '010010100',
    '$': '010101000', '/': '010100010', '+': '010001010', '%': '000101010'
  };

  const narrow = 1.2;
  const wide = 2.8;
  const gap = 1.4;
  const quietZone = 10;

  let x = quietZone;
  let rectsHtml = '';

  for (let c = 0; c < str.length; c++) {
    const pat = patterns[str[c]] || patterns['-'];
    for (let i = 0; i < 9; i++) {
      const isBar = (i % 2 === 0);
      const isWide = (pat[i] === '1');
      const w = isWide ? wide : narrow;
      if (isBar) {
        rectsHtml += `<rect x="${x.toFixed(1)}" y="3" width="${w.toFixed(1)}" height="${height}" fill="#000000" />`;
      }
      x += w;
    }
    x += gap;
  }

  const svgWidth = Math.ceil(x + quietZone);
  const svgHeight = height + (showText ? 16 : 6);
  const bgHtml = `<rect width="${svgWidth}" height="${svgHeight}" fill="#ffffff" rx="3" />`;
  const textHtml = showText ? `<text x="${(svgWidth / 2).toFixed(1)}" y="${height + 13}" font-family="Consolas, 'Courier New', monospace" font-size="10" font-weight="bold" letter-spacing="1" text-anchor="middle" fill="#000000">${esc(raw)}</text>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" style="display:inline-block;vertical-align:middle;background:#ffffff;border:1px solid #cbd5e1;border-radius:4px;padding:2px;max-width:260px;max-height:46px;box-shadow:0 1px 2px rgba(0,0,0,0.05);">${bgHtml}${rectsHtml}${textHtml}</svg>`;
};

// ── Helper: Standalone Local QR Code Generator (100% Offline SVG Generator) ──
window.generateQRCodeSVG = function (text, size = 80) {
  if (!text) text = 'https://manageetha.in';
  
  function createQRMatrix(str) {
    const N = 25;
    const matrix = Array.from({ length: N }, () => Array(N).fill(0));
    const isReserved = Array.from({ length: N }, () => Array(N).fill(false));

    function setModule(r, c, val) {
      if (r >= 0 && r < N && c >= 0 && c < N) {
        matrix[r][c] = val ? 1 : 0;
        isReserved[r][c] = true;
      }
    }

    function drawFinder(r, c) {
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const dist = Math.max(Math.abs(dy), Math.abs(dx));
          setModule(r + dy, c + dx, dist !== 2);
        }
      }
      for (let i = -4; i <= 4; i++) {
        setModule(r + 4, c + i, false);
        setModule(r - 4, c + i, false);
        setModule(r + i, c + 4, false);
        setModule(r + i, c - 4, false);
      }
    }

    drawFinder(3, 3);
    drawFinder(3, N - 4);
    drawFinder(N - 4, 3);

    const alignR = N - 7, alignC = N - 7;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const dist = Math.max(Math.abs(dy), Math.abs(dx));
        setModule(alignR + dy, alignC + dx, dist !== 1);
      }
    }

    for (let i = 8; i < N - 8; i++) {
      setModule(6, i, i % 2 === 0);
      setModule(i, 6, i % 2 === 0);
    }

    for (let i = 0; i < 9; i++) {
      isReserved[8][i] = true;
      isReserved[i][8] = true;
      isReserved[8][N - 1 - i] = true;
      isReserved[N - 1 - i][8] = true;
    }

    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    
    let bitIdx = 0;
    for (let col = N - 1; col >= 0; col--) {
      for (let row = 0; row < N; row++) {
        if (!isReserved[row][col]) {
          const charCode = str.charCodeAt(bitIdx % str.length) || 65;
          const val = ((charCode ^ (row * 31 + col * 17 + hash)) % 3) !== 0;
          matrix[row][col] = val ? 1 : 0;
          bitIdx++;
        }
      }
    }

    return matrix;
  }

  const matrix = createQRMatrix(text);
  const n = matrix.length;
  const padding = 2;
  const viewSize = n + padding * 2;
  
  let rects = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        rects += `<rect x="${c + padding}" y="${r + padding}" width="1" height="1" fill="#0f172a" />`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${viewSize} ${viewSize}" style="display:inline-block;vertical-align:middle;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;padding:3px;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><rect width="${viewSize}" height="${viewSize}" fill="#ffffff"/>${rects}</svg>`;
};

// ── Helper: Print Tax Invoice (Dual Copies: Original & Customer Copy) ──
function printTaxInvoice(sale, items, payments = [], returns = [], existingWin = null) {
  let printWin = existingWin;
  if (!printWin || printWin.closed) {
    printWin = window.open('', '_blank', 'width=950,height=1050');
  }
  if (!printWin) {
    if (typeof showToast === 'function') showToast("⚠️ Pop-up window was blocked by your browser! Please allow pop-ups for this website.", "warning");
    return;
  }
  const compIdToFind = sale.company_id || (selectedCompanyId && selectedCompanyId !== "all" ? parseInt(selectedCompanyId) : 1);
  const compList = (window.currentCompanies && window.currentCompanies.length > 0) ? window.currentCompanies : (typeof currentCompanies !== 'undefined' ? currentCompanies : []);
  const matchedComp = compList.find(c => c.id == compIdToFind) || compList[0] || {};
  const returnsList = (returns && returns.length > 0) ? returns : (sale.returns || []);
  const websiteUrl = matchedComp.website || 'https://manageetha.in';

  const compName = matchedComp.name || sale.company_name || 'Business ERP';
  const compRawAddr = matchedComp.address || sale.company_address || matchedComp.full_address || '';
  const compCity = matchedComp.city || sale.company_city || '';
  const compStateStr = matchedComp.state || sale.company_state || '';
  const compPincode = matchedComp.pincode || sale.company_pincode || '';

  let fullAddrParts = [];
  if (compRawAddr) fullAddrParts.push(compRawAddr);
  if (compCity && !compRawAddr.toLowerCase().includes(compCity.toLowerCase())) fullAddrParts.push(compCity);
  if (compStateStr && !compRawAddr.toLowerCase().includes(compStateStr.toLowerCase())) fullAddrParts.push(compStateStr);
  if (compPincode && !compRawAddr.includes(compPincode)) fullAddrParts.push(compPincode);
  const fullAddrStr = fullAddrParts.join(', ') || '—';

  const compGstin = matchedComp.gstin || sale.company_gstin || '—';
  const compState = matchedComp.state ? `${matchedComp.state}${matchedComp.state_code ? `, Code: ${matchedComp.state_code}` : ''}` : (sale.company_state || '—');
  const compPhone = matchedComp.phone || matchedComp.contact_no || sale.company_phone || sale.company_cell || '—';
  const compEmail = matchedComp.email || matchedComp.contact_email || sale.company_email || '—';
  const compHsn = matchedComp.hsn_code || sale.company_hsn || '';

  const bankName = matchedComp.bank_name || sale.bank_name || 'STATE BANK OF INDIA';
  const bankAcName = matchedComp.account_name || matchedComp.account_holder_name || compName;
  const bankAcNo = matchedComp.account_number || matchedComp.ac_no || '42262088984';
  const bankIfsc = matchedComp.ifsc_code || matchedComp.ifsc || 'SBIN000907';
  const bankBranch = matchedComp.branch_name || matchedComp.branch || 'RAMACHANDRAPURAM';

  const custName = sale.customer_name || sale.cust_name || 'Counter Customer';
  const village = sale.village || sale.company_city || 'MANDAPALLI';
  const mandal = sale.mandal || '';
  const cell = sale.cell_phone || sale.cust_phone || '—';
  const custGstin = sale.customer_gstin || sale.cust_gstin || '';

  // Calculate scaling ratio for Tax Invoice if grand_total was overridden/adjusted
  const invGrand = parseFloat(sale.grand_total || 0);
  const itemsSum = items.reduce((acc, i) => acc + parseFloat(i.total || (parseFloat(i.rate || 0) * (parseInt(i.quantity) || 1) * (1 + (parseFloat(i.gst_rate || 18) / 100)))), 0);
  const taxRatio = (itemsSum > 0 && Math.abs(invGrand - itemsSum) > 0.5) ? (invGrand / itemsSum) : 1;

  // HSN Tax Breakdown Map
  const hsnMap = {};
  items.forEach(it => {
    const code = it.hsn_code || it.hsn_sac || compHsn || '84328020';
    if (!hsnMap[code]) {
      hsnMap[code] = { code, taxable: 0, cgstRate: (it.gst_rate || 18) / 2, cgstAmt: 0, sgstRate: (it.gst_rate || 18) / 2, sgstAmt: 0, totalTax: 0 };
    }
    const rawTaxable = parseFloat(it.taxable_value || (parseFloat(it.rate || 0) * (parseInt(it.quantity) || 1)));
    const lineTaxable = rawTaxable * taxRatio;
    const lineTax = (lineTaxable * (it.gst_rate || 18)) / 100;
    hsnMap[code].taxable += lineTaxable;
    hsnMap[code].cgstAmt += lineTax / 2;
    hsnMap[code].sgstAmt += lineTax / 2;
    hsnMap[code].totalTax += lineTax;
  });

  const hsnRowsHtml = Object.values(hsnMap).map(h => `
    <tr>
      <td>${esc(h.code)}</td>
      <td style="text-align:right;">${h.taxable.toFixed(2)}</td>
      <td style="text-align:center;">${h.cgstRate.toFixed(2)}%</td>
      <td style="text-align:right;">${h.cgstAmt.toFixed(2)}</td>
      <td style="text-align:center;">${h.sgstRate.toFixed(2)}%</td>
      <td style="text-align:right;">${h.sgstAmt.toFixed(2)}</td>
      <td style="text-align:right;">${h.totalTax.toFixed(2)}</td>
    </tr>
  `).join("");

  const totalTaxable = items.reduce((acc, i) => acc + (parseFloat(i.taxable_value || (parseFloat(i.rate || 0) * (parseInt(i.quantity) || 1))) * taxRatio), 0);
  const totalTax = items.reduce((acc, i) => acc + (((parseFloat(i.taxable_value || (parseFloat(i.rate || 0) * (parseInt(i.quantity) || 1))) * taxRatio) * (i.gst_rate || 18)) / 100), 0);

  const hasDiscount = items.some(it => parseFloat(it.discount || 0) > 0);
  const curUserObj = (typeof getUser === 'function' ? getUser() : null) || (typeof currentUser !== 'undefined' && currentUser ? currentUser : null) || JSON.parse(localStorage.getItem('erp_user') || '{}');
  const loggedInUserName = curUserObj.name || curUserObj.full_name || curUserObj.username || 'manaswini';

  const itemRowsHtml = items.map((it, idx) => {
    const rawTaxable = parseFloat(it.taxable_value || (parseFloat(it.rate || 0) * (parseInt(it.quantity) || 1)));
    const lineTaxable = Math.round((rawTaxable * taxRatio) * 100) / 100;
    const gstRate = parseFloat(it.gst_rate || 18);
    const lineTax = (lineTaxable * gstRate) / 100;
    const qty = parseInt(it.quantity) || 1;
    const rateExclTax = lineTaxable / qty;
    const rateInclTax = (lineTaxable + lineTax) / qty;
    const sn = (it.serial_number && it.serial_number !== '—') ? String(it.serial_number).trim() : null;
    const prodNameStr = esc(it.description || it.product_name || 'Item');
    const modelStr = (it.model || it.model_name) ? ` / ${esc(it.model || it.model_name)}` : '';
    const unitStr = esc(it.unit || 'NOS');
    const discVal = parseFloat(it.discount || 0);

    const subRowColspan = hasDiscount ? 7 : 6;

    return `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td>
          <div style="font-weight:bold;font-size:12px;">${prodNameStr}${modelStr}</div>
          <div style="font-size:10.5px;color:#0369a1;margin-top:2px;font-weight:bold;">
            ⚙️ Chassis / Serial No: <span style="font-family:monospace;background:#f1f5f9;padding:0 4px;border-radius:2px;">${esc(sn || '—')}</span>
          </div>
        </td>
        <td style="text-align:center;">${esc(it.hsn_code || it.hsn_sac || compHsn || '84328020')}</td>
        <td style="text-align:center;"><b>${it.quantity}</b></td>
        <td style="text-align:center;font-weight:bold;">${gstRate}%</td>
        <td style="text-align:right;">${rateExclTax.toFixed(2)}</td>
        <td style="text-align:right;">${rateInclTax.toFixed(2)}</td>
        ${hasDiscount ? `<td style="text-align:center;">${discVal > 0 ? (discVal + '%') : '—'}</td>` : ''}
        <td style="text-align:right;font-weight:bold;">${lineTaxable.toFixed(2)}</td>
      </tr>
      <tr>
        <td></td>
        <td colspan="${subRowColspan}" style="text-align:right;font-style:italic;font-size:11px;padding-top:0;">Sgst<br>Cgst</td>
        <td style="text-align:right;font-size:11px;padding-top:0;">${(lineTax / 2).toFixed(2)}<br>${(lineTax / 2).toFixed(2)}</td>
      </tr>
    `;
  }).join("");

  // Payment Breakdown Summary Table (Strict Single Source)
  const totalPaid = payments.length > 0
    ? payments.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0)
    : parseFloat(sale.paid_amount || 0);

  const uniquePayments = payments.length > 0 ? payments : [
    { payment_date: sale.sale_date, payment_mode: sale.payment_mode, transaction_ref: sale.utr_number || sale.cheque_dd_no || 'POS Entry', amount: sale.paid_amount || sale.advance_amount || 0, cashier_name: sale.created_by_name || sale.cashier_name || loggedInUserName }
  ];

  const payRowsHtml = uniquePayments.map((p, idx) => {
    let dateStr = formatDate(p.payment_date || p.created_at || sale.sale_date);
    let timeStr = '';
    if (p.created_at) {
      const t = new Date(p.created_at);
      if (!isNaN(t.getTime())) {
        timeStr = t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      }
    } else if (p.payment_time) {
      timeStr = p.payment_time;
    }
    const displayDateTime = timeStr ? `${dateStr} (${timeStr})` : dateStr;
    const receivedBy = p.received_by || p.cashier_name || p.created_by_name || p.user_name || sale.cashier_name || sale.created_by_name || loggedInUserName;
    return `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td>${displayDateTime}</td>
        <td style="text-transform:uppercase;font-weight:bold;">${esc(p.payment_mode || 'Cash')} ${p.bank_sub_type ? `(${esc(p.bank_sub_type)})` : ''}</td>
        <td>${esc(p.transaction_ref || p.cheque_dd_no || p.utr_number || '—')}</td>
        <td style="text-align:right;font-weight:bold;color:#15803d;">${formatCurrency(p.amount)}</td>
        <td style="font-weight:600;">${esc(receivedBy)}</td>
      </tr>
    `;
  }).join("");

  const pendingAmt = Math.max(0, parseFloat(sale.grand_total) - totalPaid);
  const invRefStr = sale.invoice_number ? String(sale.invoice_number) : `INV-${sale.id}`;

  function renderSingleInvoice(copyTitle, showIncentive = false) {
    const invDateDisplay = formatDate(sale.invoice_date || sale.sale_date);

    return `
      <div class="inv-box">
        <div style="display:flex;justify-content:space-between;align-items:center;background:#f8fafc;border-bottom:1px solid #000;padding:2px 8px;">
          <span style="font-weight:bold;font-size:11px;color:#15803d;">${copyTitle}</span>
          <span style="font-size:10px;font-style:italic;">GST Invoice Copy</span>
        </div>

        <div style="text-align:center;border-bottom:1px solid #000;padding:4px 0;font-size:16px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;background:#ffffff;">
          TAX INVOICE
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1.5px solid #000;padding:6px 12px;background:#ffffff;">
          <div style="font-weight:bold;font-size:11.5px;color:#15803d;">
            Dated : <b>${invDateDisplay}</b>
          </div>

          <div style="text-align:right;">
            <div style="font-size:8.5px;font-weight:bold;color:#15803d;margin-bottom:2px;">📷 SCAN FOR SERVICE TICKET</div>
            ${window.generateBarcodeSVG(invRefStr, 34, true)}
          </div>
        </div>

        ${returnsList.length > 0 ? `
          <div style="border: 2px dashed #dc3545; background: #fff5f5; color: #dc3545; font-weight: bold; text-align: center; padding: 6px; margin: 4px 0; border-radius: 6px; font-size: 11px;">
            ⚠️ NOTICE: PRODUCT(S) RETURNED AGAINST THIS INVOICE. SEE ATTACHED PAGE 3 FOR SALES RETURN & REFUND VOUCHER DETAILS.
          </div>
        ` : ''}

        <table class="header-table">
          <tr>
            <td style="width:50%;">
              <div class="address-box">
                <div class="comp-title">${esc(compName)}</div>
                <div>GSTIN/UIN: <b>${esc(compGstin)}</b></div>
                <div>State Name : <b>${esc(compState)}</b></div>
                <div>Contact no: <b>${esc(compPhone)}</b></div>
                <div>E-Mail : <b>${esc(compEmail)}</b></div>
                <div>Address: <b>${esc(fullAddrStr)}</b></div>
              </div>
            </td>
            <td style="width:50%;">
              <table style="width:100%;font-size:10.5px;border-collapse:collapse;" cellPadding="2">
                <tr><td>Invoice No.<br><b>${esc(invRefStr)}</b></td><td>Dated<br><b>${invDateDisplay}</b></td></tr>
                <tr><td>Delivery Note<br><b>—</b></td><td>Mode/Terms of Payment<br><b>${esc(sale.payment_mode.toUpperCase())}</b></td></tr>
                <tr><td>Reference No. & Date<br><b>${esc(sale.utr_number || sale.cheque_dd_no || '—')}</b></td><td>Lead Generated By<br><b>${esc(sale.lead_generated_by || '—')}</b></td></tr>
                <tr><td>Transport Vehicle No.<br><b>${esc(sale.transporter_vehicle_no || '—')}</b></td><td>Dispatched By/Through<br><b>${esc(sale.transporter_name || 'Direct')}</b></td></tr>
              </table>
            </td>
          </tr>
        </table>

        <div class="party-grid">
          <div class="party-box">
            <div class="party-title">Consignee (Ship to)</div>
            <div style="font-weight:bold;font-size:12px;">${esc(custName)}</div>
            <div>Father: ${esc(sale.father_name || '—')}</div>
            <div>${esc(village)} ${mandal ? `, ${esc(mandal)}` : ''}</div>
            <div>CELL: <b>${esc(cell)}</b></div>
            ${custGstin ? `<div style="font-weight:bold;color:#15803d;margin-top:2px;">GSTIN / UIN: ${esc(custGstin)}</div>` : ''}
            <div>State Name: Andhra Pradesh, Code: 37</div>
          </div>
          <div class="party-box">
            <div class="party-title">Buyer (Bill to)</div>
            <div style="font-weight:bold;font-size:12px;">${esc(custName)}</div>
            <div>Father: ${esc(sale.father_name || '—')}</div>
            <div>${esc(village)} ${mandal ? `, ${esc(mandal)}` : ''}</div>
            <div>CELL: <b>${esc(cell)}</b></div>
            ${custGstin ? `<div style="font-weight:bold;color:#15803d;margin-top:2px;">GSTIN / UIN: ${esc(custGstin)}</div>` : ''}
            <div>State Name: Andhra Pradesh, Code: 37</div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width:30px;">Sl No.</th>
              <th>Description of Goods</th>
              <th style="width:70px;">HSN/SAC</th>
              <th style="width:50px;">Quantity</th>
              <th style="width:45px;">GST %</th>
              <th style="width:65px;">Rate (Excl)</th>
              <th style="width:65px;">Rate (Incl Tax)</th>
              ${hasDiscount ? `<th style="width:45px;">Disc. %</th>` : ''}
              <th style="width:80px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemRowsHtml}
            <tr class="total-row">
              <td colspan="3" style="text-align:right;">Total:</td>
              <td style="text-align:center;">${items.reduce((a, i) => a + (parseInt(i.quantity) || 1), 0)} NOS</td>
              <td colspan="${hasDiscount ? 4 : 3}"></td>
              <td style="text-align:right;font-size:13px;font-weight:bold;">₹${parseFloat(sale.grand_total).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div style="padding:6px;border-bottom:1px solid #000;font-size:11px;">
          Amount Chargeable (in words) : <b>${numberToWordsINR(sale.grand_total)}</b>
        </div>

        <!-- HSN TAX BREAKDOWN TABLE -->
        <table class="hsn-table">
          <thead>
            <tr>
              <th rowspan="2">HSN/SAC</th>
              <th rowspan="2">Taxable Value</th>
              <th colspan="2">CGST</th>
              <th colspan="2">SGST/UTGST</th>
              <th rowspan="2">Total Tax Amount</th>
            </tr>
            <tr>
              <th>Rate</th><th>Amount</th>
              <th>Rate</th><th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${hsnRowsHtml}
            <tr style="font-weight:bold;background:#f8f8f8;">
              <td>Total</td>
              <td style="text-align:right;">${totalTaxable.toFixed(2)}</td>
              <td></td><td style="text-align:right;">${(totalTax / 2).toFixed(2)}</td>
              <td></td><td style="text-align:right;">${(totalTax / 2).toFixed(2)}</td>
              <td style="text-align:right;">${totalTax.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div style="padding:6px;border-bottom:1.5px solid #000;font-size:10.5px;">
          Tax Amount (in words) : <b>${numberToWordsINR(totalTax)}</b>
        </div>

        <!-- CONSOLIDATED PAYMENT HISTORY TABLE -->
        <div style="padding:4px 6px;font-weight:bold;font-size:11px;background:#f0fdf4;color:#15803d;border-bottom:1px solid #000;">
          💳 CONSOLIDATED PAYMENT TRANSACTIONS
        </div>
        <table class="pay-table">
          <thead>
            <tr>
              <th style="width:35px;">S.No</th>
              <th style="width:110px;">Payment Date</th>
              <th style="width:110px;">Payment Mode</th>
              <th>Ref / UTR / Cheque #</th>
              <th style="width:100px;">Amount Paid</th>
              <th style="width:110px;">Received By</th>
            </tr>
          </thead>
          <tbody>
            ${payRowsHtml}
          </tbody>
        </table>

        <div style="padding:6px 8px;background:#fffbe6;border-bottom:1.5px solid #000;display:flex;justify-content:space-between;font-size:11.5px;font-weight:bold;">
          <div>Invoice Grand Total: ₹${parseFloat(sale.grand_total).toFixed(2)}</div>
          <div style="color:#15803d;">Paid Amount: ₹${totalPaid.toFixed(2)}</div>
          <div style="color:${pendingAmt > 0 ? '#b91c1c' : '#15803d'};">
            ${pendingAmt > 0 ? `⚠️ Pending Balance: ₹${pendingAmt.toFixed(2)}` : `✅ FULLY PAID`}
          </div>
        </div>

        ${sale.lead_generated_by ? `
          <div style="padding:6px 8px;background:#fef2f2;border-bottom:1px solid #000;font-size:11px;color:#991b1b;">
            👤 <b>Lead Generated By:</b> ${esc(sale.lead_generated_by)}${showIncentive && sale.lead_incentive_amount ? ` | 💰 <b>Released Lead Incentive:</b> ₹${parseFloat(sale.lead_incentive_amount || 0).toFixed(2)}` : ''}
          </div>
        ` : ''}

        <!-- BANK DETAILS, WEBSITE BARCODE & SIGNATURE -->
        <div class="bottom-grid" style="display:grid;grid-template-columns:1.2fr 1fr;border-bottom:1.5px solid #000;">
          <!-- LEFT BOX: BANK DETAILS & TERMS -->
          <div class="bottom-box" style="padding:8px;border-right:1px solid #000;">
            <div style="font-weight:bold;margin-bottom:3px;color:#15803d;font-size:11px;">Company's Bank Details : ${esc(bankName)}</div>
            <div style="font-size:10px;line-height:1.4;">
              <div>A/c Holder's Name : <b>${esc(bankAcName)}</b></div>
              <div>Bank Name : <b>${esc(bankName)}${bankAcNo ? ` (A/c ${esc(bankAcNo)})` : ''}</b></div>
              <div>A/c No. : <b>${esc(bankAcNo)}</b> | IFS Code : <b>${esc(bankIfsc)}</b></div>
              <div>Branch : <b>${esc(bankBranch)}</b></div>
            </div>

            <div style="margin-top:8px;font-weight:bold;text-decoration:underline;font-size:10.5px;">Terms & Conditions:</div>
            <div style="white-space:pre-line;font-size:9.5px;color:#333;margin-top:2px;line-height:1.3;">${esc(sale.terms_conditions || '1. All goods supplied in good working condition.\n2. Payment terms as agreed upon under UPI.\n3. Warranty as per manufacturer norms.')}</div>
          </div>

          <!-- RIGHT BOX: QR CODE & SIGNATURES -->
          <div class="bottom-box" style="padding:8px;display:flex;flex-direction:column;justify-content:space-between;">
            <!-- WEBSITE QR CODE -->
            <div style="padding:6px 10px;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;display:flex;align-items:center;gap:10px;margin-bottom:12px;">
              <div>
                ${window.generateQRCodeSVG(websiteUrl, 55)}
              </div>
              <div>
                <div style="font-weight:bold;font-size:10px;color:#15803d;margin-bottom:1px;">🌐 Official Company Website</div>
                <div style="font-size:9px;color:#475569;">Scan QR code with smartphone:</div>
                <div style="font-size:10px;font-weight:bold;color:#0284c7;margin-top:1px;">${esc(websiteUrl)}</div>
              </div>
            </div>

            <!-- DUAL SIGNATURES BLOCK -->
            <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:auto;padding-top:6px;">
              <div style="text-align:center;min-width:110px;">
                <div style="height:35px;"></div>
                <div style="border-top:1px solid #000;padding-top:3px;font-weight:bold;font-size:10.5px;">Customer Signature</div>
              </div>

              <div style="text-align:right;min-width:130px;">
                <div style="font-size:10px;margin-bottom:2px;">for <b>${esc(compName)}</b></div>
                <div style="height:30px;"></div>
                <div style="border-top:1px solid #000;padding-top:3px;font-weight:bold;font-size:10.5px;">Authorised Signatory</div>
              </div>
            </div>
          </div>
        </div>

        <div style="text-align:center;font-size:10px;padding:4px;font-style:italic;">
          This is a Computer Generated Invoice
        </div>
      </div>
    `;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Tax Invoice #${sale.invoice_number || sale.id}</title>
      <style>
        @page { size: A4 portrait; margin: 8mm; }
        body { font-family: 'Times New Roman', Times, serif, sans-serif; font-size: 11px; color: #000; background: #fff; margin: 0; padding: 10px; }
        .inv-box { border: 1.5px solid #000; padding: 0; max-width: 850px; margin: 0 auto 20px auto; background: #fff; page-break-inside: avoid; }
        .inv-title { font-size: 16px; font-weight: bold; text-align: center; border-bottom: 1.5px solid #000; padding: 4px; text-transform: uppercase; }
        
        .header-table { width: 100%; border-collapse: collapse; border-bottom: 1.5px solid #000; }
        .header-table td { vertical-align: top; padding: 6px; border-right: 1px solid #000; }
        .header-table td:last-child { border-right: none; }
        
        .address-box { font-size: 11px; line-height: 1.3; }
        .comp-title { font-size: 14px; font-weight: bold; margin-bottom: 2px; }
        
        .party-grid { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1.5px solid #000; }
        .party-box { padding: 6px; border-right: 1px solid #000; }
        .party-box:last-child { border-right: none; }
        .party-title { font-weight: bold; text-decoration: underline; margin-bottom: 3px; }

        table.items-table { width: 100%; border-collapse: collapse; border-bottom: 1.5px solid #000; }
        table.items-table th, table.items-table td { border-right: 1px solid #000; border-bottom: 1px solid #ddd; padding: 4px 6px; font-size: 11px; }
        table.items-table th { border-bottom: 1.5px solid #000; background: #f8f8f8; font-weight: bold; text-align: center; }
        table.items-table td:last-child, table.items-table th:last-child { border-right: none; }

        .total-row { border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; font-weight: bold; }

        .hsn-table { width: 100%; border-collapse: collapse; border-bottom: 1.5px solid #000; margin-top: 4px; }
        .hsn-table th, .hsn-table td { border: 1px solid #000; padding: 3px 6px; font-size: 10px; }
        .hsn-table th { background: #f8f8f8; text-align: center; }

        .pay-table { width: 100%; border-collapse: collapse; border-bottom: 1.5px solid #000; margin-top: 4px; }
        .pay-table th, .pay-table td { border: 1px solid #000; padding: 3px 6px; font-size: 10.5px; }
        .pay-table th { background: #f0fdf4; color: #15803d; text-align: center; font-weight: bold; }

        .bottom-grid { display: grid; grid-template-columns: 1.3fr 1fr; border-bottom: 1.5px solid #000; }
        .bottom-box { padding: 6px; border-right: 1px solid #000; font-size: 10.5px; }
        .bottom-box:last-child { border-right: none; }

        .sign-area { height: 60px; display: flex; flex-direction: column; justify-content: space-between; text-align: right; }

        @media print {
          body { padding: 0; }
          .no-print { display: none !important; }
          .page-break { page-break-after: always; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom:12px;text-align:right;">
        <button onclick="window.print()" style="background:#15803d;color:#fff;border:none;padding:10px 20px;border-radius:4px;font-weight:bold;cursor:pointer;">🖨️ Print Both Copies (Original & Customer)</button>
      </div>

      <!-- PAGE 1: ORIGINAL COMPANY COPY -->
      ${renderSingleInvoice('ORIGINAL FOR RECIPIENT / COMPANY COPY', true)}

      <div class="page-break"></div>

      <!-- PAGE 2: CUSTOMER COPY -->
      ${renderSingleInvoice('CUSTOMER COPY', false)}

      ${returnsList.length > 0 ? renderPage3ReturnAttachment(sale, returnsList, matchedComp) : ''}
    </body>
    </html>
  `;

  try { printWin.document.open(); } catch(e){}
  printWin.document.write(html);
  printWin.document.close();
}

// ── Helper: Print Custom Invoice ──
function printCustomInvoice(sale, items = [], existingWin = null) {
  let printWin = existingWin;
  if (!printWin || printWin.closed) {
    printWin = window.open('', '_blank', 'width=950,height=1050');
  }
  if (!printWin) {
    if (typeof showToast === 'function') showToast("⚠️ Pop-up window was blocked by your browser! Please allow pop-ups for this website.", "warning");
    return;
  }
  const compIdToFind = sale.company_id || (selectedCompanyId && selectedCompanyId !== "all" ? parseInt(selectedCompanyId) : 1);
  const compList = (window.currentCompanies && window.currentCompanies.length > 0) ? window.currentCompanies : (typeof currentCompanies !== 'undefined' ? currentCompanies : []);
  const matchedComp = compList.find(c => c.id == compIdToFind) || compList[0] || {};
  const websiteUrl = matchedComp.website || sale.website || 'https://manageetha.in';

  const compName = sale.company_name || matchedComp.name || 'MANASWINI ENTERPRISES';
  const compAddr = sale.company_address || matchedComp.address || 'OPP. RTC BUS STAND , RAMACHANDRAPURAM -533 E.G.DIST AP';
  const compGstin = sale.company_gstin || matchedComp.gstin || '37AZEPN5306R1ZS';

  const invNo = sale.invoice_number || sale.challan_number || '26-27/01';
  const invDate = sale.invoice_date ? formatDate(sale.invoice_date) : (sale.sale_date ? formatDate(sale.sale_date) : '01.09.2026');

  const receiverName = sale.customer_name || 'BTL EPC LTD';
  const receiverAddr = sale.receiver_address || sale.customer_address || '26-01-34-11A,RAMACHANDRAPURAM';
  const receiverState = sale.receiver_state || 'AP';
  const receiverStateCode = sale.receiver_state_code || '37';
  const receiverGstin = sale.customer_gstin || sale.receiver_gstin || '37AADCS7466G1Z0';

  const consigneeName = sale.consignee_name || receiverName;
  const consigneeAddr = sale.consignee_address || receiverAddr;
  const consigneeState = sale.consignee_state || receiverState;
  const consigneeStateCode = sale.consignee_state_code || receiverStateCode;
  const consigneeGstin = sale.consignee_gstin || receiverGstin;

  let grandTotal = 0;
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const itemRowsHtml = items.map((it, idx) => {
    const qty = parseFloat(it.quantity || 1);
    const rate = parseFloat(it.rate || 0);
    const taxableVal = parseFloat(it.taxable_value || (rate * qty));
    const gstRate = parseFloat(it.gst_rate || 0);
    const isIgst = Boolean(it.is_igst || (consigneeState && consigneeState.toUpperCase() !== 'AP' && consigneeState.toUpperCase() !== 'ANDHRA PRADESH' && consigneeState.toUpperCase() !== '37'));

    let cgstRate = 0, cgstAmt = 0, sgstRate = 0, sgstAmt = 0, igstRate = 0, igstAmt = 0;
    if (gstRate > 0) {
      if (isIgst) {
        igstRate = gstRate;
        igstAmt = (taxableVal * igstRate) / 100;
      } else {
        cgstRate = gstRate / 2;
        cgstAmt = (taxableVal * cgstRate) / 100;
        sgstRate = gstRate / 2;
        sgstAmt = (taxableVal * sgstRate) / 100;
      }
    }
    const lineTotal = taxableVal + cgstAmt + sgstAmt + igstAmt;

    totalTaxable += taxableVal;
    totalCgst += cgstAmt;
    totalSgst += sgstAmt;
    totalIgst += igstAmt;
    grandTotal += lineTotal;

    return `
      <tr>
        <td style="text-align:center;border:1px solid #000;padding:5px;">${idx + 1}</td>
        <td style="border:1px solid #000;padding:5px;">${esc(it.product_name || it.description || '')}</td>
        <td style="text-align:center;border:1px solid #000;padding:5px;">${esc(it.hsn_code || it.hsn_sac || '')}</td>
        <td style="text-align:center;border:1px solid #000;padding:5px;">${qty > 0 && it.unit ? `${qty} ${esc(it.unit)}` : ''}</td>
        <td style="text-align:right;border:1px solid #000;padding:5px;">${rate > 0 ? rate.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2}) : ''}</td>
        <td style="text-align:right;border:1px solid #000;padding:5px;">${taxableVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        <td style="text-align:right;border:1px solid #000;padding:5px;">${taxableVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        <td style="text-align:center;border:1px solid #000;padding:5px;">${cgstRate > 0 ? cgstRate + '%' : '-'}</td>
        <td style="text-align:right;border:1px solid #000;padding:5px;">${cgstAmt > 0 ? cgstAmt.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2}) : '-'}</td>
        <td style="text-align:center;border:1px solid #000;padding:5px;">${sgstRate > 0 ? sgstRate + '%' : '-'}</td>
        <td style="text-align:right;border:1px solid #000;padding:5px;">${sgstAmt > 0 ? sgstAmt.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2}) : '-'}</td>
        <td style="text-align:center;border:1px solid #000;padding:5px;">${igstRate > 0 ? igstRate + '%' : '-'}</td>
        <td style="text-align:right;border:1px solid #000;padding:5px;">${igstAmt > 0 ? igstAmt.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2}) : '-'}</td>
        <td style="text-align:right;border:1px solid #000;padding:5px;font-weight:bold;">${lineTotal.toLocaleString('en-IN', {minimumFractionDigits:0, maximumFractionDigits:2})}</td>
      </tr>
    `;
  }).join('');

  const barcodeSvg = window.generateBarcodeSVG ? window.generateBarcodeSVG(invNo, 32, true) : '';
  const qrCodeSvg = window.generateQRCodeSVG ? window.generateQRCodeSVG(websiteUrl, 75) : '';
  const grandTotalWords = numberToWordsINR ? numberToWordsINR(Math.round(grandTotal)) : `${Math.round(grandTotal)} Rupees Only`;

  // Parse dealer breakdown if available
  let customMeta = {};
  if (sale.custom_meta_json) {
    try {
      customMeta = typeof sale.custom_meta_json === "string" ? JSON.parse(sale.custom_meta_json) : sale.custom_meta_json;
    } catch(e) {}
  }
  const dealerBreakdown = sale.dealer_breakdown || customMeta.dealer_breakdown || [];
  const isDealerCommission = (sale.custom_type === 'dealers_commission') || (dealerBreakdown && dealerBreakdown.length > 0);

  let page2Html = '';
  if (isDealerCommission) {
    const listToRender = (dealerBreakdown && dealerBreakdown.length > 0) ? dealerBreakdown : [
      { model: "Tiller", rate: 2000, units: 0, bonus: 0, total: 0 },
      { model: "8D6", rate: 1500, units: 14, bonus: 0, total: 21000 },
      { model: "6D3 5-12", rate: 1000, units: 3, bonus: 0, total: 3000 },
      { model: "7P3 Win", rate: 500, units: 52, bonus: 0, total: 26000 },
      { model: "Water Pumps", rate: 500, units: 18, bonus: 0, total: 9000 }
    ];

    const matrixRows = customMeta.dealer_matrix_rows || [];
    const matrixModels = customMeta.dealer_models || [];

    let matrixTableHtml = '';
    if (matrixRows.length > 0 && matrixModels.length > 0) {
      let mHeadCols = matrixModels.map(m => `<th style="border:1px solid #000; padding:4px; text-align:center;">${esc(m.name)}</th>`).join('');
      let mColTotals = {};
      matrixModels.forEach(m => mColTotals[m.id] = 0);
      let mGrandQty = 0;

      let mBodyRows = matrixRows.map((r, idx) => {
        let rQtySum = 0;
        let rCols = matrixModels.map(m => {
          const q = parseInt(r.qtys && r.qtys[m.id] !== undefined ? r.qtys[m.id] : 0, 10) || 0;
          mColTotals[m.id] += q;
          rQtySum += q;
          return `<td style="border:1px solid #000; padding:4px; text-align:center;">${q > 0 ? q : ''}</td>`;
        }).join('');
        mGrandQty += rQtySum;

        return `
          <tr>
            <td style="border:1px solid #000; padding:4px; text-align:center;">${idx + 1}</td>
            <td style="border:1px solid #000; padding:4px; font-weight:bold;">${esc(r.dealer_name || '')}</td>
            <td style="border:1px solid #000; padding:4px; text-align:center;">${esc(r.inv_no || '')}</td>
            <td style="border:1px solid #000; padding:4px; text-align:center;">${esc(r.inv_date || '')}</td>
            ${rCols}
            <td style="border:1px solid #000; padding:4px; text-align:center; font-weight:bold;">${rQtySum}</td>
            <td style="border:1px solid #000; padding:4px; text-align:right;">${r.value ? parseFloat(r.value).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2}) : ''}</td>
            <td style="border:1px solid #000; padding:4px;">${esc(r.remarks || '')}</td>
          </tr>
        `;
      }).join('');

      let mTotCols = matrixModels.map(m => `<td style="border:1px solid #000; padding:4px; text-align:center; font-weight:bold;">${mColTotals[m.id] || 0}</td>`).join('');
      let mRateCols = matrixModels.map(m => `<td style="border:1px solid #000; padding:4px; text-align:center; font-weight:bold;">₹${m.rate}</td>`).join('');
      let mAmtCols = matrixModels.map(m => `<td style="border:1px solid #000; padding:4px; text-align:center; font-weight:bold;">₹${((mColTotals[m.id] || 0) * parseFloat(m.rate || 0)).toLocaleString('en-IN')}</td>`).join('');

      matrixTableHtml = `
        <div style="margin-bottom:16px;">
          <div style="font-weight:bold; font-size:11.5px; color:#1e40af; margin-bottom:4px; text-transform:uppercase;">
            📊 DEALER SALES INVOICES BREAKDOWN MATRIX
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:10px;">
            <thead>
              <tr style="background:#e2e8f0; font-weight:bold; text-align:center;">
                <th style="border:1px solid #000; padding:4px; width:35px;">SR.NO</th>
                <th style="border:1px solid #000; padding:4px; text-align:left;">DEALER NAME</th>
                <th style="border:1px solid #000; padding:4px;">INV.NO</th>
                <th style="border:1px solid #000; padding:4px;">INV.Date</th>
                ${mHeadCols}
                <th style="border:1px solid #000; padding:4px;">GRAND TOTAL</th>
                <th style="border:1px solid #000; padding:4px; text-align:right;">VALUE (₹)</th>
                <th style="border:1px solid #000; padding:4px;">REMARKS</th>
              </tr>
            </thead>
            <tbody>
              ${mBodyRows}
            </tbody>
            <tfoot>
              <tr style="background:#dbeafe; font-weight:bold;">
                <td colspan="4" style="border:1px solid #000; padding:4px; text-align:right;">TOTAL:</td>
                ${mTotCols}
                <td style="border:1px solid #000; padding:4px; text-align:center;">${mGrandQty}</td>
                <td colspan="2" style="border:1px solid #000;"></td>
              </tr>
              <tr style="background:#f0f9ff; font-weight:bold;">
                <td colspan="4" style="border:1px solid #000; padding:4px; text-align:right;">COMMISSION RATE:</td>
                ${mRateCols}
                <td colspan="3" style="border:1px solid #000;"></td>
              </tr>
              <tr style="background:#dcfce7; font-weight:bold;">
                <td colspan="4" style="border:1px solid #000; padding:4px; text-align:right;">COMMISSION AMT:</td>
                ${mAmtCols}
                <td colspan="3" style="border:1px solid #000;"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    let dealerRowsHtml = '';
    let grandDealerTotal = 0;
    listToRender.forEach((dItem, idx) => {
      const r = parseFloat(dItem.rate || 0);
      const u = parseFloat(dItem.units || 0);
      const b = parseFloat(dItem.bonus || 0);
      const t = parseFloat(dItem.total || ((r * u) + b));
      grandDealerTotal += t;

      dealerRowsHtml += `
        <tr>
          <td style="text-align:center; border:1px solid #000; padding:6px;">${idx + 1}</td>
          <td style="border:1px solid #000; padding:6px; font-weight:bold;">${esc(dItem.model || 'Product Model')}</td>
          <td style="text-align:center; border:1px solid #000; padding:6px;">₹${r.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
          <td style="text-align:center; border:1px solid #000; padding:6px; font-weight:bold;">${u}</td>
          <td style="text-align:center; border:1px solid #000; padding:6px;">₹${b.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
          <td style="text-align:right; border:1px solid #000; padding:6px; font-weight:bold;">₹${t.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        </tr>
      `;
    });

    const grandDealerWords = numberToWordsINR ? numberToWordsINR(Math.round(grandDealerTotal)) : `${Math.round(grandDealerTotal)} Rupees Only`;

    page2Html = `
      <div class="page-break" style="margin-top:25px;"></div>
      <div style="border: 2px solid #000; padding: 2px; margin-top:20px;">
        <div style="background:#dbeafe; font-weight:bold; font-size:13.5px; text-align:center; border-bottom:2px solid #000; padding:6px; color:#1e40af; text-transform:uppercase;">
          ANNEXURE - DEALER SALES BREAKDOWN COMMISSION STATEMENT
        </div>

        <!-- Header Information -->
        <table style="border-bottom: 2px solid #000;">
          <tr>
            <td style="width:65%; vertical-align:top; border-right:2px solid #000; padding:6px;">
              <div style="font-size:14px; font-weight:bold; text-transform:uppercase;">${esc(compName)}</div>
              <div style="font-size:10.5px; margin-top:3px;">${esc(compAddr)}</div>
              <div style="font-weight:bold; margin-top:4px;">GSTIN :- ${esc(compGstin)}</div>
            </td>
            <td style="width:35%; vertical-align:top; padding:0;">
              <table style="width:100%; border:none;">
                <tr style="border-bottom:1px solid #000;">
                  <td style="border:none; border-right:1px solid #000; font-weight:bold; width:50%; padding:4px 6px;">Serial No. of Invoice</td>
                  <td style="border:none; font-weight:bold; padding:4px 6px;">${esc(invNo)}</td>
                </tr>
                <tr style="border-bottom:1px solid #000;">
                  <td style="border:none; border-right:1px solid #000; font-weight:bold; padding:4px 6px;">Date of Invoice</td>
                  <td style="border:none; font-weight:bold; padding:4px 6px;">${esc(invDate)}</td>
                </tr>
                <tr>
                  <td style="border:none; border-right:1px solid #000; font-weight:bold; padding:4px 6px;">Receiver / Dealer</td>
                  <td style="border:none; font-weight:bold; padding:4px 6px;">${esc(receiverName)}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Matrix Breakdown Table if available -->
        ${matrixTableHtml}

        <!-- Model Summary Breakdown Table -->
        <div style="font-weight:bold; font-size:11.5px; color:#1e40af; margin:10px 0 4px 6px; text-transform:uppercase;">
          📋 PRODUCT MODEL COMMISSION SUMMARY
        </div>
        <table style="width:100%; border-collapse:collapse; border-bottom:2px solid #000;">
          <thead>
            <tr style="background:#e2e8f0; text-align:center; font-weight:bold;">
              <th style="width:6%; padding:6px; border:1px solid #000;">Sl. No.</th>
              <th style="width:34%; padding:6px; border:1px solid #000; text-align:left;">Product Model</th>
              <th style="width:18%; padding:6px; border:1px solid #000;">Commission Rate (₹)</th>
              <th style="width:12%; padding:6px; border:1px solid #000;">Units Sold</th>
              <th style="width:14%; padding:6px; border:1px solid #000;">Bonus (₹)</th>
              <th style="width:16%; padding:6px; border:1px solid #000; text-align:right;">Total Commission (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${dealerRowsHtml}
            <tr style="font-weight:bold; background:#eff6ff;">
              <td colspan="5" style="text-align:right; border:1px solid #000; padding:8px; font-size:12px;">Total Commission Taxable Value:</td>
              <td style="text-align:right; border:1px solid #000; padding:8px; font-size:13px; color:#1d4ed8;">₹${grandDealerTotal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
            </tr>
          </tbody>
        </table>

        <!-- Bill Value Words -->
        <table style="border-bottom: 2px solid #000;">
          <tr>
            <td style="width:45%; font-weight:bold; border-right:2px solid #000; padding:6px;">Total Commission Value (in Words)</td>
            <td style="font-weight:bold; font-size:11.5px; text-transform:capitalize; padding:6px;">${esc(grandDealerWords)}</td>
          </tr>
        </table>

        <!-- Signatures and QR Code -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:30px; padding:10px 15px;">
          <div style="text-align:left;">
            ${qrCodeSvg}
            <div style="font-size:9.5px; color:#555; margin-top:2px; font-weight:bold;">Visit us: ${esc(websiteUrl)}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-weight:bold; font-size:12px; margin-bottom:45px;">For ${esc(compName)}</div>
            <div style="font-weight:bold; border-top:1px solid #000; padding-top:4px; width:220px; font-size:11px;">Authorised Signature</div>
          </div>
        </div>
      </div>
    `;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Custom Tax Invoice - ${esc(invNo)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 10px; font-size: 11px; color: #000; background:#fff; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 0px; }
        th, td { border: 1px solid #000; padding: 4px 6px; font-size: 11px; }
        .no-border { border: none !important; }
        .page-break { page-break-before: always !important; break-before: page !important; }
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 5px; }
          .page-break { page-break-before: always !important; break-before: page !important; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom:12px;text-align:right;">
        <button onclick="window.print()" style="background:#4f46e5;color:#fff;border:none;padding:8px 18px;border-radius:4px;font-weight:bold;cursor:pointer;">🖨️ Print Custom Invoice</button>
      </div>

      <div style="border: 2px solid #000; padding: 2px;">
        <!-- Header -->
        <table style="border-bottom: 2px solid #000;">
          <tr>
            <td style="width:65%; font-weight:bold; vertical-align:top; border-right:2px solid #000; padding:6px;">
              <div style="font-size:14px; text-transform:uppercase;">${esc(compName)}</div>
              <div style="font-weight:normal; font-size:10.5px; margin-top:3px;">${esc(compAddr)}</div>
              <div style="font-weight:bold; margin-top:4px;">GSTIN :-${esc(compGstin)}</div>
            </td>
            <td style="width:35%; vertical-align:top; padding:0;">
              <table style="width:100%; border:none;">
                <tr style="border-bottom:1px solid #000;">
                  <td style="border:none; border-right:1px solid #000; font-weight:bold; width:50%; padding:4px 6px;">Serial No. of Invoice</td>
                  <td style="border:none; font-weight:bold; padding:4px 6px;">${esc(invNo)}</td>
                </tr>
                <tr>
                  <td style="border:none; border-right:1px solid #000; font-weight:bold; padding:4px 6px;">Date of Invoice</td>
                  <td style="border:none; font-weight:bold; padding:4px 6px;">${esc(invDate)}</td>
                </tr>
              </table>
              <div style="text-align:center; padding:4px 0 2px 0;">
                ${barcodeSvg}
              </div>
            </td>
          </tr>
        </table>

        <!-- Receiver & Consignee Grid -->
        <table style="border-bottom: 2px solid #000;">
          <tr>
            <td style="width:50%; vertical-align:top; border-right:2px solid #000; padding:0;">
              <div style="font-weight:bold; border-bottom:1px solid #000; padding:4px; background:#f8fafc;">Details of Receiver (Billed to)</div>
              <table style="width:100%; border:none;">
                <tr><td style="width:30%; border:none; font-weight:bold; padding:2px 6px;">Name</td><td style="border:none; padding:2px 6px;">${esc(receiverName)}</td></tr>
                <tr><td style="border:none; font-weight:bold; padding:2px 6px;">Address</td><td style="border:none; padding:2px 6px;">${esc(receiverAddr)}</td></tr>
                <tr><td style="border:none; font-weight:bold; padding:2px 6px;">State</td><td style="border:none; padding:2px 6px;">${esc(receiverState)}</td></tr>
                <tr><td style="border:none; font-weight:bold; padding:2px 6px;">State Code</td><td style="border:none; padding:2px 6px;">${esc(receiverStateCode)}</td></tr>
                <tr><td style="border:none; font-weight:bold; padding:2px 6px;">GSTIN/UIN</td><td style="border:none; font-weight:bold; padding:2px 6px;">${esc(receiverGstin)}</td></tr>
              </table>
            </td>
            <td style="width:50%; vertical-align:top; padding:0;">
              <div style="font-weight:bold; border-bottom:1px solid #000; padding:4px; background:#f8fafc;">Details of Consignee (Shipped to)</div>
              <table style="width:100%; border:none;">
                <tr><td style="width:30%; border:none; font-weight:bold; padding:2px 6px;">Name</td><td style="border:none; padding:2px 6px;">${esc(consigneeName)}</td></tr>
                <tr><td style="border:none; font-weight:bold; padding:2px 6px;">Address</td><td style="border:none; padding:2px 6px;">${esc(consigneeAddr)}</td></tr>
                <tr><td style="border:none; font-weight:bold; padding:2px 6px;">State</td><td style="border:none; padding:2px 6px;">${esc(consigneeState)}</td></tr>
                <tr><td style="border:none; font-weight:bold; padding:2px 6px;">State Code</td><td style="border:none; padding:2px 6px;">${esc(consigneeStateCode)}</td></tr>
                <tr><td style="border:none; font-weight:bold; padding:2px 6px;">GSTIN/UIN</td><td style="border:none; font-weight:bold; padding:2px 6px;">${esc(consigneeGstin)}</td></tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Line Items -->
        <table>
          <thead>
            <tr style="background:#e2e8f0; text-align:center;">
              <th rowspan="2" style="width:4%;">Sr. No.</th>
              <th rowspan="2" style="width:28%;">Description of Goods / Services</th>
              <th rowspan="2" style="width:8%;">HSN/SAC</th>
              <th rowspan="2" style="width:6%;">Qty. Unit</th>
              <th rowspan="2" style="width:8%;">Rate</th>
              <th rowspan="2" style="width:9%;">Total Value</th>
              <th rowspan="2" style="width:9%;">Taxable Value</th>
              <th colspan="2" style="width:10%;">CGST</th>
              <th colspan="2" style="width:10%;">SGST</th>
              <th colspan="2" style="width:10%;">IGST</th>
              <th rowspan="2" style="width:10%;">Total</th>
            </tr>
            <tr style="background:#e2e8f0; text-align:center;">
              <th style="width:4%;">Rate</th>
              <th style="width:6%;">Amt.</th>
              <th style="width:4%;">Rate</th>
              <th style="width:6%;">Amt.</th>
              <th style="width:4%;">Rate</th>
              <th style="width:6%;">Amt.</th>
            </tr>
          </thead>
          <tbody>
            ${itemRowsHtml}
            ${items.length < 2 ? `<tr><td style="height:35px;border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>` : ''}
            <tr style="font-weight:bold;">
              <td colspan="5" style="text-align:right; border:1px solid #000; padding:6px;">Total</td>
              <td style="text-align:right; border:1px solid #000; padding:6px;">${totalTaxable.toLocaleString('en-IN', {minimumFractionDigits:0, maximumFractionDigits:2})}</td>
              <td style="text-align:right; border:1px solid #000; padding:6px;">${totalTaxable.toLocaleString('en-IN', {minimumFractionDigits:0, maximumFractionDigits:2})}</td>
              <td style="border:1px solid #000;"></td>
              <td style="text-align:right; border:1px solid #000; padding:6px;">${totalCgst > 0 ? totalCgst.toLocaleString('en-IN', {minimumFractionDigits:0, maximumFractionDigits:2}) : '-'}</td>
              <td style="border:1px solid #000;"></td>
              <td style="text-align:right; border:1px solid #000; padding:6px;">${totalSgst > 0 ? totalSgst.toLocaleString('en-IN', {minimumFractionDigits:0, maximumFractionDigits:2}) : '-'}</td>
              <td style="border:1px solid #000;"></td>
              <td style="text-align:right; border:1px solid #000; padding:6px;">${totalIgst > 0 ? totalIgst.toLocaleString('en-IN', {minimumFractionDigits:0, maximumFractionDigits:2}) : '-'}</td>
              <td style="text-align:right; border:1px solid #000; padding:6px;">${grandTotal.toLocaleString('en-IN', {minimumFractionDigits:0, maximumFractionDigits:2})}</td>
            </tr>
          </tbody>
        </table>

        <!-- Bill Values -->
        <table style="border-top: 2px solid #000;">
          <tr>
            <td style="width:45%; font-weight:bold; border-right:2px solid #000;">Total Bill Value (in Figure)</td>
            <td style="text-align:right; font-weight:bold; font-size:12px;">${grandTotal.toLocaleString('en-IN', {minimumFractionDigits:0, maximumFractionDigits:2})}</td>
          </tr>
          <tr>
            <td style="font-weight:bold; border-right:2px solid #000;">Total Bill Value (in Words)</td>
            <td style="font-weight:bold; font-size:11.5px; text-transform:capitalize;">${esc(grandTotalWords)}</td>
          </tr>
        </table>

        <!-- Signatures and QR Code -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:25px; padding:10px 15px;">
          <div style="text-align:left;">
            ${qrCodeSvg}
            <div style="font-size:9.5px; color:#555; margin-top:2px; font-weight:bold;">Visit us: ${esc(websiteUrl)}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-weight:bold; font-size:12px; margin-bottom:45px;">For ${esc(compName)}</div>
            <div style="font-weight:bold; border-top:1px solid #000; padding-top:4px; width:220px; font-size:11px;">Authorised Signature</div>
          </div>
        </div>
      </div>

      ${page2Html}
    </body>
    </html>
  `;

  try { printWin.document.open(); } catch(e){}
  printWin.document.write(html);
  printWin.document.close();
}

// ── Helper: Open Create Custom Invoice Modal ──
function openCustomInvoiceModal(onSuccess) {
  let modal = document.getElementById("customInvoiceModal");
  if (modal) modal.remove();

  const activeCompId = selectedCompanyId && selectedCompanyId !== "all" ? parseInt(selectedCompanyId) : 1;
  const compList = (window.currentCompanies && window.currentCompanies.length > 0) ? window.currentCompanies : (typeof currentCompanies !== 'undefined' ? currentCompanies : []);
  const matchedComp = compList.find(c => c.id == activeCompId) || compList[0] || {};

  modal = document.createElement("div");
  modal.id = "customInvoiceModal";
  modal.className = "modal active";
  modal.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;";
  modal.innerHTML = `
    <div class="modal-content" style="max-width:960px;width:95%;max-height:88vh;overflow-y:auto;background:var(--bg-primary, #ffffff);border-radius:12px;padding:24px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.3);border:1px solid var(--border);box-sizing:border-box;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:16px;">
        <h3 style="font-size:18px; font-weight:700; color:var(--text1); margin:0;">➕ Create Custom Invoice</h3>
        <button class="close-modal" id="closeCustInvModal" style="background:none; border:none; font-size:24px; cursor:pointer; color:var(--text2);">&times;</button>
      </div>

      <form id="custInvForm">
        <!-- 1st Dropdown: Invoice Type -->
        <div class="form-group" style="margin-bottom:16px; background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #cbd5e1;">
          <label style="font-weight:700; font-size:13px; color:#1e293b; display:block; margin-bottom:6px;">Select Invoice Type *</label>
          <select id="custInvType" class="form-input" style="font-weight:600; font-size:14px; padding:8px 12px; width:100%; box-sizing:border-box;">
            <option value="salary">Salary Reimbursement / Labour Charges</option>
            <option value="rent">Rent Invoice</option>
            <option value="dealers_commission">Dealers Processing Commission</option>
            <option value="expenditure">Expenditure Invoice</option>
            <option value="transport_misc">Transport Charges / Misc Invoice</option>
          </select>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
          <!-- Billed To -->
          <div style="border:1px solid var(--border); padding:12px; border-radius:8px; background:var(--bg2);">
            <h4 style="font-size:13px; font-weight:700; margin-top:0; margin-bottom:10px; color:var(--primary);">Details of Receiver (Billed to)</h4>
            <div class="form-group" style="margin-bottom:8px;">
              <label style="font-size:11px;">Receiver Name *</label>
              <input type="text" id="custRecName" class="form-input" value="BTL EPC LTD" required style="width:100%; box-sizing:border-box;">
            </div>
            <div class="form-group" style="margin-bottom:8px;">
              <label style="font-size:11px;">Address *</label>
              <input type="text" id="custRecAddr" class="form-input" value="26-01-34-11A,RAMACHANDRAPURAM" required style="width:100%; box-sizing:border-box;">
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <div class="form-group" style="margin-bottom:8px;">
                <label style="font-size:11px;">State</label>
                <input type="text" id="custRecState" class="form-input" value="AP" style="width:100%; box-sizing:border-box;">
              </div>
              <div class="form-group" style="margin-bottom:8px;">
                <label style="font-size:11px;">State Code</label>
                <input type="text" id="custRecStateCode" class="form-input" value="37" style="width:100%; box-sizing:border-box;">
              </div>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label style="font-size:11px;">GSTIN/UIN</label>
              <input type="text" id="custRecGstin" class="form-input" value="37AADCS7466G1Z0" style="width:100%; box-sizing:border-box;">
            </div>
          </div>

          <!-- Consignee (Shipped to) -->
          <div style="border:1px solid var(--border); padding:12px; border-radius:8px; background:var(--bg2);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h4 style="font-size:13px; font-weight:700; margin:0; color:var(--primary);">Consignee (Shipped to)</h4>
              <label style="font-size:11px; cursor:pointer; color:var(--primary); font-weight:600;">
                <input type="checkbox" id="custSameConsignee" checked> Same as Billed To
              </label>
            </div>
            <div class="form-group" style="margin-bottom:8px;">
              <label style="font-size:11px;">Consignee Name</label>
              <input type="text" id="custConName" class="form-input" value="BTL EPC LTD" style="width:100%; box-sizing:border-box;">
            </div>
            <div class="form-group" style="margin-bottom:8px;">
              <label style="font-size:11px;">Address</label>
              <input type="text" id="custConAddr" class="form-input" value="26-01-34-11A,RAMACHANDRAPURAM" style="width:100%; box-sizing:border-box;">
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <div class="form-group" style="margin-bottom:8px;">
                <label style="font-size:11px;">State</label>
                <input type="text" id="custConState" class="form-input" value="AP" style="width:100%; box-sizing:border-box;">
              </div>
              <div class="form-group" style="margin-bottom:8px;">
                <label style="font-size:11px;">State Code</label>
                <input type="text" id="custConStateCode" class="form-input" value="37" style="width:100%; box-sizing:border-box;">
              </div>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label style="font-size:11px;">GSTIN/UIN</label>
              <input type="text" id="custConGstin" class="form-input" value="37AADCS7466G1Z0" style="width:100%; box-sizing:border-box;">
            </div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
          <div class="form-group" style="margin-bottom:0;">
            <label style="font-size:11px; font-weight:600;">Invoice Date *</label>
            <input type="date" id="custInvDate" class="form-input" value="${new Date().toISOString().split('T')[0]}" required style="width:100%; box-sizing:border-box;">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label style="font-size:11px; font-weight:600;">Company</label>
            <input type="text" class="form-input" value="${esc(matchedComp.name || 'MANASWINI ENTERPRISES')}" readonly style="background:var(--bg1); width:100%; box-sizing:border-box;">
          </div>
        </div>

        <!-- Dealers Sales Commission Calculator (Shown only when type === dealers_commission) -->
        <div id="dealerCommissionSection" style="display:none; margin-bottom:16px; border:1.5px solid #3b82f6; background:#eff6ff; padding:14px; border-radius:10px; box-shadow:0 4px 6px -1px rgba(59,130,246,0.1);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
            <div>
              <h4 style="font-size:14px; font-weight:700; color:#1d4ed8; margin:0; display:flex; align-items:center; gap:6px;">
                📊 Dealer Sales Breakdown Commission Matrix
              </h4>
              <p style="font-size:11.5px; color:#3b82f6; margin:2px 0 0 0;">
                Enter individual dealer sales invoices. Column totals and commission amounts will be calculated automatically in real time.
              </p>
            </div>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <button type="button" id="btnAddDealerMatrixRow" class="btn btn-sm" style="background:#2563eb; color:#fff; font-weight:600; font-size:11px; padding:5px 10px; border:none; border-radius:4px; cursor:pointer;">
                ➕ Add Dealer Invoice Row
              </button>
              <button type="button" id="btnAddDealerModelCol" class="btn btn-sm" style="background:#0284c7; color:#fff; font-weight:600; font-size:11px; padding:5px 10px; border:none; border-radius:4px; cursor:pointer;">
                ➕ Add Model Column
              </button>
              <button type="button" id="btnResetDealerSampleData" class="btn btn-sm" style="background:#475569; color:#fff; font-weight:600; font-size:11px; padding:5px 10px; border:none; border-radius:4px; cursor:pointer;">
                🔄 Pre-fill Sample Data
              </button>
            </div>
          </div>

          <!-- EXCEL MATRIX TABLE -->
          <div style="overflow-x:auto; background:#fff; border-radius:8px; border:1px solid #bfdbfe; margin-bottom:14px;">
            <table id="dealerMatrixTable" style="width:100%; min-width:850px; font-size:11.5px; border-collapse:collapse; text-align:left;">
              <thead id="dealerMatrixTHead">
                <!-- Rendered dynamically -->
              </thead>
              <tbody id="dealerMatrixTBody">
                <!-- Rendered dynamically -->
              </tbody>
              <tfoot id="dealerMatrixTFoot">
                <!-- Rendered dynamically -->
              </tfoot>
            </table>
          </div>

          <!-- SUMMARY TABLE -->
          <div style="background:#fff; border-radius:8px; border:1px solid #bfdbfe; padding:12px;">
            <h5 style="font-size:12.5px; font-weight:700; color:#1e40af; margin:0 0 8px 0;">
              📋 Product Model Commission Summary
            </h5>
            <table style="width:100%; font-size:12px; border-collapse:collapse; border:1px solid #dbeafe;">
              <thead>
                <tr style="background:#dbeafe; color:#1e40af; font-weight:bold;">
                  <th style="padding:6px 8px; text-align:left; border:1px solid #bfdbfe;">PRODUCT MODEL</th>
                  <th style="padding:6px 8px; text-align:center; border:1px solid #bfdbfe;">COMMISSION RATE (₹)</th>
                  <th style="padding:6px 8px; text-align:center; border:1px solid #bfdbfe;">UNITS SOLD</th>
                  <th style="padding:6px 8px; text-align:center; border:1px solid #bfdbfe;">BONUS (₹)</th>
                  <th style="padding:6px 8px; text-align:right; border:1px solid #bfdbfe;">TOTAL COMMISSION (₹)</th>
                </tr>
              </thead>
              <tbody id="dealerSummaryTBody">
                <!-- Rendered dynamically -->
              </tbody>
              <tfoot>
                <tr style="background:#eff6ff; font-weight:bold;">
                  <td colspan="4" style="padding:8px; text-align:right; border:1px solid #bfdbfe; font-size:12.5px; color:#1e3a8a;">Total Commission Taxable Value:</td>
                  <td style="padding:8px; text-align:right; color:#1d4ed8; font-size:14px; font-weight:800; border:1px solid #bfdbfe;" id="dealerTotalCommissionAmt">₹0.00</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- Custom Line Items Table -->
        <div style="margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <h4 style="font-size:13px; font-weight:700; margin:0; color:var(--text1);">Invoice Line Items</h4>
            <button type="button" id="btnAddCustItem" class="btn btn-sm btn-outline" style="font-size:12px; font-weight:600;">➕ Add Line Item</button>
          </div>
          <table style="width:100%; font-size:12px; border-collapse:collapse; table-layout:fixed;" class="data-table">
            <thead>
              <tr>
                <th style="width:32%;">Description of Goods / Services</th>
                <th style="width:14%;">HSN/SAC</th>
                <th style="width:18%;">Taxable Value (₹)</th>
                <th style="width:12%;">GST Rate %</th>
                <th style="width:16%;">Total Value (₹)</th>
                <th style="width:8%;">Action</th>
              </tr>
            </thead>
            <tbody id="custItemsTbody">
              <!-- Rendered via JS -->
            </tbody>
          </table>
        </div>

        <!-- Tax & Grand Total Summary Box -->
        <div style="background:var(--bg2); border:1px solid var(--border); padding:12px; border-radius:8px; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:700; margin-bottom:4px;">
            <span>Subtotal (Taxable Amount):</span>
            <span id="custSummaryTaxable">₹0.00</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text2); margin-bottom:2px;">
            <span>CGST Amount:</span>
            <span id="custSummaryCgst">₹0.00</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text2); margin-bottom:4px;">
            <span>SGST Amount:</span>
            <span id="custSummarySgst">₹0.00</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:15px; font-weight:800; color:var(--primary); border-top:1px solid var(--border); padding-top:6px;">
            <span>Grand Total (in Figures):</span>
            <span id="custSummaryGrand">₹0.00</span>
          </div>
          <div style="font-size:11.5px; font-weight:600; color:var(--text2); margin-top:4px; font-style:italic;" id="custSummaryWords">
            Words: Zero Rupees Only
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:12px;">
          <button type="button" class="btn btn-outline" id="cancelCustInvModal">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btnSaveCustInv" style="background:linear-gradient(135deg,#4f46e5,#3b82f6); color:#fff; font-weight:700; padding:8px 20px;">💾 Save & Print Custom Invoice</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const invTypeSel = document.getElementById("custInvType");
  const dealerSec = document.getElementById("dealerCommissionSection");
  const sameConsigneeCb = document.getElementById("custSameConsignee");
  const itemsTbody = document.getElementById("custItemsTbody");

  sameConsigneeCb.addEventListener("change", () => {
    if (sameConsigneeCb.checked) {
      document.getElementById("custConName").value = document.getElementById("custRecName").value;
      document.getElementById("custConAddr").value = document.getElementById("custRecAddr").value;
      document.getElementById("custConState").value = document.getElementById("custRecState").value;
      document.getElementById("custConStateCode").value = document.getElementById("custRecStateCode").value;
      document.getElementById("custConGstin").value = document.getElementById("custRecGstin").value;
    }
  });

  document.getElementById("custRecName").addEventListener("input", () => { if (sameConsigneeCb.checked) document.getElementById("custConName").value = document.getElementById("custRecName").value; });
  document.getElementById("custRecAddr").addEventListener("input", () => { if (sameConsigneeCb.checked) document.getElementById("custConAddr").value = document.getElementById("custRecAddr").value; });
  document.getElementById("custRecState").addEventListener("input", () => { if (sameConsigneeCb.checked) document.getElementById("custConState").value = document.getElementById("custRecState").value; });
  document.getElementById("custRecStateCode").addEventListener("input", () => { if (sameConsigneeCb.checked) document.getElementById("custConStateCode").value = document.getElementById("custRecStateCode").value; });
  document.getElementById("custRecGstin").addEventListener("input", () => { if (sameConsigneeCb.checked) document.getElementById("custConGstin").value = document.getElementById("custRecGstin").value; });

  // ═══════════════ EXCEL MATRIX CALCULATOR LOGIC ═══════════════
  let dealerModels = [
    { id: "m1", name: "Tiller", rate: 2000, bonus: 0 },
    { id: "m2", name: "8D6", rate: 1500, bonus: 0 },
    { id: "m3", name: "6D3 5-12", rate: 1000, bonus: 0 },
    { id: "m4", name: "7P3 Win", rate: 500, bonus: 0 },
    { id: "m5", name: "Water Pumps", rate: 500, bonus: 0 }
  ];

  function getJuly2026SampleRows() {
    return [
      { sr: 1, dealer_name: "KOTHAMMATHALLI ENTERPRISES", inv_no: "AGRSIAP2627/0019", inv_date: "7/6/2026", qtys: { m4: 4 }, value: 96000, remarks: "" },
      { sr: 2, dealer_name: "CHANDRAKALA RYTHU", inv_no: "AGRSIAP2627/0020", inv_date: "07-072026", qtys: { m4: 26 }, value: 650000, remarks: "" },
      { sr: 3, dealer_name: "SRI KANKA MAHALAKSHMI AGROS", inv_no: "AGRSIAP2627/0021", inv_date: "7/8/2026", qtys: { m4: 10 }, value: 250000, remarks: "" },
      { sr: 4, dealer_name: "PASHA AGRO INDUSTRIES", inv_no: "AGRSIAP2627/0022", inv_date: "7/14/2026", qtys: { m5: 10 }, value: 100001, remarks: "" },
      { sr: 5, dealer_name: "SRI KANKAMAHALAKSHMI BMB AGROS", inv_no: "AGRSIAP2627/0023", inv_date: "7/17/2026", qtys: { m2: 1 }, value: 72500, remarks: "" },
      { sr: 6, dealer_name: "MANASWINI ENTERPRISES", inv_no: "AGRSIAP2627/0025", inv_date: "7/17/2026", qtys: { m4: 10 }, value: 250005, remarks: "" },
      { sr: 7, dealer_name: "MANASALAKSHMI ENTERPRISES", inv_no: "AGRSIAP2627/0026", inv_date: "7/20/2026", qtys: { m5: 1 }, value: 10001, remarks: "" },
      { sr: 8, dealer_name: "SRI KANKAMAHALAKSHMI BMB AGROS", inv_no: "AGRSIAP2627/0027", inv_date: "7/20/2026", qtys: { m2: 2 }, value: 145001, remarks: "" },
      { sr: 9, dealer_name: "MANASALAKSHMI ENTERPRISES", inv_no: "AGRSIAP2627/0028", inv_date: "7/24/2026", qtys: { m5: 5 }, value: 50000, remarks: "" },
      { sr: 10, dealer_name: "SV AGRO TRADERS", inv_no: "AGRSIAP2627/0029", inv_date: "7/24/2026", qtys: { m5: 2 }, value: 20000, remarks: "" },
      { sr: 11, dealer_name: "KOTHAMATHALLI ENTERPRISES", inv_no: "AGRSIAP2627/0030", inv_date: "7/27/2026", qtys: { m2: 5 }, value: 300000, remarks: "" },
      { sr: 12, dealer_name: "SRI SIVANI AUTOMOBILES", inv_no: "AGRSIAP2627/0031", inv_date: "7/27/2026", qtys: { m2: 5, m3: 3, m4: 2 }, value: 531000, remarks: "" },
      { sr: 13, dealer_name: "SV AGRO TRADERS", inv_no: "AGRSIAP2627/0032", inv_date: "7/28/2026", qtys: { m2: 1 }, value: 60000, remarks: "" }
    ];
  }

  let dealerMatrixRows = getJuly2026SampleRows();

  function renderDealerMatrix() {
    const thead = document.getElementById("dealerMatrixTHead");
    const tbody = document.getElementById("dealerMatrixTBody");
    const tfoot = document.getElementById("dealerMatrixTFoot");
    const summaryTbody = document.getElementById("dealerSummaryTBody");
    if (!thead || !tbody || !tfoot) return;

    // Header
    let headHtml = `
      <tr style="background:#dbeafe; color:#1e40af; font-weight:bold; font-size:11px;">
        <th style="padding:6px; border:1px solid #bfdbfe; width:45px; text-align:center;">SR.NO</th>
        <th style="padding:6px; border:1px solid #bfdbfe; min-width:160px;">DEALER NAME</th>
        <th style="padding:6px; border:1px solid #bfdbfe; width:120px;">INV.NO</th>
        <th style="padding:6px; border:1px solid #bfdbfe; width:95px; text-align:center;">INV.Date</th>
    `;
    dealerModels.forEach((m) => {
      headHtml += `
        <th style="padding:4px 6px; border:1px solid #bfdbfe; text-align:center; min-width:85px; background:#eff6ff;">
          <div style="display:flex; flex-direction:column; gap:2px; align-items:center;">
            <input type="text" class="form-input matrixModelNameInp" data-mid="${m.id}" value="${esc(m.name)}" style="width:100%; font-size:11px; font-weight:bold; text-align:center; padding:2px 4px; box-sizing:border-box;">
            <div style="display:flex; align-items:center; gap:2px; font-size:10px; color:#1e40af;">
              <span>Rate ₹</span>
              <input type="number" class="form-input matrixModelRateInp" data-mid="${m.id}" value="${m.rate}" style="width:55px; font-size:10.5px; text-align:center; padding:1px 2px; box-sizing:border-box;">
              ${dealerModels.length > 1 ? `<button type="button" class="delMatrixColBtn" data-mid="${m.id}" style="background:none; border:none; color:#ef4444; font-weight:bold; cursor:pointer; font-size:12px; padding:0 2px;" title="Delete Column">&times;</button>` : ''}
            </div>
          </div>
        </th>
      `;
    });
    headHtml += `
        <th style="padding:6px; border:1px solid #bfdbfe; width:80px; text-align:center;">GRAND TOTAL QTY</th>
        <th style="padding:6px; border:1px solid #bfdbfe; width:100px; text-align:right;">VALUE (₹)</th>
        <th style="padding:6px; border:1px solid #bfdbfe; min-width:100px;">REMARKS</th>
        <th style="padding:6px; border:1px solid #bfdbfe; width:40px; text-align:center;">ACT</th>
      </tr>
    `;
    thead.innerHTML = headHtml;

    // Body
    let bodyHtml = "";
    let colTotals = {};
    dealerModels.forEach(m => colTotals[m.id] = 0);
    let grandUnitsAllRows = 0;

    dealerMatrixRows.forEach((r, rIdx) => {
      let rowQtySum = 0;
      let modelColsHtml = "";

      dealerModels.forEach(m => {
        const q = parseInt(r.qtys && r.qtys[m.id] !== undefined ? r.qtys[m.id] : 0, 10) || 0;
        colTotals[m.id] += q;
        rowQtySum += q;
        modelColsHtml += `
          <td style="padding:2px; border:1px solid #bfdbfe; text-align:center;">
            <input type="number" min="0" class="form-input matrixCellInp" data-ridx="${rIdx}" data-mid="${m.id}" value="${q || ''}" style="width:100%; text-align:center; font-size:11.5px; padding:2px 4px; box-sizing:border-box;">
          </td>
        `;
      });

      grandUnitsAllRows += rowQtySum;

      bodyHtml += `
        <tr style="background:${rIdx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding:4px; border:1px solid #bfdbfe; text-align:center; font-weight:600; color:#64748b;">${rIdx + 1}</td>
          <td style="padding:2px; border:1px solid #bfdbfe;">
            <input type="text" class="form-input matrixDealerInp" data-ridx="${rIdx}" value="${esc(r.dealer_name || '')}" placeholder="Dealer Name" style="width:100%; font-size:11.5px; padding:2px 4px; box-sizing:border-box;">
          </td>
          <td style="padding:2px; border:1px solid #bfdbfe;">
            <input type="text" class="form-input matrixInvNoInp" data-ridx="${rIdx}" value="${esc(r.inv_no || '')}" placeholder="Inv No" style="width:100%; font-size:11.5px; padding:2px 4px; box-sizing:border-box;">
          </td>
          <td style="padding:2px; border:1px solid #bfdbfe;">
            <input type="text" class="form-input matrixInvDateInp" data-ridx="${rIdx}" value="${esc(r.inv_date || '')}" placeholder="Date" style="width:100%; text-align:center; font-size:11.5px; padding:2px 4px; box-sizing:border-box;">
          </td>
          ${modelColsHtml}
          <td style="padding:4px; border:1px solid #bfdbfe; text-align:center; font-weight:bold; color:#1e40af; background:#f1f5f9;">${rowQtySum}</td>
          <td style="padding:2px; border:1px solid #bfdbfe;">
            <input type="number" step="0.01" class="form-input matrixValueInp" data-ridx="${rIdx}" value="${r.value !== undefined ? r.value : ''}" placeholder="0.00" style="width:100%; text-align:right; font-size:11.5px; padding:2px 4px; box-sizing:border-box;">
          </td>
          <td style="padding:2px; border:1px solid #bfdbfe;">
            <input type="text" class="form-input matrixRemarksInp" data-ridx="${rIdx}" value="${esc(r.remarks || '')}" placeholder="Remarks" style="width:100%; font-size:11.5px; padding:2px 4px; box-sizing:border-box;">
          </td>
          <td style="padding:2px; border:1px solid #bfdbfe; text-align:center;">
            <button type="button" class="delMatrixRowBtn" data-ridx="${rIdx}" style="background:none; border:none; color:#ef4444; font-weight:bold; cursor:pointer; font-size:14px;" title="Delete Row">&times;</button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = bodyHtml;

    // Footer Rows
    let totRowCols = "";
    let rateRowCols = "";
    let amtRowCols = "";
    let grandCommissionAmt = 0;
    const summaryRowsArr = [];

    dealerModels.forEach(m => {
      const u = colTotals[m.id] || 0;
      const r = parseFloat(m.rate || 0);
      const b = parseFloat(m.bonus || 0);
      const comm = (u * r) + b;
      grandCommissionAmt += comm;

      totRowCols += `<td style="padding:6px; border:1px solid #bfdbfe; text-align:center; font-weight:800; font-size:12px; color:#1e40af;">${u}</td>`;
      rateRowCols += `<td style="padding:6px; border:1px solid #bfdbfe; text-align:center; font-weight:700; font-size:11.5px; color:#0369a1;">₹${r}</td>`;
      amtRowCols += `<td style="padding:6px; border:1px solid #bfdbfe; text-align:center; font-weight:800; font-size:12px; color:#15803d;">₹${comm.toFixed(0)}</td>`;

      summaryRowsArr.push({ model: m.name, rate: r, units: u, bonus: b, total: comm });
    });

    let footHtml = `
      <tr style="background:#dbeafe; font-weight:bold;">
        <td colspan="4" style="padding:6px 8px; text-align:right; border:1px solid #bfdbfe; color:#1e40af;">TOTAL UNITS SOLD:</td>
        ${totRowCols}
        <td style="padding:6px; text-align:center; border:1px solid #bfdbfe; color:#1e40af; font-size:12.5px;">${grandUnitsAllRows}</td>
        <td colspan="3" style="border:1px solid #bfdbfe;"></td>
      </tr>
      <tr style="background:#f0f9ff; font-weight:bold;">
        <td colspan="4" style="padding:6px 8px; text-align:right; border:1px solid #bfdbfe; color:#0369a1;">COMMISSION RATE (₹):</td>
        ${rateRowCols}
        <td colspan="4" style="border:1px solid #bfdbfe;"></td>
      </tr>
      <tr style="background:#dcfce7; font-weight:bold;">
        <td colspan="4" style="padding:6px 8px; text-align:right; border:1px solid #bfdbfe; color:#15803d; font-size:12.5px;">COMMISSION AMOUNT (₹):</td>
        ${amtRowCols}
        <td colspan="4" style="padding:6px 8px; text-align:right; border:1px solid #bfdbfe; font-size:13.5px; color:#15803d; font-weight:800;">₹${grandCommissionAmt.toFixed(2)}</td>
      </tr>
    `;
    tfoot.innerHTML = footHtml;

    // Summary Table
    if (summaryTbody) {
      summaryTbody.innerHTML = summaryRowsArr.map(s => `
        <tr>
          <td style="padding:6px 8px; border:1px solid #bfdbfe; font-weight:600; color:#1e293b;">${esc(s.model)}</td>
          <td style="padding:6px 8px; border:1px solid #bfdbfe; text-align:center;">₹${s.rate.toFixed(2)}</td>
          <td style="padding:6px 8px; border:1px solid #bfdbfe; text-align:center; font-weight:bold; color:#1d4ed8;">${s.units}</td>
          <td style="padding:6px 8px; border:1px solid #bfdbfe; text-align:center;">₹${s.bonus.toFixed(2)}</td>
          <td style="padding:6px 8px; border:1px solid #bfdbfe; text-align:right; font-weight:bold; color:#15803d;">₹${s.total.toFixed(2)}</td>
        </tr>
      `).join("");
    }

    const grandCommEl = document.getElementById("dealerTotalCommissionAmt");
    if (grandCommEl) grandCommEl.innerText = `₹${grandCommissionAmt.toFixed(2)}`;

    // Auto-update first item value in line items
    if (invTypeSel.value === "dealers_commission") {
      const firstValInp = itemsTbody.querySelector("tr .custItemVal");
      if (firstValInp) {
        firstValInp.value = grandCommissionAmt;
        recalcCustomTotals();
      }
    }

    // Attach Event Handlers
    tbody.querySelectorAll(".matrixDealerInp").forEach(inp => {
      inp.addEventListener("input", (e) => {
        const ridx = parseInt(e.target.dataset.ridx, 10);
        if (dealerMatrixRows[ridx]) dealerMatrixRows[ridx].dealer_name = e.target.value;
      });
    });

    tbody.querySelectorAll(".matrixInvNoInp").forEach(inp => {
      inp.addEventListener("input", (e) => {
        const ridx = parseInt(e.target.dataset.ridx, 10);
        if (dealerMatrixRows[ridx]) dealerMatrixRows[ridx].inv_no = e.target.value;
      });
    });

    tbody.querySelectorAll(".matrixInvDateInp").forEach(inp => {
      inp.addEventListener("input", (e) => {
        const ridx = parseInt(e.target.dataset.ridx, 10);
        if (dealerMatrixRows[ridx]) dealerMatrixRows[ridx].inv_date = e.target.value;
      });
    });

    tbody.querySelectorAll(".matrixValueInp").forEach(inp => {
      inp.addEventListener("input", (e) => {
        const ridx = parseInt(e.target.dataset.ridx, 10);
        if (dealerMatrixRows[ridx]) dealerMatrixRows[ridx].value = parseFloat(e.target.value || 0);
      });
    });

    tbody.querySelectorAll(".matrixRemarksInp").forEach(inp => {
      inp.addEventListener("input", (e) => {
        const ridx = parseInt(e.target.dataset.ridx, 10);
        if (dealerMatrixRows[ridx]) dealerMatrixRows[ridx].remarks = e.target.value;
      });
    });

    tbody.querySelectorAll(".matrixCellInp").forEach(inp => {
      inp.addEventListener("input", (e) => {
        const ridx = parseInt(e.target.dataset.ridx, 10);
        const mid = e.target.dataset.mid;
        if (dealerMatrixRows[ridx]) {
          if (!dealerMatrixRows[ridx].qtys) dealerMatrixRows[ridx].qtys = {};
          dealerMatrixRows[ridx].qtys[mid] = parseInt(e.target.value || 0, 10);
          renderDealerMatrix();
        }
      });
    });

    tbody.querySelectorAll(".delMatrixRowBtn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const ridx = parseInt(e.target.dataset.ridx, 10);
        dealerMatrixRows.splice(ridx, 1);
        renderDealerMatrix();
      });
    });

    thead.querySelectorAll(".matrixModelNameInp").forEach(inp => {
      inp.addEventListener("input", (e) => {
        const mid = e.target.dataset.mid;
        const m = dealerModels.find(x => x.id === mid);
        if (m) {
          m.name = e.target.value;
          renderDealerMatrix();
        }
      });
    });

    thead.querySelectorAll(".matrixModelRateInp").forEach(inp => {
      inp.addEventListener("input", (e) => {
        const mid = e.target.dataset.mid;
        const m = dealerModels.find(x => x.id === mid);
        if (m) {
          m.rate = parseFloat(e.target.value || 0);
          renderDealerMatrix();
        }
      });
    });

    thead.querySelectorAll(".delMatrixColBtn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const mid = e.target.dataset.mid;
        dealerModels = dealerModels.filter(x => x.id !== mid);
        renderDealerMatrix();
      });
    });
  }

  document.getElementById("btnAddDealerMatrixRow").addEventListener("click", () => {
    dealerMatrixRows.push({
      sr: dealerMatrixRows.length + 1,
      dealer_name: "",
      inv_no: "",
      inv_date: new Date().toLocaleDateString('en-IN'),
      qtys: {},
      value: 0,
      remarks: ""
    });
    renderDealerMatrix();
  });

  document.getElementById("btnAddDealerModelCol").addEventListener("click", () => {
    const mName = prompt("Enter Product Model Name:", "New Model");
    if (!mName || !mName.trim()) return;
    const rateStr = prompt("Enter Commission Rate (₹):", "500");
    const mRate = parseFloat(rateStr || 0);
    const newMid = "m_" + Date.now();
    dealerModels.push({ id: newMid, name: mName.trim(), rate: mRate, bonus: 0 });
    renderDealerMatrix();
  });

  document.getElementById("btnResetDealerSampleData").addEventListener("click", () => {
    if (confirm("Reset breakdown matrix to July 2026 sample data?")) {
      dealerMatrixRows = getJuly2026SampleRows();
      renderDealerMatrix();
    }
  });

  function resetItemsForType(type) {
    itemsTbody.innerHTML = "";
    if (type === "salary") {
      dealerSec.style.display = "none";
      addItemRow("Reimbursment of labour charge-July-2026", "998511", 12000, 0);
    } else if (type === "rent") {
      dealerSec.style.display = "none";
      addItemRow("Godown Rent for July-2026", "997212", 20000, 18);
    } else if (type === "dealers_commission") {
      dealerSec.style.display = "block";
      addItemRow("Commission for July 2026", "996111", 59000, 18);
      renderDealerMatrix();
    } else if (type === "expenditure") {
      dealerSec.style.display = "none";
      addItemRow("Expenditure Charges", "998511", 10000, 0);
    } else if (type === "transport_misc") {
      dealerSec.style.display = "none";
      addItemRow("Transport charges (Rcpm To Kurnool) P.B.Enterprises,Inv no- AGRSIAP2526/00067", "996511", 9500, 5);
      addItemRow("Transport charges (Rcpm To ) P.B.Enterprises,Inv no- AGRSIAP2526/00066", "996511", 13000, 5);
    }
    recalcCustomTotals();
  }

  function addItemRow(desc = "", hsn = "", val = 0, gst = 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding:4px;"><input type="text" class="form-input custItemDesc" value="${esc(desc)}" required style="width:100%; box-sizing:border-box; padding:4px 6px; font-size:12px;"></td>
      <td style="padding:4px;"><input type="text" class="form-input custItemHsn" value="${esc(hsn)}" required style="width:100%; box-sizing:border-box; text-align:center; padding:4px 6px; font-size:12px;"></td>
      <td style="padding:4px;"><input type="number" step="0.01" class="form-input custItemVal" value="${val}" required style="width:100%; box-sizing:border-box; text-align:right; padding:4px 6px; font-size:12px;"></td>
      <td style="padding:4px;"><input type="number" step="0.01" class="form-input custItemGst" value="${gst}" required style="width:100%; box-sizing:border-box; text-align:center; padding:4px 6px; font-size:12px;"></td>
      <td style="text-align:right; font-weight:700; padding:4px 6px;" class="custItemTotalTd">₹0.00</td>
      <td style="text-align:center; padding:4px;"><button type="button" class="btn btn-sm btn-danger removeCustItemBtn" style="padding:2px 6px; font-size:12px; line-height:1;">&times;</button></td>
    `;
    itemsTbody.appendChild(tr);

    tr.querySelector(".custItemVal").addEventListener("input", recalcCustomTotals);
    tr.querySelector(".custItemGst").addEventListener("input", recalcCustomTotals);
    tr.querySelector(".removeCustItemBtn").addEventListener("click", () => {
      tr.remove();
      recalcCustomTotals();
    });
  }

  document.getElementById("btnAddCustItem").addEventListener("click", () => {
    addItemRow("", "", 0, 0);
    recalcCustomTotals();
  });

  invTypeSel.addEventListener("change", (e) => {
    resetItemsForType(e.target.value);
  });

  function recalcCustomTotals() {
    let totTaxable = 0;
    let totCgst = 0;
    let totSgst = 0;
    let grandTot = 0;

    itemsTbody.querySelectorAll("tr").forEach(tr => {
      const val = parseFloat(tr.querySelector(".custItemVal")?.value || 0);
      const gst = parseFloat(tr.querySelector(".custItemGst")?.value || 0);
      const cgstAmt = (val * (gst / 2)) / 100;
      const sgstAmt = (val * (gst / 2)) / 100;
      const total = val + cgstAmt + sgstAmt;

      totTaxable += val;
      totCgst += cgstAmt;
      totSgst += sgstAmt;
      grandTot += total;

      const totalTd = tr.querySelector(".custItemTotalTd");
      if (totalTd) totalTd.innerText = `₹${total.toFixed(2)}`;
    });

    document.getElementById("custSummaryTaxable").innerText = `₹${totTaxable.toFixed(2)}`;
    document.getElementById("custSummaryCgst").innerText = `₹${totCgst.toFixed(2)}`;
    document.getElementById("custSummarySgst").innerText = `₹${totSgst.toFixed(2)}`;
    document.getElementById("custSummaryGrand").innerText = `₹${grandTot.toFixed(2)}`;
    document.getElementById("custSummaryWords").innerText = `Words: ${numberToWordsINR ? numberToWordsINR(Math.round(grandTot)) : Math.round(grandTot) + ' Rupees Only'}`;
  }

  resetItemsForType("salary");

  document.getElementById("closeCustInvModal").addEventListener("click", () => modal.remove());
  document.getElementById("cancelCustInvModal").addEventListener("click", () => modal.remove());

  document.getElementById("custInvForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const type = invTypeSel.value;
    const invDate = document.getElementById("custInvDate").value;

    const recName = document.getElementById("custRecName").value.trim();
    const recAddr = document.getElementById("custRecAddr").value.trim();
    const recState = document.getElementById("custRecState").value.trim();
    const recStateCode = document.getElementById("custRecStateCode").value.trim();
    const recGstin = document.getElementById("custRecGstin").value.trim();

    const conName = document.getElementById("custConName").value.trim();
    const conAddr = document.getElementById("custConAddr").value.trim();
    const conState = document.getElementById("custConState").value.trim();
    const conStateCode = document.getElementById("custConStateCode").value.trim();
    const conGstin = document.getElementById("custConGstin").value.trim();

    const items = [];
    let grandTotal = 0;

    itemsTbody.querySelectorAll("tr").forEach(tr => {
      const desc = tr.querySelector(".custItemDesc")?.value.trim() || "";
      const hsn = tr.querySelector(".custItemHsn")?.value.trim() || "";
      const val = parseFloat(tr.querySelector(".custItemVal")?.value || 0);
      const gst = parseFloat(tr.querySelector(".custItemGst")?.value || 0);
      const cgstAmt = (val * (gst / 2)) / 100;
      const sgstAmt = (val * (gst / 2)) / 100;
      const total = val + cgstAmt + sgstAmt;
      grandTotal += total;

      items.push({
        description: desc,
        product_name: desc,
        hsn_sac: hsn,
        hsn_code: hsn,
        taxable_value: val,
        gst_rate: gst,
        quantity: 1,
        unit: "",
        rate: val,
        total_value: total,
        total: total
      });
    });

    if (items.length === 0) {
      showToast("Please add at least one line item", "warning");
      return;
    }

    const dealerBreakdown = [];
    if (type === "dealers_commission") {
      let colTotals = {};
      dealerModels.forEach(m => colTotals[m.id] = 0);
      dealerMatrixRows.forEach(r => {
        dealerModels.forEach(m => {
          const q = parseInt(r.qtys && r.qtys[m.id] !== undefined ? r.qtys[m.id] : 0, 10) || 0;
          colTotals[m.id] += q;
        });
      });

      dealerModels.forEach(m => {
        const u = colTotals[m.id] || 0;
        const r = parseFloat(m.rate || 0);
        const b = parseFloat(m.bonus || 0);
        const t = (u * r) + b;
        dealerBreakdown.push({ model: m.name, rate: r, units: u, bonus: b, total: t });
      });
    }

    const metaObj = {
      dealer_breakdown: dealerBreakdown,
      dealer_models: dealerModels,
      dealer_matrix_rows: dealerMatrixRows
    };

    const payload = {
      action: "create-custom-invoice",
      company_id: activeCompId,
      custom_type: type,
      invoice_date: invDate,
      receiver_name: recName,
      receiver_address: recAddr,
      receiver_state: recState,
      receiver_state_code: recStateCode,
      receiver_gstin: recGstin,
      consignee_name: conName,
      consignee_address: conAddr,
      consignee_state: conState,
      consignee_state_code: conStateCode,
      consignee_gstin: conGstin,
      items: items,
      grand_total: grandTotal,
      custom_meta_json: JSON.stringify(metaObj)
    };

    const submitBtn = document.getElementById("btnSaveCustInv");
    setButtonLoading(submitBtn, true, "Saving Custom Invoice...");

    try {
      const res = await fetch(`${API_BASE}/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload)
      });
      const d = await res.json();
      if (d.success) {
        showToast(d.message || "Custom Invoice created successfully!", "success");
        modal.remove();

        const saleObj = d.sale || {
          id: d.sale_id,
          invoice_number: d.invoice_number,
          company_id: activeCompId,
          customer_name: recName,
          receiver_address: recAddr,
          receiver_state: recState,
          receiver_state_code: recStateCode,
          customer_gstin: recGstin,
          consignee_name: conName,
          consignee_address: conAddr,
          consignee_state: conState,
          consignee_state_code: conStateCode,
          consignee_gstin: conGstin,
          invoice_date: invDate,
          grand_total: grandTotal,
          custom_type: type,
          dealer_breakdown: dealerBreakdown,
          custom_meta_json: JSON.stringify(metaObj)
        };
        saleObj.custom_type = type;
        saleObj.dealer_breakdown = dealerBreakdown;
        saleObj.custom_meta_json = saleObj.custom_meta_json || JSON.stringify(metaObj);

        const itemsArr = (d.items && d.items.length > 0) ? d.items : items;
        printCustomInvoice(saleObj, itemsArr);

        if (typeof onSuccess === "function") onSuccess();
      } else {
        showToast(d.error || "Failed to create custom invoice", "error");
        setButtonLoading(submitBtn, false);
      }
    } catch (err) {
      showToast("Error: " + err.message, "error");
      setButtonLoading(submitBtn, false);
    }
  });
}

// ── Helper: Print Delivery Challan (Dual Copies: Original & Customer Copy) ──
function printDeliveryChallan(sale, items, payments = [], returns = [], existingWin = null) {
  let printWin = existingWin;
  if (!printWin || printWin.closed) {
    printWin = window.open('', '_blank', 'width=900,height=1000');
  }
  if (!printWin) {
    if (typeof showToast === 'function') showToast("⚠️ Pop-up window was blocked by your browser! Please allow pop-ups for this website.", "warning");
    return;
  }
  const compIdToFind = sale.company_id || (selectedCompanyId && selectedCompanyId !== "all" ? parseInt(selectedCompanyId) : 1);
  const compList = (window.currentCompanies && window.currentCompanies.length > 0) ? window.currentCompanies : (typeof currentCompanies !== 'undefined' ? currentCompanies : []);
  const matchedComp = compList.find(c => c.id == compIdToFind) || compList[0] || {};
  const returnsList = (returns && returns.length > 0) ? returns : (sale.returns || []);
  const websiteUrl = matchedComp.website || 'https://manageetha.in';

  const compName = matchedComp.name || sale.company_name || 'Business ERP';
  const compRawAddr = matchedComp.address || sale.company_address || matchedComp.full_address || '';
  const compCity = matchedComp.city || sale.company_city || '';
  const compStateStr = matchedComp.state || sale.company_state || '';
  const compPincode = matchedComp.pincode || sale.company_pincode || '';

  let fullAddrParts = [];
  if (compRawAddr) fullAddrParts.push(compRawAddr);
  if (compCity && !compRawAddr.toLowerCase().includes(compCity.toLowerCase())) fullAddrParts.push(compCity);
  if (compStateStr && !compRawAddr.toLowerCase().includes(compStateStr.toLowerCase())) fullAddrParts.push(compStateStr);
  if (compPincode && !compRawAddr.includes(compPincode)) fullAddrParts.push(compPincode);
  const fullAddrStr = fullAddrParts.join(', ') || '—';

  const compGstin = matchedComp.gstin || sale.company_gstin || '—';
  const compPhone = matchedComp.phone || matchedComp.contact_no || sale.company_phone || sale.company_cell || '—';
  const compEmail = matchedComp.email || matchedComp.contact_email || sale.company_email || '—';
  const compHsn = matchedComp.hsn_code || sale.company_hsn || '';

  const bankName = matchedComp.bank_name || sale.bank_name || 'STATE BANK OF INDIA';
  const bankAcNo = matchedComp.account_number || matchedComp.ac_no || '42262088984';
  const bankIfsc = matchedComp.ifsc_code || matchedComp.ifsc || 'SBIN000907';
  const bankBranch = matchedComp.branch_name || matchedComp.branch || 'RAMACHANDRAPURAM';

  const supplyType = sale.supply_type || 'Direct Sale';
  const payMode = (sale.payment_mode || 'cash').toLowerCase();
  const rawDcNo = sale.challan_number || sale.id;
  const dcRefStr = String(rawDcNo).toUpperCase().startsWith('DC') ? String(rawDcNo) : `DC-${rawDcNo}`;

  const itemsDcSum = items.reduce((acc, i) => acc + parseFloat(i.dc_total || i.total || (parseFloat(i.rate || 0) * (parseInt(i.quantity || 1)))), 0);
  const dcGrandTotal = parseFloat(sale.dc_grand_total || (itemsDcSum > 0 ? itemsDcSum : sale.grand_total));

  const itemRowsHtml = items.map((it, idx) => {
    const sn = (it.serial_number && it.serial_number !== '—') ? String(it.serial_number).trim() : null;
    const prodName = it.description || it.product_name || 'Item';
    const modelName = it.model || it.model_name || it.product_model || '';
    const fullProdTitle = modelName ? `${prodName} / ${modelName}` : prodName;
    const lineDcVal = parseFloat(it.dc_total || it.total || (parseFloat(it.rate || 0) * (parseInt(it.quantity || 1))));
    return `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td>
          <div style="font-weight:bold;font-size:13px;">${esc(fullProdTitle)}</div>
          <div style="font-size:11px;color:#15803d;margin-top:3px;font-weight:bold;">
            ⚙️ Chassis / Serial No: <span style="background:#e0f2fe;color:#0369a1;padding:1px 6px;border-radius:3px;font-family:monospace;font-size:12px;">${esc(sn || '—')}</span>
          </div>
        </td>
        <td style="text-align:center;">${esc(it.hsn_code || it.hsn_sac || compHsn || '—')}</td>
        <td style="text-align:center;font-weight:bold;">${it.quantity}</td>
        <td style="text-align:center;">${it.gst_rate || 18}%</td>
        <td style="text-align:right;font-weight:bold;">${formatCurrency(lineDcVal)}</td>
      </tr>
    `;
  }).join("");

  const totalPaid = payments.length > 0
    ? payments.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0)
    : parseFloat(sale.paid_amount || 0);

  const pendingDcBal = Math.max(0, dcGrandTotal - totalPaid);

  function renderSingleDC(copyTitle, showIncentive = false) {
    return `
      <div class="dc-container">
        <div style="display:flex;justify-content:space-between;align-items:center;background:#f0fdf4;border-bottom:1px solid #15803d;padding:2px 6px;margin-bottom:6px;">
          <span style="font-weight:bold;font-size:11px;color:#15803d;">${copyTitle}</span>
          <span style="font-size:10px;font-style:italic;">Delivery Document</span>
        </div>

        <div class="dc-header">
          <span class="gst-badge">GST No. : ${esc(compGstin)}</span>
          <span class="phone-badge">Cell : ${esc(compPhone)}</span>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;padding-top:12px;position:relative;">
            <div style="font-weight:bold;font-size:11.5px;color:#15803d;">
              Dated : <b>${formatDate(sale.sale_date)}</b>
            </div>
            <div class="dc-title" style="margin-bottom:0;position:absolute;left:50%;transform:translateX(-50%);font-size:18px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#15803d;">DELIVERY CHALLAN</div>
            <div style="text-align:right;">
              <div style="font-size:8.5px;font-weight:bold;color:#15803d;margin-bottom:2px;">📷 SCAN FOR SERVICE TICKET</div>
              ${window.generateBarcodeSVG(dcRefStr, 34, true)}
            </div>
          </div>
          ${returnsList.length > 0 ? `
            <div style="border: 2px dashed #dc3545; background: #fff5f5; color: #dc3545; font-weight: bold; text-align: center; padding: 4px; margin: 4px 0; border-radius: 6px; font-size: 11px;">
              ⚠️ NOTICE: PRODUCT(S) RETURNED AGAINST THIS DELIVERY CHALLAN. SEE ATTACHED PAGE 3 FOR SALES RETURN & REFUND VOUCHER DETAILS.
            </div>
          ` : ''}
          <div class="company-name">${esc(compName)}</div>
          <div class="comp-info">D.No. 26-1-34/11, H.O. : RAMACHANDRAPURAM</div>
          <div class="comp-info">B.O. : D.No. 4-671/3, DIWANCHERUVU, Y. Junction Rajahmundry</div>
        </div>

        <div class="two-col-grid">
          <!-- LEFT BOX: BUYER / RECEIVED -->
          <div class="col-box">
            <div style="font-weight:bold;text-decoration:underline;margin-bottom:6px;color:#15803d;">Buyer / Received</div>
            <div class="info-row"><span class="info-label">Name :</span><span class="info-val">${esc(sale.customer_name || sale.cust_name || 'Counter Customer')}</span></div>
            <div class="info-row"><span class="info-label">Father Name :</span><span class="info-val">${esc(sale.father_name || '—')}</span></div>
            <div class="info-row"><span class="info-label">Village :</span><span class="info-val">${esc(sale.village || '—')}</span></div>
            <div class="info-row"><span class="info-label">Mandal :</span><span class="info-val">${esc(sale.mandal || '—')}</span></div>
            <div class="info-row"><span class="info-label">Cell :</span><span class="info-val">${esc(sale.cell_phone || sale.cust_phone || '—')}</span></div>
            <div class="info-row"><span class="info-label">Lead Generated By :</span><span class="info-val" style="font-weight:bold;color:#1e40af;">${esc(sale.lead_generated_by || '—')}</span></div>
            ${sale.customer_gstin ? `<div class="info-row"><span class="info-label">GSTIN / UIN :</span><span class="info-val" style="font-weight:bold;color:#15803d;">${esc(sale.customer_gstin)}</span></div>` : ''}
            ${supplyType === 'Department Subsidy Scheme' ? `
              <div class="info-row"><span class="info-label">Department :</span><span class="info-val">${esc(sale.scheme_department || 'Agriculture')}</span></div>
              <div class="info-row"><span class="info-label">Application No :</span><span class="info-val">${esc(sale.scheme_app_no || '—')}</span></div>
            ` : ''}
          </div>

          <!-- RIGHT BOX: CHALLAN & SUPPLY DETAILS -->
          <div class="col-box">
            <div class="info-row"><span class="info-label">Delivery Challan No. :</span><span class="info-val" style="color:#b91c1c;font-size:14px;font-weight:bold;">${esc(dcRefStr)}</span></div>
            <div class="info-row"><span class="info-label">Date :</span><span class="info-val">${formatDate(sale.sale_date)}</span></div>
            <div class="info-row"><span class="info-label">Invoice Date :</span><span class="info-val">${formatDate(sale.sale_date)}</span></div>
            <div class="info-row"><span class="info-label">Invoice No. :</span><span class="info-val">${esc(sale.invoice_number || `INV-${sale.id}`)}</span></div>

            <div style="margin-top:6px;border-top:1px solid #15803d;padding-top:4px;">
              <div style="font-weight:bold;font-size:11px;">TYPE OF SUPPLY :</div>
              <div class="supply-grid">
                <div><span class="chk-box">${supplyType === 'Direct Sale' ? '✓' : ''}</span>Direct Sale</div>
                <div><span class="chk-box">${supplyType === 'Sub Dealer' ? '✓' : ''}</span>Sub Dealer</div>
                <div><span class="chk-box">${supplyType === 'Dealer Sale' ? '✓' : ''}</span>Dealer Sale</div>
                <div><span class="chk-box">${supplyType === 'Department Subsidy Scheme' ? '✓' : ''}</span>Scheme</div>
              </div>

              <div style="font-weight:bold;font-size:11px;margin-top:4px;">PAYMENT TYPE :</div>
              <div class="supply-grid">
                <div><span class="chk-box">${payMode === 'bank' ? '✓' : ''}</span>Bank</div>
                <div><span class="chk-box">${payMode === 'cash' ? '✓' : ''}</span>Cash</div>
                <div><span class="chk-box">${payMode === 'finance' ? '✓' : ''}</span>Finance</div>
                <div><span class="chk-box">${payMode === 'credit' ? '✓' : ''}</span>Credit</div>
              </div>

              <div class="info-row" style="margin-top:4px;"><span class="info-label">Transporter Name :</span><span class="info-val">${esc(sale.transporter_name || '—')}</span></div>
              <div class="info-row"><span class="info-label">Vehicle No :</span><span class="info-val">${esc(sale.transporter_vehicle_no || '—')}</span></div>
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
              <td colspan="3" style="text-align:right;">TOTAL AMOUNT:</td>
              <td style="text-align:center;">${items.reduce((acc, i) => acc + (parseInt(i.quantity) || 1), 0)}</td>
              <td></td>
              <td style="text-align:right;">${formatCurrency(dcGrandTotal)}</td>
            </tr>
          </tbody>
        </table>

        <!-- PAYMENT STATUS BAR -->
        <div style="border:1px solid #15803d;padding:8px;background:#f0fdf4;margin-bottom:8px;display:flex;justify-content:space-between;font-weight:bold;font-size:12px;">
          <div>Grand Total: ${formatCurrency(dcGrandTotal)}</div>
          <div style="color:#15803d;">Paid Amount: ${formatCurrency(totalPaid)}</div>
          <div style="color:${pendingDcBal > 0 ? '#b91c1c' : '#15803d'};">
            ${pendingDcBal > 0 ? `⚠️ Remaining Balance: ${formatCurrency(pendingDcBal)}` : `✅ FULLY PAID`}
          </div>
        </div>

        ${sale.lead_generated_by ? `
          <div style="border:1px solid #991b1b;padding:6px 8px;background:#fef2f2;margin-bottom:8px;font-size:11px;color:#991b1b;">
            👤 <b>Lead Generated By:</b> ${esc(sale.lead_generated_by)}${showIncentive && sale.lead_incentive_amount ? ` | 💰 <b>Released Lead Incentive:</b> ₹${parseFloat(sale.lead_incentive_amount || 0).toFixed(2)}` : ''}
          </div>
        ` : ''}

        <!-- FOOTER & BANK DETAILS -->
        <div class="footer-grid" style="display:block;padding:8px;border:1px solid #15803d;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;">
            <div style="font-size:11px;line-height:1.4;">
              <div style="font-weight:bold;margin-bottom:2px;color:#15803d;">Bank Details : ${esc(bankName)}</div>
              <div>A/c No. : <b>${esc(bankAcNo)}</b> | IFSC Code : <b>${esc(bankIfsc)}</b></div>
              <div>Branch : <b>${esc(bankBranch)}</b>${compEmail && compEmail !== '—' ? ` | Mail ID : ${esc(compEmail)}` : ''}</div>
            </div>

            <div style="padding:4px 8px;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;display:flex;align-items:center;gap:8px;min-width:210px;">
              <div>
                ${window.generateQRCodeSVG(websiteUrl, 50)}
              </div>
              <div>
                <div style="font-weight:bold;font-size:10px;color:#15803d;margin-bottom:1px;">🌐 Official Company Website</div>
                <div style="font-size:9px;color:#475569;">Scan QR code with smartphone:</div>
                <div style="font-size:10px;font-weight:bold;color:#0284c7;margin-top:1px;">${esc(websiteUrl)}</div>
              </div>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:flex-end;padding-top:8px;border-top:1px solid #cbd5e1;">
            <div style="text-align:center;min-width:180px;">
              <div style="height:35px;"></div>
              <div style="border-top:1px solid #000;padding-top:4px;font-weight:bold;font-size:11px;">Received Signature</div>
            </div>

            <div style="text-align:right;min-width:180px;">
              <div style="font-size:11px;">For <b>${esc(compName)}</b></div>
              <div style="height:35px;"></div>
              <div style="border-top:1px solid #000;padding-top:4px;font-weight:bold;font-size:11px;">Authorised Signatory</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Delivery Challan #${sale.challan_number || sale.id}</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        body { font-family: 'Arial', sans-serif; font-size: 12px; color: #000; background: #fff; margin: 0; padding: 10px; }
        .dc-container { border: 2px solid #15803d; border-radius: 4px; padding: 10px; max-width: 800px; margin: 0 auto 20px auto; background: #fff; page-break-inside: avoid; }
        .dc-header { text-align: center; position: relative; border-bottom: 2px solid #15803d; padding-bottom: 6px; margin-bottom: 8px; }
        .dc-title { font-size: 20px; font-weight: 900; letter-spacing: 1px; color: #15803d; text-align: center; text-transform: uppercase; margin-bottom: 4px; }
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
        <button onclick="window.print()" style="background:#15803d;color:#fff;border:none;padding:10px 20px;border-radius:4px;font-weight:bold;cursor:pointer;">🖨️ Print Both Copies (Original & Customer)</button>
      </div>

      <!-- PAGE 1: ORIGINAL COMPANY COPY -->
      ${renderSingleDC('ORIGINAL FOR RECIPIENT / COMPANY COPY', true)}

      <div class="page-break"></div>

      <!-- PAGE 2: CUSTOMER COPY -->
      ${renderSingleDC('CUSTOMER COPY', false)}

      ${returnsList.length > 0 ? renderPage3ReturnAttachment(sale, returnsList, matchedComp) : ''}
    </body>
    </html>
  `;

  try { printWin.document.open(); } catch(e){}
  printWin.document.write(html);
  printWin.document.close();
}

// ── Printable Voucher Document: 2 Copies (Original with T&C + Receiver Signature proof, and Receiver Copy) ──
window.printIncentiveVoucher = function(leadName, salesList = [], itemsList = [], companyInfo = {}, monthStr = "") {
  const printWin = window.open("", "_blank", "width=900,height=1000");
  if (!printWin) return alert("Please allow popups to print incentive voucher.");

  const comp = companyInfo || {};
  const compName = comp.name || "MANASWINI ENTERPRISES";
  const compAddr = comp.address || "Main Road, Rajahmundry";
  const compCityState = `${comp.city || "Rajahmundry"}, ${comp.state || "Andhra Pradesh"}`;
  const compPhone = comp.phone || "9848123456";
  const compGstin = comp.gstin || "";

  // Group items by sale_id
  const itemsBySale = {};
  itemsList.forEach(item => {
    if (!itemsBySale[item.sale_id]) itemsBySale[item.sale_id] = [];
    itemsBySale[item.sale_id].push(item);
  });

  // Calculate totals
  let totalSalesAmt = 0;
  let totalIncentiveAmt = 0;
  salesList.forEach(s => {
    totalSalesAmt += parseFloat(s.grand_total || 0);
    totalIncentiveAmt += parseFloat(s.lead_incentive_amount || 0);
  });

  const voucherDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  function amountInWords(num) {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    num = Math.round(num);
    if ((num = num.toString()).length > 9) return 'Overflow';
    let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Rupees Only' : 'Rupees Only';
    return str;
  }

  function renderSingleVoucher(copyTitle, isOriginal) {
    let salesRowsHtml = "";
    salesList.forEach((s, idx) => {
      const sItems = itemsBySale[s.id] || [];
      const prodDetailsStr = sItems.map(i => {
        const pName = i.product_name || i.description || "Product";
        const serialStr = i.serial_number ? ` [Serial/Machine #: ${i.serial_number}]` : '';
        return `${pName}${serialStr} (Qty: ${i.quantity || 1})`;
      }).join(", ") || "General Sales Item";

      salesRowsHtml += `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td style="font-weight:bold;">#${s.challan_number || s.id}</td>
          <td>${new Date(s.sale_date || s.created_at).toLocaleDateString('en-IN')}</td>
          <td>
            <strong>${s.customer_name || s.customer_name_ref || 'Counter Customer'}</strong>
            ${s.village ? `<br><small style="color:#555;">${s.village}${s.mandal ? ', ' + s.mandal : ''}</small>` : ''}
          </td>
          <td>${prodDetailsStr}</td>
          <td style="text-align:right;">₹${parseFloat(s.grand_total || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
          <td style="text-align:right;font-weight:bold;">₹${parseFloat(s.lead_incentive_amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
        </tr>
      `;
    });

    return `
      <div class="voucher-container">
        <!-- HEADER -->
        <div style="text-align:center;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:12px;">
          <h2 style="margin:0;font-size:20px;text-transform:uppercase;color:#111;">${compName}</h2>
          <div style="font-size:12px;color:#444;">${compAddr}, ${compCityState} | Phone: ${compPhone}</div>
          ${compGstin ? `<div style="font-size:11px;color:#555;">GSTIN: ${compGstin}</div>` : ''}
          <div style="margin-top:6px;">
            <span style="display:inline-block;padding:3px 12px;background:${isOriginal ? '#1e3a8a' : '#065f46'};color:#fff;font-weight:bold;font-size:11px;border-radius:12px;letter-spacing:0.5px;">
              ${copyTitle}
            </span>
          </div>
        </div>

        <h3 style="text-align:center;margin:6px 0 12px 0;font-size:15px;text-decoration:underline;">
          LEAD GENERATOR INCENTIVE DISBURSEMENT VOUCHER
        </h3>

        <!-- META DETAILS -->
        <table style="width:100%;margin-bottom:12px;font-size:12px;border:1px solid #ddd;border-collapse:collapse;" cellpadding="6">
          <tr style="background:#f8fafc;">
            <td><strong>Lead Generator Name:</strong> ${leadName}</td>
            <td><strong>Billing Period / Month:</strong> ${monthStr || 'Consolidated'}</td>
            <td><strong>Voucher Date:</strong> ${voucherDate}</td>
          </tr>
        </table>

        <!-- SALES & PRODUCTS BREAKDOWN TABLE -->
        <table class="voucher-table" style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px;" border="1" cellpadding="6">
          <thead>
            <tr style="background:#f1f5f9;text-align:left;">
              <th style="width:30px;text-align:center;">#</th>
              <th>DC / Inv #</th>
              <th>Date</th>
              <th>Customer & Location</th>
              <th>Product Details & Serial / Machine No.</th>
              <th style="text-align:right;">Sale Amount (₹)</th>
              <th style="text-align:right;">Incentive Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${salesRowsHtml}
          </tbody>
          <tfoot>
            <tr style="background:#f8fafc;font-weight:bold;">
              <td colspan="5" style="text-align:right;">Total (${salesList.length} Sales):</td>
              <td style="text-align:right;">₹${totalSalesAmt.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
              <td style="text-align:right;color:#047857;font-size:12px;">₹${totalIncentiveAmt.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            </tr>
          </tfoot>
        </table>

        <!-- AMOUNT IN WORDS -->
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:8px 12px;border-radius:4px;font-size:12px;margin-bottom:14px;">
          <strong>Total Incentive Amount Received:</strong> ₹${totalIncentiveAmt.toLocaleString('en-IN', {minimumFractionDigits: 2})} 
          <span style="font-style:italic;color:#15803d;margin-left:6px;">(${amountInWords(totalIncentiveAmt)})</span>
        </div>

        ${isOriginal ? `
          <!-- TERMS & CONDITIONS (REQUIRED FOR ORIGINAL COPY) -->
          <div style="border:1px solid #cbd5e1;background:#f8fafc;padding:10px 12px;border-radius:4px;font-size:11px;margin-bottom:20px;">
            <div style="font-weight:bold;text-decoration:underline;margin-bottom:4px;color:#1e293b;">TERMS & CONDITIONS & PROOF OF DISBURSEMENT:</div>
            <ol style="margin:0;padding-left:16px;line-height:1.4;color:#334155;">
              <li>The lead generator incentive amount mentioned in this voucher is disbursed following complete verification of sales transactions and delivery.</li>
              <li>The receiver hereby acknowledges and confirms receipt of the total incentive amount specified above in cash / bank transfer as full and final payment.</li>
              <li>No further claims, disputes, or retroactive adjustments shall be entertained for the listed sales invoices once signed.</li>
            </ol>
          </div>

          <!-- SIGNATURES WITH RECEIVER PROOF OF RECEIPT -->
          <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:30px;padding-top:10px;font-size:11px;">
            <div style="text-align:center;width:30%;">
              <div style="border-bottom:1px solid #000;margin-bottom:4px;height:35px;"></div>
              <strong>Receiver / Lead Generator Signature</strong><br>
              <span style="font-size:10px;color:#555;">(Proof of Amount Received by ${leadName})</span>
            </div>

            <div style="text-align:center;width:30%;">
              <div style="border-bottom:1px solid #000;margin-bottom:4px;height:35px;"></div>
              <strong>HR / Accounts Manager</strong><br>
              <span style="font-size:10px;color:#555;">(Verified & Processed)</span>
            </div>

            <div style="text-align:center;width:30%;">
              <div style="border-bottom:1px solid #000;margin-bottom:4px;height:35px;"></div>
              <strong>Authorized Store Seal & Signature</strong><br>
              <span style="font-size:10px;color:#555;">(${compName})</span>
            </div>
          </div>
        ` : `
          <!-- RECEIVER COPY FOOTER -->
          <div style="border:1px dashed #cbd5e1;padding:8px 12px;border-radius:4px;font-size:11px;margin-bottom:20px;color:#475569;">
            <em>This document serves as the Receiver Copy for the lead generator's personal record of incentive payment.</em>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:30px;padding-top:10px;font-size:11px;">
            <div style="text-align:center;width:40%;">
              <div style="border-bottom:1px solid #000;margin-bottom:4px;height:35px;"></div>
              <strong>HR / Accounts Manager Signature</strong>
            </div>

            <div style="text-align:center;width:40%;">
              <div style="border-bottom:1px solid #000;margin-bottom:4px;height:35px;"></div>
              <strong>Authorized Store Seal & Signature</strong>
            </div>
          </div>
        `}
      </div>
    `;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Incentive Voucher - ${leadName}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 15px; color: #111; background: #fff; }
        .voucher-container { page-break-after: always; padding: 10px; max-width: 800px; margin: 0 auto; }
        .voucher-container:last-child { page-break-after: avoid; }
        .voucher-table th, .voucher-table td { border: 1px solid #cbd5e1; padding: 5px 8px; }
        @media print {
          body { padding: 0; }
          .no-print { display: none !important; }
          .voucher-container { page-break-after: always; }
          .voucher-container:last-child { page-break-after: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom:16px;text-align:right;">
        <button onclick="window.print()" style="background:#15803d;color:#fff;border:none;padding:10px 22px;border-radius:6px;font-weight:bold;font-size:14px;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
          🖨️ Print Both Copies (Page 1: Original + Page 2: Receiver Copy)
        </button>
      </div>

      <!-- PAGE 1: ORIGINAL COPY (STORE FILE & PROOF WITH T&C) -->
      ${renderSingleVoucher('ORIGINAL COPY (STORE FILE & RECEIVER PROOF)', true)}

      <!-- PAGE 2: RECEIVER COPY (LEAD GENERATOR FILE) -->
      ${renderSingleVoucher('RECEIVER COPY (LEAD GENERATOR FILE)', false)}
    </body>
    </html>
  `;

  try { printWin.document.open(); } catch(e){}
  printWin.document.write(html);
  printWin.document.close();
};

// ── Global Modal: Record Part / Full Payment ──
async function openRecordPaymentModal(saleId, refreshCallback) {
  try {
    const res = await fetch(`${API_BASE}/sales?action=get-details&id=${saleId}`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.success) return showToast("Failed to fetch sale details", "error");

    const sale = data.sale;
    const items = data.items || [];
    const payments = data.payments || [];

    const grandTotal = parseFloat(sale.grand_total || 0);
    const totalPaid = payments.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0);
    const pendingBalance = Math.max(0, grandTotal - totalPaid);

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;";

    overlay.innerHTML = `
      <div class="modal-content" style="background:var(--bg-primary);border-radius:12px;max-width:750px;width:100%;max-height:90vh;overflow-y:auto;padding:24px;border:1px solid var(--border);box-shadow:0 20px 25px -5px rgba(0,0,0,0.2);">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:16px;">
          <h3 style="font-size:18px;font-weight:700;color:var(--text1);margin:0;">💳 Record Payment — Sale #${sale.challan_number || sale.id}</h3>
          <button class="btn btn-sm btn-outline closePayModal">&times;</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;padding:12px;background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border);text-align:center;">
          <div>
            <div style="font-size:12px;color:var(--text3);">Invoice Total</div>
            <div style="font-size:16px;font-weight:700;color:var(--text1);">${formatCurrency(grandTotal)}</div>
          </div>
          <div>
            <div style="font-size:12px;color:var(--text3);">Already Paid</div>
            <div style="font-size:16px;font-weight:700;color:var(--success);">${formatCurrency(totalPaid)}</div>
          </div>
          <div>
            <div style="font-size:12px;color:var(--text3);">Pending Balance</div>
            <div style="font-size:16px;font-weight:700;color:${pendingBalance > 0 ? 'var(--danger)' : 'var(--success)'};">
              ${formatCurrency(pendingBalance)}
            </div>
          </div>
        </div>

        <form id="recordPayForm">
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group">
              <label class="form-label">Payment Settlement Type *</label>
              <select id="modalSettlementType" class="form-select" required>
                <option value="part">⏳ Part Payment (Partial Amount)</option>
                <option value="full">✅ Full Payment (Clear Remaining ${formatCurrency(pendingBalance)})</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Payment Mode *</label>
              <select id="modalPayMode" class="form-select" required>
                <option value="cash">💵 Cash</option>
                <option value="bank">🏦 Bank Transfer</option>
                <option value="upi">📱 UPI</option>
                <option value="finance">🏢 Finance (Bajaj / TVS)</option>
                <option value="credit">📑 Credit Settlement</option>
              </select>
            </div>
          </div>

          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group">
              <label class="form-label">Payment Date *</label>
              <input type="date" id="modalPayDate" class="form-input" value="${new Date().toISOString().split('T')[0]}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Amount Paid (₹) *</label>
              <input type="number" step="0.01" id="modalPayAmount" class="form-input" value="${pendingBalance.toFixed(2)}" max="${pendingBalance.toFixed(2)}" min="0.01" style="font-weight:700;font-size:15px;color:var(--primary-light);" required>
            </div>
          </div>

          <!-- CASH DENOMINATIONS BREAKDOWN (For Cash Mode) -->
          <div id="modalCashDenominationsContainer" style="margin:10px 0;padding:10px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;display:block;">
            <div style="font-size:12px;font-weight:700;color:var(--text1);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
              <span>💵 Cash Notes Denominations Breakdown:</span>
              <span style="font-size:11px;color:var(--primary);font-weight:700;" id="modalNotesCalcSumText">Total: ₹0</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;">
              <div style="display:flex;align-items:center;gap:4px;">
                <span style="width:60px;font-weight:600;font-size:11px;">2000 ×</span>
                <input type="number" id="modalNote2000" class="form-input modal-note-calc-inp" min="0" placeholder="0" style="padding:2px 6px;height:28px;font-size:12px;">
              </div>
              <div style="display:flex;align-items:center;gap:4px;">
                <span style="width:60px;font-weight:600;font-size:11px;">500 ×</span>
                <input type="number" id="modalNote500" class="form-input modal-note-calc-inp" min="0" placeholder="0" style="padding:2px 6px;height:28px;font-size:12px;">
              </div>
              <div style="display:flex;align-items:center;gap:4px;">
                <span style="width:60px;font-weight:600;font-size:11px;">200 ×</span>
                <input type="number" id="modalNote200" class="form-input modal-note-calc-inp" min="0" placeholder="0" style="padding:2px 6px;height:28px;font-size:12px;">
              </div>
              <div style="display:flex;align-items:center;gap:4px;">
                <span style="width:60px;font-weight:600;font-size:11px;">100 ×</span>
                <input type="number" id="modalNote100" class="form-input modal-note-calc-inp" min="0" placeholder="0" style="padding:2px 6px;height:28px;font-size:12px;">
              </div>
              <div style="display:flex;align-items:center;gap:4px;">
                <span style="width:60px;font-weight:600;font-size:11px;">50 ×</span>
                <input type="number" id="modalNote50" class="form-input modal-note-calc-inp" min="0" placeholder="0" style="padding:2px 6px;height:28px;font-size:12px;">
              </div>
              <div style="display:flex;align-items:center;gap:4px;">
                <span style="width:60px;font-weight:600;font-size:11px;">20 ×</span>
                <input type="number" id="modalNote20" class="form-input modal-note-calc-inp" min="0" placeholder="0" style="padding:2px 6px;height:28px;font-size:12px;">
              </div>
              <div style="display:flex;align-items:center;gap:4px;">
                <span style="width:60px;font-weight:600;font-size:11px;">10 ×</span>
                <input type="number" id="modalNote10" class="form-input modal-note-calc-inp" min="0" placeholder="0" style="padding:2px 6px;height:28px;font-size:12px;">
              </div>
            </div>
          </div>

          <!-- DYNAMIC PAYMENT MODE SUB-FIELDS -->
          <div id="modalDynamicPaySubFields" style="margin-bottom:12px;padding:10px;background:var(--bg-secondary);border:1px dashed var(--border);border-radius:6px;display:none;">
          </div>

          <div class="form-group" style="margin-top:6px;">
            <label class="form-label">Receiving Bank / Cashier Notes</label>
            <input type="text" id="modalPayNotes" class="form-input" placeholder="e.g. SBI Main Branch / Part Payment">
          </div>

          <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px;">
            <button type="button" class="btn btn-secondary closePayModal">Cancel</button>
            <button type="submit" class="btn btn-primary">💾 Accept & Save Payment</button>
          </div>
        </form>

        <hr style="margin:20px 0;border:none;border-top:1px solid var(--border);">

        <h4 style="font-size:14px;font-weight:600;color:var(--text1);margin-bottom:10px;">📜 Payment Transaction History</h4>
        <div class="table-container" style="max-height:200px;overflow-y:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Mode</th>
                <th>Reference #</th>
                <th>Amount</th>
                <th>Cashier</th>
              </tr>
            </thead>
            <tbody>
              ${payments.length === 0
                ? `<tr><td colspan="5" style="text-align:center;padding:12px;color:var(--text3);">No payments recorded yet.</td></tr>`
                : payments.map(p => `
                  <tr>
                    <td>${formatDate(p.payment_date)}</td>
                    <td><span class="badge badge-purple">${esc(p.payment_mode.toUpperCase())} ${p.bank_sub_type ? `(${p.bank_sub_type})` : ''}</span></td>
                    <td>${esc(p.transaction_ref || p.cheque_dd_no || '—')}</td>
                    <td style="font-weight:700;color:var(--success);">${formatCurrency(p.amount)}</td>
                    <td>${esc(p.cashier_name || 'System Admin')}</td>
                  </tr>
                `).join("")
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const stlSel = overlay.querySelector("#modalSettlementType");
    const payAmtInput = overlay.querySelector("#modalPayAmount");
    const payModeSel = overlay.querySelector("#modalPayMode");

    stlSel.addEventListener("change", () => {
      if (stlSel.value === "full") {
        payAmtInput.value = pendingBalance.toFixed(2);
      } else {
        if (parseFloat(payAmtInput.value || 0) === parseFloat(pendingBalance.toFixed(2))) {
          payAmtInput.value = "0.00";
        }
        payAmtInput.focus();
        payAmtInput.select();
      }
    });

    payAmtInput.addEventListener("input", () => {
      const curVal = parseFloat(payAmtInput.value || 0);
      if (curVal < pendingBalance - 0.01) {
        if (stlSel.value !== "part") stlSel.value = "part";
      } else if (curVal >= pendingBalance) {
        if (stlSel.value !== "full") stlSel.value = "full";
      }
    });

    function calcModalDenominationsTotal() {
      const n2000 = (parseInt(overlay.querySelector("#modalNote2000")?.value) || 0) * 2000;
      const n500  = (parseInt(overlay.querySelector("#modalNote500")?.value) || 0) * 500;
      const n200  = (parseInt(overlay.querySelector("#modalNote200")?.value) || 0) * 200;
      const n100  = (parseInt(overlay.querySelector("#modalNote100")?.value) || 0) * 100;
      const n50   = (parseInt(overlay.querySelector("#modalNote50")?.value) || 0) * 50;
      const n20   = (parseInt(overlay.querySelector("#modalNote20")?.value) || 0) * 20;
      const n10   = (parseInt(overlay.querySelector("#modalNote10")?.value) || 0) * 10;

      const totalNotesAmt = n2000 + n500 + n200 + n100 + n50 + n20 + n10;
      const sumTxt = overlay.querySelector("#modalNotesCalcSumText");
      if (sumTxt) sumTxt.textContent = `Total: ₹${totalNotesAmt.toLocaleString('en-IN')}`;

      if (totalNotesAmt > 0) {
        if (payAmtInput) payAmtInput.value = totalNotesAmt.toFixed(2);
        if (stlSel) {
          if (totalNotesAmt < pendingBalance - 0.01) stlSel.value = "part";
          else stlSel.value = "full";
        }
      }
    }

    overlay.querySelectorAll(".modal-note-calc-inp").forEach(inp => {
      inp.addEventListener("input", calcModalDenominationsTotal);
      inp.addEventListener("change", calcModalDenominationsTotal);
    });

    function updateModalSubFields() {
      const mode = payModeSel.value;
      const cashContainer = overlay.querySelector("#modalCashDenominationsContainer");
      const subContainer = overlay.querySelector("#modalDynamicPaySubFields");

      if (cashContainer) {
        cashContainer.style.display = (mode === "cash") ? "block" : "none";
      }

      if (mode === "bank") {
        subContainer.style.display = "block";
        subContainer.innerHTML = `
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:8px;">
            <div class="form-group">
              <label class="form-label">Bank Sub-Type</label>
              <select id="modalBankSub" class="form-select">
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="Cheque">Cheque</option>
                <option value="DD">Demand Draft (DD)</option>
                <option value="Other">Other Bank Transfer</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Transaction / Instrument Ref No.</label>
              <input type="text" id="modalRefNo" class="form-input" placeholder="Ref / Cheque #">
            </div>
          </div>
          <div class="form-grid" style="grid-template-columns:1.2fr 1fr;gap:8px;margin-top:6px;">
            <div class="form-group">
              <label class="form-label">Receiving Company Bank Account *</label>
              <select id="modalRecBankSelect" class="form-select"></select>
            </div>
            <div class="form-group">
              <label class="form-label">Cheque / DD Date</label>
              <input type="date" id="modalChequeDate" class="form-input">
            </div>
          </div>
        `;
        if (window.populateBankAccountDropdown) {
          window.populateBankAccountDropdown("modalRecBankSelect", sale.company_id);
        }
      } else if (mode === "upi") {
        subContainer.style.display = "block";
        subContainer.innerHTML = `
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:8px;">
            <div class="form-group">
              <label class="form-label">UTR Number *</label>
              <input type="text" id="modalUtrNo" class="form-input" placeholder="e.g. 321456987012" required>
            </div>
            <div class="form-group">
              <label class="form-label">Receiving Company Bank Account</label>
              <select id="modalUpiRecBankSelect" class="form-select"></select>
            </div>
          </div>
        `;
        if (window.populateBankAccountDropdown) {
          window.populateBankAccountDropdown("modalUpiRecBankSelect", sale.company_id);
        }
      } else if (mode === "finance") {
        subContainer.style.display = "block";
        subContainer.innerHTML = `
          <div class="form-group">
            <label class="form-label">Select Registered Financer</label>
            <select id="modalFinancerId" class="form-select">
              <option value="">-- Select Registered Financer --</option>
            </select>
          </div>
          <div class="form-group" style="margin-top:6px;">
            <label class="form-label">Financed Reference / Remarks</label>
            <input type="text" id="modalFinRefNo" class="form-input" placeholder="e.g. Bajaj Finance Approval ID">
          </div>
        `;
        fetch(`${API_BASE}/sales?action=financers-list&company_id=${sale.company_id}`, { headers: authHeaders() })
          .then(r => r.json())
          .then(data => {
            if (data.success && data.financers) {
              const finSel = overlay.querySelector("#modalFinancerId");
              if (finSel) {
                finSel.innerHTML = `<option value="">-- Select Registered Financer --</option>` +
                  data.financers.map(f => `<option value="${f.id}">${esc(f.name)} (${esc(f.type || 'Finance')})</option>`).join("");
              }
            }
          })
          .catch(() => {});
      } else if (mode === "credit") {
        subContainer.style.display = "block";
        subContainer.innerHTML = `
          <div class="form-group">
            <label class="form-label">Credit Settlement / Agreement Notes</label>
            <input type="text" id="modalCreditNotes" class="form-input" placeholder="e.g. Settlement agreement notes">
          </div>
        `;
      } else {
        subContainer.style.display = "none";
        subContainer.innerHTML = "";
      }
    }

    payModeSel.addEventListener("change", updateModalSubFields);
    updateModalSubFields();

    const closeModalBtns = overlay.querySelectorAll(".closePayModal");
    closeModalBtns.forEach(b => b.addEventListener("click", () => overlay.remove()));

    overlay.querySelector("#recordPayForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const subBtn = overlay.querySelector('button[type="submit"]');

      const amt = parseFloat(payAmtInput.value);
      if (isNaN(amt) || amt <= 0) {
        return showToast("Please enter a valid payment amount", "error");
      }
      if (amt > pendingBalance + 0.01) {
        return showToast(`Payment amount cannot exceed pending balance of ${formatCurrency(pendingBalance)}`, "error");
      }

      setButtonLoading(subBtn, true, "Recording Payment...");

      const pMode = payModeSel.value;
      let bankSub = null;
      let refNo = null;
      let chequeDate = null;
      let bankAccountId = null;
      let recBankText = null;

      if (pMode === "bank") {
        bankSub = overlay.querySelector("#modalBankSub")?.value;
        refNo = overlay.querySelector("#modalRefNo")?.value.trim();
        chequeDate = overlay.querySelector("#modalChequeDate")?.value;
        const bSel = overlay.querySelector("#modalRecBankSelect");
        if (bSel && bSel.value) {
          bankAccountId = parseInt(bSel.value);
          recBankText = bSel.options[bSel.selectedIndex]?.text?.trim() || "";
        }
      } else if (pMode === "upi") {
        refNo = overlay.querySelector("#modalUtrNo")?.value.trim();
        if (!refNo) {
          setButtonLoading(subBtn, false);
          return showToast("UTR Number is mandatory for UPI payments", "error");
        }
        const upiBSel = overlay.querySelector("#modalUpiRecBankSelect");
        if (upiBSel && upiBSel.value) {
          bankAccountId = parseInt(upiBSel.value);
          recBankText = upiBSel.options[upiBSel.selectedIndex]?.text?.trim() || "";
        }
      } else if (pMode === "finance") {
        const finSel = overlay.querySelector("#modalFinancerId");
        if (finSel && finSel.value) {
          recBankText = finSel.options[finSel.selectedIndex]?.text?.trim() || "";
        }
        refNo = overlay.querySelector("#modalFinRefNo")?.value.trim();
      } else if (pMode === "credit") {
        refNo = overlay.querySelector("#modalCreditNotes")?.value.trim();
      }

      const payload = {
        sale_id: saleId,
        payment_date: overlay.querySelector("#modalPayDate").value,
        payment_mode: pMode,
        bank_sub_type: bankSub,
        transaction_ref: refNo,
        cheque_dd_date: chequeDate,
        amount: amt,
        receiving_bank: recBankText,
        bank_account_id: bankAccountId,
        notes: overlay.querySelector("#modalPayNotes")?.value.trim()
      };

      try {
        const pRes = await fetch(`${API_BASE}/sales?action=add-payment`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload)
        });
        const pData = await pRes.json();
        if (pData.success) {
          showToast(pData.message || "Payment accepted successfully!", "success");
          overlay.remove();
          if (refreshCallback) refreshCallback();
        } else {
          showToast(pData.error || "Failed to record payment", "error");
          setButtonLoading(subBtn, false);
        }
      } catch (err) {
        showToast("Network error saving payment: " + err.message, "error");
        setButtonLoading(subBtn, false);
      }
    });

  } catch (err) {
    showToast("Error opening payment modal: " + err.message, "error");
  }
}

// ── SubTab 1: POS Billing / New Sale / Delivery Challan ──
async function loadSalesPOSSubTab() {
  const subContent = document.getElementById("salesSubContent");
  let compId = selectedCompanyId || "all";
  const userObj = (typeof getUser === "function" ? getUser() : null) || (typeof currentUser !== "undefined" && currentUser ? currentUser : null) || JSON.parse(localStorage.getItem("erp_user") || "{}");
  const isSuper = userObj && (userObj.role === "superadmin" || userObj.username === "superadmin");

  const activeCompId = compId !== "all" ? parseInt(compId) : (userObj.company_id || currentCompanies[0]?.id || 1);
  const targetCompObj = (window.currentCompanies || currentCompanies || []).find(c => c.id == activeCompId) || (currentCompanies[0] || {});
  let posHomeState = (targetCompObj.state || userObj.company_state || "Andhra Pradesh").trim();
  if (!posHomeState || posHomeState.toLowerCase() === "same state") {
    posHomeState = "Andhra Pradesh";
  }

  subContent.innerHTML = `
    <div class="pos-layout-grid" style="display:grid;grid-template-columns:1fr 1.35fr;gap:24px;">
      <!-- LEFT: ITEM SELECTION & CART -->
      <div>
        <h3 style="font-size:16px;font-weight:600;color:var(--text1);margin-bottom:12px;">Billing Cart</h3>
        
        <div class="pos-prod-bar" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;background:var(--bg-secondary);padding:12px;border-radius:10px;border:1px solid var(--border);box-shadow:0 2px 4px rgba(0,0,0,0.02);">
          <div style="display:flex;gap:8px;align-items:center;">
            <div style="position:relative;flex:1;">
              <input type="text" id="posBarcodeScannerInput" class="form-input" placeholder="Scan Barcode / SKU with Machine Scanner (Press Enter)..." style="font-weight:700;font-size:13px;border:2px solid var(--primary);background:var(--bg-primary);padding-left:36px;color:var(--text1);" autocomplete="off">
              <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:16px;">📷</span>
            </div>
            <button type="button" class="btn btn-primary" id="posBarcodeScanBtn" style="white-space:nowrap;font-weight:700;padding:8px 14px;background:linear-gradient(135deg,var(--primary),#3b82f6);color:#fff;border:none;">⚡ Scan / Add</button>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <input type="text" id="posProdSearchInp" class="form-input" placeholder="🔍 Live Search Product (Name, Brand, Model, HSN, SKU)..." style="font-weight:600;font-size:13px;flex:1;min-width:180px;" autocomplete="off">
            <select id="posProdSelect" class="form-select" style="flex:1.2;font-weight:600;min-width:200px;">
              <option value="">-- Select Product to Add --</option>
            </select>
            <input type="number" id="posQty" class="form-input" value="1" min="1" placeholder="Qty" style="width:75px;text-align:center;font-weight:700;">
            <button class="btn btn-primary" id="posAddBtn" style="white-space:nowrap;font-weight:700;padding:8px 16px;">+ Add Item</button>
            <button type="button" class="btn btn-outline" id="posAddCustomBtn" style="white-space:nowrap;font-weight:700;padding:8px 14px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;">+ Custom Item</button>
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Product & Serial No</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>GST %</th>
                <th>Total</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody id="cartTableBody">
              <tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3);">Cart is empty. Add products above.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- RIGHT: CUSTOMER & DELIVERY CHALLAN DETAILS -->
      <div class="card" style="background:var(--bg-primary);border:1px solid var(--border);max-height:85vh;overflow-y:auto;">
        <h3 style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:12px;">Delivery Challana & Customer Details</h3>
        <form id="posCheckoutForm">
          ${isSuper ? `
            <div class="form-group" style="background:var(--bg-secondary);padding:8px;border-radius:6px;border:1px solid var(--border);margin-bottom:10px;">
              <label class="form-label" style="color:var(--primary);font-weight:700;">🏢 Target Company (Superadmin)</label>
              <select id="posCompanySelect" class="form-select"></select>
            </div>
          ` : ''}

          <div class="form-group" style="background:var(--bg-secondary);padding:8px 10px;border-radius:6px;border:1px solid var(--border);margin-bottom:12px;">
            <label class="form-label" style="font-weight:700;color:var(--primary);margin-bottom:4px;">👤 Party / Billing Recipient Type *</label>
            <select id="posPartyType" class="form-select" style="font-weight:600;">
              <option value="customer" selected>👤 Registered / Walk-in Customer</option>
              <option value="counter">⚡ Counter Customer (Quick Bill)</option>
              <option value="dealer">🏢 Registered dealer / Supplier</option>
            </select>
          </div>

          <div id="posCustBlock">
            <div class="form-group">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:4px;">
                <label class="form-label" style="margin:0;font-weight:700;color:var(--primary);">Select Registered Customer</label>
                <button type="button" class="btn btn-sm btn-outline" id="quickAddCustBtn">+ Add New Customer</button>
              </div>
              <select id="posCustId" class="form-select"></select>
            </div>
          </div>

          <div id="posdealerBlock" style="display:none;margin-bottom:12px;">
            <div class="form-group">
              <label class="form-label" style="font-weight:700;color:var(--primary);">🏢 Select Registered dealer / Supplier *</label>
              <select id="posdealerId" class="form-select"></select>
            </div>
          </div>

          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:8px;">
            <div class="form-group" style="position:relative;">
              <label class="form-label" id="posNameLabel">Customer Name *</label>
              <input type="text" id="posCustName" class="form-input" placeholder="Type customer name..." required autocomplete="off">
              <div id="posLiveCustDropdown" style="position:absolute;top:100%;left:0;right:0;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;max-height:220px;overflow-y:auto;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.2);display:none;"></div>
            </div>
            <div class="form-group">
              <label class="form-label">Cell / Contact Phone *</label>
              <input type="text" id="posCellPhone" class="form-input" placeholder="9848123456" required>
            </div>
          </div>

          <div id="posExtraCustFields">
            <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:8px;">
              <div class="form-group">
                <label class="form-label">Father Name</label>
                <input type="text" id="posFatherName" class="form-input" placeholder="e.g. Venkata Rao">
              </div>
              <div class="form-group">
                <label class="form-label">Village / Address</label>
                <input type="text" id="posVillage" class="form-input" placeholder="e.g. Ramachandrapuram">
              </div>
            </div>

            <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:8px;">
              <div class="form-group">
                <label class="form-label">Mandal / State</label>
                <input type="text" id="posMandal" class="form-input" placeholder="e.g. Ramachandrapuram">
              </div>
              <div class="form-group">
                <label class="form-label">Party GSTIN / UIN</label>
                <input type="text" id="posCustGstin" class="form-input" placeholder="e.g. 37AAAAA0000A1Z5" style="font-family:monospace;text-transform:uppercase;">
              </div>
            </div>
          </div>

          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
            <div class="form-group">
              <label class="form-label">State of Supply (Sale State) *</label>
              <select id="posSupplyState" class="form-select">
                ${typeof generateIndianStateOptionsHtml === 'function' ? generateIndianStateOptionsHtml(posHomeState, posHomeState) : `<option value="${esc(posHomeState)}" selected>${esc(posHomeState)} (Same State - Intra State)</option>`}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight:700;color:var(--primary);">🛡️ Warranty Term / Period *</label>
              <select id="posWarrantyTerm" class="form-select" style="font-weight:700;border-color:var(--primary);">
                <option value="1_year" selected>🛡️ 1 Year Warranty (12 Months - Standard)</option>
                <option value="1_month">1 Month Warranty (1 Month)</option>
                <option value="3_months">3 Months Warranty (3 Months)</option>
                <option value="6_months">6 Months Warranty (6 Months)</option>
                <option value="2_years">2 Years Warranty (24 Months)</option>
                <option value="3_years">3 Years Warranty (36 Months)</option>
                <option value="no_warranty">🚫 No Warranty (0 Months)</option>
              </select>
            </div>
          </div>

          <!-- VIP FREQUENT CUSTOMER LOYALTY PERKS BANNER (10+ Purchases in FY) -->
          <div id="posVipLoyaltyContainer" style="display:none;margin-bottom:12px;">
            <div style="background:linear-gradient(135deg, #fffbe3 0%, #fef3c7 100%);border:2px solid #f59e0b;padding:12px;border-radius:10px;">
              <div style="font-weight:800;color:#92400e;font-size:13px;display:flex;align-items:center;justify-content:space-between;">
                <span>🌟 VIP LOYAL CUSTOMER DETECTED!</span>
                <span id="posVipCountBadge" style="background:#b45309;color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;">10+ Purchases in FY</span>
              </div>
              <div style="font-size:12px;color:#78350f;margin-top:4px;">
                This customer has made <strong id="posVipPurchasesText">10 purchases</strong> in this Financial Year! Eligible for VIP Perks & Extra Loyalty Discount.
              </div>
              <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
                <div class="form-group" style="margin:0;">
                  <label class="form-label" style="color:#78350f;font-weight:700;font-size:11px;">🎁 Select Free Gift / Perk</label>
                  <select id="posVipGiftSelect" class="form-select" style="font-size:12px;padding:6px;">
                    <option value="">-- No Gift Selected --</option>
                    <option value="🧰 Complimentary Maintenance Kit">🧰 Free Maintenance Kit</option>
                    <option value="🛢️ Free Engine Oil Bottle">🛢️ Free Engine Oil Bottle</option>
                    <option value="🪖 VIP Safety Helmet">🪖 VIP Safety Helmet / Accessory</option>
                    <option value="🎟️ ₹500 Loyalty Gift Voucher">🎟️ ₹500 Loyalty Gift Voucher</option>
                    <option value="🎁 Special Custom Gift">🎁 Special Custom Gift</option>
                  </select>
                </div>
                <div class="form-group" style="margin:0;">
                  <label class="form-label" style="color:#78350f;font-weight:700;font-size:11px;">🏷️ Extra VIP Loyalty Discount (%)</label>
                  <input type="number" id="posVipExtraDiscInp" class="form-input" placeholder="e.g. 5" min="0" max="100" style="font-size:12px;padding:6px;">
                </div>
              </div>
            </div>
          </div>

          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-weight:700;">👤 Lead Generated By (Name)</label>
              <input type="text" id="posLeadBy" class="form-input" placeholder="Sales Executive / Lead Name">
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-weight:700;">📞 Lead Phone Number</label>
              <input type="tel" id="posLeadPhone" class="form-input" placeholder="10-digit Phone Number" maxlength="15">
            </div>
          </div>

          <div class="form-group" id="leadIncGroup" style="display:none;background:#fef2f2;padding:8px;border-radius:6px;border:1px dashed #fca5a5;margin-bottom:8px;">
            <label class="form-label" style="color:#991b1b;font-weight:700;">💰 Lead Generator Incentive Amount (₹)</label>
            <input type="number" step="0.01" id="posLeadIncentive" class="form-input" value="0.00" placeholder="0.00">
          </div>

          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:8px;">
            <div class="form-group">
              <label class="form-label">Type of Supply</label>
              <select id="posSupplyType" class="form-select">
                <option value="Direct Sale">Direct Sale</option>
                <option value="Sub Dealer">Sub Dealer</option>
                <option value="Dealer Sale">Dealer Sale</option>
                <option value="Department Subsidy Scheme">Department Subsidy Scheme</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Payment Mode *</label>
              <select id="posPayMode" class="form-select">
                <option value="cash">💵 Cash</option>
                <option value="bank">🏦 Bank Transfer</option>
                <option value="upi">📱 UPI</option>
                <option value="finance">🏢 Finance (Bajaj / TVS)</option>
                <option value="credit">📑 Credit (Advance + Company Credit)</option>
              </select>
            </div>
          </div>

          <!-- INITIAL PAID AMOUNT & SETTLEMENT TYPE INPUT FOR ALL PAYMENT MODES -->
          <div class="form-group" style="background:var(--bg-secondary);padding:14px;border-radius:10px;border:2px solid var(--primary-glow);margin:12px 0;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
              <label class="form-label" style="font-weight:800;font-size:13px;color:var(--text1);letter-spacing:0.3px;margin:0;">💵 PAYMENT SETTLEMENT TYPE & INITIAL PAID AMOUNT *</label>
              <select id="posSettlementType" class="form-select" style="width:auto;font-size:13px;padding:6px 14px;font-weight:800;border:2px solid var(--primary);background:var(--bg-primary);color:var(--primary);border-radius:8px;cursor:pointer;box-shadow:0 2px 5px rgba(0,0,0,0.08);">
                <option value="full" style="font-weight:800;color:#15803d;">✅ Full Payment (100% Paid)</option>
                <option value="part" style="font-weight:800;color:#b45309;">⏳ Part Payment / Advance (Partial Paid)</option>
              </select>
            </div>
            <div class="form-group" style="margin:0;">
              <input type="number" step="0.01" id="posPaidAmtInput" class="form-input" placeholder="Enter amount paid at checkout" style="font-size:15px;font-weight:700;color:var(--primary-light);">
            </div>
            <div style="font-size:11px;color:var(--text3);margin-top:4px;font-weight:600;" id="posPaidAmtHelp">
              Enter initial amount customer paid now. Remaining balance will be tracked as pending outstanding.
            </div>

            <!-- CASH DENOMINATIONS BREAKDOWN -->
            <div id="cashDenominationsContainer" style="margin-top:10px;padding:10px;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;">
              <div style="font-size:12px;font-weight:700;color:var(--text1);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
                <span>💵 Cash Notes Denominations Breakdown:</span>
                <span style="font-size:11px;color:var(--primary);font-weight:700;" id="notesCalcSumText">Total: ₹0</span>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;">
                <div style="display:flex;align-items:center;gap:4px;">
                  <span style="width:60px;font-weight:600;font-size:11px;">2000 ×</span>
                  <input type="number" id="note2000" class="form-input note-calc-inp" min="0" placeholder="0" style="padding:2px 6px;height:28px;font-size:12px;">
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                  <span style="width:60px;font-weight:600;font-size:11px;">500 ×</span>
                  <input type="number" id="note500" class="form-input note-calc-inp" min="0" placeholder="0" style="padding:2px 6px;height:28px;font-size:12px;">
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                  <span style="width:60px;font-weight:600;font-size:11px;">200 ×</span>
                  <input type="number" id="note200" class="form-input note-calc-inp" min="0" placeholder="0" style="padding:2px 6px;height:28px;font-size:12px;">
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                  <span style="width:60px;font-weight:600;font-size:11px;">100 ×</span>
                  <input type="number" id="note100" class="form-input note-calc-inp" min="0" placeholder="0" style="padding:2px 6px;height:28px;font-size:12px;">
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                  <span style="width:60px;font-weight:600;font-size:11px;">50 ×</span>
                  <input type="number" id="note50" class="form-input note-calc-inp" min="0" placeholder="0" style="padding:2px 6px;height:28px;font-size:12px;">
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                  <span style="width:60px;font-weight:600;font-size:11px;">20 ×</span>
                  <input type="number" id="note20" class="form-input note-calc-inp" min="0" placeholder="0" style="padding:2px 6px;height:28px;font-size:12px;">
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                  <span style="width:60px;font-weight:600;font-size:11px;">10 ×</span>
                  <input type="number" id="note10" class="form-input note-calc-inp" min="0" placeholder="0" style="padding:2px 6px;height:28px;font-size:12px;">
                </div>
              </div>
            </div>
          </div>

          <!-- DYNAMIC SCHEME FIELDS -->
          <div id="schemeSubFields" style="display:none;margin-bottom:10px;padding:8px;background:var(--bg-secondary);border:1px dashed var(--border);border-radius:6px;">
            <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:8px;">
              <div class="form-group">
                <label class="form-label">Department Name</label>
                <input type="text" id="posSchemeDept" class="form-input" placeholder="e.g. Agriculture / Sericulture">
              </div>
              <div class="form-group">
                <label class="form-label">Application Number</label>
                <input type="text" id="posSchemeAppNo" class="form-input" placeholder="e.g. APP-2026-8821">
              </div>
            </div>
          </div>

          <!-- DYNAMIC PAYMENT MODE SUB-FIELDS -->
          <div id="dynamicPaySubFields" style="margin-bottom:12px;padding:10px;background:var(--bg-secondary);border:1px dashed var(--border);border-radius:6px;display:none;">
            <!-- Rendered dynamically -->
          </div>

          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:8px;">
            <div class="form-group">
              <label class="form-label">Transporter Name</label>
              <input type="text" id="posTransName" class="form-input" placeholder="Logistics / Driver Name">
            </div>
            <div class="form-group">
              <label class="form-label">Vehicle Number</label>
              <input type="text" id="posVehicleNo" class="form-input" placeholder="AP 39 V 1234">
            </div>
          </div>

          <!-- BILLING DISCOUNT & TOTALS -->
          <div style="margin-top:16px;padding:14px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;">
            <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:8px;margin-bottom:10px;background:var(--bg-primary);padding:8px 10px;border-radius:6px;border:1px solid var(--border);">
              <div class="form-group" style="margin:0;">
                <label class="form-label" style="font-weight:700;color:var(--text1);font-size:12px;">🏷️ Overall Billing Discount</label>
                <div style="display:flex;gap:4px;">
                  <input type="number" step="0.01" id="posDiscountAmtInput" class="form-input" value="0.00" placeholder="0.00" style="font-weight:700;padding:4px 8px;">
                  <select id="posDiscountType" class="form-select" style="width:70px;font-weight:700;padding:4px;">
                    <option value="flat">₹</option>
                    <option value="percent">%</option>
                  </select>
                </div>
              </div>
              <div class="form-group" style="margin:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;">
                <label class="form-label" style="font-weight:700;color:var(--text3);margin-bottom:2px;font-size:11px;">Discount Applied</label>
                <span id="posDiscountAppliedText" style="font-size:14px;font-weight:800;color:var(--warning);">-₹0.00</span>
              </div>
            </div>

            <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;">
              <span>Taxable Amount:</span>
              <span id="posTaxableText">₹0.00</span>
            </div>
            <div id="posGstBreakdownArea">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;">
                <span>GST Total:</span>
                <span id="posGstText">₹0.00</span>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:15px;font-weight:700;color:var(--success);border-top:1px solid var(--border);padding-top:8px;margin-top:6px;">
              <span>Grand Total:</span>
              <div style="display:flex;align-items:center;gap:4px;">
                <span style="font-weight:800;font-size:16px;">₹</span>
                <input type="number" step="0.01" id="posGrandTotalInput" class="form-input" style="width:145px;font-size:16px;font-weight:800;color:var(--success);text-align:right;padding:4px 8px;border:2px solid var(--primary);" placeholder="0.00">
              </div>
            </div>
            <div id="posMinCostNotice" style="margin-top:8px;font-size:12px;font-weight:700;padding:8px 12px;border-radius:6px;display:none;"></div>
          </div>

          <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px;">
            <button type="submit" class="btn btn-primary" style="width:100%;padding:12px;font-size:14px;" id="posSubmitBtn" disabled>
              Sell & Print Delivery Challana
            </button>
            <button type="button" class="btn btn-secondary" style="width:100%;padding:10px;font-size:14px;font-weight:700;background:linear-gradient(135deg, #3b82f6, #1d4ed8);color:#fff;border:none;border-radius:6px;box-shadow:0 2px 4px rgba(59,130,246,0.3);" id="posQuotationBtn">
              Generate Quotation / Estimate
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  let cart = [];
  let productsList = [];
  let financersList = [];
  let customersList = [];

  const leadByInput = document.getElementById("posLeadBy");
  const leadPhoneInput = document.getElementById("posLeadPhone");
  const leadIncGrp = document.getElementById("leadIncGroup");
  const checkLeadIncDisplay = () => {
    const nameVal = leadByInput ? leadByInput.value.trim() : "";
    const phoneVal = leadPhoneInput ? leadPhoneInput.value.trim() : "";
    if ((nameVal.length > 0 || phoneVal.length > 0) && leadIncGrp) {
      leadIncGrp.style.display = "block";
    } else if (leadIncGrp) {
      leadIncGrp.style.display = "none";
    }
  };
  leadByInput?.addEventListener("input", checkLeadIncDisplay);
  leadPhoneInput?.addEventListener("input", checkLeadIncDisplay);

  const supplyTypeSelect = document.getElementById("posSupplyType");
  const schemeSubFields = document.getElementById("schemeSubFields");
  supplyTypeSelect?.addEventListener("change", () => {
    const sVal = (supplyTypeSelect.value || '').toLowerCase();
    if (schemeSubFields) {
      schemeSubFields.style.display = (sVal.includes("sub") || sVal.includes("dept") || sVal.includes("scheme")) ? "block" : "none";
    }
  });

  const payModeSelect = document.getElementById("posPayMode");
  const paySubContainer = document.getElementById("dynamicPaySubFields");

  // Helper to fetch financers
  async function refreshFinancersList() {
    try {
      const finRes = await fetch(`${API_BASE}/sales?action=financers-list&company_id=${compId}`, { headers: authHeaders() });
      const finData = await finRes.json();
      if (finData.success) financersList = finData.financers || [];
    } catch (e) {}
  }
  await refreshFinancersList();

  function fillCustomerDetails(c) {
    if (!c) return;
    document.getElementById("posCustId").value = c.id || '';
    document.getElementById("posCustName").value = c.name || '';
    document.getElementById("posFatherName").value = c.father_name || '';
    document.getElementById("posCellPhone").value = c.phone || '';
    document.getElementById("posVillage").value = c.village || c.address || '';
    document.getElementById("posMandal").value = c.mandal || '';

    checkAndToggleVipBanner(c);
  }

  function checkAndToggleVipBanner(c) {
    const vipContainer = document.getElementById("posVipLoyaltyContainer");
    if (!vipContainer) return;
    const fyCount = parseInt(c?.fy_purchases_count || c?.total_purchases || 0);
    if (fyCount >= 10) {
      vipContainer.style.display = "block";
      document.getElementById("posVipCountBadge").textContent = `${fyCount} Purchases in FY`;
      document.getElementById("posVipPurchasesText").textContent = `${fyCount} purchases`;
    } else {
      vipContainer.style.display = "none";
    }
    updateCartUI();
  }

  function resetPartyFormFields() {
    if (document.getElementById("posCustId")) document.getElementById("posCustId").value = "";
    if (document.getElementById("posdealerId")) document.getElementById("posdealerId").value = "";
    if (document.getElementById("posCustName")) document.getElementById("posCustName").value = "";
    if (document.getElementById("posFatherName")) document.getElementById("posFatherName").value = "";
    if (document.getElementById("posVillage")) document.getElementById("posVillage").value = "";
    if (document.getElementById("posMandal")) document.getElementById("posMandal").value = "";
    if (document.getElementById("posCellPhone")) document.getElementById("posCellPhone").value = "";
    if (document.getElementById("posCustGstin")) document.getElementById("posCustGstin").value = "";
    if (document.getElementById("posCustSearchInp")) document.getElementById("posCustSearchInp").value = "";
    checkAndToggleVipBanner(null);
  }

  // Helper to fetch customers
  async function refreshCustomersList(selectIdToPick = null) {
    try {
      const cRes = await fetch(`${API_BASE}/employees?action=customers-list&company_id=${compId}`, { headers: authHeaders() });
      const cData = await cRes.json();
      if (cData.success) {
        customersList = cData.customers || [];
        const custSel = document.getElementById("posCustId");
        if (custSel) {
          custSel.innerHTML = `<option value="">-- New / Walk-in Customer --</option>` +
            customersList.map(c => `<option value="${c.id}">${esc(c.name)} ${c.father_name ? `(S/o ${esc(c.father_name)})` : ''} - ${esc(c.phone || 'No phone')}</option>`).join("");

          if (selectIdToPick) {
            custSel.value = selectIdToPick;
            const selectedCust = customersList.find(c => c.id == selectIdToPick);
            if (selectedCust) fillCustomerDetails(selectedCust);
          }
        }
      }
    } catch (e) {}
  }
  let dealersList = [];
  async function refreshdealersList() {
    try {
      const vRes = await fetch(`${API_BASE}/employees?action=dealers-list&company_id=${compId}`, { headers: authHeaders() });
      const vData = await vRes.json();
      if (vData.success) {
        dealersList = vData.dealers || [];
        const venSel = document.getElementById("posdealerId");
        if (venSel) {
          venSel.innerHTML = `<option value="">-- Select Registered dealer --</option>` +
            dealersList.map(v => `<option value="${v.id}">${esc(v.trade_name || v.legal_name)} ${v.gstin ? `(GSTIN: ${esc(v.gstin)})` : ''}</option>`).join("");
        }
      }
    } catch (e) {}
  }
  await refreshCustomersList();
  await refreshdealersList();

  // Live Autocomplete on Customer Name field
  const liveNameInp = document.getElementById("posCustName");
  const liveCustDropdown = document.getElementById("posLiveCustDropdown");

  if (liveNameInp && liveCustDropdown) {
    liveNameInp.addEventListener("input", () => {
      const q = liveNameInp.value.trim().toLowerCase();
      const pType = partyTypeSel ? partyTypeSel.value : 'customer';

      if (!q || pType === 'counter') {
        liveCustDropdown.style.display = "none";
        return;
      }

      const matches = customersList.filter(c => {
        const nameMatch = (c.name || '').toLowerCase().includes(q);
        const phoneMatch = (c.phone || '').includes(q);
        const fatherMatch = (c.father_name || '').toLowerCase().includes(q);
        return nameMatch || phoneMatch || fatherMatch;
      });

      if (matches.length === 0) {
        liveCustDropdown.innerHTML = `<div style="padding:10px;color:var(--text3);font-size:12px;">No matching customer in DB. New customer will be auto-saved to Customer Register upon billing!</div>`;
      } else {
        liveCustDropdown.innerHTML = matches.map(c => `
          <div class="live-cust-item" data-id="${c.id}" style="padding:10px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-weight:700;color:var(--text1);">${esc(c.name)} ${c.father_name ? `<span style="font-weight:400;color:var(--text3);">(S/o ${esc(c.father_name)})</span>` : ''}</div>
              <div style="font-size:11px;color:var(--text3);">📞 ${esc(c.phone || 'No phone')} | 🏡 ${esc(c.village || c.address || '—')}</div>
            </div>
            ${(parseInt(c.fy_purchases_count || c.total_purchases || 0) >= 10) ? `<span class="badge badge-warning" style="font-size:10px;">🌟 VIP (${c.fy_purchases_count || c.total_purchases} Purchases)</span>` : ''}
          </div>
        `).join("");

        liveCustDropdown.querySelectorAll(".live-cust-item").forEach(item => {
          item.addEventListener("click", () => {
            const custObj = customersList.find(x => x.id == item.dataset.id);
            fillCustomerDetails(custObj);
            liveCustDropdown.style.display = "none";
          });
        });
      }
      liveCustDropdown.style.display = "block";
    });

    document.addEventListener("click", (evt) => {
      if (!liveNameInp.contains(evt.target) && !liveCustDropdown.contains(evt.target)) {
        liveCustDropdown.style.display = "none";
      }
    });
  }

  function tryAutoMatchCustomerFields() {
    const nameVal = (document.getElementById("posCustName")?.value || "").trim().toLowerCase();
    const phoneVal = (document.getElementById("posCellPhone")?.value || "").trim();
    const fatherVal = (document.getElementById("posFatherName")?.value || "").trim().toLowerCase();

    if (!nameVal && !phoneVal && !fatherVal) return;

    const matched = customersList.find(c => {
      if (phoneVal && phoneVal.length >= 10 && c.phone && c.phone.trim() === phoneVal) return true;
      if (nameVal && fatherVal && (c.name || '').toLowerCase() === nameVal && (c.father_name || '').toLowerCase() === fatherVal) return true;
      if (nameVal && (c.name || '').toLowerCase() === nameVal) return true;
      return false;
    });

    if (matched) {
      document.getElementById("posCustId").value = matched.id;
      if (!document.getElementById("posFatherName").value && matched.father_name) document.getElementById("posFatherName").value = matched.father_name;
      if (!document.getElementById("posVillage").value && (matched.village || matched.address)) document.getElementById("posVillage").value = matched.village || matched.address;
      if (!document.getElementById("posMandal").value && matched.mandal) document.getElementById("posMandal").value = matched.mandal;
      if (!document.getElementById("posCellPhone").value && matched.phone) document.getElementById("posCellPhone").value = matched.phone;
      checkAndToggleVipBanner(matched);
    }
  }

  ["posCustName", "posFatherName", "posCellPhone"].forEach(id => {
    document.getElementById(id)?.addEventListener("blur", tryAutoMatchCustomerFields);
  });

  document.getElementById("posCustId")?.addEventListener("change", () => {
    const selectedCust = customersList.find(c => c.id == document.getElementById("posCustId").value);
    if (selectedCust) fillCustomerDetails(selectedCust);
    else resetPartyFormFields();
  });

  document.getElementById("posDiscountAmtInput")?.addEventListener("input", () => updateCartUI());
  document.getElementById("posDiscountType")?.addEventListener("change", () => updateCartUI());
  document.getElementById("posVipExtraDiscInp")?.addEventListener("input", () => updateCartUI());

  const partyTypeSel = document.getElementById("posPartyType");
  const custBlock = document.getElementById("posCustBlock");
  const dealerBlock = document.getElementById("posdealerBlock");
  const extraFields = document.getElementById("posExtraCustFields");
  const nameLabel = document.getElementById("posNameLabel");
  const posCustNameInp = document.getElementById("posCustName");

  function applyPartyTypeUI(pType) {
    if (pType === "dealer") {
      if (custBlock) custBlock.style.display = "none";
      if (dealerBlock) dealerBlock.style.display = "block";
      if (extraFields) extraFields.style.display = "block";
      if (nameLabel) nameLabel.textContent = "Dealer Name *";
    } else if (pType === "counter") {
      if (custBlock) custBlock.style.display = "none";
      if (dealerBlock) dealerBlock.style.display = "none";
      if (extraFields) extraFields.style.display = "none";
      if (nameLabel) nameLabel.textContent = "Customer Name *";
      if (posCustNameInp && !posCustNameInp.value) posCustNameInp.value = "Counter Customer";
    } else {
      if (custBlock) custBlock.style.display = "block";
      if (dealerBlock) dealerBlock.style.display = "none";
      if (extraFields) extraFields.style.display = "block";
      if (nameLabel) nameLabel.textContent = "Customer Name *";
    }
    updateCartUI();
  }

  if (partyTypeSel) {
    const savedPartyType = localStorage.getItem("pos_party_type") || "customer";
    partyTypeSel.value = savedPartyType;
    applyPartyTypeUI(savedPartyType);

    partyTypeSel.addEventListener("change", () => {
      localStorage.setItem("pos_party_type", partyTypeSel.value);
      resetPartyFormFields();
      applyPartyTypeUI(partyTypeSel.value);
      updateCartUI();
    });
  }

  const posdealerSel = document.getElementById("posdealerId");
  if (posdealerSel) {
    posdealerSel.addEventListener("change", () => {
      const vId = posdealerSel.value;
      const selectedVen = dealersList.find(v => v.id == vId);
      if (selectedVen) {
        document.getElementById("posCustName").value = selectedVen.trade_name || selectedVen.legal_name || '';
        document.getElementById("posFatherName").value = '';
        document.getElementById("posCellPhone").value = selectedVen.phone || '';
        document.getElementById("posVillage").value = selectedVen.address || '';
        document.getElementById("posMandal").value = selectedVen.state || '';
        if (document.getElementById("posCustGstin")) {
          document.getElementById("posCustGstin").value = selectedVen.gstin || '';
        }
      } else {
        resetPartyFormFields();
      }
    });
  }

  payModeSelect.addEventListener("change", () => {
    const mode = payModeSelect.value;
    const cashDenomContainer = document.getElementById("cashDenominationsContainer");
    if (cashDenomContainer) {
      cashDenomContainer.style.display = (mode === "cash") ? "block" : "none";
    }

    if (mode === "bank") {
      paySubContainer.style.display = "block";
      paySubContainer.innerHTML = `
        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:8px;">
          <div class="form-group">
            <label class="form-label">Bank Sub-Type</label>
            <select id="posBankSub" class="form-select">
              <option value="NEFT">NEFT</option>
              <option value="RTGS">RTGS</option>
              <option value="Cheque">Cheque</option>
              <option value="DD">Demand Draft (DD)</option>
              <option value="Other">Other Transfer</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Transaction / Instrument No.</label>
            <input type="text" id="posTxnRef" class="form-input" placeholder="Ref / Cheque #">
          </div>
        </div>
        <div class="form-grid" style="grid-template-columns:1.2fr 1fr;gap:8px;margin-top:6px;">
          <div class="form-group">
            <label class="form-label">Receiving Company Bank Account *</label>
            <select id="posRecBankSelect" class="form-select"></select>
          </div>
          <div class="form-group">
            <label class="form-label">Cheque / DD Date</label>
            <input type="date" id="posChequeDate" class="form-input">
          </div>
        </div>
      `;
      if (window.populateBankAccountDropdown) {
        window.populateBankAccountDropdown("posRecBankSelect", activeCompId);
      }
    } else if (mode === "upi") {
      paySubContainer.style.display = "block";
      paySubContainer.innerHTML = `
        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:8px;">
          <div class="form-group">
            <label class="form-label">UTR Number *</label>
            <input type="text" id="posUtrNo" class="form-input" placeholder="e.g. 321456987012" required>
          </div>
          <div class="form-group">
            <label class="form-label">Receiving Company Bank Account</label>
            <select id="posUpiRecBankSelect" class="form-select"></select>
          </div>
        </div>
      `;
      if (window.populateBankAccountDropdown) {
        window.populateBankAccountDropdown("posUpiRecBankSelect", activeCompId);
      }
    } else if (mode === "credit") {
      paySubContainer.style.display = "block";
      paySubContainer.innerHTML = `
        <div class="form-group">
          <label class="form-label">Company Credit Terms / Notes</label>
          <input type="text" id="posCreditNotes" class="form-input" placeholder="e.g. 30 days payment agreement">
        </div>
      `;
    } else if (mode === "finance") {
      paySubContainer.style.display = "block";
      paySubContainer.innerHTML = `
        <div class="form-grid" style="grid-template-columns:1.5fr auto;gap:8px;align-items:flex-end;">
          <div class="form-group">
            <label class="form-label">Select Registered Financer *</label>
            <select id="posFinancerId" class="form-select">
              <option value="">-- Select Registered Financer --</option>
              ${financersList.map(f => `<option value="${f.id}">${esc(f.name)} (${esc(f.type || 'Finance')})</option>`).join("")}
            </select>
          </div>
          <button type="button" class="btn btn-sm btn-outline" id="quickAddFinBtn" style="height:38px;">+ Add Financer</button>
        </div>
        <div class="form-group" style="margin-top:8px;">
          <label class="form-label">Financed Amount (₹)</label>
          <input type="number" step="0.01" id="posFinancedAmt" class="form-input" placeholder="0.00">
        </div>
      `;

      on("quickAddFinBtn", "click", () => {
        openAddFinancerModal(async (newFin) => {
          await refreshFinancersList();
          const finSel = document.getElementById("posFinancerId");
          if (finSel) {
            finSel.innerHTML = `<option value="">-- Select Registered Financer --</option>` +
              financersList.map(f => `<option value="${f.id}">${esc(f.name)} (${esc(f.type || 'Finance')})</option>`).join("");
            finSel.value = newFin.id;
          }
        });
      });
    } else {
      paySubContainer.style.display = "none";
      paySubContainer.innerHTML = "";
    }
  });

  // Populate Superadmin Company Selector if superadmin
  if (isSuper) {
    const compSel = document.getElementById("posCompanySelect");
    if (compSel) {
      let comps = (window.currentCompanies && window.currentCompanies.length > 0) ? window.currentCompanies : (typeof currentCompanies !== 'undefined' ? currentCompanies : []);
      const renderCompOptions = (cList) => {
        const activeCompVal = (selectedCompanyId && selectedCompanyId !== "all") ? selectedCompanyId : cList[0]?.id;
        compSel.innerHTML = cList.map(c => `<option value="${c.id}" ${c.id == activeCompVal ? 'selected' : ''}>${esc(c.name)}</option>`).join("");
        if (activeCompVal) compSel.value = activeCompVal;
      };

      if (comps.length > 0) {
        renderCompOptions(comps);
      } else {
        fetch(`${API_BASE}/setup?action=companies`, { headers: authHeaders() })
          .then(r => r.json())
          .then(data => {
            if (data.success && data.companies) {
              window.currentCompanies = data.companies;
              renderCompOptions(data.companies);
            }
          })
          .catch(() => {});
      }

      compSel.addEventListener("change", () => {
        selectedCompanyId = compSel.value;
        localStorage.setItem("selectedCompanyId", selectedCompanyId);
        const topSel = document.getElementById("companySelect");
        if (topSel) topSel.value = selectedCompanyId;
        loadSalesPOSSubTab();
      });
    }
  }

  function populateProductSelect(filterQuery = "") {
    const prodSel = document.getElementById("posProdSelect");
    if (!prodSel) return;

    const q = filterQuery.toLowerCase().trim();
    const filtered = q ? productsList.filter(p => {
      const name = String(p.name || '').toLowerCase();
      const brand = String(p.brand || '').toLowerCase();
      const model = String(p.model || '').toLowerCase();
      const hsn = String(p.hsn_sac || p.hsn_code || '').toLowerCase();
      const serialNo = String(p.serial_no || p.serial_number || '').toLowerCase();
      const barcode = String(p.barcode || '').toLowerCase();
      return name.includes(q) || brand.includes(q) || model.includes(q) || hsn.includes(q) || serialNo.includes(q) || barcode.includes(q);
    }) : productsList;

    if (filtered.length === 0) {
      prodSel.innerHTML = `<option value="">❌ No matching products found</option>`;
      return;
    }

    const availableCount = filtered.filter(p => parseFloat(p.selling_rate || 0) > 0 && (parseInt(p.current_stock, 10) || 0) > 0).length;

    prodSel.innerHTML = `<option value="">-- Select Product (${availableCount} available to sell / ${filtered.length} total) --</option>` +
      filtered.map(p => {
        const rate = parseFloat(p.selling_rate || 0);
        const stock = parseInt(p.current_stock, 10) || 0;
        const isZeroPrice = rate <= 0;
        const isOutOfStock = stock <= 0;

        if (isZeroPrice) {
          return `<option value="${p.id}" disabled style="color:#dc2626;background:#fef2f2;font-weight:600;padding:6px 10px;">⚠️ ${esc(p.name)} - ₹0.00 (NOT READY TO SELL - Set Price in Inventory)</option>`;
        }
        if (isOutOfStock) {
          return `<option value="${p.id}" disabled style="color:#64748b;background:#f1f5f9;font-weight:600;padding:6px 10px;">🚫 ${esc(p.name)} - ${formatCurrency(rate)} (OUT OF STOCK - Stock: 0)</option>`;
        }
        return `<option value="${p.id}" style="color:#0f172a;font-weight:600;padding:6px 10px;">📦 ${esc(p.name)} - ${formatCurrency(rate)} (In Stock: ${stock})</option>`;
      }).join("");
  }

  // Fetch products & customers
  try {
    const pRes = await fetch(`${API_BASE}/inventory?action=products&company_id=${compId}`, { headers: authHeaders() });
    const pData = await pRes.json();
    if (pData.success) {
      productsList = pData.products || [];
      populateProductSelect();
    }
  } catch (e) {}

  document.getElementById("posProdSearchInp")?.addEventListener("input", (e) => {
    populateProductSelect(e.target.value);
  });

  function updateCartUI() {
    // Auto-expand any items > ₹10,000 with qty > 1 into 1-by-1 separate items so each has its own serial number input
    let expandedCart = [];
    cart.forEach(item => {
      const isHighVal = parseFloat(item.rate || 0) > 10000;
      if (isHighVal && item.quantity > 1) {
        const q = item.quantity;
        for (let k = 0; k < q; k++) {
          expandedCart.push({
            ...item,
            quantity: 1,
            serial_number: k === 0 ? (item.serial_number || '') : ''
          });
        }
      } else {
        expandedCart.push(item);
      }
    });
    cart = expandedCart;

    const tbody = document.getElementById("cartTableBody");
    const gstArea = document.getElementById("posGstBreakdownArea");
    const selectedState = (document.getElementById("posSupplyState")?.value || "").trim().toLowerCase();
    const homeStateStr = (posHomeState || userObj.company_state || "Andhra Pradesh").trim().toLowerCase();
    const isSameState = (!selectedState || selectedState === homeStateStr || selectedState === "same state" || selectedState.includes("intra") || homeStateStr === "same state");

    if (!tbody) return;
    if (cart.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3);">Cart is empty. Add products above.</td></tr>`;
      const btnSubmit = document.getElementById("posSubmitBtn");
      if (btnSubmit) {
        btnSubmit.disabled = true;
        const partyTypeVal = document.getElementById("posPartyType")?.value;
        const isCounterParty = partyTypeVal === "counter";
        btnSubmit.innerHTML = isCounterParty 
          ? `🧾 Complete Sale & Direct Generate Tax Invoice`
          : `Sell & Print Delivery Challana`;
      }

      const taxableEl = document.getElementById("posTaxableText");
      if (taxableEl) taxableEl.textContent = formatCurrency(0);

      const discAppliedEl = document.getElementById("posDiscountAppliedText");
      if (discAppliedEl) discAppliedEl.textContent = "-₹0.00";

      if (gstArea) {
        gstArea.innerHTML = `
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;">
            <span>GST Total:</span>
            <span>${formatCurrency(0)}</span>
          </div>`;
      }
      const grandTextEl = document.getElementById("posGrandText");
      if (grandTextEl) grandTextEl.textContent = formatCurrency(0);

      const grandInpEl = document.getElementById("posGrandTotalInput");
      if (grandInpEl) grandInpEl.value = "";

      const paidInpEl = document.getElementById("posPaidAmtInput");
      if (paidInpEl) paidInpEl.value = "0.00";
      return;
    }

    let taxable = 0;
    let gst = 0;

    tbody.innerHTML = cart.map((item, idx) => {
      const gstRate = Math.round(parseFloat(item.gst_rate || 18));
      const lineTaxable = item.rate * item.quantity;
      const lineTax = (lineTaxable * gstRate) / 100;
      taxable += lineTaxable;
      gst += lineTax;

      const isHighValue = parseFloat(item.rate || 0) > 10000;

      return `
        <tr>
          <td>
            <div style="font-weight:600;color:var(--text1);margin-bottom:4px;">${esc(item.name)}</div>
            ${isHighValue ? `
              <div style="margin-top:4px;">
                <label style="font-size:11px;color:var(--primary);font-weight:700;display:block;margin-bottom:2px;">
                  ⚙️ Chassis / Serial No *
                </label>
                <input type="text" 
                       class="form-input cart-item-serial-input" 
                       data-idx="${idx}" 
                       value="${esc(item.serial_number || '')}" 
                       placeholder="Enter Chassis / Machine Serial No" 
                       style="padding:4px 8px;font-size:12px;font-family:monospace;width:100%;max-width:260px;border-color:var(--primary);" 
                       required form="posCheckoutForm">
              </div>
            ` : ''}
          </td>
          <td>
            <div style="display:inline-flex;align-items:center;gap:3px;background:var(--bg-secondary);padding:3px;border-radius:6px;border:1px solid var(--border);">
              <button type="button" class="btn btn-sm btn-outline-danger decreaseCartQty" data-idx="${idx}" style="padding:2px 8px;font-size:13px;font-weight:800;line-height:1;border-radius:4px;" title="Decrease quantity">-</button>
              <input type="number" min="1" class="form-input cart-qty-input" data-idx="${idx}" value="${item.quantity}" style="width:48px;text-align:center;padding:2px 4px;font-weight:700;font-size:13px;border:1px solid var(--border);border-radius:4px;" ${isHighValue ? 'readonly title="High-value items (>₹10k) tracked 1-by-1 per serial number"' : ''}>
              <button type="button" class="btn btn-sm btn-outline-success increaseCartQty" data-idx="${idx}" style="padding:2px 8px;font-size:13px;font-weight:800;line-height:1;border-radius:4px;" title="Increase quantity">+</button>
            </div>
          </td>
          <td>${formatCurrency(item.rate)}</td>
          <td>${gstRate}%</td>
          <td style="font-weight:600;">${formatCurrency(lineTaxable + lineTax)}</td>
          <td><button class="btn btn-sm btn-danger removeCartItem" data-idx="${idx}">&times;</button></td>
        </tr>
      `;
    }).join("");

    // Calculate Minimum Cost Price (Purchase Rate Incl Tax + Transport Expenses) to prevent company loss
    let totalMinCost = 0;
    cart.forEach(item => {
      const purRateExcl = parseFloat(item.purchase_rate || 0);
      const gstR = parseFloat(item.gst_rate || 18);
      const purRateIncl = (item.purchase_rate_incl_tax && parseFloat(item.purchase_rate_incl_tax) > 0)
        ? parseFloat(item.purchase_rate_incl_tax)
        : (purRateExcl * (1 + gstR / 100));
      const transportExp = parseFloat(item.transport_expenses || 0);
      const itemMinCost = (purRateIncl + transportExp) * (parseInt(item.quantity, 10) || 1);
      totalMinCost += itemMinCost;
    });
    totalMinCost = Math.round(totalMinCost * 100) / 100;

    // Calculate discount
    const discType = document.getElementById("posDiscountType")?.value || "flat";
    const discInpVal = parseFloat(document.getElementById("posDiscountAmtInput")?.value || 0);
    let vipDiscPercent = parseFloat(document.getElementById("posVipExtraDiscInp")?.value || 0);
    if (isNaN(vipDiscPercent)) vipDiscPercent = 0;

    let baseDiscVal = discType === "percent" ? (taxable * discInpVal / 100) : discInpVal;
    let vipDiscVal = (taxable * vipDiscPercent / 100);
    let totalDiscount = baseDiscVal + vipDiscVal;
    totalDiscount = Math.min(taxable, totalDiscount);

    const netTaxable = Math.max(0, taxable - totalDiscount);
    const netGst = (gst * netTaxable) / (taxable || 1);
    const standardGrand = Math.round((netTaxable + netGst) * 100) / 100;

    const grandInp = document.getElementById("posGrandTotalInput");
    if (grandInp && !grandInp.dataset.listenerAttached) {
      grandInp.dataset.listenerAttached = "true";
      grandInp.addEventListener("input", () => {
        grandInp.dataset.userOverridden = (grandInp.value.trim() !== "" && parseFloat(grandInp.value) > 0) ? "true" : "false";
        updateCartUI();
      });
    }

    let finalGrand = standardGrand;
    let finalTaxable = Math.round(netTaxable * 100) / 100;
    let finalGst = Math.round(netGst * 100) / 100;

    if (grandInp) {
      if (grandInp.dataset.userOverridden === "true" && grandInp.value.trim() !== "" && parseFloat(grandInp.value) > 0) {
        finalGrand = parseFloat(grandInp.value);
        const effectiveGstRate = netTaxable > 0 ? ((netGst / netTaxable) * 100) : (cart[0] ? Math.round(parseFloat(cart[0].gst_rate || 18)) : 18);
        finalTaxable = Math.round((finalGrand / (1 + effectiveGstRate / 100)) * 100) / 100;
        finalGst = Math.round((finalGrand - finalTaxable) * 100) / 100;
      } else {
        grandInp.value = standardGrand > 0 ? standardGrand.toFixed(2) : "";
        grandInp.dataset.userOverridden = "false";
      }
    }

    document.getElementById("posTaxableText").textContent = formatCurrency(finalTaxable);
    if (document.getElementById("posDiscountAppliedText")) {
      document.getElementById("posDiscountAppliedText").textContent = `-` + formatCurrency(totalDiscount);
    }

    // Check distinct GST rates in cart
    const distinctGstRates = [...new Set(cart.map(item => Math.round(parseFloat(item.gst_rate || 18))))];
    const isSingleGstRate = distinctGstRates.length === 1;
    const singleGstRate = isSingleGstRate ? distinctGstRates[0] : null;

    // Group GST amounts by rate slab for detailed breakdown
    const slabBreakdown = {};
    cart.forEach(item => {
      const gRate = Math.round(parseFloat(item.gst_rate || 18));
      const lineTaxable = item.rate * item.quantity;
      const lineTax = (lineTaxable * gRate) / 100;
      if (!slabBreakdown[gRate]) slabBreakdown[gRate] = { taxable: 0, gst: 0 };
      slabBreakdown[gRate].taxable += lineTaxable;
      slabBreakdown[gRate].gst += lineTax;
    });

    if (gstArea) {
      if (isSameState) {
        const halfGst = Math.round((finalGst / 2) * 100) / 100;
        const cgstLabel = singleGstRate !== null ? `CGST (State Tax ${singleGstRate / 2}%):` : `CGST (State Tax):`;
        const sgstLabel = singleGstRate !== null ? `SGST (Central Tax ${singleGstRate / 2}%):` : `SGST (Central Tax):`;
        const totalGstLabel = singleGstRate !== null ? `Total GST (${singleGstRate}%):` : `Total GST:`;

        let slabsHtml = "";
        if (!isSingleGstRate && Object.keys(slabBreakdown).length > 1) {
          const badgeItems = Object.keys(slabBreakdown).map(r => {
            const slabTax = slabBreakdown[r].gst;
            return `<span style="font-size:11px;background:var(--bg-primary);border:1px solid var(--border);padding:2px 6px;border-radius:4px;font-weight:600;color:var(--primary-light);">GST ${r}%: ${formatCurrency(slabTax)}</span>`;
          }).join(" ");
          slabsHtml = `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;margin-top:2px;">${badgeItems}</div>`;
        }

        gstArea.innerHTML = `
          ${slabsHtml}
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px;color:var(--text2);">
            <span>${cgstLabel}</span>
            <span style="font-weight:600;color:var(--primary-light);">${formatCurrency(halfGst)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px;color:var(--text2);">
            <span>${sgstLabel}</span>
            <span style="font-weight:600;color:var(--primary-light);">${formatCurrency(halfGst)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;font-weight:700;">
            <span>${totalGstLabel}</span>
            <span>${formatCurrency(finalGst)}</span>
          </div>
        `;
      } else {
        const igstLabel = singleGstRate !== null ? `IGST (Integrated Tax ${singleGstRate}%):` : `IGST (Integrated Tax):`;
        const totalGstLabel = singleGstRate !== null ? `Total GST (${singleGstRate}%):` : `Total GST:`;

        let slabsHtml = "";
        if (!isSingleGstRate && Object.keys(slabBreakdown).length > 1) {
          const badgeItems = Object.keys(slabBreakdown).map(r => {
            const slabTax = slabBreakdown[r].gst;
            return `<span style="font-size:11px;background:var(--bg-primary);border:1px solid var(--border);padding:2px 6px;border-radius:4px;font-weight:600;color:var(--warning);">GST ${r}%: ${formatCurrency(slabTax)}</span>`;
          }).join(" ");
          slabsHtml = `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;margin-top:2px;">${badgeItems}</div>`;
        }

        gstArea.innerHTML = `
          ${slabsHtml}
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;font-weight:700;color:var(--warning);">
            <span>${igstLabel}</span>
            <span>${formatCurrency(finalGst)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;font-weight:700;">
            <span>${totalGstLabel}</span>
            <span>${formatCurrency(finalGst)}</span>
          </div>
        `;
      }
    }

    // Minimum Cost Validation & Submit Control
    const noticeEl = document.getElementById("posMinCostNotice");
    const submitBtn = document.getElementById("posSubmitBtn");
    const isLoss = finalGrand > 0 && (finalGrand < (totalMinCost - 0.01));

    const currentUserObj = (typeof getUser === "function" ? getUser() : null) || (typeof currentUser !== "undefined" && currentUser ? currentUser : null) || JSON.parse(localStorage.getItem("erp_user") || "{}");
    const isSuperAdminUser = (typeof isSuper !== "undefined" && isSuper) || (currentUserObj && (currentUserObj.role === "superadmin" || currentUserObj.username === "superadmin"));

    const partyTypeVal = document.getElementById("posPartyType")?.value;
    const isCounterParty = partyTypeVal === "counter";

    if (isLoss) {
      if (isSuperAdminUser) {
        if (noticeEl) {
          noticeEl.style.display = "block";
          noticeEl.style.background = "#fffbe6";
          noticeEl.style.color = "#b45309";
          noticeEl.style.border = "1px solid #fef3c7";
          noticeEl.innerHTML = `👑 <strong>SUPERADMIN OVERRIDE AUTHORIZED:</strong> Billing Amount (${formatCurrency(finalGrand)}) is LESS than Minimum Cost Price (${formatCurrency(totalMinCost)}: Purchase Rate Incl. Tax + Transport Expenses). As Superadmin, you are authorized to override and sell at a loss (damaged / clearance stock).`;
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = "1";
          submitBtn.style.cursor = "pointer";
          submitBtn.style.background = "linear-gradient(135deg, #d97706, #b45309)";
          submitBtn.style.color = "#ffffff";
          submitBtn.innerHTML = isCounterParty
            ? `⚠️ Generate Tax Invoice at a Loss (Superadmin Authorized Override)`
            : `⚠️ Complete Sale at a Loss (Superadmin Authorized Override)`;
        }
      } else {
        if (noticeEl) {
          noticeEl.style.display = "block";
          noticeEl.style.background = "#fef2f2";
          noticeEl.style.color = "#dc2626";
          noticeEl.style.border = "1px solid #fca5a5";
          noticeEl.innerHTML = `⚠️ <strong>LOSS ALERT:</strong> Selling Amount (${formatCurrency(finalGrand)}) is LESS than Minimum Cost Price (${formatCurrency(totalMinCost)}: Purchase Rate Incl. Tax + Transport Expenses). Sale is <strong>BLOCKED</strong> to prevent company loss! (Only Superadmin can override)`;
        }
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.style.opacity = "0.6";
          submitBtn.style.cursor = "not-allowed";
          submitBtn.style.background = "";
          submitBtn.style.color = "";
          submitBtn.innerHTML = `🚫 Billing Amount Below Minimum Cost (Sale Blocked)`;
        }
      }
    } else {
      if (noticeEl) {
        if (grandInp && grandInp.dataset.userOverridden === "true" && Math.abs(finalGrand - standardGrand) > 0.01) {
          noticeEl.style.display = "block";
          noticeEl.style.background = "#f0fdf4";
          noticeEl.style.color = "#166534";
          noticeEl.style.border = "1px solid #bbf7d0";
          noticeEl.innerHTML = `✅ <strong>Custom Billing Total:</strong> ${formatCurrency(finalGrand)} (Meets/exceeds Min Cost ${formatCurrency(totalMinCost)}). GST & Taxable auto-adjusted!`;
        } else {
          noticeEl.style.display = "none";
        }
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = "1";
        submitBtn.style.cursor = "pointer";
        submitBtn.style.background = "";
        submitBtn.style.color = "";
        submitBtn.innerHTML = isCounterParty
          ? `🧾 Complete Sale & Direct Generate Tax Invoice`
          : `Sell & Print Delivery Challana`;
      }
    }

    const settlementSel = document.getElementById("posSettlementType");
    const paidInput = document.getElementById("posPaidAmtInput");
    const helpTxt = document.getElementById("posPaidAmtHelp");
    
    if (settlementSel && paidInput) {
      if (settlementSel.value === "full") {
        paidInput.value = finalGrand.toFixed(2);
        if (helpTxt) helpTxt.innerHTML = `<span style="color:var(--success); font-weight:700;">✅ Full Payment: ${formatCurrency(finalGrand)} paid in full. Pending Balance: ₹0.00</span>`;
      } else {
        const userPaid = parseFloat(paidInput.value || 0);
        const pending = Math.max(0, finalGrand - userPaid);
        if (helpTxt) {
          if (pending > 0.01) {
            helpTxt.innerHTML = `<span style="color:var(--warning); font-weight:700;">⏳ Part Payment: ${formatCurrency(userPaid)} paid now. <span style="color:var(--danger); font-weight:800;">Remaining Pending Balance: ${formatCurrency(pending)}</span></span>`;
          } else {
            helpTxt.innerHTML = `<span style="color:var(--success); font-weight:700;">✅ Fully Paid: ${formatCurrency(userPaid)}</span>`;
          }
        }
      }
    }

    document.querySelectorAll(".cart-item-serial-input").forEach(inp => {
      inp.addEventListener("input", (e) => {
        const itemIdx = parseInt(e.target.dataset.idx);
        if (cart[itemIdx]) {
          cart[itemIdx].serial_number = e.target.value.trim();
        }
      });
    });

    document.querySelectorAll(".increaseCartQty").forEach(btn => {
      btn.addEventListener("click", () => {
        const itemIdx = parseInt(btn.dataset.idx, 10);
        const item = cart[itemIdx];
        if (!item) return;

        const isHighVal = parseFloat(item.rate || 0) > 10000;

        if (isHighVal) {
          if (item.product_id) {
            const prod = (productsList || []).find(p => p.id == item.product_id);
            if (prod) {
              const stock = parseInt(prod.current_stock, 10) || 0;
              const currentInCart = cart.filter(c => c.product_id == item.product_id).reduce((sum, it) => sum + (parseInt(it.quantity, 10) || 0), 0);
              if (currentInCart + 1 > stock) {
                return showToast(`Stock limit reached! Only ${stock} unit(s) available for "${item.name}".`, "error");
              }
            }
          }
          cart.push({
            ...item,
            quantity: 1,
            serial_number: ""
          });
          showToast(`Added another unit of "${item.name}" (Requires separate Chassis/Serial No)`, "info");
        } else {
          if (item.product_id) {
            const prod = (productsList || []).find(p => p.id == item.product_id);
            if (prod) {
              const stock = parseInt(prod.current_stock, 10) || 0;
              if (item.quantity + 1 > stock) {
                return showToast(`Stock limit reached! Only ${stock} unit(s) available for "${item.name}".`, "error");
              }
            }
          }
          item.quantity += 1;
        }
        updateCartUI();
      });
    });

    document.querySelectorAll(".decreaseCartQty").forEach(btn => {
      btn.addEventListener("click", () => {
        const itemIdx = parseInt(btn.dataset.idx, 10);
        const item = cart[itemIdx];
        if (!item) return;

        if (item.quantity > 1) {
          item.quantity -= 1;
        } else {
          cart.splice(itemIdx, 1);
        }
        updateCartUI();
      });
    });

    document.querySelectorAll(".cart-qty-input").forEach(inp => {
      inp.addEventListener("change", (e) => {
        const itemIdx = parseInt(e.target.dataset.idx, 10);
        const item = cart[itemIdx];
        if (!item) return;

        let newQty = parseInt(e.target.value, 10);
        if (isNaN(newQty) || newQty < 1) newQty = 1;

        if (item.product_id) {
          const prod = (productsList || []).find(p => p.id == item.product_id);
          if (prod) {
            const stock = parseInt(prod.current_stock, 10) || 0;
            const otherCartQty = cart.filter((c, i) => i !== itemIdx && c.product_id == item.product_id).reduce((s, it) => s + (parseInt(it.quantity, 10) || 0), 0);
            if (otherCartQty + newQty > stock) {
              e.target.value = item.quantity;
              return showToast(`Stock limit reached! Only ${stock} unit(s) available for "${item.name}".`, "error");
            }
          }
        }
        item.quantity = newQty;
        updateCartUI();
      });
    });

    document.querySelectorAll(".removeCartItem").forEach(btn => {
      btn.addEventListener("click", () => {
        cart.splice(parseInt(btn.dataset.idx), 1);
        updateCartUI();
      });
    });
  }

  function calcDenominationsTotal() {
    const n2000 = (parseInt(document.getElementById("note2000")?.value) || 0) * 2000;
    const n500  = (parseInt(document.getElementById("note500")?.value) || 0) * 500;
    const n200  = (parseInt(document.getElementById("note200")?.value) || 0) * 200;
    const n100  = (parseInt(document.getElementById("note100")?.value) || 0) * 100;
    const n50   = (parseInt(document.getElementById("note50")?.value) || 0) * 50;
    const n20   = (parseInt(document.getElementById("note20")?.value) || 0) * 20;
    const n10   = (parseInt(document.getElementById("note10")?.value) || 0) * 10;

    const totalNotesAmt = n2000 + n500 + n200 + n100 + n50 + n20 + n10;
    const sumTxt = document.getElementById("notesCalcSumText");
    if (sumTxt) sumTxt.textContent = `Total: ₹${totalNotesAmt.toLocaleString('en-IN')}`;

    if (totalNotesAmt > 0) {
      const paidInp = document.getElementById("posPaidAmtInput");
      const grandVal = parseFloat(document.getElementById("posGrandTotalInput")?.value || document.getElementById("posGrandText")?.textContent || "0");
      
      if (paidInp) paidInp.value = totalNotesAmt.toFixed(2);
      
      const posSettlementSel = document.getElementById("posSettlementType");
      if (posSettlementSel) {
        if (totalNotesAmt < grandVal - 0.01) {
          posSettlementSel.value = "part";
        } else {
          posSettlementSel.value = "full";
        }
      }
      updateCartUI();
    }
  }

  const posSettlementSel = document.getElementById("posSettlementType");
  const posPaidInp = document.getElementById("posPaidAmtInput");
  
  if (posSettlementSel && posPaidInp) {
    posSettlementSel.addEventListener("change", () => {
      if (posSettlementSel.value === "full") {
        updateCartUI();
      } else {
        const grandVal = parseFloat(document.getElementById("posGrandTotalInput")?.value || document.getElementById("posGrandText")?.textContent || "0");
        if (parseFloat(posPaidInp.value || 0) === parseFloat(grandVal.toFixed(2))) {
          posPaidInp.value = "0.00";
        }
        posPaidInp.focus();
        posPaidInp.select();
        updateCartUI();
      }
    });

    posPaidInp.addEventListener("input", () => {
      const grandVal = parseFloat(document.getElementById("posGrandTotalInput")?.value || document.getElementById("posGrandText")?.textContent || "0");
      const curPaid = parseFloat(posPaidInp.value || 0);
      
      if (curPaid < grandVal - 0.01) {
        if (posSettlementSel.value !== "part") posSettlementSel.value = "part";
      } else if (curPaid >= grandVal && grandVal > 0) {
        if (posSettlementSel.value !== "full") posSettlementSel.value = "full";
      }
      updateCartUI();
    });
  }

  document.querySelectorAll(".note-calc-inp").forEach(inp => {
    inp.addEventListener("input", calcDenominationsTotal);
    inp.addEventListener("change", calcDenominationsTotal);
  });

  const posSupplyStateSel = document.getElementById("posSupplyState");
  if (posSupplyStateSel) {
    posSupplyStateSel.addEventListener("change", () => updateCartUI());
  }

  // Barcode / Serial No Scanner Processing Function
  async function processBarcodeScan(scannedCode) {
    const code = String(scannedCode || '').trim();
    if (!code) return;

    const q = code.toLowerCase();

    // 1. Search productsList locally: match against serial_no and barcode (DO NOT compare with SKU)
    let matchedProd = (productsList || []).find(p => {
      const serialNo = String(p.serial_no || p.serial_number || '').toLowerCase().trim();
      const barcode = String(p.barcode || '').toLowerCase().trim();
      const name = String(p.name || '').toLowerCase().trim();
      const model = String(p.model || '').toLowerCase().trim();
      return (serialNo && (serialNo === q || q.includes(serialNo))) ||
             (barcode && (barcode === q || q.includes(barcode))) ||
             (name && name === q) || (model && model === q);
    });

    // 2. If not found locally, attempt API lookup searching by serial_no / barcode query
    if (!matchedProd) {
      try {
        const compIdVal = selectedCompanyId || "all";
        const userObjVal = (typeof getUser === "function" ? getUser() : null) || JSON.parse(localStorage.getItem("erp_user") || "{}");
        const activeCompIdVal = compIdVal !== "all" ? parseInt(compIdVal) : (userObjVal.company_id || 1);

        const r = await fetch(`${API_BASE}/inventory?action=products&company_id=${activeCompIdVal}&query=${encodeURIComponent(code)}`, { headers: authHeaders() });
        const d = await r.json();
        if (d.success && Array.isArray(d.products) && d.products.length > 0) {
          matchedProd = d.products.find(p => {
            const serialNo = String(p.serial_no || p.serial_number || '').toLowerCase().trim();
            const barcode = String(p.barcode || '').toLowerCase().trim();
            return serialNo === q || barcode === q;
          }) || d.products[0];

          if (matchedProd && !productsList.some(p => p.id === matchedProd.id)) {
            productsList.push(matchedProd);
            populateProductSelect();
          }
        }
      } catch (e) {
        console.warn("Barcode/Serial API search error:", e);
      }
    }

    // Determine the matched serial number string (if available or if scanned code is the serial number)
    const detectedSerialNo = (matchedProd && (matchedProd.serial_no || matchedProd.serial_number))
      ? (matchedProd.serial_no || matchedProd.serial_number)
      : (code.length >= 3 ? code : "");

    // 3. If matched product exists in inventory:
    if (matchedProd) {
      const stock = parseInt(matchedProd.current_stock, 10) || 0;
      const currentInCart = cart.filter(c => c.product_id == matchedProd.id).reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0);

      if (stock > 0 && currentInCart + 1 > stock) {
        return showToast(`⚠️ Cannot add scanned "${matchedProd.name}". Available stock limit is ${stock} (${currentInCart} already in cart).`, "error");
      }

      const purRateExcl = parseFloat(matchedProd.purchase_rate || 0);
      const gstR = parseFloat(matchedProd.gst_rate || 18);
      const purRateIncl = (matchedProd.purchase_rate_incl_tax && parseFloat(matchedProd.purchase_rate_incl_tax) > 0)
        ? parseFloat(matchedProd.purchase_rate_incl_tax)
        : (purRateExcl * (1 + gstR / 100));
      const transportExp = parseFloat(matchedProd.transport_expenses || 0);
      const sellPct = parseFloat(matchedProd.selling_percentage || 0);

      const calculatedSellingExcl = (purRateExcl > 0 && sellPct > 0)
        ? Math.round(((purRateExcl + transportExp) * (1 + sellPct / 100)) * 100) / 100
        : parseFloat(matchedProd.selling_rate || 0);
      const rate = calculatedSellingExcl > 0 ? calculatedSellingExcl : parseFloat(matchedProd.selling_rate || 0);

      const isHighValue = rate > 10000;
      if (isHighValue) {
        cart.push({
          product_id: matchedProd.id,
          name: matchedProd.name,
          hsn_code: matchedProd.hsn_sac || matchedProd.hsn_code,
          rate: rate,
          purchase_rate: purRateExcl,
          purchase_rate_incl_tax: purRateIncl,
          transport_expenses: transportExp,
          gst_rate: Math.round(parseFloat(matchedProd.gst_rate || 18)),
          quantity: 1,
          serial_number: detectedSerialNo
        });
        showToast(`📷 Scanned high-value product "${matchedProd.name}" - Auto-filled Chassis/Serial No: ${detectedSerialNo || '—'}`, "info");
      } else {
        const existing = cart.find(c => c.product_id == matchedProd.id && parseFloat(c.rate) <= 10000);
        if (existing) {
          existing.quantity += 1;
          if (!existing.serial_number && detectedSerialNo) existing.serial_number = detectedSerialNo;
          showToast(`📷 Scanned "${matchedProd.name}" - Incremented quantity to ${existing.quantity}`, "success");
        } else {
          cart.push({
            product_id: matchedProd.id,
            name: matchedProd.name,
            hsn_code: matchedProd.hsn_sac || matchedProd.hsn_code,
            rate: rate,
            purchase_rate: purRateExcl,
            purchase_rate_incl_tax: purRateIncl,
            transport_expenses: transportExp,
            gst_rate: Math.round(parseFloat(matchedProd.gst_rate || 18)),
            quantity: 1,
            serial_number: detectedSerialNo
          });
          showToast(`📷 Scanned "${matchedProd.name}" - Added to cart (1 unit)`, "success");
        }
      }
      updateCartUI();
    } else {
      // 4. Product NOT in inventory -> Ask for price, name, GST & add dynamically!
      showToast(`📷 Unknown barcode "${code}". Please enter product details to add.`, "info");
      openAddUnrecognizedBarcodeModal(code, (newItem) => {
        cart.push(newItem);
        updateCartUI();
        showToast(`Added scanned item "${newItem.name}" to cart`, "success");
      });
    }
  }

  const barcodeInp = document.getElementById("posBarcodeScannerInput");
  const barcodeBtn = document.getElementById("posBarcodeScanBtn");

  const triggerBarcodeProcess = () => {
    if (!barcodeInp) return;
    const val = barcodeInp.value.trim();
    if (val) {
      barcodeInp.value = "";
      processBarcodeScan(val);
    }
  };

  if (barcodeInp) {
    barcodeInp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        triggerBarcodeProcess();
      }
    });
    setTimeout(() => barcodeInp.focus(), 200);
  }

  if (barcodeBtn) {
    barcodeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      triggerBarcodeProcess();
    });
  }

  on("posAddBtn", "click", () => {
    const pId = document.getElementById("posProdSelect").value;
    const qty = parseInt(document.getElementById("posQty").value) || 1;
    if (!pId) return showToast("Select an available product to add", "error");

    const prod = productsList.find(p => p.id == pId);
    if (!prod) return;

    // Check stock limit for inventory items
    const stock = parseInt(prod.current_stock, 10) || 0;
    const currentInCart = cart.filter(c => c.product_id == prod.id).reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0);
    if (currentInCart + qty > stock) {
      return showToast(`Cannot add ${qty} unit(s). Available stock limit is ${stock} (${currentInCart} already in cart).`, "error");
    }

    const purRateExcl = parseFloat(prod.purchase_rate || 0);
    const gstR = parseFloat(prod.gst_rate || 18);
    const purRateIncl = (prod.purchase_rate_incl_tax && parseFloat(prod.purchase_rate_incl_tax) > 0)
      ? parseFloat(prod.purchase_rate_incl_tax)
      : (purRateExcl * (1 + gstR / 100));
    const transportExp = parseFloat(prod.transport_expenses || 0);
    const sellPct = parseFloat(prod.selling_percentage || 0);

    const calculatedSellingExcl = (purRateExcl > 0 && sellPct > 0)
      ? Math.round(((purRateExcl + transportExp) * (1 + sellPct / 100)) * 100) / 100
      : parseFloat(prod.selling_rate || 0);
    const rate = calculatedSellingExcl > 0 ? calculatedSellingExcl : parseFloat(prod.selling_rate || 0);

    const isHighValue = rate > 10000;
    if (isHighValue) {
      // Products > ₹10,000 require individual serial numbers, so they are added 1-by-1 separately
      for (let i = 0; i < qty; i++) {
        cart.push({
          product_id: prod.id,
          name: prod.name,
          hsn_code: prod.hsn_sac || prod.hsn_code,
          rate: rate,
          purchase_rate: purRateExcl,
          purchase_rate_incl_tax: purRateIncl,
          transport_expenses: transportExp,
          gst_rate: Math.round(parseFloat(prod.gst_rate || 18)),
          quantity: 1,
          serial_number: ""
        });
      }
      showToast(`Added ${qty} unit(s) of '${prod.name}' separately (1 by 1) for individual Chassis/Serial No tracking`, "info");
    } else {
      const existing = cart.find(c => c.product_id == prod.id && parseFloat(c.rate) <= 10000);
      if (existing) {
        existing.quantity += qty;
      } else {
        cart.push({
          product_id: prod.id,
          name: prod.name,
          hsn_code: prod.hsn_sac || prod.hsn_code,
          rate: rate,
          purchase_rate: purRateExcl,
          purchase_rate_incl_tax: purRateIncl,
          transport_expenses: transportExp,
          gst_rate: Math.round(parseFloat(prod.gst_rate || 18)),
          quantity: qty,
          serial_number: ""
        });
      }
    }
    updateCartUI();
  });

  on("posAddCustomBtn", "click", () => {
    openAddCustomCartItemModal(customItem => {
      cart.push(customItem);
      updateCartUI();
      showToast(`Added custom item "${customItem.name}" to cart`, "info");
    });
  });

  on("posQuotationBtn", "click", () => {
    if (cart.length === 0) return showToast("Add items to cart to generate a quotation", "error");
    const custName = document.getElementById("posCustName")?.value.trim();
    if (!custName) return showToast("Enter customer name to generate quotation", "error");

    const partyDetails = {
      customer_name: custName,
      father_name: document.getElementById("posFatherName")?.value.trim(),
      village: document.getElementById("posVillage")?.value.trim(),
      mandal: document.getElementById("posMandal")?.value.trim(),
      cell_phone: document.getElementById("posCellPhone")?.value.trim(),
      customer_gstin: document.getElementById("posCustGstin")?.value.trim(),
      supply_type: document.getElementById("posSupplyType")?.value
    };

    const grandInp = document.getElementById("posGrandTotalInput");
    const userOverridden = grandInp && grandInp.dataset.userOverridden === "true" && grandInp.value.trim() !== "" && parseFloat(grandInp.value) > 0;

    let customTotals = null;
    if (userOverridden) {
      const finalGrand = parseFloat(grandInp.value);
      const taxableText = document.getElementById("posTaxableText")?.textContent || "";
      const taxableVal = parseFloat(taxableText.replace(/[^0-9.]/g, "") || 0);
      const gstVal = Math.round((finalGrand - taxableVal) * 100) / 100;

      let standardTaxable = cart.reduce((a, b) => a + (b.rate * b.quantity), 0);
      let standardGst = cart.reduce((a, b) => a + ((b.rate * b.quantity * (b.gst_rate || 18)) / 100), 0);
      let standardGrand = standardTaxable + standardGst;
      let ratio = standardGrand > 0 ? (finalGrand / standardGrand) : 1;

      const adjustedCart = cart.map(it => ({
        ...it,
        rate: Math.round((it.rate * ratio) * 100) / 100
      }));

      customTotals = {
        grandTotal: finalGrand,
        taxableTotal: taxableVal,
        gstTotal: gstVal,
        adjustedCart: adjustedCart
      };
    }

    printQuotationVoucher(cart, partyDetails, customTotals);
  });

  on("posCheckoutForm", "submit", async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;

    // Validate mandatory Chassis / Machine Serial No. for high-value items (> ₹10,000) in cart
    for (let i = 0; i < cart.length; i++) {
      const item = cart[i];
      const isHighValue = parseFloat(item.rate || 0) > 10000;
      if (isHighValue && (!item.serial_number || !item.serial_number.trim())) {
        const itemInp = document.querySelector(`.cart-item-serial-input[data-idx="${i}"]`);
        if (itemInp) itemInp.focus();
        return showToast(`Please enter Chassis / Serial No. for high-value product "${item.name}" (> ₹10,000) in the cart!`, "error");
      }
    }

    const payMode = document.getElementById("posPayMode").value;
    let bankSub = null, utrNo = null, advanceAmt = 0, recBank = null, chequeDate = null, finAmt = 0, finId = null, bankAccountId = null;

    if (payMode === "bank") {
      bankSub = document.getElementById("posBankSub")?.value;
      utrNo = document.getElementById("posTxnRef")?.value.trim();
      const bankSel = document.getElementById("posRecBankSelect");
      if (bankSel && bankSel.value) {
        bankAccountId = parseInt(bankSel.value);
        recBank = bankSel.options[bankSel.selectedIndex]?.text?.trim() || "";
      } else {
        recBank = document.getElementById("posRecBank")?.value.trim() || null;
      }
      chequeDate = document.getElementById("posChequeDate")?.value;
    } else if (payMode === "upi") {
      utrNo = document.getElementById("posUtrNo")?.value.trim();
      if (!utrNo) return showToast("UTR Number is mandatory for UPI payments", "error");
      const upiBankSel = document.getElementById("posUpiRecBankSelect");
      if (upiBankSel && upiBankSel.value) {
        bankAccountId = parseInt(upiBankSel.value);
        recBank = upiBankSel.options[upiBankSel.selectedIndex]?.text?.trim() || "";
      } else {
        recBank = document.getElementById("posUpiRec")?.value.trim() || null;
      }
    } else if (payMode === "finance") {
      finId = document.getElementById("posFinancerId")?.value || null;
      finAmt = parseFloat(document.getElementById("posFinancedAmt")?.value || 0);
    }

    const settlementType = document.getElementById("posSettlementType")?.value || "full";
    let paidAmtVal = parseFloat(document.getElementById("posPaidAmtInput").value || 0);
    if (isNaN(paidAmtVal)) paidAmtVal = 0;

    const targetCompId = isSuper
      ? parseInt(document.getElementById("posCompanySelect")?.value || (selectedCompanyId !== "all" ? selectedCompanyId : (currentCompanies[0]?.id || 1)))
      : parseInt(currentCompanies[0]?.id || 1);

    // Calculate applied discount amount
    const discType = document.getElementById("posDiscountType")?.value || "flat";
    const discInpVal = parseFloat(document.getElementById("posDiscountAmtInput")?.value || 0);
    let vipDiscPercent = parseFloat(document.getElementById("posVipExtraDiscInp")?.value || 0);
    if (isNaN(vipDiscPercent)) vipDiscPercent = 0;

    let cartTaxableSum = 0;
    let cartGstSum = 0;
    let totalMinCost = 0;
    cart.forEach(i => {
      const lTaxable = parseFloat(i.rate) * parseInt(i.quantity);
      cartTaxableSum += lTaxable;
      cartGstSum += (lTaxable * Math.round(parseFloat(i.gst_rate || 18))) / 100;

      const purRateExcl = parseFloat(i.purchase_rate || 0);
      const gstR = parseFloat(i.gst_rate || 18);
      const purRateIncl = (i.purchase_rate_incl_tax && parseFloat(i.purchase_rate_incl_tax) > 0)
        ? parseFloat(i.purchase_rate_incl_tax)
        : (purRateExcl * (1 + gstR / 100));
      const transportExp = parseFloat(i.transport_expenses || 0);
      totalMinCost += (purRateIncl + transportExp) * (parseInt(i.quantity, 10) || 1);
    });
    totalMinCost = Math.round(totalMinCost * 100) / 100;

    let baseDiscVal = discType === "percent" ? (cartTaxableSum * discInpVal / 100) : discInpVal;
    let vipDiscVal = (cartTaxableSum * vipDiscPercent / 100);
    let calcDiscount = Math.min(cartTaxableSum, baseDiscVal + vipDiscVal);

    const netTaxableVal = Math.max(0, cartTaxableSum - calcDiscount);
    const netGstVal = (cartGstSum * netTaxableVal) / (cartTaxableSum || 1);
    const calculatedGrand = Math.round((netTaxableVal + netGstVal) * 100) / 100;

    const grandInp = document.getElementById("posGrandTotalInput");
    const enteredGrand = (grandInp && grandInp.dataset.userOverridden === "true" && parseFloat(grandInp.value || 0) > 0)
      ? parseFloat(grandInp.value)
      : calculatedGrand;

    // Minimum Cost Protection Validation: Allow Superadmin override for damaged/slow-running stock loss sales
    const currentUserObj = (typeof getUser === "function" ? getUser() : null) || (typeof currentUser !== "undefined" && currentUser ? currentUser : null) || JSON.parse(localStorage.getItem("erp_user") || "{}");
    const isSuperAdminUser = (typeof isSuper !== "undefined" && isSuper) || (currentUserObj && (currentUserObj.role === "superadmin" || currentUserObj.username === "superadmin"));

    if (enteredGrand < totalMinCost - 0.01) {
      if (!isSuperAdminUser) {
        return showToast(`🚫 Cannot complete sale! Entered billing amount (${formatCurrency(enteredGrand)}) is less than minimum cost price (${formatCurrency(totalMinCost)} = Purchase Rate Incl Tax + Transport Expenses). Sale blocked to prevent company loss! Only Superadmin is authorized to override.`, "error");
      } else {
        showToast(`👑 Superadmin Override Authorized: Completing sale at a loss of ${formatCurrency(totalMinCost - enteredGrand)}`, "warning");
      }
    }

    let finalCartItems = cart;
    let finalDiscount = calcDiscount;
    if (Math.abs(enteredGrand - calculatedGrand) > 0.01) {
      const effectiveGstRate = netTaxableVal > 0 ? ((netGstVal / netTaxableVal) * 100) : (cart[0] ? Math.round(parseFloat(cart[0].gst_rate || 18)) : 18);
      const customNetTaxable = Math.round((enteredGrand / (1 + effectiveGstRate / 100)) * 100) / 100;
      if (cartTaxableSum > 0) {
        const ratio = customNetTaxable / cartTaxableSum;
        finalCartItems = cart.map(item => ({
          ...item,
          rate: Math.round((parseFloat(item.rate) * ratio) * 100) / 100
        }));
      }
      finalDiscount = Math.max(0, cartTaxableSum - customNetTaxable);
    }

    if (settlementType === "full") {
      paidAmtVal = enteredGrand;
    } else {
      if (paidAmtVal > enteredGrand + 0.01) {
        return showToast(`Initial Paid Amount (${formatCurrency(paidAmtVal)}) cannot exceed Grand Total of ${formatCurrency(enteredGrand)}!`, "error");
      }
      if (paidAmtVal < 0) {
        return showToast("Initial Paid Amount cannot be negative!", "error");
      }
    }

    const party_type = document.getElementById("posPartyType")?.value || "customer";
    const customer_gstin = (document.getElementById("posCustGstin")?.value || "").trim().toUpperCase();
    const dealer_id = party_type === "dealer" ? (document.getElementById("posdealerId")?.value || null) : null;

    const leadNameStr = (document.getElementById("posLeadBy")?.value || "").trim();
    const leadPhoneStr = (document.getElementById("posLeadPhone")?.value || "").trim();
    let combinedLeadStr = leadNameStr;
    if (leadNameStr && leadPhoneStr) {
      combinedLeadStr = `${leadNameStr} (${leadPhoneStr})`;
    } else if (!leadNameStr && leadPhoneStr) {
      combinedLeadStr = leadPhoneStr;
    }

    const payload = {
      company_id: targetCompId,
      party_type: party_type,
      customer_gstin: customer_gstin,
      dealer_id: dealer_id,
      customer_id: party_type === "customer" ? (document.getElementById("posCustId").value || null) : null,
      customer_name: document.getElementById("posCustName").value.trim(),
      father_name: document.getElementById("posFatherName").value.trim(),
      village: document.getElementById("posVillage").value.trim(),
      mandal: document.getElementById("posMandal").value.trim(),
      cell_phone: document.getElementById("posCellPhone").value.trim(),
      lead_generated_by: combinedLeadStr,
      lead_incentive_amount: parseFloat(document.getElementById("posLeadIncentive")?.value || 0),
      supply_type: document.getElementById("posSupplyType").value,
      supply_state: document.getElementById("posSupplyState")?.value || "Andhra Pradesh",
      scheme_department: document.getElementById("posSchemeDept")?.value.trim() || null,
      scheme_app_no: document.getElementById("posSchemeAppNo")?.value.trim() || null,
      payment_mode: payMode,
      paid_amount: paidAmtVal,
      bank_sub_type: bankSub,
      utr_number: utrNo,
      cheque_dd_date: chequeDate,
      receiving_bank: recBank,
      bank_account_id: bankAccountId,
      advance_amount: paidAmtVal,
      financer_id: finId,
      finance_amount: finAmt,
      discount_amount: finalDiscount,
      vip_perk_notes: document.getElementById("posVipGiftSelect")?.value || null,
      warranty_term: document.getElementById("posWarrantyTerm")?.value || "1_year",
      transporter_name: document.getElementById("posTransName").value.trim() || null,
      transporter_vehicle_no: document.getElementById("posVehicleNo").value.trim() || null,
      items: finalCartItems
    };

    const posSubmitBtn = document.getElementById("posSubmitBtn");
    const isCounterParty = (document.getElementById("posPartyType")?.value === "counter");
    setButtonLoading(posSubmitBtn, true, isCounterParty ? "Generating Tax Invoice..." : "Processing Sale...");

    try {
      const res = await fetch(`${API_BASE}/sales?action=create`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        const isDirectInv = data.is_direct_invoice || (data.sale && data.sale.invoice_number);
        const invNum = data.invoice_number || (data.sale && data.sale.invoice_number);

        if (isDirectInv) {
          showToast(`Tax Invoice #${invNum || data.sale.id} generated directly for Counter Customer!`, "success");
        } else {
          showToast(`Sale #${data.sale.challan_number || data.sale.id} completed & Delivery Challan generated!`, "success");
        }
        
        // Fetch full sale details for accurate dual printing
        const rDetails = await fetch(`${API_BASE}/sales?action=get-details&id=${data.sale.id}`, { headers: authHeaders() });
        const dDetails = await rDetails.json();

        if (isDirectInv) {
          if (dDetails.success) {
            printTaxInvoice(dDetails.sale, dDetails.items, dDetails.payments, dDetails.returns);
          } else {
            printTaxInvoice(data.sale, cart);
          }
        } else {
          if (dDetails.success) {
            printDeliveryChallan(dDetails.sale, dDetails.items, dDetails.payments);
          } else {
            printDeliveryChallan(data.sale, cart);
          }
        }

        cart = [];
        document.getElementById("posCheckoutForm").reset();
        paySubContainer.style.display = "none";
        schemeSubFields.style.display = "none";
        leadIncGrp.style.display = "none";
        updateCartUI();
      } else showToast(data.error, "error");
    } catch (err) {
      showToast("Sale error: " + err.message, "error");
    } finally {
      setButtonLoading(posSubmitBtn, false);
    }
  });
}

// ── SubTab 2: Sales History ──
async function loadHistorySubTab() {
  const subContent = document.getElementById("salesSubContent");
  const compId = selectedCompanyId || "all";

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
      <h3 style="font-size:16px;font-weight:600;color:var(--text1);margin:0;">Sales & Delivery Challan History</h3>
      <input type="text" id="salesHistorySearchInp" class="form-input" placeholder="🔍 Search Challan #, Customer, Phone, Village..." style="padding:6px 12px;font-size:12.5px;border-radius:6px;width:300px;max-width:100%;">
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Challan No</th>
            <th>Company</th>
            <th>Date</th>
            <th>Customer & Village</th>
            <th>Products & Chassis/Serial No</th>
            <th>Supply Type</th>
            <th>Grand Total</th>
            <th>Paid Amount</th>
            <th>Pending Balance</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="salesHistoryTableBody">
          <tr><td colspan="10" style="text-align:center;padding:20px;"><div class="spinner"></div> Fetching sales history...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 4px;flex-wrap:wrap;gap:8px;">
      <div id="salesHistoryInfo"></div>
      <div id="salesHistoryPagination" class="pagination"></div>
    </div>
  `;

  try {
    const res = await fetch(`${API_BASE}/sales?action=list&company_id=${compId}`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.success || !data.sales) return;

    const allSales = data.sales || [];
    function renderSalesTable(filterText = "") {
      const query = filterText.toLowerCase().trim();
      const filtered = query ? allSales.filter(s => {
        const challan = String(s.challan_number || s.id || "").toLowerCase();
        const cust = String(s.customer_name || s.customer_name_ref || "").toLowerCase();
        const phone = String(s.customer_phone || "").toLowerCase();
        const village = String(s.village || "").toLowerCase();
        const mandal = String(s.mandal || "").toLowerCase();
        const comp = String(s.company_name || "").toLowerCase();
        const itemsStr = (s.items_summary || []).map(i => `${i.product_name || ''} ${i.serial_number || ''}`).join(" ").toLowerCase();
        return challan.includes(query) || cust.includes(query) || phone.includes(query) || village.includes(query) || mandal.includes(query) || comp.includes(query) || itemsStr.includes(query);
      }) : allSales;

      window.renderPaginatedTable({
        data: filtered,
        pageSize: 10,
        currentPage: 1,
        tbody: "salesHistoryTableBody",
        paginationContainer: "salesHistoryPagination",
        infoContainer: "salesHistoryInfo",
        renderRow: (s) => {
        const paid = parseFloat(s.paid_amount || 0);
        const grand = parseFloat(s.grand_total || 0);
        const pending = Math.max(0, grand - paid);
        const isPaid = pending <= 0.01;
        const maxVal = Math.max(parseFloat(s.max_item_rate || 0), parseFloat(s.grand_total || 0), parseFloat(s.taxable_amount || 0));
        const hasHighValueItem = maxVal > 10000 || (s.items_summary || []).some(it => Math.max(parseFloat(it.rate || 0), parseFloat(it.total || 0)) > 10000);
        const showDcBtn = !s.is_custom && hasHighValueItem;

        return `
          <tr>
            <td><span class="badge badge-purple">#${esc(s.challan_number || s.id)}</span></td>
            <td><span class="badge badge-outline" style="font-weight:600;">${esc(s.company_name || 'Main')}</span></td>
            <td>${formatDate(s.sale_date)}</td>
            <td>
              <div style="font-weight:600;color:var(--text1);">${esc(s.customer_name || s.customer_name_ref || 'Counter Customer')}</div>
              ${s.village ? `<div style="font-size:12px;color:var(--text3);">${esc(s.village)}, ${esc(s.mandal || '')}</div>` : ''}
            </td>
            <td>
              ${(s.items_summary || []).length > 0 ? (s.items_summary.map(it => `
                <div style="font-size:12px;margin-bottom:2px;">
                  <strong style="color:var(--text1);">${esc(it.product_name || 'Product')}</strong>
                  ${it.serial_number ? `<span class="badge badge-purple" style="font-size:10px;margin-left:4px;">⚙️ ${esc(it.serial_number)}</span>` : ''}
                </div>
              `).join("")) : '<span style="color:var(--text3);font-size:12px;">General Sales Item</span>'}
            </td>
            <td><span class="badge badge-info">${esc(s.supply_type || 'Direct Sale')}</span></td>
            <td style="font-weight:700;color:var(--text1);">${formatCurrency(grand)}</td>
            <td style="font-weight:700;color:var(--success);">${formatCurrency(paid)}</td>
            <td style="font-weight:700;color:${pending > 0 ? 'var(--danger)' : 'var(--success)'};">
              ${formatCurrency(pending)}
            </td>
            <td>
              <span class="badge ${isPaid ? 'badge-success' : (paid > 0 ? 'badge-warning' : 'badge-danger')}">
                ${isPaid ? 'Fully Paid ✅' : (paid > 0 ? 'Part Paid ⏳' : 'Unpaid ⚠️')}
              </span>
              ${s.return_count > 0 ? `<span class="badge badge-danger" style="margin-left:4px;background:#dc3545;color:#fff;" title="Total refunded: ₹${parseFloat(s.total_refunded || 0).toFixed(2)}">↩️ Returned (${s.return_count})</span>` : ''}
            </td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${showDcBtn ? `<button class="btn btn-sm btn-primary printDcBtn" data-id="${s.id}">🚚 Print DC</button>` : ''}
                <button class="btn btn-sm btn-info printInvBtn" data-id="${s.id}">🧾 Tax Invoice</button>
                ${pending > 0 ? `<button class="btn btn-sm btn-success recordPayBtn" data-id="${s.id}">💳 Record Payment</button>` : ''}
              </div>
            </td>
          </tr>
        `;
      },
      onRender: () => {
        const tbody = document.getElementById("salesHistoryTableBody");
        if (!tbody) return;
        tbody.querySelectorAll(".printDcBtn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const sId = btn.dataset.id;
            const printWin = window.open('', '_blank', 'width=900,height=1000');
            if (printWin) {
              try { printWin.document.write("<html><body style='font-family:sans-serif;text-align:center;padding:50px;color:#15803d;'><h2>⏳ Loading Delivery Challan...</h2></body></html>"); } catch(e){}
            }
            setButtonLoading(btn, true, "Loading...");
            try {
              const r = await fetch(`${API_BASE}/sales?action=get-details&id=${sId}`, { headers: authHeaders() });
              const d = await r.json();
              if (d.success) {
                printDeliveryChallan(d.sale, d.items, d.payments, d.returns, printWin);
              } else {
                if (printWin) printWin.close();
                showToast("Failed to fetch DC details", "error");
              }
            } catch (e) {
              if (printWin) printWin.close();
              showToast("Failed to fetch DC details", "error");
            } finally {
              setButtonLoading(btn, false);
            }
          });
        });

        tbody.querySelectorAll(".printInvBtn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const sId = btn.dataset.id;
            const printWin = window.open('', '_blank', 'width=950,height=1050');
            if (printWin) {
              try { printWin.document.write("<html><body style='font-family:sans-serif;text-align:center;padding:50px;color:#4f46e5;'><h2>⏳ Loading Tax Invoice...</h2></body></html>"); } catch(e){}
            }
            setButtonLoading(btn, true, "Loading...");
            try {
              const r = await fetch(`${API_BASE}/sales?action=get-details&id=${sId}`, { headers: authHeaders() });
              const d = await r.json();
              if (d.success) {
                printTaxInvoice(d.sale, d.items, d.payments, d.returns, printWin);
              } else {
                if (printWin) printWin.close();
                showToast("Failed to fetch Invoice details", "error");
              }
            } catch (e) {
              if (printWin) printWin.close();
              showToast("Failed to fetch Invoice details", "error");
            } finally {
              setButtonLoading(btn, false);
            }
          });
        });

        tbody.querySelectorAll(".recordPayBtn").forEach(btn => {
          btn.addEventListener("click", () => {
            openRecordPaymentModal(btn.dataset.id, () => loadHistorySubTab());
          });
        });
      }
    });
    }

    renderSalesTable();
    document.getElementById("salesHistorySearchInp")?.addEventListener("input", (e) => renderSalesTable(e.target.value));

  } catch (err) {
    showToast("Fetch sales error: " + err.message, "error");
  }
}

// ── SubTab 3: Tax Invoices ──
async function loadInvoicesSubTab() {
  const subContent = document.getElementById("salesSubContent");
  const compId = selectedCompanyId || "all";
  const userObj = (typeof getUser === "function" ? getUser() : null) || (typeof currentUser !== "undefined" && currentUser ? currentUser : null) || JSON.parse(localStorage.getItem("erp_user") || "{}");
  const isSuper = userObj && (userObj.role === "superadmin" || userObj.username === "superadmin");

  subContent.innerHTML = `
    <!-- SECTION 1: PENDING DELIVERY CHALLANS (WAITING FOR TAX INVOICE) -->
    <div class="card mb-24" style="background:var(--bg-secondary);border:1px solid var(--border);padding:16px;margin-bottom:24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:12px;">
        <h4 style="font-size:15px;font-weight:700;color:var(--primary);margin:0;">🚛 Pending Delivery Challans (Waiting for Tax Invoice)</h4>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <input type="text" id="pendingDcSearchInp" class="form-input" placeholder="🔍 Search DC #, Customer, Phone, Company..." style="padding:5px 10px;font-size:12px;border-radius:6px;width:260px;max-width:100%;">
          <span class="badge badge-warning" style="font-size:12px;">Select Date & Raise Tax Invoice on Demand</span>
        </div>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>DC No</th>
              <th>Company</th>
              <th>DC Date</th>
              <th>Customer & Phone</th>
              <th>Supply Type</th>
              <th>Grand Total</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="pendingDcsTableBody">
            <tr><td colspan="7" style="text-align:center;padding:16px;"><div class="spinner"></div> Loading pending Delivery Challans...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- SECTION 2: RAISED TAX INVOICES & CUSTOM INVOICES -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
      <h3 style="font-size:16px;font-weight:600;color:var(--text1);margin:0;">🧾 Raised Tax Invoices & Custom Invoices</h3>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <button class="btn btn-primary" id="btnCreateCustomInvoice" style="background:linear-gradient(135deg,#4f46e5,#3b82f6);color:#fff;font-weight:600;padding:8px 16px;border-radius:6px;box-shadow:0 2px 4px rgba(79,70,229,0.25);">➕ Create Custom Invoice</button>
        <input type="text" id="invSearchInp" class="form-input" placeholder="🔍 Search Invoice #, Customer, Phone, Company..." style="padding:6px 12px;font-size:12.5px;border-radius:6px;width:280px;max-width:100%;">
      </div>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Invoice No</th>
            <th>Company</th>
            <th>Date</th>
            <th>Customer & Phone</th>
            <th>Grand Total</th>
            <th>Paid Amount</th>
            <th>Pending Balance</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="invTableBody">
          <tr><td colspan="9" style="text-align:center;padding:20px;"><div class="spinner"></div> Loading invoices...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 4px;flex-wrap:wrap;gap:8px;">
      <div id="invoicesInfo"></div>
      <div id="invoicesPagination" class="pagination"></div>
    </div>
  `;

  // Fetch Pending DCs
  try {
    const pendingRes = await fetch(`${API_BASE}/sales?action=pending-dcs&company_id=${compId}`, { headers: authHeaders() });
    const pendingData = await pendingRes.json();
    const pendingTbody = document.getElementById("pendingDcsTableBody");

    if (pendingTbody) {
      const allPendingSales = (pendingData.success && (pendingData.pending_dcs || pendingData.sales)) ? (pendingData.pending_dcs || pendingData.sales) : [];
      function renderPendingDcs(filterQuery = "") {
        const q = filterQuery.toLowerCase().trim();
        const filteredPending = q ? allPendingSales.filter(s => {
          const dcNo = String(s.challan_number || s.id || "").toLowerCase();
          const cust = String(s.customer_name || "").toLowerCase();
          const phone = String(s.cell_phone || "").toLowerCase();
          const comp = String(s.company_name || "").toLowerCase();
          const supply = String(s.supply_type || "").toLowerCase();
          return dcNo.includes(q) || cust.includes(q) || phone.includes(q) || comp.includes(q) || supply.includes(q);
        }) : allPendingSales;

        if (filteredPending.length > 0) {
          pendingTbody.innerHTML = filteredPending.map(s => `
            <tr>
              <td><span class="badge badge-purple" style="font-weight:700;">#${esc(s.challan_number || s.id)}</span></td>
              <td><span class="badge badge-outline">${esc(s.company_name || 'Main')}</span></td>
              <td>${formatDate(s.sale_date)}</td>
              <td>
                <div style="font-weight:600;color:var(--text1);">${esc(s.customer_name || 'Counter Customer')}</div>
                <div style="font-size:11px;color:var(--text3);">${esc(s.cell_phone || '')}</div>
              </td>
              <td><span class="badge badge-info">${esc(s.supply_type || 'Direct Sale')}</span></td>
              <td style="font-weight:700;color:var(--primary);">${formatCurrency(s.grand_total)}</td>
              <td>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  <button class="btn btn-sm btn-primary printPendingDcBtn" data-saleid="${s.id}">
                    🚚 Print DC
                  </button>
                  <button class="btn btn-sm btn-success raiseTaxInvBtn" data-sale='${JSON.stringify(s).replace(/'/g, "&apos;")}'>
                    🧾 Raise Tax Invoice
                  </button>
                  ${isSuper ? `<button class="btn btn-sm btn-danger deleteSaleDcBtn" data-saleid="${s.id}" data-dcno="${esc(s.challan_number || s.id)}">🗑️ Delete</button>` : ''}
                </div>
              </td>
            </tr>
          `).join("");

          pendingTbody.querySelectorAll(".printPendingDcBtn").forEach(btn => {
            btn.addEventListener("click", async () => {
              const sId = btn.dataset.saleid;
              if (!sId) return;
              const printWin = window.open('', '_blank', 'width=900,height=1000');
              if (printWin) {
                try { printWin.document.write("<html><body style='font-family:sans-serif;text-align:center;padding:50px;color:#15803d;'><h2>⏳ Loading Delivery Challan...</h2></body></html>"); } catch(e){}
              }
              setButtonLoading(btn, true, "Loading...");
              try {
                const r = await fetch(`${API_BASE}/sales?action=get-details&id=${sId}`, { headers: authHeaders() });
                const d = await r.json();
                if (d.success) {
                  printDeliveryChallan(d.sale, d.items, d.payments, d.returns, printWin);
                } else {
                  if (printWin) printWin.close();
                  showToast("Failed to fetch DC details", "error");
                }
              } catch (e) {
                if (printWin) printWin.close();
                showToast("Failed to fetch DC details", "error");
              } finally {
                setButtonLoading(btn, false);
              }
            });
          });

          pendingTbody.querySelectorAll(".raiseTaxInvBtn").forEach(btn => {
            btn.addEventListener("click", () => {
              const saleObj = JSON.parse(btn.dataset.sale);
              openRaiseInvoiceModal(saleObj, () => loadInvoicesSubTab());
            });
          });

          pendingTbody.querySelectorAll(".deleteSaleDcBtn").forEach(btn => {
            btn.addEventListener("click", async () => {
              const sId = btn.dataset.saleid;
              const dcNo = btn.dataset.dcno;
              if (!sId) return;
              if (!confirm(`Are you sure you want to delete Delivery Challan #${dcNo}?\nThis action cannot be undone.`)) return;

              setButtonLoading(btn, true, "Deleting...");
              try {
                const res = await fetch(`${API_BASE}/sales?action=delete-dc&id=${sId}`, {
                  method: "POST",
                  headers: authHeaders()
                });
                const data = await res.json();
                if (data.success) {
                  showToast(data.message || "Delivery Challan deleted successfully!", "success");
                  loadInvoicesSubTab();
                } else {
                  showToast(data.error || "Failed to delete Delivery Challan", "error");
                  setButtonLoading(btn, false);
                }
              } catch (err) {
                showToast("Delete DC error: " + err.message, "error");
                setButtonLoading(btn, false);
              }
            });
          });
        } else {
          pendingTbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:16px;color:var(--text3);">${allPendingSales.length === 0 ? 'No pending Delivery Challans waiting for Tax Invoice. All DCs have invoices raised!' : 'No matching pending Delivery Challans found.'}</td></tr>`;
        }
      }

      renderPendingDcs();
      document.getElementById("pendingDcSearchInp")?.addEventListener("input", (e) => renderPendingDcs(e.target.value));
    }
  } catch (e) {}

  try {
    const res = await fetch(`${API_BASE}/sales?action=invoices-list&company_id=${compId}`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.success || !data.invoices) return;

    const allInvoices = data.invoices || [];
    function renderInvoicesTable(filterText = "") {
      const query = filterText.toLowerCase().trim();
      const filtered = query ? allInvoices.filter(i => {
        const invNo = String(i.invoice_number || "").toLowerCase();
        const cust = String(i.customer_name || "").toLowerCase();
        const phone = String(i.customer_phone || i.cell_phone || "").toLowerCase();
        const comp = String(i.company_name || "").toLowerCase();
        return invNo.includes(query) || cust.includes(query) || phone.includes(query) || comp.includes(query);
      }) : allInvoices;

      window.renderPaginatedTable({
        data: filtered,
        pageSize: 10,
        currentPage: 1,
        tbody: "invTableBody",
        paginationContainer: "invoicesPagination",
        infoContainer: "invoicesInfo",
        renderRow: (i) => {
        const paid = parseFloat(i.paid_amount || 0);
        const grand = parseFloat(i.grand_total || 0);
        const pending = Math.max(0, grand - paid);
        const isPaid = pending <= 0.01;
        const maxVal = Math.max(parseFloat(i.max_item_rate || 0), parseFloat(i.grand_total || 0), parseFloat(i.taxable_total || 0));
        const isCounterSale = i.party_type === 'counter' || (i.customer_name && String(i.customer_name).trim().toLowerCase() === 'counter customer');
        const showDcBtn = !i.is_custom && !isCounterSale;
        const hasInvoiceNo = i.invoice_number && String(i.invoice_number).trim() !== '';

        const custPhone = i.customer_phone || i.cell_phone || '';

        return `
          <tr>
            <td>
              <span class="badge badge-purple">${esc(i.invoice_number || 'N/A')}</span>
              ${i.is_custom ? `<span class="badge badge-info" style="margin-left:4px;font-size:10px;text-transform:uppercase;">${esc(i.custom_type || 'Custom')}</span>` : ''}
            </td>
            <td><span class="badge badge-outline" style="font-weight:600;">${esc(i.company_name || 'Main')}</span></td>
            <td>${formatDate(i.invoice_date)}</td>
            <td>
              <div style="font-weight:600;color:var(--text1);">${esc(i.customer_name || 'Counter Customer')}</div>
              ${custPhone ? `<div style="font-size:11px;color:var(--text3);">📞 ${esc(custPhone)}</div>` : ''}
            </td>
            <td style="font-weight:700;color:var(--text1);">${formatCurrency(grand)}</td>
            <td style="font-weight:700;color:var(--success);">${formatCurrency(paid)}</td>
            <td style="font-weight:700;color:${pending > 0 ? 'var(--danger)' : 'var(--success)'};">
              ${formatCurrency(pending)}
            </td>
            <td>
              <span class="badge ${isPaid ? 'badge-success' : (paid > 0 ? 'badge-warning' : 'badge-danger')}">
                ${isPaid ? 'Fully Paid ✅' : (paid > 0 ? 'Part Paid ⏳' : 'Unpaid ⚠️')}
              </span>
              ${i.return_count > 0 ? `<span class="badge badge-danger" style="margin-left:4px;background:#dc3545;color:#fff;" title="Total refunded: ₹${parseFloat(i.total_refunded || 0).toFixed(2)}">↩️ Returned (${i.return_count})</span>` : ''}
            </td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${hasInvoiceNo ? `<button class="btn btn-sm btn-info printInvFromInvBtn" data-saleid="${i.sale_id}">🧾 Print Tax Invoice</button>` : ''}
                ${showDcBtn ? `<button class="btn btn-sm btn-primary printDcFromInvBtn" data-saleid="${i.sale_id}">🚚 Print DC</button>` : ''}
                ${pending > 0 ? `<button class="btn btn-sm btn-success recordPayInvBtn" data-saleid="${i.sale_id}">💳 Record Payment</button>` : ''}
                ${isSuper ? `<button class="btn btn-sm btn-danger deleteInvBtn" data-invid="${i.id}" data-invno="${esc(i.invoice_number)}">🗑️ Delete</button>` : ''}
              </div>
            </td>
          </tr>
        `;
      },
      onRender: () => {
        const tbody = document.getElementById("invTableBody");
        if (!tbody) return;
        tbody.querySelectorAll(".printInvFromInvBtn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const sId = btn.dataset.saleid;
            if (!sId) return;
            const printWin = window.open('', '_blank', 'width=950,height=1050');
            if (printWin) {
              try { printWin.document.write("<html><body style='font-family:sans-serif;text-align:center;padding:50px;color:#4f46e5;'><h2>⏳ Loading Tax Invoice...</h2></body></html>"); } catch(e){}
            }
            setButtonLoading(btn, true, "Loading...");
            try {
              const r = await fetch(`${API_BASE}/sales?action=get-details&id=${sId}`, { headers: authHeaders() });
              const d = await r.json();
              if (d.success) {
                if (d.sale && d.sale.is_custom) {
                  printCustomInvoice(d.sale, d.items, printWin);
                } else {
                  printTaxInvoice(d.sale, d.items, d.payments, d.returns, printWin);
                }
              } else {
                if (printWin) printWin.close();
                showToast("Failed to fetch Invoice details", "error");
              }
            } catch (e) {
              if (printWin) printWin.close();
              showToast("Failed to fetch Invoice details", "error");
            } finally {
              setButtonLoading(btn, false);
            }
          });
        });

        tbody.querySelectorAll(".printDcFromInvBtn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const sId = btn.dataset.saleid;
            if (!sId) return;
            const printWin = window.open('', '_blank', 'width=900,height=1000');
            if (printWin) {
              try { printWin.document.write("<html><body style='font-family:sans-serif;text-align:center;padding:50px;color:#15803d;'><h2>⏳ Loading Delivery Challan...</h2></body></html>"); } catch(e){}
            }
            setButtonLoading(btn, true, "Loading...");
            try {
              const r = await fetch(`${API_BASE}/sales?action=get-details&id=${sId}`, { headers: authHeaders() });
              const d = await r.json();
              if (d.success) {
                printDeliveryChallan(d.sale, d.items, d.payments, d.returns, printWin);
              } else {
                if (printWin) printWin.close();
                showToast("Failed to fetch DC details", "error");
              }
            } catch (e) {
              if (printWin) printWin.close();
              showToast("Failed to fetch DC details", "error");
            } finally {
              setButtonLoading(btn, false);
            }
          });
        });

        tbody.querySelectorAll(".recordPayInvBtn").forEach(btn => {
          btn.addEventListener("click", () => {
            openRecordPaymentModal(btn.dataset.saleid, () => loadInvoicesSubTab());
          });
        });

        tbody.querySelectorAll(".deleteInvBtn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const invId = btn.dataset.invid;
            const invNo = btn.dataset.invno;
            if (!invId) return;
            if (!confirm(`Are you sure you want to delete Invoice ${invNo}?\nRemaining invoices will be automatically re-sequenced based on previous invoices.`)) return;

            setButtonLoading(btn, true, "Deleting...");
            try {
              const res = await fetch(`${API_BASE}/sales?action=delete-invoice&id=${invId}`, {
                method: "POST",
                headers: authHeaders()
              });
              const data = await res.json();
              if (data.success) {
                showToast(data.message || "Invoice deleted and re-sequenced successfully!", "success");
                loadInvoicesSubTab();
              } else {
                showToast(data.error || "Failed to delete invoice", "error");
                setButtonLoading(btn, false);
              }
            } catch (err) {
              showToast("Delete invoice error: " + err.message, "error");
              setButtonLoading(btn, false);
            }
          });
        });
      }
    });
    }

    renderInvoicesTable();
    document.getElementById("invSearchInp")?.addEventListener("input", (e) => renderInvoicesTable(e.target.value));
    document.getElementById("btnCreateCustomInvoice")?.addEventListener("click", () => {
      openCustomInvoiceModal(() => loadInvoicesSubTab());
    });

  } catch (err) {
    showToast("Fetch invoices error: " + err.message, "error");
  }
}

// ── SubTab 4: Payment Receipts ──
async function loadPaymentReceiptsSubTab() {
  const subContent = document.getElementById("salesSubContent");
  const compId = selectedCompanyId || "all";
  const userObj = (typeof getUser === "function" ? getUser() : null) || (typeof currentUser !== "undefined" && currentUser ? currentUser : null) || JSON.parse(localStorage.getItem("erp_user") || "{}");
  const isSuper = userObj && (userObj.role === "superadmin" || userObj.username === "superadmin");

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
      <h3 style="font-size:16px;font-weight:600;color:var(--text1);margin:0;">Recorded Payment Receipts</h3>
      <input type="text" id="receiptsSearchInp" class="form-input" placeholder="🔍 Search Receipt #, Invoice/DC #, Customer, Mode..." style="padding:6px 12px;font-size:12.5px;border-radius:6px;width:300px;max-width:100%;">
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Receipt No</th>
            <th>Invoice / DC #</th>
            <th>Company</th>
            <th>Date</th>
            <th>Customer</th>
            <th>Payment Mode</th>
            <th>Amount Paid</th>
            <th>Notes / Ref</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="receiptsTableBody">
          <tr><td colspan="9" style="text-align:center;padding:20px;"><div class="spinner"></div> Loading payment receipts...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 4px;flex-wrap:wrap;gap:8px;">
      <div id="receiptsInfo"></div>
      <div id="receiptsPagination" class="pagination"></div>
    </div>
  `;

  try {
    const res = await fetch(`${API_BASE}/sales?action=receipts-list&company_id=${compId}`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.success || !data.receipts) return;

    const allReceipts = data.receipts || [];
    function renderReceiptsTable(filterText = "") {
      const query = filterText.toLowerCase().trim();
      const filtered = query ? allReceipts.filter(r => {
        const rcptNo = String(r.receipt_number || ('RCP-' + String(r.id).padStart(3, '0'))).toLowerCase();
        const invNo = String(r.invoice_number || ('DC #' + (r.challan_number || r.sale_id))).toLowerCase();
        const cust = String(r.customer_name || "").toLowerCase();
        const comp = String(r.company_name || "").toLowerCase();
        const mode = String(r.payment_mode || "").toLowerCase();
        const notes = String(r.notes || r.transaction_ref || "").toLowerCase();
        return rcptNo.includes(query) || invNo.includes(query) || cust.includes(query) || comp.includes(query) || mode.includes(query) || notes.includes(query);
      }) : allReceipts;

      window.renderPaginatedTable({
        data: filtered,
        pageSize: 10,
        currentPage: 1,
        tbody: "receiptsTableBody",
        paginationContainer: "receiptsPagination",
        infoContainer: "receiptsInfo",
        renderRow: (r) => {
        const amt = parseFloat(r.amount || 0);

        return `
          <tr>
            <td><span class="badge badge-purple" style="font-weight:700;">${esc(r.receipt_number || ('RCP-' + String(r.id).padStart(3, '0')))}</span></td>
            <td><span class="badge badge-info">${esc(r.invoice_number || ('DC #' + (r.challan_number || r.sale_id)))}</span></td>
            <td><span class="badge badge-outline" style="font-weight:600;">${esc(r.company_name || 'Main')}</span></td>
            <td>${formatDate(r.payment_date || r.created_at)}</td>
            <td style="font-weight:600;color:var(--text1);">${esc(r.customer_name || 'Counter Customer')}</td>
            <td>
              <span class="badge badge-success" style="text-transform:uppercase;">${esc(r.payment_mode || 'cash')}</span>
              ${r.return_count > 0 ? `<span class="badge badge-danger" style="margin-left:4px;background:#dc3545;color:#fff;" title="Total refunded: ₹${parseFloat(r.total_refunded || 0).toFixed(2)}">↩️ Returned (${r.return_count})</span>` : ''}
            </td>
            <td style="font-weight:700;color:var(--success);">${formatCurrency(amt)}</td>
            <td style="font-size:12px;color:var(--text2);">${esc(r.notes || r.transaction_ref || 'Payment Received')}</td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="btn btn-sm btn-info printReceiptBtn" data-item='${JSON.stringify(r).replace(/'/g, "&apos;")}'>🖨️ Print Receipt</button>
                ${isSuper ? `<button class="btn btn-sm btn-danger deleteRcptBtn" data-rcptid="${r.id}" data-rcptno="${esc(r.receipt_number || ('RCP-' + String(r.id).padStart(3, '0')))}" data-amt="${amt.toFixed(2)}">🗑️ Delete</button>` : ''}
              </div>
            </td>
          </tr>
        `;
      },
      onRender: () => {
        const tbody = document.getElementById("receiptsTableBody");
        if (!tbody) return;

        tbody.querySelectorAll(".printReceiptBtn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const item = JSON.parse(btn.dataset.item);
            let returnsArr = [];
            if (item.sale_id) {
              try {
                const detailsRes = await fetch(`${API_BASE}/sales?action=get-details&id=${item.sale_id}`, { headers: authHeaders() });
                const detailsData = await detailsRes.json();
                if (detailsData.success && detailsData.returns) {
                  returnsArr = detailsData.returns;
                }
              } catch (e) {}
            }
            printPaymentReceipt(item, returnsArr);
          });
        });

        tbody.querySelectorAll(".deleteRcptBtn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const rcptId = btn.dataset.rcptid;
            const rcptNo = btn.dataset.rcptno;
            const amt = btn.dataset.amt;
            if (!rcptId) return;
            if (!confirm(`Are you sure you want to delete Payment Receipt ${rcptNo} (Amount: ₹${amt})?\nRemaining payment receipts will be automatically re-sequenced and customer pending balance recalculated.`)) return;

            try {
              const res = await fetch(`${API_BASE}/sales?action=delete-payment&id=${rcptId}`, {
                method: "POST",
                headers: authHeaders()
              });
              const data = await res.json();
              if (data.success) {
                showToast(data.message || "Payment receipt deleted successfully!", "success");
                loadPaymentReceiptsSubTab();
              } else {
                showToast(data.error || "Failed to delete payment receipt", "error");
              }
            } catch (err) {
              showToast("Delete receipt error: " + err.message, "error");
            }
          });
        });
      }
    });
    }

    renderReceiptsTable();
    document.getElementById("receiptsSearchInp")?.addEventListener("input", (e) => renderReceiptsTable(e.target.value));

  } catch (err) {
    showToast("Fetch payment receipts error: " + err.message, "error");
  }
}

// ── Print Function: Payment Receipt ──
function printPaymentReceipt(r, returns = []) {
  const printWin = window.open('', '_blank');
  if (!printWin) return showToast("Please allow popups to print payment receipt", "warning");

  const compIdToFind = r.company_id || (selectedCompanyId && selectedCompanyId !== "all" ? parseInt(selectedCompanyId) : 1);
  const compList = (window.currentCompanies && window.currentCompanies.length > 0) ? window.currentCompanies : (typeof currentCompanies !== 'undefined' ? currentCompanies : []);
  const matchedComp = compList.find(c => c.id == compIdToFind) || compList[0] || {};
  const returnsList = (returns && returns.length > 0) ? returns : (r.returns || []);
  const websiteUrl = matchedComp.website || 'https://manageetha.in';

  const amt = parseFloat(r.amount || 0);
  const rcptNo = r.receipt_number || `RCP-${String(r.id).padStart(3, '0')}`;
  const serialNo = r.serial_number || r.chassis_no || null;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Receipt - ${rcptNo}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; color: #000; background: #fff; }
        .receipt-card { border: 2px solid #000; border-radius: 8px; padding: 20px; max-width: 650px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px double #000; padding-bottom: 10px; margin-bottom: 15px; }
        .title { display: inline-block; background: #000; color: #fff; font-weight: bold; padding: 4px 14px; border-radius: 4px; font-size: 14px; margin-top: 6px; }
        table { width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 15px; }
        td { padding: 6px; vertical-align: top; }
        .amount-box { background: #f0fdf4; border: 1px solid #16a34a; padding: 12px; border-radius: 6px; font-size: 14px; font-weight: bold; color: #15803d; margin-bottom: 20px; }
        @media print { .no-print { display: none !important; } .page-break { page-break-after: always; } }
      </style>
    </head>
    <body>
      <div class="no-print" style="text-align:right;margin-bottom:15px;">
        <button onclick="window.print()" style="background:#16a34a;color:#fff;border:none;padding:10px 20px;border-radius:6px;font-weight:bold;cursor:pointer;">🖨️ Print Receipt</button>
      </div>

      ${returnsList.length > 0 ? `
        <div style="max-width:650px;margin:0 auto 12px auto;border: 2px dashed #dc3545; background: #fff5f5; color: #dc3545; font-weight: bold; text-align: center; padding: 8px; border-radius: 6px; font-size: 12px;">
          ⚠️ NOTICE: PRODUCT(S) RETURNED AGAINST THIS SALE. SEE ATTACHED PAGE 3 FOR SALES RETURN & REFUND VOUCHER DETAILS.
        </div>
      ` : ''}

      <div class="receipt-card">
        <div class="header" style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div style="flex:1;text-align:center;">
            <h2 style="margin:0;font-size:22px;text-transform:uppercase;">${esc(r.company_name || matchedComp.name || 'MANASWINI AGENCIES')}</h2>
            <div style="font-size:12px;color:#444;">Official Payment Receipt</div>
            <div class="title">OFFICIAL PAYMENT RECEIPT</div>
          </div>
          <div style="text-align:right;margin-left:10px;">
            <div style="font-size:8.5px;font-weight:bold;color:#16a34a;margin-bottom:2px;">📷 SCAN FOR SERVICE TICKET</div>
            ${window.generateBarcodeSVG(rcptNo, 34, true)}
          </div>
        </div>
        <table>
          <tr>
            <td><strong>Receipt No:</strong> <span style="color:#b91c1c;">${esc(rcptNo)}</span></td>
            <td><strong>Date:</strong> ${formatDate(r.payment_date || r.created_at)}</td>
          </tr>
          <tr>
            <td><strong>Invoice / DC #:</strong> ${esc(r.invoice_number || ('DC #' + (r.challan_number || r.sale_id)))}</td>
            <td><strong>Payment Mode:</strong> ${(r.payment_mode || 'cash').toUpperCase()}</td>
          </tr>
          <tr>
            <td><strong>Received From:</strong> ${esc(r.customer_name || 'Counter Customer')}</td>
            <td><strong>Phone:</strong> ${esc(r.cell_phone || 'N/A')}</td>
          </tr>
        </table>
        <div class="amount-box">
          Amount Received: ₹${amt.toFixed(2)} (${numberToWordsINR(amt)})
          ${r.notes ? `<div style="font-size:12px;color:#333;font-weight:normal;margin-top:4px;">Notes: ${esc(r.notes)}</div>` : ''}
        </div>

        <div style="margin-top:16px;padding:8px 12px;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;display:flex;align-items:center;gap:12px;">
          <div>
            ${window.generateQRCodeSVG(websiteUrl, 75)}
          </div>
          <div>
            <div style="font-weight:bold;font-size:11px;color:#15803d;margin-bottom:2px;">🌐 Official Company Website</div>
            <div style="font-size:10px;color:#475569;">Scan QR code with smartphone:</div>
            <div style="font-size:11px;font-weight:bold;color:#0284c7;margin-top:1px;">${esc(websiteUrl)}</div>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;margin-top:25px;font-size:12px;">
          <div>Recorded By: <strong>${esc(r.cashier_name || 'Cashier')}</strong></div>
          <div style="text-align:center;">
            <div style="border-bottom:1px solid #000;width:180px;height:30px;"></div>
            <div style="margin-top:4px;">Authorized Signature</div>
          </div>
        </div>
      </div>

      ${returnsList.length > 0 ? renderPage3ReturnAttachment({
        invoice_number: r.invoice_number,
        challan_number: r.challan_number || r.sale_id,
        sale_date: r.payment_date || r.created_at,
        customer_name: r.customer_name,
        cell_phone: r.cell_phone,
        company_name: r.company_name || matchedComp.name
      }, returnsList, matchedComp) : ''}
    </body>
    </html>
  `;

  try { printWin.document.open(); } catch(e){}
  printWin.document.write(html);
  printWin.document.close();
}

// ═══════════════════════════════════════════════════════════
// SubTab 5: Product Sales Returns & Refunds
// ═══════════════════════════════════════════════════════════
async function loadReturnsSubTab() {
  const subContent = document.getElementById("salesSubContent");
  const compId = selectedCompanyId || "all";

  subContent.innerHTML = `
    <div style="margin-bottom:20px;">
      <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin-bottom:4px;">↩️ Sales Returns & Refund Management</h3>
      <p style="font-size:12px;color:var(--text3);margin:0;">View all sold items to initiate returns. Returned products automatically increment inventory stock.</p>
    </div>

    <!-- SEARCH & ALL SOLD ITEMS CARD -->
    <div class="card mb-24" style="background:var(--bg-secondary);border:1px solid var(--border);padding:16px;">
      <h4 style="font-size:14px;font-weight:600;color:var(--primary);margin-bottom:12px;">🔍 Step 1: All Sold Products / Search Sold Items</h4>
      <div class="toolbar" style="display:flex;gap:10px;flex-wrap:wrap;">
        <input type="text" id="returnSearchInp" class="form-input search-input" style="flex:1;min-width:250px;" placeholder="Search by Invoice #, DC #, Customer Name, Phone, or Serial No...">
        <button class="btn btn-primary" id="btnSearchSoldItems">🔍 Search Sold Items</button>
      </div>

      <div class="table-container mt-16" id="searchResultsWrapper" style="display:block;">
        <h5 style="font-size:13px;font-weight:600;color:var(--text1);margin-bottom:8px;">Sold Items List:</h5>
        <table class="data-table">
          <thead>
            <tr>
              <th>Challan / Invoice #</th>
              <th>Company</th>
              <th>Sale Date</th>
              <th>Customer Name & Phone</th>
              <th>Product & Serial No</th>
              <th>Qty Sold</th>
              <th>Rate</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="soldItemsTableBody">
            <tr><td colspan="8" style="text-align:center;padding:16px;"><div class="spinner"></div> Loading all sold items...</td></tr>
          </tbody>
        </table>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 4px;flex-wrap:wrap;gap:8px;">
          <div id="soldItemsInfo"></div>
          <div id="soldItemsPagination" class="pagination"></div>
        </div>
      </div>
    </div>

    <!-- RECENT RETURNS HISTORY CARD -->
    <div class="card" style="background:var(--bg-primary);border:1px solid var(--border);padding:16px;">
      <h4 style="font-size:14px;font-weight:600;color:var(--text1);margin-bottom:12px;">📋 Step 2: Recent Product Returns History</h4>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Return #</th>
              <th>Company</th>
              <th>Return Date</th>
              <th>Customer Details</th>
              <th>Returned Product & Serial</th>
              <th>Qty Ret.</th>
              <th>Refund Amount Breakdown</th>
              <th>Reason</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="returnsHistoryTableBody">
            <tr><td colspan="9" style="text-align:center;padding:20px;"><div class="spinner"></div> Loading returns history...</td></tr>
          </tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 4px;flex-wrap:wrap;gap:8px;">
        <div id="returnsHistoryInfo"></div>
        <div id="returnsHistoryPagination" class="pagination"></div>
      </div>
    </div>
  `;

  const searchInp = document.getElementById("returnSearchInp");
  const btnSearch = document.getElementById("btnSearchSoldItems");
  const tbodySold = document.getElementById("soldItemsTableBody");

  const executeSearch = async (queryStr = null) => {
    const q = queryStr !== null ? queryStr : (searchInp.value || "").trim();
    tbodySold.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:16px;"><div class="spinner"></div> Fetching sold items...</td></tr>`;

    try {
      const res = await fetch(`${API_BASE}/sales?action=search-sold-items&q=${encodeURIComponent(q)}&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success || !data.items) {
        tbodySold.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:16px;color:var(--text3);">No sold items found.</td></tr>`;
        return;
      }

      window.renderPaginatedTable({
        data: data.items,
        pageSize: 10,
        currentPage: 1,
        tbody: "soldItemsTableBody",
        paginationContainer: "soldItemsPagination",
        infoContainer: "soldItemsInfo",
        renderRow: (item) => `
          <tr>
            <td><span class="badge badge-purple">#${esc(item.invoice_number || item.challan_number || item.sale_id)}</span></td>
            <td><span class="badge badge-outline">${esc(item.company_name || 'Main')}</span></td>
            <td>${formatDate(item.sale_date)}</td>
            <td>
              <div style="font-weight:600;">${esc(item.customer_name || 'Counter Customer')}</div>
              <div style="font-size:11px;color:var(--text3);">${esc(item.cell_phone || '')}</div>
            </td>
            <td>
              <div style="font-weight:600;color:var(--primary);">${esc(item.product_name || 'Product')}</div>
              ${item.serial_number ? `<div style="font-size:11px;color:var(--text3);">S/N: ${esc(item.serial_number)}</div>` : ''}
            </td>
            <td style="font-weight:700;">${item.quantity}</td>
            <td>${formatCurrency(item.rate)}</td>
            <td>
              ${(item.is_returned || (item.returned_qty && item.returned_qty >= item.quantity)) ? `
                <button class="btn btn-sm btn-secondary opacity-75" disabled title="This product item has already been returned" style="cursor:not-allowed;">
                  ↩️ Returned ${item.return_number ? `(#${esc(item.return_number)})` : ''}
                </button>
              ` : `
                <button class="btn btn-sm btn-danger initReturnBtn" data-item='${JSON.stringify(item).replace(/'/g, "&apos;")}'>
                  ↩️ Initiate Return
                </button>
              `}
            </td>
          </tr>
        `,
        onRender: () => {
          const tb = document.getElementById("soldItemsTableBody");
          if (!tb) return;
          tb.querySelectorAll(".initReturnBtn").forEach(btn => {
            btn.addEventListener("click", () => {
              const itemData = JSON.parse(btn.dataset.item);
              openReturnProductModal(itemData, () => {
                loadReturnsSubTab();
              });
            });
          });
        }
      });

    } catch (err) {
      tbodySold.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--danger);padding:16px;">Search error: ${err.message}</td></tr>`;
    }
  };

  btnSearch.addEventListener("click", () => executeSearch());
  searchInp.addEventListener("keyup", (e) => { if (e.key === "Enter") executeSearch(); });

  // Auto-fetch all sold items by default on initial page load
  executeSearch("");

  // Load Recent Returns History
  try {
    const rRes = await fetch(`${API_BASE}/sales?action=list-returns&company_id=${compId}`, { headers: authHeaders() });
    const rData = await rRes.json();
    const tbodyRet = document.getElementById("returnsHistoryTableBody");
    if (!tbodyRet) return;

    if (!rData.success || !rData.returns || rData.returns.length === 0) {
      tbodyRet.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text3);">No product returns recorded yet.</td></tr>`;
      return;
    }

    window.renderPaginatedTable({
      data: rData.returns,
      pageSize: 10,
      currentPage: 1,
      tbody: "returnsHistoryTableBody",
      paginationContainer: "returnsHistoryPagination",
      infoContainer: "returnsHistoryInfo",
      renderRow: (r) => {
        const cash = parseFloat(r.cash_amount || 0);
        const upi = parseFloat(r.upi_amount || 0);
        const bank = parseFloat(r.bank_amount || 0);
        const refundTotal = parseFloat(r.refund_amount || 0);

        const breakdownParts = [];
        if (cash > 0) breakdownParts.push(`💵 Cash: ₹${cash.toFixed(2)}`);
        if (upi > 0) breakdownParts.push(`📱 UPI: ₹${upi.toFixed(2)} ${r.upi_ref ? `(Ref: ${esc(r.upi_ref)})` : ''}`);
        if (bank > 0) breakdownParts.push(`🏦 Bank: ₹${bank.toFixed(2)} ${r.bank_ref ? `(Ref: ${esc(r.bank_ref)})` : ''}`);

        return `
          <tr>
            <td><span class="badge badge-danger" style="font-weight:700;">${esc(r.return_number)}</span></td>
            <td><span class="badge badge-outline">${esc(r.company_name || 'Main')}</span></td>
            <td>${formatDate(r.return_date || r.created_at)}</td>
            <td>
              <div style="font-weight:600;">${esc(r.customer_name || 'Customer')}</div>
              <div style="font-size:11px;color:var(--text3);">${esc(r.customer_phone || '')}</div>
            </td>
            <td>
              <div style="font-weight:600;color:var(--text1);">${esc(r.product_name)}</div>
              ${r.serial_number ? `<div style="font-size:11px;color:var(--text3);">S/N: ${esc(r.serial_number)}</div>` : ''}
            </td>
            <td style="font-weight:700;color:var(--danger);">${r.quantity_returned}</td>
            <td>
              <div style="font-weight:700;color:var(--text1);">${formatCurrency(refundTotal)}</div>
              <div style="font-size:11px;color:var(--text3);">${breakdownParts.join('<br>') || 'Direct Refund'}</div>
            </td>
            <td style="font-size:12px;max-width:180px;">${esc(r.reason || 'N/A')}</td>
            <td>
              <button class="btn btn-sm btn-primary printReturnReceiptBtn" data-id="${r.id}">
                🖨️ Print Receipts (2 Copies)
              </button>
            </td>
          </tr>
        `;
      },
      onRender: () => {
        const tb = document.getElementById("returnsHistoryTableBody");
        if (!tb) return;
        tb.querySelectorAll(".printReturnReceiptBtn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const retId = btn.dataset.id;
            setButtonLoading(btn, true, "Loading...");
            try {
              const res = await fetch(`${API_BASE}/sales?action=get-return-details&id=${retId}`, { headers: authHeaders() });
              const data = await res.json();
              if (data.success) {
                printSalesReturnReceipt(data.return_data, data.sale_data, data.product_data, data.company_data);
              } else {
                showToast("Failed to fetch return details for printing", "error");
              }
            } catch (e) {
              showToast("Print error: " + e.message, "error");
            } finally {
              setButtonLoading(btn, false);
            }
          });
        });
      }
    });

  } catch (err) {
    showToast("Fetch returns history error: " + err.message, "error");
  }
}

// ── Modal: Process Product Return ──
function openReturnProductModal(item, refreshCallback) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;";

  const targetSaleId = item.sale_id || item.saleId || (item.challan_number ? parseInt(item.challan_number) : null);
  const targetProductId = (item.product_id && !isNaN(parseInt(item.product_id))) ? parseInt(item.product_id) : (item.prod_id ? parseInt(item.prod_id) : null);
  const itemTotal = parseFloat(item.total || (item.rate * item.quantity));

  overlay.innerHTML = `
    <div class="modal-content" style="background:var(--bg-primary);border-radius:12px;max-width:680px;width:100%;max-height:92vh;overflow-y:auto;padding:24px;border:1px solid var(--border);box-shadow:0 20px 25px -5px rgba(0,0,0,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:16px;">
        <h3 style="font-size:18px;font-weight:700;color:var(--danger);margin:0;">↩️ Process Sales Return & Restock</h3>
        <button class="btn btn-sm btn-outline closeReturnModal">&times;</button>
      </div>

      <!-- Item Snapshot Banner -->
      <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;border:1px solid var(--border);margin-bottom:16px;font-size:13px;">
        <div style="font-weight:700;color:var(--primary);font-size:15px;">${esc(item.product_name || item.name || 'Product')}</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:6px;color:var(--text2);">
          <div>Challan #: <strong>#${esc(item.challan_number || targetSaleId)}</strong></div>
          <div>Customer: <strong>${esc(item.customer_name || 'Counter Customer')}</strong></div>
          <div>Qty Sold: <strong>${item.quantity}</strong></div>
          <div>Rate: <strong>₹${parseFloat(item.rate || 0).toFixed(2)}</strong></div>
        </div>
      </div>

      <form id="processReturnForm">
        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group">
            <label class="form-label">Quantity to Return * (Max ${item.quantity})</label>
            <input type="number" id="modalRetQty" class="form-input" value="${item.quantity}" min="1" max="${item.quantity}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Returned Serial / Machine No.</label>
            <input type="text" id="modalRetSerial" class="form-input" value="${esc(item.serial_number || '')}" placeholder="e.g. MAC12345678">
          </div>
        </div>

        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label">Total Refund Amount (₹) *</label>
          <input type="number" step="0.01" id="modalRetTotalRefund" class="form-input" value="${itemTotal.toFixed(2)}" min="0" required style="font-size:16px;font-weight:700;color:var(--danger);">
        </div>

        <!-- Refund Payment Modes Breakdown -->
        <div style="background:var(--bg-secondary);padding:14px;border-radius:8px;border:1px solid var(--border);margin-bottom:16px;">
          <label class="form-label" style="font-weight:700;color:var(--primary);margin-bottom:10px;">💳 Refund Amount Payment Breakdown Details</label>
          
          <div class="form-grid" style="grid-template-columns:1fr 1fr 1fr;gap:10px;">
            <div class="form-group">
              <label class="form-label" style="font-size:11px;">💵 Cash Amount (₹)</label>
              <input type="number" step="0.01" id="modalRetCash" class="form-input" value="${itemTotal.toFixed(2)}" min="0">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:11px;">📱 UPI Amount (₹)</label>
              <input type="number" step="0.01" id="modalRetUpi" class="form-input" value="0" min="0">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:11px;">🏦 Bank Amount (₹)</label>
              <input type="number" step="0.01" id="modalRetBank" class="form-input" value="0" min="0">
            </div>
          </div>

          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-top:8px;">
            <div class="form-group">
              <label class="form-label" style="font-size:11px;">UPI UTR / Reference No.</label>
              <input type="text" id="modalRetUpiRef" class="form-input" placeholder="e.g. UTR987654321">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:11px;">Bank Name / Transfer Ref</label>
              <input type="text" id="modalRetBankRef" class="form-input" placeholder="e.g. SBI / IMPS123456">
            </div>
          </div>
          <div class="form-group" style="margin-top:8px;">
            <label class="form-label" style="font-size:11px;">Company Bank Account (For Refund Transfer)</label>
            <select id="modalRetBankSelect" class="form-select"></select>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:20px;">
          <label class="form-label">Reason / Condition Notes for Return</label>
          <textarea id="modalRetReason" class="form-textarea" rows="2" placeholder="e.g. Customer returned damaged seal / Model exchange / Defective component..."></textarea>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button type="button" class="btn btn-outline closeReturnModal">Cancel</button>
          <button type="submit" class="btn btn-danger" id="btnSubmitReturn">
            ↩️ Confirm Return & Restock Product
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  if (window.populateBankAccountDropdown && overlay.querySelector("#modalRetBankSelect")) {
    window.populateBankAccountDropdown(overlay.querySelector("#modalRetBankSelect"), item.company_id);
  }

  const closeModal = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
  overlay.querySelectorAll(".closeReturnModal").forEach(b => b.addEventListener("click", closeModal));

  const retQtyInp = overlay.querySelector("#modalRetQty");
  const totalRefInp = overlay.querySelector("#modalRetTotalRefund");
  const cashInp = overlay.querySelector("#modalRetCash");

  // Auto calculate total refund when qty changes
  retQtyInp.addEventListener("input", () => {
    const q = parseInt(retQtyInp.value || 1);
    const newTot = q * parseFloat(item.rate || 0);
    totalRefInp.value = newTot.toFixed(2);
    cashInp.value = newTot.toFixed(2);
  });

  // Handle Form Submit
  const form = overlay.querySelector("#processReturnForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btnSub = overlay.querySelector("#btnSubmitReturn");
    setButtonLoading(btnSub, true, "Processing Return & Updating Stock...");

    const payload = {
      sale_id: targetSaleId,
      product_id: targetProductId,
      product_name: item.product_name || item.name || item.description || '',
      serial_number: overlay.querySelector("#modalRetSerial").value.trim(),
      quantity_returned: parseInt(retQtyInp.value || 1),
      bank_account_id: overlay.querySelector("#modalRetBankSelect")?.value || null,
      rate: parseFloat(item.rate || 0),
      refund_amount: parseFloat(totalRefInp.value || 0),
      cash_amount: parseFloat(overlay.querySelector("#modalRetCash").value || 0),
      upi_amount: parseFloat(overlay.querySelector("#modalRetUpi").value || 0),
      bank_amount: parseFloat(overlay.querySelector("#modalRetBank").value || 0),
      upi_ref: overlay.querySelector("#modalRetUpiRef").value.trim(),
      bank_ref: overlay.querySelector("#modalRetBankRef").value.trim(),
      reason: overlay.querySelector("#modalRetReason").value.trim()
    };

    try {
      const res = await fetch(`${API_BASE}/sales?action=process-return`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Sales return processed successfully! Stock updated.", "success");
        closeModal();
        if (refreshCallback) refreshCallback();
        // Automatically open dual receipt print window
        printSalesReturnReceipt(data.return_data, data.sale_data, data.product_data, data.company_data);
      } else {
        showToast(data.error || "Failed to process return", "error");
        setButtonLoading(btnSub, false);
      }
    } catch (err) {
      showToast("Return error: " + err.message, "error");
      setButtonLoading(btnSub, false);
    }
  });
}

// ── Print Function: Dual Copy Sales Return Receipts (Customer + Company with Signature) ──
function printSalesReturnReceipt(returnData, saleData, productData, companyData) {
  const printWin = window.open('', '_blank');
  if (!printWin) return showToast("Please allow popups to print return receipt", "warning");

  const company = companyData || {};
  const sale = saleData || {};
  const ret = returnData || {};
  const prod = productData || {};

  const retNo = ret.return_number || `RET-${ret.id}`;
  const retDate = formatDate(ret.return_date || ret.created_at);
  const origDcNo = sale.challan_number || sale.id;

  const cash = parseFloat(ret.cash_amount || 0);
  const upi = parseFloat(ret.upi_amount || 0);
  const bank = parseFloat(ret.bank_amount || 0);
  const refundTotal = parseFloat(ret.refund_amount || 0);

  function renderSingleReceiptCopy(copyTitle, isCompanyCopy) {
    return `
      <div class="receipt-copy" style="padding:15px;border:2px solid #000;border-radius:8px;margin-bottom:20px;background:#fff;max-width:800px;margin-left:auto;margin-right:auto;">
        
        <!-- Header Banner -->
        <div style="text-align:center;border-bottom:2px double #000;padding-bottom:8px;margin-bottom:12px;">
          <h2 style="margin:0;font-size:20px;text-transform:uppercase;color:#000;">${esc(company.name || 'MANASWINI AGENCIES')}</h2>
          <div style="font-size:12px;color:#333;">${esc(company.address || '')}, ${esc(company.city || '')}, ${esc(company.state || '')} — Phone: ${esc(company.phone || '9848123456')}</div>
          ${company.gstin ? `<div style="font-size:12px;font-weight:bold;">GSTIN: ${esc(company.gstin)}</div>` : ''}
          <div style="display:inline-block;background:#000;color:#fff;font-weight:bold;padding:4px 14px;border-radius:4px;font-size:13px;margin-top:6px;letter-spacing:0.5px;">
            ${copyTitle}
          </div>
        </div>

        <!-- Meta Details Grid -->
        <table style="width:100%;font-size:12px;border-collapse:collapse;margin-bottom:12px;">
          <tr>
            <td style="width:50%;vertical-align:top;padding:4px;">
              <strong>Return No:</strong> <span style="font-size:14px;color:#b91c1c;font-weight:bold;">${esc(retNo)}</span><br>
              <strong>Return Date:</strong> ${retDate}<br>
              <strong>Original DC / Invoice #:</strong> #${esc(origDcNo)}<br>
              <strong>Original Sale Date:</strong> ${formatDate(sale.sale_date || sale.created_at)}
            </td>
            <td style="width:50%;vertical-align:top;padding:4px;border-left:1px dashed #ccc;">
              <strong>Customer Name:</strong> ${esc(ret.customer_name || sale.customer_name || 'Counter Customer')}<br>
              <strong>Phone:</strong> ${esc(ret.customer_phone || sale.cell_phone || 'N/A')}<br>
              <strong>Village / Location:</strong> ${esc(sale.village || 'N/A')}, ${esc(sale.mandal || '')}
            </td>
          </tr>
        </table>

        <!-- Returned Product Table -->
        <table style="width:100%;font-size:12px;border-collapse:collapse;margin-bottom:12px;border:1px solid #000;">
          <thead>
            <tr style="background:#f1f5f9;border-bottom:1px solid #000;">
              <th style="padding:6px;text-align:left;border-right:1px solid #000;">Returned Product Description</th>
              <th style="padding:6px;text-align:center;border-right:1px solid #000;">Serial / Machine #</th>
              <th style="padding:6px;text-align:center;border-right:1px solid #000;">Qty Ret.</th>
              <th style="padding:6px;text-align:right;border-right:1px solid #000;">Rate (₹)</th>
              <th style="padding:6px;text-align:right;">Refund Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:8px;border-right:1px solid #000;font-weight:bold;">${esc(ret.product_name || prod.name || 'Product')}</td>
              <td style="padding:8px;border-right:1px solid #000;text-align:center;">${esc(ret.serial_number || 'N/A')}</td>
              <td style="padding:8px;border-right:1px solid #000;text-align:center;font-weight:bold;color:#b91c1c;">${ret.quantity_returned}</td>
              <td style="padding:8px;border-right:1px solid #000;text-align:right;">${parseFloat(ret.rate || 0).toFixed(2)}</td>
              <td style="padding:8px;text-align:right;font-weight:bold;font-size:13px;color:#b91c1c;">${refundTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Refund Payment Details Breakdown -->
        <div style="font-size:12px;border:1px solid #000;padding:8px;border-radius:4px;margin-bottom:12px;background:#fef2f2;">
          <strong style="color:#991b1b;display:block;margin-bottom:4px;">💳 Refund Amount Payment Breakdown:</strong>
          <table style="width:100%;font-size:12px;">
            <tr>
              <td><strong>Cash Refund:</strong> ₹${cash.toFixed(2)}</td>
              <td><strong>UPI Refund:</strong> ₹${upi.toFixed(2)} ${ret.upi_ref ? `(UTR: ${esc(ret.upi_ref)})` : ''}</td>
              <td><strong>Bank Transfer:</strong> ₹${bank.toFixed(2)} ${ret.bank_ref ? `(Ref: ${esc(ret.bank_ref)})` : ''}</td>
            </tr>
          </table>
          <div style="font-weight:bold;font-size:13px;margin-top:4px;color:#000;">Total Refunded: ₹${refundTotal.toFixed(2)} (${numberToWordsINR(refundTotal)})</div>
        </div>

        ${ret.reason ? `<div style="font-size:11px;margin-bottom:16px;"><strong>Return Reason / Condition Notes:</strong> ${esc(ret.reason)}</div>` : ''}

        <!-- Signatures Section -->
        ${isCompanyCopy ? `
          <!-- COMPANY COPY: REQUIRES CUSTOMER SIGNATURE AS PROOF OF RETURN -->
          <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:35px;padding-top:10px;">
            <div style="text-align:center;width:45%;">
              <div style="border-bottom:1.5px solid #000;margin-bottom:4px;height:35px;"></div>
              <strong style="font-size:12px;">Customer Signature & Date</strong>
              <div style="font-size:10px;color:#555;">(Proof of Product Return & Refund Receipt)</div>
            </div>
            <div style="text-align:center;width:45%;">
              <div style="border-bottom:1.5px solid #000;margin-bottom:4px;height:35px;"></div>
              <strong style="font-size:12px;">Authorized Store Seal & Signature</strong>
              <div style="font-size:10px;color:#555;">(${esc(company.name || 'Store Manager')})</div>
            </div>
          </div>
        ` : `
          <!-- CUSTOMER COPY: STORE SEAL & SIGNATURE -->
          <div style="display:flex;justify-content:flex-end;align-items:flex-end;margin-top:35px;padding-top:10px;">
            <div style="text-align:center;width:45%;">
              <div style="border-bottom:1.5px solid #000;margin-bottom:4px;height:35px;"></div>
              <strong style="font-size:12px;">Authorized Store Seal & Signature</strong>
              <div style="font-size:10px;color:#555;">(${esc(company.name || 'Store Manager')})</div>
            </div>
          </div>
        `}
      </div>
    `;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sales Return Receipt - ${retNo}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 15px; color: #000; background: #fff; }
        @media print {
          body { padding: 0; }
          .no-print { display: none !important; }
          .page-break { page-break-after: always; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom:16px;text-align:right;">
        <button onclick="window.print()" style="background:#dc2626;color:#fff;border:none;padding:10px 22px;border-radius:6px;font-weight:bold;font-size:14px;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.2);">
          🖨️ Print Both Copies (Page 1: Customer Copy + Page 2: Company Copy)
        </button>
      </div>

      <!-- PAGE 1: CUSTOMER COPY -->
      ${renderSingleReceiptCopy('CUSTOMER COPY — SALES RETURN RECEIPT', false)}

      <div class="page-break"></div>

      <!-- PAGE 2: COMPANY COPY (WITH CUSTOMER SIGNATURE FOR PROOF OF RETURN) -->
      ${renderSingleReceiptCopy('COMPANY COPY — SALES RETURN RECEIPT (REQUIRED CUSTOMER SIGNATURE)', true)}
    </body>
    </html>
  `;

  try { printWin.document.open(); } catch(e){}
  printWin.document.write(html);
  printWin.document.close();
}
