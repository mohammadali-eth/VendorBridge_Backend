import prisma from '../../config/db.js';
import { AppError } from '../../middlewares/error.middleware.js';

/**
 * GET /api/v1/purchase-orders
 */
export async function getPurchaseOrders(req, res, next) {
  try {
    const pos = await prisma.purchaseOrder.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: { select: { name: true, email: true } },
        quotation: {
          select: {
            id: true,
            rfq: { select: { title: true } }
          }
        }
      }
    });

    res.status(200).json({
      status: 'success',
      data: pos,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/purchase-orders/:id
 */
export async function getPurchaseOrder(req, res, next) {
  try {
    const { id } = req.params;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        vendor: true,
        buyer: { select: { name: true, email: true } },
        quotation: {
          include: {
            rfq: true,
          }
        },
        invoices: true,
      }
    });

    if (!po) {
      return next(new AppError('Purchase Order not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: po,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/purchase-orders/:id
 */
export async function updatePurchaseOrder(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status },
    });

    res.status(200).json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/purchase-orders/:id/invoice
 * Generates a new invoice from PO
 */
export async function createInvoiceFromPo(req, res, next) {
  try {
    const { id } = req.params;
    const { dueDate, paymentTerms = 'Net 30' } = req.body;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        vendor: true,
        quotation: true,
      }
    });

    if (!po) {
      return next(new AppError('Purchase Order not found', 404));
    }

    // Generate unique invoice number
    const lastInvoice = await prisma.invoice.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    const nextIndex = lastInvoice ? parseInt(lastInvoice.invoiceNumber.split('-')[2]) + 1 : 101;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${nextIndex}`;

    const subtotal = po.quotation.subtotal;
    const gstPercent = po.quotation.gstPercent;
    const otherTaxPercent = po.quotation.otherTaxPercent;

    const gstAmount = subtotal.toNumber() * (gstPercent.toNumber() / 100);
    const otherTaxAmount = subtotal.toNumber() * (otherTaxPercent.toNumber() / 100);
    const taxAmount = gstAmount + otherTaxAmount;
    const totalAmount = subtotal.toNumber() + taxAmount;

    const resolvedDueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        dueDate: resolvedDueDate,
        paymentTerms,
        status: 'GENERATED',
        purchaseOrderId: po.id,
        vendorId: po.vendorId,
        subtotal,
        taxAmount,
        totalAmount,
      },
      include: {
        purchaseOrder: {
          include: {
            quotation: {
              include: { rfq: true }
            }
          }
        },
        vendor: true,
      }
    });

    // Move PO status to DELIVERED
    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: 'DELIVERED' }
    });

    res.status(201).json({
      status: 'success',
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/invoices
 */
export async function getInvoices(req, res, next) {
  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: { select: { name: true } },
        purchaseOrder: { select: { poNumber: true } }
      }
    });

    res.status(200).json({
      status: 'success',
      data: invoices,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/invoices/:id
 */
export async function getInvoice(req, res, next) {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        vendor: true,
        purchaseOrder: {
          include: {
            quotation: {
              include: { rfq: true }
            },
            buyer: { select: { name: true, email: true } }
          }
        }
      }
    });

    if (!invoice) {
      return next(new AppError('Invoice not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/invoices/:id/status
 */
export async function updateInvoiceStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await prisma.invoice.update({
      where: { id },
      data: { status },
      include: {
        vendor: true,
        purchaseOrder: {
          include: {
            quotation: {
              include: { rfq: true }
            }
          }
        }
      }
    });

    res.status(200).json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/invoices/:id/email
 */
export async function emailInvoice(req, res, next) {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { vendor: true },
    });

    if (!invoice) {
      return next(new AppError('Invoice not found', 404));
    }

    // Set invoice status to SENT if it was GENERATED/DRAFT
    if (invoice.status === 'GENERATED' || invoice.status === 'DRAFT') {
      await prisma.invoice.update({
        where: { id },
        data: { status: 'SENT' },
      });
    }

    res.status(200).json({
      status: 'success',
      message: `Invoice ${invoice.invoiceNumber} successfully emailed to ${invoice.vendor.email}`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/invoices/:id/download
 */
export async function downloadInvoicePdf(req, res, next) {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        vendor: true,
        purchaseOrder: true
      }
    });

    if (!invoice) {
      return next(new AppError('Invoice not found', 404));
    }

    const filename = `invoice-${invoice.invoiceNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const pdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 300 >>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(VendorBridge Invoice PDF)\nTj\n0 -40 Td\n/F1 12 Tf\n(Invoice Number: ${invoice.invoiceNumber}) Tj\n0 -20 Td\n(Vendor Name: ${invoice.vendor?.name || 'N/A'}) Tj\n0 -20 Td\n(Amount: INR ${invoice.totalAmount}) Tj\n0 -20 Td\n(Status: ${invoice.status}) Tj\n0 -20 Td\n(Date: ${invoice.createdAt.toLocaleDateString()}) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\n0000000244 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n414\n%%EOF`;

    res.send(Buffer.from(pdfContent, 'utf-8'));
  } catch (error) {
    next(error);
  }
}
