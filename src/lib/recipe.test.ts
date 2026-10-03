import { describe, expect, it } from 'vitest';
import { compatibleUnits, costPerBaseUnit, lineCost, recipeCost } from './recipe';
import type { Ingredient } from './types';

const ing = (over: Partial<Ingredient> = {}): Ingredient => ({
  id: 'i', updatedAt: 0, name: 'Flour', unit: 'kg', packSize: 1, packCost: 250, note: '', createdAt: 0, ...over,
});

describe('ingredient costing', () => {
  it('prices per base unit, keeping sub-cent precision', () => {
    expect(costPerBaseUnit(ing())).toBeCloseTo(0.25); // $2.50/kg = 0.25¢ per gram
    expect(costPerBaseUnit(ing({ unit: 'l', packSize: 2, packCost: 400 }))).toBeCloseTo(0.2);
  });

  it('converts between units of the same family', () => {
    expect(lineCost(ing(), 200, 'g')).toBeCloseTo(50); // 200 g of $2.50/kg
    expect(lineCost(ing(), 0.2, 'kg')).toBeCloseTo(50);
    expect(compatibleUnits('g')).toEqual(['g', 'kg']);
    expect(compatibleUnits('pcs')).toEqual(['pcs']);
  });

  it('refuses to price mismatched units instead of guessing', () => {
    expect(lineCost(ing(), 5, 'ml')).toBe(0);
    expect(lineCost(undefined, 5, 'g')).toBe(0);
  });

  it('divides a batch across the yield and adds per-item extras', () => {
    const flour = ing();
    const eggs = ing({ id: 'e', name: 'Eggs', unit: 'pcs', packSize: 12, packCost: 480 }); // 40¢ each
    const r = recipeCost(
      {
        recipe: [
          { ingredientId: 'i', qty: 500, unit: 'g' }, // 125
          { ingredientId: 'e', qty: 3, unit: 'pcs' }, // 120
        ],
        recipeYield: 10,
        extraCost: 15,
      },
      [flour, eggs],
    );
    expect(r.batchCost).toBeCloseTo(245);
    expect(r.ingredientsPerItem).toBeCloseTo(24.5);
    expect(r.perItem).toBe(40); // round(24.5 + 15)
    expect(r.missing).toEqual([]);
  });

  it('reports deleted ingredients and treats a missing yield as one', () => {
    const r = recipeCost({ recipe: [{ ingredientId: 'gone', qty: 1, unit: 'g' }], recipeYield: 0 }, []);
    expect(r.missing).toEqual(['gone']);
    expect(r.yieldCount).toBe(1);
    expect(r.perItem).toBe(0);
  });
});
