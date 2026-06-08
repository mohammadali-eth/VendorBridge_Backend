import { Router } from 'express';
import {
  getPurchaseOrders,
  getPurchaseOrder,
  updatePurchaseOrder,
  createInvoiceFromPo,
  getInvoices,
  getInvoice,
  updateInvoiceStatus,
  emailInvoice,
  downloadInvoicePdf,
} from './purchase-orders.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';

const poRouter = Router();
const invoiceRouter = Router();

// Protect all routes
poRouter.use(protect);
invoiceRouter.use(protect);

// Purchase Order Routes
poRouter.get('/', getPurchaseOrders);
poRouter.get('/:id', getPurchaseOrder);
poRouter.put('/:id', updatePurchaseOrder);
poRouter.post('/:id/invoice', createInvoiceFromPo);

// Invoice Routes
invoiceRouter.get('/', getInvoices);
invoiceRouter.get('/:id', getInvoice);
invoiceRouter.put('/:id/status', updateInvoiceStatus);
invoiceRouter.post('/:id/email', emailInvoice);
invoiceRouter.get('/:id/download', downloadInvoicePdf);

export { poRouter, invoiceRouter };
