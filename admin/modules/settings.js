// ═══════════════════════════════════════════════════════════════
// SETTINGS & PROFILE MODULE — Multi-Tenant Business ERP
// Accessible by all users for profile & Email OTP password reset
// Superadmin has additional tab to manage all user profiles
// ═══════════════════════════════════════════════════════════════

let settingsUserProfile = null;
let settingsEmailConfig = null;
let settingsAllUsers = [];
let otpCooldownTimer = null;
let otpCooldownSeconds = 0;

async function renderSettingsModule(tabKey, container) {
  const isSuperadmin = currentUser && currentUser.role === "superadmin";

  container.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:20px;">
      <div style="background:linear-gradient(135deg, var(--primary) 0%, #1e40af 100%);color:#fff;padding:20px 24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <h2 style="margin:0;font-size:20px;font-weight:800;display:flex;align-items:center;gap:10px;color:#fff;">
              <span>⚙️</span> Settings & User Profile
            </h2>
            <div style="font-size:12.5px;opacity:0.9;margin-top:4px;">
              Manage your personal profile details, account security, and Email OTP password authentication.
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="badge" style="background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.3);font-size:11.5px;padding:4px 10px;">
              Role: <strong>${esc(currentUser.role ? currentUser.role.replace(/_/g, ' ').toUpperCase() : 'USER')}</strong>
            </span>
            <span class="badge" style="background:#22c55e;color:#fff;font-size:11px;padding:4px 8px;">
              ● Online
            </span>
          </div>
        </div>
      </div>

      <!-- SUB-TABS -->
      <div class="sub-tabs-bar" style="margin:0;padding:10px 18px 0;background:var(--bg-secondary);border-bottom:1px solid var(--border);">
        <button class="sub-tab active" data-subtab="profileTab">
          👤 My Profile
        </button>
        <button class="sub-tab" data-subtab="securityTab">
          🔐 Security & Password Reset (Email OTP)
        </button>
        ${isSuperadmin ? `
        <button class="sub-tab" data-subtab="manageUsersTab">
          👥 Manage User Profiles (Superadmin)
        </button>
        ` : ''}
      </div>

      <!-- SUB-CONTENT AREA -->
      <div class="sub-content-area" id="settingsSubContent" style="padding:22px;">
        <div style="text-align:center;padding:40px;"><div class="spinner"></div> Loading settings...</div>
      </div>
    </div>
  `;

  // Attach subtab click handlers
  container.querySelectorAll(".sub-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      container.querySelectorAll(".sub-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.subtab;
      if (target === "profileTab") loadProfileSubTab();
      else if (target === "securityTab") loadSecuritySubTab();
      else if (target === "manageUsersTab" && isSuperadmin) loadManageUsersSubTab();
    });
  });

  // Default to profile subtab
  await fetchUserProfileData();
  loadProfileSubTab();
}

async function fetchUserProfileData() {
  try {
    const res = await fetch(`${API_BASE}/auth?action=get-profile`, {
      headers: authHeaders()
    });
    const data = await res.json();
    if (data.success) {
      settingsUserProfile = data.user;
      settingsEmailConfig = data.email_config;
    } else {
      showToast(data.error || "Failed to load user profile", "error");
    }
  } catch (err) {
    showToast("Profile load error: " + err.message, "error");
  }
}

// ═══════════════════════════════════════════════════════════════
// SUBTAB 1: MY PROFILE
// ═══════════════════════════════════════════════════════════════

function loadProfileSubTab() {
  const container = document.getElementById("settingsSubContent");
  if (!container) return;

  const u = settingsUserProfile || currentUser;
  const displayName = u.full_name || u.username || "User";
  const initials = displayName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "U";
  const roleName = (u.role || "").replace(/_/g, " ").toUpperCase();
  const compName = u.company_name || (u.role === "superadmin" ? "All Companies (Super Administrator)" : "Business ERP");

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:300px 1fr;gap:24px;align-items:start;">
      <!-- LEFT: Profile Card -->
      <div class="card" style="padding:24px;text-align:center;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;">
        <div style="width:84px;height:84px;border-radius:50%;background:linear-gradient(135deg, var(--primary), #4f46e5);color:#fff;font-size:32px;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;box-shadow:0 4px 10px rgba(0,0,0,0.15);">
          ${esc(initials)}
        </div>
        <h3 style="margin:0 0 4px 0;font-size:17px;font-weight:800;color:var(--text1);">${esc(displayName)}</h3>
        <div style="font-size:12.5px;color:var(--text2);margin-bottom:12px;">@${esc(u.username)}</div>
        <span class="badge badge-primary" style="font-size:11.5px;padding:4px 12px;font-weight:700;letter-spacing:0.4px;">
          ${esc(roleName)}
        </span>

        <div style="border-top:1px solid var(--border);margin-top:18px;padding-top:16px;text-align:left;font-size:12.5px;line-height:1.7;">
          <div style="color:var(--text3);font-size:11px;text-transform:uppercase;font-weight:700;margin-bottom:2px;">Company / Branch</div>
          <div style="font-weight:600;color:var(--text1);">${esc(compName)}</div>

          <div style="color:var(--text3);font-size:11px;text-transform:uppercase;font-weight:700;margin-top:12px;margin-bottom:2px;">Email Registered</div>
          <div style="font-weight:600;color:var(--text1);">${u.email ? esc(u.email) : '<span style="color:#dc2626;">⚠️ No email configured</span>'}</div>

          <div style="color:var(--text3);font-size:11px;text-transform:uppercase;font-weight:700;margin-top:12px;margin-bottom:2px;">Phone</div>
          <div style="font-weight:600;color:var(--text1);">${esc(u.phone || '—')}</div>

          <div style="color:var(--text3);font-size:11px;text-transform:uppercase;font-weight:700;margin-top:12px;margin-bottom:2px;">Member Since</div>
          <div style="color:var(--text2);font-size:12px;">${u.created_at ? formatDate(u.created_at) : 'Active User'}</div>
        </div>

        <button type="button" class="btn btn-outline btn-sm" id="btnGoToPasswordReset" style="width:100%;margin-top:20px;display:flex;align-items:center;justify-content:center;gap:6px;">
          <span>🔐</span> Change Password with OTP
        </button>
      </div>

      <!-- RIGHT: Profile Edit Form -->
      <div class="card" style="padding:24px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;">
        <div style="border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:20px;">
          <h4 style="margin:0;font-size:15px;font-weight:700;color:var(--text1);">✏️ Edit Profile Details</h4>
          <div style="font-size:12px;color:var(--text3);margin-top:2px;">Update your personal contact details, email address, and notification preferences.</div>
        </div>

        <form id="profileUpdateForm">
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:4px;">Full Name *</label>
              <input type="text" id="profFullName" class="form-input" required value="${esc(u.full_name || '')}" placeholder="e.g. Sairam V">
            </div>

            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:4px;">Username / Login ID</label>
              <div style="position:relative;">
                <input type="text" id="profUsername" class="form-input" value="${esc(u.username || '')}" readonly style="background:var(--bg-secondary);cursor:not-allowed;" title="Login username is locked">
                <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:12px;color:var(--text3);">🔒</span>
              </div>
            </div>

            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:4px;">
                Email Address * 
                <span style="font-size:11px;color:var(--primary);font-weight:normal;">(For OTP password reset)</span>
              </label>
              <input type="email" id="profEmail" class="form-input" required value="${esc(u.email || '')}" placeholder="e.g. user@manageetha.in">
              <div style="font-size:11px;color:var(--text3);margin-top:3px;">Password reset verification codes will be sent to this email.</div>
            </div>

            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:4px;">Phone Number</label>
              <input type="tel" id="profPhone" class="form-input" value="${esc(u.phone || '')}" placeholder="e.g. 9876543210">
            </div>

            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:4px;">System Role</label>
              <input type="text" class="form-input" value="${esc(roleName)}" readonly style="background:var(--bg-secondary);cursor:not-allowed;">
            </div>

            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:4px;">Assigned Company / Entity</label>
              <input type="text" class="form-input" value="${esc(compName)}" readonly style="background:var(--bg-secondary);cursor:not-allowed;">
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:12px;border-top:1px solid var(--border);padding-top:16px;margin-top:16px;">
            <button type="submit" class="btn btn-primary" id="btnSaveProfile" style="padding:8px 22px;font-size:13px;font-weight:700;">
              💾 Save Profile Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Go to security tab button
  document.getElementById("btnGoToPasswordReset")?.addEventListener("click", () => {
    const secTab = document.querySelector(`.sub-tab[data-subtab="securityTab"]`);
    if (secTab) secTab.click();
  });

  // Save profile submit
  document.getElementById("profileUpdateForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnSaveProfile");
    if (btn && btn.disabled) return;
    const origHtml = btn ? btn.innerHTML : "Save";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving...`;
    }

    const payload = {
      full_name: document.getElementById("profFullName")?.value.trim(),
      email: document.getElementById("profEmail")?.value.trim(),
      phone: document.getElementById("profPhone")?.value.trim()
    };

    try {
      const res = await fetch(`${API_BASE}/auth?action=update-profile`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Profile updated successfully!", "success");
        if (settingsUserProfile) {
          settingsUserProfile.full_name = payload.full_name;
          settingsUserProfile.email = payload.email;
          settingsUserProfile.phone = payload.phone;
        }
        if (currentUser) {
          currentUser.full_name = payload.full_name;
          currentUser.email = payload.email;
          currentUser.phone = payload.phone;
          const nameEl = document.getElementById("userName");
          if (nameEl) nameEl.textContent = payload.full_name || currentUser.username;
          localStorage.setItem("erp_user", JSON.stringify(currentUser));
        }
        loadProfileSubTab();
      } else {
        showToast(data.error || "Failed to update profile", "error");
      }
    } catch (err) {
      showToast("Error updating profile: " + err.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// SUBTAB 2: SECURITY & EMAIL OTP PASSWORD RESET
// ═══════════════════════════════════════════════════════════════

function loadSecuritySubTab() {
  const container = document.getElementById("settingsSubContent");
  if (!container) return;

  const u = settingsUserProfile || currentUser;
  const cfg = settingsEmailConfig || {};
  const hasEmail = Boolean(u.email && u.email.trim());
  const hasSmtp = Boolean(cfg.has_smtp);

  container.innerHTML = `
    <div style="max-width:800px;margin:0 auto;">
      <!-- SECURITY NOTICE CARD -->
      <div class="card" style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:18px 22px;margin-bottom:20px;">
        <div style="display:flex;align-items:flex-start;gap:14px;">
          <div style="font-size:26px;">🛡️</div>
          <div style="flex:1;">
            <h4 style="margin:0 0 4px 0;font-size:14.5px;font-weight:700;color:var(--text1);">Two-Factor Verified Password Reset</h4>
            <div style="font-size:12.5px;color:var(--text2);line-height:1.5;">
              To protect your business account, password resets require email authentication. An authorized 6-digit One-Time Password (OTP) will be sent through your company's secure outgoing mail server (SMTP) to your registered email address.
            </div>
            <div style="display:flex;gap:16px;margin-top:10px;font-size:12px;flex-wrap:wrap;">
              <div>
                <span style="color:var(--text3);">Registered Email:</span> 
                <strong>${hasEmail ? esc(u.email) : '<span style="color:#dc2626;">Not Set (Required)</span>'}</strong>
              </div>
              <div>
                <span style="color:var(--text3);">Company Mail Server:</span> 
                <strong>${hasSmtp ? `<span style="color:#16a34a;">🟢 Connected (${esc(cfg.smtp_host || 'SMTP')})</span>` : '<span style="color:#eab308;">⚠️ Pending SMTP Setup</span>'}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      ${!hasEmail ? `
      <div style="background:#fef2f2;border:1px solid #fecaca;padding:14px 18px;border-radius:8px;color:#991b1b;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div style="font-size:12.5px;">
          ⚠️ <strong>Email Required:</strong> You haven't added an email address to your profile yet. Please set your email in the <strong>My Profile</strong> tab first to receive verification OTPs.
        </div>
        <button type="button" class="btn btn-sm btn-primary" id="btnGoSetEmail" style="white-space:nowrap;">Go to My Profile</button>
      </div>
      ` : ''}

      <!-- STEP 1: REQUEST OTP -->
      <div class="card" style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:22px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-size:11.5px;font-weight:800;color:var(--primary);text-transform:uppercase;letter-spacing:0.8px;">Step 1</div>
            <h4 style="margin:2px 0 0 0;font-size:15px;font-weight:700;color:var(--text1);">Request Verification OTP Code</h4>
            <div style="font-size:12px;color:var(--text3);margin-top:2px;">
              Click the button to receive an instant 6-digit authentication code to <strong>${hasEmail ? esc(u.email) : 'your email'}</strong>.
            </div>
          </div>
          <button type="button" class="btn btn-primary" id="btnRequestOtp" ${!hasEmail ? 'disabled' : ''} style="padding:9px 20px;font-weight:700;font-size:13px;display:inline-flex;align-items:center;gap:6px;">
            <span>📩</span> <span id="btnRequestOtpText">Send Verification OTP</span>
          </button>
        </div>

        <div id="otpStatusBanner" style="display:none;margin-top:14px;padding:10px 14px;border-radius:6px;font-size:12.5px;"></div>
      </div>

      <!-- STEP 2: VERIFY OTP & RESET WITH 2-TIME CONFIRMATION -->
      <div class="card" id="step2ResetCard" style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:22px;opacity:0.9;">
        <div style="border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:18px;">
          <div style="font-size:11.5px;font-weight:800;color:var(--primary);text-transform:uppercase;letter-spacing:0.8px;">Step 2</div>
          <h4 style="margin:2px 0 0 0;font-size:15px;font-weight:700;color:var(--text1);">Enter OTP & Confirm New Password</h4>
          <div style="font-size:12px;color:var(--text3);margin-top:2px;">
            Enter the 6-digit verification code sent to your email and your new password with two-time confirmation.
          </div>
        </div>

        <form id="resetPasswordOtpForm">
          <div class="form-group" style="margin-bottom:18px;">
            <label class="form-label" style="font-size:12.5px;font-weight:700;margin-bottom:6px;display:block;">
              ENTER 6-DIGIT EMAIL OTP *
            </label>
            <div style="max-width:260px;">
              <input type="text" id="setOtpCode" class="form-input" maxlength="6" required placeholder="• • • • • •" autocomplete="one-time-code" style="font-size:24px;letter-spacing:8px;text-align:center;font-weight:800;font-family:monospace;padding:8px 12px;border:2px solid var(--border);">
            </div>
            <div style="font-size:11px;color:var(--text3);margin-top:4px;">Valid for 10 minutes from request time.</div>
          </div>

          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:4px;">New Password *</label>
              <div style="position:relative;">
                <input type="password" id="setNewPassword" class="form-input" required minlength="6" placeholder="At least 6 characters" style="padding-right:38px;">
                <button type="button" class="btnTogglePass" data-target="setNewPassword" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:14px;color:var(--text3);">👁️</button>
              </div>
            </div>

            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:4px;">Confirm New Password (2nd Time) *</label>
              <div style="position:relative;">
                <input type="password" id="setConfirmPassword" class="form-input" required minlength="6" placeholder="Re-type new password" style="padding-right:38px;">
                <button type="button" class="btnTogglePass" data-target="setConfirmPassword" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:14px;color:var(--text3);">👁️</button>
              </div>
            </div>
          </div>

          <!-- Real-time match visual indicator -->
          <div id="passMatchIndicator" style="font-size:12px;font-weight:700;margin-bottom:18px;min-height:18px;"></div>

          <div style="display:flex;justify-content:flex-end;border-top:1px solid var(--border);padding-top:16px;">
            <button type="submit" class="btn btn-success" id="btnSubmitResetPassword" style="padding:9px 24px;font-size:13.5px;font-weight:800;display:inline-flex;align-items:center;gap:6px;">
              <span>🔒</span> Verify OTP & Reset Password
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Go to profile button
  document.getElementById("btnGoSetEmail")?.addEventListener("click", () => {
    const profTab = document.querySelector(`.sub-tab[data-subtab="profileTab"]`);
    if (profTab) profTab.click();
  });

  // Toggle password visibility
  container.querySelectorAll(".btnTogglePass").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const inp = document.getElementById(targetId);
      if (inp) {
        if (inp.type === "password") {
          inp.type = "text";
          btn.textContent = "🙈";
        } else {
          inp.type = "password";
          btn.textContent = "👁️";
        }
      }
    });
  });

  // Password confirmation real-time validator
  const p1 = document.getElementById("setNewPassword");
  const p2 = document.getElementById("setConfirmPassword");
  const matchInd = document.getElementById("passMatchIndicator");

  function checkPasswordMatch() {
    if (!matchInd) return;
    const v1 = p1?.value || "";
    const v2 = p2?.value || "";

    if (!v1 && !v2) {
      matchInd.innerHTML = "";
      return;
    }

    if (v1 && v1.length < 6) {
      matchInd.innerHTML = `<span style="color:#dc2626;">⚠️ Password must be at least 6 characters long.</span>`;
      return;
    }

    if (v2.length > 0) {
      if (v1 === v2) {
        matchInd.innerHTML = `<span style="color:#16a34a;">✓ Passwords match perfectly!</span>`;
      } else {
        matchInd.innerHTML = `<span style="color:#dc2626;">✗ Passwords do not match. Please ensure both fields are identical.</span>`;
      }
    } else {
      matchInd.innerHTML = "";
    }
  }

  p1?.addEventListener("input", checkPasswordMatch);
  p2?.addEventListener("input", checkPasswordMatch);

  // Send OTP Button
  const btnRequest = document.getElementById("btnRequestOtp");
  btnRequest?.addEventListener("click", async () => {
    if (btnRequest.disabled) return;
    btnRequest.disabled = true;
    btnRequest.style.pointerEvents = "none";
    btnRequest.style.opacity = "0.75";
    btnRequest.innerHTML = `<span class="btn-spinner-inline" style="display:inline-block;width:13px;height:13px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;margin-right:6px;vertical-align:middle;"></span> Sending OTP...`;

    const statusBanner = document.getElementById("otpStatusBanner");

    try {
      const res = await fetch(`${API_BASE}/auth?action=send-otp`, {
        method: "POST",
        headers: authHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "OTP sent successfully to your email!", "success");
        if (statusBanner) {
          statusBanner.style.display = "block";
          statusBanner.style.background = "#dcfce7";
          statusBanner.style.border = "1px solid #86efac";
          statusBanner.style.color = "#166534";
          statusBanner.innerHTML = `<strong>✅ Verification Code Dispatched:</strong> An email containing your 6-digit OTP has been sent to <strong>${data.masked_email || 'your email'}</strong>. Please check your inbox or spam folder.`;
        }
        // Focus OTP input
        const otpInp = document.getElementById("setOtpCode");
        if (otpInp) {
          otpInp.focus();
          otpInp.style.borderColor = "var(--primary)";
        }
        startOtpCooldown(60);
      } else {
        showToast(data.error || "Failed to send OTP", "error");
        if (statusBanner) {
          statusBanner.style.display = "block";
          statusBanner.style.background = "#fef2f2";
          statusBanner.style.border = "1px solid #fecaca";
          statusBanner.style.color = "#991b1b";
          statusBanner.innerHTML = `<strong>❌ Error:</strong> ${esc(data.error || "Failed to dispatch OTP email.")}`;
        }
        btnRequest.disabled = false;
        btnRequest.style.pointerEvents = "";
        btnRequest.style.opacity = "";
        btnRequest.innerHTML = `<span>📩</span> <span id="btnRequestOtpText">Send Verification OTP</span>`;
      }
    } catch (err) {
      showToast("Error requesting OTP: " + err.message, "error");
      btnRequest.disabled = false;
      btnRequest.style.pointerEvents = "";
      btnRequest.style.opacity = "";
      btnRequest.innerHTML = `<span>📩</span> <span id="btnRequestOtpText">Send Verification OTP</span>`;
    }
  });

  // Verify OTP and Reset Form
  document.getElementById("resetPasswordOtpForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnSubmitResetPassword");
    if (btn && btn.disabled) return;

    const otpVal = document.getElementById("setOtpCode")?.value.trim();
    const newPass = document.getElementById("setNewPassword")?.value;
    const confirmPass = document.getElementById("setConfirmPassword")?.value;

    if (!otpVal || otpVal.length !== 6) {
      return showToast("Please enter the complete 6-digit OTP code.", "error");
    }

    if (!newPass || newPass.length < 6) {
      return showToast("New password must be at least 6 characters.", "error");
    }

    if (newPass !== confirmPass) {
      return showToast("New password and confirm password do not match.", "error");
    }

    const origHtml = btn ? btn.innerHTML : "Reset Password";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Verifying & Resetting...`;
    }

    try {
      const res = await fetch(`${API_BASE}/auth?action=reset-password-otp`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          otp_code: otpVal,
          new_password: newPass,
          confirm_password: confirmPass
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Password successfully reset! You can now use your new password.", "success");
        // Reset form
        document.getElementById("resetPasswordOtpForm")?.reset();
        if (matchInd) matchInd.innerHTML = "";
        const statusBanner = document.getElementById("otpStatusBanner");
        if (statusBanner) {
          statusBanner.style.display = "block";
          statusBanner.style.background = "#dcfce7";
          statusBanner.style.border = "1px solid #86efac";
          statusBanner.style.color = "#166534";
          statusBanner.innerHTML = `<strong>🎉 Success:</strong> Your password has been successfully updated! You can use it on your next login.`;
        }
      } else {
        showToast(data.error || "Failed to reset password", "error");
      }
    } catch (err) {
      showToast("Error resetting password: " + err.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  });

  if (otpCooldownSeconds > 0) {
    startOtpCooldown(otpCooldownSeconds);
  }
}

function startOtpCooldown(seconds) {
  if (otpCooldownTimer) {
    clearInterval(otpCooldownTimer);
    otpCooldownTimer = null;
  }
  otpCooldownSeconds = seconds;

  const btn = document.getElementById("btnRequestOtp");
  if (!btn) return;

  btn.disabled = true;
  btn.style.pointerEvents = "none";
  btn.style.opacity = "0.75";
  btn.style.cursor = "not-allowed";

  const renderTimerText = (sec) => {
    btn.innerHTML = `<span>⏱️</span> <span id="btnRequestOtpText">Resend OTP in ${sec}s</span>`;
  };

  renderTimerText(otpCooldownSeconds);

  otpCooldownTimer = setInterval(() => {
    otpCooldownSeconds--;
    const curBtn = document.getElementById("btnRequestOtp");
    if (!curBtn) {
      if (otpCooldownSeconds <= 0) {
        clearInterval(otpCooldownTimer);
        otpCooldownTimer = null;
      }
      return;
    }

    if (otpCooldownSeconds > 0) {
      renderTimerText(otpCooldownSeconds);
    } else {
      clearInterval(otpCooldownTimer);
      otpCooldownTimer = null;
      curBtn.disabled = false;
      curBtn.style.pointerEvents = "";
      curBtn.style.opacity = "";
      curBtn.style.cursor = "pointer";
      curBtn.innerHTML = `<span>📩</span> <span id="btnRequestOtpText">Resend Verification OTP</span>`;
    }
  }, 1000);
}

// ═══════════════════════════════════════════════════════════════
// SUBTAB 3: SUPERADMIN — MANAGE USER PROFILES
// ═══════════════════════════════════════════════════════════════

async function loadManageUsersSubTab() {
  const container = document.getElementById("settingsSubContent");
  if (!container) return;

  container.innerHTML = `
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
        <div>
          <h4 style="margin:0;font-size:16px;font-weight:800;color:var(--text1);">👥 Organization User Accounts Directory</h4>
          <div style="font-size:12px;color:var(--text3);margin-top:2px;">
            Superadmin master controls: Manage all employee and staff user profiles, reset passwords, and email verification codes.
          </div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <select id="setFilterCompany" class="form-select" style="min-width:180px;font-size:12.5px;padding:6px 10px;">
            <option value="all">📊 All Companies</option>
            ${(window.currentCompanies || []).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}
          </select>
          <input type="text" id="setSearchUsers" class="form-input" placeholder="🔍 Search user, email, role..." style="width:220px;font-size:12.5px;padding:6px 10px;">
          <button type="button" class="btn btn-primary" id="btnAdminAddUser" style="padding:6px 14px;font-size:12.5px;font-weight:700;">
            ➕ Add New User
          </button>
        </div>
      </div>

      <div class="table-container" style="border:1px solid var(--border);border-radius:8px;background:var(--bg-card);box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <table class="data-table" style="width:100%;border-collapse:collapse;font-size:12.5px;">
          <thead>
            <tr style="background:var(--bg-secondary);">
              <th style="width:40px;text-align:center;">#</th>
              <th>User & Profile</th>
              <th>Company</th>
              <th>Role</th>
              <th>Email & Phone</th>
              <th style="text-align:center;">Status</th>
              <th>Last Login</th>
              <th style="text-align:center;min-width:170px;">Actions</th>
            </tr>
          </thead>
          <tbody id="setUsersTableBody">
            <tr><td colspan="8" style="text-align:center;padding:24px;"><div class="spinner"></div> Loading users...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL: EDIT USER PROFILE -->
    <div class="modal-overlay" id="setEditUserModal" style="display:none;align-items:center;justify-content:center;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:99999;backdrop-filter:blur(2px);">
      <div class="modal-box" style="max-width:540px;width:100%;background:var(--bg-primary);border-radius:12px;overflow:hidden;border:1px solid var(--border);box-shadow:0 20px 25px -5px rgba(0,0,0,0.3);">
        <div class="modal-header" style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
          <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--text1);" id="setEditModalTitle">Edit User Profile</h3>
          <button class="modal-close" id="btnCloseEditModal" style="background:none;border:none;font-size:20px;cursor:pointer;">&times;</button>
        </div>
        <form id="setEditUserForm" style="padding:20px;">
          <input type="hidden" id="editUserId">
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:3px;">Full Name *</label>
              <input type="text" id="editFullName" class="form-input" required placeholder="e.g. Sairam">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:3px;">Username *</label>
              <input type="text" id="editUsername" class="form-input" required placeholder="e.g. sairam">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:3px;">Email Address</label>
              <input type="email" id="editEmail" class="form-input" placeholder="e.g. sairam@erp.com">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:3px;">Phone</label>
              <input type="tel" id="editPhone" class="form-input" placeholder="e.g. 9876543210">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:3px;">Company *</label>
              <select id="editCompanyId" class="form-select" required>
                ${(window.currentCompanies || []).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}
              </select>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:3px;">Role *</label>
              <select id="editRole" class="form-select" required>
                <option value="storeadmin">Store Admin</option>
                <option value="accountant">Accountant</option>
                <option value="sales">Sales Officer</option>
                <option value="service">Service Engineer</option>
                <option value="hr">HR Manager</option>
                <option value="marketing">Marketing Specialist</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>
          </div>
          <div style="margin-bottom:16px;">
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer;">
              <input type="checkbox" id="editIsActive" style="transform:scale(1.2);">
              <span>User Account Active (Permitted to log in)</span>
            </label>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--border);padding-top:14px;">
            <button type="button" class="btn btn-secondary" id="btnCancelEditModal">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btnSaveEditUser">💾 Save Changes</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: ADMIN DIRECT PASSWORD RESET (2-TIME CONFIRMATION) -->
    <div class="modal-overlay" id="setAdminResetModal" style="display:none;align-items:center;justify-content:center;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:99999;backdrop-filter:blur(2px);">
      <div class="modal-box" style="max-width:460px;width:100%;background:var(--bg-primary);border-radius:12px;overflow:hidden;border:1px solid var(--border);box-shadow:0 20px 25px -5px rgba(0,0,0,0.3);">
        <div class="modal-header" style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
          <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--text1);">🔑 Direct Password Override</h3>
          <button class="modal-close" id="btnCloseResetModal" style="background:none;border:none;font-size:20px;cursor:pointer;">&times;</button>
        </div>
        <form id="setAdminResetForm" style="padding:20px;">
          <input type="hidden" id="resetTargetUserId">
          <div style="margin-bottom:14px;font-size:12.5px;color:var(--text2);line-height:1.4;" id="resetTargetUserDesc">
            Directly update password for user.
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:3px;">New Password *</label>
            <input type="password" id="adminNewPass" class="form-input" required minlength="6" placeholder="At least 6 characters">
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:3px;">Confirm New Password (2nd Confirmation) *</label>
            <input type="password" id="adminConfirmPass" class="form-input" required minlength="6" placeholder="Re-type new password">
          </div>

          <div id="adminPassMatchInd" style="font-size:12px;font-weight:700;margin-bottom:14px;min-height:16px;"></div>

          <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--border);padding-top:14px;">
            <button type="button" class="btn btn-secondary" id="btnCancelResetModal">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btnSubmitAdminReset">Update Password</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Attach search & company filter
  document.getElementById("setFilterCompany")?.addEventListener("change", fetchAdminUsers);
  document.getElementById("setSearchUsers")?.addEventListener("input", renderAdminUsersTable);

  // Close modals
  document.getElementById("btnCloseEditModal")?.addEventListener("click", () => document.getElementById("setEditUserModal").style.display = "none");
  document.getElementById("btnCancelEditModal")?.addEventListener("click", () => document.getElementById("setEditUserModal").style.display = "none");
  document.getElementById("btnCloseResetModal")?.addEventListener("click", () => document.getElementById("setAdminResetModal").style.display = "none");
  document.getElementById("btnCancelResetModal")?.addEventListener("click", () => document.getElementById("setAdminResetModal").style.display = "none");

  // Admin password matching validator
  const ap1 = document.getElementById("adminNewPass");
  const ap2 = document.getElementById("adminConfirmPass");
  const aInd = document.getElementById("adminPassMatchInd");

  function checkAdminPassMatch() {
    if (!aInd) return;
    const v1 = ap1?.value || "";
    const v2 = ap2?.value || "";
    if (v2.length > 0) {
      if (v1 === v2) aInd.innerHTML = `<span style="color:#16a34a;">✓ Passwords match!</span>`;
      else aInd.innerHTML = `<span style="color:#dc2626;">✗ Passwords do not match.</span>`;
    } else aInd.innerHTML = "";
  }
  ap1?.addEventListener("input", checkAdminPassMatch);
  ap2?.addEventListener("input", checkAdminPassMatch);

  // Edit user form submit
  document.getElementById("setEditUserForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnSaveEditUser");
    if (btn && btn.disabled) return;
    const origHtml = btn ? btn.innerHTML : "Save";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Saving...`;
    }

    const payload = {
      user_id: document.getElementById("editUserId").value,
      full_name: document.getElementById("editFullName").value.trim(),
      username: document.getElementById("editUsername").value.trim(),
      email: document.getElementById("editEmail").value.trim(),
      phone: document.getElementById("editPhone").value.trim(),
      company_id: document.getElementById("editCompanyId").value,
      role: document.getElementById("editRole").value,
      is_active: document.getElementById("editIsActive").checked
    };

    try {
      const res = await fetch(`${API_BASE}/auth?action=admin-update-user`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "User profile updated successfully!", "success");
        document.getElementById("setEditUserModal").style.display = "none";
        fetchAdminUsers();
      } else {
        showToast(data.error || "Failed to update user", "error");
      }
    } catch (err) {
      showToast("Error updating user: " + err.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  });

  // Admin password reset submit
  document.getElementById("setAdminResetForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnSubmitAdminReset");
    if (btn && btn.disabled) return;

    const p1 = document.getElementById("adminNewPass")?.value;
    const p2 = document.getElementById("adminConfirmPass")?.value;
    const targetUserId = document.getElementById("resetTargetUserId")?.value;

    if (!p1 || p1.length < 6) return showToast("Password must be at least 6 characters.", "error");
    if (p1 !== p2) return showToast("New password and confirm password do not match.", "error");

    const origHtml = btn ? btn.innerHTML : "Update Password";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Updating...`;
    }

    try {
      const res = await fetch(`${API_BASE}/auth?action=admin-reset-password`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          target_user_id: targetUserId,
          new_password: p1,
          confirm_password: p2
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "User password updated successfully!", "success");
        document.getElementById("setAdminResetModal").style.display = "none";
        document.getElementById("setAdminResetForm")?.reset();
      } else {
        showToast(data.error || "Failed to update password", "error");
      }
    } catch (err) {
      showToast("Error: " + err.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  });

  // Add User button -> opens Superpanel user creation modal or simple prompt
  document.getElementById("btnAdminAddUser")?.addEventListener("click", () => {
    // Open Superpanel User Accounts or pre-populate modal
    document.getElementById("setEditModalTitle").textContent = "Add New User Account";
    document.getElementById("editUserId").value = "";
    document.getElementById("editFullName").value = "";
    document.getElementById("editUsername").value = "";
    document.getElementById("editEmail").value = "";
    document.getElementById("editPhone").value = "";
    document.getElementById("editIsActive").checked = true;
    document.getElementById("setEditUserModal").style.display = "flex";
  });

  fetchAdminUsers();
}

async function fetchAdminUsers() {
  const comp = document.getElementById("setFilterCompany")?.value || "all";
  const tbody = document.getElementById("setUsersTableBody");
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/auth?action=admin-users-list&company_id=${comp}`, {
      headers: authHeaders()
    });
    const data = await res.json();
    if (data.success) {
      settingsAllUsers = data.users || [];
      renderAdminUsersTable();
    } else {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:#dc2626;">${esc(data.error || "Failed to load users.")}</td></tr>`;
    }
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:#dc2626;">Error: ${esc(err.message)}</td></tr>`;
  }
}

