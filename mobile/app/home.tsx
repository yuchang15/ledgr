import { Redirect } from 'expo-router';

export default function HomeDeepLink() {
  return <Redirect href="/(tabs)" />;
}
