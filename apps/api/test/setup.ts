process.env.DATABASE_URL ??= 'postgresql://lifespire:lifespire@localhost:5433/lifespire_test';
process.env.JWT_SECRET ??= 'test-secret-0123456789abcdef-test';
process.env.TOTP_ENCRYPTION_KEY ??= 'test-totp-key-0123456789abcdef-t';
process.env.PUBLIC_WEB_URL ??= 'http://localhost:5173';
process.env.CORS_ORIGINS ??= 'http://localhost:5173';
process.env.NODE_ENV ??= 'test';
