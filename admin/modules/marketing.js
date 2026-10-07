// ═══════════════════════════════════════════════════
// BUSINESS ERP — marketing.js
// Airtel/Jio DLT SMS, Email Marketing Client, SMTP Management & Broadcast Logs
// ═══════════════════════════════════════════════════

window.renderMarketingModule = async function (tabKey, container) {
  const activeTab = tabKey || 'mkt_email';

  const isToday = activeTab === 'mkt_today_tasks';
  const isSMS = activeTab === 'mkt_sms' || activeTab === 'sms';
  const isEmail = activeTab === 'email' || activeTab === 'mkt_email' || activeTab === 'marketing';
  const isTemplates = activeTab === 'mkt_templates';
  const isSMTP = activeTab === 'mkt_smtp';
  const isLogs = activeTab === 'mkt_logs';

  container.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);border-radius:12px;border:1px solid var(--border);">
      <div class="sub-tabs-bar" style="display:flex;gap:4px;overflow-x:auto;padding:8px 12px;background:var(--bg-secondary);border-bottom:1px solid var(--border);">
        <button class="sub-tab ${isToday ? 'active' : ''}" data-tabkey="mkt_today_tasks">📋 Today Tasks</button>
        <button class="sub-tab ${isEmail ? 'active' : ''}" data-tabkey="mkt_email">📧 Email Marketing & Mail Client</button>
        <button class="sub-tab ${isTemplates ? 'active' : ''}" data-tabkey="mkt_templates">📄 Email Templates</button>
        <button class="sub-tab ${isSMTP ? 'active' : ''}" data-tabkey="mkt_smtp">⚙️ SMTP Server Settings</button>
        <button class="sub-tab ${isLogs ? 'active' : ''}" data-tabkey="mkt_logs">📜 Sent Email Audit Logs</button>
        <button class="sub-tab ${isSMS ? 'active' : ''}" data-tabkey="mkt_sms">💬 Airtel / Jio DLT SMS</button>
      </div>

      <div class="sub-content-area" id="mktSubContent" style="padding:20px;">
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

  const subArea = document.getElementById("mktSubContent");
  if (isToday) {
    if (window.renderTodayTasksModule) await window.renderTodayTasksModule('mkt_today_tasks', subArea);
    else loadEmailClientSubTab();
  }
  else if (isTemplates) loadEmailTemplatesSubTab();
  else if (isSMTP) loadSMTPSettingsSubTab();
  else if (isLogs) loadSentEmailLogsSubTab();
  else if (isSMS) loadSMSSubTab();
  else loadEmailClientSubTab();
};

if (window.registerModuleRoute) {
  window.registerModuleRoute(
    [
      'marketing', 'sms', 'email',
      'mkt_today_tasks', 'mkt_email', 'mkt_templates', 'mkt_sms', 'mkt_smtp', 'mkt_logs'
    ],
    window.renderMarketingModule
  );
}

// Helper to insert text at textarea cursor position
function insertAtCursor(textarea, text) {
  if (!textarea) return;
  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const val = textarea.value;
  textarea.value = val.substring(0, start) + text + val.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
  textarea.focus();
}

