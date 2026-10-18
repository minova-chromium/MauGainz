import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { createUserWithEmailAndPassword, getAuth, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { collection, deleteDoc, doc, getDoc, getFirestore, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const config = window.MAUGAINZ_SITE_CONFIG?.firebase || {};
const configured = Boolean(config.apiKey && config.projectId && config.appId);
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const loading = $("[data-loading]");
const authPage = $("[data-auth]");
const dashboard = $("[data-dashboard]");
const today = () => { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 10); };
const number = (value) => Number(value) || 0;
const friendCodeFor = (uid) => uid.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const emptyPayload = () => ({ version: 6, recipes: [], customCategories: [], goals: { weightKg: 80, goal: "maintain", calories: 2500, protein: 160, carbs: 300, fat: 75 }, plans: [], shopping: [], unitSystem: "metric", dailyTargets: [], weights: [], vitamins: [], savedIngredients: [], trainingDays: [], diaryEntries: [] });

let app;
let auth;
let db;
let currentUser = null;
let payload = emptyPayload();
let authMode = "login";
let saveTimer = 0;
let unsubscribeData = null;
let unsubscribeFriends = [];
let connections = [];
let shares = [];

function toast(message) {
  const node = $("[data-toast]");
  node.textContent = message;
  node.classList.add("is-visible");
  clearTimeout(node.toastTimer);
  node.toastTimer = setTimeout(() => node.classList.remove("is-visible"), 3200);
}

function setSync(state) {
  $$('[data-sync-dot]').forEach((node) => { node.classList.toggle('is-syncing', state === 'syncing'); node.classList.toggle('is-error', state === 'error'); });
  const label = $('[data-sync-label]');
  if (label) label.textContent = state === 'syncing' ? 'Syncing…' : state === 'error' ? 'Sync issue' : 'Synced';
}

function normalizePayload(value) {
  const base = emptyPayload();
  return { ...base, ...(value || {}), goals: { ...base.goals, ...(value?.goals || {}) }, recipes: Array.isArray(value?.recipes) ? value.recipes : [], diaryEntries: Array.isArray(value?.diaryEntries) ? value.diaryEntries : [], plans: Array.isArray(value?.plans) ? value.plans : [], trainingDays: Array.isArray(value?.trainingDays) ? value.trainingDays : [] };
}

async function saveData(immediate = false) {
  if (!currentUser) return;
  clearTimeout(saveTimer);
  const run = async () => {
    setSync('syncing');
    try { await setDoc(doc(db, 'users', currentUser.uid, 'data', 'main'), { payload: JSON.stringify(payload), schemaVersion: payload.version || 6, updatedAt: serverTimestamp() }, { merge: true }); setSync('synced'); }
    catch (error) { console.error(error); setSync('error'); toast('Your change is saved locally, but cloud sync failed.'); }
  };
  if (immediate) await run(); else saveTimer = setTimeout(run, 600);
}

function calculateToday() {
  const entries = payload.diaryEntries.filter((entry) => entry.date === today());
  return entries.reduce((total, entry) => ({ calories: total.calories + number(entry.macros?.calories), protein: total.protein + number(entry.macros?.protein), carbs: total.carbs + number(entry.macros?.carbs), fat: total.fat + number(entry.macros?.fat) }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function entryMarkup(entry, deletable = false) {
  return `<article class="entry"><div class="entry-icon">${entry.source === 'recipe' ? 'R' : 'P'}</div><div class="entry-main"><b>${escapeHtml(entry.name)}</b><small>${escapeHtml(entry.meal)} · ${number(entry.amount)} ${escapeHtml(entry.unit)}</small></div><div class="entry-macro"><b>${Math.round(number(entry.macros?.calories))}</b><small>KCAL</small></div>${deletable ? `<button class="entry-delete" data-delete-entry="${escapeHtml(entry.id)}" aria-label="Delete">×</button>` : ''}</article>`;
}

function renderOverview() {
  const totals = calculateToday();
  const target = number(payload.dailyTargets.find((item) => item.weekday === new Date().getDay())?.calories) || number(payload.goals.calories) || 2500;
  $('[data-today-kcal]').textContent = Math.round(totals.calories).toLocaleString();
  $('[data-kcal-target]').textContent = ` / ${target.toLocaleString()} KCAL`;
  $('[data-kcal-progress]').style.width = `${Math.min(100, target ? totals.calories / target * 100 : 0)}%`;
  $('[data-today-protein]').textContent = `${Math.round(totals.protein)}g`;
  $('[data-today-carbs]').textContent = `${Math.round(totals.carbs)}g`;
  $('[data-today-fat]').textContent = `${Math.round(totals.fat)}g`;
  $('[data-recipe-count]').textContent = payload.recipes.length;
  const entries = payload.diaryEntries.filter((entry) => entry.date === today()).sort((a, b) => number(b.createdAt) - number(a.createdAt));
  $('[data-meal-count]').textContent = entries.length;
  $('[data-training-today]').textContent = payload.trainingDays.find((item) => item.weekday === new Date().getDay())?.label || 'Rest';
  $('[data-recent-entries]').innerHTML = entries.length ? entries.slice(0, 5).map((entry) => entryMarkup(entry)).join('') : '<div class="empty-state">No meals logged today.<br>Add your first product or recipe.</div>';
}

function renderDiary() {
  const entries = payload.diaryEntries.filter((entry) => entry.date === today()).sort((a, b) => number(b.createdAt) - number(a.createdAt));
  $('[data-diary-total]').textContent = Math.round(entries.reduce((sum, entry) => sum + number(entry.macros?.calories), 0)).toLocaleString();
  $('[data-diary-entries]').innerHTML = entries.length ? entries.map((entry) => entryMarkup(entry, true)).join('') : '<div class="empty-state">Today’s diary is empty.</div>';
  $$('[data-delete-entry]').forEach((button) => button.addEventListener('click', () => { payload.diaryEntries = payload.diaryEntries.filter((entry) => entry.id !== button.dataset.deleteEntry); saveData(); renderAll(); }));
}

function renderRecipes() {
  const queryText = ($('[data-recipe-search]')?.value || '').trim().toLowerCase();
  const recipes = payload.recipes.filter((recipe) => `${recipe.title} ${recipe.titleNl || ''} ${recipe.category || ''}`.toLowerCase().includes(queryText));
  $('[data-recipes]').innerHTML = recipes.length ? recipes.map((recipe) => `<article class="recipe-card"><div class="recipe-icon">✦</div><h3>${escapeHtml(recipe.title)}</h3><p>${escapeHtml(recipe.subtitle || `${recipe.ingredients?.length || 0} ingredients`)}</p><div class="recipe-meta"><span>${number(recipe.prepTime)} MIN</span><span>${Math.round(number(recipe.macros?.calories))} KCAL</span><span>${Math.round(number(recipe.macros?.protein))}G P</span></div></article>`).join('') : '<div class="empty-state">No matching recipes.</div>';
}

function renderPlan() {
  const plans = [...payload.plans].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  $('[data-plans]').innerHTML = plans.length ? plans.slice(0, 20).map((item) => { const recipe = payload.recipes.find((entry) => entry.id === item.recipeId); return `<div class="plan-item"><div><b>${escapeHtml(recipe?.title || 'Recipe')}</b><small>${escapeHtml(item.date)} · ${escapeHtml(item.meal)}${item.tag ? ` · ${escapeHtml(item.tag)}` : ''}</small></div><span>${Math.round(number(recipe?.macros?.calories))} KCAL</span></div>`; }).join('') : '<div class="empty-state">Your meal plan is empty.</div>';
  const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  $('[data-training]').innerHTML = weekdays.map((day, index) => { const training = payload.trainingDays.find((item) => item.weekday === index); return `<div class="plan-item"><div><b>${day}</b><small>${escapeHtml(training?.label || 'Rest day')}</small></div><span>${training ? 'TRAIN' : 'REST'}</span></div>`; }).join('');
}

function renderFriendLists() {
  if (!currentUser) return;
  const incoming = connections.filter((item) => item.toUid === currentUser.uid && item.status === 'pending');
  const accepted = connections.filter((item) => item.status === 'accepted').map((item) => item.fromUid === currentUser.uid ? { uid: item.toUid, name: item.toName, code: item.toCode, requestId: item.id } : { uid: item.fromUid, name: item.fromName, code: item.fromCode, requestId: item.id });
  $('[data-friend-requests]').innerHTML = incoming.length ? incoming.map((item) => `<div class="friend-row"><div class="avatar">${escapeHtml(item.fromName.slice(0,1).toUpperCase())}</div><div><b>${escapeHtml(item.fromName)}</b><small>${escapeHtml(item.fromCode)}</small></div><button class="row-action" data-accept-friend="${escapeHtml(item.id)}">ACCEPT</button></div>`).join('') : '<div class="empty-state">No new requests.</div>';
  $('[data-friends]').innerHTML = accepted.length ? accepted.map((item) => `<div class="friend-row"><div class="avatar">${escapeHtml(item.name.slice(0,1).toUpperCase())}</div><div><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.code)}</small></div><span class="eyebrow">FRIEND</span></div>`).join('') : '<div class="empty-state">No friends yet.</div>';
  const friendSelect = $('[data-share-form] select[name="friend"]');
  friendSelect.innerHTML = `<option value="">Choose a friend</option>${accepted.map((item) => `<option value="${escapeHtml(item.uid)}">${escapeHtml(item.name)}</option>`).join('')}`;
  const recipeSelect = $('[data-share-form] select[name="recipe"]');
  recipeSelect.innerHTML = `<option value="">Choose a recipe</option>${payload.recipes.map((recipe) => `<option value="${escapeHtml(recipe.id)}">${escapeHtml(recipe.title)}</option>`).join('')}`;
  $('[data-shared-recipes]').innerHTML = shares.filter((item) => item.status === 'pending').length ? shares.filter((item) => item.status === 'pending').map((item) => { let recipe = {}; try { recipe = JSON.parse(item.recipeJson); } catch {} return `<div class="share-row"><div><b>${escapeHtml(recipe.title || 'Shared recipe')}</b><small>From ${escapeHtml(item.fromName)}</small></div><button class="row-action" data-accept-share="${escapeHtml(item.id)}">ADD</button></div>`; }).join('') : '<div class="empty-state">Recipes shared with you appear here.</div>';
  $$('[data-accept-friend]').forEach((button) => button.addEventListener('click', async () => { await updateDoc(doc(db, 'friendRequests', button.dataset.acceptFriend), { status: 'accepted', acceptedAt: serverTimestamp() }); toast('Friend added.'); }));
  $$('[data-accept-share]').forEach((button) => button.addEventListener('click', async () => { const item = shares.find((entry) => entry.id === button.dataset.acceptShare); if (!item) return; const recipe = JSON.parse(item.recipeJson); payload.recipes.unshift({ ...recipe, id: `shared-${Date.now()}`, favorite: false, createdAt: Date.now() }); await Promise.all([saveData(true), updateDoc(doc(db, 'recipeShares', item.id), { status: 'accepted', acceptedAt: serverTimestamp() })]); toast('Recipe added to your cookbook.'); renderAll(); }));
}

function renderAll() { renderOverview(); renderDiary(); renderRecipes(); renderPlan(); renderFriendLists(); }

function showView(name) {
  const titles = { overview: 'Command center', diary: 'Food diary', recipes: 'My cookbook', plan: 'Meal & training plan', friends: 'Friends & sharing' };
  $$('[data-view]').forEach((button) => button.classList.toggle('is-active', button.dataset.view === name));
  $$('[data-view-panel]').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.viewPanel === name));
  $('[data-view-title]').textContent = titles[name] || 'MauGainZ';
  $('.sidebar').classList.remove('is-open');
}

function connectionFromSnapshot(snapshot) {
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
}

function subscribeFriends(user) {
  unsubscribeFriends.forEach((unsubscribe) => unsubscribe());
  let incoming = [];
  let outgoing = [];
  const combine = () => { connections = [...incoming, ...outgoing]; renderFriendLists(); };
  unsubscribeFriends = [
    onSnapshot(query(collection(db, 'friendRequests'), where('toUid', '==', user.uid)), (snapshot) => { incoming = connectionFromSnapshot(snapshot); combine(); }),
    onSnapshot(query(collection(db, 'friendRequests'), where('fromUid', '==', user.uid)), (snapshot) => { outgoing = connectionFromSnapshot(snapshot); combine(); }),
    onSnapshot(query(collection(db, 'recipeShares'), where('toUid', '==', user.uid)), (snapshot) => { shares = connectionFromSnapshot(snapshot).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)); renderFriendLists(); })
  ];
}

