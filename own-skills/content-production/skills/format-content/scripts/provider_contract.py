#!/usr/bin/env python3
"""Validate and finalize one content-production WeChat layout task."""

import hashlib
import html
import json
import os
import re
import subprocess
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

from validate_gzh_html import validate as validate_gzh_html


CONTRACT = "content-production-provider/v1"
PROVIDER = "wechat-layout-v1"
SKILL_ROOT = Path(__file__).resolve().parents[1]
SHA256 = re.compile(r"^[a-f0-9]{64}$")
REQUEST_KEYS = {
    "schema_version", "contract", "task_id", "capability", "provider_contract",
    "run_dir", "run_mode", "mode", "attempt", "platform", "variant", "inputs",
    "output_dir", "expected_artifacts", "options", "interaction_policy",
}
INPUT_KEYS = {"role", "path", "sha256"}
OPTION_KEYS = {
    "theme_id", "preserve_substantive_content", "require_manifest_images",
    "validation_policy", "placeholder_policy", "unknown_author_policy",
    "preview_embedding_policy", "resource_bindings",
}
RESOURCE_PATHS = {
    "skill": "SKILL.md",
    "theme": "references/theme-red-white.md",
    "common_components": "references/common-components.md",
    "validator": "scripts/validate_gzh_html.py",
    "wrapper": "scripts/wrap_preview.py",
    "preview_template": "assets/preview-template.html",
    "provider_script": "scripts/provider_contract.py",
}
RESULT_KEYS = {
    "schema_version", "contract", "provider_contract", "task_id", "request_sha256",
    "status", "artifacts", "checks", "issues", "warnings",
}
CHECK_KEYS = {
    "request_valid", "mode", "validator_errors", "validator_warnings", "span_leaf_count",
    "clean_fragment", "safe_html", "red_white_theme", "end_divider_count", "cta_count",
    "placeholder_count", "source_block_count",
    "preserved_source_block_count", "source_blocks_in_order", "manifest_image_count",
    "markdown_image_count", "html_image_count", "manifest_images_exact",
    "preview_embedding_count", "preview_embedding_byte_identical", "preview_copy_button",
}
ALLOWED_TAGS = {
    "section", "p", "span", "strong", "h3", "img", "br", "table", "thead",
    "tbody", "tr", "th", "td", "u", "a",
}
GLOBAL_ATTRS = {"style"}
TAG_ATTRS = {"span": {"leaf"}, "img": {"src", "alt"}, "a": {"href"}}
CODE_STYLE = re.compile(r"monospace|courier|consolas|sf mono", re.I)
DANGEROUS_STYLE = re.compile(
    r"url\s*\(|expression\s*\(|behavior\s*:|-moz-binding|javascript\s*:|data\s*:|"
    r"display\s*:\s*none|visibility\s*:\s*hidden|"
    r"opacity\s*:\s*0(?:\.0*)?(?=\s*(?:;|$))",
    re.I,
)
PLACEHOLDER = re.compile(
    r"\{\{[^{}]+\}\}|\b(?:TODO|TBD|PLACEHOLDER|FIXME)\b|"
    r"待补素材|待填写|在此填写|待确认|图片URL|【\s*插入[^】]*】|此处插入",
    re.I,
)
MARKDOWN_IMAGE = re.compile(r"!\[[^\]]*\]\(([^)\s]+)(?:\s+[\"'][^\"']*[\"'])?\)")
MARKDOWN_LINK = re.compile(r"(?<!!)\[[^\]]+\]\(([^)\s]+)(?:\s+[\"'][^\"']*[\"'])?\)")
CTA = "如果你觉得今天这篇有收获，欢迎点赞、在看、转发三连，我们下篇见。"


