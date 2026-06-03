import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

/** 録画設定。CameraSetupScreen で決定し、TimerScreen で参照する。 */
export interface RecordingConfig {
  /** 録画機能を使うか */
  enabled: boolean;
  /** 'back'=外カメラ / 'front'=インカメ */
  facing: 'back' | 'front';
  /** 0〜1（CameraView の zoom 仕様に合わせて 0〜1 の正規化値） */
  zoom: number;
  /** 直近の保存先（カメラロール）URI。AlertScreen 表示などに使う想定。 */
  lastSavedUri: string | null;
}

export const DEFAULT_RECORDING_CONFIG: RecordingConfig = {
  enabled: false,
  facing: 'back',
  zoom: 0,
  lastSavedUri: null,
};

interface RecordingContextValue {
  config: RecordingConfig;
  setConfig: (next: Partial<RecordingConfig>) => void;
  reset: () => void;
}

const RecordingContext = createContext<RecordingContextValue | null>(null);

export function RecordingProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<RecordingConfig>(DEFAULT_RECORDING_CONFIG);

  const value = useMemo<RecordingContextValue>(
    () => ({
      config,
      setConfig: (next) => setConfigState((prev) => ({ ...prev, ...next })),
      reset: () => setConfigState(DEFAULT_RECORDING_CONFIG),
    }),
    [config],
  );

  return <RecordingContext.Provider value={value}>{children}</RecordingContext.Provider>;
}

export function useRecordingConfig(): RecordingContextValue {
  const ctx = useContext(RecordingContext);
  if (!ctx) {
    throw new Error('useRecordingConfig must be used within RecordingProvider');
  }
  return ctx;
}
