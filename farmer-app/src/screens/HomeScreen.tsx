import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useLang } from '../components/LangContext';
import { useAuth } from '../components/AuthContext';
import ApiService from '../services/api';

export default function HomeScreen() {
  const { t, lang, toggleLang } = useLang();
  const { farm } = useAuth();
  const [sensor, setSensor]   = useState<any>(null);
  const [alerts, setAlerts]   = useState<any[]>([]);
  const [credits, setCredits] = useState<any[]>([]);
  const [season, setSeason]   = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!farm) return;
    try {
      const [s, a, c, se] = await Promise.all([
        ApiService.getLiveSensor(farm.farm_id),
        ApiService.getAlerts(farm.farm_id),
        ApiService.getCredits(farm.farm_id),
        ApiService.getActiveSeason(farm.farm_id),
      ]);
      setSensor(s.data);
      setAlerts(a.data);
      setCredits(c.data);
      setSeason(se.data);
    } catch {}
  }, [farm]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const totalCr  = credits.filter(c => c.status === 'verified').reduce((s, c) => s + (c.credits || 0), 0);
  const totalCO2 = credits.filter(c => c.status === 'verified').reduce((s, c) => s + (c.co2_tons || 0), 0);
  const income   = totalCr * 500;
  const ndvi     = farm?.ndvi || 0;
  const health   = ndvi > 0.6 ? t('good') : ndvi > 0.4 ? t('moderate') : t('poor');
  const healthColor = ndvi > 0.6 ? '#4ade80' : ndvi > 0.4 ? '#fbbf24' : '#f87171';

  const sensorAge = sensor?.timestamp
    ? Math.floor((Date.now() - new Date(sensor.timestamp).getTime()) / 1000)
    : null;
  const ageStr = sensorAge !== null
    ? sensorAge < 60
      ? `${sensorAge} ${t('secondsAgo')}`
      : `${Math.floor(sensorAge/60)} ${t('minutesAgo')}`
    : '';

  const initials = farm?.farmer_name?.split(' ').map((n:string) => n[0]).join('').toUpperCase() || '?';

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ade80" />}
    >
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.avatar}><Text style={s.avatarTxt}>{initials}</Text></View>
          <View>
            <Text style={s.farmerName}>{farm?.farmer_name}</Text>
            <Text style={s.farmId}>{farm?.farm_id} · {farm?.location}</Text>
          </View>
        </View>
        <TouchableOpacity style={s.langBtn} onPress={toggleLang}>
          <Text style={s.langTxt}>{lang === 'en' ? 'मराठी' : 'EN'}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.content}>

        {/* Hero credit card */}
        <View style={s.hero}>
          <Text style={s.heroLabel}>{t('totalCredits')}</Text>
          <Text style={s.heroValue}>{totalCr}</Text>
          <Text style={s.heroUnit}>{t('creditsUnit')}</Text>
          <View style={s.heroRow}>
            <View>
              <Text style={s.heroStatLabel}>{t('totalCO2')}</Text>
              <Text style={s.heroStatVal}>{totalCO2.toFixed(1)} t</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.heroStatLabel}>{t('income')}</Text>
              <Text style={s.heroStatVal}>₹{income.toLocaleString('en-IN')}</Text>
            </View>
          </View>
        </View>

        {/* Stats row */}
        <View style={s.statRow}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>{t('farmHealth')}</Text>
            <Text style={[s.statVal, { color: healthColor }]}>{health}</Text>
            <Text style={s.statSub}>NDVI {ndvi.toFixed(2)}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>{t('currentSeason')}</Text>
            <Text style={s.statVal}>{season?.season_name || '—'}</Text>
            <Text style={s.statSub}>{season?.crop_type || farm?.crop_type || '—'}</Text>
          </View>
        </View>

        {/* Live sensor mini */}
        {sensor && (
          <View style={s.sensorCard}>
            <View style={s.sensorHeader}>
              <Text style={s.sensorTitle}>{t('sensors')}</Text>
              <View style={s.livePill}>
                <View style={s.liveDot} />
                <Text style={s.liveTxt}>{t('live')}</Text>
              </View>
            </View>
            <View style={s.sensorGrid}>
              <SensorMini label={t('soilMoisture')} val={`${sensor.soil_moisture?.toFixed(1)}%`} color="#60a5fa" />
              <SensorMini label={t('temperature')} val={`${sensor.temperature?.toFixed(1)}°C`} color="#fbbf24" />
              <SensorMini label={t('humidity')} val={`${sensor.humidity?.toFixed(1)}%`} color="#2dd4bf" />
              <SensorMini label={t('soilPH')} val={sensor.soil_ph?.toFixed(1)} color="#4ade80" />
            </View>
            {ageStr ? <Text style={s.sensorAge}>{t('lastUpdated')}: {ageStr}</Text> : null}
          </View>
        )}

        {/* Alerts */}
        {alerts.length > 0 && alerts.slice(0,2).map((a, i) => (
          <View key={i} style={s.alertBanner}>
            <Text style={s.alertIcon}>⚠️</Text>
            <View>
              <Text style={s.alertTitle}>{a.type === 'low_moisture' ? t('lowMoisture') : t('highTemp')}</Text>
              <Text style={s.alertMsg}>{a.message}</Text>
            </View>
          </View>
        ))}
        {alerts.length === 0 && (
          <View style={s.noAlert}>
            <Text style={s.noAlertTxt}>✓ {t('noAlerts')}</Text>
          </View>
        )}

      </View>
    </ScrollView>
  );
}

