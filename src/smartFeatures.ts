import { ImportedRecipe, Ingredient, Macros } from './types';

const OFF_BASE = 'https://world.openfoodfacts.org';
const headers = { 'User-Agent': 'MauGainZ/2.3.1 (Android; https://github.com/minova-chromium/MauGainz)' };
const productCache = new Map<string, Ingredient>();
const searchCache = new Map<string, { storedAt: number; items: Ingredient[] }>();
const SEARCH_CACHE_MS = 30 * 60 * 1000;
const number = (value: unknown) => Number(String(value ?? '').replace(',', '.')) || 0;
const decodeHtml = (value: string) => value
  .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
  .replace(/&(amp|quot|apos|lt|gt|nbsp|eacute|euml|rsquo|lsquo|ldquo|rdquo);/gi, (entity) => ({
    '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&eacute;': 'é', '&euml;': 'ë', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”'
  } as Record<string, string>)[entity.toLowerCase()] ?? entity);
const clean = (value: unknown) => decodeHtml(String(value ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const blankMacros = (): Macros => ({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  product_name_nl?: string;
  product_name_fr?: string;
  brands?: string;
  image_front_small_url?: string;
  serving_quantity?: number;
  nutriments?: Record<string, number | string>;
};

const productToIngredient = (product: OffProduct, locale: 'en' | 'nl' = 'nl'): Ingredient | null => {
  const localizedName = locale === 'nl' ? product.product_name_nl : product.product_name_en;
  const name = clean(localizedName || product.product_name || product.product_name_nl || product.product_name_fr || product.product_name_en);
  if (!name) return null;
  const nutrients = product.nutriments ?? {};
  const nutritionPer100: Macros = {
    calories: number(nutrients['energy-kcal_100g']) || Math.round(number(nutrients.energy_100g) / 4.184),
    protein: number(nutrients.proteins_100g),
    carbs: number(nutrients.carbohydrates_100g),
    fat: number(nutrients.fat_100g),
    fiber: number(nutrients.fiber_100g)
  };
  return {
    id: `ingredient-${Date.now()}-${Math.random()}`,
    name,
    nameNl: clean(product.product_name_nl) || undefined,
    amount: String(Math.round(number(product.serving_quantity) || 100)),
    unit: 'g',
    barcode: product.code,
    brand: clean(product.brands) || undefined,
    imageUrl: product.image_front_small_url,
    nutritionPer100,
    nutritionSource: 'open-food-facts'
  };
};

export async function lookupBarcode(barcode: string, locale: 'en' | 'nl' = 'nl'): Promise<Ingredient> {
  const cacheKey = `${barcode.trim()}-${locale}`;
  const cached = productCache.get(cacheKey);
  if (cached) return { ...cached, id: `ingredient-${Date.now()}-${Math.random()}` };
  const fields = 'code,product_name,product_name_en,product_name_nl,product_name_fr,brands,image_front_small_url,serving_quantity,nutriments';
  const response = await fetch(`${OFF_BASE}/api/v3/product/${encodeURIComponent(barcode)}?cc=be&lc=${locale}&fields=${fields}`, { headers });
  if (!response.ok) throw new Error('network');
  const data = await response.json() as { status?: number | string; product?: OffProduct };
  const ingredient = data.product ? productToIngredient(data.product, locale) : null;
  if (!ingredient) throw new Error('not-found');
  productCache.set(cacheKey, ingredient);
  return ingredient;
}

export async function searchNutrition(query: string, locale: 'en' | 'nl' = 'nl'): Promise<Ingredient[]> {
  const cacheKey = `${locale}-${query.toLowerCase().trim()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.storedAt < SEARCH_CACHE_MS) return cached.items.map((item) => ({ ...item, id: `ingredient-${Date.now()}-${Math.random()}` }));
  const fields = 'code,product_name,product_name_en,product_name_nl,product_name_fr,brands,image_front_small_url,serving_quantity,nutriments';
  const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=12&cc=be&lc=${locale}&tagtype_0=countries&tag_contains_0=contains&tag_0=belgium&fields=${fields}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error('network');
  const data = await response.json() as { products?: OffProduct[] };
  const items = (data.products ?? []).map((product) => productToIngredient(product, locale)).filter((item): item is Ingredient => !!item && item.nutritionPer100!.calories > 0);
  searchCache.set(cacheKey, { storedAt: Date.now(), items });
  return items;
}

export async function enrichIngredients(ingredients: Ingredient[]): Promise<Ingredient[]> {
  const next = ingredients.map((item) => ({ ...item }));
  for (let index = 0; index < next.length; index += 1) {
    const current = next[index];
    if (!current || !current.name.trim() || current.nutritionPer100) continue;
    try {
      const matches = await searchNutrition(current.name);
      if (matches[0]) next[index] = { ...current, ...matches[0], id: current.id, name: current.name, nameNl: current.nameNl, amount: current.amount, unit: current.unit };
    } catch { /* Keep the local MauGainZ estimate when offline. */ }
  }
  return next;
}

const units = '(?:kg|mg|g|gram|ml|cl|dl|l|liter|deciliter|tbsp|tsp|el|eetlepel|tl|theelepel|cup|cups|scoop|scoops|stengel|stengels|teentje|teentjes|takje|takjes|blaadje|blaadjes|bosje|bosjes|bolletje|bolletjes|vel|vellen|dopje|dopjes|snuifje|snuifjes|klontje|klontjes|scheutje|scheutjes|stuk|stuks|piece|pieces|x)?';
const ingredientPattern = new RegExp(`^[-•*]?\\s*(\\d+(?:[.,/]\\d+)?(?:\\s+\\d+/\\d+)?)?\\s*(${units})\\s+(.+)$`, 'i');
const normalizeImportedUnit = (raw = '') => {
  const unit = raw.toLowerCase();
  if (/^(?:g|gram)$/.test(unit)) return 'g';
  if (/^(?:l|liter)$/.test(unit)) return 'l';
  if (unit === 'deciliter') return 'dl';
  if (/^(?:el|eetlepel|tbsp)$/.test(unit)) return 'tbsp';
  if (/^(?:tl|theelepel|tsp)$/.test(unit)) return 'tsp';
  if (/^(?:scoops?|schep)$/.test(unit)) return 'scoop';
  if (/^(?:stengels?|teentjes?|takjes?|blaadjes?|bosjes?|bolletjes?|vel|vellen|dopjes?|snuifjes?|klontjes?|scheutjes?|stuks?|pieces?|x)$/.test(unit)) return 'pc';
  return unit || 'pc';
};
const parseAmount = (raw = '') => {
  if (!raw.includes('/')) return raw.replace(',', '.') || '1';
  const parts = raw.trim().split(/\s+/);
  return String(parts.reduce((total, part) => {
    if (!part.includes('/')) return total + number(part);
    const [a, b] = part.split('/').map(Number);
    return total + (b ? (a ?? 0) / b : 0);
  }, 0));
};

export function parseRecipeText(rawText: string): ImportedRecipe {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const title = clean(lines[0]) || 'Imported recipe';
  let section: 'unknown' | 'ingredients' | 'steps' = 'unknown';
  const ingredients: Ingredient[] = [];
  const steps: string[] = [];
  let servings: number | undefined;
  let prepTime: number | undefined;
  const macros = blankMacros();
  for (const original of lines.slice(1)) {
    const line = original.replace(/^#+\s*/, '').trim();
    if (/^(ingredients?|ingredienten|benodigdheden)\b/i.test(line)) { section = 'ingredients'; continue; }
    if (/^(instructions?|directions?|method|preparation|bereiding|stappen)\b/i.test(line)) { section = 'steps'; continue; }
    const servingsMatch = line.match(/(?:servings?|porties?)\D*(\d+)/i); if (servingsMatch) { servings = number(servingsMatch[1]); continue; }
    const timeMatch = line.match(/(?:prep(?:aration)?\s*time|bereidingstijd)\D*(\d+)/i); if (timeMatch) { prepTime = number(timeMatch[1]); continue; }
    const macroMatch = line.match(/(calories|kcal|protein|eiwit|carbs|koolhydraten|fat|vet|fiber|vezels)\D*(\d+(?:[.,]\d+)?)/i);
    if (macroMatch) {
      const key = (macroMatch[1] ?? '').toLowerCase(); const value = number(macroMatch[2]);
      if (/calories|kcal/.test(key)) macros.calories = value; else if (/protein|eiwit/.test(key)) macros.protein = value; else if (/carbs|kool/.test(key)) macros.carbs = value; else if (/fat|vet/.test(key)) macros.fat = value; else macros.fiber = value;
      continue;
    }
    const match = line.match(ingredientPattern);
    const looksLikeIngredient = section === 'ingredients' || (!!match && !/^\d+[.)]\s/.test(line));
    if (looksLikeIngredient && match) {
      ingredients.push({ id: `ingredient-${Date.now()}-${ingredients.length}`, name: clean(match[3]), amount: parseAmount(match[1]), unit: normalizeImportedUnit(match[2]) });
    } else if (section === 'steps' || /^\d+[.)]\s/.test(line)) {
      steps.push(clean(line.replace(/^\d+[.)]\s*/, '')));
    }
  }
  return { title, ingredients, steps, servings, prepTime, macros: Object.values(macros).some(Boolean) ? macros : undefined };
}

const asArray = <T>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];

/** Dagelijkse Kost's JSON-LD contains only two preview steps. The rendered
 * ordered lists contain every numbered step as well as separate tips and
 * ingredient reminders. Only import the large-body instruction for each step. */
export function extractDagelijkseKostSteps(html: string): string[] {
  const numbered = new Map<number, string>();
  const lists = [...html.matchAll(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi)];
  for (const list of lists) {
    const items = [...(list[1] ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)];
    for (const item of items) {
      const body = item[1] ?? '';
      const numberMatch = body.match(/<(?:span|p)\b[^>]*class=["'][^"']*MuiTypography-titleLarge[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|p)>/i);
      const textMatch = body.match(/<(?:p|span)\b[^>]*class=["'][^"']*MuiTypography-bodyLarge[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|span)>/i);
      const stepNumber = Number(clean(numberMatch?.[1]));
      const description = clean(textMatch?.[1]);
      if (stepNumber > 0 && description && !numbered.has(stepNumber)) numbered.set(stepNumber, description);
    }
  }
  return [...numbered.entries()].sort(([a], [b]) => a - b).map(([, description]) => description);
}

export async function importRecipeFromUrl(url: string): Promise<ImportedRecipe> {
  const response = await fetch(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  if (!response.ok) throw new Error('network');
  const html = await response.text();
  const host = url.replace(/^https?:\/\//i, '').split('/')[0] ?? '';
  const renderedSteps = /(?:^|\.)dagelijksekost\.vrt\.be$/i.test(host) ? extractDagelijkseKostSteps(html) : [];
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    try {
      if (!script[1]) continue;
      const parsed = JSON.parse(script[1]);
      const nodes = asArray(parsed).flatMap((item: any) => item?.['@graph'] ? asArray(item['@graph']) : [item]);
      const recipe: any = nodes.find((item: any) => asArray(item?.['@type']).includes('Recipe'));
      if (!recipe) continue;
      const ingredients = asArray<string>(recipe.recipeIngredient).map((line, index) => {
        const match = clean(line).match(ingredientPattern);
        return { id: `ingredient-${Date.now()}-${index}`, name: clean(match?.[3] || line), amount: parseAmount(match?.[1]), unit: normalizeImportedUnit(match?.[2]) };
      });
      const schemaInstructions = asArray<any>(recipe.recipeInstructions).flatMap((step) => typeof step === 'string' ? [step] : step?.itemListElement ? asArray(step.itemListElement).map((item: any) => item.text || item.name) : [step?.text || step?.name]).map(clean).filter(Boolean);
      const instructions = renderedSteps.length > schemaInstructions.length ? renderedSteps : schemaInstructions;
      const duration = String(recipe.prepTime || recipe.totalTime || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
      const image = Array.isArray(recipe.image) ? recipe.image[0] : typeof recipe.image === 'object' ? recipe.image?.url : recipe.image;
      return { title: clean(recipe.name) || 'Imported recipe', subtitle: clean(recipe.description), servings: number(String(recipe.recipeYield ?? '').match(/\d+/)?.[0]) || undefined, prepTime: duration ? number(duration[1]) * 60 + number(duration[2]) : undefined, ingredients, steps: instructions, photoUri: image, sourceUrl: url };
    } catch { /* Try the next JSON-LD block. */ }
  }
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  const parsed = parseRecipeText(text);
  return renderedSteps.length > parsed.steps.length ? { ...parsed, steps: renderedSteps, sourceUrl: url } : parsed;
}
