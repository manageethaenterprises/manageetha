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
  const action = req.query.action || req.body?.action || "auditor-transactions";

  try {
    const isSuperAdmin = (user && user.role === "superadmin");
    const compQuery = isSuperAdmin ? (req.query.company_id || "all") : user.company_id;
    const isAll = isSuperAdmin && (!compQuery || compQuery === "all" || isNaN(parseInt(compQuery, 10)));
    const targetCompId = !isAll ? (parseInt(compQuery, 10) || parseInt(user.company_id, 10) || 1) : null;
    const startDate = req.query.start_date || "1970-01-01";
    const endDate = req.query.end_date || "2099-12-31";
    const moduleFilter = (req.query.module || "all").toLowerCase();
    const flowFilter = (req.query.flow || "all").toLowerCase(); // 'inward', 'outward', or 'all'

    // ═════════════════════════════════════════════════════════════════════════
    // 1. AUDITOR TRANSACTIONS (All modules: Sales, Services, Expenses, Salaries, Purchases)
    // ═════════════════════════════════════════════════════════════════════════
    if (action === "auditor-transactions" || action === "all-transactions") {
      const allRows = [];

      // A) SALES (Inward revenue / Outward GST supplies)
      if (moduleFilter === "all" || moduleFilter === "sales") {
        try {
          let salesRows;
          if (isAll) {
            salesRows = await sql`
              SELECT s.id as raw_id,
                     'sales' as module,
                     'inward' as flow_type,
                     s.sale_date as transaction_date,
                     COALESCE(NULLIF(inv.invoice_number, ''), NULLIF(s.invoice_number, ''), NULLIF(s.challan_number, ''), 'SALE-' || s.id) as ref_no,
                     COALESCE(NULLIF(s.customer_name, ''), cust.name, v.legal_name, v.trade_name, 'Counter Sale') as party_name,
                     COALESCE(NULLIF(s.customer_gstin, ''), cust.gstin, v.gstin, '—') as party_gstin,
                     c.name as company_name,
                     c.gstin as company_gstin,
                     COALESCE(s.taxable_amount, s.total_amount, 0)::numeric as taxable_amount,
                     COALESCE(s.cgst, 0)::numeric as cgst,
                     COALESCE(s.sgst, 0)::numeric as sgst,
                     COALESCE(s.igst, 0)::numeric as igst,
                     COALESCE(s.tax_amount, 0)::numeric as tax_amount,
                     COALESCE(s.grand_total, 0)::numeric as grand_total,
                     COALESCE(NULLIF(s.paid_amount, 0), s.grand_total, 0)::numeric as amount_in,
                     0::numeric as amount_out,
                     COALESCE(NULLIF(s.payment_mode, ''), 'Cash') as payment_mode,
                     COALESCE(NULLIF(s.payment_status, ''), 'completed') as payment_status,
                     'Sales Supply' as category_label,
                     COALESCE(s.supply_type, 'Taxable Goods Supply') as description
              FROM sales s
              LEFT JOIN invoices inv ON inv.sale_id = s.id
              LEFT JOIN companies c ON s.company_id = c.id
              LEFT JOIN customers cust ON s.customer_id = cust.id
              LEFT JOIN dealers v ON s.dealer_id = v.id
              WHERE s.sale_date::date BETWEEN ${startDate}::date AND ${endDate}::date
              ORDER BY s.sale_date DESC
            `;
          } else {
            salesRows = await sql`
              SELECT s.id as raw_id,
                     'sales' as module,
                     'inward' as flow_type,
                     s.sale_date as transaction_date,
                     COALESCE(NULLIF(inv.invoice_number, ''), NULLIF(s.invoice_number, ''), NULLIF(s.challan_number, ''), 'SALE-' || s.id) as ref_no,
                     COALESCE(NULLIF(s.customer_name, ''), cust.name, v.legal_name, v.trade_name, 'Counter Sale') as party_name,
                     COALESCE(NULLIF(s.customer_gstin, ''), cust.gstin, v.gstin, '—') as party_gstin,
                     c.name as company_name,
                     c.gstin as company_gstin,
                     COALESCE(s.taxable_amount, s.total_amount, 0)::numeric as taxable_amount,
                     COALESCE(s.cgst, 0)::numeric as cgst,
                     COALESCE(s.sgst, 0)::numeric as sgst,
                     COALESCE(s.igst, 0)::numeric as igst,
                     COALESCE(s.tax_amount, 0)::numeric as tax_amount,
                     COALESCE(s.grand_total, 0)::numeric as grand_total,
                     COALESCE(NULLIF(s.paid_amount, 0), s.grand_total, 0)::numeric as amount_in,
                     0::numeric as amount_out,
                     COALESCE(NULLIF(s.payment_mode, ''), 'Cash') as payment_mode,
                     COALESCE(NULLIF(s.payment_status, ''), 'completed') as payment_status,
                     'Sales Supply' as category_label,
                     COALESCE(s.supply_type, 'Taxable Goods Supply') as description
              FROM sales s
              LEFT JOIN invoices inv ON inv.sale_id = s.id
              LEFT JOIN companies c ON s.company_id = c.id
              LEFT JOIN customers cust ON s.customer_id = cust.id
              LEFT JOIN dealers v ON s.dealer_id = v.id
              WHERE (s.company_id = ${targetCompId} OR s.company_id IN (SELECT id FROM companies WHERE parent_company_id = ${targetCompId}))
                AND s.sale_date::date BETWEEN ${startDate}::date AND ${endDate}::date
              ORDER BY s.sale_date DESC
            `;
          }
          if (Array.isArray(salesRows)) allRows.push(...salesRows);
        } catch (e) {
          console.warn("Reports: error querying sales:", e.message);
        }
      }

      // B) SERVICES (Inward revenue / Service receipts)
      if (moduleFilter === "all" || moduleFilter === "services") {
        try {
          let srvRows;
          if (isAll) {
            srvRows = await sql`
              SELECT sj.id as raw_id,
                     'services' as module,
                     'inward' as flow_type,
                     sj.created_at::date as transaction_date,
                     COALESCE(NULLIF(sj.job_number, ''), 'SRV-' || sj.id) as ref_no,
                     COALESCE(cust.name, 'Service Customer') as party_name,
                     COALESCE(cust.gstin, '—') as party_gstin,
                     c.name as company_name,
                     c.gstin as company_gstin,
                     (COALESCE(sj.grand_total, 0) - COALESCE(sj.gst_amount, 0))::numeric as taxable_amount,
                     (COALESCE(sj.gst_amount, 0) / 2)::numeric as cgst,
                     (COALESCE(sj.gst_amount, 0) / 2)::numeric as sgst,
                     0::numeric as igst,
                     COALESCE(sj.gst_amount, 0)::numeric as tax_amount,
                     COALESCE(sj.grand_total, 0)::numeric as grand_total,
                     COALESCE(NULLIF(sj.paid_amount, 0), sj.grand_total, 0)::numeric as amount_in,
                     0::numeric as amount_out,
                     COALESCE(NULLIF(sj.payment_status, ''), 'completed') as payment_mode,
                     COALESCE(NULLIF(sj.status, ''), 'closed') as payment_status,
                     'Service Revenue' as category_label,
                     COALESCE(NULLIF(sj.service_type, ''), 'Vehicle / Equipment Service') as description
              FROM service_jobs sj
              LEFT JOIN companies c ON sj.company_id = c.id
              LEFT JOIN customers cust ON sj.customer_id = cust.id
              WHERE sj.created_at::date BETWEEN ${startDate}::date AND ${endDate}::date
              ORDER BY sj.created_at DESC
            `;
          } else {
            srvRows = await sql`
              SELECT sj.id as raw_id,
                     'services' as module,
                     'inward' as flow_type,
                     sj.created_at::date as transaction_date,
                     COALESCE(NULLIF(sj.job_number, ''), 'SRV-' || sj.id) as ref_no,
                     COALESCE(cust.name, 'Service Customer') as party_name,
                     COALESCE(cust.gstin, '—') as party_gstin,
                     c.name as company_name,
                     c.gstin as company_gstin,
                     (COALESCE(sj.grand_total, 0) - COALESCE(sj.gst_amount, 0))::numeric as taxable_amount,
                     (COALESCE(sj.gst_amount, 0) / 2)::numeric as cgst,
                     (COALESCE(sj.gst_amount, 0) / 2)::numeric as sgst,
                     0::numeric as igst,
                     COALESCE(sj.gst_amount, 0)::numeric as tax_amount,
                     COALESCE(sj.grand_total, 0)::numeric as grand_total,
                     COALESCE(NULLIF(sj.paid_amount, 0), sj.grand_total, 0)::numeric as amount_in,
                     0::numeric as amount_out,
                     COALESCE(NULLIF(sj.payment_status, ''), 'completed') as payment_mode,
                     COALESCE(NULLIF(sj.status, ''), 'closed') as payment_status,
                     'Service Revenue' as category_label,
                     COALESCE(NULLIF(sj.service_type, ''), 'Vehicle / Equipment Service') as description
              FROM service_jobs sj
              LEFT JOIN companies c ON sj.company_id = c.id
              LEFT JOIN customers cust ON sj.customer_id = cust.id
              WHERE sj.company_id = ${targetCompId} AND sj.created_at::date BETWEEN ${startDate}::date AND ${endDate}::date
              ORDER BY sj.created_at DESC
            `;
          }
          if (Array.isArray(srvRows)) allRows.push(...srvRows);
        } catch (e) {
          console.warn("Reports: error querying service_jobs:", e.message);
        }
      }

      // C) EXPENSES (Outward expenditures)
      if (moduleFilter === "all" || moduleFilter === "expenses") {
        try {
          let expRows;
          if (isAll) {
            expRows = await sql`
              SELECT e.id as raw_id,
                     'expenses' as module,
                     'outward' as flow_type,
                     e.expense_date as transaction_date,
                     COALESCE(NULLIF(e.receipt_number, ''), 'EXP-' || e.id) as ref_no,
                     COALESCE(NULLIF(e.dealer_receiver, ''), 'Payee / Vendor') as party_name,
                     '—' as party_gstin,
                     c.name as company_name,
                     c.gstin as company_gstin,
                     COALESCE(e.amount, 0)::numeric as taxable_amount,
                     0::numeric as cgst,
                     0::numeric as sgst,
                     0::numeric as igst,
                     0::numeric as tax_amount,
                     COALESCE(e.amount, 0)::numeric as grand_total,
                     0::numeric as amount_in,
                     COALESCE(e.amount, 0)::numeric as amount_out,
                     COALESCE(NULLIF(e.payment_mode, ''), 'Cash') as payment_mode,
                     COALESCE(NULLIF(e.approval_status, ''), 'approved') as payment_status,
                     COALESCE(NULLIF(e.category, ''), 'Office Expense') as category_label,
                     COALESCE(NULLIF(e.description, ''), e.category) as description
              FROM expenses e
              LEFT JOIN companies c ON e.company_id = c.id
              WHERE e.expense_date::date BETWEEN ${startDate}::date AND ${endDate}::date
                AND (e.receipt_number IS NULL OR e.receipt_number NOT LIKE 'EXP-PUR-%')
              ORDER BY e.expense_date DESC
            `;
          } else {
            expRows = await sql`
              SELECT e.id as raw_id,
                     'expenses' as module,
                     'outward' as flow_type,
                     e.expense_date as transaction_date,
                     COALESCE(NULLIF(e.receipt_number, ''), 'EXP-' || e.id) as ref_no,
                     COALESCE(NULLIF(e.dealer_receiver, ''), 'Payee / Vendor') as party_name,
                     '—' as party_gstin,
                     c.name as company_name,
                     c.gstin as company_gstin,
                     COALESCE(e.amount, 0)::numeric as taxable_amount,
                     0::numeric as cgst,
                     0::numeric as sgst,
                     0::numeric as igst,
                     0::numeric as tax_amount,
                     COALESCE(e.amount, 0)::numeric as grand_total,
                     0::numeric as amount_in,
                     COALESCE(e.amount, 0)::numeric as amount_out,
                     COALESCE(NULLIF(e.payment_mode, ''), 'Cash') as payment_mode,
                     COALESCE(NULLIF(e.approval_status, ''), 'approved') as payment_status,
                     COALESCE(NULLIF(e.category, ''), 'Office Expense') as category_label,
                     COALESCE(NULLIF(e.description, ''), e.category) as description
              FROM expenses e
              LEFT JOIN companies c ON e.company_id = c.id
              WHERE e.company_id = ${targetCompId} 
                AND e.expense_date::date BETWEEN ${startDate}::date AND ${endDate}::date
                AND (e.receipt_number IS NULL OR e.receipt_number NOT LIKE 'EXP-PUR-%')
              ORDER BY e.expense_date DESC
            `;
          }
          if (Array.isArray(expRows)) allRows.push(...expRows);
        } catch (e) {
          console.warn("Reports: error querying expenses:", e.message);
        }
      }

      // D) SALARIES GIVEN (Outward payroll & employee advance payouts)
      if (moduleFilter === "all" || moduleFilter === "salaries") {
        try {
          // 1. Regular Payroll
          let payRows;
          if (isAll) {
            payRows = await sql`
              SELECT p.id as raw_id,
                     'salaries' as module,
                     'outward' as flow_type,
                     COALESCE(p.payment_date, p.created_at::date) as transaction_date,
                     'PAY-' || REPLACE(p.month_year, ' ', '') || '-' || p.id as ref_no,
                     COALESCE(emp.name, 'Employee') as party_name,
                     '—' as party_gstin,
                     c.name as company_name,
                     c.gstin as company_gstin,
                     COALESCE(p.net_salary, p.basic_salary, 0)::numeric as taxable_amount,
                     0::numeric as cgst,
                     0::numeric as sgst,
                     0::numeric as igst,
                     0::numeric as tax_amount,
                     COALESCE(p.net_salary, p.basic_salary, 0)::numeric as grand_total,
                     0::numeric as amount_in,
                     COALESCE(p.net_salary, p.basic_salary, 0)::numeric as amount_out,
                     COALESCE(NULLIF(p.payment_mode, ''), 'Bank Transfer') as payment_mode,
                     COALESCE(NULLIF(p.payment_status, ''), 'paid') as payment_status,
                     'Employee Payroll' as category_label,
                     'Salary Payout for ' || p.month_year || ' (' || COALESCE(emp.employee_code, 'EMP') || ')' as description
              FROM payroll p
              LEFT JOIN companies c ON p.company_id = c.id
              LEFT JOIN employees emp ON p.employee_id = emp.id
              WHERE COALESCE(p.payment_date, p.created_at::date) BETWEEN ${startDate}::date AND ${endDate}::date
              ORDER BY transaction_date DESC
            `;
          } else {
            payRows = await sql`
              SELECT p.id as raw_id,
                     'salaries' as module,
                     'outward' as flow_type,
                     COALESCE(p.payment_date, p.created_at::date) as transaction_date,
                     'PAY-' || REPLACE(p.month_year, ' ', '') || '-' || p.id as ref_no,
                     COALESCE(emp.name, 'Employee') as party_name,
                     '—' as party_gstin,
                     c.name as company_name,
                     c.gstin as company_gstin,
                     COALESCE(p.net_salary, p.basic_salary, 0)::numeric as taxable_amount,
                     0::numeric as cgst,
                     0::numeric as sgst,
                     0::numeric as igst,
                     0::numeric as tax_amount,
                     COALESCE(p.net_salary, p.basic_salary, 0)::numeric as grand_total,
                     0::numeric as amount_in,
                     COALESCE(p.net_salary, p.basic_salary, 0)::numeric as amount_out,
                     COALESCE(NULLIF(p.payment_mode, ''), 'Bank Transfer') as payment_mode,
                     COALESCE(NULLIF(p.payment_status, ''), 'paid') as payment_status,
                     'Employee Payroll' as category_label,
                     'Salary Payout for ' || p.month_year || ' (' || COALESCE(emp.employee_code, 'EMP') || ')' as description
              FROM payroll p
              LEFT JOIN companies c ON p.company_id = c.id
              LEFT JOIN employees emp ON p.employee_id = emp.id
              WHERE p.company_id = ${targetCompId} AND COALESCE(p.payment_date, p.created_at::date) BETWEEN ${startDate}::date AND ${endDate}::date
              ORDER BY transaction_date DESC
            `;
          }
          if (Array.isArray(payRows)) allRows.push(...payRows);

          // 2. Salary Advances
          let advRows;
          if (isAll) {
            advRows = await sql`
              SELECT ea.id as raw_id,
                     'salaries' as module,
                     'outward' as flow_type,
                     ea.advance_date as transaction_date,
                     COALESCE(NULLIF(ea.receipt_number, ''), 'ADV-' || ea.id) as ref_no,
                     COALESCE(emp.name, 'Employee') as party_name,
                     '—' as party_gstin,
                     c.name as company_name,
                     c.gstin as company_gstin,
                     COALESCE(ea.amount, 0)::numeric as taxable_amount,
                     0::numeric as cgst, 0::numeric as sgst, 0::numeric as igst, 0::numeric as tax_amount,
                     COALESCE(ea.amount, 0)::numeric as grand_total,
                     0::numeric as amount_in,
                     COALESCE(ea.amount, 0)::numeric as amount_out,
                     COALESCE(NULLIF(ea.payment_mode, ''), 'Cash') as payment_mode,
                     COALESCE(NULLIF(ea.repayment_status, ''), 'active') as payment_status,
                     'Salary Advance' as category_label,
                     'Employee Salary Advance Payout' as description
              FROM employee_advances ea
              LEFT JOIN companies c ON ea.company_id = c.id
              LEFT JOIN employees emp ON ea.employee_id = emp.id
              WHERE ea.advance_date::date BETWEEN ${startDate}::date AND ${endDate}::date
              ORDER BY ea.advance_date DESC
            `;
          } else {
            advRows = await sql`
              SELECT ea.id as raw_id,
                     'salaries' as module,
                     'outward' as flow_type,
                     ea.advance_date as transaction_date,
                     COALESCE(NULLIF(ea.receipt_number, ''), 'ADV-' || ea.id) as ref_no,
                     COALESCE(emp.name, 'Employee') as party_name,
                     '—' as party_gstin,
                     c.name as company_name,
                     c.gstin as company_gstin,
                     COALESCE(ea.amount, 0)::numeric as taxable_amount,
                     0::numeric as cgst, 0::numeric as sgst, 0::numeric as igst, 0::numeric as tax_amount,
                     COALESCE(ea.amount, 0)::numeric as grand_total,
                     0::numeric as amount_in,
                     COALESCE(ea.amount, 0)::numeric as amount_out,
                     COALESCE(NULLIF(ea.payment_mode, ''), 'Cash') as payment_mode,
                     COALESCE(NULLIF(ea.repayment_status, ''), 'active') as payment_status,
                     'Salary Advance' as category_label,
                     'Employee Salary Advance Payout' as description
              FROM employee_advances ea
              LEFT JOIN companies c ON ea.company_id = c.id
              LEFT JOIN employees emp ON ea.employee_id = emp.id
              WHERE ea.company_id = ${targetCompId} AND ea.advance_date::date BETWEEN ${startDate}::date AND ${endDate}::date
              ORDER BY ea.advance_date DESC
            `;
          }
          if (Array.isArray(advRows)) allRows.push(...advRows);
        } catch (e) {
          console.warn("Reports: error querying payroll/advances:", e.message);
        }
      }

      // E) PURCHASES (Supplier Inward Stock)
      if (moduleFilter === "all" || moduleFilter === "purchases") {
        try {
          let purRows;
          if (isAll) {
            purRows = await sql`
              SELECT pur.id as raw_id,
                     'purchases' as module,
                     'outward' as flow_type,
                     COALESCE(pur.purchase_date, pur.created_at::date, CURRENT_DATE) as transaction_date,
                     COALESCE(NULLIF(pur.purchase_invoice_no, ''), 'PUR-' || pur.id) as ref_no,
                     COALESCE(sup.trade_name, sup.legal_name, d.trade_name, d.legal_name, 'Supplier') as party_name,
                     COALESCE(sup.gstin, d.gstin, '—') as party_gstin,
                     c.name as company_name,
                     c.gstin as company_gstin,
                     COALESCE(pur.total_amount, 0)::numeric as taxable_amount,
                     (COALESCE(pur.gst_amount, 0) / 2)::numeric as cgst,
                     (COALESCE(pur.gst_amount, 0) / 2)::numeric as sgst,
                     0::numeric as igst,
                     COALESCE(pur.gst_amount, 0)::numeric as tax_amount,
                     COALESCE(pur.grand_total, 0)::numeric as grand_total,
                     0::numeric as amount_in,
                     COALESCE(pur.grand_total, 0)::numeric as amount_out,
                     'Credit/Bank' as payment_mode,
                     COALESCE(NULLIF(pur.payment_status, ''), 'completed') as payment_status,
                     'Supplier Stock Purchase' as category_label,
                     'Inward Inventory / Stock Receipt' as description
              FROM purchases pur
              LEFT JOIN companies c ON pur.company_id = c.id
              LEFT JOIN suppliers sup ON pur.supplier_id = sup.id
              LEFT JOIN dealers d ON pur.supplier_id = d.id
              WHERE COALESCE(pur.purchase_date, pur.created_at::date, CURRENT_DATE)::date BETWEEN ${startDate}::date AND ${endDate}::date
              ORDER BY transaction_date DESC
            `;
          } else {
            purRows = await sql`
              SELECT pur.id as raw_id,
                     'purchases' as module,
                     'outward' as flow_type,
                     COALESCE(pur.purchase_date, pur.created_at::date, CURRENT_DATE) as transaction_date,
                     COALESCE(NULLIF(pur.purchase_invoice_no, ''), 'PUR-' || pur.id) as ref_no,
                     COALESCE(sup.trade_name, sup.legal_name, d.trade_name, d.legal_name, 'Supplier') as party_name,
                     COALESCE(sup.gstin, d.gstin, '—') as party_gstin,
                     c.name as company_name,
                     c.gstin as company_gstin,
                     COALESCE(pur.total_amount, 0)::numeric as taxable_amount,
                     (COALESCE(pur.gst_amount, 0) / 2)::numeric as cgst,
                     (COALESCE(pur.gst_amount, 0) / 2)::numeric as sgst,
                     0::numeric as igst,
                     COALESCE(pur.gst_amount, 0)::numeric as tax_amount,
                     COALESCE(pur.grand_total, 0)::numeric as grand_total,
                     0::numeric as amount_in,
                     COALESCE(pur.grand_total, 0)::numeric as amount_out,
                     'Credit/Bank' as payment_mode,
                     COALESCE(NULLIF(pur.payment_status, ''), 'completed') as payment_status,
                     'Supplier Stock Purchase' as category_label,
                     'Inward Inventory / Stock Receipt' as description
              FROM purchases pur
              LEFT JOIN companies c ON pur.company_id = c.id
              LEFT JOIN suppliers sup ON pur.supplier_id = sup.id
              LEFT JOIN dealers d ON pur.supplier_id = d.id
              WHERE pur.company_id = ${targetCompId} AND COALESCE(pur.purchase_date, pur.created_at::date, CURRENT_DATE)::date BETWEEN ${startDate}::date AND ${endDate}::date
              ORDER BY transaction_date DESC
            `;
          }
          if (Array.isArray(purRows)) allRows.push(...purRows);
        } catch (e) {
          console.warn("Reports: error querying purchases:", e.message);
        }
      }

      // Filter by flow if requested
      let filteredRows = allRows;
      if (flowFilter === "inward") {
        filteredRows = allRows.filter(r => r.flow_type === "inward");
      } else if (flowFilter === "outward") {
        filteredRows = allRows.filter(r => r.flow_type === "outward");
      }

      // Sort chronological descending
      filteredRows.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));

      // Calculate aggregated financial metrics
      let totalInward = 0;
      let totalOutward = 0;
      let totalTaxable = 0;
      let totalCGST = 0;
      let totalSGST = 0;
      let totalIGST = 0;
      let totalTax = 0;

      const moduleSummaries = {
        sales: { count: 0, total: 0 },
        services: { count: 0, total: 0 },
        expenses: { count: 0, total: 0 },
        salaries: { count: 0, total: 0 },
        purchases: { count: 0, total: 0 }
      };

      filteredRows.forEach(r => {
        const inAmt = parseFloat(r.amount_in || 0);
        const outAmt = parseFloat(r.amount_out || 0);
        const taxAmt = parseFloat(r.tax_amount || 0);
        const taxableAmt = parseFloat(r.taxable_amount || 0);

        totalInward += inAmt;
        totalOutward += outAmt;
        totalTaxable += taxableAmt;
        totalCGST += parseFloat(r.cgst || 0);
        totalSGST += parseFloat(r.sgst || 0);
        totalIGST += parseFloat(r.igst || 0);
        totalTax += taxAmt;

        if (moduleSummaries[r.module]) {
          moduleSummaries[r.module].count++;
          moduleSummaries[r.module].total += (inAmt > 0 ? inAmt : outAmt);
        }
      });

      return res.status(200).json({
        success: true,
        report_type: "All System Auditor & Financial Transactions",
        period: { startDate, endDate },
        totals: {
          totalInward,
          totalOutward,
          netFlow: totalInward - totalOutward,
          totalTaxable,
          totalCGST,
          totalSGST,
          totalIGST,
          totalTax,
          totalTransactions: filteredRows.length
        },
        moduleSummaries,
        rows: filteredRows
      });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 2. SALES ANALYTICS & PERFORMANCE (Analytical views, product, branch, payment modes)
    // ═════════════════════════════════════════════════════════════════════════
    else if (action === "sales-analytics") {
      let salesRows = [];
      let itemRows = [];

      try {
        if (isAll) {
          salesRows = await sql`
            SELECT s.id, s.sale_date, s.grand_total, s.taxable_amount, s.tax_amount,
                   COALESCE(s.paid_amount, 0)::numeric as paid_amount,
                   COALESCE(s.pending_amount, 0)::numeric as pending_amount,
                   COALESCE(NULLIF(s.payment_mode, ''), 'Cash') as payment_mode,
                   COALESCE(NULLIF(s.payment_status, ''), 'completed') as payment_status,
                   COALESCE(s.party_type, 'customer') as party_type,
                   COALESCE(NULLIF(s.customer_name, ''), cust.name, 'Counter Customer') as customer_name,
                   c.name as company_name, c.id as company_id
            FROM sales s
            LEFT JOIN companies c ON s.company_id = c.id
            LEFT JOIN customers cust ON s.customer_id = cust.id
            WHERE s.sale_date::date BETWEEN ${startDate}::date AND ${endDate}::date
            ORDER BY s.sale_date DESC
          `;
        } else {
          salesRows = await sql`
            SELECT s.id, s.sale_date, s.grand_total, s.taxable_amount, s.tax_amount,
                   COALESCE(s.paid_amount, 0)::numeric as paid_amount,
                   COALESCE(s.pending_amount, 0)::numeric as pending_amount,
                   COALESCE(NULLIF(s.payment_mode, ''), 'Cash') as payment_mode,
                   COALESCE(NULLIF(s.payment_status, ''), 'completed') as payment_status,
                   COALESCE(s.party_type, 'customer') as party_type,
                   COALESCE(NULLIF(s.customer_name, ''), cust.name, 'Counter Customer') as customer_name,
                   c.name as company_name, c.id as company_id
            FROM sales s
            LEFT JOIN companies c ON s.company_id = c.id
            LEFT JOIN customers cust ON s.customer_id = cust.id
            WHERE s.company_id = ${targetCompId} AND s.sale_date::date BETWEEN ${startDate}::date AND ${endDate}::date
            ORDER BY s.sale_date DESC
          `;
        }
      } catch (e) {
        console.warn("Reports: error querying sales for analytics:", e.message);
      }

      // Query product items for sales in this period
      try {
        if (isAll) {
          itemRows = await sql`
            SELECT si.sale_id, si.product_id, si.description, si.quantity, si.rate, si.total,
                   COALESCE(p.name, si.description, 'Standard Item') as product_name,
                   COALESCE(p.model, 'Standard') as product_model,
                   c.name as category_name
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            LEFT JOIN products p ON si.product_id = p.id
            LEFT JOIN product_categories c ON p.category_id = c.id
            WHERE s.sale_date::date BETWEEN ${startDate}::date AND ${endDate}::date
          `;
        } else {
          itemRows = await sql`
            SELECT si.sale_id, si.product_id, si.description, si.quantity, si.rate, si.total,
                   COALESCE(p.name, si.description, 'Standard Item') as product_name,
                   COALESCE(p.model, 'Standard') as product_model,
                   c.name as category_name
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            LEFT JOIN products p ON si.product_id = p.id
            LEFT JOIN product_categories c ON p.category_id = c.id
            WHERE s.company_id = ${targetCompId} AND s.sale_date::date BETWEEN ${startDate}::date AND ${endDate}::date
          `;
        }
      } catch (e) {
        console.warn("Reports: error querying sale_items:", e.message);
      }

      // 1. KPI Totals
      let totalRevenue = 0;
      let totalTaxable = 0;
      let totalTax = 0;
      let totalPaid = 0;
      let totalPending = 0;
      let totalOrders = salesRows.length;

      const paymentModesMap = {};
      const companyMap = {};
      const dailyTrendMap = {};
      const partyTypeMap = { customer: { count: 0, revenue: 0 }, dealer: { count: 0, revenue: 0 } };

      salesRows.forEach(s => {
        const rev = parseFloat(s.grand_total || 0);
        const taxable = parseFloat(s.taxable_amount || 0);
        const tax = parseFloat(s.tax_amount || 0);
        const paid = parseFloat(s.paid_amount || 0);
        const pending = parseFloat(s.pending_amount || 0);

        totalRevenue += rev;
        totalTaxable += taxable;
        totalTax += tax;
        totalPaid += paid;
        totalPending += pending;

        // Payment mode breakdown
        const mode = (s.payment_mode || "Other").toUpperCase();
        if (!paymentModesMap[mode]) paymentModesMap[mode] = { count: 0, total: 0 };
        paymentModesMap[mode].count++;
        paymentModesMap[mode].total += rev;

        // Company / Branch breakdown
        const comp = s.company_name || "Head Office";
        if (!companyMap[comp]) companyMap[comp] = { count: 0, total: 0 };
        companyMap[comp].count++;
        companyMap[comp].total += rev;

        // Party type breakdown (Direct Customer vs Dealer)
        const pType = (s.party_type || "customer").toLowerCase().includes("dealer") ? "dealer" : "customer";
        partyTypeMap[pType].count++;
        partyTypeMap[pType].revenue += rev;

        // Daily trend
        const dStr = s.sale_date ? new Date(s.sale_date).toISOString().split("T")[0] : "Unknown";
        if (!dailyTrendMap[dStr]) dailyTrendMap[dStr] = { date: dStr, orders: 0, revenue: 0 };
        dailyTrendMap[dStr].orders++;
        dailyTrendMap[dStr].revenue += rev;
      });

      // 2. Product breakdown
      const productMap = {};
      let totalUnitsSold = 0;

      itemRows.forEach(item => {
        const pName = item.product_name || "Item";
        const qty = parseInt(item.quantity || 0, 10);
        const tot = parseFloat(item.total || (qty * parseFloat(item.rate || 0)));

        totalUnitsSold += qty;

        if (!productMap[pName]) {
          productMap[pName] = {
            name: pName,
            model: item.product_model || "",
            category: item.category_name || "General",
            quantity: 0,
            revenue: 0
          };
        }
        productMap[pName].quantity += qty;
        productMap[pName].revenue += tot;
      });

      const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

      // Format payment modes with percentages
      const paymentModes = Object.entries(paymentModesMap).map(([mode, data]) => ({
        mode,
        count: data.count,
        total: data.total,
        percentage: totalRevenue > 0 ? ((data.total / totalRevenue) * 100).toFixed(1) : 0
      })).sort((a, b) => b.total - a.total);

      // Format branch breakdown
      const companyBreakdown = Object.entries(companyMap).map(([company, data]) => ({
        company,
        count: data.count,
        total: data.total,
        percentage: totalRevenue > 0 ? ((data.total / totalRevenue) * 100).toFixed(1) : 0
      })).sort((a, b) => b.total - a.total);

      // Format daily trend sorted chronologically
      const dailyTrend = Object.values(dailyTrendMap).sort((a, b) => a.date.localeCompare(b.date));

      const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

      return res.status(200).json({
        success: true,
        report_type: "Sales Performance & Advanced Analytics",
        period: { startDate, endDate },
        kpis: {
          totalRevenue,
          totalTaxable,
          totalTax,
          totalPaid,
          totalPending,
          totalOrders,
          avgOrderValue,
          totalUnitsSold
        },
        paymentModes,
        companyBreakdown,
        topProducts,
        partyTypeBreakdown: partyTypeMap,
        dailyTrend,
        recentSales: salesRows.slice(0, 50)
      });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 3. GST OUTWARD REPORT (Legacy backward compatibility)
    // ═════════════════════════════════════════════════════════════════════════
    else if (action === "gst-report") {
      let salesGst = [];
      try {
        if (isAll) {
          salesGst = await sql`
            SELECT s.id, s.sale_date, c.name as company_name, c.gstin as company_gstin,
                   COALESCE(NULLIF(inv.invoice_number, ''), NULLIF(s.invoice_number, ''), NULLIF(s.challan_number, ''), 'SALE-' || s.id) as invoice_number,
                   s.challan_number,
                   COALESCE(NULLIF(s.customer_name, ''), cust.name, v.legal_name, v.trade_name, 'Counter Sale') as customer_name,
                   COALESCE(NULLIF(s.customer_gstin, ''), cust.gstin, v.gstin) as customer_gstin,
                   s.party_type, s.dealer_id,
                   s.taxable_amount, s.cgst, s.sgst, s.igst, s.tax_amount, s.grand_total
            FROM sales s
            LEFT JOIN invoices inv ON inv.sale_id = s.id
            LEFT JOIN companies c ON s.company_id = c.id
            LEFT JOIN customers cust ON s.customer_id = cust.id
            LEFT JOIN dealers v ON s.dealer_id = v.id
            WHERE s.sale_date::date BETWEEN ${startDate}::date AND ${endDate}::date
            ORDER BY s.sale_date ASC
          `;
        } else {
          salesGst = await sql`
            SELECT s.id, s.sale_date, c.name as company_name, c.gstin as company_gstin,
                   COALESCE(NULLIF(inv.invoice_number, ''), NULLIF(s.invoice_number, ''), NULLIF(s.challan_number, ''), 'SALE-' || s.id) as invoice_number,
                   s.challan_number,
                   COALESCE(NULLIF(s.customer_name, ''), cust.name, v.legal_name, v.trade_name, 'Counter Sale') as customer_name,
                   COALESCE(NULLIF(s.customer_gstin, ''), cust.gstin, v.gstin) as customer_gstin,
                   s.party_type, s.dealer_id,
                   s.taxable_amount, s.cgst, s.sgst, s.igst, s.tax_amount, s.grand_total
            FROM sales s
            LEFT JOIN invoices inv ON inv.sale_id = s.id
            LEFT JOIN companies c ON s.company_id = c.id
            LEFT JOIN customers cust ON s.customer_id = cust.id
            LEFT JOIN dealers v ON s.dealer_id = v.id
            WHERE (s.company_id = ${targetCompId} OR s.company_id IN (SELECT id FROM companies WHERE parent_company_id = ${targetCompId}))
              AND s.sale_date::date BETWEEN ${startDate}::date AND ${endDate}::date
            ORDER BY s.sale_date ASC
          `;
        }
      } catch (err) {
        console.warn("Reports: fallback gst query:", err.message);
      }

      let totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0, totalTax = 0, totalGrand = 0;
      (salesGst || []).forEach(r => {
        totalTaxable += parseFloat(r.taxable_amount || 0);
        totalCGST += parseFloat(r.cgst || 0);
        totalSGST += parseFloat(r.sgst || 0);
        totalIGST += parseFloat(r.igst || 0);
        totalTax += parseFloat(r.tax_amount || 0);
        totalGrand += parseFloat(r.grand_total || 0);
      });

      return res.status(200).json({
        success: true,
        report_type: "GST Outward Supplies Auditor Report",
        period: { startDate, endDate },
        totals: { totalTaxable, totalCGST, totalSGST, totalIGST, totalTax, totalGrand },
        rows: salesGst || []
      });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 4. GENERAL SALES REPORT (Legacy fallback)
    // ═════════════════════════════════════════════════════════════════════════
    else if (action === "sales-report") {
      let sales = [];
      if (isAll) {
        sales = await sql`
          SELECT s.*, c.name as company_name, cust.name as customer_name
          FROM sales s
          LEFT JOIN companies c ON s.company_id = c.id
          LEFT JOIN customers cust ON s.customer_id = cust.id
          WHERE s.sale_date::date BETWEEN ${startDate}::date AND ${endDate}::date
          ORDER BY s.sale_date DESC
        `;
      } else {
        sales = await sql`
          SELECT s.*, c.name as company_name, cust.name as customer_name
          FROM sales s
          LEFT JOIN companies c ON s.company_id = c.id
          LEFT JOIN customers cust ON s.customer_id = cust.id
          WHERE s.company_id = ${targetCompId} AND s.sale_date::date BETWEEN ${startDate}::date AND ${endDate}::date
          ORDER BY s.sale_date DESC
        `;
      }
      return res.status(200).json({ success: true, sales: sales || [] });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 5. HR EXECUTIVE ANALYTICS & INDUSTRY KPIS REPORT
    // ═════════════════════════════════════════════════════════════════════════
    else if (action === "hr-report" || action === "hr-analytics") {
      const month = req.query.month || new Date().toISOString().slice(0, 7);
      const reportType = (req.query.type || "overview").toLowerCase();
      const departmentFilter = (req.query.department || "all").toLowerCase().trim();

      // Calculate month boundaries (YYYY-MM-01 to YYYY-MM-lastDay)
      const [yrStr, moStr] = month.split("-");
      const year = parseInt(yrStr, 10) || new Date().getFullYear();
      const mo = parseInt(moStr, 10) || (new Date().getMonth() + 1);
      const lastDay = new Date(year, mo, 0).getDate();
      const mStart = `${year}-${String(mo).padStart(2, "0")}-01`;
      const mEnd = `${year}-${String(mo).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      // A) Employees Directory
      let empRows = [];
      try {
        if (isAll) {
          empRows = await sql`
            SELECT e.*, c.name as company_name, u.username as system_username, u.role as system_role, u.is_active as user_active
            FROM employees e
            LEFT JOIN companies c ON e.company_id = c.id
            LEFT JOIN users u ON (e.user_id = u.id OR u.employee_id = e.id)
            WHERE LOWER(COALESCE(e.name, '')) != 'superadmin'
              AND LOWER(COALESCE(e.department, '')) != 'superadmin'
              AND (u.role IS NULL OR LOWER(u.role) != 'superadmin')
            ORDER BY c.name ASC, e.name ASC
          `;
        } else {
          empRows = await sql`
            SELECT e.*, c.name as company_name, u.username as system_username, u.role as system_role, u.is_active as user_active
            FROM employees e
            LEFT JOIN companies c ON e.company_id = c.id
            LEFT JOIN users u ON (e.user_id = u.id OR u.employee_id = e.id)
            WHERE e.company_id = ${targetCompId}
              AND LOWER(COALESCE(e.name, '')) != 'superadmin'
              AND LOWER(COALESCE(e.department, '')) != 'superadmin'
              AND (u.role IS NULL OR LOWER(u.role) != 'superadmin')
            ORDER BY e.name ASC
          `;
        }
      } catch (e) {
        console.error("hr-report employees error:", e);
      }

      // Department filter
      const filteredEmployees = (departmentFilter && departmentFilter !== "all")
        ? empRows.filter(e => (e.department || "").toLowerCase().trim() === departmentFilter)
        : empRows;

      // B) Payroll Records for selected month
      let payrollRows = [];
      try {
        if (isAll) {
          payrollRows = await sql`
            SELECT p.*, e.name as employee_name, e.employee_code, e.department, c.name as company_name
            FROM payroll p
            JOIN employees e ON p.employee_id = e.id
            LEFT JOIN companies c ON p.company_id = c.id
            WHERE p.month = ${month}
            ORDER BY e.name ASC
          `;
        } else {
          payrollRows = await sql`
            SELECT p.*, e.name as employee_name, e.employee_code, e.department, c.name as company_name
            FROM payroll p
            JOIN employees e ON p.employee_id = e.id
            LEFT JOIN companies c ON p.company_id = c.id
            WHERE p.company_id = ${targetCompId} AND p.month = ${month}
            ORDER BY e.name ASC
          `;
        }
      } catch (e) {
        payrollRows = [];
      }

      // C) Attendance Records for selected month
      let attRows = [];
      try {
        if (isAll) {
          attRows = await sql`
            SELECT a.*, e.name as employee_name, e.employee_code, e.department, c.name as company_name
            FROM attendance a
            JOIN employees e ON a.employee_id = e.id
            LEFT JOIN companies c ON a.company_id = c.id
            WHERE a.date >= ${mStart} AND a.date <= ${mEnd}
            ORDER BY a.date ASC
          `;
        } else {
          attRows = await sql`
            SELECT a.*, e.name as employee_name, e.employee_code, e.department, c.name as company_name
            FROM attendance a
            JOIN employees e ON a.employee_id = e.id
            LEFT JOIN companies c ON a.company_id = c.id
            WHERE a.company_id = ${targetCompId} AND a.date >= ${mStart} AND a.date <= ${mEnd}
            ORDER BY a.date ASC
          `;
        }
      } catch (e) {
        attRows = [];
      }

      // D) Leave Applications for selected month
      let leaveRows = [];
      try {
        if (isAll) {
          leaveRows = await sql`
            SELECT l.*, e.name as employee_name, e.employee_code, e.department, lt.name as leave_type_name, c.name as company_name
            FROM leave_applications l
            JOIN employees e ON l.employee_id = e.id
            LEFT JOIN leave_types lt ON l.leave_type_id = lt.id
            LEFT JOIN companies c ON l.company_id = c.id
            WHERE l.start_date <= ${mEnd} AND l.end_date >= ${mStart}
            ORDER BY l.start_date DESC
          `;
        } else {
          leaveRows = await sql`
            SELECT l.*, e.name as employee_name, e.employee_code, e.department, lt.name as leave_type_name, c.name as company_name
            FROM leave_applications l
            JOIN employees e ON l.employee_id = e.id
            LEFT JOIN leave_types lt ON l.leave_type_id = lt.id
            LEFT JOIN companies c ON l.company_id = c.id
            WHERE l.company_id = ${targetCompId} AND l.start_date <= ${mEnd} AND l.end_date >= ${mStart}
            ORDER BY l.start_date DESC
          `;
        }
      } catch (e) {
        leaveRows = [];
      }

      // E) Employee Advances
      let advanceRows = [];
      try {
        if (isAll) {
          advanceRows = await sql`
            SELECT a.*, e.name as employee_name, e.employee_code, e.department, c.name as company_name
            FROM employee_advances a
            JOIN employees e ON a.employee_id = e.id
            LEFT JOIN companies c ON a.company_id = c.id
            ORDER BY a.advance_date DESC
          `;
        } else {
          advanceRows = await sql`
            SELECT a.*, e.name as employee_name, e.employee_code, e.department, c.name as company_name
            FROM employee_advances a
            JOIN employees e ON a.employee_id = e.id
            LEFT JOIN companies c ON a.company_id = c.id
            WHERE a.company_id = ${targetCompId}
            ORDER BY a.advance_date DESC
          `;
        }
      } catch (e) {
        advanceRows = [];
      }

      // F) Dealers & Financers Channel Directory
      let dealerRows = [];
      let financerRows = [];
      try {
        if (isAll) {
          dealerRows = await sql`SELECT v.*, c.name as company_name FROM dealers v LEFT JOIN companies c ON v.company_id = c.id ORDER BY v.name ASC`;
          financerRows = await sql`SELECT f.*, c.name as company_name FROM financers f LEFT JOIN companies c ON f.company_id = c.id ORDER BY f.name ASC`;
        } else {
          dealerRows = await sql`SELECT v.*, c.name as company_name FROM dealers v LEFT JOIN companies c ON v.company_id = c.id WHERE v.company_id = ${targetCompId} ORDER BY v.name ASC`;
          financerRows = await sql`SELECT f.*, c.name as company_name FROM financers f LEFT JOIN companies c ON f.company_id = c.id WHERE f.company_id = ${targetCompId} ORDER BY f.name ASC`;
        }
      } catch (e) {}

      // G) Lead Incentives Summary
      let incentiveRows = [];
      try {
        if (isAll) {
          incentiveRows = await sql`
            SELECT s.lead_generator_name, s.lead_phone_number, c.name as company_name,
                   COUNT(s.id) as sales_count,
                   SUM(COALESCE(s.lead_incentive_amount, 0)) as total_incentive,
                   SUM(CASE WHEN s.lead_incentive_status = 'released' THEN COALESCE(s.lead_incentive_amount, 0) ELSE 0 END) as released_amount,
                   SUM(CASE WHEN s.lead_incentive_status != 'released' THEN COALESCE(s.lead_incentive_amount, 0) ELSE 0 END) as pending_amount
            FROM sales s
            LEFT JOIN companies c ON s.company_id = c.id
            WHERE s.lead_generator_name IS NOT NULL AND TRIM(s.lead_generator_name) != ''
            GROUP BY s.lead_generator_name, s.lead_phone_number, c.name
            ORDER BY total_incentive DESC
          `;
        } else {
          incentiveRows = await sql`
            SELECT s.lead_generator_name, s.lead_phone_number, c.name as company_name,
                   COUNT(s.id) as sales_count,
                   SUM(COALESCE(s.lead_incentive_amount, 0)) as total_incentive,
                   SUM(CASE WHEN s.lead_incentive_status = 'released' THEN COALESCE(s.lead_incentive_amount, 0) ELSE 0 END) as released_amount,
                   SUM(CASE WHEN s.lead_incentive_status != 'released' THEN COALESCE(s.lead_incentive_amount, 0) ELSE 0 END) as pending_amount
            FROM sales s
            LEFT JOIN companies c ON s.company_id = c.id
            WHERE s.company_id = ${targetCompId} AND s.lead_generator_name IS NOT NULL AND TRIM(s.lead_generator_name) != ''
            GROUP BY s.lead_generator_name, s.lead_phone_number, c.name
            ORDER BY total_incentive DESC
          `;
        }
      } catch (e) {
        incentiveRows = [];
      }

      // ── KPI AGGREGATIONS ──
      const activeEmps = filteredEmployees.filter(e => (e.employment_status || 'active').toLowerCase() === 'active');
      const totalHeadcount = activeEmps.length;
      const inactiveCount = filteredEmployees.length - totalHeadcount;

      const deptSet = new Set();
      filteredEmployees.forEach(e => { if (e.department) deptSet.add(e.department.trim()); });
      const departmentsList = Array.from(deptSet).sort();

      // Attendance Metrics
      let totalPresents = 0;
      let totalLates = 0;
      let totalAbsents = 0;
      let totalAttLeaves = 0;
      attRows.forEach(a => {
        const st = (a.status || '').toLowerCase().trim();
        if (st === 'present') totalPresents++;
        else if (st === 'late') { totalPresents++; totalLates++; }
        else if (st === 'absent') totalAbsents++;
        else if (st === 'leave' || st === 'unexpected_leave') totalAttLeaves++;
      });
      const totalMarkedDays = totalPresents + totalAbsents + totalAttLeaves;
      const avgAttendanceRate = totalMarkedDays > 0 ? Math.round((totalPresents / totalMarkedDays) * 100) : 100;

      // Payroll Metrics
      let totalGrossPayroll = 0;
      let totalNetDisbursed = 0;
      let totalNetPending = 0;
      let totalStatutoryDeductions = 0;
      let totalAdvanceDeductions = 0;

      if (payrollRows.length > 0) {
        payrollRows.forEach(p => {
          const gross = parseFloat(p.gross_salary || 0);
          const net = parseFloat(p.net_salary || 0);
          const paid = parseFloat(p.paid_amount || 0);
          const pf = parseFloat(p.pf_deduction || 0);
          const esi = parseFloat(p.esi_deduction || 0);
          const tds = parseFloat(p.tds_deduction || 0);
          const pt = parseFloat(p.pt_deduction || 0);
          const adv = parseFloat(p.advance_deductions || 0);

          totalGrossPayroll += gross;
          totalStatutoryDeductions += (pf + esi + tds + pt);
          totalAdvanceDeductions += adv;

          if (p.payment_status === 'paid') {
            totalNetDisbursed += (paid > 0 ? paid : net);
          } else if (p.payment_status === 'partially_paid') {
            totalNetDisbursed += paid;
            totalNetPending += Math.max(0, net - paid);
          } else {
            totalNetPending += net;
          }
        });
      } else {
        // Fallback estimate from basic salary if payroll not processed yet for this month
        activeEmps.forEach(e => {
          const basic = parseFloat(e.basic_salary || 0);
          if (basic > 0) {
            const grossEst = basic * 1.70 + Math.max(1600, basic * 0.05);
            totalGrossPayroll += grossEst;
            totalNetPending += (grossEst - Math.min(1800, basic * 0.12));
          }
        });
      }

      // Advances Metrics
      let totalAdvDisbursed = 0;
      let totalAdvRepaid = 0;
      let totalAdvOutstanding = 0;
      let activeAdvCount = 0;
      advanceRows.forEach(a => {
        const amt = parseFloat(a.amount || 0);
        const repaid = parseFloat(a.total_repaid || 0);
        const out = parseFloat(a.outstanding != null ? a.outstanding : (amt - repaid));
        totalAdvDisbursed += amt;
        totalAdvRepaid += repaid;
        totalAdvOutstanding += Math.max(0, out);
        if (a.repayment_status === 'active' || out > 0) activeAdvCount++;
      });
      const advanceRecoveryRate = totalAdvDisbursed > 0 ? Math.round((totalAdvRepaid / totalAdvDisbursed) * 100) : 100;

      // Incentives Metrics
      let totalIncentivesGen = 0;
      let totalIncentivesRel = 0;
      let totalIncentivesPend = 0;
      incentiveRows.forEach(i => {
        totalIncentivesGen += parseFloat(i.total_incentive || 0);
        totalIncentivesRel += parseFloat(i.released_amount || 0);
        totalIncentivesPend += parseFloat(i.pending_amount || 0);
      });

      // Department-Wise Breakdown
      const deptMap = new Map();
      activeEmps.forEach(e => {
        const d = e.department ? e.department.trim() : 'General';
        if (!deptMap.has(d)) {
          deptMap.set(d, {
            department: d,
            headcount: 0,
            total_basic: 0,
            total_gross: 0,
            presents: 0,
            absents: 0,
            leaves: 0
          });
        }
        const obj = deptMap.get(d);
        obj.headcount++;
        const basic = parseFloat(e.basic_salary || 0);
        obj.total_basic += basic;
        obj.total_gross += (basic * 1.70 + Math.max(1600, basic * 0.05));
      });

      attRows.forEach(a => {
        const d = a.department ? a.department.trim() : 'General';
        if (deptMap.has(d)) {
          const obj = deptMap.get(d);
          const st = (a.status || '').toLowerCase().trim();
          if (st === 'present' || st === 'late') obj.presents++;
          else if (st === 'absent') obj.absents++;
          else if (st === 'leave' || st === 'unexpected_leave') obj.leaves++;
        }
      });

      const departmentBreakdown = Array.from(deptMap.values()).map(d => {
        const totalMarks = d.presents + d.absents + d.leaves;
        return {
          department: d.department,
          headcount: d.headcount,
          headcount_pct: totalHeadcount > 0 ? Math.round((d.headcount / totalHeadcount) * 100) : 0,
          total_gross_payroll: Math.round(d.total_gross),
          avg_salary_per_employee: d.headcount > 0 ? Math.round(d.total_gross / d.headcount) : 0,
          attendance_rate: totalMarks > 0 ? Math.round((d.presents / totalMarks) * 100) : 100,
          leaves_taken: d.leaves
        };
      }).sort((a, b) => b.headcount - a.headcount);

      return res.status(200).json({
        success: true,
        month,
        report_type: reportType,
        kpis: {
          total_headcount: totalHeadcount,
          inactive_headcount: inactiveCount,
          active_departments_count: departmentsList.length,
          avg_attendance_rate: avgAttendanceRate,
          total_present_days: totalPresents,
          total_absent_days: totalAbsents,
          total_late_clockins: totalLates,
          total_leaves_taken: totalAttLeaves + leaveRows.filter(l => l.status === 'approved').length,
          total_gross_payroll: Math.round(totalGrossPayroll),
          total_net_disbursed: Math.round(totalNetDisbursed),
          total_net_pending: Math.round(totalNetPending),
          total_statutory_deductions: Math.round(totalStatutoryDeductions),
          total_advance_deductions: Math.round(totalAdvanceDeductions),
          total_advances_disbursed: Math.round(totalAdvDisbursed),
          total_advances_repaid: Math.round(totalAdvRepaid),
          total_advances_outstanding: Math.round(totalAdvOutstanding),
          active_advances_count: activeAdvCount,
          advance_recovery_rate: advanceRecoveryRate,
          total_incentives_generated: Math.round(totalIncentivesGen),
          total_incentives_released: Math.round(totalIncentivesRel),
          total_incentives_pending: Math.round(totalIncentivesPend),
          total_dealers_count: dealerRows.length,
          total_financers_count: financerRows.length
        },
        departments: departmentsList,
        department_breakdown: departmentBreakdown,
        employees: filteredEmployees,
        payroll: payrollRows,
        attendance: attRows,
        leaves: leaveRows,
        advances: advanceRows,
        incentives: incentiveRows,
        dealers: dealerRows,
        financers: financerRows
      });
    }

    else {
      return res.status(404).json({ error: `Action '${action}' not recognized` });
    }

  } catch (error) {
    console.error(`api/reports error [${action}]:`, error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};
