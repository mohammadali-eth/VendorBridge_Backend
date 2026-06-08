import prisma from '../../config/db.js';
import bcrypt from 'bcrypt';
import { AppError } from '@vendorbridge/shared';

/**
 * GET /api/v1/users
 * Get all users
 */
export async function getUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      }
    });

    res.status(200).json({
      status: 'success',
      data: users,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/users
 * Create a new user
 */
export async function createUser(req, res, next) {
  try {
    const { name, email, role, status } = req.body;

    if (!name || !email) {
      return next(new AppError('Name and email are required', 400));
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return next(new AppError('Email already in use', 400));
    }

    const passwordHash = await bcrypt.hash('password123', 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        role,
        status: status || 'ACTIVE',
        password: passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      }
    });

    res.status(201).json({
      status: 'success',
      data: newUser,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/users/:id/toggle-status
 * Toggle user ACTIVE/INACTIVE status
 */
export async function toggleUserStatus(req, res, next) {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status: nextStatus },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      }
    });

    res.status(200).json({
      status: 'success',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/users/:id
 * Delete a user
 */
export async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Delete user
    await prisma.user.delete({
      where: { id },
    });

    res.status(200).json({
      status: 'success',
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}
