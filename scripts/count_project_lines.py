import os

def count_lines(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            return sum(1 for _ in f)
    except Exception:
        return 0

categories = {
    'Backend (Código Fonte: app/ e scripts/)': {'files': 0, 'lines': 0},
    'Testes Backend (tests/)': {'files': 0, 'lines': 0},
    'Frontend (Componentes, Telas e Estilos: src/)': {'files': 0, 'lines': 0},
    'Testes Frontend (*.test.js/jsx)': {'files': 0, 'lines': 0},
    'Docker (Dockerfiles e docker-compose)': {'files': 0, 'lines': 0},
}

# 1. Backend
for root, dirs, files in os.walk('backend'):
    norm_root = root.replace('\\', '/')
    if any(x in norm_root for x in ['node_modules', '.git', '__pycache__', '.pytest_cache']):
        continue
    for f in files:
        if not f.endswith('.py'):
            continue
        path = os.path.join(root, f)
        c = count_lines(path)
        if 'backend/tests' in norm_root:
            categories['Testes Backend (tests/)']['files'] += 1
            categories['Testes Backend (tests/)']['lines'] += c
        elif 'backend/app' in norm_root or 'backend/scripts' in norm_root:
            categories['Backend (Código Fonte: app/ e scripts/)']['files'] += 1
            categories['Backend (Código Fonte: app/ e scripts/)']['lines'] += c

# 2. Scripts raiz (ferramentas de manutenção/auditoria)
if os.path.exists('scripts'):
    for root, dirs, files in os.walk('scripts'):
        norm_root = root.replace('\\', '/')
        if '__pycache__' in norm_root:
            continue
        for f in files:
            if f.endswith('.py') and f != 'count_project_lines.py':
                path = os.path.join(root, f)
                c = count_lines(path)
                categories['Backend (Código Fonte: app/ e scripts/)']['files'] += 1
                categories['Backend (Código Fonte: app/ e scripts/)']['lines'] += c

# 3. Frontend
for root, dirs, files in os.walk('frontend/src'):
    norm_root = root.replace('\\', '/')
    if any(x in norm_root for x in ['node_modules', '.git', 'dist']):
        continue
    for f in files:
        if not f.endswith(('.js', '.jsx', '.ts', '.tsx', '.css', '.html')):
            continue
        path = os.path.join(root, f)
        c = count_lines(path)
        if any(f.endswith(ext) for ext in ('.test.js', '.test.jsx', '.test.ts', '.test.tsx', '.spec.js', '.spec.jsx')) or 'test' in f.lower() and f.endswith(('.js', '.jsx')):
            categories['Testes Frontend (*.test.js/jsx)']['files'] += 1
            categories['Testes Frontend (*.test.js/jsx)']['lines'] += c
        else:
            categories['Frontend (Componentes, Telas e Estilos: src/)']['files'] += 1
            categories['Frontend (Componentes, Telas e Estilos: src/)']['lines'] += c

# 4. Docker
for root, dirs, files in os.walk('.'):
    norm_root = root.replace('\\', '/')
    if any(x in norm_root for x in ['node_modules', '.git', 'dist', '.gemini']):
        continue
    for f in files:
        if f.startswith('Dockerfile') or (f.startswith('docker-compose') and f.endswith(('.yml', '.yaml'))):
            path = os.path.join(root, f)
            c = count_lines(path)
            categories['Docker (Dockerfiles e docker-compose)']['files'] += 1
            categories['Docker (Dockerfiles e docker-compose)']['lines'] += c

print('=' * 65)
print(f"{'CATEGORIA':<45} | {'ARQUIVOS':<8} | {'LINHAS':<8}")
print('-' * 65)
total_files = 0
total_lines = 0
for cat, data in categories.items():
    print(f"{cat:<45} | {data['files']:<8} | {data['lines']:<8}")
    total_files += data['files']
    total_lines += data['lines']

print('=' * 65)
print(f"{'TOTAL GERAL':<45} | {total_files:<8} | {total_lines:<8}")
print('=' * 65)
