import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackupPayload } from './cloudSync';
import { firebaseConfig } from './firebaseConfig';
import { Recipe } from './types';

const API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? firebaseConfig.apiKey;
const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? firebaseConfig.projectId;
const AUTH_KEY = '@maugainz/account-auth-v1';
const DATA_OWNER_KEY = '@maugainz/account-data-owner-v1';

export const accountCloudConfigured = Boolean(API_KEY && PROJECT_ID);

export type AccountUser = {
  uid: string;
  email: string;
  displayName: string;
  friendCode: string;
};

type StoredAuth = AccountUser & {
  idToken: string;
  refreshToken: string;
  expiresAt: number;
};

export type FriendConnection = {
  id: string;
  uid: string;
  displayName: string;
  friendCode: string;
  direction: 'incoming' | 'outgoing';
  status: 'pending' | 'accepted';
};

export type SharedRecipe = {
  id: string;
  fromUid: string;
  fromName: string;
  recipe: Recipe;
  status: 'pending' | 'accepted';
  createdAt: number;
};

type FirestoreField = { stringValue?: string; integerValue?: string; timestampValue?: string; booleanValue?: boolean };
type FirestoreDocument = { name?: string; fields?: Record<string, FirestoreField> };

const authUrl = (action: string) => `https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${API_KEY}`;
const refreshUrl = `https://securetoken.googleapis.com/v1/token?key=${API_KEY}`;
const documentUrl = (path: string) => `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
const queryUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
const docId = (document: FirestoreDocument) => document.name?.split('/').pop() ?? '';
const textField = (document: FirestoreDocument, key: string) => document.fields?.[key]?.stringValue ?? '';
const timeField = (document: FirestoreDocument, key: string) => Date.parse(document.fields?.[key]?.timestampValue ?? '') || 0;
const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
const makeFriendCode = (uid: string) => uid.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase();

async function saveAuth(auth: StoredAuth) {
  await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  return auth;
}

async function requestAuth(action: string, body: Record<string, unknown>) {
  if (!accountCloudConfigured) throw new Error('unconfigured');
  const response = await fetch(authUrl(action), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, returnSecureToken: true }) });
  const json = await response.json() as { localId?: string; email?: string; displayName?: string; idToken?: string; refreshToken?: string; expiresIn?: string; error?: { message?: string } };
  if (!response.ok || !json.idToken || !json.refreshToken || !json.localId) throw new Error(json.error?.message ?? 'auth');
  return json;
}

async function validAuth(): Promise<StoredAuth> {
  if (!accountCloudConfigured) throw new Error('unconfigured');
  const raw = await AsyncStorage.getItem(AUTH_KEY);
  if (!raw) throw new Error('signed-out');
  const stored = JSON.parse(raw) as StoredAuth;
  if (stored.expiresAt > Date.now() + 90_000) return stored;
  const response = await fetch(refreshUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(stored.refreshToken)}` });
  const json = await response.json() as { id_token?: string; refresh_token?: string; expires_in?: string };
  if (!response.ok || !json.id_token || !json.refresh_token) { await AsyncStorage.removeItem(AUTH_KEY); throw new Error('session-expired'); }
  return saveAuth({ ...stored, idToken: json.id_token, refreshToken: json.refresh_token, expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000 });
}

async function writeProfile(auth: StoredAuth) {
  const now = new Date().toISOString();
  const profile = { fields: { uid: { stringValue: auth.uid }, displayName: { stringValue: auth.displayName }, friendCode: { stringValue: auth.friendCode }, updatedAt: { timestampValue: now } } };
  const code = { fields: { uid: { stringValue: auth.uid }, displayName: { stringValue: auth.displayName }, friendCode: { stringValue: auth.friendCode }, updatedAt: { timestampValue: now } } };
  const [profileResponse, codeResponse] = await Promise.all([
    fetch(documentUrl(`publicProfiles/${auth.uid}`), { method: 'PATCH', headers: authHeaders(auth.idToken), body: JSON.stringify(profile) }),
    fetch(documentUrl(`friendCodes/${auth.friendCode}`), { method: 'PATCH', headers: authHeaders(auth.idToken), body: JSON.stringify(code) })
  ]);
  if (!profileResponse.ok || !codeResponse.ok) throw new Error('profile');
}

