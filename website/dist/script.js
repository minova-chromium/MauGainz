"use strict";

const translations = {
  en: {
    navSystem: "The system", navScreens: "Phone & tablet", navInstall: "Install", download: "Download",
    available: "Available for Android", heroLineOne: "Build your fuel.", heroLineTwo: "Own every gram.",
    heroLede: "Recipes, verified nutrition, meal planning and training structure—built into one focused Android app for people who take progress seriously.",
    downloadApk: "Download Android APK", explore: "Explore MauGainZ", phoneTablet: "Phone + tablet", languages: "English + Dutch", updates: "Built-in updates", seeSystem: "See the system",
    oneSystem: "One performance system", moreThanRecipes: "More than a", cookbook: "cookbook.",
    manifestoCopy: "MauGainZ connects the food you prepare with the targets you train for. Build a recipe once, confirm its nutrition and reuse accurate numbers throughout your week.",
    baseIngredients: "base ingredients", languagesShort: "languages", focusedApp: "focused app",
    featureRecipes: "Build recipes your way", featureRecipesCopy: "Choose ingredients, enter exact amounts, reorder steps and scale every quantity automatically when servings change.",
    featureMacros: "Know the real numbers", featureMacrosCopy: "Confirm nutrition from Open Food Facts or enter your own values. MauGainZ remembers them for future calculations.",
    featurePlan: "Plan beyond the plate", featurePlanCopy: "Set daily calorie and macro goals, plan meals, track weight and add Push, Pull or Legs to your training week.",
    builtForScreens: "Built for your screens", fromPocket: "From pocket", toCountertop: "to countertop.",
    screensCopy: "The layout responds to the screen in front of you: fast bottom navigation on a phone, and a wide workspace that uses the full tablet display.",
    recipeBuilder: "RECIPE BUILDER", allInView: "Everything in view.", allInViewCopy: "On tablets, ingredients, preparation and macros sit together in a true working canvas. Collapse sections when the recipe gets long.",
    dragDrop: "Drag-and-drop ordering", portionScale: "Automatic portion scaling", importRecipes: "Import from websites, photos or text",
    ingredientLibrary: "INGREDIENT LIBRARY", numbersStayYours: "Your numbers stay yours.", numbersStayYoursCopy: "Browse the built-in library separately from your custom ingredients. Edit macros, add label values and reuse confirmed nutrition in every recipe.",
    accentSearch: "Accent-insensitive search", barcodeLookup: "Barcode and product lookup", baseCustomTabs: "Separate base and custom tabs",
    androidInstaller: "Android installer", readyTo: "Ready to", fuelGains: "fuel your gains?", installCopy: "Download the official universal APK. The same installer adapts automatically to Android phones and tablets.",
    installNote: "Android may ask permission to install apps from your browser the first time. You remain in control of the final confirmation.", latest: "LATEST", version: "Version", format: "Format", fileSize: "File size", devices: "Devices", phoneTabShort: "Phone / tablet",
    installationGuide: "Installation guide", releaseNotes: "Release notes", closingEyebrow: "COOK. TRACK. TRAIN. REPEAT.", progressHas: "Progress has", recipe: "a recipe.", getMaugainz: "Get MauGainZ",
    footerCopy: "The all-around performance cookbook for Android.", installTitle: "Install MauGainZ", stepOne: "Download the APK", stepOneCopy: "Tap the download button and wait for the file to finish.", stepTwo: "Allow this source", stepTwoCopy: "If Android asks, allow your browser to install this app.", stepThree: "Confirm and open", stepThreeCopy: "Review Android’s prompt, install MauGainZ and start building your fuel.", protein: "protein",
    releaseReady: "Latest official release detected."
  },
  nl: {
    navSystem: "Het systeem", navScreens: "Telefoon & tablet", navInstall: "Installeren", download: "Download",
    available: "Beschikbaar voor Android", heroLineOne: "Bouw je brandstof.", heroLineTwo: "Beheers elke gram.",
    heroLede: "Recepten, geverifieerde voeding, maaltijdplanning en trainingsstructuur—samengebracht in één doelgerichte Android-app voor mensen die vooruitgang serieus nemen.",
    downloadApk: "Download Android-APK", explore: "Ontdek MauGainZ", phoneTablet: "Telefoon + tablet", languages: "Engels + Nederlands", updates: "Ingebouwde updates", seeSystem: "Bekijk het systeem",
    oneSystem: "Eén prestatiesysteem", moreThanRecipes: "Meer dan een", cookbook: "kookboek.",
    manifestoCopy: "MauGainZ verbindt wat je klaarmaakt met de doelen waarvoor je traint. Bouw een recept één keer, bevestig de voedingswaarden en hergebruik nauwkeurige cijfers in je hele week.",
    baseIngredients: "basisingrediënten", languagesShort: "talen", focusedApp: "gerichte app",
    featureRecipes: "Bouw recepten op jouw manier", featureRecipesCopy: "Kies ingrediënten, geef exacte hoeveelheden in, verplaats stappen en schaal alles automatisch wanneer porties veranderen.",
    featureMacros: "Ken de echte cijfers", featureMacrosCopy: "Bevestig voeding via Open Food Facts of vul je eigen waarden in. MauGainZ onthoudt ze voor toekomstige berekeningen.",
    featurePlan: "Plan verder dan je bord", featurePlanCopy: "Bepaal dagelijkse calorie- en macrodoelen, plan maaltijden, volg je gewicht en zet Push, Pull of Legs in je trainingsweek.",
    builtForScreens: "Gebouwd voor jouw schermen", fromPocket: "Van broekzak", toCountertop: "tot keukenblad.",
    screensCopy: "De indeling past zich aan het scherm aan: snelle ondernavigatie op je telefoon en een brede werkruimte die je volledige tabletscherm benut.",
    recipeBuilder: "RECEPTBOUWER", allInView: "Alles in beeld.", allInViewCopy: "Op tablets staan ingrediënten, bereiding en macro’s samen in één echte werkruimte. Klap onderdelen in wanneer het recept lang wordt.",
    dragDrop: "Volgorde via slepen", portionScale: "Automatisch porties schalen", importRecipes: "Importeer van websites, foto’s of tekst",
    ingredientLibrary: "INGREDIËNTENBIBLIOTHEEK", numbersStayYours: "Jouw cijfers blijven van jou.", numbersStayYoursCopy: "Bekijk de ingebouwde bibliotheek apart van je eigen ingrediënten. Pas macro’s aan, voeg etiketwaarden toe en hergebruik bevestigde voeding in elk recept.",
    accentSearch: "Zoeken zonder verplichte accenten", barcodeLookup: "Barcode- en productzoekfunctie", baseCustomTabs: "Aparte basis- en eigen tabbladen",
    androidInstaller: "Android-installatie", readyTo: "Klaar om", fuelGains: "je gains te voeden?", installCopy: "Download de officiële universele APK. Dezelfde installatie past zich automatisch aan Android-telefoons en tablets aan.",
    installNote: "Android kan de eerste keer toestemming vragen om apps vanuit je browser te installeren. Jij bevestigt altijd zelf de uiteindelijke installatie.", latest: "NIEUWSTE", version: "Versie", format: "Formaat", fileSize: "Bestandsgrootte", devices: "Toestellen", phoneTabShort: "Telefoon / tablet",
    installationGuide: "Installatiegids", releaseNotes: "Release-info", closingEyebrow: "KOOK. VOLG. TRAIN. HERHAAL.", progressHas: "Vooruitgang heeft", recipe: "een recept.", getMaugainz: "Download MauGainZ",
    footerCopy: "Het complete prestatiekookboek voor Android.", installTitle: "Installeer MauGainZ", stepOne: "Download de APK", stepOneCopy: "Tik op de downloadknop en wacht tot het bestand klaar is.", stepTwo: "Sta deze bron toe", stepTwoCopy: "Geef je browser toestemming wanneer Android daarom vraagt.", stepThree: "Bevestig en open", stepThreeCopy: "Controleer de Android-melding, installeer MauGainZ en bouw je brandstof.", protein: "eiwit",
    releaseReady: "Nieuwste officiële release gevonden."
  }
};

