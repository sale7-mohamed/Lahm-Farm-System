import os
import uuid
import logging
import subprocess
import glob
import tempfile
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.conf import settings
import imageio_ffmpeg

logger = logging.getLogger(__name__)

def get_best_font(font_size):
    font_paths =[
        "arial.ttf",
        "tahoma.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf",
        "C:\\Windows\\Fonts\\arial.ttf"
    ]
    for path in font_paths:
        try:
            return ImageFont.truetype(path, font_size)
        except IOError:
            continue
    return ImageFont.load_default()

def apply_image_watermark(image_file, animal_code, phone="01037029909"):
    try:
        img = Image.open(image_file).convert("RGBA")
        txt_layer = Image.new("RGBA", img.size, (255, 255, 255, 0))
        draw = ImageDraw.Draw(txt_layer)

        width, height = img.size
        font_size = max(int(width * 0.025), 14)
        font = get_best_font(font_size)

        text_color = (255, 255, 255, 180)
        outline_color = (0, 0, 0, 200)
        outline_width = max(1, int(font_size * 0.04))

        phone_text = str(phone)
        code_text = str(animal_code)

        phone_bbox = draw.textbbox((0, 0), phone_text, font=font)
        phone_w = phone_bbox[2] - phone_bbox[0]
        phone_h = phone_bbox[3] - phone_bbox[1]

        code_bbox = draw.textbbox((0, 0), code_text, font=font)
        code_w = code_bbox[2] - code_bbox[0]
        code_h = code_bbox[3] - code_bbox[1]

        phone_x = (width - phone_w) / 2
        phone_y = (height - phone_h - code_h - 10) / 2

        code_x = (width - code_w) / 2
        code_y = phone_y + phone_h + 10

        for x_offset in range(-outline_width, outline_width + 1):
            for y_offset in range(-outline_width, outline_width + 1):
                draw.text((phone_x + x_offset, phone_y + y_offset), phone_text, fill=outline_color, font=font)
                draw.text((code_x + x_offset, code_y + y_offset), code_text, fill=outline_color, font=font)

        draw.text((phone_x, phone_y), phone_text, fill=text_color, font=font)
        draw.text((code_x, code_y), code_text, fill=text_color, font=font)

        logo_path = os.path.join(settings.BASE_DIR, 'static', 'logo.png')
        if not os.path.exists(logo_path):
            logo_path = os.path.join(settings.BASE_DIR, 'media', 'logo.png')

        if os.path.exists(logo_path):
            logo = Image.open(logo_path).convert("RGBA")
            logo_size = int(width * 0.15)
            logo.thumbnail((logo_size, logo_size))

            alpha = logo.split()[3]
            alpha = alpha.point(lambda p: p * 0.6)
            logo.putalpha(alpha)

            logo_x = width - logo.width - 20
            logo_y = 20
            img.paste(logo, (logo_x, logo_y), logo)

        watermarked = Image.alpha_composite(img, txt_layer).convert("RGB")
        buffer = BytesIO()
        watermarked.save(buffer, format='JPEG', quality=95)
        buffer.seek(0)

        return InMemoryUploadedFile(
            buffer, 'ImageField',
            f"{uuid.uuid4().hex[:8]}.jpg",
            'image/jpeg', buffer.getbuffer().nbytes, None
        )
    except Exception as e:
        logger.error(f"Image watermark failed: {e}")
        return image_file

def apply_video_watermark(video_path, animal_code, phone="01037029909"):
    base, ext = os.path.splitext(video_path)
    output_path = f"{base}_wm_{uuid.uuid4().hex[:4]}.mp4"
    text_file_path = None

    try:
        ffmpeg_exe = 'ffmpeg'

        # 1.   
        logo_path = os.path.join(settings.BASE_DIR, 'static', 'logo.png')
        if not os.path.exists(logo_path):
            logo_path = os.path.join(settings.BASE_DIR, 'media', 'logo.png')
        has_logo = os.path.exists(logo_path)

        # 2.        (  )
        font_paths =[
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            "/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
            "C:\\Windows\\Fonts\\arial.ttf",
        ]
        valid_font = None
        for p in font_paths:
            if os.path.exists(p):
                valid_font = p
                break

        if not valid_font:
            for d in["/usr/share/fonts", "/usr/local/share/fonts"]:
                found = glob.glob(os.path.join(d, "**", "*.ttf"), recursive=True)
                if found:
                    valid_font = found[0]
                    break

        valid_font_ff = valid_font.replace('\\', '/').replace(':', '\\:') if valid_font else ""

        # 4.   FFmpeg  
        cmd =[ffmpeg_exe, '-y', '-i', video_path]

        if has_logo:
            cmd.extend(['-i', logo_path])

        font_opt = f"fontfile='{valid_font_ff}':" if valid_font_ff else ""

        text_str = f"{phone} | {animal_code}"

        drawtext_filter = f"drawtext={font_opt}text='{text_str}':x=(w-text_w)/2:y=(h-text_h)/2:fontsize=35:fontcolor=white@0.8:borderw=2:bordercolor=black@0.8"

        filter_complex = ""
        if has_logo:
            #      60%
            filter_complex += "[1:v]scale=150:-1,colorchannelmixer=aa=0.6[logo];"
            filter_complex += "[0:v][logo]overlay=W-w-20:20[with_logo];"
            filter_complex += f"[with_logo]{drawtext_filter}[v_out]"
        else:
            filter_complex += f"[0:v]{drawtext_filter}[v_out]"

        cmd.extend([
            '-filter_complex', filter_complex,
            '-map', '[v_out]',
            '-map', '0:a?',
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '28',
            '-c:a', 'aac',
            output_path
        ])

        #   subprocess
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        if result.returncode != 0:
            err_msg = result.stderr.decode('utf8', errors='ignore')
            logger.error(f"FFmpeg video processing error: {err_msg}")

            #      (        )
            if "Invalid stream specifier" in err_msg or "map" in err_msg:
                cmd_fallback =[ffmpeg_exe, '-y', '-i', video_path]
                if has_logo:
                    cmd_fallback.extend(['-i', logo_path])
                cmd_fallback.extend([
                    '-filter_complex', filter_complex,
                    '-map', '[v_out]',
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '28',
                    output_path
                ])
                res_fallback = subprocess.run(cmd_fallback, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                if res_fallback.returncode == 0:
                    return output_path

            return video_path

        return output_path

    except Exception as e:
        logger.error(f"Video watermark failed entirely: {e}")
        return video_path
    finally:

        if text_file_path and os.path.exists(text_file_path):
            try:
                os.remove(text_file_path)
            except:
                pass
