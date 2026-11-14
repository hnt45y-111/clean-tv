# Copies the TV launcher's page into the phone app for the live design preview,
# and downloads its fonts plus a few background photos.
import os, shutil, re
src, dst = 'launcher_src', 'app/src/main/assets/launcher'
if os.path.isdir(dst): shutil.rmtree(dst)
shutil.copytree(src, dst)
code = open('launcher_src_tools/fetch_assets.py', encoding='utf-8').read()
code = code.replace("ROOT = 'app/src/main/assets'", "ROOT = '" + dst + "'")
code = re.sub(r"(\n       140920334,194257167\])", r"\1\nids = ids[:5]", code)
code = code.replace("'-resize', '1920x1080^'", "'-resize', '1280x720^'").replace("'-extent', '1920x1080'", "'-extent', '1280x720'")
try:
    exec(compile(code, 'fetch_assets.py', 'exec'))
except Exception as e:
    print('preview extras skipped:', e)
print('launcher files:', sorted(os.listdir(dst)))
