// ==========================================
// LINE予約ボット - 05: Flexメッセージ構築
// ==========================================

/**
 * Flexカード：PDF案内
 * @param {string} displayName
 * @param {string} pdfUrl
 * @return {Object} Flex Bubble JSON
 */
function buildFlexCard(displayName, pdfUrl) {
  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy年MM月dd日');
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#8B6F5E',
      paddingAll: '20px',
      contents: [
        {
          type: 'text',
          text: '髪の説明書',
          color: '#ffffff',
          size: 'xl',
          weight: 'bold'
        },
        {
          type: 'text',
          text: displayName + 'さん専用',
          color: '#f0e0d6',
          size: 'sm',
          margin: 'sm'
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      contents: [
        {
          type: 'text',
          text: 'フォームのご回答ありがとうございます',
          wrap: true,
          size: 'sm',
          color: '#555555'
        },
        {
          type: 'text',
          text: 'あなただけの髪の説明書ができました。\n美容室でそのまま担当さんに見せてください。',
          wrap: true,
          size: 'sm',
          color: '#555555',
          margin: 'md'
        },
        {
          type: 'separator',
          margin: 'lg'
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'lg',
          contents: [
            {
              type: 'text',
              text: '作成日',
              size: 'xs',
              color: '#aaaaaa',
              flex: 2
            },
            {
              type: 'text',
              text: today,
              size: 'xs',
              color: '#555555',
              flex: 5
            }
          ]
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#8B6F5E',
          height: 'sm',
          action: {
            type: 'uri',
            label: 'PDFを開く・保存する',
            uri: pdfUrl
          }
        }
      ]
    }
  };
}

/**
 * CTA テキストメッセージ
 * @return {string}
 */
function buildCtaMessage() {
  return '大阪四ツ橋のHEJにご来店の場合は、このPDFをそのままLINEで送っていただければ事前に確認します\n' +
    'ご予約・ご相談はこのLINEからどうぞ！';
}
