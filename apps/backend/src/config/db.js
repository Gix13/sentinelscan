import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function connectDB() {
  try {
    // Test connection
    await prisma.$queryRaw`SELECT 1`;
    console.log("✓ Database (SQLite) connected successfully");
    return prisma;
  } catch (err) {
    console.error("✗ Database connection failed:", err.message);
    process.exit(1);
  }
}

export async function disconnectDB() {
  await prisma.$disconnect();
}

export { prisma };
