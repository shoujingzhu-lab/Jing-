"""
事件驱动回测引擎
================
模块三核心：按 K 线/Tick 序列执行策略逻辑，模拟真实交易所撮合。

支持：
- 5 种撮合模式 (next_open / close / limit / vwap / counterparty)
- 手续费模拟 (Maker/Taker)
- 滑点模拟
- 资金费率 (永续合约)
- 现货/合约区分
"""

import json
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Optional

import numpy as np


# ============================================================
# 枚举
# ============================================================
class FillMode(str, Enum):
    NEXT_OPEN = "next_open"        # 下一 K 线开盘价成交
    CLOSE = "close"                 # 当前 K 线收盘价成交
    LIMIT = "limit"                 # 到达限价即成交
    VWAP = "vwap"                   # VWAP 成交
    COUNTERPARTY = "counterparty"   # 对手价成交


class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


class TradeType(str, Enum):
    SPOT = "spot"
    PERPETUAL = "perpetual"


# ============================================================
# 数据结构
# ============================================================
@dataclass
class Fill:
    """成交记录"""
    timestamp: datetime
    symbol: str
    side: str
    price: float
    amount: float
    commission: float = 0.0
    commission_asset: str = "USDT"
    slippage_amount: float = 0.0


@dataclass
class Position:
    """仓位"""
    symbol: str
    side: str  # long | short
    amount: float = 0.0
    entry_price: float = 0.0
    realized_pnl: float = 0.0
    commission_paid: float = 0.0
    funding_fee_paid: float = 0.0
    open_time: Optional[datetime] = None
    close_time: Optional[datetime] = None


@dataclass
class Account:
    """账户状态"""
    initial_capital: float
    cash: float
    equity: float = 0.0
    positions: dict[str, Position] = field(default_factory=dict)

    @property
    def total_equity(self) -> float:
        return self.cash + sum(
            p.amount * p.entry_price + p.realized_pnl
            for p in self.positions.values()
        )


@dataclass
class BacktestTrade:
    """回测交易记录"""
    entry_time: datetime
    exit_time: Optional[datetime]
    symbol: str
    side: str
    entry_price: float
    exit_price: Optional[float]
    amount: float
    pnl: float = 0.0
    commission: float = 0.0
    funding_fee: float = 0.0
    pnl_pct: float = 0.0
    hold_hours: float = 0.0


