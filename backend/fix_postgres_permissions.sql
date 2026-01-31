-- Connect to the stocks_raw database and grant permissions
\c stocks_raw;
GRANT ALL PRIVILEGES ON SCHEMA public TO stocks_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO stocks_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO stocks_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO stocks_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO stocks_user;

-- Connect to the stocks_adjusted database and grant permissions
\c stocks_adjusted;
GRANT ALL PRIVILEGES ON SCHEMA public TO stocks_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO stocks_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO stocks_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO stocks_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO stocks_user;
