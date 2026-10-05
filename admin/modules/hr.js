// ═══════════════════════════════════════════════════
// BUSINESS ERP — hr.js
// HR & Employee Management, Attendance, Leave Processing,
// Monthly Payroll & Salary Deductions, Salary Advances, dealers, Financers, Customers
// ═══════════════════════════════════════════════════

window.renderHRModule = async function (tabKey, container) {
  if (tabKey === 'gen_apply_leave') {
    container.innerHTML = `
      <div class="card" style="padding:24px;" id="hrSubContent"></div>
    `;
    await loadLeaveSubTab(true);
    return;
  }

  const isToday = tabKey === 'hr_today_tasks' || tabKey === 'hr_tasks';
  const isEmp = tabKey === 'hr_employees' || tabKey === 'employees';
  const isdealer = tabKey === 'hr_dealers' || tabKey === 'dealers';
  const isFinancer = tabKey === 'hr_financers' || tabKey === 'financers';
  const isCust = tabKey === 'hr_customers' || tabKey === 'customers';
  const isAtt = tabKey === 'hr_attendance' || tabKey === 'attendance';
  const isLeave = tabKey === 'hr_leave_mgmt' || tabKey === 'leaves' || tabKey === 'gen_apply_leave';
  const isSalary = tabKey === 'hr_process_salary' || tabKey === 'payroll';
  const isAdv = tabKey === 'hr_advances' || tabKey === 'advances';
  const isPayslip = tabKey === 'hr_payslips' || tabKey === 'payslips';
  const isInc = tabKey === 'hr_incentives' || tabKey === 'incentives';
  const isReports = tabKey === 'hr_reports' || tabKey === 'reports';

  const isDefaultEmp = !isToday && !isEmp && !isdealer && !isFinancer && !isCust && !isAtt && !isLeave && !isSalary && !isAdv && !isPayslip && !isInc && !isReports;

  container.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;">
      <div class="sub-tabs-bar">
        <button class="sub-tab ${isToday ? 'active' : ''}" data-tabkey="hr_today_tasks">📋 Today Tasks</button>
        <button class="sub-tab ${(isEmp || isDefaultEmp) ? 'active' : ''}" data-tabkey="hr_employees">👤 Employees</button>
        <button class="sub-tab ${isdealer ? 'active' : ''}" data-tabkey="hr_dealers">🏪 dealers</button>
        <button class="sub-tab ${isFinancer ? 'active' : ''}" data-tabkey="hr_financers">🏛️ Financers</button>
        <button class="sub-tab ${isCust ? 'active' : ''}" data-tabkey="hr_customers">🧑 Customers</button>
        <button class="sub-tab ${isAtt ? 'active' : ''}" data-tabkey="hr_attendance">📅 Attendance</button>
        <button class="sub-tab ${isLeave ? 'active' : ''}" data-tabkey="hr_leave_mgmt">🏖️ Leave Management</button>
        <button class="sub-tab ${isSalary ? 'active' : ''}" data-tabkey="hr_process_salary">💵 Process Salaries</button>
        <button class="sub-tab ${isAdv ? 'active' : ''}" data-tabkey="hr_advances">💳 Salary Advances</button>
        <button class="sub-tab ${isPayslip ? 'active' : ''}" data-tabkey="hr_payslips">🧾 Payslips</button>
        <button class="sub-tab ${isInc ? 'active' : ''}" data-tabkey="hr_incentives">🎁 Release Incentives</button>
        <button class="sub-tab ${isReports ? 'active' : ''}" data-tabkey="hr_reports">📊 Reports</button>
      </div>

      <div style="padding:24px;" id="hrSubContent">
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

  const subArea = document.getElementById("hrSubContent");
  if (isToday) {
    if (window.renderTodayTasksModule) await window.renderTodayTasksModule('hr_today_tasks', subArea);
    else loadEmployeesSubTab();
  }
  else if (isdealer) loaddealersSubTab();
  else if (isFinancer) loadFinancersSubTab();
  else if (isCust) loadCustomersSubTab();
  else if (isAtt) loadAttendanceSubTab();
  else if (isLeave) loadLeaveSubTab(tabKey === 'gen_apply_leave');
  else if (isSalary) loadPayrollSubTab(false);
  else if (isPayslip) loadPayrollSubTab(true);
  else if (isAdv) loadAdvancesSubTab();
  else if (isInc) loadIncentivesSubTab();
  else loadEmployeesSubTab();
};

if (window.registerModuleRoute) {
  window.registerModuleRoute(
    [
      'hr', 'employees', 'dealers', 'financers', 'customers', 'attendance', 'leaves', 'payroll', 'advances', 'payslips', 'incentives',
      'hr_today_tasks', 'hr_employees', 'hr_dealers', 'hr_financers', 'hr_customers',
      'hr_attendance', 'hr_leave_mgmt', 'hr_process_salary', 'hr_advances', 'hr_payslips',
      'hr_reports', 'hr_incentives', 'gen_apply_leave'
    ],
    window.renderHRModule
  );
}



// ── Helper: Get Active Company ID Scoped by Role ──
function getActiveCompId() {
  const userObj = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null) || (typeof getUser === 'function' ? getUser() : null);
  const userRole = (userObj?.role || '').toLowerCase();
  const isSuperAdmin = (userRole === 'superadmin' || userObj?.username === 'superadmin');

  if (!isSuperAdmin) {
    return userObj?.company_id ? parseInt(userObj.company_id) : 1;
  }
  if (selectedCompanyId && selectedCompanyId !== 'all') {
    return parseInt(selectedCompanyId);
  }
  return 'all';
}

// ═══════════════════════════════════════════════════
// 1. EMPLOYEES SUBTAB
// ═══════════════════════════════════════════════════

async function safeGetCompaniesOptionsHtml(selectedId = null) {
  if (typeof window.getCompaniesOptionsHtml === 'function') {
    return await window.getCompaniesOptionsHtml(selectedId);
  }
  if (typeof getCompaniesOptionsHtml === 'function') {
    return await getCompaniesOptionsHtml(selectedId);
  }
  return `<option value="1">Default Company</option>`;
}

async function loadEmployeesSubTab() {
  const subContent = document.getElementById("hrSubContent");
  const compId = getActiveCompId();
  const loggedUser = getUser() || {};
  const isSuperAdmin = loggedUser.role === "superadmin" || loggedUser.username === "superadmin";

  const compIdToUse = compId !== "all" ? parseInt(compId) : (currentCompanies[0]?.id || 1);
  const userCompObj = (window.currentCompanies || currentCompanies || []).find(c => c.id == compIdToUse) || (currentCompanies[0] || { name: 'Main Company' });
  const userCompName = userCompObj.name || 'Main Company';
  const compOptionsHtml = await safeGetCompaniesOptionsHtml(compId !== 'all' ? compId : null);

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h3 style="font-size:16px;font-weight:600;color:var(--text1);">Employee Directory</h3>
      <button class="btn btn-primary" id="addEmpBtn">+ Add Employee</button>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Company</th>
            <th>Department</th>
            <th>Designation</th>
            <th>Phone</th>
            <th>Basic Salary</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="empTableBody">
          <tr><td colspan="9" style="text-align:center;padding:20px;"><div class="spinner"></div> Loading employees...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;flex-wrap:wrap;gap:8px;">
      <div id="empInfo"></div>
      <div id="empPagination" class="pagination"></div>
    </div>

    <!-- ADD EMPLOYEE MODAL -->
    <div class="modal-overlay" id="empModal" style="display:none;">
      <div class="modal-box" style="max-width:650px;">
        <div class="modal-header">
          <h3>Add New Employee</h3>
          <button class="modal-close" id="empModalClose">&times;</button>
        </div>
        <form id="empForm">
          <div class="modal-body">
            <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group" style="grid-column: span 2;">
                <label class="form-label">Company / Branch *</label>
                ${isSuperAdmin ? `
                  <select id="eCompanyId" class="form-select" style="font-weight:600;">
                    ${compOptionsHtml}
                  </select>
                ` : `
                  <div style="font-weight:700;padding:8px 12px;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;color:var(--text1);font-size:13px;">
                    🏢 ${esc(userCompName)}
                    <input type="hidden" id="eCompanyId" value="${compIdToUse}">
                  </div>
                `}
              </div>
              <div class="form-group">
                <label class="form-label">Employee Name *</label>
                <input type="text" id="eName" class="form-input" required placeholder="John Doe">
              </div>
              <div class="form-group">
                <label class="form-label">Employee Code <span style="font-size:11px;color:var(--text3);">(Auto-Generated)</span></label>
                <input type="text" id="eCode" class="form-input" readonly disabled value="⚡ Auto-Generated per Company" style="background:var(--bg-secondary, #f1f5f9);color:var(--text2);cursor:not-allowed;font-weight:600;">
              </div>
              <div class="form-group">
                <label class="form-label">Phone *</label>
                <input type="text" id="ePhone" class="form-input" required placeholder="+91 9876543210">
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" id="eEmail" class="form-input" placeholder="john@example.com">
              </div>
              <div class="form-group">
                <label class="form-label">Department *</label>
                <select id="eDept" class="form-select" required style="font-weight:600;">
                  <option value="">-- Select Department --</option>
                  <option value="Sales">Sales & Showroom</option>
                  <option value="Service">Service & Workshop</option>
                  <option value="Mechanics">Mechanics & Technical</option>
                  <option value="HR">HR & Administration</option>
                  <option value="Store Admin">Store Management</option>
                  <option value="Accounts">Accounts & Finance</option>
                  <option value="Inventory">Inventory & Spare Parts</option>
                  <option value="General Staff">General Staff / Other</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Designation</label>
                <input type="text" id="eDesig" class="form-input" placeholder="Technician / Staff">
              </div>
              <div class="form-group">
                <label class="form-label">Joining Date</label>
                <input type="date" id="eDate" class="form-input">
              </div>
              <div class="form-group">
                <label class="form-label">Basic Salary (₹) *</label>
                <input type="number" step="0.01" id="eSalary" class="form-input" required placeholder="25000">
              </div>
              <div class="form-group">
                <label class="form-label">Bank Name</label>
                <input type="text" id="eBank" class="form-input" placeholder="State Bank of India">
              </div>
              <div class="form-group">
                <label class="form-label">Account Number</label>
                <input type="text" id="eAcc" class="form-input" placeholder="38920192019">
              </div>
              <div class="form-group" style="grid-column: span 2;">
                <label class="form-label">Address</label>
                <input type="text" id="eAddress" class="form-input" placeholder="City, State">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="empModalCancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Employee</button>
          </div>
        </form>
      </div>
    </div>

    <!-- USER ONLINE ACCESS MODAL -->
    <div class="modal-overlay" id="userAccessModal" style="display:none;">
      <div class="modal-box" style="max-width:520px;">
        <div class="modal-header">
          <h3 id="uaModalTitle">🔑 Grant / Reset Online Login Access</h3>
          <button class="modal-close" id="uaModalClose">&times;</button>
        </div>
        <form id="userAccessForm">
          <input type="hidden" id="uaEmpId">
          <div style="background:var(--bg-secondary);padding:12px 14px;border-radius:8px;border:1px solid var(--border);margin-bottom:14px;">
            <div style="font-size:14px;font-weight:700;color:var(--text1);" id="uaEmpName">—</div>
            <div style="font-size:12px;color:var(--text3);" id="uaEmpMeta">—</div>
          </div>
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">Username for Online Login *</label>
            <input type="text" id="uaUsername" class="form-input" required placeholder="e.g. john_doe or EMP001">
            <span style="font-size:11px;color:var(--text3);">Employee will use this username to log into the ERP web application</span>
          </div>
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">Set Login Password *</label>
            <input type="password" id="uaPassword" class="form-input" required placeholder="Enter password (min 3 chars)">
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">System Role Access *</label>
            <select id="uaRole" class="form-select" style="font-weight:600;">
              <option value="staff">General Staff / Employee</option>
              <option value="sales">Sales & Showroom</option>
              <option value="service">Service & Workshop / Mechanic</option>
              <option value="hr">HR & Administration</option>
              <option value="storeadmin">Store Management / Admin</option>
              <option value="accountant">Accounts & Finance</option>
            </select>
          </div>
          <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" class="btn btn-secondary" id="uaModalCancel">Cancel</button>
            <button type="submit" class="btn btn-primary" style="font-weight:600;">🔑 Save & Enable Login Access</button>
          </div>
        </form>
      </div>
    </div>
  `;

  let empList = [];

  async function fetchEmployees() {
    try {
      const res = await fetch(`${API_BASE}/employees?action=list&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      empList = data.employees || [];
      if (!isSuperAdmin) {
        empList = empList.filter(e => {
          const nm = String(e.name || "").toLowerCase().trim();
          const dp = String(e.department || "").toLowerCase().trim();
          return nm !== "superadmin" && dp !== "superadmin";
        });
      }

      const tbody = document.getElementById("empTableBody");
      if (!tbody) return;
      if (empList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text3);">No employees found. Click + Add Employee above.</td></tr>`;
        if (document.getElementById("empInfo")) document.getElementById("empInfo").innerHTML = "";
        if (document.getElementById("empPagination")) document.getElementById("empPagination").innerHTML = "";
        return;
      }

      window.renderPaginatedTable({
        data: empList,
        pageSize: 10,
        currentPage: 1,
        tbody: "empTableBody",
        paginationContainer: "empPagination",
        infoContainer: "empInfo",
        renderRow: (e) => {
          const deptStr = (e.department || '').toLowerCase().trim();
          const desigStr = (e.designation || '').toLowerCase().trim();
          const roleStr = (e.user_role || '').toLowerCase().trim();
          
          const hasOnlineAccess = Boolean(e.user_id || e.sys_user_id);
          const isOnlineActive = e.sys_user_active !== false;

          const isSelf = Boolean(
            (loggedUser.id && (e.user_id == loggedUser.id || e.sys_user_id == loggedUser.id)) ||
            (loggedUser.employee_id && e.id == loggedUser.employee_id) ||
            (loggedUser.username && String(e.name || '').toLowerCase().trim() === String(loggedUser.username).toLowerCase().trim())
          );
          const isSuperAdminRow = String(e.name || '').toLowerCase().trim() === 'superadmin' || deptStr === 'superadmin' || desigStr === 'superadmin' || roleStr === 'superadmin';

          const canEdit = isSuperAdmin ? true : (!isSelf && !isSuperAdminRow);
          const canDelete = !isSuperAdminRow && (isSuperAdmin ? true : !isSelf);

          let accessBadge = '';
          if (hasOnlineAccess && isOnlineActive) {
            accessBadge = `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(99,102,241,0.15);color:#818cf8;margin-left:4px;" title="User: ${esc(e.sys_username || e.name)}">🔑 System User</span>`;
          } else if (hasOnlineAccess && !isOnlineActive) {
            accessBadge = `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(239,68,68,0.15);color:#ef4444;margin-left:4px;" title="Online Login Disabled">🚫 Access Disabled</span>`;
          }

          return `
            <tr>
              <td><span class="badge badge-purple">${esc(e.employee_code || 'EMP-' + e.id)}</span></td>
              <td style="font-weight:600;color:var(--text1);">
                ${esc(e.name)}
                ${accessBadge}
                ${isSelf ? '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(234,179,8,0.15);color:#eab308;margin-left:4px;">👤 You</span>' : ''}
              </td>
              <td><span class="badge badge-outline" style="font-weight:600;">${esc(e.company_name || 'Main')}</span></td>
              <td>${esc(e.department || '—')}</td>
              <td>${esc(e.designation || '—')}</td>
              <td>${esc(e.phone || '—')}</td>
              <td style="font-weight:600;color:var(--success);">${formatCurrency(e.basic_salary)}</td>
              <td><span class="badge badge-success">${esc(e.employment_status || 'active')}</span></td>
              <td>
                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                  ${canEdit ? `<button class="btn btn-sm btn-outline editEmpBtn" data-id="${e.id}">✏️ Edit</button>` : ''}
                  ${(!hasOnlineAccess || !isOnlineActive) ? `
                    <button class="btn btn-sm btn-primary enableAccessBtn" data-id="${e.id}" style="font-size:11px;padding:3px 8px;">🔑 Enable Access</button>
                  ` : `
                    <button class="btn btn-sm btn-outline resetAccessBtn" data-id="${e.id}" style="font-size:11px;padding:3px 8px;">🔑 Reset Pass</button>
                    ${(!isSelf && !isSuperAdminRow) ? `
                      <button class="btn btn-sm btn-outline-danger disableAccessBtn" data-id="${e.id}" data-name="${esc(e.name)}" style="font-size:11px;padding:3px 8px;color:#ef4444;border-color:rgba(239,68,68,0.3);">🔒 Disable</button>
                    ` : ''}
                  `}
                  ${canDelete ? `<button class="btn btn-sm btn-outline-danger deleteEmpBtn" data-id="${e.id}" data-name="${esc(e.name)}" style="color:#ef4444;border-color:rgba(239,68,68,0.3);">🗑️ Delete</button>` : ''}
                  ${isSelf && !isSuperAdminRow ? `<span class="badge badge-secondary" style="font-size:11px;opacity:0.85;" title="You cannot edit or delete your own logged-in profile">🔒 Self Profile</span>` : ''}
                  ${isSuperAdminRow ? `<span class="badge badge-secondary" style="font-size:11px;opacity:0.85;" title="Superadmin profile cannot be deleted">🔒 Core Superadmin</span>` : ''}
                </div>
              </td>
            </tr>
          `;
        },
        onRender: () => {
          const tb = document.getElementById("empTableBody");
          if (!tb) return;
          tb.querySelectorAll(".editEmpBtn").forEach(btn => {
            btn.addEventListener("click", () => {
              const empObj = empList.find(x => x.id == btn.dataset.id);
              if (empObj) openEditEmpModal(empObj);
            });
          });

          tb.querySelectorAll(".enableAccessBtn, .resetAccessBtn").forEach(btn => {
            btn.addEventListener("click", () => {
              const empObj = empList.find(x => x.id == btn.dataset.id);
              if (empObj) openUserAccessModal(empObj);
            });
          });

          tb.querySelectorAll(".disableAccessBtn").forEach(btn => {
            btn.addEventListener("click", async () => {
              const empId = btn.dataset.id;
              const empName = btn.dataset.name || "this employee";
              if (!confirm(`Are you sure you want to DISABLE online login access for employee '${empName}'?`)) return;

              btn.disabled = true;
              btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Disabling...`;
              try {
                const res = await fetch(`${API_BASE}/employees?action=disable-user-access`, {
                  method: "POST",
                  headers: authHeaders(),
                  body: JSON.stringify({ employee_id: empId })
                });
                const data = await res.json();
                if (data.success) {
                  showToast(data.message || "Online login access disabled!", "success");
                  fetchEmployees();
                } else {
                  showToast(data.error || "Failed to disable access", "error");
                  btn.disabled = false;
                  btn.innerHTML = "🔒 Disable";
                }
              } catch (err) {
                showToast("Disable access error: " + err.message, "error");
                btn.disabled = false;
                btn.innerHTML = "🔒 Disable";
              }
            });
          });

          tb.querySelectorAll(".deleteEmpBtn").forEach(btn => {
            btn.addEventListener("click", async () => {
              const empId = btn.dataset.id;
              const empName = btn.dataset.name || "this employee";
              if (!confirm(`Are you sure you want to delete employee '${empName}'?`)) return;

              btn.disabled = true;
              btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Deleting...`;
              try {
                const res = await fetch(`${API_BASE}/employees?action=delete&id=${empId}`, {
                  method: "POST",
                  headers: authHeaders()
                });
                const data = await res.json();
                if (data.success) {
                  showToast(data.message || "Employee deleted successfully!", "success");
                  fetchEmployees();
                } else {
                  showToast(data.error || "Failed to delete employee", "error");
                  btn.disabled = false;
                  btn.innerHTML = "🗑️ Delete";
                }
              } catch (err) {
                showToast("Delete employee error: " + err.message, "error");
                btn.disabled = false;
                btn.innerHTML = "🗑️ Delete";
              }
            });
          });
        }
      });

    } catch (err) {
      showToast("Fetch employees error: " + err.message, "error");
    }

  }

  function openEditEmpModal(empObj) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;";

    overlay.innerHTML = `
      <div class="modal-box" style="max-width:650px;background:var(--bg-primary);border-radius:12px;padding:22px;border:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:16px;">
          <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">✏️ Edit Employee Details</h3>
          <button class="btn btn-sm btn-outline closeEditEmpModal">&times;</button>
        </div>
        <form id="editEmpForm">
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group" style="grid-column: span 2;">
              <label class="form-label">Assigned Company / Branch *</label>
              ${isSuperAdmin ? `
                <select id="eeCompanyId" class="form-select" style="font-weight:600;">
                  ${compOptionsHtml}
                </select>
              ` : `
                <div style="font-weight:700;padding:8px 12px;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;color:var(--text1);font-size:13px;">
                  🏢 ${esc(empObj.company_name || userCompName)}
                  <input type="hidden" id="eeCompanyId" value="${empObj.company_id || compIdToUse}">
                </div>
              `}
            </div>
            <div class="form-group">
              <label class="form-label">Employee Name *</label>
              <input type="text" id="eeName" class="form-input" required value="${esc(empObj.name || '')}">
            </div>
            <div class="form-group">
              <label class="form-label">Employee Code <span style="font-size:11px;color:var(--text3);">(System Code)</span></label>
              <input type="text" id="eeCode" class="form-input" readonly disabled value="${esc(empObj.employee_code || '')}" style="background:var(--bg-secondary, #f1f5f9);color:var(--text2);cursor:not-allowed;font-weight:600;">
            </div>
            <div class="form-group">
              <label class="form-label">Phone *</label>
              <input type="text" id="eePhone" class="form-input" required value="${esc(empObj.phone || '')}">
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" id="eeEmail" class="form-input" value="${esc(empObj.email || '')}">
            </div>
            <div class="form-group">
              <label class="form-label">Department *</label>
              <select id="eeDept" class="form-select" required style="font-weight:600;">
                <option value="">-- Select Department --</option>
                <option value="Sales" ${empObj.department === 'Sales' ? 'selected' : ''}>Sales & Showroom</option>
                <option value="Service" ${empObj.department === 'Service' ? 'selected' : ''}>Service & Workshop</option>
                <option value="Mechanics" ${empObj.department === 'Mechanics' ? 'selected' : ''}>Mechanics & Technical</option>
                <option value="HR" ${empObj.department === 'HR' ? 'selected' : ''}>HR & Administration</option>
                <option value="Store Admin" ${empObj.department === 'Store Admin' ? 'selected' : ''}>Store Management</option>
                <option value="Accounts" ${empObj.department === 'Accounts' ? 'selected' : ''}>Accounts & Finance</option>
                <option value="Inventory" ${empObj.department === 'Inventory' ? 'selected' : ''}>Inventory & Spare Parts</option>
                <option value="Management" ${empObj.department === 'Management' ? 'selected' : ''}>Superadmin / Management</option>
                <option value="General Staff" ${empObj.department === 'General Staff' ? 'selected' : ''}>General Staff / Other</option>
                ${empObj.department && !['Sales','Service','Mechanics','HR','Store Admin','Accounts','Inventory','Management','General Staff'].includes(empObj.department) ? `<option value="${esc(empObj.department)}" selected>${esc(empObj.department)}</option>` : ''}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Designation</label>
              <input type="text" id="eeDesig" class="form-input" value="${esc(empObj.designation || '')}">
            </div>
            <div class="form-group">
              <label class="form-label">Joining Date</label>
              <input type="date" id="eeDate" class="form-input" value="${empObj.joining_date ? empObj.joining_date.slice(0,10) : ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Basic Salary (₹) *</label>
              <input type="number" step="0.01" id="eeSalary" class="form-input" required value="${parseFloat(empObj.basic_salary || 0).toFixed(2)}">
            </div>
            <div class="form-group">
              <label class="form-label">Bank Name</label>
              <input type="text" id="eeBank" class="form-input" value="${esc(empObj.bank_name || '')}">
            </div>
            <div class="form-group">
              <label class="form-label">Account Number</label>
              <input type="text" id="eeAcc" class="form-input" value="${esc(empObj.bank_account || '')}">
            </div>
            <div class="form-group" style="grid-column: span 2;">
              <label class="form-label">Address</label>
              <input type="text" id="eeAddress" class="form-input" value="${esc(empObj.address || '')}">
            </div>
          </div>
          <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" class="btn btn-secondary closeEditEmpModal">Cancel</button>
            <button type="submit" class="btn btn-primary">💾 Save Changes</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);
    if (isSuperAdmin && overlay.querySelector("#eeCompanyId")) {
      overlay.querySelector("#eeCompanyId").value = empObj.company_id || 1;
    }
    overlay.querySelectorAll(".closeEditEmpModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

    overlay.querySelector("#editEmpForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector("button[type='submit']");
      if (submitBtn) {
        if (submitBtn.disabled) return;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving Changes...`;
      }

      const payload = {
        company_id: parseInt(overlay.querySelector("#eeCompanyId").value || empObj.company_id),
        employee_code: overlay.querySelector("#eeCode").value.trim(),
        name: overlay.querySelector("#eeName").value.trim(),
        phone: overlay.querySelector("#eePhone").value.trim(),
        email: overlay.querySelector("#eeEmail").value.trim(),
        department: overlay.querySelector("#eeDept").value.trim(),
        designation: overlay.querySelector("#eeDesig").value.trim(),
        joining_date: overlay.querySelector("#eeDate").value || null,
        basic_salary: overlay.querySelector("#eeSalary").value,
        bank_name: overlay.querySelector("#eeBank").value.trim(),
        bank_account: overlay.querySelector("#eeAcc").value.trim(),
        address: overlay.querySelector("#eeAddress").value.trim()
      };

      if (!isSuperAdmin) {
        const deptCheck = (payload.department || '').toLowerCase().trim();
        const desigCheck = (payload.designation || '').toLowerCase().trim();
        if (deptCheck === 'superadmin' || desigCheck === 'superadmin') {
          showToast("Superadmin roles can only be assigned by Superadmin.", "error");
          if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = "💾 Save Changes"; }
          return;
        }
      }

      try {
        const res = await fetch(`${API_BASE}/employees?action=update&id=${empObj.id}`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload)
        });
        const d = await res.json();
        if (d.success) {
          showToast(d.message || "Employee details updated successfully!", "success");
          overlay.remove();
          fetchEmployees();
        } else {
          showToast(d.error || "Failed to update employee", "error");
          if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = "💾 Save Changes"; }
        }
      } catch (err) {
        showToast("Update employee error: " + err.message, "error");
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = "💾 Save Changes"; }
      }
    });
  }

  on("addEmpBtn", "click", () => {
    const modal = document.getElementById("empModal");
    if (modal) {
      if (isSuperAdmin && modal.querySelector("#eCompanyId")) {
        const activeSel = selectedCompanyId && selectedCompanyId !== 'all' ? selectedCompanyId : 1;
        modal.querySelector("#eCompanyId").value = activeSel;
      }
      modal.style.display = "flex";
    }
  });

  on("empModalClose", "click", () => { document.getElementById("empModal").style.display = "none"; });
  on("empModalCancel", "click", () => { document.getElementById("empModal").style.display = "none"; });

  on("empForm", "submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn) {
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving Employee...`;
    }

    const compVal = document.getElementById("eCompanyId") ? document.getElementById("eCompanyId").value : (selectedCompanyId !== "all" ? selectedCompanyId : 1);
    const payload = {
      company_id: parseInt(compVal || 1),
      employee_code: document.getElementById("eCode").value.trim(),
      name: document.getElementById("eName").value.trim(),
      phone: document.getElementById("ePhone").value.trim(),
      email: document.getElementById("eEmail").value.trim(),
      department: document.getElementById("eDept").value.trim(),
      designation: document.getElementById("eDesig").value.trim(),
      joining_date: document.getElementById("eDate").value,
      basic_salary: document.getElementById("eSalary").value,
      bank_name: document.getElementById("eBank").value.trim(),
      bank_account: document.getElementById("eAcc").value.trim(),
      address: document.getElementById("eAddress").value.trim()
    };

    if (!isSuperAdmin) {
      const deptCheck = (payload.department || '').toLowerCase().trim();
      const desigCheck = (payload.designation || '').toLowerCase().trim();
      if (deptCheck === 'superadmin' || desigCheck === 'superadmin') {
        showToast("Superadmin roles can only be assigned by Superadmin.", "error");
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = "Save Employee"; }
        return;
      }
    }

    try {
      const res = await fetch(`${API_BASE}/employees?action=create`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "success");
        document.getElementById("empModal").style.display = "none";
        document.getElementById("empForm").reset();
        fetchEmployees();
      } else {
        showToast(data.error, "error");
      }
    } catch (err) {
      showToast("Error creating employee: " + err.message, "error");
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = "Save Employee"; }
    }
  });

  function openUserAccessModal(empObj) {
    document.getElementById("uaEmpId").value = empObj.id;
    document.getElementById("uaEmpName").textContent = empObj.name;
    document.getElementById("uaEmpMeta").textContent = `Code: ${empObj.employee_code || 'EMP-' + empObj.id} • Dept: ${empObj.department || 'Staff'} • Store: ${empObj.company_name || 'Main'}`;

    const defaultUsername = empObj.sys_username || empObj.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    document.getElementById("uaUsername").value = defaultUsername;
    document.getElementById("uaPassword").value = "";

    const deptStr = (empObj.department || '').toLowerCase().trim();
    const roleSel = document.getElementById("uaRole");
    if (deptStr.includes('sales')) roleSel.value = 'sales';
    else if (deptStr.includes('service') || deptStr.includes('mechanic')) roleSel.value = 'service';
    else if (deptStr.includes('hr')) roleSel.value = 'hr';
    else if (deptStr.includes('store') || deptStr.includes('admin')) roleSel.value = 'storeadmin';
    else if (deptStr.includes('account')) roleSel.value = 'accountant';
    else roleSel.value = 'staff';

    const titleEl = document.getElementById("uaModalTitle");
    if (empObj.user_id || empObj.sys_user_id) {
      titleEl.textContent = `🔑 Reset / Update Online Access for ${empObj.name}`;
    } else {
      titleEl.textContent = `🔑 Grant Online Login Access for ${empObj.name}`;
    }

    document.getElementById("userAccessModal").style.display = "flex";
  }

  on("uaModalClose", "click", () => { document.getElementById("userAccessModal").style.display = "none"; });
  on("uaModalCancel", "click", () => { document.getElementById("userAccessModal").style.display = "none"; });

  on("userAccessForm", "submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn) {
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Enabling Access...`;
    }

    const payload = {
      employee_id: parseInt(document.getElementById("uaEmpId").value),
      username: document.getElementById("uaUsername").value.trim(),
      password: document.getElementById("uaPassword").value.trim(),
      role: document.getElementById("uaRole").value
    };

    try {
      const res = await fetch(`${API_BASE}/employees?action=enable-user-access`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Online login access granted successfully!", "success");
        document.getElementById("userAccessModal").style.display = "none";
        fetchEmployees();
      } else {
        showToast(data.error || "Failed to enable online access", "error");
      }
    } catch (err) {
      showToast("Enable access error: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "🔑 Save & Enable Login Access";
      }
    }
  });

  fetchEmployees();
}