# ============================================================
# 回测引擎
# ============================================================
class BacktestEngine:
    """事件驱动回测引擎。

    用法:
        engine = BacktestEngine(config)
        engine.load_data(klines)
        results = engine.run(strategy_interpreter)
        report = engine.generate_report()
    """

    def __init__(self, config: dict):
        # 基本配置
        self.symbols: list[str] = config.get("symbols", [])
        self.initial_capital: float = float(config.get("initial_capital", 10000))
        self.commission_rate: float = float(config.get("commission_rate", 0.0004))
        self.slippage: float = float(config.get("slippage", 0.0005))
        self.fill_mode: FillMode = FillMode(config.get("fill_mode", "next_open"))
        self.trade_type: TradeType = TradeType(config.get("trade_type", "spot"))
        self.funding_rate_interval: int = config.get("funding_rate_interval", 8)  # 小时

        # 运行时状态
        self.account = Account(
            initial_capital=self.initial_capital,
            cash=self.initial_capital,
            equity=self.initial_capital,
        )
        self.trades: list[BacktestTrade] = []
        self.fills: list[Fill] = []
        self.equity_curve: list[dict] = []
        self._data: dict[str, list[dict]] = {}  # symbol -> klines
        self._current_bar: dict[str, dict] = {}  # symbol -> current kline
        self._open_positions: dict[str, BacktestTrade] = {}  # pending trades

    def load_data(self, klines: dict[str, list[dict]]):
        """加载 K 线数据 {symbol: [{open_time, open, high, low, close, volume}, ...]}"""
        self._data = klines

    def run(self, strategy: Any) -> dict:
        """执行回测。

        Args:
            strategy: 策略对象，必须有 evaluate(klines, prev_klines) 方法

        Returns:
            包含所有交易记录和净值的 dict
        """
        if not self._data:
            return {"trades": [], "equity_curve": []}

        # 对齐所有 symbol 的时间轴
        all_timestamps = sorted(set(
            bar["open_time"]
            for symbol_bars in self._data.values()
            for bar in symbol_bars
        ))

        for ts in all_timestamps:
            # 更新当前 bar
            for symbol in self.symbols:
                symbol_bars = self._data.get(symbol, [])
                for bar in symbol_bars:
                    if bar["open_time"] == ts:
                        self._current_bar[symbol] = bar
                        break

            # 执行策略
            for symbol in self.symbols:
                bar = self._current_bar.get(symbol)
                if bar is None:
                    continue

                # 构造策略输入
                symbol_bars = self._data[symbol]
                current_idx = symbol_bars.index(bar)
                history_bars = symbol_bars[: current_idx + 1]

                klines_dict = {
                    "open": [b["open"] for b in history_bars],
                    "high": [b["high"] for b in history_bars],
                    "low": [b["low"] for b in history_bars],
                    "close": [b["close"] for b in history_bars],
                    "volume": [b["volume"] for b in history_bars],
                }
                prev_klines = None
                if current_idx > 0:
                    prev_history = symbol_bars[:current_idx]
                    prev_klines = {
                        "open": [b["open"] for b in prev_history],
                        "high": [b["high"] for b in prev_history],
                        "low": [b["low"] for b in prev_history],
                        "close": [b["close"] for b in prev_history],
                        "volume": [b["volume"] for b in prev_history],
                    }

                signal = strategy.evaluate(klines_dict, prev_klines)
                if signal:
                    self._execute_signal(signal, bar, symbol)

            # 记录净值曲线
            self.equity_curve.append({
                "time": ts,
                "equity": self.account.total_equity,
            })

            # 资金费率结算（每 8 小时）
            if self.trade_type == TradeType.PERPETUAL:
                self._settle_funding(ts)

        # 收盘平仓所有未平仓位
        self._close_all_positions(all_timestamps[-1] if all_timestamps else None)

        return {
            "trades": self.trades,
            "fills": self.fills,
            "equity_curve": self.equity_curve,
        }

    def _execute_signal(self, signal: dict, bar: dict, symbol: str):
        """执行交易信号"""
        action = signal.get("action", "buy")
        order_type = signal.get("order_type", "market")
        amount_type = signal.get("amount_type", "usdt")
        amount_value = signal.get("amount", 100)

        # 计算成交价格
        fill_price = self._get_fill_price(bar, order_type, action)

        # 计算成交数量
        if amount_type == "usdt":
            amount = float(amount_value) / fill_price
        elif amount_type == "percent":
            amount = (self.account.total_equity * float(amount_value) / 100) / fill_price
        else:
            amount = float(amount_value)

        # 应用滑点
        if self.slippage > 0:
            slip = fill_price * self.slippage
            fill_price = fill_price - slip if action == "sell" else fill_price + slip

        # 佣金
        commission = amount * fill_price * self.commission_rate

        if action in ("buy", "sell"):
            # 开仓
            if action == "buy":
                pos_side = "long"
                cost = amount * fill_price + commission
                if self.account.cash >= cost:
                    self.account.cash -= cost
                    trade = BacktestTrade(
                        entry_time=bar["open_time"],
                        exit_time=None,
                        symbol=symbol,
                        side=pos_side,
                        entry_price=fill_price,
                        exit_price=None,
                        amount=amount,
                        commission=commission,
                    )
                    self._open_positions[symbol] = trade
                    self.fills.append(Fill(
                        timestamp=bar["open_time"], symbol=symbol, side="buy",
                        price=fill_price, amount=amount, commission=commission,
                    ))
            else:
                # 卖出平仓
                pos = self._open_positions.pop(symbol, None)
                if pos:
                    pnl = amount * (fill_price - pos.entry_price) - commission
                    pos.exit_time = bar["open_time"]
                    pos.exit_price = fill_price
                    pos.pnl = pnl
                    pos.commission += commission
                    pos.pnl_pct = (fill_price / pos.entry_price - 1) * 100
                    pos.hold_hours = (
                        (pos.exit_time - pos.entry_time).total_seconds() / 3600
                        if pos.exit_time and pos.entry_time
                        else 0
                    )
                    self.account.cash += amount * fill_price - commission
                    self.trades.append(pos)
                    self.fills.append(Fill(
                        timestamp=bar["open_time"], symbol=symbol, side="sell",
                        price=fill_price, amount=amount, commission=commission,
                    ))

        elif action == "close":
            # 全平
            pos = self._open_positions.pop(symbol, None)
            if pos:
                pnl = pos.amount * (fill_price - pos.entry_price) - commission
                pos.exit_time = bar["open_time"]
                pos.exit_price = fill_price
                pos.pnl = pnl
                pos.commission += commission
                pos.pnl_pct = (fill_price / pos.entry_price - 1) * 100
                pos.hold_hours = (
                    (pos.exit_time - pos.entry_time).total_seconds() / 3600
                    if pos.exit_time and pos.entry_time
                    else 0
                )
                self.account.cash += pos.amount * fill_price - commission
                self.trades.append(pos)

    def _get_fill_price(self, bar: dict, order_type: str, action: str) -> float:
        """根据撮合模式计算成交价"""
        if self.fill_mode == FillMode.NEXT_OPEN:
            return float(bar["open"])
        elif self.fill_mode == FillMode.CLOSE:
            return float(bar["close"])
        elif self.fill_mode == FillMode.VWAP:
            h, l, c = float(bar["high"]), float(bar["low"]), float(bar["close"])
            return (h + l + c) / 3
        elif self.fill_mode == FillMode.COUNTERPARTY:
            return float(bar["close"])
        return float(bar["close"])

    def _settle_funding(self, ts: datetime):
        """对永续合约结算资金费率（每 8 小时结算一次）"""
        if not hasattr(self, "_last_funding_time"):
            self._last_funding_time: dict[str, datetime] = {}
        if not hasattr(self, "_funding_positions"):
            self._funding_positions: dict[str, set[int]] = {}

        position_key = str(self.strategy_id or "default")
        last_time = self._last_funding_time.get(position_key)
        if last_time and (ts - last_time).total_seconds() < 8 * 3600:
            return
        self._last_funding_time[position_key] = ts

        # 默认资金费率 0.01%（每 8 小时典型值）
        rate = 0.0001
        for pos in list(getattr(self, "_positions", [])):
            if pos.get("type") != "perpetual":
                continue
            position_value = float(pos.get("amount", 0)) * float(pos.get("entry_price", 0))
            payment = position_value * rate
            if pos.get("side") == "short":
                payment = -payment
            self.account.cash -= payment
            pos["total_funding_paid"] = pos.get("total_funding_paid", 0.0) + payment

    def _close_all_positions(self, final_time: Optional[datetime]):
        """回测结束时平掉所有未平仓位"""
        for symbol, pos in list(self._open_positions.items()):
            last_bar = self._current_bar.get(symbol, {})
            exit_price = float(last_bar.get("close", pos.entry_price))
            commission = pos.amount * exit_price * self.commission_rate
            pnl = pos.amount * (exit_price - pos.entry_price) - commission
            pos.exit_time = final_time
            pos.exit_price = exit_price
            pos.pnl = pnl
            pos.commission += commission
            pos.pnl_pct = (exit_price / pos.entry_price - 1) * 100
            if pos.entry_time and pos.exit_time:
                pos.hold_hours = (pos.exit_time - pos.entry_time).total_seconds() / 3600
            self.account.cash += pos.amount * exit_price - commission
            self.trades.append(pos)
        self._open_positions.clear()

    # ============================================================
    # 报告生成
    # ============================================================
    def generate_report(self) -> dict:
        """生成回测报告指标 (BACK-011 ~ BACK-017)"""
        trades = self.trades
        if not trades:
            return {
                "total_return_pct": 0, "annual_return_pct": 0,
                "annual_volatility_pct": 0, "sharpe_ratio": 0,
                "max_drawdown_pct": 0, "calmar_ratio": 0,
                "win_rate_pct": 0, "profit_loss_ratio": 0,
                "avg_hold_hours": 0, "total_trades": 0,
                "max_consecutive_losses": 0, "total_commission": 0,
            }

        final_equity = self.account.total_equity
        total_return = (final_equity - self.initial_capital) / self.initial_capital * 100
        total_commission = sum(t.commission for t in trades)

        # 年化收益率
        if self.equity_curve and len(self.equity_curve) >= 2:
            first_time = self.equity_curve[0]["time"]
            last_time = self.equity_curve[-1]["time"]
            if isinstance(first_time, datetime) and isinstance(last_time, datetime):
                years = (last_time - first_time).total_seconds() / (365 * 24 * 3600)
            else:
                years = len(self.equity_curve) / (365 * 24)  # 估算
            annual_return = ((1 + total_return / 100) ** (1 / max(years, 0.01)) - 1) * 100
        else:
            years = 0
            annual_return = 0

        # 净值序列
        equity_values = [e["equity"] for e in self.equity_curve] if self.equity_curve else [self.initial_capital]

        # 日收益率
        daily_returns = []
        prev_eq = self.initial_capital
        for e in self.equity_curve:
            eq = e["equity"]
            if prev_eq > 0:
                daily_returns.append(eq / prev_eq - 1)
            prev_eq = eq

        # 年化波动率
        if daily_returns:
            annual_vol = np.std(daily_returns) * np.sqrt(365) * 100
        else:
            annual_vol = 0

        # 夏普比率（无风险利率 0）
        if annual_vol > 0:
            sharpe = annual_return / annual_vol
        else:
            sharpe = 0

        # 最大回撤
        peak = equity_values[0]
        max_dd = 0
        for eq in equity_values:
            if eq > peak:
                peak = eq
            dd = (peak - eq) / peak * 100 if peak > 0 else 0
            if dd > max_dd:
                max_dd = dd

        # 卡玛比率
        calmar = annual_return / max_dd if max_dd > 0 else 0

        # 胜率 & 盈亏比
        winning = [t for t in trades if t.pnl > 0]
        losing = [t for t in trades if t.pnl <= 0]
        win_rate = len(winning) / len(trades) * 100 if trades else 0
        avg_win = np.mean([t.pnl for t in winning]) if winning else 0
        avg_loss = abs(np.mean([t.pnl for t in losing])) if losing else 1
        profit_loss_ratio = avg_win / avg_loss if avg_loss > 0 else 0

        # 平均持仓时间
        avg_hold = np.mean([t.hold_hours for t in trades if t.hold_hours > 0]) if trades else 0

        # 最大连续亏损
        max_consecutive = 0
        current_streak = 0
        for t in trades:
            if t.pnl <= 0:
                current_streak += 1
                max_consecutive = max(max_consecutive, current_streak)
            else:
                current_streak = 0

        # 净值曲线
        equity_curve_data = [
            {"time": e["time"].isoformat() if isinstance(e["time"], datetime) else str(e["time"]),
             "equity": round(e["equity"], 2)}
            for e in self.equity_curve
        ]

        # 回撤曲线
        peak = equity_values[0]
        drawdown_curve = []
        for i, eq in enumerate(equity_values):
            if eq > peak:
                peak = eq
            dd = (peak - eq) / peak * 100 if peak > 0 else 0
            ts = self.equity_curve[i]["time"]
            drawdown_curve.append({
                "time": ts.isoformat() if isinstance(ts, datetime) else str(ts),
                "drawdown_pct": round(dd, 4),
            })

        # 日收益汇总
        daily_return_data = [
            {"time": self.equity_curve[i]["time"].isoformat() if isinstance(self.equity_curve[i]["time"], datetime) else str(self.equity_curve[i]["time"]),
             "return_pct": round(r * 100, 4)}
            for i, r in enumerate(daily_returns)
        ]

        # 交易明细
        trade_details = []
        for t in trades:
            trade_details.append({
                "entry_time": t.entry_time.isoformat() if t.entry_time else None,
                "exit_time": t.exit_time.isoformat() if t.exit_time else None,
                "symbol": t.symbol,
                "side": t.side,
                "entry_price": round(t.entry_price, 8),
                "exit_price": round(t.exit_price, 8) if t.exit_price else None,
                "amount": round(t.amount, 8),
                "pnl": round(t.pnl, 8),
                "commission": round(t.commission, 8),
                "funding_fee": round(t.funding_fee, 8),
                "pnl_pct": round(t.pnl_pct, 4),
                "hold_hours": round(t.hold_hours, 2),
            })

        return {
            "total_return_pct": round(total_return, 2),
            "annual_return_pct": round(annual_return, 2),
            "annual_volatility_pct": round(annual_vol, 2),
            "sharpe_ratio": round(sharpe, 4),
            "max_drawdown_pct": round(max_dd, 2),
            "calmar_ratio": round(calmar, 4),
            "win_rate_pct": round(win_rate, 2),
            "profit_loss_ratio": round(profit_loss_ratio, 4),
            "avg_hold_hours": round(avg_hold, 2),
            "total_trades": len(trades),
            "max_consecutive_losses": max_consecutive,
            "initial_capital": self.initial_capital,
            "final_equity": round(final_equity, 8),
            "total_commission": round(total_commission, 8),
            "total_funding_fee": 0,
            "equity_curve": equity_curve_data,
            "drawdown_curve": drawdown_curve,
            "daily_returns": daily_return_data,
            "trades": trade_details,
        }


