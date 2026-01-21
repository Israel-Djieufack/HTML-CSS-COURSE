const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'your-secret-key'; // In production, use environment variable

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: SECRET_KEY,
  resave: false,
  saveUninitialized: true
}));

// Serve static files
app.use(express.static(path.join(__dirname)));

// Data storage (in production, use a real database)
let users = [
  { id: 1, username: 'admin', password: bcrypt.hashSync('admin123', 10), role: 'admin' },
  { id: 2, username: 'teacher1', password: bcrypt.hashSync('teacher123', 10), role: 'teacher', class: '10th' },
  { id: 3, username: 'student1', password: bcrypt.hashSync('student123', 10), role: 'student', class: '10th' }
];

let students = [];
let teachers = [];
let courses = [];
let attendance = [];
let grades = [];
let reportCards = [];
let messages = [];

// Authentication middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Invalid token' });
    req.user = decoded;
    next();
  });
};

const authorize = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  next();
};

// Routes
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role, class: user.class }, SECRET_KEY, { expiresIn: '1h' });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, class: user.class } });
});

app.get('/api/dashboard', authenticate, (req, res) => {
  const stats = {
    totalStudents: students.length,
    totalTeachers: teachers.length,
    totalCourses: courses.length,
    attendanceRate: calculateAttendanceRate()
  };
  res.json(stats);
});

app.get('/api/students', authenticate, authorize(['admin', 'teacher']), (req, res) => {
  res.json(students);
});

app.post('/api/students', authenticate, authorize(['admin']), (req, res) => {
  const newStudent = { id: uuidv4(), ...req.body };
  students.push(newStudent);
  saveData();
  res.json(newStudent);
});

app.get('/api/teachers', authenticate, authorize(['admin']), (req, res) => {
  res.json(teachers);
});

app.post('/api/teachers', authenticate, authorize(['admin']), (req, res) => {
  const newTeacher = { id: uuidv4(), ...req.body };
  teachers.push(newTeacher);
  saveData();
  res.json(newTeacher);
});

app.get('/api/courses', authenticate, (req, res) => {
  res.json(courses);
});

app.post('/api/courses', authenticate, authorize(['admin', 'teacher']), (req, res) => {
  const newCourse = { id: uuidv4(), ...req.body };
  courses.push(newCourse);
  saveData();
  res.json(newCourse);
});

app.get('/api/attendance', authenticate, authorize(['admin', 'teacher']), (req, res) => {
  res.json(attendance);
});

app.post('/api/attendance', authenticate, authorize(['admin', 'teacher']), (req, res) => {
  const newAttendance = { id: uuidv4(), ...req.body };
  attendance.push(newAttendance);
  saveData();
  res.json(newAttendance);
});

app.get('/api/grades', authenticate, (req, res) => {
  if (req.user.role === 'student') {
    const studentGrades = grades.filter(g => g.studentId === req.user.id);
    res.json(studentGrades);
  } else {
    res.json(grades);
  }
});

app.post('/api/grades', authenticate, authorize(['teacher']), (req, res) => {
  // Only allow teachers to grade students in their class
  const student = students.find(s => s.id === req.body.studentId);
  if (student.class !== req.user.class) {
    return res.status(403).json({ message: 'Can only grade students in your class' });
  }
  const newGrade = { id: uuidv4(), ...req.body };
  grades.push(newGrade);
  updateReportCard(newGrade.studentId);
  saveData();
  res.json(newGrade);
});

app.get('/api/report-cards/:studentId', authenticate, (req, res) => {
  if (req.user.role === 'student' && req.user.id !== req.params.studentId) {
    return res.status(403).json({ message: 'Access denied' });
  }
  const reportCard = reportCards.find(rc => rc.studentId === req.params.studentId);
  res.json(reportCard);
});

app.post('/api/report-cards/:studentId/submit', authenticate, authorize(['teacher']), (req, res) => {
  const student = students.find(s => s.id === req.params.studentId);
  if (student.class !== req.user.class) {
    return res.status(403).json({ message: 'Can only submit for students in your class' });
  }
  const reportCard = reportCards.find(rc => rc.studentId === req.params.studentId);
  if (reportCard) {
    reportCard.submitted = true;
    saveData();
    res.json({ message: 'Report card submitted' });
  } else {
    res.status(404).json({ message: 'Report card not found' });
  }
});

app.get('/api/messages', authenticate, (req, res) => {
  res.json(messages);
});

app.post('/api/messages', authenticate, (req, res) => {
  const newMessage = { id: uuidv4(), ...req.body, senderId: req.user.id, timestamp: new Date() };
  messages.push(newMessage);
  saveData();
  res.json(newMessage);
});

// Helper functions
function calculateAttendanceRate() {
  if (attendance.length === 0) return 0;
  const presentCount = attendance.filter(a => a.status === 'present').length;
  return Math.round((presentCount / attendance.length) * 100);
}

function updateReportCard(studentId) {
  const studentGrades = grades.filter(g => g.studentId === studentId);
  const sequences = ['first', 'second', 'third', 'fourth', 'fifth'];
  const reportCard = {
    studentId,
    sequences: {},
    average: 0,
    submitted: false
  };

  sequences.forEach(seq => {
    const seqGrades = studentGrades.filter(g => g.sequence === seq);
    if (seqGrades.length > 0) {
      const avg = seqGrades.reduce((sum, g) => sum + g.grade, 0) / seqGrades.length;
      reportCard.sequences[seq] = Math.round(avg * 100) / 100;
    }
  });

  const allAverages = Object.values(reportCard.sequences);
  if (allAverages.length > 0) {
    reportCard.average = Math.round((allAverages.reduce((sum, a) => sum + a, 0) / allAverages.length) * 100) / 100;
  }

  const existingIndex = reportCards.findIndex(rc => rc.studentId === studentId);
  if (existingIndex >= 0) {
    reportCards[existingIndex] = reportCard;
  } else {
    reportCards.push(reportCard);
  }
}

function saveData() {
  const data = { users, students, teachers, courses, attendance, grades, reportCards, messages };
  fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
}

function loadData() {
  if (fs.existsSync('data.json')) {
    const data = JSON.parse(fs.readFileSync('data.json'));
    users = data.users || users;
    students = data.students || [];
    teachers = data.teachers || [];
    courses = data.courses || [];
    attendance = data.attendance || [];
    grades = data.grades || [];
    reportCards = data.reportCards || [];
    messages = data.messages || [];
  }
}

// Load data on startup
loadData();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});