function SensorMini({ label, val, color }: any) {
  return (
    <View style={sm.wrap}>
      <Text style={[sm.val, { color }]}>{val}</Text>
      <Text style={sm.lbl}>{label}</Text>
    </View>
  );
}

const sm = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  val:  { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  lbl:  { fontSize: 10, color: '#86efac', textAlign: 'center' },
});

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#0f1f0f' },
  header:        { backgroundColor: '#1a2e1a', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#2d4a2d' },
  headerLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:        { width: 40, height: 40, borderRadius: 20, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center' },
  avatarTxt:     { color: 'white', fontSize: 14, fontWeight: '700' },
  farmerName:    { fontSize: 15, fontWeight: '600', color: '#f0fdf4' },
  farmId:        { fontSize: 12, color: '#86efac', marginTop: 1 },
  langBtn:       { backgroundColor: '#243524', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: '#2d4a2d' },
  langTxt:       { color: '#4ade80', fontSize: 12, fontWeight: '600' },
  content:       { padding: 16 },
  hero:          { backgroundColor: '#14532d', borderRadius: 20, padding: 24, marginBottom: 14 },
  heroLabel:     { fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  heroValue:     { fontSize: 56, fontWeight: '700', color: 'white', lineHeight: 60 },
  heroUnit:      { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 20 },
  heroRow:       { flexDirection: 'row', justifyContent: 'space-between' },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroStatVal:   { fontSize: 18, fontWeight: '600', color: 'white', marginTop: 2 },
  statRow:       { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard:      { flex: 1, backgroundColor: '#1a2e1a', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2d4a2d' },
  statLabel:     { fontSize: 10, color: '#86efac', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  statVal:       { fontSize: 18, fontWeight: '700', color: '#f0fdf4', marginBottom: 2 },
  statSub:       { fontSize: 11, color: '#4a5e4a' },
  sensorCard:    { backgroundColor: '#1a2e1a', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2d4a2d', marginBottom: 14 },
  sensorHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sensorTitle:   { fontSize: 13, fontWeight: '600', color: '#f0fdf4' },
  livePill:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#243524', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  liveDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' },
  liveTxt:       { fontSize: 11, color: '#4ade80', fontWeight: '500' },
  sensorGrid:    { flexDirection: 'row' },
  sensorAge:     { fontSize: 10, color: '#4a5e4a', textAlign: 'right', marginTop: 8 },
  alertBanner:   { backgroundColor: 'rgba(251,191,36,0.1)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)', borderRadius: 12, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 10 },
  alertIcon:     { fontSize: 18 },
  alertTitle:    { fontSize: 13, fontWeight: '600', color: '#fbbf24', marginBottom: 2 },
  alertMsg:      { fontSize: 12, color: 'rgba(251,191,36,0.7)' },
  noAlert:       { backgroundColor: 'rgba(74,222,128,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(74,222,128,0.15)', alignItems: 'center' },
  noAlertTxt:    { color: '#4ade80', fontSize: 13 },
});
