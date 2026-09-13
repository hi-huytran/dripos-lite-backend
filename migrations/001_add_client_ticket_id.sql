-- Adds an optional client-supplied idempotency key to tickets.
-- Nullable and UNIQUE so existing rows are unaffected and duplicate
-- POST /tickets submissions with the same clientTicketId can be detected.
ALTER TABLE tickets ADD COLUMN client_ticket_id TEXT UNIQUE;
