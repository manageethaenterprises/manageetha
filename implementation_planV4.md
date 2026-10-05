# Multi-Tenant Business ERP System — Implementation Plan (v4 - Final)

## Overview

A full-featured, multi-tenant Business ERP system for managing **Sales, Services, HR, Inventory, Accounting, and Marketing** across multiple companies/locations. Built using the same tech stack as the inducare reference project.

### Key Design Decisions

> [!IMPORTANT]
> **Flat Companies with Parent Grouping.** Each store/location is its own company. Companies sharing the same GSTIN are linked via `parent_company_id`. Parent holds shared GSTIN/PAN/bank details. Each child operates independently but reports can be consolidated under the parent group.

> [!IMPORTANT]
> **One Employee = One Company.** Users and employees are locked to a single `company_id` with a single `role`. No multi-company mapping. Simple `users.company_id` + `users.role` design.

> [!IMPORTANT]
> **Only Superadmin accesses multiple companies.** Superadmin has no `company_id` — they see all companies, can switch between them, and view consolidated dashboards. All other roles (Storeadmin, Accountant, HR, etc.) are locked to their assigned company.

---

### Tech Stack

| Layer          | Technology                                          |
| -------------- | --------------------------------------------------- |
| **Backend**    | Node.js + Express.js (Vercel serverless-compatible) |
| **Database**   | Neon PostgreSQL (`@neondatabase/serverless`)        |
| **Auth**       | JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`)          |
| **Frontend**   | Vanilla HTML + CSS + JavaScript (SPA-style tabs)    |
| **PDF**        | `pdfkit`                                            |
| **Excel/CSV**  | `xlsx`                                              |
| **Barcode**    | `bwip-js`                                           |
| **Email**      | `nodemailer`                                        |
| **Deployment** | Vercel                                              |

---

### Company Hierarchy & Access Model

```
┌────────────────────────────────────────────────────────────────┐
│  SUPERADMIN  (no company_id — global access)                   │
│  • Creates/manages all companies                               │
│  • Consolidated dashboard across all / grouped companies       │
│  • Controls roles, menus, settings, toggles                    │
└──────┬─────────────────────────────────┬───────────────────────┘
       │                                 │
 ┌─────▼─────────────────┐    ┌─────────▼─────────────────────┐
 │ Geetha Enterprises    │    │ Manaswini Enterprises         │
 │ (Parent Company)      │    │ (Standalone — no children)    │
 │ GSTIN: 37AHMPH1933C1Z7│    │ GSTIN: 37AZEPN5306R1ZS       │
 │ parent_company_id: NULL│    │ parent_company_id: NULL       │
 └──┬──────────────┬─────┘    │                               │
    │              │           │ Users: Ravi (Storeadmin),     │
 ┌──▼────────┐ ┌───▼───────┐  │         Sita (Accountant)     │
 │ Location A│ │ Location B│  └───────────────────────────────┘
 │ Ramchpurm │ │ Rajahmdry │
 │ parent: ↑ │ │ parent: ↑ │
 │           │ │           │
 │ Users:    │ │ Users:    │
 │ Prathap   │ │ Kumar     │
 │ (StoreAdm)│ │ (SalesAdm)│
 └───────────┘ └───────────┘
