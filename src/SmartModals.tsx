import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import MlkitOcr from 'rn-mlkit-ocr';
import { Ionicons } from '@expo/vector-icons';
import { ImportedRecipe, Ingredient, Locale } from './types';
import { importRecipeFromUrl, lookupBarcode, parseRecipeText, searchNutrition } from './smartFeatures';
import { colors, radius } from './theme';

const tr = (locale: Locale, en: string, nl: string) => locale === 'nl' ? nl : en;
const ico = (name: React.ComponentProps<typeof Ionicons>['name'], size = 20, color = colors.cream) => <Ionicons name={name} size={size} color={color} />;

export function IngredientLookupModal({ visible, locale, onClose, onSelect }: { visible: boolean; locale: Locale; onClose: () => void; onSelect: (ingredient: Ingredient) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<'scan' | 'search'>('scan');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [results, setResults] = useState<Ingredient[]>([]);
  const [manualBarcode, setManualBarcode] = useState('');

  const fail = (error: unknown) => Alert.alert('MauGainZ', error instanceof Error && error.message === 'not-found' ? tr(locale, 'Product not found. Try nutrition search.', 'Product niet gevonden. Probeer zoeken in de voedingsdatabase.') : tr(locale, 'Could not reach the nutrition database. Check your connection.', 'Kan de voedingsdatabase niet bereiken. Controleer je verbinding.'));
  const scanned = async (barcode: string) => {
    if (locked) return;
    setLocked(true); setLoading(true);
    try { const item = await lookupBarcode(barcode.trim(), locale); onSelect(item); onClose(); }
    catch (error) { fail(error); setLocked(false); }
    finally { setLoading(false); }
  };
  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try { setResults(await searchNutrition(query.trim(), locale)); }
    catch (error) { fail(error); }
    finally { setLoading(false); }
  };

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={s.safe}>
      <View style={s.top}><View><Text style={s.eyebrow}>{tr(locale, 'SMART INGREDIENT', 'SLIM INGREDIËNT')}</Text><Text style={s.title}>{tr(locale, 'Scan or search', 'Scan of zoek')}</Text></View><Pressable onPress={onClose} style={s.close}>{ico('close')}</Pressable></View>
      <View style={s.tabs}><Pressable onPress={() => { setMode('scan'); setLocked(false); }} style={[s.tab, mode === 'scan' && s.tabActive]}>{ico('barcode-outline', 18, mode === 'scan' ? colors.black : colors.muted)}<Text style={[s.tabText, mode === 'scan' && s.tabTextActive]}>{tr(locale, 'BARCODE', 'BARCODE')}</Text></Pressable><Pressable onPress={() => setMode('search')} style={[s.tab, mode === 'search' && s.tabActive]}>{ico('search-outline', 18, mode === 'search' ? colors.black : colors.muted)}<Text style={[s.tabText, mode === 'search' && s.tabTextActive]}>{tr(locale, 'DATABASE', 'DATABASE')}</Text></Pressable></View>
      {mode === 'scan' ? <View style={s.cameraArea}>
        {!permission?.granted ? <View style={s.permissionCard}>{ico('camera-outline', 38, colors.lime)}<Text style={s.cardTitle}>{tr(locale, 'Camera access needed', 'Cameratoegang nodig')}</Text><Text style={s.help}>{tr(locale, 'Use the camera to scan EAN and UPC barcodes on packaged foods.', 'Gebruik de camera om EAN- en UPC-barcodes op verpakte voeding te scannen.')}</Text><Pressable onPress={requestPermission} style={s.primary}><Text style={s.primaryText}>{tr(locale, 'ALLOW CAMERA', 'CAMERA TOESTAAN')}</Text></Pressable></View> : <View style={s.cameraFrame}><CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }} onBarcodeScanned={locked ? undefined : ({ data }) => scanned(data)} /><View style={s.scanGuide}><View style={s.scanLine} /></View><View style={s.cameraCaption}><Text style={s.cameraCaptionText}>{loading ? tr(locale, 'Looking up product…', 'Product opzoeken…') : tr(locale, 'Point at the barcode', 'Richt op de barcode')}</Text></View></View>}
        <View style={s.manualBarcode}><TextInput value={manualBarcode} onChangeText={setManualBarcode} onSubmitEditing={() => scanned(manualBarcode)} keyboardType="number-pad" placeholder={tr(locale, 'Or enter EAN manually', 'Of vul EAN handmatig in')} placeholderTextColor={colors.muted} style={s.manualBarcodeInput} /><Pressable disabled={!manualBarcode.trim() || loading} onPress={() => scanned(manualBarcode)} style={[s.searchGo, (!manualBarcode.trim() || loading) && s.disabled]}>{loading ? <ActivityIndicator color={colors.black} /> : ico('arrow-forward', 18, colors.black)}</Pressable></View>
      </View> : <View style={s.searchArea}><View style={s.searchBox}>{ico('search-outline', 19, colors.muted)}<TextInput value={query} onChangeText={setQuery} onSubmitEditing={search} placeholder={tr(locale, 'Brand or product name', 'Merk- of productnaam')} placeholderTextColor={colors.muted} returnKeyType="search" style={s.searchInput} /><Pressable onPress={search} style={s.searchGo}>{loading ? <ActivityIndicator color={colors.black} /> : ico('arrow-forward', 18, colors.black)}</Pressable></View><Text style={s.source}>Open Food Facts · België · {tr(locale, 'values per 100 g', 'waarden per 100 g')}</Text><ScrollView contentContainerStyle={s.results}>{!loading && !!query && !results.length && <Text style={s.empty}>{tr(locale, 'Search for a food to see verified nutrition profiles.', 'Zoek een product om voedingsprofielen te bekijken.')}</Text>}{results.map((item) => <Pressable key={`${item.barcode}-${item.name}`} onPress={() => { onSelect(item); onClose(); }} style={s.resultCard}>{item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={s.productImage} /> : <View style={s.productFallback}>{ico('nutrition-outline', 22, colors.lime)}</View>}<View style={s.resultBody}><Text style={s.resultName} numberOfLines={2}>{item.name}</Text><Text style={s.resultBrand} numberOfLines={1}>{item.brand || tr(locale, 'Unknown brand', 'Onbekend merk')}</Text><View style={s.macroRow}><Text style={s.macro}>{Math.round(item.nutritionPer100?.calories ?? 0)} kcal</Text><Text style={s.macro}>P {Math.round(item.nutritionPer100?.protein ?? 0)}g</Text><Text style={s.macro}>C {Math.round(item.nutritionPer100?.carbs ?? 0)}g</Text><Text style={s.macro}>F {Math.round(item.nutritionPer100?.fat ?? 0)}g</Text></View></View>{ico('add-circle', 25, colors.lime)}</Pressable>)}</ScrollView></View>}
    </SafeAreaView>
  </Modal>;
}

