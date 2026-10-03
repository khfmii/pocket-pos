import { t } from '../i18n';
import type { Ingredient, IngredientUnit, Product, RecipeLine } from './types';

type Family = 'mass' | 'volume' | 'count';

const UNITS: Record<IngredientUnit, { family: Family; factor: number; label: string }> = {
  g: { family: 'mass', factor: 1, label: 'g' },
  kg: { family: 'mass', factor: 1000, label: 'kg' },
  ml: { family: 'volume', factor: 1, label: 'ml' },
  l: { family: 'volume', factor: 1000, label: 'L' },
  pcs: { family: 'count', factor: 1, label: 'pcs' },
};

export const UNIT_LABEL = (u: IngredientUnit) => (u === 'pcs' ? t('pcs') : UNITS[u].label);
export const ALL_UNITS: IngredientUnit[] = ['g', 'kg', 'ml', 'l', 'pcs'];

/** Units that can be converted to/from `u` (kg ↔ g, L ↔ ml, pcs alone). */
export function compatibleUnits(u: IngredientUnit): IngredientUnit[] {
  return ALL_UNITS.filter((x) => UNITS[x].family === UNITS[u].family);
}

/** Cost of ONE base unit (1 g, 1 ml or 1 pc) in minor units — fractional on purpose (flour is ~0.25¢ per gram). */
export function costPerBaseUnit(ing: Pick<Ingredient, 'unit' | 'packSize' | 'packCost'>): number {
  const baseQty = ing.packSize * UNITS[ing.unit].factor;
  return baseQty > 0 ? ing.packCost / baseQty : 0;
}

/** Cost of `qty` of `unit` of this ingredient, in (fractional) minor units. */
export function lineCost(ing: Ingredient | undefined, qty: number, unit: IngredientUnit): number {
  if (!ing || qty <= 0) return 0;
  if (UNITS[unit].family !== UNITS[ing.unit].family) return 0; // mismatched families can't be priced
  return qty * UNITS[unit].factor * costPerBaseUnit(ing);
}

export interface RecipeCost {
  lines: { line: RecipeLine; ingredient?: Ingredient; cost: number }[];
  batchCost: number; // all ingredients for one batch (fractional minor units)
  yieldCount: number;
  ingredientsPerItem: number;
  extra: number;
  perItem: number; // rounded to whole minor units — what becomes the product's cost
  missing: string[]; // ingredient ids no longer in the catalogue
}

export function recipeCost(
  p: Pick<Product, 'recipe' | 'recipeYield' | 'extraCost'>,
  ingredients: Ingredient[],
): RecipeCost {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const lines = (p.recipe ?? []).map((line) => {
    const ingredient = byId.get(line.ingredientId);
    return { line, ingredient, cost: lineCost(ingredient, line.qty, line.unit) };
  });
  const batchCost = lines.reduce((a, l) => a + l.cost, 0);
  const yieldCount = Math.max(1, p.recipeYield || 1);
  const ingredientsPerItem = batchCost / yieldCount;
  const extra = p.extraCost ?? 0;
  return {
    lines,
    batchCost,
    yieldCount,
    ingredientsPerItem,
    extra,
    perItem: Math.round(ingredientsPerItem + extra),
    missing: lines.filter((l) => !l.ingredient).map((l) => l.line.ingredientId),
  };
}

/** "$2.50 / kg" style label for an ingredient's purchase price, using the supplied money formatter. */
export function packLabel(ing: Ingredient, money: (minor: number) => string): string {
  return `${money(ing.packCost)} / ${trim(ing.packSize)} ${UNIT_LABEL(ing.unit)}`;
}

export const trim = (n: number) => String(Math.round(n * 1000) / 1000);
