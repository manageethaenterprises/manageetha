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
  const action = req.query.action || req.body?.action || "sales-report";

  try {
    const compQuery = req.query.company_id || user.company_id;
    const isAll = !compQuery || compQuery === "all" || isNaN(parseInt(compQuery));
    const startDate = req.query.start_date || "1970-01-01";
    const endDate = req.query.end_date || "2099-12-31";

    // Ensure sales columns exist
    try {
      await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_gstin VARCHAR(50)`;
      await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS party_type VARCHAR(50) DEFAULT 'customer'`;
      await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS dealer_id INT`;
    } catch (e) {}

    // ═══════════════ GST AUDITOR REPORT ═══════════════
    if (action === "gst-report") {
      let salesGst;
      try {
        if (isAll) {
          salesGst = await sql`
            SELECT s.id, s.sale_date, c.name as company_name, c.gstin as company_gstin,
                   COALESCE(NULLIF(s.customer_name, ''), cust.name, v.legal_name, v.trade_name, 'Counter Sale') as customer_name,
                   COALESCE(NULLIF(s.customer_gstin, ''), cust.gstin, v.gstin) as customer_gstin,
                   s.party_type, s.dealer_id,
                   s.taxable_amount, s.cgst, s.sgst, s.igst, s.tax_amount, s.grand_total
            FROM sales s
            LEFT JOIN companies c ON s.company_id = c.id
            LEFT JOIN customers cust ON s.customer_id = cust.id
            LEFT JOIN dealers v ON s.dealer_id = v.id
            WHERE s.sale_date::date BETWEEN ${startDate}::date AND ${endDate}::date
            ORDER BY s.sale_date ASC
          `;
        } else {
          salesGst = await sql`
            SELECT s.id, s.sale_date, c.name as company_name, c.gstin as company_gstin,
                   COALESCE(NULLIF(s.customer_name, ''), cust.name, v.legal_name, v.trade_name, 'Counter Sale') as customer_name,
                   COALESCE(NULLIF(s.customer_gstin, ''), cust.gstin, v.gstin) as customer_gstin,
                   s.party_type, s.dealer_id,
                   s.taxable_amount, s.cgst, s.sgst, s.igst, s.tax_amount, s.grand_total
            FROM sales s
            LEFT JOIN companies c ON s.company_id = c.id
            LEFT JOIN customers cust ON s.customer_id = cust.id
            LEFT JOIN dealers v ON s.dealer_id = v.id
            WHERE s.company_id = ${parseInt(compQuery)} AND s.sale_date::date BETWEEN ${startDate}::date AND ${endDate}::date
            ORDER BY s.sale_date ASC
          `;
        }
      } catch (err) {
        if (isAll) {
          salesGst = await sql`
            SELECT s.id, s.sale_date, c.name as company_name, c.gstin as company_gstin,
                   COALESCE(NULLIF(s.customer_name, ''), cust.name, 'Counter Sale') as customer_name,
                   COALESCE(NULLIF(s.customer_gstin, ''), cust.gstin) as customer_gstin,
                   s.taxable_amount, s.cgst, s.sgst, s.igst, s.tax_amount, s.grand_total
            FROM sales s
            LEFT JOIN companies c ON s.company_id = c.id
            LEFT JOIN customers cust ON s.customer_id = cust.id
            WHERE s.sale_date::date BETWEEN ${startDate}::date AND ${endDate}::date
            ORDER BY s.sale_date ASC
          `;
        } else {
          salesGst = await sql`
            SELECT s.id, s.sale_date, c.name as company_name, c.gstin as company_gstin,
                   COALESCE(NULLIF(s.customer_name, ''), cust.name, 'Counter Sale') as customer_name,
                   COALESCE(NULLIF(s.customer_gstin, ''), cust.gstin) as customer_gstin,
                   s.taxable_amount, s.cgst, s.sgst, s.igst, s.tax_amount, s.grand_total
            FROM sales s
            LEFT JOIN companies c ON s.company_id = c.id
            LEFT JOIN customers cust ON s.customer_id = cust.id
            WHERE s.company_id = ${parseInt(compQuery)} AND s.sale_date::date BETWEEN ${startDate}::date AND ${endDate}::date
            ORDER BY s.sale_date ASC
          `;
        }
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

    // ═══════════════ GENERAL SALES REPORT ═══════════════
    else if (action === "sales-report") {
      let sales;
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
          WHERE s.company_id = ${parseInt(compQuery)} AND s.sale_date::date BETWEEN ${startDate}::date AND ${endDate}::date
          ORDER BY s.sale_date DESC
        `;
      }
      return res.status(200).json({ success: true, sales: sales || [] });
    }

    else {
      return res.status(404).json({ error: `Action '${action}' not recognized` });
    }

  } catch (error) {
    console.error(`api/reports error [${action}]:`, error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};
