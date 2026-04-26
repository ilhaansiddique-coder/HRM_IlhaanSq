import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { resolveDatabaseUrl } from "../lib/server-env";

const { connectionString } = resolveDatabaseUrl();

if (!connectionString) {
  throw new Error(
    "Database is not configured. Set DATABASE_URL, PLATFORM_DATABASE_POOLER_URL, PLATFORM_DATABASE_URL, or SUPABASE_DB_URL."
  );
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

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
      invoicePrefix: "INV",
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

  // Create a default payment method
  await prisma.paymentMethod.create({
    data: {
      tenantId: tenant.id,
      name: "Cash",
      isActive: true,
    },
  });

  console.log("Created default settings and payment method");

  // Create sample products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: "T-Shirt Basic",
        sku: "TSH-001",
        rate: 450,
        cost: 250,
        stockQuantity: 100,
        createdBy: admin.id,
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: "Premium Polo",
        sku: "POL-001",
        rate: 850,
        cost: 500,
        stockQuantity: 50,
        hasVariants: true,
        createdBy: admin.id,
        variants: {
          create: [
            { sku: "POL-001-S", attributes: { size: "S" }, rate: 850, cost: 500, stockQuantity: 15 },
            { sku: "POL-001-M", attributes: { size: "M" }, rate: 850, cost: 500, stockQuantity: 20 },
            { sku: "POL-001-L", attributes: { size: "L" }, rate: 850, cost: 500, stockQuantity: 15 },
          ],
        },
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: "Cotton Panjabi",
        sku: "PAN-001",
        rate: 1200,
        cost: 700,
        stockQuantity: 30,
        createdBy: admin.id,
      },
    }),
  ]);

  console.log(`Created ${products.length} sample products`);

  // Create sample customer
  const customer = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      name: "Rahim Ahmed",
      phone: "01712345678",
      email: "rahim@example.com",
      address: "123 Dhanmondi, Dhaka",
      status: "active",
      createdBy: admin.id,
    },
  });

  console.log(`Created sample customer: ${customer.name}`);

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
