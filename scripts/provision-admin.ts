import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../lib/auth/session";
import readline from "readline";

async function main() {
  const email = process.argv[2] || process.env.INITIAL_ADMIN_EMAIL;
  let password = process.argv[3] || process.env.INITIAL_ADMIN_PASSWORD;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  const targetEmail = (email || (await question("Enter admin email address: "))).trim().toLowerCase();
  if (!targetEmail || !targetEmail.includes("@")) {
    console.error("❌ A valid email address is required.");
    rl.close();
    process.exit(1);
  }

  if (!password) {
    password = await question("Enter admin password (min 8 characters): ");
  }
  rl.close();

  if (!password || password.length < 8) {
    console.error("❌ Admin password must be at least 8 characters.");
    process.exit(1);
  }

  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://prayangshuuu@localhost:5432/malaysia_preorder?schema=public";
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const existing = await prisma.user.findUnique({
      where: { email: targetEmail },
    });

    const passwordHash = await hashPassword(password);

    if (existing) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: UserRole.ADMIN,
          passwordHash,
          isActive: true,
        },
      });
      console.log(`✅ Existing user ${updated.email} promoted to ADMIN successfully!`);
    } else {
      const created = await prisma.user.create({
        data: {
          name: "System Administrator",
          email: targetEmail,
          role: UserRole.ADMIN,
          passwordHash,
          isActive: true,
          profile: {
            create: {},
          },
          walletAccount: {
            create: {},
          },
        },
      });
      console.log(`✅ Successfully provisioned initial ADMIN: ${created.email} (ID: ${created.id})`);
    }
  } catch (error) {
    console.error("❌ Provisioning failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
