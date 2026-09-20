#!/usr/bin/env python3
"""NOT check_build_fingerprint.py (V's emitted-tree gate): compare the three step lists.

Expand npm aliases/hooks and shell cwd changes, preserving order and duplicates. Compare
root build with BOTH inline deploy chains; six explicitly named deploy-only checks are
required, not silently discarded. Unknown shell grammar fails closed. This is a static
chain contract, not a shell interpreter, an Actions simulator, or proof of emitted bytes.

PyYAML is NEW: the shared developer box already has it, CI need not. A missing import is
fatal. Every workflow job invoking this gate (directly, via build, or via its unit spec)
must first install PyYAML; check that provisioning here too. No requirements.txt is implied.
Inputs: root/source package.json, both deploy workflows, all workflow gate call sites.
"""
from __future__ import annotations
import argparse
from collections import Counter
import difflib
import json
from pathlib import Path
import posixpath
import re
import shlex
import sys

try:
    import yaml
except ImportError:
    sys.exit('ERROR: PyYAML is required by check_build_chains.py; install it with python3 -m pip install PyYAML in EVERY workflow job that runs this gate.')

class ContractError(ValueError):
    pass

class UniqueLoader(yaml.SafeLoader):
    pass

def unique_mapping(loader, node, deep=False):
    result = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in result:
            raise ContractError(f'duplicate YAML key: {key!r}')
        result[key] = loader.construct_object(value_node, deep=deep)
    return result

UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, unique_mapping)

# These six validate the deployment environment or its built tree. Local build has
# historically omitted them; retaining that distinction does not authorize deletion
# from either deployment. Adding another exception requires a reason here and a spec.
DEPLOY_ONLY = {
    ('python3', 'scripts/check_seo_parity.py'): 'SEO ratchet against the deployed tree',
    ('python3', 'scripts/check_systems_payload.py'): 'resolved Systems payload',
    ('python3', 'scripts/check_affiliate_surface.py', '--built'): 'deploy referral state',
    ('python3', 'scripts/check_analytics_surface.py'): 'deploy PostHog environment',
    ('node', 'scripts/check_analytics_nokey.mjs'): 'independent keyless fixture',
}
GATE = ('python3', 'scripts/check_build_chains.py')
AFFILIATE = ('python3', 'scripts/apply_affiliate_ref.py')
DISCOVERY = ('python3', 'scripts/regenerate_agent_discovery.py')


def rel(cwd, value):
    value = posixpath.normpath(posixpath.join(cwd, value))
    if value == '..' or value.startswith('../') or value.startswith('/'):
        raise ContractError(f'cwd/path escapes repository: {value}')
    return value


def package(root, cwd):
    try:
        return json.loads((root / cwd / 'package.json').read_text())
    except (OSError, ValueError) as exc:
        raise ContractError(f'{cwd}/package.json: {exc}') from exc


