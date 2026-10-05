// ═══════════════════════════════════════════════════
// BUSINESS ERP — today-tasks.js
// Today Tasks & Work Goals Dashboard for Employees / Staff
// ═══════════════════════════════════════════════════

window.renderTodayTasksModule = async function (tabKey, container) {
  if (!container) return;

  container.innerHTML = `
    <div class="card" style="margin-bottom:24px;">
      <!-- DAILY CHECK-IN BANNER -->
      <div id="checkInBanner" style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px 20px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;box-shadow:var(--shadow-sm);">
        <div style="display:flex;align-items:center;gap:14px;">
          <div id="checkInIcon" style="font-size:30px;">📍</div>
          <div>
            <div id="checkInTitle" style="font-weight:700;font-size:15px;color:var(--text1);">Daily Attendance & Work Check-In</div>
            <div id="checkInSub" style="font-size:13px;color:var(--text3);margin-top:2px;">Checking today's attendance status...</div>
          </div>
        </div>
        <div id="checkInAction">
          <div style="display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--text3);padding:8px 14px;background:var(--bg1);border:1px solid var(--border);border-radius:8px;">
            <div class="spinner" style="width:14px;height:14px;border-width:2px;margin:0;"></div> Checking status...
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
        <div>
          <h2 style="font-size:18px;font-weight:600;color:var(--text1);">📋 My Work Tasks & Work Goals</h2>
          <p style="font-size:13px;color:var(--text3);margin-top:2px;">Track your operational goals, update task status, and review historical work assigned by management.</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <input type="date" id="myTaskDateFilter" class="form-input" style="width:auto;" title="Filter by Due / Created Date">
          <select id="myTaskStatusFilter" class="form-select" style="width:auto;">
            <option value="all">🌐 All Statuses</option>
            <option value="pending">⏳ Pending</option>
            <option value="in_progress">🚀 In Progress</option>
            <option value="completed">✅ Completed</option>
          </select>
          <button class="btn btn-secondary" id="refreshMyTasksBtn">🔄 Refresh</button>
        </div>
      </div>

      <!-- STAT CARDS -->
      <div class="stats-grid" style="grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:16px;margin-bottom:20px;">
        <div class="stat-card">
          <div class="stat-icon blue">📋</div>
          <div>
            <div class="stat-value" id="statTotal">0</div>
            <div class="stat-label">Total Assigned</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber">⏳</div>
          <div>
            <div class="stat-value" id="statPending">0</div>
            <div class="stat-label">Pending</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple">🚀</div>
          <div>
            <div class="stat-value" id="statInProgress">0</div>
            <div class="stat-label">In Progress</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">✅</div>
          <div>
            <div class="stat-value" id="statCompleted">0</div>
            <div class="stat-label">Completed</div>
          </div>
        </div>
      </div>

      <!-- TASKS TABLE -->
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Task Details</th>
              <th>Priority</th>
              <th>Target Due Date</th>
              <th>Assigned By</th>
              <th>Status</th>
              <th>Update Progress</th>
            </tr>
          </thead>
          <tbody id="myTasksTableBody">
            <tr><td colspan="7" style="text-align:center;padding:20px;"><div class="spinner"></div> Loading your assigned tasks...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  function renderCheckInButton() {
    const sub = document.getElementById("checkInSub");
    const act = document.getElementById("checkInAction");
    if (sub) sub.innerHTML = `You have not checked in for today yet. Please click the button to record your daily attendance.`;
    if (act) {
      act.innerHTML = `<button class="btn btn-success" id="doCheckInBtn" style="font-weight:700;padding:9px 18px;font-size:13.5px;">🟢 Check In Now</button>`;
      const checkInBtn = document.getElementById("doCheckInBtn");
      if (checkInBtn) {
        checkInBtn.addEventListener("click", async () => {
          checkInBtn.disabled = true;
          checkInBtn.textContent = "⏳ Checking in...";
          try {
            const cRes = await fetch(`${API_BASE}/attendance?action=check-in`, {
              method: "POST",
              headers: authHeaders()
            });
            const cData = await cRes.json();
            if (cData.success) {
              showToast(cData.message || "Checked in successfully!", "success");
              loadCheckInStatus();
            } else {
              showToast(cData.error || "Failed to check in", "error");
              checkInBtn.disabled = false;
              checkInBtn.textContent = "🟢 Check In Now";
            }
          } catch (err) {
            showToast("Check-in error: " + err.message, "error");
            checkInBtn.disabled = false;
            checkInBtn.textContent = "🟢 Check In Now";
          }
        });
      }
    }
  }

  function formatTime12h(timeStr) {
    if (!timeStr) return "";
    const parts = timeStr.trim().split(":");
    if (parts.length < 2) return timeStr;
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    if (isNaN(hours)) return timeStr;
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const hStr = hours < 10 ? "0" + hours : hours;
    return `${hStr}:${minutes} ${ampm}`;
  }

  async function loadCheckInStatus() {
    const sub = document.getElementById("checkInSub");
    const act = document.getElementById("checkInAction");
    if (!sub || !act) return;

    try {
      const res = await fetch(`${API_BASE}/attendance?action=my-status`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) {
        renderCheckInButton();
        return;
      }

      if (data.checked_in) {
        const rawIn = data.login_time ? data.login_time.slice(0, 5) : "";
        const timeStr = rawIn ? formatTime12h(rawIn) : "Today";
        const stLabel = (data.status || "present").toUpperCase();
        const badgeColor = stLabel === "LATE" ? "badge-warning" : (stLabel === "LEAVE" ? "badge-danger" : "badge-success");
        
        if (data.logout_time) {
          const rawOut = data.logout_time.slice(0, 5);
          const outStr = formatTime12h(rawOut);
          sub.innerHTML = `Checked in at <strong style="color:var(--text1);">${timeStr}</strong> | Checked out at <strong style="color:var(--text1);">${outStr}</strong> (Attendance Status: <span class="badge ${badgeColor}">${stLabel}</span>)`;
          act.innerHTML = `<span class="badge badge-neutral" style="font-size:13px;padding:8px 14px;display:inline-flex;align-items:center;gap:6px;">🏁 Checked Out (${outStr})</span>`;
        } else {
          const now = new Date();
          const isAfter6PM = now.getHours() >= 18;
          
          sub.innerHTML = `Checked in for today at <strong style="color:var(--text1);">${timeStr}</strong> (Attendance Status: <span class="badge ${badgeColor}">${stLabel}</span>). ${isAfter6PM ? 'Check-out is now available.' : 'Check-out enables after 6:00 PM.'}`;

          if (isAfter6PM) {
            act.innerHTML = `<button class="btn btn-danger" id="doCheckOutBtn" style="font-weight:700;padding:9px 18px;font-size:13.5px;">🔴 Check Out Now</button>`;
          } else {
            act.innerHTML = `<button class="btn btn-secondary" disabled id="doCheckOutBtn" style="font-weight:600;padding:9px 18px;font-size:13px;opacity:0.75;cursor:not-allowed;" title="Check-out is available after 6:00 PM">🔴 Check Out (After 6 PM)</button>`;
          }

          const checkOutBtn = document.getElementById("doCheckOutBtn");
          if (checkOutBtn && isAfter6PM) {
            checkOutBtn.addEventListener("click", async () => {
              checkOutBtn.disabled = true;
              checkOutBtn.textContent = "⏳ Checking out...";
              try {
                const cRes = await fetch(`${API_BASE}/attendance?action=check-out`, {
                  method: "POST",
                  headers: authHeaders()
                });
                const cData = await cRes.json();
                if (cData.success) {
                  showToast(cData.message || "Checked out successfully!", "success");
                  loadCheckInStatus();
                } else {
                  showToast(cData.error || "Failed to check out", "error");
                  checkOutBtn.disabled = false;
                  checkOutBtn.textContent = "🔴 Check Out Now";
                }
              } catch (err) {
                showToast("Check-out error: " + err.message, "error");
                checkOutBtn.disabled = false;
                checkOutBtn.textContent = "🔴 Check Out Now";
              }
            });
          }
        }
      } else {
        renderCheckInButton();
      }
    } catch (e) {
      renderCheckInButton();
    }
  }

  async function loadMyTasks() {
    const tbody = document.getElementById("myTasksTableBody");
    if (!tbody) return;

    try {
      const dateVal = document.getElementById("myTaskDateFilter") ? document.getElementById("myTaskDateFilter").value : "";
      const statusVal = document.getElementById("myTaskStatusFilter") ? document.getElementById("myTaskStatusFilter").value : "all";

      let queryParams = [];
      if (dateVal) queryParams.push(`date=${encodeURIComponent(dateVal)}`);
      if (statusVal && statusVal !== 'all') queryParams.push(`status=${encodeURIComponent(statusVal)}`);
      const queryString = queryParams.length > 0 ? '&' + queryParams.join('&') : '';

      const res = await fetch(`${API_BASE}/super?action=my-tasks${queryString}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) {
        showToast("Failed to load tasks: " + (data.error || "Error"), "error");
        return;
      }

      const tasks = data.tasks || [];
      const total = tasks.length;
      const pending = tasks.filter(t => t.status === 'pending').length;
      const inProgress = tasks.filter(t => t.status === 'in_progress').length;
      const completed = tasks.filter(t => t.status === 'completed').length;

      const elTotal = document.getElementById("statTotal");
      const elPending = document.getElementById("statPending");
      const elInProgress = document.getElementById("statInProgress");
      const elCompleted = document.getElementById("statCompleted");

      if (elTotal) elTotal.textContent = total;
      if (elPending) elPending.textContent = pending;
      if (elInProgress) elInProgress.textContent = inProgress;
      if (elCompleted) elCompleted.textContent = completed;

      if (tasks.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center;padding:32px;color:var(--text3);">
              <div style="font-size:32px;margin-bottom:8px;">📋</div>
              <div style="font-size:15px;font-weight:600;color:var(--text1);">No tasks found</div>
              <p style="font-size:13px;margin-top:4px;">No work tasks match the selected date or filter criteria.</p>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = tasks.map(t => {
        const priorityBadge = t.priority === 'urgent' ? 'badge-error' : t.priority === 'high' ? 'badge-warning' : t.priority === 'medium' ? 'badge-info' : 'badge-neutral';
        const statusBadge = t.status === 'completed' ? 'badge-success' : t.status === 'in_progress' ? 'badge-warning' : 'badge-info';
        return `
          <tr>
            <td>#${t.id}</td>
            <td>
              <div style="font-weight:600;color:var(--text1);">${esc(t.title)}</div>
              ${t.description ? `<div style="font-size:12.5px;color:var(--text3);margin-top:2px;">${esc(t.description)}</div>` : ''}
            </td>
            <td><span class="badge ${priorityBadge}">${esc(t.priority.toUpperCase())}</span></td>
            <td>${formatDate(t.due_date)}</td>
            <td>${esc(t.assigned_by_name || 'Management')}</td>
            <td><span class="badge ${statusBadge}">${esc(t.status.replace(/_/g, ' ').toUpperCase())}</span></td>
            <td>
              <select class="form-select myTaskStatusSelect" data-id="${t.id}" style="padding:6px 10px;font-size:12.5px;font-weight:500;">
                <option value="pending" ${t.status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>🚀 In Progress</option>
                <option value="completed" ${t.status === 'completed' ? 'selected' : ''}>✅ Completed</option>
              </select>
            </td>
          </tr>
        `;
      }).join("");

      tbody.querySelectorAll(".myTaskStatusSelect").forEach(sel => {
        sel.addEventListener("change", async () => {
          const taskId = sel.dataset.id;
          const newStatus = sel.value;
          try {
            const res = await fetch(`${API_BASE}/super?action=task-update-status`, {
              method: "POST",
              headers: authHeaders(),
              body: JSON.stringify({ task_id: taskId, status: newStatus })
            });
            const d = await res.json();
            if (d.success) {
              showToast(`Task #${taskId} status updated to ${newStatus.replace(/_/g, ' ')}!`, "success");
              loadMyTasks();
            } else {
              showToast(d.error || "Failed to update task", "error");
            }
          } catch (err) {
            showToast("Error updating task: " + err.message, "error");
          }
        });
      });

    } catch (err) {
      showToast("Error fetching your tasks: " + err.message, "error");
    }
  }

  on("refreshMyTasksBtn", "click", () => {
    loadCheckInStatus();
    loadMyTasks();
  });

  const dateFilterEl = document.getElementById("myTaskDateFilter");
  if (dateFilterEl) dateFilterEl.addEventListener("change", loadMyTasks);

  const statusFilterEl = document.getElementById("myTaskStatusFilter");
  if (statusFilterEl) statusFilterEl.addEventListener("change", loadMyTasks);

  loadCheckInStatus();
  loadMyTasks();
};

if (window.registerModuleRoute) {
  window.registerModuleRoute(
    [
      'today_tasks',
      'acc_today_tasks',
      'inv_today_tasks',
      'hr_today_tasks',
      'sales_today_tasks',
      'svc_today_tasks',
      'mkt_today_tasks',
      'gen_today_tasks'
    ],
    window.renderTodayTasksModule
  );
}