async function ensureProfile(user) {
  const code = friendCodeFor(user.uid);
  const displayName = user.displayName || user.email?.split('@')[0] || 'Athlete';
  await Promise.all([
    setDoc(doc(db, 'publicProfiles', user.uid), { uid: user.uid, displayName, friendCode: code, updatedAt: serverTimestamp() }, { merge: true }),
    setDoc(doc(db, 'friendCodes', code), { uid: user.uid, displayName, friendCode: code, updatedAt: serverTimestamp() }, { merge: true })
  ]);
  return { code, displayName };
}

function openDashboard(user, profile) {
  currentUser = user;
  authPage.hidden = true;
  dashboard.hidden = false;
  $('[data-user-name]').textContent = profile.displayName;
  $('[data-user-email]').textContent = user.email || '';
  $('[data-avatar]').textContent = profile.displayName.slice(0,1).toUpperCase();
  $('[data-friend-code]').textContent = profile.code;
  $('[data-date-label]').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()).toUpperCase();
  unsubscribeData?.();
  unsubscribeData = onSnapshot(doc(db, 'users', user.uid, 'data', 'main'), async (snapshot) => {
    if (!snapshot.exists()) { payload = emptyPayload(); await saveData(true); }
    else { try { payload = normalizePayload(JSON.parse(snapshot.data().payload || '{}')); setSync('synced'); } catch { payload = emptyPayload(); setSync('error'); } }
    renderAll();
  }, () => setSync('error'));
  subscribeFriends(user);
}

