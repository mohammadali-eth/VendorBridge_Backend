import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Reset database tables in order of dependency
  await prisma.vendorSelection.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.quotation.deleteMany({});
  await prisma.rfq.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.vendor.deleteMany({});

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create System Admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@vendorbridge.com',
      password: passwordHash,
      name: 'System Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  // 2. Create Procurement Manager
  const procurement = await prisma.user.create({
    data: {
      email: 'procurement@vendorbridge.com',
      password: passwordHash,
      name: 'Procurement Manager',
      role: 'PROCUREMENT_MANAGER',
      status: 'ACTIVE',
    },
  });

  // 2b. Create Manager / Approver (from User Management UI)
  const managerApprover = await prisma.user.create({
    data: {
      email: 'manager@vendorbridge.com',
      password: passwordHash,
      name: 'Manager / Approver',
      role: 'PROCUREMENT_MANAGER',
      status: 'ACTIVE',
    },
  });

  // 3. Create Buyer Agent
  const buyer = await prisma.user.create({
    data: {
      email: 'buyer@vendorbridge.com',
      password: passwordHash,
      name: 'Buyer Agent',
      role: 'BUYER',
      status: 'ACTIVE',
    },
  });

  // 3b. Create Procurement Officer (from User Management UI)
  const officer = await prisma.user.create({
    data: {
      email: 'officer@vendorbridge.com',
      password: passwordHash,
      name: 'Procurement Officer',
      role: 'BUYER',
      status: 'ACTIVE',
    },
  });

  // 3c. Create Inactive Tester (from User Management UI)
  await prisma.user.create({
    data: {
      email: 'inactive@vendorbridge.com',
      password: passwordHash,
      name: 'Inactive Tester',
      role: 'BUYER',
      status: 'INACTIVE',
    },
  });

  // 4. Create Vendor 1: Acme Supplies Group
  const acme = await prisma.vendor.create({
    data: {
      name: 'Acme Supplies Group',
      email: 'contact@acmesupplies.com',
      phone: '+15550199',
      address: '100 Acme Way, Industrial Zone, TX',
      registrationNumber: 'REG-884920-X',
      status: 'APPROVED',
    },
  });

  // Create User for Acme
  const acmeUser = await prisma.user.create({
    data: {
      email: 'sales@acmesupplies.com',
      password: passwordHash,
      name: 'Alice Johnson',
      role: 'SUPPLIER',
      vendorId: acme.id,
      status: 'ACTIVE',
    },
  });

  // 5. Create Vendor 2: TechParts Corp
  const techparts = await prisma.vendor.create({
    data: {
      name: 'TechParts Corp',
      email: 'sales@techparts.com',
      phone: '+15550144',
      address: '404 Silicon Boulevard, Tech District, CA',
      registrationNumber: 'REG-331049-T',
      status: 'APPROVED',
    },
  });

  // Create User for TechParts
  const techpartsUser = await prisma.user.create({
    data: {
      email: 'sales@techparts.com',
      password: passwordHash,
      name: 'Bob Miller',
      role: 'SUPPLIER',
      vendorId: techparts.id,
      status: 'ACTIVE',
    },
  });

  // 6. Create Vendor 3: Global Office Co (Global Steel Ltd in UI)
  const officeco = await prisma.vendor.create({
    data: {
      name: 'Global Steel Ltd',
      email: 'supplier@vendorbridge.com',
      phone: '+15550177',
      address: '77 Stationery Road, Logistics Park, IL',
      registrationNumber: 'REG-556102-G',
      status: 'APPROVED',
    },
  });

  // Create User for Global Steel Ltd
  const officecoUser = await prisma.user.create({
    data: {
      email: 'supplier@vendorbridge.com',
      password: passwordHash,
      name: 'Global Steel Ltd (Vendor)',
      role: 'SUPPLIER',
      vendorId: officeco.id,
      status: 'ACTIVE',
    },
  });

  // 7. Create RFQs (created by Procurement Manager or Buyer)
  // Current Month RFQs (June)
  const rfq1 = await prisma.rfq.create({
    data: {
      title: 'Laptop Procurement 2026',
      description: 'Procurement of 50 enterprise-grade laptops for engineering team. Needs 32GB RAM, 1TB SSD.',
      category: 'IT Hardware',
      deadline: new Date('2026-06-30T18:30:00.000Z'),
      status: 'PUBLISHED',
      createdById: procurement.id,
      assignedVendorIds: [techparts.id, acme.id],
    },
  });

  const rfq2 = await prisma.rfq.create({
    data: {
      title: 'Office Stationery Supply',
      description: 'Annual contract for supply of custom notebooks, pens, markers, and print paper.',
      category: 'Office Supplies',
      deadline: new Date('2026-06-25T18:30:00.000Z'),
      status: 'PUBLISHED',
      createdById: procurement.id,
      assignedVendorIds: [acme.id, officeco.id],
    },
  });

  const rfq3 = await prisma.rfq.create({
    data: {
      title: 'High-Speed Server Infrastructure',
      description: 'Hosting infrastructure renewal. Querying quotes for 5 dedicated GPU instances.',
      category: 'IT Infrastructure',
      deadline: new Date('2026-07-15T18:30:00.000Z'),
      status: 'PUBLISHED',
      createdById: buyer.id,
      assignedVendorIds: [techparts.id, officeco.id],
    },
  });

  const rfq4 = await prisma.rfq.create({
    data: {
      title: 'Logistics and Shipping Services',
      description: 'Request for quotes for freight forwarders and local courier delivery services.',
      category: 'Services',
      deadline: new Date('2026-07-20T18:30:00.000Z'),
      status: 'DRAFT',
      createdById: procurement.id,
      assignedVendorIds: [acme.id],
    },
  });

  // Historical RFQs
  const rfqJan = await prisma.rfq.create({
    data: {
      title: 'Office Paper Bulk',
      description: 'Bulk paper supply for Q1.',
      category: 'Office Supplies',
      deadline: new Date('2026-01-25T10:00:00Z'),
      status: 'PUBLISHED',
      createdById: procurement.id,
      createdAt: new Date('2026-01-05T10:00:00Z'),
    },
  });

  const rfqFeb = await prisma.rfq.create({
    data: {
      title: 'Facility Security Services',
      description: 'Security team services contract.',
      category: 'Services',
      deadline: new Date('2026-02-25T10:00:00Z'),
      status: 'PUBLISHED',
      createdById: procurement.id,
      createdAt: new Date('2026-02-05T10:00:00Z'),
    },
  });

  const rfqMar = await prisma.rfq.create({
    data: {
      title: 'Promotional Merchandise',
      description: 'Branded T-shirts and mugs.',
      category: 'Others',
      deadline: new Date('2026-03-25T10:00:00Z'),
      status: 'PUBLISHED',
      createdById: procurement.id,
      createdAt: new Date('2026-03-05T10:00:00Z'),
    },
  });

  const rfqApr = await prisma.rfq.create({
    data: {
      title: 'Data Center Rack Space',
      description: 'Data center lease extension.',
      category: 'IT Infrastructure',
      deadline: new Date('2026-04-25T10:00:00Z'),
      status: 'PUBLISHED',
      createdById: buyer.id,
      createdAt: new Date('2026-04-05T10:00:00Z'),
    },
  });

  const rfqMay = await prisma.rfq.create({
    data: {
      title: 'Ergonomic Office Desks',
      description: 'Desks for development floor.',
      category: 'Office Supplies',
      deadline: new Date('2026-05-25T10:00:00Z'),
      status: 'PUBLISHED',
      createdById: procurement.id,
      createdAt: new Date('2026-05-05T10:00:00Z'),
    },
  });


  // 8. Create Quotations submitted by Vendors
  // Quotation 1 on Laptop Procurement by TechParts
  const quote1 = await prisma.quotation.create({
    data: {
      rfqId: rfq1.id,
      vendorId: techparts.id,
      price: 365000.00, // Adjusted to 3.65L to match June peak in graph
      deliveryTimeline: '15 Days',
      comments: 'Offering Lenovo ThinkPad P1 Gen 6 with 3-year warranty support.',
      status: 'SUBMITTED',
      items: JSON.stringify([{ item: 'Lenovo ThinkPad', qty: 50, price: 7300 }]),
      deliveryDays: 15,
      subtotal: 365000.00,
      grandTotal: 365000.00,
    },
  });

  // Quotation 2 on Office Stationery by Acme Supplies
  const quote2 = await prisma.quotation.create({
    data: {
      rfqId: rfq2.id,
      vendorId: acme.id,
      price: 85000.00, // ₹85,000
      deliveryTimeline: '5 Days',
      comments: 'Full catalog delivery. Free custom embossing included on bulk notebook orders.',
      status: 'ACCEPTED',
      items: JSON.stringify([{ item: 'Notebooks & Pens', qty: 1, price: 85000 }]),
      deliveryDays: 5,
      subtotal: 85000.00,
      grandTotal: 85000.00,
    },
  });

  // Quotation 3 on Office Stationery by Global Office Co
  const quote3 = await prisma.quotation.create({
    data: {
      rfqId: rfq2.id,
      vendorId: officeco.id,
      price: 92000.00, // ₹92,000
      deliveryTimeline: '7 Days',
      comments: 'Includes 10% discount on first-time orders.',
      status: 'REJECTED',
      items: JSON.stringify([{ item: 'Stationery Catalog', qty: 1, price: 92000 }]),
      deliveryDays: 7,
      subtotal: 92000.00,
      grandTotal: 92000.00,
    },
  });

  // Quotation 4 on Server Infrastructure by OfficeCo (Submitted)
  const quote4 = await prisma.quotation.create({
    data: {
      rfqId: rfq3.id,
      vendorId: officeco.id,
      price: 1500000.00, // ₹15L
      deliveryTimeline: '10 Days',
      comments: 'Providing premium dedicated server instances with SLA agreement.',
      status: 'SUBMITTED',
      items: JSON.stringify([{ item: 'GPU Instances', qty: 5, price: 300000 }]),
      deliveryDays: 10,
      subtotal: 1500000.00,
      grandTotal: 1500000.00,
    },
  });

  // Historical Quotations
  const quoteJan = await prisma.quotation.create({
    data: {
      rfqId: rfqJan.id,
      vendorId: acme.id,
      price: 120000.00,
      status: 'ACCEPTED',
      createdAt: new Date('2026-01-10T10:00:00Z'),
    },
  });

  const quoteFeb = await prisma.quotation.create({
    data: {
      rfqId: rfqFeb.id,
      vendorId: techparts.id,
      price: 180000.00,
      status: 'ACCEPTED',
      createdAt: new Date('2026-02-10T10:00:00Z'),
    },
  });

  const quoteMar = await prisma.quotation.create({
    data: {
      rfqId: rfqMar.id,
      vendorId: officeco.id,
      price: 150000.00,
      status: 'ACCEPTED',
      createdAt: new Date('2026-03-10T10:00:00Z'),
    },
  });

  const quoteApr = await prisma.quotation.create({
    data: {
      rfqId: rfqApr.id,
      vendorId: techparts.id,
      price: 320000.00,
      status: 'ACCEPTED',
      createdAt: new Date('2026-04-10T10:00:00Z'),
    },
  });

  const quoteMay = await prisma.quotation.create({
    data: {
      rfqId: rfqMay.id,
      vendorId: acme.id,
      price: 240000.00,
      status: 'ACCEPTED',
      createdAt: new Date('2026-05-10T10:00:00Z'),
    },
  });


  // 9. Create Purchase Orders
  // PO-001: Acme Supplies Group (Accepted) - June
  const po1 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-001',
      quotationId: quote2.id,
      vendorId: acme.id,
      buyerId: procurement.id,
      totalAmount: 85000.00,
      status: 'ACCEPTED',
    },
  });

  // PO-002: TechParts Corp (Delivered) - June
  const po2 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-002',
      quotationId: quote1.id,
      vendorId: techparts.id,
      buyerId: buyer.id,
      totalAmount: 365000.00, // Adjusted to 3.65L to match June peak
      status: 'DELIVERED',
    },
  });

  // Historical POs
  const poJan = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-003',
      quotationId: quoteJan.id,
      vendorId: acme.id,
      buyerId: procurement.id,
      totalAmount: 120000.00,
      status: 'ACCEPTED',
      createdAt: new Date('2026-01-15T10:00:00Z'),
    },
  });

  const poFeb = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-004',
      quotationId: quoteFeb.id,
      vendorId: techparts.id,
      buyerId: procurement.id,
      totalAmount: 180000.00,
      status: 'ACCEPTED',
      createdAt: new Date('2026-02-15T10:00:00Z'),
    },
  });

  const poMar = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-005',
      quotationId: quoteMar.id,
      vendorId: officeco.id,
      buyerId: procurement.id,
      totalAmount: 150000.00,
      status: 'ACCEPTED',
      createdAt: new Date('2026-03-15T10:00:00Z'),
    },
  });

  const poApr = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-006',
      quotationId: quoteApr.id,
      vendorId: techparts.id,
      buyerId: buyer.id,
      totalAmount: 320000.00,
      status: 'ACCEPTED',
      createdAt: new Date('2026-04-15T10:00:00Z'),
    },
  });

  const poMay = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-007',
      quotationId: quoteMay.id,
      vendorId: acme.id,
      buyerId: procurement.id,
      totalAmount: 240000.00,
      status: 'ACCEPTED',
      createdAt: new Date('2026-05-15T10:00:00Z'),
    },
  });


  // 9.5 Create Invoices
  // Invoice 1: Acme Supplies Group (Paid)
  await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-101',
      dueDate: new Date('2026-07-10T18:30:00.000Z'),
      paymentTerms: 'Net 30',
      status: 'PAID',
      purchaseOrderId: po1.id,
      vendorId: acme.id,
      totalAmount: 85000.00,
      taxAmount: 15000.00,
      subtotal: 70000.00,
      remarks: 'Paid via direct bank transfer.',
    },
  });

  // Invoice 2: TechParts Corp (Overdue)
  await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-102',
      dueDate: new Date('2026-05-01T18:30:00.000Z'),
      paymentTerms: 'Immediate',
      status: 'OVERDUE',
      purchaseOrderId: po2.id,
      vendorId: techparts.id,
      totalAmount: 365000.00,
      taxAmount: 65000.00,
      subtotal: 300000.00,
      remarks: 'Payment delay notification sent.',
    },
  });

  // 9.6 Create VendorSelections (for approvals)
  // Pending Approval selection for Laptop Procurement
  await prisma.vendorSelection.create({
    data: {
      rfqId: rfq1.id,
      vendorId: techparts.id,
      quotationId: quote1.id,
      selectedById: buyer.id,
      status: 'PENDING',
      currentLevel: 2,
      remarks: 'Best spec for software engineers.',
      internalNotes: 'Technically approved by engineering lead.',
      history: JSON.stringify([
        { level: 1, action: 'SUBMITTED', user: buyer.email, timestamp: new Date() },
        { level: 1, action: 'APPROVED', user: buyer.email, timestamp: new Date() },
      ]),
      timeline: JSON.stringify([
        { title: 'Selection Initiated', description: 'Buyer submitted selection for approval', date: new Date() }
      ]),
    },
  });

  // Approved selection for Office Stationery
  await prisma.vendorSelection.create({
    data: {
      rfqId: rfq2.id,
      vendorId: acme.id,
      quotationId: quote2.id,
      selectedById: buyer.id,
      status: 'APPROVED',
      currentLevel: 4,
      remarks: 'Cheapest bid with good delivery timeline.',
      history: JSON.stringify([
        { level: 1, action: 'SUBMITTED', user: buyer.email, timestamp: new Date() },
        { level: 1, action: 'APPROVED', user: buyer.email, timestamp: new Date() },
        { level: 2, action: 'APPROVED', user: procurement.email, timestamp: new Date() },
      ]),
    },
  });

  // 10. Seed Notifications
  await prisma.notification.createMany({
    data: [
      {
        title: 'RFQ Deadline Approaching',
        description: 'The deadline for laptop procurement RFQ is in 3 days.',
        userId: procurement.id,
        read: false,
      },
      {
        title: 'New Quotation Received',
        description: 'TechParts Corp submitted a bid of ₹45,000 for Laptop Procurement.',
        userId: procurement.id,
        read: false,
      },
      {
        title: 'Approval Request Assigned',
        description: 'New vendor selection request is pending your authorization level 1.',
        userId: procurement.id,
        read: false,
      },
      {
        title: 'Invoice Generated',
        description: 'Invoice INV-2026-101 has been generated from PO-2026-001.',
        userId: procurement.id,
        read: true,
      },
    ],
  });

  // 11. Seed AuditLogs
  await prisma.auditLog.createMany({
    data: [
      {
        logId: 'LOG-001',
        user: 'Mohammad Ali',
        module: 'RFQ',
        action: 'Created RFQ',
        entity: 'Laptop Procurement 2026',
        status: 'Success',
        ipAddress: '192.168.1.10',
      },
      {
        logId: 'LOG-002',
        user: 'Alice Johnson',
        module: 'Quotation',
        action: 'Submitted Quotation',
        entity: 'Office Stationery Quote',
        status: 'Success',
        ipAddress: '192.168.1.12',
      },
      {
        logId: 'LOG-003',
        user: 'Procurement Manager',
        module: 'Approval',
        action: 'Approved Quotation',
        entity: 'Office Stationery Quote Selection',
        status: 'Success',
        ipAddress: '192.168.1.15',
      },
      {
        logId: 'LOG-004',
        user: 'Procurement Manager',
        module: 'PO',
        action: 'Generated PO',
        entity: 'PO-2026-001 for Acme Supplies',
        status: 'Success',
        ipAddress: '192.168.1.15',
      },
    ],
  });

  // 12. Seed Reports
  await prisma.report.createMany({
    data: [
      {
        name: 'Vendor Performance Q2',
        generatedBy: 'Procurement Manager',
        format: 'PDF',
        status: 'COMPLETED',
        url: '/exports/vendor-perf-q2.pdf',
        filters: JSON.stringify({ category: 'IT Hardware' }),
      },
      {
        name: 'Annual Spend Analysis 2026',
        generatedBy: 'Mohammad Ali',
        format: 'Excel',
        status: 'COMPLETED',
        url: '/exports/spend-analysis-2026.xlsx',
        filters: JSON.stringify({ dateRange: 'Yearly' }),
      },
      {
        name: 'Pending Invoices Audit',
        generatedBy: 'Buyer Agent',
        format: 'CSV',
        status: 'COMPLETED',
        url: '/exports/pending-invoices.csv',
        filters: JSON.stringify({ status: 'PENDING' }),
      },
    ],
  });

  console.log('Seeding completed successfully:');
  console.log({
    admin: admin.email,
    procurement: procurement.email,
    buyer: buyer.email,
    acmeUser: acmeUser.email,
    techpartsUser: techpartsUser.email,
    officecoUser: officecoUser.email,
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