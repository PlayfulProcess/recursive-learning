"""Inject data/ekho/*.json into the world template -> the private artifact page."""
import json, sys, pathlib
tpl, data_dir, out = map(pathlib.Path, sys.argv[1:4])
s = tpl.read_text(encoding='utf-8')
for key, name in [('SCHEMA', 'schema.json'), ('SOURCES', 'sources.json'), ('EKHO', 'ekho.json')]:
    data = json.loads((data_dir / name).read_text(encoding='utf-8'))
    blob = json.dumps(data, ensure_ascii=False).replace('</', '<\\/')
    marker = f'/*{key}_JSON*/null'
    assert s.count(marker) == 1, key
    s = s.replace(marker, blob)
out.write_text(s, encoding='utf-8', newline='\n')
print('wrote', out, len(s), 'chars')
