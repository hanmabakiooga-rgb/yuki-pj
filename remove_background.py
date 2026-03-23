"""
背景削除スクリプト（Google Colab用）
rembg + isnet-general-use モデルを使用して、画像の背景を白色に置換します。

使い方:
1. Google Colabで実行
2. work_images フォルダに画像を配置
3. output_images フォルダに処理済み画像が出力されます
"""

import os

from google.colab import drive
from rembg import remove, new_session
from PIL import Image, ImageOps

# 1. Googleドライブをマウント
drive.mount('/content/drive')

# 2. 超高精度モデル（isnet-general-use）のセッション作成
# このモデルは服の質感や細かい境界線の維持に優れています
print("高精度AIモデルを読み込んでいます...（初回のみ時間がかかります）")
model_name = "isnet-general-use"
session = new_session(model_name)

# 3. フォルダパスの設定
# 入力元：work_images フォルダ
# 出力先：output_images フォルダ
input_folder = '/content/drive/MyDrive/work_images'
output_folder = '/content/drive/MyDrive/output_images'

if not os.path.exists(output_folder):
    os.makedirs(output_folder)

# 4. 一括処理の実行
print("処理を開始します...")

for filename in os.listdir(input_folder):
    if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
        input_path = os.path.join(input_folder, filename)
        output_path = os.path.join(output_folder, filename)

        try:
            # 画像の読み込み
            input_image = Image.open(input_path)

            # 元画像の向きを正しく修正（EXIF情報対応）
            input_image = ImageOps.exif_transpose(input_image)

            # 背景削除（alpha_mattingをTrueにして境界線の精度を極限まで高める）
            # これにより、シルバーの足元の反射やレースの透け感が綺麗に残ります
            output_image = remove(
                input_image,
                session=session,
                alpha_matting=True,
                alpha_matting_foreground_threshold=240,
                alpha_matting_background_threshold=10,
                alpha_matting_erode_size=10,
            )

            # 完全に真っ白な背景（RGB: 255, 255, 255）を作成
            white_bg = Image.new("RGB", output_image.size, (255, 255, 255))

            # 切り抜いた画像を白背景に重ねる
            if output_image.mode == 'RGBA':
                white_bg.paste(output_image, mask=output_image.split()[3])
            else:
                white_bg.paste(output_image)

            # 高画質(JPEG quality 95)で保存
            white_bg.save(output_path, "JPEG", quality=95)
            print(f"完了: {filename}")

        except Exception as e:
            print(f"失敗: {filename} - エラー内容: {e}")

print("\n--- すべての処理が完了しました！ ---")
print(f"保存先フォルダ: {output_folder}")