def commands(root, body, cwd='.', stack=()):
    """Accept plain commands, comments, newlines, &&, cd and npm run; reject control flow."""
    result = []
    if not isinstance(body, str):
        raise ContractError('run/build must be a string')
    for line in body.splitlines():
        lexer = shlex.shlex(line, posix=True, punctuation_chars=';&|()<>' )
        lexer.whitespace_split = True
        words = list(lexer)
        chunks = [[]]
        for word in words:
            if word == '&&':
                if not chunks[-1]:
                    raise ContractError('unsupported shell: empty command before &&')
                chunks.append([])
            elif any(c in word for c in '$`') or word in (';', '|', '||', '&', '(', ')', '<', '>', '>>'):
                raise ContractError(f'unsupported shell token {word!r}')
            else:
                chunks[-1].append(word)
        if words and not chunks[-1]:
            raise ContractError('unsupported shell: trailing &&')
        for args in chunks:
            if not args:
                continue
            if args[0] in ('if', 'then', 'fi', 'for', 'while', 'until', 'case', 'export', 'env', '!') or '=' in args[0]:
                raise ContractError(f'unsupported shell command {args[0]!r}')
            if args[0] == 'cd':
                if len(args) != 2:
                    raise ContractError('unsupported shell: cd arguments')
                cwd = rel(cwd, args[1])
                continue
            if args == ['npm', 'install']:
                key = (cwd, '<install>')
                if key in stack:
                    raise ContractError('npm install lifecycle cycle')
                scripts = package(root, cwd).get('scripts', {})
                for hook in ('preinstall', 'install', 'postinstall', 'prepublish', 'preprepare', 'prepare', 'postprepare'):
                    if hook in scripts:
                        result.extend(commands(root, scripts[hook], cwd, stack + (key,)))
                continue
            if args[:2] == ['npm', 'run']:
                if len(args) != 3:
                    raise ContractError(f'unsupported shell: npm run arguments {args}')
                name = args[2]
                key = (cwd, name)
                if key in stack:
                    raise ContractError(f'npm script cycle: {stack + (key,)}')
                scripts = package(root, cwd).get('scripts', {})
                if name not in scripts:
                    raise ContractError(f'missing npm script {cwd}:{name}')
                for hook in ('pre' + name, name, 'post' + name):
                    if hook in scripts:
                        result.extend(commands(root, scripts[hook], cwd, stack + (key,)))
                continue
            if args[:2] == ['npx', 'quartz']:
                binpath = package(root, cwd).get('bin', {}).get('quartz')
                if not binpath:
                    raise ContractError('npx quartz has no declared package bin')
                args = ['node', binpath, *args[2:]]
            if args[0] in ('node', 'python3') and len(args) > 1 and not args[1].startswith('-'):
                args[1] = rel(cwd, args[1])
            result.append((cwd, tuple(args)))
    return result


def label(command):
    cwd, args = command
    return f'cwd={cwd}: {shlex.join(args)}'


def load_workflow(path):
    try:
        workflow = yaml.load(path.read_text(), Loader=UniqueLoader)
    except (OSError, yaml.YAMLError) as exc:
        raise ContractError(f'{path.name}: {exc}') from exc
    if not isinstance(workflow, dict) or not isinstance(workflow.get('jobs'), dict) or not workflow['jobs']:
        raise ContractError(f'{path.name}: missing/empty jobs')
    return workflow


def deploy_commands(root, path):
    import hashlib
    workflow = load_workflow(path)
    candidates = []
    for job in workflow['jobs'].values():
        for index, step in enumerate(job.get('steps', [])):
            if str(step.get('uses', '')).startswith('cloudflare/wrangler-action@') and str(step.get('with', {}).get('command', '')).startswith('pages deploy '):
                candidates.append((job, index))
    if len(candidates) != 1:
        raise ContractError(f'{path.name}: expected exactly one Pages deploy boundary, found {len(candidates)}')
    job, boundary = candidates[0]
    if 'if' in job or job.get('continue-on-error'):
        raise ContractError(f'{path.name}: conditional/ignored deploy job')
    run_defaults = {**workflow.get('defaults', {}).get('run', {}), **job.get('defaults', {}).get('run', {})}
    default_cwd = run_defaults.get('working-directory', '.')
    started = False
    result = []
    for step in job['steps'][:boundary]:
        if step.get('name') == 'Build Quartz':
            if started:
                raise ContractError('duplicate Build Quartz boundary')
            started = True
        if 'uses' in step:
            action = step['uses'].split('@')[0]
            allowed = {'actions/cache', 'actions/upload-artifact'} if started else {'actions/checkout', 'actions/setup-node', 'actions/setup-python', 'actions/cache'}
            if action not in allowed:
                raise ContractError(f'{path.name}: unreviewed action before Pages upload: {step["uses"]}')
            if action == 'actions/cache' and step.get('with', {}).get('path') != ('~/.cache/ms-playwright' if started else '~/.npm'):
                raise ContractError(f'{path.name}: unreviewed cache write paths')
            continue
        if 'run' not in step:
            raise ContractError(f'{path.name}: step has neither run nor uses')
        body = step['run']
        cwd = rel('.', step.get('working-directory', default_cwd))
        if not started:
            # Preparation is outside the local build. Reviewed shell programs are
            # pinned in full: adding a command even under the same name fails.
            digest = hashlib.sha256(body.encode()).hexdigest()
            if digest in PREPARATION_PROGRAMS and cwd == '.':
                continue
            if body.strip() == 'python3 scripts/check_build_chains.py' and cwd == '.' and 'if' not in step and not step.get('continue-on-error'):
                continue
            raise ContractError(f'{path.name}: unreviewed preparation command before Build Quartz: {step.get("name")}')
        if body.strip() in ('npx playwright install --with-deps chromium', 'npx playwright install-deps chromium') and cwd == '.':
            continue
        if step.get('name') == 'Resolve Playwright version':
            if hashlib.sha256(body.encode()).hexdigest() != PLAYWRIGHT_VERSION_SHA or cwd != '.':
                raise ContractError(f'{path.name}: changed browser provisioning program; review its exclusion')
            continue
        if 'if' in step or step.get('continue-on-error'):
            raise ContractError(f'{path.name}: conditional/ignored build step {step.get("name")}')
        result.extend(commands(root, body, cwd))
    if not started or not result:
        raise ContractError(f'{path.name}: empty/zero build chain')
    return result


