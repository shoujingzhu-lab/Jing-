"""
策略代码生成器
==============
STG-014: 将可视化策略节点图转换为可执行 Python 代码。
"""

from typing import Any, Optional

# ============================================================
# 节点 → Python 代码发射器
# ============================================================
# 每个指标子类型对应一个代码生成函数，返回 (code, needs_helper)
_INDICATOR_EMITTERS: dict[str, callable] = {}


def _register_indicator(*subtypes: str):
    """装饰器：注册指标代码生成器"""
    def decorator(fn):
        for st in subtypes:
            _INDICATOR_EMITTERS[st] = fn
        return fn
    return decorator


@_register_indicator("sma")
def _emit_sma(node_id: str, params: dict) -> str:
    period = params.get("period", 14)
    source = params.get("source", "close")
    return (
        f"        # SMA({period}) on {source}\n"
        f"        {node_id}_series = pd.Series(klines['{source}']).rolling(window={period}).mean()\n"
        f"        {node_id} = float({node_id}_series.iloc[-1]) if len({node_id}_series) > 0 else 0.0"
    )


@_register_indicator("ema")
def _emit_ema(node_id: str, params: dict) -> str:
    period = params.get("period", 9)
    source = params.get("source", "close")
    return (
        f"        # EMA({period}) on {source}\n"
        f"        {node_id}_series = pd.Series(klines['{source}']).ewm(span={period}, adjust=False).mean()\n"
        f"        {node_id} = float({node_id}_series.iloc[-1]) if len({node_id}_series) > 0 else 0.0"
    )


@_register_indicator("rsi")
def _emit_rsi(node_id: str, params: dict) -> str:
    period = params.get("period", 14)
    source = params.get("source", "close")
    return (
        f"        # RSI({period}) on {source}\n"
        f"        {node_id} = _compute_rsi(pd.Series(klines['{source}']), {period})"
    )


@_register_indicator("macd")
def _emit_macd(node_id: str, params: dict) -> str:
    fast = params.get("fast", 12)
    slow = params.get("slow", 26)
    signal = params.get("signal", 9)
    source = params.get("source", "close")
    return (
        f"        # MACD({fast},{slow},{signal}) on {source}\n"
        f"        {node_id}_macd, {node_id}_signal, {node_id}_hist = "
        f"_compute_macd(pd.Series(klines['{source}']), {fast}, {slow}, {signal})"
    )


@_register_indicator("bollinger_bands")
def _emit_bb(node_id: str, params: dict) -> str:
    period = params.get("period", 20)
    stddev = params.get("stddev", 2)
    source = params.get("source", "close")
    return (
        f"        # Bollinger Bands({period},{stddev}) on {source}\n"
        f"        {node_id}_ma = pd.Series(klines['{source}']).rolling(window={period}).mean()\n"
        f"        {node_id}_std = pd.Series(klines['{source}']).rolling(window={period}).std()\n"
        f"        {node_id}_upper = float(({node_id}_ma + {stddev} * {node_id}_std).iloc[-1])\n"
        f"        {node_id}_middle = float({node_id}_ma.iloc[-1])\n"
        f"        {node_id}_lower = float(({node_id}_ma - {stddev} * {node_id}_std).iloc[-1])"
    )


@_register_indicator("atr")
def _emit_atr(node_id: str, params: dict) -> str:
    period = params.get("period", 14)
    return (
        f"        # ATR({period})\n"
        f"        {node_id} = _compute_atr(klines, {period})"
    )


@_register_indicator("donchian_channel")
def _emit_donchian(node_id: str, params: dict) -> str:
    period = params.get("period", 20)
    return (
        f"        # Donchian Channel({period})\n"
        f"        highs = pd.Series(klines['high'])\n"
        f"        lows = pd.Series(klines['low'])\n"
        f"        {node_id}_upper = float(highs.rolling(window={period}).max().iloc[-1])\n"
        f"        {node_id}_lower = float(lows.rolling(window={period}).min().iloc[-1])"
    )


@_register_indicator("vwap")
def _emit_vwap(node_id: str, params: dict) -> str:
    return (
        f"        # VWAP\n"
        f"        {node_id} = _compute_vwap(klines)"
    )


@_register_indicator("kdj", "cci", "adx")
def _emit_generic_series(node_id: str, params: dict) -> str:
    """通用单值指标发射器"""
    period = params.get("period", 14)
    source = params.get("source", "close")
    return (
        f"        # Indicator: generic({source}, period={period})\n"
        f"        {node_id} = _compute_indicator(klines, '{source}', {period})"
    )


