import * as productsRepository from "../repositories/productsRepository";
import * as ticketsRepository from "../repositories/ticketsRepository";
import { ProductSummaryRow } from "../repositories/productsRepository";
import {
  PaymentRow,
  TicketDetailRow,
} from "../repositories/ticketsRepository";
import {
  CreateTicketItemInput,
  Payment,
  Ticket,
  TicketItem,
  TicketItemModifier,
  TicketListItem,
} from "../types/ticket";

const TAX_RATE = 0.08875;

export class ValidationError extends Error {}

interface ProductModifierOption {
  id: string;
  name: string;
  priceDeltaCents: number;
}

interface ProductModifierGroup {
  id: string;
  name: string;
  required: boolean;
  options: Map<string, ProductModifierOption>;
}

async function loadProductModifierGroups(
  productIds: string[]
): Promise<Map<string, ProductModifierGroup[]>> {
  const rows = await productsRepository.findProductModifierGroupRows(
    productIds
  );

  const groupsByProduct = new Map<string, Map<string, ProductModifierGroup>>();

  for (const row of rows) {
    let productGroups = groupsByProduct.get(row.product_id);
    if (!productGroups) {
      productGroups = new Map();
      groupsByProduct.set(row.product_id, productGroups);
    }

    let group = productGroups.get(row.group_id);
    if (!group) {
      group = {
        id: row.group_id,
        name: row.group_name,
        required: row.group_required,
        options: new Map(),
      };
      productGroups.set(row.group_id, group);
    }

    if (row.option_id) {
      group.options.set(row.option_id, {
        id: row.option_id,
        name: row.option_name as string,
        priceDeltaCents: row.option_price_delta_cents as number,
      });
    }
  }

  const groupsList: Map<string, ProductModifierGroup[]> = new Map();
  for (const [productId, groups] of groupsByProduct.entries()) {
    groupsList.set(productId, Array.from(groups.values()));
  }
  return groupsList;
}

function validateAndPriceItems(
  items: CreateTicketItemInput[],
  productsById: Map<string, ProductSummaryRow>,
  groupsByProduct: Map<string, ProductModifierGroup[]>
): TicketItem[] {
  const pricedItems: TicketItem[] = [];

  for (const item of items) {
    const product = productsById.get(item.productId);
    if (!product) {
      throw new ValidationError(`Product '${item.productId}' not found`);
    }

    if (product.sold_out) {
      throw new ValidationError(`'${product.name}' is sold out`);
    }

    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new ValidationError(`Invalid quantity for '${product.name}'`);
    }

    const selectedOptionIds = Array.isArray(item.selectedOptionIds)
      ? item.selectedOptionIds.filter((id) => typeof id === "string")
      : [];

    const groups = groupsByProduct.get(product.id) ?? [];

    for (const group of groups) {
      const selectedInGroup = selectedOptionIds.filter((id) =>
        group.options.has(id)
      );

      if (group.required && selectedInGroup.length !== 1) {
        throw new ValidationError(
          `'${group.name}' selection is required for '${product.name}'`
        );
      }

      if (!group.required && selectedInGroup.length > 1) {
        throw new ValidationError(
          `Only one '${group.name}' option allowed for '${product.name}'`
        );
      }
    }

    const validOptions = new Map<string, ProductModifierOption>();
    for (const group of groups) {
      for (const option of group.options.values()) {
        validOptions.set(option.id, option);
      }
    }

    for (const optionId of selectedOptionIds) {
      if (!validOptions.has(optionId)) {
        throw new ValidationError(
          `'${optionId}' is not a valid option for '${product.name}'`
        );
      }
    }

    const modifiers: TicketItemModifier[] = selectedOptionIds.map(
      (optionId) => {
        const option = validOptions.get(optionId) as ProductModifierOption;
        return {
          optionId: option.id,
          optionName: option.name,
          priceDeltaCents: option.priceDeltaCents,
        };
      }
    );

    const unitPriceCents =
      product.price_cents +
      modifiers.reduce((sum, m) => sum + m.priceDeltaCents, 0);
    const lineTotalCents = unitPriceCents * item.quantity;

    pricedItems.push({
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitPriceCents,
      lineTotalCents,
      modifiers,
    });
  }

  return pricedItems;
}

function toPaymentApiShape(row: PaymentRow): Payment {
  return {
    id: row.id,
    tenderedCents: row.tendered_cents,
    appliedCents: row.applied_cents,
    changeCents: row.change_cents,
    createdAt: row.created_at,
  };
}

function assembleTicketFromRows(
  rows: TicketDetailRow[],
  paymentRows: PaymentRow[]
): Ticket {
  const first = rows[0];
  const itemsById = new Map<number, TicketItem>();

  for (const row of rows) {
    if (!row.item_id) continue;

    let item = itemsById.get(row.item_id);
    if (!item) {
      item = {
        productId: row.product_id as string,
        productName: row.product_name as string,
        quantity: row.quantity as number,
        unitPriceCents: row.unit_price_cents as number,
        lineTotalCents: row.line_total_cents as number,
        modifiers: [],
      };
      itemsById.set(row.item_id, item);
    }

    if (row.modifier_option_id) {
      item.modifiers.push({
        optionId: row.modifier_option_id,
        optionName: row.option_name as string,
        priceDeltaCents: row.price_delta_cents as number,
      });
    }
  }

  const payments = paymentRows.map(toPaymentApiShape);
  const sumAppliedCents = payments.reduce(
    (sum, payment) => sum + payment.appliedCents,
    0
  );

  return {
    id: first.ticket_id,
    status: first.status,
    items: Array.from(itemsById.values()),
    subtotalCents: first.subtotal_cents,
    taxCents: first.tax_cents,
    totalCents: first.total_cents,
    tenderedCents: first.tendered_cents,
    changeCents: first.change_cents,
    createdAt: first.created_at,
    remainingCents:
      first.status === "paid" ? 0 : first.total_cents - sumAppliedCents,
    payments,
  };
}

