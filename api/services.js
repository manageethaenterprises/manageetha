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
  const action = req.query.action || req.body?.action || "job-list";

  try {
    // Non-superadmin users always scoped to their own company
    const compQuery = user.role === "superadmin" ? (req.query.company_id || "all") : user.company_id;
    const isAll = user.role === "superadmin" && (!compQuery || compQuery === "all" || isNaN(parseInt(compQuery)));

    // ═══════════════ LOOKUP WARRANTY & SALE DETAILS ═══════════════
    if (action === "lookup-warranty") {
      const query = (req.query.query || req.body?.query || "").trim();
      if (!query) return res.status(400).json({ error: "Please enter or scan an Invoice No, DC No, Serial No, or Barcode" });

      const cleanQ = query.toLowerCase();

      // Search sales by challan_number, invoice_number, or items' serial_number
      let saleRows = await sql`
        SELECT s.*, c.name as customer_name_ref, c.phone as customer_phone_ref, comp.name as company_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN companies comp ON s.company_id = comp.id
        WHERE LOWER(TRIM(COALESCE(s.challan_number, ''))) = ${cleanQ}
           OR LOWER(TRIM(COALESCE(s.invoice_number, ''))) = ${cleanQ}
           OR CAST(s.id AS TEXT) = ${cleanQ}
        ORDER BY s.created_at DESC
        LIMIT 1
      `;

      let matchedItem = null;
      let matchedSale = saleRows[0] || null;

      if (!matchedSale) {
        // Search by sale_items serial_number or barcode
        const itemRows = await sql`
          SELECT si.*, s.id as sale_id_ref, s.challan_number, s.invoice_number, s.sale_date, s.created_at, s.customer_id, s.customer_name, s.cell_phone, s.village, s.mandal,
                 p.name as product_name, p.serial_no as prod_serial_no, p.barcode as prod_barcode,
                 c.name as customer_name_ref, c.phone as customer_phone_ref, comp.name as company_name
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          LEFT JOIN products p ON si.product_id = p.id
          LEFT JOIN customers c ON s.customer_id = c.id
          LEFT JOIN companies comp ON s.company_id = comp.id
          WHERE LOWER(TRIM(COALESCE(si.serial_number, ''))) = ${cleanQ}
             OR LOWER(TRIM(COALESCE(p.serial_no, ''))) = ${cleanQ}
             OR LOWER(TRIM(COALESCE(p.barcode, ''))) = ${cleanQ}
             OR LOWER(TRIM(COALESCE(s.challan_number, ''))) LIKE ${'%' + cleanQ + '%'}
          ORDER BY s.created_at DESC
          LIMIT 1
        `;
        if (itemRows.length > 0) {
          matchedSale = itemRows[0];
          matchedItem = itemRows[0];
        }
      }

      if (!matchedSale) {
        // Fallback: search products table directly by serial_no or barcode
        const prodRows = await sql`
          SELECT p.*, comp.name as company_name
          FROM products p
          LEFT JOIN companies comp ON p.company_id = comp.id
          WHERE LOWER(TRIM(COALESCE(p.serial_no, ''))) = ${cleanQ}
             OR LOWER(TRIM(COALESCE(p.barcode, ''))) = ${cleanQ}
          LIMIT 1
        `;
        if (prodRows.length > 0) {
          const prod = prodRows[0];
          return res.status(200).json({
            success: true,
            found: true,
            source: "product_master",
            warranty_eligible: false,
            warranty_status: "NO_SALE_RECORD",
            warranty_message: `⚠️ Product "${prod.name}" found in inventory (Serial: ${prod.serial_no || '—'}), but no sales invoice/DC is linked. Service will be billed as Paid Repair.`,
            recommended_service_type: "paid",
            details: {
              product_id: prod.id,
              product_name: prod.name,
              serial_number: prod.serial_no || query,
              purchase_date: null,
              days_elapsed: null,
              customer_name: "",
              customer_phone: ""
            }
          });
        }

        return res.status(200).json({
          success: true,
          found: false,
          warranty_eligible: false,
          warranty_status: "NOT_FOUND",
          warranty_message: `ℹ️ No sales record or product found for barcode/ref "${query}". You can proceed to book a Paid Service Job manually.`,
          recommended_service_type: "paid",
          details: { serial_number: query }
        });
      }

      // Calculate Warranty Eligibility: Use stored warranty_months (or warranty_term from sale, default 12 months)
      const warrantyTerm = matchedSale.warranty_term || '1_year';
      let warrantyMonths = matchedSale.warranty_months !== undefined && matchedSale.warranty_months !== null
        ? parseInt(matchedSale.warranty_months, 10)
        : (warrantyTerm === '1_month' ? 1 :
           warrantyTerm === '3_months' ? 3 :
           warrantyTerm === '6_months' ? 6 :
           warrantyTerm === '2_years' ? 24 :
           warrantyTerm === '3_years' ? 36 :
           warrantyTerm === 'no_warranty' ? 0 : 12);

      const purchaseDateStr = matchedSale.sale_date || matchedSale.created_at;
      const purchaseDate = new Date(purchaseDateStr);
      const now = new Date();

      // Calculate exact Warranty Expiry Date
      const warrantyExpiryDate = new Date(purchaseDate);
      warrantyExpiryDate.setMonth(warrantyExpiryDate.getMonth() + warrantyMonths);

      const isEligible = warrantyMonths > 0 && now <= warrantyExpiryDate;

      const diffTime = Math.max(0, now - purchaseDate);
      const daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      const formattedPurchaseDate = purchaseDate.toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' });
      const formattedExpiryDate = warrantyExpiryDate.toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' });

      const warrantyLabelMap = {
        1: "1 Month Warranty",
        3: "3 Months Warranty",
        6: "6 Months Warranty",
        12: "1 Year Warranty (12 Months)",
        24: "2 Years Warranty (24 Months)",
        36: "3 Years Warranty (36 Months)",
        0: "No Warranty (0 Months)"
      };
      const warrantyTermLabel = warrantyLabelMap[warrantyMonths] || `${warrantyMonths} Months Warranty`;

      const itemsInSale = await sql`
        SELECT si.*, p.name as product_name
        FROM sale_items si
        LEFT JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ${matchedSale.sale_id_ref || matchedSale.id}
      `;

      return res.status(200).json({
        success: true,
        found: true,
        source: "sales_record",
        warranty_eligible: isEligible,
        warranty_status: isEligible ? "ELIGIBLE_WARRANTY" : (warrantyMonths === 0 ? "NO_WARRANTY" : "EXPIRED_WARRANTY"),
        warranty_message: isEligible
          ? `✅ ELIGIBLE FOR FREE WARRANTY SERVICE (${warrantyTermLabel} — Purchased on ${formattedPurchaseDate}, Valid until ${formattedExpiryDate}, ${daysElapsed} days elapsed)`
          : (warrantyMonths === 0
              ? `🚫 NO WARRANTY COVERAGE (Purchased on ${formattedPurchaseDate} under No Warranty terms)`
              : `⚠️ WARRANTY EXPIRED (${warrantyTermLabel} — Purchased on ${formattedPurchaseDate}, Expired on ${formattedExpiryDate}, ${daysElapsed} days elapsed)`
            ),
        recommended_service_type: isEligible ? "warranty" : "paid",
        details: {
          sale_id: matchedSale.sale_id_ref || matchedSale.id,
          challan_number: matchedSale.challan_number,
          invoice_number: matchedSale.invoice_number,
          customer_id: matchedSale.customer_id,
          customer_name: matchedSale.customer_name || matchedSale.customer_name_ref || "Counter Customer",
          customer_phone: matchedSale.cell_phone || matchedSale.customer_phone_ref || "",
          village: matchedSale.village || "",
          mandal: matchedSale.mandal || "",
          product_id: matchedItem?.product_id || itemsInSale[0]?.product_id || null,
          product_name: matchedItem?.product_name || itemsInSale[0]?.product_name || "Purchased Equipment",
          serial_number: matchedItem?.serial_number || matchedSale.serial_number || itemsInSale[0]?.serial_number || query,
          purchase_date: formattedPurchaseDate,
          warranty_term: warrantyTerm,
          warranty_months: warrantyMonths,
          warranty_term_label: warrantyTermLabel,
          warranty_expiry_date: formattedExpiryDate,
          days_elapsed: daysElapsed,
          items: itemsInSale
        }
      });
    }

    // ═══════════════ SERVICE JOBS LIST ═══════════════
    else if (action === "job-list") {
      const typeFilter = req.query.type || req.query.tab;
      let rows;

      if (isAll) {
        rows = await sql`
          SELECT sj.*, cust.name as customer_name_ref, m.name as mechanic_name, c.name as company_name, p.name as product_name
          FROM service_jobs sj
          LEFT JOIN customers cust ON sj.customer_id = cust.id
          LEFT JOIN mechanics m ON sj.mechanic_id = m.id
          LEFT JOIN companies c ON sj.company_id = c.id
          LEFT JOIN products p ON sj.product_id = p.id
          ORDER BY sj.created_at DESC
        `;
      } else {
        rows = await sql`
          SELECT sj.*, cust.name as customer_name_ref, m.name as mechanic_name, c.name as company_name, p.name as product_name
          FROM service_jobs sj
          LEFT JOIN customers cust ON sj.customer_id = cust.id
          LEFT JOIN mechanics m ON sj.mechanic_id = m.id
          LEFT JOIN companies c ON sj.company_id = c.id
          LEFT JOIN products p ON sj.product_id = p.id
          WHERE sj.company_id = ${parseInt(compQuery)}
          ORDER BY sj.created_at DESC
        `;
      }

      if (typeFilter === "warranty") {
        rows = rows.filter(j => j.service_type === "warranty" || j.warranty_eligible);
      } else if (typeFilter === "paid") {
        rows = rows.filter(j => j.service_type === "paid" && !j.warranty_eligible);
      } else if (typeFilter === "replacement") {
        rows = rows.filter(j => j.service_type === "replacement" || (j.status && j.status.includes("replace")));
      } else if (typeFilter === "today") {
        const todayStr = new Date().toISOString().slice(0, 10);
        rows = rows.filter(j => j.created_at && new Date(j.created_at).toISOString().slice(0, 10) === todayStr);
      }

      return res.status(200).json({ success: true, jobs: rows });
    }

    // ═══════════════ CREATE SERVICE JOB (WARRANTY OR PAID) ═══════════════
    else if (action === "job-create") {
      const {
        company_id, customer_id, customer_name, customer_phone, product_id, sale_id, serial_number, service_type,
        warranty_eligible, complaint, mechanic_id, labor_charge, parts_cost, barcode_ref
      } = req.body;

      const compId = user.role === "superadmin" ? (company_id ? parseInt(company_id) : null) : user.company_id;
      if (!compId || !complaint) return res.status(400).json({ error: "Company and Complaint description required" });

      const jobNum = "JOB-" + Date.now().toString().slice(-6);
      const isWarranty = service_type === 'warranty' || warranty_eligible === true;
      const lCharge = parseFloat(labor_charge) || 0;
      const pCost = parseFloat(parts_cost) || 0;
      const grandTotal = lCharge + pCost;

      let custId = customer_id ? parseInt(customer_id) : null;
      if (!custId && customer_name && customer_name.trim()) {
        try {
          const cCheck = await sql`SELECT id FROM customers WHERE company_id = ${compId} AND LOWER(name) = LOWER(${customer_name.trim()}) LIMIT 1`;
          if (cCheck.length > 0) custId = cCheck[0].id;
        } catch (e) {}
      }

      const newJob = await sql`
        INSERT INTO service_jobs (
          company_id, job_number, customer_id, product_id, sale_id, serial_number, service_type,
          warranty_eligible, complaint, mechanic_id, labor_charge, total_parts_cost, grand_total,
          paid_amount, pending_amount, payment_status, status, barcode_ref
        ) VALUES (
          ${compId}, ${jobNum}, ${custId},
          ${product_id ? parseInt(product_id) : null}, ${sale_id ? parseInt(sale_id) : null}, ${serial_number || null},
          ${service_type || (isWarranty ? 'warranty' : 'paid')}, ${isWarranty}, ${complaint},
          ${mechanic_id ? parseInt(mechanic_id) : null}, ${lCharge}, ${pCost}, ${grandTotal},
          0, ${grandTotal}, 'unpaid', 'open', ${barcode_ref || serial_number || null}
        )
        RETURNING *
      `;

      return res.status(200).json({ success: true, job: newJob[0], message: `Service Job ${jobNum} created successfully!` });
    }

    // ═══════════════ UPDATE JOB STATUS / DIAGNOSIS ═══════════════
    else if (action === "job-update-status") {
      const { id, status, diagnosis, technician_remarks, labor_charge } = req.body;
      const jobId = parseInt(id);
      if (!jobId) return res.status(400).json({ error: "Job ID required" });

      const existing = await sql`SELECT * FROM service_jobs WHERE id = ${jobId}`;
      if (existing.length === 0) return res.status(404).json({ error: "Job not found" });

      const currentJob = existing[0];
      const newStatus = status || currentJob.status;
      const newLabor = labor_charge !== undefined && labor_charge !== "" ? parseFloat(labor_charge) : parseFloat(currentJob.labor_charge || 0);
      const newGrand = newLabor + parseFloat(currentJob.total_parts_cost || 0) + parseFloat(currentJob.gst_amount || 0);
      const paidAmt = parseFloat(currentJob.paid_amount || 0);
      const newPending = Math.max(0, newGrand - paidAmt);
      const isClosed = newStatus === 'delivered' || newStatus === 'repaired' || newStatus === 'closed';

      let payStatus = currentJob.payment_status || 'unpaid';
      if (newPending <= 0.01 && newGrand > 0) payStatus = 'paid';
      else if (paidAmt > 0) payStatus = 'partially_paid';

      const updated = await sql`
        UPDATE service_jobs SET
          status = ${newStatus},
          diagnosis = COALESCE(${diagnosis || null}, diagnosis),
          technician_remarks = COALESCE(${technician_remarks || null}, technician_remarks),
          labor_charge = ${newLabor},
          grand_total = ${newGrand},
          pending_amount = ${newPending},
          payment_status = ${payStatus},
          closed_at = ${isClosed ? new Date() : currentJob.closed_at}
        WHERE id = ${jobId}
        RETURNING *
      `;

      return res.status(200).json({ success: true, job: updated[0], message: `Job status updated to '${newStatus}'` });
    }

    // ═══════════════ ADD SPARE PART TO SERVICE JOB ═══════════════
    else if (action === "add-spare-part") {
      const { job_id, product_id, part_name, quantity, unit_price, gst_rate, hsn, from_inventory } = req.body;
      const jId = parseInt(job_id);
      if (!jId) return res.status(400).json({ error: "Job ID required" });

      const qty = parseInt(quantity || 1, 10);
      const price = parseFloat(unit_price || 0);
      const gstRate = parseFloat(gst_rate || 0);

      const baseTotal = qty * price;
      const gstAmount = (baseTotal * gstRate) / 100;
      const cgst = gstAmount / 2;
      const sgst = gstAmount / 2;
      const totalWithGst = baseTotal + gstAmount;

      const pId = product_id ? parseInt(product_id) : null;
      let pName = part_name || "Spare Part";

      if (pId) {
        const pRows = await sql`SELECT name, current_stock FROM products WHERE id = ${pId}`;
        if (pRows.length > 0) {
          pName = pRows[0].name;
          if (from_inventory) {
            await sql`UPDATE products SET current_stock = GREATEST(0, current_stock - ${qty}) WHERE id = ${pId}`;
          }
        }
      }

      await sql`
        INSERT INTO service_parts (
          job_id, product_id, part_name, quantity, unit_price, hsn, gst_rate, cgst, sgst, igst, total, from_inventory
        ) VALUES (
          ${jId}, ${pId}, ${pName}, ${qty}, ${price}, ${hsn || null}, ${gstRate}, ${cgst}, ${sgst}, 0, ${totalWithGst}, ${from_inventory ? true : false}
        )
      `;

      // Recalculate job total parts cost, gst amount & grand total
      const partsSumRows = await sql`
        SELECT 
          COALESCE(SUM(quantity * unit_price), 0) as total_parts_base,
          COALESCE(SUM(COALESCE(cgst, 0) + COALESCE(sgst, 0) + COALESCE(igst, 0)), 0) as total_parts_gst,
          COALESCE(SUM(total), 0) as total_parts_grand
        FROM service_parts WHERE job_id = ${jId}
      `;
      const partsBase = parseFloat(partsSumRows[0].total_parts_base || 0);
      const partsGst = parseFloat(partsSumRows[0].total_parts_gst || 0);
      const partsGrand = parseFloat(partsSumRows[0].total_parts_grand || 0);

      const jobRows = await sql`SELECT labor_charge, paid_amount FROM service_jobs WHERE id = ${jId}`;
      const lCharge = parseFloat(jobRows[0]?.labor_charge || 0);
      const paidAmt = parseFloat(jobRows[0]?.paid_amount || 0);

      const grandTotal = lCharge + partsGrand;
      const newPending = Math.max(0, grandTotal - paidAmt);
      let payStatus = 'unpaid';
      if (newPending <= 0.01 && grandTotal > 0) payStatus = 'paid';
      else if (paidAmt > 0) payStatus = 'partially_paid';

      await sql`
        UPDATE service_jobs SET
          total_parts_cost = ${partsBase},
          gst_amount = ${partsGst},
          grand_total = ${grandTotal},
          pending_amount = ${newPending},
          payment_status = ${payStatus}
        WHERE id = ${jId}
      `;

      return res.status(200).json({ success: true, message: `Spare part '${pName}' added to job!` });
    }

    // ═══════════════ ADD SERVICE PAYMENT ═══════════════
    else if (action === "add-service-payment") {
      const {
        job_id, payment_date, payment_mode, bank_sub_type, transaction_ref,
        cheque_dd_no, cheque_dd_date, receiving_bank, bank_account_id, amount, notes
      } = req.body;

      const jId = parseInt(job_id);
      const payAmount = parseFloat(amount || 0);
      if (!jId || payAmount <= 0) return res.status(400).json({ error: "Job ID and valid payment amount required" });

      const jobRows = await sql`SELECT * FROM service_jobs WHERE id = ${jId}`;
      if (jobRows.length === 0) return res.status(404).json({ error: "Service job not found" });

      const job = jobRows[0];
      const compId = job.company_id;

      // Generate Receipt Number
      const lastRcpt = await sql`
        SELECT receipt_number FROM service_payments 
        WHERE company_id = ${compId} AND receipt_number IS NOT NULL AND receipt_number != ''
        ORDER BY id DESC LIMIT 1
      `;
      let nextSeq = 1;
      if (lastRcpt.length > 0 && lastRcpt[0].receipt_number) {
        const match = lastRcpt[0].receipt_number.match(/(\d+)$/);
        if (match) nextSeq = parseInt(match[1], 10) + 1;
      }
      const newRcptNo = `RCP-SVC-${String(nextSeq).padStart(3, '0')}`;

      const newPay = await sql`
        INSERT INTO service_payments (
          company_id, job_id, payment_date, payment_mode, bank_sub_type, transaction_ref,
          cheque_dd_no, cheque_dd_date, receiving_bank, bank_account_id, amount, cashier_id, notes, receipt_number
        ) VALUES (
          ${compId}, ${jId}, ${payment_date || 'NOW()'}, ${payment_mode || 'cash'}, ${bank_sub_type || null}, ${transaction_ref || null},
          ${cheque_dd_no || null}, ${cheque_dd_date || null}, ${receiving_bank || null}, ${bank_account_id ? parseInt(bank_account_id) : null},
          ${payAmount}, ${user.id}, ${notes || 'Service Payment Collected'}, ${newRcptNo}
        )
        RETURNING *
      `;

      // Recalculate total paid
      const sumRes = await sql`SELECT COALESCE(SUM(amount), 0) as total_paid FROM service_payments WHERE job_id = ${jId}`;
      const totalPaid = parseFloat(sumRes[0].total_paid || 0);
      const grandTotal = parseFloat(job.grand_total || 0);
      const newPending = Math.max(0, grandTotal - totalPaid);

      let newPayStatus = 'unpaid';
      if (newPending <= 0.01 && grandTotal > 0) newPayStatus = 'paid';
      else if (totalPaid > 0) newPayStatus = 'partially_paid';

      await sql`
        UPDATE service_jobs SET
          paid_amount = ${totalPaid},
          pending_amount = ${newPending},
          payment_status = ${newPayStatus}
        WHERE id = ${jId}
      `;

      return res.status(200).json({
        success: true,
        payment: newPay[0],
        total_paid: totalPaid,
        pending_amount: newPending,
        payment_status: newPayStatus,
        message: `Payment of ₹${payAmount.toFixed(2)} recorded. Receipt #${newRcptNo}`
      });
    }

    // ═══════════════ SERVICE PAYMENTS / RECEIPTS LIST ═══════════════
    else if (action === "service-payments-list") {
      let rows;
      if (isAll) {
        rows = await sql`
          SELECT sp.*, sj.job_number, sj.service_type, sj.serial_number, cust.name as customer_name, cust.phone as customer_phone, c.name as company_name
          FROM service_payments sp
          LEFT JOIN service_jobs sj ON sp.job_id = sj.id
          LEFT JOIN customers cust ON sj.customer_id = cust.id
          LEFT JOIN companies c ON sp.company_id = c.id
          ORDER BY sp.created_at DESC
        `;
      } else {
        const cId = parseInt(compQuery) || user.company_id;
        rows = await sql`
          SELECT sp.*, sj.job_number, sj.service_type, sj.serial_number, cust.name as customer_name, cust.phone as customer_phone, c.name as company_name
          FROM service_payments sp
          LEFT JOIN service_jobs sj ON sp.job_id = sj.id
          LEFT JOIN customers cust ON sj.customer_id = cust.id
          LEFT JOIN companies c ON sp.company_id = c.id
          WHERE sp.company_id = ${cId}
          ORDER BY sp.created_at DESC
        `;
      }
      return res.status(200).json({ success: true, payments: rows });
    }

    // ═══════════════ JOB DETAILS (FULL VIEW) ═══════════════
    else if (action === "job-details") {
      const jobId = parseInt(req.query.id);
      if (!jobId) return res.status(400).json({ error: "Job ID required" });

      const jobRows = await sql`
        SELECT sj.*, cust.name as customer_name_ref, cust.phone as customer_phone_ref, m.name as mechanic_name, m.phone as mechanic_phone, c.name as company_name, p.name as product_name
        FROM service_jobs sj
        LEFT JOIN customers cust ON sj.customer_id = cust.id
        LEFT JOIN mechanics m ON sj.mechanic_id = m.id
        LEFT JOIN companies c ON sj.company_id = c.id
        LEFT JOIN products p ON sj.product_id = p.id
        WHERE sj.id = ${jobId}
      `;
      if (jobRows.length === 0) return res.status(404).json({ error: "Job not found" });

      const parts = await sql`SELECT * FROM service_parts WHERE job_id = ${jobId} ORDER BY id ASC`;
      const payments = await sql`SELECT * FROM service_payments WHERE job_id = ${jobId} ORDER BY created_at DESC`;

      return res.status(200).json({ success: true, job: jobRows[0], parts: parts, payments: payments });
    }

    // ═══════════════ MECHANICS MASTER ═══════════════
    else if (action === "mechanics-list") {
      let rows;
      if (isAll) {
        rows = await sql`SELECT * FROM mechanics WHERE is_active = true ORDER BY id ASC`;
      } else {
        const cId = parseInt(compQuery) || user.company_id;
        rows = await sql`SELECT * FROM mechanics WHERE (company_id = ${cId} OR company_id IS NULL) AND is_active = true ORDER BY id ASC`;
      }
      return res.status(200).json({ success: true, mechanics: rows });
    }

    else if (action === "mechanic-create") {
      const { company_id, name, phone, role, specialization } = req.body;
      const compId = user.role === "superadmin" ? (company_id ? parseInt(company_id) : null) : user.company_id;
      if (!compId || !name) return res.status(400).json({ error: "Company and Mechanic Name required" });

      const newMech = await sql`
        INSERT INTO mechanics (company_id, name, phone, role, specialization)
        VALUES (${compId}, ${name}, ${phone || null}, ${role || 'Mechanic'}, ${specialization || null})
        RETURNING *
      `;

      return res.status(200).json({ success: true, mechanic: newMech[0], message: "Mechanic added" });
    }

    // ═══════════════ DELETE SERVICE JOB (SUPERADMIN ONLY) ═══════════════
    else if (action === "job-delete") {
      if (user.role !== "superadmin") return res.status(403).json({ error: "Only superadmin can delete service jobs" });
      const jobId = parseInt(req.body?.id || req.query.id);
      if (!jobId) return res.status(400).json({ error: "Job ID required" });

      await sql`DELETE FROM service_parts WHERE job_id = ${jobId}`;
      await sql`DELETE FROM service_payments WHERE job_id = ${jobId}`;
      const deleted = await sql`DELETE FROM service_jobs WHERE id = ${jobId} RETURNING id, job_number`;
      if (deleted.length === 0) return res.status(404).json({ error: "Job not found" });

      return res.status(200).json({ success: true, message: `Service Job #${deleted[0].job_number} deleted successfully` });
    }

    // ═══════════════ REMOVE SPARE PART FROM SERVICE JOB CART ═══════════════
    else if (action === "spare-part-delete") {
      const partId = parseInt(req.body?.id || req.query.id);
      if (!partId) return res.status(400).json({ error: "Part ID required" });

      const partRow = await sql`SELECT * FROM service_parts WHERE id = ${partId}`;
      if (partRow.length === 0) return res.status(404).json({ error: "Spare part not found" });

      const part = partRow[0];
      await sql`DELETE FROM service_parts WHERE id = ${partId}`;

      // Restore inventory stock if it was deducted from inventory
      if (part.product_id && part.from_inventory && part.quantity > 0) {
        try {
          await sql`UPDATE products SET current_stock = current_stock + ${part.quantity} WHERE id = ${part.product_id}`;
        } catch (e) {
          console.warn("Stock restore error:", e.message);
        }
      }

      // Recalculate job totals & GST
      if (part.job_id) {
        const partsSumRows = await sql`
          SELECT 
            COALESCE(SUM(quantity * unit_price), 0) as total_parts_base,
            COALESCE(SUM(COALESCE(cgst, 0) + COALESCE(sgst, 0) + COALESCE(igst, 0)), 0) as total_parts_gst,
            COALESCE(SUM(total), 0) as total_parts_grand
          FROM service_parts WHERE job_id = ${part.job_id}
        `;
        const partsBase = parseFloat(partsSumRows[0].total_parts_base || 0);
        const partsGst = parseFloat(partsSumRows[0].total_parts_gst || 0);
        const partsGrand = parseFloat(partsSumRows[0].total_parts_grand || 0);

        const jobRows = await sql`SELECT labor_charge, paid_amount FROM service_jobs WHERE id = ${part.job_id}`;
        const lCharge = parseFloat(jobRows[0]?.labor_charge || 0);
        const paidAmt = parseFloat(jobRows[0]?.paid_amount || 0);

        const grandTotal = lCharge + partsGrand;
        const newPending = Math.max(0, grandTotal - paidAmt);
        let payStatus = 'unpaid';
        if (newPending <= 0.01 && grandTotal > 0) payStatus = 'paid';
        else if (paidAmt > 0) payStatus = 'partially_paid';

        await sql`
          UPDATE service_jobs SET
            total_parts_cost = ${partsBase},
            gst_amount = ${partsGst},
            grand_total = ${grandTotal},
            pending_amount = ${newPending},
            payment_status = ${payStatus}
          WHERE id = ${part.job_id}
        `;
      }

      return res.status(200).json({ success: true, message: `Spare part '${part.part_name}' removed from job` });
    }

    // ═══════════════ DELETE SERVICE PAYMENT (SUPERADMIN ONLY) ═══════════════
    else if (action === "delete-service-payment") {
      if (user.role !== "superadmin") return res.status(403).json({ error: "Only superadmin can delete payments" });
      const payId = parseInt(req.body?.id || req.query.id);
      if (!payId) return res.status(400).json({ error: "Payment ID required" });

      const payRows = await sql`SELECT * FROM service_payments WHERE id = ${payId}`;
      if (payRows.length === 0) return res.status(404).json({ error: "Payment record not found" });

      const pay = payRows[0];
      await sql`DELETE FROM service_payments WHERE id = ${payId}`;

      if (pay.job_id) {
        const sumRes = await sql`SELECT COALESCE(SUM(amount), 0) as total_paid FROM service_payments WHERE job_id = ${pay.job_id}`;
        const totalPaid = parseFloat(sumRes[0].total_paid || 0);
        const jobRows = await sql`SELECT grand_total FROM service_jobs WHERE id = ${pay.job_id}`;
        const grandTotal = parseFloat(jobRows[0]?.grand_total || 0);
        const newPending = Math.max(0, grandTotal - totalPaid);

        let newPayStatus = 'unpaid';
        if (newPending <= 0.01 && grandTotal > 0) newPayStatus = 'paid';
        else if (totalPaid > 0) newPayStatus = 'partially_paid';

        await sql`
          UPDATE service_jobs SET
            paid_amount = ${totalPaid},
            pending_amount = ${newPending},
            payment_status = ${newPayStatus}
          WHERE id = ${pay.job_id}
        `;
      }

      return res.status(200).json({ success: true, message: `Payment receipt #${pay.receipt_number || payId} deleted` });
    }

    // ═══════════════ DELETE MECHANIC (SUPERADMIN ONLY) ═══════════════
    else if (action === "mechanic-delete") {
      if (user.role !== "superadmin") return res.status(403).json({ error: "Only superadmin can delete mechanics" });
      const mechId = parseInt(req.body?.id || req.query.id);
      if (!mechId) return res.status(400).json({ error: "Mechanic ID required" });

      const updated = await sql`UPDATE mechanics SET is_active = false WHERE id = ${mechId} RETURNING id, name`;
      if (updated.length === 0) return res.status(404).json({ error: "Mechanic not found" });

      return res.status(200).json({ success: true, message: `Mechanic '${updated[0].name}' deleted successfully` });
    }

    else {
      return res.status(404).json({ error: `Action '${action}' not recognized` });
    }

  } catch (error) {
    console.error(`api/services error [${action}]:`, error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};