function openAuth() {
  currentUser = null;
  unsubscribeData?.();
  unsubscribeFriends.forEach((unsubscribe) => unsubscribe());
  dashboard.hidden = true;
  authPage.hidden = false;
}

function setAuthMode(mode) {
  authMode = mode;
  $$('[data-auth-mode]').forEach((button) => button.classList.toggle('is-active', button.dataset.authMode === mode));
  $('[data-name-field]').hidden = mode !== 'signup';
  $('[data-auth-submit]').firstChild.textContent = mode === 'signup' ? 'CREATE ACCOUNT ' : 'SIGN IN ';
  $('[data-reset-password]').hidden = mode !== 'login';
  const password = $('[data-auth-form] [name="password"]');
  password.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
}

$$('[data-auth-mode]').forEach((button) => button.addEventListener('click', () => setAuthMode(button.dataset.authMode)));
$$('[data-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
$('[data-mobile-menu]')?.addEventListener('click', () => $('.sidebar').classList.toggle('is-open'));
$('[data-go-diary]')?.addEventListener('click', () => showView('diary'));
$('[data-recipe-search]')?.addEventListener('input', renderRecipes);

$('[data-auth-form]').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!configured) { $('[data-auth-error]').textContent = 'The MauGainZ account server is not configured yet.'; return; }
  const data = new FormData(event.currentTarget);
  const email = String(data.get('email') || '').trim();
  const password = String(data.get('password') || '');
  const displayName = String(data.get('displayName') || '').trim();
  $('[data-auth-error]').textContent = '';
  $('[data-auth-submit]').disabled = true;
  try {
    if (authMode === 'signup') {
      if (displayName.length < 2) throw new Error('Choose a display name.');
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName });
      await ensureProfile(result.user);
    } else await signInWithEmailAndPassword(auth, email, password);
  } catch (error) { $('[data-auth-error]').textContent = String(error?.message || 'Could not continue.').replace(/^Firebase:\s*/i, '').replace(/\(auth\/.+?\)\.?/i, '').trim(); }
  finally { $('[data-auth-submit]').disabled = false; }
});

