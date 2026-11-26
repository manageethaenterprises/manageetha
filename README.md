# 🏢 Business ERP — Enterprise Commercial & Dealership Management System

> **All-in-One Cloud ERP for Commercial Machinery Dealerships, Retail & Wholesale, Workshops, Multi-Branch Inventory, and GST Accounting.**  
> Engineered with the speed and modern simplicity of **Vyapar**, backed by the rigorous financial accuracy, ledgers, and audit trail of **Tally Prime**.

---

## 📌 Executive Architecture & Scope

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  PLATFORM CONTROL (Internal Onboarding & Multi-Tenant Organization Hosting)   │
│  * Note: Superadmin access is strictly reserved for the system owner         │
│    to onboard legal company entities, assign branch databases, and manage    │
│    platform infrastructure. Not part of daily branch store operations.       │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                      ┌────────────────┴────────────────┐
                      ▼                                 ▼
         ┌─────────────────────────┐       ┌─────────────────────────┐
         │ Geetha Enterprises      │       │ Manaswini Enterprises   │
         │ Branch / Store Entity   │       │ Branch / Store Entity   │
         └────────────┬────────────┘       └────────────┬────────────┘
                      │                                 │
     ═════════════════╪═════════════════════════════════╪═════════════════
                      ▼ DAILY STORE OPERATIONS HIERARCHY ▼
                      │
     ┌────────────────┴────────────────────────────────────────────────┐
     │ 👑 STORE ADMIN / GENERAL MANAGER (Branch Command & Operations)  │
     └────────────────┬────────────────────────────────────────────────┘
                      │
         ┌────────────┼────────────┬────────────┬────────────┐
         ▼            ▼            ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
    │💰 ACCOUNT│ │🛒 SALES  │ │📦 INVEN- │ │🔧 WORK-  │ │👥 HR &   │
    │   ANT    │ │ & CASHIER│ │   TORY   │ │   SHOP   │ │ PAYROLL  │
    └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

This Business ERP is an end-to-end cloud business management platform designed specifically for commercial machinery dealerships (tractors, power weeders, harvesters, brush cutters, sprayers), vehicle showrooms, spare parts distributors, and authorized equipment service centers.

---

## ⚖️ How Business ERP Compares to Vyapar & Tally Prime

| Feature / Capability | **Tally Prime** | **Vyapar** | **This Business ERP** |
| :--- | :---: | :---: | :---: |
| **Deployment Model** | Local Windows desktop install | Local / Hybrid Cloud app | **100% Zero-Install Cloud Web App (Any Device / Mobile / Tablet)** |
| **Multi-Branch Live Sync** | Requires Tally.NET / Static IP | Cloud sync add-on | **Real-Time Live Sync Across Branches & Outlets** |
| **Machine Chassis / Serial No. Tracking** | Complex Godown configuration | Basic text notes | **Native Chassis & Serial No. Tracking on DC & Invoices** |
| **Dual Delivery Challan (DC) Workflow** | Manual Voucher type | Basic delivery note | **Dual-Copy Print (Original + Customer) with Inspection & Scheme Data** |
| **Settlement Discounts (Flat ₹ & %)** | Manual Ledger adjustment | Simple discount | **Interactive Settlement Box with Instant Post-Discount GST Recalculation** |
| **Cash Notes Denomination Counter** | Not available natively | Not available | **Built-in Currency Note Calculator (2000, 500, 200, 100, 50, 20, 10)** |
| **Workshop Job Cards & Service Receipts** | Requires third-party TDL | Not supported | **Dedicated Service Module (Free Warranty Coupons, Spares, Labor Charges)** |
| **Department Subsidy Schemes** | Custom ledger workarounds | Not supported | **Government Agriculture Scheme Application & Subsidy Grand Total Override** |
| **HR, Attendance & Automated Payroll** | Separate Tally Payroll module | Not supported | **Integrated Attendance, Leave Quotas, Advance Deductions & Payslips** |
| **Cashier / Mechanic Daily Tasks** | Not supported | Not supported | **Role-Specific Daily Task Checklists & Operational Guardrails** |
| **Minimum Selling Price Protection** | Custom script needed | Not available | **Automatic Purchase Cost Floor Alert to Protect Profit Margins** |

