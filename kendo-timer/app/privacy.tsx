import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';

/**
 * プライバシーポリシー画面（App Store 審査要件）。
 *
 * 文面はテンプレートのため、運営者情報（社名・連絡先・URL）と
 * 取得する情報の範囲を最終リリース前に確認・更新すること。
 */
export default function PrivacyScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h1}>プライバシーポリシー</Text>
        <Text style={styles.muted}>最終更新日: 2026年6月3日</Text>

        <Text style={styles.h2}>1. 当アプリが取得する情報</Text>
        <Text style={styles.p}>
          本アプリ「剣道タイマー」は、稽古時間の計測・通知のみを目的として動作します。
          ユーザーの氏名・連絡先・位置情報などの個人を特定可能な情報は取得しません。
        </Text>
        <Text style={styles.p}>
          以下の端末機能を、機能提供のためにのみ利用します。取得したデータは端末内に保持され、
          外部サーバーへ送信されることはありません。
        </Text>
        <Text style={styles.li}>・カメラ：終了通知時の LED フラッシュ点滅、稽古動画の録画</Text>
        <Text style={styles.li}>・マイク：稽古動画の音声録音（録画を有効にしている場合のみ）</Text>
        <Text style={styles.li}>・写真ライブラリ：録画した動画の保存</Text>
        <Text style={styles.li}>・画面輝度：終了通知時の輝度自動最大化</Text>

        <Text style={styles.h2}>2. 広告について</Text>
        <Text style={styles.p}>
          本アプリは Google AdMob を利用したバナー広告を表示することがあります。AdMob は広告
          配信のために広告 ID 等の識別子を使用する場合があります。詳細は Google のプライバシー
          ポリシーをご確認ください。
        </Text>

        <Text style={styles.h2}>3. 第三者提供</Text>
        <Text style={styles.p}>
          当アプリが取得した情報を、ユーザーの同意なく第三者に提供することはありません。
        </Text>

        <Text style={styles.h2}>4. お問い合わせ</Text>
        <Text style={styles.p}>
          本ポリシーに関するお問い合わせは、アプリ運営者までご連絡ください。
        </Text>

        <Text style={[styles.muted, styles.footer]}>
          ※ 文面は審査用テンプレートです。リリース前に運営者情報を含めて最終化してください。
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, gap: 8 },
  h1: { color: Colors.text, fontSize: 22, fontWeight: '800', marginBottom: 4 },
  h2: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 4,
  },
  p: { color: Colors.text, fontSize: 14, lineHeight: 22 },
  li: { color: Colors.text, fontSize: 14, lineHeight: 22, marginLeft: 8 },
  muted: { color: Colors.textMuted, fontSize: 12 },
  footer: { marginTop: 24 },
});