$('[data-reset-password]').addEventListener('click', async () => { const email = $('[data-auth-form] [name="email"]').value.trim(); if (!email) { $('[data-auth-error]').textContent = 'Enter your email first.'; return; } try { await sendPasswordResetEmail(auth, email); toast('Password reset email sent.'); } catch { $('[data-auth-error]').textContent = 'Could not send the reset email.'; } });
$('[data-sign-out]').addEventListener('click', () => signOut(auth));
$('[data-copy-code]').addEventListener('click', async () => { await navigator.clipboard.writeText($('[data-friend-code]').textContent); toast('Friend code copied.'); });

$('[data-food-form]').addEventListener('submit', (event) => {
  event.preventDefault(); const data = new FormData(event.currentTarget); const createdAt = Date.now();
  payload.diaryEntries.unshift({ id: `web-${createdAt}`, date: today(), meal: String(data.get('meal')), source: 'product', name: String(data.get('name')).trim(), amount: number(data.get('amount')), unit: String(data.get('unit')), macros: { calories: number(data.get('calories')), protein: number(data.get('protein')), carbs: number(data.get('carbs')), fat: number(data.get('fat')), fiber: 0 }, createdAt });
  event.currentTarget.reset(); event.currentTarget.amount.value = '1'; saveData(); renderAll(); toast('Added to today’s diary.');
});

