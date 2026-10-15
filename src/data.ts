import { IngredientOption, Locale, Recipe } from './types';

export const DAILY_TARGET = { calories: 2800, protein: 190, carbs: 320, fat: 80 };

export const starterRecipes: Recipe[] = [
  {
    id: 'power-bowl',
    title: 'Power Chicken Bowl',
    titleNl: 'Power Kip Bowl',
    subtitle: 'Lean, loaded & ready to perform',
    subtitleNl: 'Mager, rijkgevuld en klaar om te presteren',
    category: 'Post-workout',
    prepTime: 25,
    servings: 2,
    accent: '#D2A74A',
    icon: 'nutrition-outline',
    favorite: true,
    createdAt: 3,
    ingredients: [
      { id: 'i1', name: 'Chicken breast', nameNl: 'Kipfilet', amount: '300', unit: 'g' },
      { id: 'i2', name: 'Basmati rice', nameNl: 'Basmatirijst', amount: '160', unit: 'g' },
      { id: 'i3', name: 'Broccoli', nameNl: 'Broccoli', amount: '200', unit: 'g' },
      { id: 'i4', name: 'Greek yoghurt', nameNl: 'Griekse yoghurt', amount: '100', unit: 'g' },
      { id: 'i5', name: 'Smoked paprika', nameNl: 'Gerookt paprikapoeder', amount: '2', unit: 'tsp' }
    ],
    steps: [
      'Cook the rice according to the package instructions until fluffy.',
      'Season the chicken with smoked paprika, salt and black pepper.',
      'Sear the chicken in a hot pan for 6–7 minutes per side, then rest and slice.',
      'Steam the broccoli until bright green with a little bite left.',
      'Build your bowl and finish with seasoned Greek yoghurt.'
    ],
    stepsNl: [
      'Kook de rijst volgens de verpakking tot hij mooi luchtig is.',
      'Kruid de kip met gerookt paprikapoeder, zout en zwarte peper.',
      'Bak de kip 6–7 minuten per kant, laat rusten en snijd in plakjes.',
      'Stoom de broccoli beetgaar en helder groen.',
      'Bouw je bowl op en werk af met gekruide Griekse yoghurt.'
    ],
    macros: { calories: 684, protein: 62, carbs: 74, fat: 14, fiber: 8 }
  },
  {
    id: 'protein-pancakes',
    title: 'Sunday Stack',
    titleNl: 'Zondags Stapeltje',
    subtitle: 'Fluffy protein pancakes',
    subtitleNl: 'Luchtige proteïnepannenkoeken',
    category: 'Breakfast',
    prepTime: 15,
    servings: 1,
    accent: '#B98C3D',
    icon: 'sunny-outline',
    favorite: false,
    createdAt: 2,
    ingredients: [
      { id: 'i1', name: 'Oats', nameNl: 'Havermout', amount: '80', unit: 'g' },
      { id: 'i2', name: 'Whey protein', nameNl: 'Wei-eiwit', amount: '30', unit: 'g' },
      { id: 'i3', name: 'Banana', nameNl: 'Banaan', amount: '1', unit: 'pc' },
      { id: 'i4', name: 'Eggs', nameNl: 'Eieren', amount: '2', unit: 'pc' },
      { id: 'i5', name: 'Blueberries', nameNl: 'Blauwe bessen', amount: '80', unit: 'g' }
    ],
    steps: [
      'Blend oats, whey, banana and eggs into a smooth batter.',
      'Warm a non-stick pan over medium heat.',
      'Cook small pancakes for 90 seconds per side.',
      'Stack, add blueberries and dig in.'
    ],
    stepsNl: [
      'Mix havermout, wei-eiwit, banaan en eieren tot een glad beslag.',
      'Verwarm een antiaanbakpan op middelhoog vuur.',
      'Bak kleine pannenkoeken ongeveer 90 seconden per kant.',
      'Stapel ze op, voeg blauwe bessen toe en geniet.'
    ],
    macros: { calories: 612, protein: 46, carbs: 72, fat: 16, fiber: 10 }
  },
  {
    id: 'beef-burrito',
    title: 'Bulk Mode Burrito',
    titleNl: 'Bulkmodus Burrito',
    subtitle: 'Big fuel, zero nonsense',
    subtitleNl: 'Veel brandstof, geen gedoe',
    category: 'High calorie',
    prepTime: 30,
    servings: 2,
    accent: '#D5D9DA',
    icon: 'flame-outline',
    favorite: true,
    createdAt: 1,
    ingredients: [
      { id: 'i1', name: 'Lean beef mince', nameNl: 'Mager rundergehakt', amount: '300', unit: 'g' },
      { id: 'i2', name: 'Large tortilla', nameNl: 'Grote tortilla', amount: '2', unit: 'pc' },
      { id: 'i3', name: 'Black beans', nameNl: 'Zwarte bonen', amount: '160', unit: 'g' },
      { id: 'i4', name: 'Cooked rice', nameNl: 'Gekookte rijst', amount: '200', unit: 'g' },
      { id: 'i5', name: 'Cheddar', nameNl: 'Cheddar', amount: '50', unit: 'g' }
    ],
    steps: [
      'Brown the beef in a large pan and season aggressively.',
      'Warm the beans and rice, then lay out the tortillas.',
      'Divide fillings and cheese between both tortillas.',
      'Fold tightly and toast seam-side down until golden.'
    ],
    stepsNl: [
      'Bak het gehakt rul in een grote pan en kruid stevig.',
      'Verwarm de bonen en rijst en leg de tortilla’s klaar.',
      'Verdeel de vulling en kaas over beide tortilla’s.',
      'Vouw strak dicht en rooster met de naad naar beneden goudbruin.'
    ],
    macros: { calories: 892, protein: 58, carbs: 96, fat: 30, fiber: 13 }
  }
];

