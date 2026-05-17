// READ-ONLY. No writes.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const TENANT = "1f40f470-8124-46f5-88f4-9dbe6873f1e8";
(async () => {
  const cols = await prisma.payrollCustomColumn.findMany({
    where: { tenantId: TENANT },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  console.log("custom columns:", cols.length);
  for (const c of cols)
    console.log(JSON.stringify({
      id: c.id.slice(0, 8), name: c.name, short: c.shortLabel,
      group: c.group, manual: c.manual,
      operation: c.operation, sourceField: c.sourceField,
      formula: c.formula, sortOrder: c.sortOrder,
    }));
  // Any per-employee manual values stored?
  const vals = await prisma.payslipCustomValue.findMany({
    where: { column: { tenantId: TENANT } },
    select: { columnId: true, value: true, payslipId: true },
  });
  console.log("\npayslipCustomValue rows:", vals.length);
  for (const v of vals)
    console.log(`  col=${v.columnId.slice(0,8)} payslip=${v.payslipId.slice(0,8)} value=${v.value}`);
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
