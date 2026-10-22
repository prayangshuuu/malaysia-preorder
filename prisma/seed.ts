import 'dotenv/config';
import { PrismaClient, UserRole, ProductStatus, PricingType, InquiryStatus, QuoteStatus, OrderStatus, PaymentStatus, PaymentMethodType, ProcurementStatus, ShipmentStatus, WalletLedgerEntryType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required to run seeds.');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting development seed...');

  // 1. Company Settings
  const settings = [
    { key: 'COMPANY_NAME', value: 'Malaysia Direct BD', description: 'Official trade brand', isPublic: true },
    { key: 'SUPPORT_EMAIL', value: 'support@example.com', description: 'Public support email', isPublic: true },
    { key: 'SUPPORT_PHONE', value: '+8801700000000', description: 'WhatsApp and customer hotline', isPublic: true },
    { key: 'DEFAULT_MYR_BDT_RATE', value: '27.50', description: 'Indicative conversion rate for internal estimates', isPublic: false },
    { key: 'QUOTE_DEFAULT_VALIDITY_DAYS', value: '7', description: 'Default validity period in days for newly issued quotes', isPublic: false },
  ];

  for (const s of settings) {
    await prisma.companySetting.upsert({
      where: { key: s.key },
      update: { value: s.value, description: s.description, isPublic: s.isPublic },
      create: s,
    });
  }
  console.log('✓ Seeded company settings');

  // 2. Users (Fictional development accounts)
  // Password hash is a dummy development hash, never real credentials
  const devPasswordHash = '$2a$10$fictionalDevelopmentHashForLocalDevOnlyPlaceholder';

  const admin = await prisma.user.upsert({
    where: { email: 'admin@dev.local' },
    update: {},
    create: {
      email: 'admin@dev.local',
      name: 'Dev Admin Staff',
      phone: '+8801800000001',
      passwordHash: devPasswordHash,
      role: UserRole.ADMIN,
      isActive: true,
      emailVerified: new Date(),
    },
  });

  const operations = await prisma.user.upsert({
    where: { email: 'operations@dev.local' },
    update: {},
    create: {
      email: 'operations@dev.local',
      name: 'KL Sourcing Specialist',
      phone: '+60110000001',
      passwordHash: devPasswordHash,
      role: UserRole.OPERATIONS,
      isActive: true,
      emailVerified: new Date(),
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@dev.local' },
    update: {},
    create: {
      email: 'customer@dev.local',
      name: 'Fictional Customer',
      phone: '+8801700000002',
      passwordHash: devPasswordHash,
      role: UserRole.CUSTOMER,
      isActive: true,
      emailVerified: new Date(),
      profile: {
        create: {
          preferredCity: 'Dhaka',
          district: 'Dhaka',
          division: 'Dhaka',
          defaultNotes: 'Deliver during standard business hours if possible.',
        },
      },
      addresses: {
        create: {
          recipientName: 'Fictional Customer',
          phoneNumber: '+8801700000002',
          streetAddress: 'House 42, Road 11, Block D, Banani',
          thanaOrUpazila: 'Banani',
          district: 'Dhaka',
          division: 'Dhaka',
          postalCode: '1213',
          country: 'Bangladesh',
          isDefault: true,
        },
      },
      walletAccount: {
        create: {
          currency: 'BDT',
          balance: 0,
          isActive: true,
        },
      },
    },
  });
  console.log('✓ Seeded users and profile');

  // 3. Private Supplier in Malaysia
  const supplier = await prisma.supplier.upsert({
    where: { id: 'sup-fictional-kl-wholesaler' },
    update: {},
    create: {
      id: 'sup-fictional-kl-wholesaler',
      name: 'Fictional KL Electronics Wholesaler Sdn Bhd',
      contactPerson: 'Dev Supplier Contact',
      email: 'supplier@fictional-kl-wholesaler.my',
      phone: '+60388880000',
      address: 'Lot 10, Jalan Bukit Bintang',
      city: 'Kuala Lumpur',
      country: 'Malaysia',
      notes: 'Reliable supplier for Malaysian gadgets and lifestyle electronics.',
      isActive: true,
    },
  });
  console.log('✓ Seeded private supplier');

  // 4. Product Categories
  const catElectronics = await prisma.productCategory.upsert({
    where: { slug: 'electronics-gadgets' },
    update: {},
    create: {
      name: 'Electronics & Gadgets',
      slug: 'electronics-gadgets',
      description: 'Authentic gadgets and consumer electronics sourced directly from Malaysia.',
      displayOrder: 1,
      isActive: true,
    },
  });

  const catHealth = await prisma.productCategory.upsert({
    where: { slug: 'beauty-healthcare' },
    update: {},
    create: {
      name: 'Beauty & Healthcare',
      slug: 'beauty-healthcare',
      description: 'Skincare, vitamins, and supplements from official Malaysian pharmacies.',
      displayOrder: 2,
      isActive: true,
    },
  });
  console.log('✓ Seeded product categories');

  // 5. Catalogue Products
  const productKeychron = await prisma.product.upsert({
    where: { slug: 'keychron-k2-pro-wireless-mechanical-keyboard' },
    update: {},
    create: {
      title: 'Keychron K2 Pro Wireless Mechanical Keyboard',
      slug: 'keychron-k2-pro-wireless-mechanical-keyboard',
      shortDesc: 'QMK/VIA wireless custom mechanical keyboard, RGB backlight, Red Switches.',
      description: 'Official Malaysia retail edition with hot-swappable switches and dual Mac/Windows compatibility.',
      categoryId: catElectronics.id,
      status: ProductStatus.PUBLISHED,
      pricingType: PricingType.FIXED_PRICE,
      displayPriceBDT: 14500.00,
      estimatedDaysMin: 7,
      estimatedDaysMax: 12,
      originCountry: 'Malaysia',
      sourceUrl: 'https://example-store.my/keychron-k2-pro',
      defaultSupplierId: supplier.id,
      approxCostMYR: 420.00, // Staff private reference
      adminNotes: 'Procured through authorized distributors in Sunway Pyramid.',
      images: {
        create: [
          {
            imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80',
            altText: 'Keychron K2 Pro top view',
            isPrimary: true,
            sortOrder: 0,
          },
        ],
      },
    },
  });
  console.log('✓ Seeded sample catalogue product');

  // 6. Product Inquiry
  const inquiry = await prisma.productInquiry.upsert({
    where: { inquiryNumber: 'INQ-DEV-0001' },
    update: {},
    create: {
      inquiryNumber: 'INQ-DEV-0001',
      userId: customer.id,
      productId: productKeychron.id,
      productName: 'Keychron K2 Pro Wireless Mechanical Keyboard (Brown Switch)',
      referenceUrl: 'https://example-store.my/keychron-k2-pro-brown',
      brandOrModel: 'Keychron K2 Pro RGB Hot-Swap',
      specifications: 'RGB Backlight, Gateron Brown Switch, ISO or ANSI layout',
      quantityRequested: 1,
      targetBudgetBDT: 15000.00,
      status: InquiryStatus.QUOTED,
      adminPrivateNotes: 'Stock verified at KL wholesale supplier; ready to source on confirmation.',
      messages: {
        create: [
          {
            senderId: customer.id,
            messageText: 'Hello, can you procure the brown switch edition with standard ANSI layout?',
            isStaffOnly: false,
          },
          {
            senderId: operations.id,
            messageText: 'Yes, we verified local stock in Kuala Lumpur. Quote issued with 7-day validity.',
            isStaffOnly: false,
          },
        ],
      },
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: InquiryStatus.SUBMITTED, reason: 'Inquiry submitted by customer' },
          { fromStatus: InquiryStatus.SUBMITTED, toStatus: InquiryStatus.UNDER_REVIEW, reason: 'Staff verifying sourcing availability' },
          { fromStatus: InquiryStatus.UNDER_REVIEW, toStatus: InquiryStatus.QUOTED, reason: 'Quote QUO-DEV-0001 issued to customer' },
        ],
      },
    },
  });
  console.log('✓ Seeded sample product inquiry');

  // 7. Quote with Snapshotted Pricing
  const quote = await prisma.quote.upsert({
    where: { quoteNumber: 'QUO-DEV-0001' },
    update: {},
    create: {
      quoteNumber: 'QUO-DEV-0001',
      version: 1,
      inquiryId: inquiry.id,
      createdById: admin.id,
      status: QuoteStatus.ACCEPTED,
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      currency: 'BDT',
      itemsSubtotalBDT: 12500.00,
      serviceFeeBDT: 1000.00,
      shippingFeeBDT: 1200.00,
      customsFeeBDT: 300.00,
      discountBDT: 0.00,
      totalAmountBDT: 15000.00,
      estCostMYR: 420.00,
      estExchangeRate: 27.50,
      shippingMethod: 'Air Express Sourcing',
      estDispatchDaysMin: 3,
      estDispatchDaysMax: 5,
      estDeliveryDaysMin: 7,
      estDeliveryDaysMax: 10,
      customerNotes: 'Includes bubble-pack packaging and direct Dhaka door-to-door delivery.',
      adminNotes: 'Supplier has 5 units remaining in warehouse.',
      acceptedAt: new Date(),
      acceptedById: customer.id,
      lineItems: {
        create: [
          {
            productId: productKeychron.id,
            title: 'Keychron K2 Pro (Gateron Brown Switch)',
            description: 'Hot-swap RGB keyboard',
            sourceUrl: 'https://example-store.my/keychron-k2-pro-brown',
            quantity: 1,
            unitPriceBDT: 12500.00,
            totalPriceBDT: 12500.00,
            estUnitCostMYR: 420.00,
          },
        ],
      },
    },
  });
  console.log('✓ Seeded sample quote');

  // 8. Order Created from Quote
  const order = await prisma.order.upsert({
    where: { orderNumber: 'ORD-DEV-0001' },
    update: {},
    create: {
      orderNumber: 'ORD-DEV-0001',
      customerId: customer.id,
      quoteId: quote.id,
      status: OrderStatus.PAID,
      paymentStatus: PaymentStatus.SUCCEEDED,
      procurementStatus: ProcurementStatus.PURCHASED,
      shipmentStatus: ShipmentStatus.READY_TO_DISPATCH,
      currency: 'BDT',
      itemsSubtotalBDT: 12500.00,
      serviceFeeBDT: 1000.00,
      shippingFeeBDT: 1200.00,
      customsFeeBDT: 300.00,
      discountBDT: 0.00,
      totalAmountBDT: 15000.00,
      paidAmountBDT: 15000.00,
      shippingRecipientName: 'Fictional Customer',
      shippingPhoneNumber: '+8801700000002',
      shippingStreetAddress: 'House 42, Road 11, Block D, Banani',
      shippingThanaOrUpazila: 'Banani',
      shippingDistrict: 'Dhaka',
      shippingDivision: 'Dhaka',
      shippingPostalCode: '1213',
      shippingCountry: 'Bangladesh',
      customerNotes: 'Please inspect the seal before dispatch.',
      adminNotes: 'Procured in KL; packed and ready for air freight handover.',
      lineItems: {
        create: [
          {
            productId: productKeychron.id,
            itemTitle: 'Keychron K2 Pro (Gateron Brown Switch)',
            itemDescription: 'Snapshotted agreed item specs',
            sourceUrl: 'https://example-store.my/keychron-k2-pro-brown',
            quantity: 1,
            unitPriceBDT: 12500.00,
            totalPriceBDT: 12500.00,
          },
        ],
      },
      events: {
        create: [
          { eventType: 'ORDER_CREATED', title: 'Order Placed', description: 'Order created from accepted quote QUO-DEV-0001' },
          { eventType: 'PAYMENT_RECEIVED', title: 'Payment Confirmed', description: 'Payment of BDT 15,000 received via bKash' },
          { eventType: 'PROCUREMENT_COMPLETED', title: 'Procured in Malaysia', description: 'Item purchased from supplier in Kuala Lumpur' },
        ],
      },
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: OrderStatus.AWAITING_PAYMENT, reason: 'Order initialized' },
          { fromStatus: OrderStatus.AWAITING_PAYMENT, toStatus: OrderStatus.PAID, reason: 'Full payment received and verified' },
          { fromStatus: OrderStatus.PAID, toStatus: OrderStatus.PROCUREMENT, reason: 'Malaysia operations initiated sourcing' },
        ],
      },
    },
  });
  console.log('✓ Seeded sample order');

  // 9. Payment Record with Idempotency Key
  const payment = await prisma.payment.upsert({
    where: { paymentNumber: 'PAY-DEV-0001' },
    update: {},
    create: {
      paymentNumber: 'PAY-DEV-0001',
      orderId: order.id,
      method: PaymentMethodType.BKASH,
      status: PaymentStatus.SUCCEEDED,
      currency: 'BDT',
      amount: 15000.00,
      provider: 'bkash',
      providerTrxId: 'BKASH-DEV-TRX-998877',
      providerPaymentId: 'BKASH-PAY-SESSION-001',
      idempotencyKey: 'idemp-pay-dev-0001',
      providerPayload: {
        trxStatus: 'Completed',
        amount: '15000.00',
        currency: 'BDT',
        merchantInvoiceNumber: 'ORD-DEV-0001',
      },
      verifiedAt: new Date(),
      verifiedById: admin.id,
      attempts: {
        create: [
          {
            method: PaymentMethodType.BKASH,
            gatewayRef: 'BKASH-PAY-SESSION-001',
            rawStatus: 'SUCCESS',
            responseData: { statusCode: '0000', statusMessage: 'Successful' },
            ipAddress: '127.0.0.1',
          },
        ],
      },
    },
  });
  console.log('✓ Seeded sample payment and attempt');

  // 10. Webhook Idempotency Event Record
  await prisma.webhookEvent.upsert({
    where: {
      provider_eventId: {
        provider: 'bkash',
        eventId: 'wh-evt-dev-998877',
      },
    },
    update: {},
    create: {
      provider: 'bkash',
      eventId: 'wh-evt-dev-998877',
      eventType: 'PaymentSuccess',
      payload: {
        paymentId: 'BKASH-PAY-SESSION-001',
        trxId: 'BKASH-DEV-TRX-998877',
        amount: '15000.00',
      },
      isProcessed: true,
      processedAt: new Date(),
    },
  });
  console.log('✓ Seeded webhook idempotency record');

  // 11. Malaysia Procurement Record (Confidential Supplier Cost)
  const orderLine = await prisma.orderLineItem.findFirst({ where: { orderId: order.id } });
  if (orderLine) {
    await prisma.procurementRecord.upsert({
      where: { procurementCode: 'PROC-DEV-0001' },
      update: {},
      create: {
        procurementCode: 'PROC-DEV-0001',
        orderId: order.id,
        orderLineItemId: orderLine.id,
        supplierId: supplier.id,
        status: ProcurementStatus.PURCHASED,
        purchaseCostMYR: 420.00,
        exchangeRateUsed: 27.50,
        purchaseCostBDT: 11550.00,
        supplierInvoiceRef: 'INV-KLW-2026-4412',
        purchasedAt: new Date(),
        purchasedById: operations.id,
        notes: 'Handover complete from warehouse counter.',
      },
    });
  }
  console.log('✓ Seeded procurement record');

  // 12. Shipment Record with Events
  const shipment = await prisma.shipment.upsert({
    where: { shipmentNumber: 'SHP-DEV-0001' },
    update: {},
    create: {
      shipmentNumber: 'SHP-DEV-0001',
      orderId: order.id,
      carrierName: 'Malaysian Air Cargo Partner',
      trackingNumber: 'MAC-BD-2026-9901',
      status: ShipmentStatus.READY_TO_DISPATCH,
      dispatchOrigin: 'Kuala Lumpur',
      destinationCountry: 'Bangladesh',
      estimatedDeparture: new Date(Date.now() + 24 * 60 * 60 * 1000),
      estimatedArrival: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      weightKg: 1.45,
      dimensionsCm: '35x18x8',
      internalCargoNotes: 'Pallet cargo flight scheduled out of KLIA.',
      events: {
        create: [
          {
            status: ShipmentStatus.READY_TO_DISPATCH,
            location: 'Kuala Lumpur Operations Center',
            description: 'Item packed, weighted, and sealed for air transit consignment.',
            isPublic: true,
            timestamp: new Date(),
          },
        ],
      },
    },
  });
  console.log('✓ Seeded shipment and tracking event');

  // 13. Customer Wallet with Immutable Ledger Entry
  const userWallet = await prisma.walletAccount.findUnique({ where: { userId: customer.id } });
  if (userWallet) {
    await prisma.walletLedgerEntry.upsert({
      where: { idempotencyKey: 'idemp-seed-wallet-topup-001' },
      update: {},
      create: {
        walletId: userWallet.id,
        entryType: WalletLedgerEntryType.TOP_UP,
        amount: 500.00,
        balanceAfter: 500.00,
        currency: 'BDT',
        idempotencyKey: 'idemp-seed-wallet-topup-001',
        referenceNote: 'Fictional goodwill test promotional credit',
        createdById: admin.id,
      },
    });

    await prisma.walletAccount.update({
      where: { id: userWallet.id },
      data: { balance: 500.00 },
    });
  }
  console.log('✓ Seeded wallet account and immutable ledger entry');

  // 14. Audit Log
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'SYSTEM_SEED_INITIALIZED',
      entityType: 'System',
      entityId: 'seed-task',
      metadata: { environment: 'development', timestamp: new Date().toISOString() },
      ipAddress: '127.0.0.1',
    },
  });
  console.log('✓ Seeded initial audit log');

  console.log('✅ Development seed successfully completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error executing seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
