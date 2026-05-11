module.exports = {
    apps: [
        {
            name: 'price-checker-scraper',
            script: 'server.js',
            interpreter: 'node',
            env: {
                SCRAPER_PORT: '3000',
                SCRAPER_POOL_SIZE: '4',
            },
            watch: false,
            autorestart: true,
            max_memory_restart: '4G',
        },
    ],
};
