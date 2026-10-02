const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');

// Generate JWT token
const generateToken = (id, role, email) => {
  return jwt.sign({ id, role, email }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Authenticate User & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    let { email, password } = req.body;
    if (email) email = email.toLowerCase().trim();


    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { clientInfo: true }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Send login alert to OWNER (security monitoring)
    const { sendLoginAlert } = require('../services/emailService');
    const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } });
    if (owner && user.role !== 'OWNER') {
      sendLoginAlert(owner, user).catch(err => console.error('Failed to send login alert:', err));
    }

    const newToken = generateToken(user.id, user.role, user.email);

    // Enforce max 3 devices by tracking activeTokens
    let activeTokens = user.activeTokens || [];
    activeTokens.push(newToken);
    if (activeTokens.length > 3) {
      activeTokens = activeTokens.slice(activeTokens.length - 3);
    }
    
    await prisma.user.update({
      where: { id: user.id },
      data: { activeTokens }
    });

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      permissions: user.permissions || [],
      clientInfo: user.clientInfo,
      token: newToken,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { 
        clientInfo: true,
        teamMemberInfo: {
          include: {
            tasks: { where: { status: 'DELIVERED' } }
          }
        },
        expenses: true,
        bonuses: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'TEAM' || user.role === 'ADMIN' || user.role === 'OWNER') {
      const tm = user.teamMemberInfo || {};
      const totalPaid = user.expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
      const monthlySalary = tm.monthlySalary || 0;
      const totalBonuses = user.bonuses?.reduce((sum, b) => sum + (b.amount || 0), 0) || 0;
        
      let lifetimeVideos = 0;
      let avgDeliveryMs = 0;
      if (tm.tasks && tm.tasks.length > 0) {
        lifetimeVideos = tm.tasks.length;
        const totalMs = tm.tasks.reduce((sum, t) => sum + (new Date(t.updatedAt) - new Date(t.createdAt)), 0);
        avgDeliveryMs = totalMs / lifetimeVideos;
      }
      
      const avgDeliveryHours = (avgDeliveryMs / (1000 * 60 * 60)).toFixed(1);

      user.performance = {
        lifetimeVideos,
        averageDeliveryHours: avgDeliveryHours
      };

      user.finance = {
        totalSalary: monthlySalary,
        earnedBonuses: totalBonuses,
        paid: totalPaid,
        remaining: Math.max(0, (monthlySalary + totalBonuses) - totalPaid)
      };
    }

    // Exclude password from response
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    next(error);
  }
};

// @desc    Update current user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    let { firstName, lastName, email, currentPassword, newPassword, company, phone, logoUrl } = req.body;
    if (email) email = email.toLowerCase().trim();


    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const dataToUpdate = { firstName, lastName, email };

    if (req.body.avatarUrl !== undefined) {
      dataToUpdate.avatarUrl = req.body.avatarUrl;
    }

    // Role Change Protection - Only OWNER can change roles (including their own if they want, but usually for others)
    if (req.body.role && req.user.role === 'OWNER') {
      dataToUpdate.role = req.body.role;
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to set a new password' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid current password' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
      }

      const salt = await bcrypt.genSalt(10);
      dataToUpdate.password = await bcrypt.hash(newPassword, salt);
    }

    // Email Change Protection
    // As per requirements: "email is a red line and requires admin approval", except for OWNER
    if (email && email !== user.email && req.user.role !== 'OWNER') {
      return res.status(403).json({ 
        message: 'Email address cannot be changed directly. Please contact an Administrator to update your email.' 
      });
    }

    if (email && email !== user.email && req.user.role === 'OWNER') {
      const emailExists = await prisma.user.findUnique({ where: { email } });
      if (emailExists && emailExists.id !== req.user.id) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: dataToUpdate,
      include: { clientInfo: true } // Include clientInfo to return updated data
    });

    // If user is a CLIENT, also update their Client record if fields are provided
    if (updatedUser.role === 'CLIENT' && updatedUser.clientInfo && (company !== undefined || phone !== undefined || logoUrl !== undefined)) {
      await prisma.client.update({
        where: { id: updatedUser.clientInfo.id },
        data: {
          ...(company !== undefined && { company }),
          ...(phone !== undefined && { phone }),
          ...(logoUrl !== undefined && { logoUrl }),
        }
      });
      // Re-fetch to get the fully updated record
      const finalUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { clientInfo: true },
        select: {
          id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true, permissions: true, createdAt: true, clientInfo: true
        }
      });
      return res.json(finalUser);
    }

    // Explicitly select fields if no client update occurred
    const { password: _p, ...userWithoutPassword } = updatedUser;
    
    res.json(userWithoutPassword);
  } catch (error) {
    next(error);
  }
};

// @desc    Logout User & remove token
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res, next) => {
  try {
    let token = '';
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
       token = req.headers.authorization.split(' ')[1];
    }
    
    if (req.user && token) {
       const user = await prisma.user.findUnique({ where: { id: req.user.id } });
       if (user) {
         const activeTokens = (user.activeTokens || []).filter(t => t !== token);
         await prisma.user.update({
           where: { id: user.id },
           data: { activeTokens }
         });
       }
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { login, getProfile, updateProfile, logout };
