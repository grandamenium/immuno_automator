// Lightweight dev runner with simple restart hints (no extra deps)
console.log('[dev] Starting server in development mode');
require('./index');

process.on('uncaughtException', (err) => {
  console.error('[dev] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[dev] Unhandled rejection:', reason);
});


