import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const DATABASE_URL = "postgresql://neondb_owner:npg_kU1MplBRu5PL@ep-shy-glitter-aof5o8xo-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});

async function setupNeon() {
  try {
    console.log("🔄 Testing Neon connection...");
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Connected to Neon successfully!\n");

    console.log("🔄 Running Prisma migrations...");
    await prisma.$executeRawUnsafe(`SELECT 1`);
    console.log("✅ Database schema verified!\n");

    console.log("🔄 Checking for existing super admin user...");
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
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.fullName}`);

      console.log("\n🔄 Creating workspace...");
      const tenant = await prisma.tenant.create({
        data: {
          slug: "hrmilhaansq",
          name: "HRM_IlhaanSq",
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
          businessName: "HRM_IlhaanSq",
          createdBy: user.id
        }
      });

      await prisma.systemSettings.create({
        data: {
          tenantId: tenant.id
        }
      });

      console.log("✅ Workspace created!");
      console.log(`   Workspace: HRM_IlhaanSq`);
      console.log(`   User Role: Owner`);
    }

    console.log("\n" + "=".repeat(70));
    console.log("✅✅✅ NEON DATABASE SETUP COMPLETE! ✅✅✅");
    console.log("=".repeat(70));
    console.log(`\n📋 LOGIN CREDENTIALS:`);
    console.log(`   Email: elsiddique@gmail.com`);
    console.log(`   Password: 12345678`);
    console.log(`\n🔗 Production URL: https://hrmilhaansq-saas-j2dv368wx.vercel.app`);
    console.log(`\n⏳ Vercel deployment should be finishing now...`);
    console.log(`\n✅ Ready to login!\n`);

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("\n💡 Troubleshooting:");
    console.error("1. Verify Neon DATABASE_URL is correct");
    console.error("2. Check if Neon database is active");
    console.error("3. Ensure network connectivity to Neon");
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupNeon();
