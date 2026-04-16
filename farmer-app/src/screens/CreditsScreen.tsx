import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useLang } from '../components/LangContext';
import { useAuth } from '../components/AuthContext';
import ApiService from '../services/api';

export default function CreditsScreen() {
  const { t } = useLang();
  const { farm } = useAuth();
  const [credits, setCredits] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!farm) return;
    try {
      const res = await ApiService.getCredits(farm.farm_id);
      setCredits(res.data);
    } catch {}
  };

  useEffect(() => { load(); }, [farm]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const verified = credits.filter(c => c.status === 'verified');
  const totalCr  = verified.reduce((s, c) => s + (c.credits || 0), 0);
  const totalVal = verified.reduce((s, c) => s + (c.value_inr || 0), 0);
  const totalCO2 = verified.reduce((s, c) => s + (c.co2_tons || 0), 0);

  const badgeStyle = (status: string) =>
    status === 'verified' ? { bg: 'rgba(74,222,128,0.15)', tx: '#4ade80' }
    : status === 'pending' ? { bg: 'rgba(251,191,36,0.15)', tx: '#fbbf24' }
    : { bg: 'rgba(248,113,113,0.15)', tx: '#f87171' };

  const statusLabel = (status: string) =>
    status === 'verified' ? t('verified')
    : status === 'pending' ? t('pending')
    : t('rejected');

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ade80" />}
    >
      <Text style={s.title}>{t('myCredits')}</Text>

      {/* Summary */}
      <View style={s.summary}>
        <View style={s.sumCard}>
          <Text style={s.sumLabel}>{t('totalEarned')}</Text>
          <Text style={s.sumVal}>{totalCr}</Text>
          <Text style={s.sumSub}>{t('creditsUnit')}</Text>
        </View>
        <View style={s.sumCard}>
          <Text style={s.sumLabel}>{t('totalValue')}</Text>
          <Text style={[s.sumVal, { color: '#4ade80' }]}>₹{totalVal.toLocaleString('en-IN')}</Text>
          <Text style={s.sumSub}>@ ₹500/credit</Text>
        </View>
        <View style={s.sumCard}>
          <Text style={s.sumLabel}>{t('totalCO2')}</Text>
          <Text style={[s.sumVal, { color: '#2dd4bf' }]}>{totalCO2.toFixed(1)}</Text>
          <Text style={s.sumSub}>{t('tonnes')}</Text>
        </View>
      </View>

      {/* Credits list */}
      <View style={s.list}>
        {credits.length === 0 ? (
          <View style={s.empty}><Text style={s.emptyTxt}>{t('noCredits')}</Text></View>
        ) : credits.map((c, i) => {
          const bd = badgeStyle(c.status);
          const dt = c.issued_on ? new Date(c.issued_on).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
          return (
            <View key={i} style={s.creditItem}>
              <View style={s.creditLeft}>
                <Text style={s.creditId}>{c.credit_id}</Text>
                <Text style={s.creditDate}>{dt}</Text>
                <Text style={s.creditCO2}>{c.co2_tons?.toFixed(2)} {t('tonnes')}</Text>
              </View>
              <View style={s.creditRight}>
                <Text style={s.creditAmt}>{c.credits}</Text>
                <Text style={s.creditAmtLabel}>{t('creditsUnit')}</Text>
                <Text style={s.creditVal}>₹{(c.value_inr || 0).toLocaleString('en-IN')}</Text>
                <View style={[s.badge, { backgroundColor: bd.bg }]}>
                  <Text style={[s.badgeTxt, { color: bd.tx }]}>{statusLabel(c.status)}</Text>
                </View>
                {c.payment_status === 'paid' && (
                  <View style={[s.badge, { backgroundColor: 'rgba(74,222,128,0.15)', marginTop: 4 }]}>
                    <Text style={[s.badgeTxt, { color: '#4ade80' }]}>₹ Paid</Text>
                  </View>
                )}
                {c.payment_status === 'initiated' && (
                  <View style={[s.badge, { backgroundColor: 'rgba(251,191,36,0.15)', marginTop: 4 }]}>
                    <Text style={[s.badgeTxt, { color: '#fbbf24' }]}>Payment Processing</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#0f1f0f' },
  title:         { fontSize: 22, fontWeight: '700', color: '#f0fdf4', padding: 20, paddingTop: 20, paddingBottom: 12 },
  summary:       { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  sumCard:       { flex: 1, backgroundColor: '#1a2e1a', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#2d4a2d', alignItems: 'center' },
  sumLabel:      { fontSize: 9, color: '#86efac', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, textAlign: 'center' },
  sumVal:        { fontSize: 20, fontWeight: '700', color: '#f0fdf4' },
  sumSub:        { fontSize: 10, color: '#4a5e4a', marginTop: 2 },
  list:          { paddingHorizontal: 16 },
  creditItem:    { backgroundColor: '#1a2e1a', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2d4a2d', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  creditLeft:    {},
  creditId:      { fontSize: 11, color: '#4a5e4a', fontFamily: 'monospace', marginBottom: 4 },
  creditDate:    { fontSize: 13, color: '#86efac', marginBottom: 2 },
  creditCO2:     { fontSize: 12, color: '#4a5e4a' },
  creditRight:   { alignItems: 'flex-end' },
  creditAmt:     { fontSize: 28, fontWeight: '700', color: '#4ade80', lineHeight: 32 },
  creditAmtLabel:{ fontSize: 11, color: '#4a5e4a', marginBottom: 2 },
  creditVal:     { fontSize: 13, color: '#f0fdf4', fontWeight: '500', marginBottom: 6 },
  badge:         { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt:      { fontSize: 11, fontWeight: '600' },
  empty:         { padding: 40, alignItems: 'center' },
  emptyTxt:      { color: '#4a5e4a', textAlign: 'center', fontSize: 14, lineHeight: 22 },
});
