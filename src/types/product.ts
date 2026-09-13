export interface ModifierOption {
  id: string;
  name: string;
  priceDeltaCents: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  options: ModifierOption[];
}

export interface Product {
  id: string;
  name: string;
  soldOut: boolean;
  category: string;
  priceCents: number;
  description: string | null;
  modifierGroups: ModifierGroup[];
}
