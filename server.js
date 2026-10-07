const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const app = express();

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || 'https://tini.click';

// MySQL connection pool
let pool;

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || '',
  port: parseInt(process.env.DB_PORT || ''),
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Initialize database
async function initDatabase() {
  let retries = 5;
  while (retries) {
    try {
      pool = mysql.createPool(dbConfig);

      // Test connection
      const connection = await pool.getConnection();
      console.log('Connected to MySQL database');

      console.log('Tables initialized successfully');

      connection.release();
      break; // Exit the loop if successful
    } catch (error) {
      console.error(`Database connection failed, retrying... (${retries} retries left)`, error.message);
      retries -= 1;
      // Wait 5 seconds before retrying
      await new Promise(res => setTimeout(res, 5000));
      if (retries === 0) {
        console.error('Database initialization error (final):', error);
        process.exit(1);
      }
    }
  }
}

// Middleware
app.use(express.json());

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Validate URL
function isValidUrl(urlStr) {
  try {
    new URL(urlStr);
    return true;
  } catch (err) {
    return false;
  }
}

// Get next available short code
async function getNextShortCode() {
  const [rows] = await pool.query(
    "SELECT MAX(CAST(short_code AS UNSIGNED)) as max_code FROM links WHERE short_code REGEXP '^[0-9]+$'"
  );

  const maxCode = rows[0]?.max_code;
  return maxCode !== null && maxCode !== undefined ? (maxCode + 1).toString() : '0';
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// Homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Swagger docs page
app.get('/api/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});

// Create short link - URL as query parameter
app.get('/api', async (req, res) => {
  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({ error: 'URL query parameter is required' });
    }

    if (!isValidUrl(url)) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Check if the URL contains any forbidden word
    const [wordMatches] = await pool.query(
      "SELECT word FROM blacklist_words WHERE ? LIKE CONCAT('%', word, '%') LIMIT 1",
      [url]
    );

    if (wordMatches.length > 0) {
      return res.status(403).json({
        error: 'Forbidden: The provided link contains prohibited words.',
        matchedWord: wordMatches[0]?.word
      });
    }

    // Check if the domain is in the blacklist
    const hostname = new URL(url).hostname;
    const [domainMatches] = await pool.query(
      'SELECT domain FROM blacklist_domains WHERE domain = ? LIMIT 1',
      [hostname]
    );

    if (domainMatches.length > 0) {
      return res.status(403).json({
        error: 'Forbidden: The provided link domain is blacklisted.'
      });
    }

    // Check if URL already exists
    const [existing] = await pool.query(
      'SELECT short_code FROM links WHERE original_url = ?',
      [url]
    );

    if (existing.length > 0) {
      const shortCode = existing[0]?.short_code;
      return res.json({
        shortUrl: `${BASE_URL}/${shortCode}`,
        originalUrl: url,
        shortCode: shortCode
      });
    }

    // Generate new sequential short code
    const shortCode = await getNextShortCode();

    // Store in database
    await pool.query(
      'INSERT INTO links (short_code, original_url, ban) VALUES (?, ?, ?)',
      [shortCode, url, false]
    );

    return res.status(201).json({
      shortUrl: `${BASE_URL}/${shortCode}`,
      originalUrl: url,
      shortCode: shortCode
    });
  } catch (error) {
    console.error('Error creating short link:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Ban short link by short code
app.get('/ban/:short_code', async (req, res) => {
  try {
    const { short_code } = req.params;

    const [result] = await pool.query(
      'UPDATE links SET ban = true WHERE short_code = ?',
      [short_code]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }

    return res.json({ message: 'Link successfully banned', short_code });
  } catch (error) {
    console.error('Error banning link:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all links
app.get('/api/links', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, short_code, original_url, created_at FROM links WHERE ban is null or ban = 0 ORDER BY id ASC'
    );

    const links = rows.map(row => ({
      id: row.id,
      shortCode: row.short_code,
      shortUrl: `${BASE_URL}/${row.short_code}`,
      originalUrl: row.original_url,
      createdAt: row.created_at
    }));

    res.json({ links, count: links.length });
  } catch (error) {
    console.error('Error fetching links:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      timestamp: new Date().toISOString()
    });
  }
});

// Redirect to original URL — must come LAST to avoid catching /api/* routes
app.get('/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;

    const [rows] = await pool.query(
      'SELECT original_url, ban FROM links WHERE short_code = ?',
      [shortCode]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Short link not found' });
    }

    if (rows[0]?.ban) {
      return res.status(403).json({ error: 'This link has been banned' });
    }

    return res.redirect(rows[0]?.original_url);
  } catch (error) {
    console.error('Error redirecting:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
