import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const DATABASE_URL = "postgresql://postgres.alhntgyjagjiobqzflqc:WDVHjyLeQrHV7Dd1%2A@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});

async function setupDatabase() {
  try {
    console.log("🔄 Testing Supabase connection...");
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Connected to Supabase successfully!");

    console.log("\n🔄 Checking for existing super admin user...");
    const existingUser = await prisma.user.findUnique({
      where: { email: "elsiddique@gmail.com" }
    }).catch(() => null);

    if (existingUser) {
      console.log("✅ Super admin user already exists!");
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Name: ${existingUser.fullName}`);
    } else {
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

      console.log("✅ Super admin user created!");

      console.log("\n🔄 Creating workspace...");
      const tenant = await prisma.tenant.create({
        data: {
          slug: "hrmilhaansq",
          name: "HRM SaaS",
          isActive: true,
          plan: "starter",
          createdBy: user.id
        }
      });

      await prisma.tenantMember.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: "owner",
          isDefault: true,
          isActive: true
        }
      });

      await prisma.businessSettings.create({
        data: {
          tenantId: tenant.id,
          businessName: "HRM SaaS",
          createdBy: user.id
        }
      });

      await prisma.systemSettings.create({
        data: {
          tenantId: tenant.id
        }
      });

      console.log("✅ Workspace created!");
    }

    console.log("\n" + "=".repeat(70));
    console.log("✅✅✅ DATABASE SETUP COMPLETE! ✅✅✅");
    console.log("=".repeat(70));

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupDatabase();
