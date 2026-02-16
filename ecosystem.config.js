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
  }, {
    name: 'posting-scheduler',
    script: 'scripts/watch-posting.js',
    cwd: '/home/pochi/workspaces/work/ai-influencer',
    env: {
      NODE_ENV: 'production',
      POLL_INTERVAL: 60000,
    },
    restart_delay: 10000,
    max_restarts: 50,
    autorestart: true,
  }, {
    name: 'yt-posting-scheduler',
    script: 'scripts/watch-yt-posting.js',
    cwd: '/home/pochi/workspaces/work/ai-influencer',
    env: {
      NODE_ENV: 'production',
      YT_POLL_INTERVAL: 120000,
      YT_MAX_PER_POLL: 2,
      YT_DAILY_LIMIT: 6,
    },
    restart_delay: 10000,
    max_restarts: 50,
    autorestart: true,
  }],
};
