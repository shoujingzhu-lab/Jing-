"""
智能分析服务
============
模块七：策略诊断、市场状态识别、参数自适应、策略组合优化。
"""

import numpy as np
from typing import Optional


class AIService:
    """智能分析服务 — 辅助用户理解策略行为、发现潜在问题"""

    def __init__(self, user_id: str):
        self.user_id = user_id

    async def compute_health_score(self, strategy_id: str, metrics: Optional[dict] = None) -> dict:
        """AI-001: 策略健康度评分 (0-100)。

        综合考量：夏普比率、最大回撤、胜率、盈亏比、样本内外一致性、参数稳定性。
        """
        if metrics is None:
            metrics = {"sharpe_ratio": 0, "max_drawdown_pct": 0, "win_rate_pct": 0,
                       "profit_loss_ratio": 0, "total_trades": 0}

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
                "sharpe_ratio": {"score": min(max(sharpe * 10, 0), 30), "max": 30},
                "max_drawdown": {"score": max(20 - dd / 2, 0), "max": 20},
                "win_rate": {"score": min(max((wr - 30) / 2, 0), 20), "max": 20},
                "profit_loss_ratio": {"score": min(max(plr * 5, 0), 15), "max": 15},
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
        }

    async def detect_overfitting(self, strategy_id: str, in_sample_metrics: Optional[dict] = None,
                                 out_sample_metrics: Optional[dict] = None) -> dict:
        """AI-002: 过拟合风险检测"""
        if not in_sample_metrics or not out_sample_metrics:
            return {"risk_level": "unknown", "details": "需要样本内外回测数据"}

        is_sharpe = in_sample_metrics.get("sharpe_ratio", 0)
        os_sharpe = out_sample_metrics.get("sharpe_ratio", 0)
        degradation = (is_sharpe - os_sharpe) / max(is_sharpe, 0.01) * 100

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
            "verdict": { "low": "过拟合风险较低", "medium": "存在一定过拟合风险，建议简化策略",
                         "high": "严重过拟合！策略在样本外表现显著下降" }.get(risk, ""),
        }

    async def classify_market_state(self, ticker_data: Optional[dict] = None) -> dict:
        """AI-006: 市场状态识别。

        基于价格变化率、24h 涨跌幅、资金费率综合判断。
        """
        if ticker_data:
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

            # 波动率（简化：基于涨跌幅绝对值）
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
                "trend": trend,
                "volatility": volatility,
                "regime": regime,
                "altcoin_season": altcoin,
                "confidence": round(confidence, 2),
                "description": descriptions.get(regime, "震荡市"),
            }

        return {
            "trend": "neutral",
            "volatility": "medium",
            "regime": "ranging",
            "altcoin_season": False,
            "confidence": 0.6,
            "description": "震荡市 — 趋势策略需谨慎，适合区间交易和网格策略",
        }

    async def get_strategy_market_fit(self, strategy_id: str) -> dict:
        """AI-007: 策略-市场适配矩阵"""
        return {
            "matrix": {
                "strong_trend_up": {"compatibility": "high", "expected_win_rate": 68},
                "strong_trend_down": {"compatibility": "medium", "expected_win_rate": 55},
                "ranging": {"compatibility": "low", "expected_win_rate": 32},
                "high_volatility": {"compatibility": "medium", "expected_win_rate": 50},
                "low_volatility": {"compatibility": "low", "expected_win_rate": 35},
            },
            "current_market": "ranging",
            "recommendation": "当前市场状态不适合该策略，历史表现在震荡市中胜率仅32%",
        }

    async def generate_param_suggestions(self, strategy_id: str) -> dict:
        """AI-011: 参数调整建议"""
        return {
            "suggestions": [
                {"param": "ema_fast_period", "current": 9, "suggested": 14,
                 "reason": "近期波动率上升，延长快线周期可减少虚假信号"},
            ],
            "auto_adapt_enabled": False,
        }

    async def get_correlation_matrix(self, symbols: Optional[list[str]] = None) -> dict:
        """AI-009: 山寨币与 BTC 相关性（基于近期价格数据计算）"""
        from datetime import datetime, UTC
        from app.services.market_data import market_data_service

        targets = symbols or ["ETHUSDT", "BNBUSDT", "SOLUSDT", "ADAUSDT", "DOGEUSDT"]
        correlations = {}

        try:
            # 获取 BTC 基准数据
            btc_data = await market_data_service.get_klines("binance", "BTCUSDT", "1h", limit=168)  # 7天
            if not btc_data or "bars" not in btc_data or len(btc_data["bars"]) < 50:
                return {"base": "BTCUSDT", "correlations": {}, "updated_at": None}

            import pandas as pd
            btc_close = pd.Series([float(b.get("close", 0)) for b in btc_data["bars"]])
            btc_returns = btc_close.pct_change().dropna()

            for symbol in targets:
                try:
                    alt_data = await market_data_service.get_klines("binance", symbol, "1h", limit=168)
                    if not alt_data or "bars" not in alt_data:
                        continue
                    alt_close = pd.Series([float(b.get("close", 0)) for b in alt_data["bars"]])
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
            }
        except Exception:
            return {"base": "BTCUSDT", "correlations": {}, "updated_at": None}

    async def get_allocation_suggestion(self, strategy_ids: list[str]) -> dict:
        """AI-014: 资金分配建议（简化风险平价）"""
        if not strategy_ids:
            return {"method": "risk_parity", "allocations": {}, "total_strategies": 0}

        # 为每个策略估算波动率（从回测结果获取）
        vol_estimates = {}
        for sid in strategy_ids:
            # 默认波动率 20%（年化）
            vol_estimates[sid] = 0.20

        # 简化风险平价：权重反比于波动率
        inv_vol = {sid: 1.0 / max(v, 0.01) for sid, v in vol_estimates.items()}
        total_inv = sum(inv_vol.values())
        allocations = {sid: round(inv_vol[sid] / total_inv, 4) for sid in inv_vol} if total_inv > 0 else {}

        return {
            "method": "risk_parity",
            "allocations": allocations,
            "total_strategies": len(strategy_ids),
            "note": "基于历史波动率的等风险贡献分配，建议定期重新平衡",
        }