# Exact non-build preparation: validation inputs and Neural payload prelude.
PREPARATION_PROGRAMS = {'cbed484932482deabbebdc48fa4e12a52fa5ae870bfbf3675fffb436a5864c32': 'Validate content (gate)', 'f7948a7f40ea7738ffd03b6c79c7ffe06c0c804d95c27d4f2c0780ed0dfc9be0': 'Regenerate Neural app + data'}

PLAYWRIGHT_VERSION_SHA = 'eeadbffb36217d7c3108123efcb99d54a10ce62592f9102a5de400c83ea6433a'


def affiliate_interval(chain, context):
    indexes = [i for i, (_, args) in enumerate(chain) if args == AFFILIATE]
    if len(indexes) != 2 or [args for _, args in chain[indexes[0]+1:indexes[-1]]] != [DISCOVERY]:
        raise ContractError(f'{context}: affiliate interval must be exactly stamp -> discovery -> stamp (two passes)')


# Python provisioning is deliberately separate from commands(): workflow run blocks
# include loops/heredocs irrelevant to the emitted-site chain. This scanner discovers
# literal Python/npm entrypoints; it does NOT interpret arbitrary shell or JS programs.
PYTHON_DISTRIBUTIONS = {
    'yaml': 'PyYAML', 'jinja2': 'jinja2', 'jsonschema': 'jsonschema',
    'tqdm': 'tqdm', 'requests': 'requests', 'numpy': 'numpy',
    'networkx': 'networkx', 'node2vec': 'node2vec', 'umap': 'umap-learn',
    'PIL': 'Pillow', 'sklearn': 'scikit-learn', 'pytest': 'pytest',
}


def _distribution_name(value):
    return re.sub(r'[-_.]+', '-', value).lower()


