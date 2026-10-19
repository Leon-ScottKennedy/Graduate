"""Read SDK request contracts without importing or executing downloaded code."""
import argparse
import ast
import json
from io import BytesIO
from zipfile import ZipFile


def inventory(path):
    with ZipFile(path) as outer:
        nested = [name for name in outer.namelist() if name.endswith('.zip') and 'taobao-sdk' in name]
        data = outer.read(nested[0]) if nested else None
    with ZipFile(BytesIO(data)) if data else ZipFile(path) as sdk:
        result = {}
        for name in sdk.namelist():
            if '/request/' not in name or not name.endswith('.py'):
                continue
            tree = ast.parse(sdk.read(name).decode('utf-8'))
            for cls in (node for node in tree.body if isinstance(node, ast.ClassDef)):
                methods = {node.name: node for node in cls.body if isinstance(node, ast.FunctionDef)}
                if 'get_api_name' not in methods or '__init__' not in methods:
                    continue
                returned = next(node for node in methods['get_api_name'].body if isinstance(node, ast.Return))
                api = ast.literal_eval(returned.value)
                result[api] = dict(file=name, parameters=[arg.arg for arg in methods['__init__'].args.args if arg.arg != 'self'])
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sdk', required=True)
    parser.add_argument('--previous')
    args = parser.parse_args()
    current = inventory(args.sdk)
    previous = inventory(args.previous) if args.previous else {}
    output = dict(total=len(current), added={name: value for name, value in current.items() if name not in previous})
    print(json.dumps(output, ensure_ascii=True, indent=2))


if __name__ == '__main__':
    main()
