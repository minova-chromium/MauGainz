import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AccountUser, accountCloudConfigured, FriendConnection, listFriends, listSharedRecipes, markSharedRecipeAccepted, respondToFriendRequest, sendFriendRequest, sendPasswordReset, SharedRecipe, shareRecipeWithFriend, signInAccount, signOutAccount, signUpAccount } from './accountSync';
import { Locale, Recipe } from './types';
import { colors, radius } from './theme';

const tr = (locale: Locale, en: string, nl: string) => locale === 'nl' ? nl : en;
const ico = (name: string, size = 20, color = colors.cream) => <Ionicons name={name as never} size={size} color={color} />;

export function FriendsScreen({ locale, tablet, user, recipes, syncState, onAuthenticated, onSignedOut, onAcceptRecipe }: {
  locale: Locale;
  tablet: boolean;
  user: AccountUser | null;
  recipes: Recipe[];
  syncState: 'offline' | 'syncing' | 'synced' | 'error';
  onAuthenticated: (user: AccountUser) => Promise<void>;
  onSignedOut: () => void;
  onAcceptRecipe: (recipe: Recipe) => void;
}) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [friendCode, setFriendCode] = useState('');
  const [friends, setFriends] = useState<FriendConnection[]>([]);
  const [shares, setShares] = useState<SharedRecipe[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<string>('');
  const [selectedRecipe, setSelectedRecipe] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const acceptedFriends = useMemo(() => friends.filter((item) => item.status === 'accepted'), [friends]);
  const incoming = useMemo(() => friends.filter((item) => item.direction === 'incoming' && item.status === 'pending'), [friends]);
  const outgoing = useMemo(() => friends.filter((item) => item.direction === 'outgoing' && item.status === 'pending'), [friends]);

  const refresh = async () => {
    if (!user) return;
    try { const [connections, received] = await Promise.all([listFriends(), listSharedRecipes()]); setFriends(connections); setShares(received); }
    catch { Alert.alert('MauGainZ', tr(locale, 'Could not refresh friends right now.', 'Vrienden konden nu niet worden vernieuwd.')); }
  };

  useEffect(() => { if (user) refresh(); else { setFriends([]); setShares([]); } }, [user?.uid]);

  const authenticate = async () => {
    if (!accountCloudConfigured) { Alert.alert('MauGainZ', tr(locale, 'The account server still needs to be connected.', 'De accountserver moet nog worden gekoppeld.')); return; }
    setBusy(true);
    try {
      const account = mode === 'signup' ? await signUpAccount(email, password, name) : await signInAccount(email, password);
      await onAuthenticated(account);
    } catch (error) {
      const reason = error instanceof Error ? error.message : '';
      Alert.alert('MauGainZ', reason.includes('EMAIL_EXISTS') ? tr(locale, 'This email already has an account.', 'Dit e-mailadres heeft al een account.') : reason.includes('INVALID_LOGIN') || reason.includes('INVALID_PASSWORD') ? tr(locale, 'Email or password is incorrect.', 'E-mailadres of wachtwoord is onjuist.') : tr(locale, 'Account action failed. Check the fields and try again.', 'Accountactie mislukt. Controleer de velden en probeer opnieuw.'));
    } finally { setBusy(false); }
  };

  if (!user) return (
    <ScrollView contentContainerStyle={[s.content, tablet && s.tabletContent]} keyboardShouldPersistTaps="handled">
      <View style={s.hero}><View style={s.heroIcon}>{ico('people', 28, colors.black)}</View><Text style={s.eyebrow}>{tr(locale, 'MAUGAINZ ACCOUNT', 'MAUGAINZ-ACCOUNT')}</Text><Text style={s.title}>{tr(locale, 'Your fuel. Everywhere.', 'Jouw brandstof. Overal.')}</Text><Text style={s.help}>{tr(locale, 'Sign in to sync your diary, recipes, goals and progress between phone, tablet and desktop.', 'Meld je aan om je dagboek, recepten, doelen en voortgang te synchroniseren tussen telefoon, tablet en desktop.')}</Text></View>
      <View style={s.authCard}>
        <View style={s.segment}>{(['login', 'signup'] as const).map((item) => <Pressable key={item} onPress={() => setMode(item)} style={[s.segmentButton, mode === item && s.segmentActive]}><Text style={[s.segmentText, mode === item && s.segmentTextActive]}>{item === 'login' ? tr(locale, 'SIGN IN', 'AANMELDEN') : tr(locale, 'CREATE ACCOUNT', 'ACCOUNT MAKEN')}</Text></Pressable>)}</View>
        {mode === 'signup' && <><Text style={s.label}>{tr(locale, 'DISPLAY NAME', 'WEERGAVENAAM')}</Text><TextInput value={name} onChangeText={setName} placeholder={tr(locale, 'How friends see you', 'Hoe vrienden je zien')} placeholderTextColor={colors.muted} style={s.input} /></>}
        <Text style={s.label}>{tr(locale, 'EMAIL', 'E-MAIL')}</Text><TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@example.com" placeholderTextColor={colors.muted} style={s.input} />
        <Text style={s.label}>{tr(locale, 'PASSWORD', 'WACHTWOORD')}</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="••••••••" placeholderTextColor={colors.muted} style={s.input} />
        <Pressable disabled={busy || !email.trim() || password.length < 6 || (mode === 'signup' && name.trim().length < 2)} onPress={authenticate} style={[s.primaryButton, (busy || !email.trim() || password.length < 6 || (mode === 'signup' && name.trim().length < 2)) && s.disabled]}>{busy ? <ActivityIndicator color={colors.black} /> : <><Text style={s.primaryText}>{mode === 'signup' ? tr(locale, 'CREATE MY ACCOUNT', 'MAAK MIJN ACCOUNT') : tr(locale, 'SIGN IN', 'AANMELDEN')}</Text>{ico('arrow-forward', 20, colors.black)}</>}</Pressable>
        {mode === 'login' && <Pressable onPress={async () => { if (!email.trim()) return; try { await sendPasswordReset(email); Alert.alert('MauGainZ', tr(locale, 'Password reset email sent.', 'E-mail voor wachtwoordherstel verzonden.')); } catch { Alert.alert('MauGainZ', tr(locale, 'Could not send the reset email.', 'De herstelmail kon niet worden verzonden.')); } }}><Text style={s.link}>{tr(locale, 'Forgot password?', 'Wachtwoord vergeten?')}</Text></Pressable>}
      </View>
    </ScrollView>
  );

  const addFriend = async () => {
    setBusy(true);
    try { await sendFriendRequest(friendCode); setFriendCode(''); await refresh(); Alert.alert('MauGainZ', tr(locale, 'Friend request sent.', 'Vriendschapsverzoek verzonden.')); }
    catch (error) { Alert.alert('MauGainZ', error instanceof Error && error.message === 'friend-not-found' ? tr(locale, 'No account uses that friend code.', 'Geen account gebruikt die vriendencode.') : tr(locale, 'Could not send the request.', 'Het verzoek kon niet worden verzonden.')); }
    finally { setBusy(false); }
  };

  const share = async () => {
    const friend = acceptedFriends.find((item) => item.uid === selectedFriend);
    const recipe = recipes.find((item) => item.id === selectedRecipe);
    if (!friend || !recipe) return;
    setBusy(true);
    try { await shareRecipeWithFriend(friend, recipe); Alert.alert('MauGainZ', tr(locale, `Recipe sent to ${friend.displayName}.`, `Recept verzonden naar ${friend.displayName}.`)); }
    catch { Alert.alert('MauGainZ', tr(locale, 'Could not share this recipe.', 'Dit recept kon niet worden gedeeld.')); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView contentContainerStyle={[s.content, tablet && s.tabletContent]}>
      <View style={s.accountHeader}><View><Text style={s.eyebrow}>{tr(locale, 'CONNECTED ACCOUNT', 'GEKOPPELD ACCOUNT')}</Text><Text style={s.title}>{tr(locale, `Hey, ${user.displayName}`, `Hoi, ${user.displayName}`)}</Text><Text style={s.help}>{user.email}</Text></View><View style={[s.syncPill, syncState === 'error' && s.syncError]}>{ico(syncState === 'syncing' ? 'sync' : syncState === 'error' ? 'cloud-offline' : 'cloud-done', 16, syncState === 'error' ? '#FF8E83' : colors.lime)}<Text style={s.syncText}>{tr(locale, syncState === 'syncing' ? 'Syncing' : syncState === 'error' ? 'Sync issue' : 'Synced', syncState === 'syncing' ? 'Synchroniseren' : syncState === 'error' ? 'Syncprobleem' : 'Gesynchroniseerd')}</Text></View></View>
      <View style={s.codeCard}><View><Text style={s.label}>{tr(locale, 'YOUR FRIEND CODE', 'JOUW VRIENDENCODE')}</Text><Text style={s.code}>{user.friendCode}</Text><Text style={s.help}>{tr(locale, 'Friends can find you with this code.', 'Vrienden kunnen je vinden met deze code.')}</Text></View>{ico('person-add', 30, colors.lime)}</View>
      <View style={s.grid}>
        <View style={s.card}><Text style={s.cardTitle}>{tr(locale, 'Add a friend', 'Vriend toevoegen')}</Text><TextInput value={friendCode} onChangeText={setFriendCode} autoCapitalize="characters" autoCorrect={false} placeholder="ABCD1234" placeholderTextColor={colors.muted} style={s.input} /><Pressable disabled={busy || friendCode.trim().length < 6} onPress={addFriend} style={[s.primaryButton, (busy || friendCode.trim().length < 6) && s.disabled]}><Text style={s.primaryText}>{tr(locale, 'SEND REQUEST', 'VERZOEK STUREN')}</Text>{ico('send', 18, colors.black)}</Pressable></View>
        <View style={s.card}><Text style={s.cardTitle}>{tr(locale, 'Share a recipe', 'Recept delen')}</Text><Text style={s.label}>{tr(locale, 'CHOOSE FRIEND', 'KIES VRIEND')}</Text><View style={s.chips}>{acceptedFriends.map((friend) => <Pressable key={friend.uid} onPress={() => setSelectedFriend(friend.uid)} style={[s.chip, selectedFriend === friend.uid && s.chipActive]}><Text style={[s.chipText, selectedFriend === friend.uid && s.chipTextActive]}>{friend.displayName}</Text></Pressable>)}</View><Text style={s.label}>{tr(locale, 'CHOOSE RECIPE', 'KIES RECEPT')}</Text><View style={s.chips}>{recipes.slice(0, 12).map((recipe) => <Pressable key={recipe.id} onPress={() => setSelectedRecipe(recipe.id)} style={[s.chip, selectedRecipe === recipe.id && s.chipActive]}><Text numberOfLines={1} style={[s.chipText, selectedRecipe === recipe.id && s.chipTextActive]}>{locale === 'nl' ? recipe.titleNl || recipe.title : recipe.title}</Text></Pressable>)}</View><Pressable disabled={busy || !selectedFriend || !selectedRecipe} onPress={share} style={[s.primaryButton, (busy || !selectedFriend || !selectedRecipe) && s.disabled]}><Text style={s.primaryText}>{tr(locale, 'SHARE RECIPE', 'DEEL RECEPT')}</Text>{ico('share-social', 18, colors.black)}</Pressable></View>
      </View>
      {!!incoming.length && <View style={s.section}><Text style={s.sectionTitle}>{tr(locale, 'Friend requests', 'Vriendschapsverzoeken')}</Text>{incoming.map((friend) => <View key={friend.id} style={s.row}><View style={s.avatar}><Text style={s.avatarText}>{friend.displayName.slice(0, 1).toUpperCase()}</Text></View><View style={s.rowBody}><Text style={s.rowTitle}>{friend.displayName}</Text><Text style={s.help}>{friend.friendCode}</Text></View><Pressable onPress={async () => { await respondToFriendRequest(friend.id, false); refresh(); }} style={s.iconButton}>{ico('close', 20, colors.muted)}</Pressable><Pressable onPress={async () => { await respondToFriendRequest(friend.id, true); refresh(); }} style={s.acceptButton}>{ico('checkmark', 20, colors.black)}</Pressable></View>)}</View>}
      <View style={s.section}><Text style={s.sectionTitle}>{tr(locale, 'Friends', 'Vrienden')}</Text>{!acceptedFriends.length ? <Text style={s.empty}>{tr(locale, 'No friends yet. Share your code to get started.', 'Nog geen vrienden. Deel je code om te beginnen.')}</Text> : acceptedFriends.map((friend) => <View key={friend.id} style={s.row}><View style={s.avatar}><Text style={s.avatarText}>{friend.displayName.slice(0, 1).toUpperCase()}</Text></View><View style={s.rowBody}><Text style={s.rowTitle}>{friend.displayName}</Text><Text style={s.help}>{friend.friendCode}</Text></View><View style={s.acceptedBadge}>{ico('checkmark-circle', 16, colors.lime)}<Text style={s.acceptedText}>{tr(locale, 'FRIEND', 'VRIEND')}</Text></View></View>)}</View>
      {!!outgoing.length && <View style={s.section}><Text style={s.sectionTitle}>{tr(locale, 'Pending', 'In afwachting')}</Text>{outgoing.map((friend) => <View key={friend.id} style={s.row}><View style={s.avatar}>{ico('time', 18, colors.muted)}</View><View style={s.rowBody}><Text style={s.rowTitle}>{friend.displayName}</Text><Text style={s.help}>{tr(locale, 'Request sent', 'Verzoek verzonden')}</Text></View></View>)}</View>}
      <View style={s.section}><Text style={s.sectionTitle}>{tr(locale, 'Recipes shared with you', 'Met jou gedeelde recepten')}</Text>{!shares.filter((item) => item.status === 'pending').length ? <Text style={s.empty}>{tr(locale, 'New recipes from friends will appear here.', 'Nieuwe recepten van vrienden verschijnen hier.')}</Text> : shares.filter((item) => item.status === 'pending').map((shareItem) => <View key={shareItem.id} style={s.shareCard}><View style={s.shareTop}><View><Text style={s.rowTitle}>{locale === 'nl' ? shareItem.recipe.titleNl || shareItem.recipe.title : shareItem.recipe.title}</Text><Text style={s.help}>{tr(locale, `From ${shareItem.fromName}`, `Van ${shareItem.fromName}`)}</Text></View><Text style={s.macro}>{shareItem.recipe.macros.calories} KCAL</Text></View><Pressable onPress={async () => { const copy = { ...shareItem.recipe, id: `shared-${Date.now()}`, favorite: false, createdAt: Date.now() }; onAcceptRecipe(copy); await markSharedRecipeAccepted(shareItem.id); refresh(); }} style={s.primaryButton}><Text style={s.primaryText}>{tr(locale, 'ADD TO MY COOKBOOK', 'TOEVOEGEN AAN MIJN KOOKBOEK')}</Text>{ico('download', 18, colors.black)}</Pressable></View>)}</View>
      <Pressable onPress={async () => { await signOutAccount(); onSignedOut(); }} style={s.signOut}><Text style={s.signOutText}>{tr(locale, 'SIGN OUT', 'AFMELDEN')}</Text></Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 130, gap: 18 }, tabletContent: { width: '100%', maxWidth: 1320, alignSelf: 'center', paddingHorizontal: 34, paddingTop: 32, paddingBottom: 54 },
  hero: { minHeight: 210, borderRadius: radius.lg, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 24, justifyContent: 'flex-end' }, heroIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  eyebrow: { color: colors.lime, fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 7 }, title: { color: colors.cream, fontSize: 30, fontWeight: '900', letterSpacing: -1 }, help: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  authCard: { width: '100%', maxWidth: 560, alignSelf: 'center', borderRadius: radius.lg, backgroundColor: '#11120F', borderWidth: 1, borderColor: colors.line, padding: 20, gap: 10 }, segment: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: 14, padding: 4, marginBottom: 10 }, segmentButton: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 11 }, segmentActive: { backgroundColor: colors.lime }, segmentText: { color: colors.muted, fontSize: 9, fontWeight: '900' }, segmentTextActive: { color: colors.black },
  label: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 5 }, input: { height: 52, borderRadius: 14, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, color: colors.cream, paddingHorizontal: 14, fontSize: 14, fontWeight: '700' },
  primaryButton: { minHeight: 50, borderRadius: 14, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 8, paddingHorizontal: 14 }, primaryText: { color: colors.black, fontSize: 10, fontWeight: '900', letterSpacing: .8 }, disabled: { opacity: .35 }, link: { color: colors.lime, textAlign: 'center', fontSize: 11, fontWeight: '800', padding: 10 },
  accountHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }, syncPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 99, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 11, height: 34, backgroundColor: colors.panel }, syncError: { borderColor: '#6F3430' }, syncText: { color: colors.cream, fontSize: 9, fontWeight: '800' },
  codeCard: { minHeight: 130, borderRadius: radius.lg, borderWidth: 1, borderColor: '#5E4C19', backgroundColor: '#19170B', padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, code: { color: colors.lime, fontSize: 30, fontWeight: '900', letterSpacing: 3, marginVertical: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, card: { flex: 1, minWidth: 290, borderRadius: radius.lg, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 10 }, cardTitle: { color: colors.cream, fontSize: 18, fontWeight: '900' }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { minHeight: 36, maxWidth: 190, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' }, chipActive: { backgroundColor: colors.lime, borderColor: colors.lime }, chipText: { color: colors.muted, fontSize: 10, fontWeight: '800' }, chipTextActive: { color: colors.black },
  section: { borderRadius: radius.lg, backgroundColor: '#11120F', borderWidth: 1, borderColor: colors.line, padding: 18, gap: 10 }, sectionTitle: { color: colors.cream, fontSize: 17, fontWeight: '900', marginBottom: 3 }, empty: { color: colors.muted, fontSize: 12, lineHeight: 18, paddingVertical: 12 }, row: { minHeight: 64, borderRadius: 15, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', padding: 10, gap: 10 }, avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.panelSoft, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.lime, fontSize: 17, fontWeight: '900' }, rowBody: { flex: 1, minWidth: 0 }, rowTitle: { color: colors.cream, fontSize: 13, fontWeight: '900' }, iconButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }, acceptButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }, acceptedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 }, acceptedText: { color: colors.lime, fontSize: 8, fontWeight: '900', letterSpacing: .7 },
  shareCard: { borderRadius: 16, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 15 }, shareTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' }, macro: { color: colors.lime, fontSize: 10, fontWeight: '900' }, signOut: { height: 48, alignItems: 'center', justifyContent: 'center' }, signOutText: { color: '#FF8E83', fontSize: 10, fontWeight: '900', letterSpacing: 1 }
});
