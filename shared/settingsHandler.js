const { getSQL } = require("./db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const JWT_SECRET = process.env.JWT_SECRET || "business-erp-jwt-secret-key-2026";

function authenticateUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.split(" ")[1];
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

async function ensureSettingsTables(sql) {
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(150);`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(150);`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);`;
  } catch (_) {}

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS password_reset_otps (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        otp_code VARCHAR(10) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        is_used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_reset_otps_user ON password_reset_otps(user_id, otp_code, is_used);`;
  } catch (_) {}
}

async function getSmtpConfigForCompany(sql, companyId) {
  let smtp = null;
  if (companyId) {
    const compSmtp = await sql`
      SELECT * FROM smtp_settings 
      WHERE company_id = ${parseInt(companyId)}
      ORDER BY is_default DESC, id ASC 
      LIMIT 1
    `;
    if (compSmtp.length > 0) smtp = compSmtp[0];
  }

  if (!smtp) {
    const defSmtp = await sql`
      SELECT * FROM smtp_settings 
      WHERE is_default = true OR company_id IS NULL
      ORDER BY is_default DESC, id ASC 
      LIMIT 1
    `;
    if (defSmtp.length > 0) smtp = defSmtp[0];
  }

  if (!smtp) {
    const anySmtp = await sql`SELECT * FROM smtp_settings ORDER BY id ASC LIMIT 1`;
    if (anySmtp.length > 0) smtp = anySmtp[0];
  }

  return smtp;
}

