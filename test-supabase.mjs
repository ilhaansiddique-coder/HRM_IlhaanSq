import { PrismaClient } from "@prisma/client";

// Try the direct connection (not pooler)
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:ilhaan464966siddique%2A@db.alhntgyjagjiobqzflqc.supabase.co:5432/postgres?sslmode=require"
    }
  }
});

async function testConnection() {
  try {
    console.log("🔄 Testing Supabase connection...");
    await prisma.$queryRaw`SELECT 1`;
    console.log("✓ Connected successfully!");
  } catch (error) {
    console.error("❌ Connection failed:", error.message);
    console.log("\n💡 The Supabase credentials appear to be invalid.");
    console.log("\nPlease check:");
    console.log("1. Go to: https://app.supabase.com/projects");
    console.log("2. Find project: alhntgyjagjiobqzflqc");
    console.log("3. Go to Settings > Database > Connection string");
    console.log("4. Copy the full connection string");
    console.log("5. Share it with me");
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