@_register_indicator("stoch_rsi", "williams_r", "mfi", "ppo", "trix")
def _emit_momentum(node_id: str, params: dict) -> str:
    """动量类指标发射器"""
    period = params.get("period", 14)
    source = params.get("source", "close")
    return (
        f"        # Momentum indicator({period}) on {source}\n"
        f"        {node_id} = _compute_momentum(klines, '{source}', {period})"
    )


@_register_indicator("keltner_channel")
def _emit_keltner(node_id: str, params: dict) -> str:
    period = params.get("period", 20)
    mult = params.get("multiplier", 2.0)
    return (
        f"        # Keltner Channel({period}, {mult})\n"
        f"        {node_id}_middle = float(pd.Series(klines['close']).ewm(span={period}).mean().iloc[-1])\n"
        f"        {node_id}_upper = {node_id}_middle + {mult} * _compute_atr(klines, {period})\n"
        f"        {node_id}_lower = {node_id}_middle - {mult} * _compute_atr(klines, {period})"
    )


@_register_indicator("obv", "cmf", "force_index", "eom")
def _emit_volume(node_id: str, params: dict) -> str:
    """成交量类指标发射器"""
    period = params.get("period", 14)
    return (
        f"        # Volume indicator({period})\n"
        f"        {node_id} = _compute_volume_indicator(klines, {period})"
    )


@_register_indicator("linear_regression_slope", "z_score", "correlation", "historical_volatility")
def _emit_statistical(node_id: str, params: dict) -> str:
    """统计类指标发射器"""
    period = params.get("period", 20)
    source = params.get("source", "close")
    return (
        f"        # Statistical indicator({period}) on {source}\n"
        f"        {node_id} = _compute_stat(klines, '{source}', {period})"
    )


def _emit_generic_indicator(node_id: str, subtype: str, params: dict) -> str:
    """未实现具体发射器的指标（兜底）"""
    period = params.get("period", 14)
    source = params.get("source", "close")
    return (
        f"        # {subtype}({source}, period={period})\n"
        f"        {node_id} = _compute_{subtype}(klines, '{source}', {period})"
    )


