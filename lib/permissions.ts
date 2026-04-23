// ──────────────────────────────────────────────────────────────
// Permission catalog — pure data, no server dependencies.
// Safe to import from client components.
// ──────────────────────────────────────────────────────────────

export type RoleKey = "owner" | "admin" | "manager" | "staff" | "member";

export const PERMISSION_CATEGORIES = {
  general: {
    label: "General",
    permissions: [
      { key: "dashboard.view", label: "View Dashboard" },
      { key: "alerts.view", label: "View Alerts" },
    ],
  },
  products: {
    label: "Products & Inventory",
    permissions: [
      { key: "products.view", label: "View Products" },
      { key: "products.create", label: "Create Products" },
      { key: "products.edit", label: "Edit Products" },
      { key: "products.delete", label: "Delete Products" },
      { key: "inventory.adjust", label: "Adjust Inventory" },
    ],
  },
  sales: {
    label: "Sales & Invoices",
    permissions: [
      { key: "sales.view", label: "View Sales" },
      { key: "sales.create", label: "Create Sales" },
      { key: "sales.edit", label: "Edit Sales" },
      { key: "sales.delete", label: "Delete Sales" },
      { key: "invoices.view", label: "View Invoices" },
      { key: "invoices.print", label: "Print Invoices" },
    ],
  },
  packaging: {
    label: "Packaging",
    permissions: [
      { key: "packaging.view", label: "View Packaging Queue" },
      { key: "packaging.update", label: "Update Packaging Status" },
    ],
  },
  customers: {
    label: "Customers",
    permissions: [
      { key: "customers.view", label: "View Customers" },
      { key: "customers.create", label: "Create Customers" },
      { key: "customers.edit", label: "Edit Customers" },
      { key: "customers.delete", label: "Delete Customers" },
    ],
  },
  reports: {
    label: "Reports & Analytics",
    permissions: [
      { key: "reports.view", label: "View Reports" },
      { key: "reports.export", label: "Export Reports" },
    ],
  },
  settings: {
    label: "Settings",
    permissions: [
      { key: "settings.view_business", label: "View Business Settings" },
      { key: "settings.edit_business", label: "Edit Business Settings" },
      { key: "settings.edit_system", label: "Edit System Settings" },
      { key: "settings.payment_methods", label: "Manage Payment Methods" },
    ],
  },
  administration: {
    label: "Administration",
    permissions: [
      { key: "users.manage", label: "Manage User Roles" },
      { key: "permissions.manage", label: "Manage User Permissions" },
      { key: "data.backup", label: "Full Data Backup" },
      { key: "data.restore", label: "Data Restore" },
      { key: "trash.view", label: "View Trash" },
      { key: "trash.restore", label: "Restore Items" },
      { key: "trash.delete_permanent", label: "Permanently Delete" },
    ],
  },

  // ─── HR MODULE PERMISSIONS ───────────────────────────────

  hr_employees: {
    label: "HR — Employees",
    permissions: [
      { key: "hr.employees.view", label: "View Employees" },
      { key: "hr.employees.create", label: "Create Employees" },
      { key: "hr.employees.edit", label: "Edit Employees" },
      { key: "hr.employees.terminate", label: "Terminate Employees" },
      { key: "hr.employees.view_salary", label: "View Salary Information" },
      { key: "hr.employees.view_personal", label: "View Personal Info (PII)" },
      { key: "hr.departments.view", label: "View Departments" },
      { key: "hr.departments.manage", label: "Manage Departments" },
      { key: "hr.positions.view", label: "View Positions" },
      { key: "hr.positions.manage", label: "Manage Positions (Job Catalog)" },
      { key: "hr.org_chart.view", label: "View Organization Chart" },
    ],
  },

  hr_attendance_leave: {
    label: "HR — Attendance & Leave",
    permissions: [
      { key: "hr.attendance.view_own", label: "View Own Attendance" },
      { key: "hr.attendance.view_all", label: "View All Employees' Attendance" },
      { key: "hr.attendance.record", label: "Record Check-in / Check-out" },
      { key: "hr.attendance.edit", label: "Edit Attendance Records" },
      { key: "hr.attendance.export", label: "Export Attendance Data" },
      { key: "hr.leave.view_own", label: "View Own Leave" },
      { key: "hr.leave.view_team", label: "View Team's Leave" },
      { key: "hr.leave.view_all", label: "View All Leave Requests" },
      { key: "hr.leave.request", label: "Submit Leave Requests" },
      { key: "hr.leave.approve", label: "Approve / Reject Leave" },
      { key: "hr.leave.cancel", label: "Cancel Leave Requests" },
      { key: "hr.leave.types.manage", label: "Manage Leave Types" },
      { key: "hr.leave.balance.adjust", label: "Adjust Leave Balances" },
    ],
  },

  hr_payroll: {
    label: "HR — Payroll",
    permissions: [
      { key: "hr.payroll.view", label: "View Payroll Runs" },
      { key: "hr.payroll.structures.view", label: "View Salary Structures" },
      { key: "hr.payroll.structures.manage", label: "Create / Edit Salary Structures" },
      { key: "hr.payroll.components.manage", label: "Manage Salary Components" },
      { key: "hr.payroll.assign_salary", label: "Assign Salaries to Employees" },
      { key: "hr.payroll.run", label: "Execute Payroll Runs" },
      { key: "hr.payroll.lock_period", label: "Lock / Unlock Pay Period" },
      { key: "hr.payslips.view_own", label: "View Own Payslip" },
      { key: "hr.payslips.view_all", label: "View All Payslips" },
      { key: "hr.payslips.distribute", label: "Distribute Payslips" },
      { key: "hr.payslips.export_pdf", label: "Export Payslip as PDF" },
      { key: "hr.payroll.gl_export", label: "Export GL Journal Entries" },
    ],
  },

  hr_performance: {
    label: "HR — Performance",
    permissions: [
      { key: "hr.performance.view_own", label: "View Own Performance" },
      { key: "hr.performance.view_team", label: "View Team's Performance" },
      { key: "hr.performance.view_all", label: "View All Performance Data" },
      { key: "hr.performance.cycles.manage", label: "Create / Manage Review Cycles" },
      { key: "hr.performance.goals.create", label: "Create Goals (OKR / KPI)" },
      { key: "hr.performance.goals.edit_own", label: "Edit Own Goals" },
      { key: "hr.performance.goals.edit_team", label: "Edit Team's Goals" },
      { key: "hr.performance.goals.update_progress", label: "Update Goal Progress" },
      { key: "hr.performance.reviews.submit_self", label: "Submit Self-Review" },
      { key: "hr.performance.reviews.submit_manager", label: "Submit Manager Review" },
      { key: "hr.performance.reviews.submit_peer", label: "Submit Peer Review" },
      { key: "hr.performance.reviews.view_all", label: "View All Reviews" },
      { key: "hr.performance.calibrate", label: "Calibrate Ratings (Bell Curve)" },
    ],
  },

  hr_recruitment: {
    label: "HR — Recruitment (ATS)",
    permissions: [
      { key: "hr.recruitment.view", label: "View Recruitment Pipeline" },
      { key: "hr.jobs.view", label: "View Job Postings" },
      { key: "hr.jobs.create", label: "Create Job Postings" },
      { key: "hr.jobs.edit", label: "Edit Job Postings" },
      { key: "hr.jobs.publish", label: "Publish / Close Jobs" },
      { key: "hr.candidates.view", label: "View Candidates" },
      { key: "hr.candidates.create", label: "Add Candidates" },
      { key: "hr.candidates.edit", label: "Edit Candidates" },
      { key: "hr.candidates.delete", label: "Delete Candidates" },
      { key: "hr.applications.view", label: "View Applications" },
      { key: "hr.applications.move_stage", label: "Move Applications Between Stages" },
      { key: "hr.applications.make_offer", label: "Make Job Offers" },
      { key: "hr.applications.reject", label: "Reject Applications" },
      { key: "hr.applications.hire", label: "Mark Candidates as Hired" },
    ],
  },

  hr_learning: {
    label: "HR — Learning (LMS)",
    permissions: [
      { key: "hr.learning.view", label: "View Course Catalog" },
      { key: "hr.learning.view_enrollments", label: "View All Enrollments" },
      { key: "hr.courses.create", label: "Create Courses" },
      { key: "hr.courses.edit", label: "Edit Courses" },
      { key: "hr.courses.publish", label: "Publish / Unpublish Courses" },
      { key: "hr.courses.delete", label: "Delete Courses" },
      { key: "hr.modules.manage", label: "Manage Course Modules" },
      { key: "hr.enrollments.self_enroll", label: "Self-Enroll in Courses" },
      { key: "hr.enrollments.assign", label: "Assign Courses to Employees" },
      { key: "hr.enrollments.update_progress", label: "Update Enrollment Progress" },
      { key: "hr.certifications.issue", label: "Issue Certifications Manually" },
      { key: "hr.certifications.revoke", label: "Revoke Certifications" },
    ],
  },

  hr_documents: {
    label: "HR — Documents",
    permissions: [
      { key: "hr.documents.view_own", label: "View Own Documents" },
      { key: "hr.documents.view_all", label: "View All Employees' Documents" },
      { key: "hr.documents.upload", label: "Upload Documents" },
      { key: "hr.documents.download", label: "Download Documents" },
      { key: "hr.documents.delete", label: "Delete Documents" },
      { key: "hr.documents.sign", label: "Sign Documents (e-Signature)" },
      { key: "hr.documents.request_signature", label: "Request Signatures from Others" },
      { key: "hr.documents.set_expiry", label: "Set Document Expiry" },
      { key: "hr.documents.view_expiring", label: "View Expiring Documents" },
      { key: "hr.documents.categories.view", label: "View Document Categories" },
      { key: "hr.documents.categories.manage", label: "Manage Document Categories" },
      { key: "hr.documents.audit_trail", label: "View Document Audit Trail" },
    ],
  },
} as const;

export const ROLES: RoleKey[] = ["owner", "admin", "manager", "staff", "member"];