export async function createTicket(body: any): Promise<Ticket> {
  // tenderedCents is intentionally not read here: payment no longer
  // happens at ticket creation, so any tenderedCents a client still sends
  // is silently ignored rather than rejected.
  const { items, clientTicketId } = body ?? {};

  const hasClientTicketId =
    typeof clientTicketId === "string" && clientTicketId.length > 0;

  if (hasClientTicketId) {
    const existingRows =
      await ticketsRepository.findTicketDetailRowsByClientTicketId(
        clientTicketId
      );
    if (existingRows.length > 0) {
      const paymentRows = await ticketsRepository.findPaymentsByTicketId(
        existingRows[0].ticket_id
      );
      return assembleTicketFromRows(existingRows, paymentRows);
    }
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError("Cart cannot be empty");
  }

  const productIds = Array.from(
    new Set(
      (items as CreateTicketItemInput[])
        .map((item) => item?.productId)
        .filter((id): id is string => typeof id === "string")
    )
  );

  const productRows = await productsRepository.findProductSummariesByIds(
    productIds
  );
  const productsById = new Map(productRows.map((row) => [row.id, row]));

  const groupsByProduct = await loadProductModifierGroups(productIds);

  const pricedItems = validateAndPriceItems(
    items as CreateTicketItemInput[],
    productsById,
    groupsByProduct
  );

  const subtotalCents = pricedItems.reduce(
    (sum, item) => sum + item.lineTotalCents,
    0
  );
  const taxCents = Math.round(subtotalCents * TAX_RATE);
  const totalCents = subtotalCents + taxCents;

  return ticketsRepository.createTicket(
    pricedItems,
    {
      subtotalCents,
      taxCents,
      totalCents,
    },
    hasClientTicketId ? clientTicketId : undefined
  );
}

export async function listTickets(): Promise<TicketListItem[]> {
  const rows = await ticketsRepository.findAllTicketRows();
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    totalCents: row.total_cents,
    createdAt: row.created_at,
  }));
}

export async function getTicketById(idParam: string): Promise<Ticket | null> {
  const ticketId = Number(idParam);
  if (!Number.isInteger(ticketId)) {
    return null;
  }

  const rows = await ticketsRepository.findTicketDetailRows(ticketId);
  if (rows.length === 0) {
    return null;
  }

  const paymentRows = await ticketsRepository.findPaymentsByTicketId(
    ticketId
  );
  return assembleTicketFromRows(rows, paymentRows);
}

export interface AddPaymentResult {
  payment: Payment;
  ticket: {
    id: number;
    status: string;
    remainingCents: number;
  };
}

export async function addPayment(
  idParam: string,
  body: any
): Promise<AddPaymentResult | null> {
  const ticketId = Number(idParam);
  if (!Number.isInteger(ticketId)) {
    return null;
  }

  const ticket = await ticketsRepository.findTicketById(ticketId);
  if (!ticket) {
    return null;
  }

  const { tenderedCents, clientPaymentId } = body ?? {};
  const hasClientPaymentId =
    typeof clientPaymentId === "string" && clientPaymentId.length > 0;

  // Idempotent replay check comes first (mirroring clientTicketId on
  // POST /tickets), so retrying the exact payment that completed a ticket
  // still returns success instead of tripping the "already paid" check
  // below.
  if (hasClientPaymentId) {
    const existingPayment =
      await ticketsRepository.findPaymentByClientPaymentId(
        ticketId,
        clientPaymentId
      );
    if (existingPayment) {
      const sumAppliedCents = await ticketsRepository.sumAppliedCentsForTicket(
        ticketId
      );
      return {
        payment: toPaymentApiShape(existingPayment),
        ticket: {
          id: ticket.id,
          status: ticket.status,
          remainingCents:
            ticket.status === "paid"
              ? 0
              : ticket.total_cents - sumAppliedCents,
        },
      };
    }
  }

  if (ticket.status === "paid") {
    throw new ValidationError("ticket is already paid");
  }

  if (!Number.isInteger(tenderedCents) || tenderedCents <= 0) {
    throw new ValidationError("Invalid tendered amount");
  }

  const sumAppliedCents = await ticketsRepository.sumAppliedCentsForTicket(
    ticketId
  );
  const remainingCents = ticket.total_cents - sumAppliedCents;
  const appliedCents = Math.min(tenderedCents, remainingCents);
  const changeCents = tenderedCents - appliedCents;
  const willBePaid = appliedCents === remainingCents;

  const paymentRow = await ticketsRepository.addPayment(
    ticketId,
    tenderedCents,
    appliedCents,
    changeCents,
    hasClientPaymentId ? clientPaymentId : undefined,
    willBePaid ? "paid" : null
  );

  return {
    payment: toPaymentApiShape(paymentRow),
    ticket: {
      id: ticket.id,
      status: willBePaid ? "paid" : "pending_payment",
      remainingCents: remainingCents - appliedCents,
    },
  };
}
