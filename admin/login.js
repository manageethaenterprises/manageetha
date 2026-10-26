// ═══════════════════════════════════════
// LOGIN PAGE — login.js
// ═══════════════════════════════════════

const API_BASE = "/api";

// Check if already logged in or session expired
function checkAuthAndRedirect() {
  const token = localStorage.getItem("erp_token");
  if (token) {
    try {
      const user = JSON.parse(localStorage.getItem("erp_user") || "null");
      if (user && user.role !== "superadmin") {
        const expiresAt = parseInt(localStorage.getItem("erp_session_expires_at") || "0", 10);
        if (expiresAt && Date.now() >= expiresAt) {
          localStorage.removeItem("erp_token");
          localStorage.removeItem("erp_user");
          localStorage.removeItem("erp_session_expires_at");
          sessionStorage.setItem("erp_session_expired", "Your session has expired due to 10 minutes of inactivity. Please sign in again.");
          return;
        }
      }
    } catch (e) {}
    window.location.replace("/admin/dashboard.html");
  }
}
checkAuthAndRedirect();
window.addEventListener("pageshow", checkAuthAndRedirect);

// Display session expired warning if redirected due to timeout
(function showSessionExpiryNotice() {
  const expiredMsg = sessionStorage.getItem("erp_session_expired");
  if (expiredMsg) {
    sessionStorage.removeItem("erp_session_expired");
    window.addEventListener("DOMContentLoaded", () => {
      const errorEl = document.getElementById("errorMessage");
      if (errorEl) {
        errorEl.textContent = expiredMsg;
        errorEl.style.display = "block";
        errorEl.style.color = "#f59e0b";
        errorEl.style.background = "rgba(245, 158, 11, 0.12)";
        errorEl.style.border = "1px solid rgba(245, 158, 11, 0.35)";
        errorEl.style.padding = "10px 14px";
        errorEl.style.borderRadius = "8px";
        errorEl.style.marginBottom = "14px";
        errorEl.style.fontSize = "13px";
        errorEl.style.fontWeight = "500";
      }
    });
  }
})();

// Theme Switcher Logic
(function initTheme() {
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const savedTheme = localStorage.getItem("erp_theme") || "dark";

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("erp_theme", theme);
    if (themeToggleBtn) {
      themeToggleBtn.textContent = theme === "dark" ? "☀️" : "🌙";
    }
  }

  applyTheme(savedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", function () {
      const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(newTheme);
    });
  }
})();

// Toggle password visibility
const togglePasswordBtn = document.getElementById("togglePassword");
if (togglePasswordBtn) {
  togglePasswordBtn.addEventListener("click", function () {
    const input = document.getElementById("password");
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    this.textContent = isPassword ? "🙈" : "👁️";
  });
}

// Login form submission
document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const errorEl = document.getElementById("errorMessage");
  const btn = document.getElementById("loginBtn");
  const btnText = btn.querySelector(".btn-text");
  const btnLoader = btn.querySelector(".btn-loader");

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!username || !password) {
    errorEl.textContent = "Please enter username and password";
    return;
  }

  errorEl.textContent = "";
  btn.disabled = true;
  btnText.textContent = "Signing in...";
  btnLoader.style.display = "inline";

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || "Login failed");
    }

    // Store auth data
    localStorage.setItem("erp_token", data.token);
    localStorage.setItem("erp_user", JSON.stringify(data.user));
    if (data.companies && data.companies.length > 0) {
      localStorage.setItem("erp_companies", JSON.stringify(data.companies));
    }

    // Set 10-minute session expiry for all users except superadmin
    if (data.user && data.user.role !== "superadmin") {
      const sessionSeconds = data.session_timeout_seconds || 600; // 10 minutes default
      const expiresAt = Date.now() + (sessionSeconds * 1000);
      localStorage.setItem("erp_session_expires_at", expiresAt.toString());
    } else {
      localStorage.removeItem("erp_session_expires_at");
    }
    sessionStorage.removeItem("erp_session_expired");

    // Redirect to dashboard
    window.location.replace("/admin/dashboard.html");
  } catch (err) {
    errorEl.textContent = err.message || "Login failed. Please try again.";
  } finally {
    btn.disabled = false;
    btnText.textContent = "Sign In";
    btnLoader.style.display = "none";
  }
});

// Initialize Database Button Listener
const initDbBtn = document.getElementById("initDbBtn");
const setupStatus = document.getElementById("setupStatus");

if (initDbBtn) {
  initDbBtn.addEventListener("click", async function () {
    if (setupStatus) {
      setupStatus.style.display = "block";
      setupStatus.className = "setup-status loading";
      setupStatus.innerHTML = "⏳ Initializing database tables and seeding superadmin...";
    }

    initDbBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.details || data.error || "Database setup failed");
      }

      if (setupStatus) {
        setupStatus.className = "setup-status success";
        setupStatus.innerHTML = `
          <div style="font-weight: 700; margin-bottom: 4px;">✅ Database Initialized Successfully!</div>
          <div>${data.message || "Tables created/migrated."}</div>
          ${data.default_login ? `
            <div style="margin-top: 8px; font-size: 12px; opacity: 0.95;">
              🔑 <strong>Superadmin Credentials:</strong><br>
              Username: <code>${data.default_login.username}</code><br>
              Password: <code>${data.default_login.password}</code>
            </div>
          ` : ''}
        `;
      }

      // Auto-fill username if available
      if (data.default_login && data.default_login.username) {
        const usernameInput = document.getElementById("username");
        if (usernameInput && !usernameInput.value) {
          usernameInput.value = data.default_login.username;
        }
      }
    } catch (err) {
      if (setupStatus) {
        setupStatus.className = "setup-status error";
        setupStatus.innerHTML = `❌ <strong>Setup Error:</strong> ${err.message || "Failed to connect to /api/setup"}`;
      }
    } finally {
      initDbBtn.disabled = false;
    }
  });
}
