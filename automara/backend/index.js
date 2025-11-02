require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'automara',
  user: process.env.DB_USER || 'automara',
  password: process.env.DB_PASSWORD
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test database connection
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      status: 'connected', 
      timestamp: result.rows[0].now 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// API Routes
app.get('/api/status', (req, res) => {
  res.json({ 
    service: 'Automara Backend',
    version: '1.0.0',
    status: 'running'
  });
});

// Tenants endpoint (placeholder)
app.get('/api/tenants', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tenants LIMIT 10');
    res.json({ tenants: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create tenant endpoint (for signup)
app.post('/api/tenants', async (req, res) => {
  const { name, domain, owner_email, owner_first_name, owner_last_name } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO tenants (name, domain, owner_email, status, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [name, domain, owner_email, 'active']
    );
    res.status(201).json({ 
      success: true,
      tenant: result.rows[0] 
    });
  } catch (error) {
    console.error('Error creating tenant:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Automara Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
