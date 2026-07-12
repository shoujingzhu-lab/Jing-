"""
API 路由汇总
===========
所有模块路由器在此注册。
"""

from fastapi import APIRouter

from app.api import auth, users, data, strategies, backtest, simulation, trading, risk, ai, admin, notifications

api_router = APIRouter()

# 模块八：认证与用户管理
api_router.include_router(auth.router, prefix="/auth", tags=["Auth | 认证"])
api_router.include_router(users.router, prefix="/users", tags=["Users | 用户"])

# 模块一：数据管理中心
api_router.include_router(data.router, prefix="/data", tags=["Data | 数据中心"])

# 模块二：策略引擎
api_router.include_router(strategies.router, prefix="/strategies", tags=["Strategies | 策略引擎"])

# 模块三：回测系统
api_router.include_router(backtest.router, prefix="/backtest", tags=["Backtest | 回测系统"])

# 模块四：模拟交易
api_router.include_router(simulation.router, prefix="/simulation", tags=["Simulation | 模拟交易"])

# 模块五：实盘交易
api_router.include_router(trading.router, prefix="/trading", tags=["Trading | 实盘交易"])

# 模块六：风险控制
api_router.include_router(risk.router, prefix="/risk", tags=["Risk | 风险控制"])

# 模块七：智能分析决策
api_router.include_router(ai.router, prefix="/ai", tags=["AI | 智能分析"])

# 模块九：系统管理
api_router.include_router(admin.router, prefix="/admin", tags=["Admin | 系统管理"])

# 模块十：通知与告警
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications | 通知告警"])
