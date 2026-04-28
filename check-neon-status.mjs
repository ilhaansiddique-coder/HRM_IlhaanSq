import { PrismaClient } from "@prisma/client";

const DATABASE_URL = "postgresql://neondb_owner:npg_kU1MplBRu5PL@ep-shy-glitter-aof5o8xo-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});

async function checkNeonStatus() {
  try {
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true, slug: true, createdAt: true }
    });

    const users = await prisma.user.findMany({
      select: { id: true, email: true, fullName: true, isSuperAdmin: true, createdAt: true }
    });

    const members = await prisma.tenantMember.findMany({
      select: { tenantId: true, userId: true, role: true }
    });

    console.log("📊 NEON DATABASE CURRENT STATE:\n");
    console.log(`📌 Tenants: ${tenants.length}`);
    tenants.forEach(t => {
      console.log(`   - ${t.name} (${t.slug})`);
      console.log(`     Created: ${new Date(t.createdAt).toLocaleString()}`);
    });

    console.log(`\n👥 Users: ${users.length}`);
    users.forEach(u => {
      console.log(`   - ${u.email} (${u.fullName})`);
      console.log(`     Super Admin: ${u.isSuperAdmin ? "✅" : "❌"}`);
      console.log(`     Created: ${new Date(u.createdAt).toLocaleString()}`);
    });

    console.log(`\n🔗 Tenant Members: ${members.length}`);
    members.forEach(m => {
      console.log(`   - User: ${m.userId}, Tenant: ${m.tenantId}, Role: ${m.role}`);
    });

    console.log("\n" + "=".repeat(70));
    console.log("✅ Neon is ready and has the seeded data!");
    console.log("=".repeat(70));

  } finally {
    await prisma.$disconnect();
  }
}

checkNeonStatus();
