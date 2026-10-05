const { getSQL } = require("../shared/db");
const jwt = require("jsonwebtoken");

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

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized. Please login." });

  const sql = getSQL();
  const action = req.query.action || req.body?.action || "capital-get";

  try {
    const compQuery = req.query.company_id || user.company_id;
    const isAll = !compQuery || compQuery === "all" || isNaN(parseInt(compQuery));

    // ═══════════════ CAPITAL MANAGEMENT ═══════════════
    if (action === "capital-get") {
      let rows;
      if (isAll) {
        rows = await sql`
          SELECT ce.*, c.name as company_name, u.username as changed_by_user
          FROM capital_entries ce
          LEFT JOIN companies c ON ce.company_id = c.id
          LEFT JOIN users u ON ce.changed_by = u.id
          ORDER BY ce.created_at DESC
        `;
      } else {
        rows = await sql`
          SELECT ce.*, c.name as company_name, u.username as changed_by_user
          FROM capital_entries ce
          LEFT JOIN companies c ON ce.company_id = c.id
          LEFT JOIN users u ON ce.changed_by = u.id
          WHERE ce.company_id = ${parseInt(compQuery)}
          ORDER BY ce.created_at DESC
        `;
      }
      return res.status(200).json({ success: true, capital_history: rows });
    }

    else if (action === "capital-set") {
      const { company_id, new_value, reason, auditor_report } = req.body;
      const compId = user.role === "superadmin" ? (company_id ? parseInt(company_id) : null) : user.company_id;

      if (!compId || !new_value) return res.status(400).json({ error: "Company ID and new_value required" });
      if (!auditor_report || !auditor_report.trim()) return res.status(400).json({ error: "Auditor Report file upload is mandatory!" });

      // Ensure auditor_report_attachment column exists
      try { await sql`ALTER TABLE capital_entries ADD COLUMN IF NOT EXISTS auditor_report_attachment TEXT`; } catch (e) {}

      // Check if capital editing is enabled for this company
      const compInfo = await sql`SELECT capital_editable FROM companies WHERE id = ${compId}`;
      if (compInfo.length > 0 && !compInfo[0].capital_editable && user.role !== 'superadmin') {
        return res.status(403).json({ error: "Capital editing is locked by Superadmin for this company." });
      }

      // Fetch last capital value
      const last = await sql`
        SELECT new_value FROM capital_entries WHERE company_id = ${compId} ORDER BY id DESC LIMIT 1
      `;
      const oldValue = last.length > 0 ? parseFloat(last[0].new_value) : 0;

      const entry = await sql`
        INSERT INTO capital_entries (company_id, old_value, new_value, effective_date, reason, auditor_report_attachment, changed_by)
        VALUES (${compId}, ${oldValue}, ${parseFloat(new_value)}, CURRENT_DATE, ${reason || 'Capital adjustment'}, ${auditor_report}, ${user.id})
        RETURNING *
      `;

      return res.status(200).json({ success: true, capital: entry[0], message: "Working capital updated successfully" });
    }

    // ═══════════════ EXPENSES MANAGEMENT ═══════════════
    else if (action === "expenses-list") {
      // Auto-sync any released lead incentives into expenses table
      try {
        await sql`
          INSERT INTO expenses (
            company_id, expense_date, category, dealer_receiver, amount, payment_mode,
            description, receipt_number, approval_status, created_by
          )
          SELECT 
            s.company_id, 
            COALESCE(s.incentive_release_date, s.created_at, CURRENT_DATE), 
            'Lead Incentives', 
            COALESCE(NULLIF(TRIM(s.lead_generated_by), ''), 'Lead Generator'), 
            s.lead_incentive_amount, 
            'bank', 
            'Lead Sales Incentive Release for ' || COALESCE(NULLIF(TRIM(s.lead_generated_by), ''), 'Lead Generator') || ' (DC/Inv #' || COALESCE(s.challan_number, s.id::text) || ')', 
            'EXP-INC-' || s.id, 
            'approved', 
            s.incentive_released_by
          FROM sales s
          WHERE s.incentive_released = true 
            AND s.lead_incentive_amount > 0
            AND NOT EXISTS (
              SELECT 1 FROM expenses e WHERE e.receipt_number = 'EXP-INC-' || s.id
            )
        `;
      } catch (syncErr) {
        console.error("Expense auto-sync error:", syncErr.message);
      }

      let rows;
      if (isAll) {
        rows = await sql`
          SELECT e.*, c.name as company_name, u.username as created_by_user
          FROM expenses e
          LEFT JOIN companies c ON e.company_id = c.id
          LEFT JOIN users u ON e.created_by = u.id
          ORDER BY e.expense_date DESC
        `;
      } else {
        rows = await sql`
          SELECT e.*, c.name as company_name, u.username as created_by_user
          FROM expenses e
          LEFT JOIN companies c ON e.company_id = c.id
          LEFT JOIN users u ON e.created_by = u.id
          WHERE e.company_id = ${parseInt(compQuery)}
          ORDER BY e.expense_date DESC
        `;
      }
      return res.status(200).json({ success: true, expenses: rows });
    }

    else if (action === "expense-create") {
      const {
        company_id, expense_date, category, dealer_receiver, amount, payment_mode, description
      } = req.body;

      const compId = user.role === "superadmin" ? (company_id ? parseInt(company_id) : null) : user.company_id;
      if (!compId || !category || !amount) {
        return res.status(400).json({ error: "Company, Category, and Amount required" });
      }

      const receiptNo = "EXP-" + Date.now().toString().slice(-6);

      const exp = await sql`
        INSERT INTO expenses (
          company_id, expense_date, category, dealer_receiver, amount, payment_mode,
          description, receipt_number, approval_status, created_by
        ) VALUES (
          ${compId}, ${expense_date || 'NOW()'}, ${category}, ${dealer_receiver || null},
          ${parseFloat(amount)}, ${payment_mode || 'cash'}, ${description || null},
          ${receiptNo}, 'approved', ${user.id}
        )
        RETURNING *
      `;

      return res.status(200).json({ success: true, expense: exp[0], message: "Expense recorded successfully" });
    }

    else if (action === "expense-update") {
      if (user.role !== "superadmin") {
        return res.status(403).json({ error: "Access denied. Only Superadmin can edit expenses." });
      }
      const { id, category, dealer_receiver, amount, payment_mode, description } = req.body;
      const expId = parseInt(id);
      if (!expId) return res.status(400).json({ error: "Expense ID required" });

      const updated = await sql`
        UPDATE expenses SET
          category = COALESCE(${category}, category),
          dealer_receiver = ${dealer_receiver || null},
          amount = ${parseFloat(amount || 0)},
          payment_mode = ${payment_mode || 'cash'},
          description = ${description || null}
        WHERE id = ${expId}
        RETURNING *
      `;

      return res.status(200).json({ success: true, expense: updated[0], message: "Expense updated successfully!" });
    }

    else if (action === "expense-delete") {
      if (user.role !== "superadmin") {
        return res.status(403).json({ error: "Access denied. Only Superadmin can delete expenses." });
      }
      const expId = parseInt(req.query.id || req.body?.id);
      if (!expId) return res.status(400).json({ error: "Expense ID required" });

      const deleted = await sql`DELETE FROM expenses WHERE id = ${expId} RETURNING *`;
      if (deleted.length === 0) return res.status(404).json({ error: "Expense entry not found" });

      return res.status(200).json({ success: true, message: "Expense deleted successfully!" });
    }

    // ═══════════════ LOANS MANAGEMENT ═══════════════
    else if (action === "loans-list") {
      let rows;
      if (isAll) {
        rows = await sql`SELECT l.*, c.name as company_name FROM loans l LEFT JOIN companies c ON l.company_id = c.id ORDER BY l.created_at DESC`;
      } else {
        rows = await sql`SELECT l.*, c.name as company_name FROM loans l LEFT JOIN companies c ON l.company_id = c.id WHERE l.company_id = ${parseInt(compQuery)} ORDER BY l.created_at DESC`;
      }
      return res.status(200).json({ success: true, loans: rows });
    }

    else if (action === "loan-create") {
      const {
        company_id, lender_name, loan_type, principal_amount, interest_rate, tenure_months, emi_amount
      } = req.body;

      const compId = user.role === "superadmin" ? (company_id ? parseInt(company_id) : null) : user.company_id;
      if (!compId || !lender_name || !principal_amount) {
        return res.status(400).json({ error: "Company, Lender Name, and Principal Amount required" });
      }

      const loan = await sql`
        INSERT INTO loans (
          company_id, lender_name, loan_type, principal_amount, disbursed_amount,
          interest_rate, tenure_months, emi_amount, outstanding_principal, status
        ) VALUES (
          ${compId}, ${lender_name}, ${loan_type || 'business_loan'}, ${parseFloat(principal_amount)},
          ${parseFloat(principal_amount)}, ${parseFloat(interest_rate || 0)}, ${parseInt(tenure_months || 12)},
          ${parseFloat(emi_amount || 0)}, ${parseFloat(principal_amount)}, 'active'
        )
        RETURNING *
      `;

      return res.status(200).json({ success: true, loan: loan[0], message: "Business loan recorded" });
    }

    // ═══════════════ BANK ACCOUNTS MANAGEMENT ═══════════════
    else if (action === "bank-accounts-list") {
      let rows;
      if (isAll) {
        rows = await sql`
          SELECT b.*, c.name as company_name
          FROM bank_accounts b
          LEFT JOIN companies c ON b.company_id = c.id
          ORDER BY b.is_primary DESC, b.created_at DESC
        `;
      } else {
        rows = await sql`
          SELECT b.*, c.name as company_name
          FROM bank_accounts b
          LEFT JOIN companies c ON b.company_id = c.id
          WHERE b.company_id = ${parseInt(compQuery)}
          ORDER BY b.is_primary DESC, b.created_at DESC
        `;
      }
      return res.status(200).json({ success: true, bank_accounts: rows });
    }

    else if (action === "bank-account-create") {
      const {
        company_id, bank_name, account_name, account_number, ifsc_code,
        branch_name, branch_address, account_type, opening_balance, current_balance,
        upi_id, is_primary
      } = req.body;

      const compId = user.role === "superadmin" ? (company_id ? parseInt(company_id) : (user.company_id || 1)) : (user.company_id || 1);
      if (!compId || !bank_name || !account_number || !ifsc_code) {
        return res.status(400).json({ error: "Company, Bank Name, Account Number, and IFSC Code are required" });
      }

      const openBal = parseFloat(opening_balance || 0);
      const currBal = current_balance !== undefined && current_balance !== null ? parseFloat(current_balance) : openBal;
      const isPri = !!is_primary;

      if (isPri) {
        await sql`UPDATE bank_accounts SET is_primary = false WHERE company_id = ${compId}`;
      }

      const account = await sql`
        INSERT INTO bank_accounts (
          company_id, bank_name, account_name, account_number, ifsc_code,
          branch_name, branch_address, account_type, opening_balance, current_balance,
          upi_id, is_primary, is_active
        ) VALUES (
          ${compId}, ${bank_name.trim()}, ${account_name ? account_name.trim() : null}, ${account_number.trim()},
          ${ifsc_code.trim().toUpperCase()}, ${branch_name ? branch_name.trim() : null}, ${branch_address ? branch_address.trim() : null},
          ${account_type || 'Current'}, ${openBal}, ${currBal},
          ${upi_id ? upi_id.trim() : null}, ${isPri}, true
        )
        RETURNING *
      `;

      return res.status(200).json({ success: true, bank_account: account[0], message: "Bank account created successfully!" });
    }

    else if (action === "bank-account-update") {
      const {
        id, bank_name, account_name, account_number, ifsc_code,
        branch_name, branch_address, account_type, opening_balance, current_balance,
        upi_id, is_primary, is_active
      } = req.body;

      const accId = parseInt(id);
      if (!accId) return res.status(400).json({ error: "Bank Account ID required" });

      const existing = await sql`SELECT * FROM bank_accounts WHERE id = ${accId}`;
      if (existing.length === 0) return res.status(404).json({ error: "Bank account not found" });

      const compId = existing[0].company_id;
      const isPri = is_primary !== undefined ? !!is_primary : existing[0].is_primary;

      if (isPri && !existing[0].is_primary) {
        await sql`UPDATE bank_accounts SET is_primary = false WHERE company_id = ${compId}`;
      }

      const updated = await sql`
        UPDATE bank_accounts SET
          bank_name = COALESCE(${bank_name ? bank_name.trim() : null}, bank_name),
          account_name = ${account_name !== undefined ? (account_name ? account_name.trim() : null) : existing[0].account_name},
          account_number = COALESCE(${account_number ? account_number.trim() : null}, account_number),
          ifsc_code = COALESCE(${ifsc_code ? ifsc_code.trim().toUpperCase() : null}, ifsc_code),
          branch_name = ${branch_name !== undefined ? (branch_name ? branch_name.trim() : null) : existing[0].branch_name},
          branch_address = ${branch_address !== undefined ? (branch_address ? branch_address.trim() : null) : existing[0].branch_address},
          account_type = COALESCE(${account_type}, account_type),
          opening_balance = ${opening_balance !== undefined ? parseFloat(opening_balance || 0) : existing[0].opening_balance},
          current_balance = ${current_balance !== undefined ? parseFloat(current_balance || 0) : existing[0].current_balance},
          upi_id = ${upi_id !== undefined ? (upi_id ? upi_id.trim() : null) : existing[0].upi_id},
          is_primary = ${isPri},
          is_active = ${is_active !== undefined ? !!is_active : existing[0].is_active},
          updated_at = NOW()
        WHERE id = ${accId}
        RETURNING *
      `;

      return res.status(200).json({ success: true, bank_account: updated[0], message: "Bank account updated successfully!" });
    }

    else if (action === "bank-account-adjust-balance") {
      const { id, new_balance, adjustment_type, adjustment_amount, reason } = req.body;
      const accId = parseInt(id);
      if (!accId) return res.status(400).json({ error: "Bank Account ID required" });

      const existing = await sql`SELECT * FROM bank_accounts WHERE id = ${accId}`;
      if (existing.length === 0) return res.status(404).json({ error: "Bank account not found" });

      let updatedBalance = parseFloat(existing[0].current_balance || 0);
      if (new_balance !== undefined && new_balance !== null && new_balance !== "") {
        updatedBalance = parseFloat(new_balance);
      } else if (adjustment_amount) {
        const amt = parseFloat(adjustment_amount);
        if (adjustment_type === "add" || adjustment_type === "credit") updatedBalance += amt;
        else if (adjustment_type === "subtract" || adjustment_type === "debit") updatedBalance -= amt;
      }

      const updated = await sql`
        UPDATE bank_accounts SET
          current_balance = ${updatedBalance},
          updated_at = NOW()
        WHERE id = ${accId}
        RETURNING *
      `;

      try {
        await sql`
          INSERT INTO audit_logs (company_id, user_id, action, module, entity, record_id, old_value_json, new_value_json, reason)
          VALUES (${existing[0].company_id}, ${user.id}, 'ADJUST_BALANCE', 'Accountant', 'bank_accounts', ${accId},
            ${JSON.stringify({ current_balance: existing[0].current_balance })},
            ${JSON.stringify({ current_balance: updatedBalance })},
            ${reason || 'Direct balance adjustment from settings'})
        `;
      } catch (e) {}

      return res.status(200).json({ success: true, bank_account: updated[0], message: "Bank balance adjusted successfully!" });
    }

    else if (action === "bank-account-delete") {
      const accId = parseInt(req.query.id || req.body?.id);
      if (!accId) return res.status(400).json({ error: "Bank Account ID required" });

      const deleted = await sql`DELETE FROM bank_accounts WHERE id = ${accId} RETURNING *`;
      if (deleted.length === 0) return res.status(404).json({ error: "Bank account not found" });

      return res.status(200).json({ success: true, message: "Bank account removed successfully!" });
    }

    else {
      return res.status(404).json({ error: `Action '${action}' not recognized` });
    }

  } catch (error) {
    console.error(`api/accountant error [${action}]:`, error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};
