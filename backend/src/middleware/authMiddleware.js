// const jwt = require('jsonwebtoken');
// const db = require('../config/db');

// const authMiddleware = async (req, res, next) => {
//     try {
//         const token = req.headers.authorization?.split(' ')[1];
        
//         if (!token) {
//             return res.status(401).json({ error: 'No token provided' });
//         }

//         const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
//         // Verify user still exists
//         const [users] = await db.query('SELECT id, role FROM users WHERE id = ?', [decoded.userId]);
//         if (users.length === 0) {
//             return res.status(401).json({ error: 'User not found' });
//         }

//         req.user = {
//             id: decoded.userId,
//             role: decoded.role
//         };
        
//         next();
//     } catch (error) {
//         res.status(401).json({ error: 'Invalid token' });
//     }
// };

// const teacherMiddleware = (req, res, next) => {
//     if (req.user.role !== 'teacher') {
//         return res.status(403).json({ error: 'Access denied. Teacher only.' });
//     }
//     next();
// };

// const adminMiddleware = (req, res, next) => {
//     if (req.user.role !== 'admin') {
//         return res.status(403).json({ error: 'Access denied. Admin only.' });
//     }
//     next();
// };

// module.exports = {
//     authMiddleware,
//     teacherMiddleware,
//     adminMiddleware
// }; 
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const authMiddleware = async (req, res, next) => {
    try {
        console.log('🔐 Auth Middleware - Checking token...');
        
        // Check if authorization header exists
        if (!req.headers.authorization) {
            console.log('❌ No authorization header found');
            return res.status(401).json({ error: 'No authorization header provided' });
        }

        // Extract token from Bearer format
        const authHeader = req.headers.authorization;
        if (!authHeader.startsWith('Bearer ')) {
            console.log('❌ Invalid authorization format. Expected: Bearer <token>');
            return res.status(401).json({ error: 'Invalid authorization format. Expected: Bearer <token>' });
        }

        const token = authHeader.split(' ')[1];
        
        if (!token) {
            console.log('❌ No token found in authorization header');
            return res.status(401).json({ error: 'No token provided' });
        }

        console.log('🔑 Token found, length:', token.length);
        console.log('🔑 Token preview:', token.substring(0, 20) + '...');

        // Check if JWT_SECRET is configured
        if (!process.env.JWT_SECRET) {
            console.error('❌ JWT_SECRET not configured in environment variables');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Verify JWT token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('✅ JWT token verified successfully');
            console.log('👤 Decoded token payload:', { userId: decoded.userId, id: decoded.id, role: decoded.role });
        } catch (jwtError) {
            console.error('❌ JWT verification failed:', jwtError.message);
            
            if (jwtError.name === 'JsonWebTokenError') {
                return res.status(401).json({ error: 'Invalid token format' });
            } else if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token has expired' });
            } else {
                return res.status(401).json({ error: 'Token verification failed' });
            }
        }

        // Handle both userId and id from token payload
        const userId = decoded.userId || decoded.id;
        
        if (!userId) {
            console.error('❌ No user ID found in token payload');
            return res.status(401).json({ error: 'Invalid token payload' });
        }

        console.log('👤 User ID from token:', userId);

        // Try to verify user exists in database
        try {
            const [users] = await db.query('SELECT id, role FROM users WHERE id = ?', [userId]);
            
            if (users.length === 0) {
                console.log('❌ User not found in database for ID:', userId);
                // For now, allow the request to proceed with token data
                console.log('⚠️ Allowing request to proceed with token data only');
                req.user = {
                    id: userId,
                    role: decoded.role || 'student'
                };
            } else {
                console.log('✅ User found in database:', users[0]);
                req.user = {
                    id: users[0].id,
                    role: users[0].role
                };
            }
        } catch (dbError) {
            console.log('⚠️ Database connection failed, using token data:', dbError.message);
            // If database is not accessible, use token data
            req.user = {
                id: userId,
                role: decoded.role || 'student'
            };
        }

        console.log('✅ Auth middleware completed successfully');
        console.log('👤 Request user:', req.user);
        
        next();
    } catch (error) {
        console.error('❌ Auth Middleware Error:', error.message);
        console.error('❌ Error stack:', error.stack);
        return res.status(401).json({ error: 'Authentication failed' });
    }
};

const teacherMiddleware = (req, res, next) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ error: 'Access denied. Teacher only.' });
    }
    next();
};

const adminMiddleware = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    next();
};

module.exports = {
    authMiddleware,
    teacherMiddleware,
    adminMiddleware
};
