const prisma = require('../prismaClient');
const bcrypt = require('bcryptjs');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        clientInfo: true,
        teamMemberInfo: true
      }
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new user (Client or Team Member)
// @route   POST /api/users
// @access  Private/Admin
const createUser = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, role, company, phone, position, avatarUrl } = req.body;

    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role,
        avatarUrl,
      },
    });

    // If role is CLIENT, create client record
    if (role === 'CLIENT') {
      await prisma.client.create({
        data: { 
          userId: user.id, 
          company, 
          phone,
          isVip: req.body.isVip || false,
          tier: req.body.tier || 'REGULAR',
          logoUrl: req.body.logoUrl
        },
      });
    }

    // If role is TEAM, create team member record
    if (role === 'TEAM') {
      await prisma.teamMember.create({
        data: { userId: user.id, position },
      });
    }

    res.status(201).json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

module.exports = { getUsers, createUser, deleteUser };
