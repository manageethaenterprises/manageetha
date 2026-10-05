const { getSQL } = require("../shared/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "business-erp-jwt-secret-key-2026";

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const action =
    req.query.action ||
    (req.url && req.url.includes("/login")
      ? "login"
      : req.url && req.url.includes("/logout")
        ? "logout"
        : req.url && req.url.includes("/me")
          ? "me"
          : req.url && req.url.includes("/heartbeat")
            ? "heartbeat"
            : req.url && req.url.includes("/change-password")
              ? "change-password"
              : null);

  const sql = getSQL();

  // ═══════════════ LOGIN ═══════════════
  if (action === "login") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const identifier = username.trim();
      const rows = await sql`
        SELECT u.*, c.name as company_name, c.logo_data as company_logo,
               c.gstin as company_gstin, c.state as company_state,
               c.parent_company_id
        FROM users u
        LEFT JOIN companies c ON u.company_id = c.id
        WHERE (u.username = ${identifier} OR u.phone = ${identifier} OR u.email = ${identifier})
          AND u.is_active = true
      `;

      if (rows.length === 0) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Update last login
      try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_logout_at TIMESTAMP`; } catch (e) {}
      await sql`UPDATE users SET last_login_at = NOW(), last_logout_at = NULL WHERE id = ${user.id}`;

function getISTDate(d = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function getISTTime(d = new Date()) {
  return d.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour12: false });
}

      // Auto-record attendance on login (for non-superadmin with employee_id)
      if (user.role !== "superadmin" && user.employee_id && user.company_id) {
        const today = getISTDate();
        const loginTime = getISTTime();

        // Check if attendance already exists for today
        const existingAtt = await sql`
          SELECT id FROM attendance
          WHERE company_id = ${user.company_id} AND employee_id = ${user.employee_id} AND date = ${today}
        `;

        if (existingAtt.length === 0) {
          // Get company attendance settings
          let cutoffNormal = "10:30";
          let cutoffLeave = "11:00";
          try {
            if (user.settings_json) {
              // settings_json is on the companies table, need to fetch
            }
            const compSettings = await sql`SELECT settings_json FROM companies WHERE id = ${user.company_id}`;
            if (compSettings.length > 0 && compSettings[0].settings_json) {
              const settings = JSON.parse(compSettings[0].settings_json);
              if (settings.attendance_cutoff_normal) cutoffNormal = settings.attendance_cutoff_normal;
              if (settings.attendance_cutoff_leave) cutoffLeave = settings.attendance_cutoff_leave;
            }
          } catch (e) { /* use defaults */ }

          let status = "present";
          if (loginTime > cutoffLeave) {
            status = "leave";
          } else if (loginTime > cutoffNormal) {
            status = "late";
          }

          await sql`
            INSERT INTO attendance (company_id, employee_id, date, login_time, status, marked_by)
            VALUES (${user.company_id}, ${user.employee_id}, ${today}, ${loginTime}, ${status}, ${user.id})
            ON CONFLICT (company_id, employee_id, date) DO NOTHING
          `;
        }
      }

      // Build JWT payload
      const tokenPayload = {
        id: user.id,
        username: user.username,
        role: user.role,
        company_id: user.company_id,
        employee_id: user.employee_id,
      };

      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "24h" });

      // Get companies list (all for superadmin, assigned company for others)
      let companies = [];
      if (user.role === "superadmin") {
        companies = await sql`
          SELECT * FROM companies ORDER BY name ASC
        `;
      } else if (user.company_id) {
        companies = await sql`
          SELECT * FROM companies WHERE id = ${user.company_id}
        `;
      }

      return res.status(200).json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          company_id: user.company_id,
          employee_id: user.employee_id,
          company_name: user.company_name || (user.role === "superadmin" ? "Super Admin Portal" : "Business ERP"),
          company_logo: user.company_logo || "",
          company_gstin: user.company_gstin || "",
          company_state: user.company_state || "",
        },
        companies: companies,
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ error: "Login failed", details: error.message });
    }
  }

  // ═══════════════ HEARTBEAT PING ═══════════════
  else if (action === "heartbeat") {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No token provided" });
      }
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      await sql`UPDATE users SET last_login_at = NOW() WHERE id = ${decoded.id}`;
      return res.status(200).json({ success: true, online: true });
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
  }

  // ═══════════════ LOGOUT ═══════════════
  else if (action === "logout") {
    try {
      let userId = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          userId = decoded.id;
        } catch (e) {}
      }
      if (!userId && (req.query.token || (req.body && req.body.token))) {
        const token = req.query.token || req.body.token;
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          userId = decoded.id;
        } catch (e) {}
      }

      if (userId) {
        try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_logout_at TIMESTAMP`; } catch (e) {}
        await sql`UPDATE users SET last_logout_at = NOW() WHERE id = ${userId}`;
      }
      return res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (err) {
      return res.status(200).json({ success: true });
    }
  }

  // ═══════════════ VERIFY TOKEN (ME) ═══════════════
  else if (action === "me") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No token provided" });
      }

      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      // Update activity pulse
      await sql`UPDATE users SET last_login_at = NOW() WHERE id = ${decoded.id}`;

      const userRows = await sql`
        SELECT u.*, c.name as company_name, c.logo_data as company_logo,
               c.gstin as company_gstin, c.state as company_state
        FROM users u
        LEFT JOIN companies c ON u.company_id = c.id
        WHERE u.id = ${decoded.id} AND u.is_active = true
      `;

      if (userRows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      const user = userRows[0];

      // Get mapped menus for this user's role in their company
      let mappedMenus = [];
      if (user.role === "superadmin") {
        // Superadmin gets all superadmin menus
        mappedMenus = await sql`
          SELECT m.menu_key, m.menu_label, m.icon, mc.category_key, mc.category_label, mc.icon as category_icon
          FROM menus m
          JOIN menu_categories mc ON m.category_id = mc.id
          ORDER BY mc.sort_order, m.sort_order
        `;
      } else if (user.company_id) {
        mappedMenus = await sql`
          SELECT rmm.menu_key, rmm.menu_label, rmm.menu_icon as icon,
                 mc.category_key, mc.category_label, mc.icon as category_icon
          FROM role_menu_mappings rmm
          LEFT JOIN menus m ON rmm.menu_key = m.menu_key
          LEFT JOIN menu_categories mc ON m.category_id = mc.id
          WHERE rmm.company_id = ${user.company_id} AND rmm.role_name = ${user.role}
          ORDER BY mc.sort_order, m.sort_order
        `;
      }

      // Send companies (all for superadmin, assigned company for others)
      let companies = [];
      if (user.role === "superadmin") {
        companies = await sql`
          SELECT * FROM companies ORDER BY name ASC
        `;
      } else if (user.company_id) {
        companies = await sql`
          SELECT * FROM companies WHERE id = ${user.company_id}
        `;
      }

      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          company_id: user.company_id,
          employee_id: user.employee_id,
          company_name: user.company_name || (user.role === "superadmin" ? "Super Admin Portal" : "Business ERP"),
          company_logo: user.company_logo || "",
          company_gstin: user.company_gstin || "",
          company_state: user.company_state || "",
        },
        menus: mappedMenus,
        companies: companies,
      });
    } catch (error) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  }

  // ═══════════════ CHANGE PASSWORD ═══════════════
  else if (action === "change-password") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No token provided" });
      }

      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      const { current_password, new_password } = req.body;
      if (!current_password || !new_password) {
        return res.status(400).json({ error: "Current and new passwords are required" });
      }
      if (new_password.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters" });
      }

      const userRows = await sql`SELECT * FROM users WHERE id = ${decoded.id}`;
      if (userRows.length === 0) return res.status(404).json({ error: "User not found" });

      const valid = await bcrypt.compare(current_password, userRows[0].password_hash);
      if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

      const newHash = await bcrypt.hash(new_password, 10);
      await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${decoded.id}`;

      // Audit log
      await sql`
        INSERT INTO audit_logs (company_id, user_id, action, module, entity, record_id)
        VALUES (${decoded.company_id}, ${decoded.id}, 'change_password', 'auth', 'users', ${decoded.id})
      `;

      return res.status(200).json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      return res.status(500).json({ error: "Failed to change password", details: error.message });
    }
  }

  else {
    return res.status(404).json({ error: "Endpoint action not found" });
  }
};
