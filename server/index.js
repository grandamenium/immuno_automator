const path = require('node:path');
const express = require('express');

const app = express();

// Minimal JSON parsing for future API endpoints
app.use(express.json());

// Health endpoint with basic request logging
app.get('/health', (req, res) => {
  const timestampIso = new Date().toISOString();
  console.log(`[health] ${timestampIso} ${req.method} ${req.url} from ${req.ip}`);
  res.status(200).json({ ok: true, time: timestampIso });
});

// Serve the built client if present
const distDir = path.resolve(__dirname, '..', 'dist');
app.use(express.static(distDir));

// Fallback to index.html for client routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distDir, 'index.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[server] Started on http://localhost:${PORT}`);
});

module.exports = app;


