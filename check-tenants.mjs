import { PrismaClient } from "@prisma/client";

const DATABASE_URL = "postgresql://neondb_owner:npg_kU1MplBRu5PL@ep-shy-glitter-aof5o8xo-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});

async function checkTenants() {
  try {
    console.log("🔍 Checking tenants in Neon database...\n");

    // Get all tenants
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        isActive: true,
        plan: true,
        createdAt: true
      }
    });

    console.log(`📊 Total Tenants: ${tenants.length}\n`);

    if (tenants.length === 0) {
      console.log("❌ No tenants found");
    } else {
      tenants.forEach((tenant, index) => {
        console.log(`${index + 1}. ${tenant.name}`);
        console.log(`   ID: ${tenant.id}`);
        console.log(`   Slug: ${tenant.slug}`);
        console.log(`   Plan: ${tenant.plan}`);
        console.log(`   Active: ${tenant.isActive ? "✅ Yes" : "❌ No"}`);
        console.log(`   Created: ${new Date(tenant.createdAt).toLocaleDateString()}\n`);
      });
    }

    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        isSuperAdmin: true,
        createdAt: true
      }
    });

    console.log(`\n👥 Total Users: ${users.length}\n`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.fullName}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Super Admin: ${user.isSuperAdmin ? "✅ Yes" : "❌ No"}`);
      console.log(`   Created: ${new Date(user.createdAt).toLocaleDateString()}\n`);
    });

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTenants();
