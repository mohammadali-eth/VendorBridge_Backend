import prisma from '../../config/db.js';
import { AppError } from '../../middlewares/error.middleware.js';

/**
 * GET /api/v1/activity/timeline
 */
export async function getTimeline(req, res, next) {
  try {
    const { module } = req.query;

    const query = {};
    if (module && module !== 'ALL') {
      query.module = module;
    }

    const logs = await prisma.auditLog.findMany({
      where: query,
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      data: logs,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/activity/notifications
 */
export async function getNotifications(req, res, next) {
  try {
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/activity/notifications/:id/read
 */
export async function markAsRead(req, res, next) {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    res.status(200).json({
      status: 'success',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/activity/notifications/read-all
 */
export async function markAllAsRead(req, res, next) {
  try {
    await prisma.notification.updateMany({
      where: { read: false },
      data: { read: true },
    });

    res.status(200).json({
      status: 'success',
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/activity/notifications/:id
 * Clear notification
 */
export async function deleteNotification(req, res, next) {
  try {
    const { id } = req.params;

    await prisma.notification.delete({
      where: { id },
    });

    res.status(200).json({
      status: 'success',
      message: 'Notification cleared',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/activity/audit-logs
 */
export async function getAuditLogs(req, res, next) {
  try {
    const { search, module, startDate, endDate } = req.query;

    const andConditions = [];

    if (module && module !== 'ALL') {
      andConditions.push({ module });
    }

    if (search) {
      andConditions.push({
        OR: [
          { user: { contains: search, mode: 'insensitive' } },
          { entity: { contains: search, mode: 'insensitive' } },
          { action: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (startDate) {
      andConditions.push({ createdAt: { gte: new Date(startDate) } });
    }

    if (endDate) {
      // Set end date to end of day
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      andConditions.push({ createdAt: { lte: end } });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      data: logs,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Helper to record audit log programmatically
 */
export async function createAuditEntry({ user, module, action, entity, status = 'Success', ipAddress = '192.168.1.10' }) {
  try {
    const lastLog = await prisma.auditLog.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    const nextIndex = lastLog ? parseInt(lastLog.logId.split('-')[1]) + 1 : 1;
    const logId = `LOG-${String(nextIndex).padStart(3, '0')}`;

    return await prisma.auditLog.create({
      data: {
        logId,
        user,
        module,
        action,
        entity,
        status,
        ipAddress,
      },
    });
  } catch (error) {
    console.error('Failed to create audit entry:', error);
  }
}
