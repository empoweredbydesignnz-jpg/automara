@echo off
echo ============================================
echo Fixing Ticket Reference Numbers
echo ============================================
echo.
echo This will:
echo - Create a sequence for ticket numbers
echo - Change trigger from AFTER to BEFORE INSERT
echo - Update existing tickets with numbers
echo - Ensure new tickets get numbers immediately
echo.
pause

echo.
echo Running migration...
echo ============================================
docker exec -i automara-postgres psql -U automara -d automara < y:\migrations\fix-ticket-number-trigger.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo SUCCESS! Migration completed successfully
    echo ============================================
    echo.
    echo Now checking existing tickets...
    echo.
    docker exec -it automara-postgres psql -U automara -d automara -c "SELECT id, ticket_number, subject, status FROM tickets ORDER BY id LIMIT 10;"
    echo.
    echo ============================================
    echo Ticket numbers are now active!
    echo.
    echo What to do next:
    echo 1. Refresh your browser (Ctrl + Shift + R)
    echo 2. Create a new ticket
    echo 3. Check that ticket number appears (TKT-000XXX)
    echo ============================================
) else (
    echo.
    echo ============================================
    echo ERROR: Migration failed
    echo ============================================
    echo.
    echo Please check:
    echo 1. Docker is running
    echo 2. PostgreSQL container is running
    echo 3. Database credentials are correct
    echo.
    echo Try running manually:
    echo docker exec -i automara-postgres psql -U automara -d automara ^< y:\migrations\fix-ticket-number-trigger.sql
    echo ============================================
)

echo.
pause
