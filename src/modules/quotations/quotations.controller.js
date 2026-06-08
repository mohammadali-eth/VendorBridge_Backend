import prisma from '../../config/db.js';
import { AppError } from '@vendorbridge/shared';

/**
 * GET /api/v1/quotations/:id
 * Retrieve a specific quotation by ID
 */
export async function getQuotation(req, res, next) {
  try {
    const { id } = req.params;

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        rfq: true,
        vendor: true,
      },
    });

    if (!quotation) {
      return next(new AppError('Quotation not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: quotation,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/quotations
 * Submit a new quotation (either DRAFT or SUBMITTED)
 */
export async function createQuotation(req, res, next) {
  try {
    const {
      rfqId,
      vendorId,
      items = [],
      deliveryDays = 0,
      gstPercent = 0,
      otherTaxPercent = 0,
      notes = '',
      subtotal = 0,
      grandTotal = 0,
      status = 'SUBMITTED',
    } = req.body;

    if (!rfqId || !vendorId) {
      return next(new AppError('RFQ ID and Vendor ID are required', 400));
    }

    // Check if vendor already has a quotation for this RFQ
    const existing = await prisma.quotation.findFirst({
      where: {
        rfqId,
        vendorId,
      },
    });

    if (existing) {
      // If already exists, update it instead of creating duplicate to make workflow smooth!
      const updated = await prisma.quotation.update({
        where: { id: existing.id },
        data: {
          items,
          deliveryDays: parseInt(deliveryDays) || 0,
          gstPercent: parseFloat(gstPercent) || 0,
          otherTaxPercent: parseFloat(otherTaxPercent) || 0,
          comments: notes,
          subtotal: parseFloat(subtotal) || 0,
          grandTotal: parseFloat(grandTotal) || 0,
          price: parseFloat(grandTotal) || 0, // Backwards compatibility
          deliveryTimeline: `${deliveryDays} Days`, // Backwards compatibility
          status,
        },
      });

      return res.status(200).json({
        status: 'success',
        data: updated,
      });
    }

    // Create new quotation
    const quotation = await prisma.quotation.create({
      data: {
        rfqId,
        vendorId,
        items,
        deliveryDays: parseInt(deliveryDays) || 0,
        gstPercent: parseFloat(gstPercent) || 0,
        otherTaxPercent: parseFloat(otherTaxPercent) || 0,
        comments: notes,
        subtotal: parseFloat(subtotal) || 0,
        grandTotal: parseFloat(grandTotal) || 0,
        price: parseFloat(grandTotal) || 0, // Backwards compatibility
        deliveryTimeline: `${deliveryDays} Days`, // Backwards compatibility
        status,
      },
    });

    res.status(201).json({
      status: 'success',
      data: quotation,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/quotations/:id
 * Update an existing quotation
 */
export async function updateQuotation(req, res, next) {
  try {
    const { id } = req.params;
    const {
      items,
      deliveryDays,
      gstPercent,
      otherTaxPercent,
      notes,
      subtotal,
      grandTotal,
      status,
    } = req.body;

    const quotation = await prisma.quotation.findUnique({
      where: { id },
    });

    if (!quotation) {
      return next(new AppError('Quotation not found', 404));
    }

    const updated = await prisma.quotation.update({
      where: { id },
      data: {
        ...(items !== undefined && { items }),
        ...(deliveryDays !== undefined && { deliveryDays: parseInt(deliveryDays) || 0 }),
        ...(gstPercent !== undefined && { gstPercent: parseFloat(gstPercent) || 0 }),
        ...(otherTaxPercent !== undefined && { otherTaxPercent: parseFloat(otherTaxPercent) || 0 }),
        ...(notes !== undefined && { comments: notes }),
        ...(subtotal !== undefined && { subtotal: parseFloat(subtotal) || 0 }),
        ...(grandTotal !== undefined && {
          grandTotal: parseFloat(grandTotal) || 0,
          price: parseFloat(grandTotal) || 0,
        }),
        ...(deliveryDays !== undefined && { deliveryTimeline: `${deliveryDays} Days` }),
        ...(status !== undefined && { status }),
      },
    });

    res.status(200).json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}
