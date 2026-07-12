"""
策略模板库与初始化
==================
STG-007: 15+ 种币圈策略模板。
模板以 system-owned (user_id=NULL) 方式存储。
"""

import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trading import Strategy
from app.repositories.strategy import StrategyRepository

logger = logging.getLogger("quant.templates")

# ============================================================
# 15 个策略模板定义
# ============================================================
TEMPLATES: list[dict] = [
    # ---- 1. 双均线交叉 ----
    {
        "name": "Dual MA Crossover",
        "description": "经典双均线交叉策略：快线上穿慢线做多，下穿平仓/做空。适合趋势行情。",
        "trade_type": "perpetual",
        "kline_interval": "1h",
        "tags": ["trend_following", "ma", "beginner"],
        "definition": {
            "nodes": [
                {"id": "ema_fast", "type": "indicator", "subtype": "ema", "params": {"period": 9, "source": "close"}},
                {"id": "ema_slow", "type": "indicator", "subtype": "ema", "params": {"period": 21, "source": "close"}},
                {"id": "cond_buy", "type": "condition", "subtype": "crossover", "params": {"direction": "above"}},
                {"id": "cond_sell", "type": "condition", "subtype": "crossover", "params": {"direction": "below"}},
                {"id": "sig_buy", "type": "signal", "subtype": "long_entry", "params": {"logic": "and"}},
                {"id": "sig_sell", "type": "signal", "subtype": "close_long", "params": {"logic": "and"}},
                {"id": "act_buy", "type": "action", "subtype": "market_order", "params": {"side": "buy", "amount_type": "usdt", "amount_value": 100}},
                {"id": "act_sell", "type": "action", "subtype": "market_order", "params": {"side": "sell", "amount_type": "percent", "amount_value": 100}},
                {"id": "risk_sl", "type": "risk_control", "subtype": "stop_loss", "params": {"type": "percent", "value": 0.05}},
                {"id": "risk_tp", "type": "risk_control", "subtype": "take_profit", "params": {"type": "percent", "value": 0.15}},
            ],
            "edges": [
                {"from": "ema_fast", "to": "cond_buy"}, {"from": "ema_slow", "to": "cond_buy"},
                {"from": "ema_fast", "to": "cond_sell"}, {"from": "ema_slow", "to": "cond_sell"},
                {"from": "cond_buy", "to": "sig_buy"}, {"from": "cond_sell", "to": "sig_sell"},
                {"from": "sig_buy", "to": "act_buy"}, {"from": "sig_sell", "to": "act_sell"},
                {"from": "act_buy", "to": "risk_sl"}, {"from": "act_buy", "to": "risk_tp"},
            ],
        },
    },
    # ---- 2. 网格交易 ----
    {
        "name": "Grid Trading",
        "description": "在设定的价格区间内等距放置买卖挂单，赚取震荡行情的波动收益。适合横盘市场。",
        "trade_type": "spot",
        "kline_interval": "15m",
        "tags": ["mean_reversion", "grid", "ranging"],
        "definition": {
            "nodes": [
                {"id": "bb", "type": "indicator", "subtype": "bollinger_bands", "params": {"period": 20, "stddev": 2, "source": "close"}},
                {"id": "cond_low", "type": "condition", "subtype": "less_than", "params": {}},
                {"id": "cond_high", "type": "condition", "subtype": "greater_than", "params": {}},
                {"id": "sig_buy", "type": "signal", "subtype": "long_entry", "params": {"logic": "and"}},
                {"id": "sig_sell", "type": "signal", "subtype": "close_long", "params": {"logic": "and"}},
                {"id": "act_buy", "type": "action", "subtype": "limit_order", "params": {"side": "buy", "amount_type": "usdt", "amount_value": 50}},
                {"id": "act_sell", "type": "action", "subtype": "limit_order", "params": {"side": "sell", "amount_type": "percent", "amount_value": 100}},
            ],
            "edges": [
                {"from": "bb", "to": "cond_low"}, {"from": "cond_low", "to": "sig_buy"},
                {"from": "bb", "to": "cond_high"}, {"from": "cond_high", "to": "sig_sell"},
                {"from": "sig_buy", "to": "act_buy"}, {"from": "sig_sell", "to": "act_sell"},
            ],
        },
    },
    # ---- 3. 海龟交易 ----
    {
        "name": "Turtle Trading",
        "description": "基于 Donchian 通道突破 + ATR 仓位管理的经典趋势跟踪策略。",
        "trade_type": "perpetual",
        "kline_interval": "1d",
        "tags": ["trend_following", "breakout", "classic"],
        "definition": {
            "nodes": [
                {"id": "dc", "type": "indicator", "subtype": "donchian_channel", "params": {"period": 20}},
                {"id": "atr", "type": "indicator", "subtype": "atr", "params": {"period": 20}},
                {"id": "cond_break", "type": "condition", "subtype": "greater_than", "params": {}},
                {"id": "sig_long", "type": "signal", "subtype": "long_entry", "params": {"logic": "and"}},
                {"id": "act_buy", "type": "action", "subtype": "market_order", "params": {"side": "buy", "amount_type": "usdt", "amount_value": 200}},
                {"id": "risk_sl", "type": "risk_control", "subtype": "stop_loss", "params": {"type": "atr_multiple", "value": 2.0}},
                {"id": "risk_ts", "type": "risk_control", "subtype": "trailing_stop", "params": {"value": 0.03}},
            ],
            "edges": [
                {"from": "dc", "to": "cond_break"}, {"from": "cond_break", "to": "sig_long"},
                {"from": "sig_long", "to": "act_buy"}, {"from": "act_buy", "to": "risk_sl"},
                {"from": "act_buy", "to": "risk_ts"},
            ],
        },
    },
    # ---- 4. 动量突破 ----
    {
        "name": "Momentum Breakout",
        "description": "成交量放大配合价格突破关键阻力位时入场，动量衰竭时离场。",
        "trade_type": "perpetual",
        "kline_interval": "4h",
        "tags": ["momentum", "breakout", "volume"],
        "definition": {
            "nodes": [
                {"id": "bb", "type": "indicator", "subtype": "bollinger_bands", "params": {"period": 20, "stddev": 2, "source": "close"}},
                {"id": "vol_ratio", "type": "indicator", "subtype": "volume_ratio", "params": {"period": 20}},
                {"id": "cond_price", "type": "condition", "subtype": "greater_than", "params": {}},
                {"id": "cond_vol", "type": "condition", "subtype": "greater_than", "params": {}},
                {"id": "sig_buy", "type": "signal", "subtype": "long_entry", "params": {"logic": "and"}},
                {"id": "act_buy", "type": "action", "subtype": "market_order", "params": {"side": "buy", "amount_type": "usdt", "amount_value": 150}},
                {"id": "risk_sl", "type": "risk_control", "subtype": "stop_loss", "params": {"type": "percent", "value": 0.04}},
            ],
            "edges": [
                {"from": "bb", "to": "cond_price"}, {"from": "vol_ratio", "to": "cond_vol"},
                {"from": "cond_price", "to": "sig_buy"}, {"from": "cond_vol", "to": "sig_buy"},
                {"from": "sig_buy", "to": "act_buy"}, {"from": "act_buy", "to": "risk_sl"},
            ],
        },
    },
    # ---- 5. 资金费率套利 ----
    {
        "name": "Funding Rate Arbitrage",
        "description": "利用永续合约资金费率机制：费率为正且较高时做空（收资金费），现货对冲。",
        "trade_type": "perpetual",
        "kline_interval": "1h",
        "tags": ["arbitrage", "funding_rate", "advanced"],
        "definition": {
            "nodes": [
                {"id": "fr", "type": "indicator", "subtype": "funding_rate_direction", "params": {"threshold": 0.0005}},
                {"id": "cond_fr_high", "type": "condition", "subtype": "greater_than", "params": {}},
                {"id": "sig_short", "type": "signal", "subtype": "short_entry", "params": {"logic": "and"}},
                {"id": "act_short", "type": "action", "subtype": "market_order", "params": {"side": "sell", "amount_type": "usdt", "amount_value": 500}},
                {"id": "risk_sl", "type": "risk_control", "subtype": "stop_loss", "params": {"type": "percent", "value": 0.03}},
            ],
            "edges": [
                {"from": "fr", "to": "cond_fr_high"}, {"from": "cond_fr_high", "to": "sig_short"},
                {"from": "sig_short", "to": "act_short"}, {"from": "act_short", "to": "risk_sl"},
            ],
        },
    },
    # ---- 6. 三角套利 ----
    {
        "name": "Triangular Arbitrage",
        "description": "利用三个交易对之间的价差进行无风险套利（如 BTC→ETH→USDT→BTC）。需多交易对。",
        "trade_type": "spot",
        "kline_interval": "1m",
        "tags": ["arbitrage", "multi_symbol", "advanced"],
        "definition": {
            "nodes": [
                {"id": "cond_opp", "type": "condition", "subtype": "greater_than", "params": {}},
                {"id": "sig_arb", "type": "signal", "subtype": "long_entry", "params": {"logic": "and"}},
                {"id": "act_trade", "type": "action", "subtype": "market_order", "params": {"side": "buy", "amount_type": "usdt", "amount_value": 1000}},
            ],
            "edges": [
                {"from": "cond_opp", "to": "sig_arb"}, {"from": "sig_arb", "to": "act_trade"},
            ],
        },
    },
    # ---- 7. 马丁格尔 ----
    {
        "name": "Martingale",
        "description": "亏损后加倍仓位以摊平成本。⚠️ 高风险策略，需设置单日最大亏损限制。",
        "trade_type": "perpetual",
        "kline_interval": "15m",
        "tags": ["risk", "martingale", "advanced", "high_risk"],
        "definition": {
            "nodes": [
                {"id": "rsi", "type": "indicator", "subtype": "rsi", "params": {"period": 14, "source": "close"}},
                {"id": "cond_oversold", "type": "condition", "subtype": "less_than", "params": {}},
                {"id": "sig_buy", "type": "signal", "subtype": "long_entry", "params": {"logic": "and"}},
                {"id": "act_buy", "type": "action", "subtype": "market_order", "params": {"side": "buy", "amount_type": "usdt", "amount_value": 50}},
                {"id": "risk_daily", "type": "risk_control", "subtype": "daily_max_loss", "params": {"value": 500}},
                {"id": "risk_cap", "type": "risk_control", "subtype": "position_pct_cap", "params": {"value": 0.5}},
            ],
            "edges": [
                {"from": "rsi", "to": "cond_oversold"}, {"from": "cond_oversold", "to": "sig_buy"},
                {"from": "sig_buy", "to": "act_buy"}, {"from": "act_buy", "to": "risk_daily"},
                {"from": "act_buy", "to": "risk_cap"},
            ],
        },
    },
    # ---- 8. 区间震荡 ----
    {
        "name": "Range Trading",
        "description": "识别价格震荡区间，在区间下沿买入、上沿卖出。配合 RSI 过滤超买超卖。",
        "trade_type": "spot",
        "kline_interval": "1h",
        "tags": ["mean_reversion", "ranging", "rsi"],
        "definition": {
            "nodes": [
                {"id": "rsi", "type": "indicator", "subtype": "rsi", "params": {"period": 14, "source": "close"}},
                {"id": "bb", "type": "indicator", "subtype": "bollinger_bands", "params": {"period": 20, "stddev": 2, "source": "close"}},
                {"id": "cond_rsibuy", "type": "condition", "subtype": "less_than", "params": {}},
                {"id": "cond_low", "type": "condition", "subtype": "less_than", "params": {}},
                {"id": "cond_rsisell", "type": "condition", "subtype": "greater_than", "params": {}},
                {"id": "cond_high", "type": "condition", "subtype": "greater_than", "params": {}},
                {"id": "sig_buy", "type": "signal", "subtype": "long_entry", "params": {"logic": "and"}},
                {"id": "sig_sell", "type": "signal", "subtype": "close_long", "params": {"logic": "and"}},
                {"id": "act_buy", "type": "action", "subtype": "limit_order", "params": {"side": "buy", "amount_type": "usdt", "amount_value": 100}},
                {"id": "act_sell", "type": "action", "subtype": "limit_order", "params": {"side": "sell", "amount_type": "percent", "amount_value": 100}},
            ],
            "edges": [
                {"from": "rsi", "to": "cond_rsibuy"}, {"from": "bb", "to": "cond_low"},
                {"from": "cond_rsibuy", "to": "sig_buy"}, {"from": "cond_low", "to": "sig_buy"},
                {"from": "rsi", "to": "cond_rsisell"}, {"from": "bb", "to": "cond_high"},
                {"from": "cond_rsisell", "to": "sig_sell"}, {"from": "cond_high", "to": "sig_sell"},
                {"from": "sig_buy", "to": "act_buy"}, {"from": "sig_sell", "to": "act_sell"},
            ],
        },
    },
    # ---- 9. EMA 通道趋势 ----
    {
        "name": "Trend Following (EMA Channel)",
        "description": "多周期 EMA 判断趋势方向，价格回调至 EMA 时入场。EMA(20)>EMA(50)>EMA(200) 确认多头。",
        "trade_type": "perpetual",
        "kline_interval": "4h",
        "tags": ["trend_following", "ema", "multi_timeframe"],
        "definition": {
            "nodes": [
                {"id": "ema20", "type": "indicator", "subtype": "ema", "params": {"period": 20, "source": "close"}},
                {"id": "ema50", "type": "indicator", "subtype": "ema", "params": {"period": 50, "source": "close"}},
                {"id": "cond_uptrend", "type": "condition", "subtype": "greater_than", "params": {}},
                {"id": "cond_pullback", "type": "condition", "subtype": "less_than", "params": {}},
                {"id": "sig_buy", "type": "signal", "subtype": "long_entry", "params": {"logic": "and"}},
                {"id": "act_buy", "type": "action", "subtype": "market_order", "params": {"side": "buy", "amount_type": "usdt", "amount_value": 200}},
                {"id": "risk_ts", "type": "risk_control", "subtype": "trailing_stop", "params": {"value": 0.05}},
            ],
            "edges": [
                {"from": "ema20", "to": "cond_uptrend"}, {"from": "ema50", "to": "cond_uptrend"},
                {"from": "cond_uptrend", "to": "sig_buy"}, {"from": "cond_pullback", "to": "sig_buy"},
                {"from": "sig_buy", "to": "act_buy"}, {"from": "act_buy", "to": "risk_ts"},
            ],
        },
    },
    # ---- 10. 布林带回归 ----
    {
        "name": "Bollinger Band Reversion",
        "description": "价格触及布林带下轨买入，触及上轨卖出，基于均值回归假设。震荡市效果好。",
        "trade_type": "spot",
        "kline_interval": "1h",
        "tags": ["mean_reversion", "bollinger", "ranging"],
        "definition": {
            "nodes": [
                {"id": "bb", "type": "indicator", "subtype": "bollinger_bands", "params": {"period": 20, "stddev": 2, "source": "close"}},
                {"id": "rsi", "type": "indicator", "subtype": "rsi", "params": {"period": 14, "source": "close"}},
                {"id": "cond_low", "type": "condition", "subtype": "less_than", "params": {}},
                {"id": "cond_rsi_buy", "type": "condition", "subtype": "less_than", "params": {}},
                {"id": "cond_high", "type": "condition", "subtype": "greater_than", "params": {}},
                {"id": "cond_rsi_sell", "type": "condition", "subtype": "greater_than", "params": {}},
                {"id": "sig_buy", "type": "signal", "subtype": "long_entry", "params": {"logic": "and"}},
                {"id": "sig_sell", "type": "signal", "subtype": "close_long", "params": {"logic": "and"}},
                {"id": "act_buy", "type": "action", "subtype": "market_order", "params": {"side": "buy", "amount_type": "usdt", "amount_value": 100}},
                {"id": "act_sell", "type": "action", "subtype": "market_order", "params": {"side": "sell", "amount_type": "percent", "amount_value": 100}},
                {"id": "risk_sl", "type": "risk_control", "subtype": "stop_loss", "params": {"type": "percent", "value": 0.05}},
            ],
            "edges": [
                {"from": "bb", "to": "cond_low"}, {"from": "rsi", "to": "cond_rsi_buy"},
                {"from": "cond_low", "to": "sig_buy"}, {"from": "cond_rsi_buy", "to": "sig_buy"},
                {"from": "bb", "to": "cond_high"}, {"from": "rsi", "to": "cond_rsi_sell"},
                {"from": "cond_high", "to": "sig_sell"}, {"from": "cond_rsi_sell", "to": "sig_sell"},
                {"from": "sig_buy", "to": "act_buy"}, {"from": "sig_sell", "to": "act_sell"},
                {"from": "act_buy", "to": "risk_sl"},
            ],
        },
    },
    # ---- 11. RSI 均值回归 ----
    {
        "name": "RSI Mean Reversion",
        "description": "RSI 低于超卖阈值做多，高于超买阈值做空，回归中轨时平仓。最基础的均值回归策略。",
        "trade_type": "perpetual",
        "kline_interval": "1h",
        "tags": ["mean_reversion", "rsi", "beginner"],
        "definition": {
            "nodes": [
                {"id": "rsi", "type": "indicator", "subtype": "rsi", "params": {"period": 14, "source": "close"}},
                {"id": "cond_oversold", "type": "condition", "subtype": "less_than", "params": {}},
                {"id": "cond_overbought", "type": "condition", "subtype": "greater_than", "params": {}},
                {"id": "sig_buy", "type": "signal", "subtype": "long_entry", "params": {"logic": "and"}},
                {"id": "sig_sell", "type": "signal", "subtype": "close_long", "params": {"logic": "and"}},
                {"id": "act_buy", "type": "action", "subtype": "market_order", "params": {"side": "buy", "amount_type": "usdt", "amount_value": 100}},
                {"id": "act_sell", "type": "action", "subtype": "market_order", "params": {"side": "sell", "amount_type": "percent", "amount_value": 100}},
                {"id": "risk_sl", "type": "risk_control", "subtype": "stop_loss", "params": {"type": "percent", "value": 0.05}},
            ],
            "edges": [
                {"from": "rsi", "to": "cond_oversold"}, {"from": "cond_oversold", "to": "sig_buy"},
                {"from": "sig_buy", "to": "act_buy"}, {"from": "act_buy", "to": "risk_sl"},
                {"from": "rsi", "to": "cond_overbought"}, {"from": "cond_overbought", "to": "sig_sell"},
                {"from": "sig_sell", "to": "act_sell"},
            ],
        },
    },
    # ---- 12. MACD 交叉 ----
    {
        "name": "MACD Crossover",
        "description": "MACD 线上穿信号线做多、下穿做空，配合零轴确认趋势方向。",
        "trade_type": "perpetual",
        "kline_interval": "4h",
        "tags": ["trend_following", "macd", "beginner"],
        "definition": {
            "nodes": [
                {"id": "macd", "type": "indicator", "subtype": "macd", "params": {"fast": 12, "slow": 26, "signal": 9, "source": "close"}},
                {"id": "cond_buy", "type": "condition", "subtype": "crossover", "params": {"direction": "above"}},
                {"id": "cond_sell", "type": "condition", "subtype": "crossover", "params": {"direction": "below"}},
                {"id": "sig_buy", "type": "signal", "subtype": "long_entry", "params": {"logic": "and"}},
                {"id": "sig_sell", "type": "signal", "subtype": "close_long", "params": {"logic": "and"}},
                {"id": "act_buy", "type": "action", "subtype": "market_order", "params": {"side": "buy", "amount_type": "usdt", "amount_value": 150}},
                {"id": "act_sell", "type": "action", "subtype": "market_order", "params": {"side": "sell", "amount_type": "percent", "amount_value": 100}},
                {"id": "risk_sl", "type": "risk_control", "subtype": "stop_loss", "params": {"type": "atr_multiple", "value": 2.0}},
            ],
            "edges": [
                {"from": "macd", "to": "cond_buy"}, {"from": "cond_buy", "to": "sig_buy"},
                {"from": "sig_buy", "to": "act_buy"}, {"from": "act_buy", "to": "risk_sl"},
                {"from": "macd", "to": "cond_sell"}, {"from": "cond_sell", "to": "sig_sell"},
                {"from": "sig_sell", "to": "act_sell"},
            ],
        },
    },
    # ---- 13. 放量突破 ----
    {
        "name": "Breakout with Volume Confirmation",
        "description": "价格突破近期高点 + 成交量放量确认，减少假突破。适合强势单边行情。",
        "trade_type": "perpetual",
        "kline_interval": "1h",
        "tags": ["breakout", "volume", "momentum"],
        "definition": {
            "nodes": [
                {"id": "dc", "type": "indicator", "subtype": "donchian_channel", "params": {"period": 20}},
                {"id": "vol_ratio", "type": "indicator", "subtype": "volume_ratio", "params": {"period": 20}},
                {"id": "cond_price", "type": "condition", "subtype": "greater_than", "params": {}},
                {"id": "cond_vol", "type": "condition", "subtype": "greater_than", "params": {}},
                {"id": "sig_buy", "type": "signal", "subtype": "long_entry", "params": {"logic": "and"}},
                {"id": "act_buy", "type": "action", "subtype": "market_order", "params": {"side": "buy", "amount_type": "usdt", "amount_value": 200}},
                {"id": "risk_sl", "type": "risk_control", "subtype": "stop_loss", "params": {"type": "percent", "value": 0.04}},
                {"id": "risk_ts", "type": "risk_control", "subtype": "trailing_stop", "params": {"value": 0.06}},
            ],
            "edges": [
                {"from": "dc", "to": "cond_price"}, {"from": "vol_ratio", "to": "cond_vol"},
                {"from": "cond_price", "to": "sig_buy"}, {"from": "cond_vol", "to": "sig_buy"},
                {"from": "sig_buy", "to": "act_buy"}, {"from": "act_buy", "to": "risk_sl"},
                {"from": "act_buy", "to": "risk_ts"},
            ],
        },
    },
    # ---- 14. ATR 波动率策略 ----
    {
        "name": "ATR-based Volatility Strategy",
        "description": "基于 ATR 动态调整止损和仓位。波动率高时降低仓位，波动率低时增加仓位。",
        "trade_type": "perpetual",
        "kline_interval": "4h",
        "tags": ["volatility", "atr", "risk_management"],
        "definition": {
            "nodes": [
                {"id": "atr", "type": "indicator", "subtype": "atr", "params": {"period": 14}},
                {"id": "ema", "type": "indicator", "subtype": "ema", "params": {"period": 50, "source": "close"}},
                {"id": "cond_trend", "type": "condition", "subtype": "greater_than", "params": {}},
                {"id": "sig_buy", "type": "signal", "subtype": "long_entry", "params": {"logic": "and"}},
                {"id": "act_buy", "type": "action", "subtype": "market_order", "params": {"side": "buy", "amount_type": "usdt", "amount_value": 100}},
                {"id": "risk_sl", "type": "risk_control", "subtype": "stop_loss", "params": {"type": "atr_multiple", "value": 2.5}},
            ],
            "edges": [
                {"from": "ema", "to": "cond_trend"}, {"from": "cond_trend", "to": "sig_buy"},
                {"from": "sig_buy", "to": "act_buy"}, {"from": "atr", "to": "risk_sl"},
            ],
        },
    },
    # ---- 15. Donchian 通道突破 ----
    {
        "name": "Donchian Channel Breakout",
        "description": "纯粹的通道突破策略：价格突破 N 日最高价做多，跌破 N 日最低价做空。海龟交易简化版。",
        "trade_type": "perpetual",
        "kline_interval": "1d",
        "tags": ["breakout", "donchian", "trend_following", "classic"],
        "definition": {
            "nodes": [
                {"id": "dc", "type": "indicator", "subtype": "donchian_channel", "params": {"period": 20}},
                {"id": "cond_break_up", "type": "condition", "subtype": "greater_than", "params": {}},
                {"id": "cond_break_down", "type": "condition", "subtype": "less_than", "params": {}},
                {"id": "sig_buy", "type": "signal", "subtype": "long_entry", "params": {"logic": "and"}},
                {"id": "sig_sell", "type": "signal", "subtype": "close_long", "params": {"logic": "and"}},
                {"id": "act_buy", "type": "action", "subtype": "market_order", "params": {"side": "buy", "amount_type": "usdt", "amount_value": 200}},
                {"id": "act_sell", "type": "action", "subtype": "market_order", "params": {"side": "sell", "amount_type": "percent", "amount_value": 100}},
                {"id": "risk_sl", "type": "risk_control", "subtype": "stop_loss", "params": {"type": "percent", "value": 0.04}},
                {"id": "risk_ts", "type": "risk_control", "subtype": "trailing_stop", "params": {"value": 0.08}},
            ],
            "edges": [
                {"from": "dc", "to": "cond_break_up"}, {"from": "cond_break_up", "to": "sig_buy"},
                {"from": "sig_buy", "to": "act_buy"}, {"from": "act_buy", "to": "risk_sl"},
                {"from": "act_buy", "to": "risk_ts"},
                {"from": "dc", "to": "cond_break_down"}, {"from": "cond_break_down", "to": "sig_sell"},
                {"from": "sig_sell", "to": "act_sell"},
            ],
        },
    },
]