// ── SubTab 1: Email Client & Composer Screen ──
async function loadEmailClientSubTab() {
  const subContent = document.getElementById("mktSubContent");
  const userObj = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null) || JSON.parse(localStorage.getItem('erp_user') || '{}');
  const isSuperAdmin = userObj && (userObj.role === 'superadmin' || userObj.username === 'superadmin');
  const compId = isSuperAdmin ? (selectedCompanyId || 'all') : (userObj?.company_id || 'all');

  let smtpsList = [];
  let contactsList = [];
  let dbTemplates = [];

  try {
    const [sRes, cRes, tRes] = await Promise.all([
      fetch(`${API_BASE}/marketing?action=smtp-list&company_id=${compId}`, { headers: authHeaders() }),
      fetch(`${API_BASE}/marketing?action=recipients-list&company_id=${compId}`, { headers: authHeaders() }),
      fetch(`${API_BASE}/marketing?action=template-list&company_id=${compId}`, { headers: authHeaders() })
    ]);
    const sData = await sRes.json();
    const cData = await cRes.json();
    const tData = await tRes.json();

    if (sData.success) smtpsList = sData.smtps || [];
    if (cData.success) contactsList = cData.contacts || [];
    if (tData.success) dbTemplates = tData.templates || [];
  } catch (e) {}

  subContent.innerHTML = `
    <div style="max-width:1100px;margin:0 auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
        <div>
          <h3 style="font-size:18px;font-weight:700;color:var(--text1);margin:0;">📧 Business Email Client & Campaign Composer</h3>
          <p style="font-size:12px;color:var(--text3);margin:2px 0 0 0;">Compose and send promotional newsletters, invoices, and updates via configured SMTP profiles</p>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline-primary" id="btnGoToTemplates" style="font-weight:600;">📄 Email Templates</button>
          <button class="btn btn-outline-primary" id="btnGoToSmtp" style="font-weight:600;">⚙️ Setup SMTP Servers</button>
        </div>
      </div>

      ${smtpsList.length === 0 ? `
        <div class="card" style="background:#fffbe6;border:1px solid #fef08a;color:#b45309;padding:16px;margin-bottom:16px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;">
          <div>⚠️ <strong>No SMTP Profile Configured!</strong> Please setup your company or personal SMTP credentials to send emails.</div>
          <button class="btn btn-sm btn-primary" id="btnQuickSmtp">⚙️ Setup SMTP Now</button>
        </div>
      ` : ''}

      <div style="display:grid;grid-template-columns:2.2fr 1fr;gap:20px;align-items:start;">
        <!-- EMAIL COMPOSER FORM -->
        <div class="card" style="background:var(--bg-primary);border:1px solid var(--border);border-radius:12px;padding:20px;box-shadow:0 4px 12px rgba(0,0,0,0.03);">
          <form id="emailComposerForm">
            <!-- FROM EMAIL PROFILE SELECT -->
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label" style="font-weight:700;color:var(--primary);">✉️ Send From (SMTP Profile) *</label>
              <select id="emSmtpId" class="form-select" style="font-weight:700;border-color:var(--primary);" required>
                ${smtpsList.length === 0 ? `<option value="">-- No SMTP Configured --</option>` : ''}
                ${smtpsList.map(s => `
                  <option value="${s.id}" ${s.is_default ? 'selected' : ''}>
                    ${esc(s.profile_name)} (${esc(s.from_email)}) ${s.company_name ? '- ' + esc(s.company_name) : ''}
                  </option>
                `).join('')}
              </select>
            </div>

            <!-- TO RECIPIENT -->
            <div class="form-group" style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <label class="form-label" style="margin:0;font-weight:600;">To (Recipient Emails) *</label>
                <div style="font-size:11px;">
                  <a href="#" id="toggleCcBcc" style="color:var(--primary);text-decoration:none;font-weight:600;">+ Cc / Bcc</a>
                </div>
              </div>
              <input type="text" id="emTo" class="form-input" placeholder="e.g. client@example.com, sales@partner.org" required style="font-weight:600;">
            </div>

            <!-- CC / BCC FIELDS (HIDDEN BY DEFAULT) -->
            <div id="ccBccGroup" style="display:none;margin-bottom:12px;">
              <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px;">
                <div class="form-group">
                  <label class="form-label">Cc (Carbon Copy)</label>
                  <input type="text" id="emCc" class="form-input" placeholder="cc@domain.com">
                </div>
                <div class="form-group">
                  <label class="form-label">Bcc (Blind Copy)</label>
                  <input type="text" id="emBcc" class="form-input" placeholder="bcc@domain.com">
                </div>
              </div>
            </div>

            <!-- SUBJECT LINE -->
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label" style="font-weight:600;">Email Subject Line *</label>
              <input type="text" id="emSubject" class="form-input" placeholder="e.g. Special Offer: 15% Discount on Rotary Equipment Services" required style="font-weight:700;">
            </div>

            <!-- TEMPLATE PICKER TOOLBAR -->
            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-secondary);padding:8px 12px;border-radius:8px 8px 0 0;border:1px solid var(--border);border-bottom:none;flex-wrap:wrap;gap:8px;">
              <div style="font-size:12px;font-weight:700;color:var(--text2);">✏️ Message Content & Formatting</div>
              <div style="display:flex;align-items:center;gap:6px;">
                <label style="font-size:11px;font-weight:700;color:var(--primary);margin:0;">📄 Template:</label>
                <select id="emTemplateSelect" class="form-select" style="max-width:240px;height:30px;font-size:11px;padding:2px 8px;font-weight:600;">
                  <option value="">-- Load Saved Template --</option>
                  ${dbTemplates.map(t => `<option value="${t.id}">${esc(t.template_name)}</option>`).join('')}
                </select>
              </div>
            </div>

            <!-- FORMATTING & PLACEHOLDER TAGS TOOLBAR -->
            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-primary);padding:6px 12px;border:1px solid var(--border);border-bottom:none;flex-wrap:wrap;gap:6px;">
              <div style="display:flex;gap:4px;align-items:center;">
                <button type="button" class="btn btn-xs btn-outline formatBtn" data-cmd="&lt;h2&gt;" data-end="&lt;/h2&gt;" title="Heading">H2</button>
                <button type="button" class="btn btn-xs btn-outline formatBtn" data-cmd="&lt;strong&gt;" data-end="&lt;/strong&gt;" title="Bold"><b>B</b></button>
                <button type="button" class="btn btn-xs btn-outline formatBtn" data-cmd="&lt;em&gt;" data-end="&lt;/em&gt;" title="Italic"><i>I</i></button>
                <button type="button" class="btn btn-xs btn-outline formatBtn" data-cmd="&lt;u&gt;" data-end="&lt;/u&gt;" title="Underline"><u>U</u></button>
                <button type="button" class="btn btn-xs btn-outline formatBtn" data-cmd="&lt;p&gt;" data-end="&lt;/p&gt;" title="Paragraph">P</button>
              </div>
              <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">
                <span style="font-size:10px;font-weight:700;color:var(--text3);">Insert Placeholder:</span>
                <button type="button" class="btn btn-xs btn-outline-primary insertTagBtn" data-tag="{{customer_name}}">+ Customer Name</button>
                <button type="button" class="btn btn-xs btn-outline-primary insertTagBtn" data-tag="{{company_name}}">+ Company (DB)</button>
                <button type="button" class="btn btn-xs btn-outline-primary insertTagBtn" data-tag="{{email}}">+ Email</button>
                <button type="button" class="btn btn-xs btn-outline-primary insertTagBtn" data-tag="{{phone}}">+ Phone</button>
                <button type="button" class="btn btn-xs btn-outline-primary insertTagBtn" data-tag="{{date}}">+ Date</button>
              </div>
            </div>

            <!-- EMAIL BODY EDITABLE -->
            <div class="form-group" style="margin-bottom:16px;">
              <textarea id="emBody" class="form-input" rows="12" style="border-radius:0 0 8px 8px;font-family:inherit;font-size:13px;line-height:1.6;" placeholder="Type your email body here... You can insert formatting tags or placeholders like {{customer_name}} and {{company_name}} above." required></textarea>
            </div>

            <!-- SUBMIT ACTION BUTTONS -->
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
              <button type="button" class="btn btn-outline" id="emTestBtn" style="font-weight:600;">⚡ Test Connection</button>
              <div style="display:flex;gap:8px;">
                <button type="button" class="btn btn-secondary" id="emClearBtn">Clear</button>
                <button type="submit" id="emSendBtn" class="btn btn-primary" style="font-weight:700;padding:10px 24px;background:linear-gradient(135deg,var(--primary),#2563eb);">🚀 Send Email Now</button>
              </div>
            </div>
          </form>
        </div>

        <!-- RIGHT SIDE: CONTACT PICKER & QUICK TIPS -->
        <div>
          <!-- CONTACT PICKER CARD -->
          <div class="card" style="background:var(--bg-primary);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <h4 style="font-size:13px;font-weight:700;color:var(--text1);margin:0;">👥 Quick Contact Picker</h4>
              ${contactsList.length > 0 ? `
                <button type="button" class="btn btn-xs btn-outline-primary" id="selectAllContactsBtn" style="font-size:11px;padding:2px 8px;font-weight:600;">➕ Select All (${contactsList.length})</button>
              ` : ''}
            </div>
            <p style="font-size:11px;color:var(--text3);margin-bottom:10px;">Click any contact to add or use <strong>Select All</strong> for mass campaigns:</p>
            
            <div style="max-height:240px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;">
              ${contactsList.length === 0 ? `
                <div style="padding:15px;text-align:center;font-size:12px;color:var(--text3);">No customer contacts with email addresses found.</div>
              ` : contactsList.map(c => `
                <div class="contact-item" data-email="${esc(c.email)}" style="padding:8px 12px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <div style="font-size:12px;font-weight:700;color:var(--text1);">${esc(c.name)}</div>
                    <div style="font-size:11px;color:var(--primary);">${esc(c.email)}</div>
                  </div>
                  <button type="button" class="btn btn-sm btn-outline-primary" style="padding:2px 6px;font-size:10px;">+ To</button>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- VARIABLE SHORTCODES & MAIL MERGE CARD -->
          <div class="card" style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:16px;">
            <h4 style="font-size:13px;font-weight:700;color:var(--text1);margin:0 0 8px 0;">⚡ Mail Merge & Formatting Tags</h4>
            <div style="font-size:11px;color:var(--text2);line-height:1.6;">
              <div style="font-weight:700;color:var(--primary);margin-bottom:4px;">Mail Merge Personalization:</div>
              <code style="background:var(--bg-primary);padding:2px 4px;border-radius:4px;display:inline-block;margin:2px 0;">{{customer_name}}</code> - Customer's Full Name<br>
              <code style="background:var(--bg-primary);padding:2px 4px;border-radius:4px;display:inline-block;margin:2px 0;">{{email}}</code> - Customer's Email Address<br>
              <hr style="border:0;border-top:1px solid var(--border);margin:8px 0;">
              <div style="font-weight:700;color:var(--text1);margin-bottom:4px;">HTML Formatting Tags:</div>
              <code style="background:var(--bg-primary);padding:2px 4px;border-radius:4px;display:inline-block;margin:2px 0;">&lt;h2&gt;Title&lt;/h2&gt;</code><br>
              <code style="background:var(--bg-primary);padding:2px 4px;border-radius:4px;display:inline-block;margin:2px 0;">&lt;strong&gt;Bold Text&lt;/strong&gt;</code><br>
              <code style="background:var(--bg-primary);padding:2px 4px;border-radius:4px;display:inline-block;margin:2px 0;">&lt;a href="..."&gt;Click Here&lt;/a&gt;</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Toggle CC/BCC
  document.getElementById("toggleCcBcc")?.addEventListener("click", (e) => {
    e.preventDefault();
    const grp = document.getElementById("ccBccGroup");
    if (grp) grp.style.display = grp.style.display === "none" ? "block" : "none";
  });

  // Switch to Templates
  document.getElementById("btnGoToTemplates")?.addEventListener("click", () => {
    if (window.switchTab) window.switchTab("mkt_templates");
  });

  // Switch to SMTP settings
  document.getElementById("btnGoToSmtp")?.addEventListener("click", () => {
    if (window.switchTab) window.switchTab("mkt_smtp");
  });
  document.getElementById("btnQuickSmtp")?.addEventListener("click", () => {
    if (window.switchTab) window.switchTab("mkt_smtp");
  });

  // Format buttons (H2, Bold, Italic, Underline, P)
  document.querySelectorAll(".formatBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const emBody = document.getElementById("emBody");
      if (!emBody) return;
      const startTag = btn.dataset.cmd || "";
      const endTag = btn.dataset.end || "";
      const selStart = emBody.selectionStart || 0;
      const selEnd = emBody.selectionEnd || 0;
      const selText = emBody.value.substring(selStart, selEnd);
      const replacement = startTag + selText + endTag;
      emBody.value = emBody.value.substring(0, selStart) + replacement + emBody.value.substring(selEnd);
      emBody.selectionStart = selStart + startTag.length;
      emBody.selectionEnd = selStart + startTag.length + selText.length;
      emBody.focus();
    });
  });

  // Insert placeholder tag buttons
  document.querySelectorAll(".insertTagBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tag = btn.dataset.tag;
      const emBody = document.getElementById("emBody");
      if (emBody && tag) insertAtCursor(emBody, tag);
    });
  });

  // Select All Contacts button click
  document.getElementById("selectAllContactsBtn")?.addEventListener("click", () => {
    const emails = contactsList.map(c => c.email).filter(Boolean);
    const toInp = document.getElementById("emTo");
    if (toInp && emails.length > 0) {
      toInp.value = emails.join(", ");
      showToast(`Selected all ${emails.length} customer contacts for Mail Merge!`, "success");
    }
  });

  // Contact item picker click
  document.querySelectorAll(".contact-item").forEach(item => {
    item.addEventListener("click", () => {
      const email = item.dataset.email;
      const toInp = document.getElementById("emTo");
      if (toInp && email) {
        if (!toInp.value.trim()) toInp.value = email;
        else if (!toInp.value.includes(email)) toInp.value += ", " + email;
        showToast(`Added ${email} to recipient list`, "info");
      }
    });
  });

  // Quick Templates Selector
  document.getElementById("emTemplateSelect")?.addEventListener("change", (e) => {
    const val = e.target.value;
    if (!val) return;
    const subjInp = document.getElementById("emSubject");
    const bodyInp = document.getElementById("emBody");
    const matched = dbTemplates.find(t => String(t.id) === String(val));
    if (matched) {
      if (subjInp) subjInp.value = matched.subject;
      if (bodyInp) bodyInp.value = matched.body_html;
      showToast(`Loaded template: ${matched.template_name}`, "info");
    }
  });

  // Clear button
  document.getElementById("emClearBtn")?.addEventListener("click", () => {
    document.getElementById("emailComposerForm")?.reset();
  });

  // Test Connection button
  document.getElementById("emTestBtn")?.addEventListener("click", async () => {
    const smtpId = document.getElementById("emSmtpId")?.value;
    if (!smtpId) return showToast("Please select an SMTP profile to test", "warning");

    const btn = document.getElementById("emTestBtn");
    setButtonLoading(btn, true, "Testing...");

    try {
      const res = await fetch(`${API_BASE}/marketing?action=smtp-test`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ smtp_id: smtpId })
      });
      const data = await res.json();
      if (data.success) showToast(data.message, "success");
      else showToast(data.error, "error");
    } catch (err) {
      showToast("Test failed: " + err.message, "error");
    } finally {
      setButtonLoading(btn, false);
    }
  });

  // Form submit (Send Email)
  document.getElementById("emailComposerForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("emSendBtn");
    setButtonLoading(btn, true, "Sending Email...");

    const payload = {
      smtp_id: document.getElementById("emSmtpId").value,
      to_email: document.getElementById("emTo").value.trim(),
      cc_email: document.getElementById("emCc")?.value.trim(),
      bcc_email: document.getElementById("emBcc")?.value.trim(),
      subject: document.getElementById("emSubject").value.trim(),
      body_html: document.getElementById("emBody").value
    };

    try {
      const res = await fetch(`${API_BASE}/marketing?action=send-email`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "success");
        document.getElementById("emailComposerForm").reset();
      } else showToast(data.error, "error");
    } catch (err) {
      showToast("Error sending email: " + err.message, "error");
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

// ── SubTab: Email Templates Management ──
async function loadEmailTemplatesSubTab() {
  const subContent = document.getElementById("mktSubContent");
  const userObj = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null) || JSON.parse(localStorage.getItem('erp_user') || '{}');
  const isSuperAdmin = userObj && (userObj.role === 'superadmin' || userObj.username === 'superadmin');
  const compId = isSuperAdmin ? (selectedCompanyId || 'all') : (userObj?.company_id || 'all');

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <div>
        <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">📄 Custom Marketing Email Templates</h3>
        <p style="font-size:12px;color:var(--text3);margin:2px 0 0 0;">Manage marketing email templates with dynamic placeholders like <code>{{customer_name}}</code> and <code>{{company_name}}</code> (Auto DB-Resolved)</p>
      </div>
      <button class="btn btn-primary" id="addTemplateBtn" style="font-weight:700;">+ Create Email Template</button>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Template Name</th>
            <th>Email Subject Line</th>
            <th>Company Scope</th>
            <th>Last Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="tplTableBody">
          <tr><td colspan="5" style="text-align:center;padding:20px;"><div class="spinner"></div> Loading email templates...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  on("addTemplateBtn", "click", () => openTemplateModal());

  async function fetchTemplates() {
    try {
      const res = await fetch(`${API_BASE}/marketing?action=template-list&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success || !data.templates) return;

      const tbody = document.getElementById("tplTableBody");
      if (!tbody) return;

      if (data.templates.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3);">No email templates found. Click <strong>+ Create Email Template</strong> to build one.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.templates.map(t => `
        <tr>
          <td><strong style="color:var(--primary);font-size:13px;">${esc(t.template_name)}</strong></td>
          <td style="font-weight:600;color:var(--text1);">${esc(t.subject)}</td>
          <td><span class="badge badge-info">${esc(t.company_name || 'All Companies / Global')}</span></td>
          <td style="font-size:12px;">${t.updated_at ? new Date(t.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
          <td>
            <div style="display:flex;gap:4px;">
              <button class="btn btn-sm btn-outline-info previewTplBtn" data-tpl='${JSON.stringify(t).replace(/'/g, "&apos;")}' title="Live Preview">👁️ Preview</button>
              <button class="btn btn-sm btn-outline editTplBtn" data-tpl='${JSON.stringify(t).replace(/'/g, "&apos;")}' title="Edit Template">✏️ Edit</button>
              <button class="btn btn-sm btn-outline-danger deleteTplBtn" data-id="${t.id}" title="Delete Template">🗑️</button>
            </div>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll(".previewTplBtn").forEach(btn => {
        btn.addEventListener("click", () => {
          const tObj = JSON.parse(btn.dataset.tpl);
          openTemplatePreviewModal(tObj);
        });
      });

      tbody.querySelectorAll(".editTplBtn").forEach(btn => {
        btn.addEventListener("click", () => {
          const tObj = JSON.parse(btn.dataset.tpl);
          openTemplateModal(tObj);
        });
      });

      tbody.querySelectorAll(".deleteTplBtn").forEach(btn => {
        btn.addEventListener("click", async () => {
          if (!confirm("Are you sure you want to delete this email template?")) return;
          try {
            const dRes = await fetch(`${API_BASE}/marketing?action=template-delete&id=${btn.dataset.id}`, {
              method: "POST",
              headers: authHeaders()
            });
            const dData = await dRes.json();
            if (dData.success) {
              showToast(dData.message, "success");
              fetchTemplates();
            } else showToast(dData.error, "error");
          } catch (e) {
            showToast("Delete error: " + e.message, "error");
          }
        });
      });

    } catch (err) {
      showToast("Fetch templates error: " + err.message, "error");
    }
  }

  fetchTemplates();
}

