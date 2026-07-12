"""
API 通用 Schema
===============
统一 API 响应格式、分页、错误响应。
"""

from datetime import datetime, UTC
from enum import StrEnum
from typing import Any, Generic, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# 统一响应格式
# ============================================================
T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    """统一 API 成功响应

    Example:
        ```json
        {
          "success": true,
          "code": 200,
          "message": "操作成功",
          "data": { "id": "550e8400-e29b-41d4-a716-446655440000" },
          "timestamp": "2026-06-08T12:00:00Z"
        }
        ```
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "code": 200,
                "message": "操作成功",
                "data": {"id": "550e8400-e29b-41d4-a716-446655440000"},
                "timestamp": "2026-06-08T12:00:00Z",
            }
        }
    )

    success: bool = True
    code: int = 200
    message: str = "OK"
    data: Optional[T] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class APIError(BaseModel):
    """统一 API 错误响应"""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": False,
                "code": 422,
                "message": "策略验证失败",
                "detail": "节点图中存在循环引用",
                "timestamp": "2026-06-08T12:00:00Z",
            }
        }
    )

    success: bool = False
    code: int
    message: str
    detail: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ============================================================
# 分页
# ============================================================
class PaginationParams(BaseModel):
    """分页请求参数"""

    page: int = Field(default=1, ge=1, description="页码")
    page_size: int = Field(default=20, ge=1, le=100, description="每页条数")


class PaginatedData(BaseModel, Generic[T]):
    """分页数据容器"""

    items: list[T] = []
    total: int = 0
    page: int = 1
    page_size: int = 20
    total_pages: int = 0


class PaginatedResponse(APIResponse[PaginatedData[T]], Generic[T]):
    """分页 API 响应"""

    pass


# ============================================================
# 通用字段
# ============================================================
class IDModel(BaseModel):
    """带 ID 的基础模型"""

    id: UUID


class TimestampModel(BaseModel):
    """带时间戳的模型"""

    created_at: datetime
    updated_at: datetime


# ============================================================
# 状态枚举
# ============================================================
class StrategyStatus(StrEnum):
    DRAFT = "draft"
    BACKTESTED = "backtested"
    SIMULATED = "simulated"
    LIVE = "live"
    PAUSED = "paused"
    ARCHIVED = "archived"


class StrategyType(StrEnum):
    VISUAL = "visual"
    PYTHON = "python"


class KlineInterval(StrEnum):
    MINUTE_1 = "1m"
    MINUTE_3 = "3m"
    MINUTE_5 = "5m"
    MINUTE_15 = "15m"
    MINUTE_30 = "30m"
    HOUR_1 = "1h"
    HOUR_4 = "4h"
    DAY_1 = "1d"
    WEEK_1 = "1w"
    MONTH_1 = "1M"


class OrderStatus(StrEnum):
    CREATED = "created"
    SUBMITTED = "submitted"
    PARTIALLY_FILLED = "partially_filled"
    FILLED = "filled"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    REJECTED = "rejected"


class ExchangeType(StrEnum):
    BINANCE = "binance"
    OKX = "okx"
    BYBIT = "bybit"
    GATEIO = "gateio"
    BITGET = "bitget"
    KUCOIN = "kucoin"


class TradeType(StrEnum):
    SPOT = "spot"
    PERPETUAL = "perpetual"
    FUTURES = "futures"


class MarginMode(StrEnum):
    CROSS = "cross"
    ISOLATED = "isolated"