---

## 👥 Role-Based Scope of Work & Responsibilities

The ERP enforces strict role-based access control (RBAC). Below is the comprehensive scope of responsibilities for every role from **Store Admin** down through all operational departments:

```
                                  ┌─────────────────────────────┐
                                  │   STORE ADMIN / PROPRIETOR  │
                                  └──────────────┬──────────────┘
                                                 │
            ┌────────────────────┬───────────────┴───────────────┬────────────────────┐
            │                    │                               │                    │
            ▼                    ▼                               ▼                    ▼
   ┌──────────────────┐ ┌──────────────────┐           ┌──────────────────┐ ┌──────────────────┐
   │    ACCOUNTANT    │ │ SALES & CASHIER  │           │INVENTORY MANAGER │ │ SERVICE MANAGER  │
   │  Ledgers & Audit │ │ Billing & Invoices│          │ Stocks & Spares  │ │ Workshop & Claims│
   └──────────────────┘ └──────────────────┘           └──────────────────┘ └──────────────────┘
            │                                                                         │
            ▼                                                                         ▼
   ┌──────────────────┐                                                        ┌──────────────────┐
   │   HR & PAYROLL   │                                                        │ WORKSHOP STAFF   │
   │Staff & Incentives│                                                        │Mechanics & Techs │
   └──────────────────┘                                                        └──────────────────┘
```

---

### 1. 👑 Store Admin (Branch Manager / Proprietor / General Manager)
The **Store Admin** has complete operational custody and supervisory control over the assigned branch/company.

* **Primary Responsibilities**:
  * Oversees day-to-day business operations across Sales, Workshop, Inventory, and Accounts.
  * Supervises daily cash drawer closing and bank deposit reconciliation.
  * Reviews and authorizes special customer discounts beyond cashier limits.
  * Grants Delivery Challan (DC) issuance override when pending balance exceeds the standard ₹10,000 threshold.
  * Configures annual employee leave quotas (Casual Leave, Sick Leave, Earned Leave) and approves leave requests.
  * Authorizes monthly payroll processing and releases staff sales incentives.
  * Approves inter-branch stock requisitions and high-value purchase orders.
* **Scope of Work**:
  * Access to all branch submodules and analytical management dashboards.
  * Exclusive rights to unlock locked machinery serial numbers or cancel faulty invoices.
  * Ensures compliance with local GST rules, E-way bill requirements, and warranty claim regulations.

---

### 2. 📊 Accountant / Financial Officer
The **Accountant** governs the financial integrity, ledgers, tax filings, and liquidity of the business.

* **Primary Responsibilities**:
  * **Daybook & Cash Drawer**: Daily verification of all cash, UPI, bank, and finance receipts against cashier counter logs.
  * **Set & Monitor Capital**: Records initial capital injections, partner additions, and working capital accounts.
  * **Operating Expenses Ledger**: Tracks overhead expenses (shop rent, electricity, freight, transport, printing, staff tea/refreshments, machinery repairs).
  * **Loans & Contra Entries**: Logs inter-account bank transfers, bank cash withdrawals, cash deposits, partner loans, and EMI payments.
  * **Assets & Liabilities Ledger**: Manages fixed asset registers (workshop machinery, tools, commercial delivery vehicles, office computers) and tracks long-term liabilities.
  * **Taxation & GSTR Compliance**: Generates GSTR-1 outward supply summaries, GSTR-3B tax liability summaries, and HSN-wise tax reports for monthly/quarterly filings.
  * **Auditor Reports**: Exports clean Excel/PDF ledgers for chartered accountants and tax auditors.
* **Scope of Work**:
  * Manages bank accounts, IFSC mappings, and bank reconciliation statements (BRS).
  * Validates supplier purchase payments against goods received notes (GRN).
  * Reconciles outstanding customer credit balances and enforces credit settlement limits.

---

### 3. 🛒 Sales Manager, Cashier & Counter Sales Executive
The **Sales Team** drives the counter commerce, machine bookings, delivery, and payment collections.

