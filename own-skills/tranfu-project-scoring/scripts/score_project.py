#!/usr/bin/env python3
"""Local pre-scorer for Tranfu project ideas.

Reads JSON from stdin or a file path argument. By default it returns
clarification questions for thin inputs and a conservative JSON pre-score for
inputs with enough core facts. Use --force-score to emit a provisional score.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

SCHEMA_VERSION = "1.0"

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

WEIGHTS = DEFAULT_WEIGHTS

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
    "tranfuFit": "Tranfu 适配度",
}

EVIDENCE_COEFFICIENT = {
    "L0": 0.75,
    "L1": 0.82,
    "L2": 0.90,
    "L3": 0.97,
    "L4": 1.00,
}

CORE_DIMENSIONS = [
    "demandReality",
    "aiWorkflowFit",
    "validationFeasibility",
    "distributionReachability",
    "riskResponsibility",
]

VAGUE_USERS = ["所有人", "人人", "企业用户", "年轻人", "打工人", "创业者", "中小企业", "everyone", "all users"]
RISK_TERMS = ["医疗", "诊断", "法律", "合同", "金融", "投资", "心理", "未成年人", "隐私", "版权"]


def clamp(value: float, low: int = 0, high: int = 100) -> int:
    return int(max(low, min(high, round(value))))


def load_input() -> Dict[str, Any]:
    paths = [arg for arg in sys.argv[1:] if not arg.startswith("--")]
    if paths:
        return json.loads(Path(paths[0]).read_text(encoding="utf-8"))
    return json.loads(sys.stdin.read())


def infer_project_type(payload: Dict[str, Any]) -> str:
    project = payload.get("project") or payload
    raw = str(project.get("projectType") or payload.get("projectType") or "").strip()
    if raw in WEIGHT_PROFILES:
        return raw

    text = " ".join(
        str(project.get(k, ""))
        for k in ["name", "description", "targetUser", "currentSolution", "aiRole", "extraContext"]
    ).lower()
    if any(term in text for term in ["transfu", "Tranfu", "skill", "codex", "agent", "方法论资产"]):
        return "tranfu_skill"
    if any(term in text for term in ["内部", "公司内部", "团队", "同事", "提效", "立项"]):
        return "internal_initiative"
    if any(term in text for term in ["demo", "演示", "公开案例"]):
        return "public_demo"
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

    # Optional answer aliases for quick CLI use. Values should be 0-100.
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
        if key not in weights:
            continue
        if key not in scores:
            inferred = average([answers.get(field) for field in fields])
            if inferred is None:
                missing.append(f"缺少{LABELS[key]}的可评分输入")
            else:
                scores[key] = clamp(inferred)

    return scores, missing


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
        (
            "target_user_scene",
            "targetUser",
            "谁是最具体的目标用户？他们在什么重复场景下会使用这个工作流？",
            "影响用户门槛和需求真实性评分。",
            "缺少具体目标用户和重复使用场景",
        ),
        (
            "current_workaround",
            "currentSolution",
            "这些用户现在怎么解决这个问题？当前替代方案哪里慢、贵、容易错或不可持续？",
            "影响需求真实性和商业/价值回收判断。",
            "缺少当前替代方案和痛点证据",
        ),
        (
            "ai_job",
            "aiRole",
            "AI 在流程中具体负责哪一步？输入是什么、输出是什么、谁来复核？",
            "影响 AI 工作流适配和责任边界。",
            "缺少 AI 的具体工作、输入输出和复核点",
        ),
        (
            "evidence",
            "evidenceLevel",
            "目前有什么证据？例如观察、访谈、真实样本、行为信号、付费或交付记录。",
            "影响置信度和是否允许进入开发。",
            "缺少证据等级或证据来源",
        ),
        (
            "first_validation_channel",
            "firstUserSource",
            "第一批 5-10 个用户或真实样本从哪里来？7 天内怎么拿到？",
            "影响验证可行性和分发可达性。",
            "缺少首批用户或样本来源",
        ),
    ]

    for question_id, field, question, why, missing_text in checks:
        value = project.get(field) or payload.get(field)
        if not is_present(value, 2 if field == "evidenceLevel" else 4):
            questions.append({"id": question_id, "question": question, "whyItMatters": why})
            missing.append(missing_text)

    text = " ".join(str(project.get(k, "")) for k in ["name", "description", "targetUser", "currentSolution", "aiRole", "extraContext"])
    has_risk = any(term in text for term in RISK_TERMS)
    boundary = project.get("responsibilityBoundary") or payload.get("responsibilityBoundary")
    if has_risk and not is_present(boundary):
        questions.append(
            {
                "id": "responsibility_boundary",
                "question": "这个项目的责任边界是什么？哪些结论必须由专业人员或人工复核，哪些内容不能由 AI 直接决定？",
                "whyItMatters": "影响责任门槛，高风险项目没有边界不能直接进入开发。",
            }
        )
        missing.append("缺少高风险场景的责任边界")

    return questions[:5], missing[:5]


def needs_clarification(payload: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
    project = payload.get("project") or payload
    questions, missing = clarification_questions(payload)
    core_missing = len(questions) >= 2
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
    return core_missing, result


def evidence_breakdown(payload: Dict[str, Any], default_level: str) -> Dict[str, str]:
    raw = payload.get("evidence")
    if isinstance(raw, dict):
        return {str(k): str(v).upper()[:2] for k, v in raw.items()}
    return {
        "demand": default_level,
        "distribution": default_level,
        "payment": default_level,
        "technical": default_level,
        "risk": default_level,
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
        return "用严格 MVP 范围启动 Demo，并在首批用户中同步验证复用意愿。"
    if level == "先验证":
        return "先做 7 天验证实验，再决定是否进入 Demo 开发。"
    if level in {"重构方向", "观察入池"}:
        return "先重构用户、场景、验证路径或责任边界，再重新评分。"
    return "暂不投入开发资源，等待新的需求证据或分发机会。"


def score(payload: Dict[str, Any]) -> Dict[str, Any]:
    project = payload.get("project") or payload
    project_type = infer_project_type(payload)
    weights = weights_for(project_type)
    evidence = str(project.get("evidenceLevel") or payload.get("evidenceLevel") or "L1").upper()[:2]
    coeff = EVIDENCE_COEFFICIENT.get(evidence, 0.82)
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
            continue
        if value < 20:
            weak_factor *= 0.70
        elif value < 30:
            weak_factor *= 0.85
        elif value < 45:
            weak_factor *= 0.95

    evidence_score_factor = coeff if should_apply_evidence_to_score(project_type) else 1.0
    final = clamp(base * evidence_score_factor * weak_factor * missing_penalty)
    gates = infer_gates(payload, scores)
    level = apply_status_limits(status_from_score(final), evidence, scores, gates, missing)

    confidence = {
        "L0": "低置信度",
        "L1": "偏低置信度",
        "L2": "中置信度",
        "L3": "高置信度",
        "L4": "最高置信度",
    }.get(evidence, "偏低置信度")

    return {
        "schemaVersion": SCHEMA_VERSION,
        "type": "score",
        "reviewMode": str(payload.get("reviewMode") or "standard"),
        "projectType": project_type,
        "weightProfile": weights,
        "inputSummary": input_summary(project),
        "missingInfo": missing,
        "evidence": evidence_breakdown(payload, evidence),
        "scoreBeforeConfidence": clamp(base),
        "informationCompleteness": round(coverage, 3),
        "confidenceCoefficient": round(coeff * missing_penalty * coverage, 3),
        "evidenceAppliedToScore": should_apply_evidence_to_score(project_type),
        "score": final,
        "level": level,
        "confidence": confidence,
        "dimensions": [
            {"key": key, "label": LABELS[key], "score": scores[key], "missing": False}
            for key in weights
            if key in scores
        ] + [
            {"key": key, "label": LABELS[key], "score": None, "missing": True}
            for key in weights
            if key not in scores
        ],
        "gates": gates,
        "riskiestAssumption": "目标用户愿意用真实样本验证该工作流，并认为输出能节省时间、降低成本或提升质量。",
        "nextAction": next_action(level, gates, missing),
    }


def main() -> None:
    payload = load_input()
    force_score = "--force-score" in sys.argv[1:]
    should_clarify, clarification = needs_clarification(payload)
    result = score(payload) if force_score or not should_clarify else clarification
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
