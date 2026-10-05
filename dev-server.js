const express = require('express');
const fs = require('fs');
const path = require('path');

// ═══════════════ ENV LOADER ═══════════════
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  const fallbackPath = path.join(__dirname, '.env');
  let envFile = null;

  if (fs.existsSync(envPath)) envFile = envPath;
  else if (fs.existsSync(fallbackPath)) envFile = fallbackPath;

  if (envFile) {
    console.log(`[INFO] Loading env from ${path.basename(envFile)}`);
    const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().startsWith('#') || !line.trim()) continue;
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?$/);
      if (match) {
        let value = (match[2] || '').trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }
        process.env[match[1]] = value;
      }
    }
  } else {
    console.log('[WARNING] No .env.local or .env found. Set environment variables manually.');
  }
}
loadEnv();

const app = express();
app.use(express.json({ limit: '50mb' }));

// ═══════════════ CORS ═══════════════
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// ═══════════════ HANDLER WRAPPER ═══════════════
function runHandler(handlerPath) {
  return async (req, res) => {
    try {
      if (req.params && req.params.id) {
        req.query = req.query || {};
        req.query.id = req.params.id;
      }
      const handler = require(handlerPath);
      await handler(req, res);
    } catch (err) {
      console.error(`[ERROR] ${handlerPath}:`, err);
      res.status(500).json({ error: 'Server handler failed', details: err.message });
    }
  };
}

// ═══════════════════════════════════════════════════════════
// API ROUTE MAPPINGS — 12 Serverless Functions
// ═══════════════════════════════════════════════════════════

// 1. Setup
app.all('/api/setup', runHandler('./api/setup'));

// 2. Auth
app.all('/api/auth/login', (req, res, next) => { req.query.action = 'login'; next(); }, runHandler('./api/auth'));
app.all('/api/auth/me', (req, res, next) => { req.query.action = 'me'; next(); }, runHandler('./api/auth'));
app.all('/api/auth/change-password', (req, res, next) => { req.query.action = 'change-password'; next(); }, runHandler('./api/auth'));
app.all('/api/auth', runHandler('./api/auth'));

// 3. Super Admin
app.all('/api/super', runHandler('./api/super'));

// 4. Employees (+ dealers, financers, customers)
app.all('/api/employees/:id', runHandler('./api/employees'));
app.all('/api/employees', runHandler('./api/employees'));

// 5. Attendance & Leave
app.all('/api/attendance', runHandler('./api/attendance'));

// 6. Payroll
app.all('/api/payroll', runHandler('./api/payroll'));

// 7. Inventory (+ suppliers, products, PO, stock)
app.all('/api/inventory', runHandler('./api/inventory'));

// 8. Sales (+ DC, invoices, payments, receipts, returns)
app.all('/api/sales', runHandler('./api/sales'));

// 9. Services
app.all('/api/services', runHandler('./api/services'));

// 10. Accountant (+ capital, loans, expenses)
app.all('/api/accountant', runHandler('./api/accountant'));

// 11. Marketing (email, SMS)
app.all('/api/marketing', runHandler('./api/marketing'));

// 12. Reports
app.all('/api/reports', runHandler('./api/reports'));

// ═══════════════ STATIC FILES ═══════════════
app.use(express.static(__dirname));

// SPA fallback
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});
app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'dashboard.html'));
});

// ═══════════════ START ═══════════════
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[READY] Business ERP running at http://localhost:${PORT}`);
  console.log(`[INFO] Run DB setup: http://localhost:${PORT}/api/setup`);
  console.log(`[INFO] Login at: http://localhost:${PORT}/admin`);
});
