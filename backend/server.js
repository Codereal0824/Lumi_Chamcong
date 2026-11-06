require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./config/database');
const authRoutes = require('./routes/auth');
const technicianRoutes = require('./routes/technician');
const adminRoutes = require('./routes/admin');

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', (_req, res) => res.json({ service: 'FieldFlow API', status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/technician', technicianRoutes);
app.use('/api/admin', adminRoutes);
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const db = initializeDatabase();
app.locals.db = db;
if (require.main === module) app.listen(port, '0.0.0.0', () => console.log(`FieldFlow API listening on http://localhost:${port}`));
module.exports = { app, db };
