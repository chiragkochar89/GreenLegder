import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useLang } from '../components/LangContext';
import { useAuth } from '../components/AuthContext';
import ApiService from '../services/api';

export default function SensorsScreen() {
  const { t } = useLang();
  const { farm } = useAuth();
  const [sensor, setSensor]   = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!farm) return;
    try {
      const [s, h] = await Promise.all([
        ApiService.getLiveSensor(farm.farm_id),
        ApiService.getSensorHistory(farm.farm_id, 10),
      ]);
      setSensor(s.data);
      setHistory(h.data);
    } catch {}
  }, [farm]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const interval = setInterval(() => { load(); setTick(t => t+1); }, 10000);
    return () => clearInterval(interval);
  }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const sensorAge = sensor?.timestamp
    ? Math.floor((Date.now() - new Date(sensor.timestamp).getTime()) / 1000)
    : null;

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ade80" />}
    >
      <View style={s.header}>
        <Text style={s.title}>{t('sensors')}</Text>
        <View style={s.livePill}>
          <View style={s.liveDot} />
          <Text style={s.liveTxt}>{t('live')}</Text>
        </View>
      </View>

      {!sensor ? (
        <View style={s.empty}>
          <Text style={s.emptyTxt}>{t('noSensorData')}</Text>
        </View>
      ) : (
        <View style={s.content}>
          {/* Big sensor cards */}
          <View style={s.bigGrid}>
            <BigSensor
              label={t('soilMoisture')} val={sensor.soil_moisture?.toFixed(1)} unit="%"
              color="#60a5fa" pct={sensor.soil_moisture} icon="💧"
            />
            <BigSensor
              label={t('temperature')} val={sensor.temperature?.toFixed(1)} unit="°C"
              color="#fbbf24" pct={(sensor.temperature - 20) / 20 * 100} icon="🌡"
            />
            <BigSensor
              label={t('humidity')} val={sensor.humidity?.toFixed(1)} unit="%"
              color="#2dd4bf" pct={sensor.humidity} icon="💨"
            />
            <BigSensor
              label={t('soilPH')} val={sensor.soil_ph?.toFixed(1)} unit="pH"
              color="#4ade80" pct={(sensor.soil_ph - 4) / 6 * 100} icon="⚗"
            />
          </View>

          {/* EC and SOC */}
          <View style={s.extraRow}>
            <View style={s.extraCard}>
              <Text style={s.extraLabel}>{t('ec')}</Text>
              <Text style={[s.extraVal, { color: '#a78bfa' }]}>{sensor.ec?.toFixed(2) || '—'}</Text>
            </View>
            <View style={s.extraCard}>
              <Text style={s.extraLabel}>{t('soc')}</Text>
              <Text style={[s.extraVal, { color: '#fb923c' }]}>{sensor.soc_estimated?.toFixed(2) || '—'}%</Text>
            </View>
          </View>

          {/* Device info */}
          <View style={s.deviceCard}>
            <Text style={s.deviceLabel}>{t('deviceId')}: </Text>
            <Text style={s.deviceVal}>{farm?.device_id}</Text>
            {sensorAge !== null && (
              <Text style={s.deviceAge}>
                {t('lastUpdated')}: {sensorAge < 60 ? `${sensorAge}s` : `${Math.floor(sensorAge/60)}m`} {t('secondsAgo')}
              </Text>
            )}
          </View>

          {/* History */}
          {history.length > 0 && (
            <View style={s.historyCard}>
              <Text style={s.historyTitle}>Recent readings</Text>
              {history.slice(0,6).map((h, i) => (
                <View key={i} style={s.historyRow}>
                  <Text style={s.historyTime}>{new Date(h.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                  <Text style={s.historyVal}>{h.soil_moisture?.toFixed(1)}% moisture</Text>
                  <Text style={s.historyVal}>{h.temperature?.toFixed(1)}°C</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function BigSensor({ label, val, unit, color, pct, icon }: any) {
  const clampedPct = Math.min(100, Math.max(0, pct || 0));
  return (
    <View style={bs.card}>
      <View style={[bs.iconWrap, { backgroundColor: color + '22' }]}>
        <Text style={bs.icon}>{icon}</Text>
      </View>
      <Text style={bs.lbl}>{label}</Text>
      <Text style={[bs.val, { color }]}>{val}</Text>
      <Text style={bs.unit}>{unit}</Text>
      <View style={bs.bar}>
        <View style={[bs.barFill, { width: `${clampedPct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const bs = StyleSheet.create({
  card:    { flex: 1, backgroundColor: '#1a2e1a', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2d4a2d', alignItems: 'center' },
  iconWrap:{ width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  icon:    { fontSize: 18 },
  lbl:     { fontSize: 10, color: '#86efac', textAlign: 'center', marginBottom: 4 },
  val:     { fontSize: 26, fontWeight: '700', lineHeight: 30 },
  unit:    { fontSize: 11, color: '#4a5e4a', marginBottom: 8 },
  bar:     { width: '100%', height: 4, backgroundColor: '#243524', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
});

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0f1f0f' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 20 },
  title:       { fontSize: 22, fontWeight: '700', color: '#f0fdf4' },
  livePill:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a2e1a', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  liveDot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' },
  liveTxt:     { color: '#4ade80', fontSize: 12, fontWeight: '500' },
  content:     { padding: 16 },
  bigGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  extraRow:    { flexDirection: 'row', gap: 10, marginBottom: 10 },
  extraCard:   { flex: 1, backgroundColor: '#1a2e1a', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#2d4a2d' },
  extraLabel:  { fontSize: 11, color: '#86efac', marginBottom: 4 },
  extraVal:    { fontSize: 22, fontWeight: '700' },
  deviceCard:  { backgroundColor: '#1a2e1a', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#2d4a2d', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 },
  deviceLabel: { fontSize: 12, color: '#86efac' },
  deviceVal:   { fontSize: 12, color: '#4ade80', fontWeight: '600', flex: 1 },
  deviceAge:   { fontSize: 11, color: '#4a5e4a', width: '100%', marginTop: 4 },
  historyCard: { backgroundColor: '#1a2e1a', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#2d4a2d' },
  historyTitle:{ fontSize: 13, fontWeight: '600', color: '#f0fdf4', marginBottom: 10 },
  historyRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#2d4a2d' },
  historyTime: { fontSize: 12, color: '#4a5e4a', width: 60 },
  historyVal:  { fontSize: 12, color: '#86efac' },
  empty:       { padding: 40, alignItems: 'center' },
  emptyTxt:    { color: '#4a5e4a', textAlign: 'center', fontSize: 14, lineHeight: 22 },
});
