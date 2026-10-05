const { getSQL } = require('../shared/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'business-erp-jwt-secret-key-2026';

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

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized. Please login.' });

  const sql = getSQL();
  const action = req.query.action || req.body?.action || 'dashboard-stats';

  try {
    // ═══════════════ 1. DASHBOARD STATS ═══════════════
    if (action === 'dashboard-stats') {
      const companyId = req.query.company_id || user.company_id || 'all';
      const startDate = req.query.start_date || '1970-01-01';
      const endDate = req.query.end_date || '2099-12-31';

      const filterCompany = companyId !== 'all' && !isNaN(parseInt(companyId));
      const cId = filterCompany ? parseInt(companyId) : null;

      let companyIds = [];
      if (filterCompany) {
        companyIds = [cId];
        try {
          const children = await sql`SELECT id FROM companies WHERE parent_company_id = ${cId}`;
          children.forEach(c => { if (!companyIds.includes(c.id)) companyIds.push(c.id); });
        } catch (e) {}
      }

      // Sales total
      const salesQuery = filterCompany
        ? await sql`SELECT COALESCE(SUM(grand_total), 0) as total_sales, COUNT(id) as count_sales FROM sales WHERE sale_date BETWEEN ${startDate} AND ${endDate} AND company_id = ANY(${companyIds})`
        : await sql`SELECT COALESCE(SUM(grand_total), 0) as total_sales, COUNT(id) as count_sales FROM sales WHERE sale_date BETWEEN ${startDate} AND ${endDate}`;

      // Sales returns total
      let returnsQuery = [{ total_returns: 0, count_returns: 0 }];
      try {
        returnsQuery = filterCompany
          ? await sql`SELECT COALESCE(SUM(refund_amount), 0) as total_returns, COUNT(id) as count_returns FROM sales_returns WHERE (return_date::date BETWEEN ${startDate} AND ${endDate} OR (return_date IS NULL AND created_at::date BETWEEN ${startDate} AND ${endDate})) AND company_id = ANY(${companyIds})`
          : await sql`SELECT COALESCE(SUM(refund_amount), 0) as total_returns, COUNT(id) as count_returns FROM sales_returns WHERE return_date::date BETWEEN ${startDate} AND ${endDate} OR (return_date IS NULL AND created_at::date BETWEEN ${startDate} AND ${endDate})`;
      } catch (e) {
        console.warn("Returns check:", e.message);
      }

      // Services total
      const serviceQuery = filterCompany
        ? await sql`SELECT COALESCE(SUM(grand_total), 0) as total_service, COUNT(id) as count_services FROM service_jobs WHERE created_at::date BETWEEN ${startDate} AND ${endDate} AND company_id = ANY(${companyIds})`
        : await sql`SELECT COALESCE(SUM(grand_total), 0) as total_service, COUNT(id) as count_services FROM service_jobs WHERE created_at::date BETWEEN ${startDate} AND ${endDate}`;

      // Expenses total
      const expenseQuery = filterCompany
        ? await sql`SELECT COALESCE(SUM(amount), 0) as total_expenses, COUNT(id) as count_expenses FROM expenses WHERE expense_date BETWEEN ${startDate} AND ${endDate} AND company_id = ANY(${companyIds})`
        : await sql`SELECT COALESCE(SUM(amount), 0) as total_expenses, COUNT(id) as count_expenses FROM expenses WHERE expense_date BETWEEN ${startDate} AND ${endDate}`;

      // Salaries paid (filtered by date)
      let salaryQuery = [{ total_salaries: 0 }];
      try {
        salaryQuery = filterCompany
          ? await sql`SELECT COALESCE(SUM(net_salary), 0) as total_salaries FROM payroll WHERE payment_status = 'paid' AND (payment_date BETWEEN ${startDate} AND ${endDate} OR (payment_date IS NULL AND created_at::date BETWEEN ${startDate} AND ${endDate})) AND company_id = ANY(${companyIds})`
          : await sql`SELECT COALESCE(SUM(net_salary), 0) as total_salaries FROM payroll WHERE payment_status = 'paid' AND (payment_date BETWEEN ${startDate} AND ${endDate} OR (payment_date IS NULL AND created_at::date BETWEEN ${startDate} AND ${endDate}))`;
      } catch (e) {
        console.warn("Payroll check:", e.message);
      }

      // Purchases total
      const purchaseQuery = filterCompany
        ? await sql`SELECT COALESCE(SUM(grand_total), 0) as total_purchases FROM purchases WHERE purchase_date BETWEEN ${startDate} AND ${endDate} AND company_id = ANY(${companyIds})`
        : await sql`SELECT COALESCE(SUM(grand_total), 0) as total_purchases FROM purchases WHERE purchase_date BETWEEN ${startDate} AND ${endDate}`;

      // Capital total
      const capitalQuery = filterCompany
        ? await sql`SELECT COALESCE(SUM(new_value), 0) as current_capital FROM capital_entries WHERE id IN (SELECT MAX(id) FROM capital_entries GROUP BY company_id) AND company_id = ANY(${companyIds})`
        : await sql`SELECT COALESCE(SUM(new_value), 0) as current_capital FROM capital_entries WHERE id IN (SELECT MAX(id) FROM capital_entries GROUP BY company_id)`;

      // Breakdown by company (All or filtered company + branches)
      let companyBreakdown = [];
      if (companyId === 'all') {
        companyBreakdown = await sql`
          SELECT c.id, c.name, c.city,
                 COALESCE(s.total_sales, 0) as sales,
                 COALESCE(ret.total_returns, 0) as returns,
                 COALESCE(e.total_expenses, 0) as expenses,
                 COALESCE(srv.total_service, 0) as services
          FROM companies c
          LEFT JOIN (
            SELECT company_id, SUM(grand_total) as total_sales FROM sales
            WHERE sale_date BETWEEN ${startDate} AND ${endDate} GROUP BY company_id
          ) s ON c.id = s.company_id
          LEFT JOIN (
            SELECT company_id, SUM(refund_amount) as total_returns FROM sales_returns
            WHERE return_date::date BETWEEN ${startDate} AND ${endDate} OR (return_date IS NULL AND created_at::date BETWEEN ${startDate} AND ${endDate}) GROUP BY company_id
          ) ret ON c.id = ret.company_id
          LEFT JOIN (
            SELECT company_id, SUM(amount) as total_expenses FROM expenses
            WHERE expense_date BETWEEN ${startDate} AND ${endDate} GROUP BY company_id
          ) e ON c.id = e.company_id
          LEFT JOIN (
            SELECT company_id, SUM(grand_total) as total_service FROM service_jobs
            WHERE created_at::date BETWEEN ${startDate} AND ${endDate} GROUP BY company_id
          ) srv ON c.id = srv.company_id
          WHERE c.is_active = true
          ORDER BY c.name
        `;
      } else {
        companyBreakdown = await sql`
          SELECT c.id, c.name, c.city,
                 COALESCE(s.total_sales, 0) as sales,
                 COALESCE(ret.total_returns, 0) as returns,
                 COALESCE(e.total_expenses, 0) as expenses,
                 COALESCE(srv.total_service, 0) as services
          FROM companies c
          LEFT JOIN (
            SELECT company_id, SUM(grand_total) as total_sales FROM sales
            WHERE sale_date BETWEEN ${startDate} AND ${endDate} GROUP BY company_id
          ) s ON c.id = s.company_id
          LEFT JOIN (
            SELECT company_id, SUM(refund_amount) as total_returns FROM sales_returns
            WHERE return_date::date BETWEEN ${startDate} AND ${endDate} OR (return_date IS NULL AND created_at::date BETWEEN ${startDate} AND ${endDate}) GROUP BY company_id
          ) ret ON c.id = ret.company_id
          LEFT JOIN (
            SELECT company_id, SUM(amount) as total_expenses FROM expenses
            WHERE expense_date BETWEEN ${startDate} AND ${endDate} GROUP BY company_id
          ) e ON c.id = e.company_id
          LEFT JOIN (
            SELECT company_id, SUM(grand_total) as total_service FROM service_jobs
            WHERE created_at::date BETWEEN ${startDate} AND ${endDate} GROUP BY company_id
          ) srv ON c.id = srv.company_id
          WHERE c.id = ANY(${companyIds})
          ORDER BY c.name
        `;
      }

      const totalSalesGross = parseFloat(salesQuery[0].total_sales || 0);
      const totalReturnsAmt = parseFloat(returnsQuery[0].total_returns || 0);
      const netSales = totalSalesGross - totalReturnsAmt;
      const totalRevenue = netSales + parseFloat(serviceQuery[0].total_service || 0);
      const totalOutflow = parseFloat(expenseQuery[0].total_expenses || 0) + parseFloat(salaryQuery[0].total_salaries || 0) + parseFloat(purchaseQuery[0].total_purchases || 0);
      const netProfit = totalRevenue - totalOutflow;

      return res.status(200).json({
        success: true,
        stats: {
          total_sales: totalSalesGross,
          count_sales: parseInt(salesQuery[0].count_sales || 0),
          total_returns: totalReturnsAmt,
          count_returns: parseInt(returnsQuery[0].count_returns || 0),
          net_sales: netSales,
          total_service: parseFloat(serviceQuery[0].total_service || 0),
          count_services: parseInt(serviceQuery[0].count_services || 0),
          total_expenses: parseFloat(expenseQuery[0].total_expenses || 0),
          total_salaries: parseFloat(salaryQuery[0].total_salaries || 0),
          total_purchases: parseFloat(purchaseQuery[0].total_purchases || 0),
          total_revenue: totalRevenue,
          total_outflow: totalOutflow,
          net_profit: netProfit,
          is_loss: netProfit < 0,
          current_capital: parseFloat(capitalQuery[0].current_capital || 0),
        },
        company_breakdown: companyBreakdown,
      });
    }

    // ═══════════════ 2. COMPANIES CRUD ═══════════════
    else if (action === 'companies-list') {
      const rows = await sql`
        SELECT c.*, p.name as parent_name
        FROM companies c
        LEFT JOIN companies p ON c.parent_company_id = p.id
        ORDER BY c.id ASC
      `;
      return res.status(200).json({ success: true, companies: rows });
    }

    else if (action === 'company-create') {
      if (user.role !== 'superadmin') return res.status(403).json({ error: 'Superadmin access required' });
      const {
        name, trade_name, parent_company_id, gstin, pan, hsn_code, website, address, city, state, state_code,
        pincode, phone, email, logo_data, bank_name, bank_account, bank_ifsc, bank_branch,
        capital_editable, inventory_add_control
      } = req.body;

      if (!name) return res.status(400).json({ error: 'Company name is required' });

      const newComp = await sql`
        INSERT INTO companies (
          name, trade_name, parent_company_id, gstin, pan, hsn_code, website, address, city, state, state_code,
          pincode, phone, email, logo_data, bank_name, bank_account, bank_ifsc, bank_branch,
          capital_editable, inventory_add_control
        ) VALUES (
          ${name}, ${trade_name || null}, ${parent_company_id ? parseInt(parent_company_id) : null},
          ${gstin || null}, ${pan || null}, ${hsn_code || null}, ${website || 'https://manageetha.in'}, ${address || null}, ${city || null}, ${state || null}, ${state_code || null},
          ${pincode || null}, ${phone || null}, ${email || null}, ${logo_data || null},
          ${bank_name || null}, ${bank_account || null}, ${bank_ifsc || null}, ${bank_branch || null},
          ${capital_editable !== undefined ? capital_editable : true}, ${inventory_add_control || '["storeadmin","superadmin"]'}
        )
        RETURNING *
      `;

      return res.status(200).json({ success: true, company: newComp[0], message: 'Company created successfully' });
    }

    else if (action === 'company-update') {
      if (user.role !== 'superadmin') return res.status(403).json({ error: 'Superadmin access required' });
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Company ID required' });

      const {
        name, trade_name, parent_company_id, gstin, pan, hsn_code, website, address, city, state, state_code,
        pincode, phone, email, logo_data, bank_name, bank_account, bank_ifsc, bank_branch,
        capital_editable, inventory_add_control, is_active
      } = req.body;

      const updated = await sql`
        UPDATE companies SET
          name = ${name},
          trade_name = ${trade_name || null},
          parent_company_id = ${parent_company_id ? parseInt(parent_company_id) : null},
          gstin = ${gstin || null},
          pan = ${pan || null},
          hsn_code = ${hsn_code || null},
          website = ${website || 'https://manageetha.in'},
          address = ${address || null},
          city = ${city || null},
          state = ${state || null},
          state_code = ${state_code || null},
          pincode = ${pincode || null},
          phone = ${phone || null},
          email = ${email || null},
          logo_data = ${logo_data || null},
          bank_name = ${bank_name || null},
          bank_account = ${bank_account || null},
          bank_ifsc = ${bank_ifsc || null},
          bank_branch = ${bank_branch || null},
          capital_editable = ${capital_editable !== undefined ? capital_editable : true},
          inventory_add_control = ${typeof inventory_add_control === 'object' ? JSON.stringify(inventory_add_control) : (inventory_add_control || '["storeadmin","superadmin"]')},
          is_active = ${is_active !== undefined ? is_active : true}
        WHERE id = ${parseInt(id)}
        RETURNING *
      `;

      return res.status(200).json({ success: true, company: updated[0], message: 'Company updated successfully' });
    }

    else if (action === 'capital-toggle') {
      if (user.role !== 'superadmin') return res.status(403).json({ error: 'Superadmin access required' });
      const { company_id, capital_editable } = req.body;
      if (!company_id) return res.status(400).json({ error: 'Company ID required' });

      await sql`
        UPDATE companies SET capital_editable = ${capital_editable} WHERE id = ${parseInt(company_id)}
      `;

      return res.status(200).json({
        success: true,
        message: `Capital editing ${capital_editable ? 'enabled' : 'disabled'} for company`
      });
    }

    else if (action === 'get-payment-terms') {
      const companyId = req.query.company_id || user.company_id || 1;
      const cId = !isNaN(parseInt(companyId)) ? parseInt(companyId) : 1;
      const terms = await sql`SELECT * FROM company_payment_terms WHERE company_id = ${cId}`;
      return res.status(200).json({ success: true, terms });
    }

    else if (action === 'save-payment-terms') {
      if (user.role !== 'superadmin') return res.status(403).json({ error: 'Superadmin access required' });
      const { company_id, payment_mode, terms_text } = req.body;
      const cId = parseInt(company_id || 1);
      if (!payment_mode) return res.status(400).json({ error: 'payment_mode required' });

      await sql`
        INSERT INTO company_payment_terms (company_id, payment_mode, terms_text, updated_at)
        VALUES (${cId}, ${payment_mode}, ${terms_text || ''}, NOW())
        ON CONFLICT (company_id, payment_mode) DO UPDATE SET
          terms_text = EXCLUDED.terms_text,
          updated_at = NOW()
      `;

      return res.status(200).json({ success: true, message: `Payment terms updated for ${payment_mode.toUpperCase()}` });
    }

    // ═══════════════ 3. ROLES & MENU MAPPING ═══════════════
    else if (action === 'roles-list') {
      const companyId = req.query.company_id || user.company_id;
      const roles = await sql`
        SELECT * FROM roles
        WHERE company_id IS NULL OR company_id = ${companyId ? parseInt(companyId) : null}
        ORDER BY role_name
      `;
      return res.status(200).json({ success: true, roles });
    }

    else if (action === 'menu-categories-list') {
      const categories = await sql`
        SELECT mc.*,
               json_agg(json_build_object(
                 'menu_key', m.menu_key,
                 'menu_label', m.menu_label,
                 'icon', m.icon,
                 'sort_order', m.sort_order
               ) ORDER BY m.sort_order) as menus
        FROM menu_categories mc
        LEFT JOIN menus m ON mc.id = m.category_id
        GROUP BY mc.id
        ORDER BY mc.sort_order
      `;
      return res.status(200).json({ success: true, categories });
    }

    else if (action === 'get-role-menu-mapping') {
      const { role_name, company_id } = req.query;
      if (!role_name) return res.status(400).json({ error: 'role_name required' });

      const targetCompany = company_id && !isNaN(parseInt(company_id)) ? parseInt(company_id) : user.company_id;
      const mappings = targetCompany
        ? await sql`SELECT menu_key FROM role_menu_mappings WHERE role_name = ${role_name} AND company_id = ${targetCompany}`
        : await sql`SELECT menu_key FROM role_menu_mappings WHERE role_name = ${role_name}`;
      return res.status(200).json({ success: true, mapped_keys: mappings.map(m => m.menu_key) });
    }

    else if (action === 'save-role-menu-mapping') {
      if (user.role !== 'superadmin') return res.status(403).json({ error: 'Superadmin access required' });
      const { company_id, role_name, menu_keys } = req.body;

      if (!company_id || !role_name || !Array.isArray(menu_keys)) {
        return res.status(400).json({ error: 'company_id, role_name, and menu_keys array required' });
      }

      // Delete existing mappings for this role & company
      await sql`
        DELETE FROM role_menu_mappings
        WHERE company_id = ${parseInt(company_id)} AND role_name = ${role_name}
      `;

      // Get metadata for requested menu_keys
      if (menu_keys.length > 0) {
        const menuRows = await sql`
          SELECT menu_key, menu_label, icon FROM menus WHERE menu_key = ANY(${menu_keys})
        `;

        for (const m of menuRows) {
          await sql`
            INSERT INTO role_menu_mappings (company_id, role_name, menu_key, menu_label, menu_icon)
            VALUES (${parseInt(company_id)}, ${role_name}, ${m.menu_key}, ${m.menu_label}, ${m.icon})
            ON CONFLICT DO NOTHING
          `;
        }
      }

      return res.status(200).json({ success: true, message: 'Role menu mappings saved successfully' });
    }

    else if (action === 'menu-reorder') {
      if (user.role !== 'superadmin') return res.status(403).json({ error: 'Superadmin access required' });
      const { menu_orders } = req.body;
      if (!Array.isArray(menu_orders)) return res.status(400).json({ error: 'menu_orders array required' });

      for (const m of menu_orders) {
        if (m.menu_key && m.sort_order !== undefined) {
          await sql`UPDATE menus SET sort_order = ${parseInt(m.sort_order)} WHERE menu_key = ${m.menu_key}`;
        }
      }

      return res.status(200).json({ success: true, message: 'Menu order updated successfully' });
    }

    // ═══════════════ 4. USER ACCOUNTS MANAGEMENT ═══════════════
    else if (action === 'users-list') {
      const companyId = req.query.company_id || user.company_id || 'all';
      const allowedUserMgmtRoles = ['superadmin', 'storeadmin', 'hr', 'hr_manager'];

      let usersList;
      if (companyId === 'all' && allowedUserMgmtRoles.includes(user.role)) {
        usersList = await sql`
          SELECT u.id, u.username, u.email, u.phone, u.role, u.is_active, u.last_login_at, u.created_at,
                 u.company_id, u.employee_id, c.name as company_name, e.name as employee_name
          FROM users u
          LEFT JOIN companies c ON u.company_id = c.id
          LEFT JOIN employees e ON u.employee_id = e.id
          ORDER BY u.created_at DESC
        `;
      } else {
        const cId = parseInt(companyId);
        usersList = await sql`
          SELECT u.id, u.username, u.email, u.phone, u.role, u.is_active, u.last_login_at, u.created_at,
                 u.company_id, u.employee_id, c.name as company_name, e.name as employee_name
          FROM users u
          LEFT JOIN companies c ON u.company_id = c.id
          LEFT JOIN employees e ON u.employee_id = e.id
          WHERE u.company_id = ${cId}
          ORDER BY u.created_at DESC
        `;
      }

      return res.status(200).json({ success: true, users: usersList });
    }

    else if (action === 'user-create') {
      const allowedUserMgmtRoles = ['superadmin', 'storeadmin', 'hr', 'hr_manager'];
      if (!allowedUserMgmtRoles.includes(user.role)) return res.status(403).json({ error: 'User management access restricted to Superadmin, Storeadmin, and HR' });
      const { company_id, username, password, email, phone, role, employee_id } = req.body;

      if (!username || !password || !role) {
        return res.status(400).json({ error: 'Username, password, and role are required' });
      }

      const existing = await sql`SELECT id FROM users WHERE username = ${username.trim()}`;
      if (existing.length > 0) return res.status(400).json({ error: 'Username already exists' });

      const hash = await bcrypt.hash(password, 10);
      const newUser = await sql`
        INSERT INTO users (company_id, username, password_hash, email, phone, role, employee_id)
        VALUES (
          ${role === 'superadmin' ? null : (company_id ? parseInt(company_id) : null)},
          ${username.trim()}, ${hash}, ${email || null}, ${phone || null}, ${role},
          ${employee_id ? parseInt(employee_id) : null}
        )
        RETURNING id, username, email, phone, role, company_id, employee_id, is_active
      `;

      const uRec = newUser[0];
      if (role !== 'superadmin' && uRec.company_id) {
        if (uRec.employee_id) {
          await sql`UPDATE employees SET user_id = ${uRec.id}, company_id = ${uRec.company_id}, department = ${role}, designation = ${role} WHERE id = ${uRec.employee_id}`;
        } else {
          const code = await generateNextEmpCode(sql, uRec.company_id);
          const createdEmp = await sql`
            INSERT INTO employees (
              company_id, user_id, employee_code, name, phone, email,
              department, designation, employment_type, basic_salary, employment_status
            ) VALUES (
              ${uRec.company_id}, ${uRec.id}, ${code}, ${uRec.username}, ${uRec.phone || null}, ${uRec.email || null},
              ${role}, ${role}, 'full_time', 0, 'active'
            )
            RETURNING id
          `;
          if (createdEmp.length > 0) {
            await sql`UPDATE users SET employee_id = ${createdEmp[0].id} WHERE id = ${uRec.id}`;
            uRec.employee_id = createdEmp[0].id;
          }
        }
      }

      return res.status(200).json({ success: true, user: uRec, message: 'User account created successfully' });
    }

    else if (action === 'user-update') {
      const allowedUserMgmtRoles = ['superadmin', 'storeadmin', 'hr', 'hr_manager'];
      if (!allowedUserMgmtRoles.includes(user.role)) return res.status(403).json({ error: 'User management access restricted to Superadmin, Storeadmin, and HR' });
      const { user_id, username, password, email, phone, role, company_id, employee_id } = req.body;

      if (!user_id || !username || !role) {
        return res.status(400).json({ error: 'user_id, username, and role are required' });
      }

      const existing = await sql`SELECT id FROM users WHERE username = ${username.trim()} AND id != ${parseInt(user_id)}`;
      if (existing.length > 0) return res.status(400).json({ error: 'Username already exists' });

      const targetCompany = role === 'superadmin' ? null : (company_id ? parseInt(company_id) : null);
      const targetEmp = employee_id ? parseInt(employee_id) : null;

      let updated;
      if (password && password.trim()) {
        const hash = await bcrypt.hash(password.trim(), 10);
        updated = await sql`
          UPDATE users SET
            username = ${username.trim()},
            password_hash = ${hash},
            email = ${email || null},
            phone = ${phone || null},
            role = ${role},
            company_id = ${targetCompany},
            employee_id = ${targetEmp}
          WHERE id = ${parseInt(user_id)}
          RETURNING id, username, email, phone, role, company_id, employee_id, is_active
        `;
      } else {
        updated = await sql`
          UPDATE users SET
            username = ${username.trim()},
            email = ${email || null},
            phone = ${phone || null},
            role = ${role},
            company_id = ${targetCompany},
            employee_id = ${targetEmp}
          WHERE id = ${parseInt(user_id)}
          RETURNING id, username, email, phone, role, company_id, employee_id, is_active
        `;
      }

      if (role !== 'superadmin' && targetCompany) {
        if (targetEmp) {
          await sql`UPDATE employees SET user_id = ${parseInt(user_id)}, company_id = ${targetCompany}, department = ${role}, designation = ${role} WHERE id = ${targetEmp}`;
        } else {
          const checkEmp = await sql`SELECT id FROM employees WHERE user_id = ${parseInt(user_id)} OR id = (SELECT employee_id FROM users WHERE id = ${parseInt(user_id)})`;
          if (checkEmp.length > 0) {
            await sql`UPDATE employees SET company_id = ${targetCompany}, department = ${role}, designation = ${role} WHERE id = ${checkEmp[0].id}`;
          } else {
            const code = await generateNextEmpCode(sql, targetCompany);
            const createdEmp = await sql`
              INSERT INTO employees (
                company_id, user_id, employee_code, name, phone, email,
                department, designation, employment_type, basic_salary, employment_status
              ) VALUES (
                ${targetCompany}, ${parseInt(user_id)}, ${code}, ${username.trim()}, ${phone || null}, ${email || null},
                ${role}, ${role}, 'full_time', 0, 'active'
              )
              RETURNING id
            `;
            if (createdEmp.length > 0) {
              await sql`UPDATE users SET employee_id = ${createdEmp[0].id} WHERE id = ${parseInt(user_id)}`;
            }
          }
        }
      }

      return res.status(200).json({ success: true, user: updated[0], message: 'User account updated successfully' });
    }

    else if (action === 'user-toggle-active') {
      const allowedUserMgmtRoles = ['superadmin', 'storeadmin', 'hr', 'hr_manager'];
      if (!allowedUserMgmtRoles.includes(user.role)) return res.status(403).json({ error: 'User management access restricted to Superadmin, Storeadmin, and HR' });
      const { user_id, is_active } = req.body;
      if (!user_id) return res.status(400).json({ error: 'User ID required' });

      const targetU = await sql`SELECT role, username FROM users WHERE id = ${parseInt(user_id)}`;
      if (targetU.length > 0 && (targetU[0].role === 'superadmin' || String(targetU[0].username).toLowerCase().trim() === 'superadmin')) {
        return res.status(400).json({ error: 'Superadmin account cannot be disabled' });
      }

      await sql`UPDATE users SET is_active = ${is_active} WHERE id = ${parseInt(user_id)}`;
      return res.status(200).json({ success: true, message: `User status updated to ${is_active ? 'active' : 'disabled'}` });
    }

    else if (action === 'user-reset-password') {
      const allowedUserMgmtRoles = ['superadmin', 'storeadmin', 'hr', 'hr_manager'];
      if (!allowedUserMgmtRoles.includes(user.role)) return res.status(403).json({ error: 'User management access restricted to Superadmin, Storeadmin, and HR' });
      const { user_id, new_password } = req.body;
      if (!user_id || !new_password) return res.status(400).json({ error: 'user_id and new_password required' });

      const hash = await bcrypt.hash(new_password, 10);
      await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${parseInt(user_id)}`;
      return res.status(200).json({ success: true, message: 'User password reset successfully' });
    }

    else if (action === 'user-delete') {
      const allowedUserMgmtRoles = ['superadmin', 'storeadmin', 'hr', 'hr_manager'];
      if (!allowedUserMgmtRoles.includes(user.role)) return res.status(403).json({ error: 'User management access restricted to Superadmin, Storeadmin, and HR' });
      const { user_id } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      const targetU = await sql`SELECT role, username FROM users WHERE id = ${parseInt(user_id)}`;
      if (targetU.length > 0 && (targetU[0].role === 'superadmin' || String(targetU[0].username).toLowerCase().trim() === 'superadmin')) {
        return res.status(400).json({ error: 'Superadmin account cannot be deleted' });
      }

      if (parseInt(user_id) === user.id) {
        return res.status(400).json({ error: 'You cannot delete your own active account' });
      }

      await sql`DELETE FROM users WHERE id = ${parseInt(user_id)}`;
      return res.status(200).json({ success: true, message: 'User account deleted successfully' });
    }

    // ═══════════════ 5. WORK MANAGEMENT & ONLINE STATUS ═══════════════
    else if (action === 'work-management-status') {
      const companyId = req.query.company_id || user.company_id || 'all';
      const todayDate = new Date().toISOString().split('T')[0];

      try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_logout_at TIMESTAMP`; } catch (e) {}

      let onlineUsers;
      if (companyId === 'all' && user.role === 'superadmin') {
        onlineUsers = await sql`
          SELECT u.id, u.username, u.role, u.last_login_at, u.last_logout_at, 
                 COALESCE(u.company_id, e.company_id) as company_id, 
                 c.name as company_name,
                 e.id as employee_id, COALESCE(e.name, u.username) as employee_name, 
                 e.department, e.designation,
                 a.login_time, a.status as attendance_status
          FROM users u
          LEFT JOIN employees e ON u.employee_id = e.id
          LEFT JOIN companies c ON COALESCE(u.company_id, e.company_id) = c.id
          LEFT JOIN attendance a ON (a.employee_id = u.employee_id OR a.employee_id = e.id) AND a.date = ${todayDate}
          WHERE u.is_active = true

          UNION ALL

          SELECT NULL as id, '—' as username, 'employee' as role, NULL as last_login_at, NULL as last_logout_at,
                 e.company_id, c.name as company_name,
                 e.id as employee_id, e.name as employee_name, e.department, e.designation,
                 a.login_time, a.status as attendance_status
          FROM employees e
          LEFT JOIN companies c ON e.company_id = c.id
          LEFT JOIN attendance a ON a.employee_id = e.id AND a.date = ${todayDate}
          WHERE (e.employment_status IS NULL OR e.employment_status = 'active') 
            AND e.id NOT IN (SELECT employee_id FROM users WHERE employee_id IS NOT NULL AND is_active = true)

          ORDER BY last_login_at DESC NULLS LAST, employee_name ASC
        `;
      } else {
        const cId = parseInt(companyId);
        onlineUsers = await sql`
          SELECT u.id, u.username, u.role, u.last_login_at, u.last_logout_at, 
                 COALESCE(u.company_id, e.company_id) as company_id, 
                 c.name as company_name,
                 e.id as employee_id, COALESCE(e.name, u.username) as employee_name, 
                 e.department, e.designation,
                 a.login_time, a.status as attendance_status
          FROM users u
          LEFT JOIN employees e ON u.employee_id = e.id
          LEFT JOIN companies c ON COALESCE(u.company_id, e.company_id) = c.id
          LEFT JOIN attendance a ON (a.employee_id = u.employee_id OR a.employee_id = e.id) AND a.date = ${todayDate}
          WHERE (u.company_id = ${cId} OR e.company_id = ${cId} OR u.company_id IS NULL) AND u.is_active = true

          UNION ALL

          SELECT NULL as id, '—' as username, 'employee' as role, NULL as last_login_at, NULL as last_logout_at,
                 e.company_id, c.name as company_name,
                 e.id as employee_id, e.name as employee_name, e.department, e.designation,
                 a.login_time, a.status as attendance_status
          FROM employees e
          LEFT JOIN companies c ON e.company_id = c.id
          LEFT JOIN attendance a ON a.employee_id = e.id AND a.date = ${todayDate}
          WHERE e.company_id = ${cId} AND (e.employment_status IS NULL OR e.employment_status = 'active') 
            AND e.id NOT IN (SELECT employee_id FROM users WHERE employee_id IS NOT NULL AND is_active = true)

          ORDER BY last_login_at DESC NULLS LAST, employee_name ASC
        `;
      }

      // Real-time online threshold (active within last 3 minutes via heartbeat)
      const now = new Date();
      const onlineThreshold = 3 * 60 * 1000;

      const formatted = onlineUsers.map(u => {
        const lastLogin = u.last_login_at ? new Date(u.last_login_at) : null;
        const lastLogout = u.last_logout_at ? new Date(u.last_logout_at) : null;

        const hasLoggedOut = lastLogout && lastLogin && (lastLogout >= lastLogin);
        const isOnline = lastLogin && !hasLoggedOut && (now - lastLogin) < onlineThreshold;
        const isSuperadmin = u.role === 'superadmin';

        return {
          ...u,
          is_online: isOnline,
          status_label: isOnline ? 'Online' : (lastLogin ? 'Offline' : 'Never Logged In'),
          attendance_status: isSuperadmin ? 'exempt' : (u.attendance_status || 'not_checked_in'),
          login_time: isSuperadmin ? '—' : (u.login_time || '—'),
        };
      });

      return res.status(200).json({ success: true, users: formatted });
    }

    // ═══════════════ ASSIGNEES LIST (USERS & EMPLOYEES) ═══════════════
    else if (action === 'assignees-list') {
      const companyId = req.query.company_id || user.company_id || 'all';
      let assignees;
      if (companyId === 'all' && user.role === 'superadmin') {
        assignees = await sql`
          SELECT u.id as user_id, u.username, u.role, u.company_id, u.employee_id,
                 c.name as company_name, e.name as employee_name, e.department
          FROM users u
          LEFT JOIN companies c ON u.company_id = c.id
          LEFT JOIN employees e ON u.employee_id = e.id
          WHERE u.is_active = true
          ORDER BY COALESCE(e.name, u.username) ASC
        `;
      } else {
        assignees = await sql`
          SELECT u.id as user_id, u.username, u.role, u.company_id, u.employee_id,
                 c.name as company_name, e.name as employee_name, e.department
          FROM users u
          LEFT JOIN companies c ON u.company_id = c.id
          LEFT JOIN employees e ON u.employee_id = e.id
          WHERE u.is_active = true
            AND (u.company_id = ${parseInt(companyId)} OR u.role = 'superadmin')
          ORDER BY COALESCE(e.name, u.username) ASC
        `;
      }

      const formatted = assignees.map(a => ({
        id: a.user_id,
        user_id: a.user_id,
        employee_id: a.employee_id,
        name: a.employee_name || a.username,
        username: a.username,
        role: a.role,
        department: a.department || a.role.replace(/_/g, ' '),
        company_id: a.company_id,
        company_name: a.company_name || 'Global'
      }));

      return res.status(200).json({ success: true, assignees: formatted });
    }

    // ═══════════════ EMPLOYEE WORK TASK ASSIGNMENTS ═══════════════
    else if (action === 'tasks-list') {
      const companyId = req.query.company_id || user.company_id || 'all';
      const targetDate = req.query.date;
      const targetStatus = req.query.status;

      let tasks;
      if (companyId === 'all' && user.role === 'superadmin') {
        tasks = await sql`
          SELECT t.*,
                 COALESCE(e.name, u_assigned.username) as employee_name,
                 COALESCE(e.department, u_assigned.role) as department,
                 c.name as company_name,
                 u_creator.username as assigned_by_name
          FROM employee_tasks t
          LEFT JOIN users u_assigned ON t.user_id = u_assigned.id
          LEFT JOIN employees e ON t.employee_id = e.id OR u_assigned.employee_id = e.id
          LEFT JOIN companies c ON t.company_id = c.id
          LEFT JOIN users u_creator ON t.assigned_by = u_creator.id
          ORDER BY t.due_date DESC NULLS LAST, t.created_at DESC
        `;
      } else {
        tasks = await sql`
          SELECT t.*,
                 COALESCE(e.name, u_assigned.username) as employee_name,
                 COALESCE(e.department, u_assigned.role) as department,
                 c.name as company_name,
                 u_creator.username as assigned_by_name
          FROM employee_tasks t
          LEFT JOIN users u_assigned ON t.user_id = u_assigned.id
          LEFT JOIN employees e ON t.employee_id = e.id OR u_assigned.employee_id = e.id
          LEFT JOIN companies c ON t.company_id = c.id
          LEFT JOIN users u_creator ON t.assigned_by = u_creator.id
          WHERE t.company_id = ${parseInt(companyId)}
          ORDER BY t.due_date DESC NULLS LAST, t.created_at DESC
        `;
      }

      if (targetDate) {
        tasks = tasks.filter(t => {
          const dueStr = t.due_date ? new Date(t.due_date).toISOString().split('T')[0] : '';
          const createdStr = t.created_at ? new Date(t.created_at).toISOString().split('T')[0] : '';
          return dueStr === targetDate || createdStr === targetDate;
        });
      }

      if (targetStatus && targetStatus !== 'all') {
        tasks = tasks.filter(t => t.status === targetStatus);
      }

      return res.status(200).json({ success: true, tasks });
    }

    else if (action === 'my-tasks') {
      const targetDate = req.query.date;
      const targetStatus = req.query.status;
      const empId = user.employee_id ? parseInt(user.employee_id) : null;

      let tasks;
      if (empId) {
        tasks = await sql`
          SELECT t.*,
                 COALESCE(e.name, u_assigned.username) as employee_name,
                 c.name as company_name,
                 u_creator.username as assigned_by_name
          FROM employee_tasks t
          LEFT JOIN users u_assigned ON t.user_id = u_assigned.id
          LEFT JOIN employees e ON t.employee_id = e.id OR u_assigned.employee_id = e.id
          LEFT JOIN companies c ON t.company_id = c.id
          LEFT JOIN users u_creator ON t.assigned_by = u_creator.id
          WHERE t.user_id = ${user.id} OR t.employee_id = ${empId}
          ORDER BY t.due_date DESC NULLS LAST, t.created_at DESC
        `;
      } else {
        tasks = await sql`
          SELECT t.*,
                 COALESCE(e.name, u_assigned.username) as employee_name,
                 c.name as company_name,
                 u_creator.username as assigned_by_name
          FROM employee_tasks t
          LEFT JOIN users u_assigned ON t.user_id = u_assigned.id
          LEFT JOIN employees e ON t.employee_id = e.id
          LEFT JOIN companies c ON t.company_id = c.id
          LEFT JOIN users u_creator ON t.assigned_by = u_creator.id
          WHERE t.user_id = ${user.id}
          ORDER BY t.due_date DESC NULLS LAST, t.created_at DESC
        `;
      }

      if (targetDate) {
        tasks = tasks.filter(t => {
          const dueStr = t.due_date ? new Date(t.due_date).toISOString().split('T')[0] : '';
          const createdStr = t.created_at ? new Date(t.created_at).toISOString().split('T')[0] : '';
          return dueStr === targetDate || createdStr === targetDate;
        });
      }

      if (targetStatus && targetStatus !== 'all') {
        tasks = tasks.filter(t => t.status === targetStatus);
      }

      return res.status(200).json({ success: true, tasks });
    }

    else if (action === 'task-create') {
      const { company_id, user_id, employee_id, title, description, priority, due_date } = req.body;
      const compId = user.role === 'superadmin' ? (company_id ? parseInt(company_id) : user.company_id) : user.company_id;
      if ((!user_id && !employee_id) || !title) {
        return res.status(400).json({ error: 'Assignee User/Employee and Task Title required' });
      }

      const userIdVal = user_id ? parseInt(user_id) : null;
      const empIdVal = employee_id ? parseInt(employee_id) : null;

      const newTask = await sql`
        INSERT INTO employee_tasks (company_id, user_id, employee_id, assigned_by, title, description, priority, due_date, status)
        VALUES (${compId || null}, ${userIdVal}, ${empIdVal}, ${user.id}, ${title}, ${description || null}, ${priority || 'medium'}, ${due_date || null}, 'pending')
        RETURNING *
      `;
      return res.status(200).json({ success: true, task: newTask[0], message: 'Work task assigned successfully' });
    }

    else if (action === 'task-update-status') {
      const { task_id, status } = req.body;
      if (!task_id || !status) return res.status(400).json({ error: 'task_id and status required' });
      await sql`UPDATE employee_tasks SET status = ${status}, updated_at = NOW() WHERE id = ${parseInt(task_id)}`;
      return res.status(200).json({ success: true, message: `Task status updated to ${status}` });
    }

    else {
      return res.status(404).json({ error: `Action '${action}' not recognized` });
    }

  } catch (error) {
    console.error(`api/super error [${action}]:`, error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};
