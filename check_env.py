import os
for k, v in os.environ.items():
    if 'POST' in k.upper() or 'HOG' in k.upper() or 'ANALYTICS' in k.upper():
        print(f"{k}: {v[:30]}")
    if k.startswith('PH'):
        print(f"{k}: {v[:30]}")