def provisioning(root):
    """D-15: Python import provisioning, NOT JS/TS dependency closure (stream V).

    Scope: every workflow run block; literal Python files/simple Python heredocs;
    recursively expanded root/source npm scripts and their pre/post hooks; literal
    scripts/tests/*.py paths in invoked Node child_process wrappers. AST Import and
    ImportFrom walk local modules at script-dir/repo-root/scripts import roots, even
    inside functions/feature branches. Unknown modules fail instead of guessing pip
    names. Distribution dependencies are never inferred from the developer install.

    Exclusions: dynamic Python -c/module/path construction, JS template Python,
    shell-script dispatch, npm install lifecycle hooks, Actions uses/with internals,
    runtime importlib/__import__, and custom dynamic sys.path. These are NOT claimed
    covered. The sole optional third-party exception is proofread_all_transitions.py's
    tqdm import, and only while an actual ImportError handler guards that import.
    """
    import ast
    root = root.resolve()
    stats = dict(workflows=0, jobs=0, entrypoints=0, python_files=0, imports=0,
                 third_party_imports=0, node_wrappers=0, excluded_inline=0,
                 optional_imports=0)
    files, imports_seen, wrappers_seen, optional_seen = set(), set(), set(), set()
    errors, cache = set(), {}

    def local_modules(module, origin, level=0):
        parts = module.split('.') if module else []
        if level:
            base = origin.parent
            for _ in range(level - 1):
                base = base.parent
            bases = [base]
        else:
            bases = [origin.parent, root, root / 'scripts']
        for base in bases:
            candidate = base.joinpath(*parts)
            if not candidate.is_relative_to(root):
                continue
            ancestors = [base.joinpath(*parts[:index]) / '__init__.py'
                         for index in range(1, len(parts))]
            initializers = [init for init in ancestors if init.is_file()]
            if candidate.with_suffix('.py').is_file():
                return [*initializers, candidate.with_suffix('.py')]
            if candidate.is_dir():
                init = candidate / '__init__.py'
                return [*initializers, init] if init.is_file() else initializers
        return None

    def inspect_python(path, source=None, ancestry=()):
        key = (str(path), source)
        if path in ancestry:
            return set()
        if key in cache:
            tree, parents = cache[key]
        else:
            if source is None:
                if not path.is_file():
                    raise ContractError(f'missing Python entrypoint/local module: {path.relative_to(root)}')
                source = path.read_text()
                files.add(path)
            try:
                tree = ast.parse(source, filename=str(path))
            except SyntaxError as exc:
                raise ContractError(f'cannot parse Python {path.relative_to(root)}:{exc.lineno}: {exc.msg}') from exc
            parents = {child: parent for parent in ast.walk(tree) for child in ast.iter_child_nodes(parent)}
            # Cache syntax, never a partially traversed cyclic dependency closure.
            cache[key] = tree, parents
        dependencies = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                modules = [(alias.name, 0) for alias in node.names]
            elif isinstance(node, ast.ImportFrom):
                modules = [(node.module or '', node.level)]
                if not node.module:
                    modules = [(alias.name, node.level) for alias in node.names]
            else:
                continue
            for module, level in modules:
                imports_seen.add((str(path), node.lineno, module))
                top = module.partition('.')[0]
                found = local_modules(module, path, level)
                if found is not None:
                    for child in found:
                        dependencies.update(inspect_python(child, ancestry=(*ancestry, path)))
                    # from local_package import child also loads child.py when present.
                    if isinstance(node, ast.ImportFrom) and node.module:
                        for alias in node.names:
                            children = local_modules(module + '.' + alias.name, path, level)
                            for child in children or []:
                                dependencies.update(inspect_python(child, ancestry=(*ancestry, path)))
                    continue
                if top in sys.stdlib_module_names and not level:
                    continue
                if level:
                    raise ContractError(f'missing Python local import {module!r} in {path.relative_to(root)}:{node.lineno}')
                dist = PYTHON_DISTRIBUTIONS.get(top)
                if not dist:
                    raise ContractError(f'unknown Python import {module!r} in {path.relative_to(root)}:{node.lineno}; declare its distribution mapping')
                optional = False
                if path == root / 'scripts/proofread_all_transitions.py' and top == 'tqdm':
                    parent = parents.get(node)
                    while parent is not None:
                        if isinstance(parent, ast.Try) and node in parent.body:
                            import hashlib
                            for handler in parent.handlers:
                                if not isinstance(handler.type, ast.Name) or handler.type.id != 'ImportError':
                                    continue
                                # Pin the reviewed no-op progress-bar implementation;
                                # merely catching ImportError (then raising) is not optional.
                                shape = ast.dump(ast.Module(body=handler.body, type_ignores=[]), include_attributes=False)
                                if hashlib.sha256(shape.encode()).hexdigest() == 'ec2c469d09c0758af0e395876461928cacbe00fb3fedf83c411d9a58e664356e':
                                    optional = True
                                    optional_seen.add((str(path), node.lineno))
                        parent = parents.get(parent)
                if not optional:
                    dependencies.add((dist, str(path.relative_to(root)), node.lineno, module))
        return dependencies

    def require_python(path, installed, context, source=None):
        stats['entrypoints'] += 1
        try:
            dependencies = inspect_python(path, source)
            stats['third_party_imports'] += len(dependencies)
            for dist, owner, line, module in dependencies:
                if _distribution_name(dist) not in installed:
                    errors.add(f'{context}: {dist} not provisioned before Python call; {owner}:{line} imports {module}')
        except ContractError as exc:
            errors.add(f'{context}: {exc}')

    def pip_packages(args, cwd):
        result = set()
        for value in args:
            if value in ('--upgrade', '-U', '--quiet', '-q', '--disable-pip-version-check', '--no-cache-dir'):
                continue
            if value.startswith('-'):
                raise ContractError(f'unsupported pip provisioning option {value!r}; use explicit package names')
            match = re.match(r'^([A-Za-z0-9][A-Za-z0-9_.-]*)(?:\[[^]]+\])?(?:[<>=!~].*)?$', value)
            if not match:
                raise ContractError(f'nonliteral pip provision {value!r}')
            result.add(_distribution_name(match[1]))
        return result

    def node_wrappers(args, cwd, installed, context):
        # Literal Python paths in code importing child_process are conservative
        # dependencies. This intentionally does not follow arbitrary JS data flow.
        for value in args[1:]:
            if not re.search(r'\.(?:mjs|cjs|js)$', value):
                continue
            pattern = rel(cwd, value)
            matched = sorted(root.glob(pattern))
            if '--test' in args and not matched:
                raise ContractError(f'{context}: node test pattern matched zero files: {pattern}')
            for wrapper in matched:
                body = wrapper.read_text()
                if 'child_process' not in body or not re.search(r'[\'"]python3?[\'"]', body):
                    continue
                wrappers_seen.add(wrapper)
                token_pattern = re.compile(r"//[^\n]*|/\*[\s\S]*?\*/|'(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\"|`(?:\\.|[^`\\])*`")
                tokens = list(token_pattern.finditer(body))
                masked = list(body)
                for token in tokens:
                    masked[token.start():token.end()] = ' ' * (token.end() - token.start())
                code = ''.join(masked)
                literal = set()
                for token in tokens:
                    value = token.group()[1:-1]
                    if not re.fullmatch(r'(?:scripts|tests)/[A-Za-z0-9_./-]+\.py', value):
                        continue
                    prefix = code[max(0, token.start() - 300):token.start()]
                    # Only source-code path operands, never Python-shaped fixture
                    # text inside another string or an arbitrary write()/assertion.
                    if re.search(r'\b(?:resolve|join)\([^()]*$', prefix) or re.search(r'\b(?:spawnSync|execFileSync|spawn|execFile)\([^;{}]*$', prefix):
                        literal.add(value)
                for value in sorted(literal):
                    require_python(root / rel(cwd, value), installed, f'{context} via {wrapper.relative_to(root)}')
                if not literal or re.search(r'[\'"]-c[\'"]', body):
                    stats['excluded_inline'] += 1

    def scan(body, cwd, installed, context, guaranteed, stack=()):
        lines = body.replace('\\\n', ' ').splitlines()
        index, conditional_depth = 0, 0
        cwd_stack = []
        while index < len(lines):
            line = lines[index]
            index += 1
            if not line.strip() or line.lstrip().startswith('#'):
                continue
            # A literal heredoc is a bounded source unit. Skip every heredoc's body
            # so shell-looking text in prompts/data cannot fabricate install proof.
            heredoc = None
            quote, escaped = None, False
            for offset, char in enumerate(line):
                if escaped:
                    escaped = False
                    continue
                if char == '\\' and quote != "'":
                    escaped = True
                    continue
                if quote:
                    if char == quote:
                        quote = None
                elif char in ("'", '"'):
                    quote = char
                elif line[offset:offset+2] == '<<' and (offset == 0 or line[offset-1] != '<') and line[offset:offset+3] != '<<<':
                    heredoc = re.match(r"<<-?\s*['\"]?([A-Za-z_][A-Za-z0-9_]*)['\"]?", line[offset:])
                    if heredoc:
                        heredoc_start = offset
                        break
            inline = None
            if heredoc:
                block = []
                while index < len(lines) and lines[index].strip() != heredoc[1]:
                    block.append(lines[index]); index += 1
                if index == len(lines):
                    raise ContractError(f'{context}: unterminated heredoc {heredoc[1]}')
                index += 1
                if re.search(r'\bpython3?\b[^;]*\s-\s*<<', line):
                    inline = '\n'.join(block) + '\n'
                line = line[:heredoc_start]
            try:
                lexer = shlex.shlex(line, posix=True, punctuation_chars=';&|()<>')
                lexer.whitespace_split = True
                words = list(lexer)
            except ValueError:
                # Multi-line quoted shell text is outside literal-command discovery;
                # it is never evidence of a successful package installation.
                stats['excluded_inline'] += 1
                continue
            chunks, chunk = [], []
            for word in words:
                if word in ('&&', '||', ';', '|', '&', '(', ')', '<', '>', '>>'):
                    if chunk:
                        chunks.append(chunk); chunk = []
                    if word in ('(', ')'):
                        chunks.append([word])
                else:
                    chunk.append(word)
            if chunk:
                chunks.append(chunk)
            for chunk_index, args in enumerate(chunks):
                # An arbitrary predecessor in an AND/OR list can skip a later
                # command. Calls still get checked, but skipped installs get no credit.
                may_skip = ('||' in words or ('&&' in words and chunk_index > 0))
                if args == ['(']:
                    cwd_stack.append(cwd)
                    continue
                if args == [')']:
                    if cwd_stack:
                        cwd = cwd_stack.pop()
                    continue
                if args[0] in ('if', 'elif', 'for', 'while', 'until', 'case'):
                    conditional_depth += 1
                while args and args[0] in ('if', 'elif', 'then', 'do', '!', 'else'):
                    args = args[1:]
                if not args:
                    continue
                if args[0] in ('fi', 'done', 'esac'):
                    conditional_depth = max(0, conditional_depth - 1)
                    continue
                if args[0] in ('env', 'command'):
                    args = args[1:]
                    if args and args[0].startswith('-'):
                        raise ContractError(f'{context}: unsupported environment/command prefix option {args[0]!r}')
                while args and re.match(r'^[A-Za-z_][A-Za-z0-9_]*=', args[0]):
                    args = args[1:]
                if not args:
                    continue
                if args[0] == 'cd':
                    if len(args) == 2 and '$' not in args[1]:
                        cwd = rel(cwd, args[1])
                    else:
                        raise ContractError(f'{context}: dynamic cwd prevents Python provisioning proof')
                    continue
                pip = args[2:] if args[:2] in (['pip', 'install'], ['pip3', 'install']) else args[4:] if args[:4] in (['python3', '-m', 'pip', 'install'], ['python', '-m', 'pip', 'install']) else None
                if pip is not None:
                    packages = pip_packages(pip, cwd)
                    if guaranteed and not conditional_depth and not may_skip and not any(token in words for token in ('||', '|', '&')):
                        installed.update(packages)
                    continue
                if args[0] in ('python', 'python3'):
                    if inline is not None:
                        require_python(root / cwd / f'__workflow_inline_{index}.py', installed, context, inline)
                        inline = None
                        continue
                    positional = args[1:]
                    while positional and positional[0].startswith('-') and positional[0] not in ('-m', '-c', '-'):
                        flag = positional.pop(0)
                        if flag in ('-W', '-X') and positional:
                            positional.pop(0)
                        elif flag not in ('-B', '-I', '-S', '-u', '-E', '-s', '-q'):
                            raise ContractError(f'{context}: unsupported Python option {flag!r}')
                    if positional[:1] == ['-m'] and len(positional) > 1 and re.fullmatch(r'[A-Za-z_][A-Za-z0-9_.]*', positional[1]):
                        require_python(root / cwd / '__workflow_module.py', installed, context, 'import ' + positional[1])
                    elif positional and positional[0].endswith('.py') and not any(c in positional[0] for c in '$`*'):
                        require_python(root / rel(cwd, positional[0]), installed, context)
                    else:
                        stats['excluded_inline'] += 1
                    continue
                if args[0] == 'npm' and len(args) > 1 and args[1].startswith('-') and 'run' in args:
                    raise ContractError(f'{context}: unsupported npm prefix/options for provisioning: {shlex.join(args)}')
                if args[0] == 'npm' and len(args) > 1 and (args[1] == 'run' or args[1] in ('test', 'start')):
                    script = args[2] if args[1] == 'run' and len(args) > 2 else args[1]
                    key = (cwd, script)
                    if key in stack:
                        raise ContractError(f'{context}: npm provisioning script cycle {key}')
                    scripts = package(root, cwd).get('scripts', {})
                    if script not in scripts:
                        raise ContractError(f'{context}: missing npm provisioning script {cwd}:{script}')
                    for name in ('pre' + script, script, 'post' + script):
                        if name in scripts:
                            scan(scripts[name], cwd, installed, f'{context} npm {cwd}:{name}', guaranteed and not conditional_depth and not may_skip, (*stack, key))
                elif args[0] == 'node':
                    node_wrappers(args, cwd, installed, context)

    for path in sorted((root / '.github/workflows').glob('*')):
        if path.suffix not in ('.yml', '.yaml'):
            continue
        stats['workflows'] += 1
        workflow = load_workflow(path)
        for name, job in workflow['jobs'].items():
            stats['jobs'] += 1
            installed = set()
            defaults = {**workflow.get('defaults', {}).get('run', {}), **job.get('defaults', {}).get('run', {})}
            default_cwd = defaults.get('working-directory', '.')
            for index, step in enumerate(job.get('steps', []), 1):
                if 'run' not in step:
                    continue
                context = f'{path.name}:{name}:step {index} ({step.get("name", "run")})'
                try:
                    cwd = rel('.', step.get('working-directory', default_cwd))
                    scan(str(step['run']), cwd, installed, context,
                         'if' not in step and not step.get('continue-on-error'))
                except ContractError as exc:
                    errors.add(str(exc))
    stats.update(python_files=len(files), imports=len(imports_seen), node_wrappers=len(wrappers_seen),
                 optional_imports=len(optional_seen))
    print('Python provisioning: ' + ', '.join(f'{name}={count}' for name, count in stats.items()))
    print('Python scope: literal workflow/npm entrypoints, local AST imports, literal Node-wrapper paths; '
          'excludes dynamic -c/JS templates/subprocess/importlib/sys.path, shell-script dispatch, '
          'npm install hooks and Actions internals; optional: proofread_all_transitions.py guarded tqdm only.')
    if not stats['workflows'] or not stats['entrypoints'] or not stats['imports']:
        errors.add('zero Python provisioning coverage (workflows, entrypoints and imports must all be positive)')
    if errors:
        raise ContractError('\n'.join(sorted(errors)))
    return stats