export function RecipeImportModal({ visible, locale, onClose, onImport }: { visible: boolean; locale: Locale; onClose: () => void; onImport: (recipe: ImportedRecipe) => void }) {
  const [mode, setMode] = useState<'url' | 'text'>('url');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [photoUri, setPhotoUri] = useState('');
  const runImport = async () => {
    if (!value.trim()) return;
    setLoading(true);
    try {
      const recipe = mode === 'url' ? await importRecipeFromUrl(value.trim()) : parseRecipeText(value);
      if (!recipe.ingredients.length && !recipe.steps.length) throw new Error('empty');
      onImport(recipe); onClose(); setValue(''); setPhotoUri('');
    } catch { Alert.alert('MauGainZ', tr(locale, 'We could not read a recipe from that source. Try pasted text instead.', 'We konden geen recept uit deze bron lezen. Probeer de tekst te plakken.')); }
    finally { setLoading(false); }
  };
  const scanPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.92 });
    if (result.canceled || !result.assets[0]?.uri) return;
    setLoading(true); setPhotoUri(result.assets[0].uri); setMode('text');
    try { const ocr = await MlkitOcr.recognizeText(result.assets[0].uri, 'latin'); setValue(ocr.text); }
    catch { Alert.alert('MauGainZ', tr(locale, 'Text recognition failed for this photo.', 'Tekstherkenning is mislukt voor deze foto.')); }
    finally { setLoading(false); }
  };
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={s.safe}><View style={s.top}><View><Text style={s.eyebrow}>{tr(locale, 'FAST START', 'SNEL STARTEN')}</Text><Text style={s.title}>{tr(locale, 'Import a recipe', 'Recept importeren')}</Text></View><Pressable onPress={onClose} style={s.close}>{ico('close')}</Pressable></View>
      <ScrollView contentContainerStyle={s.importContent} keyboardShouldPersistTaps="handled">
        <View style={s.importHero}>{ico('sparkles', 28, colors.lime)}<View style={s.importHeroBody}><Text style={s.cardTitle}>{tr(locale, 'Skip the typing', 'Sla het typen over')}</Text><Text style={s.help}>{tr(locale, 'MauGainZ finds the title, ingredients, amounts and preparation steps. You can review everything before saving.', 'MauGainZ vindt de titel, ingrediënten, hoeveelheden en bereidingsstappen. Je controleert alles voor het opslaan.')}</Text></View></View>
        <Pressable onPress={scanPhoto} style={s.photoButton}>{ico('scan-outline', 24, colors.black)}<View><Text style={s.photoButtonTitle}>{tr(locale, 'SCAN A RECIPE PHOTO', 'SCAN EEN RECEPTFOTO')}</Text><Text style={s.photoButtonSub}>{tr(locale, 'On-device, private text recognition', 'Tekstherkenning op je toestel, dus privé')}</Text></View></Pressable>
        {!!photoUri && <Image source={{ uri: photoUri }} style={s.photoPreview} />}
        <View style={s.tabs}><Pressable onPress={() => setMode('url')} style={[s.tab, mode === 'url' && s.tabActive]}>{ico('globe-outline', 18, mode === 'url' ? colors.black : colors.muted)}<Text style={[s.tabText, mode === 'url' && s.tabTextActive]}>{tr(locale, 'WEBSITE', 'WEBSITE')}</Text></Pressable><Pressable onPress={() => setMode('text')} style={[s.tab, mode === 'text' && s.tabActive]}>{ico('document-text-outline', 18, mode === 'text' ? colors.black : colors.muted)}<Text style={[s.tabText, mode === 'text' && s.tabTextActive]}>{tr(locale, 'PASTE TEXT', 'PLAK TEKST')}</Text></Pressable></View>
        <TextInput value={value} onChangeText={setValue} multiline={mode === 'text'} autoCapitalize="none" autoCorrect={mode === 'text'} placeholder={mode === 'url' ? 'https://…' : tr(locale, 'Paste the full recipe here…', 'Plak hier het volledige recept…')} placeholderTextColor={colors.muted} style={[s.importInput, mode === 'text' && s.importInputTall]} />
        <Pressable disabled={!value.trim() || loading} onPress={runImport} style={[s.primary, (!value.trim() || loading) && s.disabled]}>{loading ? <ActivityIndicator color={colors.black} /> : <><Text style={s.primaryText}>{tr(locale, 'IMPORT & REVIEW', 'IMPORTEREN & CONTROLEREN')}</Text>{ico('arrow-forward', 19, colors.black)}</>}</Pressable>
        <Text style={s.privacy}>{ico('shield-checkmark-outline', 14, colors.muted)}  {tr(locale, 'Photo text stays on your device. Website import needs internet.', 'Tekst uit foto’s blijft op je toestel. Website-import heeft internet nodig.')}</Text>
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg }, top: { minHeight: 84, paddingHorizontal: 22, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, eyebrow: { color: colors.lime, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 }, title: { color: colors.cream, fontSize: 25, fontWeight: '900', marginTop: 3 }, close: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, tabs: { flexDirection: 'row', gap: 8, padding: 14 }, tab: { flex: 1, height: 45, borderRadius: 13, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }, tabActive: { backgroundColor: colors.lime, borderColor: colors.lime }, tabText: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: .5 }, tabTextActive: { color: colors.black }, cameraArea: { flex: 1, padding: 14 }, cameraFrame: { flex: 1, minHeight: 300, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.panel }, scanGuide: { position: 'absolute', left: '12%', right: '12%', top: '32%', height: 150, borderWidth: 2, borderColor: colors.lime, borderRadius: 18, justifyContent: 'center' }, scanLine: { height: 2, backgroundColor: colors.lime, marginHorizontal: 14 }, cameraCaption: { position: 'absolute', bottom: 28, alignSelf: 'center', paddingHorizontal: 18, height: 42, borderRadius: 21, backgroundColor: 'rgba(8,9,7,.82)', justifyContent: 'center' }, cameraCaptionText: { color: colors.cream, fontSize: 12, fontWeight: '800' }, manualBarcode: { height: 54, marginTop: 10, borderRadius: 16, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', paddingLeft: 14 }, manualBarcodeInput: { flex: 1, color: colors.cream, fontSize: 13 }, permissionCard: { marginTop: 20, padding: 28, borderRadius: 24, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: 'center' }, cardTitle: { color: colors.cream, fontSize: 17, fontWeight: '900', marginTop: 10 }, help: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 }, primary: { minHeight: 52, borderRadius: 15, backgroundColor: colors.lime, marginTop: 18, paddingHorizontal: 18, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: colors.black, fontSize: 11, fontWeight: '900', letterSpacing: .6 }, disabled: { opacity: .4 }, searchArea: { flex: 1, paddingHorizontal: 14 }, searchBox: { height: 52, borderRadius: 16, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, paddingLeft: 14, flexDirection: 'row', alignItems: 'center' }, searchInput: { flex: 1, color: colors.cream, paddingHorizontal: 10, fontSize: 13 }, searchGo: { width: 42, height: 42, marginRight: 4, borderRadius: 13, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }, source: { color: colors.muted, fontSize: 9, margin: 10 }, results: { paddingBottom: 30, gap: 8 }, empty: { color: colors.muted, textAlign: 'center', marginTop: 50, fontSize: 12 }, resultCard: { minHeight: 82, padding: 10, borderRadius: 16, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 11 }, productImage: { width: 60, height: 60, borderRadius: 12, backgroundColor: colors.panelSoft }, productFallback: { width: 60, height: 60, borderRadius: 12, backgroundColor: colors.panelSoft, alignItems: 'center', justifyContent: 'center' }, resultBody: { flex: 1 }, resultName: { color: colors.cream, fontSize: 13, fontWeight: '900' }, resultBrand: { color: colors.muted, fontSize: 10, marginTop: 2 }, macroRow: { flexDirection: 'row', gap: 9, marginTop: 7, flexWrap: 'wrap' }, macro: { color: colors.lime, fontSize: 9, fontWeight: '800' }, importContent: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 50 }, importHero: { padding: 18, borderRadius: 18, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', gap: 14, alignItems: 'flex-start' }, importHeroBody: { flex: 1 }, photoButton: { marginTop: 14, minHeight: 70, paddingHorizontal: 17, borderRadius: 17, backgroundColor: colors.lime, flexDirection: 'row', gap: 12, alignItems: 'center' }, photoButtonTitle: { color: colors.black, fontSize: 11, fontWeight: '900' }, photoButtonSub: { color: '#383D14', fontSize: 9, marginTop: 3 }, photoPreview: { width: '100%', height: 150, borderRadius: 17, marginTop: 10 }, importInput: { minHeight: 55, borderRadius: 16, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, color: colors.cream, padding: 15, textAlignVertical: 'top' }, importInputTall: { minHeight: 220 }, privacy: { color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: 16 }
});
