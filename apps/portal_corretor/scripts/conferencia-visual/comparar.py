#!/usr/bin/env python3
"""Conferência visual (specs/layout/README.md § 6), passo 2: para cada tela capturada por
`capturar.mjs`, monta a imagem lado a lado com o PNG de referência e imprime as medidas da
moldura (trilho, colunas), dos títulos, botões, campos e chips, da referência e da app.

Uso: python3 -I apps/portal_corretor/scripts/conferencia-visual/comparar.py <pasta das capturas> <pasta de saída das imagens lado a lado> [--md]
Precisa de Pillow (PIL)."""
import collections, glob, json, os, statistics, sys

REF = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'specs', 'layout')
REF = os.path.normpath(REF)

def filhos(d, pid):
    return [n for n in d['nos'] if n['parent'] == pid]

def mediana(xs):
    return int(statistics.median(xs)) if xs else None

def medidas_ref(d):
    nos = d['nos']; m = {}
    nav = [n for n in nos if n['tag'] == 'nav']; m['trilho'] = nav[0]['box']['w'] if nav else None
    main = [n for n in nos if n['tag'] == 'main']
    cols = [n for n in filhos(d, main[0]['id']) if n['tag'] == 'section'] if main else []
    m['colunas'] = [c['box']['w'] for c in cols]
    m['h1'] = next((n['style']['font'] for n in nos if n['tag'] == 'h1'), None)
    m['botoes'] = sorted({n['box']['h'] for n in nos if n['tag'] == 'button' and n['box']['w'] > 50})
    m['campos'] = sorted({n['box']['h'] for n in nos if n['tag'] == 'label' and any(f['tag'] == 'input' for f in filhos(d, n['id']))} or {n['box']['h'] for n in nos if n['tag'] in ('input', 'textarea', 'select')})
    m['chips'] = sorted({n['box']['h'] for n in nos if n['tag'] == 'span' and n['style'].get('radius') == '999px'})
    return m

def medidas_app(d):
    nos = d['nos']; m = {}
    tr = [n for n in nos if n['tag'] == 'urbi-trilho-atalhos']; m['trilho'] = tr[0]['box']['w'] if tr else None
    grade = [n for n in nos if n['tag'] in ('urbi-3-colunas', 'urbi-2x1')]
    cols = [n for n in filhos(d, grade[0]['id']) if n['tag'] == 'urbi-hospedeiro'] if grade else []
    m['colunas'] = [c['box']['w'] for c in cols]
    m['h1'] = next((n['style']['font'] for n in nos if n['tag'] == 'h1'), None)
    m['botoes'] = sorted({n['box']['h'] for n in nos if n['tag'] == 'urbi-botao'})
    m['campos'] = sorted({n['box']['h'] for n in nos if n['tag'] in ('input', 'textarea', 'select')})
    m['chips'] = sorted({n['box']['h'] for n in nos if n['tag'] in ('urbi-badge', 'urbi-chip')})
    inbox = [n for n in nos if n['tag'] == 'urbi-inbox']; m['inbox'] = inbox[0]['box'] if inbox else None
    return m

def lado_a_lado(tela, cap, saida):
    from PIL import Image, ImageDraw
    r = Image.open(os.path.join(REF, 'png', f'{tela}.png')).convert('RGB'); a = Image.open(cap).convert('RGB')
    gap = 24; h = max(r.height, a.height) + 40
    out = Image.new('RGB', (r.width + a.width + gap, h), (255, 255, 255)); d = ImageDraw.Draw(out)
    d.text((8, 8), f'{tela} - referencia (specs/layout/png) {r.width}x{r.height}', fill=(0, 0, 0))
    d.text((r.width + gap + 8, 8), f'{tela} - app na instancia {a.width}x{a.height}', fill=(0, 0, 0))
    out.paste(r, (0, 40)); out.paste(a, (r.width + gap, 40))
    d.line([(r.width + gap // 2, 0), (r.width + gap // 2, h)], fill=(180, 180, 180), width=2)
    out.save(os.path.join(saida, f'{tela}.png'))

def main():
    capturas, saida = sys.argv[1], sys.argv[2]; md = '--md' in sys.argv
    os.makedirs(saida, exist_ok=True)
    if md: print('| Tela | Trilho ref/app | Colunas ref | Colunas app | h1 ref/app | Botões ref/app | Campos ref/app | Chips ref/app |\n|---|---|---|---|---|---|---|---|')
    for cap in sorted(glob.glob(os.path.join(capturas, '*.app.json'))):
        tela = os.path.basename(cap)[:-9]
        ref = os.path.join(REF, f'{tela}.layout.json')
        if not os.path.exists(ref): print(f'{tela}: sem referência em specs/layout'); continue
        a = medidas_app(json.load(open(cap, encoding='utf-8'))); r = medidas_ref(json.load(open(ref, encoding='utf-8')))
        png = os.path.join(capturas, f'{tela}.png')
        if os.path.exists(png): lado_a_lado(tela, png, saida)
        if md: print(f"| {tela} | {r['trilho']}/{a['trilho']} | {r['colunas']} | {a['colunas']} | {r['h1']}/{a['h1']} | {r['botoes']}/{a['botoes']} | {r['campos']}/{a['campos']} | {r['chips']}/{a['chips']} |")
        else: print(tela, 'ref', r, '\n   app', a)

if __name__ == '__main__': main()
