export interface TicketItemModifier {
  optionId: string;
  optionName: string;
  priceDeltaCents: number;
}

export interface TicketItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  modifiers: TicketItemModifier[];
}

export interface Payment {
  id: number;
  tenderedCents: number;
  appliedCents: number;
  changeCents: number;
  createdAt: Date;
}

export interface Ticket {
  id: number;
  status: string;
  items: TicketItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  tenderedCents: number | null;
  changeCents: number | null;
  createdAt: Date;
  remainingCents: number;
  payments: Payment[];
}

export interface TicketListItem {
  id: number;
  status: string;
  totalCents: number;
  createdAt: Date;
}

export interface CreateTicketItemInput {
  productId: string;
  quantity: number;
  selectedOptionIds?: string[];
}

export interface CreateTicketRequestBody {
  items: CreateTicketItemInput[];
  clientTicketId?: string;
}

export interface AddPaymentRequestBody {
  tenderedCents: number;
  clientPaymentId?: string;
}
