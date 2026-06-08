import prisma from '../../config/db.js';
import { AppError } from '../../middlewares/error.middleware.js';

/**
 * GET /api/v1/approvals
 * Retrieve list of all approval requests
 */
export async function getApprovals(req, res, next) {
  try {
    const approvals = await prisma.vendorSelection.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        rfq: {
          select: {
            title: true,
            createdAt: true,
          }
        },
        vendor: {
          select: {
            name: true,
          }
        },
        quotation: {
          select: {
            grandTotal: true,
          }
        }
      }
    });

    res.status(200).json({
      status: 'success',
      data: approvals,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/approvals/:id
 * Retrieve approval data by VendorSelection ID
 */
export async function getApproval(req, res, next) {
  try {
    const { id } = req.params;

    const selection = await prisma.vendorSelection.findUnique({
      where: { id },
      include: {
        rfq: {
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            priority: true,
            deadline: true,
            createdAt: true,
            createdBy: {
              select: { name: true }
            }
          }
        },
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        quotation: {
          select: {
            id: true,
            subtotal: true,
            gstPercent: true,
            otherTaxPercent: true,
            grandTotal: true,
            deliveryDays: true,
            comments: true,
          }
        },
        selectedBy: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    if (!selection) {
      return next(new AppError('Approval selection record not found', 404));
    }

    // Determine deterministic vendor rating (3.5 - 5.0) based on name string character codes
    const charSum = selection.vendor.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const rating = parseFloat((3.5 + (charSum % 16) / 10).toFixed(1));

    // Format final response object
    const rfqYear = new Date(selection.rfq.createdAt).getFullYear();
    const rfqChar = selection.rfq.title.charCodeAt(0) || 101;
    const rfqNumber = `RFQ-${rfqYear}-${rfqChar}`;

    const formattedData = {
      id: selection.id,
      rfqId: selection.rfq.id,
      rfqNumber,
      rfqTitle: selection.rfq.title,
      department: 'Administration', // Simulated default
      requestedBy: selection.rfq.createdBy.name,
      vendorName: selection.vendor.name,
      quotationValue: parseFloat(selection.quotation.grandTotal.toString()),
      expectedDelivery: `${selection.quotation.deliveryDays} Days`,
      priority: selection.rfq.priority,
      status: selection.status,
      currentLevel: selection.currentLevel,
      remarks: selection.remarks || '',
      internalNotes: selection.internalNotes || '',
      history: selection.history || [],
      timeline: selection.timeline || [],
      auditLogs: selection.auditLogs || [],
      createdAt: selection.createdAt,
      // Snapshot
      snapshot: {
        vendorName: selection.vendor.name,
        subtotal: parseFloat(selection.quotation.subtotal.toString()),
        deliveryDays: selection.quotation.deliveryDays,
        gstPercent: parseFloat(selection.quotation.gstPercent.toString()),
        otherTaxPercent: parseFloat(selection.quotation.otherTaxPercent.toString()),
        gstAmount: parseFloat(selection.quotation.subtotal.toString()) * parseFloat(selection.quotation.gstPercent.toString()) / 100,
        otherTaxAmount: parseFloat(selection.quotation.subtotal.toString()) * parseFloat(selection.quotation.otherTaxPercent.toString()) / 100,
        discount: 0, // Mocked discount
        finalTotal: parseFloat(selection.quotation.grandTotal.toString()),
        vendorRating: rating,
      }
    };

    res.status(200).json({
      status: 'success',
      data: formattedData,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/approvals/:id/timeline
 */
export async function getApprovalTimeline(req, res, next) {
  try {
    const { id } = req.params;
    const selection = await prisma.vendorSelection.findUnique({
      where: { id },
      select: { timeline: true },
    });
    if (!selection) {
      return next(new AppError('Approval not found', 404));
    }
    res.status(200).json({
      status: 'success',
      data: selection.timeline || [],
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/approvals/:id/audit
 */
export async function getApprovalAudit(req, res, next) {
  try {
    const { id } = req.params;
    const selection = await prisma.vendorSelection.findUnique({
      where: { id },
      select: { auditLogs: true },
    });
    if (!selection) {
      return next(new AppError('Approval not found', 404));
    }
    res.status(200).json({
      status: 'success',
      data: selection.auditLogs || [],
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/approvals/:id/approve
 */
export async function approveApproval(req, res, next) {
  try {
    const { id } = req.params;
    const { comment = '' } = req.body;
    const userName = req.user.name;

    const selection = await prisma.vendorSelection.findUnique({
      where: { id },
    });

    if (!selection) {
      return next(new AppError('Approval not found', 404));
    }

    if (selection.status !== 'PENDING') {
      return next(new AppError('This approval request is already finalized', 400));
    }

    let history = Array.isArray(selection.history) ? selection.history : [];
    let timeline = Array.isArray(selection.timeline) ? selection.timeline : [];
    let auditLogs = Array.isArray(selection.auditLogs) ? selection.auditLogs : [];

    const currentLevelIndex = history.findIndex((h) => h.level === selection.currentLevel);
    
    if (currentLevelIndex !== -1) {
      history[currentLevelIndex].status = 'APPROVED';
      history[currentLevelIndex].date = new Date().toISOString();
      history[currentLevelIndex].remarks = comment;
      history[currentLevelIndex].approverName = userName;
    }

    let nextLevel = selection.currentLevel + 1;
    let nextStatus = 'PENDING';

    timeline.push({
      action: `Approved at Level ${selection.currentLevel}`,
      user: userName,
      timestamp: new Date().toISOString(),
      status: 'APPROVED',
      remarks: comment || 'Approved without issues',
    });

    auditLogs.push({
      action: `Approved Level ${selection.currentLevel}`,
      performedBy: userName,
      timestamp: new Date().toISOString(),
      remarks: comment || 'Approved',
    });

    // If level 4 is reached and approved, finalize
    if (selection.currentLevel >= 4) {
      nextStatus = 'APPROVED';
      nextLevel = 4; // Caps at 4

      timeline.push({
        action: 'Purchase Order Generated',
        user: 'System Auto',
        timestamp: new Date().toISOString(),
        status: 'COMPLETED',
        remarks: 'Final approvals completed. Draft purchase order initialized.',
      });

      auditLogs.push({
        action: 'Purchase Order Issued',
        performedBy: 'System Auto',
        timestamp: new Date().toISOString(),
        remarks: 'PO Auto-generated',
      });

      // Auto-create a Purchase Order in draft status
      const lastPo = await prisma.purchaseOrder.findFirst({
        orderBy: { createdAt: 'desc' },
      });
      const nextIndex = lastPo ? parseInt(lastPo.poNumber.split('-')[2]) + 1 : 101;
      const poNumber = `PO-${new Date().getFullYear()}-${nextIndex}`;

      await prisma.purchaseOrder.create({
        data: {
          poNumber,
          quotationId: selection.quotationId,
          vendorId: selection.vendorId,
          buyerId: selection.selectedById,
          totalAmount: selection.quotationId ? (await prisma.quotation.findUnique({ where: { id: selection.quotationId } })).grandTotal : 0,
          status: 'DRAFT',
        }
      });
    }

    const updated = await prisma.vendorSelection.update({
      where: { id },
      data: {
        currentLevel: nextLevel,
        status: nextStatus,
        history,
        timeline,
        auditLogs,
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

/**
 * POST /api/v1/approvals/:id/reject
 */
export async function rejectApproval(req, res, next) {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const userName = req.user.name;

    if (!comment || comment.length < 10) {
      return next(new AppError('Rejection reason is mandatory and must be at least 10 characters long', 400));
    }

    const selection = await prisma.vendorSelection.findUnique({
      where: { id },
    });

    if (!selection) {
      return next(new AppError('Approval not found', 404));
    }

    let history = Array.isArray(selection.history) ? selection.history : [];
    let timeline = Array.isArray(selection.timeline) ? selection.timeline : [];
    let auditLogs = Array.isArray(selection.auditLogs) ? selection.auditLogs : [];

    const currentLevelIndex = history.findIndex((h) => h.level === selection.currentLevel);
    if (currentLevelIndex !== -1) {
      history[currentLevelIndex].status = 'REJECTED';
      history[currentLevelIndex].date = new Date().toISOString();
      history[currentLevelIndex].remarks = comment;
      history[currentLevelIndex].approverName = userName;
    }

    timeline.push({
      action: `Rejected at Level ${selection.currentLevel}`,
      user: userName,
      timestamp: new Date().toISOString(),
      status: 'REJECTED',
      remarks: comment,
    });

    auditLogs.push({
      action: `Rejected Level ${selection.currentLevel}`,
      performedBy: userName,
      timestamp: new Date().toISOString(),
      remarks: comment,
    });

    // Update RFQ back to PUBLISHED/draft if needed, or close
    await prisma.rfq.update({
      where: { id: selection.rfqId },
      data: { status: 'PUBLISHED' }, // Reopen for other vendor quotes
    });

    const updated = await prisma.vendorSelection.update({
      where: { id },
      data: {
        status: 'REJECTED',
        history,
        timeline,
        auditLogs,
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

/**
 * POST /api/v1/approvals/:id/send-back
 */
export async function sendBackApproval(req, res, next) {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const userName = req.user.name;

    if (!comment || comment.length < 10) {
      return next(new AppError('Revision note is mandatory and must be at least 10 characters long', 400));
    }

    const selection = await prisma.vendorSelection.findUnique({
      where: { id },
    });

    if (!selection) {
      return next(new AppError('Approval not found', 404));
    }

    let history = Array.isArray(selection.history) ? selection.history : [];
    let timeline = Array.isArray(selection.timeline) ? selection.timeline : [];
    let auditLogs = Array.isArray(selection.auditLogs) ? selection.auditLogs : [];

    const currentLevelIndex = history.findIndex((h) => h.level === selection.currentLevel);
    if (currentLevelIndex !== -1) {
      history[currentLevelIndex].status = 'REVISED';
      history[currentLevelIndex].date = new Date().toISOString();
      history[currentLevelIndex].remarks = comment;
      history[currentLevelIndex].approverName = userName;
    }

    timeline.push({
      action: `Revision Requested at Level ${selection.currentLevel}`,
      user: userName,
      timestamp: new Date().toISOString(),
      status: 'REVISED',
      remarks: comment,
    });

    auditLogs.push({
      action: `Requested Revision Level ${selection.currentLevel}`,
      performedBy: userName,
      timestamp: new Date().toISOString(),
      remarks: comment,
    });

    // Reset RFQ back to PUBLISHED so vendor can edit or buyer can choose another vendor
    await prisma.rfq.update({
      where: { id: selection.rfqId },
      data: { status: 'PUBLISHED' },
    });

    const updated = await prisma.vendorSelection.update({
      where: { id },
      data: {
        status: 'REVISED',
        currentLevel: 1, // Resets level
        history,
        timeline,
        auditLogs,
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

/**
 * POST /api/v1/approvals/:id/remarks
 */
export async function updateRemarks(req, res, next) {
  try {
    const { id } = req.params;
    const { remarks = '', internalNotes = '' } = req.body;

    const selection = await prisma.vendorSelection.findUnique({
      where: { id },
    });

    if (!selection) {
      return next(new AppError('Approval not found', 404));
    }

    const updated = await prisma.vendorSelection.update({
      where: { id },
      data: {
        remarks,
        internalNotes,
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
