import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const OPEN_ADD_KEY = 'kachingo_open_add';

export default function AddDeepLink() {
  const router = useRouter();
  useEffect(() => {
    AsyncStorage.setItem(OPEN_ADD_KEY, '1').then(() => {
      router.replace('/(tabs)');
    });
  }, []);
  return <View style={{ flex: 1, backgroundColor: '#000' }} />;
}