// ═══════════════════════════════════════════════════
// 2. CUSTOMERS MASTER SUBTAB
// ═══════════════════════════════════════════════════

function getCustomerStatusBadge(status) {
  const s = (status || 'inquired').toLowerCase();
  switch (s) {
    case 'inquired':
      return `<span class="badge" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;font-weight:600;">🟡 Inquired / Lead</span>`;
    case 'quotation_sent':
      return `<span class="badge" style="background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe;font-weight:600;">🔵 Quotation Issued</span>`;
    case 'negotiation':
      return `<span class="badge" style="background:#ffedd5;color:#9a3412;border:1px solid #fed7aa;font-weight:600;">🟠 In Negotiation</span>`;
    case 'converted':
    case 'purchased':
    case 'active':
      return `<span class="badge badge-success" style="font-weight:600;">🟢 Active Buyer</span>`;
    case 'inactive':
    case 'closed':
      return `<span class="badge badge-neutral" style="font-weight:600;">⚪ Inactive / Closed</span>`;
    default:
      return `<span class="badge badge-outline" style="font-weight:600;">${esc(status)}</span>`;
  }
}

async function loadCustomersSubTab() {
  const subContent = document.getElementById("hrSubContent");
  const compId = getActiveCompId();

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
      <div>
        <h3 style="font-size:16px;font-weight:600;color:var(--text1);margin:0;">Customer Directory Master</h3>
        <div style="font-size:12px;color:var(--text3);margin-top:2px;">Track customer leads, sales pipeline status, payment terms, and export filtered customer reports.</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <select id="custStatusFilter" class="form-select" style="max-width:180px;font-size:12.5px;padding:6px 10px;">
          <option value="all">-- All Statuses --</option>
          <option value="inquired">🟡 Inquired / Lead</option>
          <option value="quotation_sent">🔵 Quotation Issued</option>
          <option value="negotiation">🟠 In Negotiation</option>
          <option value="converted">🟢 Active Buyer</option>
          <option value="inactive">⚪ Inactive / Closed</option>
        </select>
        <input type="text" id="custSearchInp" class="form-input" placeholder="🔍 Search customer, phone, village, GSTIN, status, terms..." style="padding:6px 12px;font-size:12.5px;border-radius:6px;width:260px;">
        <button class="btn btn-secondary" id="exportCustExcelBtn" title="Export to Excel CSV">📥 Export Excel</button>
        <button class="btn btn-secondary" id="exportCustPdfBtn" title="Export/Print PDF Report">📄 Export PDF</button>
        <button class="btn btn-primary" id="addCustMainBtn">+ Add New Customer</button>
      </div>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th data-sort-key="name">Customer Name</th>
            <th data-sort-key="company_name">Company</th>
            <th data-sort-key="phone">Phone / Cell</th>
            <th>Email</th>
            <th data-sort-key="address">Village / Address</th>
            <th>GSTIN</th>
            <th data-sort-key="status">Sales Pipeline Status</th>
            <th data-sort-key="sales_terms">Sales / Credit Terms</th>
            <th data-sort-key="total_purchases">Total Purchases</th>
            <th data-sort-key="created_at">Registered Date</th>
            <th style="min-width:100px;text-align:center;">Actions</th>
          </tr>
        </thead>
        <tbody id="custTableBody">
          <tr><td colspan="11" style="text-align:center;padding:20px;"><div class="spinner"></div> Fetching customers...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;flex-wrap:wrap;gap:8px;">
      <div id="custInfo"></div>
      <div id="custPagination" class="pagination"></div>
    </div>
  `;

  let allCustomersList = [];
  let sortKey = 'created_at';
  let sortDir = 'desc';

  async function fetchCustomers() {
    try {
      const res = await fetch(`${API_BASE}/employees?action=customers-list&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      allCustomersList = data.customers || [];
      renderCustomersTable();
    } catch (err) {
      showToast("Fetch customers error: " + err.message, "error");
    }
  }

  function getFilteredCustomers() {
    const statusFilter = document.getElementById("custStatusFilter")?.value || "all";
    const searchTerm = (document.getElementById("custSearchInp")?.value || "").toLowerCase().trim();

    return allCustomersList.filter(c => {
      if (statusFilter !== "all") {
        const cStatus = (c.status || 'inquired').toLowerCase();
        if (statusFilter === 'converted') {
          if (!['converted', 'purchased', 'active'].includes(cStatus)) return false;
        } else if (statusFilter === 'inactive') {
          if (!['inactive', 'closed'].includes(cStatus)) return false;
        } else {
          if (cStatus !== statusFilter) return false;
        }
      }

      if (!searchTerm) return true;

      const compositeStr = [
        c.name, c.phone, c.email, c.address, c.village, c.gstin,
        c.status, c.sales_terms, c.company_name
      ].map(v => (v || "").toLowerCase()).join(" ");

      return compositeStr.includes(searchTerm);
    });
  }

  function renderCustomersTable() {
    const tbody = document.getElementById("custTableBody");
    const pagEl = document.getElementById("custPagination");
    const infoEl = document.getElementById("custInfo");
    if (!tbody) return;

    let filtered = getFilteredCustomers();
    filtered = window.sortDataArray(filtered, sortKey, sortDir);

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--text3);">No matching customers found.</td></tr>`;
      if (infoEl) infoEl.innerHTML = "";
      if (pagEl) pagEl.innerHTML = "";
      return;
    }

    window.renderPaginatedTable({
      data: filtered,
      pageSize: 10,
      currentPage: 1,
      tbody: tbody,
      paginationContainer: pagEl,
      infoContainer: infoEl,
      renderRow: (c) => `
        <tr>
          <td style="font-weight:700;color:var(--text1);">${esc(c.name)}</td>
          <td><span class="badge badge-outline" style="font-weight:600;">${esc(c.company_name || 'Main')}</span></td>
          <td style="font-weight:600;color:var(--primary);">${esc(c.phone || '—')}</td>
          <td>${esc(c.email || '—')}</td>
          <td>${esc(c.address || '—')}</td>
          <td><span class="badge badge-purple">${esc(c.gstin || 'N/A')}</span></td>
          <td>${getCustomerStatusBadge(c.status)}</td>
          <td><span class="badge badge-outline" style="font-weight:600;">${esc(c.sales_terms || 'Immediate Cash')}</span></td>
          <td style="font-weight:600;color:var(--success);">${c.total_purchases || 0} Orders</td>
          <td>${formatDate(c.created_at)}</td>
          <td style="text-align:center;">
            <div style="display:inline-flex;gap:4px;justify-content:center;">
              <button class="btn btn-xs btn-outline editCustBtn" data-id="${c.id}">✏️ Edit</button>
              <button class="btn btn-xs btn-danger deleteCustBtn" data-id="${c.id}">🗑️ Delete</button>
            </div>
          </td>
        </tr>
      `
    });

    tbody.querySelectorAll(".editCustBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const cust = allCustomersList.find(x => x.id == btn.dataset.id);
        if (cust) openAddCustomerModal(() => fetchCustomers(), cust);
      });
    });

    tbody.querySelectorAll(".deleteCustBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const cust = allCustomersList.find(x => x.id == btn.dataset.id);
        if (!confirm(`Are you sure you want to delete customer '${cust?.name || 'Item'}'?`)) return;
        if (btn.disabled) return;
        const origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
        try {
          const res = await fetch(`${API_BASE}/employees?action=customer-delete&id=${btn.dataset.id}`, {
            method: "POST",
            headers: authHeaders()
          });
          const d = await res.json();
          if (d.success) {
            showToast(d.message || "Customer deleted", "success");
            fetchCustomers();
          } else {
            showToast(d.error || "Failed to delete customer", "error");
            btn.disabled = false;
            btn.innerHTML = origHtml;
          }
        } catch (err) {
          showToast("Delete customer error: " + err.message, "error");
          btn.disabled = false;
          btn.innerHTML = origHtml;
        }
      });
    });
  }

  // EXPORT EXCEL FUNCTION
  function exportCustomersExcel() {
    const list = getFilteredCustomers();
    if (list.length === 0) return alert("No customers available to export.");

    const statusFilterVal = document.getElementById("custStatusFilter")?.value || "all";
    const statusText = statusFilterVal === "all" ? "All Statuses" : statusFilterVal;

    const headers = ["Customer Name", "Company Branch", "Phone / Cell", "Email", "Village / Address", "GSTIN", "Sales Pipeline Status", "Sales Terms", "Total Purchases", "Registered Date"];
    
    let csvContent = `Customer Directory Master Report\n`;
    csvContent += `Filter Applied: Status=${statusText}, Total Records=${list.length}, Export Date=${new Date().toLocaleDateString()}\n\n`;
    csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";

    list.forEach(c => {
      const row = [
        c.name || '',
        c.company_name || 'Main Company',
        c.phone || '',
        c.email || '',
        c.address || '',
        c.gstin || '',
        c.status || 'inquired',
        c.sales_terms || 'Immediate Cash',
        c.total_purchases || 0,
        formatDate(c.created_at)
      ];
      csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `customers_report_${statusFilterVal}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof showToast === "function") showToast("Customer directory exported to Excel CSV!", "success");
  }

  // EXPORT PDF / PRINT FUNCTION
  function exportCustomersPdf() {
    const list = getFilteredCustomers();
    if (list.length === 0) return alert("No customers available to print/export.");

    const statusFilterVal = document.getElementById("custStatusFilter")?.value || "all";
    const statusText = statusFilterVal === "all" ? "All Statuses" : statusFilterVal;

    const printWin = window.open("", "_blank", "width=900,height=950");
    if (!printWin) return alert("Please allow popups to export PDF.");

    const rowsHtml = list.map((c, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td style="font-weight:bold;">${esc(c.name)}</td>
        <td>${esc(c.company_name || 'Main')}</td>
        <td style="font-weight:bold;">${esc(c.phone || '—')}</td>
        <td>${esc(c.email || '—')}</td>
        <td>${esc(c.address || '—')}</td>
        <td>${esc(c.gstin || 'N/A')}</td>
        <td><span style="font-weight:bold;text-transform:capitalize;">${esc(c.status || 'inquired')}</span></td>
        <td>${esc(c.sales_terms || 'Immediate Cash')}</td>
        <td style="text-align:center;font-weight:bold;">${c.total_purchases || 0}</td>
        <td>${formatDate(c.created_at)}</td>
      </tr>
    `).join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Customer Directory Master - ${statusText}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { font-family: 'Arial', sans-serif; font-size: 11.5px; color: #000; padding: 15px; }
          .header { border-bottom: 2px solid #1e293b; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
          .title { font-size: 18px; font-weight: 900; color: #0f172a; text-transform: uppercase; }
          .meta { font-size: 11px; color: #475569; margin-bottom: 12px; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px; }
          th { background: #f1f5f9; text-align: left; font-weight: bold; }
          @media print { .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom:12px;text-align:right;">
          <button onclick="window.print()" style="background:#2563eb;color:#fff;border:none;padding:8px 18px;border-radius:6px;font-weight:bold;cursor:pointer;">📄 Save / Print PDF</button>
        </div>
        <div class="header">
          <div>
            <div class="title">Customer Directory Master</div>
            <div style="font-size:12px;color:#475569;">Business ERP Sales & Pipeline Report</div>
          </div>
          <div style="text-align:right;font-weight:bold;">
            Export Date: ${new Date().toLocaleDateString()}
          </div>
        </div>

        <div class="meta">
          <strong>Filter Status:</strong> ${statusText} &nbsp;|&nbsp; 
          <strong>Total Customers:</strong> ${list.length} &nbsp;|&nbsp; 
          <strong>Report Scope:</strong> Active Customer List
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:25px;text-align:center;">#</th>
              <th>Customer Name</th>
              <th>Company</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Village / Address</th>
              <th>GSTIN</th>
              <th>Sales Pipeline Status</th>
              <th>Sales Terms</th>
              <th style="text-align:center;">Purchases</th>
              <th>Registered Date</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
  }

  on("custStatusFilter", "change", () => renderCustomersTable());
  on("custSearchInp", "input", () => renderCustomersTable());

  on("exportCustExcelBtn", "click", () => exportCustomersExcel());
  on("exportCustPdfBtn", "click", () => exportCustomersPdf());

  on("addCustMainBtn", "click", () => {
    openAddCustomerModal(() => fetchCustomers());
  });

  fetchCustomers();
}

// ═══════════════════════════════════════════════════
// 3. FINANCERS MASTER SUBTAB
// ═══════════════════════════════════════════════════

async function loadFinancersSubTab() {
  const subContent = document.getElementById("hrSubContent");
  const compId = getActiveCompId();

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h3 style="font-size:16px;font-weight:600;color:var(--text1);">Registered Financers & Banks</h3>
      <button class="btn btn-primary" id="addFinancerMainBtn">+ Add New Financer</button>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Financer / Bank Name</th>
            <th>Company</th>
            <th>Type</th>
            <th>Contact Person</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Address</th>
          </tr>
        </thead>
        <tbody id="financerTableBody">
          <tr><td colspan="7" style="text-align:center;padding:20px;"><div class="spinner"></div> Fetching financers...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;flex-wrap:wrap;gap:8px;">
      <div id="financerInfo"></div>
      <div id="financerPagination" class="pagination"></div>
    </div>
  `;

  async function fetchFinancers() {
    try {
      const res = await fetch(`${API_BASE}/employees?action=financers-list&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      const tbody = document.getElementById("financerTableBody");
      if (!tbody) return;
      if (data.financers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text3);">No financers registered yet. Click + Add New Financer above.</td></tr>`;
        if (document.getElementById("financerInfo")) document.getElementById("financerInfo").innerHTML = "";
        if (document.getElementById("financerPagination")) document.getElementById("financerPagination").innerHTML = "";
        return;
      }

      window.renderPaginatedTable({
        data: data.financers,
        pageSize: 10,
        currentPage: 1,
        tbody: "financerTableBody",
        paginationContainer: "financerPagination",
        infoContainer: "financerInfo",
        renderRow: (f) => `
        <tr>
          <td style="font-weight:600;color:var(--text1);">${esc(f.name)}</td>
          <td><span class="badge badge-outline" style="font-weight:600;">${esc(f.company_name || 'Main')}</span></td>
          <td><span class="badge badge-info">${esc((f.type || 'finance_company').replace(/_/g, ' ').toUpperCase())}</span></td>
          <td>${esc(f.contact_person || '—')}</td>
          <td style="font-weight:600;color:var(--primary);">${esc(f.phone || '—')}</td>
          <td>${esc(f.email || '—')}</td>
          <td>${esc(f.address || '—')}</td>
        </tr>
      `
      });

    } catch (err) {
      showToast("Fetch financers error: " + err.message, "error");
    }
  }

  on("addFinancerMainBtn", "click", () => {
    openAddFinancerModal(() => fetchFinancers());
  });

  fetchFinancers();
}

// ═══════════════════════════════════════════════════
// 4. dealerS & DEALERS SUBTAB
// ═══════════════════════════════════════════════════

async function loaddealersSubTab() {
  const subContent = document.getElementById("hrSubContent");
  const compId = getActiveCompId();

  const userObj = (typeof getUser === "function" ? getUser() : null) || (typeof currentUser !== "undefined" && currentUser ? currentUser : null) || JSON.parse(localStorage.getItem("erp_user") || "{}");
  const token = (typeof getToken === "function" ? getToken() : null) || localStorage.getItem("erp_token") || localStorage.getItem("auth_token") || localStorage.getItem("token");
  let currentUserRole = (userObj?.role || (window.currentUser && window.currentUser.role) || '').toLowerCase();
  let currentUsername = (userObj?.username || (window.currentUser && window.currentUser.username) || '').toLowerCase();

  if (!currentUserRole && token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      currentUserRole = (payload.role || '').toLowerCase();
      if (!currentUsername) currentUsername = (payload.username || '').toLowerCase();
    } catch (e) {}
  }

  const isSuperAdmin = currentUserRole === 'superadmin' || currentUsername === 'superadmin';
  const canAddEditdealer = isSuperAdmin || ['storeadmin', 'hr', 'hr_manager'].includes(currentUserRole);
  const canDeletedealer = isSuperAdmin;

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h3 style="font-size:16px;font-weight:600;color:var(--text1);">Dealers Master</h3>
      ${canAddEditdealer ? `<button class="btn btn-primary" id="adddealerBtn">+ Add Dealer (with GST & Finance)</button>` : ''}
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Dealer / Company</th>
            <th>GSTIN / PAN</th>
            <th>Contact Person</th>
            <th>Bank Details</th>
            <th>Credit & Finance Terms</th>
            <th>Opening Balance</th>
            <th>Proof Doc</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody id="dealerTableBody">
          <tr><td colspan="8" style="text-align:center;padding:20px;"><div class="spinner"></div> Fetching dealers...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;flex-wrap:wrap;gap:8px;">
      <div id="dealerInfo"></div>
      <div id="dealerPagination" class="pagination"></div>
    </div>

    <!-- DEALER MODAL -->
    <div class="modal-overlay" id="dealerModal" style="display:none;">
      <div class="modal-box" style="max-width:750px;max-height:90vh;overflow-y:auto;">
        <div class="modal-header">
          <h3 id="dealerModalTitle">Add New Dealer</h3>
          <button class="modal-close" id="dealerModalClose">&times;</button>
        </div>
        <form id="dealerForm">
          <input type="hidden" id="vEditId" value="">
          <div class="modal-body" style="gap:16px;display:flex;flex-direction:column;">
            
            <!-- SECTION 1: Basic & GST Information -->
            <div style="background:var(--bg2, #f8fafc);padding:14px;border-radius:8px;border:1px solid var(--border1, #e2e8f0);">
              <h4 style="margin:0 0 10px 0;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;color:var(--primary, #3b82f6);font-weight:700;">🏢 Company & GST Details</h4>
              <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;">
                <div class="form-group" style="grid-column: span 2;">
                  <label class="form-label">Company / Business Unit *</label>
                  <select id="vCompanySelect" class="form-input" required></select>
                </div>
                <div class="form-group">
                  <label class="form-label">Legal Name *</label>
                  <input type="text" id="vLegalName" class="form-input" required placeholder="Surya Pvt Ltd">
                </div>
                <div class="form-group">
                  <label class="form-label">Trade Name</label>
                  <input type="text" id="vTradeName" class="form-input" placeholder="Surya Electronics">
                </div>
                <div class="form-group">
                  <label class="form-label">GSTIN *</label>
                  <input type="text" id="vGstin" class="form-input" required placeholder="37AHMPH1933C1Z7">
                </div>
                <div class="form-group">
                  <label class="form-label">PAN</label>
                  <input type="text" id="vPan" class="form-input" placeholder="AHMPH1933C">
                </div>
                <div class="form-group">
                  <label class="form-label">State</label>
                  <select id="vState" class="form-input"></select>
                </div>
                <div class="form-group">
                  <label class="form-label">State Code</label>
                  <input type="text" id="vStateCode" class="form-input" placeholder="37">
                </div>
                <div class="form-group">
                  <label class="form-label">Contact Person</label>
                  <input type="text" id="vContact" class="form-input" placeholder="Ramesh Kumar">
                </div>
                <div class="form-group">
                  <label class="form-label">Phone</label>
                  <input type="text" id="vPhone" class="form-input" placeholder="+91 9876543210">
                </div>
              </div>
            </div>

            <!-- SECTION 2: Bank & Finance Credit Details -->
            <div style="background:var(--bg2, #f8fafc);padding:14px;border-radius:8px;border:1px solid var(--border1, #e2e8f0);">
              <h4 style="margin:0 0 10px 0;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;color:var(--primary, #3b82f6);font-weight:700;">🏦 Dealer Bank Account & Finance Credit Details</h4>
              <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;">
                <div class="form-group">
                  <label class="form-label">Bank Name</label>
                  <input type="text" id="vBankName" class="form-input" placeholder="State Bank of India">
                </div>
                <div class="form-group">
                  <label class="form-label">Account Number</label>
                  <input type="text" id="vBankAccountNo" class="form-input" placeholder="38491029384">
                </div>
                <div class="form-group">
                  <label class="form-label">IFSC Code</label>
                  <input type="text" id="vBankIfsc" class="form-input" placeholder="SBIN0001234">
                </div>
                <div class="form-group">
                  <label class="form-label">Branch Name</label>
                  <input type="text" id="vBankBranch" class="form-input" placeholder="Main Branch">
                </div>
                <div class="form-group">
                  <label class="form-label">Credit Limit (₹)</label>
                  <input type="number" step="0.01" id="vCreditLimit" class="form-input" placeholder="500000">
                </div>
                <div class="form-group">
                  <label class="form-label">Credit Period (Days)</label>
                  <input type="number" id="vCreditPeriodDays" class="form-input" placeholder="30">
                </div>
                <div class="form-group">
                  <label class="form-label">Credit Interest Rate (%)</label>
                  <input type="number" step="0.01" id="vCreditInterestRate" class="form-input" placeholder="12.0">
                </div>
                <div class="form-group">
                  <label class="form-label">Credit Terms Description</label>
                  <input type="text" id="vCredit" class="form-input" placeholder="30 Days Net / 1.5% Interest per month over limit">
                </div>
              </div>
            </div>

            <!-- SECTION 3: Opening Balance Entry & Document Upload -->
            <div style="background:var(--bg2, #f8fafc);padding:14px;border-radius:8px;border:1px solid var(--border1, #e2e8f0);">
              <h4 style="margin:0 0 10px 0;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;color:var(--primary, #3b82f6);font-weight:700;">⚖️ Opening Balance Entry & Proof Document Upload</h4>
              <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;">
                <div class="form-group">
                  <label class="form-label">Opening Balance Amount (₹)</label>
                  <input type="number" step="0.01" id="vOpeningBalance" class="form-input" placeholder="0.00">
                </div>
                <div class="form-group">
                  <label class="form-label">Balance Type</label>
                  <select id="vOpeningBalanceType" class="form-input">
                    <option value="Payable">Payable (We owe Dealer)</option>
                    <option value="Receivable">Receivable (Dealer owes Us)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Opening Balance Date</label>
                  <input type="date" id="vOpeningBalanceDate" class="form-input">
                </div>
                <div class="form-group">
                  <label class="form-label">Upload Proof Document (PDF / Image)</label>
                  <input type="file" id="vOpeningBalanceDocFile" class="form-input" accept="image/*,application/pdf">
                  <div id="vDocPreviewArea" style="margin-top:4px;"></div>
                </div>
                <div class="form-group" style="grid-column: span 2;">
                  <label class="form-label">Notes / Remarks</label>
                  <input type="text" id="vOpeningBalanceNotes" class="form-input" placeholder="Verified ledger statement attached">
                </div>
              </div>
            </div>

          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="dealerModalCancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Dealer Details</button>
          </div>
        </form>
      </div>
    </div>
  `;

  let vOpeningBalanceDocBase64 = "";

  function populatedealerCompanySelect(selectedId) {
    const compSelect = document.getElementById("vCompanySelect");
    if (!compSelect) return;
    const compList = (window.currentCompanies && window.currentCompanies.length > 0)
      ? window.currentCompanies
      : (typeof currentCompanies !== 'undefined' ? currentCompanies : []);
    
    if (compList.length > 0) {
      compSelect.innerHTML = compList.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
      if (selectedId) {
        compSelect.value = selectedId;
      } else if (selectedCompanyId && selectedCompanyId !== "all") {
        compSelect.value = selectedCompanyId;
      } else {
        compSelect.value = compList[0].id;
      }
    } else {
      compSelect.innerHTML = `<option value="1">Main Company</option>`;
    }
  }

  function populatedealerStateSelect(selectedStateName, selectedStateCode) {
    const vStateEl = document.getElementById("vState");
    const vStateCodeEl = document.getElementById("vStateCode");
    if (!vStateEl) return;

    const states = (window.INDIAN_STATES || [
      "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
      "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
      "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
      "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
      "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
      "Uttar Pradesh", "Uttarakhand", "West Bengal",
      "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
      "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
      "Other / International"
    ]);

    vStateEl.innerHTML = `<option value="">Select State</option>` + states.map(st => {
      const code = Object.keys(window.GST_STATE_MAP || {}).find(k => ((window.GST_STATE_MAP || {})[k] || "").toLowerCase() === st.toLowerCase()) || "";
      const label = code ? `${st} (${code})` : st;
      return `<option value="${esc(st)}" data-code="${code}">${esc(label)}</option>`;
    }).join("");

    if (selectedStateName) {
      vStateEl.value = selectedStateName;
    } else {
      vStateEl.value = "Andhra Pradesh";
    }

    if (selectedStateCode) {
      if (vStateCodeEl) vStateCodeEl.value = selectedStateCode;
    } else {
      updatedealerStateCode();
    }
  }

  function updatedealerStateCode() {
    const vStateEl = document.getElementById("vState");
    const vStateCodeEl = document.getElementById("vStateCode");
    if (!vStateEl || !vStateCodeEl) return;

    const selectedOpt = vStateEl.options[vStateEl.selectedIndex];
    const code = selectedOpt ? selectedOpt.dataset.code : "";
    if (code) {
      vStateCodeEl.value = code;
    } else {
      const st = vStateEl.value;
      const foundCode = Object.keys(window.GST_STATE_MAP || {}).find(k => ((window.GST_STATE_MAP || {})[k] || "").toLowerCase() === st.toLowerCase()) || "";
      if (foundCode) vStateCodeEl.value = foundCode;
    }
  }

  async function fetchdealers() {
    try {
      const res = await fetch(`${API_BASE}/employees?action=dealers-list&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      const tbody = document.getElementById("dealerTableBody");
      if (!tbody) return;
      if (data.dealers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text3);">No dealers found. Click + Add Dealer above.</td></tr>`;
        if (document.getElementById("dealerInfo")) document.getElementById("dealerInfo").innerHTML = "";
        if (document.getElementById("dealerPagination")) document.getElementById("dealerPagination").innerHTML = "";
        return;
      }

      window.renderPaginatedTable({
        data: data.dealers,
        pageSize: 10,
        currentPage: 1,
        tbody: "dealerTableBody",
        paginationContainer: "dealerPagination",
        infoContainer: "dealerInfo",
        renderRow: (v) => {
          const bankStr = (v.bank_name || v.bank_account_no) ? `${esc(v.bank_name || 'Bank')}<br><small class="text-muted">A/C: ${esc(v.bank_account_no || '—')}</small>${v.bank_ifsc ? `<br><small class="text-muted">IFSC: ${esc(v.bank_ifsc)}</small>` : ''}` : '—';
          
          const creditStr = (v.credit_limit || v.credit_period_days || v.credit_terms) ? `
            <div><strong>Limit:</strong> ₹${parseFloat(v.credit_limit || 0).toLocaleString('en-IN')}</div>
            <div style="font-size:11px;color:var(--text2);">${v.credit_period_days ? `${v.credit_period_days} Days Net` : ''} ${v.credit_interest_rate ? `(${v.credit_interest_rate}% p.a.)` : ''}</div>
            ${v.credit_terms ? `<div style="font-size:11px;color:var(--text3);">${esc(v.credit_terms)}</div>` : ''}
          ` : '—';

          const obTypeBadge = v.opening_balance_type === 'Receivable' ? 'badge-success' : 'badge-warning';
          const obStr = (v.opening_balance && parseFloat(v.opening_balance) !== 0) ? `
            <div><strong>₹${parseFloat(v.opening_balance).toLocaleString('en-IN')}</strong></div>
            <div><span class="badge ${obTypeBadge}" style="font-size:10px;">${esc(v.opening_balance_type || 'Payable')}</span></div>
            ${v.opening_balance_date ? `<div style="font-size:11px;color:var(--text3);">${v.opening_balance_date}</div>` : ''}
          ` : '<span class="text-muted">₹0.00</span>';

          const docBtn = v.opening_balance_doc ? `
            <a href="${API_BASE}/inventory?action=view-doc&type=dealer&id=${v.id}" target="_blank" class="btn btn-xs btn-outline" style="padding:2px 6px;font-size:11px;" title="View Opening Balance Proof Document">📄 View Doc</a>
          ` : '<span class="text-muted" style="font-size:11px;">No Doc</span>';

          return `
            <tr>
              <td>
                <strong style="color:var(--text1);">${esc(v.legal_name)}</strong>
                ${v.trade_name ? `<br><small class="text-muted">${esc(v.trade_name)}</small>` : ''}
                <br><span class="badge badge-outline" style="font-size:10px;margin-top:2px;">${esc(v.company_name || 'Main')}</span>
              </td>
              <td>
                <span class="badge badge-purple">${esc(v.gstin || 'N/A')}</span>
                ${v.pan ? `<br><small class="text-muted">PAN: ${esc(v.pan)}</small>` : ''}
              </td>
              <td>
                ${esc(v.contact_person || '—')}
                ${v.phone ? `<br><small class="text-muted">📞 ${esc(v.phone)}</small>` : ''}
              </td>
              <td style="font-size:12px;">${bankStr}</td>
              <td style="font-size:12px;">${creditStr}</td>
              <td style="font-size:12px;">${obStr}</td>
              <td>${docBtn}</td>
              <td style="text-align:right;white-space:nowrap;">
                ${canAddEditdealer ? `<button class="btn btn-xs btn-outline editdealerBtn" data-id="${v.id}" style="padding:2px 8px;" title="Edit Dealer">✏️ Edit</button>` : ''}
                ${canDeletedealer ? `<button class="btn btn-xs btn-danger deletedealerBtn" data-id="${v.id}" style="padding:2px 8px;margin-left:4px;" title="Delete Dealer">&times; Delete</button>` : ''}
              </td>
            </tr>
          `;
        }
      });

      document.querySelectorAll(".editdealerBtn").forEach(btn => {
        btn.addEventListener("click", () => {
          const v = data.dealers.find(x => x.id == btn.dataset.id);
          if (!v) return;
          document.getElementById("vEditId").value = v.id;
          populatedealerCompanySelect(v.company_id);
          populatedealerStateSelect(v.state || "Andhra Pradesh", v.state_code || "");
          document.getElementById("vLegalName").value = v.legal_name || "";
          document.getElementById("vTradeName").value = v.trade_name || "";
          document.getElementById("vGstin").value = v.gstin || "";
          document.getElementById("vPan").value = v.pan || "";
          document.getElementById("vContact").value = v.contact_person || "";
          document.getElementById("vPhone").value = v.phone || "";
          document.getElementById("vCredit").value = v.credit_terms || "";

          // Bank Details
          document.getElementById("vBankName").value = v.bank_name || "";
          document.getElementById("vBankAccountNo").value = v.bank_account_no || "";
          document.getElementById("vBankIfsc").value = v.bank_ifsc || "";
          document.getElementById("vBankBranch").value = v.bank_branch || "";

          // Finance Credit Details
          document.getElementById("vCreditLimit").value = v.credit_limit !== null && v.credit_limit !== undefined ? v.credit_limit : "";
          document.getElementById("vCreditPeriodDays").value = v.credit_period_days !== null && v.credit_period_days !== undefined ? v.credit_period_days : "";
          document.getElementById("vCreditInterestRate").value = v.credit_interest_rate !== null && v.credit_interest_rate !== undefined ? v.credit_interest_rate : "";

          // Opening Balance & Doc
          document.getElementById("vOpeningBalance").value = v.opening_balance !== null && v.opening_balance !== undefined ? v.opening_balance : "";
          document.getElementById("vOpeningBalanceType").value = v.opening_balance_type || "Payable";
          document.getElementById("vOpeningBalanceDate").value = v.opening_balance_date || "";
          document.getElementById("vOpeningBalanceNotes").value = v.opening_balance_notes || "";
          
          vOpeningBalanceDocBase64 = v.opening_balance_doc || "";
          document.getElementById("vOpeningBalanceDocFile").value = "";
          const previewEl = document.getElementById("vDocPreviewArea");
          if (previewEl) {
            if (v.opening_balance_doc) {
              previewEl.innerHTML = `<span class="badge badge-info">📄 Existing Doc Attached</span> <a href="${API_BASE}/inventory?action=view-doc&type=dealer&id=${v.id}" target="_blank" style="font-size:11px;" class="ms-1">View Document</a>`;
            } else {
              previewEl.innerHTML = `<span class="text-muted" style="font-size:11px;">No file uploaded</span>`;
            }
          }

          document.getElementById("dealerModalTitle").textContent = "Edit Dealer Details";
          document.getElementById("dealerModal").style.display = "flex";
        });
      });

      document.querySelectorAll(".deletedealerBtn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const v = data.dealers.find(x => x.id == btn.dataset.id);
          if (!v) return;
          if (!confirm(`Are you sure you want to delete dealer "${v.legal_name}"?`)) return;
          if (btn.disabled) return;
          const origHtml = btn.innerHTML;
          btn.disabled = true;
          btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

          try {
            const res = await fetch(`${API_BASE}/employees?action=dealer-delete`, {
              method: "POST",
              headers: authHeaders(),
              body: JSON.stringify({ id: v.id })
            });
            const d = await res.json();
            if (d.success) {
              showToast(d.message || "Dealer deleted successfully", "success");
              fetchdealers();
            } else {
              showToast(d.error || "Failed to delete dealer", "error");
              btn.disabled = false;
              btn.innerHTML = origHtml;
            }
          } catch (e) {
            showToast("Error: " + e.message, "error");
            btn.disabled = false;
            btn.innerHTML = origHtml;
          }
        });
      });

    } catch (err) {
      showToast("Fetch dealers error: " + err.message, "error");
    }
  }

  on("adddealerBtn", "click", () => {
    document.getElementById("dealerForm").reset();
    document.getElementById("vEditId").value = "";
    vOpeningBalanceDocBase64 = "";
    const previewEl = document.getElementById("vDocPreviewArea");
    if (previewEl) previewEl.innerHTML = "";

    populatedealerCompanySelect();
    populatedealerStateSelect("Andhra Pradesh", "37");
    document.getElementById("dealerModalTitle").textContent = "Add New Dealer";
    document.getElementById("dealerModal").style.display = "flex";
  });
  on("dealerModalClose", "click", () => { document.getElementById("dealerModal").style.display = "none"; });
  on("dealerModalCancel", "click", () => { document.getElementById("dealerModal").style.display = "none"; });

  on("vState", "change", updatedealerStateCode);

  on("vGstin", "input", (e) => {
    const val = e.target.value.trim();
    if (val.length >= 2) {
      const code = val.substring(0, 2);
      if (/^\d{2}$/.test(code) && window.GST_STATE_MAP && window.GST_STATE_MAP[code]) {
        const stateName = window.GST_STATE_MAP[code];
        const vStateEl = document.getElementById("vState");
        const vStateCodeEl = document.getElementById("vStateCode");
        if (vStateEl) vStateEl.value = stateName;
        if (vStateCodeEl) vStateCodeEl.value = code;
      }
    }
  });

  on("vOpeningBalanceDocFile", "change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("File size should not exceed 5MB", "error");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      vOpeningBalanceDocBase64 = evt.target.result;
      const previewEl = document.getElementById("vDocPreviewArea");
      if (previewEl) {
        previewEl.innerHTML = `<span class="badge badge-success">✓ ${esc(file.name)} (${(file.size/1024).toFixed(1)} KB)</span>`;
      }
    };
    reader.readAsDataURL(file);
  });

  on("dealerForm", "submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn && submitBtn.disabled) return;
    const origHtml = submitBtn ? submitBtn.innerHTML : "Save Dealer Details";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving...`;
    }

    const editId = document.getElementById("vEditId")?.value;
    const actionName = editId ? "dealer-update" : "dealer-create";

    const vCompVal = document.getElementById("vCompanySelect")?.value;
    const targetCompId = vCompVal ? parseInt(vCompVal) : (selectedCompanyId !== "all" ? parseInt(selectedCompanyId) : 1);

    const payload = {
      id: editId || undefined,
      company_id: targetCompId,
      legal_name: document.getElementById("vLegalName").value.trim(),
      trade_name: document.getElementById("vTradeName").value.trim(),
      gstin: document.getElementById("vGstin").value.trim(),
      pan: document.getElementById("vPan").value.trim(),
      state: document.getElementById("vState").value.trim(),
      state_code: document.getElementById("vStateCode").value.trim(),
      contact_person: document.getElementById("vContact").value.trim(),
      phone: document.getElementById("vPhone").value.trim(),
      credit_terms: document.getElementById("vCredit").value.trim(),

      // Bank Details
      bank_name: document.getElementById("vBankName").value.trim(),
      bank_account_no: document.getElementById("vBankAccountNo").value.trim(),
      bank_ifsc: document.getElementById("vBankIfsc").value.trim(),
      bank_branch: document.getElementById("vBankBranch").value.trim(),

      // Finance & Credit Terms
      credit_limit: parseFloat(document.getElementById("vCreditLimit").value) || 0,
      credit_period_days: parseInt(document.getElementById("vCreditPeriodDays").value) || 0,
      credit_interest_rate: parseFloat(document.getElementById("vCreditInterestRate").value) || 0,

      // Opening Balance Entry
      opening_balance: parseFloat(document.getElementById("vOpeningBalance").value) || 0,
      opening_balance_type: document.getElementById("vOpeningBalanceType").value,
      opening_balance_date: document.getElementById("vOpeningBalanceDate").value,
      opening_balance_notes: document.getElementById("vOpeningBalanceNotes").value.trim(),
      opening_balance_doc: vOpeningBalanceDocBase64
    };

    try {
      const res = await fetch(`${API_BASE}/employees?action=${actionName}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "success");
        document.getElementById("dealerModal").style.display = "none";
        fetchdealers();
      } else showToast(data.error, "error");
    } catch (err) {
      showToast("Error saving dealer: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    }
  });

  fetchdealers();
}

