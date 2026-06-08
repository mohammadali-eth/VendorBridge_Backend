export default function globalErrorHandler(err, req, res, _next) {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      stack: err.stack,
      error: err,
    });
  } else {
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    }

    console.error('SYSTEM ERROR 💥:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Something went wrong on our end. Please try again later.',
    });
  }
}

import { AppError } from '@vendorbridge/shared';
export { AppError };