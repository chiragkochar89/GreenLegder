import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLang } from '../components/LangContext';
import { useAuth } from '../components/AuthContext';

export default function OTPScreen({ navigation, route }: any) {
  const { t } = useLang();
  const { setFarm } = useAuth();
  const { phone, purpose, farmData } = route.params;
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const inputs = useRef<any[]>([]);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(t => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleChange = (val: string, idx: number) => {
    const newOtp = [...otp];
    newOtp[idx] = val;
    setOtp(newOtp);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
    if (!val && idx > 0) inputs.current[idx - 1]?.focus();
    if (newOtp.every(d => d !== '') && newOtp.join('').length === 6) {
      verifyOTP(newOtp.join(''));
    }
  };

  const verifyOTP = async (code: string) => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    if (purpose === 'login' && farmData) {
      await setFarm(farmData);
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } else {
      navigation.navigate('Pending');
    }
    setLoading(false);
  };

  return (
    <View style={s.container}>
      <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
        <Text style={s.backTxt}>← Back</Text>
      </TouchableOpacity>
      <View style={s.content}>
        <View style={s.iconWrap}><Text style={s.icon}>📱</Text></View>
        <Text style={s.title}>{t('enterOTP')}</Text>
        <Text style={s.sub}>{t('otpSent')}</Text>
        <Text style={s.phone}>{phone}</Text>
        <Text style={s.demo}>Demo: enter any 6 digits</Text>
        <View style={s.otpRow}>
          {otp.map((digit, idx) => (
            <TextInput key={idx} ref={r => inputs.current[idx] = r}
              style={[s.otpBox, digit ? s.otpBoxFilled : null]}
              maxLength={1} keyboardType="number-pad" value={digit}
              onChangeText={v => handleChange(v, idx)} selectTextOnFocus />
          ))}
        </View>
        {loading && <ActivityIndicator color="#4ade80" style={{ marginTop: 20 }} />}
        <TouchableOpacity style={s.resendBtn} onPress={() => { if (timer === 0) setTimer(30); }}>
          <Text style={timer > 0 ? s.resendDisabledTxt : s.resendTxt}>
            {timer > 0 ? `${t('resendOTP')} (${timer}s)` : t('resendOTP')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1f0f' },
  back: { padding: 20, paddingTop: 60 },
  backTxt: { color: '#4ade80', fontSize: 15 },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 32, paddingTop: 20 },
  iconWrap: { width: 72, height: 72, backgroundColor: '#1a2e1a', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  icon: { fontSize: 36 },
  title: { fontSize: 24, fontWeight: '700', color: '#f0fdf4', marginBottom: 8 },
  sub: { fontSize: 14, color: '#86efac', marginBottom: 4 },
  phone: { fontSize: 16, fontWeight: '600', color: '#4ade80', marginBottom: 8 },
  demo: { fontSize: 12, color: '#4a5e4a', marginBottom: 24 },
  otpRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  otpBox: { width: 46, height: 56, backgroundColor: '#1a2e1a', borderRadius: 10, borderWidth: 1, borderColor: '#2d4a2d', textAlign: 'center', fontSize: 22, fontWeight: '700', color: '#f0fdf4' },
  otpBoxFilled: { borderColor: '#4ade80', backgroundColor: '#1e3a1e' },
  resendBtn: { paddingVertical: 12, paddingHorizontal: 24 },
  resendTxt: { color: '#4ade80', fontSize: 14, fontWeight: '500' },
  resendDisabledTxt: { color: '#4a5e4a', fontSize: 14 },
});