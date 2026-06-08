import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Reset database tables
  await prisma.purchaseOrder.deleteMany({});
  await prisma.quotation.deleteMany({});
  await prisma.rfq.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.vendor.deleteMany({});

  const passwordHash = await bcrypt.hash('password123', 10);

  // Create Admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@vendorbridge.com',
      password: passwordHash,
      name: 'System Admin',
      role: 'ADMIN',
    },
  });

  // Create Procurement Manager
  const procurement = await prisma.user.create({
    data: {
      email: 'procurement@vendorbridge.com',
      password: passwordHash,
      name: 'Procurement Manager',
      role: 'PROCUREMENT_MANAGER',
    },
  });

  // Create Vendor Company
  const vendor = await prisma.vendor.create({
    data: {
      name: 'Acme Supplies Group',
      email: 'contact@acmesupplies.com',
      phone: '+15550199',
      address: '100 Acme Way, Industrial Zone, TX',
      registrationNumber: 'REG-884920-X',
      status: 'APPROVED',
    },
  });

  // Create Vendor User linked to Vendor
  const vendorUser = await prisma.user.create({
    data: {
      email: 'sales@acmesupplies.com',
      password: passwordHash,
      name: 'Alice Johnson',
      role: 'SUPPLIER',
      vendorId: vendor.id,
    },
  });

  console.log('Seeding completed successfully:');
  console.log({
    admin: admin.email,
    procurement: procurement.email,
    vendorUser: vendorUser.email,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });