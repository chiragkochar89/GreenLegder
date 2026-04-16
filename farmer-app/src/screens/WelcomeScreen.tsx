import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useLang } from '../components/LangContext';
import { useAuth } from '../components/AuthContext';
import ApiService from '../services/api';

export default function WelcomeScreen({ navigation }: any) {
  const { t, lang, toggleLang } = useLang();
  const { setPhone } = useAuth();
  const [phoneNum, setPhoneNum] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    const cleaned = phoneNum.trim().replace(/\s/g, '');
    if (cleaned.length < 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }
    const fullPhone = cleaned.startsWith('+91') ? cleaned : `+91${cleaned}`;

    setLoading(true);
    try {
      const res = await ApiService.farmerLogin(fullPhone);
      const status = res.data.status;

      if (status === 'approved') {
        setPhone(fullPhone);
        navigation.navigate('OTP', { phone: fullPhone, purpose: 'login', farmData: res.data.farm });
      } else if (status === 'pending') {
        navigation.navigate('Pending');
      } else if (status === 'rejected') {
        const reason = res.data.rejection_reason || 'Documents could not be verified.';
        Alert.alert(
          'Application Rejected',
          `Your application was rejected.\n\nReason: ${reason}\n\nPlease contact your nearest Krishi Kendra or call 1800-XXX-XXXX for assistance.`,
          [{ text: 'OK' }]
        );
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        Alert.alert('Not Found', 'No account found. Please register first.');
      } else {
        Alert.alert('Error', 'Cannot connect to server. Check your internet connection.');
      }
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Lang toggle */}
        <TouchableOpacity style={s.langBtn} onPress={toggleLang}>
          <Text style={s.langTxt}>{lang === 'en' ? 'मराठी' : 'English'}</Text>
        </TouchableOpacity>

        {/* Logo */}
        <View style={s.logoWrap}>
          <View style={s.logoIcon}>
            {/* Stem */}
            <View style={s.stem}/>
            {/* Left leaf */}
            <View style={s.leafLeft}/>
            {/* Right leaf */}
            <View style={s.leafRight}/>
            {/* Bud */}
            <View style={s.bud}/>
          </View>
          <Text style={s.logoName}>{t('appName')}</Text>
          <Text style={s.logoSub}>{t('tagline')}</Text>
        </View>

        {/* Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('login')}</Text>
          <Text style={s.label}>{t('phone')}</Text>
          <View style={s.inputRow}>
            <Text style={s.prefix}>+91</Text>
            <TextInput
              style={s.input}
              placeholder={t('phonePlaceholder')}
              placeholderTextColor="#4a5e4a"
              keyboardType="phone-pad"
              maxLength={10}
              value={phoneNum}
              onChangeText={setPhoneNum}
            />
          </View>

          <TouchableOpacity style={s.primaryBtn} onPress={handleSendOTP} disabled={loading}>
            {loading
              ? <ActivityIndicator color="white" />
              : <Text style={s.primaryBtnTxt}>{t('sendOTP')}</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Register link */}
        <TouchableOpacity style={s.regLink} onPress={() => navigation.navigate('Register')}>
          <Text style={s.regTxt}>{t('register')} →</Text>
        </TouchableOpacity>

        <Text style={s.demo}>{t('demoNumbers')}</Text>
        <Text style={s.demoNum}>+91 98765 43210 (Ramesh Patil — F-01)</Text>
        <Text style={s.demoNum}>+91 98765 43217 (Kavita Thorat — F-08)</Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0f1f0f' },
  scroll:     { flexGrow: 1, padding: 24, paddingTop: 60 },
  langBtn:    { alignSelf: 'flex-end', backgroundColor: '#1a2e1a', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#2d4a2d' },
  langTxt:    { color: '#4ade80', fontSize: 13, fontWeight: '600' },
  logoWrap:   { alignItems: 'center', marginTop: 32, marginBottom: 40 },
  logoIcon:   { width: 80, height: 80, backgroundColor: '#0f1f0f', borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 1.5, borderColor: '#2d4a2d', overflow: 'hidden' },
  stem:       { position: 'absolute', width: 4, height: 44, backgroundColor: 'white', borderRadius: 2, bottom: 12, left: 38 },
  leafLeft:   { position: 'absolute', width: 22, height: 14, backgroundColor: '#4ade80', borderRadius: 12, bottom: 32, left: 16, transform: [{ rotate: '-35deg' }] },
  leafRight:  { position: 'absolute', width: 22, height: 14, backgroundColor: '#86efac', borderRadius: 12, bottom: 38, left: 42, transform: [{ rotate: '35deg' }] },
  bud:        { position: 'absolute', width: 14, height: 18, backgroundColor: '#4ade80', borderRadius: 7, top: 12, left: 33 },
  logoName:   { fontSize: 30, fontWeight: '700', color: '#f0fdf4', letterSpacing: -0.5 },
  logoSub:    { fontSize: 14, color: '#86efac', marginTop: 4 },
  card:       { backgroundColor: '#1a2e1a', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#2d4a2d', marginBottom: 20 },
  cardTitle:  { fontSize: 18, fontWeight: '600', color: '#f0fdf4', marginBottom: 20 },
  label:      { fontSize: 12, fontWeight: '600', color: '#86efac', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  inputRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#243524', borderRadius: 12, borderWidth: 1, borderColor: '#2d4a2d', marginBottom: 20 },
  prefix:     { color: '#86efac', paddingHorizontal: 14, fontSize: 16, fontWeight: '500' },
  input:      { flex: 1, color: '#f0fdf4', fontSize: 16, paddingVertical: 14, paddingRight: 14 },
  primaryBtn: { backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryBtnTxt: { color: 'white', fontSize: 16, fontWeight: '600' },
  regLink:    { alignItems: 'center', paddingVertical: 16 },
  regTxt:     { color: '#4ade80', fontSize: 15, fontWeight: '500' },
  demo:       { textAlign: 'center', color: '#4a5e4a', fontSize: 12, marginTop: 24, marginBottom: 6 },
  demoNum:    { textAlign: 'center', color: '#4a5e4a', fontSize: 11, marginBottom: 2 },
});
