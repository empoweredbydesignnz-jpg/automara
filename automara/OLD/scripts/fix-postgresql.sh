#!/bin/bash
# Script to fix PostgreSQL socket connection issues
# This script resolves the "No such file or directory" error when connecting to PostgreSQL

set -e

echo "Fixing PostgreSQL socket connection issues..."

# 1. Fix SSL certificate permissions
echo "1. Fixing SSL certificate permissions..."
if [ -f /etc/ssl/private/ssl-cert-snakeoil.key ]; then
    chmod 640 /etc/ssl/private/ssl-cert-snakeoil.key
    chown root:postgres /etc/ssl/private/ssl-cert-snakeoil.key
    chmod 750 /etc/ssl/private
    chown root:postgres /etc/ssl/private
fi

# 2. Disable SSL in PostgreSQL (for development environments)
echo "2. Disabling SSL in PostgreSQL configuration..."
if [ -f /etc/postgresql/16/main/postgresql.conf ]; then
    sed -i 's/^ssl = on/ssl = off/' /etc/postgresql/16/main/postgresql.conf
fi

# 3. Start PostgreSQL service
echo "3. Starting PostgreSQL service..."
service postgresql start || systemctl start postgresql || pg_ctlcluster 16 main start

# 4. Verify the socket file exists
echo "4. Verifying socket file..."
if [ -e /var/run/postgresql/.s.PGSQL.5432 ]; then
    echo "✓ PostgreSQL socket file exists: /var/run/postgresql/.s.PGSQL.5432"
    echo "✓ PostgreSQL is running on port 5432"
else
    echo "✗ Socket file not found. Please check PostgreSQL logs."
    exit 1
fi

echo ""
echo "PostgreSQL socket connection has been fixed successfully!"
echo "You can now connect to PostgreSQL using the Unix socket."