export async function signUpAccount(email: string, password: string, displayName: string): Promise<AccountUser> {
  const name = displayName.trim();
  if (name.length < 2) throw new Error('display-name');
  const json = await requestAuth('signUp', { email: email.trim(), password });
  const update = await fetch(authUrl('update'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: json.idToken, displayName: name, returnSecureToken: true }) });
  const updated = await update.json() as { idToken?: string; refreshToken?: string; expiresIn?: string; localId?: string; email?: string; displayName?: string };
  const uid = updated.localId ?? json.localId!;
  const auth = await saveAuth({ uid, email: updated.email ?? json.email ?? email.trim(), displayName: updated.displayName ?? name, friendCode: makeFriendCode(uid), idToken: updated.idToken ?? json.idToken!, refreshToken: updated.refreshToken ?? json.refreshToken!, expiresAt: Date.now() + Number(updated.expiresIn ?? json.expiresIn ?? 3600) * 1000 });
  await writeProfile(auth);
  return auth;
}

export async function signInAccount(email: string, password: string): Promise<AccountUser> {
  const json = await requestAuth('signInWithPassword', { email: email.trim(), password });
  const uid = json.localId!;
  const auth = await saveAuth({ uid, email: json.email ?? email.trim(), displayName: json.displayName?.trim() || email.trim().split('@')[0] || 'Athlete', friendCode: makeFriendCode(uid), idToken: json.idToken!, refreshToken: json.refreshToken!, expiresAt: Date.now() + Number(json.expiresIn ?? 3600) * 1000 });
  await writeProfile(auth);
  return auth;
}

export async function restoreAccount(): Promise<AccountUser | null> {
  try { return await validAuth(); } catch { return null; }
}

export async function signOutAccount() {
  await AsyncStorage.removeItem(AUTH_KEY);
}

export async function sendPasswordReset(email: string) {
  if (!accountCloudConfigured) throw new Error('unconfigured');
  const response = await fetch(authUrl('sendOobCode'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestType: 'PASSWORD_RESET', email: email.trim() }) });
  if (!response.ok) throw new Error('reset');
}

export async function uploadAccountData(payload: BackupPayload) {
  const auth = await validAuth();
  const response = await fetch(documentUrl(`users/${auth.uid}/data/main`), { method: 'PATCH', headers: authHeaders(auth.idToken), body: JSON.stringify({ fields: { payload: { stringValue: JSON.stringify(payload) }, updatedAt: { timestampValue: new Date().toISOString() }, schemaVersion: { integerValue: String(payload.version) } } }) });
  if (!response.ok) throw new Error('sync');
  await AsyncStorage.setItem(DATA_OWNER_KEY, auth.uid);
  return Date.now();
}

export async function getAccountDataOwner() {
  return AsyncStorage.getItem(DATA_OWNER_KEY);
}

