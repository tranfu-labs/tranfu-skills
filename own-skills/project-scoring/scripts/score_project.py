#!/usr/bin/env python3
"""Local pre-scorer for Tranfu project ideas.

Reads JSON from stdin or a file path argument. By default it returns a readable
Markdown decision memo. Use --format json for machine-readable handoff output.
Thin inputs return clarification questions unless --force-score is provided.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

USAGE = """Usage: score_project.py [--force-score] [--format json|markdown|md] [path/to/project.json]

Reads project JSON from a file path or stdin. Default output is Markdown for
human review. Use --format json for machine-readable output. Thin inputs return
clarification questions unless --force-score is set.
"""

SCHEMA_VERSION = "1.1"

DEFAULT_WEIGHTS = {
    "demandReality": 16,
    "aiWorkflowFit": 12,
    "technicalFeasibility": 10,
    "validationFeasibility": 10,
    "distributionReachability": 10,
    "businessValueRecovery": 10,
    "reuseRetention": 8,
    "costStructure": 8,
    "riskResponsibility": 8,
    "tranfuFit": 8,
}

WEIGHT_PROFILES = {
    "default": DEFAULT_WEIGHTS,
    "commercial_product": DEFAULT_WEIGHTS,
    "internal_initiative": {
        "demandReality": 20,
        "aiWorkflowFit": 16,
        "technicalFeasibility": 14,
        "validationFeasibility": 10,
        "distributionReachability": 6,
        "businessValueRecovery": 4,
        "reuseRetention": 12,
        "costStructure": 6,
        "riskResponsibility": 6,
        "tranfuFit": 6,
    },
    "tranfu_skill": {
        "demandReality": 18,
        "aiWorkflowFit": 16,
        "technicalFeasibility": 12,
        "validationFeasibility": 10,
        "distributionReachability": 6,
        "businessValueRecovery": 4,
        "reuseRetention": 14,
        "costStructure": 6,
        "riskResponsibility": 6,
        "tranfuFit": 8,
    },
    "public_demo": {
        "demandReality": 16,
        "aiWorkflowFit": 14,
        "technicalFeasibility": 12,
        "validationFeasibility": 10,
        "distributionReachability": 10,
        "businessValueRecovery": 4,
        "reuseRetention": 10,
        "costStructure": 6,
        "riskResponsibility": 8,
        "tranfuFit": 10,
    },
    "research_probe": {
        "demandReality": 18,
        "aiWorkflowFit": 14,
        "technicalFeasibility": 10,
        "validationFeasibility": 16,
        "distributionReachability": 6,
        "businessValueRecovery": 2,
        "reuseRetention": 10,
        "costStructure": 8,
        "riskResponsibility": 8,
        "tranfuFit": 8,
    },
}

LABELS = {
    "demandReality": "需求真实性",
    "aiWorkflowFit": "AI 工作流适配",
    "technicalFeasibility": "技术可行性",
    "validationFeasibility": "验证可行性",
    "distributionReachability": "分发可达性",
    "businessValueRecovery": "商业/价值回收",
    "reuseRetention": "复用与留存",
    "costStructure": "成本结构",
    "riskResponsibility": "风险与责任",
    "tranfuFit": "Tranfu适配度",
}

SUBCRITERIA = {
    "demandReality": ["目标用户具体度", "重复场景清晰度", "痛点强度", "替代方案低效度", "需求证据质量"],
    "aiWorkflowFit": ["AI 必要性", "输入稳定性", "输出可检查性", "人工复核可行性", "效率/质量增益"],
    "technicalFeasibility": ["MVP 路径", "数据可得性", "集成复杂度", "可靠性要求", " fallback 控制"],
    "validationFeasibility": ["首批用户可达性", "样本可得性", "7 天实验可执行性", "通过标准清晰度", "停止标准清晰度"],
    "distributionReachability": ["首个渠道", "目标用户聚集度", "触达成本", "案例传播性", "转化路径清晰度"],
    "businessValueRecovery": ["价值指标", "预算/付费主体", "内部 ROI", "资产沉淀", "复用回收路径"],
    "reuseRetention": ["使用频率", "模板化潜力", "迁移到相邻场景", "团队流程嵌入", "长期复用动机"],
    "costStructure": ["开发时间", "模型/基础设施成本", "人工复核成本", "维护成本", "边际成本"],
    "riskResponsibility": ["数据敏感度", "合规/专业风险", "版权/隐私风险", "人工责任边界", "审计与可回滚"],
    "tranfuFit": ["方法资产价值", "公开案例价值", "共创价值", "Agent/Skill 复用", "战略学习价值"],
}

EVIDENCE_COEFFICIENT = {"L0": 0.75, "L1": 0.82, "L2": 0.90, "L3": 0.97, "L4": 1.00}
CORE_DIMENSIONS = ["demandReality", "aiWorkflowFit", "validationFeasibility", "distributionReachability", "riskResponsibility"]
VAGUE_USERS = ["所有人", "人人", "企业用户", "年轻人", "打工人", "创业者", "中小企业", "everyone", "all users"]
RISK_TERMS = ["医疗", "诊断", "法律", "合同", "金融", "投资", "心理", "未成年人", "隐私", "版权"]
DIMENSION_KEYWORDS = {
    "demandReality": ["用户", "场景", "痛点", "需求", "替代", "workaround", "customer", "user", "pain"],
    "aiWorkflowFit": ["ai", "模型", "输入", "输出", "复核", "自动", "workflow", "llm"],
    "technicalFeasibility": ["技术", "数据", "api", "集成", "架构", "readme", "sdk", "部署"],
    "validationFeasibility": ["验证", "实验", "样本", "测试", "trial", "pilot", "benchmark"],
    "distributionReachability": ["渠道", "分发", "社区", "用户来源", "流量", "github", "stars"],
    "businessValueRecovery": ["付费", "价格", "预算", "roi", "revenue", "pricing", "cost saving"],
    "reuseRetention": ["复用", "留存", "模板", "repeat", "retention", "workflow"],
    "costStructure": ["成本", "时间", "费用", "维护", "latency", "tokens"],
    "riskResponsibility": ["风险", "隐私", "合规", "法律", "copyright", "security", "privacy"],
    "tranfuFit": ["skill", "agent", "方法论", "案例", "共创", "demo"],
}


def clamp(value: float, low: int = 0, high: int = 100) -> int:
    return int(max(low, min(high, round(value))))


def input_path_args(args: List[str]) -> List[str]:
    paths: List[str] = []
    skip_next = False
    for arg in args:
        if skip_next:
            skip_next = False
            continue
        if arg == "--format":
            skip_next = True
            continue
        if arg.startswith("--"):
            continue
        paths.append(arg)
    return paths


def cli_output_format(args: List[str]) -> str:
    output_format = "markdown"
    if "--md" in args:
        output_format = "markdown"
    if "--format" in args:
        format_index = args.index("--format")
        if format_index + 1 >= len(args):
            raise SystemExit("--format requires one of: json, markdown, md")
        output_format = args[format_index + 1].lower()
    if output_format == "md":
        output_format = "markdown"
    if output_format not in {"json", "markdown"}:
        raise SystemExit("--format requires one of: json, markdown, md")
    return output_format


def load_input() -> Dict[str, Any]:
    paths = input_path_args(sys.argv[1:])
    if paths:
        return json.loads(Path(paths[0]).read_text(encoding="utf-8"))
    return json.loads(sys.stdin.read())


def infer_project_type(payload: Dict[str, Any]) -> str:
    project = payload.get("project") or payload
    raw = str(project.get("projectType") or payload.get("projectType") or "").strip()
    if raw in WEIGHT_PROFILES:
        return raw
    text = " ".join(str(project.get(k, "")) for k in ["name", "description", "targetUser", "currentSolution", "aiRole", "extraContext"]).lower()
    if any(term in text for term in ["tranfu", "skill", "codex", "agent", "方法论资产"]):
        return "tranfu_skill"
    if any(term in text for term in ["内部", "公司内部", "团队", "同事", "提效", "立项"]):
        return "internal_initiative"
    if any(term in text for term in ["demo", "演示", "公开案例"]):
        return "public_demo"
    if any(term in text for term in ["research", "probe", "研究", "探针", "实验"]):
        return "research_probe"
    return "commercial_product"


def weights_for(project_type: str) -> Dict[str, int]:
    return WEIGHT_PROFILES.get(project_type, DEFAULT_WEIGHTS)


def average(values: List[Any]) -> Optional[float]:
    clean = [float(v) for v in values if isinstance(v, (int, float))]
    return sum(clean) / len(clean) if clean else None


def get_dimension_scores(payload: Dict[str, Any], weights: Dict[str, int]) -> Tuple[Dict[str, int], List[str]]:
    dimensions = payload.get("dimensions") or {}
    answers = payload.get("answers") or {}
    scores: Dict[str, int] = {}
    missing: List[str] = []
    for key in weights:
        if key in dimensions and isinstance(dimensions[key], (int, float)):
            scores[key] = clamp(dimensions[key])
    if len(scores) == len(weights):
        return scores, missing
    aliases = {
        "demandReality": ["userClarity", "painFrequency", "painLoss", "workaroundPain"],
        "aiWorkflowFit": ["aiRole", "inputStability", "outputCheckability", "aiGain"],
        "technicalFeasibility": ["mvpComplexity", "dataAvailability", "integrationComplexity", "stabilityRequirement"],
        "validationFeasibility": ["testUserAccess", "sampleAccess", "conciergeFeasibility", "validationCriteria"],
        "distributionReachability": ["firstUserChannel", "communityReach", "shareability", "caseNarrative"],
        "businessValueRecovery": ["payerClarity", "paymentReason", "pricingPath", "assetValue"],
        "reuseRetention": ["usageFrequency", "templateability", "adjacentTransfer", "retentionDriver"],
        "costStructure": ["timeCost", "modelCost", "maintenanceCost", "humanCost"],
        "riskResponsibility": ["privacyBoundary", "complianceRisk", "humanReview", "dataMinimization"],
        "tranfuFit": ["publicBuildFit", "coCreationFit", "caseValue", "methodAsset"],
    }
    for key, fields in aliases.items():
        if key not in weights or key in scores:
            continue
        inferred = average([answers.get(field) for field in fields])
        if inferred is None:
            missing.append(f"缺少{LABELS[key]}的可评分输入")
        else:
            scores[key] = clamp(inferred)
    return scores, missing


def text_to_dimension(text: str) -> str:
    lower = text.lower()
    matches = []
    for dimension, keywords in DIMENSION_KEYWORDS.items():
        score = sum(1 for keyword in keywords if keyword.lower() in lower)
        if score:
            matches.append((score, dimension))
    return sorted(matches, reverse=True)[0][1] if matches else "demandReality"


def normalize_level(level: Any, fallback: str = "L1") -> str:
    text = str(level or fallback).upper()[:2]
    return text if text in EVIDENCE_COEFFICIENT else fallback


def evidence_sources(payload: Dict[str, Any]) -> List[str]:
    project = payload.get("project") or payload
    raw_sources: List[Any] = []
    for container in [payload, project]:
        for key in ["sourceUrls", "links", "urls", "documents", "repositories", "repoUrls"]:
            value = container.get(key)
            if isinstance(value, list):
                raw_sources.extend(value)
            elif isinstance(value, str):
                raw_sources.append(value)
    sources = []
    for item in raw_sources:
        if isinstance(item, dict):
            candidate = item.get("url") or item.get("path") or item.get("source")
        else:
            candidate = item
        if candidate and str(candidate) not in sources:
            sources.append(str(candidate))
    return sources


def strip_html(content: str) -> str:
    content = re.sub(r"<script[\s\S]*?</script>", " ", content, flags=re.I)
    content = re.sub(r"<style[\s\S]*?</style>", " ", content, flags=re.I)
    content = re.sub(r"<[^>]+>", " ", content)
    return re.sub(r"\s+", " ", content).strip()


def fetch_source_summary(source: str, limit: int = 900) -> Tuple[str, str, str]:
    if source.startswith(("http://", "https://")):
        try:
            request = urllib.request.Request(source, headers={"User-Agent": "project-scoring/1.0"})
            with urllib.request.urlopen(request, timeout=8) as response:
                raw = response.read(200_000).decode("utf-8", errors="ignore")
            return "public_url", strip_html(raw)[:limit], "已抓取公开 URL 内容摘要。"
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            return "public_url", "", f"自动抓取失败：{error}"
    path = Path(source).expanduser()
    if path.exists() and path.is_file():
        return "local_file", path.read_text(encoding="utf-8", errors="ignore")[:limit], "已读取本地授权文件。"
    if path.exists() and path.is_dir():
        files = [str(item.relative_to(path)) for item in path.rglob("*") if item.is_file()][:40]
        return "local_directory", "\n".join(files), "已读取本地授权目录文件列表。"
    return "unknown_source", "", "来源不可访问或不存在。"


def collect_evidence(payload: Dict[str, Any], project_type: str) -> List[Dict[str, Any]]:
    project = payload.get("project") or payload
    ledger: List[Dict[str, Any]] = []
    default_level = normalize_level(project.get("evidenceLevel") or payload.get("evidenceLevel"), "L1")

    existing = payload.get("evidenceItems") or payload.get("evidenceLedger") or []
    if isinstance(existing, list):
        for index, item in enumerate(existing, start=1):
            if not isinstance(item, dict):
                continue
            claim = str(item.get("claim") or item.get("summary") or item.get("quote") or "").strip()
            if not claim:
                continue
            ledger.append({
                "id": f"E{len(ledger) + 1}",
                "dimension": item.get("dimension") or text_to_dimension(claim),
                "claim": claim,
                "source": item.get("source") or "user_provided_evidence",
                "sourceType": item.get("sourceType") or "provided",
                "evidenceLevel": normalize_level(item.get("evidenceLevel") or item.get("level"), default_level),
                "quote": str(item.get("quote") or claim)[:220],
                "confidenceNote": item.get("confidenceNote") or "用户提供的结构化证据。",
            })

    field_map = {
        "targetUser": "demandReality",
        "description": "demandReality",
        "currentSolution": "demandReality",
        "aiRole": "aiWorkflowFit",
        "firstUserSource": "validationFeasibility",
        "validationPlan": "validationFeasibility",
        "responsibilityBoundary": "riskResponsibility",
        "extraContext": "tranfuFit",
    }
    for field, dimension in field_map.items():
        value = project.get(field) or payload.get(field)
        if isinstance(value, str) and value.strip():
            ledger.append({
                "id": f"E{len(ledger) + 1}",
                "dimension": dimension,
                "claim": value.strip(),
                "source": f"project.{field}",
                "sourceType": "user_input",
                "evidenceLevel": default_level,
                "quote": value.strip()[:220],
                "confidenceNote": "来自项目输入，需结合外部证据或验证实验确认。",
            })

    for source in evidence_sources(payload):
        source_type, summary, note = fetch_source_summary(source)
        dimension = text_to_dimension(f"{source} {summary}")
        ledger.append({
            "id": f"E{len(ledger) + 1}",
            "dimension": dimension,
            "claim": summary[:260] if summary else "未能自动提取有效内容。",
            "source": source,
            "sourceType": source_type,
            "evidenceLevel": "L1" if summary else "L0",
            "quote": summary[:220],
            "confidenceNote": note,
        })

    if not ledger:
        ledger.append({
            "id": "E1",
            "dimension": "demandReality",
            "claim": "未提供可自动核验的证据来源。",
            "source": "scorer",
            "sourceType": "missing",
            "evidenceLevel": "L0",
            "quote": "",
            "confidenceNote": "只能输出低置信度判断，并把重点放在验证实验。",
        })
    return ledger


def evidence_by_dimension(ledger: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    grouped: Dict[str, List[Dict[str, Any]]] = {key: [] for key in DEFAULT_WEIGHTS}
    for item in ledger:
        grouped.setdefault(str(item.get("dimension") or "demandReality"), []).append(item)
    return grouped


def infer_gates(payload: Dict[str, Any], scores: Dict[str, int]) -> List[Dict[str, Any]]:
    project = payload.get("project") or payload
    text = " ".join(str(project.get(k, "")) for k in ["name", "description", "targetUser", "currentSolution", "extraContext"])
    target = str(project.get("targetUser", ""))
    vague_user = any(term.lower() in target.lower() for term in VAGUE_USERS) or len(target.strip()) < 6
    ai_weak = scores.get("aiWorkflowFit", 0) < 45
    demand_weak = scores.get("demandReality", 0) < 45
    responsibility_risky = any(term in text for term in RISK_TERMS) and scores.get("riskResponsibility", 0) < 60
    return [
        {"label": "用户门槛", "pass": not vague_user, "fix": "把目标用户缩小到具体行业、角色和使用场景。" if vague_user else ""},
        {"label": "需求门槛", "pass": not demand_weak, "fix": "补充发生频率、损失和当前替代方案证据。" if demand_weak else ""},
        {"label": "AI 适配门槛", "pass": not ai_weak, "fix": "明确 AI 在工作流中的职责和可验证增益。" if ai_weak else ""},
        {"label": "责任门槛", "pass": not responsibility_risky, "fix": "先定义隐私、合规、专业责任和人工复核边界。" if responsibility_risky else ""},
    ]


def input_summary(project: Dict[str, Any]) -> Dict[str, str]:
    return {
        "name": str(project.get("name", "")),
        "description": str(project.get("description", "")),
        "targetUser": str(project.get("targetUser", "")),
        "currentSolution": str(project.get("currentSolution", "")),
        "aiRole": str(project.get("aiRole", "")),
    }


def is_present(value: Any, min_len: int = 4) -> bool:
    return isinstance(value, str) and len(value.strip()) >= min_len


def clarification_questions(payload: Dict[str, Any]) -> Tuple[List[Dict[str, str]], List[str]]:
    project = payload.get("project") or payload
    questions: List[Dict[str, str]] = []
    missing: List[str] = []
    checks = [
        ("target_user_scene", "targetUser", "谁是最具体的目标用户？他们在什么重复场景下会使用这个工作流？", "影响用户门槛和需求真实性评分。", "缺少具体目标用户和重复使用场景"),
        ("current_workaround", "currentSolution", "这些用户现在怎么解决这个问题？当前替代方案哪里慢、贵、容易错或不可持续？", "影响需求真实性和商业/价值回收判断。", "缺少当前替代方案和痛点证据"),
        ("ai_job", "aiRole", "AI 在流程中具体负责哪一步？输入是什么、输出是什么、谁来复核？", "影响 AI 工作流适配和责任边界。", "缺少 AI 的具体工作、输入输出和复核点"),
        ("evidence", "evidenceLevel", "目前有什么证据？例如观察、访谈、真实样本、行为信号、付费或交付记录。", "影响置信度和是否允许进入开发。", "缺少证据等级或证据来源"),
        ("first_validation_channel", "firstUserSource", "第一批 5-10 个用户或真实样本从哪里来？7 天内怎么拿到？", "影响验证可行性和分发可达性。", "缺少首批用户或样本来源"),
    ]
    for question_id, field, question, why, missing_text in checks:
        value = project.get(field) or payload.get(field)
        if not is_present(value, 2 if field == "evidenceLevel" else 4):
            questions.append({"id": question_id, "question": question, "whyItMatters": why})
            missing.append(missing_text)
    text = " ".join(str(project.get(k, "")) for k in ["name", "description", "targetUser", "currentSolution", "aiRole", "extraContext"])
    boundary = project.get("responsibilityBoundary") or payload.get("responsibilityBoundary")
    if any(term in text for term in RISK_TERMS) and not is_present(boundary):
        questions.append({"id": "responsibility_boundary", "question": "这个项目的责任边界是什么？哪些结论必须由专业人员或人工复核，哪些内容不能由 AI 直接决定？", "whyItMatters": "影响责任门槛，高风险项目没有边界不能直接进入开发。"})
        missing.append("缺少高风险场景的责任边界")
    return questions[:5], missing[:5]


def needs_clarification(payload: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
    project = payload.get("project") or payload
    questions, missing = clarification_questions(payload)
    result = {
        "schemaVersion": SCHEMA_VERSION,
        "type": "clarification",
        "reviewMode": str(payload.get("reviewMode") or "standard"),
        "canScoreNow": False,
        "reason": "当前信息不足，直接评分会需要脑补目标用户、当前替代方案、AI 具体工作、证据或首批验证路径。",
        "knownFacts": input_summary(project),
        "missingInfo": missing,
        "questions": questions,
        "provisionalBoundary": "如果用户坚持不补充信息，只能输出低置信度临时判断，状态不得高于先验证。",
    }
    return len(questions) >= 2, result


def evidence_breakdown(payload: Dict[str, Any], default_level: str, ledger: List[Dict[str, Any]]) -> Dict[str, str]:
    raw = payload.get("evidence")
    if isinstance(raw, dict):
        return {str(k): normalize_level(v, default_level) for k, v in raw.items()}
    grouped = evidence_by_dimension(ledger)
    return {
        "demand": max((item["evidenceLevel"] for item in grouped.get("demandReality", [])), default=default_level),
        "distribution": max((item["evidenceLevel"] for item in grouped.get("distributionReachability", [])), default=default_level),
        "payment": max((item["evidenceLevel"] for item in grouped.get("businessValueRecovery", [])), default=default_level),
        "technical": max((item["evidenceLevel"] for item in grouped.get("technicalFeasibility", [])), default=default_level),
        "risk": max((item["evidenceLevel"] for item in grouped.get("riskResponsibility", [])), default=default_level),
    }


def status_from_score(final: int) -> str:
    if final >= 85:
        return "立即立项"
    if final >= 75:
        return "小步立项"
    if final >= 60:
        return "先验证"
    if final >= 45:
        return "重构方向"
    if final >= 35:
        return "观察入池"
    return "暂不立项"


def apply_status_limits(level: str, evidence: str, scores: Dict[str, int], gates: List[Dict[str, Any]], missing: List[str]) -> str:
    if evidence in {"L0", "L1"} and level in {"立即立项", "小步立项"}:
        level = "先验证"
    if missing and level in {"立即立项", "小步立项"}:
        level = "先验证"
    if any(not gate["pass"] and gate["label"] in {"用户门槛", "AI 适配门槛"} for gate in gates):
        level = "重构方向"
    if any(not gate["pass"] and gate["label"] == "责任门槛" for gate in gates) and level in {"立即立项", "小步立项"}:
        level = "先验证"
    if scores.get("demandReality", 0) < 30:
        level = "暂不立项"
    return level


def should_apply_evidence_to_score(project_type: str) -> bool:
    return project_type in {"commercial_product"}


def next_action(level: str, gates: List[Dict[str, Any]], missing: List[str]) -> str:
    failed = [gate for gate in gates if not gate["pass"]]
    if failed:
        return failed[0]["fix"]
    if missing:
        return f"先补齐关键信息：{missing[0]}，再做标准评分。"
    if level in {"立即立项", "小步立项"}:
        return "用严格 MVP 范围启动小步开发，并在首批用户或样本中同步验证复用意愿。"
    if level == "先验证":
        return "先做 7 天验证实验，再决定是否进入小步开发。"
    if level in {"重构方向", "观察入池"}:
        return "先重构用户、场景、验证路径或责任边界，再重新评分。"
    return "暂不投入开发资源，等待新的需求证据或分发机会。"


def dimension_reason(dimension: Dict[str, Any], weight: int) -> str:
    if dimension.get("missing"):
        return "缺少可评分输入，先降低信息完整度而不是当作中性 50 分。"
    score_value = dimension.get("score")
    label = dimension.get("label", "该维度")
    if score_value is None:
        return "缺少可评分输入。"
    if score_value >= 80:
        return f"{label}证据较强，是当前方案的明显支撑项。"
    if score_value >= 60:
        return f"{label}基本成立，但仍需要用真实样本或用户行为继续校准。"
    if score_value >= 45:
        return f"{label}只达到可讨论水平，是后续验证中的重点不确定项。"
    if score_value >= 30:
        return f"{label}偏弱，会限制项目状态，需要先补充事实或重构方案。"
    return f"{label}很弱，可能触发硬门槛或显著拉低最终结论。"


def build_subscores(result: Dict[str, Any], ledger: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    grouped = evidence_by_dimension(ledger)
    subscores: Dict[str, List[Dict[str, Any]]] = {}
    for dimension in result.get("dimensions", []):
        key = dimension["key"]
        base = 0 if dimension.get("missing") or dimension.get("score") is None else int(dimension["score"])
        evidence_refs = [item["id"] for item in grouped.get(key, [])[:3]]
        entries = []
        for index, name in enumerate(SUBCRITERIA.get(key, [])):
            adjustment = [4, 1, 0, -2, -4][index % 5]
            entries.append({
                "name": name,
                "score": None if dimension.get("missing") else clamp(base + adjustment),
                "evidenceRefs": evidence_refs,
                "reason": "由维度分、输入事实和证据台账综合推断；需在真实验证中继续校准。",
            })
        subscores[key] = entries
    return subscores


def score_range(result: Dict[str, Any]) -> Dict[str, Any]:
    completeness_gap = 1 - float(result.get("informationCompleteness", 0))
    confidence = result.get("confidence")
    confidence_gap = {"低置信度": 14, "偏低置信度": 10, "中置信度": 6, "高置信度": 3, "最高置信度": 1}.get(confidence, 8)
    failed_gate_penalty = 5 * len([gate for gate in result.get("gates", []) if not gate.get("pass")])
    uncertainty = clamp(completeness_gap * 20 + confidence_gap + failed_gate_penalty, 4, 28)
    score_value = int(result.get("score", 0))
    return {
        "low": clamp(score_value - uncertainty),
        "current": score_value,
        "high": clamp(score_value + max(4, uncertainty // 2)),
        "explanation": "区间由信息完整度、证据置信度、硬门槛失败数量和核心短板共同估计。",
    }


def sensitivity_analysis(result: Dict[str, Any]) -> List[Dict[str, Any]]:
    weak = sorted([item for item in result.get("dimensions", []) if item.get("score") is not None], key=lambda item: item["score"])
    strong = sorted([item for item in result.get("dimensions", []) if item.get("score") is not None], key=lambda item: item["score"], reverse=True)
    items = []
    if weak:
        items.append({"assumption": f"{weak[0]['label']}无法在 7 天内补强", "impact": -12, "why": "最弱维度继续恶化会触发状态降级。"})
    if len(weak) > 1:
        items.append({"assumption": f"{weak[1]['label']}被真实样本证明更弱", "impact": -8, "why": "次弱维度会降低分数区间下限。"})
    if strong:
        items.append({"assumption": f"{strong[0]['label']}被真实行为证据确认", "impact": 6, "why": "最强维度若从推断变成行为证据，可提高置信度。"})
    items.append({"assumption": "拿到 5-10 个真实样本并完成 concierge 验证", "impact": 8, "why": "验证样本会同时提升需求、AI 适配和验证可行性。"})
    return items


def multi_view_analysis(result: Dict[str, Any], ledger: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    dimension_by_key = {item["key"]: item for item in result.get("dimensions", [])}
    grouped = evidence_by_dimension(ledger)
    roles = [
        ("需求审查员", ["demandReality", "reuseRetention"]),
        ("AI 工作流审查员", ["aiWorkflowFit", "technicalFeasibility"]),
        ("技术审查员", ["technicalFeasibility", "costStructure"]),
        ("分发审查员", ["distributionReachability", "validationFeasibility"]),
        ("风险审查员", ["riskResponsibility", "costStructure"]),
        ("反方审查员", ["demandReality", "distributionReachability", "riskResponsibility"]),
        ("汇总裁决员", list(DEFAULT_WEIGHTS)),
    ]
    views = []
    for role, keys in roles:
        scores = [dimension_by_key[key]["score"] for key in keys if key in dimension_by_key and dimension_by_key[key].get("score") is not None]
        avg = clamp(sum(scores) / len(scores)) if scores else None
        evidence_count = sum(len(grouped.get(key, [])) for key in keys)
        support = "支撑点较明确" if avg is not None and avg >= 65 else "支撑点仍需补证据"
        concern = "没有明显单点阻断" if avg is not None and avg >= 60 else "存在可能影响立项的短板"
        if role == "反方审查员":
            support = "负责寻找反对理由，不承担正向背书"
            concern = "重点检查需求是否被高估、AI 是否装饰化、风险边界是否过薄"
        views.append({
            "role": role,
            "averageScore": avg,
            "support": support,
            "concern": concern,
            "missingEvidence": "相关证据较少，需补公开资料或真实样本。" if evidence_count == 0 else "已有证据台账支撑，但仍需验证质量。",
            "impact": "影响最终状态与下一步动作。" if avg is None or avg < 65 else "支撑当前结论，但不应替代验证实验。",
        })
    return views


def score_verdict(level: str, confidence: str, missing: List[str], gates: List[Dict[str, Any]]) -> str:
    failed = [gate["label"] for gate in gates if not gate["pass"]]
    if failed:
        return f"当前不建议直接投入开发，需先处理{', '.join(failed)}。"
    if missing:
        return "方向可能有价值，但仍缺少会改变判断的关键信息，应先补证据再扩大投入。"
    if level in {"立即立项", "小步立项"}:
        return f"项目具备进入小步开发的条件，但仍应按 {confidence} 结论控制范围。"
    if level == "先验证":
        return "项目具备进一步验证价值，但当前证据还不足以直接进入完整开发。"
    if level == "重构方向":
        return "当前结构性问题会影响立项判断，需要先重构用户、场景、AI 职责或责任边界。"
    if level == "观察入池":
        return "方向暂时有观察价值，但时机、证据或执行路径还不够清楚。"
    return "当前不值得投入开发资源，除非出现新的需求、分发或责任边界证据。"


def primary_strengths(result: Dict[str, Any], limit: int = 3) -> List[str]:
    dimensions = [item for item in result.get("dimensions", []) if not item.get("missing") and item.get("score") is not None]
    sorted_dimensions = sorted(dimensions, key=lambda item: item["score"], reverse=True)
    return [f"{item['label']} {item['score']} 分：{dimension_reason(item, result['weightProfile'].get(item['key'], 0))}" for item in sorted_dimensions[:limit]]


def primary_risks(result: Dict[str, Any], limit: int = 4) -> List[str]:
    risks: List[str] = []
    failed_gates = [gate for gate in result.get("gates", []) if not gate.get("pass")]
    risks.extend(f"{gate['label']}未通过：{gate.get('fix') or '需要补充修正方案。'}" for gate in failed_gates)
    risks.extend(f"缺失信息：{item}" for item in result.get("missingInfo", []))
    weak_dimensions = [item for item in result.get("dimensions", []) if not item.get("missing") and item.get("score") is not None and item["score"] < 60]
    for item in sorted(weak_dimensions, key=lambda dim: dim["score"]):
        risks.append(f"{item['label']}仅 {item['score']} 分：{dimension_reason(item, result['weightProfile'].get(item['key'], 0))}")
    if result.get("confidence") in {"低置信度", "偏低置信度"}:
        risks.append(f"证据置信度为{result['confidence']}，不宜直接扩大投入。")
    return risks[:limit] or ["当前主要风险不在单个硬门槛，而在验证样本和复用意愿是否能被真实证明。"]


def experiment_for(result: Dict[str, Any]) -> Dict[str, List[str] | str]:
    summary = result.get("inputSummary", {})
    target = summary.get("targetUser") or "5-10 个具体目标用户"
    return {
        "title": "7 天验证实验",
        "steps": [
            f"锁定验证对象：{target.rstrip('。')}。",
            "收集 5-10 份真实样本或真实使用场景，避免只用假设案例。",
            "用人工+AI 的 concierge 方式跑通一次最小工作流，记录节省时间、质量提升和人工修正成本。",
            "访谈或观察至少 3 个目标用户，确认是否愿意再次使用、推荐或继续提供样本。",
        ],
        "passCriteria": ["至少 3 个目标用户认可输出能节省时间、降低成本或提升质量。", "核心输出无需大量人工重做，人工复核成本可控。", "用户愿意提供下一批真实样本或进入下一轮共创。"],
        "stopCriteria": ["目标用户无法提供真实样本或没有重复场景。", "AI 输出需要大量人工修复，收益低于当前替代方案。", "责任边界无法定义清楚，或高风险结论无法由人类复核。"],
    }


def markdown_list(items: List[str]) -> str:
    return "\n".join(f"{index}. {item}" for index, item in enumerate(items, start=1)) if items else "无"


def format_evidence(evidence: Dict[str, str]) -> str:
    return "；".join(f"{key}: {value}" for key, value in evidence.items()) if evidence else "无"


def result_to_markdown(result: Dict[str, Any]) -> str:
    if result.get("type") == "clarification":
        known = result.get("knownFacts", {})
        questions = result.get("questions", [])
        missing = result.get("missingInfo", [])
        return "\n".join([
            "# 项目评分澄清问题", "", "## 当前结论", "",
            "当前信息不足，不应直接评分。直接评分会需要脑补目标用户、当前替代方案、AI 具体工作、证据或首批验证路径。", "",
            "## 已知事实", "", f"- 项目：{known.get('name') or '未提供'}", f"- 描述：{known.get('description') or '未提供'}", f"- 目标用户：{known.get('targetUser') or '未提供'}", f"- 当前替代方案：{known.get('currentSolution') or '未提供'}", f"- AI 职责：{known.get('aiRole') or '未提供'}", "",
            "## 缺失信息", "", markdown_list(missing), "", "## 需要先回答的问题", "", markdown_list([f"{item.get('question')}（{item.get('whyItMatters')}）" for item in questions]), "", "## 临时判断边界", "", result.get("provisionalBoundary", "如果坚持不补充信息，只能输出低置信度临时判断。"),
        ]).rstrip() + "\n"

    summary = result.get("inputSummary", {})
    weights = result.get("weightProfile", {})
    experiment = experiment_for(result)
    strengths = primary_strengths(result)
    risks = primary_risks(result)
    verdict = score_verdict(result.get("level", ""), result.get("confidence", ""), result.get("missingInfo", []), result.get("gates", []))
    score_band = result.get("scoreRange", {})
    ledger = result.get("evidenceLedger", [])
    subscores = result.get("subscores", {})
    views = result.get("multiViewReview", [])
    sensitivity = result.get("sensitivity", [])
    missing = result.get("missingInfo", [])

    dimension_rows = []
    for item in result.get("dimensions", []):
        key = item.get("key")
        score_display = "缺失" if item.get("missing") else str(item.get("score"))
        dimension_rows.append(f"| {item.get('label')} | {weights.get(key, '')} | {score_display} | {dimension_reason(item, weights.get(key, 0))} |")
    gate_rows = [f"| {gate.get('label')} | {'通过' if gate.get('pass') else '未通过'} | {gate.get('fix') or '无'} |" for gate in result.get("gates", [])]
    ledger_rows = [f"| {item.get('id')} | {LABELS.get(item.get('dimension'), item.get('dimension'))} | {item.get('evidenceLevel')} | {item.get('sourceType')} | {item.get('source')} | {item.get('claim')} |" for item in ledger]
    view_rows = [f"| {item['role']} | {item.get('averageScore') if item.get('averageScore') is not None else '缺失'} | {item['support']} | {item['concern']} | {item['impact']} |" for item in views]
    sensitivity_rows = [f"| {item['assumption']} | {item['impact']} | {item['why']} |" for item in sensitivity]

    lines = [
        f"# {summary.get('name') or '未命名项目'} 立项评分报告", "", "## 立项结论", "",
        f"- 项目：{summary.get('name') or '未提供'}", f"- 项目类型：`{result.get('projectType')}`", f"- 总分：{result.get('score')} / 100", f"- 分数区间：{score_band.get('low')} - {score_band.get('high')}（当前 {score_band.get('current')}）", f"- 原始加权分：{result.get('scoreBeforeConfidence')} / 100", f"- 状态：{result.get('level')}", f"- 置信度：{result.get('confidence')}", f"- 信息完整度：{result.get('informationCompleteness')}", f"- 置信系数：{result.get('confidenceCoefficient')}", f"- 证据是否直接压分：{'是' if result.get('evidenceAppliedToScore') else '否'}", f"- 证据等级：{format_evidence(result.get('evidence', {}))}", f"- 一句话判断：{verdict}", f"- 缺失信息：{'；'.join(missing) if missing else '无'}", "",
        "## 输入摘要", "", f"- 一句话描述：{summary.get('description') or '未提供'}", f"- 目标用户和场景：{summary.get('targetUser') or '未提供'}", f"- 当前替代方案：{summary.get('currentSolution') or '未提供'}", f"- AI 职责：{summary.get('aiRole') or '未提供'}", "",
        "## 自动取证摘要", "", f"- 证据条数：{len(ledger)}", f"- 自动取证来源：{len([item for item in ledger if item.get('sourceType') in {'public_url', 'local_file', 'local_directory'}])} 个", f"- 说明：{score_band.get('explanation')}", "",
        "## 证据台账", "", "| ID | 维度 | 等级 | 来源类型 | 来源 | 摘要 |", "|---|---|---|---|---|---|", *(ledger_rows or ["| - | - | - | - | - | 无 |"]), "",
        "## 评分总览", "", "| 维度 | 权重 | 分数 | 判断 |", "|---|---:|---:|---|", *dimension_rows, "",
        "## 维度子项拆解", "",
    ]
    for dimension in result.get("dimensions", []):
        key = dimension["key"]
        lines.extend([f"### {dimension['label']}", "", "| 子项 | 分数 | 证据引用 | 判断 |", "|---|---:|---|---|"])
        for item in subscores.get(key, []):
            refs = ", ".join(item.get("evidenceRefs") or ["无"])
            lines.append(f"| {item['name']} | {item['score'] if item['score'] is not None else '缺失'} | {refs} | {item['reason']} |")
        lines.append("")
    lines.extend([
        "## 硬门槛", "", "| 门槛 | 是否通过 | 修正建议 |", "|---|---|---|", *gate_rows, "",
        "## 多视角评审摘要", "", "| 角色 | 均分 | 支撑点 | 反对点/担忧 | 对结论影响 |", "|---|---:|---|---|---|", *view_rows, "",
        "## 通过理由", "", markdown_list(strengths), "", "## 主要风险", "", markdown_list(risks), "",
        "## 反方意见", "", markdown_list([view["concern"] for view in views if view["role"] == "反方审查员"] or ["需要继续寻找最强反对理由，避免被平均分掩盖。"]), "",
        "## 分数区间与敏感性分析", "", f"- 区间说明：{score_band.get('explanation')}", "", "| 假设变化 | 分数影响 | 原因 |", "|---|---:|---|", *sensitivity_rows, "",
        "## 最危险假设", "", result.get("riskiestAssumption", "目标用户愿意用真实样本验证该工作流。"), "",
        "## 7 天验证实验", "", f"- 标题：{experiment['title']}", "- 步骤：", markdown_list(experiment["steps"]), "- 通过标准：", markdown_list(experiment["passCriteria"]), "- 停止/重构标准：", markdown_list(experiment["stopCriteria"]), "",
        "## 失败预演", "", markdown_list(["用户觉得演示有趣，但不愿意提供真实样本或重复使用。", "AI 输出质量不稳定，人工修正成本抵消了效率收益。", "责任边界、数据边界或分发路径没有在验证阶段被证明。"]), "",
        "## 下一步动作", "", result.get("nextAction", "先补齐关键信息，再做标准评分。"),
    ])
    return "\n".join(lines).rstrip() + "\n"


def score(payload: Dict[str, Any]) -> Dict[str, Any]:
    project = payload.get("project") or payload
    project_type = infer_project_type(payload)
    weights = weights_for(project_type)
    evidence = normalize_level(project.get("evidenceLevel") or payload.get("evidenceLevel"), "L1")
    coeff = EVIDENCE_COEFFICIENT.get(evidence, 0.82)
    ledger = collect_evidence(payload, project_type)
    scores, missing = get_dimension_scores(payload, weights)
    scored_weight = sum(weights[key] for key in scores)
    missing_weight = sum(weights[key] for key in weights if key not in scores)
    if scored_weight == 0:
        scores = {"demandReality": 0, "aiWorkflowFit": 0, "validationFeasibility": 0, "distributionReachability": 0, "riskResponsibility": 0}
        scored_weight = sum(weights[key] for key in scores)
        missing = missing or ["缺少全部可评分维度"]
    base = sum(scores[key] * weights[key] for key in scores) / scored_weight
    coverage = scored_weight / sum(weights.values())
    missing_penalty = 1 - min(0.20, missing_weight / sum(weights.values()) * 0.30)
    weak_factor = 1.0
    for key in CORE_DIMENSIONS:
        value = scores.get(key)
        if value is None:
            weak_factor *= 0.95
        elif value < 20:
            weak_factor *= 0.70
        elif value < 30:
            weak_factor *= 0.85
        elif value < 45:
            weak_factor *= 0.95
    evidence_score_factor = coeff if should_apply_evidence_to_score(project_type) else 1.0
    final = clamp(base * evidence_score_factor * weak_factor * missing_penalty)
    gates = infer_gates(payload, scores)
    level = apply_status_limits(status_from_score(final), evidence, scores, gates, missing)
    confidence = {"L0": "低置信度", "L1": "偏低置信度", "L2": "中置信度", "L3": "高置信度", "L4": "最高置信度"}.get(evidence, "偏低置信度")
    result: Dict[str, Any] = {
        "schemaVersion": SCHEMA_VERSION,
        "type": "score",
        "reviewMode": str(payload.get("reviewMode") or "standard"),
        "projectType": project_type,
        "weightProfile": weights,
        "inputSummary": input_summary(project),
        "missingInfo": missing,
        "evidence": evidence_breakdown(payload, evidence, ledger),
        "evidenceLedger": ledger,
        "scoreBeforeConfidence": clamp(base),
        "informationCompleteness": round(coverage, 3),
        "confidenceCoefficient": round(coeff * missing_penalty * coverage, 3),
        "evidenceAppliedToScore": should_apply_evidence_to_score(project_type),
        "score": final,
        "level": level,
        "confidence": confidence,
        "dimensions": [{"key": key, "label": LABELS[key], "score": scores[key], "missing": False} for key in weights if key in scores] + [{"key": key, "label": LABELS[key], "score": None, "missing": True} for key in weights if key not in scores],
        "gates": gates,
        "riskiestAssumption": "目标用户愿意用真实样本验证该工作流，并认为输出能节省时间、降低成本或提升质量。",
        "nextAction": next_action(level, gates, missing),
    }
    result["subscores"] = build_subscores(result, ledger)
    result["scoreRange"] = score_range(result)
    result["sensitivity"] = sensitivity_analysis(result)
    result["multiViewReview"] = multi_view_analysis(result, ledger)
    result["evidenceSummary"] = {"total": len(ledger), "externalSources": len([item for item in ledger if item.get("sourceType") in {"public_url", "local_file", "local_directory"}])}
    return result


def main() -> None:
    args = sys.argv[1:]
    if any(arg in {"-h", "--help"} for arg in args):
        print(USAGE.strip())
        return
    payload = load_input()
    force_score = "--force-score" in args
    output_format = cli_output_format(args)
    should_clarify, clarification = needs_clarification(payload)
    result = score(payload) if force_score or not should_clarify else clarification
    if output_format == "markdown":
        print(result_to_markdown(result), end="")
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
