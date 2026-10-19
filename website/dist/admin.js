import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { collection, doc, getDoc, getDocs, getFirestore, onSnapshot, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const $ = selector => document.querySelector(selector);
const config = window.MAUGAINZ_SITE_CONFIG?.firebase || {};
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
const previewMode = ['127.0.0.1', 'localhost'].includes(location.hostname) && new URLSearchParams(location.search).has('preview');

let accountRows = [];
let publicRows = [];
let relationships = [];
let users = [];
let searchText = '';
let filter = 'all';
let coachingSearch = '';
let coachingFilter = 'all';
let unsubscribers = [];

const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const timestamp = value => value?.toDate?.()?.getTime?.() || value?.toMillis?.() || 0;
const formatDate = value => {
  const time = timestamp(value);
  return time ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(time) : 'Not yet';
};
const age = value => {
  const time = timestamp(value);
  if (!time) return 'Awaiting check-in';
  const minutes = Math.floor((Date.now() - time) / 60000);
  if (minutes < 2) return 'Now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};
const statusFor = value => {
  const time = timestamp(value);
  const difference = Date.now() - time;
  if (!time) return { label: 'Pending', className: '' };
  if (difference < 15 * 60 * 1000) return { label: 'Online', className: 'online' };
  if (difference < 7 * 86400000) return { label: 'Active', className: 'recent' };
  return { label: 'Inactive', className: '' };
};
const relationshipStatus = value => {
  const status = ['accepted', 'pending', 'revoked', 'rejected'].includes(value) ? value : 'pending';
  return { value: status, label: status === 'accepted' ? 'Active' : status[0].toUpperCase() + status.slice(1) };
};
const friendCode = (user, fallback = '') => user?.friendCode || fallback || '—';
const codeButton = code => code && code !== '—'
  ? `<button class="friend-code" type="button" data-copy-code="${esc(code)}" title="Copy friend code">${esc(code)}</button>`
  : '<span class="friend-code unavailable">—</span>';

function mergeUsers() {
  const map = new Map();
  for (const profile of publicRows) map.set(profile.id, { uid: profile.id, ...profile });
  for (const account of accountRows) map.set(account.id, { ...(map.get(account.id) || { uid: account.id }), ...account, uid: account.id });
  users = [...map.values()].sort((a, b) => (timestamp(b.lastSeen) || timestamp(b.createdAt)) - (timestamp(a.lastSeen) || timestamp(a.createdAt)));
  render();
}

function userIdentity(user, fallbackName, fallbackCode) {
  const name = user?.displayName || fallbackName || 'Unknown account';
  const email = user?.email || 'Account email unavailable';
  const code = friendCode(user, fallbackCode);
  return `<div class="person compact"><span class="avatar">${esc(name.slice(0, 1).toUpperCase())}</span><div><b>${esc(name)}</b><small>${esc(email)}</small><small class="inline-code">${esc(code)}</small></div></div>`;
}

function renderUsers(visible) {
  $('[data-users]').innerHTML = visible.map(user => {
    const status = statusFor(user.lastSeen);
    const name = user.displayName || 'MauGainZ athlete';
    const email = user.email || 'Email available after next sign-in';
    const platform = user.platform || 'Pending';
    const code = friendCode(user, user.uid);
    return `<tr>
      <td><div class="person"><span class="avatar">${esc(name.slice(0, 1).toUpperCase())}</span><div><b>${esc(name)}</b><small>${esc(email)}</small></div></div></td>
      <td>${codeButton(code)}</td>
      <td><span class="status ${status.className}">${status.label}</span></td>
      <td title="${esc(formatDate(user.lastSeen))}">${esc(age(user.lastSeen))}</td>
      <td><span class="platform">${esc(platform)}</span></td>
      <td>${esc(user.appVersion || '—')}</td>
      <td class="number">${Number.isFinite(user.recipeCount) ? user.recipeCount : '—'}</td>
      <td class="number">${Number.isFinite(user.diaryEntryCount) ? user.diaryEntryCount : '—'}</td>
      <td class="number">${Number.isFinite(user.savedIngredientCount) ? user.savedIngredientCount : '—'}</td>
    </tr>`;
  }).join('');
  $('[data-empty]').hidden = visible.length > 0;
  $('[data-visible-count]').textContent = `${visible.length} user${visible.length === 1 ? '' : 's'}`;
}

function renderCoaching() {
  const lookup = new Map(users.map(user => [user.uid, user]));
  const needle = coachingSearch.trim().toLowerCase();
  const visible = relationships
    .filter(item => coachingFilter === 'all' || item.status === coachingFilter)
    .filter(item => {
      if (!needle) return true;
      const coach = lookup.get(item.coachUid);
      const athlete = lookup.get(item.clientUid);
      return [
        coach?.displayName, coach?.email, friendCode(coach, item.coachCode),
        athlete?.displayName, athlete?.email, friendCode(athlete, item.clientCode),
        item.coachName, item.clientName, item.mode, item.status
      ].join(' ').toLowerCase().includes(needle);
    })
    .sort((a, b) => timestamp(b.acceptedAt || b.createdAt) - timestamp(a.acceptedAt || a.createdAt));

  $('[data-coaching]').innerHTML = visible.map(item => {
    const coach = lookup.get(item.coachUid);
    const athlete = lookup.get(item.clientUid);
    const status = relationshipStatus(item.status);
    const modeLabel = item.mode === 'managed' ? 'Fully managed' : 'Review only';
    const lastChange = item.revokedAt || item.acceptedAt || item.createdAt;
    return `<tr>
      <td>${userIdentity(coach, item.coachName, item.coachCode)}</td>
      <td class="relationship-arrow" aria-label="coaches">→</td>
      <td>${userIdentity(athlete, item.clientName, item.clientCode)}</td>
      <td><span class="access-badge ${item.mode === 'managed' ? 'managed' : ''}">${modeLabel}</span></td>
      <td><span class="relationship-status ${status.value}"><i></i>${status.label}</span></td>
      <td title="${esc(formatDate(item.acceptedAt || item.createdAt))}">${esc(formatDate(item.acceptedAt || item.createdAt))}</td>
      <td title="${esc(formatDate(lastChange))}">${esc(age(lastChange))}</td>
    </tr>`;
  }).join('');
  $('[data-coaching-empty]').hidden = visible.length > 0;
  $('[data-coaching-count]').textContent = `${visible.length} relationship${visible.length === 1 ? '' : 's'}`;
}

function render() {
  const weekAgo = Date.now() - 7 * 86400000;
  const known = users.filter(user => timestamp(user.lastSeen));
  const accepted = relationships.filter(item => item.status === 'accepted');
  const pending = relationships.filter(item => item.status === 'pending');
  const activeCoaches = new Set(accepted.map(item => item.coachUid)).size;

  $('[data-total]').textContent = users.length;
  $('[data-active]').textContent = users.filter(user => timestamp(user.lastSeen) >= weekAgo).length;
  $('[data-coaching-active]').textContent = accepted.length;
  $('[data-coaching-pending]').textContent = pending.length;
  $('[data-android]').textContent = known.filter(user => user.platform === 'android').length;
  $('[data-web]').textContent = known.filter(user => user.platform === 'web').length;
  $('[data-coach-count]').textContent = activeCoaches;
  $('[data-managed-count]').textContent = accepted.filter(item => item.mode === 'managed').length;

  const needle = searchText.trim().toLowerCase();
  const visible = users.filter(user => {
    const matches = !needle || `${user.displayName || ''} ${user.email || ''} ${user.friendCode || ''} ${user.uid}`.toLowerCase().includes(needle);
    if (!matches) return false;
    if (filter === 'active') return timestamp(user.lastSeen) >= weekAgo;
    if (filter === 'android' || filter === 'web') return user.platform === filter;
    if (filter === 'pending') return !timestamp(user.lastSeen);
    return true;
  });

  renderUsers(visible);
  renderCoaching();
}

function stopSubscriptions() {
  unsubscribers.forEach(unsubscribe => unsubscribe());
  unsubscribers = [];
}

async function ensureAdminProfile(user) {
  const reference = doc(db, 'accountProfiles', user.uid);
  const snapshot = await getDoc(reference);
  const name = user.displayName || user.email?.split('@')[0] || 'Administrator';
  await setDoc(reference, {
    uid: user.uid,
    email: user.email || '',
    displayName: name,
    friendCode: user.uid.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase(),
    lastSeen: serverTimestamp(),
    platform: 'web',
    appVersion: window.MAUGAINZ_SITE_CONFIG?.currentVersion || 'web',
    ...(!snapshot.exists() ? { createdAt: serverTimestamp() } : {})
  }, { merge: true });
}

async function openAdmin(user) {
  try {
    await Promise.all([
      getDocs(collection(db, 'accountProfiles')),
      getDocs(collection(db, 'publicProfiles')),
      getDocs(collection(db, 'coachingRelationships'))
    ]);
    await ensureAdminProfile(user);
    $('[data-auth]').hidden = true;
    $('[data-denied]').hidden = true;
    $('[data-admin]').hidden = false;
    $('[data-admin-email]').textContent = user.email || 'Administrator';
    stopSubscriptions();
    unsubscribers = [
      onSnapshot(collection(db, 'accountProfiles'), snapshot => {
        accountRows = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
        mergeUsers();
      }),
      onSnapshot(collection(db, 'publicProfiles'), snapshot => {
        publicRows = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
        mergeUsers();
      }),
      onSnapshot(collection(db, 'coachingRelationships'), snapshot => {
        relationships = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
        render();
      })
    ];
  } catch (error) {
    console.error(error);
    $('[data-auth]').hidden = true;
    $('[data-admin]').hidden = true;
    $('[data-denied]').hidden = false;
  }
}

function openLogin() {
  stopSubscriptions();
  $('[data-auth]').hidden = false;
  $('[data-admin]').hidden = true;
  $('[data-denied]').hidden = true;
}

$('[data-login-form]').onsubmit = async event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const button = event.currentTarget.querySelector('button');
  $('[data-login-error]').textContent = '';
  button.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, String(data.get('email') || '').trim(), String(data.get('password') || ''));
  } catch (error) {
    $('[data-login-error]').textContent = String(error?.message || 'Could not sign in.').replace(/^Firebase:\s*/i, '').replace(/\(auth\/.+?\)\.?/i, '').trim();
  } finally {
    button.disabled = false;
  }
};