# ============================================================
# 拓扑排序
# ============================================================
def _topological_sort(
    nodes: list[dict], edges: list[dict]
) -> list[str]:
    """Kahn 算法拓扑排序，返回节点 ID 执行顺序"""
    node_ids = [n["id"] for n in nodes]
    in_degree = {nid: 0 for nid in node_ids}
    adjacency: dict[str, list[str]] = {nid: [] for nid in node_ids}

    for edge in edges:
        src, tgt = edge.get("from", ""), edge.get("to", "")
        if src in adjacency and tgt in node_ids:
            adjacency[src].append(tgt)
            in_degree[tgt] = in_degree.get(tgt, 0) + 1

    queue = [nid for nid, deg in in_degree.items() if deg == 0]
    result = []

    while queue:
        nid = queue.pop(0)
        result.append(nid)
        for neighbor in adjacency.get(nid, []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    # 如果有环，补上剩余节点
    remaining = [nid for nid in node_ids if nid not in result]
    result.extend(remaining)
    return result


# ============================================================
# 主代码生成函数
# ============================================================
def generate_python_code(
    definition: dict[str, Any], name: str = "GeneratedStrategy"
) -> tuple[str, Optional[str]]:
    """将可视化策略定义转换为 Python 代码。

    Args:
        definition: 节点图 JSON {"nodes": [...], "edges": [...]}
        name: 生成的策略类名

    Returns:
        (python_code, warning_or_none)
    """
    nodes = definition.get("nodes", [])
    edges = definition.get("edges", [])
    warnings: list[str] = []

    if not nodes:
        return "# Empty strategy — no nodes defined\n", "策略没有节点"

    node_map = {n["id"]: n for n in nodes}
    execution_order = _topological_sort(nodes, edges)

    lines: list[str] = []
    helper_needed: set[str] = set()

    # === 模块头 ===
    lines.append(f'"""')
    lines.append(f"Generated Strategy: {name}")
    lines.append(f"Auto-generated from visual strategy editor.")
    lines.append(f"Nodes: {len(nodes)} | Edges: {len(edges)}")
    lines.append(f'"""')
    lines.append("")
    lines.append("import numpy as np")
    lines.append("import pandas as pd")
    lines.append("from typing import Optional, Dict, Any")
    lines.append("from app.engine import BaseStrategy")
    lines.append("")
    lines.append("")

    # === 辅助函数 ===
    if any(
        node_map.get(nid, {}).get("subtype") == "rsi"
        for nid in execution_order
    ):
        helper_needed.add("rsi")
        lines.append("def _compute_rsi(series: pd.Series, period: int = 14) -> float:")
        lines.append('    """计算 RSI 指标"""')
        lines.append("    delta = series.diff()")
        lines.append("    gain = delta.clip(lower=0).rolling(window=period).mean()")
        lines.append("    loss = (-delta.clip(upper=0)).rolling(window=period).mean()")
        lines.append("    rs = gain / loss.replace(0, 1e-10)")
        lines.append("    rsi = 100 - (100 / (1 + rs))")
        lines.append("    return float(rsi.iloc[-1]) if len(rsi) > 0 else 50.0")
        lines.append("")
        lines.append("")

    if any(
        node_map.get(nid, {}).get("subtype") == "macd"
        for nid in execution_order
    ):
        helper_needed.add("macd")
        lines.append("def _compute_macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):")
        lines.append('    """计算 MACD 指标，返回 (macd, signal_line, histogram)"""')
        lines.append("    ema_fast = series.ewm(span=fast, adjust=False).mean()")
        lines.append("    ema_slow = series.ewm(span=slow, adjust=False).mean()")
        lines.append("    macd_line = ema_fast - ema_slow")
        lines.append("    signal_line = macd_line.ewm(span=signal, adjust=False).mean()")
        lines.append("    histogram = macd_line - signal_line")
        lines.append("    return float(macd_line.iloc[-1]), float(signal_line.iloc[-1]), float(histogram.iloc[-1])")
        lines.append("")
        lines.append("")

    if any(
        node_map.get(nid, {}).get("subtype") == "atr"
        for nid in execution_order
    ):
        helper_needed.add("atr")
        lines.append("def _compute_atr(klines: dict, period: int = 14) -> float:")
        lines.append('    """计算 ATR 指标"""')
        lines.append("    high = pd.Series(klines['high'])")
        lines.append("    low = pd.Series(klines['low'])")
        lines.append("    close = pd.Series(klines['close'])")
        lines.append("    tr = pd.concat([")
        lines.append("        (high - low).abs(),")
        lines.append("        (high - close.shift()).abs(),")
        lines.append("        (low - close.shift()).abs(),")
        lines.append("    ], axis=1).max(axis=1)")
        lines.append("    atr = tr.rolling(window=period).mean()")
        lines.append("    return float(atr.iloc[-1]) if len(atr) > 0 else 0.0")
        lines.append("")
        lines.append("")

    if any(
        node_map.get(nid, {}).get("subtype") == "vwap"
        for nid in execution_order
    ):
        helper_needed.add("vwap")
        lines.append("def _compute_vwap(klines: dict) -> float:")
        lines.append('    """计算 VWAP 指标"""')
        lines.append("    typical = (pd.Series(klines['high']) + pd.Series(klines['low']) + pd.Series(klines['close'])) / 3")
        lines.append("    volume = pd.Series(klines['volume'])")
        lines.append("    vwap = (typical * volume).cumsum() / volume.cumsum()")
        lines.append("    return float(vwap.iloc[-1]) if len(vwap) > 0 else 0.0")
        lines.append("")
        lines.append("")

    # === 策略类 ===
    lines.append(f"class {name}(BaseStrategy):")
    lines.append(f'    """')
    lines.append(f"    Visual strategy converted to Python code.")
    lines.append(f"    Generated from visual editor node graph.")
    lines.append(f'    """')
    lines.append("")
    lines.append("    def __init__(self, config: dict):")
    lines.append("        super().__init__(config)")
    lines.append("        self._prev_values: Dict[str, Any] = {}")
    lines.append("")

    # === on_bar 方法 ===
    lines.append("    def on_bar(self, klines: dict) -> Optional[dict]:")
    lines.append('        """Evaluates the strategy graph on each bar."""')
    lines.append("")

    # 声明条件/信号变量
    signal_nodes = [nid for nid in execution_order if node_map.get(nid, {}).get("type") == "signal"]
    for nid in signal_nodes:
        lines.append(f"        {nid}_trigger = False")

    has_actions = any(node_map.get(nid, {}).get("type") == "action" for nid in execution_order)
    lines.append("")

    # 按拓扑序发射每个节点代码
    for nid in execution_order:
        node = node_map.get(nid)
        if node is None:
            continue

        node_type = node.get("type", "")
        subtype = node.get("subtype", "")
        params = node.get("params", {})

        # 获取上游连接
        upstream = [e["from"] for e in edges if e.get("to") == nid]

        if node_type == "indicator":
            emitter = _INDICATOR_EMITTERS.get(subtype)
            if emitter:
                lines.append(emitter(nid, params))
            else:
                code = _emit_generic_indicator(nid, subtype, params)
                lines.append(code)
                warnings.append(f"节点 '{nid}': 指标 '{subtype}' 的代码生成尚未实现，已生成占位符")

        elif node_type == "condition":
            if len(upstream) >= 2:
                a, b = upstream[0], upstream[1]
                if subtype == "crossover":
                    direction = params.get("direction", "above")
                    if direction == "above":
                        lines.append(f"        # Crossover: {a} crosses above {b}")
                        lines.append(f"        {a}_prev = self._prev_values.get('{a}', {a})")
                        lines.append(f"        {nid} = ({a}_prev <= {b} and {a} > {b})")
                    else:
                        lines.append(f"        # Crossunder: {a} crosses below {b}")
                        lines.append(f"        {a}_prev = self._prev_values.get('{a}', {a})")
                        lines.append(f"        {nid} = ({a}_prev >= {b} and {a} < {b})")
                elif subtype == "greater_than":
                    lines.append(f"        # {a} > {b}")
                    lines.append(f"        {nid} = ({a} > {b})")
                elif subtype == "less_than":
                    lines.append(f"        # {a} < {b}")
                    lines.append(f"        {nid} = ({a} < {b})")
                else:
                    lines.append(f"        # Condition: {subtype} (not fully implemented)")
                    lines.append(f"        {nid} = False")
                    warnings.append(f"节点 '{nid}': 条件 '{subtype}' 仅部分支持")
            else:
                lines.append(f"        # Condition {subtype}: insufficient inputs (need 2, got {len(upstream)})")
                lines.append(f"        {nid} = False")

        elif node_type == "signal":
            logic = params.get("logic", "and")
            if upstream:
                if logic == "and":
                    conds = " and ".join(upstream)
                    lines.append(f"        # Signal: ALL of [{', '.join(upstream)}]")
                    lines.append(f"        {nid}_trigger = ({conds})")
                elif logic == "or":
                    conds = " or ".join(upstream)
                    lines.append(f"        # Signal: ANY of [{', '.join(upstream)}]")
                    lines.append(f"        {nid}_trigger = ({conds})")
                elif logic == "weighted":
                    weight = params.get("weight", 1.0)
                    lines.append(f"        # Signal: Weighted score")
                    lines.append(f"        {nid}_score = sum({weight} * int({inp}) for inp in {upstream})")
                    lines.append(f"        {nid}_trigger = ({nid}_score >= {params.get('threshold', 1.0)})")
                else:
                    lines.append(f"        {nid}_trigger = any({upstream})")
            else:
                lines.append(f"        {nid}_trigger = False")

        elif node_type == "action":
            side = params.get("side", "buy")
            amount_type = params.get("amount_type", "usdt")
            amount_value = params.get("amount_value", 100)
            # 找到上游信号节点
            signal_upstream = [
                u for u in upstream
                if node_map.get(u, {}).get("type") == "signal"
            ]
            if signal_upstream:
                trigger_var = f"{signal_upstream[0]}_trigger"
                lines.append(f"        # Action: {subtype} {side}")
                lines.append(f"        if {trigger_var}:")
                lines.append(f"            return {{")
                lines.append(f'                "action": "{side}",')
                lines.append(f'                "order_type": "{subtype}",')
                lines.append(f'                "amount_type": "{amount_type}",')
                lines.append(f"                \"amount\": {amount_value},")
                if subtype == "limit_order" and params.get("price"):
                    lines.append(f'                "price": {params["price"]},')
                lines.append(f"            }}")
            else:
                lines.append(f"        # Action {subtype}: no signal input connected")

        elif node_type == "risk_control":
            # 风控节点在动作之后应用
            if subtype == "stop_loss":
                sl_val = params.get("value", 0.05)
                sl_type = params.get("type", "percent")
                lines.append(f"        # Risk: Stop-Loss ({sl_type}: {sl_val})")
                lines.append(f"        # Applied to the returned order")
            elif subtype == "take_profit":
                tp_val = params.get("value", 0.15)
                lines.append(f"        # Risk: Take-Profit (percent: {tp_val})")
            elif subtype == "trailing_stop":
                ts_val = params.get("value", 0.03)
                lines.append(f"        # Risk: Trailing Stop ({ts_val})")

    # === 保存前值用于交叉检测 ===
    lines.append("")
    lines.append("        # Save current values for next bar's crossover detection")
    for nid in execution_order:
        node = node_map.get(nid, {})
        if node.get("type") == "indicator":
            lines.append(f"        self._prev_values['{nid}'] = {nid}")

    # === 默认返回 ===
    if not has_actions:
        lines.append("")
        lines.append("        # No action nodes in graph")
        lines.append("        return None")
    else:
        lines.append("")
        lines.append("        return None")

    warning = "; ".join(warnings) if warnings else None
    return "\n".join(lines), warning
