-- Create databases if they don't exist
SELECT 'CREATE DATABASE stocks_raw' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'stocks_raw')\gexec
SELECT 'CREATE DATABASE stocks_adjusted' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'stocks_adjusted')\gexec

-- Grant privileges on stocks_raw
\c stocks_raw;
GRANT ALL PRIVILEGES ON SCHEMA public TO achawdhary;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO achawdhary;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO achawdhary;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO achawdhary;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO achawdhary;

-- Grant privileges on stocks_adjusted
\c stocks_adjusted;
GRANT ALL PRIVILEGES ON SCHEMA public TO achawdhary;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO achawdhary;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO achawdhary;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO achawdhary;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO achawdhary;
