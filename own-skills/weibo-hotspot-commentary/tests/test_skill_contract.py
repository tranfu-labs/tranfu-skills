import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).parents[1]


class SkillContractTest(unittest.TestCase):
    def read(self, relative_path):
        return (ROOT / relative_path).read_text(encoding="utf-8")

    def test_tranfu_profile_contains_only_public_sources(self):
        profile = json.loads(
            self.read("references/company-profiles/tranfu.json")
        )
        self.assertEqual("tranfu", profile["id"])
        self.assertEqual("public-read-only", profile["read_policy"])
        platforms = {
            source["platform"]: source for source in profile["public_sources"]
        }
        self.assertEqual("not-opened", platforms["douyin"]["status"])
        self.assertEqual("not-opened", platforms["bilibili"]["status"])
        self.assertIn("agentgong-si-yang-cheng-ji", platforms["zhihu"]["url"])
        self.assertIn("toutiao.com/c/user/token/", platforms["toutiao"]["url"])
        self.assertNotIn("lark", json.dumps(profile).lower())

    def test_provider_contract_names_every_workflow_provider(self):
        text = self.read("references/provider-contracts.md")
        for name in (
            "hot-topics",
            "collect-sources",
            "content-topics",
            "weibo-poster",
            "weibo-rewriter",
            "post-illustration-images",
            "imagegen",
        ):
            self.assertIn(f"`{name}`", text)

    def test_delivery_contract_names_all_terminal_states(self):
        text = self.read("references/delivery-contract.md")
        for state in (
            "BLOCKED_PROVIDER",
            "BLOCKED_HOT_TOPICS",
            "BLOCKED_TOPIC_EVIDENCE",
            "BLOCKED_SOURCES",
            "CANCELLED_NO_RELEVANCE",
            "CANCELLED_REVIEW",
            "FAILED_DRAFT_QA",
            "FAILED_IMAGE_QA",
            "PARTIAL",
            "COMPLETE",
        ):
            self.assertIn(state, text)

    def test_frontmatter_triggers_generic_and_fixed_topic_weibo_requests(self):
        text = self.read("SKILL.md")
        self.assertEqual("weibo-hotspot-commentary", ROOT.name)
        self.assertTrue(text.startswith("---\nname: weibo-hotspot-commentary\n"))
        frontmatter = text.split("---", 2)[1]
        description = next(
            line.removeprefix("description: ")
            for line in frontmatter.splitlines()
            if line.startswith("description: ")
        )
        self.assertLessEqual(len(description), 1024)
        for trigger in (
            "写微博",
            "微博长文",
            "固定主题",
            "明确选题",
            "默认使用望船夫 TranFu",
            "Do NOT trigger",
            "不发布",
        ):
            self.assertIn(trigger, description)
        self.assertIn('version: "0.8.0"', frontmatter)
        self.assertIn("# 微博热点评论", text)

    def test_agent_interface_uses_chinese_display_name(self):
        interface = self.read("agents/openai.yaml")
        self.assertIn('display_name: "微博热点评论"', interface)
        self.assertIn("$weibo-hotspot-commentary", interface)

    def test_topic_mode_has_live_fixed_event_and_fixed_theme_paths(self):
        skill = self.read("SKILL.md")
        for mode in ("live-discovery", "fixed-event", "fixed-theme"):
            self.assertIn(f"`{mode}`", skill)
        self.assertIn("hot-topics \\", skill)
        self.assertIn("topic-evidence \\", skill)
        self.assertIn("先查 7 天", skill)
        self.assertIn("扩展到 30 天", skill)
        self.assertIn("固定事件或固定主题不要求出现在微博热榜前 50", skill)
        self.assertIn("no_current_event_anchor", skill)

    def test_workflow_is_editorial_bridge_optional_product_then_unified_delivery(self):
        workflow = self.read("SKILL.md").split("## 工作流", 1)[1]
        headings = [
            "### 1. Topic Mode And Hotspot Evidence",
            "### 2. Build The Editorial AI Bridge",
            "### 3. Optional Promotion Evidence",
            "### 4. Propose And Review Topics",
            "### 5. Canonical Long Draft",
            "### 6. Long Rewrite And Composition QA",
            "### 7. Publishable Network Image Search",
            "### 8. Generated Image Routing",
            "### 9. Unified Delivery",
        ]
        positions = [workflow.index(heading) for heading in headings]
        self.assertEqual(sorted(positions), positions)

    def test_long_copy_contract_enforces_hotspot_ai_composition(self):
        skill = self.read("SKILL.md")
        provider = self.read("references/provider-contracts.md")
        delivery = self.read("references/delivery-contract.md")
        combined = "\n".join((skill, provider, delivery))
        for marker in (
            "75%-85%",
            "15%-25%",
            "不超过 40%",
            "不低于 35%",
            "起因",
            "经过",
            "结果",
        ):
            self.assertIn(marker, combined)
        for field in (
            "event_context",
            "hotspot_analysis",
            "analysis_facets",
            "ai_analysis",
            "product_mention_decision",
            "product_segments",
            "product_evidence_refs",
            "event_context_ratio",
            "hotspot_analysis_ratio",
            "hotspot_ratio",
            "ai_ratio",
        ):
            self.assertIn(field, combined)
        for excluded in ("标题", "话题标签", "图片说明"):
            self.assertIn(excluded, combined)
        self.assertIn("copy-ledger.json", combined)
        self.assertIn("long-copy \\", skill)
        self.assertIn("1500-2000", combined)

    def test_product_mentions_are_optional_evidence_backed_and_ai_only(self):
        texts = (
            self.read("SKILL.md"),
            self.read("references/provider-contracts.md"),
            self.read("references/delivery-contract.md"),
        )
        combined = "\n".join(texts)
        for text in texts:
            self.assertIn("product_mention_decision", text)
            self.assertIn("promotion_evidence_status", text)
            self.assertNotIn("no_company_bridge", text)
        self.assertIn("只有一般 AI 联系", combined)
        self.assertIn("全文不得出现公司名、品牌、产品或产品 CTA", combined)
        self.assertIn("产品内容必须完全位于 `ai_analysis`", combined)
        self.assertIn("AI 段的 25%", combined)
        self.assertIn("公开证据", combined)

    def test_editorial_bridge_is_the_only_relevance_gate(self):
        texts = (
            self.read("SKILL.md"),
            self.read("references/provider-contracts.md"),
            self.read("references/delivery-contract.md"),
        )
        for text in texts:
            self.assertIn("editorial_bridge", text)
            self.assertIn("no_ai_editorial_angle", text)
            self.assertNotIn("no_company_bridge", text)

    def test_deep_commentary_facets_and_anti_restatement_are_required(self):
        texts = (
            self.read("SKILL.md"),
            self.read("references/provider-contracts.md"),
            self.read("references/delivery-contract.md"),
        )
        for text in texts:
            for field in (
                "mechanism",
                "impact",
                "judgment",
                "boundary_or_counterpoint",
            ):
                self.assertIn(field, text)
            self.assertIn("复述", text)

    def test_fixed_three_short_derivation_is_removed(self):
        texts = (
            self.read("SKILL.md"),
            self.read("references/provider-contracts.md"),
            self.read("references/delivery-contract.md"),
            self.read("scripts/validate_artifact.py"),
            self.read("scripts/package_delivery.py"),
            self.read("agents/openai.yaml"),
        )
        combined = "\n".join(texts)
        for marker in (
            "80-140",
            "ai-implication",
            "action-advice",
            "shorts-manifest.json",
            "short-bundle",
            "Derive Three Shorts",
        ):
            self.assertNotIn(marker, combined)

    def test_long_rewrite_uses_plain_language_mode(self):
        skill = self.read("SKILL.md")
        provider = self.read("references/provider-contracts.md")
        combined = "\n".join((skill, provider))
        self.assertIn("long + plain-language", skill)
        self.assertIn("rewrite mode `plain-language`", provider)
        self.assertIn("专业术语首次出现时用白话说明", skill)
        self.assertIn("类比不得新增事实", skill)

    def test_images_are_searched_then_generated_before_delivery(self):
        skill = self.read("SKILL.md")
        factual = skill.index("### 7. Publishable Network Image Search")
        generated = skill.index("### 8. Generated Image Routing")
        delivery = skill.index("### 9. Unified Delivery")
        self.assertLess(factual, generated)
        self.assertLess(generated, delivery)
        self.assertIn("事实图数量 0", skill)
        self.assertIn("allowed_totals = {1, 2, 3, 4, 6, 9}", skill)
        self.assertIn("verification_required", skill)
        self.assertIn("`post-illustration-images`", skill)
        self.assertIn("`imagegen`", skill)

    def test_delivery_contract_uses_one_long_copy_and_image_bundle(self):
        delivery = self.read("references/delivery-contract.md")
        for path in (
            "01-hot-topics/topic-evidence.json",
            "04-content/<topic-id>/long/final.md",
            "04-content/<topic-id>/copy-ledger.json",
            "04-content/<topic-id>/images/image-manifest.json",
            "final-delivery/manifest.json",
            "final-delivery/delivery.md",
        ):
            self.assertIn(path, delivery)
        self.assertIn('"route": "long"', delivery)
        self.assertIn("hotspot_ratio:", delivery)
        self.assertIn("ai_ratio:", delivery)
        self.assertIn("product_mentioned:", delivery)
        self.assertIn("ordered_image_files:", delivery)
        self.assertIn("PARTIAL", delivery)
        self.assertIn("统一交付", delivery)
        self.assertIn("verification_required", delivery)

    def test_examples_cover_generic_and_fixed_topic_routes(self):
        skill = self.read("SKILL.md")
        self.assertGreaterEqual(skill.count("<example>"), 2)
        self.assertIn("User: “写微博”", skill)
        self.assertIn("User: “围绕企业 AI 落地写一篇微博长文”", skill)
        self.assertIn("固定主题入口", skill)
        self.assertIn("自动执行", skill)
        self.assertIn("<bad-example>", skill)

    def test_eval_set_covers_both_entries_long_first_images_and_non_trigger(self):
        payload = json.loads(self.read("evals/evals.json"))
        self.assertEqual("weibo-hotspot-commentary", payload["skill_name"])
        self.assertEqual(10, len(payload["evals"]))
        self.assertEqual(
            set(range(1, 11)), {item["id"] for item in payload["evals"]}
        )
        self.assertTrue(all(item["expectations"] for item in payload["evals"]))
        prompts = "\n".join(item["prompt"] for item in payload["evals"])
        self.assertIn("写微博", prompts)
        self.assertIn("固定主题", prompts)
        expectations = "\n".join(
            expectation
            for item in payload["evals"]
            for expectation in item["expectations"]
        )
        for marker in (
            "75%-85%",
            "15%-25%",
            "30 天",
            "网络图片",
            "不派生固定三条短微博",
            "不提产品",
            "不触发",
            "no_ai_editorial_angle",
            "mechanism",
            "PARTIAL",
            "统一交付",
        ):
            self.assertIn(marker, expectations)


if __name__ == "__main__":
    unittest.main()
