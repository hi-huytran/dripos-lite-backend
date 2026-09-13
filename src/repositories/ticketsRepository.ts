import { pool } from "../db";
import { Ticket, TicketItem } from "../types/ticket";

interface TicketInsertRow {
  id: number;
  status: string;
  created_at: Date;
}

export interface TicketRow {
  id: number;
  status: string;
  total_cents: number;
}

export interface TicketListRow {
  id: number;
  status: string;
  total_cents: number;
  created_at: Date;
}

export interface TicketDetailRow {
  ticket_id: number;
  status: string;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  tendered_cents: number | null;
  change_cents: number | null;
  created_at: Date;
  item_id: number | null;
  product_id: string | null;
  product_name: string | null;
  unit_price_cents: number | null;
  quantity: number | null;
  line_total_cents: number | null;
  modifier_option_id: string | null;
  option_name: string | null;
  price_delta_cents: number | null;
}

export interface PaymentRow {
  id: number;
  tendered_cents: number;
  applied_cents: number;
  change_cents: number;
  created_at: Date;
}

interface TicketTotals {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
}

export async function createTicket(
  items: TicketItem[],
  totals: TicketTotals,
  clientTicketId?: string
): Promise<Ticket> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ticketResult = await client.query<TicketInsertRow>(
      `INSERT INTO tickets (status, subtotal_cents, tax_cents, total_cents, client_ticket_id)
       VALUES ('pending_payment', $1, $2, $3, $4)
       RETURNING id, status, created_at`,
      [totals.subtotalCents, totals.taxCents, totals.totalCents, clientTicketId ?? null]
    );
    const ticket = ticketResult.rows[0];

    for (const item of items) {
      const itemResult = await client.query<{ id: number }>(
        `INSERT INTO ticket_items (ticket_id, product_id, product_name, unit_price_cents, quantity, line_total_cents)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          ticket.id,
          item.productId,
          item.productName,
          item.unitPriceCents,
          item.quantity,
          item.lineTotalCents,
        ]
      );
      const ticketItemId = itemResult.rows[0].id;

      for (const modifier of item.modifiers) {
        await client.query(
          `INSERT INTO ticket_item_modifiers (ticket_item_id, modifier_option_id, option_name, price_delta_cents)
           VALUES ($1, $2, $3, $4)`,
          [
            ticketItemId,
            modifier.optionId,
            modifier.optionName,
            modifier.priceDeltaCents,
          ]
        );
      }
    }

    await client.query("COMMIT");

    return {
      id: ticket.id,
      status: ticket.status,
      items,
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      tenderedCents: null,
      changeCents: null,
      createdAt: ticket.created_at,
      remainingCents: totals.totalCents,
      payments: [],
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function findAllTicketRows(): Promise<TicketListRow[]> {
  const result = await pool.query<TicketListRow>(
    `SELECT id, status, total_cents, created_at FROM tickets ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function findTicketById(
  ticketId: number
): Promise<TicketRow | null> {
  const result = await pool.query<TicketRow>(
    `SELECT id, status, total_cents FROM tickets WHERE id = $1`,
    [ticketId]
  );
  return result.rows[0] ?? null;
}

export async function findTicketDetailRows(
  ticketId: number
): Promise<TicketDetailRow[]> {
  const result = await pool.query<TicketDetailRow>(
    `
    SELECT
      t.id AS ticket_id, t.status, t.subtotal_cents, t.tax_cents, t.total_cents,
      t.tendered_cents, t.change_cents, t.created_at,
      ti.id AS item_id, ti.product_id, ti.product_name, ti.unit_price_cents,
      ti.quantity, ti.line_total_cents,
      tim.modifier_option_id, tim.option_name, tim.price_delta_cents
    FROM tickets t
    LEFT JOIN ticket_items ti ON ti.ticket_id = t.id
    LEFT JOIN ticket_item_modifiers tim ON tim.ticket_item_id = ti.id
    WHERE t.id = $1
    ORDER BY ti.id, tim.id
    `,
    [ticketId]
  );
  return result.rows;
}

export async function findTicketDetailRowsByClientTicketId(
  clientTicketId: string
): Promise<TicketDetailRow[]> {
  const result = await pool.query<TicketDetailRow>(
    `
    SELECT
      t.id AS ticket_id, t.status, t.subtotal_cents, t.tax_cents, t.total_cents,
      t.tendered_cents, t.change_cents, t.created_at,
      ti.id AS item_id, ti.product_id, ti.product_name, ti.unit_price_cents,
      ti.quantity, ti.line_total_cents,
      tim.modifier_option_id, tim.option_name, tim.price_delta_cents
    FROM tickets t
    LEFT JOIN ticket_items ti ON ti.ticket_id = t.id
    LEFT JOIN ticket_item_modifiers tim ON tim.ticket_item_id = ti.id
    WHERE t.client_ticket_id = $1
    ORDER BY ti.id, tim.id
    `,
    [clientTicketId]
  );
  return result.rows;
}

export async function findPaymentsByTicketId(
  ticketId: number
): Promise<PaymentRow[]> {
  const result = await pool.query<PaymentRow>(
    `SELECT id, tendered_cents, applied_cents, change_cents, created_at
     FROM payments
     WHERE ticket_id = $1
     ORDER BY id ASC`,
    [ticketId]
  );
  return result.rows;
}

export async function findPaymentByClientPaymentId(
  ticketId: number,
  clientPaymentId: string
): Promise<PaymentRow | null> {
  const result = await pool.query<PaymentRow>(
    `SELECT id, tendered_cents, applied_cents, change_cents, created_at
     FROM payments
     WHERE ticket_id = $1 AND client_payment_id = $2`,
    [ticketId, clientPaymentId]
  );
  return result.rows[0] ?? null;
}

export async function sumAppliedCentsForTicket(
  ticketId: number
): Promise<number> {
  const result = await pool.query<{ sum: number | null }>(
    `SELECT COALESCE(SUM(applied_cents), 0)::int AS sum FROM payments WHERE ticket_id = $1`,
    [ticketId]
  );
  return result.rows[0]?.sum ?? 0;
}

export async function addPayment(
  ticketId: number,
  tenderedCents: number,
  appliedCents: number,
  changeCents: number,
  clientPaymentId: string | undefined,
  newStatus: "paid" | null
): Promise<PaymentRow> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const paymentResult = await client.query<PaymentRow>(
      `INSERT INTO payments (ticket_id, tendered_cents, applied_cents, change_cents, client_payment_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, tendered_cents, applied_cents, change_cents, created_at`,
      [ticketId, tenderedCents, appliedCents, changeCents, clientPaymentId ?? null]
    );

    if (newStatus) {
      await client.query(`UPDATE tickets SET status = $1 WHERE id = $2`, [
        newStatus,
        ticketId,
      ]);
    }

    await client.query("COMMIT");

    return paymentResult.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
