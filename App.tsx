import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { categories, categoryLabel, ingredientSuggestions, starterRecipes, units } from './src/data';
import { CategoryOption, DailyMacroTarget, FoodDiaryEntry, ImportedRecipe, Ingredient, IngredientOption, Locale, Macros, MealPlanEntry, Recipe, SavedIngredient, ShoppingItem, TabName, TrainingDay, UnitSystem, UserGoals, VitaminEntry, WeightEntry } from './src/types';
import { colors, radius } from './src/theme';
import { baseIngredientProfiles, estimateRecipeMacros, nutritionCoverage } from './src/nutrition';
import { CookingMode, PlannerScreen, SettingsModal } from './src/ProFeatures';
import { IngredientLookupModal, IngredientMacroReviewModal, RecipeImportModal } from './src/SmartModals';
import { BackupPayload, cloudConfigured, createSyncCode, downloadCloudBackup, uploadCloudBackup } from './src/cloudSync';
import { APP_VERSION, AppUpdate, checkForAppUpdate } from './src/updater';
import { IngredientLibraryModal, PerformanceHub } from './src/AllAround';
import { FoodDiaryScreen } from './src/FoodDiary';
import { FriendsScreen } from './src/Friends';
import { AccountUser, downloadAccountData, getAccountDataOwner, restoreAccount, uploadAccountData } from './src/accountSync';

const STORAGE_KEY = '@maugains/recipes-v1';
const LOCALE_KEY = '@maugains/locale-v1';
const CATEGORY_KEY = '@maugains/categories-v1';
const GOALS_KEY = '@maugains/goals-v1';
const PLAN_KEY = '@maugains/planner-v1';
const SHOPPING_KEY = '@maugains/shopping-v1';
const PREFERENCES_KEY = '@maugains/preferences-v1';
const INGREDIENT_HISTORY_KEY = '@maugains/ingredient-history-v1';
const CLOUD_SYNC_KEY = '@maugains/cloud-sync-v1';
const ALL_AROUND_KEY = '@maugainz/all-around-v1';
const DIARY_KEY = '@maugainz/food-diary-v1';
const brandLogo = require('./assets/branding/maugainz-v3-mark.png');

const t = (locale: Locale, english: string, dutch: string) => locale === 'nl' ? dutch : english;
const recipeTitle = (recipe: Recipe, locale: Locale) => locale === 'nl' ? recipe.titleNl ?? recipe.title : recipe.title;
const recipeSubtitle = (recipe: Recipe, locale: Locale) => locale === 'nl' ? recipe.subtitleNl ?? recipe.subtitle : recipe.subtitle;
const ingredientName = (ingredient: Ingredient, locale: Locale) => locale === 'nl' ? ingredient.nameNl ?? ingredient.name : ingredient.name;
const recipeSteps = (recipe: Recipe, locale: Locale) => locale === 'nl' ? recipe.stepsNl ?? recipe.steps : recipe.steps;
const unitLabel = (unit: string, locale: Locale) => locale === 'nl' ? ({ pc: 'st', tbsp: 'el', tsp: 'tl', scoop: 'schep' } as Record<string, string>)[unit] ?? unit : unit;
const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const icon = (name: string, size = 20, color = colors.cream) => (
  <Ionicons name={name as never} size={size} color={color} />
);

const newIngredient = (): Ingredient => ({
  id: `${Date.now()}-${Math.random()}`,
  name: '',
  amount: '',
  unit: 'g'
});

function DragGrip({ index, total, onMove, label }: { index: number; total: number; onMove: (from: number, to: number) => void; label: string }) {
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 3,
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_, gesture) => {
      const target = Math.max(0, Math.min(total - 1, index + Math.round(gesture.dy / 58)));
      if (target !== index) onMove(index, target);
    }
  }), [index, total, onMove]);
  return <View accessibilityRole="adjustable" accessibilityLabel={label} style={styles.dragGrip} {...responder.panHandlers}>{icon('reorder-three-outline', 22, colors.muted)}</View>;
}

const numberValue = (value: string) => Number(value.replace(',', '.')) || 0;
const preciseAmount = (value: number, locale: Locale) => {
  const rounded = Math.round((value + Number.EPSILON) * 1000) / 1000;
  return String(rounded).replace('.', locale === 'nl' ? ',' : '.');
};
const normalizeSearch = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase()
  .trim();
const accentForCategory = (category: string) => ({
  Breakfast: colors.orange,
  'Post-workout': colors.lime,
  'High calorie': colors.blue,
  'Quick meal': colors.cream
} as Record<string, string>)[category] ?? colors.lime;

function Pill({ label, active = false, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pill, active && styles.pillActive, pressed && styles.pressed]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function MacroBadge({ value, label, accent = colors.lime }: { value: number; label: string; accent?: string }) {
  return (
    <View style={styles.macroBadge}>
      <Text style={[styles.macroNumber, { color: accent }]}>{value}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

function RecipeCard({ recipe, locale, tablet, onPress, onFavorite }: { recipe: Recipe; locale: Locale; tablet: boolean; onPress: () => void; onFavorite: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.recipeCard, tablet && styles.recipeCardTablet, pressed && styles.cardPressed]}>
      <LinearGradient
        colors={[`${recipe.accent}28`, colors.panel]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.75, y: 0.8 }}
        style={styles.recipeArt}
      >
        {recipe.photoUri && <Image source={{ uri: recipe.photoUri }} resizeMode="cover" style={styles.recipeArtPhoto} />}
        <View style={[styles.recipeIcon, { backgroundColor: recipe.accent }]}>
          {icon(recipe.icon, 28, colors.black)}
        </View>
        <Pressable onPress={onFavorite} hitSlop={12} style={styles.favoriteButton}>
          {icon(recipe.favorite ? 'heart' : 'heart-outline', 21, recipe.favorite ? recipe.accent : colors.cream)}
        </Pressable>
        <Text style={styles.recipeCategory}>{categoryLabel(recipe.category, locale).toUpperCase()}</Text>
      </LinearGradient>
      <View style={styles.recipeCardBody}>
        <Text style={styles.recipeTitle} numberOfLines={1}>{recipeTitle(recipe, locale)}</Text>
        <Text style={styles.recipeSubtitle} numberOfLines={1}>{recipeSubtitle(recipe, locale)}</Text>
        <View style={styles.recipeMetaRow}>
          <View style={styles.metaItem}>{icon('time-outline', 15, colors.muted)}<Text style={styles.metaText}>{recipe.prepTime} min</Text></View>
          <View style={styles.metaItem}>{icon('flame-outline', 15, colors.muted)}<Text style={styles.metaText}>{recipe.macros.calories} kcal</Text></View>
          <View style={styles.proteinTag}><Text style={styles.proteinTagText}>{recipe.macros.protein}g P</Text></View>
        </View>
      </View>
    </Pressable>
  );
}

