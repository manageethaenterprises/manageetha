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

function safeInt(val, fallback = 1) {
  if (!val || val === "all" || val === "null" || val === "undefined") return fallback;
  const p = parseInt(val, 10);
  return isNaN(p) ? fallback : p;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized. Please login." });

  const sql = getSQL();
  const action = req.query.action || req.body?.action || "list";

  try {
    const isSuper = (user.role === 'superadmin' || user.username === 'superadmin');
    const rawComp = req.query.company_id || req.body?.company_id;
    const isAll = (rawComp === "all" || (!rawComp && isSuper));
    const compQuery = isAll ? "all" : String(safeInt(rawComp, user.company_id || 1));

    // Ensure database columns for Annexure allowances, LPAs, and Holds exist
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS payroll (
          id SERIAL PRIMARY KEY,
          company_id INT,
          employee_id INT,
          month VARCHAR(10) NOT NULL,
          month_year VARCHAR(10),
          basic_salary NUMERIC(15,2) DEFAULT 0,
          hra NUMERIC(15,2) DEFAULT 0,
          da NUMERIC(15,2) DEFAULT 0,
          ta NUMERIC(15,2) DEFAULT 0,
          special_allowance NUMERIC(15,2) DEFAULT 0,
          incentives NUMERIC(15,2) DEFAULT 0,
          bonuses NUMERIC(15,2) DEFAULT 0,
          gross_salary NUMERIC(15,2) DEFAULT 0,
          leave_deductions NUMERIC(15,2) DEFAULT 0,
          advance_deductions NUMERIC(15,2) DEFAULT 0,
          pf_deduction NUMERIC(15,2) DEFAULT 0,
          esi_deduction NUMERIC(15,2) DEFAULT 0,
          other_deductions NUMERIC(15,2) DEFAULT 0,
          total_deductions NUMERIC(15,2) DEFAULT 0,
          net_salary NUMERIC(15,2) DEFAULT 0,
          offered_lpa NUMERIC(10,2) DEFAULT 0,
          actual_lpa NUMERIC(10,2) DEFAULT 0,
          payment_status VARCHAR(20) DEFAULT 'pending',
          payment_type VARCHAR(20) DEFAULT 'full',
          paid_amount NUMERIC(15,2) DEFAULT 0,
          remaining_balance NUMERIC(15,2) DEFAULT 0,
          hold_reason TEXT,
          payment_date DATE,
          payment_mode VARCHAR(20),
          transaction_ref VARCHAR(100),
          present_days INT DEFAULT 0,
          late_days INT DEFAULT 0,
          absent_days INT DEFAULT 0,
          leave_days INT DEFAULT 0,
          paid_leave_days INT DEFAULT 0,
          unpaid_leave_days INT DEFAULT 0,
          processed_by INT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS month VARCHAR(10);`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS hra NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS da NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS ta NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS special_allowance NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS incentives NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS bonuses NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS lta_allowance NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS children_edu_allowance NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS uniform_allowance NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS learning_allowance NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS car_fuel_allowance NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS cca_allowance NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS gross_salary NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS pf_calculation_mode VARCHAR(30) DEFAULT 'capped_1800';`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS vpf_deduction NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS pf_deduction NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS esi_deduction NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS tds_deduction NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS pt_deduction NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS insurance_deduction NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS facility_deduction NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS other_deductions NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS offered_lpa NUMERIC(10,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS actual_lpa NUMERIC(10,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) DEFAULT 'full';`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS hold_reason TEXT;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS transaction_ref VARCHAR(100);`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS paid_leave_days INT DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS unpaid_leave_days INT DEFAULT 0;`;
      await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_comp_emp_month ON payroll(company_id, employee_id, month);`;

      await sql`
        CREATE TABLE IF NOT EXISTS employee_advances (
          id SERIAL PRIMARY KEY,
          company_id INT REFERENCES companies(id) ON DELETE CASCADE,
          employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
          advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
          amount NUMERIC(15,2) NOT NULL DEFAULT 0,
          payment_mode VARCHAR(30) DEFAULT 'cash',
          transaction_ref VARCHAR(100),
          monthly_deduction NUMERIC(15,2) DEFAULT 0,
          total_repaid NUMERIC(15,2) DEFAULT 0,
          outstanding NUMERIC(15,2) DEFAULT 0,
          repayment_status VARCHAR(20) DEFAULT 'active',
          approved_by INT REFERENCES users(id) ON DELETE SET NULL,
          receipt_number VARCHAR(50),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS employee_advance_receipts (
          id SERIAL PRIMARY KEY,
          advance_id INT REFERENCES employee_advances(id) ON DELETE CASCADE,
          receipt_number VARCHAR(50) NOT NULL,
          receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
          amount NUMERIC(15,2) DEFAULT 0,
          type VARCHAR(20) DEFAULT 'repayment'
        )
      `;

      await sql`ALTER TABLE employee_advances ADD COLUMN IF NOT EXISTS advance_date DATE DEFAULT CURRENT_DATE;`;
      await sql`ALTER TABLE employee_advances ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(30) DEFAULT 'cash';`;
      await sql`ALTER TABLE employee_advances ADD COLUMN IF NOT EXISTS transaction_ref VARCHAR(100);`;
      await sql`ALTER TABLE employee_advances ADD COLUMN IF NOT EXISTS monthly_deduction NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE employee_advances ADD COLUMN IF NOT EXISTS total_repaid NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE employee_advances ADD COLUMN IF NOT EXISTS outstanding NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE employee_advances ADD COLUMN IF NOT EXISTS repayment_status VARCHAR(20) DEFAULT 'active';`;
      await sql`ALTER TABLE employee_advances ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(50);`;
    } catch (e) {
      console.warn("Payroll table migration warning:", e.message);
    }

    // ═══════════════ PAYROLL LIST ═══════════════
    if (action === "list") {
      const month = req.query.month || new Date().toISOString().slice(0, 7); // YYYY-MM
      const statusFilter = req.query.status || "all";
      const searchQuery = (req.query.search || "").toLowerCase().trim();

      let rows;
      if (isAll) {
        rows = await sql`
          SELECT
            e.id as employee_id,
            e.name as employee_name,
            e.employee_code,
            e.department,
            e.bank_account,
            e.basic_salary as emp_basic_salary,
            c.name as company_name,
            e.company_id,
            p.id as payroll_id,
            p.id,
            ${month}::varchar as month,
            COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) as basic_salary,
            COALESCE(p.hra, p_prev.hra, ROUND(COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.40, 2)) as hra,
            COALESCE(p.da, p_prev.da, ROUND(COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.10, 2)) as da,
            COALESCE(p.ta, p_prev.ta, GREATEST(1600, ROUND(COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.05, 2))) as ta,
            COALESCE(p.special_allowance, p_prev.special_allowance, ROUND(COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.15, 2)) as special_allowance,
            COALESCE(p.incentives, 0) as incentives,
            COALESCE(p.bonuses, 0) as bonuses,
            COALESCE(p.lta_allowance, p_prev.lta_allowance, 0) as lta_allowance,
            COALESCE(p.children_edu_allowance, p_prev.children_edu_allowance, 0) as children_edu_allowance,
            COALESCE(p.uniform_allowance, p_prev.uniform_allowance, 0) as uniform_allowance,
            COALESCE(p.learning_allowance, p_prev.learning_allowance, 0) as learning_allowance,
            COALESCE(p.car_fuel_allowance, p_prev.car_fuel_allowance, 0) as car_fuel_allowance,
            COALESCE(p.cca_allowance, p_prev.cca_allowance, 0) as cca_allowance,
            COALESCE(p.gross_salary, p_prev.gross_salary, (COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 1.70 + GREATEST(1600, COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.05))) as gross_salary,
            COALESCE(p.leave_deductions, 0) as leave_deductions,
            COALESCE(p.advance_deductions, adv.active_adv_deduction, 0) as advance_deductions,
            COALESCE(p.pf_calculation_mode, p_prev.pf_calculation_mode, 'capped_1800') as pf_calculation_mode,
            COALESCE(p.vpf_deduction, p_prev.vpf_deduction, 0) as vpf_deduction,
            COALESCE(p.pf_deduction, p_prev.pf_deduction, LEAST(1800, ROUND(COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.12, 2))) as pf_deduction,
            COALESCE(p.esi_deduction, p_prev.esi_deduction, 0) as esi_deduction,
            COALESCE(p.tds_deduction, p_prev.tds_deduction, 0) as tds_deduction,
            COALESCE(p.pt_deduction, p_prev.pt_deduction, 0) as pt_deduction,
            COALESCE(p.insurance_deduction, p_prev.insurance_deduction, 0) as insurance_deduction,
            COALESCE(p.facility_deduction, p_prev.facility_deduction, 0) as facility_deduction,
            COALESCE(p.other_deductions, p_prev.other_deductions, 0) as other_deductions,
            COALESCE(p.total_deductions, p_prev.total_deductions, LEAST(1800, ROUND(COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.12, 2))) as total_deductions,
            COALESCE(p.net_salary, p_prev.net_salary, (COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 1.70 + GREATEST(1600, COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.05) - LEAST(1800, COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.12))) as net_salary,
            COALESCE(p.offered_lpa, p_prev.offered_lpa, ROUND(((COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 1.70 + GREATEST(1600, COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.05)) * 12 / 100000), 2)) as offered_lpa,
            COALESCE(p.actual_lpa, p_prev.actual_lpa, ROUND(((COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 1.70 + GREATEST(1600, COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.05) - LEAST(1800, COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.12)) * 12 / 100000), 2)) as actual_lpa,
            COALESCE(p.payment_status, 'pending') as payment_status,
            COALESCE(p.payment_type, 'full') as payment_type,
            COALESCE(p.paid_amount, 0) as paid_amount,
            COALESCE(p.remaining_balance, 0) as remaining_balance,
            p.hold_reason,
            p.payment_mode,
            p.transaction_ref,
            COALESCE(p.present_days, 0) as present_days,
            COALESCE(p.late_days, 0) as late_days,
            COALESCE(p.absent_days, 0) as absent_days,
            COALESCE(p.leave_days, 0) as leave_days,
            COALESCE(p.paid_leave_days, 0) as paid_leave_days,
            COALESCE(p.unpaid_leave_days, 0) as unpaid_leave_days
          FROM employees e
          LEFT JOIN payroll p ON (p.employee_id = e.id AND (p.month = ${month} OR p.month_year = ${month}))
          LEFT JOIN LATERAL (
            SELECT * FROM payroll WHERE employee_id = e.id ORDER BY updated_at DESC, id DESC LIMIT 1
          ) p_prev ON true
          LEFT JOIN (
            SELECT employee_id, SUM(LEAST(GREATEST(0, amount - COALESCE(total_repaid, 0)), COALESCE(NULLIF(monthly_deduction, 0), GREATEST(0, amount - COALESCE(total_repaid, 0))))) as active_adv_deduction
            FROM employee_advances
            WHERE repayment_status = 'active' AND (amount - COALESCE(total_repaid, 0)) > 0
            GROUP BY employee_id
          ) adv ON adv.employee_id = e.id
          LEFT JOIN companies c ON e.company_id = c.id
          LEFT JOIN users u ON (e.user_id = u.id OR u.employee_id = e.id)
          WHERE e.employment_status = 'active'
            AND LOWER(COALESCE(e.name, '')) != 'superadmin'
            AND LOWER(COALESCE(e.department, '')) != 'superadmin'
            AND (u.role IS NULL OR LOWER(u.role) != 'superadmin')
          ORDER BY e.name
        `;
      } else {
        const cId = safeInt(compQuery, 1);
        rows = await sql`
          SELECT
            e.id as employee_id,
            e.name as employee_name,
            e.employee_code,
            e.department,
            e.bank_account,
            e.basic_salary as emp_basic_salary,
            c.name as company_name,
            e.company_id,
            p.id as payroll_id,
            p.id,
            ${month}::varchar as month,
            COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) as basic_salary,
            COALESCE(p.hra, p_prev.hra, ROUND(COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.40, 2)) as hra,
            COALESCE(p.da, p_prev.da, ROUND(COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.10, 2)) as da,
            COALESCE(p.ta, p_prev.ta, GREATEST(1600, ROUND(COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.05, 2))) as ta,
            COALESCE(p.special_allowance, p_prev.special_allowance, ROUND(COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.15, 2)) as special_allowance,
            COALESCE(p.incentives, 0) as incentives,
            COALESCE(p.bonuses, 0) as bonuses,
            COALESCE(p.lta_allowance, p_prev.lta_allowance, 0) as lta_allowance,
            COALESCE(p.children_edu_allowance, p_prev.children_edu_allowance, 0) as children_edu_allowance,
            COALESCE(p.uniform_allowance, p_prev.uniform_allowance, 0) as uniform_allowance,
            COALESCE(p.learning_allowance, p_prev.learning_allowance, 0) as learning_allowance,
            COALESCE(p.car_fuel_allowance, p_prev.car_fuel_allowance, 0) as car_fuel_allowance,
            COALESCE(p.cca_allowance, p_prev.cca_allowance, 0) as cca_allowance,
            COALESCE(p.gross_salary, p_prev.gross_salary, (COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 1.70 + GREATEST(1600, COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.05))) as gross_salary,
            COALESCE(p.leave_deductions, 0) as leave_deductions,
            COALESCE(p.advance_deductions, adv.active_adv_deduction, 0) as advance_deductions,
            COALESCE(p.pf_calculation_mode, p_prev.pf_calculation_mode, 'capped_1800') as pf_calculation_mode,
            COALESCE(p.vpf_deduction, p_prev.vpf_deduction, 0) as vpf_deduction,
            COALESCE(p.pf_deduction, p_prev.pf_deduction, LEAST(1800, ROUND(COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.12, 2))) as pf_deduction,
            COALESCE(p.esi_deduction, p_prev.esi_deduction, 0) as esi_deduction,
            COALESCE(p.tds_deduction, p_prev.tds_deduction, 0) as tds_deduction,
            COALESCE(p.pt_deduction, p_prev.pt_deduction, 0) as pt_deduction,
            COALESCE(p.insurance_deduction, p_prev.insurance_deduction, 0) as insurance_deduction,
            COALESCE(p.facility_deduction, p_prev.facility_deduction, 0) as facility_deduction,
            COALESCE(p.other_deductions, p_prev.other_deductions, 0) as other_deductions,
            COALESCE(p.total_deductions, p_prev.total_deductions, LEAST(1800, ROUND(COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.12, 2))) as total_deductions,
            COALESCE(p.net_salary, p_prev.net_salary, (COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 1.70 + GREATEST(1600, COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.05) - LEAST(1800, COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.12))) as net_salary,
            COALESCE(p.offered_lpa, p_prev.offered_lpa, ROUND(((COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 1.70 + GREATEST(1600, COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.05)) * 12 / 100000), 2)) as offered_lpa,
            COALESCE(p.actual_lpa, p_prev.actual_lpa, ROUND(((COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 1.70 + GREATEST(1600, COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.05) - LEAST(1800, COALESCE(p.basic_salary, p_prev.basic_salary, e.basic_salary, 0) * 0.12)) * 12 / 100000), 2)) as actual_lpa,
            COALESCE(p.payment_status, 'pending') as payment_status,
            COALESCE(p.payment_type, 'full') as payment_type,
            COALESCE(p.paid_amount, 0) as paid_amount,
            COALESCE(p.remaining_balance, 0) as remaining_balance,
            p.hold_reason,
            p.payment_mode,
            p.transaction_ref,
            COALESCE(p.present_days, 0) as present_days,
            COALESCE(p.late_days, 0) as late_days,
            COALESCE(p.absent_days, 0) as absent_days,
            COALESCE(p.leave_days, 0) as leave_days,
            COALESCE(p.paid_leave_days, 0) as paid_leave_days,
            COALESCE(p.unpaid_leave_days, 0) as unpaid_leave_days
          FROM employees e
          LEFT JOIN payroll p ON (p.employee_id = e.id AND (p.month = ${month} OR p.month_year = ${month}))
          LEFT JOIN LATERAL (
            SELECT * FROM payroll WHERE employee_id = e.id ORDER BY updated_at DESC, id DESC LIMIT 1
          ) p_prev ON true
          LEFT JOIN (
            SELECT employee_id, SUM(LEAST(GREATEST(0, amount - COALESCE(total_repaid, 0)), COALESCE(NULLIF(monthly_deduction, 0), GREATEST(0, amount - COALESCE(total_repaid, 0))))) as active_adv_deduction
            FROM employee_advances
            WHERE repayment_status = 'active' AND (amount - COALESCE(total_repaid, 0)) > 0
            GROUP BY employee_id
          ) adv ON adv.employee_id = e.id
          LEFT JOIN companies c ON e.company_id = c.id
          LEFT JOIN users u ON (e.user_id = u.id OR u.employee_id = e.id)
          WHERE e.company_id = ${cId} AND e.employment_status = 'active'
            AND LOWER(COALESCE(e.name, '')) != 'superadmin'
            AND LOWER(COALESCE(e.department, '')) != 'superadmin'
            AND (u.role IS NULL OR LOWER(u.role) != 'superadmin')
          ORDER BY e.name
        `;
      }

      // Filter in JS if status or search provided
      if (statusFilter && statusFilter !== 'all') {
        rows = rows.filter(r => (r.payment_status || '').toLowerCase() === statusFilter.toLowerCase());
      }
      if (searchQuery) {
        rows = rows.filter(r =>
          (r.employee_name || '').toLowerCase().includes(searchQuery) ||
          (r.employee_code || '').toLowerCase().includes(searchQuery) ||
          (r.department || '').toLowerCase().includes(searchQuery)
        );
      }

      return res.status(200).json({ success: true, payroll: rows, month });
    }

    // ═══════════════ PROCESS MONTHLY SALARIES ═══════════════
    else if (action === "process") {
      const { company_id, month, total_working_days } = req.body;
      const compId = user.role === "superadmin" ? (company_id ? parseInt(company_id) : null) : user.company_id;

      if (!compId || !month) return res.status(400).json({ error: "Company and Month (YYYY-MM) required" });

      const workingDays = total_working_days ? parseInt(total_working_days) : 30;

      // Fetch active employees for company
      const employees = await sql`
        SELECT e.* FROM employees e
        LEFT JOIN users u ON (e.user_id = u.id OR u.employee_id = e.id)
        WHERE e.company_id = ${compId} AND e.employment_status = 'active'
          AND LOWER(COALESCE(e.name, '')) != 'superadmin'
          AND LOWER(COALESCE(e.department, '')) != 'superadmin'
          AND (u.role IS NULL OR LOWER(u.role) != 'superadmin')
      `;

      if (employees.length === 0) {
        return res.status(400).json({ error: "No active employees found for this company" });
      }

      const [yr, mo] = month.split('-').map(Number);
      const lastDay = new Date(yr, mo, 0).getDate();
      const startDate = `${month}-01`;
      const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

      const processedRecords = [];

      for (const emp of employees) {
        // Fetch existing payroll for this employee in this month, or fallback to their most recent saved configuration
        let existingPayroll = await sql`
          SELECT * FROM payroll WHERE company_id = ${compId} AND employee_id = ${emp.id} AND (month = ${month} OR month_year = ${month}) LIMIT 1
        `;
        if (existingPayroll.length === 0) {
          existingPayroll = await sql`
            SELECT * FROM payroll WHERE company_id = ${compId} AND employee_id = ${emp.id} ORDER BY month DESC, id DESC LIMIT 1
          `;
        }
        const hasPrev = existingPayroll.length > 0;
        const prev = hasPrev ? existingPayroll[0] : {};

        const basic = hasPrev && prev.basic_salary ? parseFloat(prev.basic_salary) : parseFloat(emp.basic_salary || 0);

        const hra = hasPrev && prev.hra !== undefined ? parseFloat(prev.hra) : Math.round(basic * 0.40 * 100) / 100;
        const da = hasPrev && prev.da !== undefined ? parseFloat(prev.da) : Math.round(basic * 0.10 * 100) / 100;
        const ta = hasPrev && prev.ta !== undefined ? parseFloat(prev.ta) : Math.round(Math.max(1600, basic * 0.05) * 100) / 100;
        const specialAllowance = hasPrev && prev.special_allowance !== undefined ? parseFloat(prev.special_allowance) : Math.round(basic * 0.15 * 100) / 100;

        const lta = hasPrev ? parseFloat(prev.lta_allowance || 0) : 0;
        const edu = hasPrev ? parseFloat(prev.children_edu_allowance || 0) : 0;
        const uni = hasPrev ? parseFloat(prev.uniform_allowance || 0) : 0;
        const learn = hasPrev ? parseFloat(prev.learning_allowance || 0) : 0;
        const fuel = hasPrev ? parseFloat(prev.car_fuel_allowance || 0) : 0;
        const cca = hasPrev ? parseFloat(prev.cca_allowance || 0) : 0;

        // Check overrides array passed from modal, else retain prev, else 0
        const overrideObj = (req.body?.employee_overrides || []).find(o => parseInt(o.employee_id) === emp.id);
        const incentives = overrideObj ? parseFloat(overrideObj.incentives || 0) : (hasPrev ? parseFloat(prev.incentives || 0) : 0);
        const bonuses = overrideObj ? parseFloat(overrideObj.bonuses || 0) : (hasPrev ? parseFloat(prev.bonuses || 0) : 0);

        const grossMonthly = basic + hra + da + ta + specialAllowance + lta + edu + uni + learn + fuel + cca + incentives + bonuses;
        const offeredLpa = hasPrev && prev.offered_lpa ? parseFloat(prev.offered_lpa) : Math.round((grossMonthly * 12 / 100000) * 100) / 100;

        // Attendance stats
        const attStats = await sql`
          SELECT
            COUNT(CASE WHEN status = 'present' THEN 1 END) as present_days,
            COUNT(CASE WHEN status = 'late' THEN 1 END) as late_days,
            COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_days,
            COUNT(CASE WHEN status = 'leave' THEN 1 END) as leave_days
          FROM attendance
          WHERE employee_id = ${emp.id} AND date BETWEEN ${startDate} AND ${endDate}
        `;

        const pDays = parseInt(attStats[0].present_days || 0);
        const lDays = parseInt(attStats[0].late_days || 0);
        const aDays = parseInt(attStats[0].absent_days || 0);
        const lvDays = parseInt(attStats[0].leave_days || 0);

        // Check paid vs unpaid leave applications
        const leavesQuery = await sql`
          SELECT COALESCE(SUM(l.total_days), 0) as paid_days
          FROM leave_applications l
          LEFT JOIN leave_types lt ON l.leave_type_id = lt.id
          WHERE l.employee_id = ${emp.id} AND l.status = 'approved'
            AND l.start_date <= ${endDate} AND l.end_date >= ${startDate}
            AND (lt.is_paid IS NULL OR lt.is_paid = true)
        `;
        const paidLeaveDays = Math.min(lvDays, parseInt(leavesQuery[0].paid_days || 0));
        const unpaidLeaveDays = Math.max(0, lvDays - paidLeaveDays);

        // Unexcused absence & late cut calculation
        const totalUnpaidDays = aDays + unpaidLeaveDays + (lDays * 0.5);
        const dailyRate = grossMonthly / workingDays;
        const leaveDeduction = Math.round(dailyRate * totalUnpaidDays * 100) / 100;

        // Active advance deductions calculation
        const activeAdvs = await sql`
          SELECT id, amount, monthly_deduction, total_repaid, outstanding
          FROM employee_advances
          WHERE employee_id = ${emp.id} AND repayment_status = 'active'
          ORDER BY advance_date ASC, id ASC
        `;
        let advanceDeduction = 0;
        const advsToSettle = [];
        for (const adv of activeAdvs) {
          const curRepaid = parseFloat(adv.total_repaid || 0);
          const totalAmt = parseFloat(adv.amount || 0);
          const pending = Math.max(0, Math.round((totalAmt - curRepaid) * 100) / 100);
          if (pending <= 0) {
            await sql`UPDATE employee_advances SET repayment_status = 'completed', outstanding = 0, updated_at = NOW() WHERE id = ${adv.id}`;
            continue;
          }
          const mDed = adv.monthly_deduction && parseFloat(adv.monthly_deduction) > 0
            ? parseFloat(adv.monthly_deduction)
            : pending;
          const ded = Math.min(pending, mDed);
          advanceDeduction += ded;
          advsToSettle.push({ id: adv.id, ded, curRepaid, totalAmt, pending });
        }
        advanceDeduction = Math.round(advanceDeduction * 100) / 100;

        // EPF / PF Deduction Strategy
        const pfMode = hasPrev && prev.pf_calculation_mode ? prev.pf_calculation_mode : 'capped_1800';
        const vpfDed = hasPrev ? parseFloat(prev.vpf_deduction || 0) : 0;
        let pfDeduction = 0;

        if (hasPrev && prev.pf_deduction !== undefined && prev.pf_deduction !== null) {
          pfDeduction = parseFloat(prev.pf_deduction);
        } else {
          if (pfMode === 'actual_12') {
            pfDeduction = Math.round((basic + da) * 0.12 * 100) / 100;
          } else if (pfMode === 'vpf') {
            pfDeduction = Math.min(1800, Math.round((basic + da) * 0.12 * 100) / 100) + vpfDed;
          } else if (pfMode === 'custom') {
            pfDeduction = hasPrev ? parseFloat(prev.pf_deduction || 0) : 0;
          } else { // capped_1800
            pfDeduction = Math.min(1800, Math.round((basic + da) * 0.12 * 100) / 100);
          }
        }

        const esiDeduction = hasPrev && prev.esi_deduction !== undefined ? parseFloat(prev.esi_deduction) : (grossMonthly <= 21000 ? Math.round(grossMonthly * 0.0075 * 100) / 100 : 0);
        const tdsDeduction = hasPrev ? parseFloat(prev.tds_deduction || 0) : 0;
        const ptDeduction = hasPrev ? parseFloat(prev.pt_deduction || 0) : 0;
        const insuranceDeduction = hasPrev ? parseFloat(prev.insurance_deduction || 0) : 0;
        const facilityDeduction = hasPrev ? parseFloat(prev.facility_deduction || 0) : 0;
        const otherDeductions = hasPrev ? parseFloat(prev.other_deductions || 0) : 0;

        const totalDeductions = Math.round((leaveDeduction + advanceDeduction + pfDeduction + esiDeduction + tdsDeduction + ptDeduction + insuranceDeduction + facilityDeduction + otherDeductions) * 100) / 100;
        const netSalary = Math.max(0, Math.round((grossMonthly - totalDeductions) * 100) / 100);
        const actualLpa = Math.round((netSalary * 12 / 100000) * 100) / 100;

        const pStatus = hasPrev && prev.payment_status ? prev.payment_status : 'pending';
        const pType = hasPrev && prev.payment_type ? prev.payment_type : 'full';
        const holdReason = hasPrev ? prev.hold_reason : null;

        const rec = await sql`
          INSERT INTO payroll (
            company_id, employee_id, month, month_year, basic_salary, hra, da, ta, special_allowance,
            incentives, bonuses, lta_allowance, children_edu_allowance, uniform_allowance, learning_allowance,
            car_fuel_allowance, cca_allowance, gross_salary, present_days, late_days, absent_days, leave_days,
            paid_leave_days, unpaid_leave_days, leave_deductions, advance_deductions, pf_calculation_mode, vpf_deduction,
            pf_deduction, esi_deduction, tds_deduction, pt_deduction, insurance_deduction, facility_deduction,
            other_deductions, total_deductions, net_salary, offered_lpa, actual_lpa,
            payment_status, payment_type, paid_amount, remaining_balance, hold_reason, processed_by
          ) VALUES (
            ${compId}, ${emp.id}, ${month}, ${month}, ${basic}, ${hra}, ${da}, ${ta}, ${specialAllowance},
            ${incentives}, ${bonuses}, ${lta}, ${edu}, ${uni}, ${learn},
            ${fuel}, ${cca}, ${grossMonthly}, ${pDays + lDays}, ${lDays}, ${aDays}, ${lvDays},
            ${paidLeaveDays}, ${unpaidLeaveDays}, ${leaveDeduction}, ${advanceDeduction}, ${pfMode}, ${vpfDed},
            ${pfDeduction}, ${esiDeduction}, ${tdsDeduction}, ${ptDeduction}, ${insuranceDeduction}, ${facilityDeduction},
            ${otherDeductions}, ${totalDeductions}, ${netSalary}, ${offeredLpa}, ${actualLpa},
            ${pStatus}, ${pType}, 0, ${netSalary}, ${holdReason}, ${user.id}
          )
          ON CONFLICT (company_id, employee_id, month) DO UPDATE SET
            basic_salary = EXCLUDED.basic_salary,
            hra = EXCLUDED.hra,
            da = EXCLUDED.da,
            ta = EXCLUDED.ta,
            special_allowance = EXCLUDED.special_allowance,
            incentives = EXCLUDED.incentives,
            bonuses = EXCLUDED.bonuses,
            lta_allowance = EXCLUDED.lta_allowance,
            children_edu_allowance = EXCLUDED.children_edu_allowance,
            uniform_allowance = EXCLUDED.uniform_allowance,
            learning_allowance = EXCLUDED.learning_allowance,
            car_fuel_allowance = EXCLUDED.car_fuel_allowance,
            cca_allowance = EXCLUDED.cca_allowance,
            gross_salary = EXCLUDED.gross_salary,
            present_days = EXCLUDED.present_days,
            late_days = EXCLUDED.late_days,
            absent_days = EXCLUDED.absent_days,
            leave_days = EXCLUDED.leave_days,
            paid_leave_days = EXCLUDED.paid_leave_days,
            unpaid_leave_days = EXCLUDED.unpaid_leave_days,
            leave_deductions = EXCLUDED.leave_deductions,
            advance_deductions = EXCLUDED.advance_deductions,
            pf_calculation_mode = EXCLUDED.pf_calculation_mode,
            vpf_deduction = EXCLUDED.vpf_deduction,
            pf_deduction = EXCLUDED.pf_deduction,
            esi_deduction = EXCLUDED.esi_deduction,
            tds_deduction = EXCLUDED.tds_deduction,
            pt_deduction = EXCLUDED.pt_deduction,
            insurance_deduction = EXCLUDED.insurance_deduction,
            facility_deduction = EXCLUDED.facility_deduction,
            other_deductions = EXCLUDED.other_deductions,
            total_deductions = EXCLUDED.total_deductions,
            net_salary = EXCLUDED.net_salary,
            offered_lpa = EXCLUDED.offered_lpa,
            actual_lpa = EXCLUDED.actual_lpa,
            payment_status = EXCLUDED.payment_status,
            payment_type = EXCLUDED.payment_type,
            hold_reason = EXCLUDED.hold_reason,
            processed_by = EXCLUDED.processed_by
          RETURNING *
        `;

        // Apply advance repayment updates for active advances
        for (const item of advsToSettle) {
          if (item.ded > 0) {
            const nextRepaid = Math.round((item.curRepaid + item.ded) * 100) / 100;
            const nextOutstanding = Math.max(0, Math.round((item.totalAmt - nextRepaid) * 100) / 100);
            const nextStatus = nextOutstanding <= 0 ? 'completed' : 'active';
            await sql`
              UPDATE employee_advances SET
                total_repaid = ${nextRepaid},
                outstanding = ${nextOutstanding},
                repayment_status = ${nextStatus},
                updated_at = NOW()
              WHERE id = ${item.id}
            `;
            const rNum = 'DED-' + month + '-' + Math.floor(1000 + Math.random() * 9000);
            try {
              await sql`
                INSERT INTO employee_advance_receipts (
                  advance_id, receipt_number, receipt_date, amount, type
                ) VALUES (
                  ${item.id}, ${rNum}, CURRENT_DATE, ${item.ded}, 'salary_deduction'
                )
              `;
            } catch (rErr) {
              console.warn("Receipt creation warning:", rErr.message);
            }
          }
        }

        processedRecords.push(rec[0]);
      }

      return res.status(200).json({
        success: true,
        processed_count: processedRecords.length,
        message: `Payroll processed for ${processedRecords.length} employees for ${month}`
      });
    }

    // ═══════════════ ADJUST SALARY & PAYMENT SETTINGS ═══════════════
    else if (action === "adjust-salary" || action === "salary-adjust") {
      if (!['superadmin', 'storeadmin', 'hr', 'hr_manager', 'accountant'].includes(user.role)) {
        return res.status(403).json({ error: "Access denied. HR/Storeadmin/Superadmin only." });
      }

      const {
        id, payroll_id, employee_id, company_id, month, basic_salary, hra, da, ta, special_allowance, incentives, bonuses,
        lta_allowance, children_edu_allowance, uniform_allowance, learning_allowance, car_fuel_allowance, cca_allowance,
        leave_deductions, advance_deductions, pf_calculation_mode, vpf_deduction, pf_deduction, esi_deduction,
        tds_deduction, pt_deduction, insurance_deduction, facility_deduction, other_deductions,
        payment_type, paid_amount, hold_reason, payment_mode, transaction_ref
      } = req.body;

      let pId = id || payroll_id;
      let rec;
      const targetEmpId = employee_id || req.body?.employee_id;
      const targetMonth = month || req.body?.month || new Date().toISOString().slice(0, 7);

      if (pId) {
        const existing = await sql`SELECT * FROM payroll WHERE id = ${parseInt(pId)}`;
        if (existing.length > 0) rec = existing[0];
      }

      if (!rec && targetEmpId) {
        const existing = await sql`
          SELECT * FROM payroll
          WHERE employee_id = ${parseInt(targetEmpId)} AND (month = ${targetMonth} OR month_year = ${targetMonth})
          LIMIT 1
        `;
        if (existing.length > 0) {
          rec = existing[0];
          pId = rec.id;
        }
      }

      let compIdVal = rec ? rec.company_id : (user.role === 'superadmin' ? (company_id ? parseInt(company_id) : (user.company_id || 1)) : (user.company_id || 1));
      let empIdVal = rec ? rec.employee_id : parseInt(targetEmpId);

      if (!rec && !empIdVal) {
        return res.status(400).json({ error: "Employee ID or Payroll record ID required" });
      }

      if (user.role !== 'superadmin' && user.company_id && parseInt(compIdVal) !== parseInt(user.company_id)) {
        return res.status(403).json({ error: "Access denied. Cannot modify salary for another company." });
      }

      const basic = parseFloat(basic_salary !== undefined ? basic_salary : (rec ? rec.basic_salary : 0));
      const vHra = parseFloat(hra !== undefined ? hra : (rec ? rec.hra : Math.round(basic * 0.40)));
      const vDa = parseFloat(da !== undefined ? da : (rec ? rec.da : Math.round(basic * 0.10)));
      const vTa = parseFloat(ta !== undefined ? ta : (rec ? rec.ta : Math.max(1600, Math.round(basic * 0.05))));
      const vSpecial = parseFloat(special_allowance !== undefined ? special_allowance : (rec ? rec.special_allowance : Math.round(basic * 0.15)));
      const vInc = parseFloat(incentives !== undefined ? incentives : (rec ? rec.incentives : 0));
      const vBon = parseFloat(bonuses !== undefined ? bonuses : (rec ? rec.bonuses : 0));

      const vLta = parseFloat(lta_allowance !== undefined ? lta_allowance : (rec ? rec.lta_allowance : 0));
      const vEdu = parseFloat(children_edu_allowance !== undefined ? children_edu_allowance : (rec ? rec.children_edu_allowance : 0));
      const vUni = parseFloat(uniform_allowance !== undefined ? uniform_allowance : (rec ? rec.uniform_allowance : 0));
      const vLearn = parseFloat(learning_allowance !== undefined ? learning_allowance : (rec ? rec.learning_allowance : 0));
      const vFuel = parseFloat(car_fuel_allowance !== undefined ? car_fuel_allowance : (rec ? rec.car_fuel_allowance : 0));
      const vCca = parseFloat(cca_allowance !== undefined ? cca_allowance : (rec ? rec.cca_allowance : 0));

      const grossMonthly = basic + vHra + vDa + vTa + vSpecial + vInc + vBon + vLta + vEdu + vUni + vLearn + vFuel + vCca;
      const offeredLpa = Math.round((grossMonthly * 12 / 100000) * 100) / 100;

      const pfMode = pf_calculation_mode || (rec ? rec.pf_calculation_mode : 'capped_1800');
      const vVpf = parseFloat(vpf_deduction !== undefined ? vpf_deduction : (rec ? rec.vpf_deduction : 0));

      let computedPf = 0;
      if (pfMode === 'actual_12') {
        computedPf = Math.round((basic + vDa) * 0.12 * 100) / 100;
      } else if (pfMode === 'vpf') {
        computedPf = Math.min(1800, Math.round((basic + vDa) * 0.12 * 100) / 100) + vVpf;
      } else if (pfMode === 'custom') {
        computedPf = parseFloat(pf_deduction !== undefined ? pf_deduction : (rec ? rec.pf_deduction : 0));
      } else { // capped_1800
        computedPf = Math.min(1800, Math.round((basic + vDa) * 0.12 * 100) / 100);
      }
      const vPf = parseFloat(pf_deduction !== undefined ? pf_deduction : computedPf);

      const vLeaveDed = parseFloat(leave_deductions !== undefined ? leave_deductions : (rec ? rec.leave_deductions : 0));
      const vAdvDed = parseFloat(advance_deductions !== undefined ? advance_deductions : (rec ? rec.advance_deductions : 0));
      const vEsi = parseFloat(esi_deduction !== undefined ? esi_deduction : (rec ? rec.esi_deduction : (grossMonthly <= 21000 ? Math.round(grossMonthly * 0.0075) : 0)));
      const vTds = parseFloat(tds_deduction !== undefined ? tds_deduction : (rec ? rec.tds_deduction : 0));
      const vPt = parseFloat(pt_deduction !== undefined ? pt_deduction : (rec ? rec.pt_deduction : 0));
      const vInsurance = parseFloat(insurance_deduction !== undefined ? insurance_deduction : (rec ? rec.insurance_deduction : 0));
      const vFacility = parseFloat(facility_deduction !== undefined ? facility_deduction : (rec ? rec.facility_deduction : 0));
      const vOth = parseFloat(other_deductions !== undefined ? other_deductions : (rec ? rec.other_deductions : 0));

      const totalDeductions = vLeaveDed + vAdvDed + vPf + vEsi + vTds + vPt + vInsurance + vFacility + vOth;
      const netSalary = Math.max(0, Math.round((grossMonthly - totalDeductions) * 100) / 100);
      const actualLpa = Math.round((netSalary * 12 / 100000) * 100) / 100;

      const pType = payment_type || (rec ? rec.payment_type : 'full');
      let pStatus = rec ? rec.payment_status : 'pending';
      let vPaidAmt = parseFloat(paid_amount !== undefined ? paid_amount : (rec ? rec.paid_amount : 0));
      let vRemBal = 0;

      if (pType === 'hold') {
        pStatus = 'on_hold';
        vPaidAmt = 0;
        vRemBal = netSalary;
      } else if (pType === 'part') {
        pStatus = 'part_paid';
        vRemBal = Math.max(0, netSalary - vPaidAmt);
      } else if (pType === 'full') {
        pStatus = 'paid';
        vPaidAmt = netSalary;
        vRemBal = 0;
      }

      let updated;
      if (pId) {
        updated = await sql`
          UPDATE payroll SET
            basic_salary = ${basic},
            hra = ${vHra},
            da = ${vDa},
            ta = ${vTa},
            special_allowance = ${vSpecial},
            incentives = ${vInc},
            bonuses = ${vBon},
            lta_allowance = ${vLta},
            children_edu_allowance = ${vEdu},
            uniform_allowance = ${vUni},
            learning_allowance = ${vLearn},
            car_fuel_allowance = ${vFuel},
            cca_allowance = ${vCca},
            gross_salary = ${grossMonthly},
            offered_lpa = ${offeredLpa},
            pf_calculation_mode = ${pfMode},
            vpf_deduction = ${vVpf},
            leave_deductions = ${vLeaveDed},
            advance_deductions = ${vAdvDed},
            pf_deduction = ${vPf},
            esi_deduction = ${vEsi},
            tds_deduction = ${vTds},
            pt_deduction = ${vPt},
            insurance_deduction = ${vInsurance},
            facility_deduction = ${vFacility},
            other_deductions = ${vOth},
            total_deductions = ${totalDeductions},
            net_salary = ${netSalary},
            actual_lpa = ${actualLpa},
            payment_type = ${pType},
            payment_status = ${pStatus},
            paid_amount = ${vPaidAmt},
            remaining_balance = ${vRemBal},
            hold_reason = ${hold_reason || null},
            payment_mode = ${payment_mode || (rec ? rec.payment_mode : 'bank_transfer')},
            transaction_ref = ${transaction_ref || (rec ? rec.transaction_ref : null)},
            payment_date = ${pStatus === 'paid' || pStatus === 'part_paid' ? ((rec && rec.payment_date) || new Date().toISOString().split("T")[0]) : null},
            updated_at = NOW()
          WHERE id = ${parseInt(pId)}
          RETURNING *
        `;
      } else {
        updated = await sql`
          INSERT INTO payroll (
            company_id, employee_id, month, month_year, basic_salary, hra, da, ta, special_allowance,
            incentives, bonuses, lta_allowance, children_edu_allowance, uniform_allowance, learning_allowance,
            car_fuel_allowance, cca_allowance, gross_salary, pf_calculation_mode, vpf_deduction,
            leave_deductions, advance_deductions, pf_deduction, esi_deduction, tds_deduction, pt_deduction,
            insurance_deduction, facility_deduction, other_deductions, total_deductions, net_salary, offered_lpa, actual_lpa,
            payment_type, payment_status, paid_amount, remaining_balance, hold_reason, payment_mode,
            transaction_ref, payment_date, processed_by
          ) VALUES (
            ${compIdVal}, ${empIdVal}, ${targetMonth}, ${targetMonth}, ${basic}, ${vHra}, ${vDa}, ${vTa}, ${vSpecial},
            ${vInc}, ${vBon}, ${vLta}, ${vEdu}, ${vUni}, ${vLearn}, ${vFuel}, ${vCca}, ${grossMonthly},
            ${pfMode}, ${vVpf}, ${vLeaveDed}, ${vAdvDed}, ${vPf}, ${vEsi}, ${vTds}, ${vPt}, ${vInsurance}, ${vFacility}, ${vOth},
            ${totalDeductions}, ${netSalary}, ${offeredLpa}, ${actualLpa},
            ${pType}, ${pStatus}, ${vPaidAmt}, ${vRemBal}, ${hold_reason || null}, ${payment_mode || 'bank_transfer'},
            ${transaction_ref || null}, ${pStatus === 'paid' || pStatus === 'part_paid' ? new Date().toISOString().split("T")[0] : null}, ${user.id}
          )
          ON CONFLICT (company_id, employee_id, month) DO UPDATE SET
            basic_salary = EXCLUDED.basic_salary,
            hra = EXCLUDED.hra,
            da = EXCLUDED.da,
            ta = EXCLUDED.ta,
            special_allowance = EXCLUDED.special_allowance,
            incentives = EXCLUDED.incentives,
            bonuses = EXCLUDED.bonuses,
            lta_allowance = EXCLUDED.lta_allowance,
            children_edu_allowance = EXCLUDED.children_edu_allowance,
            uniform_allowance = EXCLUDED.uniform_allowance,
            learning_allowance = EXCLUDED.learning_allowance,
            car_fuel_allowance = EXCLUDED.car_fuel_allowance,
            cca_allowance = EXCLUDED.cca_allowance,
            gross_salary = EXCLUDED.gross_salary,
            pf_calculation_mode = EXCLUDED.pf_calculation_mode,
            vpf_deduction = EXCLUDED.vpf_deduction,
            leave_deductions = EXCLUDED.leave_deductions,
            advance_deductions = EXCLUDED.advance_deductions,
            pf_deduction = EXCLUDED.pf_deduction,
            esi_deduction = EXCLUDED.esi_deduction,
            tds_deduction = EXCLUDED.tds_deduction,
            pt_deduction = EXCLUDED.pt_deduction,
            insurance_deduction = EXCLUDED.insurance_deduction,
            facility_deduction = EXCLUDED.facility_deduction,
            other_deductions = EXCLUDED.other_deductions,
            total_deductions = EXCLUDED.total_deductions,
            net_salary = EXCLUDED.net_salary,
            offered_lpa = EXCLUDED.offered_lpa,
            actual_lpa = EXCLUDED.actual_lpa,
            payment_type = EXCLUDED.payment_type,
            payment_status = EXCLUDED.payment_status,
            paid_amount = EXCLUDED.paid_amount,
            remaining_balance = EXCLUDED.remaining_balance,
            hold_reason = EXCLUDED.hold_reason,
            payment_mode = EXCLUDED.payment_mode,
            transaction_ref = EXCLUDED.transaction_ref,
            payment_date = EXCLUDED.payment_date,
            processed_by = EXCLUDED.processed_by
          RETURNING *
        `;
      }

      // Auto update employee_advances if advance deductions settled
      if (vAdvDed > 0) {
        try {
          const activeAdvs = await sql`
            SELECT id, amount, total_repaid FROM employee_advances
            WHERE employee_id = ${empIdVal} AND repayment_status = 'active'
            ORDER BY created_at ASC, id ASC
          `;
          let remToRepay = vAdvDed;
          for (const adv of activeAdvs) {
            if (remToRepay <= 0) break;
            const curRepaid = parseFloat(adv.total_repaid || 0);
            const totalAmt = parseFloat(adv.amount || 0);
            const pending = Math.max(0, Math.round((totalAmt - curRepaid) * 100) / 100);
            if (pending > 0) {
              const applyAmt = Math.min(pending, remToRepay);
              const nextRepaid = Math.round((curRepaid + applyAmt) * 100) / 100;
              const nextOutstanding = Math.max(0, Math.round((totalAmt - nextRepaid) * 100) / 100);
              const nextStatus = nextOutstanding <= 0 ? 'completed' : 'active';
              await sql`
                UPDATE employee_advances SET
                  total_repaid = ${nextRepaid},
                  outstanding = ${nextOutstanding},
                  repayment_status = ${nextStatus},
                  updated_at = NOW()
                WHERE id = ${adv.id}
              `;
              const rNum = 'DED-' + (targetMonth || 'ADJ') + '-' + Math.floor(1000 + Math.random() * 9000);
              try {
                await sql`
                  INSERT INTO employee_advance_receipts (
                    advance_id, receipt_number, receipt_date, amount, type
                  ) VALUES (
                    ${adv.id}, ${rNum}, CURRENT_DATE, ${applyAmt}, 'salary_deduction'
                  )
                `;
              } catch (rErr) {
                console.warn("Receipt creation warning:", rErr.message);
              }
              remToRepay = Math.round((remToRepay - applyAmt) * 100) / 100;
            } else {
              await sql`UPDATE employee_advances SET repayment_status = 'completed', outstanding = 0, updated_at = NOW() WHERE id = ${adv.id}`;
            }
          }
        } catch (advErr) {
          console.warn("Advance auto repayment update warning:", advErr.message);
        }
      }

      // Sync base salary to employees table
      if (empIdVal && basic > 0) {
        try {
          await sql`
            UPDATE employees SET basic_salary = ${basic}, updated_at = NOW()
            WHERE id = ${empIdVal}
          `;
        } catch (eErr) {
          console.warn("Update employee basic_salary warning:", eErr.message);
        }
      }

      return res.status(200).json({
        success: true,
        payroll: updated[0],
        message: `Salary details updated & base basic salary saved to employee profile.`
      });
    }

    // ═══════════════ MARK SALARY PAID ═══════════════
    else if (action === "update-status") {
      const { payroll_ids, payment_mode, transaction_ref } = req.body;
      if (!Array.isArray(payroll_ids) || payroll_ids.length === 0) {
        return res.status(400).json({ error: "payroll_ids array required" });
      }

      await sql`
        UPDATE payroll SET
          payment_status = 'paid',
          payment_type = 'full',
          paid_amount = net_salary,
          remaining_balance = 0,
          payment_date = CURRENT_DATE,
          payment_mode = ${payment_mode || 'bank_transfer'},
          transaction_ref = ${transaction_ref || null}
        WHERE id = ANY(${payroll_ids})
      `;

      return res.status(200).json({ success: true, message: `${payroll_ids.length} salaries marked as Paid` });
    }

    // ═══════════════ RELEASE HELD SALARY ═══════════════
    else if (action === "release-hold") {
      const { payroll_id, payment_mode, transaction_ref } = req.body;
      const pId = payroll_id || req.body?.id;
      if (!pId) return res.status(400).json({ error: "payroll_id required" });

      const updated = await sql`
        UPDATE payroll SET
          payment_status = 'paid',
          payment_type = 'full',
          paid_amount = net_salary,
          remaining_balance = 0,
          hold_reason = NULL,
          payment_date = CURRENT_DATE,
          payment_mode = ${payment_mode || 'bank_transfer'},
          transaction_ref = ${transaction_ref || null},
          updated_at = NOW()
        WHERE id = ${parseInt(pId)}
        RETURNING *
      `;

      return res.status(200).json({ success: true, payroll: updated[0], message: "Held salary released and marked as PAID successfully" });
    }

    // ═══════════════ SALARY ADVANCES ═══════════════
    else if (action === "advance-list") {
      let rows;
      if (isAll) {
        rows = await sql`
          SELECT a.*, e.name as employee_name, e.employee_code, e.department, c.name as company_name
          FROM employee_advances a
          JOIN employees e ON a.employee_id = e.id
          LEFT JOIN companies c ON a.company_id = c.id
          ORDER BY a.created_at DESC, a.id DESC
        `;
      } else {
        rows = await sql`
          SELECT a.*, e.name as employee_name, e.employee_code, e.department, c.name as company_name
          FROM employee_advances a
          JOIN employees e ON a.employee_id = e.id
          LEFT JOIN companies c ON a.company_id = c.id
          WHERE a.company_id = ${safeInt(compQuery, 1)}
          ORDER BY a.created_at DESC, a.id DESC
        `;
      }
      return res.status(200).json({ success: true, advances: rows });
    }

    else if (action === "advance-create") {
      const { company_id, employee_id, advance_date, amount, monthly_deduction, payment_mode, transaction_ref } = req.body;
      const compId = user.role === "superadmin" ? (company_id ? parseInt(company_id) : null) : user.company_id;

      if (!compId || !employee_id || !amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: "Company, Employee, and a valid Advance Amount are required" });
      }

      const advAmt = parseFloat(amount);
      const mDed = monthly_deduction ? parseFloat(monthly_deduction) : Math.round((advAmt / 4) * 100) / 100;
      const advDate = advance_date || new Date().toISOString().slice(0, 10);
      const pMode = payment_mode || 'bank_transfer';
      const rNum = 'ADV-' + Date.now().toString().slice(-6) + '-' + Math.floor(10 + Math.random() * 90);

      const advRes = await sql`
        INSERT INTO employee_advances (
          company_id, employee_id, advance_date, amount, payment_mode, transaction_ref,
          monthly_deduction, total_repaid, outstanding, repayment_status, approved_by, receipt_number
        ) VALUES (
          ${compId}, ${parseInt(employee_id)}, ${advDate}, ${advAmt}, ${pMode}, ${transaction_ref || null},
          ${mDed}, 0, ${advAmt}, 'active', ${user.id || null}, ${rNum}
        )
        RETURNING *
      `;

      const newAdv = advRes[0];

      try {
        await sql`
          INSERT INTO employee_advance_receipts (
            advance_id, receipt_number, receipt_date, amount, type
          ) VALUES (
            ${newAdv.id}, ${rNum}, ${advDate}, ${advAmt}, 'grant'
          )
        `;
      } catch (rErr) {
        console.warn("Receipt creation warning:", rErr.message);
      }

      return res.status(200).json({ success: true, advance: newAdv, message: `Salary Advance #${rNum} granted successfully!` });
    }

    else if (action === "advance-repay") {
      const { advance_id, amount, receipt_date, payment_mode, transaction_ref } = req.body;
      if (!advance_id || !amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: "Advance ID and valid Repayment Amount required" });
      }

      const advId = parseInt(advance_id);
      const repayAmt = parseFloat(amount);
      const rDate = receipt_date || new Date().toISOString().slice(0, 10);
      const rNum = 'RCP-' + Date.now().toString().slice(-6) + '-' + Math.floor(10 + Math.random() * 90);

      const advRows = await sql`SELECT * FROM employee_advances WHERE id = ${advId} LIMIT 1`;
      if (advRows.length === 0) return res.status(404).json({ error: "Advance record not found" });

      const adv = advRows[0];
      const curRepaid = parseFloat(adv.total_repaid || 0);
      const totalAmt = parseFloat(adv.amount || 0);

      const nextRepaid = Math.round((curRepaid + repayAmt) * 100) / 100;
      const nextOutstanding = Math.max(0, Math.round((totalAmt - nextRepaid) * 100) / 100);
      const nextStatus = nextOutstanding <= 0 ? 'completed' : 'active';

      await sql`
        UPDATE employee_advances SET
          total_repaid = ${nextRepaid},
          outstanding = ${nextOutstanding},
          repayment_status = ${nextStatus},
          updated_at = NOW()
        WHERE id = ${advId}
      `;

      await sql`
        INSERT INTO employee_advance_receipts (
          advance_id, receipt_number, receipt_date, amount, type
        ) VALUES (
          ${advId}, ${rNum}, ${rDate}, ${repayAmt}, 'repayment'
        )
      `;

      return res.status(200).json({
        success: true,
        message: `Repayment #${rNum} of ₹${repayAmt.toLocaleString()} recorded successfully!`
      });
    }

    else if (action === "advance-receipts") {
      const { advance_id } = req.query;
      if (!advance_id) return res.status(400).json({ error: "advance_id required" });

      const receipts = await sql`
        SELECT * FROM employee_advance_receipts
        WHERE advance_id = ${parseInt(advance_id)}
        ORDER BY id ASC
      `;

      return res.status(200).json({ success: true, receipts });
    }

    else if (action === "advance-cancel") {
      const { advance_id } = req.body;
      if (!advance_id) return res.status(400).json({ error: "advance_id required" });

      await sql`
        UPDATE employee_advances SET repayment_status = 'cancelled', updated_at = NOW()
        WHERE id = ${parseInt(advance_id)}
      `;

      return res.status(200).json({ success: true, message: "Advance status marked as Cancelled" });
    }

    // ═══════════════ LEAVE APPLICATIONS HANDLERS ═══════════════
    else if (action === "leave-list") {
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS leave_applications (
            id SERIAL PRIMARY KEY,
            company_id INT,
            employee_id INT,
            leave_type_id INT,
            leave_type VARCHAR(100),
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            total_days NUMERIC(5,1) DEFAULT 1,
            reason TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            approved_by INT,
            approval_remarks TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `;
      } catch (e) {}

      let rows;
      if (isAll) {
        rows = await sql`
          SELECT l.*, e.name as employee_name, e.department, e.designation, e.user_id,
                 COALESCE(lt.name, l.leave_type, 'Leave') as leave_type,
                 COALESCE(lt.name, l.leave_type, 'Leave') as leave_type_name,
                 c.name as company_name
          FROM leave_applications l
          JOIN employees e ON l.employee_id = e.id
          LEFT JOIN leave_types lt ON l.leave_type_id = lt.id
          LEFT JOIN companies c ON l.company_id = c.id
          ORDER BY l.created_at DESC
        `;
      } else {
        rows = await sql`
          SELECT l.*, e.name as employee_name, e.department, e.designation, e.user_id,
                 COALESCE(lt.name, l.leave_type, 'Leave') as leave_type,
                 COALESCE(lt.name, l.leave_type, 'Leave') as leave_type_name,
                 c.name as company_name
          FROM leave_applications l
          JOIN employees e ON l.employee_id = e.id
          LEFT JOIN leave_types lt ON l.leave_type_id = lt.id
          LEFT JOIN companies c ON l.company_id = c.id
          WHERE l.company_id = ${safeInt(compQuery, 1)}
          ORDER BY l.created_at DESC
        `;
      }
      return res.status(200).json({ success: true, leaves: rows });
    }

    else if (action === "leave-apply" || action === "apply-leave") {
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS leave_applications (
            id SERIAL PRIMARY KEY,
            company_id INT,
            employee_id INT,
            leave_type_id INT,
            leave_type VARCHAR(100),
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            total_days NUMERIC(5,1) DEFAULT 1,
            reason TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            approved_by INT,
            approval_remarks TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `;
      } catch (e) {}

      let { company_id, employee_id, leave_type_id, leave_type, start_date, end_date, reason } = req.body;
      
      if (!employee_id) {
        if (user.employee_id) {
          employee_id = user.employee_id;
        } else {
          const empFind = await sql`SELECT id FROM employees WHERE user_id = ${user.id} LIMIT 1`;
          if (empFind.length > 0) employee_id = empFind[0].id;
        }
      }

      const compId = user.role === "superadmin" ? (company_id ? parseInt(company_id) : (user.company_id || 1)) : (user.company_id || 1);

      if (!compId || !employee_id || !start_date || !end_date) {
        return res.status(400).json({ error: "Missing required leave fields (Employee, Start Date, End Date)" });
      }

      const d1 = new Date(start_date);
      const d2 = new Date(end_date);
      const totalDays = Math.max(1, Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);

      let typeId = leave_type_id ? parseInt(leave_type_id) : null;
      if (!typeId) {
        try {
          const lt = await sql`SELECT id FROM leave_types ORDER BY id ASC LIMIT 1`;
          if (lt.length > 0) typeId = lt[0].id;
        } catch (e) {}
      }

      const leaveTypeStr = leave_type || 'Leave';

      const app = await sql`
        INSERT INTO leave_applications (
          company_id, employee_id, leave_type_id, leave_type, start_date, end_date, total_days, reason
        ) VALUES (
          ${compId}, ${parseInt(employee_id)}, ${typeId}, ${leaveTypeStr}, ${start_date}, ${end_date}, ${totalDays}, ${reason || null}
        )
        RETURNING *
      `;

      return res.status(200).json({ success: true, application: app[0], message: "Leave application submitted successfully" });
    }

    else if (action === "leave-approve" || action === "approve-leave" || action === "leave-reject" || action === "reject-leave") {
      const { id, leave_id, status, remarks } = req.body;
      const targetId = id || leave_id;
      if (!targetId) return res.status(400).json({ error: "Application ID required" });

      if (user.role !== "superadmin") {
        let userEmpId = user.employee_id;
        if (!userEmpId) {
          const uRows = await sql`SELECT employee_id FROM users WHERE id = ${user.id}`;
          if (uRows.length > 0) userEmpId = uRows[0].employee_id;
        }

        const appCheck = await sql`
          SELECT l.employee_id, l.company_id, e.user_id
          FROM leave_applications l
          JOIN employees e ON l.employee_id = e.id
          WHERE l.id = ${parseInt(targetId)}
        `;
        if (appCheck.length > 0) {
          const targetEmpId = appCheck[0].employee_id;
          const targetUserId = appCheck[0].user_id;
          const targetCompId = appCheck[0].company_id;

          if ((userEmpId && parseInt(userEmpId) === parseInt(targetEmpId)) || (targetUserId && targetUserId === user.id)) {
            return res.status(403).json({ error: "Storeadmin and HR cannot approve or reject their own leave applications. Only Storeadmin/HR or Superadmin can approve." });
          }

          if (user.company_id && parseInt(targetCompId) !== parseInt(user.company_id)) {
            return res.status(403).json({ error: "Access denied. You can only approve leave applications for your assigned company." });
          }
        }
      }

      const newStatus = status || ((action === "leave-approve" || action === "approve-leave") ? "approved" : "rejected");
      const updated = await sql`
        UPDATE leave_applications SET
          status = ${newStatus},
          approved_by = ${user.id},
          approval_remarks = ${remarks || null},
          updated_at = NOW()
        WHERE id = ${parseInt(targetId)}
        RETURNING *
      `;

      if (newStatus === "approved" && updated.length > 0) {
        const l = updated[0];
        const cur = new Date(l.start_date);
        const end = new Date(l.end_date);

        while (cur <= end) {
          const dateStr = cur.toISOString().split("T")[0];
          await sql`
            INSERT INTO attendance (company_id, employee_id, date, status, remarks, marked_by)
            VALUES (${l.company_id}, ${l.employee_id}, ${dateStr}, 'leave', ${'Approved Leave: ' + (l.reason || '')}, ${user.id})
            ON CONFLICT (company_id, employee_id, date) DO UPDATE SET status = 'leave', remarks = EXCLUDED.remarks
          `;
          cur.setDate(cur.getDate() + 1);
        }
      }

      return res.status(200).json({ success: true, application: updated[0], message: `Leave ${newStatus}` });
    }

    else if (action === "leave-types" || action === "leave-types-list") {
      const rawCompId = req.query.company_id || user.company_id || 1;
      const isAllTypes = rawCompId === "all";
      const targetCompId = safeInt(rawCompId, 1);
      
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS leave_types (
            id SERIAL PRIMARY KEY,
            company_id INT,
            name VARCHAR(100) NOT NULL,
            monthly_quota INT DEFAULT 1,
            yearly_quota INT DEFAULT 12,
            is_paid BOOLEAN DEFAULT true,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `;
        await sql`ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS company_id INT`;
        await sql`ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS monthly_quota INT DEFAULT 1`;
        await sql`ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS yearly_quota INT DEFAULT 12`;
        await sql`ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT true`;
        await sql`ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`;
        await sql`UPDATE leave_types SET company_id = ${targetCompId} WHERE company_id IS NULL`;
        await sql`UPDATE leave_types SET monthly_quota = 1 WHERE monthly_quota IS NULL`;
        await sql`UPDATE leave_types SET yearly_quota = 12 WHERE yearly_quota IS NULL`;
        await sql`UPDATE leave_types SET is_paid = true WHERE is_paid IS NULL`;
        await sql`UPDATE leave_types SET is_active = true WHERE is_active IS NULL`;
      } catch (e) {
        console.error("leave_types table migration notice:", e.message);
      }

      let types;
      if (isAllTypes) {
        types = await sql`SELECT * FROM leave_types ORDER BY id ASC`;
      } else {
        types = await sql`SELECT * FROM leave_types WHERE company_id = ${targetCompId} OR company_id IS NULL ORDER BY id ASC`;
        if (types.length === 0) {
          // Auto-seed default leave types for company with configurable monthly quotas
          const defaultTypes = [
            { name: 'Casual Leave (CL)', monthly: 1, yearly: 12, is_paid: true },
            { name: 'Sick Leave (SL)', monthly: 1, yearly: 6, is_paid: true },
            { name: 'Earned Leave (EL)', monthly: 1, yearly: 6, is_paid: true },
            { name: 'Unpaid Leave', monthly: 0, yearly: 0, is_paid: false }
          ];

          for (const dt of defaultTypes) {
            await sql`
              INSERT INTO leave_types (company_id, name, monthly_quota, yearly_quota, is_paid, is_active)
              VALUES (${targetCompId}, ${dt.name}, ${dt.monthly}, ${dt.yearly}, ${dt.is_paid}, true)
            `;
          }
          types = await sql`SELECT * FROM leave_types WHERE company_id = ${targetCompId} OR company_id IS NULL ORDER BY id ASC`;
        }
      }

      return res.status(200).json({ success: true, leave_types: types });
    }

    else if (action === "save-leave-types" || action === "leave-types-save") {
      const uRole = String(user.role || '').toLowerCase();
      const allowedRoles = ['superadmin', 'admin', 'storeadmin', 'store_admin', 'hr', 'hr_manager', 'manager'];
      if (!allowedRoles.includes(uRole)) {
        return res.status(403).json({ error: "Access denied. Only Superadmin, Admin, Storeadmin, and HR can configure leave quotas." });
      }

      const { company_id, types } = req.body;
      const compId = uRole === 'superadmin' ? (company_id ? parseInt(company_id) : (user.company_id || 1)) : (user.company_id || 1);

      if (!Array.isArray(types)) {
        return res.status(400).json({ error: "Invalid leave types data payload" });
      }

      // Ensure columns exist before update
      try {
        await sql`ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS company_id INT`;
        await sql`ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS monthly_quota INT DEFAULT 1`;
        await sql`ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS yearly_quota INT DEFAULT 12`;
        await sql`ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT true`;
        await sql`ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`;
      } catch (e) {}

      for (const t of types) {
        const typeId = t.id ? parseInt(t.id) : null;
        if (typeId && !isNaN(typeId)) {
          await sql`
            UPDATE leave_types SET
              name = ${t.name},
              monthly_quota = ${parseInt(t.monthly_quota || 0)},
              yearly_quota = ${parseInt(t.yearly_quota || 0)},
              is_paid = ${t.is_paid === true || t.is_paid === 'true'},
              is_active = ${t.is_active !== false}
            WHERE id = ${typeId}
          `;
        } else if (t.name && t.name.trim()) {
          await sql`
            INSERT INTO leave_types (company_id, name, monthly_quota, yearly_quota, is_paid, is_active)
            VALUES (${compId}, ${t.name.trim()}, ${parseInt(t.monthly_quota || 0)}, ${parseInt(t.yearly_quota || 0)}, ${t.is_paid === true || t.is_paid === 'true'}, true)
          `;
        }
      }

      const updatedTypes = await sql`SELECT * FROM leave_types WHERE company_id = ${compId} OR company_id IS NULL ORDER BY id ASC`;
      return res.status(200).json({ success: true, leave_types: updatedTypes, message: "Leave quotas and types configured successfully" });
    }

    else {
      return res.status(404).json({ error: `Action '${action}' not recognized` });
    }

  } catch (error) {
    console.error(`api/payroll error [${action}]:`, error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};
