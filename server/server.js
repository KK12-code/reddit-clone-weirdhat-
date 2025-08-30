
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// --- Multer Configuration for File Uploads ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/uploads'));
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Append extension
    }
});

const upload = multer({ storage: storage });

// API endpoint for file upload
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).send({ message: 'Please upload a file.' });
    }
    // The file is uploaded, return the path
    res.status(200).send({ imageUrl: `/uploads/${req.file.filename}` });
});


// Connect to SQLite database
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the SQLite database.');
});

// Create tables if they don't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    heading TEXT,
    content TEXT,
    hashtag TEXT,
    imageUrl TEXT,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    repliesCount INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts (id)
  )`);
});

// API endpoint to get all posts
app.get('/api/posts', (req, res) => {
  db.all("SELECT * FROM posts ORDER BY timestamp DESC", [], (err, rows) => {
    if (err) {
      res.status(500).json({ "error": err.message });
      return;
    }
    res.json({
      "message": "success",
      "data": rows
    });
  });
});

// API endpoint to create a new post
app.post('/api/posts', (req, res) => {
  const { heading, content, hashtag, imageUrl } = req.body;
  const sql = `INSERT INTO posts (heading, content, hashtag, imageUrl) VALUES (?, ?, ?, ?)`;
  const params = [heading, content, hashtag, imageUrl];
  db.run(sql, params, function(err) {
    if (err) {
      res.status(400).json({ "error": err.message });
      return;
    }
    res.json({
      "message": "success",
      "data": { id: this.lastID, ...req.body }
    });
  });
});

// API endpoint to vote on a post
app.post('/api/posts/:id/vote', (req, res) => {
    const { voteType } = req.body;
    const { id } = req.params;
    let columnToUpdate = '';

    if (voteType === 'upvote') {
        columnToUpdate = 'upvotes';
    } else if (voteType === 'downvote') {
        columnToUpdate = 'downvotes';
    } else {
        return res.status(400).json({ "error": "Invalid vote type" });
    }

    const sql = `UPDATE posts SET ${columnToUpdate} = ${columnToUpdate} + 1 WHERE id = ?`;
    db.run(sql, [id], function(err) {
        if (err) {
            res.status(400).json({ "error": res.message });
            return;
        }
        res.json({ message: "success" });
    });
});

// API endpoint to get replies for a post
app.get('/api/posts/:id/replies', (req, res) => {
    const { id } = req.params;
    const sql = "SELECT * FROM replies WHERE post_id = ? ORDER BY timestamp ASC";
    db.all(sql, [id], (err, rows) => {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": rows
        });
    });
});

// API endpoint to add a reply to a post
app.post('/api/posts/:id/replies', (req, res) => {
    const { id } = req.params;
    const { content } = req.body;

    db.run(`UPDATE posts SET repliesCount = repliesCount + 1 WHERE id = ?`, [id], function(err) {
        if (err) {
            res.status(400).json({ "error": res.message });
            return;
        }
    });

    const sql = `INSERT INTO replies (post_id, content) VALUES (?, ?)`;
    db.run(sql, [id, content], function(err) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": { id: this.lastID, post_id: id, content: content }
        });
    });
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
