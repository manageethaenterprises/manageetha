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

async function resequenceInvoices(sql, compId) {
  try {
    let invoices;
    if (compId && compId !== "all" && !isNaN(parseInt(compId))) {
      invoices = await sql`
        SELECT i.id, i.company_id, i.invoice_date, c.name as company_name 
        FROM invoices i
        LEFT JOIN companies c ON i.company_id = c.id
        WHERE i.company_id = ${parseInt(compId)}
        ORDER BY i.invoice_date ASC, i.id ASC
      `;
    } else {
      invoices = await sql`
        SELECT i.id, i.company_id, i.invoice_date, c.name as company_name 
        FROM invoices i
        LEFT JOIN companies c ON i.company_id = c.id
        ORDER BY i.invoice_date ASC, i.id ASC
      `;
    }

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const ddmmyy = `${dd}${mm}${yy}`;

    let seq = 1;
    for (const inv of invoices) {
      const compNameStr = (inv.company_name || 'MANASWINI').replace(/[^a-zA-Z]/g, '').toUpperCase();
      const comp4Letter = (compNameStr.slice(0, 4) || 'MANA').padEnd(4, 'X');
      const formattedNo = `${comp4Letter}${ddmmyy}-${String(seq).padStart(3, '0')}`;
      await sql`UPDATE invoices SET invoice_number = ${formattedNo} WHERE id = ${inv.id}`;
      seq++;
    }
  } catch (err) {
    console.error("resequenceInvoices error:", err.message);
  }
}

