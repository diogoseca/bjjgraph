import subprocess

files = [
    'content/Positions/Mount.json',
    'content/Positions/Back Control.json',
    'content/Positions/Closed Guard.json',
    'templates/Positions/TEMPLATE-DUAL.json',
    'templates/Positions/TEMPLATE-FAMILY.json',
    'package.json',
    'analytics_improvement_summary.txt',
]

result = subprocess.run(['git', 'add'] + files, capture_output=True, text=True)
print('stdout:', result.stdout)
print('stderr:', result.stderr)
print('return code:', result.returncode)

# Show status
status = subprocess.run(['git', 'status'], capture_output=True, text=True)
print(status.stdout[:1000])
