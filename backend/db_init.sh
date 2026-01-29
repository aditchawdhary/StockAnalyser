# Connect to PostgreSQL
psql postgres

# Create databases
CREATE DATABASE stocks_raw;
CREATE DATABASE stocks_adjusted;

# Create user (optional but recommended)
CREATE USER stocks_user WITH PASSWORD 'strong-pass';
GRANT ALL PRIVILEGES ON DATABASE stocks_raw TO stocks_user;
GRANT ALL PRIVILEGES ON DATABASE stocks_adjusted TO stocks_user;

# Exit
\q