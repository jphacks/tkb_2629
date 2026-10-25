"""Static architecture check. Parses source only; never executes application logic or tests."""

from __future__ import annotations

import ast
import importlib.util
import sys
from pathlib import Path

CONTEXTS = frozenset({"identity", "library", "reviews", "analysis"})
ROOT = Path(__file__).resolve().parents[1] / "src"


def module_name(path: Path) -> str:
    parts = path.relative_to(ROOT).with_suffix("").parts
    return ".".join(parts[:-1] if parts[-1] == "__init__" else parts)


def dependencies(name: str, file: Path, tree: ast.Module, modules: dict[str, Path]) -> set[str]:
    package = name if file.name == "__init__.py" else name.rpartition(".")[0]
    result: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            result.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            target = node.module or ""
            if node.level:
                target = importlib.util.resolve_name("." * node.level + target, package)
            source = modules.get(target)
            is_package = source is not None and source.name == "__init__.py"
            for alias in node.names:
                submodule = f"{target}.{alias.name}"
                if is_package and submodule in modules:
                    result.add(submodule)
                else:
                    result.add(target)
    return result


def violations(name: str, imports: set[str], modules: dict[str, Path]) -> list[str]:
    problems = []
    parts = name.split(".")
    context = parts[1] if len(parts) > 1 and parts[1] in CONTEXTS else None
    layer = parts[2] if context and len(parts) > 2 else None
    for target in sorted(imports):
        top = target.partition(".")[0]
        if top != "backend":
            if (
                context
                and layer in {"domain", "application"}
                and top not in sys.stdlib_module_names
            ):
                problems.append(f"{name} -> {target}: external dependency in {layer}")
            continue
        if target not in modules:
            problems.append(f"{name} -> {target}: missing internal module")
            continue
        other_parts = target.split(".")
        other = other_parts[1] if len(other_parts) > 1 else None
        if context:
            if other in CONTEXTS and other != context:
                problems.append(f"{name} -> {target}: direct context dependency")
            elif other == context:
                allowed_layers = {
                    "domain": {"domain"},
                    "application": {"domain", "application"},
                    "infrastructure": {"domain", "application", "infrastructure"},
                    "presentation": {"domain", "application", "presentation"},
                    "public": {"domain", "application"},
                }
                target_layer = other_parts[2] if len(other_parts) > 2 else None
                if target_layer not in allowed_layers.get(layer, set()):
                    problems.append(f"{name} -> {target}: layer dependency")
            elif other != "shared" or layer in {"domain", "application", "public"}:
                problems.append(f"{name} -> {target}: dependency outside context boundary")
        elif name.startswith("backend.shared") and other != "shared":
            problems.append(f"{name} -> {target}: shared code depends on context/root")
        elif name.startswith("backend.integration") and other in CONTEXTS:
            if target != f"backend.{other}.public":
                problems.append(f"{name} -> {target}: adapter bypasses published contract")
    return problems


def main() -> int:
    modules = {module_name(path): path for path in (ROOT / "backend").rglob("*.py")}
    graph: dict[str, set[str]] = {}
    problems: list[str] = []
    for name, path in sorted(modules.items()):
        tree = ast.parse(path.read_text(), filename=str(path))
        imported = dependencies(name, path, tree, modules)
        problems.extend(violations(name, imported, modules))
        graph[name] = imported.intersection(modules)
    done: set[str] = set()
    stack: list[str] = []

    def visit(name: str) -> None:
        if name in stack:
            problems.append("import cycle: " + " -> ".join(stack[stack.index(name) :] + [name]))
            return
        if name in done:
            return
        stack.append(name)
        for target in sorted(graph[name]):
            visit(target)
        stack.pop()
        done.add(name)

    for name in sorted(graph):
        visit(name)
    edges = sum(len(targets) for targets in graph.values())
    print(f"Checked {len(modules)} modules and {edges} internal import edges across four contexts.")
    if problems:
        print("\n".join(problems))
        return 1
    print(
        "No missing internal imports, direct context dependencies, "
        "reversed layers or import cycles."
    )
    print("Integration adapters use published contracts; shared code depends on no context.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