// ═══════════════════════════════════════════════════
// 5. ATTENDANCE LOG SUBTAB
// ═══════════════════════════════════════════════════

async function loadAttendanceSubTab() {
  const subContent = document.getElementById("hrSubContent");
  const compId = getActiveCompId();

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <h3 style="font-size:16px;font-weight:600;color:var(--text1);">Daily Attendance & Time Tracking</h3>
      <div style="display:flex;gap:10px;align-items:center;">
        <input type="date" id="attDateSelect" class="form-input" value="${today()}" style="width:160px;">
        <button class="btn btn-primary" id="saveAttBtn">💾 Save Attendance Log</button>
      </div>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Department</th>
            <th>Check In</th>
            <th>Check Out</th>
            <th>Status</th>
            <th>Notes</th>
            <th>Quick Action</th>
          </tr>
        </thead>
        <tbody id="attTableBody">
          <tr><td colspan="7" style="text-align:center;padding:20px;"><div class="spinner"></div> Fetching attendance...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;flex-wrap:wrap;gap:8px;">
      <div id="attInfo"></div>
      <div id="attPagination" class="pagination"></div>
    </div>
  `;

  let attEmployees = [];

  async function fetchAtt() {
    const selDate = document.getElementById("attDateSelect").value;
    try {
      const res = await fetch(`${API_BASE}/attendance?action=list&date=${selDate}&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      attEmployees = data.employees || data.attendance || [];
      const loggedUser = getUser() || {};
      const isSuperAdmin = loggedUser.role === "superadmin";

      if (!isSuperAdmin) {
        attEmployees = attEmployees.filter(e => {
          const nm = String(e.employee_name || e.name || "").toLowerCase().trim();
          const dp = String(e.department || "").toLowerCase().trim();
          return nm !== "superadmin" && dp !== "superadmin";
        });
      }

      const tbody = document.getElementById("attTableBody");
      if (!tbody) return;

      if (attEmployees.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text3);">No active employees found for attendance.</td></tr>`;
        if (document.getElementById("attInfo")) document.getElementById("attInfo").innerHTML = "";
        if (document.getElementById("attPagination")) document.getElementById("attPagination").innerHTML = "";
        return;
      }

      window.renderPaginatedTable({
        data: attEmployees,
        pageSize: 10,
        currentPage: 1,
        tbody: "attTableBody",
        paginationContainer: "attPagination",
        infoContainer: "attInfo",
        renderRow: (e) => {
          const empId = e.employee_id || e.id;
          const empName = e.employee_name || e.name;
          const st = e.status || 'not_checked_in';

          const isSelfRow = (
            (loggedUser.employee_id && (empId == loggedUser.employee_id)) ||
            (e.user_id && (e.user_id == loggedUser.id)) ||
            (loggedUser.username && empName && empName.toLowerCase().trim() === loggedUser.username.toLowerCase().trim())
          );

          const canEdit = isSuperAdmin || !isSelfRow;
          const disabledAttr = canEdit ? '' : 'disabled';
          const titleAttr = canEdit ? '' : 'title="Storeadmin and HR cannot edit their own attendance log. Only Superadmin can edit."';

          return `
            <tr data-empid="${empId}" data-isself="${isSelfRow ? 'true' : 'false'}">
              <td style="font-weight:600;color:var(--text1);">
                ${esc(empName)}
                ${isSelfRow ? `<span class="badge badge-neutral" style="font-size:11px;margin-left:6px;padding:2px 6px;">🔒 You</span>` : ''}
              </td>
              <td>${esc(e.department || 'General')}</td>
              <td><input type="time" class="form-input att-in" value="${e.check_in ? e.check_in.slice(0,5) : ''}" style="width:110px;" ${disabledAttr} ${titleAttr}></td>
              <td><input type="time" class="form-input att-out" value="${e.check_out ? e.check_out.slice(0,5) : ''}" style="width:110px;" ${disabledAttr} ${titleAttr}></td>
              <td>
                <select class="form-select att-status" style="width:145px;" ${disabledAttr} ${titleAttr}>
                  <option value="present" ${st === 'present' ? 'selected' : ''}>Present ✅</option>
                  <option value="late" ${st === 'late' ? 'selected' : ''}>Late ⏰</option>
                  <option value="absent" ${st === 'absent' ? 'selected' : ''}>Absent ❌</option>
                  <option value="leave" ${st === 'leave' ? 'selected' : ''}>Leave 🏖️</option>
                  <option value="unexpected_leave" ${st === 'unexpected_leave' ? 'selected' : ''}>Unexpected Leave 🚨</option>
                  <option value="not_checked_in" ${st === 'not_checked_in' ? 'selected' : ''}>Not Checked-In ⏳</option>
                </select>
              </td>
              <td><input type="text" class="form-input att-notes" value="${esc(e.notes || '')}" placeholder="Notes..." ${disabledAttr} ${titleAttr}></td>
              <td>
                ${canEdit ? `
                  <button class="btn btn-xs btn-danger markUnexpLeaveBtn" data-empid="${empId}" data-empname="${esc(empName)}">🚨 Put Unexpected Leave</button>
                ` : `
                  <button class="btn btn-xs btn-secondary" disabled style="opacity:0.6;cursor:not-allowed;" title="Storeadmin and HR cannot edit their own attendance. Only Superadmin can edit.">🔒 Restricted</button>
                `}
              </td>
            </tr>
          `;
        },
        onRender: () => {
          tbody.querySelectorAll(".markUnexpLeaveBtn").forEach(btn => {
            btn.addEventListener("click", async () => {
              const empId = btn.dataset.empid;
              const empName = btn.dataset.empname || "Employee";
              if (!confirm(`Are you sure you want to record an Unexpected Leave for ${empName} on ${selDate}?`)) return;
              if (btn.disabled) return;
              const origHtml = btn.innerHTML;
              btn.disabled = true;
              btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Marking...`;

              try {
                const res = await fetch(`${API_BASE}/attendance?action=unexpected-leave`, {
                  method: "POST",
                  headers: authHeaders(),
                  body: JSON.stringify({
                    company_id: compId,
                    employee_id: empId,
                    date: selDate,
                    remarks: "Unexpected Leave marked by Admin"
                  })
                });
                const d = await res.json();
                if (d.success) {
                  showToast(d.message || `Unexpected Leave recorded for ${empName}!`, "success");
                  fetchAtt();
                } else {
                  showToast(d.error || "Failed to mark unexpected leave", "error");
                  btn.disabled = false;
                  btn.innerHTML = origHtml;
                }
              } catch (err) {
                showToast("Error marking unexpected leave: " + err.message, "error");
                btn.disabled = false;
                btn.innerHTML = origHtml;
              }
            });
          });

          // Dynamic handler for Attendance Status change: Flexible Check-In & Check-Out adjustment with 6 PM default
          tbody.querySelectorAll(".att-status").forEach(selectEl => {
            selectEl.addEventListener("change", (evt) => {
              const tr = evt.target.closest("tr");
              if (!tr) return;
              const inInput = tr.querySelector(".att-in");
              const outInput = tr.querySelector(".att-out");
              const statusVal = evt.target.value;

              const now = new Date();
              const currentHour = now.getHours();
              const selDateVal = document.getElementById("attDateSelect")?.value;
              const todayStr = typeof today === "function" ? today() : new Date().toISOString().split("T")[0];
              const isPastDate = selDateVal && selDateVal < todayStr;

              if (statusVal === "present" || statusVal === "late") {
                if (inInput && !inInput.value) {
                  inInput.value = statusVal === "late" ? "10:30" : "09:30";
                }
                // Auto fill check-out after 6 PM (18:00) or for past dates, while keeping check-out fully editable
                if (outInput && (!outInput.value || outInput.value === "")) {
                  if (currentHour >= 18 || isPastDate) {
                    outInput.value = "18:00"; // 6:00 PM default check-out
                  }
                }
              } else if (statusVal === "absent" || statusVal === "leave" || statusVal === "unexpected_leave" || statusVal === "not_checked_in") {
                if (inInput) inInput.value = "";
                if (outInput) outInput.value = "";
              }
            });
          });

          // Dynamic handler for Check-In time edit
          tbody.querySelectorAll(".att-in").forEach(inInput => {
            inInput.addEventListener("change", (evt) => {
              const tr = evt.target.closest("tr");
              if (!tr) return;
              const statusEl = tr.querySelector(".att-status");
              const outInput = tr.querySelector(".att-out");
              const val = evt.target.value;

              if (val && statusEl) {
                if (statusEl.value === "not_checked_in" || statusEl.value === "absent") {
                  const parts = val.split(":");
                  const hour = parseInt(parts[0], 10);
                  const min = parseInt(parts[1], 10);
                  if (hour > 10 || (hour === 10 && min > 15)) {
                    statusEl.value = "late";
                  } else {
                    statusEl.value = "present";
                  }
                }
                const now = new Date();
                const selDateVal = document.getElementById("attDateSelect")?.value;
                const todayStr = typeof today === "function" ? today() : new Date().toISOString().split("T")[0];
                const isPastDate = selDateVal && selDateVal < todayStr;
                if (outInput && !outInput.value && (now.getHours() >= 18 || isPastDate)) {
                  outInput.value = "18:00";
                }
              }
            });
          });

          // Dynamic handler for Check-Out time edit
          tbody.querySelectorAll(".att-out").forEach(outInput => {
            outInput.addEventListener("change", (evt) => {
              const tr = evt.target.closest("tr");
              if (!tr) return;
              const statusEl = tr.querySelector(".att-status");
              const inInput = tr.querySelector(".att-in");
              if (outInput.value && statusEl && (statusEl.value === "not_checked_in" || statusEl.value === "absent")) {
                statusEl.value = "present";
                if (inInput && !inInput.value) {
                  inInput.value = "09:30";
                }
              }
            });
          });
        }
      });

    } catch (err) {
      showToast("Attendance error: " + err.message, "error");
    }
  }

  on("attDateSelect", "change", fetchAtt);

  on("saveAttBtn", "click", async () => {
    const btn = document.getElementById("saveAttBtn");
    if (btn && btn.disabled) return;
    const origHtml = btn ? btn.innerHTML : "💾 Save Attendance Log";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving Attendance...`;
    }

    const loggedUser = getUser() || {};
    const isSuperAdmin = loggedUser.role === "superadmin";
    const selDate = document.getElementById("attDateSelect").value;
    const rows = document.querySelectorAll("#attTableBody tr[data-empid]");
    const attendanceData = [];

    rows.forEach(tr => {
      const isSelf = tr.dataset.isself === "true";
      if (!isSuperAdmin && isSelf) return; // Skip self row when storeadmin/hr saves log

      const inEl = tr.querySelector(".att-in");
      if (inEl && inEl.disabled) return;

      attendanceData.push({
        employee_id: tr.dataset.empid,
        check_in: tr.querySelector(".att-in").value,
        check_out: tr.querySelector(".att-out").value,
        status: tr.querySelector(".att-status").value,
        notes: tr.querySelector(".att-notes").value.trim()
      });
    });

    try {
      const res = await fetch(`${API_BASE}/attendance?action=mark-manual`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ date: selDate, records: attendanceData })
      });
      const data = await res.json();
      if (data.success) {
        showToast("Attendance saved successfully!", "success");
        fetchAtt();
      } else showToast(data.error, "error");
    } catch (err) {
      showToast("Save attendance error: " + err.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  });

  fetchAtt();
}

// ═══════════════════════════════════════════════════
// 6. LEAVE APPLICATIONS SUBTAB
// ═══════════════════════════════════════════════════

async function loadLeaveSubTab(isGenApplyLeave = false) {
  const subContent = document.getElementById("hrSubContent");
  const compId = getActiveCompId();
  const loggedUser = getUser() || {};
  const isSuperAdmin = loggedUser.role === "superadmin" || loggedUser.username === "superadmin";
  const isAdminRole = ['superadmin', 'storeadmin', 'hr', 'hr_manager'].includes(loggedUser.role);

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
      <div>
        <h3 style="font-size:18px;font-weight:700;color:var(--text1);margin:0;">
          ${isGenApplyLeave ? '🏖️ Apply Leave & Leave Balance' : '📋 Leave Applications & Approvals'}
        </h3>
        <p style="font-size:12px;color:var(--text3);margin:2px 0 0 0;">
          ${isGenApplyLeave ? 'View your annual leave quota, breakdown per type, and apply for time off.' : 'Manage company employee leave requests, configure quotas, and approvals.'}
        </p>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        ${isAdminRole ? `<button class="btn btn-secondary" id="configLeaveQuotasBtn">⚙️ Configure Leave Quotas</button>` : ''}
        <button class="btn btn-primary" id="applyLeaveBtn">+ Apply for Leave</button>
      </div>
    </div>

    <div id="leaveAnalyticsArea"></div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Leave Type</th>
            <th>From</th>
            <th>To</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="leaveTableBody">
          <tr><td colspan="7" style="text-align:center;padding:20px;"><div class="spinner"></div> Fetching leave requests...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;flex-wrap:wrap;gap:8px;">
      <div id="leaveInfo"></div>
      <div id="leavePagination" class="pagination"></div>
    </div>

    <!-- LEAVE MODAL -->
    <div class="modal-overlay" id="leaveModal" style="display:none;">
      <div class="modal-box" style="max-width:500px;">
        <div class="modal-header">
          <h3>Apply for Leave</h3>
          <button class="modal-close" id="leaveModalClose">&times;</button>
        </div>
        <form id="leaveForm">
          <div class="modal-body">
            <div class="form-group" id="empSelectFormGroup">
              <!-- Populated dynamically -->
            </div>
            <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;">
              <div class="form-group">
                <label class="form-label">Leave Type *</label>
                <select id="leaveType" class="form-select" required>
                  <option value="casual">Casual Leave (CL)</option>
                  <option value="sick">Sick Leave (SL)</option>
                  <option value="earned">Earned Leave (EL)</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Reason</label>
                <input type="text" id="leaveReason" class="form-input" placeholder="Personal work / Health">
              </div>
              <div class="form-group">
                <label class="form-label">Start Date *</label>
                <input type="date" id="leaveStart" class="form-input" required>
              </div>
              <div class="form-group">
                <label class="form-label">End Date *</label>
                <input type="date" id="leaveEnd" class="form-input" required>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="leaveModalCancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Submit Application</button>
          </div>
        </form>
      </div>
    </div>

    <!-- CONFIG LEAVE QUOTAS MODAL -->
    <div class="modal-overlay" id="configQuotaModal" style="display:none;">
      <div class="modal-box" style="max-width:650px;">
        <div class="modal-header">
          <h3>⚙️ Configure Monthly & Yearly Leave Quotas</h3>
          <button class="modal-close" id="configQuotaModalClose">&times;</button>
        </div>
        <form id="configQuotaForm">
          <p style="font-size:12px;color:var(--text3);margin-bottom:12px;">
            Set monthly leave limits and yearly quotas per category for this company. Paid vs Unpaid status governs leave eligibility & deductions.
          </p>
          <div id="leaveTypesConfigContainer" style="overflow-x:auto;">
            <div style="text-align:center;padding:20px;"><div class="spinner"></div> Loading leave types...</div>
          </div>
          <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" class="btn btn-secondary" id="configQuotaModalCancel">Cancel</button>
            <button type="submit" class="btn btn-primary">💾 Save Quota Settings</button>
          </div>
        </form>
      </div>
    </div>
  `;

  let empListForModal = [];
  let myEmpRecord = null;
  let configuredLeaveTypes = [];

  try {
    const ltRes = await fetch(`${API_BASE}/payroll?action=leave-types-list&company_id=${compId}`, { headers: authHeaders() });
    const ltData = await ltRes.json();
    if (ltData.success && ltData.leave_types) {
      configuredLeaveTypes = ltData.leave_types;
    }
  } catch (e) {}

  try {
    const empRes = await fetch(`${API_BASE}/employees?action=list&company_id=${compId}`, { headers: authHeaders() });
    const empData = await empRes.json();
    if (empData.success && empData.employees) {
      empListForModal = empData.employees;
      myEmpRecord = empListForModal.find(e => Boolean(
        (loggedUser.employee_id && e.id == loggedUser.employee_id) ||
        (loggedUser.id && e.user_id == loggedUser.id) ||
        (loggedUser.username && String(e.name || '').toLowerCase().trim() === String(loggedUser.username).toLowerCase().trim())
      )) || empListForModal[0];

      const empSelectGroup = document.getElementById("empSelectFormGroup");
      if (empSelectGroup) {
        const canSelectOtherEmployees = isAdminRole && !isGenApplyLeave;
        if (canSelectOtherEmployees) {
          empSelectGroup.innerHTML = `
            <label class="form-label">Select Employee *</label>
            <select id="leaveEmpId" class="form-select" required>
              ${empListForModal.map(e => {
                const isSelf = myEmpRecord && e.id == myEmpRecord.id;
                return `<option value="${e.id}" ${isSelf ? 'selected' : ''}>${esc(e.name)} (${esc(e.employee_code || '')}) - ${esc(e.company_name || '')}</option>`;
              }).join("")}
            </select>
          `;
        } else {
          empSelectGroup.innerHTML = `
            <label class="form-label">Applicant Employee *</label>
            <div style="padding:10px 12px;background:var(--bg-secondary, #f1f5f9);border:1px solid var(--border);border-radius:6px;font-weight:600;color:var(--text1);font-size:13px;">
              👤 ${esc(myEmpRecord ? myEmpRecord.name : (loggedUser.username || 'Current Employee'))} 
              <span style="font-size:11px;color:var(--text3);margin-left:4px;">(${esc(myEmpRecord ? (myEmpRecord.employee_code || 'EMP') : 'SELF')})</span>
            </div>
            <input type="hidden" id="leaveEmpId" value="${myEmpRecord ? myEmpRecord.id : (loggedUser.employee_id || 1)}">
          `;
        }
      }
    }
  } catch (e) {}

  async function fetchLeaves() {
    try {
      const res = await fetch(`${API_BASE}/payroll?action=leave-list&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      const currentYear = new Date().getFullYear();
      const myLeaves = data.leaves.filter(l => Boolean(
        (myEmpRecord && l.employee_id == myEmpRecord.id) ||
        (loggedUser.employee_id && l.employee_id == loggedUser.employee_id) ||
        (l.user_id && l.user_id == loggedUser.id) ||
        (loggedUser.username && l.employee_name && l.employee_name.toLowerCase().trim() === loggedUser.username.toLowerCase().trim())
      ));

      let clUsed = 0, slUsed = 0, elUsed = 0, unpaidUsed = 0, totalPendingDays = 0;
      myLeaves.forEach(l => {
        const lYear = new Date(l.start_date || l.created_at).getFullYear();
        if (lYear === currentYear) {
          const days = parseFloat(l.total_days || 1);
          const type = (l.leave_type || '').toLowerCase();
          if (l.status === 'approved') {
            if (type.includes('casual') || type === 'cl') clUsed += days;
            else if (type.includes('sick') || type === 'sl') slUsed += days;
            else if (type.includes('earned') || type === 'el') elUsed += days;
            else unpaidUsed += days;
          } else if (l.status === 'pending') {
            totalPendingDays += days;
          }
        }
      });

      const clObj = configuredLeaveTypes.find(t => t.name.toLowerCase().includes('casual') || t.name.toLowerCase().includes('cl')) || { monthly_quota: 1, yearly_quota: 12 };
      const slObj = configuredLeaveTypes.find(t => t.name.toLowerCase().includes('sick') || t.name.toLowerCase().includes('sl')) || { monthly_quota: 1, yearly_quota: 6 };
      const elObj = configuredLeaveTypes.find(t => t.name.toLowerCase().includes('earned') || t.name.toLowerCase().includes('el')) || { monthly_quota: 1, yearly_quota: 6 };

      const clAllowed = parseInt(clObj.yearly_quota || 12);
      const slAllowed = parseInt(slObj.yearly_quota || 6);
      const elAllowed = parseInt(elObj.yearly_quota || 6);

      const clRemaining = Math.max(0, clAllowed - clUsed);
      const slRemaining = Math.max(0, slAllowed - slUsed);
      const elRemaining = Math.max(0, elAllowed - elUsed);

      const totalAllowedYearly = clAllowed + slAllowed + elAllowed;
      const totalApprovedDays = clUsed + slUsed + elUsed + unpaidUsed;
      const totalRemainingDays = clRemaining + slRemaining + elRemaining;

      const analyticsArea = document.getElementById("leaveAnalyticsArea");
      if (analyticsArea) {
        analyticsArea.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;margin-bottom:16px;">
            <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:10px;padding:14px;">
              <div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;">Yearly Leave Quota</div>
              <div style="font-size:22px;font-weight:700;color:var(--text1);margin-top:2px;">${totalAllowedYearly} <span style="font-size:12px;color:var(--text3);font-weight:normal;">Days</span></div>
            </div>
            <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:10px;padding:14px;">
              <div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;">Approved Used (${currentYear})</div>
              <div style="font-size:22px;font-weight:700;color:var(--success);margin-top:2px;">${totalApprovedDays} <span style="font-size:12px;color:var(--text3);font-weight:normal;">Days</span></div>
            </div>
            <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:10px;padding:14px;">
              <div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;">Pending Approval</div>
              <div style="font-size:22px;font-weight:700;color:#eab308;margin-top:2px;">${totalPendingDays} <span style="font-size:12px;color:var(--text3);font-weight:normal;">Days</span></div>
            </div>
            <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:10px;padding:14px;">
              <div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;">Remaining Balance</div>
              <div style="font-size:22px;font-weight:700;color:#6366f1;margin-top:2px;">${totalRemainingDays} <span style="font-size:12px;color:var(--text3);font-weight:normal;">Days</span></div>
            </div>
          </div>

          <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:20px;">
            <div style="font-size:13px;font-weight:700;color:var(--text1);margin-bottom:10px;">📊 Leave Quota Breakdown per Type (${currentYear})</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));gap:10px;">
              <div style="padding:10px 12px;background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border);">
                <div style="font-size:12px;font-weight:700;color:var(--text1);">🌴 Casual Leave (CL)</div>
                <div style="font-size:11px;color:var(--text2);margin-top:2px;">Quota: ${clObj.monthly_quota || 1}d/mo (${clAllowed}d/yr) | Used: ${clUsed}d</div>
                <div style="font-size:11px;font-weight:700;color:#6366f1;margin-top:2px;">Rem: ${clRemaining} Days</div>
              </div>
              <div style="padding:10px 12px;background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border);">
                <div style="font-size:12px;font-weight:700;color:var(--text1);">🤒 Sick Leave (SL)</div>
                <div style="font-size:11px;color:var(--text2);margin-top:2px;">Quota: ${slObj.monthly_quota || 1}d/mo (${slAllowed}d/yr) | Used: ${slUsed}d</div>
                <div style="font-size:11px;font-weight:700;color:#6366f1;margin-top:2px;">Rem: ${slRemaining} Days</div>
              </div>
              <div style="padding:10px 12px;background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border);">
                <div style="font-size:12px;font-weight:700;color:var(--text1);">⭐ Earned Leave (EL)</div>
                <div style="font-size:11px;color:var(--text2);margin-top:2px;">Quota: ${elObj.monthly_quota || 1}d/mo (${elAllowed}d/yr) | Used: ${elUsed}d</div>
                <div style="font-size:11px;font-weight:700;color:#6366f1;margin-top:2px;">Rem: ${elRemaining} Days</div>
              </div>
              <div style="padding:10px 12px;background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border);">
                <div style="font-size:12px;font-weight:700;color:var(--text1);">💸 Unpaid Leave</div>
                <div style="font-size:11px;color:var(--text2);margin-top:2px;">Taken: ${unpaidUsed}d</div>
                <div style="font-size:11px;font-weight:700;color:var(--text3);margin-top:2px;">No Quota Limit</div>
              </div>
            </div>
          </div>
        `;
      }

      const tbody = document.getElementById("leaveTableBody");
      if (!tbody) return;

      const displayLeaves = (isGenApplyLeave && !isAdminRole) ? myLeaves : data.leaves;

      if (displayLeaves.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text3);">No leave applications found.</td></tr>`;
        if (document.getElementById("leaveInfo")) document.getElementById("leaveInfo").innerHTML = "";
        if (document.getElementById("leavePagination")) document.getElementById("leavePagination").innerHTML = "";
        return;
      }

      window.renderPaginatedTable({
        data: displayLeaves,
        pageSize: 10,
        currentPage: 1,
        tbody: "leaveTableBody",
        paginationContainer: "leavePagination",
        infoContainer: "leaveInfo",
        renderRow: (l) => {
          const isSelfLeave = Boolean(
            (loggedUser.employee_id && (l.employee_id == loggedUser.employee_id)) ||
            (l.user_id && (l.user_id == loggedUser.id)) ||
            (loggedUser.username && l.employee_name && l.employee_name.toLowerCase().trim() === loggedUser.username.toLowerCase().trim())
          );

          let canApprove = false;
          let lockReason = "";

          if (isSelfLeave) {
            canApprove = false;
            lockReason = "Storeadmin & HR cannot approve their own leave applications.";
          } else if (isSuperAdmin) {
            canApprove = true;
          } else {
            const userCompanyId = loggedUser.company_id ? parseInt(loggedUser.company_id) : null;
            const leaveCompanyId = l.company_id ? parseInt(l.company_id) : null;

            if (userCompanyId && leaveCompanyId && userCompanyId !== leaveCompanyId) {
              canApprove = false;
              lockReason = "You can only approve leaves for your assigned company.";
            } else if (['storeadmin', 'hr', 'hr_manager', 'accountant'].includes(loggedUser.role)) {
              canApprove = true;
            }
          }

          return `
            <tr>
              <td style="font-weight:600;color:var(--text1);">
                ${esc(l.employee_name)}
                ${isSelfLeave ? `<span class="badge badge-warning" style="font-size:10px;margin-left:6px;padding:2px 6px;">👤 You</span>` : ''}
                <div style="font-size:11px;color:var(--text3);font-weight:normal;">${esc(l.company_name || '')}</div>
              </td>
              <td><span class="badge badge-purple">${esc(l.leave_type ? l.leave_type.toUpperCase() : 'LEAVE')}</span></td>
              <td>${formatDate(l.start_date)}</td>
              <td>${formatDate(l.end_date)} <span style="font-size:11px;color:var(--text3);">(${l.total_days || 1} d)</span></td>
              <td>${esc(l.reason || '—')}</td>
              <td>
                <span class="badge ${l.status === 'approved' ? 'badge-success' : (l.status === 'rejected' ? 'badge-danger' : 'badge-warning')}">
                  ${esc(l.status ? l.status.toUpperCase() : 'PENDING')}
                </span>
              </td>
              <td>
                ${l.status === 'pending' ? (
                  canApprove ? `
                    <div style="display:flex;gap:6px;">
                      <button class="btn btn-sm btn-success actionLeaveBtn" data-id="${l.id}" data-action="approved">Approve</button>
                      <button class="btn btn-sm btn-danger actionLeaveBtn" data-id="${l.id}" data-action="rejected">Reject</button>
                    </div>
                  ` : `
                    <span class="badge badge-secondary" style="font-size:11px;opacity:0.85;" title="${esc(lockReason || 'Requires Approver')}">🔒 ${isSelfLeave ? 'Pending Approver' : 'Restricted'}</span>
                  `
                ) : '—'}
              </td>
            </tr>
          `;
        },
        onRender: () => {
          tbody.querySelectorAll(".actionLeaveBtn").forEach(btn => {
            btn.addEventListener("click", async () => {
              const lId = btn.dataset.id;
              const status = btn.dataset.action;
              if (btn.disabled) return;
              const origHtml = btn.innerHTML;
              btn.disabled = true;
              btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
              try {
                const r = await fetch(`${API_BASE}/payroll?action=leave-approve`, {
                  method: "POST",
                  headers: authHeaders(),
                  body: JSON.stringify({ leave_id: lId, status })
                });
                const d = await r.json();
                if (d.success) {
                  showToast(`Leave ${status}!`, "success");
                  fetchLeaves();
                } else {
                  showToast(d.error || "Leave approval failed", "error");
                  btn.disabled = false;
                  btn.innerHTML = origHtml;
                }
              } catch (e) {
                showToast("Leave action error: " + e.message, "error");
                btn.disabled = false;
                btn.innerHTML = origHtml;
              }
            });
          });
        }
      });

    } catch (err) {
      showToast("Fetch leaves error: " + err.message, "error");
    }
  }

  // Modals & Events
  on("applyLeaveBtn", "click", () => { document.getElementById("leaveModal").style.display = "flex"; });
  on("leaveModalClose", "click", () => { document.getElementById("leaveModal").style.display = "none"; });
  on("leaveModalCancel", "click", () => { document.getElementById("leaveModal").style.display = "none"; });

  if (document.getElementById("configLeaveQuotasBtn")) {
    on("configLeaveQuotasBtn", "click", () => {
      const container = document.getElementById("leaveTypesConfigContainer");
      if (container) {
        container.innerHTML = `
          <table class="data-table" style="font-size:13px;width:100%;">
            <thead>
              <tr>
                <th>Leave Category Name</th>
                <th style="width:120px;">Monthly Quota</th>
                <th style="width:120px;">Yearly Quota</th>
                <th style="width:110px;">Type</th>
              </tr>
            </thead>
            <tbody>
              ${configuredLeaveTypes.map((t, idx) => `
                <tr data-idx="${idx}">
                  <td>
                    <input type="hidden" class="lt-id" value="${t.id || ''}">
                    <input type="text" class="form-input lt-name" value="${esc(t.name)}" required style="font-weight:600;">
                  </td>
                  <td>
                    <input type="number" min="0" max="31" class="form-input lt-monthly" value="${t.monthly_quota || 0}" required>
                  </td>
                  <td>
                    <input type="number" min="0" max="365" class="form-input lt-yearly" value="${t.yearly_quota || 0}" required>
                  </td>
                  <td>
                    <select class="form-select lt-paid" style="font-weight:600;">
                      <option value="true" ${t.is_paid !== false ? 'selected' : ''}>Paid</option>
                      <option value="false" ${t.is_paid === false ? 'selected' : ''}>Unpaid</option>
                    </select>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      }
      document.getElementById("configQuotaModal").style.display = "flex";
    });
  }

  on("configQuotaModalClose", "click", () => { document.getElementById("configQuotaModal").style.display = "none"; });
  on("configQuotaModalCancel", "click", () => { document.getElementById("configQuotaModal").style.display = "none"; });

  on("configQuotaForm", "submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn) {
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving Quota Settings...`;
    }

    const rows = document.querySelectorAll("#leaveTypesConfigContainer tbody tr");
    const payloadTypes = [];
    rows.forEach(tr => {
      payloadTypes.push({
        id: tr.querySelector(".lt-id").value || null,
        name: tr.querySelector(".lt-name").value.trim(),
        monthly_quota: parseInt(tr.querySelector(".lt-monthly").value || 0),
        yearly_quota: parseInt(tr.querySelector(".lt-yearly").value || 0),
        is_paid: tr.querySelector(".lt-paid").value === 'true'
      });
    });

    try {
      const res = await fetch(`${API_BASE}/payroll?action=save-leave-types`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ company_id: compId, types: payloadTypes })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Leave quotas saved successfully!", "success");
        document.getElementById("configQuotaModal").style.display = "none";
        fetchLeaves();
      } else {
        showToast(data.error || "Failed to save leave quotas", "error");
      }
    } catch (err) {
      showToast("Save quota error: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "💾 Save Quota Settings";
      }
    }
  });

  on("leaveForm", "submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn) {
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Submitting Application...`;
    }

    const selectedEmpId = document.getElementById("leaveEmpId").value;
    const selectedEmpObj = empListForModal.find(x => x.id == selectedEmpId);
    const compIdToSubmit = selectedEmpObj ? selectedEmpObj.company_id : (compId !== 'all' ? compId : 1);

    const payload = {
      company_id: parseInt(compIdToSubmit || 1),
      employee_id: parseInt(selectedEmpId),
      leave_type: document.getElementById("leaveType").value,
      start_date: document.getElementById("leaveStart").value,
      end_date: document.getElementById("leaveEnd").value,
      reason: document.getElementById("leaveReason").value.trim()
    };

    try {
      const res = await fetch(`${API_BASE}/payroll?action=leave-apply`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Leave application submitted successfully!", "success");
        document.getElementById("leaveModal").style.display = "none";
        document.getElementById("leaveForm").reset();
        fetchLeaves();
      } else {
        showToast(data.error || "Failed to submit leave", "error");
      }
    } catch (err) {
      showToast("Submit leave error: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Submit Application";
      }
    }
  });

  fetchLeaves();
}