* **Primary Responsibilities**:
  * **Point of Sale (POS) Billing**: Rapid billing for retail machinery, implement equipment, and walk-in counter customers.
  * **Quotation & Estimate Generation**: Creates official stamped quotations for farmers, commercial contractors, and sub-dealers with 1-click conversion into sales orders.
  * **Multi-Mode Payment Settlement**: Accepts payments across multiple channels:
    * Cash (with mandatory denomination breakdown).
    * UPI / QR Code (with mandatory UTR tracking).
    * Bank NEFT / RTGS / Cheque / DD (with instrument number and bank account tagging).
    * Commercial Finance (Bajaj Finance, TVS Credit, Cholamandalam with loan account tracking).
    * Split Payment (combining Cash + UPI + Bank in a single transaction).
  * **Settlement Discounts**: Applies settlement discounts in flat Rupees (`₹`) or Percentage (`%`) with instant real-time GST recalculation.
  * **Delivery Challan (DC) Issuance**: Prepares official dual-copy Delivery Challans (Original + Customer copy) capturing vehicle number, driver details, and mandatory machine chassis/serial numbers.
  * **GST Tax Invoicing**: Raises finalized Tax Invoices with sequential GST invoice numbers, HSN summaries, and scan-ready barcode SVG tags.
  * **Subsidy Scheme Processing**: Manages Department Subsidy Scheme orders (Agriculture Department, Horticulture Schemes) linking farmer application numbers.
  * **Sales Returns**: Processes customer returns with credit adjustments or cash refund vouchers.
* **Scope of Work**:
  * Cash notes counting and reconciliation at the end of each shift.
  * Ensures serial numbers on physical machinery match the Delivery Challan before customer departure.

---

### 4. 📦 Inventory Controller & Warehouse In-Charge
The **Inventory Team** maintains warehouse accuracy, procurement, stock movements, and minimum stock levels.

* **Primary Responsibilities**:
  * **Supplier Directory**: Maintains vendor masters, manufacturer contact details, GSTIN, and credit terms.
  * **Purchase Orders (PO)**: Generates automated stock reorder requisitions based on low-stock thresholds.
  * **Purchase / Inward Stock Receipts (GRN)**: Logs goods inward with purchase invoice numbers, taxable rates, GST slabs, and freight expenses.
  * **Chassis & Serial Number Inward**: Registers individual machine serial/chassis numbers during stock receipt to ensure end-to-end traceability.
  * **Transport Between Branches**: Initiates and receives stock transfers between branch locations with transit status and delivery tracking.
  * **Price Protection**: Monitors purchase cost floors and prevents counter sales below procurement cost (`totalMinCost` protection).
  * **HSN / SAC Master**: Maintains HSN codes (e.g., 8432 for agricultural machinery, 8708 for parts) and maps applicable GST tax slabs (0%, 5%, 12%, 18%, 28%).
* **Scope of Work**:
  * Periodic physical stock audits and reconciliation against system balances.
  * Tracks damaged, returned, or dead inventory.

---

### 5. 🔧 Service Manager, Workshop Technicians & Mechanics
The **Workshop & Service Team** handles post-sale equipment assembly, customer servicing, OEM warranty claims, and repairs.

* **Primary Responsibilities**:
  * **Vehicle / Equipment Service Intake ("Get Details")**: Looks up past sales records by customer phone or machine chassis number to verify service history.
  * **Warranty Services & OEM Coupons**: Processes authorized manufacturer free service coupons (1st Service, 2nd Service, 3rd Service) for tractors, weeders, and power equipment.
  * **Paid Services & Repair Work Orders**: Creates service tickets for out-of-warranty machines, diagnosing mechanical issues and documenting customer complaints.
  * **Spare Parts Consumption**: Issues spare parts (engine oil, filters, blades, belts, spark plugs) directly onto the service ticket from live inventory.
  * **Labor Charges & Job Cards**: Logs technician labor hours and diagnostic charges.
  * **Official Service Receipts**: Prints itemized GST service receipts showing labor, parts consumed, and technician remarks.
  * **Warranty Replacement Workflow**: Logs defective OEM components, submits warranty replacement claims, and issues replacement parts to customers without double-charging.
  * **Mechanics & Staff Roster**: Assigns mechanics to jobs and tracks daily service completion rates.