```

**Rules:**

- Each user logs in → sees only their company's data
- Superadmin logs in → sees company picker → can switch between any company or view all
- Reports for parent company can consolidate all children's data
- Child companies share parent's GSTIN but have own address, inventory, employees, sales

---

### API Files — 12 Serverless Functions

| #   | File                | Actions                                                                                                                                                                                                                         |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `api/setup.js`      | Database schema creation & migrations                                                                                                                                                                                           |
| 2   | `api/auth.js`       | `login`, `me`, `change-password`                                                                                                                                                                                                |
| 3   | `api/super.js`      | `dashboard-stats`, `companies`, `roles`, `menu-mapping`, `users`, `settings`, `work-schedules`, `work-history`, `capital-toggle`, `inventory-toggle`, `online-status`                                                           |
| 4   | `api/employees.js`  | `list`, `get`, `create`, `update`, `delete`, `dealers`, `financers`, `customers`, `customer-perks`                                                                                                                              |
| 5   | `api/attendance.js` | `record`, `list`, `correct`, `mark-manual`, `leave-types`, `apply-leave`, `leave-list`, `approve-leave`, `reject-leave`, `leave-balance`                                                                                        |
| 6   | `api/payroll.js`    | `process`, `list`, `update-status`, `advance-create`, `advance-list`, `advance-receipt`, `payslip-generate`, `payslip-list`, `payslip-email`, `incentive-list`, `incentive-pay`                                                 |
| 7   | `api/inventory.js`  | `suppliers`, `products`, `product-upload`, `stock-receipt`, `po-create`, `po-list`, `po-update`, `po-receive`, `reorder-check`, `inv-reports`                                                                                   |
| 8   | `api/sales.js`      | `create-sale`, `dc-create`, `dc-list`, `dc-print`, `invoice-create`, `invoice-list`, `invoice-print`, `payment-create`, `payment-list`, `receipt-print`, `receipt-consolidated`, `return-scan`, `return-create`, `terms-config` |
| 9   | `api/services.js`   | `get-details`, `warranty-create`, `paid-create`, `job-list`, `job-update`, `mechanic-crud`, `service-payment`, `service-receipt`, `warranty-replacement`                                                                        |
| 10  | `api/accountant.js` | `capital-get`, `capital-set`, `capital-history`, `loan-crud`, `loan-schedule`, `loan-payment`, `expense-crud`, `expense-approve`, `expense-receipt`, `settings-update`                                                          |
| 11  | `api/marketing.js`  | `email-send`, `email-list`, `email-templates`, `sms-config`, `sms-templates`, `sms-send`, `sms-logs`, `sms-test`                                                                                                                |
| 12  | `api/reports.js`    | `sales-report`, `purchase-report`, `inventory-report`, `finance-report`, `gst-report`, `hr-report`, `service-report`, `management-report`, `export-pdf`, `export-excel`, `generate-barcode`                                     |

---

### Project Structure

```
Business ERP/
├── admin/
│   ├── index.html              # Login page
│   ├── login.js / login.css
│   ├── dashboard.html          # Main SPA (all role tabs)
│   ├── dashboard.js            # Core: auth, routing, company picker (superadmin only)
│   ├── dashboard.css           # All styling
│   └── modules/
│       ├── super-panel.js      # Superadmin: dashboard, companies, roles, menus, users, work mgmt
│       ├── accountant.js       # Capital, loans, expenses, reports
│       ├── inventory.js        # Suppliers, products, PO, stock, reorder
│       ├── hr.js               # Employees, attendance, leave, payroll, payslips, advances
│       ├── sales.js            # DC, invoices, payments, receipts, returns
│       ├── services.js         # Warranty, paid service, mechanics, spare parts
│       ├── marketing.js        # Email, SMS campaigns
│       └── reports.js          # All report views
├── api/                        # 12 serverless functions
│   ├── setup.js    ├── auth.js       ├── super.js
│   ├── employees.js├── attendance.js  ├── payroll.js
│   ├── inventory.js├── sales.js       ├── services.js
│   ├── accountant.js├── marketing.js  └── reports.js
├── shared/
│   └── db.js
├── dev-server.js
├── vercel.json
├── package.json
└── .env.example
```

---

## Open Questions

1. **Neon Database URL:** Same database as inducare, or separate?
2. **SMS Provider:** Which provider (MSG91, Textlocal, Kaleyra)?
3. **GST Integration:** API integration or report-only for auditors?
4. **Deployment:** Same Vercel account?

---

## Database Schema (~57 tables)

### Core

```sql
companies (
  id SERIAL PRIMARY KEY,
  parent_company_id INT REFERENCES companies(id) ON DELETE SET NULL,  -- groups same-GSTIN locations
  name VARCHAR(255) NOT NULL,
  trade_name VARCHAR(255),
  gstin VARCHAR(20),               -- can be shared with parent
  pan VARCHAR(15),
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
  settings_json TEXT,              -- return_window, attendance_cutoffs, leave_policy, etc.
  capital_editable BOOLEAN DEFAULT true,
  inventory_add_control TEXT,      -- JSON: which roles can add inventory
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
)

