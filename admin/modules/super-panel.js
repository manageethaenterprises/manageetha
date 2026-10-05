// ═══════════════════════════════════════════════════
// BUSINESS ERP — super-panel.js
// Superadmin: Consolidated Dashboard, Multi-Company CRUD,
// Role & Menu Mappings, User Accounts, Work Management
// ═══════════════════════════════════════════════════

window.renderSuperPanelModule = async function (tabKey, container) {
  if (tabKey === "dashboard" || tabKey === "sa_dashboard") {
    await renderSuperDashboard(container);
  } else if (tabKey === "superpanel" || tabKey === "sa_superpanel") {
    await renderSuperpanelUI(container);
  } else if (tabKey === "work_management" || tabKey === "sa_work_mgmt") {
    await renderWorkManagementUI(container);
  } else if (tabKey === "work_schedule" || tabKey === "sa_work_schedule") {
    await renderWorkScheduleUI(container);
  } else if (tabKey === "sa_inventory_stock") {
    if (window.renderInventoryModule) {
      await window.renderInventoryModule("inventory", container);
    } else {
      await renderSuperDashboard(container);
    }
  } else {
    await renderSuperDashboard(container);
  }
};

if (window.registerModuleRoute) {
  window.registerModuleRoute(
    ["dashboard", "superpanel", "work_management", "sa_dashboard", "sa_superpanel", "sa_work_mgmt", "sa_work_schedule", "sa_inventory_stock"],
    window.renderSuperPanelModule
  );
}

// ═══════════════════════════════════════════════════
// 1. SUPERADMIN DASHBOARD
// ═══════════════════════════════════════════════════

async function renderSuperDashboard(container) {
  const compId = selectedCompanyId || "all";
  const nowD = new Date();
  const firstDayOfMonth = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}-01`;
  const endDay = today();
  
  container.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <h2 style="font-size:18px;font-weight:600;color:var(--text1);">📊 Consolidated Executive Dashboard</h2>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <input type="date" id="dashStart" class="form-input" style="width:auto;" value="${firstDayOfMonth}">
          <span style="color:var(--text3);">to</span>
          <input type="date" id="dashEnd" class="form-input" style="width:auto;" value="${endDay}">
          <button class="btn btn-primary" id="dashApplyBtn">Apply Filters</button>
          <div style="display:inline-flex;gap:4px;margin-left:6px;">
            <button class="btn btn-secondary btn-xs" id="presetTodayBtn">Today</button>
            <button class="btn btn-secondary btn-xs" id="presetMonthBtn">This Month</button>
            <button class="btn btn-secondary btn-xs" id="presetAllBtn">All Time</button>
          </div>
        </div>
      </div>

      <!-- STAT CARDS GRID -->
      <div class="stats-grid" id="dashStatsGrid">
        <div class="stat-card skeleton-card">
          <div class="skeleton-icon"></div>
          <div class="stat-info">
            <div class="skeleton-line title"></div>
            <div class="skeleton-line short"></div>
          </div>
        </div>
        <div class="stat-card skeleton-card">
          <div class="skeleton-icon"></div>
          <div class="stat-info">
            <div class="skeleton-line title"></div>
            <div class="skeleton-line short"></div>
          </div>
        </div>
        <div class="stat-card skeleton-card">
          <div class="skeleton-icon"></div>
          <div class="stat-info">
            <div class="skeleton-line title"></div>
            <div class="skeleton-line short"></div>
          </div>
        </div>
        <div class="stat-card skeleton-card">
          <div class="skeleton-icon"></div>
          <div class="stat-info">
            <div class="skeleton-line title"></div>
            <div class="skeleton-line short"></div>
          </div>
        </div>
        <div class="stat-card skeleton-card">
          <div class="skeleton-icon"></div>
          <div class="stat-info">
            <div class="skeleton-line title"></div>
            <div class="skeleton-line short"></div>
          </div>
        </div>
        <div class="stat-card skeleton-card">
          <div class="skeleton-icon"></div>
          <div class="stat-info">
            <div class="skeleton-line title"></div>
            <div class="skeleton-line short"></div>
          </div>
        </div>
        <div class="stat-card skeleton-card">
          <div class="skeleton-icon"></div>
          <div class="stat-info">
            <div class="skeleton-line title"></div>
            <div class="skeleton-line short"></div>
          </div>
        </div>
      </div>

      <!-- BREAKDOWN BY COMPANY (IF ALL SELECTED) -->
      <div id="companyBreakdownSec" style="margin-top:28px;">
        <h3 style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:12px;">🏢 Performance Breakdown by Company</h3>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Location</th>
                <th>Total Sales</th>
                <th>Sales Returns</th>
                <th>Service Revenue</th>
                <th>Expenses</th>
                <th>Net Contribution</th>
              </tr>
            </thead>
            <tbody id="companyBreakdownBody">
              <tr>
                <td><div class="skeleton-line medium"></div></td>
                <td><div class="skeleton-line short"></div></td>
                <td><div class="skeleton-line medium"></div></td>
                <td><div class="skeleton-line medium"></div></td>
                <td><div class="skeleton-line medium"></div></td>
                <td><div class="skeleton-line medium"></div></td>
                <td><div class="skeleton-line medium"></div></td>
              </tr>
              <tr>
                <td><div class="skeleton-line medium"></div></td>
                <td><div class="skeleton-line short"></div></td>
                <td><div class="skeleton-line medium"></div></td>
                <td><div class="skeleton-line medium"></div></td>
                <td><div class="skeleton-line medium"></div></td>
                <td><div class="skeleton-line medium"></div></td>
                <td><div class="skeleton-line medium"></div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  async function loadStats() {
    const sDate = document.getElementById("dashStart").value;
    const eDate = document.getElementById("dashEnd").value;

    try {
      const res = await fetch(`${API_BASE}/super?action=dashboard-stats&company_id=${compId}&start_date=${sDate}&end_date=${eDate}`, {
        headers: authHeaders()
      });
      const data = await res.json();

      if (!data.success) {
        showToast(data.error || "Failed to load dashboard stats", "error");
        return;
      }

      const s = data.stats;
      document.getElementById("dashStatsGrid").innerHTML = `
        <div class="stat-card green">
          <div class="stat-icon">💰</div>
          <div class="stat-info">
            <div class="stat-value">${formatCurrency(s.total_sales)}</div>
            <div class="stat-label">Total Sales (${s.count_sales} bills)</div>
          </div>
        </div>

        <div class="stat-card red">
          <div class="stat-icon">↩️</div>
          <div class="stat-info">
            <div class="stat-value" style="color:var(--danger);">${formatCurrency(s.total_returns)}</div>
            <div class="stat-label">Sales Returns (${s.count_returns} returns)</div>
          </div>
        </div>

        <div class="stat-card blue">
          <div class="stat-icon">🔧</div>
          <div class="stat-info">
            <div class="stat-value">${formatCurrency(s.total_service)}</div>
            <div class="stat-label">Services (${s.count_services} jobs)</div>
          </div>
        </div>

        <div class="stat-card purple">
          <div class="stat-icon">📈</div>
          <div class="stat-info">
            <div class="stat-value">${formatCurrency(s.total_revenue)}</div>
            <div class="stat-label">Gross Revenue (Net of Returns)</div>
          </div>
        </div>

        <div class="stat-card yellow">
          <div class="stat-icon">💸</div>
          <div class="stat-info">
            <div class="stat-value">${formatCurrency(s.total_expenses)}</div>
            <div class="stat-label">Operating Expenses</div>
          </div>
        </div>

        <div class="stat-card yellow">
          <div class="stat-icon">👥</div>
          <div class="stat-info">
            <div class="stat-value">${formatCurrency(s.total_salaries)}</div>
            <div class="stat-label">Salaries Paid</div>
          </div>
        </div>

        <div class="stat-card ${s.is_loss ? 'red' : 'green'}">
          <div class="stat-icon">${s.is_loss ? '📉' : '📊'}</div>
          <div class="stat-info">
            <div class="stat-value">${formatCurrency(s.net_profit)}</div>
            <div class="stat-label">${s.is_loss ? 'NET LOSS ⚠️' : 'NET PROFIT ✅'}</div>
          </div>
        </div>

        <div class="stat-card purple">
          <div class="stat-icon">🏦</div>
          <div class="stat-info">
            <div class="stat-value">${formatCurrency(s.current_capital)}</div>
            <div class="stat-label">Current Working Capital</div>
          </div>
        </div>
      `;

      // Company breakdown table
      const tbody = document.getElementById("companyBreakdownBody");
      if (!tbody) return;
      if (data.company_breakdown && data.company_breakdown.length > 0) {
        tbody.innerHTML = data.company_breakdown.map(c => {
          const retAmt = parseFloat(c.returns || 0);
          const contrib = (parseFloat(c.sales) - retAmt + parseFloat(c.services)) - parseFloat(c.expenses);
          return `
            <tr>
              <td style="font-weight:600;color:var(--text1);">${esc(c.name)}</td>
              <td>${esc(c.city || '—')}</td>
              <td style="color:var(--success);font-weight:500;">${formatCurrency(c.sales)}</td>
              <td style="color:var(--danger);font-weight:500;">${retAmt > 0 ? `-${formatCurrency(retAmt)}` : formatCurrency(0)}</td>
              <td style="color:var(--primary-light);font-weight:500;">${formatCurrency(c.services)}</td>
              <td style="color:var(--danger);font-weight:500;">${formatCurrency(c.expenses)}</td>
              <td style="font-weight:600;color:${contrib >= 0 ? 'var(--success)' : 'var(--danger)'};">
                ${formatCurrency(contrib)}
              </td>
            </tr>
          `;
        }).join("");
      } else {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:20px;">No performance records found for the selected filter.</td></tr>`;
      }

    } catch (err) {
      showToast("Error loading stats: " + err.message, "error");
    }
  }

  on("dashApplyBtn", "click", async (e) => {
    const btn = e.target.closest("button") || document.getElementById("dashApplyBtn");
    if (btn && btn.disabled) return;
    const origHtml = btn ? btn.innerHTML : "Apply Filter";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Loading...`;
    }
    try {
      await loadStats();
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  });

  on("presetTodayBtn", "click", () => {
    document.getElementById("dashStart").value = today();
    document.getElementById("dashEnd").value = today();
    loadStats();
  });

  on("presetMonthBtn", "click", () => {
    const nD = new Date();
    document.getElementById("dashStart").value = `${nD.getFullYear()}-${String(nD.getMonth() + 1).padStart(2, '0')}-01`;
    document.getElementById("dashEnd").value = today();
    loadStats();
  });

  on("presetAllBtn", "click", () => {
    document.getElementById("dashStart").value = "1970-01-01";
    document.getElementById("dashEnd").value = "2099-12-31";
    loadStats();
  });

  loadStats();
}

// ═══════════════════════════════════════════════════
// 2. SUPERPANEL (COMPANIES, ROLES, MENU MAPPINGS, USERS, CONTROLS)
// ═══════════════════════════════════════════════════

async function renderSuperpanelUI(container) {
  container.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;">
      <div class="sub-tabs-bar">
        <button class="sub-tab active" data-subtab="companiesTab">🏢 Companies & Branches</button>
        <button class="sub-tab" data-subtab="menuMappingTab">🔐 Roles & Menu Permissions</button>
        <button class="sub-tab" data-subtab="usersTab">👤 User Accounts</button>
        <button class="sub-tab" data-subtab="controlsTab">⚙️ System Toggles</button>
      </div>

      <div class="sub-content-area" id="superpanelSubContent">
        <!-- Subcontent loaded here -->
      </div>
    </div>
  `;

  // Sub-tab handling
  const buttons = container.querySelectorAll(".sub-tab");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.subtab;
      if (target === "companiesTab") loadCompaniesSubTab();
      else if (target === "menuMappingTab") loadMenuMappingSubTab();
      else if (target === "usersTab") loadUsersSubTab();
      else if (target === "controlsTab") loadControlsSubTab();
    });
  });

  loadCompaniesSubTab();
}

