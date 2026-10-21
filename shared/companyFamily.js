/**
 * shared/companyFamily.js
 * Multi-branch Company Group & Unified Sequential Numbering Engine
 * Under Indian GST and commercial regulations, all stores / sub-branches operating under
 * the same parent company group or same GSTIN share a single continuous sequential sequence.
 */

function formatDdmmyy(dateVal) {
  if (!dateVal) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    return `${dd}${mm}${yy}`;
  }
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
    const parts = dateVal.split('T')[0].split('-');
    return `${parts[2]}${parts[1]}${parts[0].slice(-2)}`;
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    return `${dd}${mm}${yy}`;
  }
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}

function getCompanyBrandKey(comp) {
  if (!comp) return '';
  const gstin = (comp.gstin || '').trim().toUpperCase();
  if (gstin.length === 15) return gstin.slice(2, 12); // PAN portion of GSTIN
  if (gstin.length >= 10) return gstin;

  const pan = (comp.pan || '').trim().toUpperCase();
  if (pan.length >= 10) return pan;

  const rawName = (comp.name || '').toUpperCase().trim();
  if (rawName.includes('GEETHA')) return 'GEETHA';
  if (rawName.includes('MANASWINI')) return 'MANASWINI';

  const clean = rawName.replace(/[^A-Z0-9\s]/g, ' ').trim().split(/\s+/);
  return clean.slice(0, 2).join(' ') || rawName;
}

async function getCompanyFamilyInfo(sql, compId) {
  if (!compId || isNaN(parseInt(compId))) {
    return {
      rootParentId: 1,
      rootName: 'GEETHA ENTERPRISES',
      sharedGstin: '',
      comp4Letter: 'GEET',
      familyCompIds: [1]
    };
  }
  const targetId = parseInt(compId);

  let allComps = [];
  try {
    allComps = await sql`
      SELECT id, name, trade_name, parent_company_id, gstin, pan, city, state 
      FROM companies 
      ORDER BY id ASC
    `;
  } catch (err) {
    console.error("getCompanyFamilyInfo db error:", err.message);
    return {
      rootParentId: targetId,
      rootName: 'GEETHA ENTERPRISES',
      sharedGstin: '',
      comp4Letter: 'GEET',
      familyCompIds: [targetId]
    };
  }

  const target = allComps.find(c => parseInt(c.id) === targetId);
  if (!target) {
    return {
      rootParentId: targetId,
      rootName: 'GEETHA ENTERPRISES',
      sharedGstin: '',
      comp4Letter: 'GEET',
      familyCompIds: [targetId]
    };
  }

  const targetBrandKey = getCompanyBrandKey(target);
  const targetGstin = (target.gstin || '').trim().toUpperCase();
  const targetPan = (target.pan || '').trim().toUpperCase();
  const targetParentId = target.parent_company_id ? parseInt(target.parent_company_id) : null;

  // Find all companies in this family
  const familyComps = [];
  for (const c of allComps) {
    const cId = parseInt(c.id);
    const cBrandKey = getCompanyBrandKey(c);
    const cGstin = (c.gstin || '').trim().toUpperCase();
    const cPan = (c.pan || '').trim().toUpperCase();
    const cParentId = c.parent_company_id ? parseInt(c.parent_company_id) : null;

    let isMatch = false;

    // 1. Direct ID
    if (cId === targetId) {
      isMatch = true;
    }
    // 2. Direct parent-child link (either c is parent, target is parent, or both share parent)
    else if (cParentId && cParentId === targetId) {
      isMatch = true;
    } else if (targetParentId && cId === targetParentId) {
      isMatch = true;
    } else if (targetParentId && cParentId && cParentId === targetParentId) {
      isMatch = true;
    }
    // 3. Matching non-empty GSTIN
    else if (targetGstin && cGstin && targetGstin === cGstin) {
      isMatch = true;
    }
    // 4. Matching non-empty PAN
    else if (targetPan && cPan && targetPan === cPan) {
      isMatch = true;
    }
    // 5. Matching brand name / group key
    else if (targetBrandKey && cBrandKey && targetBrandKey === cBrandKey) {
      isMatch = true;
    }

    if (isMatch && !familyComps.some(x => parseInt(x.id) === cId)) {
      familyComps.push(c);
    }
  }

  // Root company in the family: prioritize parent_company_id == null or lowest ID
  const rootComp = familyComps.find(c => !c.parent_company_id) || familyComps[0] || target;
  const familyCompIds = familyComps.map(c => parseInt(c.id));

  // Determine prefix: 'GEET' for Geetha, 'MANA' for Manaswini
  const brandName = (rootComp.name || target.name || 'GEETHA').trim();
  const cleanName = brandName.replace(/[^a-zA-Z]/g, '').toUpperCase();
  let comp4Letter = (cleanName.slice(0, 4) || 'GEET').padEnd(4, 'X');
  if (targetBrandKey === 'GEETHA' || brandName.toUpperCase().includes('GEETHA')) {
    comp4Letter = 'GEET';
  } else if (targetBrandKey === 'MANASWINI' || brandName.toUpperCase().includes('MANASWINI')) {
    comp4Letter = 'MANA';
  }

  const sharedGstin = (rootComp.gstin || target.gstin || '').trim();

  return {
    rootParentId: parseInt(rootComp.id),
    rootName: rootComp.name || target.name,
    sharedGstin,
    comp4Letter,
    familyCompIds
  };
}

