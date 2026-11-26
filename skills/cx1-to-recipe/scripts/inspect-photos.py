#!/usr/bin/env python3
"""从语雀 CDN 获取并校验同分辨率的 q_90 JPEG。"""

import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import unquote_plus, urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

MAX_BYTES = 64 * 1024 * 1024
PROCESS = "x-oss-process"


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


OPENER = build_opener(NoRedirect())


def photo_urls(url):
    parsed = urlsplit(url)
    if (
        parsed.scheme != "https"
        or parsed.netloc.lower() != "cdn.nlark.com"
        or not parsed.path.startswith("/yuque/")
        or not parsed.path.lower().endswith((".jpg", ".jpeg"))
    ):
        raise ValueError("此脚本只处理语雀 CDN 上的 HTTPS JPEG 地址")
    # 移除旧的 OSS 处理指令，其他参数保留原样。
    params = [
        item
        for item in parsed.query.split("&")
        if item and unquote_plus(item.partition("=")[0]) != PROCESS
    ]
    original = parsed._replace(query="&".join(params), fragment="").geturl()
    params.append(urlencode({PROCESS: "image/quality,q_90"}))
    compressed = parsed._replace(query="&".join(params), fragment="").geturl()
    return original, compressed


def fetch_image(url, dest):
    digest = hashlib.sha256()
    size = 0
    req = Request(url, headers={"Accept": "image/jpeg"})
    with OPENER.open(req, timeout=30) as response, dest.open("wb") as output:
        if response.status != 200 or response.headers.get_content_type() != "image/jpeg":
            raise ValueError("响应类型不是 JPEG")
        while chunk := response.read(65536):
            size += len(chunk)
            if size > MAX_BYTES:
                raise ValueError("响应超出单张 64 MiB 的校验上限")
            digest.update(chunk)
            output.write(chunk)
    return size, digest.digest()


def read_dimensions(magick, path):
    # 完整解码，以区别正常 JPEG 和只有有效文件头的损坏响应。
    decoded = subprocess.run(
        [magick, "-regard-warnings", f"jpeg:{path}", "-format", "%m %w %h", "info:"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    fields = decoded.stdout.split()
    if decoded.returncode or decoded.stderr or len(fields) != 3 or fields[0] != "JPEG":
        raise ValueError("响应无法完整解码为 JPEG")
    return int(fields[1]), int(fields[2])


def inspect_photo(magick, url):
    original, compressed = photo_urls(url)
    with tempfile.TemporaryDirectory(prefix="recipe-photo-") as temp:
        variants = []
        for label, src in (("原图", original), ("q_90", compressed)):
            path = Path(temp) / f"image-{len(variants)}.jpeg"
            try:
                size, digest = fetch_image(src, path)
                dimensions = read_dimensions(magick, path)
            except HTTPError as exc:
                raise ValueError(f"{label}获取失败（HTTP {exc.code}）") from exc
            except ValueError as exc:
                raise ValueError(f"{label}：{exc}") from exc
            except (OSError, subprocess.SubprocessError) as exc:
                raise ValueError(f"{label}获取或校验失败（{type(exc).__name__}）") from exc
            variants.append((size, digest, dimensions))
    original_size, original_digest, original_dimensions = variants[0]
    size, digest, dimensions = variants[1]
    if dimensions != original_dimensions:
        raise ValueError("q_90 响应的像素尺寸与原图不一致")
    if digest == original_digest:
        raise ValueError("q_90 响应与原图完全相同，无法确认 CDN 应用了参数")
    width, height = dimensions
    return {
        "original": original,
        "original_size": original_size,
        "image": {
            "uid": uuid.uuid4().hex[:6],
            "name": Path(urlsplit(original).path).name,
            "width": width,
            "height": height,
            "status": "success",
            "src": compressed,
            "size": size,
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("urls", metavar="URL", nargs="+")
    args = parser.parse_args()
    magick = shutil.which("magick")
    if not magick:
        parser.error("需要 ImageMagick 7 的 magick 命令")
    results = []
    for url in args.urls:
        try:
            result = inspect_photo(magick, url)
        except ValueError as exc:
            result = {"error": str(exc)}
        results.append({"input": url, **result})
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