// ── SubTab 1: Companies Management ──
async function loadCompaniesSubTab() {
  const subContent = document.getElementById("superpanelSubContent");
  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
      <h3 style="font-size:16px;font-weight:600;color:var(--text1);">Registered Business Entities & Branches</h3>
      <button class="btn btn-primary" id="addCompanyBtn">+ Add New Company / Location</button>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Company Name</th>
            <th>Group / Parent</th>
            <th>GSTIN</th>
            <th>City / State</th>
            <th>Phone</th>
            <th>Capital Edit Control</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="companiesTableBody">
          <tr><td colspan="10" style="text-align:center;padding:20px;">Loading companies...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- ADD/EDIT COMPANY MODAL -->
    <div class="modal-overlay" id="companyModal" style="display:none;">
      <div class="modal-box" style="max-width:700px;">
        <div class="modal-header">
          <h3 id="compModalTitle">Add New Business Entity</h3>
          <button class="modal-close" id="compModalClose">&times;</button>
        </div>
        <form id="companyForm">
          <input type="hidden" id="compEditId">
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group" style="grid-column: span 2;">
              <label class="form-label">Company / Store Name *</label>
              <input type="text" id="compName" class="form-input" placeholder="e.g. Geetha Enterprises - Vijayawada" required>
            </div>
            <div class="form-group">
              <label class="form-label">Parent Company Group (Same GSTIN)</label>
              <select id="compParentId" class="form-select">
                <option value="">-- Standalone (No Parent) --</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Trade Name</label>
              <input type="text" id="compTradeName" class="form-input" placeholder="Trading name if different">
            </div>
            <div class="form-group">
              <label class="form-label">GSTIN Number</label>
              <input type="text" id="compGstin" class="form-input" placeholder="37AHMPH1933C1Z7">
            </div>
            <div class="form-group">
              <label class="form-label">PAN Number</label>
              <input type="text" id="compPan" class="form-input" placeholder="AHMPH1933C">
            </div>
            <div class="form-group">
              <label class="form-label">Official Website URL (For Barcodes)</label>
              <input type="text" id="compWebsite" class="form-input" placeholder="https://manageetha.in">
            </div>
            <div class="form-group" style="grid-column: span 2;">
              <label class="form-label">Street Address</label>
              <input type="text" id="compAddress" class="form-input" placeholder="Door No, Street, Landmark">
            </div>
            <div class="form-group">
              <label class="form-label">City</label>
              <input type="text" id="compCity" class="form-input" placeholder="Vijayawada">
            </div>
            <div class="form-group">
              <label class="form-label">State</label>
              <input type="text" id="compState" class="form-input" placeholder="Andhra Pradesh">
            </div>
            <div class="form-group">
              <label class="form-label">State Code</label>
              <input type="text" id="compStateCode" class="form-input" placeholder="37">
            </div>
            <div class="form-group">
              <label class="form-label">Pincode</label>
              <input type="text" id="compPincode" class="form-input" placeholder="520001">
            </div>
            <div class="form-group">
              <label class="form-label">Contact Phone</label>
              <input type="text" id="compPhone" class="form-input" placeholder="+91 9876543210">
            </div>
            <div class="form-group">
              <label class="form-label">Contact Email</label>
              <input type="email" id="compEmail" class="form-input" placeholder="contact@company.com">
            </div>
          </div>
          <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" class="btn btn-secondary" id="compModalCancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Company</button>
          </div>
        </form>
      </div>
    </div>
  `;

  let companiesList = [];

  async function fetchCompanies() {
    try {
      const res = await fetch(`${API_BASE}/super?action=companies-list`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      companiesList = data.companies;
      currentCompanies = companiesList;

      const tbody = document.getElementById("companiesTableBody");
      if (!tbody) return;
      tbody.innerHTML = companiesList.map(c => `
        <tr>
          <td>#${c.id}</td>
          <td style="font-weight:600;color:var(--text1);">${esc(c.name)}</td>
          <td>${c.parent_name ? `↳ ${esc(c.parent_name)}` : '<span style="color:var(--text3);">Parent Group</span>'}</td>
          <td><span class="badge badge-purple">${esc(c.gstin || 'N/A')}</span></td>
          <td>${esc(c.city || '—')}, ${esc(c.state || '—')}</td>
          <td>${esc(c.phone || '—')}</td>
          <td>
            <label class="toggle-switch">
              <input type="checkbox" class="capitalToggle" data-id="${c.id}" ${c.capital_editable ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
            <span style="font-size:12px;color:var(--text3);margin-left:6px;">${c.capital_editable ? 'Editable' : 'Locked'}</span>
          </td>
          <td>
            <span class="badge ${c.is_active ? 'badge-success' : 'badge-danger'}">
              ${c.is_active ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td>
            <button class="btn btn-sm btn-secondary editCompBtn" data-id="${c.id}">✏️ Edit</button>
          </td>
        </tr>
      `).join("");

      // Update modal parent select options
      const parentSel = document.getElementById("compParentId");
      parentSel.innerHTML = `<option value="">-- Standalone (No Parent) --</option>` +
        companiesList.filter(c => !c.parent_company_id).map(c => `<option value="${c.id}">${esc(c.name)} (${esc(c.gstin || 'No GST')})</option>`).join("");

      // Attach capital toggles
      document.querySelectorAll(".capitalToggle").forEach(chk => {
        chk.addEventListener("change", async () => {
          const compId = chk.dataset.id;
          const editable = chk.checked;
          const res = await fetch(`${API_BASE}/super?action=capital-toggle`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ company_id: compId, capital_editable: editable })
          });
          const d = await res.json();
          if (d.success) showToast(d.message, "success");
          else { showToast(d.error, "error"); chk.checked = !editable; }
        });
      });

      // Attach edit buttons
      document.querySelectorAll(".editCompBtn").forEach(btn => {
        btn.addEventListener("click", () => {
          const comp = companiesList.find(c => c.id == btn.dataset.id);
          if (!comp) return;
          document.getElementById("compModalTitle").textContent = "Edit Company #" + comp.id;
          document.getElementById("compEditId").value = comp.id;
          document.getElementById("compName").value = comp.name || "";
          document.getElementById("compParentId").value = comp.parent_company_id || "";
          document.getElementById("compTradeName").value = comp.trade_name || "";
          document.getElementById("compGstin").value = comp.gstin || "";
          document.getElementById("compPan").value = comp.pan || "";
          if (document.getElementById("compHsnCode")) document.getElementById("compHsnCode").value = comp.hsn_code || "";
          if (document.getElementById("compWebsite")) document.getElementById("compWebsite").value = comp.website || "https://manageetha.in";
          document.getElementById("compAddress").value = comp.address || "";
          document.getElementById("compCity").value = comp.city || "";
          document.getElementById("compState").value = comp.state || "";
          document.getElementById("compStateCode").value = comp.state_code || "";
          document.getElementById("compPincode").value = comp.pincode || "";
          document.getElementById("compPhone").value = comp.phone || "";
          document.getElementById("compEmail").value = comp.email || "";
          document.getElementById("companyModal").style.display = "flex";
        });
      });

    } catch (err) {
      showToast("Error fetching companies: " + err.message, "error");
    }
  }

  on("addCompanyBtn", "click", () => {
    document.getElementById("compModalTitle").textContent = "Add New Business Entity";
    document.getElementById("compEditId").value = "";
    document.getElementById("companyForm").reset();
    if (document.getElementById("compWebsite")) document.getElementById("compWebsite").value = "https://manageetha.in";
    document.getElementById("companyModal").style.display = "flex";
  });

  on("compModalClose", "click", () => { document.getElementById("companyModal").style.display = "none"; });
  on("compModalCancel", "click", () => { document.getElementById("companyModal").style.display = "none"; });

  on("companyForm", "submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn && submitBtn.disabled) return;
    const origHtml = submitBtn ? submitBtn.innerHTML : "Save Company";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving...`;
    }

    const editId = document.getElementById("compEditId").value;
    const payload = {
      name: document.getElementById("compName").value.trim(),
      parent_company_id: document.getElementById("compParentId").value || null,
      trade_name: document.getElementById("compTradeName").value.trim(),
      gstin: document.getElementById("compGstin").value.trim(),
      pan: document.getElementById("compPan").value.trim(),
      hsn_code: document.getElementById("compHsnCode") ? document.getElementById("compHsnCode").value.trim() : "",
      website: document.getElementById("compWebsite") ? document.getElementById("compWebsite").value.trim() : "https://manageetha.in",
      address: document.getElementById("compAddress").value.trim(),
      city: document.getElementById("compCity").value.trim(),
      state: document.getElementById("compState").value.trim(),
      state_code: document.getElementById("compStateCode").value.trim(),
      pincode: document.getElementById("compPincode").value.trim(),
      phone: document.getElementById("compPhone").value.trim(),
      email: document.getElementById("compEmail").value.trim(),
    };

    const action = editId ? `company-update&id=${editId}` : "company-create";
    try {
      const res = await fetch(`${API_BASE}/super?action=${action}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "success");
        document.getElementById("companyModal").style.display = "none";
        fetchCompanies();
      } else {
        showToast(data.error || "Failed to save company", "error");
      }
    } catch (err) {
      showToast("Save error: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    }
  });

  fetchCompanies();
}

// ── SubTab 2: Role & Menu Permission Matrix ──
async function loadMenuMappingSubTab() {
  const subContent = document.getElementById("superpanelSubContent");
  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
      <div>
        <h3 style="font-size:16px;font-weight:600;color:var(--text1);">Role & Category Menu Control Matrix</h3>
        <p style="font-size:13px;color:var(--text3);margin-top:2px;">Select Company and Role to configure exact sidebar menu visibility per category (like inducare reference).</p>
      </div>
      <div style="display:flex;gap:12px;align-items:center;">
        <select id="matrixCompSelect" class="form-select" style="min-width:200px;">
          <!-- Loaded dynamically -->
        </select>
        <select id="matrixRoleSelect" class="form-select" style="min-width:160px;">
          <option value="storeadmin">Store Admin</option>
          <option value="accountant">Accountant</option>
          <option value="financers">Financers</option>
          <option value="salesadmin">Sales Admin</option>
          <option value="serviceadmin">Service Admin</option>
          <option value="hr">HR Manager</option>
          <option value="marketing">Marketing</option>
        </select>
        <button class="btn btn-primary" id="saveMatrixBtn">💾 Save Permissions</button>
      </div>
    </div>

    <div class="card" style="background:var(--bg-primary);border:1px solid var(--border);">
      <div id="permissionMatrixContainer">
        <div style="text-align:center;padding:30px;"><div class="spinner"></div> Loading menu categories...</div>
      </div>
    </div>
  `;

  // Populate company select
  const compSelect = document.getElementById("matrixCompSelect");
  compSelect.innerHTML = currentCompanies.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");

  async function loadMatrix() {
    const compId = compSelect.value;
    const roleName = document.getElementById("matrixRoleSelect").value;
    if (!compId || !roleName) return;

    const container = document.getElementById("permissionMatrixContainer");
    try {
      // 1. Fetch menu categories + menus
      const catRes = await fetch(`${API_BASE}/super?action=menu-categories-list`, { headers: authHeaders() });
      const catData = await catRes.json();

      // 2. Fetch mapped keys for this role & company
      const mapRes = await fetch(`${API_BASE}/super?action=get-role-menu-mapping&role_name=${roleName}&company_id=${compId}`, { headers: authHeaders() });
      const mapData = await mapRes.json();

      const mappedKeys = new Set(mapData.mapped_keys || []);

      let html = `<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:16px;">`;

      catData.categories.forEach(cat => {
        html += `
          <div class="role-matrix-card">
            <div class="role-matrix-header">
              <span style="font-size:14px;color:var(--primary);font-weight:600;">${esc(cat.icon)} ${esc(cat.category_label)}</span>
              <label style="font-size:11px;color:var(--text3);cursor:pointer;display:inline-flex;align-items:center;gap:4px;">
                <input type="checkbox" class="catSelectAll" data-cat="${cat.id}"> Select All
              </label>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;">
        `;

        (cat.menus || []).forEach((m, idx) => {
          const isChecked = mappedKeys.has(m.menu_key);
          const isFirst = idx === 0;
          const isLast = idx === cat.menus.length - 1;

          html += `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:6px;background:var(--bg-secondary);margin-bottom:2px;">
              <label class="custom-checkbox" style="font-size:13px;color:var(--text1);cursor:pointer;display:flex;align-items:center;gap:8px;margin:0;flex:1;">
                <input type="checkbox" class="menuKeyCheck" data-key="${m.menu_key}" data-cat="${cat.id}" ${isChecked ? 'checked' : ''}>
                <span>${esc(m.icon)} ${esc(m.menu_label)}</span>
              </label>
              <div style="display:flex;gap:4px;align-items:center;">
                <button type="button" class="btn-icon moveMenuUpBtn" data-cat="${cat.id}" data-idx="${idx}" title="Move Up (Top)" ${isFirst ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : 'style="cursor:pointer;"'}>⬆️</button>
                <button type="button" class="btn-icon moveMenuDownBtn" data-cat="${cat.id}" data-idx="${idx}" title="Move Down (Below)" ${isLast ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : 'style="cursor:pointer;"'}>⬇️</button>
              </div>
            </div>
          `;
        });

        html += `</div></div>`;
      });

      html += `</div>`;
      container.innerHTML = html;

      // Category "Select All" handlers
      container.querySelectorAll(".catSelectAll").forEach(chk => {
        chk.addEventListener("change", () => {
          const catId = chk.dataset.cat;
          container.querySelectorAll(`.menuKeyCheck[data-cat="${catId}"]`).forEach(mChk => {
            mChk.checked = chk.checked;
          });
        });
      });

      // Move Up / Move Down handlers
      async function handleReorder(catId, fromIdx, toIdx) {
        const catObj = catData.categories.find(c => c.id == catId);
        if (!catObj || !catObj.menus) return;

        // Swap items
        const temp = catObj.menus[fromIdx];
        catObj.menus[fromIdx] = catObj.menus[toIdx];
        catObj.menus[toIdx] = temp;

        // Re-assign sort_order
        const orders = catObj.menus.map((m, i) => ({ menu_key: m.menu_key, sort_order: i }));

        try {
          const res = await fetch(`${API_BASE}/super?action=menu-reorder`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ menu_orders: orders })
          });
          const d = await res.json();
          if (d.success) {
            showToast("Menu order updated", "success");
            loadMatrix();
            if (typeof renderSidebar === "function") {
              fetch(`${API_BASE}/auth/me`, { headers: authHeaders() }).then(r => r.json()).then(data => {
                if (data.success && data.menus) {
                  currentMenus = data.menus;
                  renderSidebar();
                }
              });
            }
          } else {
            showToast(d.error || "Failed to update order", "error");
          }
        } catch (err) {
          showToast("Reorder error: " + err.message, "error");
        }
      }

      container.querySelectorAll(".moveMenuUpBtn:not([disabled])").forEach(btn => {
        btn.addEventListener("click", () => {
          const catId = btn.dataset.cat;
          const idx = parseInt(btn.dataset.idx);
          if (idx > 0) handleReorder(catId, idx, idx - 1);
        });
      });

      container.querySelectorAll(".moveMenuDownBtn:not([disabled])").forEach(btn => {
        btn.addEventListener("click", () => {
          const catId = btn.dataset.cat;
          const idx = parseInt(btn.dataset.idx);
          handleReorder(catId, idx, idx + 1);
        });
      });

    } catch (err) {
      container.innerHTML = `<div style="color:var(--danger);padding:20px;">Failed to load permission matrix: ${err.message}</div>`;
    }
  }

  compSelect.addEventListener("change", loadMatrix);
  document.getElementById("matrixRoleSelect").addEventListener("change", loadMatrix);

  on("saveMatrixBtn", "click", async (e) => {
    const btn = e.target.closest("button") || document.getElementById("saveMatrixBtn");
    if (btn && btn.disabled) return;
    const origHtml = btn ? btn.innerHTML : "💾 Save Role Permission Matrix";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving...`;
    }

    const compId = compSelect.value;
    const roleName = document.getElementById("matrixRoleSelect").value;
    const selectedKeys = Array.from(document.querySelectorAll(".menuKeyCheck:checked")).map(el => el.dataset.key);

    try {
      const res = await fetch(`${API_BASE}/super?action=save-role-menu-mapping`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ company_id: compId, role_name: roleName, menu_keys: selectedKeys })
      });
      const data = await res.json();
      if (data.success) showToast(data.message, "success");
      else showToast(data.error || "Failed to save mapping", "error");
    } catch (err) {
      showToast("Save error: " + err.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  });

  loadMatrix();
}

// ── SubTab 3: User Accounts ──
async function loadUsersSubTab() {
  const subContent = document.getElementById("superpanelSubContent");
  const activeUser = typeof currentUser !== "undefined" && currentUser ? currentUser : JSON.parse(localStorage.getItem("erp_user") || "{}");
  const userRole = (activeUser.role || "").toLowerCase();
  const canManage = ["superadmin", "storeadmin", "hr", "hr_manager"].includes(userRole);

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
      <div>
        <h3 style="font-size:16px;font-weight:600;color:var(--text1);">System User Accounts</h3>
        <p style="font-size:13px;color:var(--text3);margin-top:2px;">Manage system logins, roles, and company access.</p>
      </div>
      ${canManage ? `<button class="btn btn-primary" id="addUserBtn">+ Create User Account</button>` : `<span class="badge badge-neutral" style="font-size:13px;padding:6px 12px;">🔒 Read Only Access</span>`}
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Assigned Company</th>
            <th>Role</th>
            <th>Last Login</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="usersTableBody">
          <tr><td colspan="7" style="text-align:center;padding:20px;">Loading user accounts...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 4px;flex-wrap:wrap;gap:8px;">
      <div id="usersInfo"></div>
      <div id="usersPagination" class="pagination"></div>
    </div>

    <!-- CREATE / EDIT USER MODAL -->
    <div class="modal-overlay" id="userModal" style="display:none;">
      <div class="modal-box" style="max-width:550px;">
        <div class="modal-header">
          <h3 id="userModalTitle">Create New User Account</h3>
          <button class="modal-close" id="userModalClose">&times;</button>
        </div>
        <form id="userForm">
          <input type="hidden" id="uEditId">
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group" style="grid-column:span 2;">
              <label class="form-label">Username *</label>
              <input type="text" id="uUsername" class="form-input" required placeholder="e.g. john_doe">
            </div>
            <div class="form-group" style="grid-column:span 2;" id="uPassGroup">
              <label class="form-label" id="uPassLabel">Password *</label>
              <input type="password" id="uPassword" class="form-input" placeholder="••••••••">
              <small id="uPassHint" style="display:none;color:var(--text3);font-size:11px;">Leave blank to keep existing password</small>
            </div>
            <div class="form-group">
              <label class="form-label">Company Assignment *</label>
              <select id="uCompanyId" class="form-select">
                <!-- Populated dynamically -->
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">System Role *</label>
              <select id="uRole" class="form-select" required>
                <option value="storeadmin">Store Admin</option>
                <option value="accountant">Accountant</option>
                <option value="financers">Financers</option>
                <option value="salesadmin">Sales Admin</option>
                <option value="serviceadmin">Service Admin</option>
                <option value="hr">HR Manager</option>
                <option value="marketing">Marketing</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" id="uEmail" class="form-input" placeholder="user@company.com">
            </div>
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input type="text" id="uPhone" class="form-input" placeholder="+91 9876543210">
            </div>
          </div>
          <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" class="btn btn-secondary" id="userModalCancel">Cancel</button>
            <button type="submit" class="btn btn-primary" id="userSubmitBtn">Create User</button>
          </div>
        </form>
      </div>
    </div>

    <!-- RESET PASSWORD MODAL -->
    <div class="modal-overlay" id="resetPassModal" style="display:none;">
      <div class="modal-box" style="max-width:420px;">
        <div class="modal-header">
          <h3>🔑 Reset User Password</h3>
          <button class="modal-close" id="resetPassModalClose">&times;</button>
        </div>
        <form id="resetPassForm">
          <input type="hidden" id="resetPassUserId">
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">User Account</label>
            <input type="text" id="resetPassUsername" class="form-input" readonly style="background:var(--bg-secondary);font-weight:600;">
          </div>
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label">New Password *</label>
            <input type="password" id="resetNewPass" class="form-input" required placeholder="Enter new password" minlength="4">
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" class="btn btn-secondary" id="resetPassCancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Update Password</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Populate company select
  const uCompSel = document.getElementById("uCompanyId");
  if (uCompSel) {
    uCompSel.innerHTML = `<option value="">-- Superadmin (No Company Lock) --</option>` +
      currentCompanies.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  }

  let fetchedUsers = [];

  async function fetchUsers() {
    try {
      const res = await fetch(`${API_BASE}/super?action=users-list&company_id=all`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success || !data.users) return;

      fetchedUsers = data.users;
      const tbody = document.getElementById("usersTableBody");
      if (!tbody) return;

      window.renderPaginatedTable({
        data: fetchedUsers,
        pageSize: 10,
        currentPage: 1,
        tbody: "usersTableBody",
        paginationContainer: "usersPagination",
        infoContainer: "usersInfo",
        renderRow: (u) => `
          <tr>
            <td>#${u.id}</td>
            <td style="font-weight:600;color:var(--text1);">${esc(u.username)}</td>
            <td>${u.company_name ? esc(u.company_name) : '<span style="color:var(--primary-light);">Global (Superadmin)</span>'}</td>
            <td><span class="badge badge-purple">${esc((u.role || '').replace(/_/g, ' '))}</span></td>
            <td>${formatDateTime(u.last_login_at)}</td>
            <td>
              <span class="badge ${u.is_active ? 'badge-success' : 'badge-danger'}">
                ${u.is_active ? 'Active' : 'Disabled'}
              </span>
            </td>
            <td>
              ${canManage ? `
                <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                  <button class="btn btn-sm btn-secondary editUserBtn" data-id="${u.id}" title="Edit User">✏️ Edit</button>
                  <button class="btn btn-sm btn-outline-warning resetPassBtn" data-id="${u.id}" data-username="${esc(u.username)}" title="Reset Password">🔑 Password</button>
                  ${(u.role === 'superadmin' || String(u.username).toLowerCase().trim() === 'superadmin') ? `
                    <span class="badge badge-secondary" style="font-size:11px;opacity:0.85;" title="Superadmin account cannot be disabled or deleted">🔒 Protected Core Admin</span>
                  ` : `
                    <button class="btn btn-sm btn-secondary toggleUserBtn" data-id="${u.id}" data-active="${u.is_active}" title="${u.is_active ? 'Disable User' : 'Enable User'}">
                      ${u.is_active ? '🚫 Disable' : '✅ Enable'}
                    </button>
                    <button class="btn btn-sm btn-outline-danger deleteUserBtn" data-id="${u.id}" data-username="${esc(u.username)}" title="Delete User">🗑️ Delete</button>
                  `}
                </div>
              ` : `<span style="font-size:12px;color:var(--text3);">Read Only</span>`}
            </td>
          </tr>
        `,

        onRender: () => {
          if (!canManage) return;
          const tb = document.getElementById("usersTableBody");
          if (!tb) return;

          tb.querySelectorAll(".editUserBtn").forEach(btn => {
            btn.addEventListener("click", () => {
              const user = fetchedUsers.find(u => u.id == btn.dataset.id);
              if (!user) return;

              document.getElementById("userModalTitle").textContent = `Edit User Account #${user.id}`;
              document.getElementById("uEditId").value = user.id;
              document.getElementById("uUsername").value = user.username || "";
              document.getElementById("uCompanyId").value = user.company_id || "";
              document.getElementById("uRole").value = user.role || "storeadmin";
              document.getElementById("uEmail").value = user.email || "";
              document.getElementById("uPhone").value = user.phone || "";
              
              const passInput = document.getElementById("uPassword");
              passInput.value = "";
              passInput.required = false;
              document.getElementById("uPassLabel").textContent = "Password (Optional)";
              document.getElementById("uPassHint").style.display = "block";
              document.getElementById("userSubmitBtn").textContent = "Save Changes";

              document.getElementById("userModal").style.display = "flex";
            });
          });

          tb.querySelectorAll(".resetPassBtn").forEach(btn => {
            btn.addEventListener("click", () => {
              document.getElementById("resetPassUserId").value = btn.dataset.id;
              document.getElementById("resetPassUsername").value = btn.dataset.username;
              document.getElementById("resetNewPass").value = "";
              document.getElementById("resetPassModal").style.display = "flex";
            });
          });

          tb.querySelectorAll(".toggleUserBtn").forEach(btn => {
            btn.addEventListener("click", async () => {
              if (btn.disabled) return;
              const origHtml = btn.innerHTML;
              btn.disabled = true;
              btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
              const uId = btn.dataset.id;
              const active = btn.dataset.active === "true";
              try {
                const res = await fetch(`${API_BASE}/super?action=user-toggle-active`, {
                  method: "POST",
                  headers: authHeaders(),
                  body: JSON.stringify({ user_id: uId, is_active: !active })
                });
                const d = await res.json();
                if (d.success) { showToast(d.message, "success"); fetchUsers(); }
                else {
                  showToast(d.error, "error");
                  btn.disabled = false;
                  btn.innerHTML = origHtml;
                }
              } catch (err) {
                showToast("Error: " + err.message, "error");
                btn.disabled = false;
                btn.innerHTML = origHtml;
              }
            });
          });

          tb.querySelectorAll(".deleteUserBtn").forEach(btn => {
            btn.addEventListener("click", async () => {
              const uId = btn.dataset.id;
              const uName = btn.dataset.username;
              if (!confirm(`Are you sure you want to delete user account '${uName}'?\nThis action cannot be undone.`)) return;
              if (btn.disabled) return;
              const origHtml = btn.innerHTML;
              btn.disabled = true;
              btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

              try {
                const res = await fetch(`${API_BASE}/super?action=user-delete`, {
                  method: "POST",
                  headers: authHeaders(),
                  body: JSON.stringify({ user_id: uId })
                });
                const d = await res.json();
                if (d.success) {
                  showToast(d.message, "success");
                  fetchUsers();
                } else {
                  showToast(d.error || "Failed to delete user", "error");
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
      });

    } catch (err) {
      showToast("Fetch users error: " + err.message, "error");
    }
  }

  if (canManage) {
    on("addUserBtn", "click", () => {
      document.getElementById("userModalTitle").textContent = "Create New User Account";
      document.getElementById("uEditId").value = "";
      document.getElementById("userForm").reset();
      
      const passInput = document.getElementById("uPassword");
      passInput.required = true;
      document.getElementById("uPassLabel").textContent = "Password *";
      document.getElementById("uPassHint").style.display = "none";
      document.getElementById("userSubmitBtn").textContent = "Create User";

      document.getElementById("userModal").style.display = "flex";
    });

    on("userModalClose", "click", () => { document.getElementById("userModal").style.display = "none"; });
    on("userModalCancel", "click", () => { document.getElementById("userModal").style.display = "none"; });

    on("userForm", "submit", async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector("button[type='submit']");
      if (submitBtn && submitBtn.disabled) return;
      const origHtml = submitBtn ? submitBtn.innerHTML : "Save User";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving...`;
      }

      const editId = document.getElementById("uEditId").value;
      const payload = {
        username: document.getElementById("uUsername").value.trim(),
        password: document.getElementById("uPassword").value.trim(),
        company_id: document.getElementById("uCompanyId").value || null,
        role: document.getElementById("uRole").value,
        email: document.getElementById("uEmail").value.trim(),
        phone: document.getElementById("uPhone").value.trim(),
      };

      if (editId) {
        payload.user_id = editId;
      }

      const action = editId ? "user-update" : "user-create";
      try {
        const res = await fetch(`${API_BASE}/super?action=${action}`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, "success");
          document.getElementById("userModal").style.display = "none";
          fetchUsers();
        } else showToast(data.error || "Failed to save user", "error");
      } catch (err) {
        showToast("Error: " + err.message, "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origHtml;
        }
      }
    });

    // Reset Password Modal Listeners
    on("resetPassModalClose", "click", () => { document.getElementById("resetPassModal").style.display = "none"; });
    on("resetPassCancel", "click", () => { document.getElementById("resetPassModal").style.display = "none"; });

    on("resetPassForm", "submit", async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector("button[type='submit']");
      if (submitBtn && submitBtn.disabled) return;
      const origHtml = submitBtn ? submitBtn.innerHTML : "Update Password";

      const uId = document.getElementById("resetPassUserId").value;
      const newPass = document.getElementById("resetNewPass").value.trim();
      if (!uId || !newPass) return;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Updating...`;
      }

      try {
        const res = await fetch(`${API_BASE}/super?action=user-reset-password`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ user_id: uId, new_password: newPass })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, "success");
          document.getElementById("resetPassModal").style.display = "none";
          fetchUsers();
        } else {
          showToast(data.error || "Failed to reset password", "error");
        }
      } catch (err) {
        showToast("Password reset error: " + err.message, "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origHtml;
        }
      }
    });
  }

  fetchUsers();
}

