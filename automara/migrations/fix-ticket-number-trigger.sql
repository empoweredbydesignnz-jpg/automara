-- Fix ticket number generation to work with RETURNING clause
-- This ensures the ticket_number is available immediately

-- Drop the old trigger (if exists)
DROP TRIGGER IF EXISTS trigger_generate_ticket_number ON tickets;

-- Drop the old function (if exists)
DROP FUNCTION IF EXISTS generate_ticket_number();

-- Create a sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1;

-- Create new function that generates ticket number BEFORE insert
CREATE OR REPLACE FUNCTION generate_ticket_number_before_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate ticket number if not already set
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := 'TKT-' || LPAD(nextval('ticket_number_seq')::TEXT, 6, '0');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create BEFORE INSERT trigger (this allows RETURNING to work)
CREATE TRIGGER trigger_generate_ticket_number_before
BEFORE INSERT ON tickets
FOR EACH ROW
EXECUTE FUNCTION generate_ticket_number_before_insert();

-- Update existing tickets that might not have ticket numbers
DO $$
DECLARE
  ticket_record RECORD;
  counter INTEGER := 1;
BEGIN
  FOR ticket_record IN SELECT id FROM tickets WHERE ticket_number IS NULL ORDER BY id
  LOOP
    UPDATE tickets
    SET ticket_number = 'TKT-' || LPAD(counter::TEXT, 6, '0')
    WHERE id = ticket_record.id;

    counter := counter + 1;
  END LOOP;

  -- Set the sequence to continue from the last number
  PERFORM setval('ticket_number_seq', counter);
END $$;