* **Scope of Work**:
  * Keeps workshop spare parts inventory organized and reconciled with the main warehouse.
  * Ensures warranty replacement parts are returned to manufacturer supply depots.

---

### 6. 👥 HR & Payroll Officer
The **HR Officer** manages human resources, employee records, daily attendance, leave balances, and salary disbursement.

* **Primary Responsibilities**:
  * **Employee Directory**: Maintains complete employee profiles, Aadhaar/ID proof, emergency contacts, department, designation, and bank accounts.
  * **Daily Attendance Management**: Tracks daily employee presence (Present, Absent, Half Day, On Leave) with automated monthly attendance summaries.
  * **Leave Quota Administration**: Tracks annual leave allocations (Casual Leave, Sick Leave, Earned Leave) and approves/rejects leave applications.
  * **Salary Advance Tracking**: Records interim salary advances given to staff during the month and automatically deducts them during monthly payroll.
  * **Automated Salary Processing**: Computes net monthly pay based on:
    $$\text{Net Pay} = (\text{Basic} + \text{HRA} + \text{Allowances}) \times \frac{\text{Present Days}}{\text{Working Days}} - \text{Advance Deductions} + \text{Sales Incentives}$$
  * **Payslip Generation**: Generates official monthly salary slips with printable breakdowns.
  * **Sales Incentive Release**: Audits lead-generation records for field sales staff and releases performance-based sales incentives.
  * **Master CRM Directories**: Maintains master directories for Sub-Dealers, Registered Financers, and Enterprise Customers.
* **Scope of Work**:
  * Enforces company leave policies and ensures transparent salary computation.

---

### 7. 📱 Marketing Executive
The **Marketing Team** runs promotional outreach and customer retention campaigns.

* **Primary Responsibilities**:
  * **DLT-Compliant SMS Marketing**: Sends promotional SMS campaigns to registered customer databases for seasonal agricultural discount offers, service camps, and new machinery arrivals.
  * **Email Campaigns**: Manages email newsletters, transactional invoice notifications, and seasonal greetings.
  * **Customer Notification Logs**: Audits delivery reports for outgoing customer payment receipts and service reminders.
* **Scope of Work**:
  * Ensures compliance with Indian telecom DLT registration and template approvals.

---

### 8. 👤 Standard Employee (Staff Self-Service Portal)
Every employee in the organization has a dedicated self-service portal regardless of their department.

* **Primary Responsibilities & Features**:
  * **My Profile & Security**: Manages personal profile details and performs secure password resets using self-service **Email OTP Verification**.
  * **Today Tasks**: Views daily assigned task checklists and marks completed activities.
  * **Apply for Leave**: Submits leave requests with date range and reason; checks real-time remaining leave balance per leave category (CL, SL, EL).
  * **View Payslips**: Reviews historical monthly salary slips and payment mode details.

---

