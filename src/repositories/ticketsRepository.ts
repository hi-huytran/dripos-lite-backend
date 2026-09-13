import { pool } from "../db";
import { Ticket, TicketItem } from "../types/ticket";

interface TicketInsertRow {
  id: number;
  status: string;
  created_at: Date;
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
  tendered_cents: number;
  change_cents: number;
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

interface TicketTotals {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  tenderedCents: number;
  changeCents: number;
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
      `INSERT INTO tickets (status, subtotal_cents, tax_cents, total_cents, tendered_cents, change_cents, client_ticket_id)
       VALUES ('paid', $1, $2, $3, $4, $5, $6)
       RETURNING id, status, created_at`,
      [
        totals.subtotalCents,
        totals.taxCents,
        totals.totalCents,
        totals.tenderedCents,
        totals.changeCents,
        clientTicketId ?? null,
      ]
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
      tenderedCents: totals.tenderedCents,
      changeCents: totals.changeCents,
      createdAt: ticket.created_at,
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
