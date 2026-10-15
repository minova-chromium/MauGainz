import { ingredientSuggestions } from './data';
import { Ingredient, Macros } from './types';

type Nutrition = Macros;

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const n = (calories: number, protein: number, carbs: number, fat: number, fiber = 0): Nutrition => ({ calories, protein, carbs, fat, fiber });

// Practical estimates per 100 g. These keep recipe calculations useful offline;
// labels on packaged products remain the source of truth.
const nutritionByName: Record<string, Nutrition> = {
  'chicken breast': n(165, 31, 0, 3.6), 'chicken thigh': n(209, 26, 0, 10.9), 'turkey breast': n(135, 29, 0, 1),
  'lean beef mince': n(176, 26, 0, 8), steak: n(271, 25, 0, 19), 'pork tenderloin': n(143, 26, 0, 3.5),
  salmon: n(208, 20, 0, 13), tuna: n(132, 29, 0, 1), shrimp: n(99, 24, 0.2, 0.3), eggs: n(143, 13, 0.7, 9.5),
  'egg whites': n(52, 11, 0.7, 0.2), tofu: n(144, 17, 2.8, 8.7, 2.3), tempeh: n(195, 20, 7.6, 11, 3.9),
  'whey protein': n(400, 80, 7, 6), 'casein protein': n(370, 78, 10, 3),
  'basmati rice': n(360, 8, 78, 1, 1), 'jasmine rice': n(356, 7, 80, 0.7, 1), 'brown rice': n(362, 8, 76, 2.7, 3.5),
  pasta: n(371, 13, 75, 1.5, 3.2), 'wholegrain pasta': n(350, 14, 68, 2.5, 8), potatoes: n(77, 2, 17, 0.1, 2.2),
  'sweet potato': n(86, 1.6, 20, 0.1, 3), oats: n(389, 17, 66, 6.9, 10.6), quinoa: n(368, 14, 64, 6.1, 7),
  couscous: n(376, 13, 77, 0.6, 5), bread: n(265, 9, 49, 3.2, 2.7), tortilla: n(312, 8, 52, 8, 3),
  'rice cakes': n(387, 8, 81, 3, 4), broccoli: n(34, 2.8, 7, 0.4, 2.6), spinach: n(23, 2.9, 3.6, 0.4, 2.2),
  'green beans': n(31, 1.8, 7, 0.2, 2.7), 'bell pepper': n(31, 1, 6, 0.3, 2.1), zucchini: n(17, 1.2, 3.1, 0.3, 1),
  mushrooms: n(22, 3.1, 3.3, 0.3, 1), carrot: n(41, 0.9, 10, 0.2, 2.8), asparagus: n(20, 2.2, 3.9, 0.1, 2.1),
  tomato: n(18, 0.9, 3.9, 0.2, 1.2), cucumber: n(15, 0.7, 3.6, 0.1, 0.5), corn: n(86, 3.3, 19, 1.4, 2.7),
  'black beans': n(339, 21, 63, 0.9, 16), chickpeas: n(364, 19, 61, 6, 17), banana: n(89, 1.1, 23, 0.3, 2.6),
  blueberries: n(57, 0.7, 14, 0.3, 2.4), strawberries: n(32, 0.7, 7.7, 0.3, 2), apple: n(52, 0.3, 14, 0.2, 2.4),
  mango: n(60, 0.8, 15, 0.4, 1.6), pineapple: n(50, 0.5, 13, 0.1, 1.4), 'greek yoghurt': n(73, 10, 4, 2),
  skyr: n(63, 11, 4, 0.2), 'cottage cheese': n(98, 11, 3.4, 4.3), milk: n(47, 3.4, 4.8, 1.5),
  'almond milk': n(15, 0.6, 0.6, 1.2), cheddar: n(403, 25, 1.3, 33), mozzarella: n(280, 28, 3.1, 17),
  'olive oil': n(884, 0, 0, 100), avocado: n(160, 2, 8.5, 15, 6.7), 'peanut butter': n(588, 25, 20, 50, 6),
  almonds: n(579, 21, 22, 50, 12.5), walnuts: n(654, 15, 14, 65, 6.7), 'chia seeds': n(486, 17, 42, 31, 34),
  honey: n(304, 0.3, 82, 0), 'soy sauce': n(53, 8, 4.9, 0.6), garlic: n(149, 6.4, 33, 0.5, 2.1),
  ginger: n(80, 1.8, 18, 0.8, 2), 'smoked paprika': n(282, 14, 54, 13, 35), 'curry powder': n(325, 14, 56, 14, 53),
  'hot sauce': n(12, 1, 2, 0.4, 1)
};

const pieceWeights: Record<string, number> = { eggs: 50, banana: 118, apple: 180, avocado: 150, tortilla: 65, bread: 38, garlic: 3 };

export const estimateIngredientGrams = (ingredient: Ingredient) => {
  const amount = Number(ingredient.amount.replace(',', '.')) || 0;
  if (ingredient.unit === 'g' || ingredient.unit === 'ml') return amount;
  if (ingredient.unit === 'kg' || ingredient.unit === 'l') return amount * 1000;
  if (ingredient.unit === 'dl') return amount * 100;
  if (ingredient.unit === 'cl') return amount * 10;
  if (ingredient.unit === 'tbsp') return amount * 15;
  if (ingredient.unit === 'tsp') return amount * 5;
  if (ingredient.unit === 'scoop') return amount * 30;
  return amount * (pieceWeights[normalize(ingredient.name)] ?? 100);
};

export const estimateRecipeMacros = (ingredients: Ingredient[], servings: number): Macros => {
  const total = ingredients.reduce((sum, ingredient) => {
    const option = ingredientSuggestions.find((item) => [item.en, item.nl].some((name) => normalize(name) === normalize(ingredient.name) || normalize(name) === normalize(ingredient.nameNl ?? '')));
    const profile = ingredient.nutritionPer100 ?? (option ? nutritionByName[normalize(option.en)] : undefined);
    if (!profile) return sum;
    const multiplier = estimateIngredientGrams(ingredient) / 100;
    return {
      calories: sum.calories + profile.calories * multiplier,
      protein: sum.protein + profile.protein * multiplier,
      carbs: sum.carbs + profile.carbs * multiplier,
      fat: sum.fat + profile.fat * multiplier,
      fiber: sum.fiber + profile.fiber * multiplier
    };
  }, n(0, 0, 0, 0, 0));
  const divisor = Math.max(1, servings);
  return Object.fromEntries(Object.entries(total).map(([key, value]) => [key, Math.round(value / divisor)])) as Macros;
};

export const nutritionCoverage = (ingredients: Ingredient[]) => ingredients.filter((ingredient) =>
  ingredient.nutritionPer100 || ingredientSuggestions.some((item) => [item.en, item.nl].some((name) => normalize(name) === normalize(ingredient.name) || normalize(name) === normalize(ingredient.nameNl ?? '')))
).length;
