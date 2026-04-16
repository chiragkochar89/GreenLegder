import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useLang } from '../components/LangContext';
import { useAuth } from '../components/AuthContext';
import ApiService from '../services/api';

export default function AlertsScreen() {
  const { t } = useLang();
  const { farm } = useAuth();
  const [alerts, setAlerts]     = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!farm) return;
    try {
      const res = await ApiService.getAlerts(farm.farm_id);
      setAlerts(res.data);
    } catch {}
  };

  useEffect(() => { load(); }, [farm]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const resolve = async (alertId: string) => {
    try {
      await ApiService.resolveAlert(alertId);
      setAlerts(a => a.filter(x => x._id !== alertId));
    } catch {}
  };

  const sevColor = (sev: string) =>
    sev === 'critical' ? '#f87171' : sev === 'warning' ? '#fbbf24' : '#4ade80';

  const typeLabel = (type: string) =>
    type === 'low_moisture' ? t('lowMoisture') : t('highTemp');

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ade80" />}
    >
      <Text style={s.title}>{t('myAlerts')}</Text>

      {alerts.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>✅</Text>
          <Text style={s.emptyTxt}>{t('noAlertsMsg')}</Text>
        </View>
      ) : alerts.map((a, i) => {
        const color = sevColor(a.severity);
        const dt    = a.timestamp ? new Date(a.timestamp).toLocaleString('en-IN') : '';
        return (
          <View key={i} style={[s.alertCard, { borderColor: color + '44' }]}>
            <View style={s.alertTop}>
              <View style={[s.alertDot, { backgroundColor: color }]} />
              <Text style={[s.alertTitle, { color }]}>{typeLabel(a.type)}</Text>
            </View>
            <Text style={s.alertMsg}>{a.message}</Text>
            <Text style={s.alertTime}>{dt}</Text>
            <TouchableOpacity style={s.resolveBtn} onPress={() => resolve(a._id)}>
              <Text style={s.resolveTxt}>{t('markResolved')}</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0f1f0f' },
  title:      { fontSize: 22, fontWeight: '700', color: '#f0fdf4', padding: 20, paddingTop: 20 },
  empty:      { padding: 60, alignItems: 'center' },
  emptyIcon:  { fontSize: 48, marginBottom: 16 },
  emptyTxt:   { color: '#4a5e4a', textAlign: 'center', fontSize: 14, lineHeight: 22 },
  alertCard:  { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#1a2e1a', borderRadius: 14, padding: 16, borderWidth: 1 },
  alertTop:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  alertDot:   { width: 8, height: 8, borderRadius: 4 },
  alertTitle: { fontSize: 15, fontWeight: '600' },
  alertMsg:   { fontSize: 13, color: '#86efac', marginBottom: 6, lineHeight: 20 },
  alertTime:  { fontSize: 11, color: '#4a5e4a', marginBottom: 12 },
  resolveBtn: { backgroundColor: '#243524', borderRadius: 8, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: '#2d4a2d' },
  resolveTxt: { color: '#4ade80', fontSize: 13, fontWeight: '500' },
});
