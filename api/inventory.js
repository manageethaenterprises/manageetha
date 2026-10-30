const { getSQL } = require("../shared/db");
const { getNextFamilyPoNumber, getCompanyFamilyInfo } = require("../shared/companyFamily");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "business-erp-jwt-secret-key-2026";

function verifyToken(req) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function safeInt(val, fallback = null) {
  if (val === null || val === undefined || val === "" || val === "all") return fallback;
  const p = parseInt(val, 10);
  return isNaN(p) ? fallback : p;
}

function safeNum(val, fallback = 0) {
  if (val === null || val === undefined || val === "" || val === "all") return fallback;
  const p = parseFloat(val);
  return isNaN(p) ? fallback : p;
}

async function ensureExpensesColumns(sql) {
  try {
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS dealer_receiver VARCHAR(255);`;
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS dealer_receiver_number VARCHAR(20);`;
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS dealer_receiver_email VARCHAR(100);`;
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS dealer_receiver_company VARCHAR(255);`;
  } catch (e) {
    // Ignore migration error if already exists
  }
}

async function resequenceCompanySkus(sql, compId) {
  const cid = safeInt(compId);
  if (!cid) return;
  try {
    const products = await sql`
      SELECT id, sku, created_at FROM products
      WHERE company_id = ${cid} AND is_active = true
      ORDER BY id ASC
    `;
    if (!products || products.length === 0) return;

    // Helper to extract numeric part from SKU-xxx
    const parseNum = (sku) => {
      if (!sku) return null;
      const m = sku.toString().trim().match(/^SKU-(\d+)$/i);
      return m ? parseInt(m[1], 10) : null;
    };

    // Sort products based on existing numeric SKU if present, else by created_at / id
    products.sort((a, b) => {
      const numA = parseNum(a.sku);
      const numB = parseNum(b.sku);
      if (numA !== null && numB !== null) return numA - numB;
      if (numA !== null && numB === null) return -1;
      if (numA === null && numB !== null) return 1;
      return (new Date(a.created_at || 0) - new Date(b.created_at || 0)) || (a.id - b.id);
    });

    // Check if any product needs re-numbering
    let needsUpdate = false;
    for (let i = 0; i < products.length; i++) {
      const expectedSku = `SKU-${String(i + 1).padStart(3, '0')}`;
      if (products[i].sku !== expectedSku) {
        needsUpdate = true;
        break;
      }
    }
    if (!needsUpdate) return;

    // Pass 1: Set temporary unique SKUs to prevent collision
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const expectedSku = `SKU-${String(i + 1).padStart(3, '0')}`;
      if (p.sku !== expectedSku) {
        await sql`UPDATE products SET sku = ${'TEMP-SKU-' + p.id} WHERE id = ${p.id}`;
      }
    }

    // Pass 2: Set final sequential continuous SKUs starting from SKU-001
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const expectedSku = `SKU-${String(i + 1).padStart(3, '0')}`;
      await sql`UPDATE products SET sku = ${expectedSku} WHERE id = ${p.id}`;
    }
  } catch (err) {
    console.error(`resequenceCompanySkus error for company ${cid}:`, err.message);
  }
}

