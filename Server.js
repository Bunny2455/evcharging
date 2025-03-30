const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
app.use(express.static('public'));
const app = express();
const port = process.env.PORT || 3000;

// Database setup
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/data/stationData.db' 
  : path.join(__dirname, 'stationData.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // Create stations table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      slotsAvailable INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Open', 'Closed'))
    `);
    
    // Create bookings table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stationName TEXT NOT NULL,
      location TEXT NOT NULL,
      slotsAvailable INTEGER NOT NULL,
      status TEXT NOT NULL,
      userId INTEGER NOT NULL,
      createdAt TEXT DEFAULT (datetime('now','localtime'))
    )`);
  });
}

app.use(cors());
app.use(express.json());

// Station endpoints
app.get('/stations', (req, res) => {
  db.all('SELECT * FROM stations', [], (err, rows) => {
    if (err) {
      console.error('Failed to fetch stations:', err);
      res.status(500).json({ error: 'Failed to fetch stations' });
    } else {
      console.log('Stations fetched:', rows);
      res.json(rows);
    }
  });
});

app.get('/locations', (req, res) => {
  db.all('SELECT DISTINCT location FROM stations', [], (err, rows) => {
    if (err) {
      console.error('Failed to fetch locations:', err);
      res.status(500).json({ error: 'Failed to fetch locations' });
    } else {
      res.json(rows.map(row => row.location));
    }
  });
});

app.get('/stations/location/:locationName', (req, res) => {
  const { locationName } = req.params;
  db.all('SELECT * FROM stations WHERE location = ?', [locationName], (err, rows) => {
    if (err) {
      console.error('Failed to fetch stations:', err);
      res.status(500).json({ error: 'Failed to fetch stations' });
    } else if (rows.length === 0) {
      res.status(404).json({ error: 'No stations found for the selected location' });
    } else {
      res.json(rows);
    }
  });
});

app.get('/stations/search', (req, res) => {
  const { location } = req.query;
  db.all('SELECT * FROM stations WHERE location LIKE ?', [`%${location}%`], (err, rows) => {
    if (err) {
      console.error('Failed to fetch stations:', err);
      res.status(500).json({ error: 'Failed to fetch stations' });
    } else if (rows.length === 0) {
      res.status(404).json({ error: 'No stations found for the given location' });
    } else {
      res.json(rows);
    }
  });
});

app.post('/stations', (req, res) => {
  const { name, location, slotsAvailable, status } = req.body;
  db.run(
    'INSERT INTO stations (name, location, slotsAvailable, status) VALUES (?, ?, ?, ?)',
    [name, location, slotsAvailable, status],
    function(err) {
      if (err) {
        console.error('Error adding station:', err);
        res.status(500).json({ message: 'Failed to add station' });
      } else {
        res.status(201).json({ message: 'Station added successfully', id: this.lastID });
      }
    }
  );
});

app.delete('/stations/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM stations WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Failed to delete station:', err);
      res.status(500).json({ error: 'Failed to delete station' });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Station not found' });
    } else {
      res.status(200).json({ message: 'Station deleted successfully' });
    }
  });
});

app.put('/stations/:id', (req, res) => {
  const { id } = req.params;
  const { name, location, slotsAvailable, status } = req.body;
  db.run(
    'UPDATE stations SET name = ?, location = ?, slotsAvailable = ?, status = ? WHERE id = ?',
    [name, location, slotsAvailable, status, id],
    function(err) {
      if (err) {
        console.error('Failed to update station:', err);
        res.status(500).json({ error: 'Failed to update station' });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Station not found' });
      } else {
        res.status(200).json({ message: 'Station updated successfully' });
      }
    }
  );
});

// Booking endpoints
app.post('/bookings', (req, res) => {
  const { stationName, location, slotsAvailable, status, userId } = req.body;
  
  if (!stationName || !location || !slotsAvailable || !status || !userId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  db.run(
    'INSERT INTO bookings (stationName, location, slotsAvailable, status, userId) VALUES (?, ?, ?, ?, ?)',
    [stationName, location, slotsAvailable, status, userId],
    function(err) {
      if (err) {
        console.error('Error saving booking:', err);
        res.status(500).json({ error: 'Failed to save booking' });
      } else {
        res.status(201).json({ 
          message: 'Booking saved successfully', 
          booking: { 
            id: this.lastID,
            stationName,
            location,
            slotsAvailable,
            status,
            userId
          }
        });
      }
    }
  );
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});