const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware - FIXED: Use express.json() instead of body-parser
app.use(cors());
app.use(express.json()); // This is the key fix!

// Database file path
const DB_FILE = path.join(__dirname, 'database.json');
console.log('Database file path:', DB_FILE);

// Initialize database if it doesn't exist
function initializeDatabase() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            console.log('Creating new database file...');
            const initialData = {
                passes: [],
                students: [
                    { id: 1, name: "John Doe", studentId: "S001" },
                    { id: 2, name: "Jane Smith", studentId: "S002" },
                    { id: 3, name: "Mike Johnson", studentId: "S003" }
                ]
            };
            fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
            console.log('Database initialized successfully');
        } else {
            console.log('Database file already exists');
        }
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// Read database with error handling
function readDatabase() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading database:', error);
        return { passes: [], students: [] };
    }
}

// Write to database with error handling
function writeDatabase(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing to database:', error);
        throw error;
    }
}

// Initialize database on server start
initializeDatabase();

// Test route
app.get('/', (req, res) => {
    res.json({ 
        message: 'Gate Pass System API is working!',
        endpoints: {
            'GET /api/passes': 'Get all passes',
            'POST /api/passes': 'Create new pass',
            'PUT /api/passes/:id': 'Update pass status', 
            'GET /api/verify-pass/:id': 'Verify pass'
        }
    });
});

// Get all passes
app.get('/api/passes', (req, res) => {
    try {
        const db = readDatabase();
        res.json(db.passes);
    } catch (error) {
        console.error('Error in GET /api/passes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new pass request - FIXED: Added proper error handling for req.body
app.post('/api/passes', (req, res) => {
    try {
        console.log('Received request body:', req.body);
        
        // Check if req.body exists
        if (!req.body) {
            return res.status(400).json({ error: 'Request body is missing' });
        }

        const { studentId, reason, outTime, inTime } = req.body;
        
        if (!studentId || !reason) {
            return res.status(400).json({ 
                error: 'Student ID and reason are required',
                received: { studentId, reason }
            });
        }

        const db = readDatabase();
        const student = db.students.find(s => s.studentId === studentId);
        
        if (!student) {
            return res.status(404).json({ 
                error: 'Student not found',
                availableStudents: db.students.map(s => s.studentId)
            });
        }

        const newPass = {
            id: Date.now(),
            studentId,
            studentName: student.name,
            reason,
            outTime: outTime || new Date().toISOString(),
            inTime: inTime || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours later
            status: 'pending',
            moderatorRemarks: '',
            createdAt: new Date().toISOString()
        };

        db.passes.push(newPass);
        writeDatabase(db);

        res.status(201).json(newPass);
    } catch (error) {
        console.error('Error in POST /api/passes:', error);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

// Get pass by ID
app.get('/api/passes/:id', (req, res) => {
    try {
        const db = readDatabase();
        const pass = db.passes.find(p => p.id === parseInt(req.params.id));
        if (!pass) {
            return res.status(404).json({ error: 'Pass not found' });
        }
        res.json(pass);
    } catch (error) {
        console.error('Error in GET /api/passes/:id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update pass status
app.put('/api/passes/:id', (req, res) => {
    try {
        console.log('Update pass request body:', req.body);
        
        if (!req.body) {
            return res.status(400).json({ error: 'Request body is missing' });
        }

        const { status, moderatorRemarks } = req.body;
        
        if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
            return res.status(400).json({ 
                error: 'Valid status (approved/rejected/pending) is required',
                received: status 
            });
        }

        const db = readDatabase();
        const passIndex = db.passes.findIndex(p => p.id === parseInt(req.params.id));
        
        if (passIndex === -1) {
            return res.status(404).json({ error: 'Pass not found' });
        }

        db.passes[passIndex].status = status;
        db.passes[passIndex].moderatorRemarks = moderatorRemarks || '';
        db.passes[passIndex].updatedAt = new Date().toISOString();

        writeDatabase(db);

        res.json(db.passes[passIndex]);
    } catch (error) {
        console.error('Error in PUT /api/passes/:id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Verify pass
app.get('/api/verify-pass/:id', (req, res) => {
    try {
        const db = readDatabase();
        const pass = db.passes.find(p => p.id === parseInt(req.params.id));
        
        if (!pass) {
            return res.status(404).json({ error: 'Pass not found' });
        }

        if (pass.status !== 'approved') {
            return res.json({ 
                valid: false, 
                message: 'Pass is not approved',
                pass: pass 
            });
        }

        res.json({ 
            valid: true, 
            message: 'Pass is valid',
            pass: pass 
        });
    } catch (error) {
        console.error('Error in GET /api/verify-pass/:id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all students
app.get('/api/students', (req, res) => {
    try {
        const db = readDatabase();
        res.json(db.students);
    } catch (error) {
        console.error('Error in GET /api/students:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log('📋 API Endpoints:');
    console.log('   GET  /api/passes - Get all passes');
    console.log('   POST /api/passes - Create new pass');
    console.log('   PUT  /api/passes/:id - Update pass status');
    console.log('   GET  /api/verify-pass/:id - Verify pass');
    console.log('   GET  /api/students - Get all students');
});