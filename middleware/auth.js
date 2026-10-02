const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, activeTokens: true }
      });
      
      // If token is not in activeTokens, it was evicted by max devices limit, or logged out
      if (user && user.activeTokens && user.activeTokens.length > 0) {
        if (!user.activeTokens.includes(token)) {
           return res.status(401).json({ message: 'Session expired. Logged in from another device.' });
        }
      }
      
      // Attach the user context to the request
      req.user = {
        id: decoded.id,
        role: decoded.role,
        email: decoded.email
      };
      
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    // OWNER has unrestricted access
    if (req.user.role === 'OWNER') {
      return next();
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized for this role' });
    }
    next();
  };
};

const admin = authorize('ADMIN', 'OWNER');

module.exports = { protect, authorize, admin };
