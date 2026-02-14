module.exports = {
  apps: [{
    name: 'pipeline-watcher',
    script: 'scripts/watch-pipeline.js',
    cwd: '/home/pochi/workspaces/work/ai-influencer',
    env: {
      NODE_ENV: 'production',
      MAX_CONCURRENT: 5,
    },
    restart_delay: 5000,
    max_restarts: 50,
    autorestart: true,
  }],
};
