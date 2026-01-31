-- Connect to stocks_raw and grant CREATE permission on public schema
\c stocks_raw;
GRANT CREATE ON SCHEMA public TO stocks_user;
GRANT USAGE ON SCHEMA public TO stocks_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO stocks_user;

-- Connect to stocks_adjusted and grant CREATE permission on public schema
\c stocks_adjusted;
GRANT CREATE ON SCHEMA public TO stocks_user;
GRANT USAGE ON SCHEMA public TO stocks_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO stocks_user;
