import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { getUsers } from './src/lib/api';
import type { User } from './src/types/user';

const colors = {
  background: '#F4F7F2',
  card: '#FFFFFF',
  ink: '#17211B',
  muted: '#718076',
  line: '#E3EAE2',
  primary: '#2E6B4C',
  primarySoft: '#DDEDE1',
  danger: '#A84B4B',
};

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async (refresh = false) => {
    setError(null);
    refresh ? setIsRefreshing(true) : setIsLoading(true);

    try {
      setUsers(await getUsers());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '予期しないエラーが発生しました');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>TKB 2629</Text>
            <Text style={styles.title}>ユーザー</Text>
          </View>
          <Pressable accessibilityLabel="設定" style={styles.iconButton}>
            <Ionicons name="settings-outline" size={22} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="people-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryLabel}>登録ユーザー</Text>
            <Text style={styles.summaryValue}>{isLoading ? '—' : `${users.length}人`}</Text>
          </View>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>同期済み</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>一覧</Text>
          <Text style={styles.sectionCaption}>API 接続中</Text>
        </View>

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.stateText}>読み込んでいます…</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Ionicons name="cloud-offline-outline" size={42} color={colors.danger} />
            <Text style={styles.errorTitle}>接続できませんでした</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable onPress={() => void loadUsers()} style={styles.retryButton}>
              <Text style={styles.retryText}>再試行</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={users.length === 0 ? styles.emptyList : styles.list}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => void loadUsers(true)}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.centerState}>
                <Ionicons name="person-add-outline" size={42} color={colors.muted} />
                <Text style={styles.errorTitle}>ユーザーがいません</Text>
                <Text style={styles.stateText}>バックエンドから登録データを取得できます。</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.userCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.userCopy}>
                  <Text style={styles.userName}>{item.name}</Text>
                  <Text style={styles.userEmail}>{item.email}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 22 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginBottom: 5 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800' },
  iconButton: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, height: 46, justifyContent: 'center', width: 46 },
  summaryCard: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 20, flexDirection: 'row', padding: 18 },
  summaryIcon: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: 14, height: 48, justifyContent: 'center', width: 48 },
  summaryCopy: { flex: 1, marginLeft: 14 },
  summaryLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  summaryValue: { color: colors.ink, fontSize: 24, fontWeight: '800', marginTop: 2 },
  statusPill: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: 20, flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 7 },
  statusDot: { backgroundColor: colors.primary, borderRadius: 4, height: 7, marginRight: 6, width: 7 },
  statusText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  sectionHeader: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, marginBottom: 12 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  sectionCaption: { color: colors.muted, fontSize: 12 },
  list: { paddingBottom: 24 },
  emptyList: { flexGrow: 1 },
  userCard: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 18, flexDirection: 'row', marginBottom: 10, padding: 14 },
  avatar: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: 25, height: 50, justifyContent: 'center', width: 50 },
  avatarText: { color: colors.primary, fontSize: 19, fontWeight: '800' },
  userCopy: { flex: 1, marginLeft: 13 },
  userName: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  userEmail: { color: colors.muted, fontSize: 13, marginTop: 4 },
  centerState: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  stateText: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 10, textAlign: 'center' },
  errorTitle: { color: colors.ink, fontSize: 17, fontWeight: '700', marginTop: 14 },
  retryButton: { backgroundColor: colors.primary, borderRadius: 12, marginTop: 18, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