def emit(value, code=0):
    sys.stdout.write(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    raise SystemExit(code)


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def same_keys(value, keys):
    return isinstance(value, dict) and set(value) == set(keys)


def inside(root, path):
    try:
        Path(path).absolute().relative_to(Path(root).absolute())
        return True
    except ValueError:
        return False


def run_relative(root, path):
    return Path(path).absolute().relative_to(Path(root).absolute()).as_posix()


def has_symlink_component(root, path, include_leaf=True):
    root = Path(root).absolute()
    path = Path(path).absolute()
    if not inside(root, path):
        return True
    parts = path.relative_to(root).parts
    if not include_leaf and parts:
        parts = parts[:-1]
    current = root
    for part in parts:
        current /= part
        if os.path.lexists(current) and current.is_symlink():
            return True
    return False


def issue(issues, code, message, **extra):
    issues.append({"code": code, "message": message, "resume_from": "package", **extra})


def expected_paths(attempt):
    version = f"v{attempt:03d}"
    suffix = "" if attempt == 1 else f".{version}"
    root = "08-publish-pack/_layout" if attempt == 1 else f"08-publish-pack/_layout/{version}"
    return {
        "root": root,
        "staging": f"{root}/staging",
        "request": f"{root}/wechat-layout.request.json",
        "result": f"{root}/wechat-layout.result.json",
        "clean": f"{root}/staging/article.html",
        "preview": f"{root}/staging/article-preview.html",
        "source": f"08-publish-pack/wechat/final{suffix}.md",
        "manifest": f"07-visual/wechat/manifest{suffix}.json",
        "image_prefix": "images/" if attempt == 1 else f"images/{version}/",
    }


def safe_file(root, root_real, path, issues, code, label):
    path = Path(path).absolute()
    if not inside(root, path) or not os.path.lexists(path):
        issue(issues, code, f"Missing or unsafe {label}.")
        return None
    try:
        if has_symlink_component(root, path) or path.is_symlink() or not path.is_file():
            raise ValueError("symbolic link or non-file")
        if not inside(root_real, path.resolve(strict=True)):
            raise ValueError("resolved path escapes run_dir")
    except (OSError, ValueError) as error:
        issue(issues, code, f"{label} must be a real file inside run_dir: {error}.")
        return None
    return path


def safe_skill_file(relative_path, issues):
    path = (SKILL_ROOT / relative_path).absolute()
    root_real = SKILL_ROOT.resolve(strict=True)
    if not inside(SKILL_ROOT, path) or not os.path.lexists(path):
        issue(issues, "invalid_layout_resource_binding", f"Missing provider resource: {relative_path}.")
        return None
    try:
        if has_symlink_component(SKILL_ROOT, path) or path.is_symlink() or not path.is_file():
            raise ValueError("resource is not a real file")
        if not inside(root_real, path.resolve(strict=True)):
            raise ValueError("resource escapes SKILL_ROOT")
    except (OSError, ValueError) as error:
        issue(issues, "invalid_layout_resource_binding", f"Unsafe provider resource {relative_path}: {error}.")
        return None
    return path


def markdown_outside_code(text):
    parts = []
    in_fence = False
    fence = None
    for line in text.replace("\r\n", "\n").split("\n"):
        match = re.match(r"^\s*(`{3,}|~{3,})", line)
        if match:
            marker = match.group(1)
            if not in_fence:
                in_fence, fence = True, marker[0]
            elif marker[0] == fence:
                in_fence, fence = False, None
            continue
        if not in_fence:
            parts.append(re.sub(r"`[^`]*`", "", line))
    return "\n".join(parts)


def normalize_prose(value):
    value = html.unescape(value)
    value = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", value)
    value = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", value)
    value = re.sub(r"</?[^>]+>", "", value)
    value = re.sub(r"[`*_~=#>+|:：;；,.，。!！?？、\-—()（）\[\]{}]", "", value)
    return re.sub(r"\s+", "", value)


def markdown_blocks(markdown):
    lines = markdown.replace("\r\n", "\n").split("\n")
    if lines and lines[0].strip() == "---":
        for index in range(1, len(lines)):
            if lines[index].strip() == "---":
                lines = lines[index + 1:]
                break
    blocks = []
    paragraph = []
    h1_removed = False
    in_fence = False
    fence_char = None

    def flush():
        if paragraph:
            token = normalize_prose(" ".join(paragraph))
            if token:
                blocks.append(token)
            paragraph.clear()

    for line in lines:
        fence = re.match(r"^\s*(`{3,}|~{3,})", line)
        if fence:
            flush()
            if not in_fence:
                in_fence, fence_char = True, fence.group(1)[0]
            elif fence.group(1)[0] == fence_char:
                in_fence, fence_char = False, None
            continue
        if in_fence:
            token = normalize_prose(line)
            if token:
                blocks.append(token)
            continue
        if not line.strip():
            flush()
            continue
        if not h1_removed and re.match(r"^#(?!#)\s+\S", line):
            flush()
            h1_removed = True
            continue
        if MARKDOWN_IMAGE.fullmatch(line.strip()):
            flush()
            continue
        if re.match(r"^\s*\|?(?:\s*:?-+:?\s*\|)+\s*$", line):
            flush()
            continue
        if re.match(r"^\s*(?:[-*_]\s*){3,}$", line):
            flush()
            continue
        structured = re.match(r"^\s*(?:#{2,6}|>|[-+*]|\d+[.)])\s+(.*)$", line)
        if structured or line.lstrip().startswith("|"):
            flush()
            content = structured.group(1) if structured else line.strip().strip("|").replace("|", " ")
            content = MARKDOWN_IMAGE.sub("", content)
            token = normalize_prose(content)
            if token:
                blocks.append(token)
            continue
        paragraph.append(MARKDOWN_IMAGE.sub("", line))
    flush()
    return blocks


def markdown_code_lines(markdown):
    values = []
    in_fence = False
    fence_char = None
    for line in markdown.replace("\r\n", "\n").split("\n"):
        fence = re.match(r"^\s*(`{3,}|~{3,})", line)
        if fence:
            if not in_fence:
                in_fence, fence_char = True, fence.group(1)[0]
            elif fence.group(1)[0] == fence_char:
                in_fence, fence_char = False, None
            continue
        if in_fence and line.strip():
            values.append(re.sub(r"\s+", "", html.unescape(line)))
    return values


class LayoutHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.issues = []
        self.images = []
        self.links = []
        self.text = []
        self.code_text = []
        self.placeholder_count = 0
        self.outer_style = None
        self.end_count = 0

    def add(self, message):
        if message not in self.issues:
            self.issues.append(message)

    def handle_starttag(self, tag, attrs):
        names = [name for name, _ in attrs]
        if len(names) != len(set(names)):
            self.add(f"Duplicate attributes are not authorized on <{tag}>.")
        attrs = dict(attrs)
        if tag not in ALLOWED_TAGS:
            self.add(f"Tag <{tag}> is not authorized.")
        allowed = GLOBAL_ATTRS | TAG_ATTRS.get(tag, set())
        for name, value in attrs.items():
            if name not in allowed or name.lower().startswith("on"):
                self.add(f"Attribute {name} is not authorized on <{tag}>.")
            if value and PLACEHOLDER.search(value):
                self.placeholder_count += 1
        if "leaf" in attrs and (tag != "span" or attrs["leaf"] not in (None, "")):
            self.add("leaf is only allowed as an empty span attribute.")
        style = attrs.get("style", "") or ""
        if DANGEROUS_STYLE.search(style):
            self.add("Dangerous CSS is not authorized.")
        if not self.stack and tag == "section":
            self.outer_style = style
        code = bool(CODE_STYLE.search(style)) or any(item[2] for item in self.stack)
        if tag not in {"img", "br"}:
            self.stack.append((tag, style, code))
        if tag == "img":
            source = attrs.get("src")
            if not source:
                self.add("Every image requires src.")
            else:
                self.images.append(source)
        if tag == "a":
            target = attrs.get("href")
            if not target or not safe_link(target):
                self.add("Link href uses a missing or dangerous scheme.")
            else:
                self.links.append(target)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                return

    def handle_data(self, data):
        self.text.append(data)
        in_code = any(item[2] for item in self.stack)
        if in_code:
            self.code_text.append(data)
        if not in_code and PLACEHOLDER.search(data):
            self.placeholder_count += len(PLACEHOLDER.findall(data))
        if data.strip() == "END" and any(
            "letter-spacing:3px" in re.sub(r"\s+", "", style).lower()
            and "#dc2626" in style.lower()
            for _, style, _ in self.stack
        ):
            self.end_count += 1

    def handle_comment(self, data):
        self.add("Comments are not authorized in clean HTML.")
        if "GZH_CONTENT" in data:
            self.placeholder_count += 1

    def handle_decl(self, decl):
        self.add("Declarations are not authorized in clean HTML.")


def safe_link(value):
    if re.search(r"[\x00-\x20]", value):
        return False
    split = urlsplit(value)
    if value.startswith("//"):
        return False
    return not split.scheme or split.scheme.lower() in {"http", "https", "mailto", "tel"}


def analyze_html(clean, source, expected_images):
    parser = LayoutHTMLParser()
    try:
        parser.feed(clean)
        parser.close()
    except Exception as error:
        parser.add(f"HTML parser failed: {error}")
    visible = normalize_prose("".join(parser.text))
    blocks = markdown_blocks(source)
    cursor = 0
    preserved = 0
    for block in blocks:
        found = visible.find(block, cursor)
        if found < 0:
            break
        preserved += 1
        cursor = found + len(block)

    markdown_links = Counter(MARKDOWN_LINK.findall(source))
    html_links = Counter(parser.links)
    if markdown_links != html_links:
        parser.add("Markdown links are missing, duplicated, or changed.")
    code_visible = re.sub(r"\s+", "", html.unescape("".join(parser.code_text)))
    code_cursor = 0
    for line in markdown_code_lines(source):
        found = code_visible.find(line, code_cursor)
        if found < 0:
            parser.add("Fenced-code punctuation, case, or order changed.")
            break
        code_cursor = found + len(line)

    compact_style = re.sub(r"\s+", "", parser.outer_style or "").lower()
    theme = all(value in compact_style for value in (
        "max-width:677px", "background:#ffffff", "color:#374151", "overflow-x:hidden"
    )) and "#dc2626" in clean.lower() and "#fee2e2" in clean.lower()
    visible_text = re.sub(r"\s+", "", html.unescape("".join(parser.text)))
    cta_count = visible_text.count(CTA)
    end_index = visible_text.rfind("END")
    cta_index = visible_text.rfind(CTA)
    end_before_cta = 0 <= end_index < cta_index

    images_exact = Counter(parser.images) == Counter(expected_images)
    return {
        "safe_html": not parser.issues,
        "html_issues": parser.issues,
        "red_white_theme": theme and end_before_cta,
        "end_divider_count": parser.end_count,
        "cta_count": cta_count,
        "placeholder_count": parser.placeholder_count,
        "source_block_count": len(blocks),
        "preserved_source_block_count": preserved,
        "source_blocks_in_order": preserved == len(blocks),
        "html_image_count": len(parser.images),
        "manifest_images_exact": images_exact,
    }


def default_checks(request_valid=False, mode=None):
    value = {
        "request_valid": request_valid,
        "mode": mode,
        "validator_errors": None,
        "validator_warnings": None,
        "span_leaf_count": 0,
        "clean_fragment": False,
        "safe_html": False,
        "red_white_theme": False,
        "end_divider_count": 0,
        "cta_count": 0,
        "placeholder_count": 0,
        "source_block_count": 0,
        "preserved_source_block_count": 0,
        "source_blocks_in_order": False,
        "manifest_image_count": 0,
        "markdown_image_count": 0,
        "html_image_count": 0,
        "manifest_images_exact": False,
        "preview_embedding_count": 0,
        "preview_embedding_byte_identical": False,
        "preview_copy_button": False,
    }
    if set(value) != CHECK_KEYS:
        raise RuntimeError("Internal checks schema mismatch.")
    return value


class Context:
    def __init__(self, request_input):
        self.issues = []
        self.request_path = Path(request_input or "").absolute()
        self.request = None
        self.request_sha256 = None
        self.run_dir = None
        self.run_real = None
        self.spec = None
        self.output_dir = None
        self.source_path = None
        self.manifest_path = None
        self.manifest = None
        self.expected_images = []
        self.markdown_images = []


def validate_request(request_input):
    context = Context(request_input)
    if not request_input or not os.path.lexists(context.request_path):
        issue(context.issues, "invalid_wechat_layout_request", "Missing provider request.")
        return context
    try:
        if context.request_path.is_symlink() or not context.request_path.is_file():
            raise ValueError("Request must be a real file.")
        context.request = json.loads(context.request_path.read_text(encoding="utf-8"))
        context.request_sha256 = sha256(context.request_path)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        issue(context.issues, "invalid_wechat_layout_request", str(error))
        return context

    request = context.request
    attempt = request.get("attempt")
    if isinstance(attempt, int) and not isinstance(attempt, bool) and attempt > 0:
        context.spec = expected_paths(attempt)

    if not same_keys(request, REQUEST_KEYS) or request.get("schema_version") != 1 \
            or request.get("contract") != CONTRACT or request.get("capability") != "wechat_layout" \
            or request.get("provider_contract") != PROVIDER or request.get("mode") != "format_wechat":
        issue(context.issues, "invalid_wechat_layout_request", "Request envelope does not match wechat-layout-v1.")

    run_value = request.get("run_dir")
    if not isinstance(run_value, str) or not os.path.isabs(run_value):
        issue(context.issues, "invalid_wechat_layout_run_dir", "run_dir must be absolute.")
        return context
    context.run_dir = Path(run_value).absolute()
    try:
        if context.run_dir.is_symlink() or not context.run_dir.is_dir():
            raise ValueError("run_dir must be a real directory")
        context.run_real = context.run_dir.resolve(strict=True)
        if has_symlink_component(context.run_dir, context.request_path) \
                or not inside(context.run_dir, context.request_path) \
                or not inside(context.run_real, context.request_path.resolve(strict=True)):
            raise ValueError("request must be a real file inside run_dir")
    except (OSError, ValueError) as error:
        issue(context.issues, "invalid_wechat_layout_run_dir", str(error))
        return context

    if not context.spec:
        issue(context.issues, "invalid_wechat_layout_request", "attempt must be a positive integer.")
        return context
    spec = context.spec
    if run_relative(context.run_dir, context.request_path) != spec["request"]:
        issue(context.issues, "invalid_wechat_layout_request_path", f"Request must be {spec['request']}.")

    identity_valid = request.get("run_mode") in {"autonomous", "reviewed"} \
        and request.get("platform") == "wechat" and request.get("variant") in {"A", "B"} \
        and request.get("interaction_policy") == "return_to_orchestrator" \
        and request.get("task_id") == (
            f"wechat-layout:{request.get('task_id', '').split(':')[1] if isinstance(request.get('task_id'), str) and len(request.get('task_id').split(':')) == 5 else ''}:"
            f"wechat:{request.get('variant')}:package-{attempt:03d}"
        )
    if not identity_valid:
        issue(context.issues, "invalid_wechat_layout_identity", "Task identity, platform, variant, or run mode is invalid.")

    expected_inputs = [("source_markdown", spec["source"]), ("publish_manifest", spec["manifest"])]
    inputs = request.get("inputs")
    if not isinstance(inputs, list) or len(inputs) != 2:
        issue(context.issues, "invalid_wechat_layout_inputs", "Request must bind source Markdown and publish manifest exactly once.")
    else:
        for value, (role, relative_path) in zip(inputs, expected_inputs):
            if not same_keys(value, INPUT_KEYS) or value.get("role") != role \
                    or value.get("path") != relative_path or not SHA256.fullmatch(value.get("sha256", "")):
                issue(context.issues, "invalid_wechat_layout_inputs", f"Invalid {role} binding.")
                continue
            absolute = context.run_dir / relative_path
            safe = safe_file(context.run_dir, context.run_real, absolute, context.issues,
                             "invalid_wechat_layout_input", role)
            if safe and sha256(safe) != value["sha256"]:
                issue(context.issues, "layout_input_drift", f"Input hash changed: {relative_path}.", path=relative_path)
            if safe and role == "source_markdown":
                context.source_path = safe
            if safe and role == "publish_manifest":
                context.manifest_path = safe

    context.output_dir = context.run_dir / spec["staging"]
    try:
        if not inside(context.run_dir, context.output_dir) or has_symlink_component(context.run_dir, context.output_dir) \
                or context.output_dir.is_symlink() or not context.output_dir.is_dir() \
                or not inside(context.run_real, context.output_dir.resolve(strict=True)):
            raise ValueError("output_dir must be a real directory inside run_dir")
    except (OSError, ValueError) as error:
        issue(context.issues, "invalid_wechat_layout_output_dir", str(error))

    if request.get("output_dir") != spec["staging"] \
            or request.get("expected_artifacts") != [spec["clean"], spec["preview"]]:
        issue(context.issues, "invalid_wechat_layout_output_contract", "Output directory or expected artifacts are not canonical.")

    options = request.get("options")
    expected_options = {
        "theme_id": "red-white",
        "preserve_substantive_content": True,
        "require_manifest_images": True,
        "validation_policy": "zero-errors-zero-warnings",
        "placeholder_policy": "forbid-outside-code",
        "unknown_author_policy": "omit_identity_keep_cta",
        "preview_embedding_policy": "trimmed-byte-identical-once",
    }
    if not same_keys(options, OPTION_KEYS) or any(options.get(key) != value for key, value in expected_options.items()):
        issue(context.issues, "invalid_wechat_layout_options", "Layout options do not match the fixed provider policy.")
    bindings = options.get("resource_bindings") if isinstance(options, dict) else None
    if not isinstance(bindings, dict) or set(bindings) != set(RESOURCE_PATHS):
        issue(context.issues, "invalid_layout_resource_binding", "Resource bindings must cover the exact provider resource set.")
    else:
        for name, relative_path in RESOURCE_PATHS.items():
            binding = bindings.get(name)
            if not same_keys(binding, {"path", "sha256"}) or binding.get("path") != relative_path \
                    or not SHA256.fullmatch(binding.get("sha256", "")):
                issue(context.issues, "invalid_layout_resource_binding", f"Invalid resource binding: {name}.")
                continue
            path = safe_skill_file(relative_path, context.issues)
            if path and sha256(path) != binding["sha256"]:
                issue(context.issues, "layout_resource_drift", f"Provider resource changed: {relative_path}.")

    if context.source_path:
        source = context.source_path.read_text(encoding="utf-8")
        if not source.strip():
            issue(context.issues, "invalid_wechat_layout_source", "Source Markdown is empty.")
        if PLACEHOLDER.search(markdown_outside_code(source)):
            issue(context.issues, "layout_source_placeholder", "Source Markdown contains an unresolved non-code placeholder.")
        context.markdown_images = MARKDOWN_IMAGE.findall(source)

    if context.manifest_path:
        try:
            context.manifest = json.loads(context.manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            issue(context.issues, "invalid_wechat_layout_manifest", str(error))
        if context.manifest is not None:
            manifest = context.manifest
            items = manifest.get("items") if isinstance(manifest, dict) else None
            if manifest.get("status") != "PASS" or manifest.get("platform") != "wechat" \
                    or manifest.get("package_attempt") != attempt or manifest.get("variant") != request.get("variant") \
                    or not isinstance(items, list) or not items:
                issue(context.issues, "invalid_wechat_layout_manifest", "Publish manifest identity or items are invalid.")
            else:
                refs = []
                for item in items:
                    ref = item.get("markdown_ref") if isinstance(item, dict) else None
                    publish = item.get("publish_file") if isinstance(item, dict) else None
                    expected_hash = item.get("publish_sha256") if isinstance(item, dict) else None
                    if not isinstance(ref, str) or ref != publish or not ref.startswith(spec["image_prefix"]) \
                            or os.path.isabs(ref) or ".." in Path(ref).parts or not SHA256.fullmatch(expected_hash or ""):
                        issue(context.issues, "invalid_wechat_layout_manifest", "Manifest image binding is invalid.")
                        continue
                    image_path = context.source_path.parent / ref if context.source_path else context.run_dir / ref
                    safe = safe_file(context.run_dir, context.run_real, image_path, context.issues,
                                     "invalid_wechat_layout_image", f"manifest image {ref}")
                    if safe and sha256(safe) != expected_hash:
                        issue(context.issues, "layout_image_drift", f"Manifest image hash changed: {ref}.", path=ref)
                    refs.append(ref)
                if len(refs) != len(set(refs)):
                    issue(context.issues, "invalid_wechat_layout_manifest", "Manifest image references must be unique.")
                context.expected_images = refs
                if Counter(context.markdown_images) != Counter(refs):
                    issue(context.issues, "layout_markdown_image_mismatch", "Source Markdown image references differ from the publish manifest.")
    return context


def artifacts_for(context, include_preview=True):
    artifacts = []
    for role, key in (("clean_html_candidate", "clean"), ("preview_html_candidate", "preview")):
        if key == "preview" and not include_preview:
            continue
        path = context.run_dir / context.spec[key]
        if os.path.lexists(path) and not path.is_symlink() and path.is_file() \
                and not has_symlink_component(context.run_dir, path):
            artifacts.append({"role": role, "path": context.spec[key], "sha256": sha256(path)})
    return artifacts


def make_result(context, status, artifacts, checks, issues, warnings=None):
    value = {
        "schema_version": 1,
        "contract": CONTRACT,
        "provider_contract": PROVIDER,
        "task_id": context.request.get("task_id", "unknown") if isinstance(context.request, dict) else "unknown",
        "request_sha256": context.request_sha256,
        "status": status,
        "artifacts": artifacts,
        "checks": checks,
        "issues": issues,
        "warnings": warnings or [],
    }
    if set(value) != RESULT_KEYS or set(checks) != CHECK_KEYS:
        raise RuntimeError("Internal provider result schema mismatch.")
    return value


def result_target(context):
    return context.run_dir / context.spec["result"] if context.run_dir and context.spec else None


def safe_result_target(context):
    path = result_target(context)
    if not path or not inside(context.run_dir, path) or has_symlink_component(context.run_dir, path, False):
        return False
    parent = path.parent
    try:
        if parent.is_symlink() or not parent.is_dir() or not inside(context.run_real, parent.resolve(strict=True)):
            return False
    except OSError:
        return False
    return not os.path.lexists(path)


def write_result(context, value):
    path = result_target(context)
    if not safe_result_target(context):
        raise RuntimeError("Unsafe or existing canonical layout result target.")
    with path.open("x", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return value


def request_failure(context):
    checks = default_checks(False, context.request.get("mode") if isinstance(context.request, dict) else None)
    value = make_result(context, "BLOCKED", [], checks, context.issues)
    if context.request and safe_result_target(context):
        write_result(context, value)
        value = {**value, "result_path": context.spec["result"]}
    emit(value, 2)


def finalize(context):
    checks = default_checks(True, "format_wechat")
    checks["manifest_image_count"] = len(context.expected_images)
    checks["markdown_image_count"] = len(context.markdown_images)
    issues = []
    clean_path = context.run_dir / context.spec["clean"]
    preview_path = context.run_dir / context.spec["preview"]
    names = sorted(item.name for item in os.scandir(context.output_dir))
    if names != ["article.html"]:
        issue(issues, "unexpected_layout_staging_artifact", "Staging must contain only article.html before finalize.", actual=names)
    clean_safe = safe_file(context.run_dir, context.run_real, clean_path, issues,
                           "invalid_layout_candidate", "clean HTML candidate")
    if clean_safe:
        try:
            clean = clean_safe.read_text(encoding="utf-8")
        except UnicodeDecodeError as error:
            issue(issues, "invalid_layout_candidate", str(error))
            clean = ""
    else:
        clean = ""

    if clean:
        validator_errors, validator_warnings, leaf_count = validate_gzh_html(clean, str(clean_path))
        checks["validator_errors"] = len(validator_errors)
        checks["validator_warnings"] = len(validator_warnings)
        checks["span_leaf_count"] = leaf_count
        checks["clean_fragment"] = not validator_errors \
            and bool(re.fullmatch(r"\s*<section\b[\s\S]*</section>\s*", clean, re.I)) \
            and not re.search(r"<(?:html|head|body|script)\b", clean, re.I)
        if validator_errors:
            issue(issues, "layout_validator_error", "Clean HTML failed the bundled validator.", diagnostics=validator_errors)
        if validator_warnings:
            issue(issues, "layout_validator_warning", "Clean HTML has validator warnings.", diagnostics=validator_warnings)

        source = context.source_path.read_text(encoding="utf-8")
        analyzed = analyze_html(clean, source, context.expected_images)
        for key in (
            "safe_html", "red_white_theme", "end_divider_count", "cta_count",
            "placeholder_count", "source_block_count",
            "preserved_source_block_count", "source_blocks_in_order", "html_image_count",
            "manifest_images_exact",
        ):
            checks[key] = analyzed[key]
        if not analyzed["safe_html"]:
            issue(issues, "unsafe_layout_html", "Clean HTML violates the provider allowlist.", diagnostics=analyzed["html_issues"])
        if not checks["clean_fragment"]:
            issue(issues, "invalid_layout_fragment", "Clean HTML is not one validated section fragment.")
        if not analyzed["red_white_theme"] or analyzed["end_divider_count"] != 1 or analyzed["cta_count"] != 1:
            issue(issues, "invalid_red_white_layout", "Clean HTML is missing the fixed red-white outer theme, END divider, or CTA.")
        if analyzed["placeholder_count"]:
            issue(issues, "unresolved_layout_placeholder", "Clean HTML contains unresolved non-code placeholders.")
        if not analyzed["source_blocks_in_order"]:
            issue(issues, "layout_source_content_loss", "Clean HTML does not preserve every source block in order.")
        if not analyzed["manifest_images_exact"]:
            issue(issues, "layout_manifest_image_mismatch", "Clean HTML image multiset differs from the publish manifest.")

    if not issues:
        wrapper = SKILL_ROOT / RESOURCE_PATHS["wrapper"]
        process = subprocess.run(
            [sys.executable, str(wrapper), str(clean_path), str(preview_path)],
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        if process.returncode:
            issue(issues, "layout_preview_wrap_failed", process.stderr or process.stdout or "Preview wrapper failed.")
        preview_safe = safe_file(context.run_dir, context.run_real, preview_path, issues,
                                 "invalid_layout_preview", "preview HTML candidate")
        if preview_safe:
            preview = preview_safe.read_text(encoding="utf-8")
            template = (SKILL_ROOT / RESOURCE_PATHS["preview_template"]).read_text(encoding="utf-8")
            if template.count("<!--GZH_CONTENT-->") != 1 or template.count("{{TITLE}}") != 1:
                issue(issues, "invalid_layout_preview_template", "Preview template markers are not unique.")
            expected = template.replace("<!--GZH_CONTENT-->", clean.strip(), 1).replace(
                "{{TITLE}}", html.escape(clean_path.stem), 1
            )
            target = f'<div id="gzh-content">\n{clean.strip()}\n  </div>'
            checks["preview_embedding_count"] = preview.count(target)
            checks["preview_embedding_byte_identical"] = preview == expected \
                and checks["preview_embedding_count"] == 1 \
                and preview.count(clean.strip()) == 1
            checks["preview_copy_button"] = preview.count('id="gzhCopyBtn"') == 1 \
                and "复制到公众号" in preview
            if not checks["preview_embedding_byte_identical"]:
                issue(issues, "layout_preview_embedding_mismatch", "Preview does not embed the trimmed clean fragment byte-identically once.")
            if not checks["preview_copy_button"]:
                issue(issues, "layout_preview_copy_button_missing", "Preview copy button is missing or duplicated.")

    status = "PASS" if not issues else "FAILED"
    artifacts = artifacts_for(context, include_preview=status == "PASS")
    value = make_result(context, status, artifacts, checks, issues)
    write_result(context, value)
    emit({**value, "result_path": context.spec["result"]}, 0 if status == "PASS" else 2)


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else None
    request_input = sys.argv[2] if len(sys.argv) > 2 else None
    detail = sys.argv[3] if len(sys.argv) > 3 else None
    valid = command in {"validate-request", "finalize", "block"} and request_input \
        and (command != "block" or isinstance(detail, str) and detail.strip()) and len(sys.argv) == (4 if command == "block" else 3)
    if not valid:
        emit({
            "status": "BLOCKED",
            "issues": [{
                "code": "invalid_wechat_layout_command",
                "message": "Usage: provider_contract.py validate-request|finalize <request.json> | block <request.json> <reason>",
                "resume_from": "package",
            }],
        }, 2)

    context = validate_request(request_input)
    if context.issues:
        request_failure(context)
    if command == "validate-request":
        if list(os.scandir(context.output_dir)):
            issue(context.issues, "unexpected_layout_staging_artifact", "Staging must be empty before layout generation.")
            request_failure(context)
        emit({
            "status": "PASS",
            "task_id": context.request["task_id"],
            "run_dir": str(context.run_dir),
            "output_dir": context.spec["staging"],
            "inputs": {
                "source_markdown": context.spec["source"],
                "publish_manifest": context.spec["manifest"],
            },
            "issues": [],
        })
    if command == "block":
        issues = []
        issue(issues, "wechat_layout_blocked", detail.strip())
        value = make_result(context, "BLOCKED", [], default_checks(True, "format_wechat"), issues)
        write_result(context, value)
        emit({**value, "result_path": context.spec["result"]}, 2)
    finalize(context)


if __name__ == "__main__":
    main()
