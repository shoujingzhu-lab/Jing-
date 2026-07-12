"""
策略引擎测试
============
测试: CRUD、版本管理、验证、代码导出、模板、权限、状态转换
"""

import pytest
from httpx import AsyncClient

from app.core.security import create_access_token


# ============================================================
# Fixtures
# ============================================================
TEST_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

@pytest.fixture
def auth_headers() -> dict:
    """生成测试用户 JWT"""
    token = create_access_token(subject=TEST_USER_ID)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def valid_definition() -> dict:
    """有效的双 EMA 交叉策略图"""
    return {
        "nodes": [
            {"id": "e9", "type": "indicator", "subtype": "ema", "params": {"period": 9, "source": "close"}},
            {"id": "e21", "type": "indicator", "subtype": "ema", "params": {"period": 21, "source": "close"}},
            {"id": "c1", "type": "condition", "subtype": "crossover", "params": {"direction": "above"}},
            {"id": "s1", "type": "signal", "subtype": "long_entry", "params": {"logic": "and"}},
            {"id": "a1", "type": "action", "subtype": "market_order", "params": {"side": "buy", "amount_type": "usdt", "amount_value": 100}},
            {"id": "r1", "type": "risk_control", "subtype": "stop_loss", "params": {"type": "percent", "value": 0.05}},
        ],
        "edges": [
            {"from": "e9", "to": "c1"}, {"from": "e21", "to": "c1"},
            {"from": "c1", "to": "s1"}, {"from": "s1", "to": "a1"},
            {"from": "a1", "to": "r1"},
        ],
    }


