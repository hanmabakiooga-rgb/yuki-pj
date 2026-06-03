import { StyleSheet, Text, View } from 'react-native';
import { BANNER_UNIT_ID } from '../constants/ads';
import { Colors } from '../constants/colors';

/**
 * 画面下部の AdMob バナー広告（PRD 1：収益化）。
 *
 * `react-native-google-mobile-ads` は Expo Go では動作せず、開発ビルド
 * （EAS Build）が必要。インストールされていない環境ではプレースホルダを
 * 表示するフォールバック。
 *
 * - `placement` は将来の差し替え（リワード／ネイティブ広告）用に保持。
 * - AlertScreen には配置しない（全画面点滅中なので Setup / Timer のみ）。
 */
interface AdBannerProps {
  placement: 'setup' | 'timer';
}

// 動的 require でモジュール未導入環境（Expo Go）でもクラッシュさせない。
let GoogleAds: {
  BannerAd: React.ComponentType<{ unitId: string; size: string }>;
  BannerAdSize: { ADAPTIVE_BANNER: string; BANNER: string };
} | null = null;
try {
  // 開発ビルド時のみ解決される。Expo Go では catch される。
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('react-native-google-mobile-ads');
  GoogleAds = {
    BannerAd: mod.BannerAd,
    BannerAdSize: mod.BannerAdSize,
  };
} catch {
  GoogleAds = null;
}

export function AdBanner(_props: AdBannerProps) {
  if (!GoogleAds) {
    // Expo Go / Web 等では広告ライブラリが読めないためプレースホルダを表示。
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>広告バナー（開発ビルドで表示）</Text>
      </View>
    );
  }

  const { BannerAd, BannerAdSize } = GoogleAds;
  return (
    <View style={styles.adContainer}>
      <BannerAd unitId={BANNER_UNIT_ID} size={BannerAdSize.ADAPTIVE_BANNER} />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    height: 50,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  placeholderText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  adContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
});
