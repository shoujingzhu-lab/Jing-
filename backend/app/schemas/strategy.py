"""
策略引擎 Schema
===============
模块二：策略引擎 — 请求/响应模型
- STG-001 ~ STG-018
"""

import json
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.base import KlineInterval, StrategyStatus, StrategyType, TradeType


# ============================================================
# 共享验证器
# ============================================================
def _parse_json_if_str(v: Any) -> Any:
    """如果值是 JSON 字符串则解析，否则原样返回"""
    if isinstance(v, str):
        try:
            return json.loads(v)
        except (json.JSONDecodeError, TypeError):
            return v
    return v


# ============================================================
# 请求模型
# ============================================================
class StrategyCreate(BaseModel):
    """STG-001: 新建策略（可视化或代码）"""

    name: str = Field(
        ...,
        min_length=1,
        max_length=200,
        examples=["Dual MA Crossover"],
        description="策略名称",
    )
    description: Optional[str] = Field(
        None, max_length=2000, description="策略描述"
    )
    strategy_type: StrategyType = Field(
        default=StrategyType.VISUAL, description="策略类型"
    )
    definition: Optional[dict] = Field(
        None,
        description="策略定义 (visual=JSON节点图, python=代码字符串)",
        examples=[{"nodes": [], "edges": []}],
    )
    trade_type: TradeType = Field(
        default=TradeType.SPOT, description="交易类型"
    )
    symbol_pool: Optional[list[str]] = Field(
        None,
        description="交易对池",
        examples=[["BTCUSDT", "ETHUSDT"]],
    )
    kline_interval: KlineInterval = Field(
        default=KlineInterval.HOUR_1, description="K线周期"
    )
    tags: Optional[list[str]] = Field(
        None, description="标签", examples=[["trend", "ma"]]
    )


class StrategyUpdate(BaseModel):
    """STG-008/015: 更新策略（definition 变更时自动版本记录）"""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    definition: Optional[dict] = None
    trade_type: Optional[TradeType] = None
    symbol_pool: Optional[list[str]] = None
    kline_interval: Optional[KlineInterval] = None
    tags: Optional[list[str]] = None
    status: Optional[StrategyStatus] = Field(
        None, description="生命周期状态变更"
    )
    change_summary: Optional[str] = Field(
        None,
        max_length=500,
        description="版本变更摘要（definition 变更时建议填写）",
        examples=["Added RSI filter condition"],
    )


class StrategyCloneRequest(BaseModel):
    """STG-007: 克隆策略请求"""

    name: Optional[str] = Field(
        None,
        max_length=200,
        description="新策略名称（省略则自动添加 '(Copy)'）",
    )


# ============================================================
# 响应模型
# ============================================================
class StrategyResponse(BaseModel):
    """策略完整响应"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    name: str
    description: Optional[str] = None
    strategy_type: str
    definition: Optional[dict] = None
    status: str
    version: int
    trade_type: str
    symbol_pool: Optional[list[str]] = None
    kline_interval: str
    tags: Optional[list[str]] = None
    created_at: datetime
    updated_at: datetime

    @field_validator("definition", "symbol_pool", "tags", mode="before")
    @classmethod
    def _parse_json_fields(cls, v: Any) -> Any:
        """将数据库中的 JSON 字符串转为 Python 对象"""
        return _parse_json_if_str(v)


class StrategyListResponse(BaseModel):
    """策略列表项响应（不含 definition，减少传输量）"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    name: str
    strategy_type: str
    status: str
    version: int
    trade_type: str
    kline_interval: str
    tags: Optional[list[str]] = None
    created_at: datetime
    updated_at: datetime

    @field_validator("tags", mode="before")
    @classmethod
    def _parse_json_fields(cls, v: Any) -> Any:
        """将数据库中的 JSON 字符串转为 Python 对象"""
        return _parse_json_if_str(v)


class StrategyVersionResponse(BaseModel):
    """STG-015: 策略版本记录响应"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    strategy_id: str
    version: int
    definition: Optional[dict] = None
    change_summary: Optional[str] = None
    created_by: str
    created_at: datetime

    @field_validator("definition", "strategy_id", "created_by", mode="before")
    @classmethod
    def _parse_json_and_uuid_fields(cls, v: Any) -> Any:
        """将 JSON 字符串转为对象，将 UUID 转为字符串"""
        if hasattr(v, "hex"):  # UUID
            return str(v)
        return _parse_json_if_str(v)


class StrategyExportCodeResponse(BaseModel):
    """STG-014: 可视化策略 → Python 代码导出响应"""

    strategy_id: UUID
    strategy_name: str
    strategy_type: str
    python_code: str
    warning: Optional[str] = Field(
        None,
        description="部分节点无法转换的警告",
    )


class StrategyValidationResponse(BaseModel):
    """STG-008: 策略验证结果"""

    is_valid: bool
    errors: list[str] = Field(default_factory=list, description="致命错误")
    warnings: list[str] = Field(default_factory=list, description="警告")
