const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'dev-secret-key';

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// serve static files (so you can open http://localhost:3000/website.html)
app.use(express.static(path.join(__dirname)));

// Minimal in-memory data (for fresh start)
let users = [
  { id: '1', username: 'admin', password: bcrypt.hashSync('admin123', 10), role: 'admin' },
  { id: '2', username: 'teacher1', password: bcrypt.hashSync('teacher123', 10), role: 'teacher', class: '10th' },
  { id: '3', username: 'student1', password: bcrypt.hashSync('student123', 10), role: 'student', class: '10th' }
];

let students = [
  { id: 's1', name: 'John Doe', email: 'john@example.com', grade: '10th', class: '10th' },
  { id: 's2', name: 'Jane Smith', email: 'jane@example.com', grade: '11th', class: '11th' }
];

let teachers = [
  { id: 't1', name: 'Mr. Johnson', email: 'johnson@example.com', subject: 'Math', class: '10th' }
];

let courses = [];
let attendance = [];
let grades = [];
let messages = [];

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role, class: user.class }, SECRET_KEY, { expiresIn: '8h' });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, class: user.class } });
});

// simple auth middleware
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'No token provided' });
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// get students (admin+teacher)
app.get('/api/students', authenticate, (req, res) => {
  if (req.user.role === 'student') return res.status(403).json({ message: 'Forbidden' });
  res.json(students);
});

// add student (admin only)
app.post('/api/students', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const s = { id: uuidv4(), ...req.body };
  students.push(s);
  res.json(s);
});

// public endpoints for testing
app.get('/api/teachers', (req, res) => res.json(teachers));
app.get('/api/courses', (req, res) => res.json(courses));
app.get('/api/attendance', (req, res) => res.json(attendance));
app.get('/api/grades', (req, res) => res.json(grades));
app.get('/api/messages', (req, res) => res.json(messages));

// post message (authenticated)
app.post('/api/messages', authenticate, (req, res) => {
  const m = { id: uuidv4(), senderId: req.user.id, message: req.body.message, timestamp: new Date() };
  messages.push(m);
  res.json(m);
});

// fallback
app.use((req, res) => res.status(404).json({ message: 'Not found' }));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