## 🛠️ Complete Functional Modules Breakdown

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            BUSINESS ERP MODULE MATRIX                        │
├─────────────────┬─────────────────┬─────────────────┬────────────────────────┤
│ 🛒 SALES & POS  │ 📦 INVENTORY    │ 💰 ACCOUNTING   │ 🔧 WORKSHOP & SERVICE  │
├─────────────────┼─────────────────┼─────────────────┼────────────────────────┤
│ • POS Billing   │ • Suppliers     │ • Set Capital   │ • Service Intake       │
│ • Quotations    │ • Stock Receipt │ • Loans/Contra  │ • Warranty Coupons     │
│ • Delivery (DC) │ • Multi-Branch  │ • Expenses      │ • Paid Services        │
│ • Tax Invoices  │ • Min Cost Guard│ • Daybook       │ • Spares Consumption   │
│ • Returns       │ • HSN Master    │ • Audit Reports │ • Warranty Replacement │
├─────────────────┼─────────────────┼─────────────────┼────────────────────────┤
│ 👥 HR & PAYROLL │ 📱 MARKETING    │ 📋 TODAY TASKS  │ ⚙️ GENERAL SETTINGS    │
├─────────────────┼─────────────────┼─────────────────┼────────────────────────┤
│ • Employee DB   │ • SMS (DLT)     │ • Daily Task Log│ • Profile & Security   │
│ • Attendance    │ • Email / SMTP  │ • Status Monitor│ • Email OTP Password   │
│ • Leave Quotas  │ • Broadcasts    │ • Role Checklists│ • Company Letterhead   │
│ • Salary Slips  │ • Delivery Logs │ • Action Items  │ • Terms & Conditions   │
└─────────────────┴─────────────────┴─────────────────┴────────────────────────┘
```

---

### 🛒 Module 1: Sales, Quotations & GST Billing

1. **POS Counter Billing**:
   * Instant item search by SKU, product name, model, or barcode scan.
   * Auto-populates Selling Price, MRP, HSN, and GST slab.
   * Enforces minimum purchase cost protection (`totalMinCost`) so items cannot be sold at an inadvertent loss.
2. **Denominations Calculator**:
   * Dedicated denomination breakdown table counting physical currency notes (₹2000, ₹500, ₹200, ₹100, ₹50, ₹20, ₹10).
   * Verifies that the cash collected equals the entered cash payment amount.
3. **Settlement Discounts (Flat ₹ & %)**:
   * Supports overall billing discounts in either **Rupees (₹)** or **Percentage (%)**.
   * Real-time dynamic recalculation adjusts taxable amount and GST totals proportionally so tax ledgers match rupee-for-rupee:
     $$\text{Adj. Taxable} = \text{Taxable} \times \frac{\text{Discounted Grand}}{\text{Original Grand}}$$
     $$\text{Adj. GST} = \text{Tax} \times \frac{\text{Discounted Grand}}{\text{Original Grand}}$$
4. **Delivery Challans (DC)**:
   * Dual-copy printed delivery document (Original Office Copy + Customer Gate Pass).
   * Tracks customer name, phone, village, mandal, transporter name, and vehicle registration number.
   * Captures individual machine **Chassis / Engine / Serial Numbers** ensuring clear chain of custody.
   * **DC Issuance Security Guard**: Restricts standard staff from issuing a Delivery Challan if the customer's pending balance exceeds ₹10,000 without prior Tax Invoice generation, with role-based Superadmin override.
5. **GST Tax Invoices**:
   * Sequential, gap-free invoice numbering maintained across financial years.
   * Formatted strictly as per Indian GST Tax Invoice guidelines.
   * Includes complete HSN breakdown table with CGST, SGST, IGST split.
   * Embeds official barcode SVG, dynamic website QR code, company bank details (A/c No, IFSC, Branch), and authorized signatory stamps.
6. **Government / Agriculture Subsidy Scheme Invoices**:
   * Dedicated support for Department Subsidy Schemes (Horticulture, Agriculture Department).
   * Records scheme department name and farmer application number.
   * Allows regulated Grand Total adjustment to match state department sanction orders.

---

### 📦 Module 2: Multi-Branch Inventory & Warehousing

1. **Multi-Location Stock**:
   * Real-time visibility of physical stock quantities across all branch outlets and godowns.
2. **Inward Stock Receipts (GRN)**:
   * Logs supplier consignments with PO reference, invoice date, purchase rate excluding tax, transport expenses, and GST rate.
   * Registers chassis and serial numbers upon receipt for complete traceability.
3. **Transport Between Branches**:
   * Inter-branch stock transfer vouchers with dispatch vehicle details and receiving confirmation.
4. **HSN Master & Tax Slabs**:
   * Central catalog mapping 8-digit HSN codes to GST slabs.
   * Standardizes tax calculations across all products and spare parts.

---

### 💰 Module 3: Accounting, Ledgers & Financial Statements

1. **Capital & Partner Accounts**:
   * Records initial business capital and capital infusions by proprietors/partners.
2. **Cash Book & Bank Accounts**:
   * Multiple bank account ledgers (SBI, HDFC, ICICI, etc.) with live balance tracking.
3. **Operating Expenses Ledger**:
   * Categorized expenditure tracking (Rent, Electricity, Freight, Salaries, Fuel, Tea/Snacks, Printing).
   * Daily and monthly expense analytics.
4. **Loans & Contra Vouchers**:
   * Records bank cash deposits (Cash $\rightarrow$ Bank) and cash withdrawals (Bank $\rightarrow$ Cash).
   * Manages commercial equipment loans, financier disbursements, and EMI repayments.
5. **Assets & Liabilities Ledger**:
   * Tracks tangible fixed assets, accumulated depreciation, current liabilities, and supplier payables.
6. **Auditor & Tax Reports**:
   * GSTR-1 outward supply register.
   * GSTR-3B monthly tax summary.
   * Profit & Loss statement and Balance Sheet summaries.
   * One-click export to Microsoft Excel (`.xlsx`).

---

### 🔧 Module 4: Workshop, Job Cards & Equipment Servicing

1. **Service Ticket Intake ("Get Details")**:
   * Quick vehicle/equipment lookup by customer phone number or machine chassis number.
   * Pulls warranty status, sale date, and past service logs.
2. **OEM Warranty Coupon Redemption**:
   * Verifies and claims free service coupons (1st, 2nd, 3rd Free Service).
   * Logs engine oil changes, air filter cleaning, and pre-delivery inspection (PDI) checklists.
3. **Paid Services & Repair Receipts**:
   * Records customer-reported machine faults, repair job cards, and mechanic notes.
   * Itemizes spare parts used and technician labor fees.
4. **Spare Parts Direct Consumption**:
   * Automatically deducts spare parts used during servicing from the inventory stock ledger.
5. **Warranty Machine & Parts Replacement**:
   * Manages warranty claims for defective factory parts (carburetors, gearboxes, starter motors).
   * Issues replacement items to customers and logs return items for OEM manufacturer credit.

---

### 👥 Module 5: HR, Biometric Attendance & Automated Payroll

1. **Employee Master Directory**:
   * Centralized employee records with emergency contacts, designation, and salary scale.
2. **Daily Attendance Tracking**:
   * Daily attendance register (Present, Absent, Half Day, Leave).
   * Monthly summary calculation feeding directly into payroll.
3. **Leave Management & Annual Quotas**:
   * Annual quota breakdown: Casual Leave (CL: 12 days), Sick Leave (SL: 6 days), Earned Leave (EL: 6 days).
   * Real-time leave balance deduction and online leave approval workflows.
4. **Salary Advances Ledger**:
   * Logs interim employee salary advances during the month.
   * Automatically deducts outstanding advance amounts during salary processing.
5. **Automated Monthly Salary Processing**:
   * Computes net pay based on present days, basic pay, allowances, and advance deductions.
   * Generates printable, professional salary payslips.
6. **Sales Lead Incentives**:
   * Links sales leads created by staff to completed machinery orders.
   * Computes and releases incentive commissions directly into monthly pay.

---

## 🔄 Core Business Workflows Illustrated

### Workflow A: Sales Order $\rightarrow$ Delivery Challan $\rightarrow$ Payment Settlement $\rightarrow$ Tax Invoice

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    actor Sales as Cashier / Sales Staff
    participant ERP as Business ERP
    actor Admin as Store Admin

    Customer->>Sales: Inquires for Commercial Machine
    Sales->>ERP: Generates Official Quotation / Estimate
    Customer->>Sales: Confirms Order & Pays Advance
    Sales->>ERP: Enters Payment & Records Serial / Chassis No.
    
    alt Balance <= ₹10,000 OR Fully Paid
        Sales->>ERP: Issues Dual-Copy Delivery Challan (DC)
    else Balance > ₹10,000
        Note over Sales,Admin: Delivery Challan Locked by Rule
        Admin->>ERP: Superadmin / Manager Overrides Gate Lock
        Sales->>ERP: Issues Delivery Challan
    end
    
    Customer->>Sales: Comes for Final Settlement
    Sales->>ERP: Opens Record Payment Modal
    Sales->>ERP: Enters Settlement Discount (₹ or %)
    ERP->>ERP: Automatically Recalculates Taxable & GST
    Sales->>ERP: Records Final Payment (Cash / UPI / Bank)
    Sales->>ERP: Generates Final GST Tax Invoice
    ERP->>Customer: Hands over Printed Dual Tax Invoice + SMS Receipt
```

