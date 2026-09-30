"""Create a minified static site in dist/ for Netlify hosting."""

import json
import os
import shutil
from pathlib import Path

import minify_html
import rcssmin
import rjsmin


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "dist"


def main():
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)

    (OUTPUT / "css").mkdir(parents=True)
    (OUTPUT / "js").mkdir(parents=True)

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    api_url = os.environ.get("CYCLONE_API_URL", "").strip().rstrip("/")
    if api_url:
        config_script = (
            "<script>window.CYCLONE_API_URL = "
            + json.dumps(api_url).replace("<", "\\u003c")
            + ";</script>"
        )
        html = html.replace("</head>", f"{config_script}</head>", 1)

    html = minify_html.minify(html, minify_js=True, minify_css=True)
    (OUTPUT / "index.html").write_text(html, encoding="utf-8")

    for source in (ROOT / "css").glob("*.css"):
        (OUTPUT / "css" / source.name).write_text(
            rcssmin.cssmin(source.read_text(encoding="utf-8")), encoding="utf-8"
        )

    for source in (ROOT / "js").glob("*.js"):
        (OUTPUT / "js" / source.name).write_text(
            rjsmin.jsmin(source.read_text(encoding="utf-8")), encoding="utf-8"
        )

    print(f"Built minified Netlify site at {OUTPUT}")
    if not api_url:
        print("CYCLONE_API_URL is unset; configure it to enable the hosted Flask API.")


if __name__ == "__main__":
    main()