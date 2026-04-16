import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

interface Farm {
  farm_id: string;
  farmer_name: string;
  phone: string;
  location: string;
  district: string;
  area_hectares: number;
  crop_type: string;
  practice: string;
  ndvi: number;
  total_credits: number;
  total_co2: number;
  device_id: string;
}

interface AuthContextType {
  farm: Farm | null;
  phone: string;
  setPhone: (p: string) => void;
  setFarm: (f: Farm) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  farm: null, phone: '', setPhone: () => {}, setFarm: () => {},
  logout: () => {}, isLoading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [farm, setFarmState] = useState<Farm | null>(null);
  const [phone, setPhoneState] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const saved = await SecureStore.getItemAsync('farm_data');
        if (saved) setFarmState(JSON.parse(saved));
      } catch {}
      setIsLoading(false);
    };
    load();
  }, []);

  const setFarm = async (f: Farm) => {
    setFarmState(f);
    await SecureStore.setItemAsync('farm_data', JSON.stringify(f));
  };

  const setPhone = (p: string) => setPhoneState(p);

  const logout = async () => {
    setFarmState(null);
    setPhoneState('');
    await SecureStore.deleteItemAsync('farm_data');
  };

  return (
    <AuthContext.Provider value={{ farm, phone, setPhone, setFarm, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
