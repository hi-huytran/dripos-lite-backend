import { pool } from "./db";

const MODIFIER_GROUPS_URL =
  "https://crema.dripos.com/api/mock/VFP9EVKH/modifier-groups";
const PRODUCTS_URL = "https://crema.dripos.com/api/mock/VFP9EVKH/products";

interface ModifierOption {
  id: string;
  name: string;
  priceDeltaCents: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  options: ModifierOption[];
}

interface Product {
  id: string;
  name: string;
  soldOut: boolean;
  category: string;
  priceCents: number;
  description: string | null;
  modifierGroupIds: string[];
}

async function seedModifierGroups() {
  const res = await fetch(MODIFIER_GROUPS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch modifier groups: ${res.status}`);
  }
  const groups = (await res.json()) as ModifierGroup[];

  for (const group of groups) {
    await pool.query(
      `INSERT INTO modifier_groups (id, name, required)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [group.id, group.name, group.required]
    );

    for (const option of group.options) {
      await pool.query(
        `INSERT INTO modifier_options (id, modifier_group_id, name, price_delta_cents)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [option.id, group.id, option.name, option.priceDeltaCents]
      );
    }
  }

  console.log(`Seeded ${groups.length} modifier groups.`);
  return groups.length;
}

async function seedProducts() {
  const res = await fetch(PRODUCTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch products: ${res.status}`);
  }
  const products = (await res.json()) as Product[];

  for (const product of products) {
    await pool.query(
      `INSERT INTO products (id, name, sold_out, category, price_cents, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        product.id,
        product.name,
        product.soldOut,
        product.category,
        product.priceCents,
        product.description ?? null,
      ]
    );

    for (const modifierGroupId of product.modifierGroupIds) {
      await pool.query(
        `INSERT INTO product_modifier_groups (product_id, modifier_group_id)
         VALUES ($1, $2)
         ON CONFLICT (product_id, modifier_group_id) DO NOTHING`,
        [product.id, modifierGroupId]
      );
    }
  }

  console.log(`Seeded ${products.length} products.`);
  return products.length;
}

async function seed() {
  await seedModifierGroups();
  await seedProducts();
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
