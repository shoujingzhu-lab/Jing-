"""
核心配置模块
============
集中管理所有应用配置项，使用 pydantic-settings 从环境变量 /.env 文件加载。
支持 development / staging / production 三套环境。
"""

from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用全局配置"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- 应用 ---
    APP_NAME: str = "QuantTradingSystem"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = "development"  # development | staging | production
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "text"  # text | json

    # --- 服务地址 ---
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # --- 数据库 ---
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/quant_trading"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 40
    DATABASE_ECHO: bool = False
    DATABASE_POOL_RECYCLE: int = 3600
    DATABASE_STATEMENT_TIMEOUT: int = 30000  # ms

    # 只读副本（读写分离）
    DATABASE_READONLY_URL: Optional[str] = None

    # TimescaleDB (时序数据 — K线、订单簿)
    TIMESCALE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/quant_trading_ts"

    # --- Redis ---
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_PASSWORD: Optional[str] = None
    REDIS_MAX_CONNECTIONS: int = 50

    # --- JWT ---
    JWT_SECRET_KEY: str = Field(default="change-me-to-a-real-secret-key-at-least-32-chars")
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # --- 安全 ---
    CORS_ORIGINS: List[str] = Field(default=["http://localhost:3000", "http://localhost:5173"])
    BCRYPT_COST: int = 12

    # --- API Key 加密 ---
    API_KEY_ENCRYPTION_KEY: str = Field(default="change-me-aes-256-key-32-characters!")

    # --- Celery ---
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # --- 通知 ---
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_DEFAULT_CHAT_ID: Optional[str] = None
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: str = "noreply@quant-trading.com"

    # --- 风控默认参数 ---
    DEFAULT_LEVERAGE: int = 3
    DEFAULT_MAX_POSITION_PCT: float = 0.10
    DEFAULT_DAILY_LOSS_LIMIT: float = 0.05
    DEFAULT_MAX_DRAWDOWN: float = 0.30

    # --- 数据保留 ---
    TICK_DATA_RETENTION_DAYS: int = 90
    MINUTE_KLINE_RETENTION_DAYS: int = 365
    DAILY_KLINE_RETENTION_DAYS: int = 0  # 0 = 永久

    # ================================================================
    # 生产环境新增配置 (P0-001)
    # ================================================================

    # --- Sentry 错误追踪 ---
    SENTRY_DSN: Optional[str] = None
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1  # 生产环境采样率
    SENTRY_SEND_DEFAULT_PII: bool = False
    SENTRY_ENVIRONMENT: Optional[str] = None  # 自动从 APP_ENV 推断

    # --- Prometheus 指标 ---
    PROMETHEUS_ENABLED: bool = True
    PROMETHEUS_PORT: int = 9090

    # --- 限流 (Rate Limiting) ---
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT: str = "100/minute"  # 默认每 IP 每分钟 100 次
    RATE_LIMIT_AUTH: str = "200/minute"      # 认证用户每分钟 200 次
    RATE_LIMIT_TRADING: str = "30/minute"    # 交易接口每分钟 30 次

    # --- Request ID ---
    REQUEST_ID_HEADER: str = "X-Request-ID"

    # --- 请求大小限制 ---
    MAX_REQUEST_BODY_SIZE: int = 10 * 1024 * 1024  # 10 MB

    # --- 健康检查 ---
    HEALTH_CHECK_TIMEOUT: int = 5  # 秒

    # --- 后台任务 ---
    BACKGROUND_TASK_MAX_WORKERS: int = 4

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"

    @property
    def is_staging(self) -> bool:
        return self.APP_ENV == "staging"

    @property
    def sentry_environment(self) -> str:
        return self.SENTRY_ENVIRONMENT or self.APP_ENV

    @property
    def should_show_docs(self) -> bool:
        """非生产环境展示 API 文档"""
        return not self.is_production


# 全局单例
settings = Settings()
