import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DailyMacroTarget, FoodDiaryEntry, Ingredient, Locale, Macros, MealPlanEntry, Recipe, SavedIngredient, UserGoals } from './types';
import { baseIngredientProfiles } from './nutrition';
import { IngredientLookupModal, IngredientMacroReviewModal } from './SmartModals';
import { colors, radius } from './theme';

const tr = (locale: Locale, en: string, nl: string) => locale === 'nl' ? nl : en;
const ico = (name: string, size = 20, color = colors.cream) => <Ionicons name={name as never} size={size} color={color} />;
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const numberValue = (value: string) => Math.max(0, Number(value.replace(',', '.')) || 0);
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dateFromKey = (value: string) => new Date(`${value}T12:00:00`);
const todayKey = () => dateKey(new Date());
const emptyMacros = (): Macros => ({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
const rounded = (value: number) => Math.round(value * 10) / 10;
const scaleMacros = (macros: Macros, factor: number): Macros => ({
  calories: rounded(macros.calories * factor),
  protein: rounded(macros.protein * factor),
  carbs: rounded(macros.carbs * factor),
  fat: rounded(macros.fat * factor),
  fiber: rounded(macros.fiber * factor)
});
const totalMacros = (entries: FoodDiaryEntry[]) => entries.reduce((sum, entry) => ({
  calories: rounded(sum.calories + entry.macros.calories),
  protein: rounded(sum.protein + entry.macros.protein),
  carbs: rounded(sum.carbs + entry.macros.carbs),
  fat: rounded(sum.fat + entry.macros.fat),
  fiber: rounded(sum.fiber + entry.macros.fiber)
}), emptyMacros());

const meals: MealPlanEntry['meal'][] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const mealLabel = (meal: MealPlanEntry['meal'], locale: Locale) => ({
  Breakfast: tr(locale, 'Breakfast', 'Ontbijt'),
  Lunch: tr(locale, 'Lunch', 'Lunch'),
  Dinner: tr(locale, 'Dinner', 'Avondeten'),
  Snack: tr(locale, 'Snacks', 'Tussendoortjes')
})[meal];
const mealIcon = (meal: MealPlanEntry['meal']) => ({ Breakfast: 'sunny-outline', Lunch: 'cafe-outline', Dinner: 'restaurant-outline', Snack: 'flash-outline' })[meal];

type ProductProfile = SavedIngredient & { group?: string };

function FoodPicker({ visible, locale, meal, recipes, savedIngredients, onSavedIngredients, onClose, onAdd }: {
  visible: boolean;
  locale: Locale;
  meal: MealPlanEntry['meal'];
  recipes: Recipe[];
  savedIngredients: SavedIngredient[];
  onSavedIngredients: (items: SavedIngredient[]) => void;
  onClose: () => void;
  onAdd: (entry: FoodDiaryEntry) => void;
}) {
  const [mode, setMode] = useState<'recipe' | 'product'>('recipe');
  const [query, setQuery] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductProfile | null>(null);
  const [amount, setAmount] = useState('1');
  const [lookupVisible, setLookupVisible] = useState(false);
  const [productDraft, setProductDraft] = useState<Ingredient | null>(null);

  const sameIngredient = (left: SavedIngredient, right: SavedIngredient) =>
    (!!left.barcode && left.barcode === right.barcode) || normalize(left.name) === normalize(right.name) || (!!left.nameNl && normalize(left.nameNl) === normalize(right.nameNl ?? right.name));
  const baseProducts = useMemo(() => baseIngredientProfiles.map((base) => savedIngredients.find((saved) => sameIngredient(saved, base)) ?? base), [savedIngredients]);
  const ownProducts = useMemo(() => savedIngredients.filter((saved) => !baseIngredientProfiles.some((base) => sameIngredient(saved, base))), [savedIngredients]);
  const products = useMemo(() => [...ownProducts, ...baseProducts].filter((product) => normalize(`${product.name} ${product.nameNl ?? ''} ${product.brand ?? ''}`).includes(normalize(query))), [ownProducts, baseProducts, query]);
  const filteredRecipes = recipes.filter((recipe) => normalize(`${recipe.title} ${recipe.titleNl ?? ''} ${recipe.category}`).includes(normalize(query)));
  const selectedName = selectedRecipe ? (locale === 'nl' ? selectedRecipe.titleNl ?? selectedRecipe.title : selectedRecipe.title) : selectedProduct ? (locale === 'nl' ? selectedProduct.nameNl ?? selectedProduct.name : selectedProduct.name) : '';
  const quantity = numberValue(amount);
  const previewMacros = selectedRecipe ? scaleMacros(selectedRecipe.macros, quantity) : selectedProduct ? scaleMacros(selectedProduct.nutritionPer100, quantity / 100) : emptyMacros();
  const unit = selectedRecipe ? tr(locale, quantity === 1 ? 'portion' : 'portions', quantity === 1 ? 'portie' : 'porties') : selectedProduct?.baseUnit ?? 'g';
  const reset = (nextMode = mode) => { setMode(nextMode); setQuery(''); setSelectedRecipe(null); setSelectedProduct(null); setAmount(nextMode === 'recipe' ? '1' : '100'); };
  const selectRecipe = (recipe: Recipe) => { setSelectedRecipe(recipe); setSelectedProduct(null); setAmount('1'); };
  const selectProduct = (product: ProductProfile) => { setSelectedProduct(product); setSelectedRecipe(null); setAmount(String(product.servingSize ?? 100)); };
  const reviewProduct = (ingredient: Ingredient) => { setLookupVisible(false); setProductDraft(ingredient); };
  const newProduct = (barcode?: string) => reviewProduct({ id: `product-${Date.now()}`, name: '', amount: '100', unit: 'g', barcode });
  const saveProduct = (ingredient: Ingredient, baseUnit: 'g' | 'ml') => {
    if (!ingredient.nutritionPer100) return;
    const existing = savedIngredients.find((item) => (!!ingredient.barcode && item.barcode === ingredient.barcode) || normalize(item.name) === normalize(ingredient.name) || (!!ingredient.nameNl && normalize(item.nameNl ?? item.name) === normalize(ingredient.nameNl)));
    const product: SavedIngredient = {
      id: existing?.id ?? `saved-${Date.now()}`,
      name: ingredient.name,
      nameNl: ingredient.nameNl,
      brand: ingredient.brand,
      barcode: ingredient.barcode,
      baseUnit,
      servingSize: numberValue(ingredient.amount) || existing?.servingSize || 100,
      nutritionPer100: ingredient.nutritionPer100
    };
    onSavedIngredients(existing ? savedIngredients.map((item) => item.id === existing.id ? product : item) : [product, ...savedIngredients]);
    setMode('product'); setQuery(''); setProductDraft(null); selectProduct(product);
  };
  const add = () => {
    if (quantity <= 0 || (!selectedRecipe && !selectedProduct)) return;
    const now = Date.now();
    onAdd({
      id: `diary-${now}-${Math.random()}`,
      date: '',
      meal,
      source: selectedRecipe ? 'recipe' : 'product',
      name: selectedRecipe?.title ?? selectedProduct!.name,
      nameNl: selectedRecipe?.titleNl ?? selectedProduct?.nameNl,
      amount: quantity,
      unit: selectedRecipe ? 'portion' : selectedProduct!.baseUnit,
      macros: previewMacros,
      createdAt: now,
      recipeId: selectedRecipe?.id,
      ingredientId: selectedProduct?.id
    });
    reset(); onClose();
  };

  return <><Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={s.modalSafe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.flex}>
        <View style={s.modalTop}><View style={s.flex}><Text style={s.eyebrow}>{mealLabel(meal, locale).toUpperCase()}</Text><Text style={s.modalTitle}>{tr(locale, 'Log food', 'Voeding toevoegen')}</Text></View><Pressable onPress={onClose} style={s.circle}>{ico('close', 22)}</Pressable></View>
        <View style={s.modeTabs}>
          <Pressable onPress={() => reset('recipe')} style={[s.modeTab, mode === 'recipe' && s.modeTabActive]}>{ico('book-outline', 18, mode === 'recipe' ? colors.black : colors.muted)}<Text style={[s.modeText, mode === 'recipe' && s.dark]}>{tr(locale, 'RECIPE / MEAL', 'RECEPT / MAALTIJD')}</Text></Pressable>
          <Pressable onPress={() => reset('product')} style={[s.modeTab, mode === 'product' && s.modeTabActive]}>{ico('barcode-outline', 18, mode === 'product' ? colors.black : colors.muted)}<Text style={[s.modeText, mode === 'product' && s.dark]}>{tr(locale, 'LOOSE PRODUCT', 'LOS PRODUCT')}</Text></Pressable>
        </View>
        {mode === 'product' && <View style={s.productActions}><Pressable onPress={() => setLookupVisible(true)} style={s.scanProduct}>{ico('barcode-outline', 20, colors.black)}<View style={s.flex}><Text style={s.scanProductTitle}>{tr(locale, 'SCAN BARCODE', 'SCAN BARCODE')}</Text><Text style={s.scanProductSub}>{tr(locale, 'Find Belgian product data', 'Zoek Belgische productgegevens')}</Text></View></Pressable><Pressable onPress={() => newProduct()} style={s.customProduct}>{ico('add-circle-outline', 20, colors.lime)}<View style={s.flex}><Text style={s.customProductTitle}>{tr(locale, 'NEW PRODUCT', 'NIEUW PRODUCT')}</Text><Text style={s.scanProductSub}>{tr(locale, 'Enter the label yourself', 'Vul zelf het etiket in')}</Text></View></Pressable></View>}
        <View style={s.search}><TextInput value={query} onChangeText={setQuery} placeholder={mode === 'recipe' ? tr(locale, 'Search recipes', 'Zoek recepten') : tr(locale, 'Search all ingredients and products', 'Zoek alle ingrediënten en producten')} placeholderTextColor={colors.muted} style={s.searchInput} />{ico('search-outline', 19, colors.muted)}</View>
        <ScrollView contentContainerStyle={s.pickerList} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
          {mode === 'recipe' ? filteredRecipes.map((recipe) => { const active = selectedRecipe?.id === recipe.id; return <Pressable key={recipe.id} onPress={() => selectRecipe(recipe)} style={[s.pickerRow, active && s.pickerRowActive]}><View style={[s.pickerIcon, { backgroundColor: `${recipe.accent}24` }]}>{ico(recipe.icon, 20, recipe.accent)}</View><View style={s.flex}><Text style={s.pickerName}>{locale === 'nl' ? recipe.titleNl ?? recipe.title : recipe.title}</Text><Text style={s.pickerMeta}>{recipe.macros.calories} kcal · P {recipe.macros.protein} · C {recipe.macros.carbs} · F {recipe.macros.fat} / {tr(locale, 'portion', 'portie')}</Text></View>{ico(active ? 'checkmark-circle' : 'add-circle-outline', 23, active ? colors.lime : colors.muted)}</Pressable>; }) : products.map((product) => { const active = selectedProduct?.id === product.id; return <Pressable key={`${product.id}-${product.barcode ?? ''}`} onPress={() => selectProduct(product)} style={[s.pickerRow, active && s.pickerRowActive]}><View style={s.productIcon}>{ico(product.barcode ? 'barcode-outline' : 'nutrition-outline', 20, colors.lime)}</View><View style={s.flex}><Text style={s.pickerName}>{locale === 'nl' ? product.nameNl ?? product.name : product.name}</Text><Text style={s.pickerMeta}>{product.brand ? `${product.brand} · ` : ''}{product.nutritionPer100.calories} kcal · P {product.nutritionPer100.protein} · C {product.nutritionPer100.carbs} · F {product.nutritionPer100.fat} / 100 {product.baseUnit}{product.servingSize ? ` · ${tr(locale, 'quick add', 'snel toevoegen')}: ${product.servingSize} ${product.baseUnit}` : ''}</Text></View>{ico(active ? 'checkmark-circle' : 'add-circle-outline', 23, active ? colors.lime : colors.muted)}</Pressable>; })}
          {!((mode === 'recipe' ? filteredRecipes : products).length) && <View style={s.emptyPicker}>{ico('search-outline', 26, colors.muted)}<Text style={s.emptyTitle}>{tr(locale, 'No matching food found.', 'Geen overeenkomende voeding gevonden.')}</Text><Text style={s.help}>{mode === 'product' ? tr(locale, 'Add custom products in your ingredient macro library first.', 'Voeg eigen producten eerst toe in je macrobibliotheek voor ingrediënten.') : tr(locale, 'Create a recipe first or try another search.', 'Maak eerst een recept of probeer een andere zoekterm.')}</Text></View>}
        </ScrollView>
        {!!selectedName && <View style={s.selectionDock}><View style={s.selectionTop}><View style={s.flex}><Text style={s.selectionLabel}>{tr(locale, 'SELECTED', 'GESELECTEERD')}</Text><Text style={s.selectionName} numberOfLines={1}>{selectedName}</Text></View><View style={s.amountWrap}><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" selectTextOnFocus style={s.amountInput} /><Text style={s.amountUnit}>{unit}</Text></View></View><View style={s.previewRow}><Text style={s.previewKcal}>{previewMacros.calories} kcal</Text><Text style={s.previewMacro}>P {previewMacros.protein}g</Text><Text style={s.previewMacro}>C {previewMacros.carbs}g</Text><Text style={s.previewMacro}>F {previewMacros.fat}g</Text></View><Pressable disabled={quantity <= 0} onPress={add} style={[s.addButton, quantity <= 0 && s.disabled]}>{ico('add', 20, colors.black)}<Text style={s.addButtonText}>{tr(locale, 'ADD TO DIARY', 'AAN DAGBOEK TOEVOEGEN')}</Text></Pressable></View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal><IngredientLookupModal visible={lookupVisible} locale={locale} onClose={() => setLookupVisible(false)} onSelect={reviewProduct} onBarcodeNotFound={(barcode) => newProduct(barcode)} /><IngredientMacroReviewModal visible={!!productDraft} locale={locale} ingredient={productDraft} onClose={() => setProductDraft(null)} onConfirm={saveProduct} /></>;
}

export function FoodDiaryScreen({ locale, tablet, recipes, entries, savedIngredients, onSavedIngredients, goals, dailyTargets, plans, onChange, onOpenRecipe }: {
  locale: Locale;
  tablet: boolean;
  recipes: Recipe[];
  entries: FoodDiaryEntry[];
  savedIngredients: SavedIngredient[];
  onSavedIngredients: (items: SavedIngredient[]) => void;
  goals: UserGoals;
  dailyTargets: DailyMacroTarget[];
  plans: MealPlanEntry[];
  onChange: (entries: FoodDiaryEntry[]) => void;
  onOpenRecipe: (recipe: Recipe) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [pickerMeal, setPickerMeal] = useState<MealPlanEntry['meal'] | null>(null);
  const selectedDateObject = dateFromKey(selectedDate);
  const dayEntries = entries.filter((entry) => entry.date === selectedDate);
  const totals = totalMacros(dayEntries);
  const weekday = selectedDateObject.getDay();
  const target = dailyTargets.find((item) => item.weekday === weekday) ?? { weekday, calories: goals.calories, protein: goals.protein, carbs: goals.carbs, fat: goals.fat, fiber: 30 };
  const planned = plans.filter((entry) => entry.date === selectedDate);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => { const date = dateFromKey(selectedDate); date.setDate(date.getDate() + index - 3); return date; }), [selectedDate]);
  const shiftDay = (amount: number) => { const next = dateFromKey(selectedDate); next.setDate(next.getDate() + amount); setSelectedDate(dateKey(next)); };
  const addEntry = (entry: FoodDiaryEntry) => onChange([...entries, { ...entry, date: selectedDate }]);
  const removeEntry = (id: string) => onChange(entries.filter((entry) => entry.id !== id));
  const importPlan = () => {
    const existingPlanIds = new Set(entries.filter((entry) => entry.date === selectedDate).map((entry) => entry.planEntryId).filter(Boolean));
    const imported = planned.flatMap((plan) => {
      const recipe = recipes.find((item) => item.id === plan.recipeId);
      if (!recipe || existingPlanIds.has(plan.id)) return [];
      return [{ id: `diary-plan-${Date.now()}-${plan.id}`, date: selectedDate, meal: plan.meal, source: 'recipe' as const, name: recipe.title, nameNl: recipe.titleNl, amount: 1, unit: 'portion' as const, macros: recipe.macros, createdAt: Date.now(), recipeId: recipe.id, planEntryId: plan.id }];
    });
    if (imported.length) onChange([...entries, ...imported]);
  };
  const progress = (value: number, goal: number) => `${Math.min(100, goal > 0 ? value / goal * 100 : 0)}%` as `${number}%`;

  return <>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.page, tablet && s.pageTablet]}>
      <View style={s.header}><View style={s.flex}><Text style={s.eyebrow}>{tr(locale, 'EAT. LOG. PROGRESS.', 'EET. LOG. GROEI.')}</Text><Text style={s.title}>{tr(locale, 'Food diary', 'Voedingsdagboek')}</Text></View><View style={s.headerIcon}>{ico('journal-outline', 25, colors.lime)}</View></View>

      <View style={s.dateBar}><Pressable onPress={() => shiftDay(-1)} style={s.dateArrow}>{ico('chevron-back', 21)}</Pressable><Pressable onPress={() => setSelectedDate(todayKey())} style={s.dateCenter}><Text style={s.dateTitle}>{selectedDateObject.toLocaleDateString(locale === 'nl' ? 'nl-BE' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</Text><Text style={s.dateHint}>{selectedDate === todayKey() ? tr(locale, 'TODAY', 'VANDAAG') : tr(locale, 'TAP FOR TODAY', 'TIK VOOR VANDAAG')}</Text></Pressable><Pressable onPress={() => shiftDay(1)} style={s.dateArrow}>{ico('chevron-forward', 21)}</Pressable></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.weekStrip}>{days.map((date) => { const key = dateKey(date); const active = key === selectedDate; const hasEntries = entries.some((entry) => entry.date === key); return <Pressable key={key} onPress={() => setSelectedDate(key)} style={[s.dayChip, active && s.dayChipActive]}><Text style={[s.dayChipName, active && s.dark]}>{date.toLocaleDateString(locale === 'nl' ? 'nl-BE' : 'en-GB', { weekday: 'short' }).toUpperCase()}</Text><Text style={[s.dayChipNumber, active && s.dark]}>{date.getDate()}</Text>{hasEntries && <View style={[s.dayDot, active && s.dayDotActive]} />}</Pressable>; })}</ScrollView>

      <View style={[s.contentGrid, tablet && s.contentGridTablet]}>
        <View style={[s.summaryCard, tablet && s.summaryTablet]}>
          <View style={s.summaryTop}><View><Text style={s.cardEyebrow}>{tr(locale, 'CONSUMED', 'GEGETEN')}</Text><Text style={s.summaryCalories}>{Math.round(totals.calories).toLocaleString()}</Text><Text style={s.summaryTarget}>{tr(locale, 'of', 'van')} {target.calories.toLocaleString()} kcal</Text></View><View style={s.bolt}>{ico('flash', 25, colors.black)}</View></View>
          <View style={s.kcalTrack}><View style={[s.kcalFill, { width: progress(totals.calories, target.calories) }]} /></View>
          <View style={s.summaryMacros}>{([['protein', 'P', tr(locale, 'PROTEIN', 'EIWIT')], ['carbs', 'C', tr(locale, 'CARBS', 'KOOLHYDRATEN')], ['fat', 'F', tr(locale, 'FATS', 'VETTEN')]] as [keyof Macros, string, string][]).map(([key, short, label]) => <View key={key} style={s.summaryMacro}><Text style={s.summaryMacroValue}>{rounded(totals[key])}g</Text><Text style={s.summaryMacroGoal}>{short} / {target[key]}g</Text><Text style={s.summaryMacroLabel}>{label}</Text></View>)}</View>
          <Text style={s.remaining}>{totals.calories <= target.calories ? `${Math.round(target.calories - totals.calories)} ${tr(locale, 'kcal remaining', 'kcal resterend')}` : `${Math.round(totals.calories - target.calories)} ${tr(locale, 'kcal over target', 'kcal boven doel')}`}</Text>
          {!!planned.length && <Pressable onPress={importPlan} style={s.planImport}>{ico('calendar-outline', 18, colors.black)}<View style={s.flex}><Text style={s.planImportTitle}>{tr(locale, 'ADD PLANNED MEALS', 'GEPLANDE MAALTIJDEN TOEVOEGEN')}</Text><Text style={s.planImportMeta}>{planned.length} {tr(locale, 'items in your meal plan', 'items in je maaltijdplan')}</Text></View>{ico('add-circle', 21, colors.black)}</Pressable>}
        </View>

        <View style={[s.mealsColumn, tablet && s.mealsTablet]}>{meals.map((meal) => { const mealEntries = dayEntries.filter((entry) => entry.meal === meal); const mealTotals = totalMacros(mealEntries); return <View key={meal} style={s.mealCard}><View style={s.mealHeader}><View style={s.mealHeading}><View style={s.mealIcon}>{ico(mealIcon(meal), 19, colors.lime)}</View><View><Text style={s.mealTitle}>{mealLabel(meal, locale)}</Text><Text style={s.mealTotal}>{Math.round(mealTotals.calories)} kcal · P {rounded(mealTotals.protein)}g</Text></View></View><Pressable onPress={() => setPickerMeal(meal)} style={s.mealAdd}>{ico('add', 21, colors.black)}</Pressable></View>
          {!mealEntries.length ? <Pressable onPress={() => setPickerMeal(meal)} style={s.emptyMeal}><Text style={s.emptyMealText}>{tr(locale, 'Add a meal or loose product', 'Voeg een maaltijd of los product toe')}</Text>{ico('add-circle-outline', 18, colors.muted)}</Pressable> : mealEntries.map((entry) => <View key={entry.id} style={s.entryRow}><Pressable disabled={!entry.recipeId} onPress={() => { const recipe = recipes.find((item) => item.id === entry.recipeId); if (recipe) onOpenRecipe(recipe); }} style={s.entryBody}><View style={[s.entrySource, entry.source === 'recipe' ? s.entryRecipe : s.entryProduct]}>{ico(entry.source === 'recipe' ? 'book-outline' : 'barcode-outline', 16, entry.source === 'recipe' ? colors.black : colors.lime)}</View><View style={s.flex}><Text style={s.entryName} numberOfLines={1}>{locale === 'nl' ? entry.nameNl ?? entry.name : entry.name}</Text><Text style={s.entryAmount}>{entry.amount} {entry.unit === 'portion' ? tr(locale, entry.amount === 1 ? 'portion' : 'portions', entry.amount === 1 ? 'portie' : 'porties') : entry.unit} · P {entry.macros.protein} · C {entry.macros.carbs} · F {entry.macros.fat}</Text></View><Text style={s.entryKcal}>{Math.round(entry.macros.calories)}</Text></Pressable><Pressable onPress={() => removeEntry(entry.id)} hitSlop={10} style={s.entryDelete}>{ico('trash-outline', 17, colors.muted)}</Pressable></View>)}</View>; })}</View>
      </View>
    </ScrollView>
    <FoodPicker visible={!!pickerMeal} locale={locale} meal={pickerMeal ?? 'Snack'} recipes={recipes} savedIngredients={savedIngredients} onSavedIngredients={onSavedIngredients} onClose={() => setPickerMeal(null)} onAdd={addEntry} />
  </>;
}

const s = StyleSheet.create({
  flex: { flex: 1 }, dark: { color: colors.black }, disabled: { opacity: .4 },
  page: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 122 },
  pageTablet: { width: '100%', maxWidth: 1680, alignSelf: 'center', paddingHorizontal: 34, paddingTop: 30, paddingBottom: 54 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  eyebrow: { color: colors.lime, fontSize: 9, fontWeight: '900', letterSpacing: 1.35 },
  title: { color: colors.cream, fontSize: 30, fontWeight: '900', marginTop: 4 },
  headerIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  dateBar: { minHeight: 66, borderRadius: 18, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center' },
  dateArrow: { width: 52, height: 64, alignItems: 'center', justifyContent: 'center' }, dateCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dateTitle: { color: colors.cream, fontSize: 15, fontWeight: '900', textTransform: 'capitalize' }, dateHint: { color: colors.lime, fontSize: 7, fontWeight: '900', letterSpacing: 1, marginTop: 4 },
  weekStrip: { gap: 8, paddingVertical: 14 }, dayChip: { width: 62, height: 66, borderRadius: 16, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, dayChipActive: { backgroundColor: colors.lime, borderColor: colors.lime }, dayChipName: { color: colors.muted, fontSize: 8, fontWeight: '900' }, dayChipNumber: { color: colors.cream, fontSize: 19, fontWeight: '900', marginTop: 3 }, dayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.lime, marginTop: 4 }, dayDotActive: { backgroundColor: colors.black },
  contentGrid: { gap: 14 }, contentGridTablet: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 }, summaryTablet: { flex: .82 }, mealsTablet: { flex: 1.45 },
  summaryCard: { borderRadius: radius.lg, backgroundColor: '#CFA343', padding: 20, overflow: 'hidden' }, summaryTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, cardEyebrow: { color: '#33280F', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, summaryCalories: { color: colors.black, fontSize: 48, fontWeight: '900', marginTop: 5 }, summaryTarget: { color: '#4C3B18', fontSize: 11, fontWeight: '900', letterSpacing: .4 }, bolt: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#F3F4F290', alignItems: 'center', justifyContent: 'center' }, kcalTrack: { height: 8, borderRadius: 4, backgroundColor: '#755A2480', overflow: 'hidden', marginTop: 20 }, kcalFill: { height: '100%', backgroundColor: colors.black }, summaryMacros: { flexDirection: 'row', marginTop: 22 }, summaryMacro: { flex: 1 }, summaryMacroValue: { color: colors.black, fontSize: 18, fontWeight: '900' }, summaryMacroGoal: { color: '#4C3B18', fontSize: 8, fontWeight: '900', marginTop: 2 }, summaryMacroLabel: { color: '#4C3B18', fontSize: 7, fontWeight: '900', letterSpacing: .6, marginTop: 5 }, remaining: { color: colors.black, fontSize: 11, fontWeight: '900', marginTop: 18 },
  planImport: { minHeight: 58, borderRadius: 16, backgroundColor: '#F3F4F2B8', marginTop: 16, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 }, planImportTitle: { color: colors.black, fontSize: 9, fontWeight: '900', letterSpacing: .5 }, planImportMeta: { color: '#4C3B18', fontSize: 8, marginTop: 3 },
  mealsColumn: { gap: 12 }, mealCard: { borderRadius: radius.lg, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 14 }, mealHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, mealHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 }, mealIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#D2A74A12', alignItems: 'center', justifyContent: 'center' }, mealTitle: { color: colors.cream, fontSize: 15, fontWeight: '900' }, mealTotal: { color: colors.muted, fontSize: 8, fontWeight: '800', marginTop: 3 }, mealAdd: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }, emptyMeal: { minHeight: 48, marginTop: 11, borderRadius: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, emptyMealText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  entryRow: { minHeight: 62, marginTop: 9, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', alignItems: 'center' }, entryBody: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9, paddingTop: 9 }, entrySource: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, entryRecipe: { backgroundColor: colors.lime }, entryProduct: { backgroundColor: colors.panelSoft }, entryName: { color: colors.cream, fontSize: 12, fontWeight: '900' }, entryAmount: { color: colors.muted, fontSize: 8, marginTop: 3 }, entryKcal: { color: colors.lime, fontSize: 12, fontWeight: '900', marginLeft: 6 }, entryDelete: { width: 34, alignItems: 'flex-end', paddingTop: 9 },
  modalSafe: { flex: 1, backgroundColor: colors.bg }, modalTop: { minHeight: 82, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center' }, modalTitle: { color: colors.cream, fontSize: 25, fontWeight: '900', marginTop: 3 }, circle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  modeTabs: { flexDirection: 'row', gap: 8, padding: 14, paddingBottom: 8 }, modeTab: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }, modeTabActive: { backgroundColor: colors.lime, borderColor: colors.lime }, modeText: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: .4 },
  productActions: { flexDirection: 'row', gap: 8, marginHorizontal: 14, marginBottom: 8 }, scanProduct: { flex: 1, minHeight: 58, borderRadius: 15, backgroundColor: colors.lime, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 }, customProduct: { flex: 1, minHeight: 58, borderRadius: 15, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.lime, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 }, scanProductTitle: { color: colors.black, fontSize: 9, fontWeight: '900', letterSpacing: .4 }, customProductTitle: { color: colors.lime, fontSize: 9, fontWeight: '900', letterSpacing: .4 }, scanProductSub: { color: colors.muted, fontSize: 7, marginTop: 3 },
  search: { height: 50, marginHorizontal: 14, borderRadius: 15, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }, searchInput: { flex: 1, color: colors.cream, fontSize: 13 }, pickerList: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 14, paddingBottom: 220 }, pickerRow: { minHeight: 72, borderRadius: 16, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 11, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }, pickerRowActive: { borderColor: colors.lime, backgroundColor: '#D2A74A0C' }, pickerIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, productIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.panelSoft, alignItems: 'center', justifyContent: 'center' }, pickerName: { color: colors.cream, fontSize: 13, fontWeight: '900' }, pickerMeta: { color: colors.muted, fontSize: 8, lineHeight: 12, marginTop: 4 }, emptyPicker: { minHeight: 180, alignItems: 'center', justifyContent: 'center', padding: 20 }, emptyTitle: { color: colors.cream, fontSize: 14, fontWeight: '900', marginTop: 10 }, help: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 5 },
  selectionDock: { position: 'absolute', left: 12, right: 12, bottom: 10, maxWidth: 900, alignSelf: 'center', borderRadius: 22, backgroundColor: '#1A1A17FA', borderWidth: 1, borderColor: '#D2A74A66', padding: 15, elevation: 25 }, selectionTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, selectionLabel: { color: colors.lime, fontSize: 7, fontWeight: '900', letterSpacing: 1 }, selectionName: { color: colors.cream, fontSize: 14, fontWeight: '900', marginTop: 4 }, amountWrap: { minWidth: 105, height: 50, borderRadius: 14, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }, amountInput: { minWidth: 42, color: colors.cream, fontSize: 16, fontWeight: '900', textAlign: 'right' }, amountUnit: { color: colors.muted, fontSize: 9, fontWeight: '800', marginLeft: 5 }, previewRow: { flexDirection: 'row', gap: 14, marginTop: 12 }, previewKcal: { color: colors.lime, fontSize: 12, fontWeight: '900' }, previewMacro: { color: colors.muted, fontSize: 10, fontWeight: '800' }, addButton: { minHeight: 50, marginTop: 12, borderRadius: 14, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, addButtonText: { color: colors.black, fontSize: 10, fontWeight: '900', letterSpacing: .7 }
});
