module.exports = {
  apps: [
    {
      name: 'tiktok-scraper',
      script: 'npx ts-node index.ts',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'tiktok-enricher',
      script: 'npx ts-node enricher.ts',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};