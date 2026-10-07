const { getSQL } = require("../shared/db");
const bcrypt = require("bcryptjs");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const sql = getSQL();

    // ═══════════════════════════════════════════════════════════

    await sql`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        parent_company_id INT REFERENCES companies(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        trade_name VARCHAR(255),
        gstin VARCHAR(20),
        pan VARCHAR(15),
        hsn_code VARCHAR(50),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        state_code VARCHAR(5),
        pincode VARCHAR(10),
        phone VARCHAR(20),
        email VARCHAR(100),
        logo_data TEXT,
        bank_name VARCHAR(100),
        bank_account VARCHAR(50),
        bank_ifsc VARCHAR(20),
        bank_branch VARCHAR(100),
        settings_json TEXT,
        capital_editable BOOLEAN DEFAULT true,
        inventory_add_control TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS website VARCHAR(255) DEFAULT 'https://manageetha.in'`;

    // Financial Years
    await sql`
      CREATE TABLE IF NOT EXISTS financial_years (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        label VARCHAR(20) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_current BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // ═══════════════════════════════════════════════════════════
    // AUTH & RBAC
    // ═══════════════════════════════════════════════════════════

    // Roles per company
    await sql`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        role_name VARCHAR(50) NOT NULL,
        description TEXT,
        is_system BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_role_company_uniq`;
    await sql`ALTER TABLE roles ADD CONSTRAINT roles_role_company_uniq UNIQUE (role_name, company_id)`;

    // Menu categories
    await sql`
      CREATE TABLE IF NOT EXISTS menu_categories (
        id SERIAL PRIMARY KEY,
        category_key VARCHAR(50) UNIQUE NOT NULL,
        category_label VARCHAR(100) NOT NULL,
        icon VARCHAR(10),
        sort_order INT DEFAULT 0
      )
    `;

    // Menu items
    await sql`
      CREATE TABLE IF NOT EXISTS menus (
        id SERIAL PRIMARY KEY,
        category_id INT REFERENCES menu_categories(id),
        menu_key VARCHAR(50) UNIQUE NOT NULL,
        menu_label VARCHAR(100) NOT NULL,
        icon VARCHAR(10),
        sort_order INT DEFAULT 0
      )
    `;

    // Role-menu mappings per company
    await sql`
      CREATE TABLE IF NOT EXISTS role_menu_mappings (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        role_name VARCHAR(50) NOT NULL,
        menu_key VARCHAR(50) NOT NULL,
        menu_label VARCHAR(100) NOT NULL,
        menu_icon VARCHAR(10),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE role_menu_mappings DROP CONSTRAINT IF EXISTS rmm_uniq`;
    await sql`ALTER TABLE role_menu_mappings ADD CONSTRAINT rmm_uniq UNIQUE (company_id, role_name, menu_key)`;

    // Users — one user = one company = one role. Superadmin: company_id = NULL
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE SET NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(100),
        phone VARCHAR(20),
        role VARCHAR(50) NOT NULL DEFAULT 'storeadmin',
        employee_id INT,
        is_active BOOLEAN DEFAULT true,
        last_login_at TIMESTAMP,
        last_logout_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_logout_at TIMESTAMP;`;

    // ═══════════════════════════════════════════════════════════
    // PEOPLE
    // ═══════════════════════════════════════════════════════════

    // Employees
    await sql`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        employee_code VARCHAR(50),
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(100),
        address TEXT,
        joining_date DATE,
        department VARCHAR(100),
        designation VARCHAR(100),
        reporting_manager_id INT REFERENCES employees(id) ON DELETE SET NULL,
        employment_type VARCHAR(50),
        employment_status VARCHAR(20) DEFAULT 'active',
        basic_salary NUMERIC(15,2) DEFAULT 0,
        salary_structure_json TEXT,
        bank_name VARCHAR(100),
        bank_account VARCHAR(50),
        bank_ifsc VARCHAR(20),
        statutory_json TEXT,
        documents_json TEXT,
        emergency_contact_json TEXT,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Payroll Table
    await sql`
      CREATE TABLE IF NOT EXISTS payroll (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
        month_year VARCHAR(10) NOT NULL,
        basic_salary NUMERIC(15,2) DEFAULT 0,
        allowances NUMERIC(15,2) DEFAULT 0,
        deductions NUMERIC(15,2) DEFAULT 0,
        advances_deducted NUMERIC(15,2) DEFAULT 0,
        net_salary NUMERIC(15,2) DEFAULT 0,
        payment_status VARCHAR(20) DEFAULT 'unpaid',
        payment_date DATE,
        payment_mode VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS pf_calculation_mode VARCHAR(30) DEFAULT 'capped_1800';`;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS vpf_deduction NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS lta_allowance NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS children_edu_allowance NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS uniform_allowance NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS learning_allowance NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS car_fuel_allowance NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS cca_allowance NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS tds_deduction NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS pt_deduction NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS insurance_deduction NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS facility_deduction NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`;

    // Employee Tasks Table
    await sql`
      CREATE TABLE IF NOT EXISTS employee_tasks (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        assigned_by INT REFERENCES users(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        priority VARCHAR(20) DEFAULT 'medium',
        status VARCHAR(30) DEFAULT 'pending',
        due_date DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE employee_tasks ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;`;

    // Customers
    await sql`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(100),
        address TEXT,
        gstin VARCHAR(20),
        state VARCHAR(100),
        state_code VARCHAR(5),
        total_purchases INT DEFAULT 0,
        perks_json TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // dealers
    await sql`
      CREATE TABLE IF NOT EXISTS dealers (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        dealer_code VARCHAR(50),
        legal_name VARCHAR(255) NOT NULL,
        trade_name VARCHAR(255),
        gstin VARCHAR(20),
        pan VARCHAR(15),
        address TEXT,
        state VARCHAR(100),
        state_code VARCHAR(5),
        contact_person VARCHAR(255),
        phone VARCHAR(20),
        email VARCHAR(100),
        bank_details_json TEXT,
        gst_registration_type VARCHAR(50),
        credit_terms VARCHAR(100),
        opening_balance NUMERIC(15,2) DEFAULT 0,
        documents_json TEXT,
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Dedicated Suppliers Table (Purchasing & Inward Inventory)
    await sql`
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        supplier_code VARCHAR(50),
        legal_name VARCHAR(255) NOT NULL,
        trade_name VARCHAR(255),
        gstin VARCHAR(20),
        pan VARCHAR(15),
        address TEXT,
        state VARCHAR(100),
        state_code VARCHAR(5),
        contact_person VARCHAR(255),
        phone VARCHAR(20),
        email VARCHAR(100),
        bank_details_json TEXT,
        gst_registration_type VARCHAR(50),
        credit_terms VARCHAR(100),
        opening_balance NUMERIC(15,2) DEFAULT 0,
        documents_json TEXT,
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Drop old FK constraints on supplier_id pointing to dealers
    try { await sql`ALTER TABLE products DROP CONSTRAINT IF EXISTS products_supplier_id_fkey`; } catch (e) {}
    try { await sql`ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_supplier_id_fkey`; } catch (e) {}
    try { await sql`ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_supplier_id_fkey`; } catch (e) {}

    // Initial migration: copy existing dealer records into suppliers if suppliers table is empty


    // Financers
    await sql`
      CREATE TABLE IF NOT EXISTS financers (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50),
        contact_person VARCHAR(255),
        phone VARCHAR(20),
        email VARCHAR(100),
        address TEXT,
        details_json TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // ═══════════════════════════════════════════════════════════
    // PRODUCTS & INVENTORY
    // ═══════════════════════════════════════════════════════════

    await sql`
      CREATE TABLE IF NOT EXISTS product_categories (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        parent_id INT REFERENCES product_categories(id) ON DELETE SET NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS hsn_codes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        gst_rate NUMERIC(5,2) DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    try {
      await sql`ALTER TABLE hsn_codes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;`;
      await sql`ALTER TABLE hsn_codes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`;
      await sql`ALTER TABLE hsn_codes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC(15,3) DEFAULT 0;`;
      await sql`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS pending_amount NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';`;
      await sql`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(5,2) DEFAULT 0;`;
      await sql`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS interest_frequency VARCHAR(20) DEFAULT 'monthly';`;
      await sql`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS due_date DATE;`;

      // Auto-sync missing HSN codes from products into hsn_codes table
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
    } catch (e) {
      console.log("hsn_codes / products / purchases migration non-critical:", e.message);
    }

    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        supervisor_name VARCHAR(255),
        sku VARCHAR(100),
        name VARCHAR(255) NOT NULL,
        brand VARCHAR(100),
        model VARCHAR(100),
        category_id INT REFERENCES product_categories(id) ON DELETE SET NULL,
        hsn_sac VARCHAR(20),
        unit_of_measure VARCHAR(20) DEFAULT 'NOS',
        gst_rate NUMERIC(5,2) DEFAULT 0,
        purchase_rate NUMERIC(15,2) DEFAULT 0,
        purchase_rate_incl_tax NUMERIC(15,2) DEFAULT 0,
        transport_expenses NUMERIC(15,2) DEFAULT 0,
        selling_percentage NUMERIC(7,2) DEFAULT 0,
        selling_rate NUMERIC(15,2) DEFAULT 0,
        mrp NUMERIC(15,2),
        current_stock INT DEFAULT 0,
        min_stock INT DEFAULT 0,
        moq INT DEFAULT 1,
        reorder_level INT DEFAULT 0,
        serial_tracking BOOLEAN DEFAULT false,
        batch_tracking BOOLEAN DEFAULT false,
        warranty_duration VARCHAR(50),
        warranty_basis VARCHAR(50),
        barcode VARCHAR(100),
        rack_no VARCHAR(50),
        weight NUMERIC(10,3) DEFAULT 0,
        supplier_id INT REFERENCES dealers(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`UPDATE products SET gst_rate = 18.00 WHERE gst_rate > 17 AND gst_rate < 18`;
    try { await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC(10,3) DEFAULT 0;`; } catch(e){}
    try { await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_rate_incl_tax NUMERIC(15,2) DEFAULT 0;`; } catch(e){}
    try { await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS transport_expenses NUMERIC(15,2) DEFAULT 0;`; } catch(e){}
    try { await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_percentage NUMERIC(15,2) DEFAULT 0;`; } catch(e){}
    try { await sql`ALTER TABLE products ALTER COLUMN selling_percentage TYPE NUMERIC(15,2);`; } catch(e){}
    try { await sql`ALTER TABLE products ALTER COLUMN gst_rate TYPE NUMERIC(15,2);`; } catch(e){}

    try {
      await sql`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS pending_amount NUMERIC(15,2) DEFAULT 0;`;
      await sql`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid';`;
      await sql`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(5,2) DEFAULT 0;`;
      await sql`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS interest_frequency VARCHAR(20) DEFAULT 'monthly';`;
      await sql`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS due_date DATE;`;
    } catch(e){}

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

    await sql`
      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        product_id INT REFERENCES products(id) ON DELETE CASCADE,
        transaction_type VARCHAR(20),
        quantity INT NOT NULL,
        reference_type VARCHAR(50),
        reference_id INT,
        serial_numbers_json TEXT,
        batch_info_json TEXT,
        performed_by INT REFERENCES users(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // ═══════════════════════════════════════════════════════════
    // PURCHASING
    // ═══════════════════════════════════════════════════════════

    await sql`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        po_number VARCHAR(50) NOT NULL,
        supplier_id INT REFERENCES dealers(id) ON DELETE SET NULL,
        status VARCHAR(30) DEFAULT 'draft',
        order_date DATE,
        expected_date DATE,
        total_amount NUMERIC(15,2) DEFAULT 0,
        notes TEXT,
        description TEXT,
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS po_number_company_uniq`;
    await sql`ALTER TABLE purchase_orders ADD CONSTRAINT po_number_company_uniq UNIQUE (company_id, po_number)`;

    await sql`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id SERIAL PRIMARY KEY,
        po_id INT REFERENCES purchase_orders(id) ON DELETE CASCADE,
        product_id INT REFERENCES products(id) ON DELETE SET NULL,
        quantity INT NOT NULL,
        rate NUMERIC(15,2),
        discount NUMERIC(15,2) DEFAULT 0,
        taxable_value NUMERIC(15,2),
        gst_rate NUMERIC(5,2),
        gst_amount NUMERIC(15,2),
        total NUMERIC(15,2),
        is_new_item BOOLEAN DEFAULT false,
        new_item_description TEXT
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS purchases (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        purchase_invoice_no VARCHAR(50),
        purchase_date DATE,
        supplier_id INT REFERENCES dealers(id) ON DELETE SET NULL,
        po_id INT REFERENCES purchase_orders(id) ON DELETE SET NULL,
        total_amount NUMERIC(15,2),
        gst_amount NUMERIC(15,2),
        grand_total NUMERIC(15,2),
        payment_status VARCHAR(20) DEFAULT 'unpaid',
        attachments_json TEXT,
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS purchase_items (
        id SERIAL PRIMARY KEY,
        purchase_id INT REFERENCES purchases(id) ON DELETE CASCADE,
        product_id INT REFERENCES products(id) ON DELETE SET NULL,
        quantity INT NOT NULL,
        rate NUMERIC(15,2),
        discount NUMERIC(15,2) DEFAULT 0,
        taxable_value NUMERIC(15,2),
        gst_rate NUMERIC(5,2),
        gst_amount NUMERIC(15,2),
        total NUMERIC(15,2),
        serial_numbers_json TEXT,
        batch_info_json TEXT
      )
    `;

    // ═══════════════════════════════════════════════════════════
    // SALES, INVOICES & PAYMENTS
    // ═══════════════════════════════════════════════════════════

    await sql`
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
        sale_date DATE NOT NULL,
        total_amount NUMERIC(15,2),
        discount NUMERIC(15,2) DEFAULT 0,
        taxable_amount NUMERIC(15,2),
        cgst NUMERIC(15,2) DEFAULT 0,
        sgst NUMERIC(15,2) DEFAULT 0,
        igst NUMERIC(15,2) DEFAULT 0,
        tax_amount NUMERIC(15,2),
        grand_total NUMERIC(15,2),
        payment_status VARCHAR(20) DEFAULT 'unpaid',
        payment_mode VARCHAR(20),
        supply_type VARCHAR(50),
        reference_name VARCHAR(255),
        reference_phone VARCHAR(20),
        reference_email VARCHAR(100),
        reference_amount NUMERIC(15,2),
        terms_json TEXT,
        financer_id INT REFERENCES financers(id) ON DELETE SET NULL,
        finance_amount NUMERIC(15,2),
        finance_ref VARCHAR(100),
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS next_dc_number INT DEFAULT 1;`;
    await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS next_invoice_number INT DEFAULT 1;`;

    await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS father_name VARCHAR(255);`;
    await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS village VARCHAR(255);`;
    await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS mandal VARCHAR(255);`;

    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_gstin VARCHAR(50);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS party_type VARCHAR(50) DEFAULT 'customer';`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS dealer_id INT;`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS father_name VARCHAR(255);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS village VARCHAR(255);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS mandal VARCHAR(255);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS cell_phone VARCHAR(50);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS lead_generated_by VARCHAR(255);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS lead_incentive_amount NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS supply_type VARCHAR(100);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS scheme_department VARCHAR(100);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS scheme_app_no VARCHAR(100);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS transporter_name VARCHAR(255);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS transporter_vehicle_no VARCHAR(100);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS challan_number VARCHAR(50);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS advance_amount NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS pending_amount NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS bank_sub_type VARCHAR(50);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS utr_number VARCHAR(100);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS cheque_dd_no VARCHAR(100);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS cheque_dd_date DATE;`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS terms_conditions TEXT;`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS receiving_bank VARCHAR(100);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS incentive_released BOOLEAN DEFAULT FALSE;`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS incentive_release_date TIMESTAMP;`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS incentive_released_by INT;`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS vip_perk_notes TEXT;`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE;`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS custom_type VARCHAR(50);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS consignee_name VARCHAR(255);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS consignee_address TEXT;`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS consignee_state VARCHAR(100);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS consignee_state_code VARCHAR(20);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS receiver_address TEXT;`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS receiver_state VARCHAR(100);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS receiver_state_code VARCHAR(20);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100);`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS custom_meta_json TEXT;`;

    // Sales Returns table
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

    // Backfill sales customers into customers table if not existing
    try {
      await sql`
        INSERT INTO customers (company_id, name, phone, address, created_at)
        SELECT DISTINCT s.company_id, s.customer_name, s.cell_phone, s.village, NOW()
        FROM sales s
        WHERE s.customer_name IS NOT NULL AND TRIM(s.customer_name) != ''
        AND NOT EXISTS (
          SELECT 1 FROM customers c 
          WHERE (c.phone IS NOT NULL AND c.phone != '' AND c.phone = s.cell_phone)
             OR (LOWER(c.name) = LOWER(TRIM(s.customer_name)) AND (c.company_id = s.company_id OR c.company_id IS NULL))
        )
      `;
      await sql`
        UPDATE sales s
        SET customer_id = c.id
        FROM customers c
        WHERE s.customer_id IS NULL
          AND ((c.phone IS NOT NULL AND c.phone != '' AND c.phone = s.cell_phone)
            OR (LOWER(c.name) = LOWER(TRIM(s.customer_name)) AND (c.company_id = s.company_id OR c.company_id IS NULL)))
      `;
    } catch (e) {
      console.error("Backfill customers error:", e);
    }

    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS month VARCHAR(20);`;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS month_year VARCHAR(20);`;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS present_days INT DEFAULT 0;`;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS leave_days INT DEFAULT 0;`;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS absent_days INT DEFAULT 0;`;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS late_days INT DEFAULT 0;`;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS leave_deductions NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS advance_deductions NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS total_deductions NUMERIC(15,2) DEFAULT 0;`;
    await sql`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS processed_by INT;`;

    await sql`
      CREATE TABLE IF NOT EXISTS sale_payments (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        sale_id INT REFERENCES sales(id) ON DELETE CASCADE,
        payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
        payment_mode VARCHAR(50) NOT NULL,
        bank_sub_type VARCHAR(50),
        transaction_ref VARCHAR(100),
        cheque_dd_no VARCHAR(100),
        cheque_dd_date DATE,
        receiving_bank VARCHAR(100),
        amount NUMERIC(15,2) NOT NULL,
        cashier_id INT REFERENCES users(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS company_payment_terms (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        payment_mode VARCHAR(50) NOT NULL,
        terms_text TEXT,
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, payment_mode)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS sale_items (
        id SERIAL PRIMARY KEY,
        sale_id INT REFERENCES sales(id) ON DELETE CASCADE,
        product_id INT REFERENCES products(id) ON DELETE SET NULL,
        description TEXT,
        hsn_code VARCHAR(20),
        quantity INT NOT NULL,
        unit VARCHAR(20) DEFAULT 'NOS',
        rate NUMERIC(15,2),
        discount NUMERIC(15,2) DEFAULT 0,
        taxable_value NUMERIC(15,2),
        gst_rate NUMERIC(5,2),
        cgst NUMERIC(15,2),
        sgst NUMERIC(15,2),
        igst NUMERIC(15,2),
        total NUMERIC(15,2),
        serial_number VARCHAR(100)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        invoice_number VARCHAR(50) NOT NULL,
        invoice_date DATE NOT NULL,
        sale_id INT REFERENCES sales(id) ON DELETE SET NULL,
        dc_id INT,
        customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
        delivery_note VARCHAR(255),
        buyer_order_ref VARCHAR(100),
        dispatch_doc VARCHAR(100),
        dispatched_through VARCHAR(255),
        destination VARCHAR(255),
        delivery_note_date DATE,
        motor_vehicle_no VARCHAR(50),
        bill_of_lading VARCHAR(100),
        taxable_total NUMERIC(15,2),
        cgst_total NUMERIC(15,2),
        sgst_total NUMERIC(15,2),
        igst_total NUMERIC(15,2),
        tax_total NUMERIC(15,2),
        grand_total NUMERIC(15,2),
        amount_in_words VARCHAR(500),
        eway_bill VARCHAR(50),
        barcode_ref VARCHAR(100),
        return_policy_text TEXT,
        terms_json TEXT,
        declaration TEXT,
        is_finalized BOOLEAN DEFAULT false,
        cancelled BOOLEAN DEFAULT false,
        cancel_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoice_number_company_uniq`;
    await sql`ALTER TABLE invoices ADD CONSTRAINT invoice_number_company_uniq UNIQUE (company_id, invoice_number)`;

    await sql`
      CREATE TABLE IF NOT EXISTS delivery_challans (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        dc_number VARCHAR(50) NOT NULL,
        dc_date DATE NOT NULL,
        sale_id INT REFERENCES sales(id) ON DELETE SET NULL,
        invoice_id INT REFERENCES invoices(id) ON DELETE SET NULL,
        customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
        transporter_name VARCHAR(255),
        vehicle_number VARCHAR(50),
        supply_type VARCHAR(50),
        payment_type VARCHAR(20),
        status VARCHAR(20) DEFAULT 'active',
        cancelled_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE delivery_challans DROP CONSTRAINT IF EXISTS dc_number_company_uniq`;
    await sql`ALTER TABLE delivery_challans ADD CONSTRAINT dc_number_company_uniq UNIQUE (company_id, dc_number)`;

    await sql`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        payment_date DATE NOT NULL,
        customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
        sale_id INT REFERENCES sales(id) ON DELETE SET NULL,
        invoice_id INT REFERENCES invoices(id) ON DELETE SET NULL,
        service_job_id INT,
        amount NUMERIC(15,2) NOT NULL,
        payment_mode VARCHAR(20) NOT NULL,
        payment_type VARCHAR(30),
        is_advance BOOLEAN DEFAULT false,
        notification_sent BOOLEAN DEFAULT false,
        notification_ref VARCHAR(100),
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS bank_accounts (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        bank_name VARCHAR(150) NOT NULL,
        account_name VARCHAR(150),
        account_number VARCHAR(50) NOT NULL,
        ifsc_code VARCHAR(20) NOT NULL,
        branch_name VARCHAR(150),
        branch_address TEXT,
        account_type VARCHAR(50) DEFAULT 'Current',
        opening_balance NUMERIC(15,2) DEFAULT 0.00,
        current_balance NUMERIC(15,2) DEFAULT 0.00,
        upi_id VARCHAR(100),
        is_primary BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Alter transaction tables to include bank_account_id
    try { await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS bank_account_id INT REFERENCES bank_accounts(id) ON DELETE SET NULL;`; } catch(e){}
    try { await sql`ALTER TABLE sale_payments ADD COLUMN IF NOT EXISTS bank_account_id INT REFERENCES bank_accounts(id) ON DELETE SET NULL;`; } catch(e){}
    try { await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS bank_account_id INT REFERENCES bank_accounts(id) ON DELETE SET NULL;`; } catch(e){}
    try { await sql`ALTER TABLE capital_entries ADD COLUMN IF NOT EXISTS bank_account_id INT REFERENCES bank_accounts(id) ON DELETE SET NULL;`; } catch(e){}
    try { await sql`ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS bank_account_id INT REFERENCES bank_accounts(id) ON DELETE SET NULL;`; } catch(e){}

    await sql`
      CREATE TABLE IF NOT EXISTS bank_statements (
        id SERIAL PRIMARY KEY,
        bank_account_id INT REFERENCES bank_accounts(id) ON DELETE CASCADE,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        statement_period_from DATE,
        statement_period_to DATE,
        file_name VARCHAR(255),
        file_url TEXT,
        notes TEXT,
        uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
        uploaded_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS bank_payment_details (
        id SERIAL PRIMARY KEY,
        payment_id INT REFERENCES payments(id) ON DELETE CASCADE,
        bank_name VARCHAR(100),
        account_number VARCHAR(50),
        transaction_ref VARCHAR(100),
        instrument_number VARCHAR(50),
        instrument_date DATE
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS upi_payment_details (
        id SERIAL PRIMARY KEY,
        payment_id INT REFERENCES payments(id) ON DELETE CASCADE,
        utr_number VARCHAR(100) NOT NULL,
        upi_ref VARCHAR(100)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS credit_payment_details (
        id SERIAL PRIMARY KEY,
        payment_id INT REFERENCES payments(id) ON DELETE CASCADE,
        amount_paid_by_customer NUMERIC(15,2),
        credit_amount_by_company NUMERIC(15,2),
        original_credit NUMERIC(15,2),
        total_paid_against_credit NUMERIC(15,2) DEFAULT 0,
        outstanding_credit NUMERIC(15,2)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS payment_allocations (
        id SERIAL PRIMARY KEY,
        payment_id INT REFERENCES payments(id) ON DELETE CASCADE,
        invoice_id INT REFERENCES invoices(id) ON DELETE SET NULL,
        allocated_amount NUMERIC(15,2)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS receipts (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        receipt_number VARCHAR(50) NOT NULL,
        receipt_date DATE NOT NULL,
        payment_id INT REFERENCES payments(id) ON DELETE SET NULL,
        customer_id INT,
        dealer_id INT,
        employee_id INT,
        receipt_type VARCHAR(30),
        amount NUMERIC(15,2),
        barcode_ref VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipt_number_company_uniq`;
    await sql`ALTER TABLE receipts ADD CONSTRAINT receipt_number_company_uniq UNIQUE (company_id, receipt_number)`;


    // ═══════════════════════════════════════════════════════════
    // SERVICE
    // ═══════════════════════════════════════════════════════════

    await sql`
      CREATE TABLE IF NOT EXISTS mechanics (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        role VARCHAR(100),
        specialization VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS service_jobs (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        job_number VARCHAR(50) NOT NULL,
        customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
        product_id INT REFERENCES products(id) ON DELETE SET NULL,
        sale_id INT REFERENCES sales(id) ON DELETE SET NULL,
        invoice_id INT REFERENCES invoices(id) ON DELETE SET NULL,
        serial_number VARCHAR(100),
        service_type VARCHAR(20),
        warranty_eligible BOOLEAN DEFAULT false,
        complaint TEXT,
        diagnosis TEXT,
        mechanic_id INT REFERENCES mechanics(id) ON DELETE SET NULL,
        status VARCHAR(30) DEFAULT 'open',
        technician_remarks TEXT,
        labor_charge NUMERIC(15,2) DEFAULT 0,
        total_parts_cost NUMERIC(15,2) DEFAULT 0,
        gst_amount NUMERIC(15,2) DEFAULT 0,
        grand_total NUMERIC(15,2) DEFAULT 0,
        barcode_ref VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        closed_at TIMESTAMP
      )
    `;
    await sql`ALTER TABLE service_jobs DROP CONSTRAINT IF EXISTS job_number_company_uniq`;
    await sql`ALTER TABLE service_jobs ADD CONSTRAINT job_number_company_uniq UNIQUE (company_id, job_number)`;
    await sql`ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15,2) DEFAULT 0`;
    await sql`ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS pending_amount NUMERIC(15,2) DEFAULT 0`;
    await sql`ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'unpaid'`;

    await sql`
      CREATE TABLE IF NOT EXISTS service_parts (
        id SERIAL PRIMARY KEY,
        job_id INT REFERENCES service_jobs(id) ON DELETE CASCADE,
        product_id INT REFERENCES products(id) ON DELETE SET NULL,
        part_name VARCHAR(255),
        quantity INT NOT NULL,
        unit_price NUMERIC(15,2),
        discount NUMERIC(15,2) DEFAULT 0,
        hsn VARCHAR(20),
        gst_rate NUMERIC(5,2),
        cgst NUMERIC(15,2),
        sgst NUMERIC(15,2),
        igst NUMERIC(15,2),
        total NUMERIC(15,2),
        from_inventory BOOLEAN DEFAULT false
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS service_payments (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        job_id INT REFERENCES service_jobs(id) ON DELETE CASCADE,
        payment_date TIMESTAMP DEFAULT NOW(),
        payment_mode VARCHAR(50) DEFAULT 'cash',
        bank_sub_type VARCHAR(50),
        transaction_ref VARCHAR(100),
        cheque_dd_no VARCHAR(50),
        cheque_dd_date DATE,
        receiving_bank VARCHAR(100),
        bank_account_id INT,
        amount NUMERIC(15,2) NOT NULL,
        cashier_id INT,
        notes TEXT,
        receipt_number VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS smtp_settings (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        profile_name VARCHAR(255) NOT NULL,
        smtp_host VARCHAR(255) NOT NULL,
        smtp_port INT DEFAULT 587,
        smtp_secure VARCHAR(20) DEFAULT 'tls',
        smtp_user VARCHAR(255),
        smtp_password VARCHAR(255),
        from_email VARCHAR(255) NOT NULL,
        from_name VARCHAR(255),
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS email_logs (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        smtp_id INT REFERENCES smtp_settings(id) ON DELETE SET NULL,
        from_email VARCHAR(255),
        to_email TEXT NOT NULL,
        cc_email TEXT,
        bcc_email TEXT,
        subject VARCHAR(500),
        body_text TEXT,
        status VARCHAR(50) DEFAULT 'sent',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;



    // ═══════════════════════════════════════════════════════════
    // FINANCE
    // ═══════════════════════════════════════════════════════════

    await sql`
      CREATE TABLE IF NOT EXISTS capital_entries (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        financial_year_id INT REFERENCES financial_years(id) ON DELETE SET NULL,
        old_value NUMERIC(15,2),
        new_value NUMERIC(15,2) NOT NULL,
        effective_date DATE NOT NULL,
        reason TEXT,
        auditor_report_attachment TEXT,
        changed_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS assets_liabilities (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('asset', 'liability')),
        category VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        purchase_cost NUMERIC(15,2),
        depreciation_rate NUMERIC(5,2) DEFAULT 0.00,
        depreciation_method VARCHAR(30) DEFAULT 'straight_line',
        accumulated_depreciation NUMERIC(15,2) DEFAULT 0.00,
        as_of_date DATE NOT NULL DEFAULT CURRENT_DATE,
        reference_number VARCHAR(100),
        description TEXT,
        attachment TEXT,
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    try {
      await sql`ALTER TABLE assets_liabilities ADD COLUMN IF NOT EXISTS purchase_cost NUMERIC(15,2)`;
      await sql`ALTER TABLE assets_liabilities ADD COLUMN IF NOT EXISTS depreciation_rate NUMERIC(5,2) DEFAULT 0.00`;
      await sql`ALTER TABLE assets_liabilities ADD COLUMN IF NOT EXISTS depreciation_method VARCHAR(30) DEFAULT 'straight_line'`;
      await sql`ALTER TABLE assets_liabilities ADD COLUMN IF NOT EXISTS accumulated_depreciation NUMERIC(15,2) DEFAULT 0.00`;
    } catch(e) {}

    await sql`
      CREATE TABLE IF NOT EXISTS loans (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        lender_name VARCHAR(255) NOT NULL,
        loan_type VARCHAR(50),
        loan_account_number VARCHAR(100),
        principal_amount NUMERIC(15,2),
        disbursed_amount NUMERIC(15,2),
        interest_rate NUMERIC(5,2),
        interest_type VARCHAR(30),
        tenure_months INT,
        start_date DATE,
        emi_amount NUMERIC(15,2),
        emi_frequency VARCHAR(20) DEFAULT 'monthly',
        first_due_date DATE,
        monthly_due_date INT,
        outstanding_principal NUMERIC(15,2),
        outstanding_interest NUMERIC(15,2),
        processing_charges NUMERIC(15,2),
        prepayment_details_json TEXT,
        attachments_json TEXT,
        notes TEXT,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS loan_installments (
        id SERIAL PRIMARY KEY,
        loan_id INT REFERENCES loans(id) ON DELETE CASCADE,
        installment_number INT NOT NULL,
        due_date DATE NOT NULL,
        principal_component NUMERIC(15,2),
        interest_component NUMERIC(15,2),
        total_emi NUMERIC(15,2),
        paid_amount NUMERIC(15,2) DEFAULT 0,
        pending_amount NUMERIC(15,2),
        payment_status VARCHAR(20) DEFAULT 'pending',
        payment_date DATE,
        payment_ref VARCHAR(100)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        expense_date DATE NOT NULL,
        category VARCHAR(100) NOT NULL,
        dealer_receiver VARCHAR(255),
        dealer_receiver_number VARCHAR(20),
        dealer_receiver_email VARCHAR(100),
        dealer_receiver_company VARCHAR(255),
        amount NUMERIC(15,2) NOT NULL,
        gst_details_json TEXT,
        payment_mode VARCHAR(30) NOT NULL,
        transaction_ref VARCHAR(100),
        bank_account VARCHAR(100),
        attachment TEXT,
        description TEXT,
        approval_status VARCHAR(20) DEFAULT 'draft',
        approved_by INT REFERENCES users(id) ON DELETE SET NULL,
        receipt_number VARCHAR(50),
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS dealer_receiver VARCHAR(255);`;
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS dealer_receiver_number VARCHAR(20);`;
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS dealer_receiver_email VARCHAR(100);`;
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS dealer_receiver_company VARCHAR(255);`;

    // ═══════════════════════════════════════════════════════════
    // HR / PAYROLL
    // ═══════════════════════════════════════════════════════════

    await sql`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        login_time TIME,
        logout_time TIME,
        status VARCHAR(20),
        remarks TEXT,
        correction_reason TEXT,
        corrected_by INT REFERENCES users(id) ON DELETE SET NULL,
        marked_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS remarks TEXT;`;
    await sql`ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_emp_date_uniq`;
    await sql`ALTER TABLE attendance ADD CONSTRAINT attendance_emp_date_uniq UNIQUE (company_id, employee_id, date)`;

    await sql`
      CREATE TABLE IF NOT EXISTS leave_types (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        monthly_quota INT DEFAULT 2,
        yearly_quota INT DEFAULT 24,
        is_paid BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT true
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
        leave_type_id INT REFERENCES leave_types(id) ON DELETE SET NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        days NUMERIC(3,1) NOT NULL,
        reason TEXT,
        attachment TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        approved_by INT REFERENCES users(id) ON DELETE SET NULL,
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;



    await sql`
      CREATE TABLE IF NOT EXISTS employee_advances (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
        advance_date DATE NOT NULL,
        amount NUMERIC(15,2) NOT NULL,
        payment_mode VARCHAR(30),
        transaction_ref VARCHAR(100),
        monthly_deduction NUMERIC(15,2),
        total_repaid NUMERIC(15,2) DEFAULT 0,
        outstanding NUMERIC(15,2),
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
        receipt_date DATE NOT NULL,
        amount NUMERIC(15,2),
        type VARCHAR(20)
      )
    `;

    // ═══════════════════════════════════════════════════════════
    // WORK MANAGEMENT
    // ═══════════════════════════════════════════════════════════

    await sql`
      CREATE TABLE IF NOT EXISTS work_schedules (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
        designation VARCHAR(100),
        assigned_date DATE NOT NULL,
        due_date DATE NOT NULL,
        description_points_json TEXT,
        message TEXT,
        status VARCHAR(30) DEFAULT 'assigned',
        delay_reason TEXT,
        not_completed_reason TEXT,
        assigned_by INT REFERENCES users(id) ON DELETE SET NULL,
        carried_from_id INT REFERENCES work_schedules(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // ═══════════════════════════════════════════════════════════
    // MARKETING
    // ═══════════════════════════════════════════════════════════

    await sql`
      CREATE TABLE IF NOT EXISTS email_campaigns (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        subject VARCHAR(500),
        body_html TEXT,
        template_id INT,
        recipient_type VARCHAR(30),
        recipient_filter_json TEXT,
        total_recipients INT DEFAULT 0,
        sent_count INT DEFAULT 0,
        failed_count INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'draft',
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS sms_company_settings (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        provider VARCHAR(50),
        api_key_encrypted TEXT,
        dlt_id VARCHAR(100),
        sms_api_key_encrypted TEXT,
        sms_api_secret_encrypted TEXT,
        sender_id VARCHAR(20),
        is_enabled BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (company_id)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS sms_template_mappings (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        template_id VARCHAR(100),
        template_text TEXT,
        placeholders_json TEXT,
        is_approved BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE sms_template_mappings DROP CONSTRAINT IF EXISTS sms_tmpl_event_uniq`;
    await sql`ALTER TABLE sms_template_mappings ADD CONSTRAINT sms_tmpl_event_uniq UNIQUE (company_id, event_type)`;

    await sql`
      CREATE TABLE IF NOT EXISTS sms_campaigns (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        template_mapping_id INT REFERENCES sms_template_mappings(id) ON DELETE SET NULL,
        recipient_type VARCHAR(30),
        recipient_filter_json TEXT,
        total_recipients INT DEFAULT 0,
        sent_count INT DEFAULT 0,
        failed_count INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'draft',
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS sms_delivery_logs (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        campaign_id INT,
        recipient_phone VARCHAR(20),
        event_type VARCHAR(50),
        template_id VARCHAR(100),
        provider_message_id VARCHAR(100),
        delivery_status VARCHAR(20),
        error_info TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // ═══════════════════════════════════════════════════════════
    // SYSTEM: NOTIFICATIONS, AUDIT, SEQUENCES
    // ═══════════════════════════════════════════════════════════

    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255),
        message TEXT,
        type VARCHAR(50),
        reference_type VARCHAR(50),
        reference_id INT,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        company_id INT,
        user_id INT,
        timestamp TIMESTAMP DEFAULT NOW(),
        action VARCHAR(50) NOT NULL,
        module VARCHAR(50),
        entity VARCHAR(50),
        record_id INT,
        old_value_json TEXT,
        new_value_json TEXT,
        reason TEXT,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS daily_store_reports (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        report_date DATE NOT NULL,
        total_sales NUMERIC(15,2) DEFAULT 0,
        total_expenses NUMERIC(15,2) DEFAULT 0,
        total_collections NUMERIC(15,2) DEFAULT 0,
        snapshots_json TEXT,
        submitted_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS document_sequences (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        document_type VARCHAR(30) NOT NULL,
        prefix VARCHAR(20),
        current_number INT DEFAULT 0
      )
    `;
    await sql`ALTER TABLE document_sequences DROP CONSTRAINT IF EXISTS doc_seq_type_uniq`;
    await sql`ALTER TABLE document_sequences ADD CONSTRAINT doc_seq_type_uniq UNIQUE (company_id, document_type)`;

    await sql`
      CREATE TABLE IF NOT EXISTS payment_terms_config (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        payment_mode VARCHAR(20) NOT NULL,
        terms_text TEXT
      )
    `;
    await sql`ALTER TABLE payment_terms_config DROP CONSTRAINT IF EXISTS ptc_mode_uniq`;
    await sql`ALTER TABLE payment_terms_config ADD CONSTRAINT ptc_mode_uniq UNIQUE (company_id, payment_mode)`;

    // ═══════════════════════════════════════════════════════════
    // SEED: DEFAULT MENU CATEGORIES & MENUS
    // ═══════════════════════════════════════════════════════════

    // Seed menu categories
    const categories = [
      { key: 'superadmin', label: 'Superadmin Panel', icon: '🛡️', sort: 0 },
      { key: 'accountant', label: 'Accountant Management', icon: '📊', sort: 1 },
      { key: 'inventory', label: 'Inventory Management', icon: '📦', sort: 2 },
      { key: 'hr', label: 'HR Management', icon: '👥', sort: 3 },
      { key: 'sales', label: 'Sales Management', icon: '🛒', sort: 4 },
      { key: 'service', label: 'Service Management', icon: '🔧', sort: 5 },
      { key: 'marketing', label: 'Marketing Management', icon: '📢', sort: 6 },
      { key: 'general', label: 'General', icon: '📋', sort: 7 },
    ];
    for (const c of categories) {
      await sql`
        INSERT INTO menu_categories (category_key, category_label, icon, sort_order)
        VALUES (${c.key}, ${c.label}, ${c.icon}, ${c.sort})
        ON CONFLICT (category_key) DO UPDATE SET category_label = ${c.label}, icon = ${c.icon}, sort_order = ${c.sort}
      `;
    }

    // Seed menus
    const menuItems = [
      // Superadmin
      { cat: 'superadmin', key: 'sa_dashboard', label: 'Dashboard', icon: '📈', sort: 0 },
      { cat: 'superadmin', key: 'sa_superpanel', label: 'Super Panel', icon: '🛡️', sort: 1 },
      { cat: 'superadmin', key: 'sa_work_mgmt', label: 'Work Management', icon: '👁️', sort: 2 },
      { cat: 'superadmin', key: 'sa_work_schedule', label: 'Work Schedule', icon: '📅', sort: 3 },
      { cat: 'superadmin', key: 'sa_inventory_stock', label: 'Inventory Stock', icon: '📦', sort: 4 },
      // Accountant
      { cat: 'accountant', key: 'acc_today_tasks', label: 'Today Tasks', icon: '📋', sort: 0 },
      { cat: 'accountant', key: 'acc_capital', label: 'Set Capital', icon: '💰', sort: 1 },
      { cat: 'accountant', key: 'acc_loans', label: 'Loans / Contra', icon: '🏦', sort: 2 },
      { cat: 'accountant', key: 'acc_expenses', label: 'Expenses', icon: '💸', sort: 3 },
      { cat: 'accountant', key: 'acc_assets_liabilities', label: 'Assets & Liabilities', icon: '🏛️', sort: 4 },
      { cat: 'accountant', key: 'acc_settings', label: 'Settings', icon: '⚙️', sort: 5 },
      { cat: 'accountant', key: 'rpt_auditor_gst', label: 'Reports', icon: '📊', sort: 6 },
      // Inventory
      { cat: 'inventory', key: 'inv_today_tasks', label: 'Today Tasks', icon: '📋', sort: 0 },
      { cat: 'inventory', key: 'inv_suppliers', label: 'Suppliers', icon: '🚚', sort: 1 },
      { cat: 'inventory', key: 'inv_inventory', label: 'Inventory', icon: '📦', sort: 2 },
      { cat: 'inventory', key: 'inv_branch_transfer', label: 'Transport bw Branches', icon: '🚚', sort: 3 },
      { cat: 'inventory', key: 'inv_purchase_order', label: 'Purchase Order / Reorder', icon: '📝', sort: 4 },
      { cat: 'inventory', key: 'inv_stock_receipt', label: 'Purchase / Stock Receipt', icon: '📥', sort: 5 },
      { cat: 'inventory', key: 'inv_reports', label: 'Reports', icon: '📊', sort: 6 },
      // HR
      { cat: 'hr', key: 'hr_today_tasks', label: 'Today Tasks', icon: '📋', sort: 0 },
      { cat: 'hr', key: 'hr_employees', label: 'Employees', icon: '👤', sort: 1 },
      { cat: 'hr', key: 'hr_dealers', label: 'Dealers', icon: '🏪', sort: 2 },
      { cat: 'hr', key: 'hr_financers', label: 'Financers', icon: '🏛️', sort: 3 },
      { cat: 'hr', key: 'hr_customers', label: 'Customers', icon: '🧑', sort: 4 },
      { cat: 'hr', key: 'hr_attendance', label: 'Attendance', icon: '📅', sort: 5 },
      { cat: 'hr', key: 'hr_leave_mgmt', label: 'Leave Management', icon: '🏖️', sort: 6 },
      { cat: 'hr', key: 'hr_process_salary', label: 'Process Salaries', icon: '💵', sort: 7 },
      { cat: 'hr', key: 'hr_advances', label: 'Salary Advances', icon: '💳', sort: 8 },
      { cat: 'hr', key: 'hr_payslips', label: 'Payslips', icon: '🧾', sort: 9 },
      { cat: 'hr', key: 'hr_incentives', label: 'Release Incentives', icon: '🎁', sort: 10 },
      { cat: 'hr', key: 'hr_reports', label: 'Reports', icon: '📊', sort: 11 },

      // Sales
      { cat: 'sales', key: 'sales_today_tasks', label: 'Today Tasks', icon: '📋', sort: 0 },
      { cat: 'sales', key: 'sales_dc_payments', label: 'Quotation, DC & Counter Bills', icon: '🚛', sort: 1 },
      { cat: 'sales', key: 'sales_invoices', label: 'Invoices', icon: '🧾', sort: 2 },
      { cat: 'sales', key: 'sales_receipts', label: 'Payment Receipts', icon: '🧾', sort: 3 },
      { cat: 'sales', key: 'sales_returns', label: 'Returns', icon: '↩️', sort: 4 },
      // Service
      { cat: 'service', key: 'svc_today_tasks', label: 'Today Tasks', icon: '📋', sort: 0 },
      { cat: 'service', key: 'svc_get_details', label: 'Get Details', icon: '🔍', sort: 1 },
      { cat: 'service', key: 'svc_warranty', label: 'Warranty Services', icon: '🛡️', sort: 2 },
      { cat: 'service', key: 'svc_paid', label: 'Paid Services', icon: '💰', sort: 3 },
      { cat: 'service', key: 'svc_mechanics', label: 'Mechanics & Staff', icon: '🔧', sort: 4 },
      { cat: 'service', key: 'svc_payments', label: 'Payments & Spare Parts', icon: '💸', sort: 5 },
      { cat: 'service', key: 'svc_receipts', label: 'Receipts', icon: '🧾', sort: 6 },
      { cat: 'service', key: 'svc_replacement', label: 'Warranty Replacement', icon: '🔄', sort: 7 },
      // Marketing
      { cat: 'marketing', key: 'mkt_today_tasks', label: 'Today Tasks', icon: '📋', sort: 0 },
      { cat: 'marketing', key: 'mkt_email', label: 'Email Marketing', icon: '✉️', sort: 1 },
      { cat: 'marketing', key: 'mkt_sms', label: 'SMS Marketing', icon: '📱', sort: 2 },
      // General
      { cat: 'general', key: 'gen_apply_leave', label: 'Apply Leave', icon: '🏖️', sort: 0 },
      { cat: 'general', key: 'gen_today_tasks', label: 'Today Tasks', icon: '📋', sort: 1 },
    ];

    for (const m of menuItems) {
      const catRows = await sql`SELECT id FROM menu_categories WHERE category_key = ${m.cat}`;
      const catId = catRows.length > 0 ? catRows[0].id : null;
      await sql`
        INSERT INTO menus (category_id, menu_key, menu_label, icon, sort_order)
        VALUES (${catId}, ${m.key}, ${m.label}, ${m.icon}, ${m.sort})
        ON CONFLICT (menu_key) DO UPDATE SET menu_label = ${m.label}, icon = ${m.icon}, sort_order = ${m.sort}, category_id = ${catId}
      `;
    }

    // ═══════════════════════════════════════════════════════════
    // SEED: DEFAULT SUPERADMIN USER
    // ═══════════════════════════════════════════════════════════

    const existingSA = await sql`SELECT id FROM users WHERE username = 'superadmin'`;
    if (existingSA.length === 0) {
      const hash = await bcrypt.hash("admin@123", 10);
      await sql`
        INSERT INTO users (company_id, username, password_hash, email, phone, role)
        VALUES (NULL, 'superadmin', ${hash}, 'admin@erp.com', '9999999999', 'superadmin')
      `;
    }

    return res.status(200).json({
      success: true,
      message: "All database tables created/migrated successfully. Default superadmin seeded.",
      tables_created: 57,
      default_login: { username: "superadmin", password: "admin@123" },
    });
  } catch (error) {
    console.error("Setup error:", error);
    return res.status(500).json({ error: "Database setup failed", details: error.message });
  }
};
