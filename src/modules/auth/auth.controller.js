import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppError } from '@vendorbridge/shared';
import prisma from '../../config/db.js';

// Helper to generate tokens
function generateAccessToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
}

function generateRefreshToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
}

// Helper to send response with httpOnly cookie refresh token
function sendAuthResponse(user, statusCode, res) {
  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };

  res.cookie('refreshToken', refreshToken, cookieOptions);

  res.status(statusCode).json({
    status: 'success',
    data: {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        vendorId: user.vendorId,
      },
    },
  });
}

export async function register(req, res, next) {
  try {
    const { name, email, password, companyName, phone, industry, role } = req.body;

    if (!name || !email || !password || !role) {
      return next(new AppError('Required fields are missing', 400));
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return next(new AppError('User with this email already exists', 400));
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let user;

    if (role === 'SUPPLIER') {
      if (!companyName || !phone || !industry) {
        return next(new AppError('Supplier registration requires company information', 400));
      }

      // Create vendor profile
      const vendor = await prisma.vendor.create({
        data: {
          name: companyName,
          email,
          phone,
          address: 'Update pending',
          registrationNumber: `REG-${Math.floor(100000 + Math.random() * 900000)}`,
          status: 'PENDING',
        },
      });

      // Create supplier user
      user = await prisma.user.create({
        data: {
          name,
          email,
          password: passwordHash,
          role: 'SUPPLIER',
          vendorId: vendor.id,
        },
      });
    } else {
      // Create admin, buyer, or procurement manager user
      user = await prisma.user.create({
        data: {
          name,
          email,
          password: passwordHash,
          role,
        },
      });
    }

    sendAuthResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return next(new AppError('Incorrect email or password', 401));
    }

    sendAuthResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
}

export async function refreshToken(req, res, next) {
  try {
    const token = req.cookies.refreshToken;

    if (!token) {
      return next(new AppError('Refresh token is missing. Please log in again.', 401));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      return next(new AppError('Invalid or expired refresh token. Please log in again.', 401));
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, role: true, vendorId: true },
    });

    if (!user) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    sendAuthResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new AppError('Please provide email address', 400));
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Secure practice: return 200 even if email doesn't exist to prevent enumeration
      return res.status(200).json({
        status: 'success',
        message: 'Check your email for reset instructions.',
      });
    }

    // Generate short-lived reset token (15 mins) using JWT
    const resetToken = jwt.sign({ id: user.id }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: '15m',
    });

    const resetLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;

    // Log the link in console for dev visibility
    console.log('\n--- PASSWORD RESET REQUEST ---');
    console.log(`User: ${email}`);
    console.log(`Link: ${resetLink}`);
    console.log('------------------------------\n');

    res.status(200).json({
      status: 'success',
      message: 'Check your email for reset instructions.',
      // Expose reset link in development mode to make manual/auto testing simpler
      devResetLink: process.env.NODE_ENV !== 'production' ? resetLink : undefined,
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token || !password) {
      return next(new AppError('Reset token and password are required', 400));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch {
      return next(new AppError('Reset token is invalid or has expired', 400));
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: decoded.id },
      data: { password: passwordHash },
    });

    res.status(200).json({
      status: 'success',
      message: 'Password updated successfully.',
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req, res, next) {
  try {
    res.status(200).json({
      status: 'success',
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    next(error);
  }
}