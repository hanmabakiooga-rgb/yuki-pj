import Slider from '@react-native-community/slider';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BigButton } from '../components/BigButton';
import { Colors } from '../constants/colors';
import { useRecordingConfig } from '../contexts/RecordingContext';

/**
 * CameraSetupScreen（録画設定画面）— PRD 3-1。
 * 外/インカメ切替、ズーム調整、決定で SetupScreen に戻る。
 * ライブプレビューを大きく表示して、画角と倍率を確認できるようにする。
 */
export default function CameraSetupScreen() {
  const router = useRouter();
  const { config, setConfig } = useRecordingConfig();

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();

  // 録画にはカメラ + マイクが必要。両方リクエスト。
  useEffect(() => {
    if (camPerm && !camPerm.granted && camPerm.canAskAgain) {
      requestCamPerm().catch(() => {});
    }
    if (micPerm && !micPerm.granted && micPerm.canAskAgain) {
      requestMicPerm().catch(() => {});
    }
  }, [camPerm, micPerm, requestCamPerm, requestMicPerm]);

  const toggleFacing = () => {
    setConfig({ facing: config.facing === 'back' ? 'front' : 'back' });
  };

  const confirm = () => {
    setConfig({ enabled: true });
    router.back();
  };

  const cancel = () => {
    setConfig({ enabled: false });
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>録画設定</Text>
      </View>

      <View style={styles.previewWrap}>
        {camPerm?.granted ? (
          <CameraView
            style={styles.preview}
            facing={config.facing}
            zoom={config.zoom}
            mode="video"
          />
        ) : (
          <View style={[styles.preview, styles.previewPlaceholder]}>
            <Text style={styles.placeholderText}>
              {camPerm && !camPerm.canAskAgain
                ? 'カメラへのアクセスが拒否されています。\n設定アプリから許可してください。'
                : 'カメラ権限を要求しています…'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        {/* カメラ切替 */}
        <View style={styles.row}>
          <Text style={styles.label}>カメラ</Text>
          <BigButton
            label={config.facing === 'back' ? '外カメラ' : 'インカメ'}
            variant="secondary"
            onPress={toggleFacing}
            style={styles.facingButton}
          />
        </View>

        {/* ズーム */}
        <View>
          <View style={styles.row}>
            <Text style={styles.label}>ズーム</Text>
            <Text style={styles.zoomValue}>{config.zoom.toFixed(2)}</Text>
          </View>
          <Slider
            value={config.zoom}
            minimumValue={0}
            maximumValue={1}
            step={0.01}
            minimumTrackTintColor={Colors.accent}
            maximumTrackTintColor={Colors.border}
            thumbTintColor={Colors.text}
            onValueChange={(v) => setConfig({ zoom: v })}
          />
        </View>

        {micPerm && !micPerm.granted ? (
          <Text style={styles.warn}>
            ※ 音声付きで録画するにはマイク権限も必要です
          </Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        <BigButton label="キャンセル" variant="secondary" onPress={cancel} style={styles.flex} />
        <BigButton
          label="決定"
          variant="primary"
          onPress={confirm}
          disabled={!camPerm?.granted}
          style={styles.flex}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  previewWrap: {
    flex: 1,
    paddingHorizontal: 20,
  },
  preview: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  previewPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  placeholderText: {
    color: Colors.textMuted,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  controls: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  facingButton: {
    minHeight: 48,
    paddingHorizontal: 20,
  },
  zoomValue: {
    color: Colors.textMuted,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  warn: {
    color: Colors.accent,
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  flex: { flex: 1 },
});
