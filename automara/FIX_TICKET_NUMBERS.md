# Fix Ticket Reference Numbers

## Issue

Ticket numbers (TKT-000001 format) are not being generated or displayed properly because:
1. The current trigger is `AFTER INSERT`, which doesn't populate the `ticket_number` in the `RETURNING` clause
2. Existing tickets may not have numbers assigned

## Solution

Run the migration to fix the ticket number generation system.

## Step 1: Run the Migration

### Option A: Using Docker (Recommended)

```bash
docker exec -i automara-postgres psql -U automara -d automara < y:/migrations/fix-ticket-number-trigger.sql
```

### Option B: Using psql directly

```bash
psql -h localhost -U automara -d automara -f y:/migrations/fix-ticket-number-trigger.sql
```

### Option C: Using pgAdmin

1. Open pgAdmin
2. Connect to your database
3. Open Query Tool
4. Load and execute `y:/migrations/fix-ticket-number-trigger.sql`

## What the Migration Does

1. **Drops old trigger and function**: Removes the AFTER INSERT trigger
2. **Creates sequence**: `ticket_number_seq` for generating unique numbers
3. **Creates new BEFORE INSERT trigger**: Generates ticket_number BEFORE insert
4. **Updates existing tickets**: Assigns numbers to any tickets without them
5. **Sets sequence**: Ensures future tickets continue from the correct number

## Verify It Works

### Check Existing Tickets

```sql
-- View all tickets with their numbers
SELECT id, ticket_number, subject, status
FROM tickets
ORDER BY id;
```

**Expected Output**:
```
 id | ticket_number |        subject         | status
----+---------------+------------------------+--------
  1 | TKT-000001    | Test Ticket           | open
  2 | TKT-000002    | Another Ticket        | open
```

### Create a Test Ticket

```sql
-- Create a test ticket
INSERT INTO tickets (tenant_id, created_by, subject, description, priority)
VALUES (1, 1, 'Test Reference Number', 'Testing ticket numbers', 'medium')
RETURNING id, ticket_number, subject;
```

**Expected Output**:
```
 id | ticket_number |        subject
----+---------------+------------------------
  3 | TKT-000003    | Test Reference Number
```

**The ticket_number should be populated immediately!**

### Check via API

```bash
# Create ticket via API
curl -X POST http://localhost:4000/api/tickets \
  -H "Content-Type: application/json" \
  -H "x-user-role: client_user" \
  -H "x-tenant-id: 1" \
  -H "x-user-id: 1" \
  -d '{
    "subject": "API Test Ticket",
    "description": "Testing ticket number generation",
    "priority": "medium"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "ticket": {
    "id": 4,
    "ticket_number": "TKT-000004",  ← Should be present!
    "subject": "API Test Ticket",
    "description": "Testing ticket number generation",
    "status": "open",
    "priority": "medium",
    ...
  }
}
```

## Frontend Display

After the migration, ticket numbers will appear in:

### 1. Tickets List Page
```
Ticket          Subject
TKT-000001     Cannot login to account
TKT-000002     Feature request: Dark mode
TKT-000003     Bug report: Dashboard error
```

### 2. Ticket Details Modal
```
TKT-000001
Cannot login to account

Status: Open | Priority: High
```

### 3. Search Functionality
Users can search by ticket number:
```
Search: "TKT-000001"
```

## Troubleshooting

### Issue: Tickets still don't have numbers

**Solution 1 - Check if migration ran successfully**:
```sql
-- Check if sequence exists
SELECT * FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'ticket_number_seq';

-- Check if trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_generate_ticket_number_before';
```

**Solution 2 - Manually update existing tickets**:
```sql
-- Update tickets without numbers
UPDATE tickets
SET ticket_number = 'TKT-' || LPAD(id::TEXT, 6, '0')
WHERE ticket_number IS NULL;
```

### Issue: Duplicate ticket numbers

**Solution**:
```sql
-- Reset the sequence
SELECT setval('ticket_number_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM tickets));
```

### Issue: Numbers not sequential (gaps)

This is normal! Gaps can occur when:
- Transactions are rolled back
- Tickets are deleted
- Sequence is reset

**This is OK and expected behavior.**

## Ticket Number Format

### Current Format
```
TKT-000001
TKT-000002
TKT-000003
...
TKT-999999
```

### Customizing the Format

To change the format, edit the trigger function:

**Examples**:

**Include Year**:
```sql
NEW.ticket_number := 'TKT-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(nextval('ticket_number_seq')::TEXT, 6, '0');
-- Result: TKT-2024-000001
```

**Include Tenant ID**:
```sql
NEW.ticket_number := 'TKT-' || NEW.tenant_id || '-' || LPAD(nextval('ticket_number_seq')::TEXT, 6, '0');
-- Result: TKT-5-000001
```

**Shorter Format**:
```sql
NEW.ticket_number := 'T' || LPAD(nextval('ticket_number_seq')::TEXT, 4, '0');
-- Result: T0001
```

## Testing Checklist

After running the migration:

- [ ] Run migration successfully
- [ ] Check existing tickets have numbers (SQL query)
- [ ] Create new ticket via frontend
- [ ] Verify ticket number appears immediately
- [ ] Check ticket number shows in list view
- [ ] Check ticket number shows in detail view
- [ ] Search for ticket by number
- [ ] Restart backend if needed
- [ ] Refresh frontend browser

## API Response Examples

### Before Fix
```json
{
  "success": true,
  "ticket": {
    "id": 1,
    "ticket_number": null,  ❌ Missing!
    "subject": "Test Ticket",
    ...
  }
}
```

### After Fix
```json
{
  "success": true,
  "ticket": {
    "id": 1,
    "ticket_number": "TKT-000001",  ✅ Present!
    "subject": "Test Ticket",
    ...
  }
}
```

## Rollback

If you need to rollback the changes:

```sql
-- Drop the new trigger
DROP TRIGGER IF EXISTS trigger_generate_ticket_number_before ON tickets;

-- Drop the new function
DROP FUNCTION IF EXISTS generate_ticket_number_before_insert();

-- Drop the sequence
DROP SEQUENCE IF EXISTS ticket_number_seq;

-- Recreate the original AFTER INSERT trigger
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tickets
  SET ticket_number = 'TKT-' || LPAD(NEW.id::TEXT, 6, '0')
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_ticket_number
AFTER INSERT ON tickets
FOR EACH ROW
EXECUTE FUNCTION generate_ticket_number();
```

## Summary

✅ Creates a sequence for ticket numbers
✅ Changes trigger from AFTER to BEFORE INSERT
✅ Ensures ticket_number is in RETURNING clause
✅ Updates existing tickets with numbers
✅ Ticket numbers appear immediately in API responses
✅ Frontend displays ticket numbers correctly

**Just run the migration and ticket numbers will work!**

## Quick Start Command

```bash
# Run this single command
docker exec -i automara-postgres psql -U automara -d automara < y:/migrations/fix-ticket-number-trigger.sql

# Then refresh your browser (Ctrl + Shift + R)
```

Done! 🎫
