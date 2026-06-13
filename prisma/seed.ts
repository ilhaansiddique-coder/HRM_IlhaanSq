import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { resolveDatabaseUrl } from "../lib/server-env";

const { connectionString } = resolveDatabaseUrl();

if (!connectionString) {
  throw new Error(
    "Database is not configured. Set DATABASE_URL, PLATFORM_DATABASE_POOLER_URL, PLATFORM_DATABASE_URL, or SUPABASE_DB_URL."
  );
}

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create super admin user
  const passwordHash = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@rahedeen.com" },
    update: {},
    create: {
      email: "admin@rahedeen.com",
      passwordHash,
      fullName: "Super Admin",
      emailVerified: true,
    },
  });

  console.log(`Created admin user: ${admin.email}`);

  // Create a demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      slug: "demo",
      name: "Demo Business",
      createdBy: admin.id,
    },
  });

  console.log(`Created tenant: ${tenant.name} (${tenant.slug})`);

  // Add admin as owner of the tenant
  await prisma.tenantMember.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: admin.id,
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: admin.id,
      role: "owner",
      isDefault: true,
    },
  });

  console.log("Added admin as tenant owner");

  // Create business settings
  await prisma.businessSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      businessName: "Demo Business",
    },
  });

  // Create system settings
  await prisma.systemSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      currencySymbol: "৳",
      currencyCode: "BDT",
      timezone: "Asia/Dhaka",
    },
  });

  console.log("Created default settings");

  // RaheDeen standard salary structure (terms of payment from the company sheet)
  const STRUCTURE_NAME = "Standard Monthly Salary (RaheDeen)";
  const existingStructure = await prisma.salaryStructure.findFirst({
    where: { tenantId: tenant.id, name: STRUCTURE_NAME },
  });
  if (!existingStructure) {
    await prisma.salaryStructure.create({
      data: {
        tenantId: tenant.id,
        name: STRUCTURE_NAME,
        description:
          "Basic + House Rent + Health + Education + Savings = Gross. D.H. Expenses paid on top. Advance & absence deducted on payroll run.",
        components: {
          create: [
            { name: "House Rent", code: "HRENT", type: "earning", calculationType: "fixed", value: 500, sortOrder: 10 },
            { name: "Health Allowance", code: "HEALTH", type: "earning", calculationType: "fixed", value: 300, sortOrder: 20 },
            { name: "Education Allowance", code: "EDU", type: "earning", calculationType: "fixed", value: 200, sortOrder: 30 },
            { name: "Savings", code: "SAV", type: "earning", calculationType: "fixed", value: 1000, sortOrder: 40 },
            { name: "D.H. Expenses", code: "DHEXP", type: "reimbursement", calculationType: "fixed", value: 1200, sortOrder: 50 },
          ],
        },
      },
    });
    console.log(`Created salary structure: ${STRUCTURE_NAME}`);
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
