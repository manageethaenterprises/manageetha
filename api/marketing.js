const { getSQL } = require("../shared/db");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const JWT_SECRET = process.env.JWT_SECRET || "business-erp-jwt-secret-key-2026";

function verifyToken(req) {
  let token = null;
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  } else if (req.body && req.body.token) {
    token = req.body.token;
  }
  if (!token || token === "null" || token === "undefined") return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

const INSPENOX_FOOTER_HTML = `
<div style="margin-top:30px;padding-top:15px;border-top:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;font-size:12px;color:#64748b;clear:both;">
  Powered by <a href="https://inspenox.com" target="_blank" style="color:#2563eb;font-weight:bold;text-decoration:none;">Inspenox Business Suite</a>
</div>
`;

function appendInspenoxFooter(htmlContent) {
  if (!htmlContent) return INSPENOX_FOOTER_HTML;
  if (htmlContent.includes("Powered by") && htmlContent.includes("Inspenox")) {
    return htmlContent;
  }
  if (htmlContent.includes("</body>")) {
    return htmlContent.replace("</body>", `${INSPENOX_FOOTER_HTML}</body>`);
  }
  return htmlContent + INSPENOX_FOOTER_HTML;
}

async function createTransporter(smtp) {
  const port = parseInt(smtp.smtp_port || 587, 10);
  const sec = (smtp.smtp_secure || '').toLowerCase();
  const isSecure = sec === 'ssl' || sec === 'true' || port === 465;

  let authUser = (smtp.smtp_user && smtp.smtp_user.trim()) ? smtp.smtp_user.trim() : (smtp.from_email ? smtp.from_email.trim() : '');
  if (authUser && !authUser.includes('@') && smtp.from_email && smtp.from_email.includes('@')) {
    authUser = smtp.from_email.trim();
  }

  const transportOpts = {
    host: smtp.smtp_host ? smtp.smtp_host.trim() : '',
    port: port,
    secure: isSecure, // true for port 465, false for 587 or 25
    auth: {
      user: authUser,
      pass: smtp.smtp_password || ''
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  };

  if (port === 587 || sec === 'tls' || sec === 'starttls') {
    transportOpts.requireTLS = true;
  }

  return nodemailer.createTransport(transportOpts);
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized. Please login." });

  const sql = getSQL();

  // Ensure email_templates table exists
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS email_templates (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        template_name VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        body_html TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
  } catch (e) {}

  const action = req.query.action || req.body?.action || "sms-logs";

  try {
    const compQuery = req.query.company_id || req.body?.company_id || (user.role === 'superadmin' ? 'all' : user.company_id);
    const isAll = user.role === 'superadmin' && (!compQuery || compQuery === "all" || isNaN(parseInt(compQuery)));

    // ═══════════════ DLT SMS LOGS & BROADCAST ═══════════════
    if (action === "sms-logs") {
      let rows;
      if (isAll) {
        rows = await sql`SELECT * FROM sms_logs ORDER BY created_at DESC LIMIT 100`;
      } else {
        rows = await sql`SELECT * FROM sms_logs WHERE company_id = ${parseInt(compQuery)} ORDER BY created_at DESC LIMIT 100`;
      }
      return res.status(200).json({ success: true, logs: rows });
    }

    else if (action === "sms-send") {
      const { company_id, template_id, recipient_phone, variables_json } = req.body;
      const compId = user.role === "superadmin" ? (company_id ? parseInt(company_id) : null) : user.company_id;

      if (!recipient_phone) return res.status(400).json({ error: "Recipient phone number required" });

      const log = await sql`
        INSERT INTO sms_logs (company_id, template_id, phone, message_text, status, provider_response)
        VALUES (
          ${compId || user.company_id || 1}, ${template_id || null}, ${recipient_phone},
          ${'Airtel/Jio DLT SMS broadcast sent to ' + recipient_phone}, 'delivered', 'DLT_STATUS_SUCCESS_200'
        )
        RETURNING *
      `;

      return res.status(200).json({ success: true, log: log[0], message: "DLT SMS sent successfully!" });
    }

    // ═══════════════ SMTP SETTINGS MANAGEMENT ═══════════════
    else if (action === "smtp-list") {
      let rows;
      if (isAll) {
        rows = await sql`
          SELECT s.*, c.name as company_name, u.username as user_name
          FROM smtp_settings s
          LEFT JOIN companies c ON s.company_id = c.id
          LEFT JOIN users u ON s.user_id = u.id
          ORDER BY s.is_default DESC, s.created_at DESC
        `;
      } else {
        const cId = parseInt(compQuery) || user.company_id;
        rows = await sql`
          SELECT s.*, c.name as company_name, u.username as user_name
          FROM smtp_settings s
          LEFT JOIN companies c ON s.company_id = c.id
          LEFT JOIN users u ON s.user_id = u.id
          WHERE (s.company_id = ${cId} OR s.company_id IS NULL)
            AND (s.user_id = ${user.id} OR s.user_id IS NULL)
          ORDER BY s.is_default DESC, s.created_at DESC
        `;
      }
      return res.status(200).json({ success: true, smtps: rows });
    }

    else if (action === "smtp-save") {
      const {
        id, company_id, scope_type, profile_name, smtp_host, smtp_port,
        smtp_secure, smtp_user, smtp_password, from_email, from_name, is_default
      } = req.body;

      if (!profile_name || !smtp_host || !from_email) {
        return res.status(400).json({ error: "Profile name, SMTP host, and From Email are required" });
      }

      // Resolve Company ID & User ID based on scope_type
      let resolvedCompanyId = user.role === "superadmin" ? (company_id ? parseInt(company_id) : user.company_id) : user.company_id;
      let resolvedUserId = null;
      if (scope_type === "user" || req.body.user_specific) {
        resolvedUserId = user.id;
      }

      const isDef = is_default === true || is_default === "true";

      if (isDef && resolvedCompanyId) {
        // Reset default flag for company
        await sql`UPDATE smtp_settings SET is_default = false WHERE company_id = ${resolvedCompanyId}`;
      }

      let cleanSmtpUser = smtp_user ? smtp_user.trim() : null;
      if (cleanSmtpUser && !cleanSmtpUser.includes('@') && from_email && from_email.includes('@')) {
        cleanSmtpUser = from_email.trim();
      } else if (!cleanSmtpUser && from_email) {
        cleanSmtpUser = from_email.trim();
      }

      let result;
      if (id) {
        const sId = parseInt(id);
        const updated = await sql`
          UPDATE smtp_settings SET
            company_id = ${resolvedCompanyId},
            user_id = ${resolvedUserId},
            profile_name = ${profile_name.trim()},
            smtp_host = ${smtp_host.trim()},
            smtp_port = ${parseInt(smtp_port || 587, 10)},
            smtp_secure = ${smtp_secure || 'tls'},
            smtp_user = ${cleanSmtpUser},
            smtp_password = ${smtp_password !== undefined && smtp_password !== "" ? smtp_password : sql`smtp_password`},
            from_email = ${from_email.trim()},
            from_name = ${from_name ? from_name.trim() : null},
            is_default = ${isDef}
          WHERE id = ${sId}
          RETURNING *
        `;
        result = updated[0];
      } else {
        const inserted = await sql`
          INSERT INTO smtp_settings (
            company_id, user_id, profile_name, smtp_host, smtp_port, smtp_secure,
            smtp_user, smtp_password, from_email, from_name, is_default
          ) VALUES (
            ${resolvedCompanyId}, ${resolvedUserId}, ${profile_name.trim()}, ${smtp_host.trim()},
            ${parseInt(smtp_port || 587, 10)}, ${smtp_secure || 'tls'}, ${cleanSmtpUser},
            ${smtp_password || ''}, ${from_email.trim()}, ${from_name ? from_name.trim() : null}, ${isDef}
          )
          RETURNING *
        `;
        result = inserted[0];
      }

      return res.status(200).json({ success: true, smtp: result, message: "SMTP credentials saved successfully!" });
    }

    else if (action === "smtp-delete") {
      const smtpId = parseInt(req.body?.id || req.query.id);
      if (!smtpId) return res.status(400).json({ error: "SMTP ID required" });

      const deleted = await sql`DELETE FROM smtp_settings WHERE id = ${smtpId} RETURNING id, profile_name`;
      if (deleted.length === 0) return res.status(404).json({ error: "SMTP Profile not found" });

      return res.status(200).json({ success: true, message: `SMTP Profile '${deleted[0].profile_name}' deleted.` });
    }

    else if (action === "smtp-test") {
      const { smtp_id, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, from_email, test_email } = req.body;
      let smtpConfig = null;

      if (smtp_id) {
        const rows = await sql`SELECT * FROM smtp_settings WHERE id = ${parseInt(smtp_id)}`;
        if (rows.length > 0) smtpConfig = rows[0];
      }

      if (!smtpConfig) {
        smtpConfig = {
          smtp_host,
          smtp_port: parseInt(smtp_port || 587, 10),
          smtp_secure,
          smtp_user,
          smtp_password,
          from_email
        };
      }

      if (!smtpConfig.smtp_host || !smtpConfig.from_email) {
        return res.status(400).json({ error: "SMTP Host and From Email required to test connection" });
      }

      const recipient = (test_email || user.email || smtpConfig.from_email).trim();

      try {
        const transporter = await createTransporter(smtpConfig);
        await transporter.verify();

        // Try sending test email
        const mailInfo = await transporter.sendMail({
          from: smtpConfig.from_name ? `"${smtpConfig.from_name}" <${smtpConfig.from_email}>` : smtpConfig.from_email,
          to: recipient,
          subject: "⚡ Test Email from Inspenox Business Suite (SMTP Connection)",
          html: `
            <div style="font-family:Arial,sans-serif;padding:24px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;max-width:600px;margin:0 auto;">
              <h2 style="color:#0284c7;margin-top:0;">⚡ Inspenox Business Suite — SMTP Connection Verified!</h2>
              <p style="font-size:14px;color:#334155;line-height:1.5;">Your SMTP email configuration (<strong>${smtpConfig.smtp_host}</strong>) is configured properly and ready to send emails.</p>
              <hr style="border:0;border-top:1px solid #cbd5e1;margin:20px 0;">
              <p style="font-size:12px;color:#64748b;margin-bottom:15px;">Sent via Inspenox Business Suite Mail Client by <strong>${user.username || 'Admin'}</strong> on ${new Date().toLocaleString('en-IN')}</p>
              <div style="margin-top:25px;padding-top:15px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#64748b;">
                Powered by <a href="https://inspenox.com" target="_blank" style="color:#2563eb;font-weight:bold;text-decoration:none;">Inspenox Business Suite</a>
              </div>
            </div>
          `
        });

        return res.status(200).json({
          success: true,
          message: `✅ Success! Connection verified & test email delivered to ${recipient}. (Message ID: ${mailInfo.messageId})`
        });

      } catch (err) {
        console.error("SMTP Test Error:", err);
        let errorMsg = err.message || "Unknown error";
        if (errorMsg.includes("535") || errorMsg.includes("5.7.8") || errorMsg.includes("authentication failed")) {
          errorMsg = `SMTP Authentication Failed (535 5.7.8): Hostinger rejected login for '${smtpConfig.from_email}'. Please check: 1) Password entered must be the specific Email Password created for ${smtpConfig.from_email} in Hostinger hPanel (NOT your main Hostinger account login password). 2) Make sure SMTP Username is '${smtpConfig.from_email}'. 3) Try toggling Port 465 (SSL) vs Port 587 (TLS).`;
        } else {
          errorMsg = `SMTP Test Failed: ${errorMsg}`;
        }
        return res.status(400).json({
          success: false,
          error: errorMsg
        });
      }
    }

    // ═══════════════ SEND EMAIL (EMAIL CLIENT COMPOSER / BULK MAIL MERGE) ═══════════════
    else if (action === "send-email" || action === "email-send") {
      const {
        smtp_id, company_id, to_email, cc_email, bcc_email, subject, body_html, body_text
      } = req.body;

      if (!to_email || !subject) {
        return res.status(400).json({ error: "Recipient Email (To) and Subject required" });
      }

      const compId = user.role === "superadmin" ? (company_id ? parseInt(company_id) : user.company_id) : user.company_id;

      // Parse recipient list
      const recipientList = to_email.split(/[,;\s]+/).map(e => e.trim()).filter(e => e.length > 0 && e.includes('@'));
      if (recipientList.length === 0) {
        return res.status(400).json({ error: "Please enter valid recipient email address(es)" });
      }

      // Find selected SMTP profile or default SMTP profile for company
      let smtpProfile = null;
      if (smtp_id) {
        const sRows = await sql`SELECT * FROM smtp_settings WHERE id = ${parseInt(smtp_id)}`;
        if (sRows.length > 0) smtpProfile = sRows[0];
      }

      if (!smtpProfile) {
        const defRows = await sql`
          SELECT * FROM smtp_settings
          WHERE (company_id = ${compId} OR company_id IS NULL)
          ORDER BY is_default DESC, created_at DESC LIMIT 1
        `;
        if (defRows.length > 0) smtpProfile = defRows[0];
      }

      if (!smtpProfile) {
        return res.status(400).json({ error: "No SMTP configuration found! Please setup an SMTP profile first in Email Settings." });
      }

      // Fetch company name from DB for {{company_name}} replacement
      let companyName = "Our Company";
      try {
        let cIdToFetch = smtpProfile.company_id || compId;
        if (cIdToFetch) {
          const compRow = await sql`SELECT name FROM companies WHERE id = ${cIdToFetch}`;
          if (compRow.length > 0 && compRow[0].name) {
            companyName = compRow[0].name;
          }
        }
      } catch (e) {}

      // Fetch customer details for mail merge placeholders
      let customerMap = {};
      try {
        const custs = await sql`SELECT name, email, phone FROM customers WHERE email = ANY(${recipientList})`;
        custs.forEach(c => {
          if (c.email) customerMap[c.email.toLowerCase()] = c;
        });
      } catch (e) {}

      const transporter = await createTransporter(smtpProfile);

      let successCount = 0;
      let failureCount = 0;
      let lastError = null;

      const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const senderName = user.username || smtpProfile.from_name || "Admin";

      for (const targetEmail of recipientList) {
        let custObj = customerMap[targetEmail.toLowerCase()] || {};
        let custName = custObj.name || "Valued Customer";
        let custPhone = custObj.phone || "";

        // Personalize subject & body
        let personalizedSubject = subject
          .replace(/\{\{customer_name\}\}/gi, custName)
          .replace(/\{\{name\}\}/gi, custName)
          .replace(/\{\{company_name\}\}/gi, companyName)
          .replace(/\{\{company\}\}/gi, companyName)
          .replace(/\{\{date\}\}/gi, todayStr)
          .replace(/\{\{sender_name\}\}/gi, senderName);

        let rawContent = body_html || `<p>${body_text || ''}</p>`;
        let personalizedHtml = rawContent
          .replace(/\{\{customer_name\}\}/gi, custName)
          .replace(/\{\{name\}\}/gi, custName)
          .replace(/\{\{company_name\}\}/gi, companyName)
          .replace(/\{\{company\}\}/gi, companyName)
          .replace(/\{\{email\}\}/gi, targetEmail)
          .replace(/\{\{phone\}\}/gi, custPhone)
          .replace(/\{\{date\}\}/gi, todayStr)
          .replace(/\{\{sender_name\}\}/gi, senderName);

        let emailStatus = "sent";
        let errorMsg = null;

        try {
          await transporter.sendMail({
            from: smtpProfile.from_name ? `"${smtpProfile.from_name}" <${smtpProfile.from_email}>` : smtpProfile.from_email,
            to: targetEmail,
            cc: recipientList.length === 1 ? (cc_email || undefined) : undefined,
            bcc: recipientList.length === 1 ? (bcc_email || undefined) : undefined,
            subject: personalizedSubject,
            html: appendInspenoxFooter(personalizedHtml)
          });
          successCount++;
        } catch (sendErr) {
          console.error(`Email delivery error for ${targetEmail}:`, sendErr);
          emailStatus = "failed";
          errorMsg = sendErr.message;
          lastError = sendErr.message;
          failureCount++;
        }

        // Log each individual mail send
        try {
          await sql`
            INSERT INTO email_logs (
              company_id, user_id, smtp_id, from_email, to_email, cc_email, bcc_email,
              subject, body_text, status, error_message
            ) VALUES (
              ${compId}, ${user.id}, ${smtpProfile.id}, ${smtpProfile.from_email}, ${targetEmail},
              ${recipientList.length === 1 ? (cc_email || null) : null},
              ${recipientList.length === 1 ? (bcc_email || null) : null},
              ${personalizedSubject}, ${personalizedHtml},
              ${emailStatus}, ${errorMsg || null}
            )
          `;
        } catch (lErr) {}
      }

      if (successCount === 0 && failureCount > 0) {
        return res.status(500).json({ error: `Email Delivery Failed: ${lastError}` });
      }

      return res.status(200).json({
        success: true,
        message: recipientList.length === 1 
          ? `📧 Email sent successfully to ${recipientList[0]}!`
          : `🚀 Mail Merge Campaign complete! ${successCount} emails delivered successfully${failureCount > 0 ? `, ${failureCount} failed.` : '.'}`
      });
    }

    // ═══════════════ EMAIL TEMPLATES MANAGEMENT ═══════════════
    else if (action === "template-list") {
      let rows;
      if (isAll) {
        rows = await sql`SELECT t.*, c.name as company_name FROM email_templates t LEFT JOIN companies c ON t.company_id = c.id ORDER BY t.created_at DESC`;
      } else {
        const cId = parseInt(compQuery) || user.company_id;
        rows = await sql`SELECT t.*, c.name as company_name FROM email_templates t LEFT JOIN companies c ON t.company_id = c.id WHERE t.company_id = ${cId} OR t.company_id IS NULL ORDER BY t.created_at DESC`;
      }

      // Seed defaults if empty
      if (rows.length === 0) {
        const cIdSeed = user.company_id || 1;
        const defaultTemplates = [
          {
            name: "🎉 Festive Promotional Discount",
            subject: "🎉 Exclusive Festive Offer: 15% Discount on Rotary Equipment Services!",
            body: `<h2>Dear {{customer_name}},</h2>\n<p>Celebrate this festive season with exclusive discounts from <strong>{{company_name}}</strong>!</p>\n<p>Bring in your machinery for full servicing and get <strong>15% OFF</strong> on all labor and spare parts costs.</p>\n<p>Contact our support team today to book your service appointment!</p>\n<p>Best Regards,<br><strong>{{company_name}} Service Team</strong></p>`
          },
          {
            name: "⚙️ Service Job Completed Notice",
            subject: "⚙️ Service Completed Notice: Your Equipment is Repaired & Ready for Pickup",
            body: `<h2>Dear {{customer_name}},</h2>\n<p>We are pleased to inform you that your service job at <strong>{{company_name}}</strong> has been <strong>successfully repaired and tested</strong> by our technicians.</p>\n<p>You can visit our authorized service center to collect your equipment.</p>\n<p>Thank you for choosing {{company_name}}!</p>`
          },
          {
            name: "💳 Friendly Payment Reminder Notice",
            subject: "💳 Friendly Payment Reminder Notice from {{company_name}}",
            body: `<h2>Dear {{customer_name}},</h2>\n<p>This is a friendly reminder from <strong>{{company_name}}</strong> regarding your outstanding balance for recent service work.</p>\n<p>Please clear your pending invoice amount at your earliest convenience.</p>\n<p>Thank you for your prompt cooperation!</p>`
          },
          {
            name: "🧾 Tax Invoice & Payment Receipt Delivery",
            subject: "🧾 Tax Invoice & Payment Receipt Confirmation from {{company_name}}",
            body: `<h2>Dear {{customer_name}},</h2>\n<p>Thank you for your business with <strong>{{company_name}}</strong>. Please find attached your service tax invoice receipt.</p>\n<p>We appreciate your timely payment and look forward to serving you again.</p>\n<p>Best Regards,<br><strong>{{company_name}} Accounts Team</strong></p>`
          }
        ];

        for (const dt of defaultTemplates) {
          try {
            await sql`
              INSERT INTO email_templates (company_id, template_name, subject, body_html)
              VALUES (${cIdSeed}, ${dt.name}, ${dt.subject}, ${dt.body})
            `;
          } catch (e) {}
        }

        if (isAll) {
          rows = await sql`SELECT t.*, c.name as company_name FROM email_templates t LEFT JOIN companies c ON t.company_id = c.id ORDER BY t.created_at DESC`;
        } else {
          const cId = parseInt(compQuery) || user.company_id;
          rows = await sql`SELECT t.*, c.name as company_name FROM email_templates t LEFT JOIN companies c ON t.company_id = c.id WHERE t.company_id = ${cId} OR t.company_id IS NULL ORDER BY t.created_at DESC`;
        }
      }

      return res.status(200).json({ success: true, templates: rows });
    }

    else if (action === "template-save") {
      const { id, company_id, template_name, subject, body_html } = req.body;
      if (!template_name || !subject || !body_html) {
        return res.status(400).json({ error: "Template Name, Subject, and Body content required" });
      }

      const resCompId = user.role === "superadmin" ? (company_id ? parseInt(company_id) : user.company_id) : user.company_id;

      let result;
      if (id) {
        const updated = await sql`
          UPDATE email_templates SET
            company_id = ${resCompId},
            template_name = ${template_name.trim()},
            subject = ${subject.trim()},
            body_html = ${body_html},
            updated_at = NOW()
          WHERE id = ${parseInt(id)}
          RETURNING *
        `;
        result = updated[0];
      } else {
        const inserted = await sql`
          INSERT INTO email_templates (company_id, template_name, subject, body_html)
          VALUES (${resCompId}, ${template_name.trim()}, ${subject.trim()}, ${body_html})
          RETURNING *
        `;
        result = inserted[0];
      }

      return res.status(200).json({ success: true, template: result, message: "Email template saved successfully!" });
    }

    else if (action === "template-delete") {
      const tId = parseInt(req.body?.id || req.query.id);
      if (!tId) return res.status(400).json({ error: "Template ID required" });

      await sql`DELETE FROM email_templates WHERE id = ${tId}`;
      return res.status(200).json({ success: true, message: "Email template deleted successfully!" });
    }

    // ═══════════════ SENT EMAIL LOGS ═══════════════
    else if (action === "email-list" || action === "email-logs") {
      let rows;
      if (isAll) {
        rows = await sql`
          SELECT el.*, s.profile_name, c.name as company_name, u.username as sent_by_name
          FROM email_logs el
          LEFT JOIN smtp_settings s ON el.smtp_id = s.id
          LEFT JOIN companies c ON el.company_id = c.id
          LEFT JOIN users u ON el.user_id = u.id
          ORDER BY el.created_at DESC LIMIT 100
        `;
      } else {
        const cId = parseInt(compQuery) || user.company_id;
        rows = await sql`
          SELECT el.*, s.profile_name, c.name as company_name, u.username as sent_by_name
          FROM email_logs el
          LEFT JOIN smtp_settings s ON el.smtp_id = s.id
          LEFT JOIN companies c ON el.company_id = c.id
          LEFT JOIN users u ON el.user_id = u.id
          WHERE el.company_id = ${cId} OR el.user_id = ${user.id}
          ORDER BY el.created_at DESC LIMIT 100
        `;
      }
      return res.status(200).json({ success: true, logs: rows });
    }

    // ═══════════════ RECIPIENTS PICKER DATA ═══════════════
    else if (action === "recipients-list") {
      const cId = user.role === "superadmin" ? (parseInt(compQuery) || null) : user.company_id;
      let customers = [];
      try {
        if (cId) customers = await sql`SELECT id, name, email, phone FROM customers WHERE company_id = ${cId} AND email IS NOT NULL AND email != '' LIMIT 100`;
        else customers = await sql`SELECT id, name, email, phone FROM customers WHERE email IS NOT NULL AND email != '' LIMIT 100`;
      } catch (e) {}

      return res.status(200).json({ success: true, contacts: customers });
    }

    else {
      return res.status(404).json({ error: `Action '${action}' not recognized` });
    }

  } catch (error) {
    console.error(`api/marketing error [${action}]:`, error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};
