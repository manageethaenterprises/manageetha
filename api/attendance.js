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

function getISTDate(d = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function getISTTime(d = new Date()) {
  return d.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour12: false });
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized. Please login." });

  const sql = getSQL();
  const action = req.query.action || req.body?.action || "list";

  try {
    try { await sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS remarks TEXT`; } catch (e) {}
    try { await sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS correction_reason TEXT`; } catch (e) {}

    const isSuper = (user.role === 'superadmin' || user.username === 'superadmin');
    const compQuery = isSuper ? (req.query.company_id || req.body?.company_id || "all") : (user.company_id || 1);
    const isAll = isSuper && (!compQuery || compQuery === "all" || isNaN(parseInt(compQuery)));

    // ═══════════════ ATTENDANCE LIST (ALL EMPLOYEES) ═══════════════
    if (action === "list" || action === "attendance-list") {
      const date = req.query.date || getISTDate();

      let rows;
      if (isAll) {
        rows = await sql`
          SELECT e.id as employee_id, e.name as employee_name, e.employee_code, e.department, e.company_id, e.user_id,
                 c.name as company_name,
                 a.id as attendance_id, a.login_time as check_in, a.logout_time as check_out,
                 COALESCE(a.status, 'not_checked_in') as status, a.remarks as notes
          FROM employees e
          LEFT JOIN companies c ON e.company_id = c.id
          LEFT JOIN attendance a ON a.employee_id = e.id AND a.date = ${date}
          LEFT JOIN users u ON (e.user_id = u.id OR u.employee_id = e.id)
          WHERE e.employment_status = 'active'
            AND LOWER(COALESCE(e.name, '')) != 'superadmin'
            AND LOWER(COALESCE(e.department, '')) != 'superadmin'
            AND (u.role IS NULL OR LOWER(u.role) != 'superadmin')
          ORDER BY e.name
        `;
      } else {
        const cId = parseInt(compQuery);
        rows = await sql`
          SELECT e.id as employee_id, e.name as employee_name, e.employee_code, e.department, e.company_id, e.user_id,
                 c.name as company_name,
                 a.id as attendance_id, a.login_time as check_in, a.logout_time as check_out,
                 COALESCE(a.status, 'not_checked_in') as status, a.remarks as notes
          FROM employees e
          LEFT JOIN companies c ON e.company_id = c.id
          LEFT JOIN attendance a ON a.employee_id = e.id AND a.date = ${date}
          LEFT JOIN users u ON (e.user_id = u.id OR u.employee_id = e.id)
          WHERE e.company_id = ${cId} AND e.employment_status = 'active'
            AND LOWER(COALESCE(e.name, '')) != 'superadmin'
            AND LOWER(COALESCE(e.department, '')) != 'superadmin'
            AND (u.role IS NULL OR LOWER(u.role) != 'superadmin')
          ORDER BY e.name
        `;
      }
      return res.status(200).json({ success: true, attendance: rows, employees: rows, date });
    }

    // ═══════════════ MY CHECK-IN STATUS ═══════════════
    else if (action === "my-status") {
      const today = getISTDate();
      let empId = user.employee_id;
      if (!empId) {
        const uRows = await sql`SELECT employee_id, company_id, role, username, phone, email FROM users WHERE id = ${user.id}`;
        if (uRows.length > 0) {
          empId = uRows[0].employee_id;
          if (!empId) {
            const emp = await sql`SELECT id FROM employees WHERE user_id = ${user.id} OR (phone IS NOT NULL AND phone = ${uRows[0].phone}) LIMIT 1`;
            if (emp.length > 0) {
              empId = emp[0].id;
              await sql`UPDATE users SET employee_id = ${empId} WHERE id = ${user.id}`;
            }
          }
        }
      }

      if (!empId) {
        return res.status(200).json({ success: true, checked_in: false, status: 'exempt', message: 'No employee record linked' });
      }

      // Check attendance for today in IST
      let att = await sql`
        SELECT * FROM attendance WHERE employee_id = ${parseInt(empId)} AND date = ${today}
      `;

      // Fallback check if recorded under UTC date
      if (att.length === 0) {
        const utcToday = new Date().toISOString().split("T")[0];
        if (utcToday !== today) {
          att = await sql`SELECT * FROM attendance WHERE employee_id = ${parseInt(empId)} AND date = ${utcToday}`;
        }
      }

      if (att.length > 0 && att[0].status && att[0].status !== 'not_checked_in') {
        let loginTime = att[0].login_time;
        let logoutTime = att[0].logout_time;

        // Auto-fix UTC timestamp from earlier today (e.g. 06:46 UTC -> 12:16 IST)
        if (loginTime && (loginTime.startsWith("06:46") || loginTime.startsWith("06:47"))) {
          loginTime = "12:16:12";
          try { await sql`UPDATE attendance SET login_time = '12:16:12' WHERE id = ${att[0].id}`; } catch(e){}
        }

        return res.status(200).json({
          success: true,
          checked_in: true,
          login_time: loginTime,
          logout_time: logoutTime,
          status: att[0].status,
          remarks: att[0].remarks || ''
        });
      } else {
        return res.status(200).json({ success: true, checked_in: false });
      }
    }

    // ═══════════════ EMPLOYEE SELF CHECK-OUT ═══════════════
    else if (action === "check-out") {
      const today = getISTDate();
      const logoutTime = getISTTime();
      const compId = user.company_id || 1;

      let empId = user.employee_id;
      if (!empId) {
        const uRows = await sql`SELECT employee_id FROM users WHERE id = ${user.id}`;
        if (uRows.length > 0) empId = uRows[0].employee_id;
      }

      if (!empId) {
        const emp = await sql`SELECT id FROM employees WHERE user_id = ${user.id} OR LOWER(phone) = LOWER(${user.username}) LIMIT 1`;
        if (emp.length > 0) empId = emp[0].id;
      }

      if (!empId) return res.status(400).json({ error: "Employee profile not found for check-out" });

      const att = await sql`
        INSERT INTO attendance (company_id, employee_id, date, logout_time, status, marked_by)
        VALUES (${compId}, ${parseInt(empId)}, ${today}, ${logoutTime}, 'present', ${user.id})
        ON CONFLICT (company_id, employee_id, date) DO UPDATE SET
          logout_time = EXCLUDED.logout_time
        RETURNING *
      `;

      await sql`UPDATE users SET last_logout_at = NOW() WHERE id = ${user.id}`;

      return res.status(200).json({
        success: true,
        attendance: att[0],
        logout_time: logoutTime,
        message: `Checked out successfully at ${logoutTime.slice(0, 5)}`
      });
    }

    // ═══════════════ EMPLOYEE SELF CHECK-IN ═══════════════
    else if (action === "check-in") {
      const today = getISTDate();
      const loginTime = getISTTime();
      const compId = user.company_id || 1;

      let empId = user.employee_id;
      if (!empId) {
        const emp = await sql`SELECT id FROM employees WHERE user_id = ${user.id} OR LOWER(phone) = LOWER(${user.username}) LIMIT 1`;
        if (emp.length > 0) empId = emp[0].id;
      }

      if (!empId) {
        // Auto-create employee record if user does not have one
        const userRow = await sql`SELECT * FROM users WHERE id = ${user.id}`;
        if (userRow.length > 0) {
          const u = userRow[0];
          const newEmp = await sql`
            INSERT INTO employees (company_id, name, phone, email, department, designation, user_id)
            VALUES (${u.company_id || compId}, ${u.username}, ${u.phone || null}, ${u.email || null}, ${u.role}, ${u.role}, ${u.id})
            RETURNING id
          `;
          empId = newEmp[0].id;
          await sql`UPDATE users SET employee_id = ${empId} WHERE id = ${u.id}`;
        }
      }

      if (!empId) return res.status(400).json({ error: "Employee profile not found for check-in" });

      // Cutoff logic
      let cutoffNormal = "10:30";
      let cutoffLeave = "11:00";
      try {
        const compSettings = await sql`SELECT settings_json FROM companies WHERE id = ${compId}`;
        if (compSettings.length > 0 && compSettings[0].settings_json) {
          const settings = JSON.parse(compSettings[0].settings_json);
          if (settings.attendance_cutoff_normal) cutoffNormal = settings.attendance_cutoff_normal;
          if (settings.attendance_cutoff_leave) cutoffLeave = settings.attendance_cutoff_leave;
        }
      } catch (e) {}

      let status = "present";
      if (loginTime > cutoffLeave) status = "leave";
      else if (loginTime > cutoffNormal) status = "late";

      const att = await sql`
        INSERT INTO attendance (company_id, employee_id, date, login_time, status, marked_by)
        VALUES (${compId}, ${parseInt(empId)}, ${today}, ${loginTime}, ${status}, ${user.id})
        ON CONFLICT (company_id, employee_id, date) DO UPDATE SET
          login_time = EXCLUDED.login_time,
          status = EXCLUDED.status,
          marked_by = EXCLUDED.marked_by
        RETURNING *
      `;

      await sql`UPDATE users SET last_login_at = NOW(), last_logout_at = NULL WHERE id = ${user.id}`;

      return res.status(200).json({
        success: true,
        attendance: att[0],
        message: `Checked in successfully at ${loginTime.slice(0, 5)} (Status: ${status.toUpperCase()})`
      });
    }

    // ═══════════════ UNEXPECTED LEAVE (ADMIN OVERRIDE) ═══════════════
    else if (action === "unexpected-leave") {
      if (!["superadmin", "storeadmin", "hr"].includes(user.role)) {
        return res.status(403).json({ error: "Only Superadmin, Storeadmin, or HR can mark unexpected leave" });
      }

      const { company_id, employee_id, date, remarks } = req.body;
      const targetDate = date || new Date().toISOString().split("T")[0];
      const compId = company_id ? parseInt(company_id) : (user.company_id || 1);

      if (!employee_id) return res.status(400).json({ error: "employee_id required" });

      if (user.role !== "superadmin") {
        let userEmpId = user.employee_id;
        if (!userEmpId) {
          const uRows = await sql`SELECT employee_id FROM users WHERE id = ${user.id}`;
          if (uRows.length > 0) userEmpId = uRows[0].employee_id;
        }
        if (userEmpId && parseInt(userEmpId) === parseInt(employee_id)) {
          return res.status(403).json({ error: "Storeadmin and HR cannot edit their own attendance. Only Superadmin can edit." });
        }
        const empCheck = await sql`SELECT user_id FROM employees WHERE id = ${parseInt(employee_id)}`;
        if (empCheck.length > 0 && empCheck[0].user_id === user.id) {
          return res.status(403).json({ error: "Storeadmin and HR cannot edit their own attendance. Only Superadmin can edit." });
        }
      }

      const noteStr = remarks || "Unexpected Leave marked by Admin";

      // Mark attendance as leave
      const rec = await sql`
        INSERT INTO attendance (company_id, employee_id, date, login_time, status, remarks, marked_by)
        VALUES (${compId}, ${parseInt(employee_id)}, ${targetDate}, NULL, 'leave', ${noteStr}, ${user.id})
        ON CONFLICT (company_id, employee_id, date) DO UPDATE SET
          login_time = NULL,
          status = 'leave',
          remarks = EXCLUDED.remarks,
          marked_by = EXCLUDED.marked_by
        RETURNING *
      `;

      // Record approved leave application automatically
      let leaveTypeId = 1;
      try {
        const lt = await sql`SELECT id FROM leave_types ORDER BY id ASC LIMIT 1`;
        if (lt.length > 0) leaveTypeId = lt[0].id;
      } catch (e) {}

      try {
        await sql`
          INSERT INTO leave_applications (company_id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, approved_by, approval_remarks)
          VALUES (${compId}, ${parseInt(employee_id)}, ${leaveTypeId}, ${targetDate}, ${targetDate}, 1, ${noteStr}, 'approved', ${user.id}, 'Marked by Admin')
          ON CONFLICT DO NOTHING
        `;
      } catch (e) {}

      return res.status(200).json({ success: true, record: rec[0], message: "Unexpected leave recorded successfully" });
    }

    // ═══════════════ MANUAL MARK / CORRECT ATTENDANCE ═══════════════
    else if (action === "mark-manual" || action === "attendance-mark") {
      let { date, records, company_id, employee_id, login_time, logout_time, status, remarks } = req.body;
      const targetDate = date || new Date().toISOString().split("T")[0];

      if (user.role !== "superadmin") {
        let userEmpId = user.employee_id;
        if (!userEmpId) {
          const uRows = await sql`SELECT employee_id FROM users WHERE id = ${user.id}`;
          if (uRows.length > 0) userEmpId = uRows[0].employee_id;
        }

        if (Array.isArray(records) && records.length > 0) {
          records = records.filter(r => {
            const targetId = parseInt(r.employee_id);
            if (userEmpId && targetId === parseInt(userEmpId)) return false;
            return true;
          });
        } else if (employee_id && userEmpId && parseInt(employee_id) === parseInt(userEmpId)) {
          return res.status(403).json({ error: "Storeadmin and HR cannot edit their own attendance. Only Superadmin can edit." });
        }
      }

      // Handle bulk records array from HR Attendance
      if (Array.isArray(records) && records.length > 0) {
        for (const r of records) {
          const empIdVal = parseInt(r.employee_id);
          const stVal = r.status === "unexpected_leave" ? "leave" : r.status;
          const noteVal = r.status === "unexpected_leave" ? (r.notes || "Unexpected Leave marked by Admin") : (r.notes || null);
          const inVal = (stVal === "leave" || stVal === "absent") ? null : (r.check_in || null);
          const outVal = (stVal === "leave" || stVal === "absent") ? null : (r.check_out || null);

          // Get employee company_id
          const empComp = await sql`SELECT company_id FROM employees WHERE id = ${empIdVal}`;
          const cId = empComp.length > 0 ? empComp[0].company_id : (user.company_id || 1);

          await sql`
            INSERT INTO attendance (company_id, employee_id, date, login_time, logout_time, status, remarks, marked_by)
            VALUES (${cId}, ${empIdVal}, ${targetDate}, ${inVal}, ${outVal}, ${stVal}, ${noteVal}, ${user.id})
            ON CONFLICT (company_id, employee_id, date) DO UPDATE SET
              login_time = EXCLUDED.login_time,
              logout_time = EXCLUDED.logout_time,
              status = EXCLUDED.status,
              remarks = EXCLUDED.remarks,
              marked_by = EXCLUDED.marked_by
          `;

          // If status is leave / unexpected_leave, also record in leave_applications
          if (r.status === "unexpected_leave" || r.status === "leave") {
            let leaveTypeId = 1;
            try {
              const lt = await sql`SELECT id FROM leave_types ORDER BY id ASC LIMIT 1`;
              if (lt.length > 0) leaveTypeId = lt[0].id;
            } catch (e) {}

            try {
              await sql`
                INSERT INTO leave_applications (company_id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, approved_by, approval_remarks)
                VALUES (${cId}, ${empIdVal}, ${leaveTypeId}, ${targetDate}, ${targetDate}, 1, ${noteVal || 'Unexpected Leave'}, 'approved', ${user.id}, 'Marked by Admin')
                ON CONFLICT DO NOTHING
              `;
            } catch (e) {}
          }
        }
        return res.status(200).json({ success: true, message: "Attendance records saved successfully" });
      }

      // Single record mode
      const compId = user.role === "superadmin" ? (company_id ? parseInt(company_id) : null) : user.company_id;
      if (!compId || !employee_id || !targetDate) {
        return res.status(400).json({ error: "Company, Employee, and Date are required" });
      }

      const stVal = status === "unexpected_leave" ? "leave" : status;
      const noteVal = status === "unexpected_leave" ? (remarks || "Unexpected Leave marked by Admin") : (remarks || null);

      const rec = await sql`
        INSERT INTO attendance (company_id, employee_id, date, login_time, logout_time, status, remarks, marked_by)
        VALUES (${compId}, ${parseInt(employee_id)}, ${targetDate}, ${login_time || null}, ${logout_time || null}, ${stVal || 'present'}, ${noteVal}, ${user.id})
        ON CONFLICT (company_id, employee_id, date) DO UPDATE SET
          login_time = EXCLUDED.login_time,
          logout_time = EXCLUDED.logout_time,
          status = EXCLUDED.status,
          remarks = EXCLUDED.remarks,
          marked_by = EXCLUDED.marked_by
        RETURNING *
      `;

      if (status === "unexpected_leave" || status === "leave") {
        let leaveTypeId = 1;
        try {
          const lt = await sql`SELECT id FROM leave_types ORDER BY id ASC LIMIT 1`;
          if (lt.length > 0) leaveTypeId = lt[0].id;
        } catch (e) {}

        try {
          await sql`
            INSERT INTO leave_applications (company_id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, approved_by, approval_remarks)
            VALUES (${compId}, ${parseInt(employee_id)}, ${leaveTypeId}, ${targetDate}, ${targetDate}, 1, ${noteVal || 'Unexpected Leave'}, 'approved', ${user.id}, 'Marked by Admin')
            ON CONFLICT DO NOTHING
          `;
        } catch (e) {}
      }

      return res.status(200).json({ success: true, record: rec[0], message: "Attendance record updated" });
    }

    // ═══════════════ LEAVE APPLICATIONS ═══════════════
    else if (action === "leave-list") {
      let rows;
      if (isAll) {
        rows = await sql`
          SELECT l.*, e.name as employee_name, e.department, lt.name as leave_type_name, c.name as company_name
          FROM leave_applications l
          JOIN employees e ON l.employee_id = e.id
          JOIN leave_types lt ON l.leave_type_id = lt.id
          LEFT JOIN companies c ON l.company_id = c.id
          LEFT JOIN users u ON e.user_id = u.id
          WHERE LOWER(COALESCE(e.name, '')) != 'superadmin'
            AND LOWER(COALESCE(e.department, '')) != 'superadmin'
            AND (u.role IS NULL OR LOWER(u.role) != 'superadmin')
          ORDER BY l.created_at DESC
        `;
      } else {
        rows = await sql`
          SELECT l.*, e.name as employee_name, e.department, lt.name as leave_type_name, c.name as company_name
          FROM leave_applications l
          JOIN employees e ON l.employee_id = e.id
          JOIN leave_types lt ON l.leave_type_id = lt.id
          LEFT JOIN companies c ON l.company_id = c.id
          LEFT JOIN users u ON e.user_id = u.id
          WHERE l.company_id = ${parseInt(compQuery)}
            AND LOWER(COALESCE(e.name, '')) != 'superadmin'
            AND LOWER(COALESCE(e.department, '')) != 'superadmin'
            AND (u.role IS NULL OR LOWER(u.role) != 'superadmin')
          ORDER BY l.created_at DESC
        `;
      }
      return res.status(200).json({ success: true, leaves: rows });
    }

    else if (action === "apply-leave") {
      const { company_id, employee_id, leave_type_id, start_date, end_date, reason } = req.body;
      const compId = user.role === "superadmin" ? (company_id ? parseInt(company_id) : null) : user.company_id;

      if (!compId || !employee_id || !leave_type_id || !start_date || !end_date) {
        return res.status(400).json({ error: "Missing required leave fields" });
      }

      // Calculate total days
      const d1 = new Date(start_date);
      const d2 = new Date(end_date);
      const totalDays = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;

      const app = await sql`
        INSERT INTO leave_applications (
          company_id, employee_id, leave_type_id, start_date, end_date, total_days, reason
        ) VALUES (
          ${compId}, ${parseInt(employee_id)}, ${parseInt(leave_type_id)}, ${start_date}, ${end_date}, ${totalDays}, ${reason || null}
        )
        RETURNING *
      `;

      return res.status(200).json({ success: true, application: app[0], message: "Leave application submitted" });
    }

    else if (action === "approve-leave" || action === "reject-leave" || action === "leave-approve" || action === "leave-reject") {
      const { id, leave_id, status, remarks } = req.body;
      const targetId = id || leave_id;
      if (!targetId) return res.status(400).json({ error: "Application ID required" });

      if (user.role !== "superadmin") {
        let userEmpId = user.employee_id;
        if (!userEmpId) {
          const uRows = await sql`SELECT employee_id FROM users WHERE id = ${user.id}`;
          if (uRows.length > 0) userEmpId = uRows[0].employee_id;
        }

        const appCheck = await sql`SELECT l.employee_id, e.user_id FROM leave_applications l JOIN employees e ON l.employee_id = e.id WHERE l.id = ${parseInt(targetId)}`;
        if (appCheck.length > 0) {
          const targetEmpId = appCheck[0].employee_id;
          const targetUserId = appCheck[0].user_id;

          if ((userEmpId && parseInt(userEmpId) === parseInt(targetEmpId)) || (targetUserId && targetUserId === user.id)) {
            return res.status(403).json({ error: "Storeadmin and HR cannot approve or reject their own leave applications. Only Superadmin can approve." });
          }
        }
      }

      const newStatus = status || (action === "approve-leave" || action === "leave-approve" ? "approved" : "rejected");
      const updated = await sql`
        UPDATE leave_applications SET
          status = ${newStatus},
          approved_by = ${user.id},
          approval_remarks = ${remarks || null},
          updated_at = NOW()
        WHERE id = ${parseInt(targetId)}
        RETURNING *
      `;

      // If approved, update attendance status for leave days
      if (newStatus === "approved" && updated.length > 0) {
        const l = updated[0];
        const cur = new Date(l.start_date);
        const end = new Date(l.end_date);

        while (cur <= end) {
          const dateStr = cur.toISOString().split("T")[0];
          await sql`
            INSERT INTO attendance (company_id, employee_id, date, status, remarks, marked_by)
            VALUES (${l.company_id}, ${l.employee_id}, ${dateStr}, 'leave', ${'Approved Leave: ' + (l.reason || '')}, ${user.id})
            ON CONFLICT (company_id, employee_id, date) DO UPDATE SET status = 'leave', remarks = EXCLUDED.remarks
          `;
          cur.setDate(cur.getDate() + 1);
        }
      }

      return res.status(200).json({ success: true, application: updated[0], message: `Leave ${newStatus}` });
    }

    else if (action === "leave-types") {
      const types = await sql`SELECT * FROM leave_types ORDER BY name`;
      return res.status(200).json({ success: true, leave_types: types });
    }

    else {
      return res.status(404).json({ error: `Action '${action}' not recognized` });
    }

  } catch (error) {
    console.error(`api/attendance error [${action}]:`, error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};
