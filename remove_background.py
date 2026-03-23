"""
背景削除スクリプト（Google Colab用）
rembg + BiRefNet モデルを使用して、画像の背景を白色に置換します。

使い方:
1. Google Colabで実行
2. work_images フォルダに画像を配置
3. output_images フォルダに処理済み画像が出力されます
"""

import os
import numpy as np

from google.colab import drive
from rembg import remove, new_session
from PIL import Image, ImageOps, ImageFilter

# 1. Googleドライブをマウント
drive.mount('/content/drive')

# 2. BiRefNet高精度モデルのセッション作成
# BiRefNetは最新の高精度セグメンテーションモデルで、
# 細かいエッジ（首元、髪、服の境界）の保持に優れています
print("高精度AIモデル(BiRefNet)を読み込んでいます...（初回のみ時間がかかります）")
model_name = "birefnet-general"
session = new_session(model_name)

# 3. フォルダパスの設定
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

            # BiRefNetで背景削除（alpha_mattingは使わない＝被写体を削りすぎない）
            output_image = remove(input_image, session=session)

            # マスクのエッジを滑らかにしてギザギザを軽減
            if output_image.mode == 'RGBA':
                alpha = output_image.split()[3]
                # 軽くぼかしてからしきい値で二値化し、滑らかなエッジにする
                alpha_smooth = alpha.filter(ImageFilter.GaussianBlur(radius=1))
                alpha_np = np.array(alpha_smooth)
                # 薄い半透明部分（背景の残り）を除去、被写体部分はしっかり残す
                alpha_np = np.where(alpha_np > 30, 255, 0).astype(np.uint8)
                alpha_clean = Image.fromarray(alpha_np)
                output_image.putalpha(alpha_clean)

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
