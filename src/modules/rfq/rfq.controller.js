import prisma from '../../config/db.js';
import { AppError } from '@vendorbridge/shared';

/**
 * POST /api/v1/rfqs
 * Create a new RFQ (DRAFT or PUBLISHED)
 */
export async function createRfq(req, res, next) {
  try {
    const {
      title,
      description = '',
      category = 'Product',
      priority = 'Medium',
      startDate,
      deadline,
      items = [],
      attachments = [],
      assignedVendorIds = [],
      status = 'DRAFT'
    } = req.body;

    const createdById = req.user.id; // From auth.middleware

    // 1. Basic validation
    if (!title || !deadline) {
      return next(new AppError('Title and Submission Deadline are required fields', 400));
    }

    if (status === 'PUBLISHED') {
      if (!items || !Array.isArray(items) || items.length === 0) {
        return next(new AppError('At least one line item is required to publish an RFQ', 400));
      }
      if (!assignedVendorIds || !Array.isArray(assignedVendorIds) || assignedVendorIds.length === 0) {
        return next(new AppError('At least one vendor must be assigned to publish an RFQ', 400));
      }
    }

    // Parse Dates
    const parsedStart = startDate ? new Date(startDate) : new Date();
    const parsedDeadline = new Date(deadline);

    if (parsedDeadline <= parsedStart) {
      return next(new AppError('Submission Deadline must be after the RFQ Start Date', 400));
    }

    // 2. Create RFQ record
    const rfq = await prisma.rfq.create({
      data: {
        title,
        description,
        category,
        priority,
        startDate: parsedStart,
        deadline: parsedDeadline,
        status: status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        items: items,
        attachments: attachments,
        assignedVendorIds: assignedVendorIds,
        createdById
      }
    });

    res.status(201).json({
      status: 'success',
      data: rfq
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/rfqs/upload
 * Simulated File Upload endpoint (Accepts mock files and returns metadata details)
 */
export async function uploadAttachments(req, res, next) {
  try {
    // Return standard mock uploaded file metadata
    const files = req.body.files || [];
    const uploaded = files.map((file) => ({
      name: file.name || 'document.pdf',
      size: file.size || 2500000, // Default 2.5MB
      type: file.type || 'application/pdf',
      url: `/uploads/mock_${Date.now()}_${file.name || 'document.pdf'}`
    }));

    res.status(200).json({
      status: 'success',
      data: uploaded
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/rfqs
 * Retrieve list of all RFQs
 */
export async function getRfqs(req, res, next) {
  try {
    const rfqs = await prisma.rfq.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        quotations: {
          select: {
            id: true,
            status: true,
            grandTotal: true,
            deliveryDays: true,
          },
        },
      },
    });

    res.status(200).json({
      status: 'success',
      data: rfqs,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/rfqs/:id
 * Fetch a single RFQ details
 */
export async function getRfq(req, res, next) {
  try {
    const { id } = req.params;

    const rfq = await prisma.rfq.findUnique({
      where: { id },
    });

    if (!rfq) {
      return next(new AppError('RFQ not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: rfq,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/rfqs/:id/comparison
 * Fetch quotation comparison report for an RFQ
 */
export async function getRfqComparison(req, res, next) {
  try {
    const { id } = req.params;

    const rfq = await prisma.rfq.findUnique({
      where: { id },
    });

    if (!rfq) {
      return next(new AppError('RFQ not found', 404));
    }

    const quotations = await prisma.quotation.findMany({
      where: {
        rfqId: id,
        status: 'SUBMITTED', // Compare only submitted quotations
      },
      include: {
        vendor: true,
      },
    });

    // Format comparison records
    const formattedQuotations = quotations.map((q) => {
      // Deterministic vendor rating (3.5 - 5.0) based on name string character codes
      const charSum = q.vendor.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const rating = parseFloat((3.5 + (charSum % 16) / 10).toFixed(1));

      return {
        id: q.id,
        vendorId: q.vendorId,
        vendorName: q.vendor.name,
        subtotal: parseFloat(q.subtotal.toString()) || 0,
        gst: parseFloat(q.gstPercent.toString()) || 0,
        grandTotal: parseFloat(q.grandTotal.toString()) || 0,
        deliveryDays: q.deliveryDays || 5,
        vendorRating: rating,
        paymentTerms: q.comments || 'Net 30 Days',
      };
    });

    res.status(200).json({
      status: 'success',
      data: {
        rfqId: id,
        rfqTitle: rfq.title,
        rfqNumber: `RFQ-${rfq.createdAt.getFullYear()}-${rfq.title.charCodeAt(0) || 101}`,
        quotations: formattedQuotations,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/vendor-selection
 * Select a vendor quotation and push RFQ to PENDING_APPROVAL status
 */
export async function createVendorSelection(req, res, next) {
  try {
    const { rfqId, vendorId, quotationId } = req.body;
    const selectedById = req.user.id;

    if (!rfqId || !vendorId || !quotationId) {
      return next(new AppError('RFQ ID, Vendor ID, and Quotation ID are required fields', 400));
    }

    // Verify Rfq exists
    const rfq = await prisma.rfq.findUnique({
      where: { id: rfqId },
    });

    if (!rfq) {
      return next(new AppError('RFQ not found', 404));
    }

    // Initial approval chain
    const initialHistory = [
      { level: 1, approverName: 'Rahul Mehta', role: 'Procurement Head', status: 'PENDING', date: null, remarks: '' },
      { level: 2, approverName: 'Priya Shah', role: 'Finance Manager', status: 'PENDING', date: null, remarks: '' },
      { level: 3, approverName: 'Akbar Husain', role: 'Department Head', status: 'PENDING', date: null, remarks: '' },
      { level: 4, approverName: 'Vikram Malhotra', role: 'Procurement Director', status: 'PENDING', date: null, remarks: '' }
    ];

    const initialTimeline = [
      { action: 'RFQ Created', user: 'System Auto', timestamp: rfq.createdAt.toISOString(), status: 'COMPLETED', remarks: 'RFQ successfully initialized' },
      { action: 'Vendor Selected', user: req.user.name, timestamp: new Date().toISOString(), status: 'COMPLETED', remarks: 'Vendor bid approved for authorization chain' }
    ];

    const initialAudit = [
      { action: 'RFQ Created', performedBy: 'System Auto', timestamp: rfq.createdAt.toISOString(), remarks: 'RFQ published' },
      { action: 'Selection Initiated', performedBy: req.user.name, timestamp: new Date().toISOString(), remarks: 'Pushed to approval chain' }
    ];

    // Create the vendor selection record
    const selection = await prisma.vendorSelection.create({
      data: {
        rfqId,
        vendorId,
        quotationId,
        selectedById,
        status: 'PENDING',
        currentLevel: 1,
        history: initialHistory,
        timeline: initialTimeline,
        auditLogs: initialAudit,
      },
    });

    // Move RFQ status to PENDING_APPROVAL
    await prisma.rfq.update({
      where: { id: rfqId },
      data: {
        status: 'PENDING_APPROVAL',
      },
    });

    // Update selected quotation status
    await prisma.quotation.update({
      where: { id: quotationId },
      data: {
        status: 'ACCEPTED',
      },
    });

    res.status(201).json({
      status: 'success',
      data: selection,
    });
  } catch (error) {
    next(error);
  }
}