function renderAdminUsersTable() {
  const tbody = document.getElementById("setUsersTableBody");
  if (!tbody) return;

  const q = (document.getElementById("setSearchUsers")?.value || "").toLowerCase().trim();
  let filtered = settingsAllUsers;

  if (q) {
    filtered = filtered.filter(u =>
      (u.username || '').toLowerCase().includes(q) ||
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q) ||
      (u.company_name || '').toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text3);">No users found matching your criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((u, idx) => {
    const displayName = u.full_name || u.username;
    const initials = displayName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "U";
    const roleBadges = {
      superadmin: 'background:#ede9fe;color:#6d28d9;border:1px solid #c4b5fd;',
      storeadmin: 'background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;',
      accountant: 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d;',
      sales: 'background:#dcfce7;color:#166534;border:1px solid #86efac;',
      service: 'background:#e0f2fe;color:#0369a1;border:1px solid #7dd3fc;',
      hr: 'background:#fce7f3;color:#9d174d;border:1px solid #fbcfe8;',
      marketing: 'background:#ffedd5;color:#c2410c;border:1px solid #fed7aa;'
    };
    const rStyle = roleBadges[u.role] || 'background:var(--bg-secondary);color:var(--text2);';

    return `
      <tr>
        <td style="text-align:center;color:var(--text3);">${idx + 1}</td>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg, var(--primary), #4f46e5);color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              ${esc(initials)}
            </div>
            <div>
              <div style="font-weight:700;color:var(--text1);">${esc(displayName)}</div>
              <div style="font-size:11px;color:var(--text3);">@${esc(u.username)}</div>
            </div>
          </div>
        </td>
        <td style="font-weight:600;color:var(--text2);">${esc(u.company_name || 'All Companies')}</td>
        <td>
          <span class="badge" style="${rStyle}font-size:10.5px;padding:2px 8px;font-weight:700;">
            ${esc((u.role || '').replace(/_/g, ' ').toUpperCase())}
          </span>
        </td>
        <td style="font-size:12px;">
          <div>${u.email ? `📧 ${esc(u.email)}` : '<span style="color:var(--text3);">No email</span>'}</div>
          ${u.phone ? `<div style="color:var(--text3);font-size:11px;">📞 ${esc(u.phone)}</div>` : ''}
        </td>
        <td style="text-align:center;">
          ${u.is_active !== false 
            ? '<span class="badge" style="background:#dcfce7;color:#15803d;padding:2px 8px;font-weight:700;font-size:10.5px;">Active</span>' 
            : '<span class="badge" style="background:#fee2e2;color:#b91c1c;padding:2px 8px;font-weight:700;font-size:10.5px;">Disabled</span>'}
        </td>
        <td style="font-size:11px;color:var(--text3);white-space:nowrap;">
          ${u.last_login_at ? formatDate(u.last_login_at) : 'Never'}
        </td>
        <td style="text-align:center;white-space:nowrap;">
          <div style="display:inline-flex;gap:4px;justify-content:center;">
            <button type="button" class="btn btn-xs btn-outline editUserRowBtn" data-id="${u.id}" title="Edit Profile">
              ✏️ Edit
            </button>
            <button type="button" class="btn btn-xs btn-primary resetUserPassBtn" data-id="${u.id}" data-name="${esc(displayName)}" data-user="${esc(u.username)}" title="Direct Password Reset">
              🔑 Reset Pass
            </button>
            ${u.email ? `
            <button type="button" class="btn btn-xs btn-outline sendUserOtpBtn" data-id="${u.id}" data-email="${esc(u.email)}" title="Send Password Reset OTP to User">
              📧 Send OTP
            </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join("");

  // Attach button events
  tbody.querySelectorAll(".editUserRowBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const u = settingsAllUsers.find(x => x.id == btn.dataset.id);
      if (!u) return;
      document.getElementById("setEditModalTitle").textContent = `Edit Profile — ${u.full_name || u.username}`;
      document.getElementById("editUserId").value = u.id;
      document.getElementById("editFullName").value = u.full_name || "";
      document.getElementById("editUsername").value = u.username || "";
      document.getElementById("editEmail").value = u.email || "";
      document.getElementById("editPhone").value = u.phone || "";
      document.getElementById("editCompanyId").value = u.company_id || (window.currentCompanies && window.currentCompanies[0]?.id) || "";
      document.getElementById("editRole").value = u.role || "storeadmin";
      document.getElementById("editIsActive").checked = u.is_active !== false;
      document.getElementById("setEditUserModal").style.display = "flex";
    });
  });

  tbody.querySelectorAll(".resetUserPassBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("resetTargetUserId").value = btn.dataset.id;
      document.getElementById("resetTargetUserDesc").innerHTML = `Set a new password for <strong>${btn.dataset.name} (@${btn.dataset.user})</strong> with 2-time confirmation.`;
      document.getElementById("adminNewPass").value = "";
      document.getElementById("adminConfirmPass").value = "";
      const aInd = document.getElementById("adminPassMatchInd");
      if (aInd) aInd.innerHTML = "";
      document.getElementById("setAdminResetModal").style.display = "flex";
    });
  });

  tbody.querySelectorAll(".sendUserOtpBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const uid = btn.dataset.id;
      const uemail = btn.dataset.email;
      if (!confirm(`Send a password reset OTP email to ${uemail}?`)) return;

      const origHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

      try {
        const res = await fetch(`${API_BASE}/auth?action=admin-send-user-otp`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ target_user_id: uid })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || "OTP sent successfully to user!", "success");
        } else {
          showToast(data.error || "Failed to send OTP", "error");
        }
      } catch (err) {
        showToast("Error: " + err.message, "error");
      } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// REGISTER MODULE ROUTES
// ═══════════════════════════════════════════════════════════════

if (window.registerModuleRoute) {
  window.registerModuleRoute(
    ['gen_settings', 'settings', 'profile_settings', 'profile'],
    renderSettingsModule
  );
}