// ── Modal: Create / Edit Template ──
async function openTemplateModal(editData = null) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:12px;overflow-y:auto;";

  const userObj = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null) || JSON.parse(localStorage.getItem('erp_user') || '{}');
  const isSuperAdmin = userObj && (userObj.role === 'superadmin' || userObj.username === 'superadmin');

  let companiesList = [];
  if (isSuperAdmin) {
    companiesList = (typeof currentCompanies !== 'undefined' && currentCompanies) ? currentCompanies : [];
  }

  const isEdit = !!editData;

  overlay.innerHTML = `
    <div class="modal-content" style="background:var(--bg-primary,#ffffff);border-radius:12px;max-width:680px;width:100%;max-height:92vh;overflow-y:auto;padding:24px;border:1px solid var(--border);box-shadow:0 20px 25px -5px rgba(0,0,0,0.3);box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:16px;">
        <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">📄 ${isEdit ? 'Edit Marketing Email Template' : 'Create Superadmin / Company Email Template'}</h3>
        <button class="btn btn-sm btn-outline closeTplModal">&times;</button>
      </div>

      <form id="templateConfigForm">
        ${isSuperAdmin ? `
        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-weight:700;color:var(--primary);">🏢 Select Company Scope *</label>
          <select id="tplCompanyId" class="form-select" required style="border-color:var(--primary);font-weight:600;">
            <option value="">-- All Companies / Global Template --</option>
            ${companiesList.map(c => `<option value="${c.id}" ${(editData && editData.company_id === c.id) || (selectedCompanyId && parseInt(selectedCompanyId) === c.id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        ` : ''}

        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-weight:600;">Template Title / Identifier *</label>
          <input type="text" id="tplName" class="form-input" value="${esc(editData?.template_name || '')}" required placeholder="e.g. 🎉 Diwali Special Promotional Offer">
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-weight:600;">Email Subject Line *</label>
          <input type="text" id="tplSubject" class="form-input" value="${esc(editData?.subject || '')}" required placeholder="e.g. Special Festival Discount from {{company_name}} for {{customer_name}}">
        </div>

        <!-- FORMATTING & PLACEHOLDER TAGS TOOLBAR -->
        <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-secondary);padding:8px 12px;border-radius:8px 8px 0 0;border:1px solid var(--border);border-bottom:none;flex-wrap:wrap;gap:6px;">
          <div style="display:flex;gap:4px;align-items:center;">
            <button type="button" class="btn btn-xs btn-outline tplFormatBtn" data-cmd="&lt;h2&gt;" data-end="&lt;/h2&gt;" title="Heading">H2</button>
            <button type="button" class="btn btn-xs btn-outline tplFormatBtn" data-cmd="&lt;strong&gt;" data-end="&lt;/strong&gt;" title="Bold"><b>B</b></button>
            <button type="button" class="btn btn-xs btn-outline tplFormatBtn" data-cmd="&lt;em&gt;" data-end="&lt;/em&gt;" title="Italic"><i>I</i></button>
            <button type="button" class="btn btn-xs btn-outline tplFormatBtn" data-cmd="&lt;u&gt;" data-end="&lt;/u&gt;" title="Underline"><u>U</u></button>
            <button type="button" class="btn btn-xs btn-outline tplFormatBtn" data-cmd="&lt;p&gt;" data-end="&lt;/p&gt;" title="Paragraph">P</button>
          </div>
          <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">
            <span style="font-size:10px;font-weight:700;color:var(--text3);">Placeholders:</span>
            <button type="button" class="btn btn-xs btn-outline-primary tplInsertTagBtn" data-tag="{{customer_name}}">+ Customer Name</button>
            <button type="button" class="btn btn-xs btn-outline-primary tplInsertTagBtn" data-tag="{{company_name}}">+ Company (DB)</button>
            <button type="button" class="btn btn-xs btn-outline-primary tplInsertTagBtn" data-tag="{{email}}">+ Email</button>
            <button type="button" class="btn btn-xs btn-outline-primary tplInsertTagBtn" data-tag="{{phone}}">+ Phone</button>
            <button type="button" class="btn btn-xs btn-outline-primary tplInsertTagBtn" data-tag="{{date}}">+ Date</button>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:16px;">
          <textarea id="tplBody" class="form-input" rows="10" style="border-radius:0 0 8px 8px;font-family:inherit;font-size:13px;line-height:1.6;" placeholder="Type your template HTML body here... Use tags like {{customer_name}} and {{company_name}} for dynamic replacement." required>${esc(editData?.body_html || '')}</textarea>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <button type="button" class="btn btn-outline-info" id="btnPreviewTplForm" style="font-weight:600;">👁️ Live Preview</button>
          <div style="display:flex;gap:8px;">
            <button type="button" class="btn btn-secondary closeTplModal">Cancel</button>
            <button type="submit" id="tplSubmitBtn" class="btn btn-primary" style="font-weight:700;">Save Template</button>
          </div>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelectorAll(".closeTplModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

  // Toolbar format buttons
  overlay.querySelectorAll(".tplFormatBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tBody = overlay.querySelector("#tplBody");
      if (!tBody) return;
      const startTag = btn.dataset.cmd || "";
      const endTag = btn.dataset.end || "";
      const selStart = tBody.selectionStart || 0;
      const selEnd = tBody.selectionEnd || 0;
      const selText = tBody.value.substring(selStart, selEnd);
      const replacement = startTag + selText + endTag;
      tBody.value = tBody.value.substring(0, selStart) + replacement + tBody.value.substring(selEnd);
      tBody.selectionStart = selStart + startTag.length;
      tBody.selectionEnd = selStart + startTag.length + selText.length;
      tBody.focus();
    });
  });

  // Placeholder tag buttons
  overlay.querySelectorAll(".tplInsertTagBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tag = btn.dataset.tag;
      const tBody = overlay.querySelector("#tplBody");
      if (tBody && tag) insertAtCursor(tBody, tag);
    });
  });

  // Live preview inside form
  overlay.querySelector("#btnPreviewTplForm")?.addEventListener("click", () => {
    const previewData = {
      template_name: overlay.querySelector("#tplName").value || "Preview Template",
      subject: overlay.querySelector("#tplSubject").value || "Subject Line",
      body_html: overlay.querySelector("#tplBody").value || "<p>Email Body</p>"
    };
    openTemplatePreviewModal(previewData);
  });

  // Save template form
  overlay.querySelector("#templateConfigForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = overlay.querySelector("#tplSubmitBtn");
    setButtonLoading(btn, true, "Saving...");

    let resolvedCompanyId = null;
    if (isSuperAdmin) {
      const compSel = overlay.querySelector("#tplCompanyId");
      if (compSel && compSel.value) resolvedCompanyId = parseInt(compSel.value);
    } else {
      resolvedCompanyId = userObj?.company_id;
    }

    const payload = {
      id: editData?.id || null,
      company_id: resolvedCompanyId,
      template_name: overlay.querySelector("#tplName").value.trim(),
      subject: overlay.querySelector("#tplSubject").value.trim(),
      body_html: overlay.querySelector("#tplBody").value
    };

    try {
      const res = await fetch(`${API_BASE}/marketing?action=template-save`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "success");
        overlay.remove();
        loadEmailTemplatesSubTab();
      } else showToast(data.error, "error");
    } catch (err) {
      showToast("Error saving template: " + err.message, "error");
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

// ── Modal: Live Template Preview Window ──
function openTemplatePreviewModal(template) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;padding:12px;overflow-y:auto;";

  const demoCompName = "Manaswini Enterprises (DB Auto-Resolved)";
  const demoCustName = "Sairajeev (Demo Recipient)";
  const demoEmail = "sairajeev2002@gmail.com";
  const demoDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  let renderedSubject = (template.subject || "")
    .replace(/\{\{customer_name\}\}/gi, demoCustName)
    .replace(/\{\{company_name\}\}/gi, demoCompName)
    .replace(/\{\{company\}\}/gi, demoCompName)
    .replace(/\{\{date\}\}/gi, demoDate);

  let renderedBody = (template.body_html || "")
    .replace(/\{\{customer_name\}\}/gi, demoCustName)
    .replace(/\{\{company_name\}\}/gi, demoCompName)
    .replace(/\{\{company\}\}/gi, demoCompName)
    .replace(/\{\{email\}\}/gi, demoEmail)
    .replace(/\{\{phone\}\}/gi, "+91 98765 43210")
    .replace(/\{\{date\}\}/gi, demoDate)
    .replace(/\{\{sender_name\}\}/gi, "Manaswini Service Team");

  overlay.innerHTML = `
    <div style="background:#ffffff;border-radius:12px;max-width:680px;width:100%;max-height:90vh;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);display:flex;flex-direction:column;">
      <!-- Webmail Header -->
      <div style="background:#1e293b;color:#ffffff;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;">📧</span>
          <span style="font-weight:700;font-size:15px;">Webmail Live Preview — ${esc(template.template_name || 'Template')}</span>
        </div>
        <button class="btn btn-sm btn-outline-light closePrevModal" style="border-color:#475569;color:#ffffff;">&times;</button>
      </div>

      <!-- Mail Headers Box -->
      <div style="background:#f8fafc;padding:14px 20px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#334155;">
        <div style="margin-bottom:4px;"><strong>From:</strong> info@manageetha.in &lt;${demoCompName}&gt;</div>
        <div style="margin-bottom:4px;"><strong>To:</strong> ${demoEmail} (${demoCustName})</div>
        <div><strong>Subject:</strong> <span style="font-weight:700;color:#0f172a;">${esc(renderedSubject)}</span></div>
      </div>

      <!-- Rendered Body -->
      <div style="padding:24px;overflow-y:auto;flex:1;background:#ffffff;color:#1e293b;font-family:sans-serif;line-height:1.6;">
        ${renderedBody}
      </div>

      <!-- Footer -->
      <div style="padding:12px 20px;background:#f1f5f9;border-top:1px solid #e2e8f0;text-align:right;">
        <button class="btn btn-secondary closePrevModal">Close Preview</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelectorAll(".closePrevModal").forEach(b => b.addEventListener("click", () => overlay.remove()));
}

// ── SubTab 2: SMTP Server Settings & Profiles ──
async function loadSMTPSettingsSubTab() {
  const subContent = document.getElementById("mktSubContent");
  const userObj = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null) || JSON.parse(localStorage.getItem('erp_user') || '{}');
  const isSuperAdmin = userObj && (userObj.role === 'superadmin' || userObj.username === 'superadmin');
  const compId = isSuperAdmin ? (selectedCompanyId || 'all') : (userObj?.company_id || 'all');

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <div>
        <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">⚙️ SMTP Server Credentials & Email Profiles</h3>
        <p style="font-size:12px;color:var(--text3);margin:2px 0 0 0;">Configure custom SMTP settings for each company (superadmin) and individual users</p>
      </div>
      <button class="btn btn-primary" id="addSmtpBtn" style="font-weight:700;">+ Add SMTP Profile</button>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Profile Name</th>
            <th>Company / User Scope</th>
            <th>From Email</th>
            <th>From Name</th>
            <th>SMTP Host & Port</th>
            <th>Default</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="smtpTableBody">
          <tr><td colspan="7" style="text-align:center;padding:20px;"><div class="spinner"></div> Loading SMTP profiles...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  on("addSmtpBtn", "click", () => openSmtpModal());

  async function fetchSmtpProfiles() {
    try {
      const res = await fetch(`${API_BASE}/marketing?action=smtp-list&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success || !data.smtps) return;

      const tbody = document.getElementById("smtpTableBody");
      if (!tbody) return;

      if (data.smtps.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text3);">No SMTP profiles found. Click <strong>+ Add SMTP Profile</strong> to configure credentials.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.smtps.map(s => `
        <tr>
          <td><strong style="color:var(--text1);">${esc(s.profile_name)}</strong></td>
          <td>
            <div style="font-weight:600;">${esc(s.company_name || 'All Companies')}</div>
            ${s.user_name ? `<div style="font-size:11px;color:var(--primary);">User: ${esc(s.user_name)}</div>` : '<div style="font-size:11px;color:var(--text3);">Company-Wide</div>'}
          </td>
          <td><span class="badge badge-info" style="font-family:monospace;">${esc(s.from_email)}</span></td>
          <td>${esc(s.from_name || '—')}</td>
          <td style="font-family:monospace;font-size:12px;">${esc(s.smtp_host)}:${s.smtp_port} (${esc(s.smtp_secure || 'tls')})</td>
          <td>${s.is_default ? `<span class="badge badge-success">DEFAULT</span>` : '—'}</td>
          <td>
            <div style="display:flex;gap:4px;">
              <button class="btn btn-sm btn-outline-info testSmtpSingleBtn" data-id="${s.id}" title="Test Connection">⚡ Test</button>
              <button class="btn btn-sm btn-outline editSmtpBtn" data-smtp='${JSON.stringify(s).replace(/'/g, "&apos;")}' title="Edit Profile">✏️ Edit</button>
              <button class="btn btn-sm btn-outline-danger deleteSmtpBtn" data-id="${s.id}" title="Delete Profile">🗑️</button>
            </div>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll(".testSmtpSingleBtn").forEach(btn => {
        btn.addEventListener("click", async () => {
          setButtonLoading(btn, true, "Testing...");
          try {
            const res = await fetch(`${API_BASE}/marketing?action=smtp-test`, {
              method: "POST",
              headers: authHeaders(),
              body: JSON.stringify({ smtp_id: btn.dataset.id })
            });
            const d = await res.json();
            if (d.success) showToast(d.message, "success");
            else showToast(d.error, "error");
          } catch (e) {
            showToast("Test error: " + e.message, "error");
          } finally {
            setButtonLoading(btn, false);
          }
        });
      });

      tbody.querySelectorAll(".editSmtpBtn").forEach(btn => {
        btn.addEventListener("click", () => {
          const sObj = JSON.parse(btn.dataset.smtp);
          openSmtpModal(sObj);
        });
      });

      tbody.querySelectorAll(".deleteSmtpBtn").forEach(btn => {
        btn.addEventListener("click", async () => {
          if (!confirm("Are you sure you want to delete this SMTP profile?")) return;
          try {
            const dRes = await fetch(`${API_BASE}/marketing?action=smtp-delete&id=${btn.dataset.id}`, {
              method: "POST",
              headers: authHeaders()
            });
            const dData = await dRes.json();
            if (dData.success) {
              showToast(dData.message, "success");
              fetchSmtpProfiles();
            } else showToast(dData.error, "error");
          } catch (e) {
            showToast("Delete error: " + e.message, "error");
          }
        });
      });

    } catch (err) {
      showToast("Fetch SMTP profiles error: " + err.message, "error");
    }
  }

  fetchSmtpProfiles();
}