// ═══════════════════════════════════════════════════
// 7. PAYROLL & PAYSLIPS SUBTAB
// ═══════════════════════════════════════════════════

async function loadPayrollSubTab(isPayslipOnly = false) {
  const subContent = document.getElementById("hrSubContent");
  const compId = getActiveCompId();
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
      <div>
        <h3 style="font-size:17px;font-weight:700;color:var(--text1);">${isPayslipOnly ? '🧾 Employee Payslips Directory' : 'Monthly Salary Processing & History Directory'}</h3>
        <p style="font-size:12px;color:var(--text3);margin-top:2px;">${isPayslipOnly ? 'View and print generated employee monthly payslips.' : 'Calculate salaries based on attendance, paid/unpaid leaves, late cuts, Annexure allowances, Offered LPA, and Actual LPA Taken.'}</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:6px;">
          <label style="font-size:12px;font-weight:600;color:var(--text2);">Month:</label>
          <input type="month" id="payrollMonthSelect" class="form-input" value="${currentMonth}" style="width:150px;font-weight:600;">
        </div>
        ${isPayslipOnly ? '' : '<button class="btn btn-primary" id="processPayrollBtn" style="font-weight:600;">⚙️ Process Monthly Salaries</button>'}
      </div>
    </div>

    <!-- FILTER BAR -->
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap;background:var(--bg-primary);padding:12px 16px;border-radius:10px;border:1px solid var(--border);">
      <div style="flex:1;min-width:220px;">
        <input type="text" id="payrollSearchInput" class="form-input" placeholder="🔍 Search employee by name, code, or department...">
      </div>
      <div style="width:180px;">
        <select id="payrollStatusFilter" class="form-select" style="font-weight:600;">
          <option value="all">All Payment Statuses</option>
          <option value="pending">⏳ Pending</option>
          <option value="paid">✅ Full Paid</option>
          <option value="part_paid">🟡 Partially Paid</option>
          <option value="on_hold">⏸️ On Hold</option>
        </select>
      </div>
    </div>

    <!-- BULK ACTION BAR -->
    ${isPayslipOnly ? '' : `
    <div id="payrollBulkBar" style="display:none;background:var(--bg-secondary);padding:10px 16px;border-radius:10px;border:1px solid var(--border);margin-bottom:14px;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;max-width:100%;">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;max-width:100%;">
        <span class="badge badge-purple" id="bulkCountBadge" style="font-size:12px;font-weight:700;">0 Selected</span>
        <span style="font-size:12px;color:var(--text2);">Bulk operations for selected employees:</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;max-width:100%;">
        <button class="btn btn-sm btn-success" id="btnBulkPaySelected" style="font-weight:600;white-space:nowrap;"><i class="fas fa-check-double me-1"></i> 💳 Pay Selected at Once</button>
        <button class="btn btn-sm btn-warning" id="btnBulkHoldSelected" style="font-weight:600;white-space:nowrap;"><i class="fas fa-pause me-1"></i> ⏸️ Put Selected On Hold</button>
      </div>
    </div>
    `}

    <div class="table-container" style="overflow-x:auto;padding:0;border-radius:10px;border:1px solid var(--border);background:var(--bg-primary);">
      <table class="data-table" style="width:100%;font-size:13px;border-collapse:collapse;min-width:1150px;">
        <thead>
          <tr style="background:var(--bg-secondary);border-bottom:1px solid var(--border);">
            ${isPayslipOnly ? '' : '<th style="width:40px;text-align:center;padding:12px 10px;"><input type="checkbox" id="payrollSelectAll" title="Select All"></th>'}
            <th style="padding:12px 16px;min-width:180px;text-align:left;">Employee</th>
            <th style="padding:12px 12px;min-width:140px;text-align:left;">Offered LPA (CTC)</th>
            <th style="padding:12px 12px;min-width:120px;text-align:left;">Basic Salary</th>
            <th style="padding:12px 12px;min-width:140px;text-align:left;">Allowances & Perks</th>
            <th style="padding:12px 12px;min-width:150px;text-align:left;">Attendance / Leaves</th>
            <th style="padding:12px 12px;min-width:130px;text-align:left;">Total Deductions</th>
            <th style="padding:12px 12px;min-width:120px;text-align:left;">Net Salary</th>
            <th style="padding:12px 12px;min-width:140px;text-align:left;">Actual LPA Taken</th>
            <th style="padding:12px 12px;min-width:130px;text-align:left;">Payment Status</th>
            <th style="padding:12px 16px;min-width:180px;text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody id="payrollTableBody">
          <tr><td colspan="${isPayslipOnly ? 10 : 11}" style="text-align:center;padding:24px;"><div class="spinner"></div> Loading payroll records...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;flex-wrap:wrap;gap:8px;">
      <div id="payrollInfo"></div>
      <div id="payrollPagination" class="pagination"></div>
    </div>

    <!-- SALARY ADJUSTMENT & PAYMENT MODAL -->
    <div class="modal-overlay" id="payrollAdjustModal" style="display:none;z-index:9999;">
      <div class="modal-box" style="max-width:860px;">
        <div class="modal-header">
          <h3 id="pModalTitle">✏️ Adjust & Process Employee Salary</h3>
          <button class="modal-close" id="pModalClose">&times;</button>
        </div>
        <form id="payrollAdjustForm">
          <input type="hidden" id="pModalId">
          <input type="hidden" id="pModalEmpId">
          <input type="hidden" id="pModalCompId">
          <input type="hidden" id="pModalMonthVal">
          <div class="modal-body">
            <div style="background:var(--bg-secondary);padding:12px 16px;border-radius:8px;border:1px solid var(--border);margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
              <div>
                <div style="font-size:15px;font-weight:700;color:var(--text1);" id="pModalEmpName">—</div>
                <div style="font-size:12px;color:var(--text3);" id="pModalEmpMeta">—</div>
              </div>
              <div style="text-align:right;">
                <span class="badge badge-purple" id="pModalMonth" style="font-size:12px;">—</span>
              </div>
            </div>

            <!-- CTC & GROSS AUTO-SPLITTER TOOLBAR -->
            <div style="background:var(--bg-primary);padding:12px 14px;border-radius:10px;border:1px solid var(--border);margin-bottom:14px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
                <span style="font-size:13px;font-weight:700;color:var(--text1);">⚡ CTC / Package Auto-Splitter</span>
                <button type="button" class="btn btn-sm btn-outline" id="pModalAutoSplitBtn" style="font-size:11px;font-weight:600;">⚡ Auto-Calculate Standard Splits</button>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;">
                <div>
                  <label class="form-label" style="font-size:11px;">Annual Package (Offered LPA)</label>
                  <input type="number" step="0.01" id="pModalInputLpa" class="form-input" placeholder="e.g. 6.00">
                </div>
                <div>
                  <label class="form-label" style="font-size:11px;">Target Gross Monthly (₹)</label>
                  <input type="number" step="0.01" id="pModalInputGross" class="form-input" placeholder="e.g. 50000">
                </div>
                <div>
                  <label class="form-label" style="font-size:11px;">Basic Salary % of Gross</label>
                  <input type="number" step="1" min="1" max="100" id="pModalBasicPercent" class="form-input" value="50" placeholder="50">
                </div>
                <div>
                  <label class="form-label" style="font-size:11px;">Employer EPF Strategy *</label>
                  <select id="pModalPfStrategy" class="form-select" style="font-size:12px;font-weight:600;">
                    <option value="capped_1800">📌 Statutory Cap ₹1,800/mo (Max Cash-In-Hand)</option>
                    <option value="actual_12">📈 12% on Actual Basic + DA (Max Compounding)</option>
                    <option value="vpf">💼 Voluntary PF (VPF) (Capped + Extra VPF)</option>
                    <option value="custom">⚙️ Custom Specified Amount</option>
                  </select>
                </div>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <!-- EARNINGS / ALLOWANCES -->
              <div style="background:var(--bg-primary);padding:14px;border-radius:10px;border:1px solid var(--border);">
                <h4 style="font-size:13px;font-weight:700;color:var(--text1);margin-bottom:10px;border-bottom:1px solid var(--border);padding-bottom:6px;">
                  💵 Monthly Earnings (Annexure Structure)
                </h4>
                <div class="form-group" style="margin-bottom:8px;">
                  <label class="form-label" style="font-size:11px;">Basic Salary (50% of Gross) * (₹)</label>
                  <input type="number" step="0.01" id="pModalBasic" class="form-input p-calc" required>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                  <div class="form-group">
                    <label class="form-label" style="font-size:11px;">HRA (40% of Basic) (₹)</label>
                    <input type="number" step="0.01" id="pModalHra" class="form-input p-calc">
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-size:11px;">Dearness (DA) (10% Basic) (₹)</label>
                    <input type="number" step="0.01" id="pModalDa" class="form-input p-calc">
                  </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                  <div class="form-group">
                    <label class="form-label" style="font-size:11px;">Travelling (TA) (5%/Min 1600) (₹)</label>
                    <input type="number" step="0.01" id="pModalTa" class="form-input p-calc">
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-size:11px;">Special Allowance (Balancing) (₹)</label>
                    <input type="number" step="0.01" id="pModalSpecial" class="form-input p-calc">
                  </div>
                </div>

                <details style="margin-top:10px;background:var(--bg-secondary);padding:8px 10px;border-radius:6px;border:1px solid var(--border);">
                  <summary style="font-size:12px;font-weight:700;color:var(--primary);cursor:pointer;">➕ Extended Tax-Exempt & Industry Allowances</summary>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
                    <div class="form-group">
                      <label class="form-label" style="font-size:11px;">Leave Travel (LTA) (₹)</label>
                      <input type="number" step="0.01" id="pModalLta" class="form-input p-calc">
                    </div>
                    <div class="form-group">
                      <label class="form-label" style="font-size:11px;">Children Edu & Hostel (₹)</label>
                      <input type="number" step="0.01" id="pModalEdu" class="form-input p-calc">
                    </div>
                    <div class="form-group">
                      <label class="form-label" style="font-size:11px;">Uniform / Attire (₹)</label>
                      <input type="number" step="0.01" id="pModalUni" class="form-input p-calc">
                    </div>
                    <div class="form-group">
                      <label class="form-label" style="font-size:11px;">Books & Learning (₹)</label>
                      <input type="number" step="0.01" id="pModalLearn" class="form-input p-calc">
                    </div>
                    <div class="form-group">
                      <label class="form-label" style="font-size:11px;">Car Lease & Fuel (₹)</label>
                      <input type="number" step="0.01" id="pModalFuel" class="form-input p-calc">
                    </div>
                    <div class="form-group">
                      <label class="form-label" style="font-size:11px;">City Compensatory (CCA) (₹)</label>
                      <input type="number" step="0.01" id="pModalCca" class="form-input p-calc">
                    </div>
                  </div>
                </details>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
                  <div class="form-group">
                    <label class="form-label" style="font-size:11px;">Monthly Incentives (₹)</label>
                    <input type="number" step="0.01" id="pModalIncentives" class="form-input p-calc">
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-size:11px;">Monthly Bonuses (₹)</label>
                    <input type="number" step="0.01" id="pModalBonuses" class="form-input p-calc">
                  </div>
                </div>

                <div style="padding:8px 12px;background:rgba(99,102,241,0.08);border-radius:6px;margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:12px;font-weight:700;color:var(--text1);">Gross Monthly:</span>
                  <span style="font-size:14px;font-weight:700;color:#6366f1;" id="pModalGrossDisp">₹0.00</span>
                </div>
                <div style="padding:6px 12px;background:rgba(16,185,129,0.08);border-radius:6px;margin-top:6px;display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:12px;font-weight:700;color:var(--text1);">Offered LPA (CTC):</span>
                  <span style="font-size:13px;font-weight:700;color:var(--success);" id="pModalOfferedLpaDisp">₹0.00 LPA</span>
                </div>
              </div>

              <!-- DEDUCTIONS & STATUTORY -->
              <div style="background:var(--bg-primary);padding:14px;border-radius:10px;border:1px solid var(--border);">
                <h4 style="font-size:13px;font-weight:700;color:var(--text1);margin-bottom:10px;border-bottom:1px solid var(--border);padding-bottom:6px;">
                  🔻 Deductions & Statutory Cuts
                </h4>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                  <div class="form-group">
                    <label class="form-label" style="font-size:11px;">Leave / Absent Deductions (₹) <span id="pModalLeaveDaysDisp" style="font-weight:600;color:var(--danger);"></span></label>
                    <input type="number" step="0.01" id="pModalLeaveDed" class="form-input p-calc">
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-size:11px;">Salary Advance Repayment (₹)</label>
                    <input type="number" step="0.01" id="pModalAdvDed" class="form-input p-calc">
                  </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                  <div class="form-group">
                    <label class="form-label" style="font-size:11px;">Provident Fund (EPF) (₹)</label>
                    <input type="number" step="0.01" id="pModalPf" class="form-input p-calc">
                  </div>
                  <div class="form-group" id="pModalVpfGroup" style="display:none;">
                    <label class="form-label" style="font-size:11px;">Voluntary PF (VPF) (₹)</label>
                    <input type="number" step="0.01" id="pModalVpf" class="form-input p-calc">
                  </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                  <div class="form-group">
                    <label class="form-label" style="font-size:11px;">Income Tax (TDS) (₹)</label>
                    <input type="number" step="0.01" id="pModalTds" class="form-input p-calc">
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-size:11px;">Professional Tax (PT) (₹)</label>
                    <input type="number" step="0.01" id="pModalPt" class="form-input p-calc">
                  </div>
                </div>

                <details style="margin-top:10px;background:var(--bg-secondary);padding:8px 10px;border-radius:6px;border:1px solid var(--border);">
                  <summary style="font-size:12px;font-weight:700;color:var(--danger);cursor:pointer;">➕ ESI & Corporate Deductions</summary>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
                    <div class="form-group">
                      <label class="form-label" style="font-size:11px;">ESI Cut (0.75% if Gross≤21k) (₹)</label>
                      <input type="number" step="0.01" id="pModalEsi" class="form-input p-calc">
                    </div>
                    <div class="form-group">
                      <label class="form-label" style="font-size:11px;">Health Insurance (₹)</label>
                      <input type="number" step="0.01" id="pModalInsurance" class="form-input p-calc">
                    </div>
                    <div class="form-group">
                      <label class="form-label" style="font-size:11px;">Canteen / Transport (₹)</label>
                      <input type="number" step="0.01" id="pModalFacility" class="form-input p-calc">
                    </div>
                    <div class="form-group">
                      <label class="form-label" style="font-size:11px;">Other Deductions (₹)</label>
                      <input type="number" step="0.01" id="pModalOtherDed" class="form-input p-calc">
                    </div>
                  </div>
                </details>

                <div style="padding:8px 12px;background:rgba(239,68,68,0.08);border-radius:6px;margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:12px;font-weight:700;color:var(--text1);">Total Deductions:</span>
                  <span style="font-size:14px;font-weight:700;color:var(--danger);" id="pModalTotalDedDisp">₹0.00</span>
                </div>
                <div style="padding:6px 12px;background:rgba(16,185,129,0.12);border-radius:6px;margin-top:6px;display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:12px;font-weight:700;color:var(--text1);">Net Salary Payable:</span>
                  <span style="font-size:15px;font-weight:700;color:var(--success);" id="pModalNetDisp">₹0.00</span>
                </div>
                <div style="padding:4px 12px;margin-top:4px;display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:11px;color:var(--text3);">Actual LPA Taken:</span>
                  <span style="font-size:12px;font-weight:700;color:var(--text1);" id="pModalActualLpaDisp">0.00 LPA</span>
                </div>
              </div>
            </div>

            <!-- PAYMENT SETTLEMENT & HOLD OPTION -->
            <div style="margin-top:14px;background:var(--bg-secondary);padding:14px;border-radius:10px;border:1px solid var(--border);">
              <h4 style="font-size:13px;font-weight:700;color:var(--text1);margin-bottom:10px;">💳 Payment Status & Settlement Options</h4>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="form-group">
                  <label class="form-label">Payment Option *</label>
                  <select id="pModalPaymentType" class="form-select" style="font-weight:600;">
                    <option value="full">✅ Full Payment (Mark Paid)</option>
                    <option value="part">🟡 Part Payment (Enter Paid Amount)</option>
                    <option value="hold">⏸️ Hold Salary (Put On Hold)</option>
                    <option value="pending">⏳ Keep Pending</option>
                  </select>
                </div>
                <div class="form-group" id="pModalPaidAmtGroup" style="display:none;">
                  <label class="form-label">Part Amount Paid Now (₹) *</label>
                  <input type="number" step="0.01" id="pModalPaidAmt" class="form-input" placeholder="e.g. 10000">
                </div>
                <div class="form-group" id="pModalHoldReasonGroup" style="display:none;grid-column:span 2;">
                  <label class="form-label" style="color:var(--danger);">Reason for Holding Salary *</label>
                  <input type="text" id="pModalHoldReason" class="form-input" placeholder="e.g. Pending document verification / Disputed attendance cut">
                </div>
                <div class="form-group" id="pModalPaymentModeGroup">
                  <label class="form-label">Payment Mode</label>
                  <select id="pModalPaymentMode" class="form-select">
                    <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
                    <option value="upi">UPI / Online</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                <div class="form-group" id="pModalTxnGroup">
                  <label class="form-label">Transaction / UTR Reference No.</label>
                  <input type="text" id="pModalTxnRef" class="form-input" placeholder="e.g. UTR19203910293">
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center;">
            <button type="button" class="btn btn-warning" id="pModalQuickReleaseBtn" style="display:none;font-weight:600;">🔓 Release Held Salary</button>
            <div style="display:flex;gap:10px;margin-left:auto;">
              <button type="button" class="btn btn-secondary" id="payrollAdjustCancel">Cancel</button>
              <button type="submit" class="btn btn-primary" style="font-weight:600;">💾 Save & Update Salary</button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <!-- PRE-PROCESSING VARIABLE PAY MODAL -->
    <div class="modal-overlay" id="processPayrollModal" style="display:none;z-index:9999;">
      <div class="modal-box" style="max-width:740px;">
        <div class="modal-header">
          <h3 id="processModalTitle">⚙️ Monthly Salary Pre-Processing</h3>
          <button class="modal-close" id="processModalClose">&times;</button>
        </div>
        <div class="modal-body">
          <div style="padding:12px 14px;background:var(--bg-secondary);border-radius:8px;margin-bottom:14px;">
            <p style="font-size:13px;color:var(--text2);margin:0;">
              Configure monthly <strong>Incentives</strong> or <strong>Bonuses</strong> for employees before running bulk calculation for <strong id="processModalMonthDisp">—</strong>. Attendance cuts and advance repayments will be computed automatically.
            </p>
          </div>
          <div style="max-height:340px;overflow-y:auto;margin-bottom:14px;">
            <table class="data-table" style="font-size:12px;">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Basic Salary</th>
                  <th>Monthly Incentives (₹)</th>
                  <th>Monthly Bonuses (₹)</th>
                </tr>
              </thead>
              <tbody id="processModalEmpList">
                <!-- Populated dynamically -->
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="processModalCancel">Cancel</button>
          <button type="button" class="btn btn-primary" id="processModalConfirmBtn" style="font-weight:600;">🚀 Run Monthly Processing</button>
        </div>
      </div>
    </div>

    <!-- DEDICATED HOLD SALARY MODAL -->
    <div class="modal-overlay" id="singleHoldModal" style="display:none;z-index:9999;">
      <div class="modal-box" style="max-width:480px;">
        <div class="modal-header">
          <h3>⏸️ Put Salary On Hold</h3>
          <button class="modal-close" id="holdModalClose">&times;</button>
        </div>
        <form id="singleHoldForm">
          <input type="hidden" id="holdModalPId">
          <input type="hidden" id="holdModalEmpId">
          <div class="modal-body">
            <div style="margin-bottom:14px;background:rgba(239,68,68,0.08);padding:12px;border-radius:8px;">
              <div style="font-weight:700;font-size:14px;color:var(--text1);" id="holdModalEmpName">—</div>
              <div style="font-size:12px;color:var(--danger);" id="holdModalEmpMeta">Putting salary on hold will withhold payout during monthly processing.</div>
            </div>
            <div class="form-group">
              <label class="form-label" style="color:var(--danger);font-weight:600;">Reason for Holding Salary *</label>
              <textarea id="holdModalReason" class="form-input" rows="3" placeholder="e.g. Pending document submission / disputed attendance / manual audit" required></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="holdModalCancel">Cancel</button>
            <button type="submit" class="btn btn-danger" id="holdModalSubmitBtn" style="font-weight:600;">⏸️ Confirm Put On Hold</button>
          </div>
        </form>
      </div>
    </div>

    <!-- BULK PAY SETTLEMENT MODAL -->
    <div class="modal-overlay" id="bulkPayModal" style="display:none;z-index:9999;">
      <div class="modal-box" style="max-width:480px;">
        <div class="modal-header">
          <h3>💳 Pay Selected Employee Salaries</h3>
          <button class="modal-close" id="bulkPayClose">&times;</button>
        </div>
        <form id="bulkPayForm">
          <div class="modal-body">
            <div style="background:rgba(16,185,129,0.08);padding:12px;border-radius:8px;margin-bottom:14px;">
              <div style="font-size:13px;font-weight:700;color:var(--success);" id="bulkPaySummaryDisp">0 Employees Selected</div>
              <div style="font-size:11px;color:var(--text2);">Selected salaries will be marked as FULL PAID.</div>
            </div>
            <div class="form-group" style="margin-bottom:10px;">
              <label class="form-label">Payment Mode *</label>
              <select id="bulkPayMode" class="form-select" style="font-weight:600;">
                <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
                <option value="upi">UPI / Online</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label">Transaction Ref / UTR No. (Optional)</label>
              <input type="text" id="bulkPayTxnRef" class="form-input" placeholder="e.g. UTR19203910293">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="bulkPayCancel">Cancel</button>
            <button type="submit" class="btn btn-success" id="bulkPaySubmitBtn" style="font-weight:600;">💳 Confirm & Mark Paid</button>
          </div>
        </form>
      </div>
    </div>

    <!-- VIEW PROCESSED SALARY & PAYSLIP MODAL -->
    <div class="modal-overlay" id="viewSalaryModal" style="display:none;z-index:9999;">
      <div class="modal-box" style="max-width:840px;">
        <div class="modal-header">
          <h3>Processed Salary Details & Payslip Summary</h3>
          <button class="modal-close" id="viewSalaryClose">&times;</button>
        </div>
        <div class="modal-body" id="viewSalaryBody">
          <!-- Populated dynamically -->
        </div>
        <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center;">
          <button type="button" class="btn btn-outline" id="viewSalaryEditBtn" style="font-weight:600;padding:8px 16px;border-radius:8px;">✏️ Edit / Adjust Salary Structure</button>
          <div style="display:flex;gap:10px;margin-left:auto;">
            <button type="button" class="btn btn-secondary" id="viewSalaryCancel" style="padding:8px 16px;border-radius:8px;">Close</button>
            <button type="button" class="btn btn-primary" id="viewSalaryPrintBtn" style="font-weight:600;padding:8px 18px;border-radius:8px;"><i class="fas fa-print me-1"></i> 🖨️ Print Payslip</button>
          </div>
        </div>
      </div>
    </div>
  `;

  let payrollDataList = [];

  async function fetchPayroll() {
    const selMonth = document.getElementById("payrollMonthSelect").value;
    const statusFilter = document.getElementById("payrollStatusFilter").value;
    const searchQuery = document.getElementById("payrollSearchInput").value.trim();

    try {
      const res = await fetch(`${API_BASE}/payroll?action=list&month=${selMonth}&status=${statusFilter}&search=${encodeURIComponent(searchQuery)}&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      payrollDataList = data.payroll || [];
      const tbody = document.getElementById("payrollTableBody");
      if (!tbody) return;

      if (payrollDataList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${isPayslipOnly ? 10 : 11}" style="text-align:center;padding:24px;color:var(--text3);">No ${isPayslipOnly ? 'payslip' : 'payroll'} records found matching selected criteria. ${isPayslipOnly ? '' : 'Click ⚙️ Process Monthly Salaries above.'}</td></tr>`;
        if (document.getElementById("payrollInfo")) document.getElementById("payrollInfo").innerHTML = "";
        if (document.getElementById("payrollPagination")) document.getElementById("payrollPagination").innerHTML = "";
        return;
      }

      window.renderPaginatedTable({
        data: payrollDataList,
        pageSize: 10,
        currentPage: 1,
        tbody: "payrollTableBody",
        paginationContainer: "payrollPagination",
        infoContainer: "payrollInfo",
        renderRow: (p) => {
          const basic = parseFloat(p.basic_salary || 0);
          const totalAllowances = parseFloat(p.hra || 0) + parseFloat(p.da || 0) + parseFloat(p.ta || 0) + parseFloat(p.special_allowance || 0) + parseFloat(p.incentives || 0) + parseFloat(p.bonuses || 0);
          const status = (p.payment_status || 'pending').toLowerCase();
          const offeredLpa = parseFloat(p.offered_lpa || 0);
          const actualLpa = parseFloat(p.actual_lpa || 0);

          let statusBadge = `<span class="badge badge-secondary">PENDING ⏳</span>`;
          if (status === 'paid') {
            statusBadge = `<span class="badge badge-success">FULL PAID ✅</span>`;
          } else if (status === 'part_paid') {
            statusBadge = `
              <span class="badge badge-warning" title="Paid: ${formatCurrency(p.paid_amount || 0)} | Bal: ${formatCurrency(p.remaining_balance || 0)}">
                PART PAID 🟡 (${formatCurrency(p.paid_amount || 0)})
              </span>
            `;
          } else if (status === 'on_hold') {
            statusBadge = `
              <span class="badge badge-danger" title="Reason: ${esc(p.hold_reason || 'Held by Management')}">
                ON HOLD ⏸️
              </span>
            `;
          }

          return `
            <tr style="border-bottom:1px solid var(--border);">
              ${isPayslipOnly ? '' : `
                <td style="text-align:center;padding:10px 10px;">
                  <input type="checkbox" class="payroll-row-chk" data-id="${p.id || ''}" data-empid="${p.employee_id}" data-name="${esc(p.employee_name)}" data-net="${p.net_salary || 0}">
                </td>
              `}
              <td style="padding:10px 16px;min-width:180px;">
                <div style="font-weight:700;color:var(--text1);">${esc(p.employee_name)}</div>
                <div style="font-size:11px;color:var(--text3);">${esc(p.employee_code || 'EMP-' + p.employee_id)} • ${esc(p.department || 'Staff')}</div>
              </td>
              <td style="padding:10px 12px;min-width:140px;">
                <div style="font-weight:700;color:#6366f1;">₹ ${offeredLpa.toFixed(2)} LPA</div>
                <div style="font-size:11px;color:var(--text3);">Gross: ${formatCurrency(p.gross_salary || (basic + totalAllowances))}</div>
              </td>
              <td style="padding:10px 12px;min-width:120px;font-weight:600;color:var(--text1);">${formatCurrency(basic)}</td>
              <td style="padding:10px 12px;min-width:140px;">
                <span class="badge badge-outline" title="HRA: ${p.hra || 0}, TA: ${p.ta || 0}, Inc: ${p.incentives || 0}, Bonus: ${p.bonuses || 0}">
                  + ${formatCurrency(totalAllowances)}
                </span>
              </td>
              <td style="padding:10px 12px;min-width:150px;">
                <div style="font-size:12px;font-weight:600;color:var(--text2);">${p.present_days || 0} P / ${p.late_days || 0} L</div>
                <div style="font-size:11px;color:var(--text3);">${p.paid_leave_days || 0} Paid Lv / ${p.unpaid_leave_days || 0} Unpaid / ${p.absent_days || 0} Abs</div>
              </td>
              <td style="padding:10px 12px;min-width:130px;font-weight:600;color:var(--danger);">
                <div>${formatCurrency(p.total_deductions || 0)}</div>
                ${parseFloat(p.leave_deductions || 0) > 0 ? `
                  <div style="font-size:10px;color:var(--danger);font-weight:600;" title="Leave / Absent Cut: ${formatCurrency(p.leave_deductions || 0)}">
                    (${(p.unpaid_leave_days || 0) + (p.absent_days || 0)} unpaid days cut)
                  </div>
                ` : ''}
              </td>
              <td style="padding:10px 12px;min-width:120px;font-weight:700;color:var(--success);font-size:14px;">${formatCurrency(p.net_salary)}</td>
              <td style="padding:10px 12px;min-width:140px;">
                <div style="font-weight:700;color:var(--success);">₹ ${actualLpa.toFixed(2)} LPA</div>
                <div style="font-size:11px;color:var(--text3);">Take-Home Annualized</div>
              </td>
              <td style="padding:10px 12px;min-width:130px;">${statusBadge}</td>
              <td style="padding:10px 16px;min-width:180px;text-align:right;">
                <div style="display:flex;gap:6px;justify-content:flex-end;align-items:center;">
                  ${isPayslipOnly ? `
                    <button class="btn btn-sm btn-primary viewPayrollBtn" data-id="${p.id || ''}" data-empid="${p.employee_id}" style="font-weight:600;"><i class="fas fa-file-invoice-dollar me-1"></i> 👁️ View Payslip</button>
                  ` : `
                    <button class="btn btn-sm btn-info viewPayrollBtn" data-id="${p.id || ''}" data-empid="${p.employee_id}" style="font-weight:600;">👁️ View</button>
                    <button class="btn btn-sm btn-outline adjustPayrollBtn" data-id="${p.id || ''}" data-empid="${p.employee_id}">✏️ Adjust</button>
                    ${status === 'on_hold' ? `
                      <button class="btn btn-sm btn-warning releaseHoldBtn" data-id="${p.id || ''}" data-empid="${p.employee_id}" style="font-weight:600;">🔓 Release</button>
                    ` : `
                      <button class="btn btn-sm btn-outline holdSingleBtn" data-id="${p.id || ''}" data-empid="${p.employee_id}" data-name="${esc(p.employee_name)}" style="color:var(--danger);border-color:var(--danger);">⏸️ Hold</button>
                      ${status !== 'paid' ? `<button class="btn btn-sm btn-success quickPayBtn" data-id="${p.id || ''}" data-empid="${p.employee_id}">💸 Pay</button>` : ''}
                    `}
                  `}
                </div>
              </td>
            </tr>
          `;
        },
        onRender: () => {
          // Checkbox logic & Bulk Toolbar
          const selectAllChk = document.getElementById("payrollSelectAll");
          const rowChks = document.querySelectorAll(".payroll-row-chk");
          const bulkBar = document.getElementById("payrollBulkBar");
          const bulkBadge = document.getElementById("bulkCountBadge");

          function updateBulkSelection() {
            const checked = Array.from(rowChks).filter(c => c.checked);
            if (checked.length > 0) {
              if (bulkBar) bulkBar.style.display = "flex";
              if (bulkBadge) bulkBadge.textContent = `${checked.length} Selected`;
            } else {
              if (bulkBar) bulkBar.style.display = "none";
              if (selectAllChk) selectAllChk.checked = false;
            }
          }

          if (selectAllChk) {
            selectAllChk.checked = false;
            selectAllChk.onclick = () => {
              rowChks.forEach(c => c.checked = selectAllChk.checked);
              updateBulkSelection();
            };
          }

          rowChks.forEach(c => {
            c.onclick = updateBulkSelection;
          });

          // View Processed Salary Button Listener
          tbody.querySelectorAll(".viewPayrollBtn").forEach(btn => {
            btn.addEventListener("click", () => {
              const pId = btn.dataset.id;
              const empId = btn.dataset.empid;
              const rec = payrollDataList.find(x => (pId && pId !== 'null' && x.id == pId) || (empId && x.employee_id == empId));
              if (rec) openViewSalaryModal(rec, isPayslipOnly);
            });
          });

          // Single Hold Button Listener
          tbody.querySelectorAll(".holdSingleBtn").forEach(btn => {
            btn.addEventListener("click", () => {
              document.getElementById("holdModalPId").value = btn.dataset.id || "";
              document.getElementById("holdModalEmpId").value = btn.dataset.empid || "";
              document.getElementById("holdModalEmpName").textContent = btn.dataset.name || "Employee";
              document.getElementById("holdModalReason").value = "";
              document.getElementById("singleHoldModal").style.display = "flex";
            });
          });

          tbody.querySelectorAll(".adjustPayrollBtn").forEach(btn => {
            btn.addEventListener("click", () => {
              const pId = btn.dataset.id;
              const empId = btn.dataset.empid;
              const rec = payrollDataList.find(x => (pId && pId !== 'null' && x.id == pId) || (empId && x.employee_id == empId));
              if (rec) openAdjustModal(rec);
            });
          });

          tbody.querySelectorAll(".releaseHoldBtn").forEach(btn => {
            btn.addEventListener("click", async () => {
              const pId = btn.dataset.id;
              if (!pId || pId === 'null') return;
              if (!confirm("Are you sure you want to RELEASE this held salary and mark it as FULL PAID?")) return;
              if (btn.disabled) return;
              btn.disabled = true;
              btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Releasing...`;
              try {
                const r = await fetch(`${API_BASE}/payroll?action=release-hold`, {
                  method: "POST",
                  headers: authHeaders(),
                  body: JSON.stringify({ payroll_id: pId })
                });
                const d = await r.json();
                if (d.success) {
                  showToast(d.message || "Held salary released successfully!", "success");
                  fetchPayroll();
                } else {
                  showToast(d.error || "Failed to release held salary", "error");
                  btn.disabled = false;
                  btn.innerHTML = "🔓 Release";
                }
              } catch (e) {
                showToast("Release error: " + e.message, "error");
                btn.disabled = false;
                btn.innerHTML = "🔓 Release";
              }
            });
          });

          tbody.querySelectorAll(".quickPayBtn").forEach(btn => {
            btn.addEventListener("click", async () => {
              const pId = btn.dataset.id;
              const empId = btn.dataset.empid;
              const rec = payrollDataList.find(x => (pId && pId !== 'null' && x.id == pId) || (empId && x.employee_id == empId));

              if ((!pId || pId === 'null') && rec) {
                openAdjustModal(rec);
                document.getElementById("pModalPaymentType").value = "full";
                togglePaymentFields();
                return;
              }

              if (btn.disabled) return;
              btn.disabled = true;
              btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Paying...`;
              try {
                const r = await fetch(`${API_BASE}/payroll?action=update-status`, {
                  method: "POST",
                  headers: authHeaders(),
                  body: JSON.stringify({ payroll_ids: [parseInt(pId)], payment_mode: "bank_transfer" })
                });
                const d = await r.json();
                if (d.success) {
                  showToast("Salary marked as Full Paid!", "success");
                  fetchPayroll();
                } else {
                  showToast(d.error || "Payment failed", "error");
                  btn.disabled = false;
                  btn.innerHTML = "💸 Pay";
                }
              } catch (e) {
                showToast("Action error: " + e.message, "error");
                btn.disabled = false;
                btn.innerHTML = "💸 Pay";
              }
            });
          });
        }
      });

    } catch (err) {
      showToast("Payroll fetch error: " + err.message, "error");
    }
  }

  let currentViewingRec = null;

  function openViewSalaryModal(rec, isPayslipOnly = false) {
    currentViewingRec = rec;
    const modal = document.getElementById("viewSalaryModal");
    const body = document.getElementById("viewSalaryBody");
    const editBtn = document.getElementById("viewSalaryEditBtn");
    if (!modal || !body) return;

    if (editBtn) {
      editBtn.style.display = isPayslipOnly ? "none" : "inline-block";
    }

    const basic = parseFloat(rec.basic_salary || 0);
    const hra = parseFloat(rec.hra || 0);
    const da = parseFloat(rec.da || 0);
    const ta = parseFloat(rec.ta || 0);
    const special = parseFloat(rec.special_allowance || 0);
    const lta = parseFloat(rec.lta_allowance || 0);
    const edu = parseFloat(rec.children_edu_allowance || 0);
    const uni = parseFloat(rec.uniform_allowance || 0);
    const learn = parseFloat(rec.learning_allowance || 0);
    const fuel = parseFloat(rec.car_fuel_allowance || 0);
    const cca = parseFloat(rec.cca_allowance || 0);
    const inc = parseFloat(rec.incentives || 0);
    const bon = parseFloat(rec.bonuses || 0);

    const allowancesSum = hra + da + ta + special + lta + edu + uni + learn + fuel + cca + inc + bon;
    const gross = parseFloat(rec.gross_salary || (basic + allowancesSum));
    const rawOffered = parseFloat(rec.offered_lpa || 0);
    const offeredLpa = rawOffered > 0 ? rawOffered : (Math.round((gross * 12 / 100000) * 100) / 100);

    const leaveDed = parseFloat(rec.leave_deductions || 0);
    const advDed = parseFloat(rec.advance_deductions || 0);
    const pf = parseFloat(rec.pf_deduction || 0);
    const vpf = parseFloat(rec.vpf_deduction || 0);
    const esi = parseFloat(rec.esi_deduction || 0);
    const tds = parseFloat(rec.tds_deduction || 0);
    const pt = parseFloat(rec.pt_deduction || 0);
    const insurance = parseFloat(rec.insurance_deduction || 0);
    const facility = parseFloat(rec.facility_deduction || 0);
    const oth = parseFloat(rec.other_deductions || 0);

    const totalDed = parseFloat(rec.total_deductions || (leaveDed + advDed + pf + vpf + esi + tds + pt + insurance + facility + oth));
    const netSalary = parseFloat(rec.net_salary || Math.max(0, gross - totalDed));
    const rawActual = parseFloat(rec.actual_lpa || 0);
    const actualLpa = rawActual > 0 ? rawActual : (Math.round((netSalary * 12 / 100000) * 100) / 100);

    const pStatus = (rec.payment_status || 'pending').toLowerCase();
    let statusHtml = `<span class="badge badge-secondary">PENDING ⏳</span>`;
    if (pStatus === 'paid') statusHtml = `<span class="badge badge-success">FULL PAID ✅</span>`;
    else if (pStatus === 'part_paid') statusHtml = `<span class="badge badge-warning">PART PAID 🟡 (Paid: ${formatCurrency(rec.paid_amount || 0)})</span>`;
    else if (pStatus === 'on_hold') statusHtml = `<span class="badge badge-danger">ON HOLD ⏸️</span>`;

    const unpaidDaysCount = (parseInt(rec.unpaid_leave_days || 0)) + (parseInt(rec.absent_days || 0)) + (parseInt(rec.late_days || 0) * 0.5);

    body.innerHTML = `
      <div style="background:var(--bg-secondary);padding:12px 16px;border-radius:8px;border:1px solid var(--border);margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--text1);">${esc(rec.employee_name)}</div>
          <div style="font-size:12px;color:var(--text3);">${esc(rec.employee_code || 'EMP-' + rec.employee_id)} • ${esc(rec.department || 'Staff')} • ${esc(rec.company_name || 'Main Company')}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px;font-weight:700;color:var(--text2);">Month: ${rec.month || rec.month_year || 'Current'}</div>
          <div style="margin-top:4px;">${statusHtml}</div>
        </div>
      </div>

      <!-- ATTENDANCE SUMMARY -->
      <div style="background:var(--bg-primary);padding:10px 14px;border-radius:8px;border:1px solid var(--border);margin-bottom:14px;display:flex;justify-content:space-around;text-align:center;font-size:12px;">
        <div><div style="color:var(--text3);">Present Days</div><div style="font-weight:700;font-size:14px;color:var(--success);">${rec.present_days || 0}</div></div>
        <div><div style="color:var(--text3);">Late Days</div><div style="font-weight:700;font-size:14px;color:var(--warning);">${rec.late_days || 0}</div></div>
        <div><div style="color:var(--text3);">Paid Leaves</div><div style="font-weight:700;font-size:14px;color:#6366f1;">${rec.paid_leave_days || 0}</div></div>
        <div><div style="color:var(--text3);">Unpaid / Absent</div><div style="font-weight:700;font-size:14px;color:var(--danger);">${unpaidDaysCount} Days</div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <!-- EARNINGS BREAKDOWN -->
        <div style="background:var(--bg-primary);padding:14px;border-radius:10px;border:1px solid var(--border);">
          <h4 style="font-size:13px;font-weight:700;color:var(--text1);margin-bottom:10px;border-bottom:1px solid var(--border);padding-bottom:6px;">💵 Monthly Earnings Breakdown</h4>
          <table style="width:100%;font-size:12px;border-collapse:collapse;">
            <tr style="border-bottom:1px solid var(--border);"><td style="padding:4px 0;color:var(--text2);">Basic Salary</td><td style="text-align:right;font-weight:600;">${formatCurrency(basic)}</td></tr>
            <tr style="border-bottom:1px solid var(--border);"><td style="padding:4px 0;color:var(--text2);">House Rent Allowance (HRA)</td><td style="text-align:right;font-weight:600;">${formatCurrency(hra)}</td></tr>
            <tr style="border-bottom:1px solid var(--border);"><td style="padding:4px 0;color:var(--text2);">Dearness Allowance (DA)</td><td style="text-align:right;font-weight:600;">${formatCurrency(da)}</td></tr>
            <tr style="border-bottom:1px solid var(--border);"><td style="padding:4px 0;color:var(--text2);">Transport Allowance (TA)</td><td style="text-align:right;font-weight:600;">${formatCurrency(ta)}</td></tr>
            <tr style="border-bottom:1px solid var(--border);"><td style="padding:4px 0;color:var(--text2);">Special Allowance</td><td style="text-align:right;font-weight:600;">${formatCurrency(special)}</td></tr>
            ${(lta + edu + uni + learn + fuel + cca) > 0 ? `
              <tr style="border-bottom:1px solid var(--border);"><td style="padding:4px 0;color:var(--text2);">Extended Perks (LTA/Edu/Fuel/CCA)</td><td style="text-align:right;font-weight:600;">${formatCurrency(lta + edu + uni + learn + fuel + cca)}</td></tr>
            ` : ''}
            ${(inc + bon) > 0 ? `
              <tr style="border-bottom:1px solid var(--border);"><td style="padding:4px 0;color:var(--text2);">Variable Pay (Incentives/Bonuses)</td><td style="text-align:right;font-weight:600;color:var(--success);">${formatCurrency(inc + bon)}</td></tr>
            ` : ''}
          </table>
          <div style="margin-top:12px;padding:8px 10px;background:rgba(99,102,241,0.08);border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:12px;font-weight:700;">Gross Monthly:</span>
            <span style="font-size:14px;font-weight:700;color:#6366f1;">${formatCurrency(gross)}</span>
          </div>
          <div style="margin-top:4px;padding:6px 10px;background:rgba(16,185,129,0.08);border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:11px;font-weight:700;">Offered LPA (CTC):</span>
            <span style="font-size:12px;font-weight:700;color:var(--success);">₹ ${offeredLpa.toFixed(2)} LPA</span>
          </div>
        </div>

        <!-- DEDUCTIONS BREAKDOWN -->
        <div style="background:var(--bg-primary);padding:14px;border-radius:10px;border:1px solid var(--border);">
          <h4 style="font-size:13px;font-weight:700;color:var(--text1);margin-bottom:10px;border-bottom:1px solid var(--border);padding-bottom:6px;">🔻 Deductions & Statutory Cuts</h4>
          <table style="width:100%;font-size:12px;border-collapse:collapse;">
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:4px 0;color:var(--text2);">
                Leave / Absent Cut
                ${unpaidDaysCount > 0 ? `<div style="font-size:10px;color:var(--danger);">(${unpaidDaysCount} unpaid/absent days cut)</div>` : ''}
              </td>
              <td style="text-align:right;font-weight:600;color:var(--danger);">${formatCurrency(leaveDed)}</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border);"><td style="padding:4px 0;color:var(--text2);">Salary Advance Repayment</td><td style="text-align:right;font-weight:600;">${formatCurrency(advDed)}</td></tr>
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:4px 0;color:var(--text2);">Provident Fund (EPF)</td>
              <td style="text-align:right;font-weight:600;">${formatCurrency(pf)}</td>
            </tr>
            ${vpf > 0 ? `<tr style="border-bottom:1px solid var(--border);"><td style="padding:4px 0;color:var(--text2);">Voluntary PF (VPF)</td><td style="text-align:right;font-weight:600;">${formatCurrency(vpf)}</td></tr>` : ''}
            ${esi > 0 ? `<tr style="border-bottom:1px solid var(--border);"><td style="padding:4px 0;color:var(--text2);">ESI Cut</td><td style="text-align:right;font-weight:600;">${formatCurrency(esi)}</td></tr>` : ''}
            ${tds > 0 ? `<tr style="border-bottom:1px solid var(--border);"><td style="padding:4px 0;color:var(--text2);">Income Tax (TDS)</td><td style="text-align:right;font-weight:600;">${formatCurrency(tds)}</td></tr>` : ''}
            ${pt > 0 ? `<tr style="border-bottom:1px solid var(--border);"><td style="padding:4px 0;color:var(--text2);">Professional Tax (PT)</td><td style="text-align:right;font-weight:600;">${formatCurrency(pt)}</td></tr>` : ''}
            ${(insurance + facility + oth) > 0 ? `<tr style="border-bottom:1px solid var(--border);"><td style="padding:4px 0;color:var(--text2);">Other / Corporate Cuts</td><td style="text-align:right;font-weight:600;">${formatCurrency(insurance + facility + oth)}</td></tr>` : ''}
          </table>
          <div style="margin-top:12px;padding:8px 10px;background:rgba(239,68,68,0.08);border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:12px;font-weight:700;">Total Deductions:</span>
            <span style="font-size:14px;font-weight:700;color:var(--danger);">${formatCurrency(totalDed)}</span>
          </div>
          <div style="margin-top:4px;padding:8px 10px;background:rgba(16,185,129,0.12);border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:13px;font-weight:700;">Net Salary Payable:</span>
            <span style="font-size:15px;font-weight:700;color:var(--success);">${formatCurrency(netSalary)}</span>
          </div>
        </div>
      </div>
    `;

    modal.style.display = "flex";
  }

  function openAdjustModal(rec) {
    const selMonth = document.getElementById("payrollMonthSelect") ? document.getElementById("payrollMonthSelect").value : new Date().toISOString().slice(0, 7);
    document.getElementById("pModalId").value = rec.id || "";
    document.getElementById("pModalEmpId").value = rec.employee_id || "";
    document.getElementById("pModalCompId").value = rec.company_id || getActiveCompId() || 1;
    document.getElementById("pModalMonthVal").value = rec.month || rec.month_year || selMonth;

    document.getElementById("pModalEmpName").textContent = rec.employee_name;
    document.getElementById("pModalEmpMeta").textContent = `${rec.employee_code || 'EMP-' + rec.employee_id} • ${rec.department || 'Staff'} • ${rec.company_name || 'Main'}`;
    document.getElementById("pModalMonth").textContent = `Month: ${rec.month || rec.month_year || selMonth}`;

    const basic = parseFloat(rec.basic_salary || 0);
    const hra = parseFloat(rec.hra || Math.round(basic * 0.40));
    const da = parseFloat(rec.da || Math.round(basic * 0.10));
    const ta = parseFloat(rec.ta || Math.max(0, Math.round(basic * 0.05)));
    const special = parseFloat(rec.special_allowance || Math.round(basic * 0.15));
    const inc = parseFloat(rec.incentives || 0);
    const bon = parseFloat(rec.bonuses || 0);

    const lta = parseFloat(rec.lta_allowance || 0);
    const edu = parseFloat(rec.children_edu_allowance || 0);
    const uni = parseFloat(rec.uniform_allowance || 0);
    const learn = parseFloat(rec.learning_allowance || 0);
    const fuel = parseFloat(rec.car_fuel_allowance || 0);
    const cca = parseFloat(rec.cca_allowance || 0);

    document.getElementById("pModalBasic").value = basic;
    document.getElementById("pModalHra").value = hra;
    document.getElementById("pModalDa").value = da;
    document.getElementById("pModalTa").value = ta;
    document.getElementById("pModalSpecial").value = special;
    document.getElementById("pModalIncentives").value = inc;
    document.getElementById("pModalBonuses").value = bon;

    document.getElementById("pModalLta").value = lta;
    document.getElementById("pModalEdu").value = edu;
    document.getElementById("pModalUni").value = uni;
    document.getElementById("pModalLearn").value = learn;
    document.getElementById("pModalFuel").value = fuel;
    document.getElementById("pModalCca").value = cca;

    const pfMode = rec.pf_calculation_mode || 'capped_1800';
    document.getElementById("pModalPfStrategy").value = pfMode;
    document.getElementById("pModalVpf").value = parseFloat(rec.vpf_deduction || 0);
    const vpfGroup = document.getElementById("pModalVpfGroup");
    if (vpfGroup) vpfGroup.style.display = (pfMode === 'vpf') ? 'block' : 'none';

    const leaveDed = parseFloat(rec.leave_deductions || 0);
    const advDed = parseFloat(rec.advance_deductions || 0);
    const pf = parseFloat(rec.pf_deduction || Math.min(1800, Math.round((basic + da) * 0.12)));
    const esi = parseFloat(rec.esi_deduction || 0);
    const tds = parseFloat(rec.tds_deduction || 0);
    const pt = parseFloat(rec.pt_deduction || 0);
    const insurance = parseFloat(rec.insurance_deduction || 0);
    const facility = parseFloat(rec.facility_deduction || 0);
    const othDed = parseFloat(rec.other_deductions || 0);

    const unpaidDaysCount = (parseInt(rec.unpaid_leave_days || 0)) + (parseInt(rec.absent_days || 0)) + (parseInt(rec.late_days || 0) * 0.5);
    const leaveDaysDisp = document.getElementById("pModalLeaveDaysDisp");
    if (leaveDaysDisp) {
      leaveDaysDisp.textContent = unpaidDaysCount > 0 ? `(${unpaidDaysCount} unpaid/absent days cut)` : `(0 unpaid days cut)`;
    }

    document.getElementById("pModalLeaveDed").value = leaveDed;
    document.getElementById("pModalAdvDed").value = advDed;
    document.getElementById("pModalPf").value = pf;
    document.getElementById("pModalEsi").value = esi;
    document.getElementById("pModalTds").value = tds;
    document.getElementById("pModalPt").value = pt;
    document.getElementById("pModalInsurance").value = insurance;
    document.getElementById("pModalFacility").value = facility;
    document.getElementById("pModalOtherDed").value = othDed;

    // Gross & Offered LPA calculation without double addition
    const calcGross = rec.gross_salary || (rec.offered_lpa ? Math.round((rec.offered_lpa * 100000 / 12) * 100) / 100 : (basic + hra + da + ta + special + inc + bon + lta + edu + uni + learn + fuel + cca));
    const offeredLpa = rec.offered_lpa || Math.round((calcGross * 12 / 100000) * 100) / 100;
    const basicPct = (basic > 0 && calcGross > 0) ? Math.round((basic / calcGross) * 100) : 50;

    document.getElementById("pModalInputGross").value = calcGross;
    document.getElementById("pModalInputLpa").value = offeredLpa;
    document.getElementById("pModalBasicPercent").value = basicPct;

    const pTypeSel = document.getElementById("pModalPaymentType");
    const currentStatus = (rec.payment_status || 'pending').toLowerCase();
    if (currentStatus === 'on_hold') pTypeSel.value = 'hold';
    else if (currentStatus === 'part_paid') pTypeSel.value = 'part';
    else if (currentStatus === 'paid') pTypeSel.value = 'full';
    else pTypeSel.value = 'pending';

    document.getElementById("pModalPaidAmt").value = rec.paid_amount || 0;
    document.getElementById("pModalHoldReason").value = rec.hold_reason || "";
    document.getElementById("pModalPaymentMode").value = rec.payment_mode || "bank_transfer";
    document.getElementById("pModalTxnRef").value = rec.transaction_ref || "";

    const releaseBtn = document.getElementById("pModalQuickReleaseBtn");
    if (currentStatus === 'on_hold') {
      releaseBtn.style.display = "inline-block";
    } else {
      releaseBtn.style.display = "none";
    }

    recalculatePfByStrategy();
    updateModalCalculations();
    togglePaymentFields();

    document.getElementById("payrollAdjustModal").style.display = "flex";
  }

  function recalculatePfByStrategy() {
    const pfMode = document.getElementById("pModalPfStrategy")?.value || 'capped_1800';
    const basic = parseFloat(document.getElementById("pModalBasic")?.value || 0);
    const da = parseFloat(document.getElementById("pModalDa")?.value || 0);
    const vpfGroup = document.getElementById("pModalVpfGroup");
    const pfInput = document.getElementById("pModalPf");

    if (vpfGroup) vpfGroup.style.display = (pfMode === 'vpf') ? 'block' : 'none';

    if (!pfInput) return;

    if (pfMode === 'capped_1800') {
      pfInput.value = Math.min(1800, Math.round((basic + da) * 0.12 * 100) / 100);
    } else if (pfMode === 'actual_12') {
      pfInput.value = Math.round((basic + da) * 0.12 * 100) / 100;
    } else if (pfMode === 'vpf') {
      pfInput.value = Math.min(1800, Math.round((basic + da) * 0.12 * 100) / 100);
    }
  }

  function updateModalCalculations() {
    const basic = parseFloat(document.getElementById("pModalBasic").value || 0);
    const hra = parseFloat(document.getElementById("pModalHra").value || 0);
    const da = parseFloat(document.getElementById("pModalDa").value || 0);
    const ta = parseFloat(document.getElementById("pModalTa").value || 0);
    const special = parseFloat(document.getElementById("pModalSpecial").value || 0);
    const inc = parseFloat(document.getElementById("pModalIncentives").value || 0);
    const bon = parseFloat(document.getElementById("pModalBonuses").value || 0);

    const lta = parseFloat(document.getElementById("pModalLta").value || 0);
    const edu = parseFloat(document.getElementById("pModalEdu").value || 0);
    const uni = parseFloat(document.getElementById("pModalUni").value || 0);
    const learn = parseFloat(document.getElementById("pModalLearn").value || 0);
    const fuel = parseFloat(document.getElementById("pModalFuel").value || 0);
    const cca = parseFloat(document.getElementById("pModalCca").value || 0);

    const grossMonthly = basic + hra + da + ta + special + inc + bon + lta + edu + uni + learn + fuel + cca;
    const offeredLpa = Math.round((grossMonthly * 12 / 100000) * 100) / 100;

    const leaveDed = parseFloat(document.getElementById("pModalLeaveDed").value || 0);
    const advDed = parseFloat(document.getElementById("pModalAdvDed").value || 0);
    const pf = parseFloat(document.getElementById("pModalPf").value || 0);
    const esi = parseFloat(document.getElementById("pModalEsi").value || 0);
    const tds = parseFloat(document.getElementById("pModalTds").value || 0);
    const pt = parseFloat(document.getElementById("pModalPt").value || 0);
    const insurance = parseFloat(document.getElementById("pModalInsurance").value || 0);
    const facility = parseFloat(document.getElementById("pModalFacility").value || 0);
    const othDed = parseFloat(document.getElementById("pModalOtherDed").value || 0);

    const totalDed = leaveDed + advDed + pf + esi + tds + pt + insurance + facility + othDed;
    const netSalary = Math.max(0, grossMonthly - totalDed);
    const actualLpa = Math.round((netSalary * 12 / 100000) * 100) / 100;

    document.getElementById("pModalGrossDisp").textContent = formatCurrency(grossMonthly);
    document.getElementById("pModalOfferedLpaDisp").textContent = `₹ ${offeredLpa.toFixed(2)} LPA`;
    document.getElementById("pModalTotalDedDisp").textContent = formatCurrency(totalDed);
    document.getElementById("pModalNetDisp").textContent = formatCurrency(netSalary);
    document.getElementById("pModalActualLpaDisp").textContent = `₹ ${actualLpa.toFixed(2)} LPA`;
  }

  function togglePaymentFields() {
    const pType = document.getElementById("pModalPaymentType").value;
    const paidGroup = document.getElementById("pModalPaidAmtGroup");
    const holdGroup = document.getElementById("pModalHoldReasonGroup");

    if (pType === "part") {
      paidGroup.style.display = "block";
      holdGroup.style.display = "none";
    } else if (pType === "hold") {
      paidGroup.style.display = "none";
      holdGroup.style.display = "block";
    } else {
      paidGroup.style.display = "none";
      holdGroup.style.display = "none";
    }
  }

  function handleAutoCalculateSplits() {
    const btn = document.getElementById("pModalAutoSplitBtn");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Calculating...`;
    }

    setTimeout(() => {
      const lpaInput = parseFloat(document.getElementById("pModalInputLpa")?.value || 0);
      let targetGross = parseFloat(document.getElementById("pModalInputGross")?.value || 0);
      if (lpaInput > 0) {
        targetGross = Math.round((lpaInput * 100000 / 12) * 100) / 100;
        if (document.getElementById("pModalInputGross")) document.getElementById("pModalInputGross").value = targetGross;
      }
      if (targetGross <= 0) {
        if (btn) { btn.disabled = false; btn.innerHTML = `⚡ Auto-Calculate Standard Splits`; }
        showToast("Please enter an Annual Package (LPA) or Target Gross Monthly salary first.", "warning");
        return;
      }

      const basicPctVal = parseFloat(document.getElementById("pModalBasicPercent")?.value || 50);
      const basicPct = Math.max(1, Math.min(100, basicPctVal)) / 100;
      const basic = Math.round(targetGross * basicPct * 100) / 100;
      const hra = Math.round(basic * 0.40 * 100) / 100;
      const da = Math.round(basic * 0.10 * 100) / 100;
      const ta = Math.round(Math.max(1600, basic * 0.05) * 100) / 100;

      const lta = parseFloat(document.getElementById("pModalLta")?.value || 0);
      const edu = parseFloat(document.getElementById("pModalEdu")?.value || 0);
      const uni = parseFloat(document.getElementById("pModalUni")?.value || 0);
      const learn = parseFloat(document.getElementById("pModalLearn")?.value || 0);
      const fuel = parseFloat(document.getElementById("pModalFuel")?.value || 0);
      const cca = parseFloat(document.getElementById("pModalCca")?.value || 0);
      const inc = parseFloat(document.getElementById("pModalIncentives")?.value || 0);
      const bon = parseFloat(document.getElementById("pModalBonuses")?.value || 0);

      const sumOther = hra + da + ta + lta + edu + uni + learn + fuel + cca + inc + bon;
      const special = Math.max(0, Math.round((targetGross - basic - sumOther) * 100) / 100);

      if (document.getElementById("pModalBasic")) document.getElementById("pModalBasic").value = basic;
      if (document.getElementById("pModalHra")) document.getElementById("pModalHra").value = hra;
      if (document.getElementById("pModalDa")) document.getElementById("pModalDa").value = da;
      if (document.getElementById("pModalTa")) document.getElementById("pModalTa").value = ta;
      if (document.getElementById("pModalSpecial")) document.getElementById("pModalSpecial").value = special;

      recalculatePfByStrategy();
      updateModalCalculations();

      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `⚡ Auto-Calculate Standard Splits`;
      }
      showToast(`⚡ Auto-calculated splits for ₹${Math.round(targetGross).toLocaleString()} Gross Monthly!`, "success");
    }, 150);
  }

  // Event Listeners
  on("payrollMonthSelect", "change", fetchPayroll);
  on("payrollStatusFilter", "change", fetchPayroll);
  on("payrollSearchInput", "input", fetchPayroll);

  on("pModalAutoSplitBtn", "click", handleAutoCalculateSplits);
  on("pModalInputLpa", "input", handleAutoCalculateSplits);
  on("pModalInputGross", "input", handleAutoCalculateSplits);
  on("pModalBasicPercent", "input", handleAutoCalculateSplits);

  on("pModalPfStrategy", "change", () => {
    recalculatePfByStrategy();
    updateModalCalculations();
  });

  // Pre-Processing Modal Launcher
  on("processPayrollBtn", "click", () => {
    const selMonth = document.getElementById("payrollMonthSelect").value;
    document.getElementById("processModalMonthDisp").textContent = selMonth;
    const tbody = document.getElementById("processModalEmpList");
    if (!tbody) return;

    if (payrollDataList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--text3);">No active employees found matching criteria.</td></tr>`;
    } else {
      tbody.innerHTML = payrollDataList.map(emp => `
        <tr>
          <td>
            <div style="font-weight:700;color:var(--text1);">${esc(emp.employee_name)}</div>
            <div style="font-size:11px;color:var(--text3);">${esc(emp.employee_code || 'EMP-' + emp.employee_id)} • ${esc(emp.department || 'Staff')}</div>
          </td>
          <td style="font-weight:600;">${formatCurrency(emp.basic_salary || 0)}</td>
          <td>
            <input type="number" step="0.01" class="form-input proc-inc" data-empid="${emp.employee_id}" value="${emp.incentives || 0}" style="padding:4px 8px;font-size:12px;width:120px;">
          </td>
          <td>
            <input type="number" step="0.01" class="form-input proc-bon" data-empid="${emp.employee_id}" value="${emp.bonuses || 0}" style="padding:4px 8px;font-size:12px;width:120px;">
          </td>
        </tr>
      `).join("");
    }

    document.getElementById("processPayrollModal").style.display = "flex";
  });

  on("processModalClose", "click", () => { document.getElementById("processPayrollModal").style.display = "none"; });
  on("processModalCancel", "click", () => { document.getElementById("processPayrollModal").style.display = "none"; });

  on("processModalConfirmBtn", "click", async () => {
    const selMonth = document.getElementById("payrollMonthSelect").value;
    const btn = document.getElementById("processModalConfirmBtn");
    if (btn && btn.disabled) return;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Processing Payroll...`;
    }

    const overrides = [];
    document.querySelectorAll(".proc-inc").forEach(incInput => {
      const empId = parseInt(incInput.dataset.empid);
      const bonInput = document.querySelector(`.proc-bon[data-empid="${empId}"]`);
      overrides.push({
        employee_id: empId,
        incentives: parseFloat(incInput.value || 0),
        bonuses: parseFloat(bonInput ? bonInput.value : 0)
      });
    });

    try {
      const res = await fetch(`${API_BASE}/payroll?action=process`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          company_id: getActiveCompId() || 1,
          month: selMonth,
          employee_overrides: overrides
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Salaries processed successfully!", "success");
        document.getElementById("processPayrollModal").style.display = "none";
        fetchPayroll();
      } else showToast(data.error || "Failed to process payroll", "error");
    } catch (err) {
      showToast("Process payroll error: " + err.message, "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = "🚀 Run Monthly Processing";
    }
  });

  document.querySelectorAll(".p-calc").forEach(input => {
    input.addEventListener("input", updateModalCalculations);
  });

  on("pModalPaymentType", "change", togglePaymentFields);

  on("pModalClose", "click", () => { document.getElementById("payrollAdjustModal").style.display = "none"; });
  on("payrollAdjustCancel", "click", () => { document.getElementById("payrollAdjustModal").style.display = "none"; });

  on("pModalQuickReleaseBtn", "click", async () => {
    const pId = document.getElementById("pModalId").value;
    if (!pId) return;
    if (!confirm("Release this held salary and mark as Full Paid?")) return;

    const btn = document.getElementById("pModalQuickReleaseBtn");
    if (btn && btn.disabled) return;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Releasing...`;
    }
    try {
      const r = await fetch(`${API_BASE}/payroll?action=release-hold`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ payroll_id: pId })
      });
      const d = await r.json();
      if (d.success) {
        showToast(d.message || "Held salary released successfully!", "success");
        document.getElementById("payrollAdjustModal").style.display = "none";
        fetchPayroll();
      } else showToast(d.error || "Failed to release hold", "error");
    } catch (e) {
      showToast("Release hold error: " + e.message, "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = "🔓 Release Held Salary";
    }
  });

  on("payrollAdjustForm", "submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn) {
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving & Updating Salary...`;
    }

    const rawPId = document.getElementById("pModalId").value;
    const rawEmpId = document.getElementById("pModalEmpId").value;
    const rawCompId = document.getElementById("pModalCompId").value;
    const selMonth = document.getElementById("payrollMonthSelect") ? document.getElementById("payrollMonthSelect").value : new Date().toISOString().slice(0, 7);

    const payload = {
      payroll_id: (rawPId && rawPId !== 'null') ? parseInt(rawPId) : null,
      employee_id: rawEmpId ? parseInt(rawEmpId) : null,
      company_id: rawCompId ? parseInt(rawCompId) : (getActiveCompId() || 1),
      month: document.getElementById("pModalMonthVal").value || selMonth,
      basic_salary: parseFloat(document.getElementById("pModalBasic").value || 0),
      hra: parseFloat(document.getElementById("pModalHra").value || 0),
      da: parseFloat(document.getElementById("pModalDa").value || 0),
      ta: parseFloat(document.getElementById("pModalTa").value || 0),
      special_allowance: parseFloat(document.getElementById("pModalSpecial").value || 0),
      incentives: parseFloat(document.getElementById("pModalIncentives").value || 0),
      bonuses: parseFloat(document.getElementById("pModalBonuses").value || 0),
      leave_deductions: parseFloat(document.getElementById("pModalLeaveDed").value || 0),
      advance_deductions: parseFloat(document.getElementById("pModalAdvDed").value || 0),
      pf_deduction: parseFloat(document.getElementById("pModalPf").value || 0),
      esi_deduction: parseFloat(document.getElementById("pModalEsi").value || 0),
      other_deductions: parseFloat(document.getElementById("pModalOtherDed").value || 0),
      payment_type: document.getElementById("pModalPaymentType").value,
      paid_amount: parseFloat(document.getElementById("pModalPaidAmt").value || 0),
      hold_reason: document.getElementById("pModalHoldReason").value.trim(),
      payment_mode: document.getElementById("pModalPaymentMode").value,
      transaction_ref: document.getElementById("pModalTxnRef").value.trim()
    };

    try {
      const res = await fetch(`${API_BASE}/payroll?action=salary-adjust`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Salary updated successfully!", "success");
        document.getElementById("payrollAdjustModal").style.display = "none";
        fetchPayroll();
      } else {
        showToast(data.error || "Failed to update salary", "error");
      }
    } catch (err) {
      showToast("Salary update error: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "💾 Save & Update Salary";
      }
    }
  });

  // Hold Modal Event Handlers
  on("holdModalClose", "click", () => { document.getElementById("singleHoldModal").style.display = "none"; });
  on("holdModalCancel", "click", () => { document.getElementById("singleHoldModal").style.display = "none"; });

  on("singleHoldForm", "submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("holdModalSubmitBtn");
    const pId = document.getElementById("holdModalPId").value;
    const empId = document.getElementById("holdModalEmpId").value;
    const reason = document.getElementById("holdModalReason").value.trim();
    if (!reason) { showToast("Please enter a reason for holding salary.", "warning"); return; }

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Holding...`;

    const checkedRows = Array.from(document.querySelectorAll(".payroll-row-chk")).filter(c => c.checked);
    const selMonth = document.getElementById("payrollMonthSelect") ? document.getElementById("payrollMonthSelect").value : new Date().toISOString().slice(0, 7);

    try {
      if (checkedRows.length > 0 && (!pId || pId === 'null')) {
        let successCount = 0;
        for (const chk of checkedRows) {
          const rowPId = chk.dataset.id;
          const rowEmpId = chk.dataset.empid;
          await fetch(`${API_BASE}/payroll?action=salary-adjust`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
              payroll_id: (rowPId && rowPId !== 'null') ? parseInt(rowPId) : null,
              employee_id: rowEmpId ? parseInt(rowEmpId) : null,
              company_id: getActiveCompId() || 1,
              month: selMonth,
              payment_type: 'hold',
              payment_status: 'on_hold',
              hold_reason: reason
            })
          });
          successCount++;
        }
        showToast(`${successCount} salaries placed on HOLD!`, "success");
      } else {
        const rec = payrollDataList.find(x => (pId && pId !== 'null' && x.id == pId) || (empId && x.employee_id == empId));
        const res = await fetch(`${API_BASE}/payroll?action=salary-adjust`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            payroll_id: (pId && pId !== 'null') ? parseInt(pId) : null,
            employee_id: empId ? parseInt(empId) : null,
            company_id: getActiveCompId() || 1,
            month: selMonth,
            basic_salary: rec ? parseFloat(rec.basic_salary || 0) : 0,
            payment_type: 'hold',
            payment_status: 'on_hold',
            hold_reason: reason
          })
        });
        const d = await res.json();
        if (d.success) showToast(d.message || "Salary placed on HOLD!", "success");
        else showToast(d.error || "Failed to put on hold", "error");
      }
      document.getElementById("singleHoldModal").style.display = "none";
      fetchPayroll();
    } catch (err) {
      showToast("Hold error: " + err.message, "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `⏸️ Confirm Put On Hold`;
    }
  });

  // Bulk Pay Toolbar & Modal Handlers
  on("btnBulkPaySelected", "click", () => {
    const checkedRows = Array.from(document.querySelectorAll(".payroll-row-chk")).filter(c => c.checked);
    if (checkedRows.length === 0) { showToast("Please select at least one employee to pay.", "warning"); return; }
    let totalNet = 0;
    checkedRows.forEach(c => { totalNet += parseFloat(c.dataset.net || 0); });

    document.getElementById("bulkPaySummaryDisp").textContent = `${checkedRows.length} Employees Selected (Total Net: ${formatCurrency(totalNet)})`;
    document.getElementById("bulkPayTxnRef").value = "";
    document.getElementById("bulkPayModal").style.display = "flex";
  });

  on("btnBulkHoldSelected", "click", () => {
    const checkedRows = Array.from(document.querySelectorAll(".payroll-row-chk")).filter(c => c.checked);
    if (checkedRows.length === 0) { showToast("Please select at least one employee to put on hold.", "warning"); return; }
    document.getElementById("holdModalPId").value = "";
    document.getElementById("holdModalEmpId").value = "";
    document.getElementById("holdModalEmpName").textContent = `${checkedRows.length} Selected Employees`;
    document.getElementById("holdModalReason").value = "";
    document.getElementById("singleHoldModal").style.display = "flex";
  });

  on("bulkPayClose", "click", () => { document.getElementById("bulkPayModal").style.display = "none"; });
  on("bulkPayCancel", "click", () => { document.getElementById("bulkPayModal").style.display = "none"; });

  on("bulkPayForm", "submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("bulkPaySubmitBtn");
    const checkedRows = Array.from(document.querySelectorAll(".payroll-row-chk")).filter(c => c.checked);
    const pIds = checkedRows.map(c => parseInt(c.dataset.id)).filter(id => !isNaN(id) && id > 0);

    if (pIds.length === 0) {
      showToast("Selected employees must have processed salary records to mark as paid.", "warning");
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Processing Payments...`;
    const pMode = document.getElementById("bulkPayMode").value;
    const txnRef = document.getElementById("bulkPayTxnRef").value.trim();

    try {
      const res = await fetch(`${API_BASE}/payroll?action=update-status`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          payroll_ids: pIds,
          payment_mode: pMode,
          transaction_ref: txnRef
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `${pIds.length} salaries marked as Full Paid!`, "success");
        document.getElementById("bulkPayModal").style.display = "none";
        fetchPayroll();
      } else showToast(data.error || "Failed bulk payment", "error");
    } catch (err) {
      showToast("Bulk pay error: " + err.message, "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `💳 Confirm & Mark Paid`;
    }
  });

  // View Processed Salary Modal Event Handlers
  on("viewSalaryClose", "click", () => { document.getElementById("viewSalaryModal").style.display = "none"; });
  on("viewSalaryCancel", "click", () => { document.getElementById("viewSalaryModal").style.display = "none"; });

  on("viewSalaryEditBtn", "click", () => {
    document.getElementById("viewSalaryModal").style.display = "none";
    if (currentViewingRec) openAdjustModal(currentViewingRec);
  });

  on("viewSalaryPrintBtn", "click", () => {
    const printContent = document.getElementById("viewSalaryBody")?.innerHTML;
    if (!printContent) return;
    const printWin = window.open("", "_blank");
    printWin.document.write(`
      <html>
        <head>
          <title>Payslip Summary - ${esc(currentViewingRec?.employee_name || 'Employee')}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #0f172a; background: #ffffff; }
            .badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            td { padding: 6px; }
          </style>
        </head>
        <body>
          <h2>🏢 ${esc(currentViewingRec?.company_name || 'Business ERP')} - Official Payslip Summary</h2>
          ${printContent}
          <div style="margin-top:30px;font-size:11px;color:#64748b;text-align:center;border-top:1px solid #e2e8f0;padding-top:10px;">
            This is a computer-generated payslip summary. No signature required.
          </div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWin.document.close();
  });

  fetchPayroll();
}

