const { getSQL } = require('./shared/db');
(async () => {
  const sql = getSQL();
  const comps = await sql`SELECT id, name, parent_company_id, gstin, pan FROM companies ORDER BY id ASC`;
  console.log('COMPANIES:', JSON.stringify(comps, null, 2));
  const invs = await sql`
    SELECT i.id, i.company_id, c.name as company_name, i.sale_id, i.invoice_number, i.invoice_date, i.created_at
    FROM invoices i
    JOIN companies c ON i.company_id = c.id
    ORDER BY i.id ASC
  `;
  console.log('INVOICES:', JSON.stringify(invs, null, 2));
  const sales = await sql`
    SELECT s.id, s.company_id, c.name as company_name, s.invoice_number, s.sale_date, s.created_at
    FROM sales s
    JOIN companies c ON s.company_id = c.id
    ORDER BY s.id ASC
  `;
  console.log('SALES:', JSON.stringify(sales, null, 2));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
