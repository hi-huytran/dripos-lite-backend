import * as productsRepository from "../repositories/productsRepository";
import { ProductRow } from "../repositories/productsRepository";
import { Product } from "../types/product";

function assembleProducts(rows: ProductRow[]): Product[] {
  const productsById = new Map<string, Product>();

  for (const row of rows) {
    let product = productsById.get(row.id);
    if (!product) {
      product = {
        id: row.id,
        name: row.name,
        soldOut: row.sold_out,
        category: row.category,
        priceCents: row.price_cents,
        description: row.description,
        modifierGroups: [],
      };
      productsById.set(row.id, product);
    }

    if (row.mg_id) {
      let group = product.modifierGroups.find((g) => g.id === row.mg_id);
      if (!group) {
        group = {
          id: row.mg_id,
          name: row.mg_name as string,
          required: row.mg_required as boolean,
          options: [],
        };
        product.modifierGroups.push(group);
      }

      if (row.mo_id) {
        group.options.push({
          id: row.mo_id,
          name: row.mo_name as string,
          priceDeltaCents: row.mo_price_delta_cents as number,
        });
      }
    }
  }

  return Array.from(productsById.values());
}

export async function getAllProducts(): Promise<Product[]> {
  const rows = await productsRepository.findAllProductRows();
  return assembleProducts(rows);
}

export async function getProductById(id: string): Promise<Product | null> {
  const rows = await productsRepository.findProductRowsById(id);
  if (rows.length === 0) {
    return null;
  }
  return assembleProducts(rows)[0];
}