function Header({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTitleBlock}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.screenTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

function UpdateModal({ update, locale, onClose }: { update: AppUpdate | null; locale: Locale; onClose: () => void }) {
  const install = async () => {
    if (!update) return;
    try {
      await Linking.openURL(update.downloadUrl);
    } catch {
      Alert.alert('MauGainZ', t(locale, 'The download could not be opened. Try the release page instead.', 'De download kon niet worden geopend. Probeer de releasepagina.'));
      Linking.openURL(update.releaseUrl).catch(() => undefined);
    }
  };

  return (
    <Modal visible={!!update} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.updateBackdrop}>
        <View style={styles.updateCard}>
          <View style={styles.updateIcon}>{icon('arrow-up-circle', 32, colors.black)}</View>
          <Text style={styles.updateEyebrow}>{t(locale, 'NEW VERSION AVAILABLE', 'NIEUWE VERSIE BESCHIKBAAR')}</Text>
          <Text style={styles.updateTitle}>{update?.title}</Text>
          <Text style={styles.updateVersion}>{t(locale, 'Installed', 'Geïnstalleerd')} {APP_VERSION}  →  {update?.version}</Text>
          {!!update?.notes && <Text style={styles.updateNotes} numberOfLines={7}>{update.notes}</Text>}
          <Text style={styles.updateHint}>{t(locale, 'Android will ask you to confirm the APK installation after downloading.', 'Android vraagt na het downloaden om de installatie van de APK te bevestigen.')}</Text>
          <Pressable onPress={install} style={({ pressed }) => [styles.updatePrimary, pressed && styles.pressed]}>
            {icon('download-outline', 20, colors.black)}
            <Text style={styles.updatePrimaryText}>{t(locale, 'DOWNLOAD UPDATE', 'UPDATE DOWNLOADEN')}</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.updateLater}>
            <Text style={styles.updateLaterText}>{t(locale, 'Not now', 'Niet nu')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function HomeScreen({ recipes, diaryEntries, locale, tablet, goals, onOpen, onGoRecipes, onGoDiary, onCreate, onSettings }: {
  recipes: Recipe[];
  diaryEntries: FoodDiaryEntry[];
  locale: Locale;
  tablet: boolean;
  goals: UserGoals;
  onOpen: (recipe: Recipe) => void;
  onGoRecipes: () => void;
  onGoDiary: () => void;
  onCreate: () => void;
  onSettings: () => void;
}) {
  const favorites = recipes.filter((recipe) => recipe.favorite);
  const spotlight = favorites[0] ?? recipes[0];
  const today = diaryEntries.filter((entry) => entry.date === localDateKey()).reduce(
    (sum, entry) => ({
      calories: Math.round((sum.calories + entry.macros.calories) * 10) / 10,
      protein: Math.round((sum.protein + entry.macros.protein) * 10) / 10,
      carbs: Math.round((sum.carbs + entry.macros.carbs) * 10) / 10,
      fat: Math.round((sum.fat + entry.macros.fat) * 10) / 10
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.screenContent, tablet && styles.tabletScreenContent]}>
      <Header
        eyebrow={t(locale, 'WEDNESDAY · PUSH DAY', 'WOENSDAG · PUSHDAG')}
        title={t(locale, 'Feed the work.', 'Voed je progressie.')}
        action={<View style={styles.headerActions}><Pressable onPress={onSettings} style={styles.headerUtility}>{icon('settings-outline', 21, colors.cream)}</Pressable><View style={styles.brandMark}><Image source={brandLogo} resizeMode="contain" style={styles.brandMarkImage} /></View></View>}
      />

      <View style={tablet ? styles.tabletHomeGrid : undefined}>
        <View style={tablet ? styles.tabletHomeColumn : undefined}>
          <LinearGradient colors={['#E0B65E', '#B88A35']} style={[styles.heroCard, tablet && styles.tabletHeroCard]}>
            <View style={styles.heroTop}>
              <View style={styles.heroLabel}><Text style={styles.heroLabelText}>{t(locale, "TODAY'S FUEL", 'BRANDSTOF VANDAAG')}</Text></View>
              <Pressable onPress={onGoDiary} style={styles.heroDiaryButton}>{icon('journal-outline', 18, colors.black)}<Text style={styles.heroDiaryButtonText}>{t(locale, 'OPEN DIARY', 'OPEN DAGBOEK')}</Text></Pressable>
            </View>
            <Text style={[styles.heroNumber, tablet && styles.tabletHeroNumber]}>{today.calories.toLocaleString()}</Text>
            <Text style={styles.heroUnit}>{t(locale, 'OF', 'VAN')} {goals.calories.toLocaleString()} KCAL</Text>
            <View style={styles.heroProgressTrack}>
              <View style={[styles.heroProgressFill, { width: `${Math.min(100, (today.calories / goals.calories) * 100)}%` }]} />
            </View>
            <View style={styles.heroMacros}>
              <View><Text style={styles.heroMacroValue}>{today.protein}g</Text><Text style={styles.heroMacroLabel}>{t(locale, 'PROTEIN', 'EIWIT')}</Text></View>
              <View><Text style={styles.heroMacroValue}>{today.carbs}g</Text><Text style={styles.heroMacroLabel}>{t(locale, 'CARBS', 'KOOLHYDRATEN')}</Text></View>
              <View><Text style={styles.heroMacroValue}>{today.fat}g</Text><Text style={styles.heroMacroLabel}>{t(locale, 'FATS', 'VETTEN')}</Text></View>
            </View>
          </LinearGradient>

          <View style={[styles.quickRow, tablet && styles.tabletQuickRow]}>
            <Pressable onPress={onCreate} style={({ pressed }) => [styles.quickAction, tablet && styles.tabletQuickAction, pressed && styles.pressed]}>
              <View style={styles.quickIcon}>{icon('add', 24, colors.black)}</View>
              <View><Text style={styles.quickTitle}>{t(locale, 'Build recipe', 'Recept maken')}</Text><Text style={styles.quickSubtitle}>{t(locale, 'Track every gram', 'Volg elke gram')}</Text></View>
            </Pressable>
            <Pressable onPress={onGoRecipes} style={({ pressed }) => [styles.quickAction, tablet && styles.tabletQuickAction, pressed && styles.pressed]}>
              <View style={[styles.quickIcon, styles.quickIconDark]}>{icon('book-outline', 21, colors.lime)}</View>
              <View><Text style={styles.quickTitle}>{t(locale, 'My cookbook', 'Mijn kookboek')}</Text><Text style={styles.quickSubtitle}>{recipes.length} {t(locale, 'recipes', 'recepten')}</Text></View>
            </Pressable>
          </View>
        </View>

        <View style={tablet ? styles.tabletHomeColumn : undefined}>
          <View style={[styles.sectionHeading, tablet && styles.tabletHomeSectionHeading]}>
            <View><Text style={styles.sectionEyebrow}>{t(locale, 'MUSCLE ON THE MENU', 'SPIEREN OP HET MENU')}</Text><Text style={styles.sectionTitle}>{t(locale, 'Your favourites', 'Jouw favorieten')}</Text></View>
            <Pressable onPress={onGoRecipes}><Text style={styles.linkText}>{t(locale, 'See all', 'Alles bekijken')}</Text></Pressable>
          </View>

          {spotlight ? (
            <Pressable onPress={() => onOpen(spotlight)} style={[styles.spotlightCard, tablet && styles.tabletSpotlightCard]}>
              <LinearGradient colors={[`${spotlight.accent}35`, '#1B1E18']} style={[styles.spotlightGradient, tablet && styles.tabletSpotlightGradient]}>
                <View style={styles.spotlightTop}>
                  <View style={[styles.spotlightIcon, { borderColor: spotlight.accent }]}>{icon(spotlight.icon, 36, spotlight.accent)}</View>
                  <View style={styles.spotlightCalories}>
                    <Text style={styles.spotlightCaloriesValue}>{spotlight.macros.calories}</Text>
                    <Text style={styles.spotlightCaloriesLabel}>KCAL</Text>
                  </View>
                </View>
                <Text style={styles.spotlightCategory}>{categoryLabel(spotlight.category, locale).toUpperCase()}</Text>
                <Text style={styles.spotlightTitle}>{recipeTitle(spotlight, locale)}</Text>
                <Text style={styles.spotlightSubtitle}>{recipeSubtitle(spotlight, locale)}</Text>
                <View style={styles.spotlightFooter}>
                  <Text style={styles.spotlightProtein}>{spotlight.macros.protein}G {t(locale, 'PROTEIN', 'EIWIT')}</Text>
                  <View style={[styles.roundArrow, { backgroundColor: spotlight.accent }]}>{icon('arrow-forward', 20, colors.black)}</View>
                </View>
              </LinearGradient>
            </Pressable>
          ) : (
            <View style={styles.emptyCard}><Text style={styles.emptyTitle}>{t(locale, 'Your cookbook is hungry.', 'Je kookboek heeft honger.')}</Text><Text style={styles.emptyBody}>{t(locale, 'Create your first performance recipe to get started.', 'Maak je eerste performancerecept om te beginnen.')}</Text></View>
          )}
        </View>
      </View>
      <View style={styles.homeLowerSection}>
        <View style={styles.sectionHeading}><View><Text style={styles.sectionEyebrow}>{t(locale, 'READY FOR THE WEEK', 'KLAAR VOOR DE WEEK')}</Text><Text style={styles.sectionTitle}>{t(locale, 'Recently added', 'Recent toegevoegd')}</Text></View><Pressable onPress={onGoRecipes}><Text style={styles.linkText}>{t(locale, 'Open cookbook', 'Open kookboek')}</Text></Pressable></View>
        <View style={[styles.homeRecipeGrid, tablet && styles.homeRecipeGridTablet]}>{recipes.slice(0, tablet ? 4 : 3).map((recipe) => <Pressable key={recipe.id} onPress={() => onOpen(recipe)} style={[styles.homeRecipeCard, tablet && styles.homeRecipeCardTablet]}><View style={[styles.homeRecipeIcon, { backgroundColor: `${recipe.accent}24` }]}>{icon(recipe.icon, 24, recipe.accent)}</View><Text style={styles.homeRecipeCategory}>{categoryLabel(recipe.category, locale).toUpperCase()}</Text><Text style={styles.homeRecipeTitle} numberOfLines={2}>{recipeTitle(recipe, locale)}</Text><View style={styles.homeRecipeFooter}><Text style={styles.homeRecipeMacro}>{recipe.macros.calories} kcal</Text><Text style={styles.homeRecipeMacro}>{recipe.macros.protein}g P</Text>{icon('arrow-forward-circle-outline', 21, recipe.accent)}</View></Pressable>)}</View>
      </View>
    </ScrollView>
  );
}

function RecipesScreen({ recipes, locale, tablet, categoryOptions, onOpen, onFavorite, onCreate }: {
  recipes: Recipe[];
  locale: Locale;
  tablet: boolean;
  categoryOptions: string[];
  onOpen: (recipe: Recipe) => void;
  onFavorite: (id: string) => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<'newest' | 'protein' | 'calories'>('newest');
  const filtered = recipes.filter((recipe) => {
    const matchesCategory = category === 'All' || recipe.category === category;
    const haystack = normalizeSearch(`${recipe.title} ${recipe.titleNl ?? ''} ${recipe.subtitle} ${recipe.subtitleNl ?? ''} ${recipe.ingredients.map((item) => `${item.name} ${item.nameNl ?? ''}`).join(' ')}`);
    return matchesCategory && haystack.includes(normalizeSearch(query));
  }).sort((a, b) => sort === 'protein' ? b.macros.protein - a.macros.protein : sort === 'calories' ? b.macros.calories - a.macros.calories : b.createdAt - a.createdAt);
  const sortLabel = sort === 'protein' ? t(locale, 'Protein', 'Eiwit') : sort === 'calories' ? t(locale, 'Calories', 'Calorieën') : t(locale, 'Newest', 'Nieuwste');

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.screenContent, tablet && styles.tabletScreenContent]} keyboardShouldPersistTaps="handled">
      <Header
        eyebrow={`${recipes.length} ${t(locale, 'PERFORMANCE RECIPES', 'PERFORMANCERECEPTEN')}`}
        title={t(locale, 'The cookbook', 'Het kookboek')}
        action={<Pressable onPress={onCreate} style={styles.headerAdd}>{icon('add', 25, colors.black)}</Pressable>}
      />
      <View style={styles.searchBox}>
        {icon('search-outline', 20, colors.muted)}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t(locale, 'Search recipes or ingredients', 'Zoek recepten of ingrediënten')}
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {!!query && <Pressable onPress={() => setQuery('')}>{icon('close-circle', 18, colors.muted)}</Pressable>}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {categoryOptions.map((item) => <Pill key={item} label={categoryLabel(item, locale)} active={category === item} onPress={() => setCategory(item)} />)}
      </ScrollView>

      <View style={styles.resultsRow}>
        <Text style={styles.resultsText}>{filtered.length} {filtered.length === 1 ? t(locale, 'recipe', 'recept') : t(locale, 'recipes', 'recepten')}</Text>
        <Pressable onPress={() => setSort((current) => current === 'newest' ? 'protein' : current === 'protein' ? 'calories' : 'newest')} style={styles.sortLabel}>{icon('options-outline', 15, colors.muted)}<Text style={styles.sortText}>{sortLabel}</Text></Pressable>
      </View>

      <View style={tablet ? styles.tabletRecipeGrid : undefined}>
        {filtered.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} locale={locale} tablet={tablet} onPress={() => onOpen(recipe)} onFavorite={() => onFavorite(recipe.id)} />
        ))}
      </View>
      {!filtered.length && (
        <View style={styles.emptyCard}>
          {icon('search-outline', 34, colors.muted)}
          <Text style={styles.emptyTitle}>{t(locale, 'No gains found.', 'Geen gains gevonden.')}</Text>
          <Text style={styles.emptyBody}>{t(locale, 'Try another search or build a new recipe.', 'Probeer een andere zoekterm of maak een nieuw recept.')}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function FieldLabel({ children, optional, locale = 'en' }: { children: React.ReactNode; optional?: boolean; locale?: Locale }) {
  return <Text style={styles.fieldLabel}>{children} {optional && <Text style={styles.optional}>{t(locale, 'OPTIONAL', 'OPTIONEEL')}</Text>}</Text>;
}

function BuilderScreen({ locale, tablet, landscape, wideLandscape, initialRecipe, categoryOptions, categoryStyles, recentIngredientNames, savedIngredients, onSavedIngredients, onIngredientUsed, onAddCategory, onSave, onCancel }: {
  locale: Locale;
  tablet: boolean;
  landscape: boolean;
  wideLandscape: boolean;
  initialRecipe?: Recipe | null;
  categoryOptions: string[];
  categoryStyles: CategoryOption[];
  recentIngredientNames: string[];
  savedIngredients: SavedIngredient[];
  onSavedIngredients: (items: SavedIngredient[]) => void;
  onIngredientUsed: (name: string) => void;
  onAddCategory: (category: string) => void;
  onSave: (recipe: Recipe) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initialRecipe?.title ?? '');
  const [subtitle, setSubtitle] = useState(initialRecipe?.subtitle ?? '');
  const [category, setCategory] = useState(initialRecipe?.category ?? 'Post-workout');
  const [prepTime, setPrepTime] = useState(String(initialRecipe?.prepTime ?? 20));
  const [servings, setServings] = useState(String(initialRecipe?.servings ?? 1));
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialRecipe?.ingredients.map((item) => ({ ...item })) ?? [newIngredient(), newIngredient()]);
  const [ingredientQuery, setIngredientQuery] = useState('');
  const [steps, setSteps] = useState(initialRecipe?.steps.slice() ?? ['', '']);
  const [stepTimers, setStepTimers] = useState<number[]>(initialRecipe?.stepTimers?.slice() ?? (initialRecipe?.steps ?? ['', '']).map(() => 0));
  const [macroInput, setMacroInput] = useState({
    calories: initialRecipe ? String(initialRecipe.macros.calories) : '', protein: initialRecipe ? String(initialRecipe.macros.protein) : '',
    carbs: initialRecipe ? String(initialRecipe.macros.carbs) : '', fat: initialRecipe ? String(initialRecipe.macros.fat) : '', fiber: initialRecipe ? String(initialRecipe.macros.fiber) : ''
  });
  const [newCategory, setNewCategory] = useState('');
  const [photoUri, setPhotoUri] = useState(initialRecipe?.photoUri ?? '');
  const [dietaryTags, setDietaryTags] = useState<string[]>(initialRecipe?.dietaryTags ?? []);
  const [allergens, setAllergens] = useState<string[]>(initialRecipe?.allergens ?? []);
  const [lookupVisible, setLookupVisible] = useState(false);
  const [libraryVisible, setLibraryVisible] = useState(false);
  const [importVisible, setImportVisible] = useState(false);
  const [macroIngredient, setMacroIngredient] = useState<Ingredient | null>(null);
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<'basics' | 'ingredients' | 'preparation' | 'macros', boolean>>({ basics: false, ingredients: false, preparation: false, macros: false });
  const builderScrollRef = useRef<ScrollView>(null);
  const amountAnchors = useRef<Record<string, { amount: number; servings: number }>>(Object.fromEntries((initialRecipe?.ingredients ?? []).map((item) => [item.id, { amount: numberValue(item.amount), servings: Math.max(1, initialRecipe?.servings ?? 1) }])));
  const toggleSection = (section: keyof typeof collapsed) => setCollapsed((current) => ({ ...current, [section]: !current[section] }));
  const filledIngredientCount = ingredients.filter((item) => item.name.trim() && item.amount.trim()).length;
  const filledStepCount = steps.filter((step) => step.trim()).length;
  const recipeChecks = [
    { label: t(locale, 'Recipe named', 'Recept benoemd'), done: !!title.trim() },
    { label: t(locale, 'Ingredients ready', 'Ingrediënten klaar'), done: filledIngredientCount > 0 },
    { label: t(locale, 'Method complete', 'Bereiding compleet'), done: filledStepCount > 0 },
    { label: t(locale, 'Macros entered', 'Macro’s ingevuld'), done: numberValue(macroInput.calories) > 0 }
  ];
  const completion = Math.round((recipeChecks.filter((item) => item.done).length / recipeChecks.length) * 100);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      setTimeout(() => {
        const focusedInput = TextInput.State.currentlyFocusedInput?.();
        if (focusedInput) builderScrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(focusedInput, 36, true);
      }, 120);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const updateIngredient = (id: string, update: Partial<Ingredient>) => {
    if (update.amount !== undefined) {
      const parsed = Number(update.amount.replace(',', '.'));
      if (update.amount.trim() && Number.isFinite(parsed)) amountAnchors.current[id] = { amount: parsed, servings: Math.max(1, numberValue(servings)) };
      else delete amountAnchors.current[id];
    }
    setIngredients((current) => current.map((item) => item.id === id ? { ...item, ...update } : item));
  };

  const changeServings = (change: number) => {
    const currentServings = Math.max(1, numberValue(servings));
    const nextServings = Math.max(1, currentServings + change);
    if (nextServings === currentServings) return;
    setIngredients((current) => current.map((item) => {
      const currentAmount = Number(item.amount.replace(',', '.'));
      if (!item.amount.trim() || !Number.isFinite(currentAmount)) return item;
      const anchor = amountAnchors.current[item.id] ?? { amount: currentAmount, servings: currentServings };
      amountAnchors.current[item.id] = anchor;
      return { ...item, amount: preciseAmount(anchor.amount * nextServings / anchor.servings, locale) };
    }));
    setServings(String(nextServings));
  };

  const cycleUnit = (ingredient: Ingredient) => {
    const index = units.indexOf(ingredient.unit);
    updateIngredient(ingredient.id, { unit: units[(index + 1) % units.length] ?? 'g' });
  };

  const moveIngredient = (from: number, to: number) => setIngredients((current) => {
    const next = current.slice();
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    return next;
  });

  const moveStep = (from: number, to: number) => {
    setSteps((current) => { const next = current.slice(); const [moved] = next.splice(from, 1); if (moved !== undefined) next.splice(to, 0, moved); return next; });
    setStepTimers((current) => { const next = current.slice(); const [moved] = next.splice(from, 1); if (moved !== undefined) next.splice(to, 0, moved); return next; });
  };

  const addSuggested = (option: IngredientOption) => {
    const blank = ingredients.find((item) => !item.name.trim());
    const names = { name: option.en, nameNl: option.nl };
    if (blank) updateIngredient(blank.id, names);
    else setIngredients((current) => [...current, { ...newIngredient(), ...names }]);
    onIngredientUsed(option.en);
  };

  const addIngredient = (item: Ingredient) => {
    const blank = ingredients.find((entry) => !entry.name.trim());
    const nextItem = { ...item, id: blank?.id ?? item.id };
    const needsConfirmation = item.nutritionSource !== 'maugainz' && !!item.nutritionPer100;
    const recipeItem = needsConfirmation ? { ...nextItem, nutritionPer100: undefined, nutritionSource: undefined } : nextItem;
    setIngredients((current) => blank ? current.map((entry) => entry.id === blank.id ? recipeItem : entry) : [...current, recipeItem]);
    if (needsConfirmation) setMacroIngredient(nextItem);
  };

  const reviewMacros = (ingredient: Ingredient) => {
    const saved = savedIngredients.find((item) => (ingredient.barcode && item.barcode === ingredient.barcode) || normalizeSearch(item.name) === normalizeSearch(ingredient.name) || (ingredient.nameNl && normalizeSearch(item.nameNl ?? item.name) === normalizeSearch(ingredient.nameNl)));
    const base = baseIngredientProfiles.find((item) => normalizeSearch(item.name) === normalizeSearch(ingredient.name) || (ingredient.nameNl && normalizeSearch(item.nameNl ?? item.name) === normalizeSearch(ingredient.nameNl)));
    setMacroIngredient(saved ? { ...ingredient, brand: ingredient.brand ?? saved.brand, barcode: ingredient.barcode ?? saved.barcode, nutritionPer100: saved.nutritionPer100, nutritionSource: 'maugainz' } : base ? { ...ingredient, name: base.name, nameNl: base.nameNl, nutritionPer100: base.nutritionPer100 } : ingredient);
  };

  const confirmIngredientMacros = (verified: Ingredient, baseUnit: 'g' | 'ml') => {
    setIngredients((current) => current.map((item) => item.id === verified.id ? { ...item, name: verified.name, nameNl: verified.nameNl, brand: verified.brand, barcode: verified.barcode, nutritionPer100: verified.nutritionPer100, nutritionSource: 'maugainz' } : item));
    const saved: SavedIngredient = {
      id: `saved-${Date.now()}`,
      name: verified.name,
      nameNl: verified.nameNl,
      brand: verified.brand,
      barcode: verified.barcode,
      baseUnit,
      nutritionPer100: verified.nutritionPer100!
    };
    const existing = savedIngredients.find((item) => (saved.barcode && item.barcode === saved.barcode) || normalizeSearch(item.name) === normalizeSearch(saved.name) || (saved.nameNl && normalizeSearch(item.nameNl ?? item.name) === normalizeSearch(saved.nameNl)));
    onSavedIngredients(existing ? savedIngredients.map((item) => item.id === existing.id ? { ...saved, id: existing.id } : item) : [saved, ...savedIngredients]);
    setMacroIngredient(null);
  };

  const filteredSuggestions = ingredientSuggestions.filter((option) =>
    normalizeSearch(`${option.en} ${option.nl} ${option.group}`).includes(normalizeSearch(ingredientQuery))
  ).sort((a, b) => {
    const aIndex = recentIngredientNames.indexOf(a.en);
    const bIndex = recentIngredientNames.indexOf(b.en);
    return (aIndex < 0 ? 999 : aIndex) - (bIndex < 0 ? 999 : bIndex);
  });

  const addCustomCategory = () => {
    const cleanCategory = newCategory.trim();
    if (!cleanCategory) return;
    const existing = categoryOptions.find((item) => normalizeSearch(item) === normalizeSearch(cleanCategory));
    const nextCategory = existing ?? cleanCategory;
    if (!existing) onAddCategory(nextCategory);
    setCategory(nextCategory);
    setNewCategory('');
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.82 });
    if (!result.canceled) setPhotoUri(result.assets[0]?.uri ?? '');
  };

  const calculateMacros = async () => {
    setNutritionLoading(true);
    const locallyMatched = ingredients.map((ingredient) => {
      const saved = savedIngredients.find((item) => (ingredient.barcode && item.barcode === ingredient.barcode) || normalizeSearch(item.name) === normalizeSearch(ingredient.name) || (ingredient.nameNl && normalizeSearch(item.nameNl ?? item.name) === normalizeSearch(ingredient.nameNl)));
      return saved ? { ...ingredient, nutritionPer100: saved.nutritionPer100, nutritionSource: 'maugainz' as const, barcode: ingredient.barcode ?? saved.barcode, brand: ingredient.brand ?? saved.brand } : ingredient;
    });
    setIngredients(locallyMatched);
    const calculated = estimateRecipeMacros(locallyMatched, Math.max(1, numberValue(servings)));
    setMacroInput(Object.fromEntries(Object.entries(calculated).map(([key, value]) => [key, String(value)])) as typeof macroInput);
    setNutritionLoading(false);
  };

  const applyImport = (recipe: ImportedRecipe) => {
    setTitle(recipe.title || title);
    if (recipe.subtitle) setSubtitle(recipe.subtitle);
    const importedServings = Math.max(1, recipe.servings ?? numberValue(servings));
    if (recipe.servings) setServings(String(importedServings));
    if (recipe.prepTime) setPrepTime(String(recipe.prepTime));
    if (recipe.ingredients.length) {
      setIngredients(recipe.ingredients);
      amountAnchors.current = Object.fromEntries(recipe.ingredients.map((item) => [item.id, { amount: numberValue(item.amount), servings: importedServings }]));
    }
    if (recipe.steps.length) { setSteps(recipe.steps); setStepTimers(recipe.steps.map(() => 0)); }
    if (recipe.macros) setMacroInput(Object.fromEntries(Object.entries(recipe.macros).map(([key, value]) => [key, String(value)])) as typeof macroInput);
    if (recipe.photoUri) setPhotoUri(recipe.photoUri);
  };

  const submit = () => {
    const cleanIngredients = ingredients.filter((item) => item.name.trim() && item.amount.trim());
    const cleanSteps = steps.map((step) => step.trim()).filter(Boolean);
    if (!title.trim()) return Alert.alert(t(locale, 'Give it a name', 'Geef het een naam'), t(locale, 'Add a name for your recipe before saving.', 'Voeg een naam toe voordat je het recept opslaat.'));
    if (!cleanIngredients.length) return Alert.alert(t(locale, 'Add your fuel', 'Voeg je brandstof toe'), t(locale, 'Add at least one ingredient and amount.', 'Voeg minstens één ingrediënt en hoeveelheid toe.'));
    if (!cleanSteps.length) return Alert.alert(t(locale, 'Add the method', 'Voeg de bereiding toe'), t(locale, 'Add at least one preparation step.', 'Voeg minstens één bereidingsstap toe.'));

    const recipe: Recipe = {
      id: initialRecipe?.id ?? `recipe-${Date.now()}`,
      title: title.trim(),
      subtitle: subtitle.trim() || 'Built for your goals',
      category,
      prepTime: Math.max(1, numberValue(prepTime)),
      servings: Math.max(1, numberValue(servings)),
      ingredients: cleanIngredients,
      steps: cleanSteps,
      macros: {
        calories: numberValue(macroInput.calories),
        protein: numberValue(macroInput.protein),
        carbs: numberValue(macroInput.carbs),
        fat: numberValue(macroInput.fat),
        fiber: numberValue(macroInput.fiber)
      },
      accent: categoryStyles.find((item) => item.name === category)?.color ?? accentForCategory(category),
      icon: categoryStyles.find((item) => item.name === category)?.icon ?? (category === 'Breakfast' ? 'sunny-outline' : category === 'High calorie' ? 'flame-outline' : 'nutrition-outline'),
      favorite: initialRecipe?.favorite ?? false,
      createdAt: initialRecipe?.createdAt ?? Date.now(),
      photoUri: photoUri || undefined,
      dietaryTags,
      allergens,
      stepTimers: cleanSteps.map((_, index) => stepTimers[index] ?? 0)
    };
    onSave(recipe);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView ref={builderScrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets stickyHeaderIndices={landscape ? [0] : undefined} contentContainerStyle={[styles.builderContent, tablet && styles.tabletBuilderContent, keyboardVisible && styles.builderContentKeyboardOpen]}>
        <View style={landscape ? styles.builderStickyHeader : undefined}>
        <Header
          eyebrow={initialRecipe ? t(locale, 'EDIT PERFORMANCE RECIPE', 'PERFORMANCERECEPT BEWERKEN') : t(locale, 'NEW PERFORMANCE RECIPE', 'NIEUW PERFORMANCERECEPT')}
          title={initialRecipe ? t(locale, 'Refine your fuel', 'Verfijn je brandstof') : t(locale, 'Build your fuel', 'Bouw je brandstof')}
          action={<View style={styles.headerActions}>{landscape && <Pressable onPress={submit} style={styles.headerSave}><Text style={styles.headerSaveText}>{initialRecipe ? t(locale, 'SAVE CHANGES', 'OPSLAAN') : t(locale, 'SAVE RECIPE', 'RECEPT OPSLAAN')}</Text>{icon('checkmark', 18, colors.black)}</Pressable>}<Pressable onPress={onCancel} style={styles.closeButton}>{icon('close', 23, colors.cream)}</Pressable></View>}
        />
        <Pressable onPress={() => setImportVisible(true)} style={styles.importRecipeButton}>
          {icon('sparkles', 18, colors.lime)}
          <View style={styles.importRecipeBody}><Text style={styles.importRecipeTitle}>{t(locale, 'IMPORT RECIPE', 'RECEPT IMPORTEREN')}</Text><Text style={styles.importRecipeSub}>{t(locale, 'Website, photo or pasted text', 'Website, foto of geplakte tekst')}</Text></View>
          {icon('arrow-forward', 18, colors.muted)}
        </Pressable>
        </View>

        <View style={landscape ? styles.builderLandscapeGrid : undefined}>
        <View style={[landscape && styles.builderLandscapePanel, wideLandscape && styles.builderLandscapePanelWide]}>
        <View style={styles.formSection}>
          <View style={styles.formNumber}><Text style={styles.formNumberText}>01</Text></View>
          <View style={styles.formTitleBody}><Text style={styles.formTitle}>{t(locale, 'The basics', 'De basis')}</Text>{collapsed.basics && <Text style={styles.collapseSummary}>{title.trim() || t(locale, 'Recipe details', 'Receptgegevens')}</Text>}</View>
          <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'Collapse basics', 'Basis inklappen')} onPress={() => toggleSection('basics')} hitSlop={8} style={styles.collapseButton}>{icon(collapsed.basics ? 'chevron-down' : 'chevron-up', 18, colors.lime)}</Pressable>
        </View>
        {!collapsed.basics && <>
        <FieldLabel>{t(locale, 'RECIPE NAME', 'NAAM RECEPT')}</FieldLabel>
        <TextInput value={title} onChangeText={setTitle} placeholder={t(locale, 'e.g. Monster chicken wrap', 'bv. Monster kipwrap')} placeholderTextColor={colors.muted} style={styles.input} />
        <FieldLabel optional locale={locale}>{t(locale, 'SHORT DESCRIPTION', 'KORTE BESCHRIJVING')}</FieldLabel>
        <TextInput value={subtitle} onChangeText={setSubtitle} placeholder={t(locale, 'What makes it great?', 'Wat maakt dit recept geweldig?')} placeholderTextColor={colors.muted} style={styles.input} />
        <Pressable onPress={pickPhoto} style={styles.photoPicker}>
          {photoUri ? <Image source={{ uri: photoUri }} resizeMode="cover" style={styles.photoPreview} /> : <View style={styles.photoPlaceholder}>{icon('camera-outline', 26, colors.lime)}<Text style={styles.photoPickerText}>{t(locale, 'Add a recipe photo', 'Voeg een receptfoto toe')}</Text></View>}
          {photoUri && <View style={styles.photoEditBadge}>{icon('camera', 16, colors.black)}</View>}
        </Pressable>
        <FieldLabel>{t(locale, 'CATEGORY', 'CATEGORIE')}</FieldLabel>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryChipScroller} contentContainerStyle={styles.chipRowForm}>
          {categoryOptions.slice(1).map((item) => <Pill key={item} label={categoryLabel(item, locale)} active={category === item} onPress={() => setCategory(item)} />)}
        </ScrollView>
        <View style={styles.customCategoryRow}>
          <TextInput
            value={newCategory}
            onChangeText={setNewCategory}
            onSubmitEditing={addCustomCategory}
            placeholder={t(locale, 'New custom category', 'Nieuwe eigen categorie')}
            placeholderTextColor={colors.muted}
            returnKeyType="done"
            style={styles.customCategoryInput}
          />
          <Pressable onPress={addCustomCategory} disabled={!newCategory.trim()} style={({ pressed }) => [styles.customCategoryButton, !newCategory.trim() && styles.disabledButton, pressed && styles.pressed]}>
            {icon('add', 20, colors.black)}
            <Text style={styles.customCategoryButtonText}>{t(locale, 'ADD', 'TOEVOEGEN')}</Text>
          </Pressable>
        </View>
        <View style={styles.doubleField}>
          <View style={styles.halfField}><FieldLabel>{t(locale, 'PREP TIME', 'BEREIDINGSTIJD')}</FieldLabel><View style={styles.inputWithSuffix}><TextInput value={prepTime} onChangeText={setPrepTime} keyboardType="number-pad" style={styles.numberInput} /><Text style={styles.inputSuffix}>min</Text></View></View>
          <View style={styles.halfField}><FieldLabel>{t(locale, 'SERVINGS', 'PORTIES')}</FieldLabel><View style={styles.servingStepper}><Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'Remove one serving', 'Eén portie verwijderen')} disabled={numberValue(servings) <= 1} onPress={() => changeServings(-1)} style={[styles.portionButton, numberValue(servings) <= 1 && styles.portionButtonDisabled]}>{icon('remove', 21, colors.black)}</Pressable><View style={styles.servingValueBlock}><Text style={styles.portionStepperValue}>{Math.max(1, numberValue(servings))}</Text><Text style={styles.inputSuffix}>{t(locale, 'people', 'personen')}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'Add one serving', 'Eén portie toevoegen')} onPress={() => changeServings(1)} style={styles.portionButton}>{icon('add', 22, colors.black)}</Pressable></View><Text style={styles.portionScaleHint}>{t(locale, 'Ingredient amounts scale automatically', 'Ingrediënten schalen automatisch mee')}</Text></View>
        </View>
        </>}
        </View>

        {!landscape && <View style={styles.divider} />}
        <View style={[landscape && styles.builderLandscapePanel, wideLandscape && styles.builderLandscapePanelWide]}>
        <View style={styles.formSection}>
          <View style={styles.formNumber}><Text style={styles.formNumberText}>02</Text></View>
          <View style={styles.formTitleBody}><Text style={styles.formTitle}>{t(locale, 'Ingredients', 'Ingrediënten')}</Text><Text style={styles.formHelp}>{collapsed.ingredients ? `${ingredients.filter((item) => item.name.trim()).length} ${t(locale, 'filled · tap to expand', 'ingevuld · tik om te openen')}` : t(locale, 'Name it. Weigh it. Own it.', 'Benoem het. Weeg het. Maak het.')}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'Collapse ingredients', 'Ingrediënten inklappen')} onPress={() => toggleSection('ingredients')} hitSlop={8} style={styles.collapseButton}>{icon(collapsed.ingredients ? 'chevron-down' : 'chevron-up', 18, colors.lime)}</Pressable>
        </View>
        {!collapsed.ingredients && <>
        <View style={styles.ingredientSearch}>
          {icon('search-outline', 18, colors.muted)}
          <TextInput
            value={ingredientQuery}
            onChangeText={setIngredientQuery}
            placeholder={t(locale, `Search ${ingredientSuggestions.length} ingredients`, `Zoek in ${ingredientSuggestions.length} ingrediënten`)}
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
          />
          {!!ingredientQuery && <Pressable onPress={() => setIngredientQuery('')}>{icon('close-circle', 18, colors.muted)}</Pressable>}
        </View>
        <Pressable onPress={() => setLookupVisible(true)} style={styles.smartIngredientButton}>
          {icon('barcode-outline', 20, colors.black)}<Text style={styles.smartIngredientText}>{t(locale, 'SCAN BARCODE OR SEARCH NUTRITION DATABASE', 'SCAN BARCODE OF ZOEK VOEDINGSDATABASE')}</Text>
        </Pressable>
        <Pressable onPress={() => setLibraryVisible(true)} style={styles.ingredientLibraryButton}>
          {icon('nutrition-outline', 20, colors.lime)}<Text style={styles.ingredientLibraryText}>{t(locale, 'FULL INGREDIENT LIBRARY', 'VOLLEDIGE INGREDIËNTENBIBLIOTHEEK')} · {baseIngredientProfiles.length} + {savedIngredients.length}</Text>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionScroller} contentContainerStyle={styles.suggestionRow}>
          {filteredSuggestions.slice(0, tablet ? 24 : 14).map((item) => (
            <Pressable key={item.en} onPress={() => addSuggested(item)} style={styles.suggestionChip}>
              {icon('add', 14, colors.lime)}<Text style={styles.suggestionText}>{locale === 'nl' ? item.nl : item.en}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {!!recentIngredientNames.length && <Text style={styles.historyHint}>{t(locale, 'Recent and favourite ingredients appear first.', 'Recente en favoriete ingrediënten staan vooraan.')}</Text>}
        {ingredients.map((ingredient, index) => (
          <View key={ingredient.id} style={styles.ingredientEditorBlock}>
            <View style={styles.ingredientEditRow}>
              <DragGrip index={index} total={ingredients.length} onMove={moveIngredient} label={t(locale, `Move ingredient ${index + 1}`, `Verplaats ingrediënt ${index + 1}`)} />
              <View style={styles.ingredientIndex}><Text style={styles.ingredientIndexText}>{index + 1}</Text></View>
              <TextInput
                value={ingredientName(ingredient, locale)}
                onChangeText={(name) => {
                  const changed = normalizeSearch(name) !== normalizeSearch(ingredientName(ingredient, locale));
                  updateIngredient(ingredient.id, locale === 'nl'
                    ? { nameNl: name, name: ingredient.name || name, ...(changed ? { nutritionPer100: undefined, nutritionSource: undefined, barcode: undefined, brand: undefined } : {}) }
                    : { name, ...(changed ? { nutritionPer100: undefined, nutritionSource: undefined, barcode: undefined, brand: undefined } : {}) });
                }}
                onSubmitEditing={() => ingredient.name.trim() && reviewMacros(ingredient)}
                placeholder={t(locale, 'Custom ingredient', 'Eigen ingrediënt')}
                placeholderTextColor={colors.muted}
                style={styles.ingredientNameInput}
              />
              <TextInput
                value={ingredient.amount}
                onChangeText={(amount) => updateIngredient(ingredient.id, { amount })}
                placeholder="0"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                style={styles.ingredientAmountInput}
              />
              <Pressable onPress={() => cycleUnit(ingredient)} style={styles.unitButton}><Text style={styles.unitText}>{unitLabel(ingredient.unit, locale)}</Text></Pressable>
              <Pressable onPress={() => setIngredients((current) => current.filter((item) => item.id !== ingredient.id))} hitSlop={8} style={styles.removeButton}>{icon('close', 17, colors.muted)}</Pressable>
              {!!ingredient.nutritionPer100 && <View style={styles.databaseBadge}>{icon('checkmark', 10, colors.black)}</View>}
            </View>
            {!!ingredient.name.trim() && <Pressable onPress={() => reviewMacros(ingredient)} style={[styles.macroVerifyBar, !!ingredient.nutritionPer100 && styles.macroVerifyBarConfirmed]}>{icon(ingredient.nutritionPer100 ? 'shield-checkmark' : 'search-circle-outline', 17, ingredient.nutritionPer100 ? colors.black : colors.lime)}<Text style={[styles.macroVerifyText, !!ingredient.nutritionPer100 && styles.macroVerifyTextConfirmed]}>{ingredient.nutritionPer100 ? `${t(locale, 'CONFIRMED', 'BEVESTIGD')} · ${ingredient.nutritionPer100.calories} kcal · P ${ingredient.nutritionPer100.protein} · C ${ingredient.nutritionPer100.carbs} · F ${ingredient.nutritionPer100.fat}` : t(locale, 'FIND OR ENTER MACROS', 'MACRO’S ZOEKEN OF INVULLEN')}</Text>{icon('chevron-forward', 16, ingredient.nutritionPer100 ? colors.black : colors.lime)}</Pressable>}
          </View>
        ))}
        <Pressable onPress={() => setIngredients((current) => [...current, newIngredient()])} style={styles.addLineButton}>
          {icon('add-circle-outline', 20, colors.lime)}<Text style={styles.addLineText}>{t(locale, 'Add custom ingredient', 'Eigen ingrediënt toevoegen')}</Text>
        </Pressable>
        </>}
        </View>

        {!landscape && <View style={styles.divider} />}
        <View style={[landscape && styles.builderLandscapePanel, wideLandscape && styles.builderLandscapePanelWide]}>
        <View style={styles.formSection}>
          <View style={styles.formNumber}><Text style={styles.formNumberText}>03</Text></View>
          <View style={styles.formTitleBody}><Text style={styles.formTitle}>{t(locale, 'Preparation', 'Bereiding')}</Text><Text style={styles.formHelp}>{collapsed.preparation ? `${steps.filter(Boolean).length} ${t(locale, 'steps · tap to expand', 'stappen · tik om te openen')}` : t(locale, 'One clear move at a time.', 'Eén duidelijke stap tegelijk.')}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'Collapse preparation', 'Bereiding inklappen')} onPress={() => toggleSection('preparation')} hitSlop={8} style={styles.collapseButton}>{icon(collapsed.preparation ? 'chevron-down' : 'chevron-up', 18, colors.lime)}</Pressable>
        </View>
        {!collapsed.preparation && <>
        {steps.map((step, index) => (
          <View key={index} style={styles.stepEditRow}>
            <DragGrip index={index} total={steps.length} onMove={moveStep} label={t(locale, `Move step ${index + 1}`, `Verplaats stap ${index + 1}`)} />
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{String(index + 1).padStart(2, '0')}</Text></View>
            <TextInput
              value={step}
              onChangeText={(text) => setSteps((current) => current.map((item, itemIndex) => itemIndex === index ? text : item))}
              placeholder={index === 0 ? t(locale, 'What happens first?', 'Wat doe je eerst?') : t(locale, 'Add the next step...', 'Voeg de volgende stap toe...')}
              placeholderTextColor={colors.muted}
              multiline
              style={styles.stepInput}
            />
            <View style={styles.stepTools}>
              <View style={styles.stepTimerInput}><TextInput value={stepTimers[index] ? String(stepTimers[index] / 60) : ''} onChangeText={(value) => setStepTimers((current) => current.map((item, itemIndex) => itemIndex === index ? Math.max(0, numberValue(value) * 60) : item))} placeholder="min" placeholderTextColor={colors.muted} keyboardType="number-pad" style={styles.stepTimerText} />{icon('timer-outline', 15, colors.muted)}</View>
              {steps.length > 1 && <Pressable onPress={() => { setSteps((current) => current.filter((_, itemIndex) => itemIndex !== index)); setStepTimers((current) => current.filter((_, itemIndex) => itemIndex !== index)); }}>{icon('trash-outline', 18, colors.muted)}</Pressable>}
            </View>
          </View>
        ))}
        <Pressable onPress={() => { setSteps((current) => [...current, '']); setStepTimers((current) => [...current, 0]); }} style={styles.addLineButton}>
          {icon('add-circle-outline', 20, colors.lime)}<Text style={styles.addLineText}>{t(locale, 'Add preparation step', 'Bereidingsstap toevoegen')}</Text>
        </Pressable>
        </>}
        </View>

        {!landscape && <View style={styles.divider} />}
        <View style={[landscape && styles.builderLandscapePanel, wideLandscape && styles.builderLandscapePanelWide]}>
        <View style={styles.formSection}>
          <View style={styles.formNumber}><Text style={styles.formNumberText}>04</Text></View>
          <View style={styles.formTitleBody}><Text style={styles.formTitle}>{t(locale, 'Macros', 'Macro’s')}</Text><Text style={styles.formHelp}>{collapsed.macros ? `${macroInput.calories || 0} kcal · ${macroInput.protein || 0}g P` : t(locale, 'Per serving.', 'Per portie.')}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'Collapse macros', 'Macro’s inklappen')} onPress={() => toggleSection('macros')} hitSlop={8} style={styles.collapseButton}>{icon(collapsed.macros ? 'chevron-down' : 'chevron-up', 18, colors.lime)}</Pressable>
        </View>
        {!collapsed.macros && <>
        <View style={styles.tagSection}>
          <FieldLabel>{t(locale, 'DIETARY TAGS', 'DIEETTAGS')}</FieldLabel>
          <View style={styles.tagWrap}>{['High protein', 'Vegetarian', 'Vegan', 'Gluten-free', 'Low carb'].map((tag) => <Pill key={tag} label={t(locale, tag, ({ 'High protein': 'Eiwitrijk', Vegetarian: 'Vegetarisch', Vegan: 'Veganistisch', 'Gluten-free': 'Glutenvrij', 'Low carb': 'Koolhydraatarm' } as Record<string, string>)[tag] ?? tag)} active={dietaryTags.includes(tag)} onPress={() => setDietaryTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])} />)}</View>
          <FieldLabel>{t(locale, 'ALLERGENS', 'ALLERGENEN')}</FieldLabel>
          <View style={styles.tagWrap}>{['Milk', 'Eggs', 'Gluten', 'Peanuts', 'Nuts', 'Soy'].map((tag) => <Pill key={tag} label={t(locale, tag, ({ Milk: 'Melk', Eggs: 'Eieren', Gluten: 'Gluten', Peanuts: 'Pinda’s', Nuts: 'Noten', Soy: 'Soja' } as Record<string, string>)[tag] ?? tag)} active={allergens.includes(tag)} onPress={() => setAllergens((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])} />)}</View>
        </View>
        <View style={styles.autoMacroCard}>
          <View style={styles.autoMacroBody}><Text style={styles.autoMacroTitle}>{t(locale, 'Automatic macro estimate', 'Automatische macroschatting')}</Text><Text style={styles.autoMacroText}>{nutritionCoverage(ingredients)}/{ingredients.filter((item) => item.name.trim()).length || 0} {t(locale, 'ingredients recognised', 'ingrediënten herkend')}</Text></View>
          <Pressable disabled={nutritionLoading} onPress={calculateMacros} style={[styles.autoMacroButton, nutritionLoading && styles.disabledButton]}>{icon(nutritionLoading ? 'cloud-download-outline' : 'calculator-outline', 19, colors.black)}<Text style={styles.autoMacroButtonText}>{nutritionLoading ? t(locale, 'MATCHING…', 'KOPPELEN…') : t(locale, 'CALCULATE', 'BEREKEN')}</Text></Pressable>
        </View>
        <View style={styles.macroInputGrid}>
          {([
            ['calories', 'KCAL', colors.lime],
            ['protein', t(locale, 'PROTEIN (G)', 'EIWIT (G)'), colors.orange],
            ['carbs', t(locale, 'CARBS (G)', 'KOOLHYDRATEN (G)'), colors.blue],
            ['fat', t(locale, 'FAT (G)', 'VET (G)'), colors.blue],
            ['fiber', t(locale, 'FIBER (G)', 'VEZELS (G)'), colors.limeDark]
          ] as [keyof Macros, string, string][]).map(([key, label, accent]) => (
            <View key={key} style={[styles.macroInputWrap, tablet && styles.tabletMacroInputWrap]}>
              <Text style={[styles.fieldLabel, { color: accent }]}>{label}</Text>
              <TextInput
                value={macroInput[key]}
                onChangeText={(value) => setMacroInput((current) => ({ ...current, [key]: value }))}
                placeholder="0"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                style={styles.macroInput}
              />
            </View>
          ))}
        </View>
        </>}
        </View>
        </View>
        {wideLandscape && (
          <View style={styles.builderTabletSummary}>
            <View style={[styles.builderSummaryBlock, styles.builderReadinessBlock]}>
              <View style={styles.builderSummaryHeading}>
                <View><Text style={styles.builderSummaryEyebrow}>{t(locale, 'LIVE OVERVIEW', 'LIVE OVERZICHT')}</Text><Text style={styles.builderSummaryTitle}>{title.trim() || t(locale, 'Your new performance recipe', 'Je nieuwe performancerecept')}</Text></View>
                <Text style={styles.builderCompletionValue}>{completion}%</Text>
              </View>
              <ProgressBar value={completion} target={100} color={colors.lime} />
              <Text style={styles.builderSummaryHint}>{completion === 100 ? t(locale, 'Ready to save and start cooking.', 'Klaar om op te slaan en te koken.') : t(locale, 'Complete the essentials before saving.', 'Vul de belangrijkste onderdelen in voor je opslaat.')}</Text>
            </View>
            <View style={styles.builderSummaryBlock}>
              <Text style={styles.builderSummaryEyebrow}>{t(locale, 'RECIPE AT A GLANCE', 'RECEPT IN ÉÉN OOGOPSLAG')}</Text>
              <View style={styles.builderMetricRow}>
                {[
                  [String(filledIngredientCount), t(locale, 'Ingredients', 'Ingrediënten')],
                  [String(filledStepCount), t(locale, 'Steps', 'Stappen')],
                  [String(Math.max(1, numberValue(servings))), t(locale, 'Servings', 'Porties')],
                  [String(numberValue(macroInput.calories)), 'KCAL']
                ].map(([value, label]) => <View key={label} style={styles.builderMetric}><Text style={styles.builderMetricValue}>{value}</Text><Text style={styles.builderMetricLabel}>{label}</Text></View>)}
              </View>
            </View>
            <View style={[styles.builderSummaryBlock, styles.builderChecklistBlock]}>
              <Text style={styles.builderSummaryEyebrow}>{t(locale, 'COMPLETION CHECK', 'VOLTOOIINGSCHECK')}</Text>
              <View style={styles.builderChecklist}>
                {recipeChecks.map((item) => <View key={item.label} style={styles.builderCheckRow}><View style={[styles.builderCheckIcon, item.done && styles.builderCheckIconDone]}>{icon(item.done ? 'checkmark' : 'ellipse-outline', 14, item.done ? colors.black : colors.muted)}</View><Text style={[styles.builderCheckText, item.done && styles.builderCheckTextDone]}>{item.label}</Text></View>)}
              </View>
            </View>
          </View>
        )}
        {landscape && <Pressable onPress={submit} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
          <Text style={styles.saveButtonText}>{initialRecipe ? t(locale, 'SAVE CHANGES', 'WIJZIGINGEN OPSLAAN') : t(locale, 'SAVE TO COOKBOOK', 'OPSLAAN IN KOOKBOEK')}</Text>{icon('arrow-forward', 21, colors.black)}
        </Pressable>}
      </ScrollView>
      {!landscape && !keyboardVisible && <View style={[styles.builderSaveDock, tablet && styles.builderSaveDockTablet]} pointerEvents="box-none"><Pressable onPress={submit} style={({ pressed }) => [styles.builderDockButton, pressed && styles.pressed]}><Text style={styles.builderDockText}>{initialRecipe ? t(locale, 'SAVE CHANGES', 'WIJZIGINGEN OPSLAAN') : t(locale, 'SAVE RECIPE', 'RECEPT OPSLAAN')}</Text>{icon('checkmark', 20, colors.black)}</Pressable></View>}
      <IngredientLookupModal visible={lookupVisible} locale={locale} onClose={() => setLookupVisible(false)} onSelect={addIngredient} />
      <IngredientMacroReviewModal visible={!!macroIngredient} locale={locale} ingredient={macroIngredient} onClose={() => setMacroIngredient(null)} onConfirm={confirmIngredientMacros} />
      <IngredientLibraryModal visible={libraryVisible} locale={locale} ingredients={savedIngredients} onChange={onSavedIngredients} onSelect={addIngredient} onClose={() => setLibraryVisible(false)} />
      <RecipeImportModal visible={importVisible} locale={locale} onClose={() => setImportVisible(false)} onImport={applyImport} />
    </KeyboardAvoidingView>
  );
}

