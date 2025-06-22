#!/usr/bin/env python3
"""
Create PWA icons for AgeDefy AI platform
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

import os

def create_simple_icon(size, filename):
    """Create a simple colored icon without PIL"""
    svg_content = f'''<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0d9488;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="{size}" height="{size}" rx="{size//8}" fill="url(#grad)"/>
  <text x="{size//2}" y="{size//2 - 10}" font-family="Arial, sans-serif" font-size="{size//4}" font-weight="bold" text-anchor="middle" fill="white">AD</text>
  <text x="{size//2}" y="{size//2 + 20}" font-family="Arial, sans-serif" font-size="{size//8}" text-anchor="middle" fill="white">AI</text>
</svg>'''
    
    svg_file = f'/tmp/icon_{size}.svg'
    with open(svg_file, 'w') as f:
        f.write(svg_content)
    
    convert_commands = [
        f'convert {svg_file} {filename}',
        f'magick {svg_file} {filename}',
        f'rsvg-convert -w {size} -h {size} {svg_file} -o {filename}'
    ]
    
    for cmd in convert_commands:
        if os.system(cmd + ' 2>/dev/null') == 0:
            print(f"Created {filename} using {cmd.split()[0]}")
            return True
    
    return False

def create_pil_icon(size, filename):
    """Create icon using PIL"""
    img = Image.new('RGB', (size, size), color='#0d9488')
    draw = ImageDraw.Draw(img)
    
    for i in range(size):
        color_val = int(13 + (124-13) * i / size)  # Gradient from teal to purple
        draw.line([(i, 0), (i, size)], fill=(color_val, 148 + i//4, 136 + i//3))
    
    border_size = size // 8
    draw.rectangle([border_size, border_size, size-border_size, size-border_size], 
                  fill=None, outline='#ffffff', width=4)
    
    try:
        font_size = size // 4
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', font_size)
    except:
        font = ImageFont.load_default()
    
    draw.text((size//2, size//2 - 20), 'AD', font=font, fill='white', anchor='mm')
    try:
        small_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', font_size//2)
    except:
        small_font = font
    draw.text((size//2, size//2 + 20), 'AI', font=small_font, fill='white', anchor='mm')
    
    img.save(filename)
    print(f"Created {filename} using PIL")
    return True

def main():
    """Create PWA icons"""
    icons = [
        (192, 'public/icon-192x192.png'),
        (512, 'public/icon-512x512.png')
    ]
    
    success_count = 0
    
    for size, filename in icons:
        print(f"Creating {filename}...")
        
        if PIL_AVAILABLE:
            try:
                if create_pil_icon(size, filename):
                    success_count += 1
                    continue
            except Exception as e:
                print(f"PIL failed for {filename}: {e}")
        
        if create_simple_icon(size, filename):
            success_count += 1
        else:
            print(f"Failed to create {filename}")
    
    print(f"\nCreated {success_count}/{len(icons)} icons successfully")
    
    for size, filename in icons:
        if os.path.exists(filename):
            file_size = os.path.getsize(filename)
            print(f"{filename}: {file_size} bytes")
        else:
            print(f"{filename}: NOT FOUND")

if __name__ == '__main__':
    main()
