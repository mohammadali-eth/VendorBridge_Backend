import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { AppError } from './utils/appError.js';
import globalErrorHandler from './middlewares/error.middleware.js';

import authRouter from './modules/auth/auth.routes.js';
import dashboardRouter from './modules/dashboard/dashboard.routes.js';
import vendorRouter from './modules/vendors/vendors.routes.js';
import rfqRouter from './modules/rfq/rfq.routes.js';
import quotationsRouter from './modules/quotations/quotations.routes.js';
import approvalsRouter from './modules/approvals/approvals.routes.js';
import { poRouter, invoiceRouter } from './modules/purchase-orders/purchase-orders.routes.js';
import activityRouter from './modules/activity/activity.routes.js';
import reportsRouter from './modules/reports/reports.routes.js';
import usersRouter from './modules/users/users.routes.js';
import { createVendorSelection } from './modules/rfq/rfq.controller.js';
import { protect } from './middlewares/auth.middleware.js';

const app = express();

// Security HTTP headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 10000 : 1000,
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/api', limiter);

// Body parsers
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Compression
app.use(compression());

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/vendors', vendorRouter);
app.use('/api/v1/rfqs', rfqRouter);
app.use('/api/v1/quotations', quotationsRouter);
app.use('/api/v1/approvals', approvalsRouter);
app.use('/api/v1/purchase-orders', poRouter);
app.use('/api/v1/invoices', invoiceRouter);
app.use('/api/v1/activity', activityRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/users', usersRouter);
app.post('/api/v1/vendor-selection', protect, createVendorSelection);
app.use('/api/v1/users', usersRouter);
app.post('/api/v1/vendor-selection', protect, createVendorSelection);

// Serve mock exports files dynamically
app.get('/exports/:filename', (req, res) => {
  const { filename } = req.params;
  const ext = filename.split('.').pop().toLowerCase();
  
  if (ext === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
  } else if (ext === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
  } else if (ext === 'xlsx' || ext === 'xls') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  } else {
    res.setHeader('Content-Type', 'application/octet-stream');
  }
  
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  
  if (ext === 'csv') {
    res.send(`Report Title,${filename.split('.')[0].replace(/-/g, ' ')}\nGenerated At,${new Date().toISOString()}\nStatus,COMPLETED\n\nMetric,Value\nTotal Spend,1500000\nActive Vendors,45\nPending Approvals,3`);
  } else if (ext === 'pdf') {
    const pdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 120 >>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(VendorBridge Procurement Report) Tj\n0 -40 Td\n/F1 14 Tf\n(Generated Mock File: ${filename}) Tj\n0 -20 Td\n(Status: COMPLETED) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\n0000000244 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n414\n%%EOF`;
    res.send(Buffer.from(pdfContent, 'utf-8'));
  } else {
    res.send(`Mock report data for ${filename}`);
  }
});

// Serve mock exports files dynamically
app.get('/exports/:filename', (req, res) => {
  const { filename } = req.params;
  const ext = filename.split('.').pop().toLowerCase();
  
  if (ext === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
  } else if (ext === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
  } else if (ext === 'xlsx' || ext === 'xls') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  } else {
    res.setHeader('Content-Type', 'application/octet-stream');
  }
  
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  
  if (ext === 'csv') {
    res.send(`Report Title,${filename.split('.')[0].replace(/-/g, ' ')}\nGenerated At,${new Date().toISOString()}\nStatus,COMPLETED\n\nMetric,Value\nTotal Spend,1500000\nActive Vendors,45\nPending Approvals,3`);
  } else if (ext === 'pdf') {
    const pdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 120 >>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(VendorBridge Procurement Report) Tj\n0 -40 Td\n/F1 14 Tf\n(Generated Mock File: ${filename}) Tj\n0 -20 Td\n(Status: COMPLETED) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\n0000000244 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n414\n%%EOF`;
    res.send(Buffer.from(pdfContent, 'utf-8'));
  } else {
    res.send(`Mock report data for ${filename}`);
  }
});

// Catch-all route for undefined paths
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Centralized error handling middleware
app.use(globalErrorHandler);

export default app;
