import { Redirect } from 'expo-router';

export default function BudgetDeepLink() {
  return <Redirect href="/(tabs)/budget" />;
}
