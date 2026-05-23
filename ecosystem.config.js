module.exports = {
    apps: [
        {
            name: 'nemolab-api',
            script: './backend/server.js',
            instances: 1,
            env: { NODE_ENV: 'production' },
            log_file: './logs/api.log'
        },
        {
            name: 'nemolab-scheduler',
            script: './scripts/scheduler.js',
            instances: 1,
            env: { NODE_ENV: 'production' },
            log_file: './logs/scheduler.log'
        }
    ]
};