$('[data-friend-form]').addEventListener('submit', async (event) => {
  event.preventDefault(); const code = String(new FormData(event.currentTarget).get('code') || '').replace(/[^a-z0-9]/gi, '').toUpperCase(); if (!code) return;
  try { const codeDocument = await getDoc(doc(db, 'friendCodes', code)); if (!codeDocument.exists()) throw new Error('not-found'); const target = codeDocument.data(); if (target.uid === currentUser.uid) throw new Error('self'); await setDoc(doc(db, 'friendRequests', `${currentUser.uid}_${target.uid}`), { fromUid: currentUser.uid, fromName: currentUser.displayName || currentUser.email.split('@')[0], fromCode: friendCodeFor(currentUser.uid), toUid: target.uid, toName: target.displayName, toCode: code, status: 'pending', createdAt: serverTimestamp() }); event.currentTarget.reset(); toast('Friend request sent.'); }
  catch (error) { toast(error.message === 'self' ? 'That is your own code.' : 'Friend code not found.'); }
});

$('[data-share-form]').addEventListener('submit', async (event) => {
  event.preventDefault(); const data = new FormData(event.currentTarget); const friendUid = String(data.get('friend') || ''); const recipe = payload.recipes.find((item) => item.id === String(data.get('recipe') || '')); const friend = connections.find((item) => item.status === 'accepted' && (item.fromUid === friendUid || item.toUid === friendUid)); if (!friendUid || !recipe || !friend) return;
  await setDoc(doc(db, 'recipeShares', `${currentUser.uid}_${friendUid}_${Date.now()}`), { fromUid: currentUser.uid, fromName: currentUser.displayName || currentUser.email.split('@')[0], toUid: friendUid, recipeJson: JSON.stringify(recipe), status: 'pending', createdAt: serverTimestamp() }); toast('Recipe shared.'); event.currentTarget.reset();
});

if (!configured) {
  loading.hidden = true; authPage.hidden = false; $('[data-auth-error]').textContent = 'The MauGainZ account server is being connected. Please try again shortly.';
} else {
  app = initializeApp(config); auth = getAuth(app); db = getFirestore(app);
  onAuthStateChanged(auth, async (user) => {
    loading.hidden = true;
    if (!user) { openAuth(); return; }
    try { const profile = await ensureProfile(user); openDashboard(user, profile); }
    catch (error) { console.error(error); openAuth(); $('[data-auth-error]').textContent = 'Could not open your account data.'; }
  });
}
