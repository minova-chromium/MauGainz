export type Ingredient = {
  id: string;
  name: string;
  nameNl?: string;
  amount: string;
  unit: string;
  barcode?: string;
  brand?: string;
  imageUrl?: string;
  nutritionPer100?: Macros;
  nutritionSource?: 'open-food-facts' | 'maugainz';
};

export type Macros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export type Recipe = {
  id: string;
  title: string;
  titleNl?: string;
  subtitle: string;
  subtitleNl?: string;
  category: string;
  prepTime: number;
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
  stepsNl?: string[];
  macros: Macros;
  accent: string;
  icon: string;
  favorite: boolean;
  createdAt: number;
  photoUri?: string;
  dietaryTags?: string[];
  allergens?: string[];
  stepTimers?: number[];
};

export type TabName = 'home' | 'recipes' | 'create' | 'planner' | 'macros';

export type Locale = 'en' | 'nl';

export type IngredientOption = {
  en: string;
  nl: string;
  group: 'Protein' | 'Carbs' | 'Vegetables' | 'Fruit' | 'Dairy' | 'Fats' | 'Flavour';
};

export type CategoryOption = {
  name: string;
  color: string;
  icon: string;
};

export type UserGoals = {
  weightKg: number;
  goal: 'cut' | 'maintain' | 'gain';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type ShoppingItem = {
  id: string;
  name: string;
  amount: string;
  unit: string;
  checked: boolean;
  recipeId?: string;
};

export type MealPlanEntry = {
  id: string;
  date: string;
  meal: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  recipeId: string;
};

export type UnitSystem = 'metric' | 'imperial';

export type ImportedRecipe = {
  title: string;
  subtitle?: string;
  servings?: number;
  prepTime?: number;
  ingredients: Ingredient[];
  steps: string[];
  macros?: Macros;
  photoUri?: string;
  sourceUrl?: string;
};

export type CloudSyncConfig = {
  enabled: boolean;
  syncCode: string;
  lastSyncedAt?: number;
};
