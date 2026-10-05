const { getSQL } = require("../shared/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

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

function getCompanyCodePrefix(companyName) {
  if (!companyName) return "COMP";
  const clean = String(companyName).toUpperCase().replace(/[^A-Z]/g, '');
  if (clean.length >= 4) {
    return clean.slice(0, 4);
  } else if (clean.length > 0) {
    return clean.padEnd(4, 'X');
  }
  return "COMP";
}
async function ensureDealersColumns(sql) {
  try {
    await sql`ALTER TABLE dealers ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255);`;
    await sql`ALTER TABLE dealers ADD COLUMN IF NOT EXISTS bank_account_no VARCHAR(100);`;
    await sql`ALTER TABLE dealers ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(20);`;
    await sql`ALTER TABLE dealers ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(255);`;
    await sql`ALTER TABLE dealers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE dealers ADD COLUMN IF NOT EXISTS credit_period_days INT DEFAULT 0;`;
    await sql`ALTER TABLE dealers ADD COLUMN IF NOT EXISTS credit_interest_rate NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE dealers ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE dealers ADD COLUMN IF NOT EXISTS opening_balance_type VARCHAR(20) DEFAULT 'payable';`;
    await sql`ALTER TABLE dealers ADD COLUMN IF NOT EXISTS opening_balance_date DATE;`;
    await sql`ALTER TABLE dealers ADD COLUMN IF NOT EXISTS opening_balance_notes TEXT;`;
    await sql`ALTER TABLE dealers ADD COLUMN IF NOT EXISTS opening_balance_doc TEXT;`;
  } catch (e) {
    // Ignore migration error if columns exist
  }
}

async function generateNextEmpCode(sql, companyId) {
  if (!companyId) companyId = 1;
  const compRows = await sql`SELECT name FROM companies WHERE id = ${companyId}`;
  const compName = compRows.length > 0 ? compRows[0].name : "COMP";
  const prefix = getCompanyCodePrefix(compName);
  const fullPrefix = `${prefix}-EMP-`;

  const empCodes = await sql`
    SELECT employee_code FROM employees
    WHERE company_id = ${companyId} AND employee_code IS NOT NULL
  `;

  let maxNum = 0;
  for (const row of empCodes) {
    const code = String(row.employee_code || '').trim();
    const match = code.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  const paddedNum = String(nextNum).padStart(3, '0');
  return `${fullPrefix}${paddedNum}`;
}

async function backfillEmployeeCodes(sql) {
  try {
    const companies = await sql`SELECT id, name FROM companies ORDER BY id ASC`;
    for (const comp of companies) {
      const prefix = getCompanyCodePrefix(comp.name);
      const expectedPrefix = `${prefix}-EMP-`;
      const emps = await sql`
        SELECT id, employee_code FROM employees
        WHERE company_id = ${comp.id}
        ORDER BY id ASC
      `;

      let seq = 1;
      for (const emp of emps) {
        if (!emp.employee_code || !emp.employee_code.startsWith(expectedPrefix)) {
          const expectedCode = `${expectedPrefix}${String(seq).padStart(3, '0')}`;
          await sql`UPDATE employees SET employee_code = ${expectedCode} WHERE id = ${emp.id}`;
        } else {
          const match = String(emp.employee_code).match(/(\d+)$/);
          if (match) {
            const currentNum = parseInt(match[1], 10);
            if (!isNaN(currentNum) && currentNum >= seq) {
              seq = currentNum;
            }
          }
        }
        seq++;
      }
    }
  } catch (err) {
    console.error("Backfill employee codes error:", err);
  }
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized. Please login." });

  const sql = getSQL();
  const action = req.query.action || req.body?.action || "list";

  try {
    const isSuper = (user.role === 'superadmin' || user.username === 'superadmin');
    const compQuery = isSuper ? (req.query.company_id || req.body?.company_id || "all") : (user.company_id || 1);
    const isAll = isSuper && (!compQuery || compQuery === "all" || isNaN(parseInt(compQuery)));

    // ═══════════════ EMPLOYEES ═══════════════
    if (action === "list") {
      // Auto-repair and auto-sync system registered users into employees table
      try {
        // Step A: Disambiguate users incorrectly pointing to an employee record owned by someone else
        await sql`
          UPDATE users SET employee_id = NULL
          WHERE id IN (
            SELECT u.id FROM users u
            JOIN employees e ON u.employee_id = e.id
            WHERE e.user_id IS NOT NULL AND e.user_id != u.id
          )
        `;

        // Step B: Set employees.user_id for correctly linked users
        await sql`
          UPDATE employees SET user_id = u.id
          FROM users u
          WHERE u.employee_id = employees.id AND employees.user_id IS NULL
        `;

        // Step C: Backfill and format employee codes (e.g. MANA-EMP-001)
        await backfillEmployeeCodes(sql);

      } catch (syncErr) {
        console.error("Auto-sync unlinked users error:", syncErr);
      }

      let rows;
      if (isAll) {
        rows = await sql`
          SELECT e.*, c.name as company_name, m.name as manager_name,
                 u.id as sys_user_id, u.role as user_role, u.is_active as sys_user_active, u.username as sys_username
          FROM employees e
          LEFT JOIN companies c ON e.company_id = c.id
          LEFT JOIN employees m ON e.reporting_manager_id = m.id
          LEFT JOIN users u ON (e.user_id = u.id OR u.employee_id = e.id)
          WHERE LOWER(COALESCE(e.name, '')) != 'superadmin'
            AND LOWER(COALESCE(e.department, '')) != 'superadmin'
            AND (u.role IS NULL OR LOWER(u.role) != 'superadmin')
          ORDER BY e.created_at DESC
        `;
      } else {
        const cId = parseInt(compQuery);
        rows = await sql`
          SELECT e.*, c.name as company_name, m.name as manager_name,
                 u.id as sys_user_id, u.role as user_role, u.is_active as sys_user_active, u.username as sys_username
          FROM employees e
          LEFT JOIN companies c ON e.company_id = c.id
          LEFT JOIN employees m ON e.reporting_manager_id = m.id
          LEFT JOIN users u ON (e.user_id = u.id OR u.employee_id = e.id)
          WHERE e.company_id = ${cId}
            AND LOWER(COALESCE(e.name, '')) != 'superadmin'
          ORDER BY e.created_at DESC
        `;
      }
      return res.status(200).json({ success: true, employees: rows });
    }

    else if (action === "create") {
      const {
        company_id, employee_code, name, phone, email, address, joining_date,
        department, designation, reporting_manager_id, employment_type, basic_salary,
        bank_name, bank_account, bank_ifsc, statutory_json
      } = req.body;

      const isSuper = (user.role === 'superadmin' || user.username === 'superadmin');
      if (!isSuper) {
        const deptStr = (department || '').toLowerCase().trim();
        const desigStr = (designation || '').toLowerCase().trim();
        if (deptStr === 'superadmin' || desigStr === 'superadmin') {
          return res.status(403).json({ error: "Superadmin records can only be created by Superadmin." });
        }
      }

      const compId = isSuper ? (company_id && !isNaN(parseInt(company_id)) ? parseInt(company_id) : (user.company_id || 1)) : (user.company_id || 1);
      if (!compId || !name) return res.status(400).json({ error: "Company ID and Name are required" });

      // Anti-double-submission check: prevent creating exact same employee within 5 seconds
      const duplicateCheck = await sql`
        SELECT id FROM employees
        WHERE company_id = ${compId}
          AND LOWER(TRIM(name)) = LOWER(TRIM(${name}))
          AND (phone IS NOT NULL AND phone = ${phone || null})
          AND created_at > NOW() - INTERVAL '5 seconds'
      `;
      if (duplicateCheck.length > 0) {
        return res.status(400).json({ error: "Duplicate submission detected. Employee is already created." });
      }

      let finalEmpCode = employee_code ? employee_code.trim() : "";
      if (!finalEmpCode || finalEmpCode === 'EMP-001' || finalEmpCode.startsWith('EMP-')) {
        finalEmpCode = await generateNextEmpCode(sql, compId);
      }

      const newEmp = await sql`
        INSERT INTO employees (
          company_id, employee_code, name, phone, email, address, joining_date,
          department, designation, reporting_manager_id, employment_type, basic_salary,
          bank_name, bank_account, bank_ifsc, statutory_json
        ) VALUES (
          ${compId}, ${finalEmpCode}, ${name}, ${phone || null}, ${email || null},
          ${address || null}, ${joining_date || null}, ${department || null}, ${designation || null},
          ${reporting_manager_id ? parseInt(reporting_manager_id) : null}, ${employment_type || 'full_time'},
          ${basic_salary ? parseFloat(basic_salary) : 0}, ${bank_name || null}, ${bank_account || null},
          ${bank_ifsc || null}, ${typeof statutory_json === 'object' ? JSON.stringify(statutory_json) : (statutory_json || null)}
        )
        RETURNING *
      `;

      return res.status(200).json({ success: true, employee: newEmp[0], message: "Employee created successfully" });
    }


    else if (action === "update") {
      const { id } = req.query;
      const empId = parseInt(id || req.body?.id);
      if (!empId) return res.status(400).json({ error: "Employee ID required" });

      const isSuper = (user.role === 'superadmin' || user.username === 'superadmin');
      if (!isSuper) {
        const checkEmp = await sql`
          SELECT e.id, e.user_id, e.company_id, e.name, e.department, e.designation, u.role
          FROM employees e
          LEFT JOIN users u ON e.user_id = u.id
          WHERE e.id = ${empId}
        `;
        if (checkEmp.length > 0) {
          const eRec = checkEmp[0];
          if (eRec.company_id !== user.company_id) {
            return res.status(403).json({ error: "Access denied. You can only manage employees in your store." });
          }
          const deptStr = (eRec.department || '').toLowerCase().trim();
          const roleStr = (eRec.role || '').toLowerCase().trim();
          const nameStr = (eRec.name || '').toLowerCase().trim();
          if (nameStr === 'superadmin' || deptStr === 'superadmin' || roleStr === 'superadmin') {
            return res.status(403).json({ error: "Superadmin profiles can only be edited by Superadmin." });
          }
          if ((eRec.user_id && eRec.user_id === user.id) || (user.employee_id && eRec.id === user.employee_id)) {
            return res.status(403).json({ error: "You cannot edit your own employee profile. Please contact Superadmin." });
          }
        }
      }

      const {
        company_id, employee_code, name, phone, email, address, joining_date,
        department, designation, reporting_manager_id, employment_type, employment_status,
        basic_salary, bank_name, bank_account, bank_ifsc
      } = req.body;

      const compIdVal = (company_id && !isNaN(parseInt(company_id))) ? parseInt(company_id) : null;

      const updated = await sql`
        UPDATE employees SET
          company_id = COALESCE(${compIdVal}, company_id),
          employee_code = ${employee_code || null},
          name = ${name},
          phone = ${phone || null},
          email = ${email || null},
          address = ${address || null},
          joining_date = ${joining_date || null},
          department = ${department || null},
          designation = ${designation || null},
          reporting_manager_id = ${reporting_manager_id ? parseInt(reporting_manager_id) : null},
          employment_type = ${employment_type || 'full_time'},
          employment_status = ${employment_status || 'active'},
          basic_salary = ${basic_salary ? parseFloat(basic_salary) : 0},
          bank_name = ${bank_name || null},
          bank_account = ${bank_account || null},
          bank_ifsc = ${bank_ifsc || null},
          updated_at = NOW()
        WHERE id = ${empId}
        RETURNING *
      `;

      return res.status(200).json({ success: true, employee: updated[0], message: "Employee updated successfully" });
    }

    else if (action === "delete") {
      const empId = parseInt(req.query.id || req.body?.id);
      if (!empId) return res.status(400).json({ error: "Employee ID required" });

      const empRows = await sql`
        SELECT e.*, u.role as user_role
        FROM employees e
        LEFT JOIN users u ON e.user_id = u.id
        WHERE e.id = ${empId}
      `;
      if (empRows.length === 0) return res.status(404).json({ error: "Employee record not found" });

      const targetEmp = empRows[0];
      const deptStr = (targetEmp.department || '').toLowerCase().trim();
      const desigStr = (targetEmp.designation || '').toLowerCase().trim();
      const roleStr = (targetEmp.user_role || '').toLowerCase().trim();
      const nameStr = (targetEmp.name || '').toLowerCase().trim();

      if (nameStr === 'superadmin' || deptStr === 'superadmin' || desigStr === 'superadmin' || roleStr === 'superadmin') {
        return res.status(400).json({ error: "Superadmin employee records cannot be deleted." });
      }

      const isSuper = (user.role === 'superadmin' || user.username === 'superadmin');

      if (!isSuper) {
        if (targetEmp.company_id !== user.company_id) {
          return res.status(403).json({ error: "Access denied. You can only delete employees in your assigned store." });
        }
        if ((targetEmp.user_id && targetEmp.user_id === user.id) || (user.employee_id && targetEmp.id === user.employee_id)) {
          return res.status(403).json({ error: "You cannot delete your own employee profile." });
        }
      }

      // Delete any linked user account for this employee so it is not auto-recreated
      let linkedUserIds = [];
      if (targetEmp.user_id) {
        linkedUserIds = await sql`SELECT id FROM users WHERE employee_id = ${empId} OR id = ${targetEmp.user_id}`;
      } else {
        linkedUserIds = await sql`SELECT id FROM users WHERE employee_id = ${empId}`;
      }

      for (const uRow of linkedUserIds) {
        try {
          await sql`DELETE FROM users WHERE id = ${uRow.id}`;
        } catch (uErr) {
          console.error("Error deleting linked user account during employee delete:", uErr);
          await sql`UPDATE users SET employee_id = NULL, is_active = false WHERE id = ${uRow.id}`;
        }
      }

      await sql`DELETE FROM employees WHERE id = ${empId}`;
      return res.status(200).json({ success: true, message: "Employee record deleted successfully" });
    }

    // ═══════════════ ONLINE USER ACCESS MANAGEMENT ═══════════════
    else if (action === "enable-user-access") {
      const { employee_id, username, password, role } = req.body;
      const empId = parseInt(employee_id || req.body?.id);
      if (!empId || !username || !password) {
        return res.status(400).json({ error: "Employee ID, Username, and Password are required" });
      }

      if (password.length < 3) {
        return res.status(400).json({ error: "Password must be at least 3 characters long" });
      }

      const empRows = await sql`
        SELECT e.*, u.id as linked_user_id, u.role as linked_user_role
        FROM employees e
        LEFT JOIN users u ON (e.user_id = u.id OR u.employee_id = e.id)
        WHERE e.id = ${empId}
      `;
      if (empRows.length === 0) return res.status(404).json({ error: "Employee not found" });

      const emp = empRows[0];
      const isSuper = user.role === 'superadmin' || user.username === 'superadmin';
      if (!isSuper && emp.company_id !== user.company_id) {
        return res.status(403).json({ error: "Access denied. Cannot manage users for another store." });
      }

      const deptStr = (emp.department || '').toLowerCase().trim();
      const desigStr = (emp.designation || '').toLowerCase().trim();
      const nameStr = (emp.name || '').toLowerCase().trim();
      if (nameStr === 'superadmin' || deptStr === 'superadmin' || desigStr === 'superadmin') {
        return res.status(403).json({ error: "Superadmin user accounts can only be managed by Superadmin." });
      }

      const cleanUsername = username.trim();
      const existingUser = await sql`
        SELECT id FROM users
        WHERE LOWER(username) = LOWER(${cleanUsername})
          AND (${emp.linked_user_id ? sql`id != ${emp.linked_user_id}` : sql`true`})
      `;
      if (existingUser.length > 0) {
        return res.status(400).json({ error: `Username '${cleanUsername}' is already taken by another user.` });
      }

      const passwordHash = await bcrypt.hash(password.trim(), 10);
      const userRole = role || emp.department || 'staff';

      let userId = emp.linked_user_id;
      if (userId) {
        await sql`
          UPDATE users SET
            username = ${cleanUsername},
            password_hash = ${passwordHash},
            role = ${userRole},
            is_active = true,
            company_id = ${emp.company_id},
            phone = COALESCE(${emp.phone || null}, phone),
            email = COALESCE(${emp.email || null}, email)
          WHERE id = ${userId}
        `;
      } else {
        const newUser = await sql`
          INSERT INTO users (
            company_id, employee_id, username, password_hash, role, is_active, phone, email
          ) VALUES (
            ${emp.company_id}, ${emp.id}, ${cleanUsername}, ${passwordHash}, ${userRole}, true, ${emp.phone || null}, ${emp.email || null}
          )
          RETURNING id
        `;
        userId = newUser[0].id;
        await sql`UPDATE employees SET user_id = ${userId} WHERE id = ${emp.id}`;
      }

      return res.status(200).json({
        success: true,
        user_id: userId,
        username: cleanUsername,
        message: `Online access enabled for ${emp.name}! Username: '${cleanUsername}'`
      });
    }

    else if (action === "disable-user-access") {
      const { employee_id } = req.body;
      const empId = parseInt(employee_id || req.body?.id || req.query?.id);
      if (!empId) return res.status(400).json({ error: "Employee ID required" });

      const empRows = await sql`
        SELECT e.*, u.id as linked_user_id, u.role as user_role, u.username as sys_username
        FROM employees e
        JOIN users u ON (e.user_id = u.id OR u.employee_id = e.id)
        WHERE e.id = ${empId}
      `;
      if (empRows.length === 0) {
        return res.status(404).json({ error: "No system user account found for this employee" });
      }

      const emp = empRows[0];
      const isSuper = user.role === 'superadmin' || user.username === 'superadmin';

      if (!isSuper && emp.company_id !== user.company_id) {
        return res.status(403).json({ error: "Access denied." });
      }

      if ((user.employee_id && parseInt(user.employee_id) === empId) || (emp.linked_user_id === user.id)) {
        return res.status(403).json({ error: "You cannot disable your own active user account." });
      }

      const deptStr = (emp.department || '').toLowerCase().trim();
      const roleStr = (emp.user_role || '').toLowerCase().trim();
      const nameStr = (emp.name || '').toLowerCase().trim();
      if (nameStr === 'superadmin' || deptStr === 'superadmin' || roleStr === 'superadmin') {
        return res.status(403).json({ error: "Superadmin user accounts cannot be disabled." });
      }

      await sql`UPDATE users SET is_active = false WHERE id = ${emp.linked_user_id}`;

      return res.status(200).json({
        success: true,
        message: `Online access disabled for ${emp.name} (${emp.sys_username})`
      });
    }

    // ═══════════════ dealerS (WITH GST DETAILS) ═══════════════

    else if (action === "dealers-list") {
      await ensureDealersColumns(sql);
      let rows;
      if (isAll) {
        rows = await sql`SELECT v.*, c.name as company_name FROM dealers v LEFT JOIN companies c ON v.company_id = c.id ORDER BY v.created_at DESC`;
      } else {
        rows = await sql`SELECT v.*, c.name as company_name FROM dealers v LEFT JOIN companies c ON v.company_id = c.id WHERE v.company_id = ${parseInt(compQuery)} ORDER BY v.created_at DESC`;
      }
      return res.status(200).json({ success: true, dealers: rows });
    }

    else if (action === "dealer-create") {
      await ensureDealersColumns(sql);
      const {
        company_id, dealer_code, legal_name, trade_name, gstin, pan, address, state, state_code,
        contact_person, phone, email, credit_terms,
        bank_name, bank_account_no, bank_ifsc, bank_branch,
        credit_limit, credit_period_days, credit_interest_rate,
        opening_balance, opening_balance_type, opening_balance_date, opening_balance_notes, opening_balance_doc
      } = req.body;

      let compId = (company_id && !isNaN(parseInt(company_id))) ? parseInt(company_id) : (user.company_id || null);
      if (!compId) {
        const firstC = await sql`SELECT id FROM companies ORDER BY id ASC LIMIT 1`;
        if (firstC.length > 0) compId = firstC[0].id;
      }

      if (!compId || !legal_name || !legal_name.trim()) {
        return res.status(400).json({ error: "Company and Legal Name required" });
      }

      const newVen = await sql`
        INSERT INTO dealers (
          company_id, dealer_code, legal_name, trade_name, gstin, pan, address, state, state_code,
          contact_person, phone, email, credit_terms,
          bank_name, bank_account_no, bank_ifsc, bank_branch,
          credit_limit, credit_period_days, credit_interest_rate,
          opening_balance, opening_balance_type, opening_balance_date, opening_balance_notes, opening_balance_doc
        ) VALUES (
          ${compId}, ${dealer_code || null}, ${legal_name.trim()}, ${trade_name ? trade_name.trim() : null}, ${gstin ? gstin.trim() : null},
          ${pan ? pan.trim() : null}, ${address ? address.trim() : null}, ${state ? state.trim() : null}, ${state_code ? state_code.trim() : null},
          ${contact_person ? contact_person.trim() : null}, ${phone ? phone.trim() : null}, ${email ? email.trim() : null}, ${credit_terms ? credit_terms.trim() : null},
          ${bank_name ? bank_name.trim() : null}, ${bank_account_no ? bank_account_no.trim() : null}, ${bank_ifsc ? bank_ifsc.trim() : null}, ${bank_branch ? bank_branch.trim() : null},
          ${credit_limit ? parseFloat(credit_limit) : 0}, ${credit_period_days ? parseInt(credit_period_days) : 0}, ${credit_interest_rate ? parseFloat(credit_interest_rate) : 0},
          ${opening_balance ? parseFloat(opening_balance) : 0}, ${opening_balance_type || 'payable'}, ${opening_balance_date || null}, ${opening_balance_notes ? opening_balance_notes.trim() : null}, ${opening_balance_doc || null}
        )
        RETURNING *
      `;

      return res.status(200).json({ success: true, dealer: newVen[0], message: "dealer created successfully" });
    }

    else if (action === "dealer-update") {
      await ensureDealersColumns(sql);
      const {
        id, company_id, legal_name, trade_name, gstin, pan, address, state, state_code,
        contact_person, phone, email, credit_terms,
        bank_name, bank_account_no, bank_ifsc, bank_branch,
        credit_limit, credit_period_days, credit_interest_rate,
        opening_balance, opening_balance_type, opening_balance_date, opening_balance_notes, opening_balance_doc
      } = req.body;
      const vId = parseInt(id);
      if (!vId || !legal_name || !legal_name.trim()) return res.status(400).json({ error: "dealer ID and Legal Name required" });

      const compId = (company_id && !isNaN(parseInt(company_id))) ? parseInt(company_id) : null;
      const userCompId = parseInt(user.company_id || 0);
      const isSuperAdmin = (user.role === 'superadmin' || user.username === 'superadmin');

      const updated = await sql`
        UPDATE dealers SET
          company_id = COALESCE(${compId}, company_id),
          legal_name = ${legal_name.trim()},
          trade_name = ${trade_name ? trade_name.trim() : null},
          gstin = ${gstin ? gstin.trim() : null},
          pan = ${pan ? pan.trim() : null},
          address = ${address ? address.trim() : null},
          state = ${state ? state.trim() : null},
          state_code = ${state_code ? state_code.trim() : null},
          contact_person = ${contact_person ? contact_person.trim() : null},
          phone = ${phone ? phone.trim() : null},
          email = ${email ? email.trim() : null},
          credit_terms = ${credit_terms ? credit_terms.trim() : null},
          bank_name = ${bank_name ? bank_name.trim() : null},
          bank_account_no = ${bank_account_no ? bank_account_no.trim() : null},
          bank_ifsc = ${bank_ifsc ? bank_ifsc.trim() : null},
          bank_branch = ${bank_branch ? bank_branch.trim() : null},
          credit_limit = ${credit_limit ? parseFloat(credit_limit) : 0},
          credit_period_days = ${credit_period_days ? parseInt(credit_period_days) : 0},
          credit_interest_rate = ${credit_interest_rate ? parseFloat(credit_interest_rate) : 0},
          opening_balance = ${opening_balance ? parseFloat(opening_balance) : 0},
          opening_balance_type = ${opening_balance_type || 'payable'},
          opening_balance_date = ${opening_balance_date || null},
          opening_balance_notes = ${opening_balance_notes ? opening_balance_notes.trim() : null},
          opening_balance_doc = ${opening_balance_doc || null}
        WHERE id = ${vId} AND (company_id = ${userCompId} OR ${isSuperAdmin})
        RETURNING *
      `;

      return res.status(200).json({ success: true, dealer: updated[0], message: "dealer updated successfully" });
    }

    else if (action === "dealer-delete") {
      const isSuper = user.role === 'superadmin' || user.username === 'superadmin';
      if (!isSuper) {
        return res.status(403).json({ error: "Access denied. Only Superadmin can delete dealers." });
      }
      const vId = parseInt(req.body?.id || req.query?.id);
      if (!vId) return res.status(400).json({ error: "dealer ID required" });

      await sql`DELETE FROM dealers WHERE id = ${vId}`;
      return res.status(200).json({ success: true, message: "dealer deleted successfully" });
    }

    // ═══════════════ FINANCERS ═══════════════
    else if (action === "financers-list") {
      let rows;
      if (isAll) {
        rows = await sql`SELECT f.*, c.name as company_name FROM financers f LEFT JOIN companies c ON f.company_id = c.id ORDER BY f.name`;
      } else {
        rows = await sql`SELECT f.*, c.name as company_name FROM financers f LEFT JOIN companies c ON f.company_id = c.id WHERE f.company_id = ${parseInt(compQuery)} ORDER BY f.name`;
      }
      return res.status(200).json({ success: true, financers: rows });
    }

    else if (action === "financer-create") {
      const { company_id, name, type, contact_person, phone, email, address } = req.body;
      const compId = (company_id && company_id !== "all" && !isNaN(parseInt(company_id))) ? parseInt(company_id) : (user.company_id || 1);
      if (!name) return res.status(400).json({ error: "Financer Name required" });

      const newFin = await sql`
        INSERT INTO financers (company_id, name, type, contact_person, phone, email, address)
        VALUES (${compId}, ${name}, ${type || 'finance_company'}, ${contact_person || null}, ${phone || null}, ${email || null}, ${address || null})
        RETURNING *
      `;
      return res.status(200).json({ success: true, financer: newFin[0], message: "Financer added successfully" });
    }

    // ═══════════════ CUSTOMERS ═══════════════
    else if (action === "customers-list") {
      try {
        await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'inquired';`;
        await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS sales_terms VARCHAR(255);`;
      } catch (e) {}

      const now = new Date();
      let fyStartYear = now.getFullYear();
      if (now.getMonth() < 3) fyStartYear -= 1; // Financial year starts in April (Month index 3)
      const fyStartStr = `${fyStartYear}-04-01 00:00:00`;
      const fyEndStr = `${fyStartYear + 1}-03-31 23:59:59`;

      let rows;
      if (isAll) {
        rows = await sql`
          SELECT c.*, comp.name as company_name,
            (SELECT COUNT(*) FROM sales s WHERE s.customer_id = c.id OR (s.cell_phone IS NOT NULL AND s.cell_phone = c.phone AND c.phone != '')) as total_purchases,
            (SELECT COUNT(*) FROM sales s WHERE (s.customer_id = c.id OR (s.cell_phone IS NOT NULL AND s.cell_phone = c.phone AND c.phone != '')) AND s.sale_date >= ${fyStartStr}::timestamp AND s.sale_date <= ${fyEndStr}::timestamp) as fy_purchases_count
          FROM customers c
          LEFT JOIN companies comp ON c.company_id = comp.id
          ORDER BY c.created_at DESC, c.name ASC
        `;
      } else {
        const cId = parseInt(compQuery);
        rows = await sql`
          SELECT c.*, comp.name as company_name,
            (SELECT COUNT(*) FROM sales s WHERE s.customer_id = c.id OR (s.cell_phone IS NOT NULL AND s.cell_phone = c.phone AND c.phone != '')) as total_purchases,
            (SELECT COUNT(*) FROM sales s WHERE (s.customer_id = c.id OR (s.cell_phone IS NOT NULL AND s.cell_phone = c.phone AND c.phone != '')) AND s.sale_date >= ${fyStartStr}::timestamp AND s.sale_date <= ${fyEndStr}::timestamp) as fy_purchases_count
          FROM customers c
          LEFT JOIN companies comp ON c.company_id = comp.id
          WHERE c.company_id = ${cId}
          ORDER BY c.created_at DESC, c.name ASC
        `;
      }
      return res.status(200).json({ success: true, customers: rows });
    }

    else if (action === "customer-create") {
      const { company_id, name, phone, email, address, gstin, state, state_code, father_name, village, mandal, status, sales_terms } = req.body;
      const compId = (company_id && company_id !== "all" && !isNaN(parseInt(company_id))) ? parseInt(company_id) : (user.company_id || 1);
      if (!name || !name.trim()) return res.status(400).json({ error: "Customer Name required" });

      const newCust = await sql`
        INSERT INTO customers (company_id, name, phone, email, address, gstin, state, state_code, father_name, village, mandal, status, sales_terms)
        VALUES (
          ${compId}, ${name.trim()}, ${phone ? phone.trim() : null}, ${email ? email.trim() : null}, ${address ? address.trim() : null},
          ${gstin ? gstin.trim() : null}, ${state || null}, ${state_code || null}, ${father_name ? father_name.trim() : null},
          ${village ? village.trim() : null}, ${mandal ? mandal.trim() : null}, ${status || 'inquired'}, ${sales_terms ? sales_terms.trim() : null}
        )
        RETURNING *
      `;
      return res.status(200).json({ success: true, customer: newCust[0], message: "Customer created successfully" });
    }

    else if (action === "customer-update") {
      const { id, company_id, name, phone, email, address, gstin, state, state_code, father_name, village, mandal, status, sales_terms } = req.body;
      const cId = parseInt(id, 10);
      if (!cId || !name || !name.trim()) return res.status(400).json({ error: "Customer ID and Name required" });

      const compId = (company_id && company_id !== "all" && !isNaN(parseInt(company_id))) ? parseInt(company_id) : null;

      const updated = await sql`
        UPDATE customers SET
          company_id = COALESCE(${compId}, company_id),
          name = ${name.trim()},
          phone = ${phone ? phone.trim() : null},
          email = ${email ? email.trim() : null},
          address = ${address ? address.trim() : null},
          gstin = ${gstin ? gstin.trim() : null},
          state = ${state || null},
          state_code = ${state_code || null},
          father_name = ${father_name ? father_name.trim() : null},
          village = ${village ? village.trim() : null},
          mandal = ${mandal ? mandal.trim() : null},
          status = ${status || 'inquired'},
          sales_terms = ${sales_terms ? sales_terms.trim() : null}
        WHERE id = ${cId}
        RETURNING *
      `;
      return res.status(200).json({ success: true, customer: updated[0], message: "Customer updated successfully" });
    }

    else if (action === "customer-delete") {
      const cId = parseInt(req.body?.id || req.query?.id, 10);
      if (!cId) return res.status(400).json({ error: "Customer ID required" });

      await sql`DELETE FROM customers WHERE id = ${cId}`;
      return res.status(200).json({ success: true, message: "Customer deleted successfully" });
    }

    else {
      return res.status(404).json({ error: `Action '${action}' not recognized` });
    }

  } catch (error) {
    console.error(`api/employees error [${action}]:`, error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};