const config = window.MAUGAINZ_SITE_CONFIG || {};
let activeLanguage = localStorage.getItem("maugainz-language") || (navigator.language.toLowerCase().startsWith("nl") ? "nl" : "en");

function applyLanguage(language) {
  activeLanguage = translations[language] ? language : "en";
  document.documentElement.lang = activeLanguage;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const value = translations[activeLanguage][node.dataset.i18n];
    if (value) node.textContent = value;
  });
  document.querySelectorAll("[data-language]").forEach((button) => button.classList.toggle("is-active", button.dataset.language === activeLanguage));
  localStorage.setItem("maugainz-language", activeLanguage);
}

function applyRelease(version, url, size) {
  if (version) document.querySelectorAll("[data-release-version]").forEach((node) => { node.textContent = version; });
  if (url) document.querySelectorAll("[data-download-link]").forEach((link) => { link.href = url; });
  if (size) document.querySelectorAll("[data-release-size]").forEach((node) => { node.textContent = size; });
  const status = document.querySelector("[data-release-status]");
  if (status) status.textContent = translations[activeLanguage].releaseReady;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return config.fallbackSize || "";
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

async function refreshRelease() {
  applyRelease(config.currentVersion, config.fallbackApkUrl, config.fallbackSize);
  try {
    const response = await fetch(config.latestReleaseApiUrl, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) return;
    const release = await response.json();
    const apk = Array.isArray(release.assets) ? release.assets.find((asset) => /\.apk$/i.test(asset.name || "")) : null;
    applyRelease(String(release.tag_name || "").replace(/^v/i, ""), apk?.browser_download_url || config.fallbackApkUrl, formatBytes(apk?.size));
  } catch (_) {
    // The stable fallback remains fully usable if GitHub is temporarily unavailable.
  }
}

document.querySelectorAll("[data-language]").forEach((button) => button.addEventListener("click", () => applyLanguage(button.dataset.language)));

const header = document.querySelector("[data-header]");
window.addEventListener("scroll", () => header?.classList.toggle("is-scrolled", window.scrollY > 24), { passive: true });

const dialog = document.querySelector("[data-install-dialog]");
document.querySelector("[data-open-guide]")?.addEventListener("click", () => dialog?.showModal());
document.querySelector("[data-close-guide]")?.addEventListener("click", () => dialog?.close());
dialog?.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); } });
}, { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((node) => observer.observe(node));

document.querySelectorAll("[data-year]").forEach((node) => { node.textContent = String(new Date().getFullYear()); });
applyLanguage(activeLanguage);
refreshRelease();