$('[data-signout]').onclick = () => signOut(auth);
$('[data-denied-signout]').onclick = () => signOut(auth);
$('[data-search]').oninput = event => { searchText = event.target.value; render(); };
$('[data-filter]').onchange = event => { filter = event.target.value; render(); };
$('[data-coaching-search]').oninput = event => { coachingSearch = event.target.value; renderCoaching(); };
$('[data-coaching-filter]').onchange = event => { coachingFilter = event.target.value; renderCoaching(); };

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-copy-code]');
  if (!button) return;
  const code = button.dataset.copyCode;
  try {
    await navigator.clipboard.writeText(code);
    const previous = button.textContent;
    button.textContent = 'COPIED';
    button.classList.add('copied');
    setTimeout(() => {
      button.textContent = previous;
      button.classList.remove('copied');
    }, 1200);
  } catch {
    button.title = code;
  }
});

if (previewMode) {
  const mockTime = milliseconds => ({ toDate: () => new Date(milliseconds), toMillis: () => milliseconds });
  const now = Date.now();
  accountRows = [
    { id: 'preview-admin', uid: 'preview-admin', displayName: 'MauGainZ Owner', email: 'owner@example.com', friendCode: 'OWNER001', createdAt: mockTime(now - 90 * 86400000), lastSeen: mockTime(now - 3 * 60000), platform: 'web', appVersion: '2.5.0', recipeCount: 18, diaryEntryCount: 142, savedIngredientCount: 35 },
    { id: 'preview-phone', uid: 'preview-phone', displayName: 'Liam Power', email: 'liam@example.com', friendCode: 'LIAM0001', createdAt: mockTime(now - 28 * 86400000), lastSeen: mockTime(now - 2 * 86400000), platform: 'android', appVersion: '2.5.0', recipeCount: 9, diaryEntryCount: 61, savedIngredientCount: 22 },
    { id: 'preview-tablet', uid: 'preview-tablet', displayName: 'Noor Gains', email: 'noor@example.com', friendCode: 'NOOR0001', createdAt: mockTime(now - 9 * 86400000), lastSeen: mockTime(now - 10 * 86400000), platform: 'android', appVersion: '2.4.0', recipeCount: 4, diaryEntryCount: 19, savedIngredientCount: 8 }
  ];
  publicRows = [...accountRows, { id: 'preview-pending', uid: 'preview-pending', displayName: 'New athlete', friendCode: 'NEW00001', createdAt: mockTime(now - 86400000) }];
  relationships = [
    { id: 'preview-admin_preview-phone', coachUid: 'preview-admin', coachName: 'MauGainZ Owner', coachCode: 'OWNER001', clientUid: 'preview-phone', clientName: 'Liam Power', clientCode: 'LIAM0001', mode: 'managed', status: 'accepted', createdAt: mockTime(now - 18 * 86400000), acceptedAt: mockTime(now - 17 * 86400000) },
    { id: 'preview-admin_preview-tablet', coachUid: 'preview-admin', coachName: 'MauGainZ Owner', coachCode: 'OWNER001', clientUid: 'preview-tablet', clientName: 'Noor Gains', clientCode: 'NOOR0001', mode: 'shared', status: 'pending', createdAt: mockTime(now - 2 * 86400000) },
    { id: 'preview-phone_preview-pending', coachUid: 'preview-phone', coachName: 'Liam Power', coachCode: 'LIAM0001', clientUid: 'preview-pending', clientName: 'New athlete', clientCode: 'NEW00001', mode: 'managed', status: 'revoked', createdAt: mockTime(now - 25 * 86400000), acceptedAt: mockTime(now - 24 * 86400000), revokedAt: mockTime(now - 3 * 86400000) }
  ];
  $('[data-loading]').hidden = true;
  $('[data-auth]').hidden = true;
  $('[data-admin]').hidden = false;
  $('[data-admin-email]').textContent = 'owner@example.com';
  mergeUsers();
} else {
  onAuthStateChanged(auth, user => {
    $('[data-loading]').hidden = true;
    if (user) openAdmin(user);
    else openLogin();
  });
}
