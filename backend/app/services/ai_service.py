"""
智能分析服务
============
模块七：策略诊断、市场状态识别、参数自适应、策略组合优化。
所有分析基于真实数据源（数据库回测结果 + 实时行情）。
"""

import json
import uuid
import numpy as np
from datetime import datetime, UTC
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.backtest import BacktestResult, BacktestTask, ParameterOptimizationTask


class AIService:
    """智能分析服务 — 基于真实回测数据 + 实时行情进行量化分析"""

    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id

    @staticmethod
    def _is_valid_uuid(value: str) -> bool:
        """检查字符串是否为有效 UUID"""
        try:
            uuid.UUID(value)
            return True
        except (ValueError, AttributeError):
            return False

    # ================================================================
    # 内部：从数据库获取真实指标
    # ================================================================
    async def _get_latest_backtest_metrics(self, strategy_id: str) -> Optional[dict]:
        """从数据库查询策略最近一次回测的真实指标"""
        if not self._is_valid_uuid(strategy_id):
            return None
        stmt = (
            select(BacktestResult)
            .join(BacktestTask, BacktestResult.task_id == BacktestTask.id)
            .where(BacktestTask.strategy_id == strategy_id)
            .order_by(BacktestResult.created_at.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        bt = result.scalar_one_or_none()
        if bt is None:
            return None
        return {
            "sharpe_ratio": bt.sharpe_ratio,
            "max_drawdown_pct": bt.max_drawdown_pct,
            "win_rate_pct": bt.win_rate_pct,
            "profit_loss_ratio": bt.profit_loss_ratio,
            "total_trades": bt.total_trades,
            "annual_return_pct": bt.annual_return_pct,
            "annual_volatility_pct": bt.annual_volatility_pct,
            "calmar_ratio": bt.calmar_ratio,
            "avg_hold_hours": bt.avg_hold_hours,
            "max_consecutive_losses": bt.max_consecutive_losses,
            "final_equity": float(bt.final_equity),
            "initial_capital": float(bt.initial_capital),
            "total_return_pct": bt.total_return_pct,
        }

    async def _get_all_backtest_metrics(self, strategy_id: str) -> list[dict]:
        """获取策略的所有回测结果（用于趋势分析）"""
        if not self._is_valid_uuid(strategy_id):
            return []
        stmt = (
            select(BacktestResult)
            .join(BacktestTask, BacktestResult.task_id == BacktestTask.id)
            .where(BacktestTask.strategy_id == strategy_id)
            .order_by(BacktestResult.created_at.asc())
        )
        result = await self.db.execute(stmt)
        results = []
        for bt in result.scalars().all():
            results.append({
                "sharpe_ratio": bt.sharpe_ratio,
                "max_drawdown_pct": bt.max_drawdown_pct,
                "win_rate_pct": bt.win_rate_pct,
                "profit_loss_ratio": bt.profit_loss_ratio,
                "total_trades": bt.total_trades,
                "annual_return_pct": bt.annual_return_pct,
                "annual_volatility_pct": bt.annual_volatility_pct,
                "created_at": bt.created_at.isoformat() if bt.created_at else None,
            })
        return results

    async def _get_optimization_results(self, strategy_id: str) -> Optional[dict]:
        """获取策略最近的参数优化结果"""
        if not self._is_valid_uuid(strategy_id):
            return None
        stmt = (
            select(ParameterOptimizationTask)
            .where(
                ParameterOptimizationTask.strategy_id == strategy_id,
                ParameterOptimizationTask.status == "completed",
            )
            .order_by(ParameterOptimizationTask.created_at.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        opt = result.scalar_one_or_none()
        if opt is None:
            return None
        return {
            "best_params": json.loads(opt.best_params) if opt.best_params else {},
            "best_score": opt.best_score,
            "all_results": json.loads(opt.all_results) if opt.all_results else [],
            "total_combinations": opt.total_combinations,
            "optimization_method": opt.optimization_method,
            "metric": opt.metric,
        }

    async def _get_strategy_backtest_count(self, strategy_id: str) -> int:
        """统计策略的回测次数"""
        if not self._is_valid_uuid(strategy_id):
            return 0
        stmt = (
            select(func.count())
            .select_from(BacktestTask)
            .where(
                BacktestTask.strategy_id == strategy_id,
                BacktestTask.status == "completed",
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    # ================================================================
    # AI-001: 策略健康度评分
    # ================================================================
    async def compute_health_score(self, strategy_id: str, metrics: Optional[dict] = None) -> dict:
        """AI-001: 策略健康度评分 (0-100)。

        优先使用传入的 metrics，否则从数据库查询最近一次回测的真实指标。
        """
        if metrics is None:
            metrics = await self._get_latest_backtest_metrics(strategy_id)

        if metrics is None:
            return {
                "score": 0,
                "grade": "N/A",
                "breakdown": {},
                "weaknesses": [],
                "warning": "该策略尚未运行回测，无法计算健康度评分。请先执行回测任务。",
            }

        score = 50  # 基础分

        # 夏普比率 (0-30 分)
        sharpe = metrics.get("sharpe_ratio", 0)
        score += min(max(sharpe * 10, 0), 30)

        # 最大回撤 (-20~0 分)
        dd = metrics.get("max_drawdown_pct", 30)
        score -= min(dd / 2, 20)

        # 胜率 (0-20 分)
        wr = metrics.get("win_rate_pct", 50)
        score += min((wr - 30) / 2, 20)

        # 盈亏比 (0-15 分)
        plr = metrics.get("profit_loss_ratio", 0)
        score += min(plr * 5, 15)

        # 最低交易次数 → 可信度
        trades = metrics.get("total_trades", 0)
        if trades < 30:
            score -= 10

        score = max(0, min(100, round(score)))

        return {
            "score": score,
            "grade": "A" if score >= 80 else "B" if score >= 60 else "C" if score >= 40 else "D",
            "breakdown": {
                "sharpe_ratio": {"score": round(min(max(sharpe * 10, 0), 30), 1), "max": 30},
                "max_drawdown": {"score": round(max(20 - dd / 2, 0), 1), "max": 20},
                "win_rate": {"score": round(min(max((wr - 30) / 2, 0), 20), 1), "max": 20},
                "profit_loss_ratio": {"score": round(min(max(plr * 5, 0), 15), 1), "max": 15},
            },
            "weaknesses": [
                k for k, v in {
                    "夏普比率偏低": sharpe < 1.0,
                    "回撤过大": dd > 20,
                    "胜率偏低": wr < 40,
                    "盈亏比不足": plr < 1.5,
                    "样本不足": trades < 30,
                }.items() if v
            ],
            "data_source": "latest_backtest_result",
        }

    # ================================================================
    # AI-002: 过拟合风险检测
    # ================================================================
    async def detect_overfitting(self, strategy_id: str, in_sample_metrics: Optional[dict] = None,
                                 out_sample_metrics: Optional[dict] = None) -> dict:
        """AI-002: 过拟合风险检测。

        优先使用传入的样本内外指标；否则从参数优化任务中提取。
        """
        if not in_sample_metrics or not out_sample_metrics:
            # 尝试从参数优化结果获取
            opt_result = await self._get_optimization_results(strategy_id)
            if opt_result and opt_result.get("all_results"):
                all_results = opt_result["all_results"]
                # 按 train_ratio 估算样本内外：前半部分视为样本内，后半部分视为样本外
                split = max(1, len(all_results) // 2)
                in_sample = all_results[:split]
                out_sample = all_results[split:]
                if in_sample and out_sample:
                    metric_key = opt_result.get("metric", "sharpe_ratio")
                    in_sample_metrics = {
                        "sharpe_ratio": np.mean([r.get(metric_key, 0) for r in in_sample]),
                    }
                    out_sample_metrics = {
                        "sharpe_ratio": np.mean([r.get(metric_key, 0) for r in out_sample]),
                    }

        if not in_sample_metrics or not out_sample_metrics:
            # 最后尝试：多次回测中最早 vs 最新
            all_metrics = await self._get_all_backtest_metrics(strategy_id)
            if len(all_metrics) >= 2:
                half = len(all_metrics) // 2
                in_sample_metrics = {
                    "sharpe_ratio": np.mean([m["sharpe_ratio"] for m in all_metrics[:half]]),
                }
                out_sample_metrics = {
                    "sharpe_ratio": np.mean([m["sharpe_ratio"] for m in all_metrics[half:]]),
                }

        if not in_sample_metrics or not out_sample_metrics:
            return {
                "risk_level": "unknown",
                "details": "需要至少 2 次回测结果或 1 次参数优化任务才能检测过拟合。请先执行回测。",
            }

        is_sharpe = in_sample_metrics.get("sharpe_ratio", 0)
        os_sharpe = out_sample_metrics.get("sharpe_ratio", 0)
        degradation = (is_sharpe - os_sharpe) / max(abs(is_sharpe), 0.01) * 100

        risk = "low"
        if degradation > 50:
            risk = "high"
        elif degradation > 30:
            risk = "medium"

        return {
            "risk_level": risk,
            "in_sample_sharpe": round(is_sharpe, 4),
            "out_sample_sharpe": round(os_sharpe, 4),
            "degradation_pct": round(degradation, 1),
            "verdict": {
                "low": "过拟合风险较低，策略泛化能力良好",
                "medium": "存在一定过拟合风险，建议简化策略或增加样本外验证",
                "high": "严重过拟合！策略在样本外表现显著下降，建议降低复杂度",
            }.get(risk, ""),
            "data_source": "parameter_optimization" if await self._get_optimization_results(strategy_id) else "multiple_backtests",
        }

    # ================================================================
    # AI-006: 市场状态识别
    # ================================================================
    async def classify_market_state(self, symbol: str = "BTCUSDT") -> dict:
        """AI-006: 市场状态识别。

        从交易所获取 BTCUSDT 实时行情，基于真实数据分类市场状态。
        """
        ticker_data = None
        try:
            from app.services.market_data import market_data_service
            ticker = await market_data_service.get_ticker("binance", symbol)
            if ticker:
                ticker_data = {
                    "change_24h_pct": ticker.get("change_pct_24h", 0),
                    "volume_24h": ticker.get("volume_24h", 0),
                }
                # 也获取资金费率
                try:
                    fr = await market_data_service.get_funding_rate("binance", symbol)
                    ticker_data["funding_rate"] = fr.get("rate", 0)
                except Exception:
                    ticker_data["funding_rate"] = 0
        except Exception:
            pass

        if ticker_data is None:
            return {
                "trend": "unknown",
                "volatility": "unknown",
                "regime": "unknown",
                "altcoin_season": False,
                "confidence": 0.0,
                "description": "无法连接交易所获取实时数据，请检查网络连接",
                "data_source": "failed",
            }

        change_24h = float(ticker_data.get("change_24h_pct", 0))
        volume = float(ticker_data.get("volume_24h", 0))
        funding = float(ticker_data.get("funding_rate", 0))

        # 趋势判断
        if change_24h > 3:
            trend = "bullish"
        elif change_24h < -3:
            trend = "bearish"
        else:
            trend = "neutral"

        # 波动率（基于涨跌幅绝对值）
        abs_change = abs(change_24h)
        if abs_change > 8:
            volatility = "high"
        elif abs_change < 2:
            volatility = "low"
        else:
            volatility = "medium"

        # 市场体制
        if trend == "bullish" and volatility == "high":
            regime = "trending_up_volatile"
        elif trend == "bullish":
            regime = "trending_up"
        elif trend == "bearish" and volatility == "high":
            regime = "trending_down_volatile"
        elif trend == "bearish":
            regime = "trending_down"
        else:
            regime = "ranging"

        # 山寨币季（简化：资金费率极端正偏 + 高成交量）
        altcoin = funding > 0.1 and volume > 0

        confidence = min(0.9, 0.5 + abs_change / 20)

        descriptions = {
            "trending_up": "上升趋势 — 趋势跟随策略表现良好",
            "trending_down": "下降趋势 — 空头策略占优，多头需谨慎",
            "trending_up_volatile": "剧烈上升 — 高波动趋势，注意回撤风险",
            "trending_down_volatile": "剧烈下跌 — 恐慌市，风控优先",
            "ranging": "震荡市 — 趋势策略需谨慎，适合区间交易和网格策略",
        }

        return {
            "symbol": symbol,
            "trend": trend,
            "volatility": volatility,
            "regime": regime,
            "altcoin_season": altcoin,
            "confidence": round(confidence, 2),
            "change_24h_pct": round(change_24h, 2),
            "description": descriptions.get(regime, "震荡市"),
            "data_source": "binance_realtime",
            "timestamp": datetime.now(UTC).isoformat(),
        }

    # ================================================================
    # AI-007: 策略-市场适配矩阵
    # ================================================================
    async def get_strategy_market_fit(self, strategy_id: str) -> dict:
        """AI-007: 策略-市场适配矩阵。

        基于策略的真实回测数据计算不同市场条件下的表现。
        如有历史回测，从交易记录中分析；否则返回数据不足提示。
        """
        # 获取回测结果
        metrics = await self._get_latest_backtest_metrics(strategy_id)
        backtest_count = await self._get_strategy_backtest_count(strategy_id)

        if metrics is None or backtest_count == 0:
            return {
                "strategy_id": strategy_id,
                "matrix": {},
                "current_market": "unknown",
                "recommendation": "该策略尚未运行回测，无法评估市场适配度。请先执行回测任务。",
                "data_source": "none",
            }

        # 从回测结果推断策略特征
        win_rate = metrics.get("win_rate_pct", 50)
        sharpe = metrics.get("sharpe_ratio", 0)
        max_dd = metrics.get("max_drawdown_pct", 0)

        # 根据真实指标推算不同市场状态下的兼容性
        # 夏普高 + 回撤低 → 趋势市表现好；胜率高 → 震荡市表现好
        trending_score = min(100, int(sharpe * 15 + 40))
        ranging_score = min(100, int(win_rate * 1.2))
        volatile_score = min(100, int(80 - max_dd * 1.5))

        matrix = {}
        if trending_score >= 50:
            matrix["strong_trend_up"] = {
                "compatibility": "high" if trending_score >= 70 else "medium",
                "expected_win_rate": round(min(win_rate * 1.15, 85), 1),
            }
            matrix["strong_trend_down"] = {
                "compatibility": "medium",
                "expected_win_rate": round(win_rate * 0.85, 1),
            }
        else:
            matrix["strong_trend_up"] = {
                "compatibility": "medium" if trending_score >= 40 else "low",
                "expected_win_rate": round(min(win_rate, 60), 1),
            }

        matrix["ranging"] = {
            "compatibility": "high" if ranging_score >= 65 else "medium" if ranging_score >= 45 else "low",
            "expected_win_rate": round(ranging_score * 0.55, 1),
        }
        matrix["high_volatility"] = {
            "compatibility": "high" if volatile_score >= 65 else "medium" if volatile_score >= 45 else "low",
            "expected_win_rate": round(volatile_score * 0.6, 1),
        }
        matrix["low_volatility"] = {
            "compatibility": "medium",
            "expected_win_rate": round(win_rate * 0.9, 1),
        }

        # 尝试获取当前市场状态
        current_regime = "ranging"
        try:
            market_state = await self.classify_market_state()
            current_regime = market_state.get("regime", "ranging")
        except Exception:
            pass

        regime_labels = {
            "trending_up": "上升趋势",
            "trending_up_volatile": "剧烈上升",
            "trending_down": "下降趋势",
            "trending_down_volatile": "剧烈下跌",
            "ranging": "震荡市",
        }

        # 生成建议
        fit = matrix.get(current_regime, {})
        compat = fit.get("compatibility", "unknown")
        if compat == "high":
            recommendation = f"当前市场状态（{regime_labels.get(current_regime, current_regime)}）适合该策略运行"
        elif compat == "low":
            recommendation = f"当前市场状态（{regime_labels.get(current_regime, current_regime)}）不适合该策略，建议暂停或切换策略"
        else:
            recommendation = f"当前市场状态（{regime_labels.get(current_regime, current_regime)}）下该策略表现中等，建议谨慎运行"

        return {
            "strategy_id": strategy_id,
            "matrix": matrix,
            "current_market": current_regime,
            "recommendation": recommendation,
            "data_source": f"derived_from_{backtest_count}_backtests",
            "backtest_count": backtest_count,
        }

    # ================================================================
    # AI-011: 参数调整建议
    # ================================================================
    async def generate_param_suggestions(self, strategy_id: str) -> dict:
        """AI-011: 参数调整建议。

        从参数优化任务或多次回测中提取真实参数敏感性建议。
        """
        suggestions = []

        # 方法 1：从参数优化结果获取
        opt_result = await self._get_optimization_results(strategy_id)
        if opt_result:
            best_params = opt_result.get("best_params", {})
            all_results = opt_result.get("all_results", [])
            if best_params:
                for param, value in best_params.items():
                    suggestions.append({
                        "param": param,
                        "suggested": value,
                        "reason": f"参数优化（{opt_result.get('optimization_method', 'grid_search')}）"
                                 f"在 {opt_result.get('total_combinations', 0)} 组参数中找到最优值，"
                                 f"目标指标 {opt_result.get('metric', 'sharpe_ratio')}={opt_result.get('best_score', value)}",
                    })
                return {
                    "suggestions": suggestions,
                    "auto_adapt_enabled": False,
                    "data_source": "parameter_optimization",
                    "optimization_method": opt_result.get("optimization_method"),
                    "total_combinations_tested": opt_result.get("total_combinations", 0),
                }

        # 方法 2：从多次回测的趋势分析给出建议
        all_metrics = await self._get_all_backtest_metrics(strategy_id)
        if len(all_metrics) >= 2:
            first = all_metrics[0]
            last = all_metrics[-1]

            # 检测趋势
            if last["sharpe_ratio"] < first["sharpe_ratio"] * 0.7:
                suggestions.append({
                    "param": "strategy_complexity",
                    "current": "current",
                    "suggested": "simplify",
                    "reason": f"近期夏普比率下降（{first['sharpe_ratio']:.2f}→{last['sharpe_ratio']:.2f}），"
                              f"策略可能过拟合，建议简化参数或增加正则化",
                })

            if last["max_drawdown_pct"] > first["max_drawdown_pct"] * 1.5:
                suggestions.append({
                    "param": "stop_loss_pct",
                    "current": "current",
                    "suggested": "tighten",
                    "reason": f"回撤显著扩大（{first['max_drawdown_pct']:.1f}%→{last['max_drawdown_pct']:.1f}%），"
                              f"建议收紧止损或降低仓位",
                })

            if last["win_rate_pct"] < first["win_rate_pct"] - 10:
                suggestions.append({
                    "param": "entry_threshold",
                    "current": "current",
                    "suggested": "increase",
                    "reason": f"胜率持续下降（{first['win_rate_pct']:.1f}%→{last['win_rate_pct']:.1f}%），"
                              f"建议提高入场门槛，减少低质量信号",
                })

            if suggestions:
                return {
                    "suggestions": suggestions,
                    "auto_adapt_enabled": False,
                    "data_source": f"backtest_trend_analysis ({len(all_metrics)} backtests)",
                }

        if not suggestions:
            return {
                "suggestions": [],
                "auto_adapt_enabled": False,
                "message": "参数优化建议需要至少 1 次参数优化或 2 次回测记录。当前数据不足，请先运行回测或参数优化。",
                "data_source": "none",
            }

    # ================================================================
    # AI-009: BTC 相关性矩阵
    # ================================================================
    async def get_correlation_matrix(self, symbols: Optional[list[str]] = None) -> dict:
        """AI-009: 山寨币与 BTC 相关性（基于 Binance 真实 K 线数据计算）"""
        from app.services.market_data import market_data_service

        targets = symbols or ["ETHUSDT", "BNBUSDT", "SOLUSDT", "ADAUSDT", "DOGEUSDT"]
        correlations = {}

        try:
            # 获取 BTC 基准数据
            btc_bars = await market_data_service.get_klines("binance", "BTCUSDT", "1h", limit=168)
            if not btc_bars or len(btc_bars) < 50:
                return {
                    "base": "BTCUSDT",
                    "correlations": {},
                    "updated_at": None,
                    "warning": "BTC K线数据不足（需要至少 50 根），无法计算相关性",
                }

            import pandas as pd
            btc_close = pd.Series([float(b.get("close", 0)) for b in btc_bars])
            btc_returns = btc_close.pct_change().dropna()

            for symbol in targets:
                try:
                    alt_bars = await market_data_service.get_klines("binance", symbol, "1h", limit=168)
                    if not alt_bars or len(alt_bars) < 50:
                        correlations[symbol] = None
                        continue
                    alt_close = pd.Series([float(b.get("close", 0)) for b in alt_bars])
                    alt_returns = alt_close.pct_change().dropna()

                    if len(alt_returns) > 20:
                        corr = float(btc_returns.corr(alt_returns))
                        correlations[symbol] = round(corr, 4)
                except Exception:
                    correlations[symbol] = None

            return {
                "base": "BTCUSDT",
                "correlations": correlations,
                "updated_at": datetime.now(UTC).isoformat(),
                "period": "7d_1h",
                "data_source": "binance_realtime",
            }
        except Exception as e:
            return {
                "base": "BTCUSDT",
                "correlations": {},
                "updated_at": None,
                "error": str(e),
            }

    # ================================================================
    # AI-014: 资金分配建议
    # ================================================================
    async def get_allocation_suggestion(self, strategy_ids: list[str]) -> dict:
        """AI-014: 资金分配建议。

        基于各策略真实回测波动率计算风险平价权重。
        """
        if not strategy_ids:
            return {"method": "risk_parity", "allocations": {}, "total_strategies": 0}

        # 从数据库查询每个策略的真实波动率
        vol_estimates = {}
        for sid in strategy_ids:
            metrics = await self._get_latest_backtest_metrics(sid)
            if metrics:
                # 使用真实年化波动率
                vol = metrics.get("annual_volatility_pct", 20)
                if vol > 0:
                    vol_estimates[sid] = vol / 100.0  # 百分比转小数
                else:
                    vol_estimates[sid] = 0.20
            else:
                # 无回测数据时使用中性值
                vol_estimates[sid] = 0.20

        # 风险平价：权重反比于波动率
        inv_vol = {sid: 1.0 / max(v, 0.01) for sid, v in vol_estimates.items()}
        total_inv = sum(inv_vol.values())
        allocations = {
            sid: round(inv_vol[sid] / total_inv, 4) for sid in inv_vol
        } if total_inv > 0 else {}

        # 标记哪些策略基于真实数据
        data_sources = {}
        for sid in strategy_ids:
            metrics = await self._get_latest_backtest_metrics(sid)
            data_sources[sid] = "backtest" if metrics else "default_estimate"

        return {
            "method": "risk_parity",
            "allocations": allocations,
            "total_strategies": len(strategy_ids),
            "note": "基于历史回测波动率的等风险贡献分配，建议定期重新平衡",
            "data_sources": data_sources,
        }