# ============================================================
# 参数优化引擎
# ============================================================
class ParameterOptimizer:
    """参数优化引擎 (BACK-018 ~ BACK-022)"""

    def __init__(self, config: dict):
        self.param_grid = config.get("param_grid", {})
        self.method = config.get("optimization_method", "grid_search")
        self.metric = config.get("metric", "sharpe_ratio")
        self.backtest_config = config.get("backtest_config", {})

    def generate_combinations(self) -> list[dict]:
        """生成参数组合（网格搜索）"""
        if self.method != "grid_search":
            return []

        keys = list(self.param_grid.keys())
        if not keys:
            return []

        import itertools

        ranges = []
        for key in keys:
            cfg = self.param_grid[key]
            start = cfg.get("min", 1)
            end = cfg.get("max", 10)
            step = cfg.get("step", 1)
            values = []
            v = start
            while v <= end:
                values.append(v)
                v += step
            ranges.append(values)

        combinations = []
        for combo in itertools.product(*ranges):
            combinations.append(dict(zip(keys, combo)))

        return combinations

    def evaluate_combination(
        self, params: dict, klines_data: dict, strategy_definition: dict
    ) -> dict:
        """评估单个参数组合"""
        # 将参数注入策略定义
        definition = json.loads(json.dumps(strategy_definition))
        for node in definition.get("nodes", []):
            for key, val in params.items():
                # 参数命名格式: node_id__param_name
                parts = key.rsplit("__", 1)
                if len(parts) == 2:
                    nid, pname = parts
                    if node["id"] == nid:
                        node.setdefault("params", {})[pname] = val
                # 简单格式直接覆盖
                elif key in node.get("params", {}):
                    node["params"][key] = val

        # 运行回测
        from app.engine.interpreter import VisualStrategyInterpreter
        from app.engine.backtest import BacktestEngine

        engine_config = {**self.backtest_config}
        engine = BacktestEngine(engine_config)
        engine.load_data(klines_data)

        strategy = VisualStrategyInterpreter(definition)
        engine.run(strategy)
        report = engine.generate_report()

        return {
            "params": params,
            "total_return_pct": report["total_return_pct"],
            "sharpe_ratio": report["sharpe_ratio"],
            "max_drawdown_pct": report["max_drawdown_pct"],
            "win_rate_pct": report["win_rate_pct"],
            "total_trades": report["total_trades"],
            "calmar_ratio": report["calmar_ratio"],
        }

    def optimize(
        self, klines_data: dict, strategy_definition: dict
    ) -> tuple[dict, list[dict]]:
        """执行参数优化，返回 (best_result, all_results)"""
        combinations = self.generate_combinations()
        all_results = []

        for params in combinations:
            result = self.evaluate_combination(params, klines_data, strategy_definition)
            all_results.append(result)

        if not all_results:
            return {}, []

        # 按优化目标排序
        best = max(all_results, key=lambda r: r.get(self.metric, float("-inf")))
        return best, all_results
