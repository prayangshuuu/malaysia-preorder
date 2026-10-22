import 'dotenv/config';
import { prisma, pool } from '../lib/prisma';
import { hashPassword } from '../lib/auth/password';
import { UserRole } from '@prisma/client';

/**
 * Provision First Administrator Script
 * Usage:
 *   ADMIN_EMAIL="admin@yourcompany.com" ADMIN_PASSWORD="SecurePassword123!" tsx scripts/provision-admin.ts
 */
async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Platform Administrator';
  const phone = process.env.ADMIN_PHONE || '+8801800000000';

  if (!email || !password) {
    console.error('❌ Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.');
    console.error('Usage: ADMIN_EMAIL="..." ADMIN_PASSWORD="..." npx tsx scripts/provision-admin.ts');
    process.exit(1);
  }

  if (password.length < 10) {
    console.error('❌ Error: Admin password must be at least 10 characters.');
    process.exit(1);
  }

  console.log(`🔒 Provisioning Superadmin user: ${email}...`);

  const passwordHash = await hashPassword(password);

  const admin = await prisma.user.upsert({
    where: { email: email.toLowerCase().trim() },
    create: {
      email: email.toLowerCase().trim(),
      name,
      phone,
      passwordHash,
      role: UserRole.ADMIN,
      emailVerified: new Date(),
    },
    update: {
      role: UserRole.ADMIN,
      passwordHash,
      name,
      emailVerified: new Date(),
    },
  });

  // Ensure Wallet Account exists for the administrator
  await prisma.walletAccount.upsert({
    where: { userId: admin.id },
    create: {
      userId: admin.id,
      currency: 'BDT',
      isActive: true,
    },
    update: {},
  });

  console.log(`✅ Super Administrator successfully provisioned (ID: ${admin.id}, Role: ${admin.role})`);
}

main()
  .catch((err) => {
    console.error('❌ Failed to provision admin:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