# ============================================================
# Seeder
# ============================================================
async def seed_templates(
    db: AsyncSession, overwrite: bool = False
) -> int:
    """将策略模板写入数据库。

    Args:
        db: 数据库会话
        overwrite: True 时先删除所有已有模板再重建

    Returns:
        此次写入的模板数量
    """
    repo = StrategyRepository(db)
    existing = await repo.list_templates()

    if existing and not overwrite:
        logger.info(
            f"策略模板已存在 ({len(existing)} 个)，跳过初始化"
        )
        return 0

    if overwrite and existing:
        for tpl in existing:
            await db.delete(tpl)
        await db.flush()
        logger.info(f"已删除 {len(existing)} 个旧模板")

    count = 0
    for tpl in TEMPLATES:
        strategy = Strategy(
            user_id=None,  # 系统模板
            name=tpl["name"],
            description=tpl["description"],
            strategy_type="visual",
            definition=json.dumps(tpl["definition"], ensure_ascii=False),
            status="draft",
            version=1,
            trade_type=tpl["trade_type"],
            kline_interval=tpl["kline_interval"],
            tags=json.dumps(tpl["tags"], ensure_ascii=False),
        )
        db.add(strategy)
        count += 1

    await db.flush()
    logger.info(f"已初始化 {count} 个策略模板")
    return count
