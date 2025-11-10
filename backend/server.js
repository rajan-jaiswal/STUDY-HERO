

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
const userRoutes = require('./src/routes/userRoutes');
const courseRoutes = require('./src/routes/courseRoutes');
const assignmentRoutes = require('./src/routes/assignmentRoutes');
const quizRoutes = require('./src/routes/quizRoutes');
app.use('/api/quiz', quizRoutes);

const authRoutes = require('./src/routes/authRoutes');
app.use('/api/auth', authRoutes);

// Code execution routes (disabled: missing implementation)


// Use routes
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/assignments', assignmentRoutes);


// Default route
app.get('/', (req, res) => {
    res.send('Study Hero API is running! 🚀');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('Available routes:');
    console.log('- POST /api/users/register');
    console.log('- POST /api/users/login');
    console.log('- GET /api/courses');
    console.log('- POST /api/courses');
    console.log('- GET /api/assignments/course/:courseId');
    console.log('- POST /api/assignments');
});