export async function downloadAccountData(): Promise<{ payload: BackupPayload; updatedAt: number } | null> {
  const auth = await validAuth();
  const response = await fetch(documentUrl(`users/${auth.uid}/data/main`), { headers: authHeaders(auth.idToken) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('sync');
  const document = await response.json() as FirestoreDocument;
  const payload = textField(document, 'payload');
  if (!payload) return null;
  await AsyncStorage.setItem(DATA_OWNER_KEY, auth.uid);
  return { payload: JSON.parse(payload) as BackupPayload, updatedAt: timeField(document, 'updatedAt') };
}

async function runFieldQuery(collectionId: string, fieldPath: string, value: string): Promise<FirestoreDocument[]> {
  const auth = await validAuth();
  const response = await fetch(queryUrl, { method: 'POST', headers: authHeaders(auth.idToken), body: JSON.stringify({ structuredQuery: { from: [{ collectionId }], where: { fieldFilter: { field: { fieldPath }, op: 'EQUAL', value: { stringValue: value } } }, limit: 100 } }) });
  if (!response.ok) throw new Error('query');
  const rows = await response.json() as { document?: FirestoreDocument }[];
  return rows.flatMap((row) => row.document ? [row.document] : []);
}

export async function sendFriendRequest(friendCode: string) {
  const auth = await validAuth();
  const code = friendCode.replace(/[^a-z0-9]/gi, '').toUpperCase();
  const lookup = await fetch(documentUrl(`friendCodes/${code}`), { headers: authHeaders(auth.idToken) });
  if (lookup.status === 404) throw new Error('friend-not-found');
  if (!lookup.ok) throw new Error('friend');
  const target = await lookup.json() as FirestoreDocument;
  const toUid = textField(target, 'uid');
  if (!toUid || toUid === auth.uid) throw new Error('self');
  const id = `${auth.uid}_${toUid}`;
  const response = await fetch(documentUrl(`friendRequests/${id}`), { method: 'PATCH', headers: authHeaders(auth.idToken), body: JSON.stringify({ fields: { fromUid: { stringValue: auth.uid }, fromName: { stringValue: auth.displayName }, fromCode: { stringValue: auth.friendCode }, toUid: { stringValue: toUid }, toName: { stringValue: textField(target, 'displayName') }, toCode: { stringValue: code }, status: { stringValue: 'pending' }, createdAt: { timestampValue: new Date().toISOString() } } }) });
  if (!response.ok) throw new Error('friend');
}

export async function listFriends(): Promise<FriendConnection[]> {
  const auth = await validAuth();
  const [incoming, outgoing] = await Promise.all([runFieldQuery('friendRequests', 'toUid', auth.uid), runFieldQuery('friendRequests', 'fromUid', auth.uid)]);
  return [
    ...incoming.map((document): FriendConnection => ({ id: docId(document), uid: textField(document, 'fromUid'), displayName: textField(document, 'fromName'), friendCode: textField(document, 'fromCode'), direction: 'incoming', status: textField(document, 'status') === 'accepted' ? 'accepted' : 'pending' })),
    ...outgoing.map((document): FriendConnection => ({ id: docId(document), uid: textField(document, 'toUid'), displayName: textField(document, 'toName'), friendCode: textField(document, 'toCode'), direction: 'outgoing', status: textField(document, 'status') === 'accepted' ? 'accepted' : 'pending' }))
  ];
}

export async function respondToFriendRequest(id: string, accept: boolean) {
  const auth = await validAuth();
  if (!accept) {
    const response = await fetch(documentUrl(`friendRequests/${id}`), { method: 'DELETE', headers: authHeaders(auth.idToken) });
    if (!response.ok) throw new Error('friend');
    return;
  }
  const response = await fetch(`${documentUrl(`friendRequests/${id}`)}?updateMask.fieldPaths=status&updateMask.fieldPaths=acceptedAt`, { method: 'PATCH', headers: authHeaders(auth.idToken), body: JSON.stringify({ fields: { status: { stringValue: 'accepted' }, acceptedAt: { timestampValue: new Date().toISOString() } } }) });
  if (!response.ok) throw new Error('friend');
}

export async function shareRecipeWithFriend(friend: FriendConnection, recipe: Recipe) {
  const auth = await validAuth();
  const id = `${auth.uid}_${friend.uid}_${Date.now()}`;
  const response = await fetch(documentUrl(`recipeShares/${id}`), { method: 'PATCH', headers: authHeaders(auth.idToken), body: JSON.stringify({ fields: { fromUid: { stringValue: auth.uid }, fromName: { stringValue: auth.displayName }, toUid: { stringValue: friend.uid }, recipeJson: { stringValue: JSON.stringify(recipe) }, status: { stringValue: 'pending' }, createdAt: { timestampValue: new Date().toISOString() } } }) });
  if (!response.ok) throw new Error('share');
}

export async function listSharedRecipes(): Promise<SharedRecipe[]> {
  const auth = await validAuth();
  const documents = await runFieldQuery('recipeShares', 'toUid', auth.uid);
  return documents.map((document): SharedRecipe => ({ id: docId(document), fromUid: textField(document, 'fromUid'), fromName: textField(document, 'fromName'), recipe: JSON.parse(textField(document, 'recipeJson')) as Recipe, status: textField(document, 'status') === 'accepted' ? 'accepted' : 'pending', createdAt: timeField(document, 'createdAt') })).sort((a, b) => b.createdAt - a.createdAt);
}

export async function markSharedRecipeAccepted(id: string) {
  const auth = await validAuth();
  const response = await fetch(`${documentUrl(`recipeShares/${id}`)}?updateMask.fieldPaths=status&updateMask.fieldPaths=acceptedAt`, { method: 'PATCH', headers: authHeaders(auth.idToken), body: JSON.stringify({ fields: { status: { stringValue: 'accepted' }, acceptedAt: { timestampValue: new Date().toISOString() } } }) });
  if (!response.ok) throw new Error('share');
}