// ── Invoices Sequence ──
async function getNextFamilyInvoiceNumber(sql, compId, dateVal) {
  const familyInfo = await getCompanyFamilyInfo(sql, compId);
  const familyCompIds = (familyInfo && familyInfo.familyCompIds && familyInfo.familyCompIds.length > 0)
    ? familyInfo.familyCompIds
    : [parseInt(compId)];
  const comp4Letter = familyInfo ? familyInfo.comp4Letter : 'GEET';
  const ddmmyy = formatDdmmyy(dateVal);

  const lastInvs = await sql`
    SELECT invoice_number FROM invoices 
    WHERE company_id = ANY(${familyCompIds}) 
      AND invoice_number IS NOT NULL AND invoice_number != ''
    ORDER BY id DESC LIMIT 500
  `;

  let maxSeq = 0;
  for (const row of lastInvs) {
    if (row.invoice_number) {
      const match = row.invoice_number.match(/-(\d+)$/) || row.invoice_number.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }
  }

  const lastSales = await sql`
    SELECT invoice_number FROM sales
    WHERE company_id = ANY(${familyCompIds})
      AND invoice_number IS NOT NULL AND invoice_number != ''
    ORDER BY id DESC LIMIT 500
  `;
  for (const row of lastSales) {
    if (row.invoice_number) {
      const match = row.invoice_number.match(/-(\d+)$/) || row.invoice_number.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  const invNo = `${comp4Letter}${ddmmyy}-${String(nextSeq).padStart(3, '0')}`;
  return { invNo, nextSeq, familyInfo };
}

async function resequenceInvoices(sql, compId = null) {
  try {
    try {
      await sql`
        UPDATE sales s
        SET invoice_number = i.invoice_number,
            invoice_date = COALESCE(s.invoice_date, i.invoice_date)
        FROM invoices i
        WHERE i.sale_id = s.id
          AND (s.invoice_number IS NULL OR s.invoice_number = '' OR s.invoice_number != i.invoice_number)
      `;
    } catch (syncErr) {
      console.warn("Initial sales-invoice sync error:", syncErr.message);
    }

    let targetFamilies = [];

    if (compId && compId !== "all" && !isNaN(parseInt(compId))) {
      const familyInfo = await getCompanyFamilyInfo(sql, parseInt(compId));
      if (familyInfo) {
        targetFamilies.push(familyInfo);
      }
    } else {
      const allComps = await sql`SELECT id, name, parent_company_id, gstin, pan FROM companies ORDER BY id ASC`;
      const processedCompIds = new Set();

      for (const comp of allComps) {
        const cId = parseInt(comp.id);
        if (processedCompIds.has(cId)) continue;

        const familyInfo = await getCompanyFamilyInfo(sql, cId);
        if (familyInfo) {
          targetFamilies.push(familyInfo);
          familyInfo.familyCompIds.forEach(id => processedCompIds.add(id));
        }
      }
    }

    for (const family of targetFamilies) {
      if (!family.familyCompIds || family.familyCompIds.length === 0) continue;

      const invoices = await sql`
        SELECT i.id, i.company_id, i.sale_id, i.invoice_date, i.created_at, i.invoice_number,
               s.is_custom
        FROM invoices i
        LEFT JOIN sales s ON i.sale_id = s.id
        WHERE i.company_id = ANY(${family.familyCompIds})
          AND (s.is_custom IS NOT TRUE OR s.is_custom = false)
        ORDER BY COALESCE(i.invoice_date, i.created_at) ASC, i.id ASC
      `;

      if (invoices.length === 0) continue;

      // Phase 1: Set temporary numbers to avoid UNIQUE (company_id, invoice_number) constraint collisions
      for (const inv of invoices) {
        await sql`UPDATE invoices SET invoice_number = ${`TEMP-${inv.id}-${Date.now()}`} WHERE id = ${inv.id}`;
      }

      // Phase 2: Set clean, unified sequential numbers across all branches in this family
      let seq = 1;
      for (const inv of invoices) {
        const ddmmyy = formatDdmmyy(inv.invoice_date || inv.created_at);
        const formattedNo = `${family.comp4Letter}${ddmmyy}-${String(seq).padStart(3, '0')}`;
        await sql`UPDATE invoices SET invoice_number = ${formattedNo} WHERE id = ${inv.id}`;
        if (inv.sale_id) {
          await sql`UPDATE sales SET invoice_number = ${formattedNo} WHERE id = ${inv.sale_id}`;
        }
        seq++;
      }
    }
  } catch (err) {
    console.error("resequenceInvoices error:", err.message);
  }
}

// ── Delivery Challan Sequence ──
async function getNextFamilyDcNumber(sql, compId) {
  const familyInfo = await getCompanyFamilyInfo(sql, compId);
  const familyCompIds = (familyInfo && familyInfo.familyCompIds && familyInfo.familyCompIds.length > 0)
    ? familyInfo.familyCompIds
    : [parseInt(compId)];

  const lastDc = await sql`
    SELECT challan_number FROM sales 
    WHERE company_id = ANY(${familyCompIds}) 
      AND challan_number IS NOT NULL AND challan_number != ''
    ORDER BY id DESC LIMIT 500
  `;

  let maxSeq = 0;
  for (const row of lastDc) {
    if (row.challan_number) {
      const match = row.challan_number.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return nextSeq.toString();
}

// ── Sale Payment Receipt Sequence ──
async function getNextFamilyReceiptNumber(sql, compId) {
  const familyInfo = await getCompanyFamilyInfo(sql, compId);
  const familyCompIds = (familyInfo && familyInfo.familyCompIds && familyInfo.familyCompIds.length > 0)
    ? familyInfo.familyCompIds
    : [parseInt(compId)];

  const lastRcpts = await sql`
    SELECT receipt_number FROM sale_payments 
    WHERE company_id = ANY(${familyCompIds}) 
      AND receipt_number IS NOT NULL AND receipt_number != ''
    ORDER BY id DESC LIMIT 500
  `;

  let maxSeq = 0;
  for (const row of lastRcpts) {
    if (row.receipt_number) {
      const match = row.receipt_number.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `RCP-${String(nextSeq).padStart(3, '0')}`;
}

async function resequenceReceipts(sql, compId = null) {
  try {
    let targetFamilies = [];
    if (compId && compId !== "all" && !isNaN(parseInt(compId))) {
      const familyInfo = await getCompanyFamilyInfo(sql, parseInt(compId));
      if (familyInfo) targetFamilies.push(familyInfo);
    } else {
      const allComps = await sql`SELECT id, name, parent_company_id, gstin, pan FROM companies ORDER BY id ASC`;
      const processedCompIds = new Set();
      for (const comp of allComps) {
        const cId = parseInt(comp.id);
        if (processedCompIds.has(cId)) continue;
        const familyInfo = await getCompanyFamilyInfo(sql, cId);
        if (familyInfo) {
          targetFamilies.push(familyInfo);
          familyInfo.familyCompIds.forEach(id => processedCompIds.add(id));
        }
      }
    }

    for (const family of targetFamilies) {
      if (!family.familyCompIds || family.familyCompIds.length === 0) continue;
      const receipts = await sql`
        SELECT id FROM sale_payments 
        WHERE company_id = ANY(${family.familyCompIds})
        ORDER BY payment_date ASC, id ASC
      `;
      let seq = 1;
      for (const r of receipts) {
        const formattedNo = `RCP-${String(seq).padStart(3, '0')}`;
        await sql`UPDATE sale_payments SET receipt_number = ${formattedNo} WHERE id = ${r.id}`;
        seq++;
      }
    }
  } catch (err) {
    console.error("resequenceReceipts error:", err.message);
  }
}

// ── Service Jobs & Service Payments Sequence ──
async function getNextFamilyServiceJobNumber(sql, compId) {
  const familyInfo = await getCompanyFamilyInfo(sql, compId);
  const familyCompIds = (familyInfo && familyInfo.familyCompIds && familyInfo.familyCompIds.length > 0)
    ? familyInfo.familyCompIds
    : [parseInt(compId)];

  const lastJobs = await sql`
    SELECT job_number FROM service_jobs 
    WHERE company_id = ANY(${familyCompIds}) 
      AND job_number IS NOT NULL AND job_number != ''
    ORDER BY id DESC LIMIT 500
  `;

  let maxSeq = 0;
  for (const row of lastJobs) {
    if (row.job_number) {
      const match = row.job_number.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `JOB-${String(nextSeq).padStart(3, '0')}`;
}

async function getNextFamilyServiceReceiptNumber(sql, compId) {
  const familyInfo = await getCompanyFamilyInfo(sql, compId);
  const familyCompIds = (familyInfo && familyInfo.familyCompIds && familyInfo.familyCompIds.length > 0)
    ? familyInfo.familyCompIds
    : [parseInt(compId)];

  const lastRcpts = await sql`
    SELECT receipt_number FROM service_payments 
    WHERE company_id = ANY(${familyCompIds}) 
      AND receipt_number IS NOT NULL AND receipt_number != ''
    ORDER BY id DESC LIMIT 500
  `;

  let maxSeq = 0;
  for (const row of lastRcpts) {
    if (row.receipt_number) {
      const match = row.receipt_number.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `RCP-SVC-${String(nextSeq).padStart(3, '0')}`;
}

// ── Expenses Sequence ──
async function getNextFamilyExpenseNumber(sql, compId) {
  const familyInfo = await getCompanyFamilyInfo(sql, compId);
  const familyCompIds = (familyInfo && familyInfo.familyCompIds && familyInfo.familyCompIds.length > 0)
    ? familyInfo.familyCompIds
    : [parseInt(compId)];

  const lastExps = await sql`
    SELECT receipt_number FROM expenses 
    WHERE company_id = ANY(${familyCompIds}) 
      AND receipt_number IS NOT NULL AND receipt_number != ''
    ORDER BY id DESC LIMIT 500
  `;

  let maxSeq = 0;
  for (const row of lastExps) {
    if (row.receipt_number) {
      const match = row.receipt_number.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `EXP-${String(nextSeq).padStart(3, '0')}`;
}

// ── HR / Employees Code Sequence ──
async function getNextFamilyEmployeeCode(sql, compId) {
  const familyInfo = await getCompanyFamilyInfo(sql, compId);
  const familyCompIds = (familyInfo && familyInfo.familyCompIds && familyInfo.familyCompIds.length > 0)
    ? familyInfo.familyCompIds
    : [parseInt(compId)];
  const prefix = familyInfo ? `${familyInfo.comp4Letter}-EMP-` : 'GEET-EMP-';

  const emps = await sql`
    SELECT employee_code FROM employees
    WHERE company_id = ANY(${familyCompIds}) 
      AND employee_code IS NOT NULL AND employee_code != ''
    ORDER BY id DESC LIMIT 500
  `;

  let maxSeq = 0;
  for (const row of emps) {
    if (row.employee_code) {
      const match = row.employee_code.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

// ── HR / Advances & Repayments Sequence ──
async function getNextFamilyAdvanceNumber(sql, compId) {
  const familyInfo = await getCompanyFamilyInfo(sql, compId);
  const familyCompIds = (familyInfo && familyInfo.familyCompIds && familyInfo.familyCompIds.length > 0)
    ? familyInfo.familyCompIds
    : [parseInt(compId)];

  const lastAdvs = await sql`
    SELECT receipt_number FROM employee_advances
    WHERE company_id = ANY(${familyCompIds})
      AND receipt_number IS NOT NULL AND receipt_number != ''
    ORDER BY id DESC LIMIT 500
  `;

  let maxSeq = 0;
  for (const row of lastAdvs) {
    if (row.receipt_number) {
      const match = row.receipt_number.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `ADV-${String(nextSeq).padStart(3, '0')}`;
}

async function getNextFamilyAdvanceReceiptNumber(sql, compId) {
  const familyInfo = await getCompanyFamilyInfo(sql, compId);
  const familyCompIds = (familyInfo && familyInfo.familyCompIds && familyInfo.familyCompIds.length > 0)
    ? familyInfo.familyCompIds
    : [parseInt(compId)];

  const lastRcpts = await sql`
    SELECT receipt_number FROM employee_advance_receipts
    WHERE receipt_number LIKE 'RCP-ADV-%'
    ORDER BY id DESC LIMIT 500
  `;

  let maxSeq = 0;
  for (const row of lastRcpts) {
    if (row.receipt_number) {
      const match = row.receipt_number.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `RCP-ADV-${String(nextSeq).padStart(3, '0')}`;
}

// ── Purchase Order Sequence ──
async function getNextFamilyPoNumber(sql, compId) {
  const familyInfo = await getCompanyFamilyInfo(sql, compId);
  const familyCompIds = (familyInfo && familyInfo.familyCompIds && familyInfo.familyCompIds.length > 0)
    ? familyInfo.familyCompIds
    : [parseInt(compId)];

  const lastPos = await sql`
    SELECT po_number FROM purchase_orders
    WHERE company_id = ANY(${familyCompIds})
      AND po_number IS NOT NULL AND po_number != ''
    ORDER BY id DESC LIMIT 500
  `;

  let maxSeq = 0;
  for (const row of lastPos) {
    if (row.po_number) {
      const match = row.po_number.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `PO-${String(nextSeq).padStart(3, '0')}`;
}

module.exports = {
  formatDdmmyy,
  getCompanyBrandKey,
  getCompanyFamilyInfo,
  getNextFamilyInvoiceNumber,
  resequenceInvoices,
  getNextFamilyDcNumber,
  getNextFamilyReceiptNumber,
  resequenceReceipts,
  getNextFamilyServiceJobNumber,
  getNextFamilyServiceReceiptNumber,
  getNextFamilyExpenseNumber,
  getNextFamilyEmployeeCode,
  getNextFamilyAdvanceNumber,
  getNextFamilyAdvanceReceiptNumber,
  getNextFamilyPoNumber
};