// ═══════════════════════════════════════════════════
// 8. SALARY ADVANCES SUBTAB
// ═══════════════════════════════════════════════════

async function loadAdvancesSubTab() {
  const subContent = document.getElementById("hrSubContent");
  const compId = getActiveCompId();

  subContent.innerHTML = `
    <!-- Stats Cards Summary -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;margin-bottom:20px;">
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;box-shadow:var(--shadow-sm);">
        <div style="font-size:12px;color:var(--text3);font-weight:600;text-transform:uppercase;">Total Advances Granted</div>
        <div id="statAdvTotal" style="font-size:22px;font-weight:700;color:var(--primary);margin-top:6px;">₹0.00</div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;box-shadow:var(--shadow-sm);">
        <div style="font-size:12px;color:var(--text3);font-weight:600;text-transform:uppercase;">Total Amount Repaid</div>
        <div id="statAdvRepaid" style="font-size:22px;font-weight:700;color:var(--success);margin-top:6px;">₹0.00</div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;box-shadow:var(--shadow-sm);">
        <div style="font-size:12px;color:var(--text3);font-weight:600;text-transform:uppercase;">Outstanding Balance</div>
        <div id="statAdvOutstanding" style="font-size:22px;font-weight:700;color:var(--danger);margin-top:6px;">₹0.00</div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;box-shadow:var(--shadow-sm);">
        <div style="font-size:12px;color:var(--text3);font-weight:600;text-transform:uppercase;">Active Advances</div>
        <div id="statAdvActiveCount" style="font-size:22px;font-weight:700;color:var(--warning);margin-top:6px;">0</div>
      </div>
    </div>

    <!-- Header Actions -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;max-width:100%;">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;max-width:100%;">
        <h3 style="font-size:16px;font-weight:600;color:var(--text1);margin:0;">Employee Salary Advances</h3>
        <input type="text" id="advSearchInput" class="form-input" placeholder="🔍 Search employee / receipt..." style="width:240px;max-width:100%;padding:6px 12px;font-size:13px;">
      </div>
      <button class="btn btn-primary" id="grantAdvBtn" style="font-weight:600;white-space:nowrap;">+ Issue Salary Advance</button>
    </div>

    <!-- Advances Table -->
    <div class="table-container" style="overflow-x:auto;">
      <table class="data-table" style="width:100%;min-width:900px;">
        <thead>
          <tr>
            <th style="padding:10px;">Receipt #</th>
            <th style="padding:10px;">Employee</th>
            <th style="padding:10px;">Advance Date</th>
            <th style="padding:10px;text-align:right;">Granted (₹)</th>
            <th style="padding:10px;text-align:right;">Monthly Deduction (₹)</th>
            <th style="padding:10px;text-align:right;">Repaid (₹)</th>
            <th style="padding:10px;text-align:right;">Outstanding (₹)</th>
            <th style="padding:10px;text-align:center;">Status</th>
            <th style="padding:10px;text-align:center;">Actions</th>
          </tr>
        </thead>
        <tbody id="advTableBody">
          <tr><td colspan="9" style="text-align:center;padding:24px;"><div class="spinner"></div> Fetching salary advances...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;flex-wrap:wrap;gap:8px;">
      <div id="advInfo"></div>
      <div id="advPagination" class="pagination"></div>
    </div>

    <!-- GRANT ADVANCE MODAL -->
    <div class="modal-overlay" id="advModal" style="display:none;z-index:9999;">
      <div class="modal-box" style="max-width:520px;width:100%;padding:24px;border-radius:12px;">
        <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;border-bottom:1px solid var(--border);padding-bottom:12px;">
          <h3 style="margin:0;font-size:18px;font-weight:600;color:var(--text1);">💰 Issue Salary Advance</h3>
          <button class="modal-close" id="advModalClose" style="background:none;border:none;font-size:24px;cursor:pointer;color:var(--text3);">&times;</button>
        </div>
        <form id="advForm">
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="font-weight:600;font-size:13px;">Select Employee *</label>
            <select id="advEmpId" class="form-select" required style="width:100%;padding:8px 12px;"></select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
            <div class="form-group">
              <label class="form-label" style="font-weight:600;font-size:13px;">Advance Date *</label>
              <input type="date" id="advDate" class="form-input" required style="width:100%;padding:8px 12px;">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight:600;font-size:13px;">Advance Amount (₹) *</label>
              <input type="number" step="0.01" min="1" id="advAmount" class="form-input" required placeholder="10000" style="width:100%;padding:8px 12px;">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
            <div class="form-group">
              <label class="form-label" style="font-weight:600;font-size:13px;">Monthly Deduction (₹)</label>
              <input type="number" step="0.01" min="0" id="advMonthlyDed" class="form-input" placeholder="2500" style="width:100%;padding:8px 12px;">
              <small style="color:var(--text3);font-size:11px;">Default: 25% of Advance</small>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight:600;font-size:13px;">Payment Mode</label>
              <select id="advPaymentMode" class="form-select" style="width:100%;padding:8px 12px;">
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI / Online</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>
          <div class="form-group" style="margin-bottom:18px;">
            <label class="form-label" style="font-weight:600;font-size:13px;">Transaction Ref / Cheque No.</label>
            <input type="text" id="advTxnRef" class="form-input" placeholder="e.g. UTR192830192 / CHQ-001" style="width:100%;padding:8px 12px;">
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--border);padding-top:14px;">
            <button type="button" class="btn btn-secondary" id="advModalCancel">Cancel</button>
            <button type="submit" class="btn btn-primary" style="font-weight:600;">Grant Advance</button>
          </div>
        </form>
      </div>
    </div>

    <!-- REPAYMENT MODAL -->
    <div class="modal-overlay" id="advRepayModal" style="display:none;z-index:9999;">
      <div class="modal-box" style="max-width:480px;width:100%;padding:24px;border-radius:12px;">
        <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:12px;">
          <h3 style="margin:0;font-size:18px;font-weight:600;color:var(--text1);">💵 Record Advance Repayment</h3>
          <button class="modal-close" id="advRepayClose" style="background:none;border:none;font-size:24px;cursor:pointer;color:var(--text3);">&times;</button>
        </div>
        <div id="advRepaySummary" style="background:var(--bg3);padding:12px 14px;border-radius:8px;margin-bottom:16px;font-size:13px;color:var(--text2);"></div>
        <form id="advRepayForm">
          <input type="hidden" id="repayAdvId">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
            <div class="form-group">
              <label class="form-label" style="font-weight:600;font-size:13px;">Repayment Date *</label>
              <input type="date" id="repayDate" class="form-input" required style="width:100%;padding:8px 12px;">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight:600;font-size:13px;">Repayment Amount (₹) *</label>
              <input type="number" step="0.01" min="1" id="repayAmount" class="form-input" required style="width:100%;padding:8px 12px;">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div class="form-group">
              <label class="form-label" style="font-weight:600;font-size:13px;">Payment Mode</label>
              <select id="repayMode" class="form-select" style="width:100%;padding:8px 12px;">
                <option value="payroll_deduction">Salary Deduction</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI / Online</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight:600;font-size:13px;">Transaction Ref / Note</label>
              <input type="text" id="repayRef" class="form-input" placeholder="Ref no. / Cash voucher" style="width:100%;padding:8px 12px;">
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--border);padding-top:14px;">
            <button type="button" class="btn btn-secondary" id="advRepayCancel">Cancel</button>
            <button type="submit" class="btn btn-primary" style="font-weight:600;">Save Repayment</button>
          </div>
        </form>
      </div>
    </div>

    <!-- TRANSACTIONS & RECEIPTS HISTORY MODAL -->
    <div class="modal-overlay" id="advReceiptsModal" style="display:none;z-index:9999;">
      <div class="modal-box" style="max-width:650px;width:100%;padding:24px;border-radius:12px;">
        <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:12px;">
          <h3 style="margin:0;font-size:18px;font-weight:600;color:var(--text1);" id="receiptsModalTitle">📜 Advance Receipt & Audit Log</h3>
          <button class="modal-close" id="advReceiptsClose" style="background:none;border:none;font-size:24px;cursor:pointer;color:var(--text3);">&times;</button>
        </div>
        <div class="table-container" style="max-height:350px;overflow-y:auto;margin-bottom:16px;">
          <table class="data-table" style="width:100%;">
            <thead>
              <tr>
                <th style="padding:8px;">Receipt #</th>
                <th style="padding:8px;">Date</th>
                <th style="padding:8px;">Type</th>
                <th style="padding:8px;text-align:right;">Amount</th>
                <th style="padding:8px;text-align:center;">Voucher</th>
              </tr>
            </thead>
            <tbody id="receiptsTableBody">
              <tr><td colspan="5" style="text-align:center;padding:16px;">Loading history...</td></tr>
            </tbody>
          </table>
        </div>
        <div style="display:flex;justify-content:flex-end;border-top:1px solid var(--border);padding-top:14px;">
          <button type="button" class="btn btn-secondary" id="advReceiptsOk">Close</button>
        </div>
      </div>
    </div>
  `;

  // Pre-fill date & auto calculate monthly deduction on amount change
  const advDateElem = document.getElementById("advDate");
  if (advDateElem) advDateElem.value = new Date().toISOString().slice(0, 10);

  on("advAmount", "input", () => {
    const val = parseFloat(document.getElementById("advAmount").value || 0);
    const mDedInput = document.getElementById("advMonthlyDed");
    if (mDedInput && val > 0 && (!mDedInput.value || mDedInput.dataset.userModified !== "true")) {
      mDedInput.value = Math.round((val / 4) * 100) / 100;
    }
  });

  on("advMonthlyDed", "input", () => {
    const mDedInput = document.getElementById("advMonthlyDed");
    if (mDedInput) mDedInput.dataset.userModified = "true";
  });

  // Populate employee select
  try {
    const empRes = await fetch(`${API_BASE}/employees?action=list&company_id=${compId}`, { headers: authHeaders() });
    const empData = await empRes.json();
    if (empData.success && empData.employees) {
      const select = document.getElementById("advEmpId");
      if (select) {
        select.innerHTML = '<option value="">-- Select Employee --</option>' + 
          empData.employees.map(e => `<option value="${e.id}">${esc(e.name)} (${esc(e.employee_code || 'EMP-' + e.id)}) - ${esc(e.department || 'General')}</option>`).join("");
      }
    }
  } catch (e) {
    console.error("Error fetching employees for advance modal:", e);
  }

  let allAdvances = [];

  async function fetchAdvances() {
    try {
      const res = await fetch(`${API_BASE}/payroll?action=advance-list&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      allAdvances = data.advances || [];

      // Compute summary stats
      let totalGranted = 0;
      let totalRepaid = 0;
      let totalOutstanding = 0;
      let activeCount = 0;

      allAdvances.forEach(a => {
        if (a.repayment_status !== 'cancelled') {
          totalGranted += parseFloat(a.amount || 0);
          totalRepaid += parseFloat(a.total_repaid || 0);
          const out = parseFloat(a.outstanding !== undefined && a.outstanding !== null ? a.outstanding : (parseFloat(a.amount) - parseFloat(a.total_repaid || 0)));
          totalOutstanding += Math.max(0, out);
          if (a.repayment_status === 'active' && out > 0) {
            activeCount++;
          }
        }
      });

      if (document.getElementById("statAdvTotal")) document.getElementById("statAdvTotal").textContent = formatCurrency(totalGranted);
      if (document.getElementById("statAdvRepaid")) document.getElementById("statAdvRepaid").textContent = formatCurrency(totalRepaid);
      if (document.getElementById("statAdvOutstanding")) document.getElementById("statAdvOutstanding").textContent = formatCurrency(totalOutstanding);
      if (document.getElementById("statAdvActiveCount")) document.getElementById("statAdvActiveCount").textContent = activeCount;

      renderTableData(allAdvances);
    } catch (err) {
      showToast("Fetch advances error: " + err.message, "error");
    }
  }

  function renderTableData(items) {
    const search = (document.getElementById("advSearchInput")?.value || "").toLowerCase().trim();
    const filtered = items.filter(a => {
      if (!search) return true;
      const empName = (a.employee_name || "").toLowerCase();
      const empCode = (a.employee_code || "").toLowerCase();
      const rNum = (a.receipt_number || "").toLowerCase();
      return empName.includes(search) || empCode.includes(search) || rNum.includes(search);
    });

    const tbody = document.getElementById("advTableBody");
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text3);">No salary advances found.</td></tr>`;
      if (document.getElementById("advInfo")) document.getElementById("advInfo").innerHTML = "";
      if (document.getElementById("advPagination")) document.getElementById("advPagination").innerHTML = "";
      return;
    }

    window.renderPaginatedTable({
      data: filtered,
      pageSize: 10,
      currentPage: 1,
      tbody: "advTableBody",
      paginationContainer: "advPagination",
      infoContainer: "advInfo",
      renderRow: (a) => {
        const amt = parseFloat(a.amount || 0);
        const repaid = parseFloat(a.total_repaid || 0);
        const out = Math.max(0, parseFloat(a.outstanding !== undefined && a.outstanding !== null ? a.outstanding : (amt - repaid)));
        const status = a.repayment_status || (out <= 0 ? 'completed' : 'active');

        let statusBadge = `<span class="badge badge-warning">Active</span>`;
        if (status === 'completed' || out <= 0) {
          statusBadge = `<span class="badge badge-success">Completed</span>`;
        } else if (status === 'cancelled') {
          statusBadge = `<span class="badge badge-danger">Cancelled</span>`;
        }

        const canRepay = status === 'active' && out > 0;
        const canCancel = status === 'active' && repaid === 0;

        return `
          <tr>
            <td style="font-weight:600;font-size:12px;color:var(--primary);">${esc(a.receipt_number || 'ADV-' + a.id)}</td>
            <td style="font-weight:600;color:var(--text1);">
              ${esc(a.employee_name)}
              <div style="font-size:11px;color:var(--text3);font-weight:normal;">${esc(a.employee_code || '')} • ${esc(a.department || 'Staff')}</div>
            </td>
            <td style="font-size:13px;">${a.advance_date ? String(a.advance_date).slice(0,10) : '—'}</td>
            <td style="font-weight:600;color:var(--text1);text-align:right;">${formatCurrency(amt)}</td>
            <td style="color:var(--text2);text-align:right;">${formatCurrency(a.monthly_deduction || 0)}</td>
            <td style="color:var(--success);text-align:right;">${formatCurrency(repaid)}</td>
            <td style="font-weight:700;color:${out > 0 ? 'var(--danger)' : 'var(--text3)'};text-align:right;">${formatCurrency(out)}</td>
            <td style="text-align:center;">${statusBadge}</td>
            <td style="text-align:center;white-space:nowrap;">
              <div style="display:inline-flex;gap:4px;">
                ${canRepay ? `<button class="btn btn-sm btn-outline-primary adv-repay-btn" data-id="${a.id}" title="Record Repayment">💵 Repay</button>` : ''}
                <button class="btn btn-sm btn-outline-secondary adv-history-btn" data-id="${a.id}" title="View Receipts & History">📜 Receipts</button>
                <button class="btn btn-sm btn-outline-secondary adv-print-btn" data-id="${a.id}" title="Print Voucher">🖨️</button>
                ${canCancel ? `<button class="btn btn-sm btn-outline-danger adv-cancel-btn" data-id="${a.id}" title="Cancel Advance">🚫</button>` : ''}
              </div>
            </td>
          </tr>
        `;
      }
    });

    attachRowListeners(filtered);
  }

  function attachRowListeners(advancesList) {
    const tbody = document.getElementById("advTableBody");
    if (!tbody) return;

    tbody.querySelectorAll(".adv-repay-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.dataset.id);
        const adv = advancesList.find(x => x.id === id);
        if (!adv) return;

        const amt = parseFloat(adv.amount || 0);
        const repaid = parseFloat(adv.total_repaid || 0);
        const out = Math.max(0, parseFloat(adv.outstanding !== undefined && adv.outstanding !== null ? adv.outstanding : (amt - repaid)));

        document.getElementById("repayAdvId").value = adv.id;
        document.getElementById("repayDate").value = new Date().toISOString().slice(0, 10);
        
        const mDed = parseFloat(adv.monthly_deduction || 0);
        const suggAmt = mDed > 0 ? Math.min(mDed, out) : out;
        document.getElementById("repayAmount").value = suggAmt > 0 ? suggAmt : out;

        document.getElementById("advRepaySummary").innerHTML = `
          <strong>Employee:</strong> ${esc(adv.employee_name)}<br>
          <strong>Voucher Ref:</strong> ${esc(adv.receipt_number || 'ADV-' + adv.id)}<br>
          <strong>Granted:</strong> ${formatCurrency(amt)} | <strong>Outstanding:</strong> <span style="color:var(--danger);font-weight:bold;">${formatCurrency(out)}</span>
        `;

        document.getElementById("advRepayModal").style.display = "flex";
      });
    });

    tbody.querySelectorAll(".adv-history-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = parseInt(btn.dataset.id);
        const adv = advancesList.find(x => x.id === id);
        if (!adv) return;

        document.getElementById("receiptsModalTitle").textContent = `📜 Receipts History - ${esc(adv.employee_name)}`;
        const tbodyRec = document.getElementById("receiptsTableBody");
        tbodyRec.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:16px;">Fetching history...</td></tr>`;
        document.getElementById("advReceiptsModal").style.display = "flex";

        try {
          const res = await fetch(`${API_BASE}/payroll?action=advance-receipts&advance_id=${id}`, { headers: authHeaders() });
          const data = await res.json();
          if (data.success && data.receipts && data.receipts.length > 0) {
            tbodyRec.innerHTML = data.receipts.map(r => `
              <tr>
                <td style="font-weight:600;font-size:12px;color:var(--primary);">${esc(r.receipt_number)}</td>
                <td>${r.receipt_date ? String(r.receipt_date).slice(0,10) : '—'}</td>
                <td>
                  <span class="badge ${r.type === 'grant' ? 'badge-warning' : 'badge-success'}">
                    ${r.type === 'grant' ? 'Grant Issued' : 'Repayment Received'}
                  </span>
                </td>
                <td style="font-weight:600;text-align:right;color:${r.type === 'grant' ? 'var(--warning)' : 'var(--success)'};">
                  ${formatCurrency(r.amount)}
                </td>
                <td style="text-align:center;">
                  <button class="btn btn-sm btn-outline-secondary print-receipt-item-btn" data-rnum="${esc(r.receipt_number)}" data-rdate="${r.receipt_date}" data-rtype="${r.type}" data-ramt="${r.amount}" data-emp="${esc(adv.employee_name)}">🖨️ Print</button>
                </td>
              </tr>
            `).join("");

            tbodyRec.querySelectorAll(".print-receipt-item-btn").forEach(pBtn => {
              pBtn.addEventListener("click", () => {
                const item = {
                  receipt_number: pBtn.dataset.rnum,
                  receipt_date: pBtn.dataset.rdate,
                  type: pBtn.dataset.rtype,
                  amount: pBtn.dataset.ramt,
                  employee_name: pBtn.dataset.emp,
                  company_name: adv.company_name || 'Business ERP'
                };
                printReceiptVoucher(item);
              });
            });

          } else {
            tbodyRec.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--text3);">No receipts recorded yet.</td></tr>`;
          }
        } catch (err) {
          tbodyRec.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--danger);">Failed to load receipts: ${esc(err.message)}</td></tr>`;
        }
      });
    });

    tbody.querySelectorAll(".adv-print-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.dataset.id);
        const adv = advancesList.find(x => x.id === id);
        if (adv) printAdvanceVoucher(adv);
      });
    });

    tbody.querySelectorAll(".adv-cancel-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = parseInt(btn.dataset.id);
        const adv = advancesList.find(x => x.id === id);
        if (!adv) return;

        if (!confirm(`Are you sure you want to cancel Salary Advance #${adv.receipt_number || adv.id} for ${adv.employee_name}?`)) return;

        try {
          const res = await fetch(`${API_BASE}/payroll?action=advance-cancel`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ advance_id: id })
          });
          const data = await res.json();
          if (data.success) {
            showToast(data.message || "Advance cancelled", "success");
            fetchAdvances();
          } else showToast(data.error || "Failed to cancel", "error");
        } catch (err) {
          showToast("Cancel error: " + err.message, "error");
        }
      });
    });
  }

  function printAdvanceVoucher(adv) {
    const printWin = window.open("", "_blank");
    if (!printWin) {
      showToast("Please allow popups to print voucher", "error");
      return;
    }
    const compName = adv.company_name || 'Business ERP';
    const amt = parseFloat(adv.amount || 0);
    const repaid = parseFloat(adv.total_repaid || 0);
    const out = Math.max(0, parseFloat(adv.outstanding !== undefined && adv.outstanding !== null ? adv.outstanding : (amt - repaid)));

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Salary Advance Voucher - ${esc(adv.receipt_number || 'ADV')}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; color: #0f172a; max-width: 750px; margin: 0 auto; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
            .header h1 { margin: 0; font-size: 22px; color: #0f172a; }
            .header p { margin: 4px 0 0 0; font-size: 13px; color: #64748b; }
            .voucher-title { background: #f1f5f9; padding: 10px; text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px; border-radius: 6px; text-transform: uppercase; letter-spacing: 1px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; font-size: 14px; }
            .info-box { background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
            .info-box div { margin-bottom: 6px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; }
            th { background: #f1f5f9; font-weight: 600; }
            .signatures { display: flex; justify-content: space-between; margin-top: 60px; padding-top: 20px; }
            .sig-block { text-align: center; width: 200px; border-top: 1px dashed #94a3b8; padding-top: 8px; font-size: 13px; color: #475569; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>${esc(compName)}</h1>
              <p>Human Resources & Payroll Department</p>
            </div>
            <div style="text-align:right;">
              <div style="font-size:16px;font-weight:bold;color:#2563eb;">Voucher #${esc(adv.receipt_number || 'ADV-' + adv.id)}</div>
              <div style="font-size:12px;color:#64748b;">Date: ${adv.advance_date ? String(adv.advance_date).slice(0,10) : new Date().toISOString().slice(0,10)}</div>
            </div>
          </div>

          <div class="voucher-title">SALARY ADVANCE DISBURSEMENT VOUCHER</div>

          <div class="info-grid">
            <div class="info-box">
              <div><strong>Employee Name:</strong> ${esc(adv.employee_name)}</div>
              <div><strong>Employee Code:</strong> ${esc(adv.employee_code || 'N/A')}</div>
              <div><strong>Department:</strong> ${esc(adv.department || 'General')}</div>
            </div>
            <div class="info-box">
              <div><strong>Payment Mode:</strong> ${esc((adv.payment_mode || 'Bank Transfer').toUpperCase())}</div>
              <div><strong>Transaction Ref:</strong> ${esc(adv.transaction_ref || 'N/A')}</div>
              <div><strong>Monthly Deduction:</strong> ${formatCurrency(adv.monthly_deduction || 0)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align:right;">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Salary Advance Issued to Employee</td>
                <td style="text-align:right;font-weight:bold;color:#2563eb;">${formatCurrency(amt)}</td>
              </tr>
              <tr>
                <td>Total Repaid till date</td>
                <td style="text-align:right;color:#16a34a;">${formatCurrency(repaid)}</td>
              </tr>
              <tr style="background:#f8fafc;">
                <td><strong>Current Pending Outstanding</strong></td>
                <td style="text-align:right;font-weight:bold;color:#dc2626;">${formatCurrency(out)}</td>
              </tr>
            </tbody>
          </table>

          <div class="signatures">
            <div class="sig-block">Employee Signature</div>
            <div class="sig-block">HR Manager Signature</div>
            <div class="sig-block">Authorized Signatory</div>
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  }

  function printReceiptVoucher(item) {
    const printWin = window.open("", "_blank");
    if (!printWin) {
      showToast("Please allow popups to print receipt", "error");
      return;
    }
    const compName = item.company_name || 'Business ERP';
    const isGrant = item.type === 'grant';

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Advance Receipt - ${esc(item.receipt_number)}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; color: #0f172a; max-width: 700px; margin: 0 auto; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            .header h1 { margin: 0; font-size: 20px; }
            .receipt-box { border: 2px solid #e2e8f0; border-radius: 8px; padding: 20px; background: #f8fafc; margin-bottom: 20px; }
            .title { font-size: 16px; font-weight: bold; color: ${isGrant ? '#d97706' : '#16a34a'}; text-transform: uppercase; margin-bottom: 15px; text-align: center; letter-spacing: 1px; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #cbd5e1; font-size: 14px; }
            .row:last-child { border-bottom: none; }
            .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
            .sig-block { text-align: center; width: 180px; border-top: 1px solid #94a3b8; padding-top: 6px; font-size: 12px; color: #475569; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>${esc(compName)}</h1>
              <div style="font-size:12px;color:#64748b;">Advance Receipt Voucher</div>
            </div>
            <div style="text-align:right;font-weight:bold;font-size:14px;color:#2563eb;">
              ${esc(item.receipt_number)}
            </div>
          </div>

          <div class="receipt-box">
            <div class="title">${isGrant ? 'SALARY ADVANCE DISBURSEMENT RECEIPT' : 'SALARY ADVANCE REPAYMENT RECEIPT'}</div>
            <div class="row"><span>Employee Name:</span><strong>${esc(item.employee_name)}</strong></div>
            <div class="row"><span>Transaction Date:</span><span>${item.receipt_date ? String(item.receipt_date).slice(0,10) : '—'}</span></div>
            <div class="row"><span>Transaction Type:</span><span>${isGrant ? 'Advance Grant (+)' : 'Advance Repayment (-)'}</span></div>
            <div class="row"><span>Amount:</span><strong style="font-size:16px;color:${isGrant ? '#d97706' : '#16a34a'};">${formatCurrency(item.amount)}</strong></div>
          </div>

          <div class="signatures">
            <div class="sig-block">Received / Paid By</div>
            <div class="sig-block">Authorized Signatory</div>
          </div>

          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWin.document.close();
  }

  on("advSearchInput", "input", () => {
    renderTableData(allAdvances);
  });

  on("grantAdvBtn", "click", () => {
    document.getElementById("advForm").reset();
    document.getElementById("advDate").value = new Date().toISOString().slice(0, 10);
    delete document.getElementById("advMonthlyDed").dataset.userModified;
    document.getElementById("advModal").style.display = "flex";
  });
  on("advModalClose", "click", () => { document.getElementById("advModal").style.display = "none"; });
  on("advModalCancel", "click", () => { document.getElementById("advModal").style.display = "none"; });

  on("advForm", "submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn && submitBtn.disabled) return;
    const origHtml = submitBtn ? submitBtn.innerHTML : "Grant Advance";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Granting Advance...`;
    }

    const empId = document.getElementById("advEmpId").value;
    if (!empId) {
      showToast("Please select an employee", "error");
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origHtml; }
      return;
    }

    const payload = {
      company_id: getActiveCompId() === 'all' ? (currentCompanies[0]?.id || 1) : getActiveCompId(),
      employee_id: empId,
      advance_date: document.getElementById("advDate").value,
      amount: document.getElementById("advAmount").value,
      monthly_deduction: document.getElementById("advMonthlyDed").value || null,
      payment_mode: document.getElementById("advPaymentMode").value,
      transaction_ref: document.getElementById("advTxnRef").value.trim() || null
    };

    try {
      const res = await fetch(`${API_BASE}/payroll?action=advance-create`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Advance granted successfully!", "success");
        document.getElementById("advModal").style.display = "none";
        fetchAdvances();
      } else showToast(data.error || "Failed to grant advance", "error");
    } catch (err) {
      showToast("Error: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    }
  });

  // Repayment modal actions
  on("advRepayClose", "click", () => { document.getElementById("advRepayModal").style.display = "none"; });
  on("advRepayCancel", "click", () => { document.getElementById("advRepayModal").style.display = "none"; });

  on("advRepayForm", "submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn && submitBtn.disabled) return;
    const origHtml = submitBtn ? submitBtn.innerHTML : "Save Repayment";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving Repayment...`;
    }

    const advId = document.getElementById("repayAdvId").value;
    const amount = document.getElementById("repayAmount").value;

    if (!advId || !amount || parseFloat(amount) <= 0) {
      showToast("Please enter a valid repayment amount", "error");
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origHtml; }
      return;
    }

    const payload = {
      advance_id: advId,
      amount: amount,
      receipt_date: document.getElementById("repayDate").value,
      payment_mode: document.getElementById("repayMode").value,
      transaction_ref: document.getElementById("repayRef").value.trim() || null
    };

    try {
      const res = await fetch(`${API_BASE}/payroll?action=advance-repay`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Repayment recorded successfully!", "success");
        document.getElementById("advRepayModal").style.display = "none";
        fetchAdvances();
      } else showToast(data.error || "Failed to record repayment", "error");
    } catch (err) {
      showToast("Error: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    }
  });

  // Receipts history modal
  on("advReceiptsClose", "click", () => { document.getElementById("advReceiptsModal").style.display = "none"; });
  on("advReceiptsOk", "click", () => { document.getElementById("advReceiptsModal").style.display = "none"; });

  fetchAdvances();
}

// ═══════════════════════════════════════════════════
// 9. RELEASE INCENTIVES SUBTAB
// ═══════════════════════════════════════════════════

async function loadIncentivesSubTab() {
  const subContent = document.getElementById("hrSubContent");
  const compId = getActiveCompId();
  function checkIsSuperAdmin() {
    const userObj = (typeof getUser === "function" ? getUser() : null) || (typeof currentUser !== "undefined" && currentUser ? currentUser : null) || JSON.parse(localStorage.getItem("erp_user") || "{}");
    return !!(userObj && (userObj.role === "superadmin" || userObj.username === "superadmin"));
  }

  const now = new Date();
  const currentYYYYMM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
      <div>
        <h3 style="font-size:16px;font-weight:600;color:var(--text1);margin:0;">Lead Incentives Master & Release</h3>
        <div style="font-size:12px;color:var(--text3);margin-top:2px;">HR processing module to enter, edit, release, and print dual-copy incentive vouchers.</div>
      </div>

      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;max-width:100%;">
        <label class="form-label" style="margin:0;font-weight:600;color:var(--text2);white-space:nowrap;">📅 Billing Month Archive:</label>
        <input type="month" id="incMonthFilter" class="form-input" value="${currentYYYYMM}" style="width:160px;max-width:100%;">
        <button class="btn btn-secondary btn-sm" id="incClearMonthBtn" style="white-space:nowrap;">Show All Months</button>
      </div>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Lead Generator Name</th>
            <th>Company</th>
            <th>Sales Count</th>
            <th>Total Incentive (₹)</th>
            <th>Released (₹)</th>
            <th>Pending Release (₹)</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="incTableBody">
          <tr><td colspan="8" style="text-align:center;padding:20px;"><div class="spinner"></div> Fetching incentives summary...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;flex-wrap:wrap;gap:8px;">
      <div id="incInfo"></div>
      <div id="incPagination" class="pagination"></div>
    </div>
  `;

  async function fetchIncentivesSummary() {
    const monthVal = document.getElementById("incMonthFilter")?.value || "";
    try {
      const url = `${API_BASE}/sales?action=incentives-summary&company_id=${compId}${monthVal ? `&month=${monthVal}` : ''}`;
      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      const tbody = document.getElementById("incTableBody");
      if (!tbody) return;
      if (!data.summary || data.summary.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text3);">No lead generated sales found for the selected period.</td></tr>`;
        if (document.getElementById("incInfo")) document.getElementById("incInfo").innerHTML = "";
        if (document.getElementById("incPagination")) document.getElementById("incPagination").innerHTML = "";
        return;
      }

      window.renderPaginatedTable({
        data: data.summary,
        pageSize: 10,
        currentPage: 1,
        tbody: "incTableBody",
        paginationContainer: "incPagination",
        infoContainer: "incInfo",
        renderRow: (s) => {
          const total = parseFloat(s.total_incentive_amount || 0);
          const released = parseFloat(s.released_incentive_amount || 0);
          const pending = parseFloat(s.pending_incentive_amount || 0);
          const isFullyReleased = pending <= 0.01 && released > 0;
          const isSuper = checkIsSuperAdmin();

          return `
            <tr>
              <td style="font-weight:700;color:var(--text1);">${esc(s.lead_generated_by)}</td>
              <td><span class="badge badge-outline" style="font-weight:600;">${esc(s.company_name || 'Main')}</span></td>
              <td style="font-weight:600;">${s.total_sales_count} Sales</td>
              <td style="font-weight:700;color:var(--text1);">${formatCurrency(total)}</td>
              <td style="font-weight:700;color:var(--success);">${formatCurrency(released)}</td>
              <td style="font-weight:700;color:${pending > 0 ? 'var(--danger)' : 'var(--text2)'};">${formatCurrency(pending)}</td>
              <td>
                <span class="badge ${isFullyReleased ? 'badge-success' : 'badge-warning'}">
                  ${isFullyReleased ? 'Fully Released ✅' : (pending > 0 ? 'Pending Release ⏳' : 'No Incentive')}
                </span>
              </td>
              <td>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  <button class="btn btn-sm btn-primary releaseLeadIncBtn" data-lead="${esc(s.lead_generated_by)}">
                    🎁 ${isFullyReleased ? 'Re-Print Voucher' : 'Edit, Release & Print'}
                  </button>
                  ${isSuper ? `
                    <button class="btn btn-sm btn-danger deleteLeadIncBtn" data-lead="${esc(s.lead_generated_by)}">
                      🗑️ Delete
                    </button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `;
        },
        onRender: () => {
          tbody.querySelectorAll(".releaseLeadIncBtn").forEach(btn => {
            btn.addEventListener("click", () => openReleaseIncentiveModal(btn.dataset.lead));
          });

          tbody.querySelectorAll(".deleteLeadIncBtn").forEach(btn => {
            btn.addEventListener("click", async () => {
              const leadName = btn.dataset.lead;
              if (!leadName) return;
              if (!confirm(`Are you sure you want to delete lead incentives for "${leadName}"?\nThis will reset incentive amounts to ₹0.00 and remove associated company expense records.`)) return;
              if (btn.disabled) return;
              const origHtml = btn.innerHTML;
              btn.disabled = true;
              btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

              try {
                const monthVal = document.getElementById("incMonthFilter")?.value || "";
                const res = await fetch(`${API_BASE}/sales?action=delete-lead-incentive&company_id=${compId}`, {
                  method: "POST",
                  headers: authHeaders(),
                  body: JSON.stringify({ lead_name: leadName, company_id: compId, month: monthVal })
                });
                const data = await res.json();
                if (data.success) {
                  showToast(data.message || "Lead incentive deleted successfully!", "success");
                  fetchIncentivesSummary();
                } else {
                  showToast(data.error || "Failed to delete lead incentive", "error");
                  btn.disabled = false;
                  btn.innerHTML = origHtml;
                }
              } catch (err) {
                showToast("Delete incentive error: " + err.message, "error");
                btn.disabled = false;
                btn.innerHTML = origHtml;
              }
            });
          });
        }
      });

    } catch (err) {
      showToast("Fetch incentives summary error: " + err.message, "error");
    }
  }

  on("incMonthFilter", "change", fetchIncentivesSummary);
  on("incClearMonthBtn", "click", () => {
    const inp = document.getElementById("incMonthFilter");
    if (inp) inp.value = "";
    fetchIncentivesSummary();
  });

  async function openReleaseIncentiveModal(leadName) {
    const monthVal = document.getElementById("incMonthFilter")?.value || "";
    try {
      const url = `${API_BASE}/sales?action=get-lead-sales&lead_name=${encodeURIComponent(leadName)}${monthVal ? `&month=${monthVal}` : ''}`;
      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success || data.sales.length === 0) return showToast("No sales found for this lead generator", "error");

      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;";

      const salesList = data.sales;
      const itemsList = data.items || [];

      // Group items by sale_id for modal preview
      const itemsBySale = {};
      itemsList.forEach(i => {
        if (!itemsBySale[i.sale_id]) itemsBySale[i.sale_id] = [];
        itemsBySale[i.sale_id].push(i);
      });

      const rowsHtml = salesList.map(s => {
        const sItems = itemsBySale[s.id] || [];
        const prodSummary = sItems.map(i => `${i.product_name || i.description || 'Product'} (Qty: ${i.quantity || 1})`).join(", ") || "General Sales Item";

        return `
          <tr>
            <td>#${esc(s.challan_number || s.id)}</td>
            <td>${formatDate(s.sale_date)}</td>
            <td>${esc(s.customer_name || 'Counter Customer')}</td>
            <td style="font-size:12px;color:var(--text2);">${esc(prodSummary)}</td>
            <td style="font-weight:600;">${formatCurrency(s.grand_total)}</td>
            <td>
              <input type="number" step="0.01" class="form-input leadIncAmtInput" data-saleid="${s.id}" value="${parseFloat(s.lead_incentive_amount || 0).toFixed(2)}" style="width:110px;padding:4px 8px;font-weight:700;color:var(--primary);">
            </td>
            <td>
              <span class="badge ${s.incentive_released ? 'badge-success' : 'badge-warning'}">
                ${s.incentive_released ? 'Released ✅' : 'Pending ⏳'}
              </span>
            </td>
          </tr>
        `;
      }).join("");

      overlay.innerHTML = `
        <div class="modal-content" style="background:var(--bg-primary);border-radius:12px;max-width:850px;width:100%;padding:24px;border:1px solid var(--border);max-height:90vh;overflow-y:auto;">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:16px;">
            <div>
              <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">🎁 Lead Incentive Processing — ${esc(leadName)}</h3>
              <div style="font-size:12px;color:var(--text3);margin-top:2px;">You can enter, edit, or release incentive amounts for each sale below before printing vouchers.</div>
            </div>
            <button class="btn btn-sm btn-outline closeIncModal">&times;</button>
          </div>

          <div style="margin-bottom:16px;max-height:400px;overflow-y:auto;" class="table-container">
            <table class="data-table" style="width:100%;">
              <thead>
                <tr>
                  <th>DC / Inv #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Products & Quantities</th>
                  <th>Sale Amount</th>
                  <th>Incentive Amount (₹)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;border-top:1px solid var(--border);padding-top:14px;">
            <button type="button" class="btn btn-secondary closeIncModal">Cancel</button>
            <button type="button" class="btn btn-primary" id="confirmReleasePrintBtn">
              💾 Save, Release & Print Dual Voucher (Page 1: Original + Page 2: Receiver Copy)
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      overlay.querySelectorAll(".closeIncModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

      overlay.querySelector("#confirmReleasePrintBtn").addEventListener("click", async () => {
        const btn = overlay.querySelector("#confirmReleasePrintBtn");
        if (btn && btn.disabled) return;
        const origHtml = btn ? btn.innerHTML : "💾 Save, Release & Print Dual Voucher";
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Releasing & Preparing Voucher...`;
        }

        const inputs = overlay.querySelectorAll(".leadIncAmtInput");
        const updates = [];
        inputs.forEach(inp => {
          updates.push({ id: inp.dataset.saleid, incentive_amount: parseFloat(inp.value || 0) });
        });

        try {
          const relRes = await fetch(`${API_BASE}/sales?action=release-incentives`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ lead_name: leadName, updates })
          });
          const relData = await relRes.json();
          if (relData.success) {
            showToast("Incentives saved and marked as released!", "success");
            overlay.remove();
            
            // Re-fetch latest sales data for printing dual copy voucher
            const refreshRes = await fetch(`${API_BASE}/sales?action=get-lead-sales&lead_name=${encodeURIComponent(leadName)}${monthVal ? `&month=${monthVal}` : ''}`, { headers: authHeaders() });
            const refreshData = await refreshRes.json();
            if (refreshData.success) {
              if (typeof window.printIncentiveVoucher === "function") {
                const compObj = (typeof currentCompanies !== 'undefined' && currentCompanies.find(c => c.id === salesList[0]?.company_id)) || {};
                window.printIncentiveVoucher(leadName, refreshData.sales, refreshData.items, compObj, monthVal || "All Time");
              }
            }
            fetchIncentivesSummary();
          } else {
            showToast(relData.error || "Failed to release incentives", "error");
            if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
          }
        } catch (err) {
          showToast("Error releasing incentives: " + err.message, "error");
          if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
        }
      });

    } catch (err) {
      showToast("Error fetching lead sales details: " + err.message, "error");
    }
  }

  fetchIncentivesSummary();
}
