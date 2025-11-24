#!/usr/bin/env python3
"""
Script para generar iconos predeterminados para la extensión Chrome
Genera iconos PNG en tamaños 16x16, 48x48 y 128x128
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    import os
except ImportError:
    print("Error: Se requiere la librería Pillow (PIL)")
    print("Instala con: pip install Pillow")
    exit(1)

def create_icon(size, output_path):
    """Crea un icono con diseño de paginación"""
    # Crear imagen con fondo transparente
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Colores
    bg_color = (74, 144, 226, 255)  # #4a90e2
    border_color = (53, 122, 189, 255)  # #357abd
    text_color = (255, 255, 255, 255)  # Blanco
    
    # Dibujar fondo redondeado
    margin = max(1, size // 16)
    draw.ellipse([margin, margin, size - margin, size - margin], 
                 fill=bg_color, outline=border_color, width=max(1, size // 32))
    
    # Dibujar símbolo de paginación (páginas apiladas)
    center_x, center_y = size // 2, size // 2
    
    if size >= 48:
        # Para iconos grandes: dibujar páginas apiladas
        page_width = size // 3
        page_height = size // 4
        offset = size // 12
        
        # Página de atrás
        draw.rectangle(
            [center_x - page_width // 2 + offset, center_y - page_height // 2 + offset,
             center_x + page_width // 2 + offset, center_y + page_height // 2 + offset],
            fill=(255, 255, 255, 200), outline=(200, 200, 200, 255), width=1
        )
        
        # Página del medio
        draw.rectangle(
            [center_x - page_width // 2, center_y - page_height // 2,
             center_x + page_width // 2, center_y + page_height // 2],
            fill=(255, 255, 255, 255), outline=(180, 180, 180, 255), width=1
        )
        
        # Líneas de texto simuladas
        line_y1 = center_y - page_height // 4
        line_y2 = center_y
        line_y3 = center_y + page_height // 4
        line_width = page_width // 2
        
        draw.line([center_x - line_width // 2, line_y1, center_x + line_width // 2, line_y1], 
                 fill=(100, 100, 100, 255), width=1)
        draw.line([center_x - line_width // 2, line_y2, center_x + line_width // 2, line_y2], 
                 fill=(100, 100, 100, 255), width=1)
    else:
        # Para iconos pequeños: solo mostrar "P"
        try:
            # Intentar usar una fuente del sistema
            font_size = int(size * 0.7)
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except:
            try:
                font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
            except:
                # Fuente por defecto
                font = ImageFont.load_default()
        
        # Calcular posición del texto
        bbox = draw.textbbox((0, 0), "P", font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        text_x = center_x - text_width // 2
        text_y = center_y - text_height // 2
        
        draw.text((text_x, text_y), "P", fill=text_color, font=font)
    
    # Guardar imagen
    img.save(output_path, 'PNG')
    print(f"✓ Icono generado: {output_path} ({size}x{size})")

def main():
    """Función principal"""
    sizes = [16, 48, 128]
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    print("Generando iconos para la extensión Chrome...")
    print("-" * 50)
    
    for size in sizes:
        output_path = os.path.join(base_dir, f"icon{size}.png")
        create_icon(size, output_path)
    
    print("-" * 50)
    print("¡Iconos generados exitosamente!")
    print(f"Ubicación: {base_dir}")

if __name__ == "__main__":
    main()

