@echo off
echo ============================================
echo Checking Tickets Database
echo ============================================
echo.

echo 1. Checking all tickets in database:
echo ============================================
docker exec -it automara-postgres psql -U automara -d automara -c "SELECT id, ticket_number, subject, status, priority, tenant_id FROM tickets ORDER BY created_at DESC LIMIT 10;"

echo.
echo.
echo 2. Checking ticket stats:
echo ============================================
docker exec -it automara-postgres psql -U automara -d automara -c "SELECT status, priority, COUNT(*) FROM tickets GROUP BY status, priority;"

echo.
echo.
echo 3. Checking tenants:
echo ============================================
docker exec -it automara-postgres psql -U automara -d automara -c "SELECT id, name, tenant_type, parent_tenant_id FROM client_tenants ORDER BY id;"

echo.
echo.
echo 4. Checking users:
echo ============================================
docker exec -it automara-postgres psql -U automara -d automara -c "SELECT id, email, role, tenant_id FROM users ORDER BY id;"

echo.
echo ============================================
pause