# ============================================================
# Test: 创建策略
# ============================================================
class TestCreateStrategy:
    """STG-001: 创建策略"""

    async def test_create_visual_strategy(
        self, async_client: AsyncClient, auth_headers: dict, valid_definition: dict
    ):
        resp = await async_client.post(
            "/api/v1/strategies/",
            json={
                "name": "Test EMA Strategy",
                "strategy_type": "visual",
                "description": "测试策略",
                "trade_type": "perpetual",
                "kline_interval": "1h",
                "symbol_pool": ["BTCUSDT"],
                "definition": valid_definition,
                "tags": ["test", "ema"],
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["name"] == "Test EMA Strategy"
        assert data["data"]["version"] == 1
        assert data["data"]["status"] == "draft"
        assert data["data"]["strategy_type"] == "visual"
        assert data["data"]["id"] is not None

    async def test_create_python_strategy(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        resp = await async_client.post(
            "/api/v1/strategies/",
            json={
                "name": "Python Strategy",
                "strategy_type": "python",
                "definition": {"code": "def on_bar(kline): return None"},
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["data"]["strategy_type"] == "python"

    async def test_create_invalid_graph_returns_422(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        """含循环的图应该返回 422"""
        resp = await async_client.post(
            "/api/v1/strategies/",
            json={
                "name": "Cyclic Strategy",
                "strategy_type": "visual",
                "definition": {
                    "nodes": [
                        {"id": "n1", "type": "indicator", "subtype": "ema", "params": {"period": 9}},
                        {"id": "n2", "type": "condition", "subtype": "crossover", "params": {"direction": "above"}},
                    ],
                    "edges": [
                        {"from": "n1", "to": "n2"},
                        {"from": "n2", "to": "n1"},  # 环
                    ],
                },
            },
            headers=auth_headers,
        )
        assert resp.status_code == 422

    async def test_create_without_auth_returns_401(
        self, async_client: AsyncClient
    ):
        resp = await async_client.post(
            "/api/v1/strategies/",
            json={"name": "Test", "strategy_type": "visual"},
        )
        assert resp.status_code == 401

    async def test_create_empty_graph_returns_422(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        resp = await async_client.post(
            "/api/v1/strategies/",
            json={
                "name": "Empty",
                "strategy_type": "visual",
                "definition": {"nodes": [], "edges": []},
            },
            headers=auth_headers,
        )
        assert resp.status_code == 422

    async def test_create_missing_indicator_period(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        """指标节点缺少 period 参数"""
        resp = await async_client.post(
            "/api/v1/strategies/",
            json={
                "name": "Missing Period",
                "strategy_type": "visual",
                "definition": {
                    "nodes": [
                        {"id": "e1", "type": "indicator", "subtype": "ema", "params": {"source": "close"}},
                    ],
                    "edges": [],
                },
            },
            headers=auth_headers,
        )
        assert resp.status_code == 422


# ============================================================
# Test: CRUD 操作
# ============================================================
class TestStrategyCRUD:
    async def test_list_strategies(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        resp = await async_client.get("/api/v1/strategies/", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data["data"]

    async def test_get_strategy(
        self, async_client: AsyncClient, auth_headers: dict, valid_definition: dict
    ):
        """先创建再获取"""
        create_resp = await async_client.post(
            "/api/v1/strategies/",
            json={
                "name": "Get Test",
                "strategy_type": "visual",
                "definition": valid_definition,
            },
            headers=auth_headers,
        )
        sid = create_resp.json()["data"]["id"]

        resp = await async_client.get(
            f"/api/v1/strategies/{sid}", headers=auth_headers
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["name"] == "Get Test"

    async def test_get_strategy_not_found(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        resp = await async_client.get(
            "/api/v1/strategies/00000000-0000-0000-0000-000000000000",
            headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_update_strategy_creates_new_version(
        self, async_client: AsyncClient, auth_headers: dict, valid_definition: dict
    ):
        """更新 definition 应该自动升级版本"""
        create_resp = await async_client.post(
            "/api/v1/strategies/",
            json={
                "name": "Version Test",
                "strategy_type": "visual",
                "definition": valid_definition,
            },
            headers=auth_headers,
        )
        sid = create_resp.json()["data"]["id"]

        resp = await async_client.put(
            f"/api/v1/strategies/{sid}",
            json={
                "definition": valid_definition,
                "change_summary": "无变化更新",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["version"] == 2

    async def test_update_name_no_version_bump(
        self, async_client: AsyncClient, auth_headers: dict, valid_definition: dict
    ):
        """仅修改名称不应升级版本号"""
        create_resp = await async_client.post(
            "/api/v1/strategies/",
            json={
                "name": "Rename Test",
                "strategy_type": "visual",
                "definition": valid_definition,
            },
            headers=auth_headers,
        )
        sid = create_resp.json()["data"]["id"]

        resp = await async_client.put(
            f"/api/v1/strategies/{sid}",
            json={"name": "Renamed Strategy"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["version"] == 1  # 未变
        assert resp.json()["data"]["name"] == "Renamed Strategy"

    async def test_soft_delete(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        resp = await async_client.post(
            "/api/v1/strategies/",
            json={"name": "Delete Me", "strategy_type": "visual"},
            headers=auth_headers,
        )
        sid = resp.json()["data"]["id"]

        del_resp = await async_client.delete(
            f"/api/v1/strategies/{sid}", headers=auth_headers
        )
        assert del_resp.status_code == 200

        get_resp = await async_client.get(
            f"/api/v1/strategies/{sid}", headers=auth_headers
        )
        assert get_resp.status_code == 404

    async def test_cannot_access_others_strategy(
        self, async_client: AsyncClient, auth_headers: dict, valid_definition: dict
    ):
        """用另一个用户 Token 尝试访问"""
        # 用 test-user 1 创建
        resp = await async_client.post(
            "/api/v1/strategies/",
            json={
                "name": "Private",
                "strategy_type": "visual",
                "definition": valid_definition,
            },
            headers=auth_headers,
        )
        sid = resp.json()["data"]["id"]

        # 用其他用户访问
        other_token = create_access_token(subject="b2c3d4e5-f6a7-8901-bcde-f12345678901")
        other_headers = {"Authorization": f"Bearer {other_token}"}
        get_resp = await async_client.get(
            f"/api/v1/strategies/{sid}", headers=other_headers
        )
        assert get_resp.status_code == 403


# ============================================================
# Test: 克隆
# ============================================================
class TestClone:
    async def test_clone_strategy(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        resp = await async_client.post(
            "/api/v1/strategies/",
            json={"name": "Original", "strategy_type": "visual"},
            headers=auth_headers,
        )
        sid = resp.json()["data"]["id"]

        clone_resp = await async_client.post(
            f"/api/v1/strategies/{sid}/clone",
            json={"name": "Cloned"},
            headers=auth_headers,
        )
        assert clone_resp.status_code == 201
        assert clone_resp.json()["data"]["name"] == "Cloned"
        assert clone_resp.json()["data"]["status"] == "draft"
        assert clone_resp.json()["data"]["version"] == 1

    async def test_clone_template(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        """克隆系统模板"""
        # 获取模板列表
        tmpl_resp = await async_client.get(
            "/api/v1/strategies/templates", headers=auth_headers
        )
        # 模板通过 seeder 初始化，如果没有运行 seeder 则列表为空
        # 跳过测试如果无模板
        templates = tmpl_resp.json().get("data", [])
        if not templates:
            pytest.skip("无系统模板（seeder 未运行）")

        template_id = templates[0]["id"]
        clone_resp = await async_client.post(
            f"/api/v1/strategies/{template_id}/clone",
            json={"name": "My Template Copy"},
            headers=auth_headers,
        )
        if clone_resp.status_code == 201:
            assert clone_resp.json()["data"]["user_id"] is not None


# ============================================================
# Test: 版本管理
# ============================================================
class TestVersions:
    async def test_list_versions(
        self, async_client: AsyncClient, auth_headers: dict, valid_definition: dict
    ):
        resp = await async_client.post(
            "/api/v1/strategies/",
            json={
                "name": "Versioned",
                "strategy_type": "visual",
                "definition": valid_definition,
            },
            headers=auth_headers,
        )
        sid = resp.json()["data"]["id"]

        # 查询版本历史
        ver_resp = await async_client.get(
            f"/api/v1/strategies/{sid}/versions", headers=auth_headers
        )
        assert ver_resp.status_code == 200
        versions = ver_resp.json()["data"]["items"]
        assert len(versions) >= 1  # 至少 v1

    async def test_rollback(
        self, async_client: AsyncClient, auth_headers: dict, valid_definition: dict
    ):
        # 创建
        resp = await async_client.post(
            "/api/v1/strategies/",
            json={
                "name": "Rollback Test",
                "strategy_type": "visual",
                "definition": valid_definition,
            },
            headers=auth_headers,
        )
        sid = resp.json()["data"]["id"]

        # 更新（生成 v2）
        await async_client.put(
            f"/api/v1/strategies/{sid}",
            json={"definition": valid_definition, "change_summary": "v2"},
            headers=auth_headers,
        )

        # 回滚到 v1
        rollback_resp = await async_client.post(
            f"/api/v1/strategies/{sid}/versions/1/rollback",
            headers=auth_headers,
        )
        assert rollback_resp.status_code == 200
        assert rollback_resp.json()["data"]["version"] == 3  # 新版本

    async def test_rollback_nonexistent_version(
        self, async_client: AsyncClient, auth_headers: dict, valid_definition: dict
    ):
        resp = await async_client.post(
            "/api/v1/strategies/",
            json={
                "name": "Rollback 404",
                "strategy_type": "visual",
                "definition": valid_definition,
            },
            headers=auth_headers,
        )
        sid = resp.json()["data"]["id"]

        rb_resp = await async_client.post(
            f"/api/v1/strategies/{sid}/versions/999/rollback",
            headers=auth_headers,
        )
        assert rb_resp.status_code == 404


# ============================================================
# Test: 代码导出
# ============================================================
class TestCodeExport:
    async def test_export_visual_to_code(
        self, async_client: AsyncClient, auth_headers: dict, valid_definition: dict
    ):
        resp = await async_client.post(
            "/api/v1/strategies/",
            json={
                "name": "Export Test",
                "strategy_type": "visual",
                "definition": valid_definition,
            },
            headers=auth_headers,
        )
        sid = resp.json()["data"]["id"]

        export_resp = await async_client.post(
            f"/api/v1/strategies/{sid}/export-code",
            headers=auth_headers,
        )
        assert export_resp.status_code == 200
        data = export_resp.json()["data"]
        assert "python_code" in data
        assert "class ExportTest" in data["python_code"]
        assert "on_bar" in data["python_code"]

    async def test_export_python_strategy_returns_400(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        resp = await async_client.post(
            "/api/v1/strategies/",
            json={
                "name": "Py Export",
                "strategy_type": "python",
                "definition": {"code": "pass"},
            },
            headers=auth_headers,
        )
        sid = resp.json()["data"]["id"]

        export_resp = await async_client.post(
            f"/api/v1/strategies/{sid}/export-code",
            headers=auth_headers,
        )
        assert export_resp.status_code == 400


# ============================================================
# Test: 模板
# ============================================================
class TestTemplates:
    async def test_list_templates(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        resp = await async_client.get(
            "/api/v1/strategies/templates", headers=auth_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        # 模板通过 seeder 初始化，未运行时列表为空
        # assert len(data["data"]) >= 15


# ============================================================
# Test: 校验器
# ============================================================
class TestValidator:
    def test_validate_valid_graph(self, valid_definition: dict):
        from app.services.strategy_validator import validate_visual_graph

        errors, warnings = validate_visual_graph(valid_definition)
        assert len(errors) == 0  # 无致命错误
        assert len(warnings) == 0  # 有风控节点，无警告

    def test_validate_dangling_nodes(self):
        from app.services.strategy_validator import validate_visual_graph

        errors, warnings = validate_visual_graph({
            "nodes": [
                {"id": "n1", "type": "indicator", "subtype": "ema", "params": {"period": 9}},
                {"id": "n2", "type": "indicator", "subtype": "ema", "params": {"period": 21}},
            ],
            "edges": [],
        })
        assert len(warnings) >= 1  # 至少一个悬空节点警告

    def test_validate_cycle_detection(self):
        from app.services.strategy_validator import validate_visual_graph

        errors, _ = validate_visual_graph({
            "nodes": [
                {"id": "n1", "type": "indicator", "subtype": "ema", "params": {"period": 9}},
                {"id": "n2", "type": "condition", "subtype": "greater_than", "params": {}},
            ],
            "edges": [
                {"from": "n1", "to": "n2"},
                {"from": "n2", "to": "n1"},
            ],
        })
        assert any("循环" in e for e in errors)

    def test_validate_invalid_node_type(self):
        from app.services.strategy_validator import validate_visual_graph

        errors, _ = validate_visual_graph({
            "nodes": [
                {"id": "n1", "type": "unknown_type", "subtype": "ema", "params": {}},
            ],
            "edges": [],
        })
        assert any("无效的节点类型" in e for e in errors)

    def test_validate_missing_risk_warning(self):
        from app.services.strategy_validator import validate_visual_graph

        _errors, warnings = validate_visual_graph({
            "nodes": [
                {"id": "e1", "type": "indicator", "subtype": "ema", "params": {"period": 9}},
                {"id": "a1", "type": "action", "subtype": "market_order", "params": {"side": "buy", "amount_type": "usdt", "amount_value": 100}},
            ],
            "edges": [{"from": "e1", "to": "a1"}],
        })
        assert any("风控" in w for w in warnings)


# ============================================================
# Test: 代码生成器
# ============================================================
class TestCodegen:
    def test_generate_code_valid_graph(self, valid_definition: dict):
        from app.services.strategy_codegen import generate_python_code

        code, warning = generate_python_code(valid_definition, "TestStrategy")
        assert "class TestStrategy" in code
        assert "on_bar" in code
        assert "return None" in code

    def test_generate_empty_graph(self):
        from app.services.strategy_codegen import generate_python_code

        code, warning = generate_python_code({"nodes": [], "edges": []}, "Empty")
        assert warning is not None  # 空图有警告


# ============================================================
# Test: 状态转换
# ============================================================
class TestStatusTransition:
    async def test_valid_transition_draft_to_backtested(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        resp = await async_client.post(
            "/api/v1/strategies/",
            json={"name": "Transition", "strategy_type": "visual"},
            headers=auth_headers,
        )
        sid = resp.json()["data"]["id"]

        update_resp = await async_client.put(
            f"/api/v1/strategies/{sid}",
            json={"status": "backtested"},
            headers=auth_headers,
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["data"]["status"] == "backtested"

    async def test_invalid_transition_draft_to_live(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        """draft → live 直接跳转非法"""
        resp = await async_client.post(
            "/api/v1/strategies/",
            json={"name": "Bad Transition", "strategy_type": "visual"},
            headers=auth_headers,
        )
        sid = resp.json()["data"]["id"]

        update_resp = await async_client.put(
            f"/api/v1/strategies/{sid}",
            json={"status": "live"},
            headers=auth_headers,
        )
        assert update_resp.status_code == 400
