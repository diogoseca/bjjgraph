"""UTC environment for V captures and D-02 receipt runners (D-256).

No import-time effects. The returned environment must be passed to the build; the
assertion measures a child Node process, including winter/summer boundary probes.
It proves inherited timezone configuration, not date provenance, clock stability,
or commands that explicitly replace their environment. Historical receipts are
never upgraded. Pinned by emit_mutation_test.py --capture-driver.
"""
import json
import os
import subprocess


def assert_utc_environment(environment, cwd=None):
    probe = """
const dates = ['2026-01-01T23:30:00Z', '2026-07-01T23:30:00Z'];
process.stdout.write(JSON.stringify({
  observed: process.env.TZ,
  node_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  probes: dates.map(iso => ({iso, offset_minutes: new Date(iso).getTimezoneOffset(),
    visible_date: new Date(iso).toLocaleDateString('en-US',
      {year: 'numeric', month: 'short', day: '2-digit'})}))
}));
"""
    actual = json.loads(subprocess.check_output(
        ['node', '-e', probe], cwd=cwd, env=environment, text=True))
    expected_dates = ['Jan 01, 2026', 'Jul 01, 2026']
    if (actual.get('observed') != 'UTC' or actual.get('node_timezone') != 'UTC'
            or [p['offset_minutes'] for p in actual['probes']] != [0, 0]
            or [p['visible_date'] for p in actual['probes']] != expected_dates):
        raise ValueError('capture timezone assertion failed: child Node must use TZ=UTC')
    return {'TZ': {'expected': 'UTC', **actual,
                   'scope': 'inherited build environment; child Node observed before execution'}}


def utc_capture_environment(environment=None, cwd=None):
    env = dict(os.environ if environment is None else environment)
    env['TZ'] = 'UTC'
    return env, assert_utc_environment(env, cwd)
