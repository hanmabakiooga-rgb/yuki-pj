import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Expo Go 上で動作しているか。
 *
 * Expo Go には Expo SDK 同梱モジュールしか含まれないため、第三者ネイティブ
 * モジュール（react-native-volume-manager / react-native-google-mobile-ads 等）は
 * 利用できない。これらは import / require した時点でネイティブにアクセスして
 * クラッシュすることがあるため、この判定で Expo Go では読み込みを回避する。
 *
 * 開発ビルド（development client）や本番ビルドでは false になり、通常どおり動作する。
 */
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