# D-F-01: the TWO exact known deltas retain production behaviour during byte-parity.
KNOWN_DIVERGENCES = {
    "implicit-four-workers": "Local specifies 4; incumbent parse.ts defaults to 4 for the 4,600-file corpus. No arbitrary concurrency equivalence is claimed.",
    "disjoint-forward-share-order": "Share writes l.html/l-manifest.json; Forward writes dev/**. No intersection or cross-read. Alignment waits until after cutover.",
}


def baseline_deploy(local, deploy, context):
    result = list(deploy)
    used = []
    explicit = ('source', ('node', 'source/quartz/bootstrap-cli.mjs', 'build', '--concurrency', '4', '-d', '../content'))
    implicit = ('source', ('node', 'source/quartz/bootstrap-cli.mjs', 'build', '-d', '../content'))
    if local.count(explicit) == 1 and result.count(implicit) == 1:
        result[result.index(implicit)] = explicit
        used.append('implicit-four-workers')
    forward = ('.', ('node', 'scripts/build_forward_components.mjs'))
    share = ('.', ('node', 'scripts/build_share_shell.mjs'))
    if local.count(forward) == local.count(share) == result.count(forward) == result.count(share) == 1:
        a, b = local.index(forward), result.index(share)
        if local[a:a+2] == [forward, share] and result[b:b+2] == [share, forward]:
            result[b:b+2] = [forward, share]
            used.append('disjoint-forward-share-order')
    for name in used:
        print(f'{context}: baseline {name}: {KNOWN_DIVERGENCES[name]}')
    return result


