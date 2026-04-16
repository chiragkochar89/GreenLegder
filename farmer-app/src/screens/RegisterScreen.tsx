import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLang } from '../components/LangContext';
import ApiService from '../services/api';

const DISTRICTS = ['Pune','Nashik','Mumbai','Nagpur','Aurangabad','Solapur',
                   'Kolhapur','Satara','Sangli','Latur','Nanded','Osmanabad'];
const CROPS     = ['soybean','wheat','cotton','jowar','sugarcane','grapes','orange','pomegranate','other'];
const PRACTICES = ['conventional','cover_crop','no_till','agroforestry'];

export default function RegisterScreen({ navigation }: any) {
  const { t } = useLang();
  const [step, setStep]     = useState(1);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    full_name:'', phone:'', aadhaar_last4:'', village:'',
    district:'Pune', state:'Maharashtra', area_acres:'',
    crop_type:'soybean', practice:'conventional',
    latitude:0, longitude:0,
  });

  const [docs, setDocs] = useState<{
    selfie: string|null, document_712: string|null, aadhaar_photo: string|null
  }>({ selfie: null, document_712: null, aadhaar_photo: null });

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission denied'); return; }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setForm(f => ({ ...f, latitude: loc.coords.latitude, longitude: loc.coords.longitude }));
    Alert.alert('Location captured', `${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
  };

  const takePhoto = async (field: 'selfie' | 'document_712' | 'aadhaar_photo') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Camera permission needed'); return; }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setDocs(d => ({ ...d, [field]: result.assets[0].uri }));
    }
  };

  const validateStep1 = () => {
    if (!form.full_name.trim()) { Alert.alert('Error', 'Enter your full name'); return false; }
    if (form.phone.replace(/\D/g,'').length < 10) { Alert.alert('Error', 'Enter valid phone number'); return false; }
    if (form.aadhaar_last4.length !== 4) { Alert.alert('Error', 'Enter last 4 digits of Aadhaar'); return false; }
    if (!form.village.trim()) { Alert.alert('Error', 'Enter your village'); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!form.area_acres || parseFloat(form.area_acres) <= 0) { Alert.alert('Error', 'Enter valid farm area'); return false; }
    if (form.latitude === 0) { Alert.alert('Error', 'Please capture GPS location'); return false; }
    return true;
  };

  const validateStep3 = () => {
    if (!docs.selfie)       { Alert.alert('Error', 'Please take a farm selfie'); return false; }
    if (!docs.document_712) { Alert.alert('Error', 'Please take photo of 7/12 document'); return false; }
    if (!docs.aadhaar_photo){ Alert.alert('Error', 'Please take photo of Aadhaar card'); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;
    setLoading(true);
    try {
      const fd = new FormData() as any;
      const phone = form.phone.replace(/\D/g,'');
      const fullPhone = phone.startsWith('91') ? `+${phone}` : `+91${phone}`;
      fd.append('full_name',     form.full_name);
      fd.append('phone',         fullPhone);
      fd.append('aadhaar_last4', form.aadhaar_last4);
      fd.append('village',       form.village);
      fd.append('district',      form.district);
      fd.append('state',         form.state);
      fd.append('area_acres',    form.area_acres);
      fd.append('crop_type',     form.crop_type);
      fd.append('practice',      form.practice);
      fd.append('latitude',      String(form.latitude));
      fd.append('longitude',     String(form.longitude));

      const appendPhoto = (field: string, uri: string) => {
        fd.append(field, { uri, type: 'image/jpeg', name: `${field}.jpg` } as any);
      };
      if (docs.selfie)        appendPhoto('selfie',        docs.selfie);
      if (docs.document_712)  appendPhoto('document_712',  docs.document_712);
      if (docs.aadhaar_photo) appendPhoto('aadhaar_photo', docs.aadhaar_photo);

      await ApiService.submitApplication(fd);
      navigation.navigate('OTP', { phone: fullPhone, purpose: 'register' });
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Submission failed. Try again.';
      Alert.alert('Error', msg);
    }
    setLoading(false);
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(step-1) : navigation.goBack()}>
          <Text style={s.backTxt}>← {t('back')}</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('registerTitle')} ({step}/3)</Text>
        <View style={s.steps}>
          {[1,2,3].map(n => <View key={n} style={[s.stepDot, step >= n && s.stepDotActive]} />)}
        </View>
      </View>

      <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Step 1 — Personal */}
        {step === 1 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('step1')}</Text>
            <Field label={t('fullName')} value={form.full_name} onChangeText={v => update('full_name',v)} />
            <Field label={t('phone')} value={form.phone} onChangeText={v => update('phone',v)} keyboardType="phone-pad" />
            <Field label={t('aadhaarLast4')} value={form.aadhaar_last4} onChangeText={v => update('aadhaar_last4',v.replace(/\D/g,'').slice(0,4))} keyboardType="number-pad" maxLength={4} />
            <Field label={t('village')} value={form.village} onChangeText={v => update('village',v)} />
            <Text style={s.label}>{t('district')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
              {DISTRICTS.map(d => (
                <TouchableOpacity key={d} style={[s.chip, form.district===d && s.chipActive]} onPress={() => update('district',d)}>
                  <Text style={[s.chipTxt, form.district===d && s.chipTxtActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.primaryBtn} onPress={() => validateStep1() && setStep(2)}>
              <Text style={s.primaryBtnTxt}>{t('next')} →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2 — Farm */}
        {step === 2 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('step2')}</Text>
            <Field label={t('farmArea')} value={form.area_acres} onChangeText={v => update('area_acres',v)} keyboardType="decimal-pad" />
            <Text style={s.label}>{t('cropType')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
              {CROPS.map(c => (
                <TouchableOpacity key={c} style={[s.chip, form.crop_type===c && s.chipActive]} onPress={() => update('crop_type',c)}>
                  <Text style={[s.chipTxt, form.crop_type===c && s.chipTxtActive]}>{t(c as any)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.label}>{t('practice')}</Text>
            <View style={s.practiceGrid}>
              {PRACTICES.map(p => (
                <TouchableOpacity key={p} style={[s.practiceBtn, form.practice===p && s.practiceBtnActive]} onPress={() => update('practice',p)}>
                  <Text style={[s.practiceTxt, form.practice===p && s.practiceTxtActive]}>{t(p as any)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={s.locationBtn} onPress={getLocation}>
              <Text style={s.locationBtnTxt}>
                {form.latitude !== 0 ? `✓ ${t('locationCaptured')}: ${form.latitude.toFixed(4)}, ${form.longitude.toFixed(4)}` : `📍 ${t('getLocation')}`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.primaryBtn} onPress={() => validateStep2() && setStep(3)}>
              <Text style={s.primaryBtnTxt}>{t('next')} →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 3 — Documents */}
        {step === 3 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('step3')}</Text>
            <DocCapture label={t('takeSelfie')} uri={docs.selfie} onPress={() => takePhoto('selfie')} retakeLabel={t('retake')} />
            <DocCapture label={t('take712')} uri={docs.document_712} onPress={() => takePhoto('document_712')} retakeLabel={t('retake')} />
            <DocCapture label={t('takeAadhaar')} uri={docs.aadhaar_photo} onPress={() => takePhoto('aadhaar_photo')} retakeLabel={t('retake')} />
            <TouchableOpacity style={[s.primaryBtn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="white" /> : <Text style={s.primaryBtnTxt}>{t('submit')}</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Field({ label, ...props }: any) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} placeholderTextColor="#4a5e4a" {...props} />
    </View>
  );
}

function DocCapture({ label, uri, onPress, retakeLabel }: any) {
  return (
    <View style={s.docWrap}>
      <Text style={s.label}>{label}</Text>
      {uri ? (
        <View>
          <Image source={{ uri }} style={s.docPreview} />
          <TouchableOpacity style={s.retakeBtn} onPress={onPress}>
            <Text style={s.retakeTxt}>{retakeLabel}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={s.docBtn} onPress={onPress}>
          <Text style={s.docBtnIcon}>📷</Text>
          <Text style={s.docBtnTxt}>{label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#0f1f0f' },
  header:          { backgroundColor: '#1a2e1a', padding: 20, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: '#2d4a2d' },
  backTxt:         { color: '#4ade80', fontSize: 14, marginBottom: 8 },
  headerTitle:     { color: '#f0fdf4', fontSize: 17, fontWeight: '600', marginBottom: 12 },
  steps:           { flexDirection: 'row', gap: 8 },
  stepDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2d4a2d' },
  stepDotActive:   { backgroundColor: '#4ade80' },
  scroll:          { flex: 1 },
  section:         { padding: 20 },
  sectionTitle:    { fontSize: 20, fontWeight: '700', color: '#f0fdf4', marginBottom: 20 },
  label:           { fontSize: 12, fontWeight: '600', color: '#86efac', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input:           { backgroundColor: '#1a2e1a', borderRadius: 12, borderWidth: 1, borderColor: '#2d4a2d', color: '#f0fdf4', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },
  chipRow:         { marginBottom: 16 },
  chip:            { backgroundColor: '#1a2e1a', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: '#2d4a2d' },
  chipActive:      { backgroundColor: '#16a34a', borderColor: '#4ade80' },
  chipTxt:         { color: '#86efac', fontSize: 13 },
  chipTxtActive:   { color: 'white', fontWeight: '600' },
  practiceGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  practiceBtn:     { backgroundColor: '#1a2e1a', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#2d4a2d' },
  practiceBtnActive:{ backgroundColor: '#16a34a', borderColor: '#4ade80' },
  practiceTxt:     { color: '#86efac', fontSize: 13 },
  practiceTxtActive:{ color: 'white', fontWeight: '600' },
  locationBtn:     { backgroundColor: '#1a2e1a', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#2d4a2d', alignItems: 'center', marginBottom: 20 },
  locationBtnTxt:  { color: '#4ade80', fontSize: 14 },
  primaryBtn:      { backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  primaryBtnTxt:   { color: 'white', fontSize: 16, fontWeight: '600' },
  docWrap:         { marginBottom: 20 },
  docBtn:          { backgroundColor: '#1a2e1a', borderRadius: 12, borderWidth: 1, borderColor: '#2d4a2d', borderStyle: 'dashed', padding: 24, alignItems: 'center' },
  docBtnIcon:      { fontSize: 28, marginBottom: 8 },
  docBtnTxt:       { color: '#86efac', fontSize: 13 },
  docPreview:      { width: '100%', height: 160, borderRadius: 12, marginBottom: 8 },
  retakeBtn:       { alignItems: 'center', paddingVertical: 8 },
  retakeTxt:       { color: '#4ade80', fontSize: 13 },
});
