import { Alert, Platform } from 'react-native';

/** Cross-platform confirm. Alert.alert is unreliable on web. */
export function confirmDestructive(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      // eslint-disable-next-line no-alert
      return Promise.resolve(window.confirm(`${title}\n\n${message}`));
    } catch {
      return Promise.resolve(true);
    }
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Удалить', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