function createTransporter(smtp) {
  const port = parseInt(smtp.smtp_port || 587, 10);
  const sec = (smtp.smtp_secure || '').toLowerCase();
  const isSecure = (sec === 'ssl' || port === 465);

  let authUser = (smtp.smtp_user && smtp.smtp_user.trim()) ? smtp.smtp_user.trim() : (smtp.from_email ? smtp.from_email.trim() : '');
  if (authUser && !authUser.includes('@') && smtp.from_email && smtp.from_email.includes('@')) {
    authUser = smtp.from_email.trim();
  }

  return nodemailer.createTransport({
    host: smtp.smtp_host ? smtp.smtp_host.trim() : '',
    port: port,
    secure: isSecure,
    auth: {
      user: authUser,
      pass: smtp.smtp_password || ''
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  const first = local[0];
  const last = local[local.length - 1];
  const asterisks = '*'.repeat(Math.min(local.length - 2, 5));
  return `${first}${asterisks}${last}@${domain}`;
}

async function handleSettings(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = authenticateUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }

  const sql = getSQL();
  await ensureSettingsTables(sql);

  const action = req.query.action || req.body?.action;

  try {
    // ═══════════════ 1. GET PROFILE ═══════════════
    if (action === "get-profile") {
      const rows = await sql`
        SELECT u.id, u.username, u.full_name, u.email, u.phone, u.role, u.company_id,
               u.employee_id, u.is_active, u.created_at, u.last_login_at,
               c.name as company_name, c.gstin as company_gstin, c.logo_data as company_logo
        FROM users u
        LEFT JOIN companies c ON u.company_id = c.id
        WHERE u.id = ${user.id}
      `;

      if (rows.length === 0) {
        return res.status(404).json({ error: "User profile not found" });
      }

      const userProfile = rows[0];

      // Check if SMTP is configured for this company/user
      const smtp = await getSmtpConfigForCompany(sql, userProfile.company_id);
      const emailConfig = {
        has_smtp: Boolean(smtp),
        smtp_host: smtp ? smtp.smtp_host : null,
        from_email: smtp ? maskEmail(smtp.from_email) : null,
        from_name: smtp ? (smtp.from_name || smtp.profile_name) : null
      };

      return res.status(200).json({
        success: true,
        user: userProfile,
        email_config: emailConfig
      });
    }

    // ═══════════════ 2. UPDATE PROFILE ═══════════════
    else if (action === "update-profile") {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

      const { full_name, email, phone } = req.body;

      const cleanFullName = full_name ? full_name.trim() : null;
      const cleanEmail = email ? email.trim().toLowerCase() : null;
      const cleanPhone = phone ? phone.trim() : null;

      if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: "Please enter a valid email address." });
      }

      // Check if email already used by another user
      if (cleanEmail) {
        const existingEmail = await sql`
          SELECT id FROM users 
          WHERE LOWER(TRIM(email)) = ${cleanEmail} AND id != ${user.id}
        `;
        if (existingEmail.length > 0) {
          return res.status(400).json({ error: "This email address is already associated with another user account." });
        }
      }

      const updated = await sql`
        UPDATE users SET
          full_name = ${cleanFullName},
          email = ${cleanEmail},
          phone = ${cleanPhone}
        WHERE id = ${user.id}
        RETURNING id, username, full_name, email, phone, role, company_id
      `;

      // If user is linked to employee record, keep employee contact in sync
      if (user.employee_id) {
        try {
          await sql`
            UPDATE employees SET
              name = COALESCE(${cleanFullName}, name),
              email = COALESCE(${cleanEmail}, email),
              phone = COALESCE(${cleanPhone}, phone)
            WHERE id = ${user.employee_id}
          `;
        } catch (_) {}
      }

      // Audit log
      try {
        await sql`
          INSERT INTO audit_logs (company_id, user_id, action, module, entity, record_id)
          VALUES (${user.company_id}, ${user.id}, 'update_profile', 'settings', 'users', ${user.id})
        `;
      } catch (_) {}

      return res.status(200).json({
        success: true,
        user: updated[0],
        message: "Profile updated successfully!"
      });
    }

    // ═══════════════ 3. SEND PASSWORD RESET OTP ═══════════════
    else if (action === "send-otp") {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

      const userRows = await sql`
        SELECT u.id, u.username, u.full_name, u.email, u.company_id,
               c.name as company_name, c.logo_data as company_logo
        FROM users u
        LEFT JOIN companies c ON u.company_id = c.id
        WHERE u.id = ${user.id}
      `;

      if (userRows.length === 0) return res.status(404).json({ error: "User not found" });
      const curUser = userRows[0];

      if (!curUser.email || !curUser.email.trim()) {
        return res.status(400).json({
          error: "No email address found on your profile. Please add and save your email in the Profile section above first."
        });
      }

      const targetEmail = curUser.email.trim();

      // Find company SMTP
      const smtp = await getSmtpConfigForCompany(sql, curUser.company_id);
      if (!smtp) {
        return res.status(400).json({
          error: "No outgoing email (SMTP) server configured for your company. Please ask your administrator to configure SMTP under Marketing / Email Settings first."
        });
      }

      // Invalidate existing unused OTPs for this user
      await sql`UPDATE password_reset_otps SET is_used = true WHERE user_id = ${user.id} AND is_used = false`;

      // Generate 6-digit numeric OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await sql`
        INSERT INTO password_reset_otps (user_id, email, otp_code, expires_at, is_used)
        VALUES (${user.id}, ${targetEmail}, ${otpCode}, ${expiresAt}, false)
      `;

      const compName = curUser.company_name || smtp.from_name || "Business ERP Suite";
      const displayName = curUser.full_name || curUser.username;

      const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; background: #f8fafc; color: #1e293b; }
            .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
            .header { background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff; padding: 24px 28px; text-align: center; }
            .content { padding: 28px; }
            .otp-box { background: #f1f5f9; border: 2px dashed #93c5fd; border-radius: 8px; padding: 18px; text-align: center; margin: 22px 0; }
            .otp-number { font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; font-family: monospace; }
            .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 11px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h2 style="margin:0;font-size:20px;font-weight:700;">${compName}</h2>
              <div style="font-size:12px;opacity:0.85;margin-top:4px;">Security & Account Authentication</div>
            </div>
            <div class="content">
              <p style="font-size:15px;margin-top:0;">Hello <strong>${displayName}</strong>,</p>
              <p style="font-size:13.5px;color:#475569;line-height:1.5;">
                We received a request to reset your password for your account (<strong>${curUser.username}</strong>). Use the verification code below to confirm your request:
              </p>
              <div class="otp-box">
                <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Your One-Time Password (OTP)</div>
                <div class="otp-number">${otpCode}</div>
                <div style="font-size:11px;color:#dc2626;font-weight:600;margin-top:6px;">⏱️ Valid for 10 minutes only</div>
              </div>
              <p style="font-size:12.5px;color:#64748b;line-height:1.4;">
                If you did not request this password reset, please contact your company administrator immediately. Never share your OTP with anyone.
              </p>
            </div>
            <div class="footer">
              This is an automated system email generated by ${compName} ERP. Please do not reply.
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        const transporter = createTransporter(smtp);
        await transporter.sendMail({
          from: smtp.from_name ? `"${smtp.from_name}" <${smtp.from_email}>` : smtp.from_email,
          to: targetEmail,
          subject: `🔐 Your Password Reset OTP: ${otpCode} — ${compName}`,
          html: htmlBody,
          text: `Your password reset code is ${otpCode}. It is valid for 10 minutes. If you did not request this, please ignore this email.`
        });

        // Log to email_logs
        try {
          await sql`
            INSERT INTO email_logs (company_id, user_id, smtp_id, from_email, to_email, subject, body_text, status)
            VALUES (${curUser.company_id}, ${user.id}, ${smtp.id}, ${smtp.from_email}, ${targetEmail}, 'Password Reset OTP', 'OTP Code Sent', 'sent')
          `;
        } catch (_) {}

        return res.status(200).json({
          success: true,
          message: `OTP sent successfully to ${maskEmail(targetEmail)}! Check your inbox/spam folder.`,
          masked_email: maskEmail(targetEmail)
        });
      } catch (mailErr) {
        console.error("Email send error:", mailErr);
        return res.status(500).json({
          error: `Failed to send email OTP via company mail server: ${mailErr.message}. Please verify SMTP settings.`
        });
      }
    }

    // ═══════════════ 4. VERIFY OTP & RESET PASSWORD ═══════════════
    else if (action === "reset-password-otp") {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

      const { otp_code, new_password, confirm_password } = req.body;

      const cleanOtp = (otp_code || '').toString().trim();
      if (!cleanOtp) {
        return res.status(400).json({ error: "Please enter the 6-digit verification code (OTP)." });
      }

      if (!new_password || !confirm_password) {
        return res.status(400).json({ error: "Please enter your new password and confirmation." });
      }

      if (new_password.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters long." });
      }

      // Two-time confirmation check as requested
      if (new_password !== confirm_password) {
        return res.status(400).json({ error: "New password and Confirm password do not match. Please re-enter." });
      }

      // Check OTP in DB
      const otpRows = await sql`
        SELECT * FROM password_reset_otps
        WHERE user_id = ${user.id}
          AND otp_code = ${cleanOtp}
          AND is_used = false
        ORDER BY id DESC
        LIMIT 1
      `;

      if (otpRows.length === 0) {
        return res.status(400).json({ error: "Invalid OTP code. Please enter the correct code or request a new one." });
      }

      const otpRecord = otpRows[0];
      const now = new Date();
      if (new Date(otpRecord.expires_at) < now) {
        return res.status(400).json({ error: "This OTP code has expired. Please click 'Send OTP' to receive a new code." });
      }

      // Hash password and update user
      const hash = await bcrypt.hash(new_password, 10);
      await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${user.id}`;

      // Mark OTP as used
      await sql`UPDATE password_reset_otps SET is_used = true WHERE id = ${otpRecord.id}`;

      // Audit log
      try {
        await sql`
          INSERT INTO audit_logs (company_id, user_id, action, module, entity, record_id)
          VALUES (${user.company_id}, ${user.id}, 'password_reset_otp', 'settings', 'users', ${user.id})
        `;
      } catch (_) {}

      return res.status(200).json({
        success: true,
        message: "Password reset successfully! You can now use your new password."
      });
    }

    // ═══════════════ 5. SUPERADMIN: LIST ALL USERS ═══════════════
    else if (action === "admin-users-list") {
      if (user.role !== "superadmin") {
        return res.status(403).json({ error: "Access denied. Only Superadmin can manage other user accounts." });
      }

      const compParam = req.query.company_id;
      let rows;
      if (compParam && compParam !== "all") {
        rows = await sql`
          SELECT u.id, u.username, u.full_name, u.email, u.phone, u.role, u.company_id,
                 u.employee_id, u.is_active, u.created_at, u.last_login_at,
                 c.name as company_name, c.gstin as company_gstin
          FROM users u
          LEFT JOIN companies c ON u.company_id = c.id
          WHERE u.company_id = ${parseInt(compParam)}
          ORDER BY u.id DESC
        `;
      } else {
        rows = await sql`
          SELECT u.id, u.username, u.full_name, u.email, u.phone, u.role, u.company_id,
                 u.employee_id, u.is_active, u.created_at, u.last_login_at,
                 c.name as company_name, c.gstin as company_gstin
          FROM users u
          LEFT JOIN companies c ON u.company_id = c.id
          ORDER BY u.id DESC
        `;
      }

      return res.status(200).json({ success: true, users: rows });
    }

    // ═══════════════ 6. SUPERADMIN: UPDATE ANOTHER USER PROFILE ═══════════════
    else if (action === "admin-update-user") {
      if (user.role !== "superadmin") {
        return res.status(403).json({ error: "Access denied. Only Superadmin can manage other user accounts." });
      }

      const { user_id, full_name, username, email, phone, role, company_id, is_active } = req.body;
      const targetId = parseInt(user_id);
      if (!targetId) return res.status(400).json({ error: "User ID required" });

      const cleanUsername = username ? username.trim() : null;
      const cleanFullName = full_name ? full_name.trim() : null;
      const cleanEmail = email ? email.trim().toLowerCase() : null;
      const cleanPhone = phone ? phone.trim() : null;

      if (cleanUsername) {
        const dupUser = await sql`
          SELECT id FROM users WHERE LOWER(username) = LOWER(${cleanUsername}) AND id != ${targetId}
        `;
        if (dupUser.length > 0) return res.status(400).json({ error: "Username already taken." });
      }

      if (cleanEmail) {
        const dupEmail = await sql`
          SELECT id FROM users WHERE LOWER(TRIM(email)) = ${cleanEmail} AND id != ${targetId}
        `;
        if (dupEmail.length > 0) return res.status(400).json({ error: "Email already in use by another user." });
      }

      const targetCompany = (role === "superadmin") ? null : (company_id ? parseInt(company_id) : null);

      const updated = await sql`
        UPDATE users SET
          username = COALESCE(${cleanUsername}, username),
          full_name = ${cleanFullName},
          email = ${cleanEmail},
          phone = ${cleanPhone},
          role = COALESCE(${role}, role),
          company_id = ${targetCompany},
          is_active = COALESCE(${is_active !== undefined ? Boolean(is_active) : null}, is_active)
        WHERE id = ${targetId}
        RETURNING id, username, full_name, email, phone, role, company_id, is_active
      `;

      return res.status(200).json({
        success: true,
        user: updated[0],
        message: "User profile updated successfully!"
      });
    }

    // ═══════════════ 7. SUPERADMIN: DIRECT PASSWORD RESET (2-TIME CONFIRMATION) ═══════════════
    else if (action === "admin-reset-password") {
      if (user.role !== "superadmin") {
        return res.status(403).json({ error: "Access denied. Only Superadmin can reset user passwords." });
      }

      const { target_user_id, new_password, confirm_password } = req.body;
      const targetId = parseInt(target_user_id);
      if (!targetId) return res.status(400).json({ error: "Target User ID required." });

      if (!new_password || !confirm_password) {
        return res.status(400).json({ error: "New password and Confirmation password are both required." });
      }

      if (new_password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long." });
      }

      if (new_password !== confirm_password) {
        return res.status(400).json({ error: "New password and Confirm password do not match." });
      }

      const hash = await bcrypt.hash(new_password, 10);
      await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${targetId}`;

      return res.status(200).json({
        success: true,
        message: "Password updated successfully for the user!"
      });
    }

    // ═══════════════ 8. SUPERADMIN: TRIGGER USER OTP RESET EMAIL ═══════════════
    else if (action === "admin-send-user-otp") {
      if (user.role !== "superadmin") {
        return res.status(403).json({ error: "Access denied." });
      }

      const { target_user_id } = req.body;
      const targetId = parseInt(target_user_id);
      if (!targetId) return res.status(400).json({ error: "Target User ID required." });

      const targetRows = await sql`
        SELECT u.id, u.username, u.full_name, u.email, u.company_id,
               c.name as company_name
        FROM users u
        LEFT JOIN companies c ON u.company_id = c.id
        WHERE u.id = ${targetId}
      `;
      if (targetRows.length === 0) return res.status(404).json({ error: "Target user not found." });
      const targetUser = targetRows[0];

      if (!targetUser.email) {
        return res.status(400).json({ error: "User does not have an email address registered." });
      }

      const smtp = await getSmtpConfigForCompany(sql, targetUser.company_id);
      if (!smtp) {
        return res.status(400).json({ error: "No outgoing email (SMTP) server configured for this company." });
      }

      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await sql`UPDATE password_reset_otps SET is_used = true WHERE user_id = ${targetId} AND is_used = false`;
      await sql`
        INSERT INTO password_reset_otps (user_id, email, otp_code, expires_at, is_used)
        VALUES (${targetId}, ${targetUser.email}, ${otpCode}, ${expiresAt}, false)
      `;

      const compName = targetUser.company_name || smtp.from_name || "Business ERP Suite";
      const transporter = createTransporter(smtp);

      await transporter.sendMail({
        from: smtp.from_name ? `"${smtp.from_name}" <${smtp.from_email}>` : smtp.from_email,
        to: targetUser.email,
        subject: `🔐 Password Reset OTP: ${otpCode} — ${compName}`,
        html: `
          <div style="font-family:sans-serif;padding:20px;max-width:500px;border:1px solid #e2e8f0;border-radius:10px;">
            <h3 style="color:#1d4ed8;margin-top:0;">${compName} Password Reset</h3>
            <p>Hello <strong>${targetUser.full_name || targetUser.username}</strong>,</p>
            <p>An administrator has initiated a password reset for your account. Your verification OTP code is:</p>
            <div style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#1e40af;text-align:center;padding:15px;background:#f1f5f9;border-radius:8px;margin:15px 0;">${otpCode}</div>
            <p style="color:#64748b;font-size:12px;">Valid for 10 minutes. If you did not expect this, please notify your administrator.</p>
          </div>
        `
      });

      return res.status(200).json({
        success: true,
        message: `OTP successfully emailed to ${maskEmail(targetUser.email)}!`
      });
    }

    else {
      return res.status(400).json({ error: "Unknown settings action requested." });
    }
  } catch (err) {
    console.error("Settings handler error:", err);
    return res.status(500).json({ error: "Settings server error", details: err.message });
  }
}

module.exports = {
  handleSettings
};
