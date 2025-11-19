# PostgreSQL Socket Connection Fix

## Issue
When attempting to connect to PostgreSQL, the following error occurs:
```
pg_dump: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: No such file or directory
Is the server running locally and accepting connections on that socket?
```

## Root Cause
PostgreSQL was failing to start due to SSL certificate permission issues. The error in the log was:
```
FATAL: private key file "/etc/ssl/private/ssl-cert-snakeoil.key" has group or world access
DETAIL: File must have permissions u=rw (0600) or less if owned by the database user, or permissions u=rw,g=r (0640) or less if owned by root.
```

## Solution
The issue was resolved by:

1. **Fixing SSL certificate permissions**:
   - Set correct permissions on the SSL key file: `chmod 640 /etc/ssl/private/ssl-cert-snakeoil.key`
   - Set correct ownership: `chown root:postgres /etc/ssl/private/ssl-cert-snakeoil.key`
   - Fixed directory permissions: `chmod 750 /etc/ssl/private` and `chown root:postgres /etc/ssl/private`

2. **Disabling SSL** (alternative solution for development):
   - Edited `/etc/postgresql/16/main/postgresql.conf`
   - Changed `ssl = on` to `ssl = off`
   - This bypasses SSL certificate requirements for local development

3. **Starting PostgreSQL**:
   - Started the service: `service postgresql start`
   - Verified socket creation: `/var/run/postgresql/.s.PGSQL.5432`

## Automated Fix
Run the provided script to automatically apply this fix:
```bash
sudo ./automara/scripts/fix-postgresql.sh
```

## Verification
After applying the fix, verify PostgreSQL is running:
```bash
# Check service status
service postgresql status

# Verify socket exists
ls -la /var/run/postgresql/.s.PGSQL.5432

# Test connection (requires proper authentication)
psql -U postgres -c "SELECT version();"
```

## Configuration Files Modified
- `/etc/postgresql/16/main/postgresql.conf` - Disabled SSL (line 108: `ssl = off`)
- `/etc/ssl/private/ssl-cert-snakeoil.key` - Permissions changed to 640
- `/etc/ssl/private/` - Directory permissions changed to 750

## Production Considerations
For production environments:
- Consider keeping SSL enabled and properly configuring certificates instead of disabling SSL
- Use proper SSL certificates instead of the snakeoil self-signed certificate
- Ensure PostgreSQL authentication is properly configured in `/etc/postgresql/16/main/pg_hba.conf`