financial_years (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  label VARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
)
```

### Auth & RBAC

```sql
roles (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  role_name VARCHAR(50) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (role_name, company_id)
)

menu_categories (
  id SERIAL PRIMARY KEY,
  category_key VARCHAR(50) UNIQUE NOT NULL,
  category_label VARCHAR(100) NOT NULL,
  icon VARCHAR(10),
  sort_order INT DEFAULT 0
)

menus (
  id SERIAL PRIMARY KEY,
  category_id INT REFERENCES menu_categories(id),
  menu_key VARCHAR(50) UNIQUE NOT NULL,
  menu_label VARCHAR(100) NOT NULL,
  icon VARCHAR(10),
  sort_order INT DEFAULT 0
)

role_menu_mappings (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  role_name VARCHAR(50) NOT NULL,
  menu_key VARCHAR(50) NOT NULL,
  menu_label VARCHAR(100) NOT NULL,
  menu_icon VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (company_id, role_name, menu_key)
)

-- Simple: one user = one company = one role
users (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE SET NULL,  -- NULL for superadmin
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(20),
  role VARCHAR(50) NOT NULL,         -- their role in their company
  employee_id INT,                   -- link to employee record (nullable)
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
)
-- Superadmin: company_id = NULL, role = 'superadmin'
-- Everyone else: company_id = their company, role = their role in that company
```

### People

```sql
employees (
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
  reporting_manager_id INT REFERENCES employees(id),
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
  user_id INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

customers (
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

dealers (
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

financers (
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
```

### Products & Inventory

```sql
product_categories (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  parent_id INT REFERENCES product_categories(id)
)

hsn_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL,
  description TEXT,
  gst_rate NUMERIC(5,2)
)

products (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  supervisor_name VARCHAR(255),
  sku VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(100),
  model VARCHAR(100),
  category_id INT REFERENCES product_categories(id),
  hsn_sac VARCHAR(20),
  unit_of_measure VARCHAR(20) DEFAULT 'NOS',
  gst_rate NUMERIC(5,2) DEFAULT 0,
  purchase_rate NUMERIC(15,2) DEFAULT 0,
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
  supplier_id INT REFERENCES dealers(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
)

inventory_transactions (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id),
  transaction_type VARCHAR(20),
  quantity INT NOT NULL,
  reference_type VARCHAR(50),
  reference_id INT,
  serial_numbers_json TEXT,
  batch_info_json TEXT,
  performed_by INT REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
)
```

### Purchasing

```sql
purchase_orders (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  po_number VARCHAR(50) NOT NULL,
  supplier_id INT REFERENCES dealers(id),
  status VARCHAR(30) DEFAULT 'draft',
  order_date DATE,
  expected_date DATE,
  total_amount NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  description TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (company_id, po_number)
)

purchase_order_items (
  id SERIAL PRIMARY KEY,
  po_id INT REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id),
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

purchases (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  purchase_invoice_no VARCHAR(50),
  purchase_date DATE,
  supplier_id INT REFERENCES dealers(id),
  po_id INT REFERENCES purchase_orders(id),
  total_amount NUMERIC(15,2),
  gst_amount NUMERIC(15,2),
  grand_total NUMERIC(15,2),
  payment_status VARCHAR(20) DEFAULT 'unpaid',
  attachments_json TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
)

purchase_items (
  id SERIAL PRIMARY KEY,
  purchase_id INT REFERENCES purchases(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id),
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
```

### Sales, Invoices & Payments

```sql
sales (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  customer_id INT REFERENCES customers(id),
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
  financer_id INT REFERENCES financers(id),
  finance_amount NUMERIC(15,2),
  finance_ref VARCHAR(100),
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
)

sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INT REFERENCES sales(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id),
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

delivery_challans (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  dc_number VARCHAR(50) NOT NULL,
  dc_date DATE NOT NULL,
  sale_id INT REFERENCES sales(id),
  invoice_id INT,
  customer_id INT REFERENCES customers(id),
  transporter_name VARCHAR(255),
  vehicle_number VARCHAR(50),
  supply_type VARCHAR(50),
  payment_type VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active',
  cancelled_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (company_id, dc_number)
)

invoices (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) NOT NULL,
  invoice_date DATE NOT NULL,
  sale_id INT REFERENCES sales(id),
  dc_id INT REFERENCES delivery_challans(id),
  customer_id INT REFERENCES customers(id),
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
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (company_id, invoice_number)
)

payments (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  customer_id INT REFERENCES customers(id),
  sale_id INT REFERENCES sales(id),
  invoice_id INT REFERENCES invoices(id),
  service_job_id INT,
  amount NUMERIC(15,2) NOT NULL,
  payment_mode VARCHAR(20) NOT NULL,
  payment_type VARCHAR(30),
  is_advance BOOLEAN DEFAULT false,
  notification_sent BOOLEAN DEFAULT false,
  notification_ref VARCHAR(100),
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
)

bank_payment_details (
  id SERIAL PRIMARY KEY,
  payment_id INT REFERENCES payments(id) ON DELETE CASCADE,
  bank_name VARCHAR(100),
  account_number VARCHAR(50),
  transaction_ref VARCHAR(100),
  instrument_number VARCHAR(50),
  instrument_date DATE
)

upi_payment_details (
  id SERIAL PRIMARY KEY,
  payment_id INT REFERENCES payments(id) ON DELETE CASCADE,
  utr_number VARCHAR(100) NOT NULL,
  upi_ref VARCHAR(100)
)

credit_payment_details (
  id SERIAL PRIMARY KEY,
  payment_id INT REFERENCES payments(id) ON DELETE CASCADE,
  amount_paid_by_customer NUMERIC(15,2),
  credit_amount_by_company NUMERIC(15,2),
  original_credit NUMERIC(15,2),
  total_paid_against_credit NUMERIC(15,2) DEFAULT 0,
  outstanding_credit NUMERIC(15,2)
)

payment_allocations (
  id SERIAL PRIMARY KEY,
  payment_id INT REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id INT REFERENCES invoices(id),
  allocated_amount NUMERIC(15,2)
)

receipts (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  receipt_number VARCHAR(50) NOT NULL,
  receipt_date DATE NOT NULL,
  payment_id INT REFERENCES payments(id),
  customer_id INT,
  dealer_id INT,
  employee_id INT,
  receipt_type VARCHAR(30),
  amount NUMERIC(15,2),
  barcode_ref VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (company_id, receipt_number)
)
```

### Returns

```sql
returns (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  sale_id INT REFERENCES sales(id),
  invoice_id INT REFERENCES invoices(id),
  customer_id INT REFERENCES customers(id),
  return_date DATE NOT NULL,
  reason TEXT,
  supervisor_name VARCHAR(255),
  rack_no VARCHAR(50),
  remarks TEXT,
  condition_status VARCHAR(30),
  eligibility_result VARCHAR(20),
  eligibility_reason TEXT,
  outcome VARCHAR(30),
  refund_amount NUMERIC(15,2),
  tax_reversal_json TEXT,
  approval_status VARCHAR(20) DEFAULT 'pending',
  approved_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
)

return_items (
  id SERIAL PRIMARY KEY,
  return_id INT REFERENCES returns(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id),
  sale_item_id INT REFERENCES sale_items(id),
  quantity INT NOT NULL,
  serial_number VARCHAR(100),
  condition VARCHAR(30),
  is_sellable BOOLEAN DEFAULT true,
  inventory_transaction_id INT REFERENCES inventory_transactions(id)
)
```

### Service

```sql
service_jobs (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  job_number VARCHAR(50) NOT NULL,
  customer_id INT REFERENCES customers(id),
  product_id INT REFERENCES products(id),
  sale_id INT REFERENCES sales(id),
  invoice_id INT REFERENCES invoices(id),
  serial_number VARCHAR(100),
  service_type VARCHAR(20),
  warranty_eligible BOOLEAN DEFAULT false,
  complaint TEXT,
  diagnosis TEXT,
  mechanic_id INT REFERENCES mechanics(id),
  status VARCHAR(30) DEFAULT 'open',
  technician_remarks TEXT,
  labor_charge NUMERIC(15,2) DEFAULT 0,
  total_parts_cost NUMERIC(15,2) DEFAULT 0,
  gst_amount NUMERIC(15,2) DEFAULT 0,
  grand_total NUMERIC(15,2) DEFAULT 0,
  barcode_ref VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  UNIQUE (company_id, job_number)
)

service_parts (
  id SERIAL PRIMARY KEY,
  job_id INT REFERENCES service_jobs(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id),
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

mechanics (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(100),
  specialization VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
)
```

### Finance

```sql
capital_entries (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  financial_year_id INT REFERENCES financial_years(id),
  old_value NUMERIC(15,2),
  new_value NUMERIC(15,2) NOT NULL,
  effective_date DATE NOT NULL,
  reason TEXT,
  auditor_report_attachment TEXT,
  changed_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
)

loans (
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

loan_installments (
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

expenses (
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
  approved_by INT REFERENCES users(id),
  receipt_number VARCHAR(50),
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (company_id, receipt_number)
)
```

### HR / Payroll

```sql
attendance (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INT REFERENCES employees(id),
  date DATE NOT NULL,
  login_time TIME,
  logout_time TIME,
  status VARCHAR(20),
  correction_reason TEXT,
  corrected_by INT REFERENCES users(id),
  marked_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (company_id, employee_id, date)
)

leave_types (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  monthly_quota INT DEFAULT 2,
  yearly_quota INT DEFAULT 24,
  is_paid BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true
)

leave_requests (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INT REFERENCES employees(id),
  leave_type_id INT REFERENCES leave_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days NUMERIC(3,1) NOT NULL,
  reason TEXT,
  attachment TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  approved_by INT REFERENCES users(id),
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
)

payroll_runs (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  month INT NOT NULL,
  year INT NOT NULL,
  financial_year_id INT REFERENCES financial_years(id),
  status VARCHAR(20) DEFAULT 'draft',
  processed_by INT REFERENCES users(id),
  released_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (company_id, month, year)
)

payroll_items (
  id SERIAL PRIMARY KEY,
  payroll_run_id INT REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id INT REFERENCES employees(id),
  basic_salary NUMERIC(15,2),
  allowances_json TEXT,
  incentives NUMERIC(15,2) DEFAULT 0,
  bonuses NUMERIC(15,2) DEFAULT 0,
  paid_leave_days INT DEFAULT 0,
  leave_deduction NUMERIC(15,2) DEFAULT 0,
  late_deduction NUMERIC(15,2) DEFAULT 0,
  advance_emi_deduction NUMERIC(15,2) DEFAULT 0,
  other_deductions_json TEXT,
  statutory_deductions_json TEXT,
  gross_salary NUMERIC(15,2),
  total_deductions NUMERIC(15,2),
  net_salary NUMERIC(15,2),
  payment_status VARCHAR(20) DEFAULT 'draft',
  payment_ref VARCHAR(100),
  remarks TEXT,
  snapshot_json TEXT,
  created_at TIMESTAMP DEFAULT NOW()
)

employee_advances (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INT REFERENCES employees(id),
  advance_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  payment_mode VARCHAR(30),
  transaction_ref VARCHAR(100),
  monthly_deduction NUMERIC(15,2),
  total_repaid NUMERIC(15,2) DEFAULT 0,
  outstanding NUMERIC(15,2),
  repayment_status VARCHAR(20) DEFAULT 'active',
  approved_by INT REFERENCES users(id),
  receipt_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
)

employee_advance_receipts (
  id SERIAL PRIMARY KEY,
  advance_id INT REFERENCES employee_advances(id) ON DELETE CASCADE,
  receipt_number VARCHAR(50) NOT NULL,
  receipt_date DATE NOT NULL,
  amount NUMERIC(15,2),
  type VARCHAR(20)
)
```

### Work Management

```sql
work_schedules (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INT REFERENCES employees(id),
  designation VARCHAR(100),
  assigned_date DATE NOT NULL,
  due_date DATE NOT NULL,
  description_points_json TEXT,
  message TEXT,
  status VARCHAR(30) DEFAULT 'assigned',
  delay_reason TEXT,
  not_completed_reason TEXT,
  assigned_by INT REFERENCES users(id),
  carried_from_id INT REFERENCES work_schedules(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

### Marketing

```sql
email_campaigns (
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
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
)

sms_company_settings (
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

sms_template_mappings (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  template_id VARCHAR(100),
  template_text TEXT,
  placeholders_json TEXT,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (company_id, event_type)
)

sms_campaigns (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  template_mapping_id INT REFERENCES sms_template_mappings(id),
  recipient_type VARCHAR(30),
  recipient_filter_json TEXT,
  total_recipients INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft',
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
)

sms_delivery_logs (
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
```

### System

```sql
notifications (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id),
  title VARCHAR(255),
  message TEXT,
  type VARCHAR(50),
  reference_type VARCHAR(50),
  reference_id INT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
)

audit_logs (
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

daily_store_reports (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  total_sales NUMERIC(15,2) DEFAULT 0,
  total_expenses NUMERIC(15,2) DEFAULT 0,
  total_collections NUMERIC(15,2) DEFAULT 0,
  snapshots_json TEXT,
  submitted_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
)

document_sequences (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  document_type VARCHAR(30) NOT NULL,
  prefix VARCHAR(20),
  current_number INT DEFAULT 0,
  UNIQUE (company_id, document_type)
)

payment_terms_config (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  payment_mode VARCHAR(20) NOT NULL,
  terms_text TEXT,
  UNIQUE (company_id, payment_mode)
)
```

---

## Phase Execution Summary

| Phase  | Focus              | Key Deliverables                                                                                                      |
| ------ | ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **1**  | Foundation         | Login, auth, DB schema (~57 tables), dashboard shell, dev-server, company picker for superadmin                       |
| **2**  | Superadmin         | Company CRUD (with parent grouping), roles, checkbox menu mapping, user accounts, capital/inventory toggles           |
| **3**  | HR Part 1          | Employees, dealers, financers, customers (with perks), attendance (configurable cutoffs), leave workflow              |
| **4**  | HR Part 2          | Salary processing (frozen snapshots), advances with EMI, payslips (PDF + email), incentives                           |
| **5**  | Inventory Part 1   | Suppliers, products (manual + Excel), stock receipts, inventory transactions                                          |
| **6**  | Inventory Part 2   | Purchase orders (with new/existing items), auto reorder, inventory reports                                            |
| **7**  | Sales              | DC (2-copy matching image), invoices (GST calc matching image), multi-mode payments, receipts, returns (barcode scan) |
| **8**  | Service            | Warranty/paid service, mechanic assignment, spare parts billing, service receipts, warranty replacement               |
| **9**  | Accountant         | Capital with audit trail, loans/EMI schedule, expenses with approval workflow, financial reports                      |
| **10** | Marketing & Polish | Email/SMS campaigns, DLT templates, all reports, consolidated dashboard, work schedules, final polish                 |

---

## Verification Plan

### Automated

- `GET /api/setup` — All tables created successfully
- curl testing for every action across all 12 APIs

### Manual

- Superadmin: create parent company + 2 child locations (same GSTIN) → verify data isolation
- Superadmin: consolidated report across children of same parent
- Login as each role → verify menus match mapping
- Full sale cycle → DC → Invoice → Payment → Receipt → Return
- Full HR cycle → Employee → Attendance → Leave → Payroll → Payslip
- Print formats match provided DC and Invoice images
- GST calculation accuracy



## later 
### Shrachi supplier bills like rental bills and per product based commission
### BTL supplier loading and unloading charges
