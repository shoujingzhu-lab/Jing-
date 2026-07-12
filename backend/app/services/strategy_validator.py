"""
策略图验证器
============
STG-008: 保存前自动检查节点图的结构完整性。
"""

from typing import Any

# ============================================================
# 合法节点类型与子类型定义
# ============================================================
VALID_NODE_TYPES: dict[str, set[str]] = {
    "indicator": {
        # 趋势指标
        "sma", "ema", "wma", "hma",
        "macd", "ichimoku", "parabolic_sar",
        # 震荡指标
        "rsi", "stoch_rsi", "kdj", "cci", "williams_r",
        # 波动指标
        "bollinger_bands", "atr", "keltner_channels", "donchian_channel",
        # 成交量
        "obv", "volume_profile", "cvd", "vwap", "volume_ratio",
        # 订单簿
        "orderbook_imbalance", "bid_ask_depth_ratio", "large_order_detection",
        "spread_ratio",
        # 衍生品
        "funding_rate_direction", "oi_change_rate", "long_short_ratio",
        "contract_premium",
    },
    "condition": {
        "crossover", "crossunder",
        "greater_than", "less_than", "equal_to",
        "between", "outside",
        "rising", "falling",
        "changed_percent",
    },
    "signal": {
        "long_entry", "short_entry",
        "close_long", "close_short", "close_all",
        "wait",
        "weighted_score", "weighted_score",
    },
    "action": {
        "market_order", "limit_order",
        "iceberg", "twap",
        "reduce_position",
    },
    "risk_control": {
        "stop_loss", "take_profit", "trailing_stop",
        "position_pct_cap", "max_hold_time",
        "daily_max_loss",
    },
}

# 需要 period 参数的指标
INDICATORS_REQUIRING_PERIOD = {
    "sma", "ema", "wma", "hma", "rsi", "stoch_rsi",
    "kdj", "cci", "williams_r", "bollinger_bands",
    "atr", "keltner_channels", "donchian_channel",
    "vwap", "volume_ratio",
}


def validate_visual_graph(definition: dict[str, Any]) -> tuple[list[str], list[str]]:
    """验证可视化策略节点图的完整性。

    Args:
        definition: 节点图 JSON，格式 {"nodes": [...], "edges": [...]}

    Returns:
        (errors, warnings): errors 为致命错误列表，warnings 为警告列表。
        空 errors → 校验通过。
    """
    errors: list[str] = []
    warnings: list[str] = []

    nodes = definition.get("nodes", [])
    edges = definition.get("edges", [])

    if not nodes:
        errors.append("策略必须包含至少一个节点")
        return errors, warnings

    node_ids = {n["id"] for n in nodes}
    node_map = {n["id"]: n for n in nodes}

    # ---- 1. 重复节点 ID ----
    if len(node_ids) != len(nodes):
        errors.append("检测到重复的节点 ID")

    # ---- 2. 无效节点类型/子类型 + 必填参数 ----
    for node in nodes:
        nid = node.get("id", "<?>")
        node_type = node.get("type")
        subtype = node.get("subtype")

        if node_type not in VALID_NODE_TYPES:
            errors.append(f"节点 '{nid}': 无效的节点类型 '{node_type}'")
        elif subtype not in VALID_NODE_TYPES.get(node_type, set()):
            errors.append(
                f"节点 '{nid}': 无效的子类型 '{subtype}' (类型={node_type})"
            )
        else:
            # 检查指标节点必填参数
            params = node.get("params", {})
            if node_type == "indicator" and subtype in INDICATORS_REQUIRING_PERIOD:
                if not params.get("period"):
                    errors.append(
                        f"节点 '{nid}' ({subtype}): 缺少必填参数 'period'"
                    )
            # signal 节点检查逻辑
            if node_type == "signal":
                if not params.get("logic"):
                    errors.append(
                        f"节点 '{nid}' ({subtype}): 缺少必填参数 'logic' (and/or/weighted)"
                    )
            # action 节点检查方向
            if node_type == "action":
                if not params.get("side"):
                    errors.append(
                        f"节点 '{nid}' ({subtype}): 缺少必填参数 'side' (buy/sell)"
                    )

    # ---- 3. 边引用完整性 ----
    for edge in edges:
        src = edge.get("from")
        tgt = edge.get("to")
        if src not in node_ids:
            errors.append(f"边引用了不存在的源节点 '{src}'")
        if tgt not in node_ids:
            errors.append(f"边引用了不存在的目标节点 '{tgt}'")

    # ---- 4. 悬空节点检测 ----
    if len(nodes) > 1:
        connected_nodes: set[str] = set()
        for edge in edges:
            connected_nodes.add(edge.get("from", ""))
            connected_nodes.add(edge.get("to", ""))
        for node in nodes:
            if node["id"] not in connected_nodes:
                warnings.append(
                    f"节点 '{node['id']}' ({node.get('type')}/{node.get('subtype')}) "
                    "未连接到任何其他节点"
                )

    # ---- 5. 循环检测 (Kahn 算法) ----
    in_degree: dict[str, int] = {nid: 0 for nid in node_ids}
    adjacency: dict[str, list[str]] = {nid: [] for nid in node_ids}

    for edge in edges:
        src, tgt = edge.get("from", ""), edge.get("to", "")
        if src in adjacency and tgt in node_ids:
            adjacency[src].append(tgt)
            in_degree[tgt] = in_degree.get(tgt, 0) + 1

    queue = [nid for nid, deg in in_degree.items() if deg == 0]
    sorted_count = 0

    while queue:
        nid = queue.pop(0)
        sorted_count += 1
        for neighbor in adjacency.get(nid, []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if sorted_count != len(node_ids):
        errors.append("图中存在循环引用（将导致逻辑死循环）")

    # ---- 6. 风控检查（警告） ----
    action_nodes = [n for n in nodes if n.get("type") == "action"]
    risk_nodes = [n for n in nodes if n.get("type") == "risk_control"]
    if action_nodes and not risk_nodes:
        warnings.append("策略包含交易动作但缺少风控节点，建议添加止损/止盈规则")

    return errors, warnings
