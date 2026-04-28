import { PrismaClient } from "@prisma/client";

const DATABASE_URL = "postgresql://neondb_owner:npg_kU1MplBRu5PL@ep-shy-glitter-aof5o8xo-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});

async function checkUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: "proxadbd@gmail.com" },
      select: { id: true, email: true, fullName: true, createdAt: true }
    });

    if (user) {
      console.log("✅ User EXISTS in Neon:");
      console.log(`   Email: ${user.email}`);
      console.log(`   Created: ${new Date(user.createdAt).toISOString()}`);
    } else {
      console.log("❌ User NOT FOUND in Neon");
      console.log("\n💡 This means the signup was created on a different database!");
      console.log("   Vercel might not be using the Neon DATABASE_URL yet.\n");
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