async function resequenceReceipts(sql, compId) {
  try {
    let receipts;
    if (compId && compId !== "all" && !isNaN(parseInt(compId))) {
      receipts = await sql`
        SELECT id FROM sale_payments 
        WHERE company_id = ${parseInt(compId)}
        ORDER BY payment_date ASC, id ASC
      `;
    } else {
      receipts = await sql`
        SELECT id FROM sale_payments 
        ORDER BY payment_date ASC, id ASC
      `;
    }

    let seq = 1;
    for (const r of receipts) {
      const formattedNo = `RCP-${String(seq).padStart(3, '0')}`;
      await sql`UPDATE sale_payments SET receipt_number = ${formattedNo} WHERE id = ${r.id}`;
      seq++;
    }
  } catch (err) {
    console.error("resequenceReceipts error:", err.message);
  }
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized. Please login." });

  const sql = getSQL();
  try {
    await sql`ALTER TABLE sale_payments ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(50);`;
  } catch (e) {}

  const action = req.query.action || req.body?.action || "list";

  try {
    const compQuery = req.query.company_id || user.company_id;
    const isAll = !compQuery || compQuery === "all" || isNaN(parseInt(compQuery));

    // ═══════════════ FINANCERS LIST ═══════════════
    if (action === "financers-list") {
      const compId = isAll ? 1 : parseInt(compQuery);
      const finRows = await sql`
        SELECT * FROM financers WHERE (company_id = ${compId} OR company_id IS NULL) AND is_active = true ORDER BY name ASC
      `;
      return res.status(200).json({ success: true, financers: finRows });
    }

    // ═══════════════ UPDATE INCENTIVE ═══════════════
    else if (action === "update-incentive") {
      const { sale_id, lead_incentive_amount } = req.body;
      if (!sale_id) return res.status(400).json({ error: "Sale ID required" });
      await sql`
        UPDATE sales SET lead_incentive_amount = ${parseFloat(lead_incentive_amount || 0)} WHERE id = ${parseInt(sale_id)}
      `;
      return res.status(200).json({ success: true, message: "Lead generator incentive updated successfully!" });
    }

    // ═══════════════ INCENTIVES SUMMARY & RELEASE ═══════════════
    else if (action === "incentives-summary") {
      const monthFilter = req.query.month;
      let rows;
      if (isAll) {
        if (monthFilter && monthFilter !== "all") {
          rows = await sql`
            SELECT 
              s.lead_generated_by,
              s.company_id,
              comp.name as company_name,
              COUNT(s.id)::int as total_sales_count,
              COALESCE(SUM(s.lead_incentive_amount), 0)::numeric as total_incentive_amount,
              COALESCE(SUM(CASE WHEN s.incentive_released = true THEN s.lead_incentive_amount ELSE 0 END), 0)::numeric as released_incentive_amount,
              COALESCE(SUM(CASE WHEN s.incentive_released = false OR s.incentive_released IS NULL THEN s.lead_incentive_amount ELSE 0 END), 0)::numeric as pending_incentive_amount
            FROM sales s
            LEFT JOIN companies comp ON s.company_id = comp.id
            WHERE s.lead_generated_by IS NOT NULL AND TRIM(s.lead_generated_by) != ''
              AND TO_CHAR(COALESCE(s.sale_date, s.created_at), 'YYYY-MM') = ${monthFilter}
            GROUP BY s.lead_generated_by, s.company_id, comp.name
            ORDER BY s.lead_generated_by ASC
          `;
        } else {
          rows = await sql`
            SELECT 
              s.lead_generated_by,
              s.company_id,
              comp.name as company_name,
              COUNT(s.id)::int as total_sales_count,
              COALESCE(SUM(s.lead_incentive_amount), 0)::numeric as total_incentive_amount,
              COALESCE(SUM(CASE WHEN s.incentive_released = true THEN s.lead_incentive_amount ELSE 0 END), 0)::numeric as released_incentive_amount,
              COALESCE(SUM(CASE WHEN s.incentive_released = false OR s.incentive_released IS NULL THEN s.lead_incentive_amount ELSE 0 END), 0)::numeric as pending_incentive_amount
            FROM sales s
            LEFT JOIN companies comp ON s.company_id = comp.id
            WHERE s.lead_generated_by IS NOT NULL AND TRIM(s.lead_generated_by) != ''
            GROUP BY s.lead_generated_by, s.company_id, comp.name
            ORDER BY s.lead_generated_by ASC
          `;
        }
      } else {
        const cId = parseInt(compQuery);
        if (monthFilter && monthFilter !== "all") {
          rows = await sql`
            SELECT 
              s.lead_generated_by,
              s.company_id,
              comp.name as company_name,
              COUNT(s.id)::int as total_sales_count,
              COALESCE(SUM(s.lead_incentive_amount), 0)::numeric as total_incentive_amount,
              COALESCE(SUM(CASE WHEN s.incentive_released = true THEN s.lead_incentive_amount ELSE 0 END), 0)::numeric as released_incentive_amount,
              COALESCE(SUM(CASE WHEN s.incentive_released = false OR s.incentive_released IS NULL THEN s.lead_incentive_amount ELSE 0 END), 0)::numeric as pending_incentive_amount
            FROM sales s
            LEFT JOIN companies comp ON s.company_id = comp.id
            WHERE s.company_id = ${cId} AND s.lead_generated_by IS NOT NULL AND TRIM(s.lead_generated_by) != ''
              AND TO_CHAR(COALESCE(s.sale_date, s.created_at), 'YYYY-MM') = ${monthFilter}
            GROUP BY s.lead_generated_by, s.company_id, comp.name
            ORDER BY s.lead_generated_by ASC
          `;
        } else {
          rows = await sql`
            SELECT 
              s.lead_generated_by,
              s.company_id,
              comp.name as company_name,
              COUNT(s.id)::int as total_sales_count,
              COALESCE(SUM(s.lead_incentive_amount), 0)::numeric as total_incentive_amount,
              COALESCE(SUM(CASE WHEN s.incentive_released = true THEN s.lead_incentive_amount ELSE 0 END), 0)::numeric as released_incentive_amount,
              COALESCE(SUM(CASE WHEN s.incentive_released = false OR s.incentive_released IS NULL THEN s.lead_incentive_amount ELSE 0 END), 0)::numeric as pending_incentive_amount
            FROM sales s
            LEFT JOIN companies comp ON s.company_id = comp.id
            WHERE s.company_id = ${cId} AND s.lead_generated_by IS NOT NULL AND TRIM(s.lead_generated_by) != ''
            GROUP BY s.lead_generated_by, s.company_id, comp.name
            ORDER BY s.lead_generated_by ASC
          `;
        }
      }
      return res.status(200).json({ success: true, summary: rows });
    }

    else if (action === "get-lead-sales") {
      const { lead_name, month: monthFilter } = req.query;
      if (!lead_name) return res.status(400).json({ error: "Lead generator name required" });

      let rows;
      if (monthFilter && monthFilter !== "all") {
        if (isAll) {
          rows = await sql`
            SELECT s.*, comp.name as company_name, cust.name as customer_name, cust.village, cust.mandal
            FROM sales s
            LEFT JOIN companies comp ON s.company_id = comp.id
            LEFT JOIN customers cust ON s.customer_id = cust.id
            WHERE LOWER(TRIM(s.lead_generated_by)) = LOWER(TRIM(${lead_name}))
              AND TO_CHAR(COALESCE(s.sale_date, s.created_at), 'YYYY-MM') = ${monthFilter}
            ORDER BY s.created_at DESC
          `;
        } else {
          const cId = parseInt(compQuery);
          rows = await sql`
            SELECT s.*, comp.name as company_name, cust.name as customer_name, cust.village, cust.mandal
            FROM sales s
            LEFT JOIN companies comp ON s.company_id = comp.id
            LEFT JOIN customers cust ON s.customer_id = cust.id
            WHERE s.company_id = ${cId} AND LOWER(TRIM(s.lead_generated_by)) = LOWER(TRIM(${lead_name}))
              AND TO_CHAR(COALESCE(s.sale_date, s.created_at), 'YYYY-MM') = ${monthFilter}
            ORDER BY s.created_at DESC
          `;
        }
      } else {
        if (isAll) {
          rows = await sql`
            SELECT s.*, comp.name as company_name, cust.name as customer_name, cust.village, cust.mandal
            FROM sales s
            LEFT JOIN companies comp ON s.company_id = comp.id
            LEFT JOIN customers cust ON s.customer_id = cust.id
            WHERE LOWER(TRIM(s.lead_generated_by)) = LOWER(TRIM(${lead_name}))
            ORDER BY s.created_at DESC
          `;
        } else {
          const cId = parseInt(compQuery);
          rows = await sql`
            SELECT s.*, comp.name as company_name, cust.name as customer_name, cust.village, cust.mandal
            FROM sales s
            LEFT JOIN companies comp ON s.company_id = comp.id
            LEFT JOIN customers cust ON s.customer_id = cust.id
            WHERE s.company_id = ${cId} AND LOWER(TRIM(s.lead_generated_by)) = LOWER(TRIM(${lead_name}))
            ORDER BY s.created_at DESC
          `;
        }
      }

      const saleIds = rows.map(r => r.id);
      let items = [];
      if (saleIds.length > 0) {
        items = await sql`
          SELECT si.*, p.name as product_name, p.brand, p.model
          FROM sale_items si
          LEFT JOIN products p ON si.product_id = p.id
          WHERE si.sale_id = ANY(${saleIds})
        `;
      }

      return res.status(200).json({ success: true, sales: rows, items });
    }

    else if (action === "release-incentives") {
      const { sale_ids, updates, lead_name } = req.body;
      const salesToSync = [];

      if (Array.isArray(updates) && updates.length > 0) {
        for (const u of updates) {
          if (u.id) {
            const incAmt = parseFloat(u.incentive_amount || 0);
            const updatedRows = await sql`
              UPDATE sales 
              SET lead_incentive_amount = ${incAmt},
                  incentive_released = true,
                  incentive_release_date = NOW(),
                  incentive_released_by = ${user.id}
              WHERE id = ${parseInt(u.id)}
              RETURNING id, company_id, lead_generated_by, challan_number, lead_incentive_amount
            `;
            if (updatedRows.length > 0) {
              salesToSync.push(updatedRows[0]);
            }
          }
        }
      } else if (Array.isArray(sale_ids) && sale_ids.length > 0) {
        for (const sId of sale_ids) {
          const updatedRows = await sql`
            UPDATE sales 
            SET incentive_released = true,
                incentive_release_date = NOW(),
                incentive_released_by = ${user.id}
            WHERE id = ${parseInt(sId)}
            RETURNING id, company_id, lead_generated_by, challan_number, lead_incentive_amount
          `;
          if (updatedRows.length > 0) {
            salesToSync.push(updatedRows[0]);
          }
        }
      }

      // Upsert expense record for each released sale
      for (const s of salesToSync) {
        const sId = s.id;
        const incAmt = parseFloat(s.lead_incentive_amount || 0);
        const compId = s.company_id || 1;
        const leadGen = lead_name || s.lead_generated_by || "Lead Generator";
        const dcNum = s.challan_number || sId;
        const expReceiptNum = 'EXP-INC-' + sId;

        const existingExp = await sql`SELECT id FROM expenses WHERE receipt_number = ${expReceiptNum}`;

        if (incAmt > 0) {
          if (existingExp.length > 0) {
            await sql`
              UPDATE expenses
              SET amount = ${incAmt},
                  dealer_receiver = ${leadGen},
                  company_id = ${compId},
                  expense_date = NOW(),
                  description = ${'Lead Sales Incentive Release for ' + leadGen + ' (DC/Inv #' + dcNum + ')'}
              WHERE id = ${existingExp[0].id}
            `;
          } else {
            await sql`
              INSERT INTO expenses (
                company_id, expense_date, category, dealer_receiver, amount, payment_mode,
                description, receipt_number, approval_status, created_by
              ) VALUES (
                ${compId}, NOW(), 'Lead Incentives', ${leadGen}, ${incAmt}, 'bank',
                ${'Lead Sales Incentive Release for ' + leadGen + ' (DC/Inv #' + dcNum + ')'},
                ${expReceiptNum}, 'approved', ${user.id}
              )
            `;
          }
        } else {
          if (existingExp.length > 0) {
            await sql`DELETE FROM expenses WHERE id = ${existingExp[0].id}`;
          }
        }
      }

      // Bulk sync any unsynced released incentives into expenses table
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
      } catch (err) {
        console.error("Incentive expense bulk sync error:", err.message);
      }

      return res.status(200).json({ success: true, message: "Incentives released & added to company expenses successfully!" });
    }

    // ═══════════════ DELETE LEAD INCENTIVE (SUPERADMIN ONLY) ═══════════════
    else if (action === "delete-lead-incentive") {
      if (user.role !== "superadmin" && user.username !== "superadmin") {
        return res.status(403).json({ error: "Only Superadmin can delete lead incentives." });
      }
      const { lead_name, company_id, month } = req.body;
      const leadNameStr = (lead_name || "").trim();
      if (!leadNameStr) return res.status(400).json({ error: "Lead generator name required" });

      const targetCompId = company_id || req.query.company_id || compQuery;
      const targetIsAll = !targetCompId || targetCompId === "all" || isNaN(parseInt(targetCompId));

      let targetSales;
      if (month && month !== "all") {
        if (targetIsAll) {
          targetSales = await sql`
            SELECT id FROM sales
            WHERE LOWER(TRIM(COALESCE(lead_generated_by, ''))) = LOWER(TRIM(${leadNameStr}))
              AND TO_CHAR(COALESCE(sale_date, created_at), 'YYYY-MM') = ${month}
          `;
        } else {
          const cId = parseInt(targetCompId);
          targetSales = await sql`
            SELECT id FROM sales
            WHERE (company_id = ${cId} OR company_id IS NULL)
              AND LOWER(TRIM(COALESCE(lead_generated_by, ''))) = LOWER(TRIM(${leadNameStr}))
              AND TO_CHAR(COALESCE(sale_date, created_at), 'YYYY-MM') = ${month}
          `;
        }
      } else {
        if (targetIsAll) {
          targetSales = await sql`
            SELECT id FROM sales
            WHERE LOWER(TRIM(COALESCE(lead_generated_by, ''))) = LOWER(TRIM(${leadNameStr}))
          `;
        } else {
          const cId = parseInt(targetCompId);
          targetSales = await sql`
            SELECT id FROM sales
            WHERE (company_id = ${cId} OR company_id IS NULL)
              AND LOWER(TRIM(COALESCE(lead_generated_by, ''))) = LOWER(TRIM(${leadNameStr}))
          `;
        }
      }

      const saleIds = targetSales.map(s => s.id);

      if (saleIds.length > 0) {
        await sql`
          UPDATE sales
          SET lead_generated_by = NULL,
              lead_incentive_amount = 0,
              incentive_released = false,
              incentive_release_date = NULL,
              incentive_released_by = NULL
          WHERE id = ANY(${saleIds})
        `;

        const expReceiptNums = saleIds.map(id => `EXP-INC-${id}`);
        await sql`
          DELETE FROM expenses
          WHERE receipt_number = ANY(${expReceiptNums})
        `;
      } else {
        if (targetIsAll) {
          await sql`
            UPDATE sales
            SET lead_generated_by = NULL,
                lead_incentive_amount = 0,
                incentive_released = false,
                incentive_release_date = NULL,
                incentive_released_by = NULL
            WHERE LOWER(TRIM(COALESCE(lead_generated_by, ''))) = LOWER(TRIM(${leadNameStr}))
          `;
        } else {
          const cId = parseInt(targetCompId);
          await sql`
            UPDATE sales
            SET lead_generated_by = NULL,
                lead_incentive_amount = 0,
                incentive_released = false,
                incentive_release_date = NULL,
                incentive_released_by = NULL
            WHERE (company_id = ${cId} OR company_id IS NULL)
              AND LOWER(TRIM(COALESCE(lead_generated_by, ''))) = LOWER(TRIM(${leadNameStr}))
          `;
        }
      }

      try {
        await sql`
          DELETE FROM expenses
          WHERE category = 'Lead Incentives'
            AND LOWER(TRIM(COALESCE(dealer_receiver, ''))) = LOWER(TRIM(${leadNameStr}))
        `;
      } catch (e) {}

      return res.status(200).json({ success: true, message: `Incentives for '${leadNameStr}' deleted & company expenses updated successfully!` });
    }

    // ═══════════════ SALES LIST ═══════════════
    else if (action === "list") {
      let rows;
      if (isAll) {
        rows = await sql`
          SELECT s.*, cust.name as customer_name, c.name as company_name,
                 c.gstin as company_gstin, c.hsn_code as company_hsn,
                 c.address as company_address, c.city as company_city, c.state as company_state,
                 c.pincode as company_pincode, c.state_code as company_state_code,
                 c.phone as company_phone, c.email as company_email, c.website as company_website,
                 c.bank_name, c.bank_account, c.bank_ifsc, c.bank_branch,
                 COALESCE(ret.return_count, 0)::int as return_count,
                 COALESCE(ret.total_refunded, 0)::numeric as total_refunded,
                 COALESCE(item_stat.max_rate, 0)::numeric as max_item_rate
          FROM sales s
          LEFT JOIN customers cust ON s.customer_id = cust.id
          LEFT JOIN companies c ON s.company_id = c.id
          LEFT JOIN (
            SELECT sale_id, COUNT(id) as return_count, SUM(refund_amount) as total_refunded
            FROM sales_returns GROUP BY sale_id
          ) ret ON ret.sale_id = s.id
          LEFT JOIN (
            SELECT sale_id, MAX(rate) as max_rate
            FROM sale_items GROUP BY sale_id
          ) item_stat ON item_stat.sale_id = s.id
          ORDER BY s.created_at DESC
        `;
      } else {
        rows = await sql`
          SELECT s.*, cust.name as customer_name, c.name as company_name,
                 c.gstin as company_gstin, c.hsn_code as company_hsn,
                 c.address as company_address, c.city as company_city, c.state as company_state,
                 c.pincode as company_pincode, c.state_code as company_state_code,
                 c.phone as company_phone, c.email as company_email, c.website as company_website,
                 c.bank_name, c.bank_account, c.bank_ifsc, c.bank_branch,
                 COALESCE(ret.return_count, 0)::int as return_count,
                 COALESCE(ret.total_refunded, 0)::numeric as total_refunded,
                 COALESCE(item_stat.max_rate, 0)::numeric as max_item_rate
          FROM sales s
          LEFT JOIN customers cust ON s.customer_id = cust.id
          LEFT JOIN companies c ON s.company_id = c.id
          LEFT JOIN (
            SELECT sale_id, COUNT(id) as return_count, SUM(refund_amount) as total_refunded
            FROM sales_returns GROUP BY sale_id
          ) ret ON ret.sale_id = s.id
          LEFT JOIN (
            SELECT sale_id, MAX(rate) as max_rate
            FROM sale_items GROUP BY sale_id
          ) item_stat ON item_stat.sale_id = s.id
          WHERE s.company_id = ${parseInt(compQuery)}
          ORDER BY s.created_at DESC
        `;
      }

      const saleIds = rows.map(r => r.id);
      let itemsMap = {};
      if (saleIds.length > 0) {
        const items = await sql`
          SELECT si.sale_id, si.quantity, si.rate, si.serial_number, p.name as product_name
          FROM sale_items si
          LEFT JOIN products p ON si.product_id = p.id
          WHERE si.sale_id = ANY(${saleIds})
        `;
        items.forEach(it => {
          if (!itemsMap[it.sale_id]) itemsMap[it.sale_id] = [];
          itemsMap[it.sale_id].push(it);
        });
      }

      rows.forEach(r => {
        r.items_summary = itemsMap[r.id] || [];
      });

      return res.status(200).json({ success: true, sales: rows });
    }

    else if (action === "get-details") {
      const saleId = req.query.id || req.body?.id;
      if (!saleId) return res.status(400).json({ error: "Sale ID required" });

      const sale = await sql`
        SELECT s.*, c.name as company_name, c.gstin as company_gstin, c.hsn_code as company_hsn,
               c.address as company_address, c.city as company_city, c.state as company_state,
               c.pincode as company_pincode, c.state_code as company_state_code,
               c.phone as company_phone, c.email as company_email, c.website as company_website,
               c.bank_name, c.bank_account, c.bank_ifsc, c.bank_branch,
               cust.name as cust_name, cust.phone as cust_phone,
               fin.name as financer_name
        FROM sales s
        LEFT JOIN companies c ON s.company_id = c.id
        LEFT JOIN customers cust ON s.customer_id = cust.id
        LEFT JOIN financers fin ON s.financer_id = fin.id
        WHERE s.id = ${parseInt(saleId)}
      `;

      if (sale.length === 0) return res.status(404).json({ error: "Sale not found" });

      const items = await sql`
        SELECT si.*, p.name as product_name, p.brand, p.model, p.hsn_sac
        FROM sale_items si
        LEFT JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ${parseInt(saleId)}
      `;

      const payments = await sql`
        SELECT sp.*, u.username as cashier_name
        FROM sale_payments sp
        LEFT JOIN users u ON sp.cashier_id = u.id
        WHERE sp.sale_id = ${parseInt(saleId)}
        ORDER BY sp.payment_date ASC, sp.id ASC
      `;

      const returns = await sql`
        SELECT r.*, p.brand, p.model
        FROM sales_returns r
        LEFT JOIN products p ON r.product_id = p.id
        WHERE r.sale_id = ${parseInt(saleId)}
        ORDER BY r.return_date ASC, r.id ASC
      `;

      return res.status(200).json({ success: true, sale: sale[0], items, payments, returns });
    }

    // ═══════════════ CREATE SALE & DELIVERY CHALLAN ═══════════════
    else if (action === "create") {
      const {
        company_id, customer_id, customer_name, father_name, village, mandal, cell_phone,
        lead_generated_by, lead_incentive_amount, supply_type, scheme_department, scheme_app_no,
        transporter_name, transporter_vehicle_no, sale_date, items, payment_mode, bank_sub_type,
        utr_number, transaction_ref, cheque_dd_no, cheque_dd_date, receiving_bank, bank_account_id, advance_amount,
        paid_amount, financer_id, finance_amount, discount_amount, vip_perk_notes,
        customer_gstin, party_type, dealer_id
      } = req.body;

      // Auto-migrate columns if missing
      try {
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_gstin VARCHAR(50)`;
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS party_type VARCHAR(50) DEFAULT 'customer'`;
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS dealer_id INT REFERENCES dealers(id) ON DELETE SET NULL`;
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS bank_account_id INT REFERENCES bank_accounts(id) ON DELETE SET NULL`;
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100)`;
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_date DATE`;
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS warranty_term VARCHAR(50) DEFAULT '1_year'`;
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS warranty_months INT DEFAULT NULL`;
        await sql`ALTER TABLE sale_payments ADD COLUMN IF NOT EXISTS bank_account_id INT REFERENCES bank_accounts(id) ON DELETE SET NULL`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN DEFAULT true;`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'generated';`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_id INT;`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS taxable_total NUMERIC(12,2);`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cgst_total NUMERIC(12,2);`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sgst_total NUMERIC(12,2);`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS igst_total NUMERIC(12,2);`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_total NUMERIC(12,2);`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS grand_total NUMERIC(12,2);`;
      } catch (e) {}

      const compId = user.role === "superadmin" ? (company_id ? parseInt(company_id) : (user.company_id || 1)) : (user.company_id || 1);
      if (!compId || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Company and items array required" });
      }

      const isCounter = (party_type === 'counter' || (customer_name && customer_name.trim().toLowerCase() === 'counter customer'));

      // Fetch company for sequential numbering
      const compArr = await sql`SELECT * FROM companies WHERE id = ${compId}`;
      const company = compArr[0] || {};
      const compNameStr = (company.name || 'MANASWINI').replace(/[^a-zA-Z]/g, '').toUpperCase();
      const comp4Letter = (compNameStr.slice(0, 4) || 'MANA').padEnd(4, 'X');

      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yy = String(now.getFullYear()).slice(-2);
      const ddmmyy = `${dd}${mm}${yy}`;

      const lastInv = await sql`
        SELECT invoice_number FROM invoices 
        WHERE company_id = ${compId} AND invoice_number IS NOT NULL AND invoice_number != ''
        ORDER BY id DESC LIMIT 1
      `;
      let nextInvSeq = 1;
      if (lastInv.length > 0 && lastInv[0].invoice_number) {
        const match = lastInv[0].invoice_number.match(/(\d+)$/);
        if (match) nextInvSeq = parseInt(match[1], 10) + 1;
      }
      const invNo = `${comp4Letter}${ddmmyy}-${String(nextInvSeq).padStart(3, '0')}`;

      const lastDc = await sql`
        SELECT challan_number FROM sales 
        WHERE company_id = ${compId} AND challan_number IS NOT NULL AND challan_number != ''
        ORDER BY id DESC LIMIT 1
      `;
      let nextDcSeq = 1;
      if (lastDc.length > 0 && lastDc[0].challan_number) {
        const match = lastDc[0].challan_number.match(/(\d+)$/);
        if (match) nextDcSeq = parseInt(match[1], 10) + 1;
      }
      const dcNo = nextDcSeq.toString();

      const lastRcpt = await sql`
        SELECT receipt_number FROM sale_payments 
        WHERE company_id = ${compId} AND receipt_number IS NOT NULL AND receipt_number != ''
        ORDER BY id DESC LIMIT 1
      `;
      let nextRcptSeq = 1;
      if (lastRcpt.length > 0 && lastRcpt[0].receipt_number) {
        const match = lastRcpt[0].receipt_number.match(/(\d+)$/);
        if (match) nextRcptSeq = parseInt(match[1], 10) + 1;
      }
      const initialRcptNo = `RCP-${String(nextRcptSeq).padStart(3, '0')}`;

      const compStateStr = (company.state || "").trim().toLowerCase();
      const reqSupplyState = (req.body.supply_state || "").trim().toLowerCase();
      const isSameState = (!compStateStr || !reqSupplyState || reqSupplyState === compStateStr || reqSupplyState === "same state" || reqSupplyState.includes("intra"));
      const isInterstate = !isSameState;
      let taxableSum = 0;
      let taxSum = 0;

      items.forEach(i => {
        const lineTotal = parseFloat(i.rate) * parseInt(i.quantity);
        const gstRate = parseFloat(i.gst_rate || 18);
        const lineTax = (lineTotal * gstRate) / 100;
        taxableSum += lineTotal;
        taxSum += lineTax;
      });

      const discVal = parseFloat(discount_amount || 0);
      const grandTotal = Math.max(0, (taxableSum - discVal) + taxSum);
      const cgst = isInterstate ? 0 : taxSum / 2;
      const sgst = isInterstate ? 0 : taxSum / 2;
      const igst = isInterstate ? taxSum : 0;

      const rawPaid = (paid_amount !== undefined && paid_amount !== null && paid_amount !== "" && !isNaN(parseFloat(paid_amount)))
        ? parseFloat(paid_amount)
        : (payment_mode === 'credit'
            ? (parseFloat(advance_amount || 0))
            : (payment_mode === 'finance' ? (parseFloat(finance_amount || 0)) : grandTotal));
      
      const initialPaid = Math.min(grandTotal, Math.max(0, rawPaid));
      const pendingAmt = Math.max(0, grandTotal - initialPaid);
      let status = 'unpaid';
      if (pendingAmt <= 0.01) status = 'paid';
      else if (initialPaid > 0) status = 'partially_paid';

      // Fetch terms snapshot for payment mode
      let termsSnapshot = `1. All goods supplied in good working condition.\n2. Payment terms as agreed upon under ${payment_mode.toUpperCase()}.\n3. Warranty as per manufacturer norms.`;
      try {
        const termsObj = await sql`
          SELECT terms_text FROM company_payment_terms WHERE company_id = ${compId} AND payment_mode = ${payment_mode || 'cash'}
        `;
        if (termsObj.length > 0 && termsObj[0].terms_text) termsSnapshot = termsObj[0].terms_text;
      } catch (e) {}

      // Auto-resolve or register customer in customers table with 3-combination matching
      let finalCustId = customer_id ? parseInt(customer_id) : null;
      if (customer_name && customer_name.trim() && party_type !== 'dealer') {
        try {
          let existing;
          if (cell_phone && cell_phone.trim()) {
            existing = await sql`SELECT id FROM customers WHERE phone = ${cell_phone.trim()} LIMIT 1`;
          }
          if ((!existing || existing.length === 0) && father_name && father_name.trim()) {
            existing = await sql`SELECT id FROM customers WHERE (company_id = ${compId} OR company_id IS NULL) AND LOWER(name) = LOWER(${customer_name.trim()}) AND LOWER(father_name) = LOWER(${father_name.trim()}) LIMIT 1`;
          }
          if (!existing || existing.length === 0) {
            existing = await sql`SELECT id FROM customers WHERE (company_id = ${compId} OR company_id IS NULL) AND LOWER(name) = LOWER(${customer_name.trim()}) LIMIT 1`;
          }

          if (existing && existing.length > 0) {
            finalCustId = existing[0].id;
            await sql`
              UPDATE customers SET
                father_name = COALESCE(father_name, ${father_name || null}),
                village = COALESCE(village, ${village || null}),
                mandal = COALESCE(mandal, ${mandal || null}),
                phone = COALESCE(phone, ${cell_phone || null}),
                address = COALESCE(address, ${village || null})
              WHERE id = ${finalCustId}
            `;
          } else {
            const insertedCust = await sql`
              INSERT INTO customers (company_id, name, phone, father_name, village, mandal, address, created_at)
              VALUES (${compId}, ${customer_name.trim()}, ${cell_phone ? cell_phone.trim() : null}, ${father_name ? father_name.trim() : null}, ${village ? village.trim() : null}, ${mandal ? mandal.trim() : null}, ${village ? village.trim() : null}, NOW())
              RETURNING id
            `;
            if (insertedCust.length > 0) finalCustId = insertedCust[0].id;
          }
        } catch (err) {
          console.error("Auto customer creation error during sale:", err);
        }
      }

      if (finalCustId && party_type !== 'dealer') {
        try {
          await sql`UPDATE customers SET total_purchases = COALESCE(total_purchases, 0) + 1 WHERE id = ${finalCustId}`;
        } catch (e) {}
      }

      const invDateVal = sale_date || new Date().toISOString().split('T')[0];

      const warrantyTermVal = req.body.warranty_term || '1_year';
      let warrantyMonthsVal = 12;
      if (warrantyTermVal === '1_month') warrantyMonthsVal = 1;
      else if (warrantyTermVal === '3_months') warrantyMonthsVal = 3;
      else if (warrantyTermVal === '6_months') warrantyMonthsVal = 6;
      else if (warrantyTermVal === '1_year') warrantyMonthsVal = 12;
      else if (warrantyTermVal === '2_years') warrantyMonthsVal = 24;
      else if (warrantyTermVal === '3_years') warrantyMonthsVal = 36;
      else if (warrantyTermVal === 'no_warranty') warrantyMonthsVal = 0;

      const newSale = await sql`
        INSERT INTO sales (
          company_id, customer_id, customer_name, father_name, village, mandal,
          cell_phone, customer_gstin, party_type, dealer_id, lead_generated_by, lead_incentive_amount, supply_type, scheme_department, scheme_app_no,
          transporter_name, transporter_vehicle_no, challan_number, sale_date, total_amount, taxable_amount,
          cgst, sgst, igst, tax_amount, grand_total, advance_amount, paid_amount, pending_amount,
          payment_status, payment_mode, bank_sub_type, utr_number, cheque_dd_no, cheque_dd_date,
          receiving_bank, bank_account_id, terms_conditions, financer_id, finance_amount, discount_amount, vip_perk_notes, created_by,
          invoice_number, invoice_date, warranty_term, warranty_months
        ) VALUES (
          ${compId}, ${finalCustId}, ${customer_name || null},
          ${father_name || null}, ${village || null}, ${mandal || null}, ${cell_phone || null},
          ${customer_gstin || null}, ${party_type || 'customer'}, ${dealer_id ? parseInt(dealer_id) : null},
          ${lead_generated_by || null}, ${parseFloat(lead_incentive_amount || 0)}, ${supply_type || 'Direct Sale'},
          ${scheme_department || null}, ${scheme_app_no || null}, ${transporter_name || null},
          ${transporter_vehicle_no || null}, ${dcNo}, ${invDateVal},
          ${taxableSum}, ${taxableSum}, ${cgst}, ${sgst}, ${igst}, ${taxSum}, ${grandTotal},
          ${parseFloat(advance_amount || 0)}, ${initialPaid}, ${pendingAmt}, ${status}, ${payment_mode || 'cash'},
          ${bank_sub_type || null}, ${utr_number || transaction_ref || null}, ${cheque_dd_no || null},
          ${cheque_dd_date || null}, ${receiving_bank || null}, ${bank_account_id ? parseInt(bank_account_id) : null}, ${termsSnapshot},
          ${financer_id ? parseInt(financer_id) : null}, ${finance_amount ? parseFloat(finance_amount) : 0}, ${discVal}, ${vip_perk_notes || null}, ${user.id},
          ${isCounter ? invNo : null}, ${isCounter ? invDateVal : null}, ${warrantyTermVal}, ${warrantyMonthsVal}
        )
        RETURNING *
      `;

      // If counter customer, auto insert Tax Invoice record into invoices table
      if (isCounter) {
        try {
          await sql`
            INSERT INTO invoices (
              company_id, invoice_number, invoice_date, sale_id, customer_id, taxable_total,
              cgst_total, sgst_total, igst_total, tax_total, grand_total, is_finalized
            ) VALUES (
              ${compId}, ${invNo}, ${invDateVal}, ${newSale[0].id},
              ${finalCustId ? parseInt(finalCustId) : null}, ${taxableSum}, ${cgst}, ${sgst},
              ${igst}, ${taxSum}, ${grandTotal}, true
            )
          `;
        } catch (invErr) {
          console.error("Auto counter invoice insertion error:", invErr);
        }
      }

      // Save initial payment record if paid > 0
      if (initialPaid > 0) {
        await sql`
          INSERT INTO sale_payments (
            company_id, sale_id, payment_date, payment_mode, bank_sub_type,
            transaction_ref, cheque_dd_no, cheque_dd_date, receiving_bank, bank_account_id,
            amount, cashier_id, notes, receipt_number
          ) VALUES (
            ${compId}, ${newSale[0].id}, ${invDateVal}, ${payment_mode || 'cash'},
            ${bank_sub_type || null}, ${utr_number || transaction_ref || null}, ${cheque_dd_no || null},
            ${cheque_dd_date || null}, ${receiving_bank || null}, ${bank_account_id ? parseInt(bank_account_id) : null}, ${initialPaid}, ${user.id},
            ${payment_mode === 'credit' ? 'Initial Advance Payment' : (pendingAmt > 0.01 ? 'Initial Part Payment' : 'Initial Full POS Payment')},
            ${initialRcptNo}
          )
        `;
      }

      // Save items and deduct stock
      for (const item of items) {
        const lineTotal = parseFloat(item.rate) * parseInt(item.quantity);
        const gstRate = parseFloat(item.gst_rate || 18);
        const lineTax = (lineTotal * gstRate) / 100;
        const validProdId = (item.product_id && !isNaN(parseInt(item.product_id))) ? parseInt(item.product_id) : null;

        await sql`
          INSERT INTO sale_items (
            sale_id, product_id, description, hsn_code, quantity, rate, taxable_value,
            gst_rate, cgst, sgst, igst, total, serial_number
          ) VALUES (
            ${newSale[0].id}, ${validProdId}, ${item.description || item.name || null},
            ${item.hsn_code || item.hsn_sac || null}, ${parseInt(item.quantity)}, ${parseFloat(item.rate)},
            ${lineTotal}, ${gstRate}, ${lineTax / 2}, ${lineTax / 2}, 0, ${lineTotal + lineTax},
            ${item.serial_number || null}
          )
        `;

        // Deduct inventory stock only if item has a valid product_id with atomic concurrency lock
        if (validProdId) {
          const qtyDeduct = parseInt(item.quantity) || 0;
          await sql`
            UPDATE products 
            SET current_stock = GREATEST(0, current_stock - ${qtyDeduct})
            WHERE id = ${validProdId} AND current_stock >= ${qtyDeduct}
          `;
        }
      }

      // Fetch complete sale details with company and customer metadata for instant accurate printing
      const fullSaleDetails = await sql`
        SELECT s.*, c.name as company_name, c.gstin as company_gstin, c.hsn_code as company_hsn,
               c.address as company_address, c.city as company_city, c.state as company_state,
               c.pincode as company_pincode, c.state_code as company_state_code,
               c.phone as company_phone, c.email as company_email, c.website as company_website,
               c.bank_name, c.bank_account, c.bank_ifsc, c.bank_branch,
               cust.name as cust_name, cust.phone as cust_phone,
               fin.name as financer_name
        FROM sales s
        LEFT JOIN companies c ON s.company_id = c.id
        LEFT JOIN customers cust ON s.customer_id = cust.id
        LEFT JOIN financers fin ON s.financer_id = fin.id
        WHERE s.id = ${newSale[0].id}
      `;

      return res.status(200).json({
        success: true,
        sale: fullSaleDetails[0] || newSale[0],
        is_direct_invoice: isCounter,
        invoice_number: isCounter ? invNo : null,
        message: isCounter 
          ? `Tax Invoice #${invNo} generated directly for Counter Customer!`
          : "Delivery Challan & Sale created successfully! Go to Invoices tab to raise Tax Invoice."
      });
    }

    // ═══════════════ CREATE CUSTOM INVOICE ═══════════════
    else if (action === "create-custom-invoice") {
      const {
        company_id, custom_type, invoice_number, sale_date,
        receiver_name, receiver_address, receiver_state, receiver_state_code, receiver_gstin,
        consignee_name, consignee_address, consignee_state, consignee_state_code, consignee_gstin,
        items, grand_total, custom_meta_json
      } = req.body;

      const compId = user.role === "superadmin" ? (company_id ? parseInt(company_id) : (user.company_id || 1)) : (user.company_id || 1);
      if (!compId || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Company ID and items array required" });
      }

      // Auto-migrate custom columns if missing
      try {
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100)`;
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE`;
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS custom_type VARCHAR(50)`;
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS consignee_name VARCHAR(255)`;
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS consignee_address TEXT`;
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS consignee_state VARCHAR(100)`;
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS consignee_state_code VARCHAR(20)`;
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS consignee_gstin VARCHAR(50)`;
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS receiver_address TEXT`;
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS receiver_state VARCHAR(100)`;
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS receiver_state_code VARCHAR(20)`;
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS custom_meta_json TEXT`;
      } catch (e) {}

      // Format custom invoice serial number
      let invNo = invoice_number ? String(invoice_number).trim() : null;
      if (!invNo) {
        const lastCustom = await sql`SELECT invoice_number FROM sales WHERE company_id = ${compId} AND is_custom = TRUE ORDER BY id DESC LIMIT 1`;
        let seq = 1;
        if (lastCustom.length > 0 && lastCustom[0].invoice_number) {
          const match = lastCustom[0].invoice_number.match(/(\d+)$/);
          if (match) seq = parseInt(match[1], 10) + 1;
        }
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const nextYY = String(now.getFullYear() + 1).slice(-2);
        invNo = `${yy}-${nextYY}/${String(seq).padStart(2, '0')}`;
      }

      // Calculate totals
      let taxableSum = 0;
      let cgstSum = 0;
      let sgstSum = 0;
      let igstSum = 0;

      items.forEach(it => {
        const tVal = parseFloat(it.taxable_value || (parseFloat(it.rate || 0) * (parseInt(it.qty || it.quantity) || 1)));
        const cAmt = parseFloat(it.cgst_amount || (tVal * (parseFloat(it.cgst_rate || 0) / 100)));
        const sAmt = parseFloat(it.sgst_amount || (tVal * (parseFloat(it.sgst_rate || 0) / 100)));
        const iAmt = parseFloat(it.igst_amount || (tVal * (parseFloat(it.igst_rate || 0) / 100)));

        taxableSum += tVal;
        cgstSum += cAmt;
        sgstSum += sAmt;
        igstSum += iAmt;
      });

      const totalTax = cgstSum + sgstSum + igstSum;
      const computedGrandTotal = parseFloat(grand_total || (taxableSum + totalTax));

      // Insert custom invoice into sales table
      const newCustomSale = await sql`
        INSERT INTO sales (
          company_id, is_custom, custom_type, invoice_number, sale_date,
          customer_name, receiver_address, receiver_state, receiver_state_code, customer_gstin,
          consignee_name, consignee_address, consignee_state, consignee_state_code, consignee_gstin,
          taxable_amount, cgst, sgst, igst, tax_amount, grand_total, total_amount, paid_amount,
          pending_amount, payment_status, custom_meta_json, created_by
        ) VALUES (
          ${compId}, TRUE, ${custom_type || 'misc'}, ${invNo}, ${sale_date || 'NOW()'},
          ${receiver_name || 'BTL EPC LTD'}, ${receiver_address || null},
          ${receiver_state || 'AP'}, ${receiver_state_code || '37'}, ${receiver_gstin || null},
          ${consignee_name || receiver_name || 'BTL EPC LTD'}, ${consignee_address || receiver_address || null},
          ${consignee_state || receiver_state || 'AP'}, ${consignee_state_code || receiver_state_code || '37'},
          ${consignee_gstin || receiver_gstin || null},
          ${taxableSum}, ${cgstSum}, ${sgstSum}, ${igstSum}, ${totalTax}, ${computedGrandTotal}, ${computedGrandTotal},
          ${computedGrandTotal}, 0, 'paid', ${custom_meta_json ? (typeof custom_meta_json === 'string' ? custom_meta_json : JSON.stringify(custom_meta_json)) : null}, ${user.userId || null}
        ) RETURNING *
      `;

      const saleId = newCustomSale[0].id;

      // Insert line items
      for (const item of items) {
        const qty = parseInt(item.qty || item.quantity) || 1;
        const rate = parseFloat(item.rate || 0);
        const tVal = parseFloat(item.taxable_value || (rate * qty));
        const cRate = parseFloat(item.cgst_rate || 0);
        const sRate = parseFloat(item.sgst_rate || 0);
        const iRate = parseFloat(item.igst_rate || 0);
        const cAmt = parseFloat(item.cgst_amount || (tVal * cRate / 100));
        const sAmt = parseFloat(item.sgst_amount || (tVal * sRate / 100));
        const iAmt = parseFloat(item.igst_amount || (tVal * iRate / 100));
        const lineTotal = parseFloat(item.total || (tVal + cAmt + sAmt + iAmt));

        await sql`
          INSERT INTO sale_items (
            sale_id, description, hsn_code, quantity, unit, rate,
            taxable_value, gst_rate, cgst, sgst, igst, total
          ) VALUES (
            ${saleId}, ${item.description || 'Service Charges'}, ${item.hsn_code || item.hsn_sac || null},
            ${qty}, ${item.unit || 'NOS'}, ${rate}, ${tVal}, ${cRate + sRate + iRate},
            ${cAmt}, ${sAmt}, ${iAmt}, ${lineTotal}
          )
        `;
      }

      // Automatically record in invoices table
      await sql`
        INSERT INTO invoices (
          company_id, invoice_number, invoice_date, sale_id, taxable_total,
          cgst_total, sgst_total, igst_total, tax_total, grand_total, is_finalized
        ) VALUES (
          ${compId}, ${invNo}, ${sale_date || 'NOW()'}, ${saleId}, ${taxableSum},
          ${cgstSum}, ${sgstSum}, ${igstSum}, ${totalTax}, ${computedGrandTotal}, true
        )
      `;

      return res.status(200).json({
        success: true,
        sale_id: saleId,
        invoice_number: invNo,
        sale: newCustomSale[0],
        items: items,
        message: "Custom Invoice created successfully!"
      });
    }

    // ═══════════════ ADD PART / FULL PAYMENT ═══════════════
    else if (action === "add-payment") {
      const {
        sale_id, payment_date, payment_mode, bank_sub_type, transaction_ref,
        cheque_dd_no, cheque_dd_date, receiving_bank, bank_account_id, amount, notes
      } = req.body;

      if (!sale_id || !amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: "Sale ID and valid payment amount required" });
      }

      const saleArr = await sql`SELECT * FROM sales WHERE id = ${parseInt(sale_id)}`;
      if (saleArr.length === 0) return res.status(404).json({ error: "Sale not found" });

      const sale = saleArr[0];
      const payAmount = parseFloat(amount);

      const lastRcpt = await sql`
        SELECT receipt_number FROM sale_payments 
        WHERE company_id = ${sale.company_id} AND receipt_number IS NOT NULL AND receipt_number != ''
        ORDER BY id DESC LIMIT 1
      `;
      let nextRcptSeq = 1;
      if (lastRcpt.length > 0 && lastRcpt[0].receipt_number) {
        const match = lastRcpt[0].receipt_number.match(/(\d+)$/);
        if (match) nextRcptSeq = parseInt(match[1], 10) + 1;
      }
      const newRcptNo = `RCP-${String(nextRcptSeq).padStart(3, '0')}`;

      // Record payment in sale_payments
      const newPay = await sql`
        INSERT INTO sale_payments (
          company_id, sale_id, payment_date, payment_mode, bank_sub_type,
          transaction_ref, cheque_dd_no, cheque_dd_date, receiving_bank, bank_account_id,
          amount, cashier_id, notes, receipt_number
        ) VALUES (
          ${sale.company_id}, ${sale.id}, ${payment_date || 'NOW()'}, ${payment_mode || 'cash'},
          ${bank_sub_type || null}, ${transaction_ref || null}, ${cheque_dd_no || null},
          ${cheque_dd_date || null}, ${receiving_bank || null}, ${bank_account_id ? parseInt(bank_account_id) : null}, ${payAmount}, ${user.id},
          ${notes || 'Part/Full payment collected'}, ${newRcptNo}
        )
        RETURNING *
      `;

      // Recalculate total payments strictly from sale_payments table
      const sumRes = await sql`
        SELECT COALESCE(SUM(amount), 0) as total_paid FROM sale_payments WHERE sale_id = ${sale.id}
      `;
      const totalPaid = parseFloat(sumRes[0].total_paid);
      const grandTotal = parseFloat(sale.grand_total);
      const newPending = Math.max(0, grandTotal - totalPaid);

      let newStatus = 'unpaid';
      if (newPending <= 0.01) newStatus = 'paid';
      else if (totalPaid > 0) newStatus = 'partially_paid';

      await sql`
        UPDATE sales SET
          paid_amount = ${totalPaid},
          pending_amount = ${newPending},
          payment_status = ${newStatus}
        WHERE id = ${sale.id}
      `;

      // Trigger DLT SMS customer notification log
      const custPhone = sale.cell_phone || sale.phone;
      if (custPhone) {
        try {
          const smsText = `Dear ${sale.customer_name || 'Customer'}, received payment of Rs.${payAmount.toFixed(2)} via ${payment_mode.toUpperCase()} for Invoice #${sale.challan_number || sale.id}. Remaining pending balance: Rs.${newPending.toFixed(2)}. Thank you!`;
          await sql`
            INSERT INTO sms_logs (company_id, phone, message_text, status, provider_response)
            VALUES (${sale.company_id}, ${custPhone}, ${smsText}, 'delivered', 'DLT_STATUS_SUCCESS_200')
          `;
        } catch (smsErr) {}
      }

      return res.status(200).json({
        success: true,
        payment: newPay[0],
        total_paid: totalPaid,
        pending_amount: newPending,
        status: newStatus,
        message: `Payment of ₹${payAmount.toFixed(2)} recorded successfully!`
      });
    }

    // ═══════════════ PENDING DCS LIST (Waiting for Tax Invoice) ═══════════════
    else if (action === "pending-dcs") {
      let pendingRows;
      if (isAll) {
        pendingRows = await sql`
          SELECT s.*, COALESCE(s.customer_name, cust.name, 'Counter Customer') as customer_name,
                 s.cell_phone, c.name as company_name
          FROM sales s
          LEFT JOIN customers cust ON s.customer_id = cust.id
          LEFT JOIN companies c ON s.company_id = c.id
          WHERE (s.is_custom IS NOT TRUE OR s.is_custom = false)
            AND (s.invoice_number IS NULL OR s.invoice_number = '' OR s.id NOT IN (SELECT sale_id FROM invoices WHERE sale_id IS NOT NULL))
          ORDER BY s.created_at DESC
        `;
      } else {
        const cId = parseInt(compQuery);
        pendingRows = await sql`
          SELECT s.*, COALESCE(s.customer_name, cust.name, 'Counter Customer') as customer_name,
                 s.cell_phone, c.name as company_name
          FROM sales s
          LEFT JOIN customers cust ON s.customer_id = cust.id
          LEFT JOIN companies c ON s.company_id = c.id
          WHERE s.company_id = ${cId}
            AND (s.is_custom IS NOT TRUE OR s.is_custom = false)
            AND (s.invoice_number IS NULL OR s.invoice_number = '' OR s.id NOT IN (SELECT sale_id FROM invoices WHERE sale_id IS NOT NULL))
          ORDER BY s.created_at DESC
        `;
      }
      return res.status(200).json({ success: true, sales: pendingRows, pending_dcs: pendingRows });
    }

    // ═══════════════ RAISE TAX INVOICE FOR A DC ═══════════════
    else if (action === "raise-invoice") {
      const { sale_id, invoice_date, custom_grand_total, custom_taxable_amount, editable_grand_total, editable_taxable_amount } = req.body;
      if (!sale_id) return res.status(400).json({ error: "Sale ID is required to raise Tax Invoice" });

      const sRows = await sql`SELECT * FROM sales WHERE id = ${parseInt(sale_id)}`;
      if (sRows.length === 0) return res.status(404).json({ error: "Sale / Delivery Challan not found" });

      const sale = sRows[0];
      const compId = sale.company_id;

      // Auto-migrate missing columns on invoices and sales tables to avoid DB schema errors
      try {
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100);`;
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_date DATE;`;
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS dc_grand_total NUMERIC(12,2);`;
        await sql`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS dc_rate NUMERIC(12,2);`;
        await sql`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS dc_taxable_value NUMERIC(12,2);`;
        await sql`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS dc_total NUMERIC(12,2);`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN DEFAULT true;`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'generated';`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_id INT;`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS taxable_total NUMERIC(12,2);`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cgst_total NUMERIC(12,2);`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sgst_total NUMERIC(12,2);`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS igst_total NUMERIC(12,2);`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_total NUMERIC(12,2);`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS grand_total NUMERIC(12,2);`;
      } catch (e) {}

      const invDate = invoice_date || sale.sale_date || new Date().toISOString().split('T')[0];

      // Check if invoice already raised for this DC
      const existingInv = await sql`SELECT id, invoice_number FROM invoices WHERE sale_id = ${sale.id}`;
      if (existingInv.length > 0 && existingInv[0].invoice_number) {
        const invNo = existingInv[0].invoice_number;
        await sql`UPDATE sales SET invoice_number = ${invNo}, invoice_date = ${invDate} WHERE id = ${sale.id}`;

        const fullSale = await sql`
          SELECT s.*, c.name as company_name, c.gstin as company_gstin, c.hsn_code as company_hsn,
                 c.address as company_address, c.city as company_city, c.state as company_state,
                 c.pincode as company_pincode, c.state_code as company_state_code,
                 c.phone as company_phone, c.email as company_email, c.website as company_website,
                 c.bank_name, c.bank_account, c.bank_ifsc, c.bank_branch,
                 cust.name as cust_name, cust.phone as cust_phone
          FROM sales s
          LEFT JOIN companies c ON s.company_id = c.id
          LEFT JOIN customers cust ON s.customer_id = cust.id
          WHERE s.id = ${sale.id}
        `;
        const items = await sql`
          SELECT si.*, p.name as product_name, p.brand, p.model, p.hsn_sac
          FROM sale_items si
          LEFT JOIN products p ON si.product_id = p.id
          WHERE si.sale_id = ${sale.id}
        `;
        const payments = await sql`
          SELECT sp.*, u.username as cashier_name
          FROM sale_payments sp
          LEFT JOIN users u ON sp.cashier_id = u.id
          WHERE sp.sale_id = ${sale.id}
          ORDER BY sp.payment_date ASC, sp.id ASC
        `;

        return res.status(200).json({
          success: true,
          message: `Tax Invoice #${invNo} raised successfully!`,
          invoice_number: invNo,
          sale: fullSale[0] || sale,
          items: items,
          payments: payments
        });
      }

      // Generate next sequential invoice number
      const compArr = await sql`SELECT * FROM companies WHERE id = ${compId}`;
      const company = compArr[0] || {};
      const compNameStr = (company.name || 'MANASWINI').replace(/[^a-zA-Z]/g, '').toUpperCase();
      const comp4Letter = (compNameStr.slice(0, 4) || 'MANA').padEnd(4, 'X');

      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yy = String(now.getFullYear()).slice(-2);
      const ddmmyy = `${dd}${mm}${yy}`;

      const lastInv = await sql`
        SELECT invoice_number FROM invoices 
        WHERE company_id = ${compId} AND invoice_number IS NOT NULL AND invoice_number != ''
        ORDER BY id DESC LIMIT 1
      `;
      let nextInvSeq = 1;
      if (lastInv.length > 0 && lastInv[0].invoice_number) {
        const match = lastInv[0].invoice_number.match(/(\d+)$/);
        if (match) nextInvSeq = parseInt(match[1], 10) + 1;
      }
      const invNo = `${comp4Letter}${ddmmyy}-${String(nextInvSeq).padStart(3, '0')}`;

      let taxableTotal = parseFloat(sale.taxable_amount || sale.total_amount || 0);
      let taxTotal = parseFloat(sale.tax_amount || 0);
      let grandTotal = parseFloat(sale.grand_total || 0);
      let cgstTotal = parseFloat(sale.cgst || 0);
      let sgstTotal = parseFloat(sale.sgst || 0);
      let igstTotal = parseFloat(sale.igst || 0);

      // Handle Department Subsidy / Subcity Scheme custom grand total override if provided
      const customGrandVal = custom_grand_total || editable_grand_total || custom_taxable_amount || editable_taxable_amount;
      const supplyStr = (sale.supply_type || '').toLowerCase();
      const isSubsidy = supplyStr.includes('sub') || supplyStr.includes('dept') || supplyStr.includes('scheme');

      if (isSubsidy && customGrandVal && !isNaN(parseFloat(customGrandVal)) && parseFloat(customGrandVal) > 0) {
        const newGrand = parseFloat(customGrandVal);
        const oldGrand = grandTotal > 0 ? grandTotal : (taxableTotal + taxTotal);
        const ratio = oldGrand > 0 ? (newGrand / oldGrand) : 1;

        const originalDcGrand = sale.dc_grand_total || sale.grand_total || oldGrand;

        taxableTotal = Math.round((taxableTotal * ratio) * 100) / 100;
        cgstTotal = Math.round((cgstTotal * ratio) * 100) / 100;
        sgstTotal = Math.round((sgstTotal * ratio) * 100) / 100;
        igstTotal = Math.round((igstTotal * ratio) * 100) / 100;
        taxTotal = cgstTotal + sgstTotal + igstTotal;
        grandTotal = newGrand;

        // Update sales table with the overridden amounts as well as storing original dc_grand_total
        await sql`
          UPDATE sales SET
            dc_grand_total = COALESCE(dc_grand_total, ${originalDcGrand}),
            taxable_amount = ${taxableTotal},
            tax_amount = ${taxTotal},
            cgst = ${cgstTotal},
            sgst = ${sgstTotal},
            igst = ${igstTotal},
            grand_total = ${grandTotal}
          WHERE id = ${sale.id}
        `;

        // Update sale_items with scaled rates while preserving original dc_rate, dc_taxable_value, dc_total
        const saleItems = await sql`SELECT * FROM sale_items WHERE sale_id = ${sale.id}`;
        for (const item of saleItems) {
          const itemOldRate = parseFloat(item.rate || 0);
          const itemOldTaxable = parseFloat(item.taxable_value || (itemOldRate * (item.quantity || 1)));
          const itemOldCgst = parseFloat(item.cgst || 0);
          const itemOldSgst = parseFloat(item.sgst || 0);
          const itemOldIgst = parseFloat(item.igst || 0);
          const itemOldTotal = parseFloat(item.total || (itemOldTaxable + itemOldCgst + itemOldSgst + itemOldIgst));

          const newRate = Math.round((itemOldRate * ratio) * 100) / 100;
          const newTaxable = Math.round((itemOldTaxable * ratio) * 100) / 100;
          const newCgst = Math.round((itemOldCgst * ratio) * 100) / 100;
          const newSgst = Math.round((itemOldSgst * ratio) * 100) / 100;
          const newIgst = Math.round((itemOldIgst * ratio) * 100) / 100;
          const newTotal = Math.round((itemOldTotal * ratio) * 100) / 100;

          await sql`
            UPDATE sale_items SET
              dc_rate = COALESCE(dc_rate, ${itemOldRate}),
              dc_taxable_value = COALESCE(dc_taxable_value, ${itemOldTaxable}),
              dc_total = COALESCE(dc_total, ${itemOldTotal}),
              rate = ${newRate},
              taxable_value = ${newTaxable},
              cgst = ${newCgst},
              sgst = ${newSgst},
              igst = ${newIgst},
              total = ${newTotal}
            WHERE id = ${item.id}
          `;
        }
      }

      // Insert into invoices
      await sql`
        INSERT INTO invoices (
          company_id, invoice_number, invoice_date, sale_id, customer_id, taxable_total,
          cgst_total, sgst_total, igst_total, tax_total, grand_total, is_finalized
        ) VALUES (
          ${compId}, ${invNo}, ${invDate}, ${sale.id},
          ${sale.customer_id ? parseInt(sale.customer_id) : null}, ${taxableTotal}, ${cgstTotal}, ${sgstTotal},
          ${igstTotal}, ${taxTotal}, ${grandTotal}, true
        )
      `;

      // Update sales table with invoice_number and invoice_date
      await sql`
        UPDATE sales SET
          invoice_number = ${invNo},
          invoice_date = ${invDate}
        WHERE id = ${sale.id}
      `;

      // Fetch updated sale details and items for printing
      const fullSale = await sql`
        SELECT s.*, c.name as company_name, c.gstin as company_gstin, c.hsn_code as company_hsn,
               c.address as company_address, c.city as company_city, c.state as company_state,
               c.pincode as company_pincode, c.state_code as company_state_code,
               c.phone as company_phone, c.email as company_email, c.website as company_website,
               c.bank_name, c.bank_account, c.bank_ifsc, c.bank_branch,
               cust.name as cust_name, cust.phone as cust_phone
        FROM sales s
        LEFT JOIN companies c ON s.company_id = c.id
        LEFT JOIN customers cust ON s.customer_id = cust.id
        WHERE s.id = ${sale.id}
      `;

      const items = await sql`
        SELECT si.*, p.name as product_name, p.brand, p.model, p.hsn_sac
        FROM sale_items si
        LEFT JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ${sale.id}
      `;

      const payments = await sql`
        SELECT sp.*, u.username as cashier_name
        FROM sale_payments sp
        LEFT JOIN users u ON sp.cashier_id = u.id
        WHERE sp.sale_id = ${sale.id}
        ORDER BY sp.payment_date ASC, sp.id ASC
      `;

      return res.status(200).json({
        success: true,
        message: `Tax Invoice #${invNo} raised successfully!`,
        invoice_number: invNo,
        sale: fullSale[0],
        items: items,
        payments: payments
      });
    }

    // ═══════════════ INVOICES LIST ═══════════════
    else if (action === "invoices-list") {
      await resequenceInvoices(sql, isAll ? null : parseInt(compQuery));

      let rows;
      if (isAll) {
        rows = await sql`
          SELECT i.*, s.paid_amount, s.pending_amount, s.payment_status, s.payment_mode, s.is_custom, s.custom_type, s.party_type,
                 COALESCE(s.customer_name, cust.name, 'Counter Customer') as customer_name,
                 COALESCE(s.cell_phone, cust.phone, '') as customer_phone,
                 c.name as company_name,
                 COALESCE(ret.return_count, 0)::int as return_count,
                 COALESCE(ret.total_refunded, 0)::numeric as total_refunded,
                 COALESCE(item_stat.max_rate, s.grand_total, i.grand_total, 0)::numeric as max_item_rate
          FROM invoices i
          LEFT JOIN sales s ON i.sale_id = s.id
          LEFT JOIN customers cust ON i.customer_id = cust.id
          LEFT JOIN companies c ON i.company_id = c.id
          LEFT JOIN (
            SELECT sale_id, COUNT(id) as return_count, SUM(refund_amount) as total_refunded
            FROM sales_returns GROUP BY sale_id
          ) ret ON ret.sale_id = i.sale_id
          LEFT JOIN (
            SELECT sale_id, MAX(GREATEST(COALESCE(rate, 0), COALESCE(taxable_value, 0), COALESCE(total, 0))) as max_rate
            FROM sale_items GROUP BY sale_id
          ) item_stat ON (item_stat.sale_id = i.sale_id OR item_stat.sale_id = s.id)
          ORDER BY i.created_at DESC
        `;
      } else {
        rows = await sql`
          SELECT i.*, s.paid_amount, s.pending_amount, s.payment_status, s.payment_mode, s.is_custom, s.custom_type, s.party_type,
                 COALESCE(s.customer_name, cust.name, 'Counter Customer') as customer_name,
                 COALESCE(s.cell_phone, cust.phone, '') as customer_phone,
                 c.name as company_name,
                 COALESCE(ret.return_count, 0)::int as return_count,
                 COALESCE(ret.total_refunded, 0)::numeric as total_refunded,
                 COALESCE(item_stat.max_rate, s.grand_total, i.grand_total, 0)::numeric as max_item_rate
          FROM invoices i
          LEFT JOIN sales s ON i.sale_id = s.id
          LEFT JOIN customers cust ON i.customer_id = cust.id
          LEFT JOIN companies c ON i.company_id = c.id
          LEFT JOIN (
            SELECT sale_id, COUNT(id) as return_count, SUM(refund_amount) as total_refunded
            FROM sales_returns GROUP BY sale_id
          ) ret ON ret.sale_id = i.sale_id
          LEFT JOIN (
            SELECT sale_id, MAX(GREATEST(COALESCE(rate, 0), COALESCE(taxable_value, 0), COALESCE(total, 0))) as max_rate
            FROM sale_items GROUP BY sale_id
          ) item_stat ON (item_stat.sale_id = i.sale_id OR item_stat.sale_id = s.id)
          WHERE i.company_id = ${parseInt(compQuery)}
          ORDER BY i.created_at DESC
        `;
      }
      return res.status(200).json({ success: true, invoices: rows });
    }

    // ═══════════════ DELETE INVOICE (SUPERADMIN ONLY) ═══════════════
    else if (action === "delete-invoice") {
      if (user.role !== "superadmin") {
        return res.status(403).json({ error: "Only Superadmin can delete invoices." });
      }
      const invId = parseInt(req.query.id || req.body?.id);
      if (!invId) return res.status(400).json({ error: "Invoice ID required" });

      const invRows = await sql`SELECT * FROM invoices WHERE id = ${invId}`;
      if (invRows.length === 0) return res.status(404).json({ error: "Invoice not found" });

      const invObj = invRows[0];
      const compId = invObj.company_id;
      const saleId = invObj.sale_id;

      // Restore inventory stock for sale items if linked to a sale
      if (saleId) {
        const saleItems = await sql`SELECT product_id, quantity FROM sale_items WHERE sale_id = ${saleId}`;
        for (const item of saleItems) {
          if (item.product_id && !isNaN(parseInt(item.product_id))) {
            await sql`
              UPDATE products SET current_stock = current_stock + ${parseInt(item.quantity || 0)}
              WHERE id = ${parseInt(item.product_id)}
            `;
          }
        }
        await sql`DELETE FROM sale_items WHERE sale_id = ${saleId}`;
        await sql`DELETE FROM sale_payments WHERE sale_id = ${saleId}`;
        await sql`DELETE FROM sales_returns WHERE sale_id = ${saleId}`;
        await sql`DELETE FROM sales WHERE id = ${saleId}`;
      }

      await sql`DELETE FROM invoices WHERE id = ${invId}`;

      // Re-sequence remaining invoices so numbers stay gapless and strictly sequential
      await resequenceInvoices(sql, compId);

      return res.status(200).json({ success: true, message: "Invoice & sale deleted, product stock restored to inventory, and remaining invoice numbers re-sequenced successfully!" });
    }

    // ═══════════════ DELETE SALE / DELIVERY CHALLAN (SUPERADMIN ONLY) ═══════════════
    else if (action === "delete-sale" || action === "delete-dc") {
      if (user.role !== "superadmin") {
        return res.status(403).json({ error: "Only Superadmin can delete Delivery Challans." });
      }
      const saleId = parseInt(req.query.id || req.body?.id);
      if (!saleId) return res.status(400).json({ error: "Sale / Delivery Challan ID required" });

      const saleRows = await sql`SELECT * FROM sales WHERE id = ${saleId}`;
      if (saleRows.length === 0) return res.status(404).json({ error: "Delivery Challan not found" });

      // Restore inventory stock for sale items
      const saleItems = await sql`SELECT product_id, quantity FROM sale_items WHERE sale_id = ${saleId}`;
      for (const item of saleItems) {
        if (item.product_id && !isNaN(parseInt(item.product_id))) {
          await sql`
            UPDATE products SET current_stock = current_stock + ${parseInt(item.quantity || 0)}
            WHERE id = ${parseInt(item.product_id)}
          `;
        }
      }

      await sql`DELETE FROM sale_items WHERE sale_id = ${saleId}`;
      await sql`DELETE FROM sale_payments WHERE sale_id = ${saleId}`;
      await sql`DELETE FROM sales_returns WHERE sale_id = ${saleId}`;
      await sql`DELETE FROM invoices WHERE sale_id = ${saleId}`;
      await sql`DELETE FROM sales WHERE id = ${saleId}`;

      return res.status(200).json({ success: true, message: "Delivery Challan deleted and product stock restored to inventory successfully!" });
    }

    // ═══════════════ PAYMENT RECEIPTS LIST ═══════════════
    else if (action === "receipts-list") {
      await resequenceReceipts(sql, isAll ? null : parseInt(compQuery));

      let rows;
      if (isAll) {
        rows = await sql`
          SELECT sp.*, s.challan_number, s.customer_name, s.cell_phone, s.grand_total as sale_grand_total,
                 s.paid_amount as sale_paid_amount, s.pending_amount as sale_pending_amount,
                 c.name as company_name, u.username as cashier_name, inv.invoice_number,
                 COALESCE(ret.return_count, 0)::int as return_count,
                 COALESCE(ret.total_refunded, 0)::numeric as total_refunded
          FROM sale_payments sp
          LEFT JOIN sales s ON sp.sale_id = s.id
          LEFT JOIN invoices inv ON inv.sale_id = s.id
          LEFT JOIN companies c ON sp.company_id = c.id
          LEFT JOIN users u ON sp.cashier_id = u.id
          LEFT JOIN (
            SELECT sale_id, COUNT(id) as return_count, SUM(refund_amount) as total_refunded
            FROM sales_returns GROUP BY sale_id
          ) ret ON ret.sale_id = sp.sale_id
          ORDER BY sp.payment_date DESC, sp.id DESC
        `;
      } else {
        const cId = parseInt(compQuery);
        rows = await sql`
          SELECT sp.*, s.challan_number, s.customer_name, s.cell_phone, s.grand_total as sale_grand_total,
                 s.paid_amount as sale_paid_amount, s.pending_amount as sale_pending_amount,
                 c.name as company_name, u.username as cashier_name, inv.invoice_number,
                 COALESCE(ret.return_count, 0)::int as return_count,
                 COALESCE(ret.total_refunded, 0)::numeric as total_refunded
          FROM sale_payments sp
          LEFT JOIN sales s ON sp.sale_id = s.id
          LEFT JOIN invoices inv ON inv.sale_id = s.id
          LEFT JOIN companies c ON sp.company_id = c.id
          LEFT JOIN users u ON sp.cashier_id = u.id
          LEFT JOIN (
            SELECT sale_id, COUNT(id) as return_count, SUM(refund_amount) as total_refunded
            FROM sales_returns GROUP BY sale_id
          ) ret ON ret.sale_id = sp.sale_id
          WHERE sp.company_id = ${cId}
          ORDER BY sp.payment_date DESC, sp.id DESC
        `;
      }
      return res.status(200).json({ success: true, receipts: rows });
    }

    // ═══════════════ DELETE PAYMENT RECEIPT (SUPERADMIN ONLY) ═══════════════
    else if (action === "delete-payment" || action === "delete-receipt") {
      if (user.role !== "superadmin") {
        return res.status(403).json({ error: "Only Superadmin can delete payment receipts." });
      }
      const payId = parseInt(req.query.id || req.body?.id);
      if (!payId) return res.status(400).json({ error: "Payment Receipt ID required" });

      const payRows = await sql`SELECT * FROM sale_payments WHERE id = ${payId}`;
      if (payRows.length === 0) return res.status(404).json({ error: "Payment receipt not found" });

      const payObj = payRows[0];
      const saleId = payObj.sale_id;
      const compId = payObj.company_id;

      await sql`DELETE FROM sale_payments WHERE id = ${payId}`;

      // Recalculate sale payment totals
      if (saleId) {
        const sumRes = await sql`SELECT COALESCE(SUM(amount), 0) as total_paid FROM sale_payments WHERE sale_id = ${saleId}`;
        const totalPaid = parseFloat(sumRes[0].total_paid);
        const saleArr = await sql`SELECT grand_total FROM sales WHERE id = ${saleId}`;
        if (saleArr.length > 0) {
          const grandTotal = parseFloat(saleArr[0].grand_total);
          const newPending = Math.max(0, grandTotal - totalPaid);
          let newStatus = 'unpaid';
          if (newPending <= 0.01) newStatus = 'paid';
          else if (totalPaid > 0) newStatus = 'partially_paid';

          await sql`
            UPDATE sales SET
              paid_amount = ${totalPaid},
              pending_amount = ${newPending},
              payment_status = ${newStatus}
            WHERE id = ${saleId}
          `;
        }
      }

      // Re-sequence remaining payment receipts so numbers stay gapless and strictly sequential
      await resequenceReceipts(sql, compId);

      return res.status(200).json({ success: true, message: "Payment receipt deleted, balance updated & receipt numbers re-sequenced successfully!" });
    }

    // ═══════════════ SEARCH SOLD ITEMS FOR RETURNS ═══════════════
    else if (action === "search-sold-items") {
      const { q } = req.query;
      const searchStr = (q || "").trim();
      const cId = isNaN(parseInt(compQuery, 10)) ? null : parseInt(compQuery, 10);

      let rows;
      if (!searchStr) {
        if (isAll || !cId) {
          rows = await sql`
            SELECT si.*, s.challan_number, inv.invoice_number, s.sale_date, s.customer_name, s.cell_phone, s.company_id,
                   COALESCE(p.name, si.description, 'Product Item') as product_name, p.brand, p.model, c.name as company_name,
                   COALESCE(sr.total_returned_qty, 0)::int as returned_qty,
                   CASE WHEN COALESCE(sr.total_returned_qty, 0) >= si.quantity THEN true ELSE false END as is_returned,
                   sr.return_number, sr.return_date
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            LEFT JOIN invoices inv ON inv.sale_id = s.id
            LEFT JOIN products p ON si.product_id = p.id
            LEFT JOIN companies c ON s.company_id = c.id
            LEFT JOIN (
              SELECT sale_id, product_id, serial_number,
                     SUM(quantity_returned)::int as total_returned_qty,
                     MAX(return_number) as return_number,
                     MAX(return_date) as return_date
              FROM sales_returns
              GROUP BY sale_id, product_id, serial_number
            ) sr ON sr.sale_id = si.sale_id
                 AND (
                   (si.serial_number IS NOT NULL AND si.serial_number != '' AND LOWER(TRIM(sr.serial_number)) = LOWER(TRIM(si.serial_number)))
                   OR ((si.serial_number IS NULL OR si.serial_number = '') AND (sr.product_id = si.product_id OR sr.product_id IS NULL))
                 )
            WHERE (s.is_custom IS NOT TRUE OR s.is_custom = false)
            ORDER BY s.created_at DESC
            LIMIT 50
          `;
        } else {
          rows = await sql`
            SELECT si.*, s.challan_number, inv.invoice_number, s.sale_date, s.customer_name, s.cell_phone, s.company_id,
                   COALESCE(p.name, si.description, 'Product Item') as product_name, p.brand, p.model, c.name as company_name,
                   COALESCE(sr.total_returned_qty, 0)::int as returned_qty,
                   CASE WHEN COALESCE(sr.total_returned_qty, 0) >= si.quantity THEN true ELSE false END as is_returned,
                   sr.return_number, sr.return_date
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            LEFT JOIN invoices inv ON inv.sale_id = s.id
            LEFT JOIN products p ON si.product_id = p.id
            LEFT JOIN companies c ON s.company_id = c.id
            LEFT JOIN (
              SELECT sale_id, product_id, serial_number,
                     SUM(quantity_returned)::int as total_returned_qty,
                     MAX(return_number) as return_number,
                     MAX(return_date) as return_date
              FROM sales_returns
              GROUP BY sale_id, product_id, serial_number
            ) sr ON sr.sale_id = si.sale_id
                 AND (
                   (si.serial_number IS NOT NULL AND si.serial_number != '' AND LOWER(TRIM(sr.serial_number)) = LOWER(TRIM(si.serial_number)))
                   OR ((si.serial_number IS NULL OR si.serial_number = '') AND (sr.product_id = si.product_id OR sr.product_id IS NULL))
                 )
            WHERE s.company_id = ${cId} AND (s.is_custom IS NOT TRUE OR s.is_custom = false)
            ORDER BY s.created_at DESC
            LIMIT 50
          `;
        }
      } else {
        const pattern = '%' + searchStr + '%';
        if (isAll || !cId) {
          rows = await sql`
            SELECT si.*, s.challan_number, inv.invoice_number, s.sale_date, s.customer_name, s.cell_phone, s.company_id,
                   COALESCE(p.name, si.description, 'Product Item') as product_name, p.brand, p.model, c.name as company_name,
                   COALESCE(sr.total_returned_qty, 0)::int as returned_qty,
                   CASE WHEN COALESCE(sr.total_returned_qty, 0) >= si.quantity THEN true ELSE false END as is_returned,
                   sr.return_number, sr.return_date
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            LEFT JOIN invoices inv ON inv.sale_id = s.id
            LEFT JOIN products p ON si.product_id = p.id
            LEFT JOIN companies c ON s.company_id = c.id
            LEFT JOIN (
              SELECT sale_id, product_id, serial_number,
                     SUM(quantity_returned)::int as total_returned_qty,
                     MAX(return_number) as return_number,
                     MAX(return_date) as return_date
              FROM sales_returns
              GROUP BY sale_id, product_id, serial_number
            ) sr ON sr.sale_id = si.sale_id
                 AND (
                   (si.serial_number IS NOT NULL AND si.serial_number != '' AND LOWER(TRIM(sr.serial_number)) = LOWER(TRIM(si.serial_number)))
                   OR ((si.serial_number IS NULL OR si.serial_number = '') AND (sr.product_id = si.product_id OR sr.product_id IS NULL))
                 )
            WHERE (s.is_custom IS NOT TRUE OR s.is_custom = false) AND (
              s.challan_number ILIKE ${pattern}
              OR inv.invoice_number ILIKE ${pattern}
              OR s.customer_name ILIKE ${pattern}
              OR s.cell_phone ILIKE ${pattern}
              OR p.name ILIKE ${pattern}
              OR si.description ILIKE ${pattern}
              OR si.serial_number ILIKE ${pattern}
            )
            ORDER BY s.created_at DESC
            LIMIT 50
          `;
        } else {
          rows = await sql`
            SELECT si.*, s.challan_number, inv.invoice_number, s.sale_date, s.customer_name, s.cell_phone, s.company_id,
                   COALESCE(p.name, si.description, 'Product Item') as product_name, p.brand, p.model, c.name as company_name,
                   COALESCE(sr.total_returned_qty, 0)::int as returned_qty,
                   CASE WHEN COALESCE(sr.total_returned_qty, 0) >= si.quantity THEN true ELSE false END as is_returned,
                   sr.return_number, sr.return_date
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            LEFT JOIN invoices inv ON inv.sale_id = s.id
            LEFT JOIN products p ON si.product_id = p.id
            LEFT JOIN companies c ON s.company_id = c.id
            LEFT JOIN (
              SELECT sale_id, product_id, serial_number,
                     SUM(quantity_returned)::int as total_returned_qty,
                     MAX(return_number) as return_number,
                     MAX(return_date) as return_date
              FROM sales_returns
              GROUP BY sale_id, product_id, serial_number
            ) sr ON sr.sale_id = si.sale_id
                 AND (
                   (si.serial_number IS NOT NULL AND si.serial_number != '' AND LOWER(TRIM(sr.serial_number)) = LOWER(TRIM(si.serial_number)))
                   OR ((si.serial_number IS NULL OR si.serial_number = '') AND (sr.product_id = si.product_id OR sr.product_id IS NULL))
                 )
            WHERE s.company_id = ${cId} AND (s.is_custom IS NOT TRUE OR s.is_custom = false)
              AND (
                s.challan_number ILIKE ${pattern}
                OR inv.invoice_number ILIKE ${pattern}
                OR s.customer_name ILIKE ${pattern}
                OR s.cell_phone ILIKE ${pattern}
                OR p.name ILIKE ${pattern}
                OR si.description ILIKE ${pattern}
                OR si.serial_number ILIKE ${pattern}
              )
            ORDER BY s.created_at DESC
            LIMIT 50
          `;
        }
      }
      return res.status(200).json({ success: true, items: rows });
    }

    // ═══════════════ PROCESS SALES RETURN ═══════════════
    else if (action === "process-return") {
      const {
        sale_id, product_id, product_name, serial_number, quantity_returned, rate,
        refund_amount, cash_amount, upi_amount, bank_amount,
        upi_ref, bank_ref, receiving_bank, reason, return_date
      } = req.body;

      let saleId = sale_id ? parseInt(sale_id) : null;
      let productId = product_id ? parseInt(product_id) : null;
      let qtyRet = parseInt(quantity_returned || 1);

      if (!saleId || isNaN(saleId) || !qtyRet || isNaN(qtyRet) || qtyRet <= 0) {
        return res.status(400).json({ error: "Valid Sale ID and Quantity Returned are required" });
      }

      await sql`
        CREATE TABLE IF NOT EXISTS sales_returns (
          id SERIAL PRIMARY KEY,
          return_number VARCHAR(50) NOT NULL,
          company_id INT REFERENCES companies(id) ON DELETE CASCADE,
          sale_id INT REFERENCES sales(id) ON DELETE CASCADE,
          customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
          customer_name VARCHAR(255),
          customer_phone VARCHAR(50),
          product_id INT REFERENCES products(id) ON DELETE CASCADE,
          product_name VARCHAR(255),
          serial_number VARCHAR(100),
          quantity_returned INT NOT NULL DEFAULT 1,
          rate NUMERIC(12,2) DEFAULT 0,
          refund_amount NUMERIC(12,2) DEFAULT 0,
          cash_amount NUMERIC(12,2) DEFAULT 0,
          upi_amount NUMERIC(12,2) DEFAULT 0,
          bank_amount NUMERIC(12,2) DEFAULT 0,
          upi_ref VARCHAR(100),
          bank_ref VARCHAR(100),
          receiving_bank VARCHAR(100),
          reason TEXT,
          return_date TIMESTAMP DEFAULT NOW(),
          created_by INT REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `;

      const sRows = await sql`SELECT * FROM sales WHERE id = ${saleId}`;
      if (sRows.length === 0) return res.status(404).json({ error: "Sale record not found" });
      const saleObj = sRows[0];

      // Duplicate return check to prevent returning an already returned product or serial number
      if (serial_number && serial_number.trim()) {
        const existingRet = await sql`
          SELECT return_number FROM sales_returns 
          WHERE sale_id = ${saleId} AND LOWER(TRIM(serial_number)) = LOWER(TRIM(${serial_number.trim()}))
          LIMIT 1
        `;
        if (existingRet.length > 0) {
          return res.status(400).json({ error: `This product item with Serial No. '${serial_number.trim()}' has already been returned (Return Voucher #${existingRet[0].return_number}) and cannot be re-initiated for return.` });
        }
      } else {
        const targetPId = productId || null;
        if (targetPId) {
          const sumRet = await sql`
            SELECT COALESCE(SUM(quantity_returned), 0)::int as total_returned 
            FROM sales_returns 
            WHERE sale_id = ${saleId} AND product_id = ${targetPId}
          `;
          const itemQtyRes = await sql`
            SELECT quantity FROM sale_items 
            WHERE sale_id = ${saleId} AND product_id = ${targetPId} 
            LIMIT 1
          `;
          const soldQty = itemQtyRes.length > 0 ? itemQtyRes[0].quantity : 1;
          if ((sumRet[0].total_returned + qtyRet) > soldQty) {
            return res.status(400).json({ error: `Cannot process return. Already returned ${sumRet[0].total_returned} out of ${soldQty} sold units for this product.` });
          }
        }
      }

      let validProductId = null;
      let prodObj = {};

      if (productId && !isNaN(productId)) {
        const pRows = await sql`SELECT * FROM products WHERE id = ${productId}`;
        if (pRows.length > 0) {
          validProductId = pRows[0].id;
          prodObj = pRows[0];
        }
      }

      // Auto-resolve product_id if null or not found in products table
      if (!validProductId) {
        let matchingItems;
        if (serial_number && serial_number.trim()) {
          matchingItems = await sql`SELECT product_id FROM sale_items WHERE sale_id = ${saleObj.id} AND serial_number = ${serial_number.trim()} AND product_id IS NOT NULL LIMIT 1`;
        }
        if (!matchingItems || matchingItems.length === 0 || !matchingItems[0].product_id) {
          matchingItems = await sql`SELECT product_id FROM sale_items WHERE sale_id = ${saleObj.id} AND product_id IS NOT NULL LIMIT 1`;
        }
        if (matchingItems && matchingItems.length > 0 && matchingItems[0].product_id) {
          const candidateId = parseInt(matchingItems[0].product_id);
          const pCheck = await sql`SELECT * FROM products WHERE id = ${candidateId}`;
          if (pCheck.length > 0) {
            validProductId = pCheck[0].id;
            prodObj = pCheck[0];
          }
        }
      }

      const countRes = await sql`SELECT COUNT(*)::int as count FROM sales_returns WHERE company_id = ${saleObj.company_id}`;
      const nextSeq = (countRes[0]?.count || 0) + 1;
      const returnNo = `RET-${String(nextSeq).padStart(4, '0')}`;

      const refAmt = parseFloat(refund_amount || 0);
      const cashAmt = parseFloat(cash_amount || 0);
      const upiAmt = parseFloat(upi_amount || 0);
      const bankAmt = parseFloat(bank_amount || 0);

      const newRet = await sql`
        INSERT INTO sales_returns (
          return_number, company_id, sale_id, customer_id, customer_name, customer_phone,
          product_id, product_name, serial_number, quantity_returned, rate,
          refund_amount, cash_amount, upi_amount, bank_amount, upi_ref, bank_ref,
          receiving_bank, reason, return_date, created_by
        ) VALUES (
          ${returnNo}, ${saleObj.company_id}, ${saleObj.id}, ${saleObj.customer_id},
          ${saleObj.customer_name || 'Counter Customer'}, ${saleObj.cell_phone || null},
          ${validProductId || null}, ${prodObj.name || product_name || 'Returned Product'}, ${serial_number || null},
          ${qtyRet}, ${parseFloat(rate || 0)}, ${refAmt}, ${cashAmt}, ${upiAmt}, ${bankAmt},
          ${upi_ref || null}, ${bank_ref || null}, ${receiving_bank || null}, ${reason || null},
          ${return_date || 'NOW()'}, ${user.id}
        )
        RETURNING *
      `;

      // INCREMENT INVENTORY STOCK FOR THE RETURNED PRODUCT IF PRODUCT ID IS VALID
      if (validProductId) {
        await sql`
          UPDATE products SET current_stock = current_stock + ${qtyRet}
          WHERE id = ${validProductId}
        `;
      }

      const compRows = await sql`SELECT * FROM companies WHERE id = ${saleObj.company_id}`;
      const companyObj = compRows[0] || {};

      return res.status(200).json({
        success: true,
        message: `Sales return ${returnNo} processed successfully! Stock updated.`,
        return_data: newRet[0],
        sale_data: saleObj,
        company_data: companyObj,
        product_data: prodObj
      });
    }

    // ═══════════════ LIST SALES RETURNS ═══════════════
    else if (action === "list-returns") {
      let rows;
      if (isAll) {
        rows = await sql`
          SELECT r.*, c.name as company_name, s.challan_number
          FROM sales_returns r
          LEFT JOIN sales s ON r.sale_id = s.id
          LEFT JOIN companies c ON r.company_id = c.id
          ORDER BY r.created_at DESC
        `;
      } else {
        rows = await sql`
          SELECT r.*, c.name as company_name, s.challan_number
          FROM sales_returns r
          LEFT JOIN sales s ON r.sale_id = s.id
          LEFT JOIN companies c ON r.company_id = c.id
          WHERE r.company_id = ${parseInt(compQuery)}
          ORDER BY r.created_at DESC
        `;
      }
      return res.status(200).json({ success: true, returns: rows });
    }

    // ═══════════════ GET RETURN DETAILS FOR PRINTING ═══════════════
    else if (action === "get-return-details") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "Return ID required" });

      const retRows = await sql`SELECT * FROM sales_returns WHERE id = ${parseInt(id)}`;
      if (retRows.length === 0) return res.status(404).json({ error: "Return record not found" });

      const retObj = retRows[0];
      const sRows = await sql`SELECT * FROM sales WHERE id = ${retObj.sale_id}`;
      const cRows = await sql`SELECT * FROM companies WHERE id = ${retObj.company_id}`;
      const pRows = await sql`SELECT * FROM products WHERE id = ${retObj.product_id}`;

      return res.status(200).json({
        success: true,
        return_data: retObj,
        sale_data: sRows[0] || {},
        company_data: cRows[0] || {},
        product_data: pRows[0] || {}
      });
    }

    // ═══════════════ CREATE CUSTOM INVOICE ═══════════════
    else if (action === "create-custom-invoice") {
      const {
        company_id, custom_type, invoice_date,
        receiver_name, receiver_address, receiver_state, receiver_state_code, receiver_gstin,
        consignee_name, consignee_address, consignee_state, consignee_state_code, consignee_gstin,
        items, grand_total, custom_meta
      } = req.body;

      const compId = company_id ? parseInt(company_id) : (user.company_id || 1);
      const invDate = invoice_date || new Date().toISOString().split('T')[0];

      const countRes = await sql`SELECT COUNT(*)::int as count FROM invoices WHERE company_id = ${compId}`;
      const nextSeq = (countRes[0]?.count || 0) + 1;
      
      const compRows = await sql`SELECT * FROM companies WHERE id = ${compId}`;
      const company = compRows[0] || {};
      const compNameStr = (company.name || 'MANASWINI').replace(/[^a-zA-Z]/g, '').toUpperCase();
      const comp4 = (compNameStr.slice(0, 4) || 'MANA').padEnd(4, 'X');
      const invoice_number = `26-27/${String(nextSeq).padStart(2, '0')}`;

      try {
        await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100);`;
      } catch (e) {}

      const saleResult = await sql`
        INSERT INTO sales (
          company_id, invoice_number, customer_name, customer_gstin, sale_date, total_amount, grand_total, paid_amount,
          payment_status, created_by, is_custom, custom_type,
          receiver_address, receiver_state, receiver_state_code,
          consignee_name, consignee_address, consignee_state, consignee_state_code, consignee_gstin,
          custom_meta_json
        ) VALUES (
          ${compId}, ${invoice_number}, ${receiver_name || 'Counter Customer'}, ${receiver_gstin || null}, ${invDate}, ${parseFloat(grand_total || 0)}, ${parseFloat(grand_total || 0)}, ${parseFloat(grand_total || 0)},
          'paid', ${user.id}, true, ${custom_type || 'misc'},
          ${receiver_address || null}, ${receiver_state || null}, ${receiver_state_code || null},
          ${consignee_name || null}, ${consignee_address || null}, ${consignee_state || null}, ${consignee_state_code || null}, ${consignee_gstin || null},
          ${custom_meta ? JSON.stringify(custom_meta) : null}
        )
        RETURNING *
      `;
      const sale = saleResult[0];

      await sql`
        INSERT INTO invoices (
          sale_id, company_id, invoice_number, invoice_date, grand_total, status, created_by
        ) VALUES (
          ${sale.id}, ${compId}, ${invoice_number}, ${invDate}, ${parseFloat(grand_total || 0)}, 'generated', ${user.id}
        )
      `;

      const insertedItems = [];
      if (Array.isArray(items)) {
        for (const item of items) {
          const resItem = await sql`
            INSERT INTO sale_items (
              sale_id, product_name, hsn_code, quantity, unit, rate, taxable_value, gst_rate, total_amount
            ) VALUES (
              ${sale.id}, ${item.description || item.product_name || ''}, ${item.hsn_sac || item.hsn_code || null}, ${parseFloat(item.quantity || 1)}, ${item.unit || 'Nos'}, ${parseFloat(item.rate || 0)}, ${parseFloat(item.taxable_value || item.total_value || 0)}, ${parseFloat(item.gst_rate || 0)}, ${parseFloat(item.total || item.total_value || 0)}
            )
            RETURNING *
          `;
          insertedItems.push(resItem[0]);
        }
      }

      return res.status(200).json({
        success: true,
        message: "Custom invoice created successfully!",
        sale_id: sale.id,
        invoice_number: invoice_number,
        sale: sale,
        items: insertedItems
      });
    }

    else {
      return res.status(404).json({ error: `Action '${action}' not recognized` });
    }

  } catch (error) {
    console.error(`api/sales error [${action}]:`, error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};
