import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLang } from '../components/LangContext';

export default function PendingScreen({ navigation }: any) {
  const { t, toggleLang, lang } = useLang();
  return (
    <View style={s.container}>
      <TouchableOpacity style={s.langBtn} onPress={toggleLang}>
        <Text style={s.langTxt}>{lang === 'en' ? 'मराठी' : 'English'}</Text>
      </TouchableOpacity>
      <View style={s.content}>
        <Text style={s.emoji}>⏳</Text>
        <Text style={s.title}>{t('pendingTitle')}</Text>
        <Text style={s.msg}>{t('pendingMsg')}</Text>
        <Text style={s.time}>{t('pendingTime')}</Text>
        <TouchableOpacity style={s.btn} onPress={() => navigation.navigate('Welcome')}>
          <Text style={s.btnTxt}>OK</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1f0f' },
  langBtn:   { alignSelf: 'flex-end', margin: 20, marginTop: 60, backgroundColor: '#1a2e1a', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#2d4a2d' },
  langTxt:   { color: '#4ade80', fontSize: 13, fontWeight: '600' },
  content:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emoji:     { fontSize: 64, marginBottom: 24 },
  title:     { fontSize: 24, fontWeight: '700', color: '#f0fdf4', marginBottom: 16, textAlign: 'center' },
  msg:       { fontSize: 15, color: '#86efac', textAlign: 'center', lineHeight: 24, marginBottom: 12 },
  time:      { fontSize: 13, color: '#4a5e4a', textAlign: 'center', marginBottom: 40 },
  btn:       { backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  btnTxt:    { color: 'white', fontSize: 16, fontWeight: '600' },
});
