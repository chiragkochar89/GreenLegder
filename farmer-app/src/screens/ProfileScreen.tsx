import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { useLang } from '../components/LangContext';
import { useAuth } from '../components/AuthContext';
import ApiService from '../services/api';

const CROPS     = ['soybean','wheat','cotton','jowar','sugarcane','grapes','orange','pomegranate','other'];
const PRACTICES = ['conventional','cover_crop','no_till','agroforestry'];

export default function ProfileScreen() {
  const { t, lang, toggleLang } = useLang();
  const { farm, setFarm, logout } = useAuth();

  const [showSeason, setShowSeason]   = useState(false);
  const [showBank, setShowBank]       = useState(false);
  const [seasonName, setSeasonName]   = useState('');
  const [cropType, setCropType]       = useState(farm?.crop_type || 'soybean');
  const [savingBank, setSavingBank]   = useState(false);
  const [savingSeason, setSavingSeason] = useState(false);

  // Bank details state
  const [upiId, setUpiId]           = useState((farm as any)?.bank_details?.upi_id || '');
  const [accountNo, setAccountNo]   = useState((farm as any)?.bank_details?.account_no || '');
  const [ifsc, setIfsc]             = useState((farm as any)?.bank_details?.ifsc || '');
  const [bankName, setBankName]     = useState((farm as any)?.bank_details?.bank_name || '');
  const [accountName, setAccountName] = useState((farm as any)?.bank_details?.account_name || farm?.farmer_name || '');

  const handleLogout = () => {
    Alert.alert(t('logout'), 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: t('logout'), style: 'destructive', onPress: logout },
    ]);
  };

  const handleSaveSeason = async () => {
    if (!seasonName.trim()) { Alert.alert('Error', 'Enter season name'); return; }
    setSavingSeason(true);
    try {
      await ApiService.createSeason({
        farm_id: farm?.farm_id, season_name: seasonName,
        crop_type: cropType, start_date: new Date().toISOString(),
      });
      Alert.alert('Success', 'Season updated successfully');
      setShowSeason(false);
      setSeasonName('');
    } catch {
      Alert.alert('Error', 'Could not update season. Check connection.');
    }
    setSavingSeason(false);
  };

  const handleSaveBankDetails = async () => {
    if (!upiId.trim() && !accountNo.trim()) {
      Alert.alert('Error', 'Please enter at least UPI ID or Bank Account Number');
      return;
    }
    if (accountNo.trim() && !ifsc.trim()) {
      Alert.alert('Error', 'Please enter IFSC code for bank account');
      return;
    }
    setSavingBank(true);
    try {
      const bankData = {
        upi_id: upiId.trim(),
        account_no: accountNo.trim(),
        ifsc: ifsc.trim().toUpperCase(),
        bank_name: bankName.trim(),
        account_name: accountName.trim(),
      };
      await ApiService.updateBankDetails(farm!.farm_id, bankData);
      // Update local farm data
      const updatedFarm = { ...farm, bank_details: bankData } as any;
      await setFarm(updatedFarm);
      Alert.alert('✓ Saved', 'Bank details saved successfully.\n\nPayments will be processed to this account after credit verification.');
      setShowBank(false);
    } catch {
      Alert.alert('Error', 'Could not save bank details. Check connection.');
    }
    setSavingBank(false);
  };

  const initials = farm?.farmer_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '?';
  const hasBankDetails = (farm as any)?.bank_details?.upi_id || (farm as any)?.bank_details?.account_no;

  const farmRows = [
    { label: t('farmId'),          val: farm?.farm_id },
    { label: t('phone'),           val: farm?.phone },
    { label: t('location'),        val: `${farm?.location}, ${farm?.district}` },
    { label: t('farmArea2'),       val: `${farm?.area_hectares?.toFixed(1)} ha` },
    { label: t('crop'),            val: farm?.crop_type },
    { label: t('farmingPractice'), val: t((farm?.practice || 'conventional') as any) },
    { label: 'NDVI',               val: farm?.ndvi?.toFixed(2) },
    { label: 'Device ID',          val: (farm as any)?.device_id || '—' },
  ];

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>

      {/* Profile Header */}
      <View style={s.profileHeader}>
        <View style={s.bigAvatar}><Text style={s.bigAvatarTxt}>{initials}</Text></View>
        <Text style={s.farmerName}>{farm?.farmer_name}</Text>
        <Text style={s.farmIdTxt}>{farm?.farm_id} · {farm?.location}</Text>
        <View style={s.verifiedBadge}>
          <Text style={s.verifiedTxt}>✓ Verified Farmer</Text>
        </View>
      </View>

      {/* Farm Details */}
      <View style={s.sectionHeader}><Text style={s.sectionTitle}>Farm Details</Text></View>
      <View style={s.card}>
        {farmRows.map((r, i) => (
          <View key={i} style={[s.row, i < farmRows.length - 1 && s.rowBorder]}>
            <Text style={s.rowLabel}>{r.label}</Text>
            <Text style={s.rowVal}>{r.val || '—'}</Text>
          </View>
        ))}
      </View>

      {/* Bank Details */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Payment Details</Text>
        {hasBankDetails && <View style={s.savedBadge}><Text style={s.savedBadgeTxt}>✓ Saved</Text></View>}
      </View>
      <View style={s.card}>
        {hasBankDetails && !showBank ? (
          <>
            <View style={s.row}>
              <Text style={s.rowLabel}>UPI ID</Text>
              <Text style={s.rowVal}>{(farm as any)?.bank_details?.upi_id || '—'}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.rowLabel}>Bank Account</Text>
              <Text style={s.rowVal}>{(farm as any)?.bank_details?.account_no ? `****${(farm as any).bank_details.account_no.slice(-4)}` : '—'}</Text>
            </View>
            <View style={[s.row, s.rowBorder]}>
              <Text style={s.rowLabel}>IFSC</Text>
              <Text style={s.rowVal}>{(farm as any)?.bank_details?.ifsc || '—'}</Text>
            </View>
            <TouchableOpacity style={s.editBtn} onPress={() => setShowBank(true)}>
              <Text style={s.editBtnTxt}>Edit Payment Details</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={s.actionRow} onPress={() => setShowBank(!showBank)}>
            <View>
              <Text style={s.actionTxt}>
                {hasBankDetails ? 'Edit Payment Details' : 'Add Payment Details'}
              </Text>
              <Text style={s.actionSub}>UPI ID or Bank Account for credit payments</Text>
            </View>
            <Text style={s.actionArrow}>{showBank ? '▲' : '▼'}</Text>
          </TouchableOpacity>
        )}

        {showBank && (
          <View style={s.formWrap}>
            <Text style={s.notice}>
              💡 Your payment details are used to transfer carbon credit earnings directly to your account. All data is encrypted and secure.
            </Text>

            <Text style={s.fieldLabel}>Account Holder Name</Text>
            <TextInput style={s.input} value={accountName} onChangeText={setAccountName}
              placeholder="As per bank records" placeholderTextColor="#4a5e4a" />

            <Text style={s.fieldLabel}>UPI ID (Recommended)</Text>
            <TextInput style={s.input} value={upiId} onChangeText={setUpiId}
              placeholder="e.g. 9876543210@upi" placeholderTextColor="#4a5e4a"
              keyboardType="email-address" autoCapitalize="none" />

            <View style={s.divider}><Text style={s.dividerTxt}>— OR Bank Account —</Text></View>

            <Text style={s.fieldLabel}>Bank Account Number</Text>
            <TextInput style={s.input} value={accountNo} onChangeText={setAccountNo}
              placeholder="Enter account number" placeholderTextColor="#4a5e4a"
              keyboardType="number-pad" secureTextEntry />

            <Text style={s.fieldLabel}>IFSC Code</Text>
            <TextInput style={s.input} value={ifsc} onChangeText={v => setIfsc(v.toUpperCase())}
              placeholder="e.g. SBIN0001234" placeholderTextColor="#4a5e4a"
              autoCapitalize="characters" />

            <Text style={s.fieldLabel}>Bank Name</Text>
            <TextInput style={s.input} value={bankName} onChangeText={setBankName}
              placeholder="e.g. State Bank of India" placeholderTextColor="#4a5e4a" />

            <View style={s.btnRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowBank(false)}>
                <Text style={s.cancelBtnTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, savingBank && { opacity: 0.6 }]}
                onPress={handleSaveBankDetails} disabled={savingBank}>
                {savingBank
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text style={s.saveBtnTxt}>Save Details</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Season Update */}
      <View style={s.sectionHeader}><Text style={s.sectionTitle}>Current Season</Text></View>
      <View style={s.card}>
        <TouchableOpacity style={s.actionRow} onPress={() => setShowSeason(!showSeason)}>
          <View>
            <Text style={s.actionTxt}>{t('updateSeason')}</Text>
            <Text style={s.actionSub}>Update crop and season details</Text>
          </View>
          <Text style={s.actionArrow}>{showSeason ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {showSeason && (
          <View style={s.formWrap}>
            <Text style={s.fieldLabel}>{t('seasonName')}</Text>
            <TextInput style={s.input} placeholder="e.g. Kharif 2025"
              placeholderTextColor="#4a5e4a" value={seasonName} onChangeText={setSeasonName} />

            <Text style={s.fieldLabel}>{t('cropType')}</Text>
            <View style={s.chipGrid}>
              {CROPS.map(c => (
                <TouchableOpacity key={c}
                  style={[s.chip, cropType === c && s.chipActive]}
                  onPress={() => setCropType(c)}>
                  <Text style={[s.chipTxt, cropType === c && s.chipTxtActive]}>{t(c as any)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.btnRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowSeason(false)}>
                <Text style={s.cancelBtnTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, savingSeason && { opacity: 0.6 }]}
                onPress={handleSaveSeason} disabled={savingSeason}>
                {savingSeason
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text style={s.saveBtnTxt}>{t('saveSeason')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Language */}
      <View style={s.sectionHeader}><Text style={s.sectionTitle}>Preferences</Text></View>
      <View style={s.card}>
        <View style={s.actionRow}>
          <View>
            <Text style={s.actionTxt}>{t('language')}</Text>
            <Text style={s.actionSub}>English / मराठी</Text>
          </View>
          <TouchableOpacity style={s.langToggle} onPress={toggleLang}>
            <Text style={[s.langOpt, lang === 'en' && s.langOptActive]}>EN</Text>
            <Text style={s.langSep}>|</Text>
            <Text style={[s.langOpt, lang === 'mr' && s.langOptActive]}>मर</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Support */}
      <View style={s.card} style={{ margin: 16, marginBottom: 0, backgroundColor: '#1a2e1a', borderRadius: 14, borderWidth: 1, borderColor: '#2d4a2d', overflow: 'hidden' }}>
        <View style={s.row}>
          <Text style={s.rowLabel}>Helpline</Text>
          <Text style={[s.rowVal, { color: '#4ade80' }]}>1800-XXX-XXXX</Text>
        </View>
        <View style={[s.row, s.rowBorder]}>
          <Text style={s.rowLabel}>Support Email</Text>
          <Text style={[s.rowVal, { color: '#4ade80' }]}>support@greenledger.in</Text>
        </View>
        <View style={s.row}>
          <Text style={s.rowLabel}>Version</Text>
          <Text style={s.rowVal}>GreenLedger v2.0</Text>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
        <Text style={s.logoutTxt}>🚪 {t('logout')}</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#0f1f0f' },
  profileHeader:   { backgroundColor: '#1a2e1a', padding: 32, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#2d4a2d' },
  bigAvatar:       { width: 80, height: 80, borderRadius: 40, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 3, borderColor: '#4ade80' },
  bigAvatarTxt:    { color: 'white', fontSize: 28, fontWeight: '700' },
  farmerName:      { fontSize: 22, fontWeight: '700', color: '#f0fdf4', marginBottom: 4 },
  farmIdTxt:       { fontSize: 14, color: '#86efac', marginBottom: 10 },
  verifiedBadge:   { backgroundColor: 'rgba(74,222,128,0.15)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)' },
  verifiedTxt:     { color: '#4ade80', fontSize: 12, fontWeight: '600' },
  sectionHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  sectionTitle:    { fontSize: 11, fontWeight: '700', color: '#86efac', textTransform: 'uppercase', letterSpacing: 1 },
  savedBadge:      { backgroundColor: 'rgba(74,222,128,0.15)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  savedBadgeTxt:   { color: '#4ade80', fontSize: 10, fontWeight: '600' },
  card:            { marginHorizontal: 16, marginBottom: 0, backgroundColor: '#1a2e1a', borderRadius: 14, borderWidth: 1, borderColor: '#2d4a2d', overflow: 'hidden' },
  row:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  rowBorder:       { borderBottomWidth: 1, borderBottomColor: '#2d4a2d' },
  rowLabel:        { fontSize: 13, color: '#86efac' },
  rowVal:          { fontSize: 13, color: '#f0fdf4', fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  actionRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  actionTxt:       { fontSize: 14, color: '#f0fdf4', fontWeight: '500' },
  actionSub:       { fontSize: 11, color: '#4a5e4a', marginTop: 2 },
  actionArrow:     { color: '#4ade80', fontSize: 12 },
  editBtn:         { margin: 12, backgroundColor: '#243524', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2d4a2d' },
  editBtnTxt:      { color: '#4ade80', fontSize: 13, fontWeight: '500' },
  formWrap:        { padding: 16, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#2d4a2d' },
  notice:          { backgroundColor: 'rgba(74,222,128,0.08)', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12, color: '#86efac', lineHeight: 18, borderWidth: 1, borderColor: 'rgba(74,222,128,0.15)' },
  fieldLabel:      { fontSize: 11, color: '#86efac', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 12 },
  input:           { backgroundColor: '#243524', borderRadius: 10, borderWidth: 1, borderColor: '#2d4a2d', color: '#f0fdf4', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  divider:         { alignItems: 'center', marginVertical: 14 },
  dividerTxt:      { color: '#4a5e4a', fontSize: 12 },
  btnRow:          { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn:       { flex: 1, backgroundColor: '#243524', borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#2d4a2d' },
  cancelBtnTxt:    { color: '#86efac', fontSize: 14 },
  saveBtn:         { flex: 2, backgroundColor: '#16a34a', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveBtnTxt:      { color: 'white', fontSize: 14, fontWeight: '600' },
  chipGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip:            { backgroundColor: '#243524', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#2d4a2d' },
  chipActive:      { backgroundColor: '#16a34a', borderColor: '#4ade80' },
  chipTxt:         { color: '#86efac', fontSize: 12 },
  chipTxtActive:   { color: 'white', fontWeight: '600' },
  langToggle:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#243524', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#2d4a2d' },
  langOpt:         { fontSize: 13, color: '#4a5e4a', paddingHorizontal: 4 },
  langOptActive:   { color: '#4ade80', fontWeight: '700' },
  langSep:         { color: '#2d4a2d', marginHorizontal: 2 },
  logoutBtn:       { margin: 16, marginTop: 16, backgroundColor: 'rgba(248,113,113,0.1)', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)' },
  logoutTxt:       { color: '#f87171', fontSize: 15, fontWeight: '600' },
});