function ProgressBar({ value, target, color }: { value: number; target: number; color: string }) {
  const percentage = Math.min(100, target ? (value / target) * 100 : 0);
  return <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: color }]} /></View>;
}

function MacrosScreen({ recipes, locale, tablet, goals, onOpen, onSettings }: { recipes: Recipe[]; locale: Locale; tablet: boolean; goals: UserGoals; onOpen: (recipe: Recipe) => void; onSettings: () => void }) {
  const averages = recipes.length ? recipes.reduce((sum, recipe) => ({
    calories: sum.calories + recipe.macros.calories / recipes.length,
    protein: sum.protein + recipe.macros.protein / recipes.length,
    carbs: sum.carbs + recipe.macros.carbs / recipes.length,
    fat: sum.fat + recipe.macros.fat / recipes.length
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 }) : { calories: 0, protein: 0, carbs: 0, fat: 0 };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.screenContent, tablet && styles.tabletScreenContent]}>
      <Header eyebrow={t(locale, 'KNOW YOUR NUMBERS', 'KEN JE CIJFERS')} title={t(locale, 'Macro lab', 'Macrolab')} action={<Pressable onPress={onSettings} style={styles.labIcon}>{icon('settings-outline', 22, colors.lime)}</Pressable>} />
      <View style={tablet ? styles.tabletMetricsGrid : undefined}>
        <View style={[styles.goalCard, tablet && styles.tabletMetricColumn]}>
          <View style={styles.goalHeader}><View><Text style={styles.goalEyebrow}>{t(locale, 'DAILY TARGET', 'DAGELIJKS DOEL')}</Text><Text style={styles.goalTitle}>{t(locale, 'Built for your goal', 'Gebouwd voor je doel')}</Text></View><Text style={styles.goalKcal}>{goals.calories}<Text style={styles.goalKcalUnit}> kcal</Text></Text></View>
          {[
            [t(locale, 'Protein', 'Eiwit'), goals.protein, 'g', colors.lime],
            [t(locale, 'Carbohydrates', 'Koolhydraten'), goals.carbs, 'g', colors.blue],
            [t(locale, 'Fats', 'Vetten'), goals.fat, 'g', colors.orange]
          ].map(([label, target, unit, color]) => (
            <View key={String(label)} style={styles.goalRow}>
              <View style={styles.goalLabelRow}><Text style={styles.goalLabel}>{label}</Text><Text style={styles.goalValue}>{target}{unit}</Text></View>
              <ProgressBar value={Number(target) * 0.68} target={Number(target)} color={String(color)} />
            </View>
          ))}
          <Text style={styles.goalHint}>{t(locale, 'Targets are tuned for a high-protein training day.', 'Doelen zijn afgestemd op een eiwitrijke trainingsdag.')}</Text>
        </View>

        <View style={tablet ? styles.tabletMetricColumn : undefined}>
          <View style={[styles.sectionHeading, tablet && styles.tabletMetricHeading]}>
            <View><Text style={styles.sectionEyebrow}>{t(locale, 'COOKBOOK AVERAGE', 'GEMIDDELDE KOOKBOEK')}</Text><Text style={styles.sectionTitle}>{t(locale, 'Per serving', 'Per portie')}</Text></View>
          </View>
          <View style={styles.averageGrid}>
            <View style={styles.averageMain}><Text style={styles.averageValue}>{Math.round(averages.calories)}</Text><Text style={styles.averageLabel}>{t(locale, 'AVG KCAL', 'GEM. KCAL')}</Text></View>
            <View style={styles.averageMini}><Text style={[styles.averageMiniValue, { color: colors.lime }]}>{Math.round(averages.protein)}g</Text><Text style={styles.averageLabel}>{t(locale, 'PROTEIN', 'EIWIT')}</Text></View>
            <View style={styles.averageMini}><Text style={[styles.averageMiniValue, { color: colors.blue }]}>{Math.round(averages.carbs)}g</Text><Text style={styles.averageLabel}>{t(locale, 'CARBS', 'KOOLHYDRATEN')}</Text></View>
            <View style={styles.averageMini}><Text style={[styles.averageMiniValue, { color: colors.orange }]}>{Math.round(averages.fat)}g</Text><Text style={styles.averageLabel}>{t(locale, 'FATS', 'VETTEN')}</Text></View>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeading}><View><Text style={styles.sectionEyebrow}>{t(locale, 'COMPARE YOUR FUEL', 'VERGELIJK JE BRANDSTOF')}</Text><Text style={styles.sectionTitle}>{t(locale, 'Recipe breakdown', 'Receptoverzicht')}</Text></View></View>
      {recipes.map((recipe) => (
        <Pressable key={recipe.id} onPress={() => onOpen(recipe)} style={styles.macroRecipeRow}>
          <View style={[styles.macroRecipeIcon, { backgroundColor: `${recipe.accent}25` }]}>{icon(recipe.icon, 21, recipe.accent)}</View>
          <View style={styles.macroRecipeBody}><Text style={styles.macroRecipeTitle} numberOfLines={1}>{recipeTitle(recipe, locale)}</Text><Text style={styles.macroRecipeMeta}>{recipe.macros.protein}P · {recipe.macros.carbs}C · {recipe.macros.fat}F</Text></View>
          <Text style={styles.macroRecipeKcal}>{recipe.macros.calories}</Text>
          {icon('chevron-forward', 17, colors.muted)}
        </Pressable>
      ))}
    </ScrollView>
  );
}

