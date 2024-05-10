from typing import Any, Hashable, Mapping, Optional


def path(obj: Optional[Mapping], *keys: Hashable, default=None) -> Any:
    for key in keys:
        if obj is None:
            return default

        try:
            obj = obj.get(key)
        except Exception as e:
            raise ValueError(
                f"Got error getting key '{key}' in path {keys}: {e}"
            ) from e

        if obj is None:
            return default

    return obj
