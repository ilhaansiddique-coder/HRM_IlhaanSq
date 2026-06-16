import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Connect to production Supabase database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.alhntgyjagjiobqzflqc:ilhaan464966siddique%2A@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres"
    }
  }
});

async function migrateAndSeed() {
  try {
    console.log("🔄 Connecting to Supabase production database...");
    
    // Test connection
    await prisma.$queryRaw`SELECT 1`;
    console.log("✓ Connected to Supabase!");

    // Check if super admin already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: "elsiddique@gmail.com" }
    });

    if (existingUser) {
      console.log("✓ Super admin user already exists!");
      return;
    }

    // Create super admin user
    console.log("🔄 Creating super admin user...");
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("12345678", salt);

    const user = await prisma.user.create({
      data: {
        email: "elsiddique@gmail.com",
        passwordHash: passwordHash,
        fullName: "El Siddique",
        isSuperAdmin: true,
        emailVerified: true
      }
    });
    console.log("✓ Super admin user created!");

    // Create workspace
    console.log("🔄 Creating workspace...");
    const tenant = await prisma.tenant.create({
      data: {
        slug: "hrmilhaansq",
        name: "HRM SaaS",
        isActive: true,
        plan: "starter",
        createdBy: user.id
      }
    });

    // Add user as owner
    await prisma.tenantMember.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        role: "owner",
        isDefault: true,
        isActive: true
      }
    });

    // Create business settings
    await prisma.businessSettings.create({
      data: {
        tenantId: tenant.id,
        businessName: "HRM SaaS",
        createdBy: user.id
      }
    });

    // Create system settings
    await prisma.systemSettings.create({
      data: {
        tenantId: tenant.id
      }
    });

    console.log("\n✅ Database migration and seeding complete!");
    console.log(`\n📋 Login Credentials:\n   Email: elsiddique@gmail.com\n   Password: 12345678`);
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateAndSeed();
