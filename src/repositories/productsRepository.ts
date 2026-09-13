import { pool } from "../db";

export interface ProductRow {
  id: string;
  name: string;
  sold_out: boolean;
  category: string;
  price_cents: number;
  description: string | null;
  mg_id: string | null;
  mg_name: string | null;
  mg_required: boolean | null;
  mo_id: string | null;
  mo_name: string | null;
  mo_price_delta_cents: number | null;
}

export interface ProductSummaryRow {
  id: string;
  name: string;
  sold_out: boolean;
  price_cents: number;
}

export interface ProductModifierGroupRow {
  product_id: string;
  group_id: string;
  group_name: string;
  group_required: boolean;
  option_id: string | null;
  option_name: string | null;
  option_price_delta_cents: number | null;
}

function buildProductsQuery(whereClause = ""): string {
  return `
    SELECT
      p.id, p.name, p.sold_out, p.category, p.price_cents, p.description,
      mg.id AS mg_id, mg.name AS mg_name, mg.required AS mg_required,
      mo.id AS mo_id, mo.name AS mo_name, mo.price_delta_cents AS mo_price_delta_cents
    FROM products p
    LEFT JOIN product_modifier_groups pmg ON pmg.product_id = p.id
    LEFT JOIN modifier_groups mg ON mg.id = pmg.modifier_group_id
    LEFT JOIN modifier_options mo ON mo.modifier_group_id = mg.id
    ${whereClause}
    ORDER BY p.id, mg.id, mo.id
  `;
}

export async function findAllProductRows(): Promise<ProductRow[]> {
  const result = await pool.query<ProductRow>(buildProductsQuery());
  return result.rows;
}

export async function findProductRowsById(id: string): Promise<ProductRow[]> {
  const result = await pool.query<ProductRow>(
    buildProductsQuery("WHERE p.id = $1"),
    [id]
  );
  return result.rows;
}

export async function findProductSummariesByIds(
  ids: string[]
): Promise<ProductSummaryRow[]> {
  const result = await pool.query<ProductSummaryRow>(
    `SELECT id, name, sold_out, price_cents FROM products WHERE id = ANY($1::text[])`,
    [ids]
  );
  return result.rows;
}

export async function findProductModifierGroupRows(
  productIds: string[]
): Promise<ProductModifierGroupRow[]> {
  const result = await pool.query<ProductModifierGroupRow>(
    `
    SELECT
      pmg.product_id AS product_id,
      mg.id AS group_id, mg.name AS group_name, mg.required AS group_required,
      mo.id AS option_id, mo.name AS option_name, mo.price_delta_cents AS option_price_delta_cents
    FROM product_modifier_groups pmg
    JOIN modifier_groups mg ON mg.id = pmg.modifier_group_id
    LEFT JOIN modifier_options mo ON mo.modifier_group_id = mg.id
    WHERE pmg.product_id = ANY($1::text[])
    ORDER BY pmg.product_id, mg.id, mo.id
    `,
    [productIds]
  );
  return result.rows;
}