// ── SubTab 4: Controls & Toggles ──
async function loadControlsSubTab() {
  const subContent = document.getElementById("superpanelSubContent");
  subContent.innerHTML = `
    <div style="max-width:700px;">
      <h3 style="font-size:16px;font-weight:600;color:var(--text1);margin-bottom:12px;">Global System Controls & Feature Locks</h3>
      
      <div class="card" style="background:var(--bg-primary);margin-bottom:16px;">
        <div style="font-weight:600;color:var(--primary-light);margin-bottom:8px;">🔒 Capital Amount Modification Policy</div>
        <p style="font-size:13px;color:var(--text3);margin-bottom:12px;">
          When disabled, Accountants and Storeadmins cannot edit or change the company capital entry. Only Superadmin can modify.
        </p>
        <div id="companyCapitalToggles">
          <div class="spinner"></div> Loading company toggles...
        </div>
      </div>
    </div>
  `;

  const container = document.getElementById("companyCapitalToggles");
  container.innerHTML = currentCompanies.map(c => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(148,163,184,0.1);">
      <div>
        <div style="font-weight:500;color:var(--text1);">${esc(c.name)}</div>
        <div style="font-size:11px;color:var(--text3);">${esc(c.city || 'Location')} | GST: ${esc(c.gstin || 'N/A')}</div>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" class="ctrlCapitalToggle" data-id="${c.id}" ${c.capital_editable ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </div>
  `).join("");

  container.querySelectorAll(".ctrlCapitalToggle").forEach(chk => {
    chk.addEventListener("change", async () => {
      const cId = chk.dataset.id;
      const editable = chk.checked;
      const res = await fetch(`${API_BASE}/super?action=capital-toggle`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ company_id: cId, capital_editable: editable })
      });
      const d = await res.json();
      if (d.success) showToast(d.message, "success");
      else { showToast(d.error, "error"); chk.checked = !editable; }
    });
  });
}

// ═══════════════════════════════════════════════════
// 3. WORK MANAGEMENT (ACTIVITY & ONLINE STATUS MONITOR)
// ═══════════════════════════════════════════════════

async function renderWorkManagementUI(container) {
  const compId = selectedCompanyId || "all";
  container.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
        <div>
          <h2 style="font-size:18px;font-weight:600;color:var(--text1);">📡 Work Management & Employee Activity Status</h2>
          <p style="font-size:13px;color:var(--text3);margin-top:2px;">Real-time tracking of employee login activity, online session status, and daily attendance.</p>
        </div>
        <button class="btn btn-secondary" id="refreshWorkBtn">🔄 Refresh Status</button>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Employee Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Company</th>
              <th>Attendance Status</th>
              <th>Check-in Time</th>
              <th>Last Activity</th>
              <th>Online Status</th>
            </tr>
          </thead>
          <tbody id="workTableBody">
            <tr><td colspan="8" style="text-align:center;padding:20px;"><div class="spinner"></div> Fetching activity logs...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  async function fetchStatus() {
    try {
      const res = await fetch(`${API_BASE}/super?action=work-management-status&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      const tbody = document.getElementById("workTableBody");
      if (!tbody) return;
      tbody.innerHTML = data.users.map(u => {
        const attBadge = u.attendance_status === 'exempt'
          ? 'badge-purple'
          : u.attendance_status === 'present'
          ? 'badge-success'
          : u.attendance_status === 'late'
          ? 'badge-warning'
          : 'badge-danger';

        const attLabel = u.attendance_status === 'exempt'
          ? '⚡ Exempt / Super Admin'
          : (u.attendance_status ? u.attendance_status.replace(/_/g, ' ').toUpperCase() : 'Not Checked-in');

        const unexpBtn = (u.role !== 'superadmin' && u.employee_id && u.attendance_status !== 'leave')
          ? `<button class="btn btn-xs btn-outline markUnexpLeaveSuperBtn" data-empid="${u.employee_id}" data-empname="${esc(u.employee_name || u.username)}" data-compid="${u.company_id || ''}" style="font-size:11px;padding:2px 6px;margin-left:6px;" title="Record Unexpected Leave">🚨 Put Leave</button>`
          : '';

        return `
          <tr>
            <td style="font-weight:600;color:var(--text1);">${esc(u.employee_name || u.username)}</td>
            <td>${esc(u.username)}</td>
            <td><span class="badge badge-purple">${esc(u.role.replace(/_/g, ' '))}</span></td>
            <td>${esc(u.company_name || 'Global')}</td>
            <td><span class="badge ${attBadge}">${esc(attLabel)}</span>${unexpBtn}</td>
            <td>${esc(u.login_time || '—')}</td>
            <td>${formatDateTime(u.last_login_at)}</td>
            <td>
              <span class="badge ${u.is_online ? 'badge-success' : 'badge-danger'}" style="display:inline-flex;align-items:center;gap:4px;">
                <span style="width:8px;height:8px;border-radius:50%;background:${u.is_online ? '#10b981' : '#ef4444'};display:inline-block;"></span>
                ${esc(u.status_label)}
              </span>
            </td>
          </tr>
        `;
      }).join("");

      tbody.querySelectorAll(".markUnexpLeaveSuperBtn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const empId = btn.dataset.empid;
          const empName = btn.dataset.empname || "Employee";
          const cId = btn.dataset.compid;
          if (!confirm(`Mark Unexpected Leave for ${empName} today?`)) return;
          if (btn.disabled) return;
          const origHtml = btn.innerHTML;
          btn.disabled = true;
          btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

          try {
            const res = await fetch(`${API_BASE}/attendance?action=unexpected-leave`, {
              method: "POST",
              headers: authHeaders(),
              body: JSON.stringify({
                company_id: cId,
                employee_id: empId,
                remarks: "Unexpected Leave marked by Admin"
              })
            });
            const d = await res.json();
            if (d.success) {
              showToast(d.message || `Unexpected Leave recorded for ${empName}!`, "success");
              fetchStatus();
            } else {
              showToast(d.error || "Failed to mark unexpected leave", "error");
              btn.disabled = false;
              btn.innerHTML = origHtml;
            }
          } catch (err) {
            showToast("Error: " + err.message, "error");
            btn.disabled = false;
            btn.innerHTML = origHtml;
          }
        });
      });

    } catch (err) {
      showToast("Failed to fetch work status: " + err.message, "error");
    }
  }

  on("refreshWorkBtn", "click", async (e) => {
    const btn = e.target.closest("button") || document.getElementById("refreshWorkBtn");
    if (btn && btn.disabled) return;
    const origHtml = btn ? btn.innerHTML : "🔄 Refresh Status";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Refreshing...`;
    }
    try {
      await fetchStatus();
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  });
  fetchStatus();
}

// ═══════════════════════════════════════════════════
// 4. WORK SCHEDULE (TASK ASSIGNMENT & TRACKING)
// ═══════════════════════════════════════════════════

async function renderWorkScheduleUI(container) {
  const compId = selectedCompanyId || "all";
  container.innerHTML = `
    <!-- WORK TASK ASSIGNMENT SECTION -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
        <div>
          <h2 style="font-size:18px;font-weight:600;color:var(--text1);">📌 Assign & Track Employee Work Tasks</h2>
          <p style="font-size:13px;color:var(--text3);margin-top:2px;">Assign specific tasks, operational goals, and deadlines to employees across any company location.</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <input type="date" id="scheduleDateFilter" class="form-input" style="width:auto;" title="Filter by Date">
          <select id="scheduleStatusFilter" class="form-select" style="width:auto;">
            <option value="all">🌐 All Statuses</option>
            <option value="pending">⏳ Pending</option>
            <option value="in_progress">🚀 In Progress</option>
            <option value="completed">✅ Completed</option>
          </select>
          <button class="btn btn-secondary" id="refreshScheduleBtn">🔄 Refresh Tasks</button>
          <button class="btn btn-primary" id="openTaskModalBtn">+ Assign New Task</button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Employee Name</th>
              <th>Company</th>
              <th>Task Title & Description</th>
              <th>Priority</th>
              <th>Due Date</th>
              <th>Assigned By</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="tasksTableBody">
            <tr><td colspan="9" style="text-align:center;padding:20px;"><div class="spinner"></div> Loading assigned tasks...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ASSIGN TASK MODAL -->
    <div class="modal-overlay" id="taskModal" style="display:none;">
      <div class="modal-box" style="max-width:550px;">
        <div class="modal-header">
          <h3>Assign Work Task to Employee</h3>
          <button class="modal-close" id="taskModalClose">&times;</button>
        </div>
        <form id="assignTaskForm">
          <div class="form-group">
            <label class="form-label">Assignee Company / Location *</label>
            <select id="taskCompId" class="form-select" required>
              <option value="all">🌐 All Companies / Global</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Assignee Employee / User *</label>
            <select id="taskEmpId" class="form-select" required>
              <option value="">-- Select Employee --</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Task Title *</label>
            <input type="text" id="taskTitle" class="form-input" placeholder="e.g. Conduct monthly inventory audit for Rotavators" required>
          </div>
          <div class="form-group">
            <label class="form-label">Task Description</label>
            <textarea id="taskDesc" class="form-input" style="min-height:80px;" placeholder="Detailed instructions or expectations..."></textarea>
          </div>
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group">
              <label class="form-label">Priority</label>
              <select id="taskPriority" class="form-select">
                <option value="low">🟢 Low</option>
                <option value="medium" selected>🟡 Medium</option>
                <option value="high">🟠 High</option>
                <option value="urgent">🔴 Urgent</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Target Due Date</label>
              <input type="date" id="taskDueDate" class="form-input" value="${today()}">
            </div>
          </div>
          <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" class="btn btn-secondary" id="taskModalCancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Assign Task</button>
          </div>
        </form>
      </div>
    </div>
  `;

  async function fetchTasks() {
    try {
      const dateVal = document.getElementById("scheduleDateFilter") ? document.getElementById("scheduleDateFilter").value : "";
      const statusVal = document.getElementById("scheduleStatusFilter") ? document.getElementById("scheduleStatusFilter").value : "all";

      let queryParams = [`company_id=${compId}`];
      if (dateVal) queryParams.push(`date=${encodeURIComponent(dateVal)}`);
      if (statusVal && statusVal !== 'all') queryParams.push(`status=${encodeURIComponent(statusVal)}`);
      const queryString = queryParams.join('&');

      const res = await fetch(`${API_BASE}/super?action=tasks-list&${queryString}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      const tbody = document.getElementById("tasksTableBody");
      if (!tbody) return;
      if (data.tasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:20px;">No work tasks found. Click "+ Assign New Task" to create one.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.tasks.map(t => {
        const priorityBadge = t.priority === 'urgent' ? 'badge-error' : t.priority === 'high' ? 'badge-warning' : t.priority === 'medium' ? 'badge-info' : 'badge-neutral';
        const statusBadge = t.status === 'completed' ? 'badge-success' : t.status === 'in_progress' ? 'badge-warning' : 'badge-info';
        return `
          <tr>
            <td>#${t.id}</td>
            <td style="font-weight:600;color:var(--text1);">${esc(t.employee_name || 'Unassigned')}</td>
            <td>${esc(t.company_name || '—')}</td>
            <td>
              <div style="font-weight:600;color:var(--text1);">${esc(t.title)}</div>
              ${t.description ? `<div style="font-size:12px;color:var(--text3);margin-top:2px;">${esc(t.description)}</div>` : ''}
            </td>
            <td><span class="badge ${priorityBadge}">${esc(t.priority.toUpperCase())}</span></td>
            <td>${formatDate(t.due_date)}</td>
            <td>${esc(t.assigned_by_name || 'Admin')}</td>
            <td><span class="badge ${statusBadge}">${esc(t.status.replace(/_/g, ' ').toUpperCase())}</span></td>
            <td>
              <select class="form-select taskStatusSelect" data-id="${t.id}" style="padding:4px 8px;font-size:12px;">
                <option value="pending" ${t.status === 'pending' ? 'selected' : ''}>Pending</option>
                <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                <option value="completed" ${t.status === 'completed' ? 'selected' : ''}>Completed</option>
              </select>
            </td>
          </tr>
        `;
      }).join("");

      tbody.querySelectorAll(".taskStatusSelect").forEach(sel => {
        sel.addEventListener("change", async () => {
          const taskId = sel.dataset.id;
          const status = sel.value;
          const res = await fetch(`${API_BASE}/super?action=task-update-status`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ task_id: taskId, status })
          });
          const d = await res.json();
          if (d.success) { showToast(d.message, "success"); fetchTasks(); }
          else showToast(d.error, "error");
        });
      });

    } catch (err) {
      showToast("Error fetching tasks: " + err.message, "error");
    }
  }

  async function populateEmployeeSelect(targetCompanyId) {
    const sel = document.getElementById("taskEmpId");
    if (!sel) return;
    sel.innerHTML = `<option value="">Loading user accounts & employees...</option>`;
    try {
      const selectedCompany = targetCompanyId || "all";
      const res = await fetch(`${API_BASE}/super?action=assignees-list&company_id=${selectedCompany}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success || !Array.isArray(data.assignees)) {
        sel.innerHTML = `<option value="">-- No Users Found --</option>`;
        return;
      }

      if (data.assignees.length === 0) {
        sel.innerHTML = `<option value="">-- No Users/Employees in Selected Company --</option>`;
      } else {
        sel.innerHTML = `<option value="">-- Select Assignee Employee / User --</option>` +
          data.assignees.map(a => {
            const roleLabel = a.role ? a.role.replace(/_/g, ' ') : 'employee';
            return `<option value="${a.user_id}" data-userid="${a.user_id}" data-empid="${a.employee_id || ''}">${esc(a.name)} (${esc(roleLabel)}) — ${esc(a.company_name)}</option>`;
          }).join("");
      }
    } catch (err) {
      sel.innerHTML = `<option value="">-- Failed to Load Assignees --</option>`;
    }
  }

  on("openTaskModalBtn", "click", () => {
    const taskCompSelect = document.getElementById("taskCompId");
    if (taskCompSelect) {
      taskCompSelect.innerHTML = `<option value="all">🌐 All Companies / Global</option>` +
        currentCompanies.map(c => `<option value="${c.id}" ${c.id == compId ? 'selected' : ''}>${esc(c.name)}</option>`).join("");
      populateEmployeeSelect(taskCompSelect.value);
    }
    document.getElementById("assignTaskForm").reset();
    document.getElementById("taskModal").style.display = "flex";
  });

  const taskCompSelectEl = document.getElementById("taskCompId");
  if (taskCompSelectEl) {
    taskCompSelectEl.addEventListener("change", (e) => {
      populateEmployeeSelect(e.target.value);
    });
  }

  on("taskModalClose", "click", () => { document.getElementById("taskModal").style.display = "none"; });
  on("taskModalCancel", "click", () => { document.getElementById("taskModal").style.display = "none"; });

  on("assignTaskForm", "submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn && submitBtn.disabled) return;
    const origHtml = submitBtn ? submitBtn.innerHTML : "Assign Task";

    const taskCompVal = document.getElementById("taskCompId").value;
    const empSelect = document.getElementById("taskEmpId");
    const selectedOpt = empSelect.options[empSelect.selectedIndex];

    if (!selectedOpt || !selectedOpt.value) {
      showToast("Please select an assignee user or employee", "error");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Assigning...`;
    }

    const userId = selectedOpt.getAttribute("data-userid");
    const empId = selectedOpt.getAttribute("data-empid");

    const payload = {
      company_id: taskCompVal === "all" ? null : parseInt(taskCompVal),
      user_id: userId ? parseInt(userId) : null,
      employee_id: empId ? parseInt(empId) : null,
      title: document.getElementById("taskTitle").value.trim(),
      description: document.getElementById("taskDesc").value.trim(),
      priority: document.getElementById("taskPriority").value,
      due_date: document.getElementById("taskDueDate").value,
    };

    try {
      const res = await fetch(`${API_BASE}/super?action=task-create`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "success");
        document.getElementById("taskModal").style.display = "none";
        fetchTasks();
      } else showToast(data.error || "Failed to assign task", "error");
    } catch (err) {
      showToast("Error: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    }
  });

  on("refreshScheduleBtn", "click", async (e) => {
    const btn = e.target.closest("button") || document.getElementById("refreshScheduleBtn");
    if (btn && btn.disabled) return;
    const origHtml = btn ? btn.innerHTML : "🔄 Refresh Tasks";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Refreshing...`;
    }
    try {
      await fetchTasks();
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  });

  const schedDateEl = document.getElementById("scheduleDateFilter");
  if (schedDateEl) schedDateEl.addEventListener("change", fetchTasks);

  const schedStatusEl = document.getElementById("scheduleStatusFilter");
  if (schedStatusEl) schedStatusEl.addEventListener("change", fetchTasks);

  fetchTasks();
}
