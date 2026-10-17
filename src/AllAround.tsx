import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DailyMacroTarget, Ingredient, Locale, Macros, MealPlanEntry, Recipe, SavedIngredient, TrainingDay, UserGoals, VitaminEntry, WeightEntry } from './types';
import { colors, radius } from './theme';

const tr = (locale: Locale, en: string, nl: string) => locale === 'nl' ? nl : en;
const ico = (name: string, size = 20, color = colors.cream) => <Ionicons name={name as never} size={size} color={color} />;
const todayKey = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const number = (value: string) => Number(value.replace(',', '.')) || 0;
const emptyMacros = (): Macros => ({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
const dayOrder = [1, 2, 3, 4, 5, 6, 0];
const dayName = (weekday: number, locale: Locale, short = false) => {
  const reference = new Date(2024, 0, 7 + weekday);
  return reference.toLocaleDateString(locale === 'nl' ? 'nl-BE' : 'en-GB', { weekday: short ? 'short' : 'long' });
};

export function savedIngredientToRecipe(item: SavedIngredient): Ingredient {
  return {
    id: `ingredient-${Date.now()}-${Math.random()}`,
    name: item.name,
    nameNl: item.nameNl,
    brand: item.brand,
    barcode: item.barcode,
    amount: '100',
    unit: item.baseUnit,
    nutritionPer100: item.nutritionPer100,
    nutritionSource: 'maugainz'
  };
}

export function IngredientLibraryModal({ visible, locale, ingredients, onChange, onSelect, onClose }: {
  visible: boolean;
  locale: Locale;
  ingredients: SavedIngredient[];
  onChange: (items: SavedIngredient[]) => void;
  onSelect?: (ingredient: Ingredient) => void;
  onClose: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState('');
  const [baseUnit, setBaseUnit] = useState<'g' | 'ml'>('g');
  const [macro, setMacro] = useState<Record<keyof Macros, string>>({ calories: '', protein: '', carbs: '', fat: '', fiber: '' });

  const reset = () => { setEditingId(null); setName(''); setBrand(''); setBarcode(''); setBaseUnit('g'); setMacro({ calories: '', protein: '', carbs: '', fat: '', fiber: '' }); };
  const edit = (item: SavedIngredient) => {
    setEditingId(item.id); setName(item.nameNl || item.name); setBrand(item.brand ?? ''); setBarcode(item.barcode ?? ''); setBaseUnit(item.baseUnit);
    setMacro(Object.fromEntries(Object.entries(item.nutritionPer100).map(([key, value]) => [key, String(value)])) as Record<keyof Macros, string>);
  };
  const save = () => {
    if (!name.trim() || number(macro.calories) <= 0) return;
    const item: SavedIngredient = {
      id: editingId ?? `saved-${Date.now()}`,
      name: name.trim(), nameNl: name.trim(), brand: brand.trim() || undefined, barcode: barcode.trim() || undefined,
      baseUnit,
      nutritionPer100: { calories: number(macro.calories), protein: number(macro.protein), carbs: number(macro.carbs), fat: number(macro.fat), fiber: number(macro.fiber) }
    };
    onChange(editingId ? ingredients.map((current) => current.id === editingId ? item : current) : [item, ...ingredients]);
    reset();
  };

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={s.safe}>
      <View style={s.top}><View><Text style={s.eyebrow}>{tr(locale, 'YOUR VERIFIED DATA', 'JOUW GECONTROLEERDE DATA')}</Text><Text style={s.title}>{tr(locale, 'Ingredient macro library', 'Macrobibliotheek ingrediënten')}</Text></View><Pressable onPress={onClose} style={s.circle}>{ico('close', 22)}</Pressable></View>
      <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="always">
        <View style={s.editorCard}>
          <Text style={s.cardTitle}>{editingId ? tr(locale, 'Edit ingredient', 'Ingrediënt aanpassen') : tr(locale, 'Add your own ingredient', 'Eigen ingrediënt toevoegen')}</Text>
          <Text style={s.help}>{tr(locale, 'Enter the label values per 100 g or 100 ml. MauGainZ will remember and reuse them in every recipe.', 'Vul de etiketwaarden per 100 g of 100 ml in. MauGainZ onthoudt en hergebruikt ze in elk recept.')}</Text>
          <TextInput value={name} onChangeText={setName} placeholder={tr(locale, 'Ingredient name', 'Naam ingrediënt')} placeholderTextColor={colors.muted} style={s.input} />
          <View style={s.row}><TextInput value={brand} onChangeText={setBrand} placeholder={tr(locale, 'Brand (optional)', 'Merk (optioneel)')} placeholderTextColor={colors.muted} style={[s.input, s.flex]} /><TextInput value={barcode} onChangeText={setBarcode} keyboardType="number-pad" placeholder="EAN" placeholderTextColor={colors.muted} style={[s.input, s.flex]} /></View>
          <Text style={s.label}>{tr(locale, 'VALUES APPLY TO', 'WAARDEN GELDEN VOOR')}</Text>
          <View style={s.unitRow}>{(['g', 'ml'] as const).map((unit) => <Pressable key={unit} onPress={() => setBaseUnit(unit)} style={[s.unit, baseUnit === unit && s.unitActive]}><Text style={[s.unitText, baseUnit === unit && s.dark]}>100 {unit}</Text></Pressable>)}</View>
          <Text style={s.label}>{tr(locale, 'NUTRITION PER 100 G / ML', 'VOEDINGSWAARDEN PER 100 G / ML')}</Text>
          <View style={s.macroGrid}>{([['calories', 'KCAL'], ['protein', 'P'], ['carbs', 'C'], ['fat', 'F'], ['fiber', tr(locale, 'FIBER', 'VEZEL')]] as [keyof Macros, string][]).map(([key, label]) => <View key={key} style={s.macroField}><Text style={s.miniLabel}>{label}</Text><TextInput value={macro[key]} onChangeText={(value) => setMacro((current) => ({ ...current, [key]: value }))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted} style={s.macroInput} /></View>)}</View>
          <View style={s.row}><Pressable disabled={!name.trim() || number(macro.calories) <= 0} onPress={save} style={[s.primary, s.flex, (!name.trim() || number(macro.calories) <= 0) && s.disabled]}>{ico('save-outline', 18, colors.black)}<Text style={s.primaryText}>{editingId ? tr(locale, 'SAVE CHANGES', 'WIJZIGINGEN OPSLAAN') : tr(locale, 'ADD INGREDIENT', 'INGREDIËNT TOEVOEGEN')}</Text></Pressable>{editingId && <Pressable onPress={reset} style={s.secondary}>{ico('close', 18, colors.lime)}</Pressable>}</View>
        </View>
        <View style={s.listHeader}><Text style={s.sectionTitle}>{tr(locale, 'Saved ingredients', 'Opgeslagen ingrediënten')}</Text><Text style={s.count}>{ingredients.length}</Text></View>
        {!ingredients.length && <View style={s.empty}><Text style={s.emptyTitle}>{tr(locale, 'Your macro library is empty.', 'Je macrobibliotheek is leeg.')}</Text><Text style={s.help}>{tr(locale, 'Add label values once, then recipe macro calculations stay accurate.', 'Voeg etiketwaarden één keer toe; daarna blijven receptberekeningen correct.')}</Text></View>}
        {ingredients.map((item) => <View key={item.id} style={s.ingredientRow}><Pressable onPress={() => edit(item)} style={s.ingredientBody}><Text style={s.ingredientName}>{item.nameNl || item.name}</Text><Text style={s.ingredientMeta}>{item.brand ? `${item.brand} · ` : ''}{item.nutritionPer100.calories} kcal / 100 {item.baseUnit}</Text><Text style={s.ingredientMacros}>P {item.nutritionPer100.protein} · C {item.nutritionPer100.carbs} · F {item.nutritionPer100.fat} · {tr(locale, 'fiber', 'vezel')} {item.nutritionPer100.fiber}</Text></Pressable>{onSelect && <Pressable onPress={() => { onSelect(savedIngredientToRecipe(item)); onClose(); }} style={s.addCircle}>{ico('add', 21, colors.black)}</Pressable>}<Pressable onPress={() => onChange(ingredients.filter((current) => current.id !== item.id))} hitSlop={8} style={s.trash}>{ico('trash-outline', 18, colors.muted)}</Pressable></View>)}
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}

export function PerformanceHub({ locale, tablet, goals, recipes, plans, dailyTargets, onDailyTargets, weights, onWeights, vitamins, onVitamins, savedIngredients, onSavedIngredients, trainingDays }: {
  locale: Locale; tablet: boolean; goals: UserGoals; recipes: Recipe[]; plans: MealPlanEntry[];
  dailyTargets: DailyMacroTarget[]; onDailyTargets: (items: DailyMacroTarget[]) => void;
  weights: WeightEntry[]; onWeights: (items: WeightEntry[]) => void;
  vitamins: VitaminEntry[]; onVitamins: (items: VitaminEntry[]) => void;
  savedIngredients: SavedIngredient[]; onSavedIngredients: (items: SavedIngredient[]) => void;
  trainingDays: TrainingDay[];
}) {
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const selected = dailyTargets.find((item) => item.weekday === selectedDay) ?? { weekday: selectedDay, ...goals, fiber: 30 };
  const [targetDraft, setTargetDraft] = useState({ calories: '', protein: '', carbs: '', fat: '' });
  const [weight, setWeight] = useState(String(weights[0]?.weightKg ?? goals.weightKg));
  const [vitaminName, setVitaminName] = useState('');
  const [inventoryVisible, setInventoryVisible] = useState(false);
  const date = todayKey();
  useEffect(() => setTargetDraft({ calories: String(selected.calories), protein: String(selected.protein), carbs: String(selected.carbs), fat: String(selected.fat) }), [selectedDay, selected.calories, selected.protein, selected.carbs, selected.fat]);
  const saveTarget = () => {
    const next: DailyMacroTarget = { weekday: selectedDay, calories: number(targetDraft.calories), protein: number(targetDraft.protein), carbs: number(targetDraft.carbs), fat: number(targetDraft.fat), fiber: selected.fiber || 30 };
    onDailyTargets([...dailyTargets.filter((item) => item.weekday !== selectedDay), next]);
  };
  const addWeight = () => { const value = number(weight); if (value > 0) onWeights([{ id: `weight-${Date.now()}`, date, weightKg: value }, ...weights.filter((item) => item.date !== date)]); };
  const addVitamin = () => { if (vitaminName.trim()) { onVitamins([...vitamins, { id: `vitamin-${Date.now()}`, name: vitaminName.trim(), dose: '', takenDates: [] }]); setVitaminName(''); } };
  const training = trainingDays.find((item) => item.weekday === selectedDay)?.label;
  const plannedForDay = useMemo(() => plans.filter((entry) => new Date(`${entry.date}T12:00:00`).getDay() === selectedDay).map((entry) => recipes.find((recipe) => recipe.id === entry.recipeId)).filter((recipe): recipe is Recipe => !!recipe), [plans, recipes, selectedDay]);
  const plannedMacros = plannedForDay.reduce((sum, recipe) => ({ calories: sum.calories + recipe.macros.calories, protein: sum.protein + recipe.macros.protein, carbs: sum.carbs + recipe.macros.carbs, fat: sum.fat + recipe.macros.fat, fiber: sum.fiber + recipe.macros.fiber }), emptyMacros());

  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.hubPage, tablet && s.hubPageTablet]} keyboardShouldPersistTaps="always">
    <View style={s.hubHeader}><View style={s.hubHeaderText}><Text style={s.eyebrow}>{tr(locale, 'ALL-AROUND PERFORMANCE', 'COMPLETE PERFORMANCE')}</Text><Text style={s.hubTitle}>{tr(locale, 'MauGainZ Control Center', 'MauGainZ Controlecentrum')}</Text></View><View style={s.hubBadge}>{ico('barbell-outline', 25, colors.black)}</View></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.days}>{dayOrder.map((weekday) => <Pressable key={weekday} onPress={() => setSelectedDay(weekday)} style={[s.day, selectedDay === weekday && s.dayActive]}><Text style={[s.dayText, selectedDay === weekday && s.dark]}>{dayName(weekday, locale, true).toUpperCase()}</Text><Text style={[s.dayKcal, selectedDay === weekday && s.dark]}>{dailyTargets.find((item) => item.weekday === weekday)?.calories ?? goals.calories}</Text></Pressable>)}</ScrollView>
    <View style={[s.hubGrid, tablet && s.hubGridTablet]}>
      <View style={[s.hubCard, tablet && s.hubCardTablet]}><View style={s.cardHeading}><View><Text style={s.cardEyebrow}>{dayName(selectedDay, locale).toUpperCase()}</Text><Text style={s.cardTitle}>{tr(locale, 'Daily macro target', 'Dagelijks macrodoel')}</Text></View>{training && <View style={s.trainingChip}>{ico('barbell', 15, colors.black)}<Text style={s.trainingChipText}>{training}</Text></View>}</View><View style={s.macroGrid}>{([['calories', 'KCAL'], ['protein', 'P'], ['carbs', 'C'], ['fat', 'F']] as [keyof typeof targetDraft, string][]).map(([key, label]) => <View key={key} style={[s.macroField, !tablet && s.macroFieldMobile]}><Text style={s.miniLabel}>{label}</Text><TextInput value={targetDraft[key]} onChangeText={(value) => setTargetDraft((current) => ({ ...current, [key]: value }))} keyboardType="decimal-pad" style={s.macroInput} /></View>)}</View><Pressable onPress={saveTarget} style={s.primary}><Text style={s.primaryText}>{tr(locale, 'SAVE DAY TARGET', 'DAGDOEL OPSLAAN')}</Text></Pressable></View>
      <View style={[s.hubCard, tablet && s.hubCardTablet]}><Text style={s.cardEyebrow}>{tr(locale, 'PLANNED FOOD', 'GEPLANDE VOEDING')}</Text><Text style={s.cardTitle}>{plannedForDay.length} {tr(locale, 'meals this weekday', 'maaltijden op deze weekdag')}</Text><View style={s.planMacroRow}><View><Text style={s.bigValue}>{plannedMacros.calories}</Text><Text style={s.miniLabel}>KCAL</Text></View><View><Text style={s.planValue}>{plannedMacros.protein}g</Text><Text style={s.miniLabel}>P</Text></View><View><Text style={s.planValue}>{plannedMacros.carbs}g</Text><Text style={s.miniLabel}>C</Text></View><View><Text style={s.planValue}>{plannedMacros.fat}g</Text><Text style={s.miniLabel}>F</Text></View></View><View style={s.progress}><View style={[s.progressFill, { width: `${Math.min(100, selected.calories ? plannedMacros.calories / selected.calories * 100 : 0)}%` }]} /></View></View>
      <View style={[s.hubCard, tablet && s.hubCardTablet]}><Text style={s.cardEyebrow}>{tr(locale, 'WEIGHT JOURNAL', 'GEWICHTSDAGBOEK')}</Text><View style={s.row}><TextInput value={weight} onChangeText={setWeight} keyboardType="decimal-pad" style={[s.input, s.flex]} /><Text style={s.inputSuffix}>kg</Text><Pressable onPress={addWeight} style={s.smallPrimary}>{ico('add', 20, colors.black)}</Pressable></View>{weights.slice(0, 6).map((entry, index) => <View key={entry.id} style={s.historyRow}><View><Text style={s.historyValue}>{entry.weightKg} kg</Text><Text style={s.historyDate}>{new Date(`${entry.date}T12:00:00`).toLocaleDateString(locale === 'nl' ? 'nl-BE' : 'en-GB')}</Text></View>{index > 0 && <Text style={[s.delta, { color: entry.weightKg <= weights[index - 1]!.weightKg ? colors.lime : colors.orange }]}>{(entry.weightKg - weights[index - 1]!.weightKg).toFixed(1)} kg</Text>}<Pressable onPress={() => onWeights(weights.filter((item) => item.id !== entry.id))}>{ico('trash-outline', 17, colors.muted)}</Pressable></View>)}</View>
      <View style={[s.hubCard, tablet && s.hubCardTablet]}><Text style={s.cardEyebrow}>{tr(locale, 'DAILY VITAMINS', 'DAGELIJKSE VITAMINES')}</Text>{vitamins.map((item) => { const taken = item.takenDates.includes(date); return <Pressable key={item.id} onPress={() => onVitamins(vitamins.map((current) => current.id === item.id ? { ...current, takenDates: taken ? current.takenDates.filter((value) => value !== date) : [...current.takenDates, date] } : current))} style={s.vitaminRow}><View style={[s.check, taken && s.checkActive]}>{taken && ico('checkmark', 15, colors.black)}</View><Text style={[s.vitaminName, taken && s.done]}>{item.name}</Text><TextInput value={item.dose} onChangeText={(dose) => onVitamins(vitamins.map((current) => current.id === item.id ? { ...current, dose } : current))} placeholder={tr(locale, 'dose', 'dosis')} placeholderTextColor={colors.muted} style={s.doseInput} /><Pressable onPress={() => onVitamins(vitamins.filter((current) => current.id !== item.id))}>{ico('close', 17, colors.muted)}</Pressable></Pressable>; })}<View style={s.row}><TextInput value={vitaminName} onChangeText={setVitaminName} onSubmitEditing={addVitamin} placeholder={tr(locale, 'Add vitamin or supplement', 'Vitamine of supplement toevoegen')} placeholderTextColor={colors.muted} style={[s.input, s.flex]} /><Pressable onPress={addVitamin} style={s.smallPrimary}>{ico('add', 20, colors.black)}</Pressable></View></View>
      <Pressable onPress={() => setInventoryVisible(true)} style={[s.hubCard, tablet && s.hubCardTablet, s.inventoryCard]}><View style={s.inventoryIcon}>{ico('nutrition-outline', 27, colors.black)}</View><View style={s.flex}><Text style={s.cardEyebrow}>{tr(locale, 'INGREDIENT MACRO LIBRARY', 'MACROBIBLIOTHEEK INGREDIËNTEN')}</Text><Text style={s.cardTitle}>{savedIngredients.length} {tr(locale, 'verified ingredients', 'gecontroleerde ingrediënten')}</Text><Text style={s.help}>{tr(locale, 'Correct macro values once; MauGainZ reuses them everywhere.', 'Pas macrowaarden één keer aan; MauGainZ gebruikt ze daarna overal.')}</Text></View>{ico('chevron-forward', 21, colors.lime)}</Pressable>
    </View>
    <IngredientLibraryModal visible={inventoryVisible} locale={locale} ingredients={savedIngredients} onChange={onSavedIngredients} onClose={() => setInventoryVisible(false)} />
  </ScrollView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg }, top: { minHeight: 86, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, eyebrow: { color: colors.lime, fontSize: 9, fontWeight: '900', letterSpacing: 1.35 }, title: { color: colors.cream, fontSize: 26, fontWeight: '900', marginTop: 4 }, circle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, modalContent: { width: '100%', maxWidth: 1060, alignSelf: 'center', padding: 22, paddingBottom: 70 }, editorCard: { borderRadius: radius.lg, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 18 }, cardTitle: { color: colors.cream, fontSize: 19, fontWeight: '900' }, help: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 6 }, input: { height: 48, borderRadius: 13, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, color: colors.cream, paddingHorizontal: 13, fontSize: 13, marginTop: 12 }, row: { flexDirection: 'row', alignItems: 'center', gap: 9 }, flex: { flex: 1 }, label: { color: colors.lime, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 17, marginBottom: 2 }, unitRow: { flexDirection: 'row', gap: 4, marginTop: 12 }, unit: { minWidth: 38, height: 48, borderRadius: 12, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, unitActive: { backgroundColor: colors.lime, borderColor: colors.lime }, unitText: { color: colors.muted, fontSize: 10, fontWeight: '900' }, dark: { color: colors.black }, macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }, macroField: { flex: 1, minWidth: 88 }, miniLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: .7 }, macroInput: { height: 47, marginTop: 5, borderRadius: 12, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, color: colors.cream, textAlign: 'center', fontSize: 15, fontWeight: '900' }, primary: { minHeight: 50, borderRadius: 14, backgroundColor: colors.lime, paddingHorizontal: 15, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, primaryText: { color: colors.black, fontSize: 10, fontWeight: '900', letterSpacing: .6 }, secondary: { width: 50, height: 50, marginTop: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.lime, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: .35 }, listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 10 }, sectionTitle: { color: colors.cream, fontSize: 21, fontWeight: '900' }, count: { color: colors.lime, fontSize: 13, fontWeight: '900' }, empty: { borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, padding: 24, alignItems: 'center' }, emptyTitle: { color: colors.cream, fontSize: 14, fontWeight: '900' }, ingredientRow: { minHeight: 78, borderRadius: 16, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 9 }, ingredientBody: { flex: 1 }, ingredientName: { color: colors.cream, fontSize: 14, fontWeight: '900' }, ingredientMeta: { color: colors.muted, fontSize: 9, marginTop: 4 }, ingredientMacros: { color: colors.lime, fontSize: 9, fontWeight: '800', marginTop: 4 }, addCircle: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }, trash: { width: 34, alignItems: 'center' },
  hubPage: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 125 }, hubPageTablet: { width: '100%', maxWidth: 1680, alignSelf: 'center', paddingHorizontal: 34, paddingTop: 30, paddingBottom: 54 }, hubHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }, hubHeaderText: { flex: 1, minWidth: 0, paddingRight: 12 }, hubTitle: { color: colors.cream, fontSize: 30, fontWeight: '900', marginTop: 4 }, hubBadge: { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }, days: { gap: 8, paddingBottom: 20 }, day: { width: 80, minHeight: 66, borderRadius: 16, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, dayActive: { backgroundColor: colors.lime, borderColor: colors.lime }, dayText: { color: colors.muted, fontSize: 9, fontWeight: '900' }, dayKcal: { color: colors.cream, fontSize: 15, fontWeight: '900', marginTop: 4 }, hubGrid: { gap: 14 }, hubGridTablet: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' }, hubCard: { minWidth: 0, borderRadius: radius.lg, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 18 }, hubCardTablet: { flexGrow: 1, flexBasis: 420 }, cardHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }, cardEyebrow: { color: colors.lime, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginBottom: 5 }, trainingChip: { borderRadius: 12, backgroundColor: colors.lime, paddingHorizontal: 10, height: 34, flexDirection: 'row', alignItems: 'center', gap: 5 }, trainingChipText: { color: colors.black, fontSize: 9, fontWeight: '900' }, planMacroRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 24 }, bigValue: { color: colors.lime, fontSize: 34, fontWeight: '900' }, planValue: { color: colors.cream, fontSize: 20, fontWeight: '900' }, progress: { height: 7, borderRadius: 4, backgroundColor: colors.panelSoft, overflow: 'hidden', marginTop: 18 }, progressFill: { height: '100%', backgroundColor: colors.lime }, inputSuffix: { color: colors.muted, fontSize: 12, fontWeight: '800', marginTop: 12 }, smallPrimary: { width: 48, height: 48, borderRadius: 13, marginTop: 12, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }, historyRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line }, historyValue: { color: colors.cream, fontSize: 13, fontWeight: '900' }, historyDate: { color: colors.muted, fontSize: 8, marginTop: 2 }, delta: { flex: 1, textAlign: 'right', fontSize: 10, fontWeight: '900' }, vitaminRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: colors.line }, check: { width: 26, height: 26, borderRadius: 9, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, checkActive: { backgroundColor: colors.lime, borderColor: colors.lime }, vitaminName: { flex: 1, color: colors.cream, fontSize: 12, fontWeight: '800' }, done: { color: colors.muted, textDecorationLine: 'line-through' }, doseInput: { width: 78, height: 36, borderRadius: 10, backgroundColor: colors.bg, color: colors.cream, textAlign: 'center', fontSize: 10 }, inventoryCard: { flexDirection: 'row', alignItems: 'center', gap: 13 }, inventoryIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }, macroFieldMobile: { flexBasis: '45%', minWidth: 130 }
});
