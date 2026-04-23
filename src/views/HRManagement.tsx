import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageHeaderActions } from "@/hooks/usePageHeaderActions";
import { usePageHeaderControls } from "@/hooks/usePageHeaderControls";
import { usePageSearch } from "@/hooks/usePageSearch";
import {
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Fingerprint,
  Globe2,
  GraduationCap,
  PauseCircle,
  PlayCircle,
  Receipt,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

type HRTab =
  | "overview"
  | "lifecycle"
  | "attendance"
  | "leave"
  | "payroll"
  | "talent"
  | "compliance";

type WorkState = "working" | "on_break" | "offline" | "leave";

type BreakSession = {
  start: Date;
  end: Date | null;
};

type EmployeeRecord = {
  id: string;
  name: string;
  code: string;
  department: string;
  position: string;
  manager: string;
  location: string;
  regionPack: "Bangladesh" | "India" | "GCC";
  lifecycleStage: "Onboarding" | "Active" | "Promotion Review" | "Leave";
  employmentType: "Full Time" | "Contract" | "Hybrid";
  workState: WorkState;
  shiftStart: Date | null;
  shiftHours: number;
  breakSessions: BreakSession[];
  activeBreakStartedAt: Date | null;
  attendanceMode: "Biometric" | "QR" | "GPS";
  weeklyHours: number;
  overtimeMinutes: number;
  leaveBalanceDays: number;
  contractStatus: "Signed" | "Pending Renewal" | "Probation";
  performanceScore: number;
  directReports: number;
  hireDate: string;
  currentFocus: string;
  salaryBand: string;
  complianceFlag: "Clear" | "Review";
};

type LeaveRequest = {
  id: string;
  employee: string;
  department: string;
  type: string;
  dateRange: string;
  days: number;
  status: "Pending" | "Approved" | "Escalated";
  approver: string;
};

type PayrollRun = {
  id: string;
  period: string;
  countryPack: "Bangladesh" | "India" | "GCC";
  status: "Locked for Approval" | "Draft Aggregation" | "Completed";
  processedCount: number;
  totalEmployees: number;
  totalCost: number;
  approver: string;
  journalExport: string;
};

type ModuleBlueprint = {
  name: string;
  suite: "Core Suite" | "Growth Suite" | "Governance" | "ESS";
  standard: string;
  summary: string;
};

const hrModules: ModuleBlueprint[] = [
  {
    name: "Employee Lifecycle",
    suite: "Core Suite",
    standard: "ISO 30408",
    summary: "Hire-to-retire records, org structure, employment history, and digital contracts.",
  },
  {
    name: "Attendance & Time",
    suite: "Core Suite",
    standard: "ILO Working Time",
    summary: "Biometric, QR, GPS, shifts, overtime controls, and live work-state tracking.",
  },
  {
    name: "Leave Management",
    suite: "Core Suite",
    standard: "Regional Labor Laws",
    summary: "Policy-driven leave accrual, carryover rules, and multi-level approvals.",
  },
  {
    name: "Payroll Engine",
    suite: "Core Suite",
    standard: "IFRS / IAS 19",
    summary: "Multi-currency payroll, statutory deductions, payslips, and GL readiness.",
  },
  {
    name: "Performance Management",
    suite: "Growth Suite",
    standard: "ISO 10667",
    summary: "OKR, KPI, 360 feedback, review cycles, and calibration workflows.",
  },
  {
    name: "Recruitment (ATS)",
    suite: "Growth Suite",
    standard: "EEOC / GDPR Art. 13",
    summary: "Requisition approval, hiring pipeline, offers, onboarding, and consent tracking.",
  },
  {
    name: "Learning & Development",
    suite: "Growth Suite",
    standard: "SCORM 2004 / xAPI",
    summary: "Course delivery, certification tracking, and skill-matrix coverage.",
  },
  {
    name: "Benefits & Compensation",
    suite: "Growth Suite",
    standard: "IAS 19 / ASC 715",
    summary: "Benefits enrollment, salary bands, loans, and compensation governance.",
  },
  {
    name: "Document Management",
    suite: "Governance",
    standard: "eIDAS / ESIGN Act",
    summary: "Template-driven documents, e-sign flow, policy storage, and expiry tracking.",
  },
  {
    name: "Analytics & Reports",
    suite: "Governance",
    standard: "ISO 30414",
    summary: "Headcount, attrition, payroll cost, overtime, and workforce reporting.",
  },
  {
    name: "Compliance Engine",
    suite: "Governance",
    standard: "GDPR / SOX / PDPA",
    summary: "Audit logs, regulatory calendar, labor-law packs, and privacy controls.",
  },
  {
    name: "Employee Self-Service",
    suite: "ESS",
    standard: "Mobile PWA",
    summary: "Employee-facing profile, leave, payslip, goals, and document access.",
  },
];

const leavePolicies = [
  {
    name: "Annual Leave",
    entitlement: "18 days / year",
    carryover: "Max 5 days until Mar 31",
    approval: "Manager -> HR",
  },
  {
    name: "Sick Leave",
    entitlement: "12 days / year",
    carryover: "No carryover",
    approval: "Manager only",
  },
  {
    name: "Parental Leave",
    entitlement: "Region-based statutory policy",
    carryover: "Policy protected",
    approval: "Manager -> HR -> Compliance",
  },
  {
    name: "Comp Off",
    entitlement: "Earned from overtime shifts",
    carryover: "Expires after 90 days",
    approval: "Line Manager",
  },
];

const leaveRequests: LeaveRequest[] = [
  {
    id: "lv-001",
    employee: "Omar Faruq",
    department: "Finance & Payroll",
    type: "Sick Leave",
    dateRange: "Mar 18 - Mar 19",
    days: 2,
    status: "Pending",
    approver: "Ayesha Rahman",
  },
  {
    id: "lv-002",
    employee: "Priya Sen",
    department: "Learning & Development",
    type: "Annual Leave",
    dateRange: "Mar 15 - Mar 17",
    days: 3,
    status: "Approved",
    approver: "Sohan Ahmed",
  },
  {
    id: "lv-003",
    employee: "Yasin Chowdhury",
    department: "Governance",
    type: "Comp Off",
    dateRange: "Mar 22",
    days: 1,
    status: "Pending",
    approver: "Ayesha Rahman",
  },
  {
    id: "lv-004",
    employee: "Nabila Karim",
    department: "Recruitment",
    type: "Emergency Leave",
    dateRange: "Mar 28",
    days: 1,
    status: "Escalated",
    approver: "HR Operations Board",
  },
];

const payrollRuns: PayrollRun[] = [
  {
    id: "pr-001",
    period: "March 2026 Payroll",
    countryPack: "Bangladesh",
    status: "Locked for Approval",
    processedCount: 148,
    totalEmployees: 156,
    totalCost: 124000,
    approver: "Finance Controller",
    journalExport: "QuickBooks draft ready",
  },
  {
    id: "pr-002",
    period: "March 2026 Shared Services",
    countryPack: "India",
    status: "Draft Aggregation",
    processedCount: 61,
    totalEmployees: 74,
    totalCost: 68500,
    approver: "Payroll Lead",
    journalExport: "Awaiting salary revision sync",
  },
  {
    id: "pr-003",
    period: "February 2026 GCC WPS",
    countryPack: "GCC",
    status: "Completed",
    processedCount: 44,
    totalEmployees: 44,
    totalCost: 91200,
    approver: "Regional HRBP",
    journalExport: "WPS file exported",
  },
];

const recruitmentPipeline = [
  { stage: "Sourcing", count: 28 },
  { stage: "Screening", count: 11 },
  { stage: "Interview", count: 6 },
  { stage: "Offer", count: 2 },
  { stage: "Onboard", count: 1 },
];

const salaryMix = [
  { name: "Basic Salary", value: 52 },
  { name: "Allowances", value: 18 },
  { name: "Housing / HRA", value: 14 },
  { name: "Tax & Statutory", value: 9 },
  { name: "Benefits Reserve", value: 7 },
];

const payrollRegions = [
  {
    country: "Bangladesh",
    rules: "Income tax slabs, PF, gratuity, BEPZA-ready",
    exportFormat: "NBR-ready schedule + PDF payslip",
  },
  {
    country: "India",
    rules: "TDS, PF, ESI, PT structure",
    exportFormat: "Form 16 / TDS-ready handoff",
  },
  {
    country: "GCC",
    rules: "WPS, gratuity, DEWS / GOSI readiness",
    exportFormat: "WPS / regional payroll packs",
  },
];

const complianceHighlights = [
  {
    title: "Privacy & Consent",
    standard: "GDPR / CCPA / PDPA",
    description: "Consent records, controlled access, and policy-linked employee data handling.",
  },
  {
    title: "Security Controls",
    standard: "ISO 27001 / SOC 2",
    description: "Role-based access, auditability, encrypted payroll data, and tenant isolation.",
  },
  {
    title: "Labor Compliance",
    standard: "GCC / ILO / Regional Packs",
    description: "Working-time, overtime, leave entitlement, and end-of-service rule support.",
  },
  {
    title: "Reporting Discipline",
    standard: "ISO 30414",
    description: "Headcount, turnover, cost, training, and governance metrics for management review.",
  },
];

const essFeatures = [
  "My profile, documents, and digital contracts",
  "Leave request, balance, and approval tracking",
  "Payslip, payroll summary, and tax breakdown",
  "Goals, feedback, certifications, and training history",
];

const analyticsHighlights = [
  {
    label: "Headcount Growth",
    value: "+12%",
    description: "Quarter-on-quarter growth across HR, finance, and operations.",
  },
  {
    label: "Attrition Risk",
    value: "2.1%",
    description: "Low current attrition, with contract renewals driving most review cases.",
  },
  {
    label: "Overtime Alerts",
    value: "3 employees",
    description: "Employees approaching working-time thresholds for weekly compliance review.",
  },
];

const performanceHighlights = [
  { label: "Quarterly OKR Progress", value: 72 },
  { label: "360 Feedback Completion", value: 81 },
  { label: "Learning Certification Rate", value: 68 },
];

const workforceMoments = [
  "Shift planner synced with biometric, QR, and GPS attendance modes.",
  "Break timer pauses work accumulation until the employee resumes active work.",
  "Overtime visibility mapped to weekly thresholds for manager and HR review.",
  "Attendance, leave, and payroll stay aligned for payroll-period processing.",
];

const suiteToneClasses: Record<ModuleBlueprint["suite"], string> = {
  "Core Suite": "border-transparent bg-primary/10 text-primary",
  "Growth Suite": "border-transparent bg-secondary/20 text-secondary-content",
  Governance: "border-transparent bg-accent/15 text-accent-content",
  ESS: "border-transparent bg-success/15 text-success",
};

const lifecycleToneClasses: Record<EmployeeRecord["lifecycleStage"], string> = {
  Onboarding: "border-transparent bg-info/15 text-info",
  Active: "border-transparent bg-success/15 text-success",
  "Promotion Review": "border-transparent bg-warning/15 text-warning",
  Leave: "border-transparent bg-base-300 text-base-content",
};

const contractToneClasses: Record<EmployeeRecord["contractStatus"], string> = {
  Signed: "border-transparent bg-success/15 text-success",
  "Pending Renewal": "border-transparent bg-warning/15 text-warning",
  Probation: "border-transparent bg-info/15 text-info",
};

const workStateToneClasses: Record<WorkState, string> = {
  working: "border-transparent bg-success/15 text-success",
  on_break: "border-transparent bg-warning/15 text-warning",
  offline: "border-transparent bg-base-300 text-base-content",
  leave: "border-transparent bg-info/15 text-info",
};

const leaveStatusToneClasses: Record<LeaveRequest["status"], string> = {
  Pending: "border-transparent bg-warning/15 text-warning",
  Approved: "border-transparent bg-success/15 text-success",
  Escalated: "border-transparent bg-error/15 text-error",
};

const payrollToneClasses: Record<PayrollRun["status"], string> = {
  "Locked for Approval": "border-transparent bg-warning/15 text-warning",
  "Draft Aggregation": "border-transparent bg-info/15 text-info",
  Completed: "border-transparent bg-success/15 text-success",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const formatDateLabel = (value: Date | string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(typeof value === "string" ? new Date(value) : value);

const formatTimeLabel = (value: Date) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds,
  ).padStart(2, "0")}`;
};

const formatDurationCompact = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const getBreakSeconds = (employee: EmployeeRecord, referenceTime: Date) =>
  employee.breakSessions.reduce((total, session) => {
    const end = session.end ?? referenceTime;
    return total + Math.max(0, (end.getTime() - session.start.getTime()) / 1000);
  }, 0);

const getWorkSeconds = (employee: EmployeeRecord, referenceTime: Date) => {
  if (!employee.shiftStart) {
    return 0;
  }

  const totalShiftSeconds = Math.max(
    0,
    (referenceTime.getTime() - employee.shiftStart.getTime()) / 1000,
  );

  return Math.max(0, totalShiftSeconds - getBreakSeconds(employee, referenceTime));
};

const buildInitialEmployees = (): EmployeeRecord[] => {
  const now = Date.now();

  return [
    {
      id: "emp-001",
      name: "Ayesha Rahman",
      code: "HR-001",
      department: "People Operations",
      position: "HR Admin",
      manager: "Executive Board",
      location: "Dhaka HQ",
      regionPack: "Bangladesh",
      lifecycleStage: "Active",
      employmentType: "Full Time",
      workState: "working",
      shiftStart: new Date(now - 4 * 60 * 60 * 1000 - 12 * 60 * 1000),
      shiftHours: 9,
      breakSessions: [
        {
          start: new Date(now - 2 * 60 * 60 * 1000 - 5 * 60 * 1000),
          end: new Date(now - 1 * 60 * 60 * 1000 - 50 * 60 * 1000),
        },
      ],
      activeBreakStartedAt: null,
      attendanceMode: "Biometric",
      weeklyHours: 37.5,
      overtimeMinutes: 25,
      leaveBalanceDays: 9,
      contractStatus: "Signed",
      performanceScore: 92,
      directReports: 8,
      hireDate: "2023-05-15",
      currentFocus: "Policy rollout and hiring approvals",
      salaryBand: "Band C3",
      complianceFlag: "Clear",
    },
    {
      id: "emp-002",
      name: "Omar Faruq",
      code: "PAY-014",
      department: "Finance & Payroll",
      position: "Payroll Specialist",
      manager: "Ayesha Rahman",
      location: "Dhaka HQ",
      regionPack: "Bangladesh",
      lifecycleStage: "Active",
      employmentType: "Full Time",
      workState: "on_break",
      shiftStart: new Date(now - 3 * 60 * 60 * 1000 - 35 * 60 * 1000),
      shiftHours: 9,
      breakSessions: [
        {
          start: new Date(now - 2 * 60 * 60 * 1000 - 10 * 60 * 1000),
          end: new Date(now - 1 * 60 * 60 * 1000 - 55 * 60 * 1000),
        },
        {
          start: new Date(now - 14 * 60 * 1000),
          end: null,
        },
      ],
      activeBreakStartedAt: new Date(now - 14 * 60 * 1000),
      attendanceMode: "QR",
      weeklyHours: 38.1,
      overtimeMinutes: 40,
      leaveBalanceDays: 6,
      contractStatus: "Signed",
      performanceScore: 88,
      directReports: 0,
      hireDate: "2022-11-04",
      currentFocus: "March payroll validation and deduction review",
      salaryBand: "Band B2",
      complianceFlag: "Clear",
    },
    {
      id: "emp-003",
      name: "Nabila Karim",
      code: "TA-008",
      department: "Recruitment",
      position: "Talent Acquisition Lead",
      manager: "Ayesha Rahman",
      location: "Remote - Dhaka",
      regionPack: "Bangladesh",
      lifecycleStage: "Promotion Review",
      employmentType: "Hybrid",
      workState: "working",
      shiftStart: new Date(now - 2 * 60 * 60 * 1000 - 18 * 60 * 1000),
      shiftHours: 8.5,
      breakSessions: [],
      activeBreakStartedAt: null,
      attendanceMode: "GPS",
      weeklyHours: 34.8,
      overtimeMinutes: 0,
      leaveBalanceDays: 11,
      contractStatus: "Signed",
      performanceScore: 95,
      directReports: 3,
      hireDate: "2021-08-20",
      currentFocus: "Offer approvals and structured interview scorecards",
      salaryBand: "Band C2",
      complianceFlag: "Clear",
    },
    {
      id: "emp-004",
      name: "Sohan Ahmed",
      code: "OPS-021",
      department: "Operations",
      position: "Operations Manager",
      manager: "Executive Board",
      location: "Chattogram Plant",
      regionPack: "Bangladesh",
      lifecycleStage: "Active",
      employmentType: "Full Time",
      workState: "offline",
      shiftStart: null,
      shiftHours: 10,
      breakSessions: [],
      activeBreakStartedAt: null,
      attendanceMode: "Biometric",
      weeklyHours: 42.4,
      overtimeMinutes: 85,
      leaveBalanceDays: 5,
      contractStatus: "Pending Renewal",
      performanceScore: 84,
      directReports: 19,
      hireDate: "2020-02-12",
      currentFocus: "Shift rostering and overtime stabilization",
      salaryBand: "Band D1",
      complianceFlag: "Review",
    },
    {
      id: "emp-005",
      name: "Priya Sen",
      code: "LMS-003",
      department: "Learning & Development",
      position: "L&D Partner",
      manager: "Ayesha Rahman",
      location: "Bengaluru Hub",
      regionPack: "India",
      lifecycleStage: "Leave",
      employmentType: "Hybrid",
      workState: "leave",
      shiftStart: null,
      shiftHours: 8.5,
      breakSessions: [],
      activeBreakStartedAt: null,
      attendanceMode: "GPS",
      weeklyHours: 31.2,
      overtimeMinutes: 0,
      leaveBalanceDays: 4,
      contractStatus: "Signed",
      performanceScore: 90,
      directReports: 2,
      hireDate: "2023-01-07",
      currentFocus: "Certification framework refresh",
      salaryBand: "Band C1",
      complianceFlag: "Clear",
    },
    {
      id: "emp-006",
      name: "Yasin Chowdhury",
      code: "GOV-009",
      department: "Governance",
      position: "Compliance Analyst",
      manager: "Ayesha Rahman",
      location: "Dubai Office",
      regionPack: "GCC",
      lifecycleStage: "Active",
      employmentType: "Contract",
      workState: "working",
      shiftStart: new Date(now - 5 * 60 * 60 * 1000 - 4 * 60 * 1000),
      shiftHours: 9,
      breakSessions: [
        {
          start: new Date(now - 4 * 60 * 60 * 1000 - 20 * 60 * 1000),
          end: new Date(now - 4 * 60 * 60 * 1000),
        },
        {
          start: new Date(now - 2 * 60 * 60 * 1000 - 15 * 60 * 1000),
          end: new Date(now - 2 * 60 * 60 * 1000),
        },
      ],
      activeBreakStartedAt: null,
      attendanceMode: "QR",
      weeklyHours: 40.6,
      overtimeMinutes: 32,
      leaveBalanceDays: 7,
      contractStatus: "Probation",
      performanceScore: 86,
      directReports: 0,
      hireDate: "2025-12-02",
      currentFocus: "Regional compliance pack validation",
      salaryBand: "Band B3",
      complianceFlag: "Review",
    },
  ];
};

const KpiCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: typeof Briefcase;
}) => (
  <Card className="border-border/70 bg-card/90 shadow-sm">
    <CardContent className="flex items-start justify-between gap-4 p-5">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </p>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
    </CardContent>
  </Card>
);

export default function HRManagement() {
  const [activeTab, setActiveTab] = useState<HRTab>("overview");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [employees, setEmployees] = useState<EmployeeRecord[]>(() => buildInitialEmployees());
  const [now, setNow] = useState(() => new Date());

  const { query: searchTerm } = usePageSearch({
    placeholder: "Search employees, departments, payroll packs, leave requests...",
  });

  usePageHeaderActions(null);
  usePageHeaderControls(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const departmentOptions = useMemo(
    () => ["all", ...new Set(employees.map((employee) => employee.department))],
    [employees],
  );

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesDepartment =
        departmentFilter === "all" || employee.department === departmentFilter;
      const matchesRegion = regionFilter === "all" || employee.regionPack === regionFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [
          employee.name,
          employee.code,
          employee.department,
          employee.position,
          employee.manager,
          employee.location,
          employee.currentFocus,
          employee.regionPack,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesDepartment && matchesRegion && matchesSearch;
    });
  }, [departmentFilter, employees, regionFilter, searchTerm]);

  const filteredLeaveRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return leaveRequests.filter((request) => {
      const matchesDepartment =
        departmentFilter === "all" || request.department === departmentFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [request.employee, request.department, request.type, request.approver]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesDepartment && matchesSearch;
    });
  }, [departmentFilter, searchTerm]);

  const filteredPayrollRuns = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return payrollRuns.filter((run) => {
      const matchesRegion = regionFilter === "all" || run.countryPack === regionFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [run.period, run.countryPack, run.status, run.approver, run.journalExport]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesRegion && matchesSearch;
    });
  }, [regionFilter, searchTerm]);

  const departmentCounts = useMemo(() => {
    const counts = new Map<string, number>();

    filteredEmployees.forEach((employee) => {
      counts.set(employee.department, (counts.get(employee.department) ?? 0) + 1);
    });

    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
  }, [filteredEmployees]);

  const workingCount = filteredEmployees.filter((employee) => employee.workState === "working").length;
  const onBreakCount = filteredEmployees.filter((employee) => employee.workState === "on_break").length;
  const leaveCount = filteredEmployees.filter((employee) => employee.workState === "leave").length;
  const payrollReadyCount = filteredEmployees.filter(
    (employee) => employee.contractStatus === "Signed" && employee.complianceFlag === "Clear",
  ).length;

  const averagePerformance = Math.round(
    filteredEmployees.reduce((total, employee) => total + employee.performanceScore, 0) /
      Math.max(filteredEmployees.length, 1),
  );

  const totalProductiveSeconds = filteredEmployees.reduce(
    (total, employee) => total + getWorkSeconds(employee, now),
    0,
  );
  const averageProductiveSeconds = Math.round(
    totalProductiveSeconds / Math.max(filteredEmployees.length, 1),
  );
  const complianceReadiness = Math.round((9 / hrModules.length) * 100);

  const handleBreakToggle = (employeeId: string) => {
    setEmployees((currentEmployees) =>
      currentEmployees.map((employee) => {
        if (employee.id !== employeeId || !employee.shiftStart) {
          return employee;
        }

        if (employee.workState === "working") {
          return {
            ...employee,
            workState: "on_break",
            activeBreakStartedAt: new Date(),
            breakSessions: [
              ...employee.breakSessions,
              {
                start: new Date(),
                end: null,
              },
            ],
          };
        }

        if (employee.workState === "on_break") {
          return {
            ...employee,
            workState: "working",
            activeBreakStartedAt: null,
            breakSessions: employee.breakSessions.map((session, index) =>
              index === employee.breakSessions.length - 1 && session.end === null
                ? { ...session, end: new Date() }
                : session,
            ),
          };
        }

        return employee;
      }),
    );
  };

  const handleStartShift = (employeeId: string) => {
    setEmployees((currentEmployees) =>
      currentEmployees.map((employee) =>
        employee.id === employeeId
          ? {
              ...employee,
              workState: "working",
              shiftStart: new Date(),
              breakSessions: [],
              activeBreakStartedAt: null,
              lifecycleStage:
                employee.lifecycleStage === "Leave" ? "Active" : employee.lifecycleStage,
            }
          : employee,
      ),
    );
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-border/70 bg-card/90 shadow-sm">
        <div className="flex flex-col gap-6 p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Briefcase className="h-6 w-6" />
                </div>
                <Badge variant="secondary" className="shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium">
                  Blueprint-Driven HR Workspace
                </Badge>
                <Badge variant="outline" className="shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs">
                  Multi-tenant
                </Badge>
                <Badge variant="outline" className="shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs">
                  Compliance-ready
                </Badge>
                <Badge variant="outline" className="shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs">
                  White-label ready
                </Badge>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                  HR Management
                </h2>
                <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
                  Built directly from the HR solution blueprint: employee lifecycle, attendance,
                  leave, payroll, performance, recruitment, compliance, and self-service are
                  organized into one operations view. Break handling is live here, so employee work
                  time pauses during breaks and refreshes the active work clock correctly.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setActiveTab("lifecycle")}>
                <Users className="h-4 w-4" />
                Employee Lifecycle
              </Button>
              <Button type="button" variant="outline" onClick={() => setActiveTab("attendance")}>
                <Clock3 className="h-4 w-4" />
                Attendance Desk
              </Button>
              <Button type="button" onClick={() => setActiveTab("payroll")}>
                <Wallet className="h-4 w-4" />
                Payroll Engine
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-base-100/70 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs">
                {filteredEmployees.length} employees in scope
              </Badge>
              <Badge variant="outline" className="shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs">
                {workingCount} active now
              </Badge>
              <Badge variant="outline" className="shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs">
                {onBreakCount} on break
              </Badge>
              <Badge variant="outline" className="shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs">
                Search: {searchTerm.trim() ? `"${searchTerm.trim()}"` : "All records"}
              </Badge>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="min-w-[190px]">
                  <SelectValue placeholder="Filter department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departmentOptions
                    .filter((option) => option !== "all")
                    .map((department) => (
                      <SelectItem key={department} value={department}>
                        {department}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger className="min-w-[170px]">
                  <SelectValue placeholder="Filter region pack" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All region packs</SelectItem>
                  <SelectItem value="Bangladesh">Bangladesh</SelectItem>
                  <SelectItem value="India">India</SelectItem>
                  <SelectItem value="GCC">GCC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Headcount View"
          value={String(filteredEmployees.length)}
          subtitle="Filtered by current department and region scope."
          icon={Users}
        />
        <KpiCard
          title="Productive Time"
          value={formatDurationCompact(averageProductiveSeconds)}
          subtitle="Average tracked work time after break deduction."
          icon={Clock3}
        />
        <KpiCard
          title="Payroll Ready"
          value={`${payrollReadyCount}/${filteredEmployees.length || 1}`}
          subtitle="Employees clear for payroll and compliance handoff."
          icon={Wallet}
        />
        <KpiCard
          title="Compliance Score"
          value={`${complianceReadiness}%`}
          subtitle="Current coverage against the blueprint module plan."
          icon={ShieldCheck}
        />
      </section>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as HRTab)}>
        <TabsList className="flex w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lifecycle">Employee Lifecycle</TabsTrigger>
          <TabsTrigger value="attendance">Attendance & Time</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="talent">Talent Suite</TabsTrigger>
          <TabsTrigger value="compliance">Compliance & ESS</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-border/70 bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  Module Coverage
                </CardTitle>
                <CardDescription>
                  The 12-module HR suite defined in the blueprint is mapped here with the same
                  structure, standards, and commercial packaging direction.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {hrModules.map((module) => (
                  <div
                    key={module.name}
                    className="rounded-2xl border border-border/70 bg-base-100/80 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{module.name}</p>
                        <p className="text-xs text-muted-foreground">{module.standard}</p>
                      </div>
                      <Badge
                        className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] ${suiteToneClasses[module.suite]}`}
                      >
                        {module.suite}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{module.summary}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border-border/70 bg-card/90 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Architecture Alignment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-border/70 bg-base-100/80 p-4">
                    <p className="text-sm font-semibold text-foreground">Presentation Layer</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      The UI stays inside the current project’s component system and route model,
                      keeping the existing layout, DaisyUI classes, and workspace rhythm unchanged.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-base-100/80 p-4">
                    <p className="text-sm font-semibold text-foreground">Operations Coverage</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Employee data, attendance, leave, payroll, talent, compliance, and ESS are
                      presented as one modular HR surface instead of disconnected placeholders.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-base-100/80 p-4">
                    <p className="text-sm font-semibold text-foreground">Break-Aware Time Engine</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Active break sessions pause the work timer until resume. Productive work time
                      is recalculated live every second from shift start minus total break duration.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/90 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe2 className="h-5 w-5 text-primary" />
                    International Focus
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {payrollRegions.map((region) => (
                    <div
                      key={region.country}
                      className="rounded-2xl border border-border/70 bg-base-100/80 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-foreground">{region.country}</p>
                        <Badge variant="outline" className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px]">
                          Regional Pack
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{region.rules}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{region.exportFormat}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="lifecycle" className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
            <Card className="border-border/70 bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Employee Master Record
                </CardTitle>
                <CardDescription>
                  Hire-to-retire visibility for employee profile, department, manager, contract, and
                  lifecycle stage.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>Lifecycle</TableHead>
                      <TableHead>Contract</TableHead>
                      <TableHead>Region</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border border-border/70">
                              <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{employee.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {employee.code} · {employee.position}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{employee.department}</p>
                            <p className="text-xs text-muted-foreground">{employee.location}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-foreground">{employee.manager}</p>
                          <p className="text-xs text-muted-foreground">
                            {employee.directReports} direct reports
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] ${lifecycleToneClasses[employee.lifecycleStage]}`}
                          >
                            {employee.lifecycleStage}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <Badge
                              className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] ${contractToneClasses[employee.contractStatus]}`}
                            >
                              {employee.contractStatus}
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              Hired {formatDateLabel(employee.hireDate)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{employee.regionPack}</p>
                            <p className="text-xs text-muted-foreground">{employee.salaryBand}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border-border/70 bg-card/90 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Department Snapshot
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {departmentCounts.map(([department, count]) => (
                    <div
                      key={department}
                      className="flex items-center justify-between rounded-2xl border border-border/70 bg-base-100/80 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-foreground">{department}</p>
                        <p className="text-xs text-muted-foreground">Active people structure</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px]">
                        {count} employees
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/90 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Lifecycle Controls
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-border/70 bg-base-100/80 p-4">
                    <p className="text-sm font-semibold text-foreground">Onboarding</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Job code, department, grade, contract issuance, and policy acknowledgement.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-base-100/80 p-4">
                    <p className="text-sm font-semibold text-foreground">Transfer / Promotion</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Position changes, salary band movement, and manager history tracking.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-base-100/80 p-4">
                    <p className="text-sm font-semibold text-foreground">Offboarding Readiness</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Contract renewal watch, settlement handoff, and document completeness review.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="attendance" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Working Now"
              value={String(workingCount)}
              subtitle="Employees actively accumulating work time."
              icon={PlayCircle}
            />
            <KpiCard
              title="Break Sessions"
              value={String(onBreakCount)}
              subtitle="Employees currently paused on break."
              icon={PauseCircle}
            />
            <KpiCard
              title="Avg Productive"
              value={formatDurationCompact(averageProductiveSeconds)}
              subtitle="Net work time after break deductions."
              icon={Clock3}
            />
            <KpiCard
              title="OT Review"
              value={String(
                filteredEmployees.filter((employee) => employee.overtimeMinutes >= 30).length,
              )}
              subtitle="Employees nearing overtime review thresholds."
              icon={TrendingUp}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            <Card className="border-border/70 bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock3 className="h-5 w-5 text-primary" />
                  Live Time Board
                </CardTitle>
                <CardDescription>
                  Break and resume actions update work time in real time. During an active break,
                  productive work time stays paused and total break time keeps increasing.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Work Time</TableHead>
                      <TableHead>Break Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((employee) => {
                      const workSeconds = getWorkSeconds(employee, now);
                      const breakSeconds = getBreakSeconds(employee, now);
                      const progressValue = employee.shiftStart
                        ? Math.min((workSeconds / (employee.shiftHours * 3600)) * 100, 100)
                        : 0;

                      return (
                        <TableRow key={employee.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{employee.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {employee.department} · {employee.currentFocus}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{employee.attendanceMode}</p>
                              <p className="text-xs text-muted-foreground">{employee.location}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-2">
                              <p className="font-medium text-foreground">
                                {employee.shiftStart ? formatTimeLabel(employee.shiftStart) : "Not started"}
                              </p>
                              <Progress value={progressValue} className="h-2 bg-base-200" />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-semibold text-foreground">{formatDuration(workSeconds)}</p>
                              <p className="text-xs text-muted-foreground">
                                Target {employee.shiftHours}h shift
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{formatDuration(breakSeconds)}</p>
                              <p className="text-xs text-muted-foreground">
                                OT {employee.overtimeMinutes} min
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] capitalize ${workStateToneClasses[employee.workState]}`}
                            >
                              {employee.workState.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {employee.workState === "working" || employee.workState === "on_break" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant={employee.workState === "on_break" ? "default" : "outline"}
                                onClick={() => handleBreakToggle(employee.id)}
                              >
                                {employee.workState === "on_break" ? (
                                  <>
                                    <PlayCircle className="h-4 w-4" />
                                    Resume Work
                                  </>
                                ) : (
                                  <>
                                    <PauseCircle className="h-4 w-4" />
                                    Start Break
                                  </>
                                )}
                              </Button>
                            ) : employee.workState === "offline" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleStartShift(employee.id)}
                              >
                                <PlayCircle className="h-4 w-4" />
                                Start Shift
                              </Button>
                            ) : (
                              <Button type="button" size="sm" variant="ghost" disabled>
                                Leave Day
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border-border/70 bg-card/90 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Fingerprint className="h-5 w-5 text-primary" />
                    Time Engine Rules
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {workforceMoments.map((moment) => (
                    <div
                      key={moment}
                      className="rounded-2xl border border-border/70 bg-base-100/80 p-4"
                    >
                      <p className="text-sm text-muted-foreground">{moment}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/90 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Weekly Working Time
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {filteredEmployees.map((employee) => (
                    <div key={employee.id} className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{employee.name}</p>
                        <p className="text-xs text-muted-foreground">{employee.weeklyHours}h / week</p>
                      </div>
                      <Progress
                        value={Math.min((employee.weeklyHours / 48) * 100, 100)}
                        className="h-2 bg-base-200"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="leave" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {leavePolicies.map((policy) => (
              <Card key={policy.name} className="border-border/70 bg-card/90 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">{policy.name}</CardTitle>
                  <CardDescription>{policy.entitlement}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>Carryover: {policy.carryover}</p>
                  <p>Approval: {policy.approval}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-border/70 bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  Leave Requests
                </CardTitle>
                <CardDescription>
                  Policy-driven leave approvals with escalation, carryover, and statutory routing.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Approver</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeaveRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{request.employee}</p>
                            <p className="text-xs text-muted-foreground">{request.department}</p>
                          </div>
                        </TableCell>
                        <TableCell>{request.type}</TableCell>
                        <TableCell>{request.dateRange}</TableCell>
                        <TableCell>{request.days}</TableCell>
                        <TableCell>
                          <Badge
                            className={`rounded-full px-2.5 py-1 text-[11px] ${leaveStatusToneClasses[request.status]}`}
                          >
                            {request.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{request.approver}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Leave Engine Coverage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-border/70 bg-base-100/80 p-4">
                  <p className="text-sm font-semibold text-foreground">Accrual & Carryover</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Monthly and annual accrual logic with carryover caps and policy expiry windows.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-base-100/80 p-4">
                  <p className="text-sm font-semibold text-foreground">Approval Chains</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Manager, HR, and escalation routing for parental, emergency, and statutory cases.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-base-100/80 p-4">
                  <p className="text-sm font-semibold text-foreground">Calendar Awareness</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Designed for public holidays, team calendars, and workforce planning conflicts.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="payroll" className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              {filteredPayrollRuns.map((run) => (
                <Card key={run.id} className="border-border/70 bg-card/90 shadow-sm">
                  <CardContent className="grid gap-4 p-5 md:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-foreground">{run.period}</p>
                        <Badge
                          className={`rounded-full px-2.5 py-1 text-[11px] ${payrollToneClasses[run.status]}`}
                        >
                          {run.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {run.countryPack} statutory pack · {run.journalExport}
                      </p>
                      <p className="text-sm text-muted-foreground">Approver: {run.approver}</p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">Processed employees</span>
                        <span className="font-medium text-foreground">
                          {run.processedCount}/{run.totalEmployees}
                        </span>
                      </div>
                      <Progress
                        value={(run.processedCount / run.totalEmployees) * 100}
                        className="h-2 bg-base-200"
                      />
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">Gross run value</span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(run.totalCost)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Card className="border-border/70 bg-card/90 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" />
                    Salary Structure Mix
                  </CardTitle>
                  <CardDescription>
                    Typical component distribution aligned with salary structures, earnings, and
                    deductions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {salaryMix.map((item) => (
                    <div key={item.name} className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.value}%</p>
                      </div>
                      <Progress value={item.value} className="h-2 bg-base-200" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-border/70 bg-card/90 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    Payroll Pipeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    "Lock payroll period and freeze source data.",
                    "Aggregate attendance, leave, overtime, and salary structures.",
                    "Apply statutory deductions by regional tax pack.",
                    "Add adjustments, arrears, loans, and bonus entries.",
                    "Generate payslips and accounting-ready journal exports.",
                    "Distribute output through HR and ESS channels.",
                    "Archive run with approval and audit trace.",
                  ].map((step, index) => (
                    <div
                      key={step}
                      className="flex items-start gap-3 rounded-2xl border border-border/70 bg-base-100/80 p-4"
                    >
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {index + 1}
                      </div>
                      <p className="text-sm text-muted-foreground">{step}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/90 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe2 className="h-5 w-5 text-primary" />
                    Regional Payroll Packs
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {payrollRegions.map((region) => (
                    <div
                      key={region.country}
                      className="rounded-2xl border border-border/70 bg-base-100/80 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-foreground">{region.country}</p>
                        <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                          Supported
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{region.rules}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{region.exportFormat}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="talent" className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Card className="border-border/70 bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Performance Management
                </CardTitle>
                <CardDescription>
                  OKR, KPI, and 360-degree review coverage aligned with the blueprint.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {performanceHighlights.map((metric) => (
                  <div key={metric.label} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{metric.label}</p>
                      <p className="text-xs text-muted-foreground">{metric.value}%</p>
                    </div>
                    <Progress value={metric.value} className="h-2 bg-base-200" />
                  </div>
                ))}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-base-100/80 p-4">
                    <p className="text-sm font-semibold text-foreground">Calibration Tool</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Bell-curve review support and promotion-readiness calibration.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-base-100/80 p-4">
                    <p className="text-sm font-semibold text-foreground">PIP Workflow</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Improvement plan documentation and legal-review checkpoints.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  Recruitment Pipeline
                </CardTitle>
                <CardDescription>
                  ATS workflow from requisition approval to onboarding handoff.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {recruitmentPipeline.map((item) => (
                    <div
                      key={item.stage}
                      className="rounded-2xl border border-border/70 bg-base-100/80 p-4 text-center"
                    >
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {item.stage}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{item.count}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-base-100/80 p-4">
                    <p className="text-sm font-semibold text-foreground">Structured Interviews</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Scorecards, calibrated ratings, and approval steps before offer release.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-base-100/80 p-4">
                    <p className="text-sm font-semibold text-foreground">Offer & Onboarding</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Candidate consent, offer generation, and direct handoff into employee lifecycle.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/70 bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  Learning & Development
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>16 active learning tracks across compliance, leadership, and onboarding.</p>
                <p>Certification trackers prepared for role-based and recurring training.</p>
                <p>Skill matrix coverage supports promotion and workforce planning.</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  Benefits & Compensation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Salary bands, benefits reserve, and region-aware compensation governance.</p>
                <p>Insurance, loans, and flexi-benefit allocation can plug into payroll runs.</p>
                <p>Compensation review stays linked to performance and approval workflows.</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Document Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Offer letters, policy packs, contracts, and acknowledgements in one workspace.</p>
                <p>Expiry monitoring and e-sign flow are represented for governance readiness.</p>
                <p>Document access is structured to fit employee, manager, and HR roles.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Card className="border-border/70 bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Compliance Engine
                </CardTitle>
                <CardDescription>
                  Regulatory, privacy, and audit controls reflected from the blueprint.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {complianceHighlights.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-border/70 bg-base-100/80 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.standard}</p>
                      </div>
                      <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                        Ready
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Analytics & ISO 30414
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analyticsHighlights.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border/70 bg-base-100/80 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-foreground">{item.label}</p>
                      <p className="text-lg font-semibold text-foreground">{item.value}</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <Card className="border-border/70 bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe2 className="h-5 w-5 text-primary" />
                  Employee Self-Service
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {essFeatures.map((feature) => (
                  <div
                    key={feature}
                    className="rounded-2xl border border-border/70 bg-base-100/80 p-4"
                  >
                    <p className="text-sm text-muted-foreground">{feature}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Workforce Governance Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-base-100/80 p-4">
                  <p className="text-sm font-semibold text-foreground">Tenant Isolation</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Designed around multi-tenant HR operations with scoped access and role-based views.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-base-100/80 p-4">
                  <p className="text-sm font-semibold text-foreground">Immutable Audit Trail</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Payroll, employee updates, leave approvals, and policy changes are auditable.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-base-100/80 p-4">
                  <p className="text-sm font-semibold text-foreground">Region-Specific Packs</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Payroll and labor-law behavior can be packaged by geography without changing the UI shell.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-base-100/80 p-4">
                  <p className="text-sm font-semibold text-foreground">Manager Visibility</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Direct-report visibility, approval chains, and review workflows stay consistent across modules.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <section className="rounded-[28px] border border-border/70 bg-card/90 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Current HR pulse</p>
            <p className="text-sm text-muted-foreground">
              {workingCount} employees are working, {onBreakCount} are on break, {leaveCount} are on
              leave, and the filtered workforce average performance score is {averagePerformance}%.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
              {formatDateLabel(now)}
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
              Live clock {formatTimeLabel(now)}
            </Badge>
          </div>
        </div>
      </section>
    </div>
  );
}
