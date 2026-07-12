"""
可视化策略运行时解释器
======================
加载 JSON 节点图，按拓扑序执行各节点，生成交易信号。
用于回测和模拟交易的实时执行。
"""

from typing import Any, Optional

import numpy as np
import pandas as pd


class VisualStrategyInterpreter:
    """可视化策略图运行时解释器。

    在每个 K 线/Tick 上：
    1. 拓扑排序确定节点执行顺序
    2. 按序计算指标 → 条件 → 信号 → 动作
    3. 返回触发的订单指令
    """

    def __init__(self, definition: dict[str, Any]):
        self.nodes = definition.get("nodes", [])
        self.edges = definition.get("edges", [])
        self.node_map: dict[str, dict] = {n["id"]: n for n in self.nodes}
        self.inputs_for: dict[str, list[str]] = self._build_input_map()
        self.execution_order: list[str] = self._topological_sort()
        self._prev_results: dict[str, Any] = {}

    def _build_input_map(self) -> dict[str, list[str]]:
        """构建每个节点的输入列表"""
        inputs: dict[str, list[str]] = {n["id"]: [] for n in self.nodes}
        for edge in self.edges:
            tgt = edge.get("to", "")
            src = edge.get("from", "")
            if tgt in inputs:
                inputs[tgt].append(src)
        return inputs

    def _topological_sort(self) -> list[str]:
        """Kahn 算法拓扑排序"""
        in_degree = {n["id"]: 0 for n in self.nodes}
        adjacency: dict[str, list[str]] = {n["id"]: [] for n in self.nodes}

        for edge in self.edges:
            src, tgt = edge.get("from", ""), edge.get("to", "")
            if src in adjacency and tgt in in_degree:
                adjacency[src].append(tgt)
                in_degree[tgt] += 1

        queue = [nid for nid, deg in in_degree.items() if deg == 0]
        result = []

        while queue:
            nid = queue.pop(0)
            result.append(nid)
            for neighbor in adjacency.get(nid, []):
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        # 补上因环而落后的节点
        remaining = [
            nid for nid in self.node_map if nid not in result
        ]
        result.extend(remaining)
        return result

    def evaluate(
        self, klines: dict[str, list], prev_klines: Optional[dict[str, list]] = None
    ) -> Optional[dict]:
        """评估策略图。

        Args:
            klines: 当前 K 线数据（多根蜡烛的 OHLCV 列表）
                    e.g. {"open": [...], "high": [...], "low": [...], "close": [...], "volume": [...]}
            prev_klines: 前一个 K 线数据（用于 crossover 检测）

        Returns:
            订单指令 dict 或 None
        """
        results: dict[str, Any] = {}

        # 如果有前值，先计算前值用于 crossover
        if prev_klines:
            prev_results = self._execute_all(prev_klines)
            self._prev_results = prev_results

        results = self._execute_all(klines)

        # 找到第一个触发的动作节点
        for nid in self.execution_order:
            node = self.node_map.get(nid)
            if node and node["type"] == "action":
                action_result = results.get(nid)
                if action_result:
                    # 附加风控参数
                    return self._attach_risk_controls(action_result, results)

        return None

    def _execute_all(self, klines: dict[str, list]) -> dict[str, Any]:
        """按拓扑序执行所有节点"""
        results: dict[str, Any] = {}
        for nid in self.execution_order:
            node = self.node_map.get(nid)
            if node is None:
                continue
            inputs = [
                results.get(inp) for inp in self.inputs_for.get(nid, [])
            ]
            results[nid] = self._evaluate_node(node, inputs, klines, nid)
        return results

    def _evaluate_node(
        self,
        node: dict,
        inputs: list,
        klines: dict[str, list],
        nid: str,
    ) -> Any:
        """分发到具体类型的评估函数"""
        node_type = node["type"]
        subtype = node["subtype"]
        params = node.get("params", {})

        if node_type == "indicator":
            return self._eval_indicator(subtype, params, klines)
        elif node_type == "condition":
            return self._eval_condition(subtype, params, inputs, nid)
        elif node_type == "signal":
            return self._eval_signal(subtype, params, inputs)
        elif node_type == "action":
            return self._eval_action(subtype, params, inputs)
        elif node_type == "risk_control":
            return self._eval_risk(subtype, params)
        return None

    # ---- Indicator Evaluators ----

    def _eval_indicator(
        self, subtype: str, params: dict, klines: dict[str, list]
    ) -> Any:
        source = klines.get(params.get("source", "close"), [])

        if subtype == "sma":
            period = params.get("period", 14)
            series = pd.Series(source[-period:], dtype=float)
            return float(series.mean())

        elif subtype == "ema":
            period = params.get("period", 9)
            series = pd.Series(source, dtype=float)
            return float(series.ewm(span=period, adjust=False).mean().iloc[-1])

        elif subtype == "rsi":
            period = params.get("period", 14)
            series = pd.Series(source, dtype=float)
            delta = series.diff()
            gain = delta.clip(lower=0).rolling(window=period).mean()
            loss = (-delta.clip(upper=0)).rolling(window=period).mean()
            rs = gain / loss.replace(0, 1e-10)
            rsi = 100 - (100 / (1 + rs))
            return float(rsi.iloc[-1]) if len(rsi) > 0 else 50.0

        elif subtype == "macd":
            fast = params.get("fast", 12)
            slow = params.get("slow", 26)
            signal_p = params.get("signal", 9)
            series = pd.Series(source, dtype=float)
            ema_fast = series.ewm(span=fast, adjust=False).mean()
            ema_slow = series.ewm(span=slow, adjust=False).mean()
            macd_line = ema_fast - ema_slow
            signal_line = macd_line.ewm(span=signal_p, adjust=False).mean()
            return {
                "macd": float(macd_line.iloc[-1]),
                "signal": float(signal_line.iloc[-1]),
                "histogram": float((macd_line - signal_line).iloc[-1]),
            }

        elif subtype == "bollinger_bands":
            period = params.get("period", 20)
            stddev = params.get("stddev", 2)
            series = pd.Series(source, dtype=float)
            ma = series.rolling(window=period).mean()
            std = series.rolling(window=period).std()
            return {
                "upper": float((ma + stddev * std).iloc[-1]),
                "middle": float(ma.iloc[-1]),
                "lower": float((ma - stddev * std).iloc[-1]),
            }

        elif subtype == "atr":
            period = params.get("period", 14)
            high = pd.Series(klines.get("high", []), dtype=float)
            low = pd.Series(klines.get("low", []), dtype=float)
            close = pd.Series(klines.get("close", []), dtype=float)
            tr = pd.concat(
                [
                    (high - low).abs(),
                    (high - close.shift()).abs(),
                    (low - close.shift()).abs(),
                ],
                axis=1,
            ).max(axis=1)
            atr = tr.rolling(window=period).mean()
            return float(atr.iloc[-1]) if len(atr) > 0 else 0.0

        elif subtype == "donchian_channel":
            period = params.get("period", 20)
            highs = pd.Series(klines.get("high", []), dtype=float)
            lows = pd.Series(klines.get("low", []), dtype=float)
            return {
                "upper": float(highs.rolling(window=period).max().iloc[-1]),
                "lower": float(lows.rolling(window=period).min().iloc[-1]),
            }

        elif subtype == "volume_ratio":
            period = params.get("period", 20)
            volumes = pd.Series(klines.get("volume", []), dtype=float)
            avg_vol = volumes.rolling(window=period).mean().iloc[-1]
            current_vol = volumes.iloc[-1]
            return float(current_vol / avg_vol) if avg_vol > 0 else 1.0

        elif subtype == "vwap":
            high = pd.Series(klines.get("high", []), dtype=float)
            low = pd.Series(klines.get("low", []), dtype=float)
            close = pd.Series(klines.get("close", []), dtype=float)
            volume = pd.Series(klines.get("volume", []), dtype=float)
            typical = (high + low + close) / 3
            vwap_val = (typical * volume).cumsum() / volume.cumsum()
            return float(vwap_val.iloc[-1]) if len(vwap_val) > 0 else 0.0

        # ================================================================
        # 趋势类指标
        # ================================================================

        elif subtype == "kdj":
            # KDJ 随机指标：K/D/J 三线
            period = params.get("period", 9)
            high = pd.Series(klines.get("high", []), dtype=float)
            low = pd.Series(klines.get("low", []), dtype=float)
            close = pd.Series(klines.get("close", []), dtype=float)
            lowest = low.rolling(window=period).min()
            highest = high.rolling(window=period).max()
            rsv = (close - lowest) / (highest - lowest + 1e-10) * 100
            k = rsv.ewm(com=2, adjust=False).mean()
            d = k.ewm(com=2, adjust=False).mean()
            j = 3 * k - 2 * d
            return {"k": float(k.iloc[-1]), "d": float(d.iloc[-1]), "j": float(j.iloc[-1])}

        elif subtype == "cci":
            # 商品通道指数
            period = params.get("period", 20)
            high = pd.Series(klines.get("high", []), dtype=float)
            low = pd.Series(klines.get("low", []), dtype=float)
            close = pd.Series(klines.get("close", []), dtype=float)
            tp = (high + low + close) / 3
            sma_tp = tp.rolling(window=period).mean()
            mad = tp.rolling(window=period).apply(lambda x: (abs(x - x.mean())).mean())
            cci_val = (tp - sma_tp) / (0.015 * mad + 1e-10)
            return float(cci_val.iloc[-1])

        elif subtype == "adx":
            # 平均趋向指数
            period = params.get("period", 14)
            high = pd.Series(klines.get("high", []), dtype=float)
            low = pd.Series(klines.get("low", []), dtype=float)
            close = pd.Series(klines.get("close", []), dtype=float)
            plus_dm = high.diff().clip(lower=0)
            minus_dm = (-low.diff()).clip(lower=0)
            tr = pd.concat([(high - low), (high - close.shift()).abs(), (low - close.shift()).abs()], axis=1).max(axis=1)
            atr_14 = tr.rolling(window=period).mean()
            plus_di = 100 * (plus_dm.rolling(window=period).mean() / (atr_14 + 1e-10))
            minus_di = 100 * (minus_dm.rolling(window=period).mean() / (atr_14 + 1e-10))
            dx = (abs(plus_di - minus_di) / (plus_di + minus_di + 1e-10)) * 100
            adx_val = dx.rolling(window=period).mean()
            return float(adx_val.iloc[-1])

        elif subtype == "parabolic_sar":
            # 抛物线转向指标（简化实现）
            af_start = params.get("af_start", 0.02)
            af_step = params.get("af_step", 0.02)
            af_max = params.get("af_max", 0.20)
            high = klines.get("high", [])
            low = klines.get("low", [])
            if len(high) < 2:
                return float(high[-1]) - 1 if high else 0.0
            sar = float(low[0])
            ep = float(high[0])
            af = af_start
            trend = 1  # 1=上升, -1=下降
            for i in range(1, min(len(high), 50)):
                if trend == 1:
                    sar = min(sar + af * (ep - sar), float(low[i - 1]), float(low[i]))
                    if float(high[i]) > ep:
                        ep = float(high[i])
                        af = min(af + af_step, af_max)
                    if float(low[i]) < sar:
                        trend = -1
                        sar = ep
                        ep = float(low[i])
                        af = af_start
                else:
                    sar = max(sar + af * (ep - sar), float(high[i - 1]), float(high[i]))
                    if float(low[i]) < ep:
                        ep = float(low[i])
                        af = min(af + af_step, af_max)
                    if float(high[i]) > sar:
                        trend = 1
                        sar = ep
                        ep = float(high[i])
                        af = af_start
            return float(sar)

        elif subtype == "hma":
            # Hull 移动平均线
            period = params.get("period", 16)
            series = pd.Series(source, dtype=float)
            half = int(period / 2)
            sqrt_p = int(period ** 0.5)
            wma_half = 2 * series.rolling(window=half).mean()
            wma_full = series.rolling(window=period).mean()
            diff = wma_half - wma_full
            hma_val = diff.rolling(window=sqrt_p).mean()
            return float(hma_val.iloc[-1]) if len(hma_val) > 0 else 0.0

        # ================================================================
        # 动量类指标
        # ================================================================

        elif subtype == "stoch_rsi":
            # 随机 RSI
            period = params.get("period", 14)
            series = pd.Series(source, dtype=float)
            delta = series.diff()
            gain = delta.clip(lower=0).rolling(window=period).mean()
            loss = (-delta.clip(upper=0)).rolling(window=period).mean()
            rs = gain / (loss + 1e-10)
            rsi_vals = 100 - (100 / (1 + rs))
            rsi_min = rsi_vals.rolling(window=period).min()
            rsi_max = rsi_vals.rolling(window=period).max()
            stoch = (rsi_vals - rsi_min) / (rsi_max - rsi_min + 1e-10)
            return float(stoch.iloc[-1])

        elif subtype == "awesome_oscillator":
            # 动量震荡指标 (AO)
            high = pd.Series(klines.get("high", []), dtype=float)
            low = pd.Series(klines.get("low", []), dtype=float)
            median = (high + low) / 2
            ao = median.rolling(5).mean() - median.rolling(34).mean()
            return float(ao.iloc[-1])

        elif subtype == "williams_r":
            # 威廉 %R
            period = params.get("period", 14)
            high = pd.Series(klines.get("high", []), dtype=float)
            low = pd.Series(klines.get("low", []), dtype=float)
            close = pd.Series(klines.get("close", []), dtype=float)
            hh = high.rolling(window=period).max()
            ll = low.rolling(window=period).min()
            wr = (hh - close) / (hh - ll + 1e-10) * -100
            return float(wr.iloc[-1])

        elif subtype == "mfi":
            # 资金流量指数
            period = params.get("period", 14)
            high = pd.Series(klines.get("high", []), dtype=float)
            low = pd.Series(klines.get("low", []), dtype=float)
            close = pd.Series(klines.get("close", []), dtype=float)
            volume = pd.Series(klines.get("volume", []), dtype=float)
            tp = (high + low + close) / 3
            mf = tp * volume
            pmf = mf.where(tp.diff() > 0, 0).rolling(window=period).sum()
            nmf = mf.where(tp.diff() < 0, 0).rolling(window=period).sum()
            mfi_val = 100 - (100 / (1 + pmf / (nmf + 1e-10)))
            return float(mfi_val.iloc[-1])

        elif subtype == "ppo":
            # 价格震荡百分比
            fast = params.get("fast", 12)
            slow = params.get("slow", 26)
            series = pd.Series(source, dtype=float)
            ema_fast = series.ewm(span=fast, adjust=False).mean()
            ema_slow = series.ewm(span=slow, adjust=False).mean()
            ppo_val = (ema_fast - ema_slow) / (ema_slow + 1e-10) * 100
            signal_line = ppo_val.ewm(span=9, adjust=False).mean()
            return float(ppo_val.iloc[-1])

        elif subtype == "trix":
            # 三重指数平均
            period = params.get("period", 15)
            series = pd.Series(source, dtype=float)
            ema1 = series.ewm(span=period, adjust=False).mean()
            ema2 = ema1.ewm(span=period, adjust=False).mean()
            ema3 = ema2.ewm(span=period, adjust=False).mean()
            trix_val = ema3.pct_change() * 100
            return float(trix_val.iloc[-1])

        # ================================================================
        # 波动类指标
        # ================================================================

        elif subtype == "keltner_channel":
            # 肯特纳通道
            period = params.get("period", 20)
            multiplier = params.get("multiplier", 2.0)
            high = pd.Series(klines.get("high", []), dtype=float)
            low = pd.Series(klines.get("low", []), dtype=float)
            close = pd.Series(klines.get("close", []), dtype=float)
            tp = (high + low + close) / 3
            ema_tp = tp.ewm(span=period, adjust=False).mean()
            tr = pd.concat([(high - low), (high - close.shift()).abs(), (low - close.shift()).abs()], axis=1).max(axis=1)
            atr_k = tr.ewm(span=period, adjust=False).mean()
            return {
                "upper": float((ema_tp + multiplier * atr_k).iloc[-1]),
                "middle": float(ema_tp.iloc[-1]),
                "lower": float((ema_tp - multiplier * atr_k).iloc[-1]),
            }

        elif subtype == "historical_volatility":
            # 历史波动率（年化）
            period = params.get("period", 20)
            series = pd.Series(source, dtype=float)
            log_returns = (series / series.shift()).apply(lambda x: __import__("math").log(x))
            std = log_returns.rolling(window=period).std()
            hv = std * (365 ** 0.5)  # 年化
            return float(hv.iloc[-1])

        elif subtype == "ulcer_index":
            # 溃疡指数
            period = params.get("period", 14)
            series = pd.Series(source, dtype=float)
            peak = series.rolling(window=period).max()
            drawdown_pct = (series - peak) / (peak + 1e-10) * 100
            squared_avg = (drawdown_pct ** 2).rolling(window=period).mean()
            return float(squared_avg.iloc[-1] ** 0.5)

        # ================================================================
        # 成交量类指标
        # ================================================================

        elif subtype == "obv":
            # 能量潮
            close = pd.Series(klines.get("close", []), dtype=float)
            volume = pd.Series(klines.get("volume", []), dtype=float)
            direction = close.diff().apply(lambda x: 1 if x > 0 else (-1 if x < 0 else 0))
            obv_val = (volume * direction).cumsum()
            return float(obv_val.iloc[-1])

        elif subtype == "cmf":
            # 蔡金资金流
            period = params.get("period", 20)
            high = pd.Series(klines.get("high", []), dtype=float)
            low = pd.Series(klines.get("low", []), dtype=float)
            close = pd.Series(klines.get("close", []), dtype=float)
            volume = pd.Series(klines.get("volume", []), dtype=float)
            hl_range = high - low
            mf_multiplier = ((close - low) - (high - close)) / (hl_range + 1e-10)
            mf_volume = mf_multiplier * volume
            cmf_val = mf_volume.rolling(window=period).sum() / volume.rolling(window=period).sum()
            return float(cmf_val.iloc[-1])

        elif subtype == "force_index":
            # 强力指数
            period = params.get("period", 13)
            close = pd.Series(klines.get("close", []), dtype=float)
            volume = pd.Series(klines.get("volume", []), dtype=float)
            fi = close.diff() * volume
            fi_ema = fi.ewm(span=period, adjust=False).mean()
            return float(fi_ema.iloc[-1])

        elif subtype == "eom":
            # 容易移动指数
            period = params.get("period", 14)
            high = pd.Series(klines.get("high", []), dtype=float)
            low = pd.Series(klines.get("low", []), dtype=float)
            volume = pd.Series(klines.get("volume", []), dtype=float)
            mid_pt = (high + low) / 2
            box_ratio = volume / (high - low + 1e-10)
            eom_val = mid_pt.diff() / (box_ratio + 1e-10)
            eom_ema = eom_val.rolling(window=period).mean()
            return float(eom_ema.iloc[-1])

        # ================================================================
        # 统计类指标
        # ================================================================

        elif subtype == "linear_regression_slope":
            # 线性回归斜率
            period = params.get("period", 20)
            series = pd.Series(source, dtype=float)
            x = pd.Series(range(period), dtype=float)
            recent = series.tail(period)
            if len(recent) < period:
                return 0.0
            slope = (period * (x * recent).sum() - x.sum() * recent.sum()) / (period * (x**2).sum() - x.sum()**2 + 1e-10)
            return float(slope)

        elif subtype == "z_score":
            # Z-Score（标准化分数）
            period = params.get("period", 20)
            series = pd.Series(source, dtype=float)
            mean = series.rolling(window=period).mean()
            std = series.rolling(window=period).std()
            z = (series - mean) / (std + 1e-10)
            return float(z.iloc[-1])

        elif subtype == "correlation":
            # 滚动相关系数
            period = params.get("period", 20)
            series = pd.Series(source, dtype=float)
            shifted = series.shift(1)
            corr = series.rolling(window=period).corr(shifted)
            return float(corr.iloc[-1]) if len(corr) > period else 0.0

        # Fallback
        return 0.0

    # ---- Condition Evaluators ----

    def _eval_condition(
        self,
        subtype: str,
        params: dict,
        inputs: list,
        nid: str,
    ) -> bool:
        if len(inputs) < 2:
            return False

        a, b = inputs[0], inputs[1]

        # Extract scalar from dict outputs (like macd, bb, dc)
        a_val = self._extract_value(a, params.get("a_field", "value"))
        b_val = self._extract_value(b, params.get("b_field", "value"))

        if subtype == "crossover":
            direction = params.get("direction", "above")
            prev_a = self._prev_results.get(self.inputs_for.get(nid, [None])[0]) if self.inputs_for.get(nid) else a_val
            prev_a_val = self._extract_value(prev_a, params.get("a_field", "value")) if prev_a is not None else a_val
            if direction == "above":
                return bool(prev_a_val is not None and a_val is not None and prev_a_val <= b_val and a_val > b_val)
            else:
                return bool(prev_a_val is not None and a_val is not None and prev_a_val >= b_val and a_val < b_val)

        elif subtype == "greater_than":
            return bool(a_val is not None and b_val is not None and a_val > b_val)
        elif subtype == "less_than":
            return bool(a_val is not None and b_val is not None and a_val < b_val)
        elif subtype == "equal_to":
            return bool(a_val == b_val)
        elif subtype == "rising":
            prev_val = self._prev_results.get(
                self.inputs_for.get(nid, [None])[0]
            ) if self.inputs_for.get(nid) else a_val
            prev_v = self._extract_value(prev_val) if prev_val is not None else a_val
            return bool(a_val is not None and prev_v is not None and a_val > prev_v)
        elif subtype == "falling":
            prev_val = self._prev_results.get(
                self.inputs_for.get(nid, [None])[0]
            ) if self.inputs_for.get(nid) else a_val
            prev_v = self._extract_value(prev_val) if prev_val is not None else a_val
            return bool(a_val is not None and prev_v is not None and a_val < prev_v)

        return False

    # ---- Signal Evaluators ----

    def _eval_signal(
        self, subtype: str, params: dict, inputs: list
    ) -> bool:
        logic = params.get("logic", "and")

        if not inputs:
            return False

        if logic == "and":
            return all(bool(i) for i in inputs)
        elif logic == "or":
            return any(bool(i) for i in inputs)
        elif logic == "weighted":
            weight = params.get("weight", 1.0)
            threshold = params.get("threshold", 1.0)
            score = sum(weight * float(i) for i in inputs if isinstance(i, (int, float)))
            return score >= threshold

        return False

    # ---- Action Evaluators ----

    def _eval_action(
        self, subtype: str, params: dict, inputs: list
    ) -> Optional[dict]:
        # 至少有一个上游信号触发
        if not inputs or not any(inputs):
            return None

        order: dict[str, Any] = {
            "action": params.get("side", "buy"),
            "order_type": subtype.replace("_order", ""),
            "amount_type": params.get("amount_type", "usdt"),
            "amount": params.get("amount_value", 100),
        }

        if subtype == "limit_order":
            order["price"] = params.get("price", 0)

        return order

    # ---- Risk Evaluators ----

    def _eval_risk(self, subtype: str, params: dict) -> Optional[dict]:
        if subtype == "stop_loss":
            return {
                "stop_loss": params.get("value", 0.05),
                "stop_loss_type": params.get("type", "percent"),
            }
        elif subtype == "take_profit":
            return {
                "take_profit": params.get("value", 0.15),
                "take_profit_type": params.get("type", "percent"),
            }
        elif subtype == "trailing_stop":
            return {"trailing_stop": params.get("value", 0.03)}
        elif subtype == "position_pct_cap":
            return {"max_position_pct": params.get("value", 0.5)}
        elif subtype == "daily_max_loss":
            return {"daily_max_loss": params.get("value", 500)}
        elif subtype == "max_hold_time":
            return {"max_hold_time_seconds": params.get("value", 86400)}
        return None

    # ---- Helpers ----

    @staticmethod
    def _extract_value(val: Any, field: str = "value") -> Any:
        """从可能为 dict 的结果中提取标量值"""
        if isinstance(val, dict):
            # 尝试按字段名提取，否则取第一个值
            if field in val:
                return val[field]
            return next(iter(val.values()), 0)
        return val

    def _attach_risk_controls(
        self, order: dict, results: dict[str, Any]
    ) -> dict:
        """将风控参数附加到订单"""
        for nid, node in self.node_map.items():
            if node.get("type") == "risk_control":
                risk_params = results.get(nid, {})
                if isinstance(risk_params, dict):
                    order.update(risk_params)
        return order