---

### Workflow B: Equipment Service Intake $\rightarrow$ Job Card $\rightarrow$ Parts $\rightarrow$ Service Receipt

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    actor Tech as Workshop Mechanic
    participant ERP as Business ERP
    actor Cashier

    Customer->>Tech: Brings Machine for Service / Fault Repair
    Tech->>ERP: "Get Details" by Phone / Chassis No.
    ERP-->>Tech: Displays Sale Date, Model & Warranty Status
    
    alt Under Free Warranty Coupon
        Tech->>ERP: Redeems Free Service Coupon (PDI / Oil / Check)
    else Paid Service / Major Repair
        Tech->>ERP: Opens Paid Service Work Order & Job Card
    end
    
    Tech->>ERP: Adds Spares Consumed (Filter, Oil, Spark Plug)
    ERP->>ERP: Deducts Spares from Inventory in Real-Time
    Tech->>ERP: Adds Labor / Mechanic Charges
    Tech->>Cashier: Hands over Completed Work Order
    Cashier->>ERP: Collects Service Payment
    Cashier->>Customer: Issues Official GST Service Receipt
```

---

## 💻 Technology Stack & Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND LAYER                            │
│  • Vanilla ES6+ JavaScript (Modular, Zero-Build Overhead)             │
│  • CSS3 Custom Variables (Native Dark & Light Theme Support)          │
│  • Responsive Design (Optimized for Mobile, Tablets & POS Desktops)   │
│  • Browser-Native SVG Engine for Instant Barcodes & QR Codes          │
│  • SheetJS (xlsx.full.min.js) for Native Client-Side Excel Exports    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / JSON REST APIs
┌───────────────────────────────────┴────────────────────────────────────┐
│                             BACKEND ENGINE                             │
│  • Node.js Serverless Microservices on Vercel Engine                  │
│  • Express-Compatible Stateless REST Controllers                      │
│  • JSON Web Tokens (JWT) & Bcrypt Password Hashing                    │
│  • Nodemailer SMTP Engine for Transactional Mail Notifications        │
│  • DLT SMS Gateway Integration for Customer SMS Alerts                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Connection Pooling (Postgres Wire)
┌───────────────────────────────────┴────────────────────────────────────┐
│                             DATABASE LAYER                             │
│  • PostgreSQL 15+ Hosted on Neon Serverless Cloud                     │
│  • 50+ Interlinked Normalized Relational Tables                       │
│  • Atomic Transactions with Relational Integrity & Cascades           │
│  • Automatic On-The-Fly Schema Migrations (`ALTER TABLE IF NOT EXISTS`)│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Installation & Local Development

### 1. Prerequisites
* **Node.js**: v18.0.0 or higher.
* **Database**: PostgreSQL database (or free [Neon Serverless Postgres](https://neon.tech)).

### 2. Clone the Repository
```bash
git clone https://github.com/manageethaenterprises/manageetha.git
cd manageetha
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables
Create a `.env` file in the project root:
```env
# Database Connection (Neon Postgres)
DATABASE_URL="postgres://username:password@ep-your-database.neon.tech/neondb?sslmode=require"

# JWT Authentication Secret
JWT_SECRET="your-super-secret-jwt-key"

# SMTP Mail Server Configuration (Optional for Password Resets)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="Geetha Enterprises <no-reply@manageetha.in>"
```

### 5. Launch the Local Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:3000` or `http://localhost:3000/admin/dashboard`.

### 6. Deployment to Vercel
The repository is optimized for one-click deployment on **Vercel**:
```bash
vercel --prod
```
Ensure `DATABASE_URL` and `JWT_SECRET` are configured in your Vercel Project Environment Variables.

---

## 🔒 Security & Data Integrity Highlights

* **Automatic Schema Healing**: Database controllers run atomic `ALTER TABLE IF NOT EXISTS` checks on initialization, preventing production downtime during feature rollouts.
* **Cost Floor Protection**: Built-in pricing checks reject counter billing that falls below unit procurement cost.
* **Double Payment Guard**: Payment inputs validate against current real-time pending balance to prevent accidental duplicate payments.
* **DLT SMS Compliance**: Outgoing customer billing messages comply with Indian telecom DLT formatting standards.

---

## 📄 License & Enterprise Support

* **Application**: Commercial Business ERP System.
* **Copyright**: © 2026 Geetha Enterprises / Manaswini Enterprises. All rights reserved.
* **Support & Customization**: Managed and maintained internally by the platform administrator.