// ── Modal: Create/Edit SMTP Profile ──
async function openSmtpModal(editData = null) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:12px;overflow-y:auto;";

  const userObj = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null) || JSON.parse(localStorage.getItem('erp_user') || '{}');
  const isSuperAdmin = userObj && (userObj.role === 'superadmin' || userObj.username === 'superadmin');

  let companiesList = [];
  if (isSuperAdmin) {
    companiesList = (typeof currentCompanies !== 'undefined' && currentCompanies) ? currentCompanies : [];
  }

  const isEdit = !!editData;

  overlay.innerHTML = `
    <style>
      .smtp-modal-box {
        background: var(--bg-primary, #ffffff);
        border-radius: 12px;
        max-width: 580px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        padding: 24px;
        border: 1px solid var(--border, #e2e8f0);
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3);
        box-sizing: border-box;
      }
      .smtp-responsive-grid {
        display: grid;
        gap: 12px;
        margin-bottom: 12px;
      }
      .smtp-grid-2 {
        grid-template-columns: 1fr 1fr;
      }
      .smtp-grid-2-1 {
        grid-template-columns: 2fr 1fr;
      }
      @media (max-width: 576px) {
        .smtp-modal-box {
          padding: 16px;
          max-width: 95vw;
        }
        .smtp-responsive-grid {
          grid-template-columns: 1fr !important;
        }
        .smtp-footer-actions {
          flex-direction: column-reverse;
          align-items: stretch !important;
          gap: 10px !important;
        }
        .smtp-footer-actions > div {
          flex-direction: column-reverse;
          width: 100%;
        }
        .smtp-footer-actions button {
          width: 100%;
        }
      }
    </style>
    <div class="modal-content smtp-modal-box">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:16px;">
        <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">⚙️ ${isEdit ? 'Edit SMTP Configuration' : 'Setup New SMTP Configuration'}</h3>
        <button class="btn btn-sm btn-outline closeSmtpModal">&times;</button>
      </div>

      <form id="smtpConfigForm">
        ${isSuperAdmin ? `
        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-weight:700;color:var(--primary);">🏢 Select Company *</label>
          <select id="smCompanyId" class="form-select" required style="border-color:var(--primary);font-weight:600;">
            <option value="">-- Select Company --</option>
            ${companiesList.map(c => `<option value="${c.id}" ${(editData && editData.company_id === c.id) || (selectedCompanyId && parseInt(selectedCompanyId) === c.id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        ` : ''}

        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-weight:700;color:var(--primary);">⚡ Auto-Fill Provider Presets</label>
          <select id="smPreset" class="form-select" style="font-weight:600;border-color:var(--primary);">
            <option value="custom">-- Custom / Other Domain Mail Provider --</option>
            <option value="hostinger">🌐 Hostinger Mail (smtp.hostinger.com:465 SSL)</option>
            <option value="office365">🔷 Microsoft Office 365 / Outlook (smtp.office365.com:587 TLS)</option>
            <option value="godaddy">🟩 GoDaddy Mail (smtpout.secureserver.net:465 SSL)</option>
            <option value="gmail">🔴 Google Workspace / Gmail (smtp.gmail.com:465 SSL)</option>
            <option value="zoho">⚡ Zoho Mail (smtp.zoho.com:465 SSL)</option>
            <option value="cpanel">✉️ cPanel / Private Domain Mail (mail.yourdomain.com:465 SSL)</option>
          </select>
        </div>

        <div class="smtp-responsive-grid smtp-grid-2">
          <div class="form-group">
            <label class="form-label" style="font-weight:600;">Profile Label *</label>
            <input type="text" id="smProfileName" class="form-input" value="${esc(editData?.profile_name || 'Company Sales SMTP')}" required placeholder="e.g. Sales Department">
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight:600;">Scope / Access</label>
            <select id="smScope" class="form-select">
              <option value="company" ${!editData?.user_id ? 'selected' : ''}>Company-Wide (All Staff)</option>
              <option value="user" ${editData?.user_id ? 'selected' : ''}>User-Specific (Only My Account)</option>
            </select>
          </div>
        </div>

        <div class="smtp-responsive-grid smtp-grid-2-1">
          <div class="form-group">
            <label class="form-label" style="font-weight:600;">SMTP Host / Server *</label>
            <input type="text" id="smHost" class="form-input" value="${esc(editData?.smtp_host || 'smtp.gmail.com')}" required placeholder="e.g. smtp.hostinger.com / smtp.office365.com">
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight:600;">Port *</label>
            <input type="number" id="smPort" class="form-input" value="${editData?.smtp_port || 587}" required>
          </div>
        </div>

        <div class="smtp-responsive-grid smtp-grid-2">
          <div class="form-group">
            <label class="form-label" style="font-weight:600;">Security Encryption</label>
            <select id="smSecure" class="form-select">
              <option value="tls" ${editData?.smtp_secure === 'tls' || !editData ? 'selected' : ''}>TLS / STARTTLS (Port 587/25)</option>
              <option value="ssl" ${editData?.smtp_secure === 'ssl' ? 'selected' : ''}>SSL / TLS (Port 465)</option>
              <option value="none" ${editData?.smtp_secure === 'none' ? 'selected' : ''}>None (Unencrypted)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight:600;">From Sender Name</label>
            <input type="text" id="smFromName" class="form-input" value="${esc(editData?.from_name || 'Manaswini Enterprises')}" placeholder="Company / Sender Name">
          </div>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-weight:600;">From Email Address *</label>
          <input type="email" id="smFromEmail" class="form-input" value="${esc(editData?.from_email || '')}" required placeholder="info@manageetha.in">
        </div>

        <div class="smtp-responsive-grid smtp-grid-2">
          <div class="form-group">
            <label class="form-label" style="font-weight:600;">SMTP Username / Email</label>
            <input type="text" id="smUser" class="form-input" value="${esc(editData?.smtp_user || editData?.from_email || '')}" placeholder="info@manageetha.in">
            <small style="color:var(--text-muted, #64748b);display:block;font-size:11px;margin-top:3px;">(Usually full email address for Hostinger, O365, GoDaddy)</small>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight:600;">SMTP Password / App Password</label>
            <div style="position:relative;display:flex;align-items:center;">
              <input type="password" id="smPassword" class="form-input" value="${esc(editData?.smtp_password || '')}" placeholder="Enter SMTP password / App Password" style="padding-right:38px;width:100%;">
              <button type="button" id="toggleSmPassBtn" style="position:absolute;right:8px;background:none;border:none;cursor:pointer;font-size:16px;color:var(--text-muted, #64748b);padding:4px;" title="Show/Hide Password">👁️</button>
            </div>
          </div>
        </div>

        <div class="form-group" style="background:var(--bg-secondary);padding:10px 12px;border-radius:6px;border:1px solid var(--border);margin-bottom:16px;">
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--text1);cursor:pointer;margin:0;">
            <input type="checkbox" id="smIsDefault" ${editData?.is_default ? 'checked' : ''} style="accent-color:var(--primary);">
            Set as Default SMTP profile for this company
          </label>
        </div>

        <div class="smtp-footer-actions" style="display:flex;justify-content:space-between;align-items:center;">
          <button type="button" class="btn btn-outline-info" id="smTestFormBtn" style="font-weight:600;">⚡ Test Connection</button>
          <div style="display:flex;gap:8px;">
            <button type="button" class="btn btn-secondary closeSmtpModal">Cancel</button>
            <button type="submit" id="smSubmitBtn" class="btn btn-primary" style="font-weight:700;">Save Credentials</button>
          </div>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelectorAll(".closeSmtpModal").forEach(b => b.addEventListener("click", () => overlay.remove()));

  // Password Visibility Toggle Button logic
  const smPassInput = overlay.querySelector("#smPassword");
  const toggleSmPassBtn = overlay.querySelector("#toggleSmPassBtn");
  if (toggleSmPassBtn && smPassInput) {
    toggleSmPassBtn.addEventListener("click", () => {
      if (smPassInput.type === "password") {
        smPassInput.type = "text";
        toggleSmPassBtn.textContent = "🙈";
        toggleSmPassBtn.title = "Hide Password";
      } else {
        smPassInput.type = "password";
        toggleSmPassBtn.textContent = "👁️";
        toggleSmPassBtn.title = "Show Password";
      }
    });
  }

  // Auto-sync Username with From Email
  const smFromEmailEl = overlay.querySelector("#smFromEmail");
  const smUserEl = overlay.querySelector("#smUser");
  if (smFromEmailEl && smUserEl) {
    smFromEmailEl.addEventListener("input", () => {
      if (!smUserEl.value || !smUserEl.value.includes("@") || smUserEl.dataset.autoFilled === "true") {
        smUserEl.value = smFromEmailEl.value.trim();
        smUserEl.dataset.autoFilled = "true";
      }
    });
    smUserEl.addEventListener("input", () => {
      smUserEl.dataset.autoFilled = "false";
    });
  }

  // Auto-fill provider presets on select change
  overlay.querySelector("#smPreset")?.addEventListener("change", (e) => {
    const p = e.target.value;
    const h = overlay.querySelector("#smHost");
    const port = overlay.querySelector("#smPort");
    const sec = overlay.querySelector("#smSecure");

    if (p === "hostinger") {
      h.value = "smtp.hostinger.com";
      port.value = 465;
      sec.value = "ssl";
    } else if (p === "office365") {
      h.value = "smtp.office365.com";
      port.value = 587;
      sec.value = "tls";
    } else if (p === "godaddy") {
      h.value = "smtpout.secureserver.net";
      port.value = 465;
      sec.value = "ssl";
    } else if (p === "gmail") {
      h.value = "smtp.gmail.com";
      port.value = 465;
      sec.value = "ssl";
    } else if (p === "zoho") {
      h.value = "smtp.zoho.com";
      port.value = 465;
      sec.value = "ssl";
    } else if (p === "cpanel") {
      h.value = "mail.yourdomain.com";
      port.value = 465;
      sec.value = "ssl";
    }
  });

  // Test connection button inside modal
  overlay.querySelector("#smTestFormBtn").addEventListener("click", async () => {
    const btn = overlay.querySelector("#smTestFormBtn");
    setButtonLoading(btn, true, "Testing...");

    let testUser = overlay.querySelector("#smUser").value.trim();
    const fromEmailVal = overlay.querySelector("#smFromEmail").value.trim();
    if ((!testUser || !testUser.includes("@")) && fromEmailVal.includes("@")) {
      testUser = fromEmailVal;
      overlay.querySelector("#smUser").value = testUser;
    }

    const testPayload = {
      smtp_host: overlay.querySelector("#smHost").value.trim(),
      smtp_port: overlay.querySelector("#smPort").value,
      smtp_secure: overlay.querySelector("#smSecure").value,
      smtp_user: testUser,
      smtp_password: overlay.querySelector("#smPassword").value || editData?.smtp_password || "",
      from_email: fromEmailVal
    };

    try {
      const res = await fetch(`${API_BASE}/marketing?action=smtp-test`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(testPayload)
      });
      const data = await res.json();
      if (data.success) showToast(data.message, "success");
      else showToast(data.error, "error");
    } catch (e) {
      showToast("Test connection error: " + e.message, "error");
    } finally {
      setButtonLoading(btn, false);
    }
  });

  // Submit SMTP form
  overlay.querySelector("#smtpConfigForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = overlay.querySelector("#smSubmitBtn");
    setButtonLoading(btn, true, "Saving...");

    let resolvedCompanyId;
    if (isSuperAdmin) {
      const compSel = overlay.querySelector("#smCompanyId");
      resolvedCompanyId = compSel ? parseInt(compSel.value) : null;
      if (!resolvedCompanyId) {
        showToast("Please select a company", "error");
        setButtonLoading(btn, false);
        return;
      }
    } else {
      resolvedCompanyId = userObj?.company_id;
    }

    let saveUser = overlay.querySelector("#smUser").value.trim();
    const fromEmailVal = overlay.querySelector("#smFromEmail").value.trim();
    if ((!saveUser || !saveUser.includes("@")) && fromEmailVal.includes("@")) {
      saveUser = fromEmailVal;
      overlay.querySelector("#smUser").value = saveUser;
    }

    const payload = {
      id: editData?.id || null,
      company_id: resolvedCompanyId,
      scope_type: overlay.querySelector("#smScope").value,
      profile_name: overlay.querySelector("#smProfileName").value.trim(),
      smtp_host: overlay.querySelector("#smHost").value.trim(),
      smtp_port: overlay.querySelector("#smPort").value,
      smtp_secure: overlay.querySelector("#smSecure").value,
      from_name: overlay.querySelector("#smFromName").value.trim(),
      from_email: fromEmailVal,
      smtp_user: saveUser,
      smtp_password: overlay.querySelector("#smPassword").value || editData?.smtp_password || "",
      is_default: overlay.querySelector("#smIsDefault").checked
    };

    try {
      const res = await fetch(`${API_BASE}/marketing?action=smtp-save`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "success");
        overlay.remove();
        loadSMTPSettingsSubTab();
      } else showToast(data.error, "error");
    } catch (err) {
      showToast("Error saving SMTP: " + err.message, "error");
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

// ── SubTab 3: Sent Email Logs ──
async function loadSentEmailLogsSubTab() {
  const subContent = document.getElementById("mktSubContent");
  const userObj = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null) || JSON.parse(localStorage.getItem('erp_user') || '{}');
  const isSuperAdmin = userObj && (userObj.role === 'superadmin' || userObj.username === 'superadmin');
  const compId = isSuperAdmin ? (selectedCompanyId || 'all') : (userObj?.company_id || 'all');

  subContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h3 style="font-size:16px;font-weight:700;color:var(--text1);margin:0;">📜 Sent Email Delivery Audit Logs</h3>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Time & Date</th>
            <th>From Email</th>
            <th>To Recipient</th>
            <th>Subject</th>
            <th>Status</th>
            <th>Sender User</th>
          </tr>
        </thead>
        <tbody id="emailLogsTableBody">
          <tr><td colspan="6" style="text-align:center;padding:20px;"><div class="spinner"></div> Loading email logs...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  async function fetchLogs() {
    try {
      const res = await fetch(`${API_BASE}/marketing?action=email-logs&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success || !data.logs) return;

      const tbody = document.getElementById("emailLogsTableBody");
      if (!tbody) return;

      if (data.logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3);">No email delivery logs found.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.logs.map(l => `
        <tr>
          <td style="font-size:12px;">${l.created_at ? new Date(l.created_at).toLocaleString('en-IN') : '—'}</td>
          <td style="font-family:monospace;font-size:12px;">${esc(l.from_email)}</td>
          <td><strong style="color:var(--primary);">${esc(l.to_email)}</strong></td>
          <td style="font-weight:600;color:var(--text1);">${esc(l.subject)}</td>
          <td>
            ${l.status === 'sent' 
              ? `<span class="badge badge-success">DELIVERED ✅</span>` 
              : `<span class="badge badge-danger" title="${esc(l.error_message || '')}">FAILED ❌</span>`}
          </td>
          <td style="font-size:12px;">${esc(l.sent_by_name || 'Admin')}</td>
        </tr>
      `).join('');

    } catch (err) {
      showToast("Fetch logs error: " + err.message, "error");
    }
  }

  fetchLogs();
}

// ── SubTab 4: DLT SMS Broadcasts ──
async function loadSMSSubTab() {
  const subContent = document.getElementById("mktSubContent");
  const compId = selectedCompanyId || "all";

  subContent.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div class="card" style="background:var(--bg-primary);">
        <h3 style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:12px;">📱 Send Airtel / Jio DLT Approved SMS</h3>
        <form id="smsSendForm">
          <div class="form-group">
            <label class="form-label">Recipient Phone Number *</label>
            <input type="text" id="smsPhone" class="form-input" required placeholder="+91 9876543210">
          </div>
          <div class="form-group">
            <label class="form-label">DLT Header / Sender ID</label>
            <input type="text" id="smsSender" class="form-input" value="INDERP" readonly>
          </div>
          <div class="form-group">
            <label class="form-label">DLT Approved Template</label>
            <select id="smsTpl" class="form-select">
              <option value="1">Payment Thanks: Dear {#var#}, thank you for your payment of Rs.{#var#}.</option>
              <option value="2">Service Ready: Dear {#var#}, your service job #{#var#} is completed.</option>
              <option value="3">Festive Offer: Dear customer, visit our store for 20% discount!</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;margin-top:12px;">🚀 Broadcast DLT SMS</button>
        </form>
      </div>

      <div>
        <h3 style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:12px;">SMS Broadcast Logs</h3>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody id="smsLogsTableBody">
              <tr><td colspan="3" style="text-align:center;padding:20px;"><div class="spinner"></div> Fetching logs...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  async function fetchSmsLogs() {
    try {
      const res = await fetch(`${API_BASE}/marketing?action=sms-logs&company_id=${compId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.success) return;

      const tbody = document.getElementById("smsLogsTableBody");
      if (!tbody) return;
      if (data.logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text3);">No SMS logs.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.logs.map(l => `
        <tr>
          <td style="font-weight:600;color:var(--text1);">${esc(l.phone)}</td>
          <td><span class="badge badge-success">DELIVERED ✅</span></td>
          <td>${l.created_at ? new Date(l.created_at).toLocaleString('en-IN') : '—'}</td>
        </tr>
      `).join("");

    } catch (err) {
      showToast("Fetch SMS logs error: " + err.message, "error");
    }
  }

  on("smsSendForm", "submit", async (e) => {
    e.preventDefault();
    const payload = {
      company_id: currentCompanies[0]?.id || 1,
      recipient_phone: document.getElementById("smsPhone").value.trim(),
    };

    try {
      const res = await fetch(`${API_BASE}/marketing?action=sms-send`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "success");
        fetchSmsLogs();
      } else showToast(data.error, "error");
    } catch (err) {
      showToast("Error: " + err.message, "error");
    }
  });

  fetchSmsLogs();
}
