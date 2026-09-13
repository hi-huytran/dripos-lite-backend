-- Split tender: a ticket can now be paid via multiple payments over time
-- instead of one tenderedCents value supplied at creation.
--
-- tickets.status already existed (previously always written as 'paid' at
-- creation) -- this just updates its default for the new flow, where
-- POST /tickets writes 'pending_payment' explicitly. tendered_cents and
-- change_cents are kept (not dropped) but relaxed to nullable, since the
-- new creation flow no longer populates them -- payment now happens via
-- the payments table instead.
ALTER TABLE tickets ALTER COLUMN status SET DEFAULT 'pending_payment';
ALTER TABLE tickets ALTER COLUMN tendered_cents DROP NOT NULL;
ALTER TABLE tickets ALTER COLUMN change_cents DROP NOT NULL;

CREATE TABLE payments (
  id                  SERIAL PRIMARY KEY,
  ticket_id           INTEGER NOT NULL REFERENCES tickets(id),
  tendered_cents      INTEGER NOT NULL,
  applied_cents       INTEGER NOT NULL,
  change_cents        INTEGER NOT NULL,
  client_payment_id   TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, client_payment_id)
);
