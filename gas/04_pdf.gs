// ==========================================
// LINE予約ボット - 04: PDF生成
// ==========================================

/**
 * 説明書PDFを作成してDriveに保存し、共有URLを返す
 * @param {string} setsumeisho - Gemini生成の説明書本文
 * @param {string} formAnswersPdf - Block6除外済みのフォーム回答
 * @param {string} displayName - ユーザーの表示名
 * @return {string} PDFの共有URL
 */
function createSetsumeishoPdf(setsumeisho, formAnswersPdf, displayName) {
  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy年MM月dd日');
  var title = displayName + 'さんの髪の説明書';

  // Google Docsで文書を作成
  var doc  = DocumentApp.create(title);
  var body = doc.getBody();

  // タイトル
  var titlePara = body.appendParagraph(title);
  titlePara.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  titlePara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  // 作成日
  var datePara = body.appendParagraph('作成日：' + today);
  datePara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  datePara.setFontSize(10);

  body.appendParagraph('━━━━━━━━━━━━━━━━━━━━━━━')
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('');

  // Gemini生成の説明書本文
  body.appendParagraph(setsumeisho).setFontSize(11);
  body.appendParagraph('');

  body.appendParagraph('━━━━━━━━━━━━━━━━━━━━━━━')
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('');

  // フォーム回答詳細（Block6除外）
  var detailHeader = body.appendParagraph('【フォーム回答詳細】');
  detailHeader.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(formAnswersPdf).setFontSize(10);

  doc.saveAndClose();

  // PDFとしてエクスポート
  var docFile = DriveApp.getFileById(doc.getId());
  var pdfBlob = docFile.getAs('application/pdf');
  pdfBlob.setName(title + '.pdf');
  var pdfFile = DriveApp.createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // 元のGoogle Docはゴミ箱へ
  docFile.setTrashed(true);

  var pdfUrl = 'https://drive.google.com/file/d/' + pdfFile.getId() + '/view';
  console.log('PDF作成完了: ' + pdfUrl);
  return pdfUrl;
}
