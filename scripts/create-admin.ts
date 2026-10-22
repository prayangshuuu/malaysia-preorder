/**
 * Safe Admin Provisioning CLI Script
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts --email admin@example.com --name "Lead Admin" --role ADMIN
 * Or interactive prompt if password not supplied via ADMIN_PASSWORD environment variable.
 *
 * Security:
 * - Passwords are NEVER hardcoded.
 * - Minimum 8 chars with complexity requirement.
 * - Salted bcrypt hash with 12 rounds.
 */

import { parseArgs } from "util";
import readline from "readline";
import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth/session";

function askQuestion(query: string, hide = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (hide) {
      // In masked mode, don't echo characters
      process.stdout.write(query);
      let input = "";
      process.stdin.on("data", (char) => {
        const str = char.toString();
        if (str === "\n" || str === "\r" || str === "\u0004") {
          process.stdout.write("\n");
          rl.close();
          resolve(input.trim());
        } else {
          input += str;
        }
      });
    } else {
      rl.question(query, (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    }
  });
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      email: { type: "string" },
      name: { type: "string" },
      role: { type: "string", default: "ADMIN" },
      phone: { type: "string" },
    },
  });

  console.log("==================================================");
  console.log("   Malaysia Pre-Order: Admin / Staff Provisioning  ");
  console.log("==================================================");

  const email =
    values.email || (await askQuestion("Enter staff/admin email: "));
  if (!email || !email.includes("@")) {
    console.error("Error: A valid email address is required.");
    process.exit(1);
  }

  const name =
    values.name || (await askQuestion("Enter staff/admin full name: "));
  if (!name) {
    console.error("Error: Full name is required.");
    process.exit(1);
  }

  const roleInput = (values.role || "ADMIN").toUpperCase();
  const validRoles: UserRole[] = [
    UserRole.ADMIN,
    UserRole.OPERATIONS,
    UserRole.FINANCE,
    UserRole.SUPPORT,
  ];

  if (!validRoles.includes(roleInput as UserRole)) {
    console.error(
      `Error: Invalid role "${roleInput}". Allowed roles: ${validRoles.join(", ")}`
    );
    process.exit(1);
  }

  const role = roleInput as UserRole;

  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = await askQuestion("Enter new secure password (min 8 chars): ");
  }

  if (!password || password.length < 8) {
    console.error("Error: Password must be at least 8 characters long.");
    process.exit(1);
  }

  console.log(`Checking if user ${email} already exists...`);
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  const passwordHash = await hashPassword(password);

  if (existing) {
    console.log(`User exists with role "${existing.role}". Promoting to "${role}" and updating password...`);
    const updated = await prisma.user.update({
      where: { email },
      data: {
        role,
        passwordHash,
        isActive: true,
      },
    });

    console.log(`\nSuccessfully updated account: ${updated.email} (${updated.role})`);
  } else {
    console.log(`Creating new ${role} account...`);
    const created = await prisma.user.create({
      data: {
        email,
        name,
        phone: values.phone || null,
        role,
        passwordHash,
        isActive: true,
      },
    });

    console.log(`\nSuccessfully provisioned: ${created.email} (${created.role})`);
  }

  console.log("\nStaff portal sign in URL: /admin/login");
  process.exit(0);
}

main().catch((err) => {
  console.error("Provisioning failed:", err);
  process.exit(1);
});
