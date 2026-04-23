// ecosystem.config.js
// PM2 process manager config — lives in repo root, copied to VPS on every deploy

module.exports = {
  apps: [
    {
      name:    'saas',
      script:  'node_modules/.bin/next',
      args:    'start',
      cwd:     '/var/www/saas/current',

      // Cluster mode = one worker per CPU core (max concurrency)
      instances:  'max',   // use '2' for a 2-core VPS, '4' for 4-core, etc.
      exec_mode:  'cluster',

      // Zero-downtime restart settings
      wait_ready:     true,
      listen_timeout: 15000,   // 15s to become ready
      kill_timeout:   5000,    // 5s to gracefully shut down old workers

      // Auto-restart on crash
      autorestart:    true,
      max_restarts:   10,
      min_uptime:     '10s',   // must stay up 10s to count as stable
      restart_delay:  3000,

      // Memory guard — restart if worker exceeds 512MB
      max_memory_restart: '512M',

      // Environment variables (secrets come from .env.local)
      env_production: {
        NODE_ENV: 'production',
        PORT:     3000,
      },

      // Log files (tailed by: pm2 logs saas)
      out_file:        '/var/www/saas/shared/logs/out.log',
      error_file:      '/var/www/saas/shared/logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs:      true,
      log_type:        'json',

      // Never watch filesystem in production (it's a built app)
      watch: false,
    },
  ],
};
