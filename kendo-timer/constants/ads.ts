import { Platform } from 'react-native';

/**
 * AdMob ユニット ID。
 *
 * Google が公開しているテスト用バナー ID（本番では絶対に使用しないこと）。
 * 本番リリース時は AdMob 管理画面で発行した実 ID に差し替える。
 * @see https://developers.google.com/admob/ios/test-ads
 * @see https://developers.google.com/admob/android/test-ads
 */
export const TEST_BANNER_UNIT_ID = Platform.select({
  ios: 'ca-app-pub-3940256099942544/2934735716',
  android: 'ca-app-pub-3940256099942544/6300978111',
  default: 'ca-app-pub-3940256099942544/6300978111',
}) as string;

/**
 * TODO(release): 本番リリース時、以下を実際の AdMob ユニット ID で置き換える。
 * iOS / Android で別 ID を発行すること。
 */
export const PROD_BANNER_UNIT_ID: { ios: string; android: string } = {
  ios: 'REPLACE_WITH_PROD_IOS_BANNER_ID',
  android: 'REPLACE_WITH_PROD_ANDROID_BANNER_ID',
};

/** 開発ビルドかどうか */
export const IS_DEV = __DEV__;

/** 実際に使うユニット ID（開発中はテスト ID 固定） */
export const BANNER_UNIT_ID = IS_DEV
  ? TEST_BANNER_UNIT_ID
  : (Platform.select({
      ios: PROD_BANNER_UNIT_ID.ios,
      android: PROD_BANNER_UNIT_ID.android,
      default: PROD_BANNER_UNIT_ID.android,
    }) as string);
