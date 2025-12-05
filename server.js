const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors'); // Import the cors package

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // To parse JSON bodies
app.use(express.static(path.join(__dirname, '/'))); // Serve static files

// --- MongoDB Connection ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/PrimeExcellenceDB';

mongoose.connect(MONGO_URI)
    .then(() => console.log('Successfully connected to MongoDB.'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Badge Schema (for embedding) ---
const badgeSchema = new mongoose.Schema({
    type: String,
    game: Number,
    date: String,
    score: Number
});

// --- Mongoose Schema and Model ---
const studentSchema = new mongoose.Schema({
    studentId: { type: String, required: true, unique: true },
    name: String,
    class: String,
    sessions: { type: Number, default: 0 },
    badges: [badgeSchema],
    highScore: { type: Number, default: 0 },
    overallScore: { type: Number, default: 0 },
    timeSpent: { type: Map, of: Number, default: {} }
});

const Student = mongoose.model('Student', studentSchema);

// --- API Routes ---

// GET: Load a student's profile or create a new one
app.get('/api/students/:id', async (req, res) => {
    try {
        let student = await Student.findOne({ studentId: req.params.id });
        if (!student) {
            // If student doesn't exist, create a new one with default values
            student = new Student({
                studentId: req.params.id,
                name: `Student ${req.params.id}`, // Default name
                class: 'Orion Crew', // Default class
            });
            await student.save();
        }
        res.json(student);
    } catch (error) {
        res.status(500).json({ message: 'Error loading student profile', error });
    }
});

// DELETE: A student record (for admin and settings)
// This was moved from admin routes to here to fix a route conflict.
// It now correctly matches `/api/students/delete/:id` instead of `/api/students/:id`
app.delete('/api/students/:id', async (req, res) => {
    try {
        const result = await Student.findOneAndDelete({ studentId: req.params.id });
        if (!result) {
            return res.status(404).json({ message: 'Student not found.' });
        }
        res.status(200).json({ message: 'Student deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting student', error });
    }
});

// PUT: Update a student's profile
app.put('/api/students/:id', async (req, res) => {
    try {
        const updatedStudent = await Student.findOneAndUpdate(
            { studentId: req.params.id },
            req.body,
            { new: true, upsert: true } // `new` returns the updated doc, `upsert` creates if not found
        );
        res.json(updatedStudent);
    } catch (error) {
        res.status(500).json({ message: 'Error updating student data', error });
    }
});

// POST: Admin creates a new student
app.post('/api/admin/students', async (req, res) => {
    try {
        const { studentId, name, class: studentClass } = req.body;
        const newStudent = new Student({
            studentId,
            name,
            class: studentClass
        });
        await newStudent.save();
        res.status(201).json(newStudent);
    } catch (error) {
        res.status(500).json({ message: 'Error creating student', error });
    }
});

// POST: End a game session and save progress
app.post('/api/sessions', async (req, res) => {
    try {
        const { studentId, gameNum, score, misses, timeSpent } = req.body;

        const student = await Student.findOne({ studentId });
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        // Update stats
        student.sessions += 1;
        if (score > student.highScore) {
            student.highScore = score;
        }

        // Update time spent for the specific game
        const timeSpentKey = `game${gameNum}`;
        const existingTime = student.timeSpent.get(timeSpentKey) || 0;
        student.timeSpent.set(timeSpentKey, existingTime + timeSpent);

        let newBadge = null;
        // Badge logic: Award a badge if the score is over a certain threshold and a badge for this game doesn't already exist
        if (score > 20 && !student.badges.some(b => b.game === gameNum)) {
            newBadge = {
                type: `Master of Game ${gameNum}`,
                type: `Mission ${gameNum} Specialist`,
                game: gameNum,
                date: new Date().toLocaleDateString(),
                score: score
            };
            student.badges.push(newBadge);
        }

        // Recalculate overall score
        if (student.badges.length > 0) {
            const sumOfScores = student.badges.reduce((acc, badge) => acc + badge.score, 0);
            student.overallScore = Math.round(sumOfScores / student.badges.length);
        }

        await student.save();
        res.status(200).json({ student, newBadge });
    } catch (error) {
        res.status(500).json({ message: 'Error saving session data', error });
    }
});

// --- Admin Routes ---

// GET: All students for the admin panel
app.get('/api/admin/students', async (req, res) => {
    try {
        const allStudents = await Student.find({}).sort({ name: 1 });
        res.json(allStudents);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching all students', error });
    }
});

// GET: Leaderboard of top students by high score
app.get('/api/leaderboard', async (req, res) => {
    try {
        const topStudents = await Student.find().sort({ highScore: -1 }).limit(10);
        res.json(topStudents);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching leaderboard', error });
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});