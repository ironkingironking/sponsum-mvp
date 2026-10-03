process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgresql://sponsum:sponsum@127.0.0.1:5432/sponsum?schema=public";
process.env.AUTH_SECRET ??= "integration-test-secret-with-32-chars";
process.env.CORS_ORIGIN ??= "http://localhost:3000";
process.env.RATE_LIMIT_MAX_REQUESTS ??= "1000";
