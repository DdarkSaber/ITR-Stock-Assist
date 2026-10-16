# Browser Python dependencies

This directory contains unmodified, pinned pure-Python wheels for openpyxl 3.1.5
and et-xmlfile 2.0.0, downloaded from PyPI. Both are MIT-licensed; each wheel
includes its upstream license and metadata.

Reproduce the vendored downloads from the project root:

```powershell
python -m pip download --only-binary=:all: --no-deps -r requirements-browser.txt -d web\vendor
```

The app installs these wheels in the in-memory Pyodide filesystem using micropip.
No financial information is included in dependency requests. Serving these
locally avoids runtime queries to PyPI. The Pyodide runtime and micropip are
still fetched from the pinned jsDelivr runtime URL.
