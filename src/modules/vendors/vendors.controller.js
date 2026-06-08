import prisma from '../../config/db.js';
import { AppError } from '@vendorbridge/shared';

// Helper to validate GSTIN format
function isValidGST(gst) {
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstRegex.test(gst);
}

// Helper to validate Email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * GET /api/v1/vendors
 * Fetch all vendors with search, filtering, and pagination
 */
export async function getVendors(req, res, next) {
  try {
    const {
      search = '',
      status,
      category,
      state,
      city,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Build query filters
    const where = {};

    // Global Search
    if (search.trim()) {
      const searchString = search.trim();
      where.OR = [
        { name: { contains: searchString, mode: 'insensitive' } },
        { email: { contains: searchString, mode: 'insensitive' } },
        { phone: { contains: searchString, mode: 'insensitive' } },
        { code: { contains: searchString, mode: 'insensitive' } },
        { gstNumber: { contains: searchString, mode: 'insensitive' } },
        { contactPerson: { contains: searchString, mode: 'insensitive' } }
      ];
    }

    // Status Filter
    if (status) {
      where.status = status;
    }

    // Category Filter
    if (category) {
      where.category = category;
    }

    // State Filter
    if (state) {
      where.state = { contains: state, mode: 'insensitive' };
    }

    // City Filter
    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    // Fetch records
    const [vendors, total] = await prisma.$transaction([
      prisma.vendor.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: {
          [sortBy]: sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc'
        }
      }),
      prisma.vendor.count({ where })
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        vendors,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/vendors/categories
 * Get list of standard vendor categories
 */
export async function getCategories(req, res, next) {
  try {
    const categories = ['Manufacturer', 'Distributor', 'Service Provider', 'Contractor', 'Consultant'];
    res.status(200).json({
      status: 'success',
      data: categories
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/vendors/statuses
 * Get list of vendor status codes
 */
export async function getStatuses(req, res, next) {
  try {
    const statuses = ['ACTIVE', 'PENDING', 'INACTIVE', 'BLOCKED'];
    res.status(200).json({
      status: 'success',
      data: statuses
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/vendors/:id
 * Get single vendor details and associated dashboard statistics
 */
export async function getVendorById(req, res, next) {
  try {
    const { id } = req.params;

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        pos: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            poNumber: true,
            totalAmount: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    if (!vendor) {
      return next(new AppError('Vendor not found', 404));
    }

    // Calculate spend statistics
    const poStats = await prisma.purchaseOrder.aggregate({
      where: {
        vendorId: id,
        status: { in: ['SENT', 'ACCEPTED', 'DELIVERED'] }
      },
      _sum: {
        totalAmount: true
      },
      _count: {
        id: true
      }
    });

    const totalOrders = poStats._count.id || 0;
    const totalSpend = Number(poStats._sum.totalAmount || 0);

    // Dynamic compliance documents list (empty initially as no files are uploaded/verified yet)
    const documents = [];

    // Query real Invoices from PostgreSQL
    const dbInvoices = await prisma.invoice.findMany({
      where: { vendorId: id },
      orderBy: { createdAt: 'desc' }
    });

    const invoices = dbInvoices.map(inv => ({
      id: inv.id,
      invoiceNo: inv.invoiceNumber,
      amount: Number(inv.totalAmount),
      status: inv.status === 'PAID' ? 'Paid' : inv.status === 'OVERDUE' ? 'Overdue' : 'Pending',
      date: inv.createdAt.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    }));

    res.status(200).json({
      status: 'success',
      data: {
        vendor,
        metrics: {
          totalOrders,
          totalSpend,
        },
        documents,
        invoices
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/vendors
 * Create a new vendor record
 */
export async function createVendor(req, res, next) {
  try {
    const {
      name,
      code,
      category,
      type,
      registrationNumber,
      gstNumber,
      panNumber,
      taxDetails,
      contactPerson,
      designation,
      email,
      phone,
      alternatePhone,
      addressLine1,
      addressLine2,
      city,
      state,
      country,
      pincode,
      status = 'PENDING'
    } = req.body;

    // 1. Validation
    if (!name || !category || !gstNumber || !contactPerson || !email) {
      return next(new AppError('Required fields (Name, Category, GST, Contact, Email) are missing', 400));
    }

    if (!isValidEmail(email)) {
      return next(new AppError('Invalid email format', 400));
    }

    if (!isValidGST(gstNumber)) {
      return next(new AppError('Invalid GSTIN format (e.g. 27AAAAA1111A1Z1)', 400));
    }

    // 2. Duplicate Detection
    const existingEmail = await prisma.vendor.findFirst({ where: { email } });
    if (existingEmail) {
      return next(new AppError('A vendor with this email already exists', 400));
    }

    const existingGST = await prisma.vendor.findFirst({ where: { gstNumber } });
    if (existingGST) {
      return next(new AppError('A vendor with this GSTIN already exists', 400));
    }

    if (registrationNumber) {
      const existingReg = await prisma.vendor.findFirst({ where: { registrationNumber } });
      if (existingReg) {
        return next(new AppError('A vendor with this registration number already exists', 400));
      }
    }

    // Auto-generate code if not provided
    const vendorCode = code || `VND-${Math.floor(1000 + Math.random() * 9000)}`;

    const newVendor = await prisma.vendor.create({
      data: {
        name,
        email,
        phone: phone || '',
        address: `${addressLine1 || ''}, ${city || ''}, ${state || ''}`,
        registrationNumber: registrationNumber || `REG-${Date.now()}`,
        status,
        code: vendorCode,
        category,
        type: type || 'Manufacturer',
        gstNumber,
        panNumber: panNumber || '',
        taxDetails: taxDetails || '',
        contactPerson,
        designation: designation || '',
        alternatePhone: alternatePhone || '',
        addressLine1: addressLine1 || '',
        addressLine2: addressLine2 || '',
        city: city || '',
        state: state || '',
        country: country || 'India',
        pincode: pincode || ''
      }
    });

    res.status(201).json({
      status: 'success',
      data: newVendor
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/vendors/:id
 * Update an existing vendor record
 */
export async function updateVendor(req, res, next) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existingVendor = await prisma.vendor.findUnique({ where: { id } });
    if (!existingVendor) {
      return next(new AppError('Vendor not found', 404));
    }

    // Perform validation if key fields are updated
    if (updateData.email && updateData.email !== existingVendor.email) {
      if (!isValidEmail(updateData.email)) {
        return next(new AppError('Invalid email format', 400));
      }
      const duplicateEmail = await prisma.vendor.findFirst({ where: { email: updateData.email } });
      if (duplicateEmail) {
        return next(new AppError('Another vendor with this email already exists', 400));
      }
    }

    if (updateData.gstNumber && updateData.gstNumber !== existingVendor.gstNumber) {
      if (!isValidGST(updateData.gstNumber)) {
        return next(new AppError('Invalid GSTIN format', 400));
      }
      const duplicateGST = await prisma.vendor.findFirst({ where: { gstNumber: updateData.gstNumber } });
      if (duplicateGST) {
        return next(new AppError('Another vendor with this GSTIN already exists', 400));
      }
    }

    if (updateData.registrationNumber && updateData.registrationNumber !== existingVendor.registrationNumber) {
      const duplicateReg = await prisma.vendor.findFirst({ where: { registrationNumber: updateData.registrationNumber } });
      if (duplicateReg) {
        return next(new AppError('Another vendor with this registration number already exists', 400));
      }
    }

    // Compose address field for legacy compatibility
    const address = `${updateData.addressLine1 || existingVendor.addressLine1 || ''}, ${updateData.city || existingVendor.city || ''}, ${updateData.state || existingVendor.state || ''}`;

    const updatedVendor = await prisma.vendor.update({
      where: { id },
      data: {
        ...updateData,
        address
      }
    });

    res.status(200).json({
      status: 'success',
      data: updatedVendor
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/vendors/:id
 * Delete a vendor record
 */
export async function deleteVendor(req, res, next) {
  try {
    const { id } = req.params;

    const existingVendor = await prisma.vendor.findUnique({ where: { id } });
    if (!existingVendor) {
      return next(new AppError('Vendor not found', 404));
    }

    // Run transaction to clean up all vendor-related records to avoid constraint violations
    await prisma.$transaction([
      prisma.invoice.deleteMany({ where: { vendorId: id } }),
      prisma.purchaseOrder.deleteMany({ where: { vendorId: id } }),
      prisma.vendorSelection.deleteMany({ where: { vendorId: id } }),
      prisma.quotation.deleteMany({ where: { vendorId: id } }),
      prisma.user.deleteMany({ where: { vendorId: id } }),
      prisma.vendor.delete({ where: { id } }),
    ]);

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/vendors/bulk-update
 * Bulk status updates for selected vendors
 */
export async function bulkUpdateVendors(req, res, next) {
  try {
    const { ids, status } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0 || !status) {
      return next(new AppError('Invalid request parameters. Vendor IDs array and Status are required.', 400));
    }

    await prisma.vendor.updateMany({
      where: {
        id: { in: ids }
      },
      data: {
        status
      }
    });

    res.status(200).json({
      status: 'success',
      message: `${ids.length} vendors status updated successfully`
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/vendors/bulk-delete
 * Bulk delete operation for selected vendors
 */
export async function bulkDeleteVendors(req, res, next) {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return next(new AppError('Invalid request parameters. Vendor IDs array is required.', 400));
    }

    // Run transaction to bulk delete related records to avoid constraint violations
    await prisma.$transaction([
      prisma.invoice.deleteMany({ where: { vendorId: { in: ids } } }),
      prisma.purchaseOrder.deleteMany({ where: { vendorId: { in: ids } } }),
      prisma.vendorSelection.deleteMany({ where: { vendorId: { in: ids } } }),
      prisma.quotation.deleteMany({ where: { vendorId: { in: ids } } }),
      prisma.user.deleteMany({ where: { vendorId: { in: ids } } }),
      prisma.vendor.deleteMany({ where: { id: { in: ids } } }),
    ]);

    res.status(200).json({
      status: 'success',
      message: `${ids.length} vendors deleted successfully`
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/vendors/import
 * Bulk import vendors from a CSV payload
 */
export async function importVendors(req, res, next) {
  try {
    const { vendors } = req.body;
    if (!Array.isArray(vendors)) {
      return next(new AppError('Invalid request payload. Expected an array of vendors.', 400));
    }
    
    const results = {
      successCount: 0,
      failCount: 0,
      errors: []
    };
    
    for (let i = 0; i < vendors.length; i++) {
      const v = vendors[i];
      const name = v.name || v.VendorName || v['Vendor Name'];
      const email = v.email || v.Email;
      const gstNumber = v.gstNumber || v.gst || v.GSTIN || v['GST Number'] || v['GSTIN'];
      const contactPerson = v.contactPerson || v.contact || v['Contact Person'];
      const category = v.category || v.Category || 'Manufacturer';
      const type = v.type || v.Type || 'Manufacturer';
      const phone = v.phone || v.Phone || '';
      const addressLine1 = v.addressLine1 || v.address || v.Address || '';
      const city = v.city || v.City || '';
      const state = v.state || v.State || '';
      const status = v.status || v.Status || 'PENDING';
      const registrationNumber = v.registrationNumber || v['Registration Number'] || `REG-${Date.now()}-${i}`;
      
      if (!name || !gstNumber || !contactPerson || !email) {
        results.failCount++;
        results.errors.push(`Row ${i + 1}: Required fields missing`);
        continue;
      }
      
      if (!isValidEmail(email)) {
        results.failCount++;
        results.errors.push(`Row ${i + 1}: Invalid email format (${email})`);
        continue;
      }
      
      if (!isValidGST(gstNumber)) {
        results.failCount++;
        results.errors.push(`Row ${i + 1}: Invalid GSTIN format (${gstNumber})`);
        continue;
      }
      
      // Duplicate check
      const existingEmail = await prisma.vendor.findFirst({ where: { email } });
      const existingGST = await prisma.vendor.findFirst({ where: { gstNumber } });
      
      if (existingEmail || existingGST) {
        results.failCount++;
        results.errors.push(`Row ${i + 1}: Vendor with this email/GSTIN already exists`);
        continue;
      }
      
      const vendorCode = v.code || v.Code || `VND-${Math.floor(1000 + Math.random() * 9000)}`;
      
      await prisma.vendor.create({
        data: {
          name,
          email,
          phone,
          address: `${addressLine1}, ${city}, ${state}`,
          registrationNumber,
          status,
          code: vendorCode,
          category,
          type,
          gstNumber: gstNumber.toUpperCase(),
          panNumber: v.panNumber || v['PAN Number'] || '',
          taxDetails: v.taxDetails || '',
          contactPerson,
          designation: v.designation || '',
          alternatePhone: v.alternatePhone || '',
          addressLine1,
          addressLine2: v.addressLine2 || '',
          city,
          state,
          country: v.country || 'India',
          pincode: v.pincode || '',
        }
      });
      
      results.successCount++;
    }
    
    res.status(200).json({
      status: 'success',
      data: results
    });
  } catch (error) {
    next(error);
  }
}
