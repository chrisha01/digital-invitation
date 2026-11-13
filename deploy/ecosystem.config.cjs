/**
 * PM2 alternative to the systemd unit:
 *
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup            # then run the command it prints, so it survives reboot
 *
 * PM2 does not load .env, so node is started with --env-file-if-exists, the same
 * way the npm script does.
 */
module.exports = {
  apps: [
    {
      name: 'gatherly-scheduler',
      cwd: __dirname + '/..',
      script: 'scripts/scheduler.mjs',
      interpreter: 'node',
      interpreter_args: '--env-file-if-exists=.env',
      // One scheduler is enough: overlapping runs are refused by an advisory
      // lock anyway, and a second copy would only log 409s.
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 10000,
      kill_timeout: 15000,
      time: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
