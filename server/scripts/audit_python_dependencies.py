"""Query PyPI version-specific advisories for installed packages; never upload source/config."""
from concurrent.futures import ThreadPoolExecutor
from importlib.metadata import distributions
import json
from urllib.parse import quote
from urllib.request import urlopen, Request
import sys


def check(package):
    name, version = package
    for attempt in range(3):
        try:
            url = f'https://pypi.org/pypi/{quote(name, safe="")}/{quote(version, safe="")}/json'
            with urlopen(Request(url, headers={'User-Agent': 'NexBuild-dependency-audit'}), timeout=15) as response:
                data = json.load(response)
            return name, version, data.get('vulnerabilities', []), None
        except Exception as error:
            if attempt == 2:
                return name, version, [], type(error).__name__


if __name__ == '__main__':
    packages = sorted({(item.metadata['Name'], item.version) for item in distributions()})
    failures = []
    findings = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        for name, version, vulnerabilities, error in executor.map(check, packages):
            if error: failures.append(f'{name} {version}: {error}')
            for advisory in vulnerabilities:
                if not advisory.get('withdrawn'):
                    findings.append(f'{name} {version}: {advisory.get("id", "unknown")} fixed: {advisory.get("fixed_in", [])}')
    print(f'Checked {len(packages)} installed packages against PyPI advisories; findings={len(findings)}, failed={len(failures)}')
    for line in findings + failures: print(line)
    sys.exit(1 if findings or failures else 0)