def check(root):
    errors = []
    local = commands(root, 'npm run build')
    local = [c for c in local if c[1] != GATE]
    if not local:
        raise ContractError('local build has empty/zero comparable commands')
    affiliate_interval(local, 'local build')
    # Curated is itself an npm umbrella: preserve and require every expanded command.
    curated = commands(root, 'npm run test:curated')
    if not curated:
        raise ContractError('empty deploy-only curated gate')
    required = Counter(DEPLOY_ONLY.keys())
    required.update(args for _, args in curated)
    for name in ('deploy.yaml', 'deploy-dev.yaml'):
        try:
            deploy = deploy_commands(root, root / '.github/workflows' / name)
            affiliate_interval(deploy, name)
            seen = Counter(args for _, args in deploy)
            for args, needed in required.items():
                if seen[args] != needed:
                    errors.append(f'{name}: required deploy-only {shlex.join(args)}: expected {needed}, found {seen[args]}')
            gates = [c for c in deploy if c[1] in required]
            expected_gates = [(('source' if args == ('python3', 'scripts/check_seo_parity.py') else '.'), args) for args in DEPLOY_ONLY]
            expected_gates.extend(curated)
            if gates != expected_gates:
                errors.append(f'{name}: deploy-only gate cwd/order divergence')
            comparable = [c for c in deploy if c[1] not in required and c[1] != GATE]
            # All environment/fixture/journey gates must observe the FINAL output.
            last_shared = max((i for i, c in enumerate(deploy) if c in comparable), default=-1)
            for i, c in enumerate(deploy):
                if c[1] in required and c[1] != ('python3', 'scripts/check_seo_parity.py') and i <= last_shared:
                    errors.append(f'{name}: deploy-only gate ran before final shared output: {label(c)}')
            seo = ('source', ('python3', 'scripts/check_seo_parity.py'))
            headers = ('source', ('python3', 'scripts/check_headers_cache.py'))
            llms = ('source', ('python3', 'scripts/regenerate_llms_txt.py'))
            if headers in deploy and llms in deploy and not (deploy.index(headers) < deploy.index(seo) < deploy.index(llms)):
                errors.append(f'{name}: SEO gate must stay between headers validation and llms emit')
            affiliate_interval(comparable, name)
            print(f'{name}: compared {len(local)} local / {len(comparable)} deploy steps; 6 required deploy-only gates ({sum(required.values())} expanded commands)')
            adjusted = baseline_deploy(local, comparable, name)
            if adjusted != local:
                errors.append(f'{name}: build-chain divergence\n' + '\n'.join(difflib.unified_diff([label(c) for c in local], [label(c) for c in comparable], fromfile='package.json build (expanded)', tofile=name, lineterm='')))
        except ContractError as exc:
            errors.append(str(exc))
    try:
        provisioning(root)
    except ContractError as exc:
        errors.append(str(exc))
    if errors:
        for error in errors:
            print('ERROR: ' + error, file=sys.stderr)
        return 1
    print(f'PASS: both deployment chains agree within named baseline; {len(local) * 2} ordered step comparisons')
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parent.parent)
    args = parser.parse_args()
    try:
        return check(args.root.resolve())
    except (ContractError, ValueError, KeyError, TypeError) as exc:
        print(f'ERROR: build-chain contract: {exc}', file=sys.stderr)
        return 1

if __name__ == '__main__':
    sys.exit(main())
