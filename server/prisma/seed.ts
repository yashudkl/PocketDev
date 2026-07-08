import { PrismaClient, Tier } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Seeds two demo accounts matching the "Definition of Done":
 *  - free@pocketdev.dev  (FREE tier — shares the queue)
 *  - paid@pocketdev.dev  (PAID tier — instant execution)
 * Both use the password: password123
 */
async function main(): Promise<void> {
  const password = await hash('password123', 10);

  const free = await prisma.user.upsert({
    where: { email: 'free@pocketdev.dev' },
    update: {},
    create: {
      email: 'free@pocketdev.dev',
      passwordHash: password,
      name: 'Free Demo',
      tier: Tier.FREE,
      subscription: { create: { tier: Tier.FREE, quotaJobsPerDay: 50 } },
      projects: { create: { name: 'Hello World', slug: 'hello-world' } },
    },
  });

  const paid = await prisma.user.upsert({
    where: { email: 'paid@pocketdev.dev' },
    update: {},
    create: {
      email: 'paid@pocketdev.dev',
      passwordHash: password,
      name: 'Paid Demo',
      tier: Tier.PAID,
      subscription: { create: { tier: Tier.PAID, quotaJobsPerDay: 1000 } },
      projects: { create: { name: 'Sandbox', slug: 'sandbox' } },
    },
  });

  console.log('Seeded:', { free: free.email, paid: paid.email });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