export const categories = ['All', 'Breakfast', 'Post-workout', 'High calorie', 'Quick meal'];

export const categoryLabel = (category: string, locale: Locale) => {
  if (locale === 'en') return category;
  return ({
    All: 'Alles',
    Breakfast: 'Ontbijt',
    'Post-workout': 'Na training',
    'High calorie': 'Calorierijk',
    'Quick meal': 'Snelle maaltijd'
  } as Record<string, string>)[category] ?? category;
};

export const ingredientSuggestions: IngredientOption[] = [
  { en: 'Chicken breast', nl: 'Kipfilet', group: 'Protein' },
  { en: 'Chicken thigh', nl: 'Kippendij', group: 'Protein' },
  { en: 'Turkey breast', nl: 'Kalkoenfilet', group: 'Protein' },
  { en: 'Lean beef mince', nl: 'Mager rundergehakt', group: 'Protein' },
  { en: 'Steak', nl: 'Biefstuk', group: 'Protein' },
  { en: 'Pork tenderloin', nl: 'Varkenshaas', group: 'Protein' },
  { en: 'Salmon', nl: 'Zalm', group: 'Protein' },
  { en: 'Tuna', nl: 'Tonijn', group: 'Protein' },
  { en: 'Shrimp', nl: 'Garnalen', group: 'Protein' },
  { en: 'Eggs', nl: 'Eieren', group: 'Protein' },
  { en: 'Egg whites', nl: 'Eiwitten', group: 'Protein' },
  { en: 'Tofu', nl: 'Tofu', group: 'Protein' },
  { en: 'Tempeh', nl: 'Tempeh', group: 'Protein' },
  { en: 'Whey protein', nl: 'Wei-eiwit', group: 'Protein' },
  { en: 'Casein protein', nl: 'Caseïne-eiwit', group: 'Protein' },
  { en: 'Basmati rice', nl: 'Basmatirijst', group: 'Carbs' },
  { en: 'Jasmine rice', nl: 'Jasmijnrijst', group: 'Carbs' },
  { en: 'Brown rice', nl: 'Zilvervliesrijst', group: 'Carbs' },
  { en: 'Pasta', nl: 'Pasta', group: 'Carbs' },
  { en: 'Wholegrain pasta', nl: 'Volkorenpasta', group: 'Carbs' },
  { en: 'Potatoes', nl: 'Aardappelen', group: 'Carbs' },
  { en: 'Sweet potato', nl: 'Zoete aardappel', group: 'Carbs' },
  { en: 'Oats', nl: 'Havermout', group: 'Carbs' },
  { en: 'Quinoa', nl: 'Quinoa', group: 'Carbs' },
  { en: 'Couscous', nl: 'Couscous', group: 'Carbs' },
  { en: 'Bread', nl: 'Brood', group: 'Carbs' },
  { en: 'Tortilla', nl: 'Tortilla', group: 'Carbs' },
  { en: 'Rice cakes', nl: 'Rijstwafels', group: 'Carbs' },
  { en: 'Broccoli', nl: 'Broccoli', group: 'Vegetables' },
  { en: 'Spinach', nl: 'Spinazie', group: 'Vegetables' },
  { en: 'Green beans', nl: 'Sperziebonen', group: 'Vegetables' },
  { en: 'Bell pepper', nl: 'Paprika', group: 'Vegetables' },
  { en: 'Zucchini', nl: 'Courgette', group: 'Vegetables' },
  { en: 'Mushrooms', nl: 'Champignons', group: 'Vegetables' },
  { en: 'Carrot', nl: 'Wortel', group: 'Vegetables' },
  { en: 'Asparagus', nl: 'Asperges', group: 'Vegetables' },
  { en: 'Tomato', nl: 'Tomaat', group: 'Vegetables' },
  { en: 'Cucumber', nl: 'Komkommer', group: 'Vegetables' },
  { en: 'Corn', nl: 'Maïs', group: 'Vegetables' },
  { en: 'Black beans', nl: 'Zwarte bonen', group: 'Vegetables' },
  { en: 'Chickpeas', nl: 'Kikkererwten', group: 'Vegetables' },
  { en: 'Banana', nl: 'Banaan', group: 'Fruit' },
  { en: 'Blueberries', nl: 'Blauwe bessen', group: 'Fruit' },
  { en: 'Strawberries', nl: 'Aardbeien', group: 'Fruit' },
  { en: 'Apple', nl: 'Appel', group: 'Fruit' },
  { en: 'Mango', nl: 'Mango', group: 'Fruit' },
  { en: 'Pineapple', nl: 'Ananas', group: 'Fruit' },
  { en: 'Greek yoghurt', nl: 'Griekse yoghurt', group: 'Dairy' },
  { en: 'Skyr', nl: 'Skyr', group: 'Dairy' },
  { en: 'Cottage cheese', nl: 'Hüttenkäse', group: 'Dairy' },
  { en: 'Milk', nl: 'Melk', group: 'Dairy' },
  { en: 'Almond milk', nl: 'Amandelmelk', group: 'Dairy' },
  { en: 'Cheddar', nl: 'Cheddar', group: 'Dairy' },
  { en: 'Mozzarella', nl: 'Mozzarella', group: 'Dairy' },
  { en: 'Olive oil', nl: 'Olijfolie', group: 'Fats' },
  { en: 'Avocado', nl: 'Avocado', group: 'Fats' },
  { en: 'Peanut butter', nl: 'Pindakaas', group: 'Fats' },
  { en: 'Almonds', nl: 'Amandelen', group: 'Fats' },
  { en: 'Walnuts', nl: 'Walnoten', group: 'Fats' },
  { en: 'Chia seeds', nl: 'Chiazaad', group: 'Fats' },
  { en: 'Honey', nl: 'Honing', group: 'Flavour' },
  { en: 'Soy sauce', nl: 'Sojasaus', group: 'Flavour' },
  { en: 'Garlic', nl: 'Knoflook', group: 'Flavour' },
  { en: 'Ginger', nl: 'Gember', group: 'Flavour' },
  { en: 'Smoked paprika', nl: 'Gerookt paprikapoeder', group: 'Flavour' },
  { en: 'Curry powder', nl: 'Kerriepoeder', group: 'Flavour' },
  { en: 'Hot sauce', nl: 'Hete saus', group: 'Flavour' }
];

export const units = ['g', 'kg', 'ml', 'cl', 'dl', 'l', 'pc', 'tbsp', 'tsp', 'scoop'];