function RecipeDetail({ recipe, visible, locale, tablet, unitSystem, onClose, onFavorite, onDelete, onEdit, onDuplicate, onShare, onCook, onAddShopping }: {
  recipe: Recipe | null;
  visible: boolean;
  locale: Locale;
  tablet: boolean;
  unitSystem: UnitSystem;
  onClose: () => void;
  onFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (recipe: Recipe) => void;
  onDuplicate: (recipe: Recipe) => void;
  onShare: (recipe: Recipe) => void;
  onCook: (recipe: Recipe) => void;
  onAddShopping: (recipe: Recipe) => void;
}) {
  const [servings, setServings] = useState(1);
  const [checkedIngredients, setCheckedIngredients] = useState<string[]>([]);
  const [checkedSteps, setCheckedSteps] = useState<number[]>([]);

  useEffect(() => {
    if (recipe) {
      setServings(recipe.servings);
      setCheckedIngredients([]);
      setCheckedSteps([]);
    }
  }, [recipe?.id]);

  if (!recipe) return null;
  const localizedSteps = recipeSteps(recipe, locale);
  const scale = servings / recipe.servings;
  const scaleAmount = (amount: string) => {
    const numeric = Number(amount.replace(',', '.'));
    if (Number.isNaN(numeric)) return amount;
    const result = numeric * scale;
    return Number.isInteger(result) ? String(result) : result.toFixed(1);
  };
  const displayQuantity = (ingredient: Ingredient) => {
    const scaled = Number(scaleAmount(ingredient.amount).replace(',', '.'));
    if (Number.isNaN(scaled) || unitSystem === 'metric') return `${scaleAmount(ingredient.amount)} ${unitLabel(ingredient.unit, locale)}`;
    if (ingredient.unit === 'g') return `${(scaled / 28.3495).toFixed(1)} oz`;
    if (ingredient.unit === 'ml') return `${(scaled / 29.5735).toFixed(1)} fl oz`;
    return `${scaleAmount(ingredient.amount)} ${unitLabel(ingredient.unit, locale)}`;
  };

  const deleteRecipe = () => Alert.alert(t(locale, 'Delete recipe?', 'Recept verwijderen?'), t(locale, `${recipeTitle(recipe, locale)} will be removed from your cookbook.`, `${recipeTitle(recipe, locale)} wordt uit je kookboek verwijderd.`), [
    { text: t(locale, 'Keep it', 'Behouden'), style: 'cancel' },
    { text: t(locale, 'Delete', 'Verwijderen'), style: 'destructive', onPress: () => onDelete(recipe.id) }
  ]);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <SafeAreaView style={styles.detailSafe}>
        <ExpoStatusBar style="light" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.detailContent, tablet && styles.tabletDetailContent]}>
          <View style={styles.detailTopBar}>
            <Pressable onPress={onClose} style={styles.detailTopButton}>{icon('arrow-back', 22, colors.cream)}</Pressable>
            <View style={styles.detailTopActions}>
              <Pressable onPress={() => onFavorite(recipe.id)} style={styles.detailTopButton}>{icon(recipe.favorite ? 'heart' : 'heart-outline', 21, recipe.favorite ? recipe.accent : colors.cream)}</Pressable>
              <Pressable onPress={deleteRecipe} style={styles.detailTopButton}>{icon('trash-outline', 20, colors.muted)}</Pressable>
            </View>
          </View>
          <View style={tablet ? styles.tabletDetailSummary : undefined}>
            <LinearGradient colors={[`${recipe.accent}36`, colors.panel]} style={[styles.detailHero, tablet && styles.tabletDetailHero]}>
              {recipe.photoUri && <Image source={{ uri: recipe.photoUri }} resizeMode="cover" style={styles.detailHeroPhoto} />}
              <View style={[styles.detailHeroIcon, { borderColor: recipe.accent }]}>{icon(recipe.icon, 44, recipe.accent)}</View>
              <Text style={[styles.detailCategory, { color: recipe.accent }]}>{categoryLabel(recipe.category, locale).toUpperCase()}</Text>
              <Text style={styles.detailTitle}>{recipeTitle(recipe, locale)}</Text>
              <Text style={styles.detailSubtitle}>{recipeSubtitle(recipe, locale)}</Text>
              <View style={styles.detailMeta}>
                <View style={styles.detailMetaItem}>{icon('time-outline', 18, colors.cream)}<Text style={styles.detailMetaText}>{recipe.prepTime} min</Text></View>
                <View style={styles.detailMetaItem}>{icon('restaurant-outline', 18, colors.cream)}<Text style={styles.detailMetaText}>{recipe.ingredients.length} {t(locale, 'ingredients', 'ingrediënten')}</Text></View>
              </View>
              {!!(recipe.dietaryTags?.length || recipe.allergens?.length) && <View style={styles.detailTagRow}>{recipe.dietaryTags?.map((tag) => <View key={tag} style={styles.detailTag}><Text style={styles.detailTagText}>{tag}</Text></View>)}{recipe.allergens?.map((tag) => <View key={tag} style={styles.allergenTag}><Text style={styles.allergenTagText}>{tag}</Text></View>)}</View>}
            </LinearGradient>

            <View style={[styles.detailMacroStrip, tablet && styles.tabletDetailMacroStrip]}>
              <MacroBadge value={recipe.macros.calories} label="KCAL" accent={recipe.accent} />
              <MacroBadge value={recipe.macros.protein} label={t(locale, 'PROTEIN', 'EIWIT')} />
              <MacroBadge value={recipe.macros.carbs} label={t(locale, 'CARBS', 'KOOLHYDRATEN')} accent={colors.blue} />
              <MacroBadge value={recipe.macros.fat} label={t(locale, 'FATS', 'VETTEN')} accent={colors.orange} />
            </View>
          </View>

          <View style={styles.detailActionRow}>
            <Pressable onPress={() => onCook(recipe)} style={[styles.detailAction, styles.detailActionPrimary]}>{icon('play', 18, colors.black)}<Text style={styles.detailActionPrimaryText}>{t(locale, 'COOK', 'KOKEN')}</Text></Pressable>
            <Pressable onPress={() => onEdit(recipe)} style={styles.detailAction}>{icon('create-outline', 18, colors.cream)}<Text style={styles.detailActionText}>{t(locale, 'Edit', 'Bewerk')}</Text></Pressable>
            <Pressable onPress={() => onDuplicate(recipe)} style={styles.detailAction}>{icon('copy-outline', 18, colors.cream)}<Text style={styles.detailActionText}>{t(locale, 'Copy', 'Kopie')}</Text></Pressable>
            <Pressable onPress={() => onShare(recipe)} style={styles.detailAction}>{icon('share-outline', 18, colors.cream)}<Text style={styles.detailActionText}>{t(locale, 'Share', 'Deel')}</Text></Pressable>
            <Pressable onPress={() => onAddShopping(recipe)} style={styles.detailAction}>{icon('cart-outline', 18, colors.cream)}<Text style={styles.detailActionText}>{t(locale, 'Shop', 'Lijst')}</Text></Pressable>
          </View>

          <View style={tablet ? styles.tabletDetailColumns : undefined}>
            <View style={tablet ? styles.tabletDetailColumn : undefined}>
              <View style={styles.detailSectionHeader}>
                <View><Text style={styles.sectionEyebrow}>{t(locale, 'WHAT YOU NEED', 'WAT JE NODIG HEBT')}</Text><Text style={styles.detailSectionTitle}>{t(locale, 'Ingredients', 'Ingrediënten')}</Text></View>
                <View style={styles.servingControl}>
                  <Pressable onPress={() => setServings((value) => Math.max(1, value - 1))} style={styles.servingButton}>{icon('remove', 17, colors.cream)}</Pressable>
                  <View style={styles.servingCount}><Text style={styles.servingValue}>{servings}</Text><Text style={styles.servingLabel}>{t(locale, 'SERVINGS', 'PORTIES')}</Text></View>
                  <Pressable onPress={() => setServings((value) => value + 1)} style={styles.servingButton}>{icon('add', 17, colors.cream)}</Pressable>
                </View>
              </View>
              {recipe.ingredients.map((ingredient) => {
                const checked = checkedIngredients.includes(ingredient.id);
                return (
                  <Pressable key={ingredient.id} onPress={() => setCheckedIngredients((current) => checked ? current.filter((id) => id !== ingredient.id) : [...current, ingredient.id])} style={styles.detailIngredientRow}>
                    <View style={[styles.checkBox, checked && { backgroundColor: recipe.accent, borderColor: recipe.accent }]}>{checked && icon('checkmark', 15, colors.black)}</View>
                    <Text style={[styles.detailIngredientName, checked && styles.checkedText]}>{ingredientName(ingredient, locale)}</Text>
                    <Text style={[styles.detailIngredientAmount, checked && styles.checkedText]}>{displayQuantity(ingredient)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={tablet ? styles.tabletDetailColumn : undefined}>
              <View style={styles.detailSectionHeader}>
                <View><Text style={styles.sectionEyebrow}>{t(locale, 'LOCK IN', 'FOCUS')}</Text><Text style={styles.detailSectionTitle}>{t(locale, 'Preparation', 'Bereiding')}</Text></View>
                <Text style={styles.stepCount}>{checkedSteps.length}/{localizedSteps.length} {t(locale, 'DONE', 'KLAAR')}</Text>
              </View>
              {localizedSteps.map((step, index) => {
                const checked = checkedSteps.includes(index);
                return (
                  <Pressable key={index} onPress={() => setCheckedSteps((current) => checked ? current.filter((value) => value !== index) : [...current, index])} style={[styles.detailStep, checked && styles.detailStepChecked]}>
                    <View style={[styles.detailStepNumber, checked && { backgroundColor: recipe.accent, borderColor: recipe.accent }]}>
                      {checked ? icon('checkmark', 17, colors.black) : <Text style={styles.detailStepNumberText}>{String(index + 1).padStart(2, '0')}</Text>}
                    </View>
                    <Text style={[styles.detailStepText, checked && styles.checkedText]}>{step}</Text>
                  </Pressable>
                );
              })}
              <View style={styles.detailDoneCard}>
                {icon('trophy-outline', 28, recipe.accent)}
                <View style={styles.detailDoneBody}><Text style={styles.detailDoneTitle}>{t(locale, 'Meal prep. Then rep.', 'Mealprep. Dan je reps.')}</Text><Text style={styles.detailDoneText}>{t(locale, 'Consistency is the secret ingredient.', 'Consistentie is het geheime ingrediënt.')}</Text></View>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function BottomNav({ active, locale, tablet, compact = false, onChange, onToggleLocale }: { active: TabName; locale: Locale; tablet: boolean; compact?: boolean; onChange: (tab: TabName) => void; onToggleLocale: () => void }) {
  const tabs: { name: TabName; label: string; icon: string; activeIcon: string }[] = [
    { name: 'home', label: t(locale, 'Home', 'Home'), icon: 'home-outline', activeIcon: 'home' },
    { name: 'recipes', label: t(locale, 'Recipes', 'Recepten'), icon: 'book-outline', activeIcon: 'book' },
    { name: 'diary', label: t(locale, 'Diary', 'Dagboek'), icon: 'journal-outline', activeIcon: 'journal' },
    { name: 'create', label: t(locale, 'Create', 'Maken'), icon: 'add', activeIcon: 'add' },
    { name: 'planner', label: t(locale, 'Plan', 'Plan'), icon: 'calendar-outline', activeIcon: 'calendar' },
    { name: 'macros', label: t(locale, 'Macros', 'Macro’s'), icon: 'analytics-outline', activeIcon: 'analytics' },
    { name: 'friends', label: t(locale, 'Friends', 'Vrienden'), icon: 'people-outline', activeIcon: 'people' }
  ];
  return (
    <View style={[tablet ? styles.tabletNavRail : styles.bottomNav, compact && styles.compactBottomNav]}>
      {tablet && <View style={styles.tabletNavBrand}><Image source={brandLogo} resizeMode="contain" style={styles.tabletNavBrandImage} /></View>}
      {tabs.map((tab) => {
        const isActive = active === tab.name;
        const isCreate = tab.name === 'create';
        return (
          <Pressable key={tab.name} onPress={() => onChange(tab.name)} style={[styles.navItem, tablet && styles.tabletNavItem, tablet && isActive && styles.tabletNavItemActive]}>
            <View style={[styles.navIconWrap, isCreate && styles.createNavButton, compact && isCreate && styles.compactCreateNavButton, isCreate && isActive && styles.createNavButtonActive]}>
              {icon(isActive ? tab.activeIcon : tab.icon, isCreate ? 27 : 22, isCreate ? colors.black : isActive ? colors.lime : colors.muted)}
            </View>
            {(!isCreate || tablet) && <Text style={[styles.navLabel, tablet && styles.tabletNavLabel, isActive && styles.navLabelActive]}>{tab.label}</Text>}
          </Pressable>
        );
      })}
      {tablet && <Pressable onPress={onToggleLocale} style={[styles.navItem, styles.tabletNavItem]} accessibilityLabel={t(locale, 'Switch to Dutch', 'Naar Engels wisselen')}>
        <View style={styles.languageNavButton}>{icon('language-outline', 21, colors.blue)}</View>
        <Text style={styles.languageNavLabel}>{locale === 'en' ? 'NL' : 'EN'}</Text>
      </Pressable>}
    </View>
  );
}

function MauGainzApp() {
  const { width, height } = useWindowDimensions();
  const tablet = Math.min(width, height) >= 600;
  const screenLandscape = width > height;
  const compactLandscape = screenLandscape && !tablet;
  const landscape = tablet && screenLandscape;
  const wideLandscape = landscape && width >= 1500;
  const [recipes, setRecipes] = useState<Recipe[]>(starterRecipes);
  const [customCategories, setCustomCategories] = useState<CategoryOption[]>([]);
  const [locale, setLocale] = useState<Locale>('en');
  const [activeTab, setActiveTab] = useState<TabName>('home');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [cookingRecipe, setCookingRecipe] = useState<Recipe | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [goals, setGoals] = useState<UserGoals>({ weightKg: 85, goal: 'gain', calories: 3060, protein: 170, carbs: 394, fat: 77 });
  const [plans, setPlans] = useState<MealPlanEntry[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<FoodDiaryEntry[]>([]);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [recentIngredientNames, setRecentIngredientNames] = useState<string[]>([]);
  const [backupText, setBackupText] = useState('');
  const [syncCode, setSyncCode] = useState(createSyncCode);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | undefined>();
  const [hydrated, setHydrated] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<AppUpdate | null>(null);
  const [dailyTargets, setDailyTargets] = useState<DailyMacroTarget[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [vitamins, setVitamins] = useState<VitaminEntry[]>([]);
  const [savedIngredients, setSavedIngredients] = useState<SavedIngredient[]>([]);
  const [trainingDays, setTrainingDays] = useState<TrainingDay[]>([]);
  const [accountUser, setAccountUser] = useState<AccountUser | null>(null);
  const [accountReady, setAccountReady] = useState(false);
  const [accountSyncState, setAccountSyncState] = useState<'offline' | 'syncing' | 'synced' | 'error'>('offline');

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(LOCALE_KEY), AsyncStorage.getItem(CATEGORY_KEY),
      AsyncStorage.getItem(GOALS_KEY), AsyncStorage.getItem(PLAN_KEY), AsyncStorage.getItem(SHOPPING_KEY),
      AsyncStorage.getItem(PREFERENCES_KEY), AsyncStorage.getItem(INGREDIENT_HISTORY_KEY), AsyncStorage.getItem(CLOUD_SYNC_KEY), AsyncStorage.getItem(ALL_AROUND_KEY), AsyncStorage.getItem(DIARY_KEY)
    ]).then(([storedRecipes, storedLocale, storedCategories, storedGoals, storedPlans, storedShopping, storedPreferences, storedHistory, storedCloud, storedAllAround, storedDiary]) => {
      if (storedRecipes) setRecipes(JSON.parse(storedRecipes) as Recipe[]);
      if (storedLocale === 'en' || storedLocale === 'nl') setLocale(storedLocale);
      if (storedCategories) {
        const parsed = JSON.parse(storedCategories) as (string | CategoryOption)[];
        setCustomCategories(parsed.map((item) => typeof item === 'string' ? { name: item, color: colors.lime, icon: 'nutrition-outline' } : item));
      }
      if (storedGoals) setGoals(JSON.parse(storedGoals) as UserGoals);
      if (storedPlans) setPlans(JSON.parse(storedPlans) as MealPlanEntry[]);
      if (storedShopping) setShopping(JSON.parse(storedShopping) as ShoppingItem[]);
      if (storedPreferences) setUnitSystem((JSON.parse(storedPreferences) as { unitSystem?: UnitSystem }).unitSystem ?? 'metric');
      if (storedHistory) setRecentIngredientNames(JSON.parse(storedHistory) as string[]);
      if (storedCloud) { const cloud = JSON.parse(storedCloud) as { syncCode?: string; lastSyncedAt?: number }; if (cloud.syncCode) setSyncCode(cloud.syncCode); setLastSyncedAt(cloud.lastSyncedAt); }
      if (storedAllAround) { const data = JSON.parse(storedAllAround) as { dailyTargets?: DailyMacroTarget[]; weights?: WeightEntry[]; vitamins?: VitaminEntry[]; savedIngredients?: SavedIngredient[]; trainingDays?: TrainingDay[] }; setDailyTargets(data.dailyTargets ?? []); setWeights(data.weights ?? []); setVitamins(data.vitamins ?? []); setSavedIngredients((data.savedIngredients ?? []).map((item) => ({ ...item, baseUnit: item.baseUnit ?? 'g' }))); setTrainingDays(data.trainingDays ?? []); }
      if (storedDiary) setDiaryEntries(JSON.parse(storedDiary) as FoodDiaryEntry[]);
    }).catch(() => undefined).finally(() => setHydrated(true));
  }, []);

  useEffect(() => { if (hydrated) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(recipes)).catch(() => undefined); }, [recipes, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(LOCALE_KEY, locale).catch(() => undefined); }, [locale, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(CATEGORY_KEY, JSON.stringify(customCategories)).catch(() => undefined); }, [customCategories, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goals)).catch(() => undefined); }, [goals, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(PLAN_KEY, JSON.stringify(plans)).catch(() => undefined); }, [plans, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(SHOPPING_KEY, JSON.stringify(shopping)).catch(() => undefined); }, [shopping, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify({ unitSystem })).catch(() => undefined); }, [unitSystem, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(INGREDIENT_HISTORY_KEY, JSON.stringify(recentIngredientNames)).catch(() => undefined); }, [recentIngredientNames, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(CLOUD_SYNC_KEY, JSON.stringify({ syncCode, lastSyncedAt })).catch(() => undefined); }, [syncCode, lastSyncedAt, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(ALL_AROUND_KEY, JSON.stringify({ dailyTargets, weights, vitamins, savedIngredients, trainingDays })).catch(() => undefined); }, [dailyTargets, weights, vitamins, savedIngredients, trainingDays, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(DIARY_KEY, JSON.stringify(diaryEntries)).catch(() => undefined); }, [diaryEntries, hydrated]);

  useEffect(() => {
    if (!hydrated || Platform.OS !== 'android') return;
    let active = true;
    checkForAppUpdate().then((update) => { if (active && update) setAvailableUpdate(update); });
    return () => { active = false; };
  }, [hydrated]);

  const builtInCategoryStyles: CategoryOption[] = categories.slice(1).map((name) => ({
    name, color: accentForCategory(name), icon: name === 'Breakfast' ? 'sunny-outline' : name === 'High calorie' ? 'flame-outline' : name === 'Quick meal' ? 'flash-outline' : 'nutrition-outline'
  }));
  const categoryStyles = [...builtInCategoryStyles, ...customCategories];
  const categoryOptions = useMemo(() => {
    const recipeCategories = recipes.map((recipe) => recipe.category).filter((category) => !categories.includes(category));
    return [...categories, ...customCategories.map((item) => item.name), ...recipeCategories].filter((category, index, all) => all.findIndex((item) => normalizeSearch(item) === normalizeSearch(category)) === index);
  }, [recipes, customCategories]);

  const selectedLive = useMemo(() => selectedRecipe ? recipes.find((recipe) => recipe.id === selectedRecipe.id) ?? null : null, [selectedRecipe, recipes]);
  const toggleFavorite = (id: string) => setRecipes((current) => current.map((recipe) => recipe.id === id ? { ...recipe, favorite: !recipe.favorite } : recipe));
  const openCreate = () => { setEditingRecipe(null); setActiveTab('create'); };
  const saveRecipe = (recipe: Recipe) => {
    setRecipes((current) => current.some((item) => item.id === recipe.id) ? current.map((item) => item.id === recipe.id ? { ...recipe, favorite: item.favorite } : item) : [recipe, ...current]);
    setEditingRecipe(null); setActiveTab('recipes'); setSelectedRecipe(recipe);
  };
  const deleteRecipe = (id: string) => { setRecipes((current) => current.filter((recipe) => recipe.id !== id)); setSelectedRecipe(null); };
  const editRecipe = (recipe: Recipe) => { setEditingRecipe(recipe); setSelectedRecipe(null); setActiveTab('create'); };
  const duplicateRecipe = (recipe: Recipe) => {
    const copy = { ...recipe, id: `recipe-${Date.now()}`, title: `${recipe.title} ${t(locale, 'copy', 'kopie')}`, favorite: false, createdAt: Date.now(), ingredients: recipe.ingredients.map((item) => ({ ...item, id: `${item.id}-${Date.now()}` })) };
    setRecipes((current) => [copy, ...current]); setSelectedRecipe(copy);
  };
  const shareRecipe = (recipe: Recipe) => Share.share({ title: recipeTitle(recipe, locale), message: `${recipeTitle(recipe, locale)}\n\n${recipe.ingredients.map((item) => `• ${item.amount} ${unitLabel(item.unit, locale)} ${ingredientName(item, locale)}`).join('\n')}\n\n${recipeSteps(recipe, locale).map((step, index) => `${index + 1}. ${step}`).join('\n')}` }).catch(() => undefined);
  const addRecipeToShopping = (recipe: Recipe) => setShopping((current) => [...current, ...recipe.ingredients.map((item) => ({ id: `${Date.now()}-${item.id}-${Math.random()}`, name: ingredientName(item, locale), amount: item.amount, unit: item.unit, checked: false, recipeId: recipe.id }))]);
  const generateShopping = (date: string) => {
    const recipeIds = plans.filter((entry) => entry.date === date).map((entry) => entry.recipeId);
    const items = recipeIds.flatMap((id) => recipes.find((recipe) => recipe.id === id)?.ingredients.map((item) => ({ id: `${Date.now()}-${id}-${item.id}-${Math.random()}`, name: ingredientName(item, locale), amount: item.amount, unit: item.unit, checked: false, recipeId: id })) ?? []);
    setShopping(items);
  };
  const backupPayload = (): BackupPayload => ({ version: 6, recipes, customCategories, goals, plans, shopping, unitSystem, dailyTargets, weights, vitamins, savedIngredients, trainingDays, diaryEntries });
  const freshAccountPayload = (): BackupPayload => ({ version: 6, recipes: starterRecipes, customCategories: [], goals: { weightKg: 85, goal: 'gain', calories: 3060, protein: 170, carbs: 394, fat: 77 }, plans: [], shopping: [], unitSystem: 'metric', dailyTargets: [], weights: [], vitamins: [], savedIngredients: [], trainingDays: [], diaryEntries: [] });
  const applyBackup = (data: BackupPayload) => {
    setRecipes(data.recipes); setCustomCategories(data.customCategories ?? []); if (data.goals) setGoals(data.goals); setPlans(data.plans ?? []); setShopping(data.shopping ?? []); if (data.unitSystem) setUnitSystem(data.unitSystem); setDailyTargets(data.dailyTargets ?? []); setWeights(data.weights ?? []); setVitamins(data.vitamins ?? []); setSavedIngredients(data.savedIngredients ?? []); setTrainingDays(data.trainingDays ?? []); setDiaryEntries(data.diaryEntries ?? []);
  };
  const connectAccount = async (user: AccountUser) => {
    setAccountUser(user); setAccountReady(false); setAccountSyncState('syncing');
    try {
      const previousOwner = await getAccountDataOwner();
      const cloud = await downloadAccountData();
      if (cloud?.payload) { applyBackup(cloud.payload); setLastSyncedAt(cloud.updatedAt); }
      else {
        const isNewOwner = Boolean(previousOwner && previousOwner !== user.uid);
        const initial = isNewOwner ? freshAccountPayload() : backupPayload();
        if (isNewOwner) applyBackup(initial);
        const syncedAt = await uploadAccountData(initial); setLastSyncedAt(syncedAt);
      }
      setAccountReady(true); setAccountSyncState('synced');
    } catch { setAccountSyncState('error'); throw new Error('sync'); }
  };

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    restoreAccount().then((user) => { if (active && user) connectAccount(user).catch(() => undefined); });
    return () => { active = false; };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !accountUser || !accountReady) return;
    setAccountSyncState('syncing');
    const timer = setTimeout(() => {
      uploadAccountData(backupPayload()).then((syncedAt) => { setLastSyncedAt(syncedAt); setAccountSyncState('synced'); }).catch(() => setAccountSyncState('error'));
    }, 1200);
    return () => clearTimeout(timer);
  }, [recipes, customCategories, goals, plans, shopping, unitSystem, dailyTargets, weights, vitamins, savedIngredients, trainingDays, diaryEntries, hydrated, accountUser?.uid, accountReady]);
  const exportBackup = () => {
    const data = JSON.stringify(backupPayload(), null, 2);
    setBackupText(data); Share.share({ title: 'MauGainZ backup', message: data }).catch(() => undefined);
  };
  const importBackup = (json: string) => {
    try {
      const data = JSON.parse(json) as Partial<BackupPayload>;
      if (!Array.isArray(data.recipes)) throw new Error('invalid');
      applyBackup({ version: 6, recipes: data.recipes, customCategories: data.customCategories ?? [], goals: data.goals ?? goals, plans: data.plans ?? [], shopping: data.shopping ?? [], unitSystem: data.unitSystem ?? unitSystem, dailyTargets: data.dailyTargets, weights: data.weights, vitamins: data.vitamins, savedIngredients: data.savedIngredients, trainingDays: data.trainingDays, diaryEntries: data.diaryEntries });
      Alert.alert('MauGainZ', t(locale, 'Backup imported successfully.', 'Back-up succesvol geïmporteerd.'));
    } catch { Alert.alert('MauGainZ', t(locale, 'This backup is not valid.', 'Deze back-up is niet geldig.')); }
  };
  const cloudUpload = async () => {
    try { await uploadCloudBackup(syncCode, backupPayload()); const now = Date.now(); setLastSyncedAt(now); Alert.alert('MauGainZ', t(locale, 'Cloud backup updated. Use this sync code on your other device.', 'Cloudback-up bijgewerkt. Gebruik deze synchronisatiecode op je andere toestel.')); }
    catch (error) { Alert.alert('MauGainZ', error instanceof Error && error.message === 'unconfigured' ? t(locale, 'Firebase project keys are still needed for live cloud sync.', 'Firebase-projectsleutels zijn nog nodig voor live cloudsynchronisatie.') : t(locale, 'Cloud sync failed. Check your connection and Firebase permissions.', 'Cloudsynchronisatie mislukt. Controleer je verbinding en Firebase-rechten.')); }
  };
  const cloudDownload = () => Alert.alert('MauGainZ', t(locale, 'Replace local data with the cloud copy?', 'Lokale gegevens vervangen door de cloudversie?'), [{ text: t(locale, 'Cancel', 'Annuleren'), style: 'cancel' }, { text: t(locale, 'Restore', 'Ophalen'), onPress: async () => { try { const data = await downloadCloudBackup(syncCode); applyBackup(data); setLastSyncedAt(Date.now()); Alert.alert('MauGainZ', t(locale, 'Phone and tablet data are now in sync.', 'Gegevens op telefoon en tablet zijn nu gesynchroniseerd.')); } catch { Alert.alert('MauGainZ', t(locale, 'No cloud backup was found for this code.', 'Geen cloudback-up gevonden voor deze code.')); } } }]);
  const renameCategory = (oldName: string, newName: string) => { setCustomCategories((current) => current.map((item) => item.name === oldName ? { ...item, name: newName } : item)); setRecipes((current) => current.map((item) => item.category === oldName ? { ...item, category: newName } : item)); };
  const deleteCategory = (name: string) => { setCustomCategories((current) => current.filter((item) => item.name !== name)); setRecipes((current) => current.map((item) => item.category === name ? { ...item, category: 'Quick meal', accent: accentForCategory('Quick meal') } : item)); };
  const styleCategory = (name: string, color: string, categoryIcon: string) => { setCustomCategories((current) => current.map((item) => item.name === name ? { ...item, color, icon: categoryIcon } : item)); setRecipes((current) => current.map((item) => item.category === name ? { ...item, accent: color, icon: categoryIcon } : item)); };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} /><ExpoStatusBar style="light" />
      <View style={[styles.flex, tablet && styles.tabletAppFrame]}>
        {tablet && <BottomNav active={activeTab} locale={locale} tablet onChange={setActiveTab} onToggleLocale={() => setLocale((current) => current === 'en' ? 'nl' : 'en')} />}
        <View style={styles.mainContent}>
          {activeTab === 'home' && <HomeScreen recipes={recipes} diaryEntries={diaryEntries} locale={locale} tablet={tablet} goals={{ ...goals, ...(dailyTargets.find((item) => item.weekday === new Date().getDay()) ?? {}) }} onOpen={setSelectedRecipe} onGoRecipes={() => setActiveTab('recipes')} onGoDiary={() => setActiveTab('diary')} onCreate={openCreate} onSettings={() => setSettingsVisible(true)} />}
          {activeTab === 'recipes' && <RecipesScreen recipes={recipes} locale={locale} tablet={tablet} categoryOptions={categoryOptions} onOpen={setSelectedRecipe} onFavorite={toggleFavorite} onCreate={openCreate} />}
          {activeTab === 'diary' && <FoodDiaryScreen locale={locale} tablet={tablet} recipes={recipes} entries={diaryEntries} savedIngredients={savedIngredients} onSavedIngredients={setSavedIngredients} goals={goals} dailyTargets={dailyTargets} plans={plans} onChange={setDiaryEntries} onOpenRecipe={setSelectedRecipe} />}
          {activeTab === 'create' && <BuilderScreen key={editingRecipe?.id ?? `new-${recipes.length}`} locale={locale} tablet={tablet} landscape={screenLandscape} wideLandscape={wideLandscape} initialRecipe={editingRecipe} categoryOptions={categoryOptions} categoryStyles={categoryStyles} recentIngredientNames={recentIngredientNames} savedIngredients={savedIngredients} onSavedIngredients={setSavedIngredients} onIngredientUsed={(name) => setRecentIngredientNames((current) => [name, ...current.filter((item) => item !== name)].slice(0, 12))} onAddCategory={(name) => setCustomCategories((current) => [...current, { name, color: colors.lime, icon: 'nutrition-outline' }])} onSave={saveRecipe} onCancel={() => { setEditingRecipe(null); setActiveTab('home'); }} />}
          {activeTab === 'planner' && <PlannerScreen recipes={recipes} locale={locale} landscape={landscape} plans={plans} shopping={shopping} trainingDays={trainingDays} onTrainingDays={setTrainingDays} onAddPlan={(entry) => setPlans((current) => [...current, entry])} onRemovePlan={(id) => setPlans((current) => current.filter((entry) => entry.id !== id))} onOpenRecipe={setSelectedRecipe} onGenerateShopping={generateShopping} onToggleShopping={(id) => setShopping((current) => current.map((item) => item.id === id ? { ...item, checked: !item.checked } : item))} onRemoveShopping={(id) => setShopping((current) => current.filter((item) => item.id !== id))} />}
          {activeTab === 'macros' && <PerformanceHub locale={locale} tablet={tablet} goals={goals} recipes={recipes} plans={plans} dailyTargets={dailyTargets} onDailyTargets={setDailyTargets} weights={weights} onWeights={setWeights} vitamins={vitamins} onVitamins={setVitamins} savedIngredients={savedIngredients} onSavedIngredients={setSavedIngredients} trainingDays={trainingDays} />}
          {activeTab === 'friends' && <FriendsScreen locale={locale} tablet={tablet} user={accountUser} recipes={recipes} syncState={accountSyncState} onAuthenticated={connectAccount} onSignedOut={() => { setAccountUser(null); setAccountReady(false); setAccountSyncState('offline'); }} onAcceptRecipe={(recipe) => { setRecipes((current) => [recipe, ...current]); setSelectedRecipe(recipe); }} />}
          {!tablet && <BottomNav active={activeTab} locale={locale} tablet={false} compact={compactLandscape} onChange={setActiveTab} onToggleLocale={() => setLocale((current) => current === 'en' ? 'nl' : 'en')} />}
        </View>
      </View>
      <RecipeDetail recipe={selectedLive} visible={!!selectedLive} locale={locale} tablet={tablet} unitSystem={unitSystem} onClose={() => setSelectedRecipe(null)} onFavorite={toggleFavorite} onDelete={deleteRecipe} onEdit={editRecipe} onDuplicate={duplicateRecipe} onShare={shareRecipe} onCook={(recipe) => { setSelectedRecipe(null); setCookingRecipe(recipe); }} onAddShopping={(recipe) => { addRecipeToShopping(recipe); Alert.alert('MauGainZ', t(locale, 'Added to your shopping list.', 'Toegevoegd aan je boodschappenlijst.')); }} />
      {cookingRecipe && <CookingMode recipe={cookingRecipe} locale={locale} onClose={() => setCookingRecipe(null)} />}
      <SettingsModal visible={settingsVisible} locale={locale} categories={customCategories} goals={goals} unitSystem={unitSystem} backupText={backupText} cloudReady={cloudConfigured} syncCode={syncCode} lastSyncedAt={lastSyncedAt} onSyncCode={setSyncCode} onCloudUpload={cloudUpload} onCloudDownload={cloudDownload} onClose={() => setSettingsVisible(false)} onGoals={setGoals} onUnitSystem={setUnitSystem} onToggleLocale={() => setLocale((current) => current === 'en' ? 'nl' : 'en')} onRenameCategory={renameCategory} onDeleteCategory={deleteCategory} onCategoryStyle={styleCategory} onExport={exportBackup} onImport={importBackup} />
      <UpdateModal update={availableUpdate} locale={locale} onClose={() => setAvailableUpdate(null)} />
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><MauGainzApp /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mainContent: { flex: 1, minWidth: 0 },
  safeArea: { flex: 1, backgroundColor: colors.bg },
  tabletAppFrame: { width: '100%', alignSelf: 'stretch', flexDirection: 'row' },
  screenContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 124 },
  tabletScreenContent: { width: '100%', maxWidth: 1680, alignSelf: 'center', paddingHorizontal: 34, paddingTop: 30, paddingBottom: 54 },
  builderContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 140 },
  tabletBuilderContent: { width: '100%', maxWidth: 1780, alignSelf: 'center', flexGrow: 1, paddingHorizontal: 28, paddingTop: 24, paddingBottom: 34 },
  builderContentKeyboardOpen: { paddingBottom: 320 },
  builderSaveDock: { position: 'absolute', left: 18, right: 18, bottom: 94, zIndex: 30, elevation: 20 },
  builderSaveDockTablet: { left: undefined, right: 28, bottom: 24, width: 270 },
  builderDockButton: { height: 58, borderRadius: 18, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#000', shadowOpacity: .45, shadowRadius: 14, elevation: 14 },
  builderDockText: { color: colors.black, fontSize: 11, fontWeight: '900', letterSpacing: .7 },
  builderLandscapeGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', columnGap: 20, rowGap: 20 },
  builderLandscapePanel: { flexBasis: '47%', flexGrow: 1, maxWidth: '49%', minWidth: 0, backgroundColor: '#11120F', borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: 20 },
  builderLandscapePanelWide: { flexBasis: '22%', maxWidth: '24%', padding: 16 },
  builderTabletSummary: { flexGrow: 1, minHeight: 210, marginTop: 20, flexDirection: 'row', alignItems: 'stretch', gap: 16 },
  builderSummaryBlock: { flex: 1, minWidth: 0, borderRadius: radius.lg, backgroundColor: '#11120F', borderWidth: 1, borderColor: colors.line, padding: 20, justifyContent: 'space-between' },
  builderReadinessBlock: { flex: 1.25 },
  builderChecklistBlock: { flex: 0.9 },
  builderSummaryHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  builderSummaryEyebrow: { color: colors.lime, fontSize: 9, fontWeight: '900', letterSpacing: 1.35, marginBottom: 7 },
  builderSummaryTitle: { color: colors.cream, fontSize: 20, fontWeight: '900', letterSpacing: -0.45 },
  builderCompletionValue: { color: colors.lime, fontSize: 30, lineHeight: 34, fontWeight: '900', letterSpacing: -1 },
  builderSummaryHint: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  builderMetricRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  builderMetric: { flex: 1, height: 92, borderRadius: radius.md, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  builderMetricValue: { color: colors.cream, fontSize: 28, lineHeight: 32, fontWeight: '900' },
  builderMetricLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase', marginTop: 4 },
  builderChecklist: { gap: 9 },
  builderCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  builderCheckIcon: { width: 25, height: 25, borderRadius: 9, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  builderCheckIconDone: { backgroundColor: colors.lime, borderColor: colors.lime },
  builderCheckText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  builderCheckTextDone: { color: colors.cream },
  builderStickyHeader: { backgroundColor: colors.bg, paddingTop: 4, zIndex: 10 },
  pressed: { opacity: 0.75 },
  cardPressed: { transform: [{ scale: 0.99 }], opacity: 0.92 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  headerTitleBlock: { flex: 1, minWidth: 0, marginRight: 12 },
  eyebrow: { color: colors.lime, fontSize: 10, fontWeight: '900', letterSpacing: 1.6, marginBottom: 5 },
  screenTitle: { color: colors.cream, fontSize: 31, fontWeight: '900', letterSpacing: -1.1 },
  brandMark: { width: 58, height: 58, borderRadius: 18, backgroundColor: colors.black, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  brandMarkImage: { width: 54, height: 54 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  headerUtility: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  headerSave: { height: 44, borderRadius: 14, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14 },
  headerSaveText: { color: colors.black, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  headerAdd: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  closeButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  heroCard: { borderRadius: radius.lg, padding: 22, marginBottom: 14 },
  tabletHomeGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: 22 },
  tabletHomeColumn: { flex: 1, minWidth: 280 },
  tabletHeroCard: { flex: 1, minHeight: 284, padding: 28, justifyContent: 'space-between' },
  tabletHeroNumber: { fontSize: 58, lineHeight: 64 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { backgroundColor: 'rgba(11,12,9,0.12)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  heroLabelText: { color: colors.black, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  heroDiaryButton: { minHeight: 38, borderRadius: 13, backgroundColor: '#F3F4F285', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroDiaryButtonText: { color: colors.black, fontSize: 8, fontWeight: '900', letterSpacing: .5 },
  heroNumber: { color: colors.black, fontSize: 46, lineHeight: 52, fontWeight: '900', letterSpacing: -2, marginTop: 12 },
  heroUnit: { color: 'rgba(11,12,9,0.62)', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  heroProgressTrack: { height: 8, backgroundColor: 'rgba(11,12,9,0.15)', borderRadius: 4, overflow: 'hidden', marginTop: 16 },
  heroProgressFill: { height: '100%', backgroundColor: colors.black, borderRadius: 4 },
  heroMacros: { flexDirection: 'row', gap: 38, marginTop: 17 },
  heroMacroValue: { color: colors.black, fontWeight: '900', fontSize: 17 },
  heroMacroLabel: { color: 'rgba(11,12,9,0.56)', fontWeight: '900', fontSize: 8, letterSpacing: 1.1, marginTop: 2 },
  quickRow: { flexDirection: 'row', gap: 10, marginBottom: 30 },
  tabletQuickRow: { marginBottom: 0, marginTop: 0 },
  tabletQuickAction: { minHeight: 92, padding: 16 },
  quickAction: { flex: 1, minHeight: 76, borderRadius: radius.md, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  quickIconDark: { backgroundColor: colors.panelSoft },
  quickTitle: { color: colors.cream, fontSize: 13, fontWeight: '800' },
  quickSubtitle: { color: colors.muted, fontSize: 10, marginTop: 3 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 5, marginBottom: 14 },
  tabletHomeSectionHeading: { marginTop: 0, minHeight: 55 },
  sectionEyebrow: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginBottom: 4 },
  sectionTitle: { color: colors.cream, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  linkText: { color: colors.lime, fontSize: 12, fontWeight: '800', paddingVertical: 6 },
  spotlightCard: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  tabletSpotlightCard: { flex: 1 },
  spotlightGradient: { padding: 21 },
  tabletSpotlightGradient: { flex: 1, minHeight: 321, padding: 28, justifyContent: 'space-between' },
  homeLowerSection: { marginTop: 28 },
  homeRecipeGrid: { gap: 10 },
  homeRecipeGridTablet: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  homeRecipeCard: { minHeight: 165, borderRadius: radius.lg, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 17 },
  homeRecipeCardTablet: { flexGrow: 1, flexBasis: 260, minHeight: 190 },
  homeRecipeIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  homeRecipeCategory: { color: colors.lime, fontSize: 8, fontWeight: '900', letterSpacing: 1.1, marginTop: 15 },
  homeRecipeTitle: { flex: 1, color: colors.cream, fontSize: 17, lineHeight: 22, fontWeight: '900', marginTop: 5 },
  homeRecipeFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  homeRecipeMacro: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  spotlightTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  spotlightIcon: { width: 68, height: 68, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.12)' },
  spotlightCalories: { alignItems: 'flex-end' },
  spotlightCaloriesValue: { color: colors.cream, fontSize: 26, fontWeight: '900' },
  spotlightCaloriesLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  spotlightCategory: { color: colors.lime, fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginTop: 24 },
  spotlightTitle: { color: colors.cream, fontSize: 25, fontWeight: '900', letterSpacing: -0.7, marginTop: 4 },
  spotlightSubtitle: { color: colors.muted, fontSize: 13, marginTop: 4 },
  spotlightFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22 },
  spotlightProtein: { color: colors.cream, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  roundArrow: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  searchBox: { height: 52, borderRadius: radius.md, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, color: colors.cream, fontSize: 14, paddingHorizontal: 11 },
  chipRow: { gap: 8, paddingVertical: 15 },
  chipRowForm: { gap: 8, paddingBottom: 16 },
  categoryChipScroller: { flexGrow: 0, height: 48 },
  pill: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, paddingHorizontal: 15, paddingVertical: 9 },
  pillActive: { backgroundColor: colors.lime, borderColor: colors.lime },
  pillText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  pillTextActive: { color: colors.black },
  resultsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  resultsText: { color: colors.cream, fontSize: 13, fontWeight: '800' },
  sortLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortText: { color: colors.muted, fontSize: 11 },
  recipeCard: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, marginTop: 11, overflow: 'hidden' },
  recipeCardTablet: { width: '48.8%' },
  tabletRecipeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  recipeArt: { height: 112, padding: 15, justifyContent: 'space-between' },
  recipeArtPhoto: { position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5 },
  recipeIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  favoriteButton: { position: 'absolute', top: 13, right: 13, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(11,12,9,0.45)', alignItems: 'center', justifyContent: 'center' },
  recipeCategory: { color: colors.cream, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  recipeCardBody: { padding: 16 },
  recipeTitle: { color: colors.cream, fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  recipeSubtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
  recipeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 15 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  proteinTag: { marginLeft: 'auto', backgroundColor: '#D2A74A18', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5 },
  proteinTagText: { color: colors.lime, fontSize: 10, fontWeight: '900' },
  emptyCard: { minHeight: 170, marginTop: 18, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, alignItems: 'center', justifyContent: 'center', padding: 25 },
  emptyTitle: { color: colors.cream, fontWeight: '900', fontSize: 17, marginTop: 10 },
  emptyBody: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 5 },
  formSection: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  formNumber: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  formNumberText: { color: colors.black, fontSize: 11, fontWeight: '900' },
  formTitle: { color: colors.cream, fontSize: 20, fontWeight: '900' },
  formTitleBody: { flex: 1, minWidth: 0 },
  formHelp: { color: colors.muted, fontSize: 11, marginTop: 2 },
  collapseSummary: { color: colors.muted, fontSize: 10, marginTop: 3 },
  collapseButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.panelSoft, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  importRecipeButton: { minHeight: 52, borderRadius: radius.md, backgroundColor: '#D2A74A10', borderWidth: 1, borderColor: '#D2A74A35', paddingHorizontal: 14, marginBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 11 },
  importRecipeBody: { flex: 1 },
  importRecipeTitle: { color: colors.cream, fontSize: 10, fontWeight: '900', letterSpacing: .7 },
  importRecipeSub: { color: colors.muted, fontSize: 9, marginTop: 3 },
  fieldLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 7 },
  optional: { color: '#7F8384', fontSize: 8 },
  input: { height: 52, borderRadius: radius.md, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, color: colors.cream, paddingHorizontal: 15, marginBottom: 16, fontSize: 14 },
  photoPicker: { height: 130, borderRadius: radius.md, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', marginBottom: 16 },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoPickerText: { color: colors.lime, fontSize: 11, fontWeight: '800' },
  photoEditBadge: { position: 'absolute', right: 10, bottom: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  customCategoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  customCategoryInput: { flex: 1, height: 50, borderRadius: radius.md, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, color: colors.cream, paddingHorizontal: 15, fontSize: 13 },
  customCategoryButton: { minWidth: 112, height: 50, borderRadius: radius.md, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14 },
  customCategoryButtonText: { color: colors.black, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  disabledButton: { opacity: 0.38 },
  doubleField: { flexDirection: 'row', gap: 10 },
  halfField: { flex: 1 },
  inputWithSuffix: { height: 52, borderRadius: radius.md, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  servingStepper: { height: 52, borderRadius: radius.md, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingHorizontal: 4, gap: 4 },
  servingValueBlock: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 },
  portionStepperValue: { color: colors.cream, fontSize: 17, fontWeight: '900' },
  portionButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  portionButtonDisabled: { opacity: 0.3 },
  portionScaleHint: { color: colors.muted, fontSize: 8, fontWeight: '700', marginTop: 3, textAlign: 'center' },
  numberInput: { flex: 1, color: colors.cream, paddingHorizontal: 15, fontSize: 15, fontWeight: '800' },
  inputSuffix: { color: colors.muted, fontSize: 11, marginRight: 13 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 28 },
  suggestionRow: { gap: 7, paddingBottom: 13 },
  suggestionScroller: { flexGrow: 0, height: 46 },
  ingredientSearch: { height: 48, borderRadius: radius.md, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  smartIngredientButton: { minHeight: 44, borderRadius: radius.md, backgroundColor: colors.lime, paddingHorizontal: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  smartIngredientText: { color: colors.black, fontSize: 9, fontWeight: '900', letterSpacing: .25, textAlign: 'center' },
  ingredientLibraryButton: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.lime, paddingHorizontal: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ingredientLibraryText: { color: colors.lime, fontSize: 9, fontWeight: '900', letterSpacing: .25, textAlign: 'center' },
  suggestionChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: '#D2A74A10', borderColor: '#D2A74A2D', borderWidth: 1, borderRadius: radius.pill },
  suggestionText: { color: colors.cream, fontSize: 10, fontWeight: '700' },
  historyHint: { color: colors.muted, fontSize: 9, marginBottom: 9 },
  ingredientEditRow: { flexDirection: 'row', alignItems: 'center', minHeight: 54, marginBottom: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 7 },
  dragGrip: { width: 30, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  databaseBadge: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  ingredientIndex: { width: 25, height: 25, borderRadius: 8, backgroundColor: colors.panelSoft, alignItems: 'center', justifyContent: 'center' },
  ingredientIndexText: { color: colors.muted, fontSize: 9, fontWeight: '900' },
  ingredientNameInput: { flex: 1, minWidth: 100, color: colors.cream, fontSize: 12, paddingHorizontal: 9 },
  ingredientAmountInput: { width: 50, color: colors.cream, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  unitButton: { minWidth: 48, marginLeft: 6, paddingVertical: 9, borderRadius: 9, backgroundColor: colors.panelSoft, alignItems: 'center' },
  unitText: { color: colors.lime, fontSize: 10, fontWeight: '900' },
  removeButton: { paddingLeft: 8, paddingVertical: 12 },
  addLineButton: { height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D2A74A55', marginTop: 4 },
  addLineText: { color: colors.lime, fontSize: 11, fontWeight: '800' },
  stepEditRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12 },
  stepNumber: { width: 31, height: 31, borderRadius: 10, backgroundColor: colors.panelSoft, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: colors.lime, fontSize: 9, fontWeight: '900' },
  stepInput: { flex: 1, minHeight: 50, color: colors.cream, fontSize: 13, lineHeight: 19, paddingTop: 5, paddingBottom: 5, textAlignVertical: 'top' },
  stepTools: { alignItems: 'center', gap: 9 },
  stepTimerInput: { width: 62, height: 34, borderRadius: 10, backgroundColor: colors.panelSoft, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7 },
  stepTimerText: { flex: 1, color: colors.cream, fontSize: 10, textAlign: 'center' },
  tagSection: { gap: 6, marginBottom: 14 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 },
  autoMacroCard: { minHeight: 70, borderRadius: radius.md, backgroundColor: '#D2A74A12', borderWidth: 1, borderColor: '#D2A74A42', padding: 13, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  autoMacroBody: { flex: 1 },
  autoMacroTitle: { color: colors.cream, fontSize: 12, fontWeight: '900' },
  autoMacroText: { color: colors.muted, fontSize: 9, marginTop: 4 },
  autoMacroButton: { height: 40, borderRadius: 12, backgroundColor: colors.lime, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  autoMacroButtonText: { color: colors.black, fontSize: 9, fontWeight: '900' },
  macroInputGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  macroInputWrap: { width: '47.8%' },
  tabletMacroInputWrap: { width: '31.8%' },
  macroInput: { height: 52, borderRadius: radius.md, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, color: colors.cream, paddingHorizontal: 15, fontSize: 17, fontWeight: '900', marginBottom: 5 },
  saveButton: { height: 58, borderRadius: radius.md, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 25 },
  saveButtonText: { color: colors.black, fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  goalCard: { borderRadius: radius.lg, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 20 },
  tabletMetricsGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: 20 },
  tabletMetricColumn: { flex: 1, minWidth: 280 },
  tabletMetricHeading: { marginTop: 4, minHeight: 48 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: colors.line },
  goalEyebrow: { color: colors.lime, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  goalTitle: { color: colors.cream, fontSize: 18, fontWeight: '900', marginTop: 3 },
  goalKcal: { color: colors.cream, fontSize: 20, fontWeight: '900' },
  goalKcalUnit: { color: colors.muted, fontSize: 10 },
  goalRow: { marginTop: 16 },
  goalLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  goalLabel: { color: colors.cream, fontSize: 12, fontWeight: '700' },
  goalValue: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.panelSoft, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  goalHint: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 18 },
  labIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#D2A74A16', alignItems: 'center', justifyContent: 'center' },
  averageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  averageMain: { width: '100%', backgroundColor: colors.lime, borderRadius: radius.md, padding: 17 },
  averageValue: { color: colors.black, fontSize: 31, fontWeight: '900' },
  averageLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginTop: 2 },
  averageMini: { flex: 1, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 14 },
  averageMiniValue: { fontSize: 18, fontWeight: '900' },
  macroRecipeRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.line },
  macroRecipeIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  macroRecipeBody: { flex: 1 },
  macroRecipeTitle: { color: colors.cream, fontSize: 13, fontWeight: '800' },
  macroRecipeMeta: { color: colors.muted, fontSize: 10, marginTop: 4 },
  macroRecipeKcal: { color: colors.cream, fontSize: 13, fontWeight: '900' },
  detailSafe: { flex: 1, backgroundColor: colors.bg },
  detailContent: { paddingHorizontal: 18, paddingTop: Platform.OS === 'android' ? 16 : 5, paddingBottom: 50 },
  tabletDetailContent: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 36, paddingTop: 26, paddingBottom: 60 },
  detailTopBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 13 },
  detailTopActions: { flexDirection: 'row', gap: 8 },
  detailTopButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  detailHero: { borderRadius: radius.lg, padding: 22, borderWidth: 1, borderColor: colors.line },
  detailHeroPhoto: { position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: radius.lg, opacity: 0.28 },
  tabletDetailSummary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: 14 },
  tabletDetailHero: { flex: 2, minWidth: 320, minHeight: 270, justifyContent: 'center' },
  detailHeroIcon: { width: 76, height: 76, borderRadius: 25, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  detailCategory: { fontSize: 9, fontWeight: '900', letterSpacing: 1.6 },
  detailTitle: { color: colors.cream, fontSize: 31, fontWeight: '900', letterSpacing: -1, marginTop: 5 },
  detailSubtitle: { color: colors.muted, fontSize: 13, marginTop: 5 },
  detailMeta: { flexDirection: 'row', gap: 20, marginTop: 22 },
  detailMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  detailMetaText: { color: colors.cream, fontSize: 11, fontWeight: '700' },
  detailTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 17 },
  detailTag: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: '#D2A74A24' },
  detailTagText: { color: colors.lime, fontSize: 8, fontWeight: '900' },
  allergenTag: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: '#D86D5C22' },
  allergenTagText: { color: '#E88C7D', fontSize: 8, fontWeight: '900' },
  detailMacroStrip: { flexDirection: 'row', backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, marginTop: 10, paddingVertical: 15 },
  tabletDetailMacroStrip: { flex: 1, minWidth: 260, marginTop: 0, paddingVertical: 24, alignItems: 'center' },
  detailActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  detailAction: { minHeight: 44, paddingHorizontal: 14, borderRadius: 13, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  detailActionPrimary: { backgroundColor: colors.lime, borderColor: colors.lime },
  detailActionText: { color: colors.cream, fontSize: 10, fontWeight: '800' },
  detailActionPrimaryText: { color: colors.black, fontSize: 10, fontWeight: '900' },
  macroBadge: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.line },
  macroNumber: { fontSize: 16, fontWeight: '900' },
  macroLabel: { color: colors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 0.7, marginTop: 3 },
  detailSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 33, marginBottom: 13 },
  tabletDetailColumns: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 28 },
  tabletDetailColumn: { flex: 1, minWidth: 320 },
  detailSectionTitle: { color: colors.cream, fontSize: 22, fontWeight: '900' },
  servingControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: 13, overflow: 'hidden' },
  servingButton: { width: 35, height: 42, alignItems: 'center', justifyContent: 'center' },
  servingCount: { width: 55, alignItems: 'center' },
  servingValue: { color: colors.cream, fontSize: 14, fontWeight: '900' },
  servingLabel: { color: colors.muted, fontSize: 6, fontWeight: '900', letterSpacing: 0.6 },
  detailIngredientRow: { minHeight: 51, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line },
  checkBox: { width: 24, height: 24, borderRadius: 8, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  detailIngredientName: { flex: 1, color: colors.cream, fontSize: 13, fontWeight: '600' },
  detailIngredientAmount: { color: colors.lime, fontSize: 12, fontWeight: '900' },
  checkedText: { textDecorationLine: 'line-through', color: colors.muted, opacity: 0.65 },
  stepCount: { color: colors.lime, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  detailStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 14, marginBottom: 9, borderRadius: radius.md, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  detailStepChecked: { backgroundColor: '#D2A74A09', borderColor: '#D2A74A28' },
  detailStepNumber: { width: 34, height: 34, borderRadius: 11, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  detailStepNumberText: { color: colors.lime, fontSize: 9, fontWeight: '900' },
  detailStepText: { flex: 1, color: colors.cream, fontSize: 13, lineHeight: 20 },
  detailDoneCard: { marginTop: 18, padding: 18, borderRadius: radius.md, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 13 },
  detailDoneBody: { flex: 1 },
  detailDoneTitle: { color: colors.cream, fontSize: 14, fontWeight: '900' },
  detailDoneText: { color: colors.muted, fontSize: 11, marginTop: 3 },
  bottomNav: { position: 'absolute', left: 14, right: 14, bottom: Platform.OS === 'android' ? 14 : 8, height: 72, backgroundColor: '#151513F4', borderRadius: 23, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8 },
  compactBottomNav: { left: 10, right: 10, bottom: 6, height: 54, borderRadius: 18 },
  tabletNavRail: { width: 98, height: '100%', backgroundColor: colors.panel, borderRightWidth: 1, borderRightColor: colors.line, alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 10, paddingTop: 104, paddingBottom: 12, gap: 8 },
  tabletNavBrand: { position: 'absolute', top: 20, width: 68, height: 68, borderRadius: 20, backgroundColor: colors.black, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tabletNavBrandImage: { width: 64, height: 64 },
  navItem: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
  tabletNavItem: { flex: 0, width: 76, height: 62, borderRadius: 18 },
  tabletNavItemActive: { backgroundColor: '#D2A74A12', borderWidth: 1, borderColor: '#D2A74A30' },
  navIconWrap: { width: 34, height: 30, alignItems: 'center', justifyContent: 'center' },
  navLabel: { color: colors.muted, fontSize: 8, fontWeight: '800', marginTop: 1 },
  tabletNavLabel: { fontSize: 9, marginTop: 3 },
  navLabelActive: { color: colors.lime },
  createNavButton: { width: 49, height: 49, borderRadius: 17, backgroundColor: colors.lime, transform: [{ rotate: '0deg' }] },
  compactCreateNavButton: { width: 40, height: 40, borderRadius: 13 },
  createNavButtonActive: { backgroundColor: colors.cream },
  languageNavButton: { width: 34, height: 30, alignItems: 'center', justifyContent: 'center' },
  languageNavLabel: { color: colors.blue, fontSize: 8, fontWeight: '900', marginTop: 1 },
  updateBackdrop: { flex: 1, backgroundColor: '#000000CC', alignItems: 'center', justifyContent: 'center', padding: 22 },
  updateCard: { width: '100%', maxWidth: 520, borderRadius: 28, backgroundColor: colors.panel, borderWidth: 1, borderColor: '#D2A74A55', padding: 26, alignItems: 'center' },
  updateIcon: { width: 62, height: 62, borderRadius: 20, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  updateEyebrow: { color: colors.lime, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  updateTitle: { color: colors.cream, fontSize: 25, lineHeight: 31, fontWeight: '900', textAlign: 'center', marginTop: 7 },
  updateVersion: { color: colors.muted, fontSize: 11, fontWeight: '800', marginTop: 8 },
  updateNotes: { width: '100%', color: colors.cream, fontSize: 12, lineHeight: 19, marginTop: 18, padding: 14, borderRadius: 15, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line },
  updateHint: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 16 },
  updatePrimary: { width: '100%', height: 54, borderRadius: 16, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 20 },
  updatePrimaryText: { color: colors.black, fontSize: 11, fontWeight: '900', letterSpacing: 0.9 },
  updateLater: { minHeight: 44, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  updateLaterText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  ingredientEditorBlock: { marginBottom: 5 },
  macroVerifyBar: { minHeight: 38, marginTop: -4, marginHorizontal: 7, paddingHorizontal: 11, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, borderWidth: 1, borderTopWidth: 0, borderColor: '#D2A74A55', backgroundColor: '#D2A74A0B', flexDirection: 'row', alignItems: 'center', gap: 7 },
  macroVerifyBarConfirmed: { backgroundColor: colors.lime, borderColor: colors.lime },
  macroVerifyText: { flex: 1, color: colors.lime, fontSize: 8, fontWeight: '900', letterSpacing: .3 },
  macroVerifyTextConfirmed: { color: colors.black }
});