async function getNextSkuNumber(sql, compId) {
  const cid = safeInt(compId) || 1;
  try {
    await resequenceCompanySkus(sql, cid);

    const activeProducts = await sql`
      SELECT id, sku FROM products 
      WHERE company_id = ${cid} AND is_active = true 
      ORDER BY id ASC
    `;

    let maxNum = 0;
    for (const p of activeProducts) {
      const skuStr = p.sku ? p.sku.toString().trim() : '';
      const m = skuStr.match(/^SKU-(\d+)$/i);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    return maxNum;
  } catch (err) {
    console.error(`getNextSkuNumber error for company ${cid}:`, err.message);
    return 0;
  }
}

function calculateRates(purchase_rate, purchase_rate_incl_tax, transport_expenses, gst_rate, selling_percentage, user_selling_rate, user_mrp, packaging_charges) {
  let prExcl = parseFloat(purchase_rate || 0);
  let prIncl = parseFloat(purchase_rate_incl_tax || 0);
  let gst = parseFloat(gst_rate || 0);
  let transport = parseFloat(transport_expenses || 0);
  let packaging = parseFloat(packaging_charges || 0);
  let sellPct = parseFloat(selling_percentage || 0);

  if (prExcl > 0) {
    prIncl = prExcl * (1 + gst / 100);
  } else if (prExcl <= 0 && prIncl > 0) {
    prExcl = prIncl / (1 + gst / 100);
  }

  let finalSellingRate = (user_selling_rate !== undefined && user_selling_rate !== null && user_selling_rate !== "" && parseFloat(user_selling_rate) > 0) ? parseFloat(user_selling_rate) : null;
  let finalMrp = (user_mrp !== undefined && user_mrp !== null && user_mrp !== "" && parseFloat(user_mrp) > 0) ? parseFloat(user_mrp) : null;

  if (finalSellingRate === null || isNaN(finalSellingRate) || finalSellingRate <= 0) {
    const baseCostExcl = prExcl + transport + packaging;
    if (sellPct > 0) {
      finalSellingRate = Math.round((baseCostExcl * (1 + sellPct / 100)) * 100) / 100;
    } else {
      finalSellingRate = Math.round(baseCostExcl * 100) / 100;
    }
  }

  // MRP (Incl Tax) is automatically calculated on Selling Price (Excl) with relevant GST % of that product if user not entered/overridden
  if (finalMrp === null || isNaN(finalMrp) || finalMrp <= 0) {
    const sellExcl = finalSellingRate || 0;
    finalMrp = Math.round((sellExcl * (1 + gst / 100)) * 100) / 100;
  }

  return {
    purchase_rate: Math.round(prExcl * 100) / 100,
    purchase_rate_incl_tax: Math.round(prIncl * 100) / 100,
    transport_expenses: Math.round(transport * 100) / 100,
    packaging_charges: Math.round(packaging * 100) / 100,
    selling_percentage: Math.round(sellPct * 100) / 100,
    selling_rate: Math.round((finalSellingRate || 0) * 100) / 100,
    mrp: Math.round((finalMrp || 0) * 100) / 100
  };
}

// ── Helper 1: Track and Validate HSN Codes & GST Rates ──
async function trackAndValidateHsn(sql, hsnCode, gstRate, description = null) {
  if (!hsnCode || !hsnCode.toString().trim()) {
    return { valid: true, hsnCode: null, masterGstRate: parseFloat(gstRate || 0), isMismatch: false };
  }
  const cleanCode = hsnCode.toString().trim();
  const rate = parseFloat(gstRate || 0);

  try {
    const existing = await sql`SELECT * FROM hsn_codes WHERE LOWER(code) = LOWER(${cleanCode}) LIMIT 1`;
    if (existing.length > 0) {
      const masterRate = parseFloat(existing[0].gst_rate || 0);
      const isMismatch = Math.abs(masterRate - rate) > 0.01;
      if (isMismatch) {
        return {
          valid: false,
          hsnCode: existing[0].code,
          masterGstRate: masterRate,
          providedGstRate: rate,
          isMismatch: true,
          error: `HSN GST Rate Mismatch! HSN Code '${cleanCode}' is registered in HSN Master with ${masterRate}% GST rate, but entry/upload specifies ${rate}%. Operation blocked! Only Superadmin can change HSN Master rates or entry rate must match Master.`
        };
      }
      return {
        valid: true,
        hsnCode: existing[0].code,
        masterGstRate: masterRate,
        providedGstRate: rate,
        isMismatch: false,
        description: existing[0].description
      };
    } else {
      // HSN code does not exist yet: store in hsn_codes for future tracking
      try {
        await sql`
          INSERT INTO hsn_codes (code, description, gst_rate, is_active)
          VALUES (${cleanCode}, ${description || null}, ${rate}, true)
        `;
      } catch (insertErr) {
        console.warn("hsn_codes auto-insert info:", insertErr.message);
      }
      return {
        valid: true,
        hsnCode: cleanCode,
        masterGstRate: rate,
        providedGstRate: rate,
        isMismatch: false,
        autoCreated: true
      };
    }
  } catch (err) {
    console.error("trackAndValidateHsn error:", err.message);
    return { valid: true, hsnCode: cleanCode, masterGstRate: rate, providedGstRate: rate, isMismatch: false };
  }
}

// ── Helper 2: Smart Product Upsert (Prevents Duplicates in Bulk Import) ──
async function upsertProduct(sql, compId, itemData, options = {}) {
  const pName = (itemData.name || itemData.product_name || '').toString().trim();
  if (!pName) return null;

  const skuClean = (itemData.sku && itemData.sku.toString().trim() !== "") ? itemData.sku.toString().trim() : null;
  const barcodeClean = (itemData.barcode && itemData.barcode.toString().trim() !== "") ? itemData.barcode.toString().trim() : null;
  const modelClean = (itemData.model && itemData.model.toString().trim() !== "") ? itemData.model.toString().trim() : null;
  const brandClean = (itemData.brand && itemData.brand.toString().trim() !== "") ? itemData.brand.toString().trim() : null;
  const supId = safeInt(itemData.supplier_id);
  const hsnClean = (itemData.hsn_sac || itemData.hsn || itemData.hsn_code || '').toString().trim() || null;
  const gstRate = parseFloat(itemData.gst_rate || 0);

  if (hsnClean) {
    const hsnCheck = await trackAndValidateHsn(sql, hsnClean, gstRate, itemData.hsn_description || null);
    if (!hsnCheck.valid) {
      throw new Error(hsnCheck.error);
    }
  }

  const rates = calculateRates(
    itemData.purchase_rate || itemData.purchase_rate_excl_tax,
    itemData.purchase_rate_incl_tax,
    itemData.transport_expenses || itemData.transport,
    gstRate,
    itemData.selling_percentage || itemData.selling_pct,
    itemData.selling_rate || itemData.selling_price,
    itemData.mrp || itemData.mrp_incl_tax,
    itemData.packaging_charges || itemData.packaging || 0
  );

  let existingProd = null;

  if (skuClean) {
    const rows = await sql`SELECT * FROM products WHERE company_id = ${compId} AND LOWER(TRIM(sku)) = LOWER(TRIM(${skuClean})) AND is_active = true LIMIT 1`;
    if (rows.length > 0) existingProd = rows[0];
  }

  if (!existingProd && barcodeClean) {
    const rows = await sql`SELECT * FROM products WHERE company_id = ${compId} AND barcode = ${barcodeClean} AND is_active = true LIMIT 1`;
    if (rows.length > 0) existingProd = rows[0];
  }

  if (!existingProd) {
    if (modelClean && brandClean) {
      const rows = await sql`SELECT * FROM products WHERE company_id = ${compId} AND is_active = true AND LOWER(TRIM(name)) = LOWER(TRIM(${pName})) AND LOWER(TRIM(model)) = LOWER(TRIM(${modelClean})) AND LOWER(TRIM(brand)) = LOWER(TRIM(${brandClean})) LIMIT 1`;
      if (rows.length > 0) existingProd = rows[0];
    }
    if (!existingProd && modelClean) {
      const rows = await sql`SELECT * FROM products WHERE company_id = ${compId} AND is_active = true AND LOWER(TRIM(name)) = LOWER(TRIM(${pName})) AND LOWER(TRIM(model)) = LOWER(TRIM(${modelClean})) LIMIT 1`;
      if (rows.length > 0) existingProd = rows[0];
    }
    if (!existingProd && !modelClean && brandClean) {
      const rows = await sql`SELECT * FROM products WHERE company_id = ${compId} AND is_active = true AND LOWER(TRIM(name)) = LOWER(TRIM(${pName})) AND LOWER(TRIM(brand)) = LOWER(TRIM(${brandClean})) AND (model IS NULL OR TRIM(model) = '') LIMIT 1`;
      if (rows.length > 0) existingProd = rows[0];
    }
    if (!existingProd && !modelClean && !brandClean) {
      const rows = await sql`SELECT * FROM products WHERE company_id = ${compId} AND is_active = true AND LOWER(TRIM(name)) = LOWER(TRIM(${pName})) AND (brand IS NULL OR TRIM(brand) = '') AND (model IS NULL OR TRIM(model) = '') LIMIT 1`;
      if (rows.length > 0) existingProd = rows[0];
    }
  }

  const uploadedQty = (itemData.current_stock !== undefined) ? parseInt(itemData.current_stock, 10) :
    (itemData.quantity !== undefined ? parseInt(itemData.quantity, 10) :
      (itemData.initial_stock !== undefined ? parseInt(itemData.initial_stock, 10) : 0));

  const weightClean = parseFloat(itemData.weight || itemData.weight_kg || 0);
  const serialNoClean = (itemData.serial_no || itemData.serial_number || itemData.serial || itemData.product_serial_no || '').toString().trim() || null;

  if (existingProd) {
    let newStock = existingProd.current_stock || 0;
    if (options.mode === 'purchase_upload') {
      newStock = (existingProd.current_stock || 0) + uploadedQty;
    } else if (options.mode === 'inventory_upload') {
      newStock = (itemData.current_stock !== undefined || itemData.initial_stock !== undefined) ? uploadedQty : existingProd.current_stock;
    }

    const updated = await sql`
      UPDATE products SET
        name = ${pName},
        brand = COALESCE(${brandClean}, brand),
        model = COALESCE(${modelClean}, model),
        hsn_sac = COALESCE(${hsnClean}, hsn_sac),
        unit_of_measure = COALESCE(${itemData.unit_of_measure || null}, unit_of_measure),
        gst_rate = COALESCE(${gstRate > 0 ? gstRate : null}, gst_rate),
        purchase_rate = COALESCE(${rates.purchase_rate > 0 ? rates.purchase_rate : null}, purchase_rate),
        purchase_rate_incl_tax = COALESCE(${rates.purchase_rate_incl_tax > 0 ? rates.purchase_rate_incl_tax : null}, purchase_rate_incl_tax),
        transport_expenses = COALESCE(${rates.transport_expenses >= 0 ? rates.transport_expenses : null}, transport_expenses),
        selling_percentage = COALESCE(${rates.selling_percentage >= 0 ? rates.selling_percentage : null}, selling_percentage),
        selling_rate = COALESCE(${rates.selling_rate > 0 ? rates.selling_rate : null}, selling_rate),
        mrp = COALESCE(${rates.mrp > 0 ? rates.mrp : null}, mrp),
        current_stock = ${newStock},
        min_stock = COALESCE(${itemData.min_stock !== undefined && itemData.min_stock !== null && itemData.min_stock !== '' ? parseInt(itemData.min_stock, 10) : null}, min_stock),
        rack_no = COALESCE(${itemData.rack_no || itemData.rack || null}, rack_no),
        weight = COALESCE(${weightClean > 0 ? weightClean : null}, weight),
        serial_no = COALESCE(${serialNoClean}, serial_no),
        supplier_id = COALESCE(${supId}, supplier_id),
        is_active = true
      WHERE id = ${existingProd.id}
      RETURNING *
    `;

    return { product: updated[0], isCreated: false, isUpdated: true, warning: null };
  } else {
    let finalSku = skuClean;
    if (!finalSku) {
      const maxNum = await getNextSkuNumber(sql, compId);
      finalSku = `SKU-${String(maxNum + 1).padStart(3, '0')}`;
    }

    const created = await sql`
      INSERT INTO products (
        company_id, sku, name, brand, model, hsn_sac, unit_of_measure, gst_rate,
        purchase_rate, purchase_rate_incl_tax, transport_expenses, selling_percentage,
        selling_rate, mrp, current_stock, min_stock, rack_no, weight, serial_no, supplier_id, is_active
      ) VALUES (
        ${compId}, ${finalSku}, ${pName}, ${brandClean}, ${modelClean}, ${hsnClean},
        ${itemData.unit_of_measure || 'NOS'}, ${gstRate},
        ${rates.purchase_rate}, ${rates.purchase_rate_incl_tax}, ${rates.transport_expenses}, ${rates.selling_percentage},
        ${rates.selling_rate}, ${rates.mrp}, ${uploadedQty}, ${itemData.min_stock ? parseInt(itemData.min_stock, 10) : 5},
        ${itemData.rack_no || itemData.rack || null}, ${weightClean}, ${serialNoClean}, ${supId}, true
      )
      RETURNING *
    `;

    return { product: created[0], isCreated: true, isUpdated: false, warning: null };
  }
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized. Please login." });

  const sql = getSQL();
  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { }
  }
  const action = req.query.action || body.action || "products";

  try {
    try {
      // Ensure entity_ledger table and columns exist for suppliers & dealers
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS entity_ledger (
            id SERIAL PRIMARY KEY,
            company_id INT REFERENCES companies(id) ON DELETE CASCADE,
            entity_type VARCHAR(20) NOT NULL,
            entity_id INT NOT NULL,
            post_date DATE NOT NULL DEFAULT CURRENT_DATE,
            document_no VARCHAR(100),
            entry_type VARCHAR(50) NOT NULL,
            narration TEXT,
            debit NUMERIC(15,2) DEFAULT 0,
            credit NUMERIC(15,2) DEFAULT 0,
            balance NUMERIC(15,2) DEFAULT 0,
            payment_mode VARCHAR(50),
            bank_name VARCHAR(100),
            reference_id INT,
            attachments_json TEXT,
            created_by INT,
            created_at TIMESTAMP DEFAULT NOW()
          );
        `;
        try { await sql`CREATE INDEX IF NOT EXISTS idx_entity_ledger_lookup ON entity_ledger (entity_type, entity_id, post_date);`; } catch(e){}
        try {
          await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS opening_balance_date DATE;`;
          await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS opening_balance_type VARCHAR(50) DEFAULT 'credit';`;
          await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS account_code VARCHAR(50);`;
          await sql`ALTER TABLE dealers ADD COLUMN IF NOT EXISTS opening_balance_date DATE;`;
          await sql`ALTER TABLE dealers ADD COLUMN IF NOT EXISTS opening_balance_type VARCHAR(50) DEFAULT 'debit';`;
          await sql`ALTER TABLE dealers ADD COLUMN IF NOT EXISTS account_code VARCHAR(50);`;
        } catch(e){}
      } catch(e) {}

      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_rate_incl_tax NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS transport_expenses NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS packaging_charges NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_percentage NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS serial_no VARCHAR(255);`;
      await sql`ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS serial_no VARCHAR(255);`;
      await sql`ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS packaging_charges NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS transport_expenses NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(15,2);`;
      try { await sql`ALTER TABLE products ALTER COLUMN selling_percentage TYPE NUMERIC(15,2);`; } catch (e) { }
      try { await sql`ALTER TABLE products ALTER COLUMN gst_rate TYPE NUMERIC(15,2);`; } catch (e) { }
      try {
        // Backfill gst_rate on purchase_items where missing from line total and taxable base
        await sql`
          UPDATE purchase_items
          SET gst_rate = CASE 
            WHEN ((quantity * rate) + COALESCE(packaging_charges, 0) + COALESCE(transport_expenses, 0)) > 0 
                 AND total > ((quantity * rate) + COALESCE(packaging_charges, 0) + COALESCE(transport_expenses, 0))
            THEN ROUND((((total / ((quantity * rate) + COALESCE(packaging_charges, 0) + COALESCE(transport_expenses, 0))) - 1.0) * 100)::numeric, 2)
            ELSE 18
          END
          WHERE gst_rate IS NULL;
        `;
        await sql`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS round_off NUMERIC(10,2) DEFAULT 0;`;

        // Universally reconcile round_off for any existing purchases where grand_total differs slightly from item sum (<= Rs 5)
        await sql`
          UPDATE purchases p
          SET round_off = ROUND((p.grand_total - item_sums.subtotal)::numeric, 2)
          FROM (
            SELECT purchase_id, SUM(total) as subtotal
            FROM purchase_items
            GROUP BY purchase_id
          ) item_sums
          WHERE p.id = item_sums.purchase_id
            AND (p.round_off IS NULL OR p.round_off = 0)
            AND p.grand_total > 0
            AND ABS(p.grand_total - item_sums.subtotal) > 0.005
            AND ABS(p.grand_total - item_sums.subtotal) < 5.0;
        `;
      } catch (e) { }
      await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) ON DELETE SET NULL;`;
      await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS supply_state VARCHAR(100) DEFAULT 'Andhra Pradesh';`;
      await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS designation VARCHAR(100);`;
      await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contacts_json TEXT;`;
      await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255);`;
      await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bank_account_no VARCHAR(100);`;
      await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(50);`;
      await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(255);`;
      await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS credit_period_days INT DEFAULT 0;`;
      await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS credit_interest_rate NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS opening_balance_type VARCHAR(20) DEFAULT 'payable';`;
      await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS opening_balance_date DATE;`;
      await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS opening_balance_notes TEXT;`;
      await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS opening_balance_doc TEXT;`;
      try {
        await sql`
          UPDATE suppliers s
          SET company_id = p.company_id
          FROM purchases p
          WHERE s.company_id IS NULL AND p.supplier_id = s.id AND p.company_id IS NOT NULL;
        `;
        await sql`
          UPDATE suppliers s
          SET company_id = pr.company_id
          FROM products pr
          WHERE s.company_id IS NULL AND pr.supplier_id = s.id AND pr.company_id IS NOT NULL;
        `;
      } catch (e) { }
      await sql`
        CREATE TABLE IF NOT EXISTS inter_branch_transfers (
          id SERIAL PRIMARY KEY,
          transfer_number VARCHAR(50) UNIQUE NOT NULL,
          from_company_id INT REFERENCES companies(id) ON DELETE CASCADE,
          to_company_id INT REFERENCES companies(id) ON DELETE CASCADE,
          product_id INT REFERENCES products(id) ON DELETE SET NULL,
          product_name VARCHAR(255) NOT NULL,
          brand VARCHAR(100),
          model VARCHAR(100),
          hsn_sac VARCHAR(20),
          quantity INT NOT NULL,

          dispatch_date_time TIMESTAMP DEFAULT NOW(),
          transport_charges NUMERIC(15,2) DEFAULT 0,
          vehicle_details VARCHAR(255),
          driver_info VARCHAR(255),
          dispatch_notes TEXT,
          dispatched_by_user_id INT,

          received_date_time TIMESTAMP,
          receiving_vehicle_details VARCHAR(255),
          receipt_attachment_url TEXT,
          receiving_notes TEXT,
          received_by_user_id INT,

          status VARCHAR(30) DEFAULT 'in_transit',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
    } catch (e) { }

    const isSuperAdmin = (user && user.role === "superadmin");
    const compQuery = isSuperAdmin ? (req.query.company_id || "all") : user.company_id;
    const isAll = isSuperAdmin && (!compQuery || compQuery === "all" || isNaN(parseInt(compQuery, 10)));
    const targetCompId = !isAll ? (parseInt(compQuery, 10) || parseInt(user.company_id, 10) || 1) : null;

    // ═══════════════ SUPPLIERS MASTER (SCOPED BY USER COMPANY) ═══════════════
    if (action === "suppliers-list") {
      const userRole = (user && user.role ? user.role : "").toLowerCase();
      const isSuper = (userRole === "superadmin");
      const userCompId = safeInt(user?.company_id) || 1;
      const reqCompId = safeInt(req.query.company_id || req.body?.company_id);

      let targetCompIds = [];
      let isAll = false;

      if (isSuper && (!reqCompId || req.query.company_id === "all")) {
        isAll = true;
      } else {
        const compToInspect = (isSuper && reqCompId) ? reqCompId : userCompId;
        try {
          const famInfo = await getCompanyFamilyInfo(sql, compToInspect);
          targetCompIds = (famInfo && famInfo.familyCompIds && famInfo.familyCompIds.length > 0)
            ? famInfo.familyCompIds
            : [compToInspect];
        } catch (e) {
          targetCompIds = [compToInspect];
        }
      }

      let rows;
      if (isAll) {
        rows = await sql`
          SELECT s.*, c.name as company_name
          FROM suppliers s
          LEFT JOIN companies c ON s.company_id = c.id
          WHERE s.is_active = true
          ORDER BY s.legal_name ASC
        `;
      } else {
        rows = await sql`
          SELECT s.*, c.name as company_name
          FROM suppliers s
          LEFT JOIN companies c ON s.company_id = c.id
          WHERE s.is_active = true
            AND (
              s.company_id = ANY(${targetCompIds})
              OR (
                s.company_id IS NULL
                AND (
                  EXISTS (SELECT 1 FROM products p WHERE p.supplier_id = s.id AND p.company_id = ANY(${targetCompIds}))
                  OR EXISTS (SELECT 1 FROM purchases pu WHERE pu.supplier_id = s.id AND pu.company_id = ANY(${targetCompIds}))
                )
              )
            )
          ORDER BY s.legal_name ASC
        `;
      }
      return res.status(200).json({ success: true, suppliers: rows });
    }

    else if (action === "supplier-create") {
      const {
        company_id, legal_name, trade_name, gstin, phone, address, contact_person, designation, email, supply_state, credit_terms, contacts_json,
        bank_name, bank_account_no, bank_ifsc, bank_branch, credit_limit, credit_period_days, credit_interest_rate,
        opening_balance, opening_balance_type, opening_balance_date, opening_balance_notes, opening_balance_doc
      } = req.body;
      if (!legal_name || !legal_name.trim()) return res.status(400).json({ error: "Supplier Legal Name required" });
      const compId = safeInt(company_id) || safeInt(user.company_id) || 1;
      const contactsStr = typeof contacts_json === 'object' ? JSON.stringify(contacts_json) : (contacts_json || null);

      const newSup = await sql`
        INSERT INTO suppliers (
          company_id, legal_name, trade_name, gstin, phone, address, contact_person, designation, email, supply_state, credit_terms, contacts_json, is_active,
          bank_name, bank_account_no, bank_ifsc, bank_branch, credit_limit, credit_period_days, credit_interest_rate,
          opening_balance, opening_balance_type, opening_balance_date, opening_balance_notes, opening_balance_doc
        )
        VALUES (
          ${compId}, ${legal_name.trim()}, ${trade_name ? trade_name.trim() : null}, ${gstin ? gstin.trim() : null},
          ${phone ? phone.trim() : null}, ${address ? address.trim() : null}, ${contact_person ? contact_person.trim() : null},
          ${designation ? designation.trim() : null}, ${email ? email.trim() : null}, ${supply_state || 'Andhra Pradesh'},
          ${credit_terms || 'Immediate'}, ${contactsStr}, true,
          ${bank_name ? bank_name.trim() : null}, ${bank_account_no ? bank_account_no.trim() : null}, ${bank_ifsc ? bank_ifsc.trim() : null}, ${bank_branch ? bank_branch.trim() : null},
          ${safeNum(credit_limit)}, ${safeInt(credit_period_days, 0)}, ${safeNum(credit_interest_rate)},
          ${safeNum(opening_balance)}, ${opening_balance_type || 'payable'}, ${opening_balance_date || null}, ${opening_balance_notes ? opening_balance_notes.trim() : null}, ${opening_balance_doc || null}
        )
        RETURNING *
      `;
      return res.status(200).json({ success: true, supplier: newSup[0], message: "Supplier registered successfully!" });
    }

    else if (action === "supplier-update") {
      const {
        id, company_id, legal_name, trade_name, gstin, phone, address, contact_person, designation, email, supply_state, credit_terms, contacts_json,
        bank_name, bank_account_no, bank_ifsc, bank_branch, credit_limit, credit_period_days, credit_interest_rate,
        opening_balance, opening_balance_type, opening_balance_date, opening_balance_notes, opening_balance_doc
      } = req.body;
      const supId = safeInt(id);
      if (!supId || !legal_name || !legal_name.trim()) return res.status(400).json({ error: "Supplier ID and Legal Name required" });

      const compId = safeInt(company_id) || (isSuperAdmin ? null : (safeInt(user.company_id) || 1));
      const contactsStr = typeof contacts_json === 'object' ? JSON.stringify(contacts_json) : (contacts_json || null);

      const updated = await sql`
        UPDATE suppliers
        SET company_id = ${compId},
            legal_name = ${legal_name.trim()},
            trade_name = ${trade_name ? trade_name.trim() : null},
            gstin = ${gstin ? gstin.trim() : null},
            phone = ${phone ? phone.trim() : null},
            address = ${address ? address.trim() : null},
            contact_person = ${contact_person ? contact_person.trim() : null},
            designation = ${designation ? designation.trim() : null},
            email = ${email ? email.trim() : null},
            supply_state = ${supply_state || 'Andhra Pradesh'},
            credit_terms = ${credit_terms || 'Immediate'},
            contacts_json = ${contactsStr},
            bank_name = ${bank_name ? bank_name.trim() : null},
            bank_account_no = ${bank_account_no ? bank_account_no.trim() : null},
            bank_ifsc = ${bank_ifsc ? bank_ifsc.trim() : null},
            bank_branch = ${bank_branch ? bank_branch.trim() : null},
            credit_limit = ${safeNum(credit_limit)},
            credit_period_days = ${safeInt(credit_period_days, 0)},
            credit_interest_rate = ${safeNum(credit_interest_rate)},
            opening_balance = ${safeNum(opening_balance)},
            opening_balance_type = ${opening_balance_type || 'payable'},
            opening_balance_date = ${opening_balance_date || null},
            opening_balance_notes = ${opening_balance_notes ? opening_balance_notes.trim() : null},
            opening_balance_doc = ${opening_balance_doc || null}
        WHERE id = ${supId}
        RETURNING *
      `;
      return res.status(200).json({ success: true, supplier: updated[0], message: "Supplier updated successfully!" });
    }

    else if (action === "supplier-delete") {
      const supId = safeInt(req.query.id || req.body?.id);
      if (!supId) return res.status(400).json({ error: "Supplier ID required" });

      await sql`UPDATE suppliers SET is_active = false WHERE id = ${supId}`;
      return res.status(200).json({ success: true, message: "Supplier deleted successfully!" });
    }

    // ═══════════════ ENTITY LEDGER (SUPPLIERS & DEALERS) ═══════════════
    else if (action === "entity-ledger-list") {
      const entityType = (req.query.entity_type || req.body?.entity_type || "supplier").toLowerCase().trim();
      const entityId = safeInt(req.query.entity_id || req.body?.entity_id);
      const fromDate = req.query.from_date || req.body?.from_date || null;
      const toDate = req.query.to_date || req.body?.to_date || null;
      const includeAuto = req.query.include_auto !== "false";

      if (!entityId) return res.status(400).json({ error: "entity_id is required" });
      if (entityType !== "supplier" && entityType !== "dealer") {
        return res.status(400).json({ error: "entity_type must be 'supplier' or 'dealer'" });
      }

      let entity = null;
      if (entityType === "supplier") {
        const rows = await sql`
          SELECT s.*, c.name as company_name, c.address as company_address, c.gstin as company_gstin, c.phone as company_phone, c.email as company_email
          FROM suppliers s
          LEFT JOIN companies c ON s.company_id = c.id
          WHERE s.id = ${entityId}
        `;
        if (rows.length === 0) return res.status(404).json({ error: "Supplier not found" });
        entity = rows[0];
      } else {
        const rows = await sql`
          SELECT d.*, c.name as company_name, c.address as company_address, c.gstin as company_gstin, c.phone as company_phone, c.email as company_email
          FROM dealers d
          LEFT JOIN companies c ON d.company_id = c.id
          WHERE d.id = ${entityId}
        `;
        if (rows.length === 0) return res.status(404).json({ error: "Dealer not found" });
        entity = rows[0];
      }

      const compIdToUse = entity.company_id || (safeInt(compQuery) || safeInt(user.company_id) || 1);
      const compRows = await sql`SELECT * FROM companies WHERE id = ${compIdToUse}`;
      const company = compRows[0] || {};

      // 1. Fetch manual entries from entity_ledger
      const manualEntries = await sql`
        SELECT el.*, u.username as created_by_name
        FROM entity_ledger el
        LEFT JOIN users u ON el.created_by = u.id
        WHERE el.entity_type = ${entityType} AND el.entity_id = ${entityId}
        ORDER BY el.post_date ASC, el.id ASC
      `;

      let allRawEntries = [...manualEntries.map(e => ({
        id: e.id,
        post_date: e.post_date ? new Date(e.post_date).toISOString().split('T')[0] : '',
        document_no: e.document_no || '',
        entry_type: e.entry_type || 'manual_entry',
        narration: e.narration || '',
        debit: parseFloat(e.debit || 0),
        credit: parseFloat(e.credit || 0),
        payment_mode: e.payment_mode || '',
        bank_name: e.bank_name || '',
        attachments_json: e.attachments_json || null,
        is_manual: true,
        created_at: e.created_at
      }))];

      // 2. Auto-linked ERP entries
      if (includeAuto) {
        const manualDocNos = new Set(allRawEntries.map(e => (e.document_no || '').toLowerCase().trim()).filter(Boolean));

        if (entityType === "supplier") {
          try {
            const purRows = await sql`
              SELECT p.id, p.purchase_date, p.purchase_invoice_no, p.bill_number, p.grand_total, p.total_amount, p.created_at
              FROM purchases p
              WHERE p.supplier_id = ${entityId}
              ORDER BY p.purchase_date ASC, p.id ASC
            `;
            for (const p of purRows) {
              const docNo = (p.purchase_invoice_no || p.bill_number || `PUR-${p.id}`).trim();
              if (manualDocNos.has(docNo.toLowerCase())) continue;
              allRawEntries.push({
                id: `pur-${p.id}`,
                post_date: p.purchase_date ? new Date(p.purchase_date).toISOString().split('T')[0] : '',
                document_no: docNo,
                entry_type: 'purchase_invoice',
                narration: `Purchase Bill #${docNo}`,
                debit: 0,
                credit: parseFloat(p.grand_total || p.total_amount || 0),
                payment_mode: '',
                bank_name: '',
                is_manual: false,
                created_at: p.created_at
              });
            }
          } catch(e){}

          try {
            const expRows = await sql`
              SELECT e.id, e.expense_date, e.receipt_number, e.amount, e.payment_mode, e.notes, e.created_at
              FROM expenses e
              WHERE (
                LOWER(TRIM(COALESCE(e.dealer_receiver, ''))) = LOWER(TRIM(${entity.legal_name}))
                OR (e.receipt_number LIKE 'EXP-PUR-%' AND EXISTS (
                     SELECT 1 FROM purchases pu WHERE pu.supplier_id = ${entityId} AND ('EXP-PUR-' || pu.id::text) = e.receipt_number
                   ))
              )
              ORDER BY e.expense_date ASC, e.id ASC
            `;
            for (const e of expRows) {
              const docNo = (e.receipt_number || `EXP-${e.id}`).trim();
              if (manualDocNos.has(docNo.toLowerCase())) continue;
              allRawEntries.push({
                id: `exp-${e.id}`,
                post_date: e.expense_date ? new Date(e.expense_date).toISOString().split('T')[0] : '',
                document_no: docNo,
                entry_type: 'bank_payment',
                narration: e.notes ? `${e.notes} (${e.payment_mode || 'Bank'})` : `Payment to Supplier: ${e.payment_mode || 'Bank Transfer'}`,
                debit: parseFloat(e.amount || 0),
                credit: 0,
                payment_mode: e.payment_mode || 'Bank Transfer',
                bank_name: '',
                is_manual: false,
                created_at: e.created_at
              });
            }
          } catch(e){}
        } else if (entityType === "dealer") {
          try {
            const saleRows = await sql`
              SELECT s.id, s.invoice_date, s.sale_date, s.invoice_number, s.challan_number, s.grand_total, s.total_amount, s.paid_amount, s.payment_mode, s.created_at
              FROM sales s
              WHERE LOWER(TRIM(COALESCE(s.customer_name, ''))) = LOWER(TRIM(${entity.legal_name}))
                 OR LOWER(TRIM(COALESCE(s.customer_name, ''))) = LOWER(TRIM(${entity.trade_name || '---'}))
              ORDER BY COALESCE(s.invoice_date, s.sale_date) ASC, s.id ASC
            `;
            for (const s of saleRows) {
              const docNo = (s.invoice_number || s.challan_number || `INV-${s.id}`).trim();
              if (manualDocNos.has(docNo.toLowerCase())) continue;
              const sDate = s.invoice_date || s.sale_date;
              allRawEntries.push({
                id: `sale-${s.id}`,
                post_date: sDate ? new Date(sDate).toISOString().split('T')[0] : '',
                document_no: docNo,
                entry_type: 'sale_invoice',
                narration: `Sales Invoice #${docNo}`,
                debit: parseFloat(s.grand_total || s.total_amount || 0),
                credit: 0,
                payment_mode: '',
                bank_name: '',
                is_manual: false,
                created_at: s.created_at
              });
              if (parseFloat(s.paid_amount || 0) > 0) {
                allRawEntries.push({
                  id: `sale-pay-${s.id}`,
                  post_date: sDate ? new Date(sDate).toISOString().split('T')[0] : '',
                  document_no: `RCPT-${docNo}`,
                  entry_type: 'bank_receipt',
                  narration: `Receipt against Invoice #${docNo} (${s.payment_mode || 'Bank'})`,
                  debit: 0,
                  credit: parseFloat(s.paid_amount || 0),
                  payment_mode: s.payment_mode || 'Bank',
                  bank_name: '',
                  is_manual: false,
                  created_at: s.created_at
                });
              }
            }
          } catch(e){}
        }
      }

      // Sort all chronologically
      allRawEntries.sort((a, b) => {
        const da = a.post_date || '';
        const db = b.post_date || '';
        if (da !== db) return da.localeCompare(db);
        return String(a.id).localeCompare(String(b.id));
      });

      // Calculate Running Balance
      const rawOpeningAmt = parseFloat(entity.opening_balance || 0);
      const rawOpeningType = (entity.opening_balance_type || (entityType === "supplier" ? "Credit" : "Debit")).trim();
      const isSupplier = (entityType === "supplier");

      let runningBalance = isSupplier
        ? (rawOpeningType.toLowerCase() === "debit" ? -rawOpeningAmt : rawOpeningAmt)
        : (rawOpeningType.toLowerCase() === "credit" ? -rawOpeningAmt : rawOpeningAmt);

      let effectiveOpeningBalance = rawOpeningAmt;
      let effectiveOpeningType = rawOpeningType;

      const filteredEntries = [];
      let totalPeriodDebit = 0;
      let totalPeriodCredit = 0;

      for (const entry of allRawEntries) {
        const d = entry.post_date;
        const isBeforeFrom = fromDate && d && d < fromDate;
        const isAfterTo = toDate && d && d > toDate;

        if (isSupplier) {
          runningBalance = runningBalance + entry.credit - entry.debit;
        } else {
          runningBalance = runningBalance + entry.debit - entry.credit;
        }

        entry.balance = Math.abs(runningBalance);
        if (isSupplier) {
          entry.balance_type = runningBalance >= 0 ? "Credit" : "Debit";
          entry.balance_formatted = runningBalance >= 0 
            ? `${entry.balance.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}-` 
            : `${entry.balance.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})} Dr`;
        } else {
          entry.balance_type = runningBalance >= 0 ? "Debit" : "Credit";
          entry.balance_formatted = runningBalance >= 0 
            ? `${entry.balance.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})} Dr` 
            : `${entry.balance.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})} Cr`;
        }

        if (isBeforeFrom) {
          effectiveOpeningBalance = Math.abs(runningBalance);
          effectiveOpeningType = entry.balance_type;
        } else if (!isAfterTo) {
          filteredEntries.push(entry);
          totalPeriodDebit += entry.debit;
          totalPeriodCredit += entry.credit;
        }
      }

      const closingBalance = Math.abs(runningBalance);
      const closingBalanceType = isSupplier
        ? (runningBalance >= 0 ? "Credit" : "Debit")
        : (runningBalance >= 0 ? "Debit" : "Credit");

      return res.status(200).json({
        success: true,
        entity,
        company,
        entity_type: entityType,
        opening_balance: effectiveOpeningBalance,
        opening_balance_type: effectiveOpeningType,
        opening_balance_date: entity.opening_balance_date || '2025-04-01',
        entries: filteredEntries,
        totals: {
          total_debit: Math.round(totalPeriodDebit * 100) / 100,
          total_credit: Math.round(totalPeriodCredit * 100) / 100,
          closing_balance: Math.round(closingBalance * 100) / 100,
          closing_balance_type: closingBalanceType,
          closing_balance_formatted: isSupplier 
            ? (runningBalance >= 0 ? `${closingBalance.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}-` : `${closingBalance.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})} Dr`)
            : (runningBalance >= 0 ? `${closingBalance.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})} Dr` : `${closingBalance.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})} Cr`)
        }
      });
    }

    else if (action === "entity-ledger-create") {
      const {
        entity_type, entity_id, company_id, post_date, document_no,
        entry_type, narration, debit, credit, payment_mode, bank_name,
        attachments_json
      } = req.body;

      const eType = (entity_type || "supplier").toLowerCase().trim();
      const eId = safeInt(entity_id);
      if (!eId) return res.status(400).json({ error: "entity_id required" });
      const compId = safeInt(company_id) || safeInt(user.company_id) || 1;

      const pDate = post_date || new Date().toISOString().split('T')[0];
      const docNo = (document_no || '').trim() || null;
      const eNarration = (narration || '').trim() || 'Ledger Entry';
      const debAmt = parseFloat(debit || 0);
      const credAmt = parseFloat(credit || 0);

      const inserted = await sql`
        INSERT INTO entity_ledger (
          company_id, entity_type, entity_id, post_date, document_no,
          entry_type, narration, debit, credit, payment_mode, bank_name,
          attachments_json, created_by
        ) VALUES (
          ${compId}, ${eType}, ${eId}, ${pDate}, ${docNo},
          ${entry_type || 'manual_entry'}, ${eNarration}, ${debAmt}, ${credAmt},
          ${payment_mode || null}, ${bank_name || null}, ${attachments_json || null},
          ${user.userId || null}
        )
        RETURNING *
      `;

      return res.status(200).json({ success: true, entry: inserted[0], message: "Ledger entry recorded successfully!" });
    }

    else if (action === "entity-ledger-update") {
      const {
        id, post_date, document_no, entry_type, narration,
        debit, credit, payment_mode, bank_name, attachments_json
      } = req.body;
      const recId = safeInt(id);
      if (!recId) return res.status(400).json({ error: "Ledger entry id required" });

      const updated = await sql`
        UPDATE entity_ledger SET
          post_date = COALESCE(${post_date || null}, post_date),
          document_no = COALESCE(${document_no || null}, document_no),
          entry_type = COALESCE(${entry_type || null}, entry_type),
          narration = COALESCE(${narration || null}, narration),
          debit = ${parseFloat(debit || 0)},
          credit = ${parseFloat(credit || 0)},
          payment_mode = COALESCE(${payment_mode || null}, payment_mode),
          bank_name = COALESCE(${bank_name || null}, bank_name),
          attachments_json = COALESCE(${attachments_json || null}, attachments_json)
        WHERE id = ${recId}
        RETURNING *
      `;

      return res.status(200).json({ success: true, entry: updated[0], message: "Ledger entry updated successfully!" });
    }

    else if (action === "entity-ledger-delete") {
      const recId = safeInt(req.query.id || req.body?.id);
      if (!recId) return res.status(400).json({ error: "Ledger entry id required" });

      await sql`DELETE FROM entity_ledger WHERE id = ${recId}`;
      return res.status(200).json({ success: true, message: "Ledger entry deleted successfully!" });
    }

    else if (action === "entity-ledger-update-opening") {
      const { entity_type, entity_id, opening_balance, opening_balance_type, opening_balance_date, account_code } = req.body;
      const eType = (entity_type || "supplier").toLowerCase().trim();
      const eId = safeInt(entity_id);
      if (!eId) return res.status(400).json({ error: "entity_id required" });

      const opBal = parseFloat(opening_balance || 0);
      const opType = (opening_balance_type || (eType === "supplier" ? "Credit" : "Debit")).trim();
      const opDate = opening_balance_date || '2025-04-01';
      const accCode = (account_code || '').trim() || null;

      if (eType === "supplier") {
        await sql`
          UPDATE suppliers SET
            opening_balance = ${opBal},
            opening_balance_type = ${opType},
            opening_balance_date = ${opDate},
            account_code = COALESCE(${accCode}, account_code)
          WHERE id = ${eId}
        `;
      } else {
        await sql`
          UPDATE dealers SET
            opening_balance = ${opBal},
            opening_balance_type = ${opType},
            opening_balance_date = ${opDate},
            account_code = COALESCE(${accCode}, account_code)
          WHERE id = ${eId}
        `;
      }

      return res.status(200).json({ success: true, message: "Opening balance updated successfully!" });
    }

    // ═══════════════ HSN MASTER / GST RATES ═══════════════
    else if (action === "hsn-list") {
      try {
        await sql`
          INSERT INTO hsn_codes (code, gst_rate, is_active)
          SELECT DISTINCT TRIM(p.hsn_sac), MAX(p.gst_rate), true
          FROM products p
          WHERE p.hsn_sac IS NOT NULL AND TRIM(p.hsn_sac) != ''
            AND NOT EXISTS (
              SELECT 1 FROM hsn_codes h WHERE LOWER(h.code) = LOWER(TRIM(p.hsn_sac))
            )
          GROUP BY TRIM(p.hsn_sac)
        `;
      } catch (syncErr) {
        console.warn("hsn_codes auto-sync info:", syncErr.message);
      }

      const rows = await sql`SELECT * FROM hsn_codes ORDER BY is_active DESC, code ASC`;
      return res.status(200).json({ success: true, hsn_codes: rows });
    }

    else if (action === "save-hsn") {
      const userRole = (user?.role || '').toLowerCase();
      if (userRole !== 'superadmin') {
        return res.status(403).json({ error: "Access denied. Only Superadmin can create or edit HSN Master GST rates." });
      }

      const { id, code, description, gst_rate, is_active } = req.body;
      if (!code || !code.toString().trim()) return res.status(400).json({ error: "HSN / SAC Code is required" });

      const cleanCode = code.toString().trim();
      const rate = parseFloat(gst_rate || 0);
      const activeStatus = is_active !== undefined ? Boolean(is_active) : true;

      let savedRecord;
      if (id) {
        const updated = await sql`
          UPDATE hsn_codes SET
            code = ${cleanCode},
            description = ${description || null},
            gst_rate = ${rate},
            is_active = ${activeStatus},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${safeInt(id)}
          RETURNING *
        `;
        savedRecord = updated[0];
      } else {
        const existing = await sql`SELECT id FROM hsn_codes WHERE LOWER(code) = LOWER(${cleanCode}) LIMIT 1`;
        if (existing.length > 0) {
          const updated = await sql`
            UPDATE hsn_codes SET
              description = ${description || null},
              gst_rate = ${rate},
              is_active = ${activeStatus},
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ${existing[0].id}
            RETURNING *
          `;
          savedRecord = updated[0];
        } else {
          const inserted = await sql`
            INSERT INTO hsn_codes (code, description, gst_rate, is_active)
            VALUES (${cleanCode}, ${description || null}, ${rate}, ${activeStatus})
            RETURNING *
          `;
          savedRecord = inserted[0];
        }
      }

      return res.status(200).json({ success: true, hsn: savedRecord, message: "HSN Code saved successfully!" });
    }

    else if (action === "delete-hsn") {
      const userRole = (user?.role || '').toLowerCase();
      if (userRole !== 'superadmin') {
        return res.status(403).json({ error: "Access denied. Only Superadmin can delete HSN Master codes." });
      }

      const hsnId = safeInt(req.query.id || req.body?.id);
      if (!hsnId) return res.status(400).json({ error: "HSN Code ID required" });

      await sql`DELETE FROM hsn_codes WHERE id = ${hsnId}`;
      return res.status(200).json({ success: true, message: "HSN Code deleted successfully!" });
    }

    // ═══════════════ PRODUCTS ═══════════════
    else if (action === "products") {
      const userRole = (user.role || "").toLowerCase();
      const isSuperAdmin = (userRole === "superadmin");

      let targetCompId = null;
      if (isSuperAdmin) {
        if (!isAll && compQuery && compQuery !== 'all') {
          targetCompId = safeInt(compQuery);
        }
      } else {
        const userCompId = safeInt(user.company_id) || 1;
        const requestedCompId = safeInt(compQuery);
        if (requestedCompId && requestedCompId !== userCompId) {
          const uCompRows = await sql`SELECT id, parent_company_id, gstin FROM companies WHERE id = ${userCompId}`;
          const uComp = uCompRows[0];
          const rootId = uComp?.parent_company_id ? parseInt(uComp.parent_company_id) : (uComp ? parseInt(uComp.id) : userCompId);
          const gstinVal = uComp?.gstin ? uComp.gstin.trim() : null;

          let allowed;
          if (gstinVal) {
            allowed = await sql`
              SELECT id FROM companies 
              WHERE id = ${requestedCompId} 
                AND (id = ${rootId} 
                     OR parent_company_id = ${rootId} 
                     OR (gstin IS NOT NULL AND gstin != '' AND LOWER(TRIM(gstin)) = LOWER(TRIM(${gstinVal}))))
            `;
          } else {
            allowed = await sql`
              SELECT id FROM companies 
              WHERE id = ${requestedCompId} 
                AND (id = ${rootId} 
                     OR parent_company_id = ${rootId})
            `;
          }
          if (allowed.length > 0) {
            targetCompId = requestedCompId;
          } else {
            targetCompId = userCompId;
          }
        } else {
          targetCompId = userCompId;
        }
      }

      // Automatically re-sequence SKU numbers starting from SKU-001 with continuous sequence per company
      if (targetCompId) {
        await resequenceCompanySkus(sql, targetCompId);
      } else {
        const distinctComps = await sql`SELECT DISTINCT company_id FROM products WHERE is_active = true AND company_id IS NOT NULL`;
        for (const dc of distinctComps) {
          await resequenceCompanySkus(sql, dc.company_id);
        }
      }

            let rows;
      if (targetCompId) {
        rows = await sql`
          SELECT p.*, v.legal_name as supplier_name, c.name as company_name
          FROM products p
          LEFT JOIN suppliers v ON p.supplier_id = v.id
          LEFT JOIN companies c ON p.company_id = c.id
          WHERE p.company_id = ${targetCompId} AND p.is_active = true
          ORDER BY p.id ASC
        `;
      } else {
        rows = await sql`
          SELECT p.*, v.legal_name as supplier_name, c.name as company_name
          FROM products p
          LEFT JOIN suppliers v ON p.supplier_id = v.id
          LEFT JOIN companies c ON p.company_id = c.id
          WHERE p.is_active = true
          ORDER BY c.name ASC, p.id ASC
        `;
        rows.forEach((r, idx) => {
          r.all_companies_sku = `SKU-${String(idx + 1).padStart(3, '0')}`;
        });
      }
      return res.status(200).json({ success: true, products: rows });
    }

    else if (action === "product-update") {
      const {
        id, sku, name, brand, model, hsn_sac, unit_of_measure, gst_rate,
        purchase_rate, purchase_rate_incl_tax, transport_expenses, selling_percentage,
        selling_rate, mrp, current_stock, min_stock, rack_no, weight, serial_no, supplier_id
      } = req.body;

            const pId = safeInt(id);
      if (!pId || !name) return res.status(400).json({ error: "Product ID and Name required" });

      const curProd = await sql`SELECT company_id, sku FROM products WHERE id = ${pId}`;
      const oldCompId = curProd[0]?.company_id;
      const targetCompId = safeInt(req.body.company_id) || oldCompId || 1;

      const supId = safeInt(supplier_id);
      let finalSku = (sku && sku.toString().trim() !== "" && sku.toString().trim().toLowerCase() !== "auto") ? sku.toString().trim() : (curProd[0]?.sku || null);
      if (!finalSku) {
        const maxNum = await getNextSkuNumber(sql, targetCompId);
        finalSku = `SKU-${String(maxNum + 1).padStart(3, '0')}`;
      }

      if (hsn_sac) {
        const hsnCheck = await trackAndValidateHsn(sql, hsn_sac, gst_rate);
        if (!hsnCheck.valid) {
          return res.status(400).json({ error: hsnCheck.error });
        }
      }

      const rates = calculateRates(
        purchase_rate, purchase_rate_incl_tax, transport_expenses, gst_rate,
        selling_percentage, selling_rate, mrp
      );

      const updated = await sql`
        UPDATE products SET
          company_id = COALESCE(${targetCompId}, company_id),
          sku = ${finalSku},
          name = ${name},
          brand = ${brand || null},
          model = ${model || null},
          hsn_sac = ${hsn_sac || null},
          unit_of_measure = ${unit_of_measure || 'NOS'},
          gst_rate = ${gst_rate !== undefined ? parseFloat(gst_rate) : 0},
          purchase_rate = ${rates.purchase_rate},
          purchase_rate_incl_tax = ${rates.purchase_rate_incl_tax},
          transport_expenses = ${rates.transport_expenses},
          selling_percentage = ${rates.selling_percentage},
          selling_rate = ${rates.selling_rate},
          mrp = ${rates.mrp},
          current_stock = ${current_stock !== undefined ? parseInt(current_stock, 10) : 0},
          min_stock = ${min_stock !== undefined ? parseInt(min_stock, 10) : 5},
          rack_no = ${rack_no || null},
          weight = COALESCE(${weight !== undefined && weight !== null && weight !== '' && !isNaN(parseFloat(weight)) ? parseFloat(weight) : null}, weight),
          serial_no = ${serial_no ? serial_no.toString().trim() : null},
          supplier_id = ${supId}
        WHERE id = ${pId}
        RETURNING *
      `;

      if (oldCompId && targetCompId !== oldCompId) {
        await resequenceCompanySkus(sql, oldCompId);
        await resequenceCompanySkus(sql, targetCompId);
      }
      return res.status(200).json({ success: true, product: updated[0], message: "Product updated successfully" });
    }

        else if (action === "product-delete") {
      const pId = safeInt(req.query.id || req.body?.id);
      if (!pId) return res.status(400).json({ error: "Product ID required" });

      const prodRows = await sql`SELECT company_id, sku FROM products WHERE id = ${pId}`;
      const compId = prodRows[0]?.company_id;
      const oldSku = prodRows[0]?.sku || '';

      await sql`UPDATE products SET is_active = false, sku = ${'DEL-' + pId + '-' + oldSku} WHERE id = ${pId}`;

      if (compId) {
        await resequenceCompanySkus(sql, compId);
      }

      return res.status(200).json({ success: true, message: "Product deleted and SKU sequence adjusted successfully!" });
    }

    else if (action === "realign-skus" || action === "resequence-skus") {
      const compId = safeInt(req.query.company_id || req.body?.company_id);
      if (compId) {
        await resequenceCompanySkus(sql, compId);
      } else {
        const distinctComps = await sql`SELECT DISTINCT company_id FROM products WHERE is_active = true AND company_id IS NOT NULL`;
        for (const dc of distinctComps) {
          await resequenceCompanySkus(sql, dc.company_id);
        }
      }
      return res.status(200).json({ success: true, message: "SKU codes successfully aligned and sequenced from SKU-001!" });
    }

    else if (action === "product-create" || action === "add-product") {
      const {
        company_id, sku, name, brand, model, hsn_sac, unit_of_measure, gst_rate,
        purchase_rate, purchase_rate_incl_tax, transport_expenses, selling_percentage,
        selling_rate, mrp, current_stock, min_stock, rack_no, weight, serial_no, supplier_id,
        serial_tracking, warranty_duration
      } = req.body;

      const compId = safeInt(company_id) || safeInt(user.company_id) || 1;
      if (!compId || !name) return res.status(400).json({ error: "Company and Product Name required" });

      if (hsn_sac) {
        const hsnCheck = await trackAndValidateHsn(sql, hsn_sac, gst_rate);
        if (!hsnCheck.valid) {
          return res.status(400).json({ error: hsnCheck.error });
        }
      }

      const supId = safeInt(supplier_id);
      let finalSku = (sku && sku.toString().trim() !== "") ? sku.toString().trim() : null;
      if (!finalSku) {
        const maxNum = await getNextSkuNumber(sql, compId);
        finalSku = `SKU-${String(maxNum + 1).padStart(3, '0')}`;
      }

      const rates = calculateRates(
        purchase_rate, purchase_rate_incl_tax, transport_expenses, gst_rate,
        selling_percentage, selling_rate, mrp
      );

      const newProd = await sql`
        INSERT INTO products (
          company_id, sku, name, brand, model, hsn_sac, unit_of_measure, gst_rate,
          purchase_rate, purchase_rate_incl_tax, transport_expenses, selling_percentage,
          selling_rate, mrp, current_stock, min_stock, rack_no, weight, serial_no, supplier_id,
          serial_tracking, warranty_duration
        ) VALUES (
          ${compId}, ${finalSku}, ${name}, ${brand || null}, ${model || null}, ${hsn_sac || null},
          ${unit_of_measure || 'NOS'}, ${gst_rate ? parseFloat(gst_rate) : 0},
          ${rates.purchase_rate}, ${rates.purchase_rate_incl_tax}, ${rates.transport_expenses}, ${rates.selling_percentage},
          ${rates.selling_rate}, ${rates.mrp}, ${current_stock ? parseInt(current_stock, 10) : 0},
          ${min_stock ? parseInt(min_stock, 10) : 5}, ${rack_no || null}, ${weight ? parseFloat(weight) : 0}, ${serial_no ? serial_no.toString().trim() : null}, ${supId},
          ${serial_tracking || false}, ${warranty_duration || null}
        )
        RETURNING *
      `;

      return res.status(200).json({ success: true, product: newProd[0], message: "Product created successfully" });
    }

    else if (action === "bulk-create") {
      const { company_id, products } = req.body;
      const compId = safeInt(company_id) || safeInt(user.company_id) || 1;
      if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: "Array of products required for bulk create" });
      }

      const compList = await sql`SELECT id, LOWER(name) as lower_name FROM companies WHERE is_active = true`;
      const compMap = new Map();
      compList.forEach(c => { compMap.set(c.lower_name.trim(), c.id); });

      let createdCount = 0;
      let updatedCount = 0;
      const warnings = [];

      for (const p of products) {
        if (!p.name) continue;
        let pCompId = compId;
        const rawCompName = (p.company || p.company_name || "").toString().trim().toLowerCase();
        if (rawCompName && compMap.has(rawCompName)) {
          pCompId = compMap.get(rawCompName);
        }

        let supId = safeInt(p.supplier_id);
        const supName = (p.supplier_name || p.supplier || p.dealer || "").toString().trim();

        if (!supId && supName) {
          const matchSup = await sql`
            SELECT id FROM suppliers
            WHERE (company_id = ${pCompId} OR company_id IS NULL) AND (LOWER(legal_name) = LOWER(${supName}) OR LOWER(trade_name) = LOWER(${supName}))
            LIMIT 1
          `;
          if (matchSup.length > 0) {
            supId = matchSup[0].id;
          } else {
            const newSup = await sql`
              INSERT INTO suppliers (company_id, legal_name, is_active)
              VALUES (${pCompId}, ${supName}, true)
              RETURNING id
            `;
            if (newSup.length > 0) supId = newSup[0].id;
          }
        }
        p.supplier_id = supId;

        const resObj = await upsertProduct(sql, pCompId, p, { mode: 'inventory_upload' });
        if (resObj) {
          if (resObj.isCreated) createdCount++;
          if (resObj.isUpdated) updatedCount++;
          if (resObj.warning) warnings.push(`[${p.name}] ${resObj.warning}`);
        }
      }

      for (const cid of touchedCompIds) {
        await resequenceCompanySkus(sql, cid);
      }

      let msg = `Bulk inventory import completed! ${createdCount} new product(s) created, ${updatedCount} existing product(s) updated.`;
      if (warnings.length > 0) {
        msg += ` (${warnings.length} GST rate mismatch warning(s) flagged).`;
      }

      return res.status(200).json({
        success: true,
        createdCount,
        updatedCount,
        count: createdCount + updatedCount,
        warnings,
        message: msg
      });
    }

    // ═══════════════ INTER-BRANCH TRANSFERS ═══════════════
    else if (action === "inter-branch-list") {
      const statusFilter = req.query.status || "all";
      const requestedCompId = safeInt(req.query.company_id);
      const userRole = (user.role || "").toLowerCase();
      const isSuperAdmin = (userRole === "superadmin");

      let targetCompanyIds = [];

      if (isSuperAdmin) {
        if (requestedCompId && !isAll) {
          targetCompanyIds = [requestedCompId];
          const childBranches = await sql`SELECT id FROM companies WHERE parent_company_id = ${requestedCompId}`;
          childBranches.forEach(b => { if (!targetCompanyIds.includes(b.id)) targetCompanyIds.push(b.id); });
        }
      } else {
        const userCompId = safeInt(user.company_id) || 1;
        const compRows = await sql`SELECT id, parent_company_id, gstin FROM companies WHERE id = ${userCompId}`;
        const uComp = compRows[0];
        const rootId = uComp?.parent_company_id ? parseInt(uComp.parent_company_id) : (uComp ? parseInt(uComp.id) : userCompId);
        const gstinVal = uComp?.gstin ? uComp.gstin.trim() : null;

        let familyRows;
        if (gstinVal) {
          familyRows = await sql`
            SELECT id FROM companies 
            WHERE id = ${rootId} 
               OR parent_company_id = ${rootId}
               OR (gstin IS NOT NULL AND gstin != '' AND LOWER(TRIM(gstin)) = LOWER(TRIM(${gstinVal})))
          `;
        } else {
          familyRows = await sql`
            SELECT id FROM companies 
            WHERE id = ${rootId} 
               OR parent_company_id = ${rootId}
          `;
        }
        const allFamilyIds = familyRows.map(r => r.id);
        if (!allFamilyIds.includes(userCompId)) allFamilyIds.push(userCompId);

        if (requestedCompId && allFamilyIds.includes(requestedCompId)) {
          targetCompanyIds = [requestedCompId];
        } else {
          targetCompanyIds = allFamilyIds;
        }
      }

      let rows;
      if (targetCompanyIds.length > 0) {
        if (statusFilter !== "all") {
          rows = await sql`
            SELECT t.*, 
                   t.transfer_number as transfer_code,
                   t.vehicle_details as vehicle_no,
                   t.driver_info as driver_name,
                   t.receipt_attachment_url as receipt_image,
                   t.dispatch_date_time as dispatched_at,
                   t.received_date_time as received_at,
                   fc.name as from_company_name, 
                   fc.gstin as from_company_gstin,
                   fc.phone as from_company_phone,
                   fc.address as from_company_address,
                   fc.hsn_code as from_company_hsn,
                   tc.name as to_company_name,
                   tc.gstin as to_company_gstin,
                   tc.phone as to_company_phone,
                   tc.address as to_company_address,
                   COALESCE(NULLIF(p.hsn_sac, ''), NULLIF(fc.hsn_code, ''), NULLIF(t.hsn_sac, ''), '') as hsn_code,
                   COALESCE(p.gst_rate, 18) as gst_rate,
                   COALESCE(p.selling_rate, p.purchase_rate, 0) as unit_price,
                   p.current_stock as source_current_stock
            FROM inter_branch_transfers t
            LEFT JOIN companies fc ON t.from_company_id = fc.id
            LEFT JOIN companies tc ON t.to_company_id = tc.id
            LEFT JOIN products p ON t.product_id = p.id
            WHERE t.status = ${statusFilter}
              AND (t.from_company_id = ANY(${targetCompanyIds}) OR t.to_company_id = ANY(${targetCompanyIds}))
            ORDER BY t.created_at DESC
          `;
        } else {
          rows = await sql`
            SELECT t.*, 
                   t.transfer_number as transfer_code,
                   t.vehicle_details as vehicle_no,
                   t.driver_info as driver_name,
                   t.receipt_attachment_url as receipt_image,
                   t.dispatch_date_time as dispatched_at,
                   t.received_date_time as received_at,
                   fc.name as from_company_name, 
                   fc.gstin as from_company_gstin,
                   fc.phone as from_company_phone,
                   fc.address as from_company_address,
                   fc.hsn_code as from_company_hsn,
                   tc.name as to_company_name,
                   tc.gstin as to_company_gstin,
                   tc.phone as to_company_phone,
                   tc.address as to_company_address,
                   COALESCE(NULLIF(p.hsn_sac, ''), NULLIF(fc.hsn_code, ''), NULLIF(t.hsn_sac, ''), '') as hsn_code,
                   COALESCE(p.gst_rate, 18) as gst_rate,
                   COALESCE(p.selling_rate, p.purchase_rate, 0) as unit_price,
                   p.current_stock as source_current_stock
            FROM inter_branch_transfers t
            LEFT JOIN companies fc ON t.from_company_id = fc.id
            LEFT JOIN companies tc ON t.to_company_id = tc.id
            LEFT JOIN products p ON t.product_id = p.id
            WHERE (t.from_company_id = ANY(${targetCompanyIds}) OR t.to_company_id = ANY(${targetCompanyIds}))
            ORDER BY t.created_at DESC
          `;
        }
      } else {
        if (statusFilter !== "all") {
          rows = await sql`
            SELECT t.*, 
                   t.transfer_number as transfer_code,
                   t.vehicle_details as vehicle_no,
                   t.driver_info as driver_name,
                   t.receipt_attachment_url as receipt_image,
                   t.dispatch_date_time as dispatched_at,
                   t.received_date_time as received_at,
                   fc.name as from_company_name, 
                   fc.gstin as from_company_gstin,
                   fc.phone as from_company_phone,
                   fc.address as from_company_address,
                   fc.hsn_code as from_company_hsn,
                   tc.name as to_company_name,
                   tc.gstin as to_company_gstin,
                   tc.phone as to_company_phone,
                   tc.address as to_company_address,
                   COALESCE(NULLIF(p.hsn_sac, ''), NULLIF(fc.hsn_code, ''), NULLIF(t.hsn_sac, ''), '') as hsn_code,
                   COALESCE(p.gst_rate, 18) as gst_rate,
                   COALESCE(p.selling_rate, p.purchase_rate, 0) as unit_price,
                   p.current_stock as source_current_stock
            FROM inter_branch_transfers t
            LEFT JOIN companies fc ON t.from_company_id = fc.id
            LEFT JOIN companies tc ON t.to_company_id = tc.id
            LEFT JOIN products p ON t.product_id = p.id
            WHERE t.status = ${statusFilter}
            ORDER BY t.created_at DESC
          `;
        } else {
          rows = await sql`
            SELECT t.*, 
                   t.transfer_number as transfer_code,
                   t.vehicle_details as vehicle_no,
                   t.driver_info as driver_name,
                   t.receipt_attachment_url as receipt_image,
                   t.dispatch_date_time as dispatched_at,
                   t.received_date_time as received_at,
                   fc.name as from_company_name, 
                   fc.gstin as from_company_gstin,
                   fc.phone as from_company_phone,
                   fc.address as from_company_address,
                   fc.hsn_code as from_company_hsn,
                   tc.name as to_company_name,
                   tc.gstin as to_company_gstin,
                   tc.phone as to_company_phone,
                   tc.address as to_company_address,
                   COALESCE(NULLIF(p.hsn_sac, ''), NULLIF(fc.hsn_code, ''), NULLIF(t.hsn_sac, ''), '') as hsn_code,
                   COALESCE(p.gst_rate, 18) as gst_rate,
                   COALESCE(p.selling_rate, p.purchase_rate, 0) as unit_price,
                   p.current_stock as source_current_stock
            FROM inter_branch_transfers t
            LEFT JOIN companies fc ON t.from_company_id = fc.id
            LEFT JOIN companies tc ON t.to_company_id = tc.id
            LEFT JOIN products p ON t.product_id = p.id
            ORDER BY t.created_at DESC
          `;
        }
      }
      return res.status(200).json({ success: true, transfers: rows });
    }

    else if (action === "inter-branch-dispatch") {
      const {
        from_company_id, to_company_id, product_id, quantity,
        transport_charges, vehicle_no, vehicle_details, driver_name, driver_phone, driver_info, notes, dispatch_notes, dispatch_date_time
      } = body;

      const fCompId = safeInt(from_company_id);
      const tCompId = safeInt(to_company_id);
      const pId = safeInt(product_id);
      const qty = safeInt(quantity, 0);

      if (!fCompId || !tCompId || !pId || qty <= 0) {
        return res.status(400).json({ error: "Source Branch, Destination Branch, Product, and positive Quantity are required." });
      }
      if (fCompId === tCompId) {
        return res.status(400).json({ error: "Source and Destination branches must be different." });
      }

      // Check if both branches belong to the same company family (same parent group or GSTIN)
      const compRows = await sql`SELECT id, parent_company_id, gstin FROM companies WHERE id IN (${fCompId}, ${tCompId})`;
      if (compRows.length < 2) {
        return res.status(400).json({ error: "Invalid source or destination branch selected." });
      }
      const cFrom = compRows.find(c => c.id === fCompId);
      const cTo = compRows.find(c => c.id === tCompId);

      const rootFrom = cFrom.parent_company_id ? parseInt(cFrom.parent_company_id) : parseInt(cFrom.id);
      const rootTo = cTo.parent_company_id ? parseInt(cTo.parent_company_id) : parseInt(cTo.id);

      const isSameFamily = (
        rootFrom === rootTo ||
        (cFrom.parent_company_id && parseInt(cFrom.parent_company_id) === parseInt(cTo.id)) ||
        (cTo.parent_company_id && parseInt(cTo.parent_company_id) === parseInt(cFrom.id)) ||
        (cFrom.gstin && cTo.gstin && cFrom.gstin.trim().toLowerCase() === cTo.gstin.trim().toLowerCase())
      );

      if (!isSameFamily) {
        return res.status(400).json({ error: "Stock transfer is only allowed between branches of the same company (matching parent group or GSTIN)." });
      }

      // If not superadmin, verify that user belongs to this company family
      const userRole = (user.role || "").toLowerCase();
      if (userRole !== "superadmin") {
        const userCompId = safeInt(user.company_id) || 1;
        const uCompRows = await sql`SELECT id, parent_company_id, gstin FROM companies WHERE id = ${userCompId}`;
        const uComp = uCompRows[0];
        const rootUser = uComp?.parent_company_id ? parseInt(uComp.parent_company_id) : (uComp ? parseInt(uComp.id) : userCompId);
        const userInFamily = (
          userCompId === fCompId ||
          userCompId === tCompId ||
          rootUser === rootFrom ||
          rootUser === rootTo ||
          (uComp?.gstin && cFrom.gstin && uComp.gstin.trim().toLowerCase() === cFrom.gstin.trim().toLowerCase())
        );
        if (!userInFamily) {
          return res.status(403).json({ error: "Unauthorized. You can only dispatch stock between branches in your own company group." });
        }
      }

      const prodRows = await sql`SELECT * FROM products WHERE id = ${pId} AND company_id = ${fCompId}`;
      if (prodRows.length === 0) return res.status(404).json({ error: "Product not found at source branch." });

      const srcProd = prodRows[0];
      if (srcProd.current_stock < qty) {
        return res.status(400).json({ error: `Insufficient stock at source branch. Available: ${srcProd.current_stock}, Requested: ${qty}` });
      }

      // Deduct stock from source branch atomically with concurrency check
      await sql`UPDATE products SET current_stock = GREATEST(0, current_stock - ${qty}) WHERE id = ${pId} AND current_stock >= ${qty}`;

      // Generate transfer number TR-YYYY-XXXX
      const year = new Date().getFullYear();
      const countRes = await sql`SELECT COUNT(*)::int as count FROM inter_branch_transfers`;
      const seq = (countRes[0]?.count || 0) + 1;
      const transfer_number = `TR-${year}-${String(seq).padStart(4, '0')}`;

      const dispatchTime = dispatch_date_time ? new Date(dispatch_date_time) : new Date();

      const vehStr = vehicle_no || vehicle_details || null;
      const drvStr = driver_info || [driver_name, driver_phone].filter(Boolean).join(" | ") || null;
      const ntsStr = notes || dispatch_notes || null;

      const newTransfer = await sql`
        INSERT INTO inter_branch_transfers (
          transfer_number, from_company_id, to_company_id, product_id,
          product_name, brand, model, hsn_sac, quantity,
          dispatch_date_time, transport_charges, vehicle_details, driver_info, dispatch_notes, dispatched_by_user_id, status
        ) VALUES (
          ${transfer_number}, ${fCompId}, ${tCompId}, ${pId},
          ${srcProd.name}, ${srcProd.brand || null}, ${srcProd.model || null}, ${srcProd.hsn_sac || null}, ${qty},
          ${dispatchTime}, ${parseFloat(transport_charges || 0)}, ${vehStr}, ${drvStr}, ${ntsStr}, ${user.id || null}, 'in_transit'
        )
        RETURNING *
      `;

      return res.status(200).json({ success: true, transfer: newTransfer[0], message: `Stock of ${qty} units dispatched successfully. Transfer #${transfer_number}` });
    }

    else if (action === "inter-branch-receive") {
      const transferId = safeInt(req.query.id || req.query.transfer_id || body.id || body.transfer_id || req.body?.id || req.body?.transfer_id);
      if (!transferId) return res.status(400).json({ error: "Transfer ID required" });

      const tRows = await sql`SELECT * FROM inter_branch_transfers WHERE id = ${transferId}`;
      if (tRows.length === 0) return res.status(404).json({ error: "Transfer record not found" });

      const transfer = tRows[0];
      if (transfer.status !== 'in_transit') {
        return res.status(400).json({ error: `Transfer is already ${transfer.status}` });
      }

      const receivingVeh = req.body?.receiving_vehicle_no || req.body?.receiving_vehicle_details || body.receiving_vehicle_no || body.receiving_vehicle_details || null;
      const receiptImg = req.body?.receipt_image || req.body?.receipt_attachment_url || body.receipt_image || body.receipt_attachment_url || null;
      const recNotes = req.body?.receiving_notes || body.receiving_notes || null;
      const receiveTime = req.body?.received_date_time ? new Date(req.body.received_date_time) : new Date();

      // Find matching product in destination company (by name and model)
      let destProd = [];
      if (transfer.model) {
        destProd = await sql`
          SELECT * FROM products 
          WHERE company_id = ${transfer.to_company_id} 
            AND LOWER(name) = LOWER(${transfer.product_name})
            AND LOWER(model) = LOWER(${transfer.model})
            AND is_active = true
          LIMIT 1
        `;
      } else {
        destProd = await sql`
          SELECT * FROM products 
          WHERE company_id = ${transfer.to_company_id} 
            AND LOWER(name) = LOWER(${transfer.product_name})
            AND (model IS NULL OR model = '')
            AND is_active = true
          LIMIT 1
        `;
      }

      if (destProd.length > 0) {
        // Increase stock at destination
        await sql`UPDATE products SET current_stock = current_stock + ${transfer.quantity} WHERE id = ${destProd[0].id}`;
      } else {
        // Fetch full source product info
        const srcProdRows = await sql`SELECT * FROM products WHERE id = ${transfer.product_id}`;
        const srcProd = srcProdRows[0] || {};
        const maxNum = await getNextSkuNumber(sql, transfer.to_company_id);
        const newSku = `SKU-${String(maxNum + 1).padStart(3, '0')}`;

        await sql`
          INSERT INTO products (
            company_id, sku, name, brand, model, hsn_sac, unit_of_measure, gst_rate,
            purchase_rate, purchase_rate_incl_tax, transport_expenses, selling_percentage,
            selling_rate, mrp, current_stock, min_stock, rack_no, supplier_id, is_active
          ) VALUES (
            ${transfer.to_company_id}, ${newSku}, ${transfer.product_name}, ${transfer.brand || srcProd.brand || null},
            ${transfer.model || srcProd.model || null}, ${transfer.hsn_sac || srcProd.hsn_sac || null},
            ${srcProd.unit_of_measure || 'NOS'}, ${srcProd.gst_rate || 0},
            ${srcProd.purchase_rate || 0}, ${srcProd.purchase_rate_incl_tax || 0}, ${srcProd.transport_expenses || 0},
            ${srcProd.selling_percentage || 0}, ${srcProd.selling_rate || 0}, ${srcProd.mrp || null},
            ${transfer.quantity}, ${srcProd.min_stock || 5}, ${srcProd.rack_no || null}, ${srcProd.supplier_id || null}, true
          )
        `;
      }

      // Update transfer record
      const updatedT = await sql`
        UPDATE inter_branch_transfers SET
          status = 'received',
          received_date_time = ${receiveTime},
          receiving_vehicle_details = ${receivingVeh},
          receipt_attachment_url = ${receiptImg},
          receiving_notes = ${recNotes},
          received_by_user_id = ${user.id || null}
        WHERE id = ${transferId}
        RETURNING *
      `;

      return res.status(200).json({ success: true, transfer: updatedT[0], message: "Stock received successfully into destination branch inventory!" });
    }

    else if (action === "inter-branch-cancel" || action === "inter-branch-delete") {
      const transferId = safeInt(req.query.id || req.query.transfer_id || body.id || body.transfer_id || req.body?.id || req.body?.transfer_id);
      if (!transferId) return res.status(400).json({ error: "Transfer ID required." });

      const tRows = await sql`SELECT * FROM inter_branch_transfers WHERE id = ${transferId}`;
      if (tRows.length === 0) return res.status(404).json({ error: "Transfer record not found." });

      const transfer = tRows[0];
      const userRole = (user.role || "").toLowerCase();

      if (action === "inter-branch-delete") {
        if (userRole !== 'superadmin' && userRole !== 'storeadmin' && userRole !== 'admin') {
          return res.status(403).json({ error: "Only Super Admin and Store Admin can delete transfer records." });
        }
        await sql`DELETE FROM inter_branch_transfers WHERE id = ${transferId}`;
        return res.status(200).json({ success: true, message: "Transfer record deleted successfully." });
      }

      if (transfer.status === 'in_transit') {
        if (transfer.product_id) {
          await sql`UPDATE products SET current_stock = current_stock + ${transfer.quantity} WHERE id = ${transfer.product_id}`;
        }
        await sql`UPDATE inter_branch_transfers SET status = 'cancelled' WHERE id = ${transferId}`;
        return res.status(200).json({ success: true, message: `Transfer cancelled and ${transfer.quantity} units restored to source branch.` });
      }

      if (userRole === 'superadmin' || userRole === 'storeadmin' || userRole === 'admin') {
        await sql`DELETE FROM inter_branch_transfers WHERE id = ${transferId}`;
        return res.status(200).json({ success: true, message: "Transfer record deleted successfully." });
      } else {
        return res.status(400).json({ error: `Cannot cancel transfer with status '${transfer.status}'.` });
      }
    }

    else if (action === "reorder-check") {
      let rows;
      if (isAll) {
        rows = await sql`
          SELECT p.*, v.legal_name as supplier_name, c.name as company_name,
                 (
                   SELECT json_build_object('id', po.id, 'po_number', po.po_number, 'status', po.status, 'order_date', po.order_date)
                   FROM purchase_orders po
                   JOIN purchase_order_items poi ON poi.po_id = po.id
                   WHERE poi.product_id = p.id AND (po.status IS NULL OR LOWER(po.status) NOT IN ('deleted', 'cancelled', 'received', 'completed'))
                   ORDER BY po.id DESC LIMIT 1
                 ) as active_po
          FROM products p
          LEFT JOIN suppliers v ON p.supplier_id = v.id
          LEFT JOIN companies c ON p.company_id = c.id
          WHERE p.current_stock <= p.min_stock AND p.is_active = true
          ORDER BY p.current_stock ASC
        `;
      } else {
        const cId = safeInt(compQuery) || safeInt(user.company_id) || 1;
        rows = await sql`
          SELECT p.*, v.legal_name as supplier_name, c.name as company_name,
                 (
                   SELECT json_build_object('id', po.id, 'po_number', po.po_number, 'status', po.status, 'order_date', po.order_date)
                   FROM purchase_orders po
                   JOIN purchase_order_items poi ON poi.po_id = po.id
                   WHERE poi.product_id = p.id AND (po.status IS NULL OR LOWER(po.status) NOT IN ('deleted', 'cancelled', 'received', 'completed'))
                   ORDER BY po.id DESC LIMIT 1
                 ) as active_po
          FROM products p
          LEFT JOIN suppliers v ON p.supplier_id = v.id
          LEFT JOIN companies c ON p.company_id = c.id
          WHERE p.company_id = ${cId} AND p.current_stock <= p.min_stock AND p.is_active = true
          ORDER BY p.current_stock ASC
        `;
      }
      return res.status(200).json({ success: true, low_stock: rows });
    }

    else if (action === "auto-create-po") {
      const { orders, company_id } = req.body;
      const compId = safeInt(company_id) || safeInt(user.company_id) || 1;

      if (!Array.isArray(orders) || orders.length === 0) {
        return res.status(400).json({ error: "Orders list required for generating PO" });
      }

      const createdPOs = [];
      for (const ord of orders) {
        const supId = safeInt(ord.supplier_id);
        if (!supId) {
          return res.status(400).json({ error: "Supplier selection is mandatory to generate a Purchase Order!" });
        }

        const items = ord.items || [];
        if (items.length === 0) continue;

        const poNum = "PO-REORDER-" + Math.floor(100000 + Math.random() * 900000);
        let taxableSum = 0;
        let taxSum = 0;

        for (const i of items) {
          const qty = safeInt(i.quantity) || 1;
          const rate = parseFloat(i.rate || 0);
          const pId = safeInt(i.product_id);
          let gstRate = 18;
          if (pId) {
            const pRes = await sql`SELECT gst_rate FROM products WHERE id = ${pId}`;
            if (pRes.length > 0 && pRes[0].gst_rate !== null) gstRate = parseFloat(pRes[0].gst_rate);
          }
          const lineTaxable = qty * rate;
          const lineTax = (lineTaxable * gstRate) / 100;
          taxableSum += lineTaxable;
          taxSum += lineTax;
        }

        const grandTotalPO = taxableSum + taxSum;

        const compArr = await sql`SELECT state FROM companies WHERE id = ${compId}`;
        const compState = (compArr[0]?.state || "").trim().toLowerCase();
        const reqState = (ord.supply_state || "").trim().toLowerCase();
        const isSameState = (!compState || !reqState || reqState === compState || reqState === "same state" || reqState.includes("intra"));
        const gstTypeStr = isSameState ? "Intra-State (CGST+SGST)" : "Inter-State (IGST)";

        const po = await sql`
          INSERT INTO purchase_orders (company_id, po_number, supplier_id, order_date, total_amount, notes, created_by, status)
          VALUES (${compId}, ${poNum}, ${supId}, NOW(), ${grandTotalPO}, ${ord.notes || `Reorder PO [${gstTypeStr}] - Taxable: ₹${taxableSum.toFixed(2)}, Tax: ₹${taxSum.toFixed(2)}`}, ${user.id}, 'created')
          RETURNING *
        `;

        for (const i of items) {
          const pId = safeInt(i.product_id);
          const qty = safeInt(i.quantity) || 1;
          const rate = parseFloat(i.rate || 0);
          await sql`
            INSERT INTO purchase_order_items (po_id, product_id, quantity, rate, total)
            VALUES (${po[0].id}, ${pId}, ${qty}, ${rate}, ${qty * rate})
          `;

          // If product had no assigned supplier, update supplier_id on product
          if (pId) {
            await sql`UPDATE products SET supplier_id = ${supId} WHERE id = ${pId} AND supplier_id IS NULL`;
          }
        }
        createdPOs.push(po[0]);
      }

      return res.status(200).json({
        success: true,
        created_pos: createdPOs,
        message: `Successfully generated ${createdPOs.length} Purchase Order(s)!`
      });
    }

    // ═══════════════ PURCHASE ORDERS ═══════════════
    else if (action === "po-list") {
      let rows;
      if (isAll) {
        rows = await sql`
          SELECT po.*, v.legal_name as supplier_name, c.name as company_name,
                 (SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.po_id = po.id)::int as item_count
          FROM purchase_orders po
          LEFT JOIN suppliers v ON po.supplier_id = v.id
          LEFT JOIN companies c ON po.company_id = c.id
          ORDER BY po.created_at DESC
        `;
      } else {
        const cId = safeInt(compQuery) || safeInt(user.company_id) || 1;
        rows = await sql`
          SELECT po.*, v.legal_name as supplier_name, c.name as company_name,
                 (SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.po_id = po.id)::int as item_count
          FROM purchase_orders po
          LEFT JOIN suppliers v ON po.supplier_id = v.id
          LEFT JOIN companies c ON po.company_id = c.id
          WHERE po.company_id = ${cId}
          ORDER BY po.created_at DESC
        `;
      }
      return res.status(200).json({ success: true, purchase_orders: rows });
    }

    else if (action === "po-details") {
      const poId = safeInt(req.query.id || req.body?.id);
      if (!poId) return res.status(400).json({ error: "PO ID required" });

      const po = await sql`
        SELECT po.*,
               v.legal_name as supplier_name, v.trade_name as supplier_trade_name, v.gstin as supplier_gstin,
               v.phone as supplier_phone, v.email as supplier_email, v.address as supplier_address, v.contact_person as supplier_contact,
               c.name as company_name, c.address as company_address, c.phone as company_phone, c.email as company_email, c.gstin as company_gstin, c.state as company_state, c.state_code as company_state_code
        FROM purchase_orders po
        LEFT JOIN suppliers v ON po.supplier_id = v.id
        LEFT JOIN companies c ON po.company_id = c.id
        WHERE po.id = ${poId}
      `;
      if (po.length === 0) return res.status(404).json({ error: "Purchase Order not found" });

      const items = await sql`
        SELECT poi.*, p.name as product_name, p.brand, p.model, p.sku, p.hsn_sac, p.unit_of_measure, p.gst_rate
        FROM purchase_order_items poi
        LEFT JOIN products p ON poi.product_id = p.id
        WHERE poi.po_id = ${poId}
      `;

      return res.status(200).json({ success: true, po: po[0], items });
    }

    else if (action === "po-create") {
      const { company_id, supplier_id, order_date, expected_date, items, notes } = req.body;
      const compId = safeInt(company_id) || safeInt(user.company_id) || 1;
      const supId = safeInt(supplier_id);

      if (!compId || !supId || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Company, Supplier, and items array required" });
      }

      const poNum = await getNextFamilyPoNumber(sql, compId);
      let totalAmount = 0;
      items.forEach(i => totalAmount += (parseFloat(i.rate) * parseInt(i.quantity, 10)));

      const po = await sql`
        INSERT INTO purchase_orders (company_id, po_number, supplier_id, order_date, expected_date, total_amount, notes, created_by, status)
        VALUES (${compId}, ${poNum}, ${supId}, ${order_date || 'NOW()'}, ${expected_date || null}, ${totalAmount}, ${notes || null}, ${user.id}, 'created')
        RETURNING *
      `;

      for (const item of items) {
        const itemProdId = safeInt(item.product_id);
        const itemQty = safeInt(item.quantity) || 1;
        const itemRate = parseFloat(item.rate || 0);
        await sql`
          INSERT INTO purchase_order_items (po_id, product_id, quantity, rate, total)
          VALUES (${po[0].id}, ${itemProdId}, ${itemQty}, ${itemRate}, ${itemRate * itemQty})
        `;
      }

      return res.status(200).json({ success: true, po: po[0], message: `Purchase Order ${poNum} created` });
    }

    else if (action === "po-delete") {
      const poId = safeInt(req.query.id || req.body?.id);
      if (!poId) return res.status(400).json({ error: "Purchase Order ID required" });

      await sql`DELETE FROM purchase_orders WHERE id = ${poId}`;
      return res.status(200).json({ success: true, message: "Purchase Order deleted successfully!" });
    }

    else if (action === "po-update") {
      const { id, company_id, supplier_id, status, expected_date, notes, total_amount } = req.body;
      const poId = safeInt(id);
      if (!poId) return res.status(400).json({ error: "Purchase Order ID required" });

      const compId = safeInt(company_id);
      const supId = safeInt(supplier_id);
      const totAmt = total_amount ? parseFloat(total_amount) : null;

      const updated = await sql`
        UPDATE purchase_orders SET
          company_id = COALESCE(${compId}, company_id),
          supplier_id = COALESCE(${supId}, supplier_id),
          status = COALESCE(${status || null}, status),
          expected_date = ${expected_date || null},
          notes = ${notes || null},
          total_amount = COALESCE(${totAmt}, total_amount)
        WHERE id = ${poId}
        RETURNING *
      `;

      return res.status(200).json({ success: true, po: updated[0], message: "Purchase Order updated successfully!" });
    }

    // ═══════════════ STOCK RECEIPT & PURCHASES ═══════════════
    else if (action === "stock-receipt") {
      const { product_id, supplier_id, supply_state, quantity, purchase_rate, bill_no, billed_amount, bill_doc, notes, paid_amount, interest_rate, interest_frequency, due_date, model } = req.body;
      const pId = safeInt(product_id);
      const qty = safeInt(quantity);
      const stateVal = supply_state || "Andhra Pradesh";
      const modelClean = (model && model.toString().trim() !== "") ? model.toString().trim() : null;

      if (!pId || !qty) return res.status(400).json({ error: "product_id and quantity required" });

      const prodRows = await sql`SELECT hsn_sac, gst_rate FROM products WHERE id = ${pId}`;
      if (prodRows.length > 0 && prodRows[0].hsn_sac) {
        const hsnCheck = await trackAndValidateHsn(sql, prodRows[0].hsn_sac, prodRows[0].gst_rate);
        if (!hsnCheck.valid) {
          return res.status(400).json({ error: hsnCheck.error });
        }
      }

      const purRate = purchase_rate ? parseFloat(purchase_rate) : null;
      const supId = safeInt(supplier_id);
      const bAmt = billed_amount ? parseFloat(billed_amount) : (purRate ? purRate * qty : 0);

      const paidAmt = Math.min(bAmt, Math.max(0, parseFloat(paid_amount !== undefined ? paid_amount : bAmt)));
      const pendingAmt = Math.max(0, bAmt - paidAmt);
      const pStatus = pendingAmt <= 0 ? 'paid' : (paidAmt > 0 ? 'partial' : 'unpaid');
      const intRate = parseFloat(interest_rate || 0);
      const intFreq = (interest_frequency || 'monthly').toString().trim().toLowerCase();

      // Update product stock and automatically recalculate rates, selling price & MRP
      let updated;
      if (purRate) {
        const curP = (await sql`SELECT transport_expenses, gst_rate, selling_percentage FROM products WHERE id = ${pId}`)[0] || {};
        const rates = calculateRates(
          purRate,
          null,
          curP.transport_expenses || 0,
          curP.gst_rate || 18,
          curP.selling_percentage || 0,
          null,
          null
        );

        updated = await sql`
          UPDATE products SET
            current_stock = current_stock + ${qty},
            purchase_rate = ${rates.purchase_rate},
            purchase_rate_incl_tax = ${rates.purchase_rate_incl_tax},
            selling_rate = ${rates.selling_rate},
            mrp = ${rates.mrp},
            model = COALESCE(${modelClean}, model),
            supplier_id = COALESCE(${supId}, supplier_id)
          WHERE id = ${pId} RETURNING *
        `;
      } else if (supId) {
        updated = await sql`
          UPDATE products SET current_stock = current_stock + ${qty}, model = COALESCE(${modelClean}, model), supplier_id = ${supId}
          WHERE id = ${pId} RETURNING *
        `;
      } else {
        updated = await sql`
          UPDATE products SET current_stock = current_stock + ${qty}, model = COALESCE(${modelClean}, model)
          WHERE id = ${pId} RETURNING *
        `;
      }

      if (updated.length > 0) {
        const purchaseRec = await sql`
          INSERT INTO purchases (
            company_id, purchase_invoice_no, purchase_date, supplier_id, total_amount, grand_total,
            paid_amount, pending_amount, payment_status, interest_rate, interest_frequency, due_date,
            attachments_json, created_by
          )
          VALUES (
            ${updated[0].company_id}, ${bill_no || null}, NOW(), ${supId || updated[0].supplier_id}, ${bAmt}, ${bAmt},
            ${paidAmt}, ${pendingAmt}, ${pStatus}, ${intRate}, ${intFreq}, ${due_date || null},
            ${bill_doc ? JSON.stringify([bill_doc]) : null}, ${user.id}
          )
          RETURNING *
        `;

        if (purchaseRec.length > 0) {
          await sql`
            INSERT INTO purchase_items (purchase_id, product_id, quantity, rate, total)
            VALUES (${purchaseRec[0].id}, ${pId}, ${qty}, ${purRate || updated[0].purchase_rate || 0}, ${bAmt})
          `;

          // Auto-record supplier purchase bill as an expense in company expenses if paid
          if (paidAmt > 0) {
            let sName = "dealer / Universal Supplier";
            const actualSupId = supId || updated[0].supplier_id;
            if (actualSupId) {
              const vRes = await sql`SELECT legal_name FROM suppliers WHERE id = ${actualSupId}`;
              if (vRes.length > 0) sName = vRes[0].legal_name;
            }
            const compArr = await sql`SELECT state FROM companies WHERE id = ${updated[0].company_id}`;
            const compState = (compArr[0]?.state || "").trim().toLowerCase();
            const reqState = (supply_state || "").trim().toLowerCase();
            const isSameState = (!compState || !reqState || reqState === compState || reqState === "same state" || reqState.includes("intra"));
            const gstTypeStr = isSameState ? "Intra-State (CGST+SGST)" : "Inter-State (IGST)";

            await sql`
              INSERT INTO expenses (
                company_id, expense_date, category, dealer_receiver, amount, payment_mode,
                description, receipt_number, approval_status, created_by
              ) VALUES (
                ${updated[0].company_id}, NOW(), 'Inventory Purchase', ${sName},
                ${paidAmt}, 'bank', ${notes || `Stock Receipt Purchase [${gstTypeStr}] - Bill #${bill_no || 'N/A'}`},
                ${'EXP-PUR-' + purchaseRec[0].id}, 'approved', ${user.id}
              )
            `;
          }
        }

        await sql`
          INSERT INTO inventory_transactions (company_id, product_id, transaction_type, quantity, reference_type, reference_id, performed_by, notes)
          VALUES (${updated[0].company_id}, ${pId}, 'receipt', ${qty}, 'purchase', ${purchaseRec[0]?.id || null}, ${user.id}, ${notes || `Stock receipt [${stateVal}] - Bill #${bill_no || 'N/A'}, Amount ₹${bAmt}`})
        `;
      }

      return res.status(200).json({ success: true, product: updated[0], message: "Stock receipt & purchase entry recorded successfully!" });
    }

    else if (action === "bulk-stock-receipt") {
      const { company_id, receipts } = req.body;
      const compId = safeInt(company_id) || safeInt(user.company_id) || 1;
      if (!compId || !Array.isArray(receipts) || receipts.length === 0) {
        return res.status(400).json({ error: "Company ID and array of receipts required" });
      }

      let count = 0;
      for (const r of receipts) {
        let prodId = safeInt(r.product_id);
        if (!prodId && r.sku) {
          const pBySku = await sql`SELECT id FROM products WHERE company_id = ${compId} AND LOWER(sku) = LOWER(${r.sku})`;
          if (pBySku.length > 0) prodId = pBySku[0].id;
        }
        if (!prodId && r.name) {
          const pByName = await sql`SELECT id FROM products WHERE company_id = ${compId} AND LOWER(name) = LOWER(${r.name})`;
          if (pByName.length > 0) prodId = pByName[0].id;
        }
        if (!prodId) continue;

        const qty = safeInt(r.quantity) || 0;
        if (qty <= 0) continue;

        const purRate = r.purchase_rate ? parseFloat(r.purchase_rate) : null;
        const supId = safeInt(r.supplier_id);
        const bAmt = r.billed_amount ? parseFloat(r.billed_amount) : (purRate ? purRate * qty : 0);

        let updated;
        if (purRate && supId) {
          updated = await sql`
            UPDATE products SET current_stock = current_stock + ${qty}, purchase_rate = ${purRate}, supplier_id = ${supId}
            WHERE id = ${prodId} RETURNING *
          `;
        } else {
          updated = await sql`
            UPDATE products SET current_stock = current_stock + ${qty}
            WHERE id = ${prodId} RETURNING *
          `;
        }

        if (updated.length > 0) {
          const purchaseRec = await sql`
            INSERT INTO purchases (company_id, purchase_invoice_no, purchase_date, supplier_id, total_amount, grand_total, attachments_json, created_by)
            VALUES (${compId}, ${r.bill_no || null}, NOW(), ${supId || updated[0].supplier_id}, ${bAmt}, ${bAmt}, ${r.bill_doc ? JSON.stringify([r.bill_doc]) : null}, ${user.id})
            RETURNING *
          `;

          if (purchaseRec.length > 0) {
            await sql`
              INSERT INTO purchase_items (purchase_id, product_id, quantity, rate, total)
              VALUES (${purchaseRec[0].id}, ${prodId}, ${qty}, ${purRate || updated[0].purchase_rate || 0}, ${bAmt})
            `;

            if (bAmt > 0) {
              let sName = "dealer / Universal Supplier";
              const actualSupId = supId || updated[0].supplier_id;
              if (actualSupId) {
                const vRes = await sql`SELECT legal_name FROM suppliers WHERE id = ${actualSupId}`;
                if (vRes.length > 0) sName = vRes[0].legal_name;
              }
              await sql`
                INSERT INTO expenses (
                  company_id, expense_date, category, dealer_receiver, amount, payment_mode,
                  description, receipt_number, approval_status, created_by
                ) VALUES (
                  ${compId}, NOW(), 'Inventory Purchase', ${sName},
                  ${bAmt}, 'bank', ${r.notes || `Stock Receipt Purchase - Bill #${r.bill_no || 'N/A'}`},
                  ${'EXP-PUR-' + purchaseRec[0].id}, 'approved', ${user.id}
                )
              `;
            }
          }

          await sql`
            INSERT INTO inventory_transactions (company_id, product_id, transaction_type, quantity, reference_type, reference_id, performed_by, notes)
            VALUES (${compId}, ${prodId}, 'receipt', ${qty}, 'purchase', ${purchaseRec[0]?.id || null}, ${user.id}, ${r.notes || `Bulk Stock Receipt - Bill #${r.bill_no || 'N/A'}`})
          `;
          count++;
        }
      }

      return res.status(200).json({ success: true, count, message: `Successfully imported ${count} stock receipts & updated inventory!` });
    }

    else if (action === "multi-purchase-entry") {
      const { company_id, supplier_id, bill_no, purchase_date, items, bill_doc, notes, supply_state, paid_amount, interest_rate, interest_frequency, due_date } = req.body;
      const compId = safeInt(company_id) || safeInt(user.company_id) || 1;
      const supId = safeInt(supplier_id);

      if (!compId || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Company ID and at least 1 item required" });
      }

      for (const item of items) {
        const prodId = safeInt(item.product_id);
        const itemGstRate = parseFloat(item.gst_rate || 18);
        if (prodId) {
          const prodRows = await sql`SELECT hsn_sac, gst_rate FROM products WHERE id = ${prodId}`;
          if (prodRows.length > 0 && prodRows[0].hsn_sac) {
            const hsnCheck = await trackAndValidateHsn(sql, prodRows[0].hsn_sac, itemGstRate);
            if (!hsnCheck.valid) {
              return res.status(400).json({ error: hsnCheck.error });
            }
          }
        }
      }

      let grandTotal = 0;
      items.forEach(i => {
        const qty = safeInt(i.quantity) || 1;
        const rate = parseFloat(i.rate || i.purchase_rate || 0);
        const gstRate = parseFloat(i.gst_rate || 18);
        const transport = parseFloat(i.transport_expenses || 0);
        const packaging = parseFloat(i.packaging_charges || i.packaging || 0);
        const taxable = (qty * rate) + transport + packaging;
        const lineTotal = Math.round((taxable * (1 + gstRate / 100)) * 100) / 100;
        grandTotal += lineTotal;
      });
      const roundOffVal = parseFloat(req.body.round_off || 0) || 0;
      const subtotalAmount = Math.round(grandTotal * 100) / 100;
      grandTotal = Math.round((subtotalAmount + roundOffVal) * 100) / 100;

      const paidAmt = Math.min(grandTotal, Math.max(0, parseFloat(paid_amount !== undefined ? paid_amount : grandTotal)));
      const pendingAmt = Math.max(0, grandTotal - paidAmt);
      const pStatus = pendingAmt <= 0 ? 'paid' : (paidAmt > 0 ? 'partial' : 'unpaid');
      const intRate = parseFloat(interest_rate || 0);
      const intFreq = (interest_frequency || 'monthly').toString().trim().toLowerCase();

      const purchaseRec = await sql`
        INSERT INTO purchases (
          company_id, purchase_invoice_no, purchase_date, supplier_id, total_amount, grand_total, round_off,
          paid_amount, pending_amount, payment_status, interest_rate, interest_frequency, due_date,
          attachments_json, created_by
        )
        VALUES (
          ${compId}, ${bill_no || null}, ${purchase_date ? new Date(purchase_date) : new Date()}, ${supId || null},
          ${grandTotal}, ${grandTotal}, ${roundOffVal}, ${paidAmt}, ${pendingAmt}, ${pStatus}, ${intRate}, ${intFreq}, ${due_date || null},
          ${bill_doc ? JSON.stringify([bill_doc]) : null}, ${user.id}
        )
        RETURNING *
      `;

      const purId = purchaseRec[0].id;

      for (const item of items) {
        const prodId = safeInt(item.product_id);
        const qty = safeInt(item.quantity) || 1;
        const rate = parseFloat(item.rate || item.purchase_rate || 0);
        const gstRate = parseFloat(item.gst_rate || 18);
        const transport = parseFloat(item.transport_expenses || 0);
        const packaging = parseFloat(item.packaging_charges || item.packaging || 0);
        const taxable = (qty * rate) + transport + packaging;
        const lineTotal = Math.round((taxable * (1 + gstRate / 100)) * 100) / 100;
        const itemSupId = safeInt(item.supplier_id) || supId;

        if (prodId) {
          const curP = (await sql`SELECT transport_expenses, packaging_charges, gst_rate, selling_percentage FROM products WHERE id = ${prodId}`)[0] || {};
          const rates = calculateRates(
            rate,
            null,
            curP.transport_expenses || transport || 0,
            gstRate || curP.gst_rate || 18,
            curP.selling_percentage || 0,
            null,
            null,
            curP.packaging_charges || packaging || 0
          );

          await sql`
            UPDATE products SET 
              current_stock = current_stock + ${qty},
              purchase_rate = ${rates.purchase_rate},
              purchase_rate_incl_tax = ${rates.purchase_rate_incl_tax},
              selling_rate = ${rates.selling_rate},
              mrp = ${rates.mrp},
              gst_rate = COALESCE(${gstRate}, gst_rate),
              serial_no = COALESCE(${item.serial_no || item.product_serial_no || null}, serial_no),
              model = COALESCE(${item.model ? item.model.trim() : null}, model),
              supplier_id = COALESCE(${itemSupId}, supplier_id),
              packaging_charges = COALESCE(${packaging > 0 ? packaging : null}, packaging_charges)
            WHERE id = ${prodId}
          `;

          await sql`
            INSERT INTO purchase_items (purchase_id, product_id, quantity, rate, total, serial_no, packaging_charges, transport_expenses, gst_rate)
            VALUES (${purId}, ${prodId}, ${qty}, ${rate}, ${lineTotal}, ${item.serial_no || item.product_serial_no || null}, ${packaging}, ${transport}, ${gstRate})
          `;

          await sql`
            INSERT INTO inventory_transactions (company_id, product_id, transaction_type, quantity, reference_type, reference_id, performed_by, notes)
            VALUES (${compId}, ${prodId}, 'receipt', ${qty}, 'purchase', ${purId}, ${user.id}, ${notes || `Multi-Purchase Entry - Bill #${bill_no || 'N/A'}`})
          `;
        }
      }

      if (paidAmt > 0) {
        let dealerName = "Supplier Purchase";
        if (supId) {
          const vRes = await sql`SELECT legal_name FROM suppliers WHERE id = ${supId}`;
          if (vRes.length > 0) dealerName = vRes[0].legal_name;
        }
        await ensureExpensesColumns(sql);
        await sql`
          INSERT INTO expenses (
            company_id, expense_date, category, dealer_receiver, amount, payment_mode,
            description, receipt_number, approval_status, created_by
          ) VALUES (
            ${compId}, ${purchase_date ? new Date(purchase_date) : new Date()}, 'Inventory Purchase', ${dealerName},
            ${paidAmt}, 'bank', ${notes || `Purchase Entry - Bill #${bill_no || 'N/A'}`},
            ${'EXP-PUR-' + purId}, 'approved', ${user.id}
          )
        `;
      }

      return res.status(200).json({ success: true, message: `Purchase Entry recorded successfully with ${items.length} item(s)!`, purchase: purchaseRec[0] });
    }

    else if (action === "bulk-purchase-import") {
      const { company_id, supplier_groups } = req.body;
      const defaultCompId = safeInt(company_id) || safeInt(user.company_id) || 1;

      if (!Array.isArray(supplier_groups) || supplier_groups.length === 0) {
        return res.status(400).json({ error: "Company ID and supplier_groups array required" });
      }

      let totalPurchasesCreated = 0;
      let totalProductsCreated = 0;
      let totalItemsProcessed = 0;

      for (const group of supplier_groups) {
        const { supplier_name, bill_no, invoice_date, invoice_doc, notes, items, company_name, company } = group;
        if (!Array.isArray(items) || items.length === 0) continue;

        let groupCompId = defaultCompId;
        const compStr = (company_name || company || "").toString().trim();
        if (compStr) {
          const compRows = await sql`
            SELECT id FROM companies 
            WHERE LOWER(name) = LOWER(${compStr}) OR LOWER(trade_name) = LOWER(${compStr}) 
            LIMIT 1
          `;
          if (compRows.length > 0) {
            groupCompId = compRows[0].id;
          }
        }

        // 1. Find or create supplier
        let supId = null;
        if (supplier_name && supplier_name.trim()) {
          const supRows = await sql`SELECT id FROM suppliers WHERE LOWER(legal_name) = LOWER(${supplier_name.trim()}) LIMIT 1`;
          if (supRows.length > 0) {
            supId = supRows[0].id;
          } else {
            const newSup = await sql`
              INSERT INTO suppliers (legal_name, trade_name, is_active)
              VALUES (${supplier_name.trim()}, ${supplier_name.trim()}, true)
              RETURNING id
            `;
            supId = newSup[0].id;
          }
        }

        let groupGrandTotal = 0;
        const processedItems = [];

        // 2. Resolve products via Upsert (find existing or create new, updating stock & rates)
        for (const item of items) {
          const pName = (item.product_name || item.name || '').trim();
          if (!pName) continue;

          item.supplier_id = supId;
          const resObj = await upsertProduct(sql, groupCompId, item, { mode: 'purchase_upload' });
          if (!resObj || !resObj.product) continue;

          const prodObj = resObj.product;
          const prodId = prodObj.id;

          if (resObj.isCreated) totalProductsCreated++;

          const qty = safeInt(item.quantity) || 1;
          const purRate = parseFloat(item.purchase_rate || item.rate || 0);
          const gstRate = parseFloat(item.gst_rate || prodObj.gst_rate || 18);
          const transport = parseFloat(item.transport_expenses || 0);
          const packaging = parseFloat(item.packaging_charges || item.packaging || 0);
          const taxable = (qty * purRate) + transport + packaging;
          const lineTotal = taxable * (1 + gstRate / 100);
          const serialNo = item.serial_no || item.product_serial_no || item.serial || null;
          groupGrandTotal += lineTotal;

          processedItems.push({ prodId, qty, purRate, lineTotal, serialNo, packaging, transport });
          totalItemsProcessed++;
        }

        // 3. Create purchase record
        if (processedItems.length > 0) {
          const parseSafeDate = (dStr) => {
            if (!dStr) return new Date();
            if (dStr instanceof Date && !isNaN(dStr)) return dStr;
            const s = dStr.toString().trim();
            if (!s) return new Date();
            const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
            if (dmyMatch) {
              const day = parseInt(dmyMatch[1], 10);
              const month = parseInt(dmyMatch[2], 10) - 1;
              const year = parseInt(dmyMatch[3], 10);
              return new Date(year, month, day);
            }
            const dt = new Date(s);
            return isNaN(dt.getTime()) ? new Date() : dt;
          };

          const pDate = invoice_date ? parseSafeDate(invoice_date) : new Date();
          const paidAmt = Math.min(groupGrandTotal, Math.max(0, parseFloat(group.paid_amount !== undefined ? group.paid_amount : groupGrandTotal)));
          const pendingAmt = Math.max(0, groupGrandTotal - paidAmt);
          const pStatus = pendingAmt <= 0 ? 'paid' : (paidAmt > 0 ? 'partial' : 'unpaid');
          const intRate = parseFloat(group.interest_rate || 0);
          const intFreq = (group.interest_frequency || 'monthly').toString().trim().toLowerCase();
          const dueDate = group.due_date ? parseSafeDate(group.due_date) : null;

          const purchaseRec = await sql`
            INSERT INTO purchases (
              company_id, purchase_invoice_no, purchase_date, supplier_id, total_amount, grand_total,
              paid_amount, pending_amount, payment_status, interest_rate, interest_frequency, due_date,
              attachments_json, created_by
            )
            VALUES (
              ${groupCompId}, ${bill_no || null}, ${pDate}, ${supId || null}, ${groupGrandTotal}, ${groupGrandTotal},
              ${paidAmt}, ${pendingAmt}, ${pStatus}, ${intRate}, ${intFreq}, ${dueDate},
              ${invoice_doc ? JSON.stringify([invoice_doc]) : null}, ${user.id}
            )
            RETURNING id
          `;
          const purId = purchaseRec[0].id;

          for (const item of processedItems) {
            await sql`
              INSERT INTO purchase_items (purchase_id, product_id, quantity, rate, total, serial_no, packaging_charges, transport_expenses)
              VALUES (${purId}, ${item.prodId}, ${item.qty}, ${item.purRate}, ${item.lineTotal}, ${item.serialNo}, ${item.packaging || 0}, ${item.transport || 0})
            `;
            await sql`
              INSERT INTO inventory_transactions (company_id, product_id, transaction_type, quantity, reference_type, reference_id, performed_by, notes)
              VALUES (${groupCompId}, ${item.prodId}, 'receipt', ${item.qty}, 'purchase', ${purId}, ${user.id}, ${notes || `Bulk Purchase Import - Bill #${bill_no || 'N/A'}`})
            `;
          }

          if (paidAmt > 0) {
            await ensureExpensesColumns(sql);
            await sql`
              INSERT INTO expenses (
                company_id, expense_date, category, dealer_receiver, amount, payment_mode,
                description, receipt_number, approval_status, created_by
              ) VALUES (
                ${groupCompId}, ${pDate}, 'Inventory Purchase', ${supplier_name || 'Supplier'},
                ${paidAmt}, 'bank', ${notes || `Bulk Import - Bill #${bill_no || 'N/A'}`},
                ${'EXP-PUR-' + purId}, 'approved', ${user.id}
              )
            `;
          }
          totalPurchasesCreated++;
        }
      }

      return res.status(200).json({
        success: true,
        message: `Bulk import completed! ${totalPurchasesCreated} purchase invoices created, ${totalProductsCreated} new products added to inventory, ${totalItemsProcessed} line items processed.`,
        stats: { totalPurchasesCreated, totalProductsCreated, totalItemsProcessed }
      });
    }

    else if (action === "stock-receipts-list") {
      let rows;
      if (isAll) {
        rows = await sql`
          SELECT p.*, 
                 v.legal_name as supplier_name,
                 v.trade_name as supplier_trade_name,
                 v.state as supplier_state,
                 v.gstin as supplier_gstin,
                 c.name as company_name,
                 c.state as company_state,
                 c.gstin as company_gstin
          FROM purchases p
          LEFT JOIN suppliers v ON p.supplier_id = v.id
          LEFT JOIN companies c ON p.company_id = c.id
          ORDER BY p.purchase_date DESC, p.created_at DESC
        `;
      } else {
        const cId = safeInt(compQuery) || safeInt(user.company_id) || 1;
        rows = await sql`
          SELECT p.*, 
                 v.legal_name as supplier_name,
                 v.trade_name as supplier_trade_name,
                 v.state as supplier_state,
                 v.gstin as supplier_gstin,
                 c.name as company_name,
                 c.state as company_state,
                 c.gstin as company_gstin
          FROM purchases p
          LEFT JOIN suppliers v ON p.supplier_id = v.id
          LEFT JOIN companies c ON p.company_id = c.id
          WHERE p.company_id = ${cId}
          ORDER BY p.purchase_date DESC, p.created_at DESC
        `;
      }

      const purIds = rows.map(p => p.id);
      let itemsMap = {};
      if (purIds.length > 0) {
        const itemRows = await sql`
          SELECT pi.id, pi.purchase_id, pi.product_id, pi.quantity, pi.rate, pi.total,
                 pi.serial_no, pi.packaging_charges, pi.transport_expenses,
                 pi.gst_rate,
                 prod.gst_rate as prod_gst_rate,
                 prod.name as product_name, prod.sku, COALESCE(prod.model, '') as model, prod.brand, prod.unit_of_measure
          FROM purchase_items pi
          LEFT JOIN products prod ON pi.product_id = prod.id
          WHERE pi.purchase_id = ANY(${purIds})
          ORDER BY pi.id ASC
        `;
        itemRows.forEach(item => {
          let itemGst = null;
          if (item.gst_rate !== null && item.gst_rate !== undefined && item.gst_rate !== '') {
            itemGst = parseFloat(item.gst_rate);
          }

          const qty = parseFloat(item.quantity) || 1;
          const rate = parseFloat(item.rate) || 0;
          const pkg = parseFloat(item.packaging_charges) || 0;
          const trp = parseFloat(item.transport_expenses) || 0;
          const taxable = (qty * rate) + pkg + trp;
          const savedTot = parseFloat(item.total) || 0;

          // If gst_rate is missing or 0, deduce from ratio if available
          if ((itemGst === null || isNaN(itemGst) || itemGst <= 0) && taxable > 0 && savedTot > 0) {
            const ratio = savedTot / taxable;
            if (ratio > 0.99) {
              const deduced = Math.round((ratio - 1) * 100 * 100) / 100;
              if (Math.abs(deduced - 5) < 0.25) itemGst = 5;
              else if (Math.abs(deduced - 12) < 0.25) itemGst = 12;
              else if (Math.abs(deduced - 18) < 0.25) itemGst = 18;
              else if (Math.abs(deduced - 28) < 0.25) itemGst = 28;
              else if (Math.abs(deduced) < 0.25) itemGst = 0;
            }
          }

          if (itemGst === null || isNaN(itemGst)) {
            itemGst = parseFloat(item.prod_gst_rate || 18);
          }
          item.gst_rate = itemGst;

          // Reconcile line total: if saved total matches calculated total within normal rounding, keep it; otherwise calculate
          const calculatedTot = Math.round((taxable * (1 + itemGst / 100)) * 100) / 100;
          if (savedTot > 0 && Math.abs(savedTot - calculatedTot) <= 0.02) {
            item.total = savedTot;
          } else {
            item.total = calculatedTot;
          }

          if (!itemsMap[item.purchase_id]) itemsMap[item.purchase_id] = [];
          itemsMap[item.purchase_id].push(item);
        });
      }

      const receipts = rows.map(p => {
        const items = itemsMap[p.id] || [];
        const totalQty = items.reduce((sum, i) => sum + (parseInt(i.quantity, 10) || 0), 0);
        return {
          ...p,
          items,
          items_count: items.length,
          total_qty: totalQty
        };
      });

      return res.status(200).json({ success: true, receipts });
    }

    // ═══════════════ PAYABLES & INTEREST CALCULATOR ═══════════════
    else if (action === "payables-list") {
      const compParam = req.query.company_id || req.body?.company_id;
      const isAllComps = compParam === "all" || (!compParam && user.role === "superadmin") || compQuery === "all";
      const cId = safeInt(compParam) || safeInt(compQuery) || safeInt(user.company_id) || 1;
      let rows;
      if (isAllComps) {
        rows = await sql`
          SELECT p.*, v.legal_name as supplier_name, v.legal_name as supplier_legal_name, v.phone as supplier_phone, v.trade_name as supplier_trade_name, c.name as company_name
          FROM purchases p
          LEFT JOIN suppliers v ON p.supplier_id = v.id
          LEFT JOIN companies c ON p.company_id = c.id
          ORDER BY p.purchase_date DESC, p.created_at DESC
        `;
      } else {
        rows = await sql`
          SELECT p.*, v.legal_name as supplier_name, v.legal_name as supplier_legal_name, v.phone as supplier_phone, v.trade_name as supplier_trade_name, c.name as company_name
          FROM purchases p
          LEFT JOIN suppliers v ON p.supplier_id = v.id
          LEFT JOIN companies c ON p.company_id = c.id
          WHERE p.company_id = ${cId}
          ORDER BY p.purchase_date DESC, p.created_at DESC
        `;
      }

      const payables = rows.map(r => {
        const pDate = new Date(r.purchase_date || r.created_at || new Date());
        const now = new Date();
        const daysElapsed = Math.max(0, Math.floor((now - pDate) / (1000 * 60 * 60 * 24)));

        const grand = parseFloat(r.grand_total || r.total_amount || 0);
        const paid = parseFloat(r.paid_amount || 0);
        const pending = Math.max(0, parseFloat(r.pending_amount !== undefined && r.pending_amount !== null ? r.pending_amount : (grand - paid)));
        const intRate = parseFloat(r.interest_rate || 0);
        const freq = (r.interest_frequency || 'monthly').toString().toLowerCase();

        let accruedInterest = 0;
        if (pending > 0 && intRate > 0 && daysElapsed > 0) {
          if (freq === 'daily') {
            accruedInterest = pending * (intRate / 100) * daysElapsed;
          } else if (freq === 'yearly') {
            accruedInterest = pending * (intRate / 100) * (daysElapsed / 365.25);
          } else { // monthly
            accruedInterest = pending * (intRate / 100) * (daysElapsed / 30.4375);
          }
        }

        accruedInterest = Math.round(accruedInterest * 100) / 100;
        const netPayable = Math.round((pending + accruedInterest) * 100) / 100;

        return {
          ...r,
          grand_total: grand,
          paid_amount: paid,
          pending_amount: pending,
          days_elapsed: daysElapsed,
          accrued_interest: accruedInterest,
          net_payable: netPayable
        };
      });

      return res.status(200).json({ success: true, payables });
    }

    else if (action === "record-purchase-payment") {
      const { purchase_id, payment_amount, payment_mode, notes } = req.body;
      const purId = safeInt(purchase_id);
      const payAmt = parseFloat(payment_amount || 0);
      if (!purId || payAmt <= 0) return res.status(400).json({ error: "Purchase ID and positive payment amount required" });

      const pRecs = await sql`SELECT * FROM purchases WHERE id = ${purId}`;
      if (pRecs.length === 0) return res.status(404).json({ error: "Purchase record not found" });

      const p = pRecs[0];
      const newPaid = parseFloat(p.paid_amount || 0) + payAmt;
      const grand = parseFloat(p.grand_total || p.total_amount || 0);
      const newPending = Math.max(0, grand - newPaid);
      const newStatus = newPending <= 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'pending');

      await sql`
        UPDATE purchases SET
          paid_amount = ${newPaid},
          pending_amount = ${newPending},
          payment_status = ${newStatus}
        WHERE id = ${purId}
      `;

      let vName = "Supplier Payment";
      if (p.supplier_id) {
        const vRes = await sql`SELECT legal_name FROM suppliers WHERE id = ${p.supplier_id}`;
        if (vRes.length > 0) vName = vRes[0].legal_name;
      }

      await ensureExpensesColumns(sql);
      await sql`
        INSERT INTO expenses (
          company_id, expense_date, category, dealer_receiver, amount, payment_mode,
          description, receipt_number, approval_status, created_by
        ) VALUES (
          ${p.company_id}, NOW(), 'Supplier Payment', ${vName},
          ${payAmt}, ${payment_mode || 'bank'}, ${notes || `Payment towards Purchase Bill #${p.purchase_invoice_no || 'N/A'}`},
          ${'PAY-PUR-' + purId}, 'approved', ${user.id}
        )
      `;

      return res.status(200).json({ success: true, message: `Payment of ₹${payAmt.toFixed(2)} recorded successfully!` });
    }

    else if (action === "update-purchase-interest") {
      const { purchase_id, interest_rate, interest_frequency, due_date } = req.body;
      const purId = safeInt(purchase_id);
      if (!purId) return res.status(400).json({ error: "Purchase ID required" });

      const rate = parseFloat(interest_rate || 0);
      const freq = (interest_frequency || 'monthly').toString().toLowerCase();

      await sql`
        UPDATE purchases SET
          interest_rate = ${rate},
          interest_frequency = ${freq},
          due_date = ${due_date || null}
        WHERE id = ${purId}
      `;

      return res.status(200).json({ success: true, message: "Interest parameters updated successfully!" });
    }

    else if (action === "dealer-dues-list") {
      const cId = safeInt(compQuery) || safeInt(user.company_id) || 1;
      let rows;
      if (isAll) {
        rows = await sql`
          SELECT p.*, v.legal_name as supplier_name, v.phone as supplier_phone, v.email as supplier_email,
                 c.name as company_name
          FROM purchases p
          LEFT JOIN suppliers v ON p.supplier_id = v.id
          LEFT JOIN companies c ON p.company_id = c.id
          WHERE p.pending_amount > 0 OR p.payment_status != 'paid'
          ORDER BY p.purchase_date ASC
        `;
      } else {
        rows = await sql`
          SELECT p.*, v.legal_name as supplier_name, v.phone as supplier_phone, v.email as supplier_email,
                 c.name as company_name
          FROM purchases p
          LEFT JOIN suppliers v ON p.supplier_id = v.id
          LEFT JOIN companies c ON p.company_id = c.id
          WHERE p.company_id = ${cId} AND (p.pending_amount > 0 OR p.payment_status != 'paid')
          ORDER BY p.purchase_date ASC
        `;
      }
      return res.status(200).json({ success: true, dues: rows });
    }

    else if (action === "dealer-dues-pay") {
      const { purchase_id, payment_amount, notes, payment_mode } = req.body;
      const purId = safeInt(purchase_id);
      const payAmt = parseFloat(payment_amount || 0);
      if (!purId || payAmt <= 0) return res.status(400).json({ error: "Purchase ID and payment amount > 0 required" });

      const pRows = await sql`SELECT p.*, v.legal_name as supplier_name FROM purchases p LEFT JOIN suppliers v ON p.supplier_id = v.id WHERE p.id = ${purId}`;
      if (pRows.length === 0) return res.status(400).json({ error: "Purchase record not found" });

      const pur = pRows[0];
      const grandTotal = parseFloat(pur.grand_total || pur.total_amount || 0);
      const currentPaid = parseFloat(pur.paid_amount || 0);
      const newPaid = currentPaid + payAmt;
      const newPending = Math.max(0, grandTotal - newPaid);
      const newStatus = newPending <= 0 ? 'paid' : 'partial';

      const updated = await sql`
        UPDATE purchases SET
          paid_amount = ${newPaid},
          pending_amount = ${newPending},
          payment_status = ${newStatus}
        WHERE id = ${purId}
        RETURNING *
      `;

      // Record payment in expenses log
      await sql`
        INSERT INTO expenses (
          company_id, expense_date, category, dealer_receiver, amount, payment_mode,
          description, receipt_number, approval_status, created_by
        ) VALUES (
          ${pur.company_id}, NOW(), 'dealer Payment', ${pur.supplier_name || 'dealer Dues'},
          ${payAmt}, ${payment_mode || 'bank'}, ${notes || `dealer Dues Payment for Bill #${pur.purchase_invoice_no || purId}`},
          ${'EXP-VD-PAY-' + purId}, 'approved', ${user.id}
        )
      `;

      return res.status(200).json({ success: true, purchase: updated[0], message: `Payment of ₹${payAmt} recorded successfully!` });
    }

    else if (action === "stock-receipt-update") {
      const { id, purchase_invoice_no, supplier_id, total_amount, grand_total } = req.body;
      const recId = safeInt(id);
      if (!recId) return res.status(400).json({ error: "Purchase Receipt ID required" });

      const supId = safeInt(supplier_id);
      const amt = parseFloat(grand_total || total_amount || 0);

      const updated = await sql`
        UPDATE purchases SET
          purchase_invoice_no = ${purchase_invoice_no || null},
          supplier_id = COALESCE(${supId}, supplier_id),
          total_amount = ${amt},
          grand_total = ${amt}
        WHERE id = ${recId}
        RETURNING *
      `;

      return res.status(200).json({ success: true, receipt: updated[0], message: "Stock receipt purchase entry updated!" });
    }

    else if (action === "stock-receipt-delete") {
      const userRole = (user.role || '').toLowerCase();
      const isSuperAdmin = userRole === 'superadmin' || userRole === 'super_admin' || user.username === 'superadmin';
      if (!isSuperAdmin) {
        return res.status(403).json({ error: "Access denied. Only Superadmin can delete an entire purchase invoice/bill. You can delete or edit individual sub-items instead." });
      }

      const recId = safeInt(req.query.id || req.body?.id);
      if (!recId) return res.status(400).json({ error: "Purchase Receipt ID required" });

      // First fetch items to adjust product current_stock back
      const items = await sql`SELECT product_id, quantity FROM purchase_items WHERE purchase_id = ${recId}`;
      for (const item of items) {
        if (item.product_id && item.quantity) {
          await sql`UPDATE products SET current_stock = GREATEST(0, current_stock - ${item.quantity}) WHERE id = ${item.product_id}`;
        }
      }

      // Delete auto-recorded expense entry for this purchase so P&L reports stay accurate
      const expReceiptNum = 'EXP-PUR-' + recId;
      try {
        await sql`DELETE FROM expenses WHERE receipt_number = ${expReceiptNum} OR description LIKE ${'%EXP-PUR-' + recId + '%'}`;
      } catch (e) { }

      await sql`DELETE FROM purchase_items WHERE purchase_id = ${recId}`;
      await sql`DELETE FROM purchases WHERE id = ${recId}`;

      return res.status(200).json({ success: true, message: "Purchase receipt entry deleted, stock adjusted, and expense record removed!" });
    }

    else if (action === "stock-receipt-item-delete") {
      const userRole = (user.role || '').toLowerCase();
      const isSuperAdmin = userRole === 'superadmin' || userRole === 'super_admin' || user.username === 'superadmin';
      const isStoreAdmin = userRole === 'storeadmin' || userRole === 'store_admin';
      if (!isSuperAdmin && !isStoreAdmin && userRole !== 'admin') {
        return res.status(403).json({ error: "Access denied. Only Superadmin and Storeadmin can delete purchase items." });
      }

      const itemId = safeInt(req.query.item_id || req.body?.item_id);
      let purId = safeInt(req.query.purchase_id || req.body?.purchase_id);
      if (!itemId) return res.status(400).json({ error: "item_id required" });

      const itemRows = purId ?
        await sql`SELECT * FROM purchase_items WHERE id = ${itemId} AND purchase_id = ${purId}` :
        await sql`SELECT * FROM purchase_items WHERE id = ${itemId}`;
      if (itemRows.length === 0) return res.status(404).json({ error: "Purchase item not found" });

      const item = itemRows[0];
      purId = item.purchase_id;

      // If this is the only item in the purchase bill, only Superadmin is allowed to delete it (as it deletes the entire bill)
      const allItemsForPur = await sql`SELECT id FROM purchase_items WHERE purchase_id = ${purId}`;
      if (allItemsForPur.length <= 1 && !isSuperAdmin) {
        return res.status(403).json({ 
          error: "Access denied. Cannot delete the only item in this purchase bill because deleting it would delete the entire invoice. Only Superadmin can delete an entire purchase invoice. You can edit this item instead." 
        });
      }

      if (item.product_id && item.quantity) {
        await sql`UPDATE products SET current_stock = GREATEST(0, current_stock - ${item.quantity}) WHERE id = ${item.product_id}`;
      }

      await sql`DELETE FROM purchase_items WHERE id = ${itemId}`;

      // Check remaining items for this purchase
      const remainingItems = await sql`SELECT * FROM purchase_items WHERE purchase_id = ${purId}`;
      if (remainingItems.length === 0) {
        const expReceiptNum = 'EXP-PUR-' + purId;
        try {
          await sql`DELETE FROM expenses WHERE receipt_number = ${expReceiptNum} OR description LIKE ${'%EXP-PUR-' + purId + '%'}`;
        } catch (e) { }
        await sql`DELETE FROM purchases WHERE id = ${purId}`;
        return res.status(200).json({ success: true, message: "Sub-item deleted. Since it was the last item, the entire purchase entry was removed.", deleted_bill: true });
      }

      // Recalculate purchase totals from remaining items
      let itemsSubtotal = 0;
      remainingItems.forEach(i => {
        itemsSubtotal += parseFloat(i.total || 0);
      });
      itemsSubtotal = Math.round(itemsSubtotal * 100) / 100;

      const purRows = await sql`SELECT paid_amount, round_off FROM purchases WHERE id = ${purId}`;
      const roundOff = purRows.length > 0 ? (parseFloat(purRows[0].round_off) || 0) : 0;
      const newGrandTotal = Math.round((itemsSubtotal + roundOff) * 100) / 100;

      const paidAmt = purRows.length > 0 ? parseFloat(purRows[0].paid_amount || 0) : 0;
      const newPaidAmt = Math.min(newGrandTotal, paidAmt);
      const newPendingAmt = Math.max(0, newGrandTotal - newPaidAmt);
      const newStatus = newPendingAmt <= 0 ? 'paid' : (newPaidAmt > 0 ? 'partial' : 'unpaid');

      await sql`
        UPDATE purchases SET
          total_amount = ${newGrandTotal},
          grand_total = ${newGrandTotal},
          paid_amount = ${newPaidAmt},
          pending_amount = ${newPendingAmt},
          payment_status = ${newStatus}
        WHERE id = ${purId}
      `;

      try {
        const expReceiptNum = 'EXP-PUR-' + purId;
        await sql`UPDATE expenses SET amount = ${newPaidAmt} WHERE receipt_number = ${expReceiptNum} OR description LIKE ${'%EXP-PUR-' + purId + '%'}`;
      } catch (e) { }

      return res.status(200).json({
        success: true,
        message: "Sub-item deleted and bill total recalculated successfully!",
        remaining_count: remainingItems.length,
        new_grand_total: newGrandTotal
      });
    }

    else if (action === "multi-purchase-update") {
      const userRole = (user.role || '').toLowerCase();
      const isSuperAdmin = userRole === 'superadmin' || userRole === 'super_admin' || user.username === 'superadmin';
      const isStoreAdmin = userRole === 'storeadmin' || userRole === 'store_admin';
      if (!isSuperAdmin && !isStoreAdmin && userRole !== 'admin') {
        return res.status(403).json({ error: "Access denied. Only Superadmin and Storeadmin can edit purchase entries." });
      }

      const {
        purchase_id, company_id, supplier_id, bill_no, purchase_date,
        paid_amount, interest_rate, interest_frequency, due_date, bill_doc, items
      } = req.body;

      const purId = safeInt(purchase_id);
      if (!purId) return res.status(400).json({ error: "purchase_id required" });
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "At least 1 item is required" });
      }

      const existingPur = await sql`SELECT * FROM purchases WHERE id = ${purId}`;
      if (existingPur.length === 0) return res.status(404).json({ error: "Purchase entry not found" });

      const compId = safeInt(company_id) || existingPur[0].company_id || safeInt(user.company_id) || 1;
      const supId = safeInt(supplier_id) || existingPur[0].supplier_id;

      // 1. Revert previous stock from old purchase_items
      const oldItems = await sql`SELECT product_id, quantity FROM purchase_items WHERE purchase_id = ${purId}`;
      for (const oldIt of oldItems) {
        if (oldIt.product_id && oldIt.quantity) {
          await sql`UPDATE products SET current_stock = GREATEST(0, current_stock - ${oldIt.quantity}) WHERE id = ${oldIt.product_id}`;
        }
      }

      // 2. Delete old purchase items
      await sql`DELETE FROM purchase_items WHERE purchase_id = ${purId}`;

      // 3. Insert updated purchase items, recalculating rates & line totals, and increment stock
      let grandTotal = 0;
      for (const item of items) {
        const prodId = safeInt(item.product_id);
        const qty = safeInt(item.quantity) || 1;
        const rate = parseFloat(item.rate || item.purchase_rate || 0);
        const gstRate = parseFloat(item.gst_rate || 18);
        const transport = parseFloat(item.transport_expenses || 0);
        const packaging = parseFloat(item.packaging_charges || item.packaging || 0);
        const taxable = (qty * rate) + transport + packaging;
        const lineTotal = Math.round((taxable * (1 + gstRate / 100)) * 100) / 100;
        grandTotal += lineTotal;

        if (prodId) {
          const curP = (await sql`SELECT transport_expenses, packaging_charges, gst_rate, selling_percentage FROM products WHERE id = ${prodId}`)[0] || {};
          const rates = calculateRates(
            rate,
            null,
            curP.transport_expenses || transport || 0,
            gstRate || curP.gst_rate || 18,
            curP.selling_percentage || 0,
            null,
            null,
            curP.packaging_charges || packaging || 0
          );

          await sql`
            UPDATE products SET 
              current_stock = current_stock + ${qty},
              purchase_rate = ${rates.purchase_rate},
              purchase_rate_incl_tax = ${rates.purchase_rate_incl_tax},
              selling_rate = ${rates.selling_rate},
              mrp = ${rates.mrp},
              gst_rate = COALESCE(${gstRate}, gst_rate),
              serial_no = COALESCE(${item.serial_no || item.product_serial_no || null}, serial_no),
              model = COALESCE(${item.model ? item.model.trim() : null}, model),
              supplier_id = COALESCE(${supId}, supplier_id),
              packaging_charges = COALESCE(${packaging > 0 ? packaging : null}, packaging_charges)
            WHERE id = ${prodId}
          `;

          await sql`
            INSERT INTO purchase_items (purchase_id, product_id, quantity, rate, total, serial_no, packaging_charges, transport_expenses, gst_rate)
            VALUES (${purId}, ${prodId}, ${qty}, ${rate}, ${lineTotal}, ${item.serial_no || item.product_serial_no || null}, ${packaging}, ${transport}, ${gstRate})
          `;
        }
      }

      const roundOffVal = parseFloat(req.body.round_off !== undefined && req.body.round_off !== null ? req.body.round_off : (existingPur[0].round_off || 0)) || 0;
      const subtotalAmount = Math.round(grandTotal * 100) / 100;
      grandTotal = Math.round((subtotalAmount + roundOffVal) * 100) / 100;

      const paidAmt = Math.min(grandTotal, Math.max(0, parseFloat(paid_amount !== undefined && paid_amount !== null && paid_amount !== '' ? paid_amount : grandTotal)));
      const pendingAmt = Math.max(0, grandTotal - paidAmt);
      const pStatus = pendingAmt <= 0 ? 'paid' : (paidAmt > 0 ? 'partial' : 'unpaid');
      const intRate = parseFloat(interest_rate || 0);
      const intFreq = (interest_frequency || 'monthly').toString().trim().toLowerCase();

      let finalBillDoc = existingPur[0].attachments_json;
      if (bill_doc) {
        finalBillDoc = JSON.stringify([bill_doc]);
      }

      const updatedPur = await sql`
        UPDATE purchases SET
          company_id = ${compId},
          purchase_invoice_no = ${bill_no || null},
          purchase_date = ${purchase_date ? new Date(purchase_date) : existingPur[0].purchase_date},
          supplier_id = ${supId || null},
          total_amount = ${grandTotal},
          grand_total = ${grandTotal},
          round_off = ${roundOffVal},
          paid_amount = ${paidAmt},
          pending_amount = ${pendingAmt},
          payment_status = ${pStatus},
          interest_rate = ${intRate},
          interest_frequency = ${intFreq},
          due_date = ${due_date || null},
          attachments_json = ${finalBillDoc}
        WHERE id = ${purId}
        RETURNING *
      `;

      // Update expense entry if exists
      if (paidAmt > 0) {
        let dealerName = "Supplier Purchase";
        if (supId) {
          const vRes = await sql`SELECT legal_name FROM suppliers WHERE id = ${supId}`;
          if (vRes.length > 0) dealerName = vRes[0].legal_name;
        }
        await ensureExpensesColumns(sql);
        const expReceiptNum = 'EXP-PUR-' + purId;
        const expExists = await sql`SELECT id FROM expenses WHERE receipt_number = ${expReceiptNum} LIMIT 1`;
        if (expExists.length > 0) {
          await sql`
            UPDATE expenses SET
              amount = ${paidAmt},
              dealer_receiver = ${dealerName},
              expense_date = ${purchase_date ? new Date(purchase_date) : new Date()},
              description = ${`Purchase Entry - Bill #${bill_no || 'N/A'}`}
            WHERE id = ${expExists[0].id}
          `;
        } else {
          await sql`
            INSERT INTO expenses (
              company_id, expense_date, category, dealer_receiver, amount, payment_mode,
              description, receipt_number, approval_status, created_by
            ) VALUES (
              ${compId}, ${purchase_date ? new Date(purchase_date) : new Date()}, 'Inventory Purchase', ${dealerName},
              ${paidAmt}, 'bank', ${`Purchase Entry - Bill #${bill_no || 'N/A'}`},
              ${expReceiptNum}, 'approved', ${user.id}
            )
          `;
        }
      }

      return res.status(200).json({
        success: true,
        message: `Purchase Entry Bill #${bill_no || purId} updated successfully with ${items.length} item(s)!`,
        purchase: updatedPur[0]
      });
    }

    else if (action === "view-doc") {
      const recId = safeInt(req.query.id);
      if (!recId) return res.status(400).send("Record ID required");

      const docType = req.query.type || "purchase";
      const userCompId = safeInt(user.company_id);
      const isSuperAdmin = (user.role === 'superadmin' || user.role === 'Superadmin');

      let docData = null;

      if (docType === "supplier") {
        const rows = await sql`
          SELECT opening_balance_doc FROM suppliers 
          WHERE id = ${recId} AND (company_id = ${userCompId} OR ${isSuperAdmin})
        `;
        if (!rows || rows.length === 0 || !rows[0].opening_balance_doc) {
          return res.status(404).send("Supplier document not found");
        }
        docData = rows[0].opening_balance_doc;
      } else if (docType === "dealer") {
        const rows = await sql`
          SELECT opening_balance_doc FROM dealers 
          WHERE id = ${recId} AND (company_id = ${userCompId} OR ${isSuperAdmin})
        `;
        if (!rows || rows.length === 0 || !rows[0].opening_balance_doc) {
          return res.status(404).send("dealer document not found");
        }
        docData = rows[0].opening_balance_doc;
      } else {
        const rows = await sql`
          SELECT attachments_json FROM purchases 
          WHERE id = ${recId} AND (company_id = ${userCompId} OR ${isSuperAdmin})
        `;
        if (!rows || rows.length === 0 || !rows[0].attachments_json) {
          return res.status(404).send("Purchase document not found");
        }
        let docs = [];
        try {
          docs = typeof rows[0].attachments_json === "string" ? JSON.parse(rows[0].attachments_json) : rows[0].attachments_json;
        } catch (e) {
          docs = [];
        }
        if (!Array.isArray(docs) || docs.length === 0 || !docs[0]) {
          return res.status(404).send("Document content empty");
        }
        docData = docs[0];
      }

      const matches = typeof docData === "string" ? docData.match(/^data:(.+?);base64,(.+)$/) : null;
      if (matches) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, "base64");

        let extension = "bin";
        if (mimeType.includes("pdf")) extension = "pdf";
        else if (mimeType.includes("png")) extension = "png";
        else if (mimeType.includes("jpeg") || mimeType.includes("jpg")) extension = "jpg";

        res.setHeader("Content-Type", mimeType);
        res.setHeader("Content-Disposition", `inline; filename="doc-${recId}.${extension}"`);
        return res.status(200).send(buffer);
      } else if (typeof docData === "string" && (docData.startsWith("http://") || docData.startsWith("https://"))) {
        return res.redirect(docData);
      } else {
        return res.status(400).send("Invalid document format");
      }
    }

    else if (action === "inventory-reports") {
      const type = req.query.type || "current-stock";
      const daysThreshold = safeInt(req.query.days) || 30;

      if (type === "current-stock") {
        const rows = isAll
          ? await sql`
              SELECT p.*, v.legal_name as supplier_name, c.name as company_name
              FROM products p
              LEFT JOIN suppliers v ON p.supplier_id = v.id
              LEFT JOIN companies c ON p.company_id = c.id
              WHERE p.is_active = true
              ORDER BY p.name ASC
            `
          : await sql`
              SELECT p.*, v.legal_name as supplier_name, c.name as company_name
              FROM products p
              LEFT JOIN suppliers v ON p.supplier_id = v.id
              LEFT JOIN companies c ON p.company_id = c.id
              WHERE p.is_active = true AND p.company_id = ${safeInt(compQuery) || safeInt(user.company_id) || 1}
              ORDER BY p.name ASC
            `;
        let totalQty = 0, totalVal = 0, lowCount = 0;
        rows.forEach(r => {
          totalQty += (r.current_stock || 0);
          totalVal += (r.current_stock || 0) * parseFloat(r.purchase_rate || 0);
          if ((r.current_stock || 0) <= (r.min_stock || 0)) lowCount++;
        });
        return res.status(200).json({
          success: true,
          report: "current-stock",
          summary: { total_skus: rows.length, total_stock_qty: totalQty, total_stock_value: totalVal, low_stock_count: lowCount },
          data: rows
        });
      }

      else if (type === "stock-valuation") {
        const rows = isAll
          ? await sql`
              SELECT p.id, p.sku, p.name, p.brand, p.model, p.current_stock, p.purchase_rate, p.selling_rate as selling_price, c.name as company_name
              FROM products p
              LEFT JOIN companies c ON p.company_id = c.id
              WHERE p.is_active = true
              ORDER BY p.name ASC
            `
          : await sql`
              SELECT p.id, p.sku, p.name, p.brand, p.model, p.current_stock, p.purchase_rate, p.selling_rate as selling_price, c.name as company_name
              FROM products p
              LEFT JOIN companies c ON p.company_id = c.id
              WHERE p.is_active = true AND p.company_id = ${safeInt(compQuery) || safeInt(user.company_id) || 1}
              ORDER BY p.name ASC
            `;
        let totCostVal = 0, totRetailVal = 0, totMargin = 0;
        const processed = rows.map(r => {
          const stk = r.current_stock || 0;
          const pRate = parseFloat(r.purchase_rate || 0);
          const sPrice = parseFloat(r.selling_price || 0);
          const costVal = stk * pRate;
          const retailVal = stk * sPrice;
          const margin = retailVal - costVal;
          const marginPct = costVal > 0 ? ((margin / costVal) * 100).toFixed(2) : 0;
          totCostVal += costVal;
          totRetailVal += retailVal;
          totMargin += margin;
          return { ...r, cost_valuation: costVal, retail_valuation: retailVal, potential_margin: margin, margin_percentage: marginPct };
        });
        const overallMarginPct = totCostVal > 0 ? ((totMargin / totCostVal) * 100).toFixed(2) : 0;
        return res.status(200).json({
          success: true,
          report: "stock-valuation",
          summary: { total_skus: rows.length, total_cost_valuation: totCostVal, total_retail_valuation: totRetailVal, total_potential_margin: totMargin, overall_margin_percentage: overallMarginPct },
          data: processed
        });
      }

      else if (type === "low-stock") {
        const rows = isAll
          ? await sql`
              SELECT p.*, v.legal_name as supplier_name, c.name as company_name
              FROM products p
              LEFT JOIN suppliers v ON p.supplier_id = v.id
              LEFT JOIN companies c ON p.company_id = c.id
              WHERE p.is_active = true AND p.current_stock <= p.min_stock
              ORDER BY (p.min_stock - p.current_stock) DESC
            `
          : await sql`
              SELECT p.*, v.legal_name as supplier_name, c.name as company_name
              FROM products p
              LEFT JOIN suppliers v ON p.supplier_id = v.id
              LEFT JOIN companies c ON p.company_id = c.id
              WHERE p.is_active = true AND p.current_stock <= p.min_stock AND p.company_id = ${safeInt(compQuery) || safeInt(user.company_id) || 1}
              ORDER BY (p.min_stock - p.current_stock) DESC
            `;
        let totalDeficit = 0, estCost = 0;
        rows.forEach(r => {
          const def = Math.max(0, (r.min_stock || 0) - (r.current_stock || 0));
          totalDeficit += def;
          estCost += def * parseFloat(r.purchase_rate || 0);
        });
        return res.status(200).json({
          success: true,
          report: "low-stock",
          summary: { total_low_items: rows.length, total_deficit_units: totalDeficit, estimated_reorder_cost: estCost },
          data: rows
        });
      }

      else if (type === "product-movement") {
        const rows = isAll
          ? await sql`
              SELECT t.*, p.name as product_name, p.sku, u.username as user_name, c.name as company_name
              FROM inventory_transactions t
              LEFT JOIN products p ON t.product_id = p.id
              LEFT JOIN users u ON t.performed_by = u.id
              LEFT JOIN companies c ON t.company_id = c.id
              ORDER BY t.created_at DESC
              LIMIT 200
            `
          : await sql`
              SELECT t.*, p.name as product_name, p.sku, u.username as user_name, c.name as company_name
              FROM inventory_transactions t
              LEFT JOIN products p ON t.product_id = p.id
              LEFT JOIN users u ON t.performed_by = u.id
              LEFT JOIN companies c ON t.company_id = c.id
              WHERE t.company_id = ${safeInt(compQuery) || safeInt(user.company_id) || 1}
              ORDER BY t.created_at DESC
              LIMIT 200
            `;
        let inQty = 0, outQty = 0;
        rows.forEach(r => {
          if (r.transaction_type === 'receipt' || r.transaction_type === 'in') inQty += Math.abs(r.quantity || 0);
          else outQty += Math.abs(r.quantity || 0);
        });
        return res.status(200).json({
          success: true,
          report: "product-movement",
          summary: { total_transactions: rows.length, total_inward_qty: inQty, total_outward_qty: outQty, net_change: inQty - outQty },
          data: rows
        });
      }

      else if (type === "purchase-register") {
        const rows = isAll
          ? await sql`
              SELECT p.*, v.legal_name as supplier_name, c.name as company_name, u.username as created_by_name,
                     (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) as items_count
              FROM purchases p
              LEFT JOIN suppliers v ON p.supplier_id = v.id
              LEFT JOIN companies c ON p.company_id = c.id
              LEFT JOIN users u ON p.created_by = u.id
              ORDER BY p.created_at DESC
            `
          : await sql`
              SELECT p.*, v.legal_name as supplier_name, c.name as company_name, u.username as created_by_name,
                     (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) as items_count
              FROM purchases p
              LEFT JOIN suppliers v ON p.supplier_id = v.id
              LEFT JOIN companies c ON p.company_id = c.id
              LEFT JOIN users u ON p.created_by = u.id
              WHERE p.company_id = ${safeInt(compQuery) || safeInt(user.company_id) || 1}
              ORDER BY p.created_at DESC
            `;
        let totAmt = 0;
        rows.forEach(r => totAmt += parseFloat(r.grand_total || r.total_amount || 0));
        return res.status(200).json({
          success: true,
          report: "purchase-register",
          summary: { total_bills: rows.length, total_billed_amount: totAmt },
          data: rows
        });
      }

      else if (type === "supplier-purchase") {
        const rows = isAll
          ? await sql`
              SELECT v.id, v.legal_name, v.trade_name, v.gstin, v.phone,
                     COUNT(p.id) as total_bills,
                     COALESCE(SUM(p.grand_total), 0) as total_spend,
                     COALESCE(AVG(p.grand_total), 0) as avg_bill_value
              FROM suppliers v
              LEFT JOIN purchases p ON p.supplier_id = v.id
              GROUP BY v.id
              ORDER BY total_spend DESC
            `
          : await sql`
              SELECT v.id, v.legal_name, v.trade_name, v.gstin, v.phone,
                     COUNT(p.id) as total_bills,
                     COALESCE(SUM(p.grand_total), 0) as total_spend,
                     COALESCE(AVG(p.grand_total), 0) as avg_bill_value
              FROM suppliers v
              LEFT JOIN purchases p ON p.supplier_id = v.id AND p.company_id = ${safeInt(compQuery) || safeInt(user.company_id) || 1}
              GROUP BY v.id
              ORDER BY total_spend DESC
            `;
        let totSpendAll = 0, totBillsAll = 0;
        rows.forEach(r => {
          totSpendAll += parseFloat(r.total_spend || 0);
          totBillsAll += parseInt(r.total_bills || 0, 10);
        });
        return res.status(200).json({
          success: true,
          report: "supplier-purchase",
          summary: { total_suppliers: rows.length, total_bills: totBillsAll, total_spend: totSpendAll },
          data: rows
        });
      }

      else if (type === "product-purchase") {
        const rows = isAll
          ? await sql`
              SELECT pr.id, pr.sku, pr.name as product_name, pr.brand,
                     COUNT(pi.id) as total_purchases_count,
                     COALESCE(SUM(pi.quantity), 0) as total_qty_purchased,
                     COALESCE(SUM(pi.total), 0) as total_spend,
                     COALESCE(AVG(pi.rate), 0) as avg_rate
              FROM products pr
              JOIN purchase_items pi ON pi.product_id = pr.id
              GROUP BY pr.id
              ORDER BY total_spend DESC
            `
          : await sql`
              SELECT pr.id, pr.sku, pr.name as product_name, pr.brand,
                     COUNT(pi.id) as total_purchases_count,
                     COALESCE(SUM(pi.quantity), 0) as total_qty_purchased,
                     COALESCE(SUM(pi.total), 0) as total_spend,
                     COALESCE(AVG(pi.rate), 0) as avg_rate
              FROM products pr
              JOIN purchase_items pi ON pi.product_id = pr.id
              WHERE pr.company_id = ${safeInt(compQuery) || safeInt(user.company_id) || 1}
              GROUP BY pr.id
              ORDER BY total_spend DESC
            `;
        let totProdQty = 0, totProdSpend = 0;
        rows.forEach(r => {
          totProdQty += parseInt(r.total_qty_purchased || 0, 10);
          totProdSpend += parseFloat(r.total_spend || 0);
        });
        return res.status(200).json({
          success: true,
          report: "product-purchase",
          summary: { unique_products_purchased: rows.length, total_qty_purchased: totProdQty, total_spend: totProdSpend },
          data: rows
        });
      }

      else if (type === "serial-history") {
        const rows = isAll
          ? await sql`
              SELECT t.*, p.name as product_name, p.sku, u.username as user_name
              FROM inventory_transactions t
              LEFT JOIN products p ON t.product_id = p.id
              LEFT JOIN users u ON t.performed_by = u.id
              WHERE t.serial_numbers_json IS NOT NULL AND t.serial_numbers_json != ''
              ORDER BY t.created_at DESC
              LIMIT 150
            `
          : await sql`
              SELECT t.*, p.name as product_name, p.sku, u.username as user_name
              FROM inventory_transactions t
              LEFT JOIN products p ON t.product_id = p.id
              LEFT JOIN users u ON t.performed_by = u.id
              WHERE t.company_id = ${safeInt(compQuery) || safeInt(user.company_id) || 1} AND t.serial_numbers_json IS NOT NULL AND t.serial_numbers_json != ''
              ORDER BY t.created_at DESC
              LIMIT 150
            `;
        return res.status(200).json({
          success: true,
          report: "serial-history",
          summary: { total_serial_logs: rows.length },
          data: rows
        });
      }

      else if (type === "stock-adjustments") {
        const rows = isAll
          ? await sql`
              SELECT t.*, p.name as product_name, p.sku, u.username as user_name, c.name as company_name
              FROM inventory_transactions t
              LEFT JOIN products p ON t.product_id = p.id
              LEFT JOIN users u ON t.performed_by = u.id
              LEFT JOIN companies c ON t.company_id = c.id
              WHERE t.transaction_type IN ('adjustment', 'correction', 'manual', 'waste', 'loss', 'damage') OR t.reference_type = 'adjustment'
              ORDER BY t.created_at DESC
            `
          : await sql`
              SELECT t.*, p.name as product_name, p.sku, u.username as user_name, c.name as company_name
              FROM inventory_transactions t
              LEFT JOIN products p ON t.product_id = p.id
              LEFT JOIN users u ON t.performed_by = u.id
              LEFT JOIN companies c ON t.company_id = c.id
              WHERE t.company_id = ${safeInt(compQuery) || safeInt(user.company_id) || 1}
                AND (t.transaction_type IN ('adjustment', 'correction', 'manual', 'waste', 'loss', 'damage') OR t.reference_type = 'adjustment')
              ORDER BY t.created_at DESC
            `;
        let netAdjustedQty = 0;
        rows.forEach(r => netAdjustedQty += (r.quantity || 0));
        return res.status(200).json({
          success: true,
          report: "stock-adjustments",
          summary: { total_adjustment_entries: rows.length, net_adjusted_quantity: netAdjustedQty },
          data: rows
        });
      }

      else if (type === "dead-slow-stock") {
        const rows = isAll
          ? await sql`
              SELECT p.*, v.legal_name as supplier_name, c.name as company_name,
                     (p.current_stock * p.purchase_rate) as tied_capital,
                     (SELECT MAX(created_at) FROM inventory_transactions it WHERE it.product_id = p.id) as last_movement_date
              FROM products p
              LEFT JOIN dealers v ON p.supplier_id = v.id
              LEFT JOIN companies c ON p.company_id = c.id
              WHERE p.is_active = true AND p.current_stock > 0
                AND (
                  (SELECT MAX(created_at) FROM inventory_transactions it WHERE it.product_id = p.id) IS NULL
                  OR (SELECT MAX(created_at) FROM inventory_transactions it WHERE it.product_id = p.id) < NOW() - INTERVAL '1 day' * ${daysThreshold}
                )
              ORDER BY tied_capital DESC
            `
          : await sql`
              SELECT p.*, v.legal_name as supplier_name, c.name as company_name,
                     (p.current_stock * p.purchase_rate) as tied_capital,
                     (SELECT MAX(created_at) FROM inventory_transactions it WHERE it.product_id = p.id) as last_movement_date
              FROM products p
              LEFT JOIN dealers v ON p.supplier_id = v.id
              LEFT JOIN companies c ON p.company_id = c.id
              WHERE p.is_active = true AND p.current_stock > 0 AND p.company_id = ${safeInt(compQuery) || safeInt(user.company_id) || 1}
                AND (
                  (SELECT MAX(created_at) FROM inventory_transactions it WHERE it.product_id = p.id) IS NULL
                  OR (SELECT MAX(created_at) FROM inventory_transactions it WHERE it.product_id = p.id) < NOW() - INTERVAL '1 day' * ${daysThreshold}
                )
              ORDER BY tied_capital DESC
            `;
        let totalTiedCapital = 0, totalSlowStockUnits = 0;
        rows.forEach(r => {
          totalTiedCapital += parseFloat(r.tied_capital || 0);
          totalSlowStockUnits += (r.current_stock || 0);
        });
        return res.status(200).json({
          success: true,
          report: "dead-slow-stock",
          summary: { total_dead_skus: rows.length, total_slow_units: totalSlowStockUnits, total_tied_capital: totalTiedCapital, days_threshold: daysThreshold },
          data: rows
        });
      }

      else {
        return res.status(400).json({ error: "Invalid report type specified" });
      }
    }

    else {
      return res.status(404).json({ error: `Action '${action}' not recognized` });
    }

  } catch (error) {
    console.error(`api/inventory error [${action}]:`, error);
    const msg = error.message || "Server error";
    const isUserErr = msg.includes("HSN GST Rate Mismatch") || msg.includes("blocked") || msg.includes("required") || msg.includes("invalid");
    return res.status(isUserErr ? 400 : 500).json({ error: msg, details: msg });
  }
};
