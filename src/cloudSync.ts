import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { CategoryOption, MealPlanEntry, Recipe, ShoppingItem, UnitSystem, UserGoals } from './types';

export type BackupPayload = {
  version: number;
  recipes: Recipe[];
  customCategories: CategoryOption[];
  goals: UserGoals;
  plans: MealPlanEntry[];
  shopping: ShoppingItem[];
  unitSystem: UnitSystem;
};

const API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '';
const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '';
const AUTH_KEY = '@maugainz/cloud-auth-v1';
export const cloudConfigured = Boolean(API_KEY && PROJECT_ID);

type AuthState = { idToken: string; refreshToken: string; expiresAt: number };

async function authenticate(): Promise<AuthState> {
  const stored = await AsyncStorage.getItem(AUTH_KEY);
  const cached = stored ? JSON.parse(stored) as AuthState : null;
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached;
  if (cached?.refreshToken) {
    const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(cached.refreshToken)}` });
    if (response.ok) {
      const json = await response.json() as { id_token: string; refresh_token: string; expires_in: string };
      const refreshed = { idToken: json.id_token, refreshToken: json.refresh_token, expiresAt: Date.now() + Number(json.expires_in) * 1000 };
      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(refreshed)); return refreshed;
    }
  }
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) });
  if (!response.ok) throw new Error('auth');
  const json = await response.json() as { idToken: string; refreshToken: string; expiresIn: string };
  const auth = { idToken: json.idToken, refreshToken: json.refreshToken, expiresAt: Date.now() + Number(json.expiresIn) * 1000 };
  await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(auth)); return auth;
}

export const createSyncCode = () => Crypto.randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase().match(/.{1,5}/g)!.join('-');
const normalizeCode = (code: string) => code.replace(/[^a-z0-9]/gi, '').toUpperCase();
const endpoint = (code: string) => `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/maugainzSync/${normalizeCode(code)}`;

export async function uploadCloudBackup(code: string, payload: BackupPayload) {
  if (!cloudConfigured) throw new Error('unconfigured');
  const auth = await authenticate();
  const response = await fetch(endpoint(code), { method: 'PATCH', headers: { Authorization: `Bearer ${auth.idToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { payload: { stringValue: JSON.stringify(payload) }, updatedAt: { timestampValue: new Date().toISOString() } } }) });
  if (!response.ok) throw new Error(response.status === 403 ? 'permission' : 'network');
}

export async function downloadCloudBackup(code: string): Promise<BackupPayload> {
  if (!cloudConfigured) throw new Error('unconfigured');
  const auth = await authenticate();
  const response = await fetch(endpoint(code), { headers: { Authorization: `Bearer ${auth.idToken}` } });
  if (!response.ok) throw new Error(response.status === 404 ? 'not-found' : response.status === 403 ? 'permission' : 'network');
  const json = await response.json() as { fields?: { payload?: { stringValue?: string } } };
  const payload = json.fields?.payload?.stringValue;
  if (!payload) throw new Error('invalid');
  return JSON.parse(payload) as BackupPayload;
}
