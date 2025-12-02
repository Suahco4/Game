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
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/Gamedb';

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
    overallScore: { type: Number, default: 0 }
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
                class: 'Fun Class', // Default class
            });
            await student.save();
        }
        res.json(student);
    } catch (error) {
        res.status(500).json({ message: 'Error loading student profile', error });
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