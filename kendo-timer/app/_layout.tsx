import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { RecordingProvider } from '../contexts/RecordingContext';

/**
 * アプリ全体のナビゲーション定義。
 * ヘッダーは非表示にし、各画面が全面を使えるようにする。
 */
export default function RootLayout() {
  return (
    <RecordingProvider>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="timer" />
          {/* 終了通知は戻る操作で抜けさせない（明示的な「止め」のみ） */}
          <Stack.Screen name="alert" options={{ gestureEnabled: false }} />
          <Stack.Screen name="camera-setup" />
          <Stack.Screen name="privacy" options={{ headerShown: true, title: 'プライバシーポリシー' }} />
        </Stack>
      </SafeAreaProvider>
    </RecordingProvider>
  );
}
