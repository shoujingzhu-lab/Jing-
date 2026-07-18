"""
日志配置模块
============
集中管理应用日志格式、级别、输出目标。
- 开发环境: 彩色控制台输出
- 生产环境: JSON 格式输出（便于 ELK 收集）
- 集成 Sentry 错误追踪
"""

import logging
import sys
from typing import Optional

from app.core.config import settings


class JsonFormatter(logging.Formatter):
    """JSON 格式日志 — 生产环境使用，适配 ELK / Loki"""

    def format(self, record: logging.LogRecord) -> str:
        import json
        from datetime import datetime, timezone

        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "line": record.lineno,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
        }

        # 附加异常信息
        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = {
                "type": type(record.exc_info[1]).__name__,
                "message": str(record.exc_info[1]),
            }

        # 附加自定义字段
        for key in ("request_id", "user_id", "path", "method", "status_code"):
            if hasattr(record, key):
                log_entry[key] = getattr(record, key)

        return json.dumps(log_entry, ensure_ascii=False, default=str)


class ColoredFormatter(logging.Formatter):
    """带颜色的控制台日志"""

    COLORS = {
        "DEBUG": "\033[36m",     # Cyan
        "INFO": "\033[32m",      # Green
        "WARNING": "\033[33m",   # Yellow
        "ERROR": "\033[31m",     # Red
        "CRITICAL": "\033[35m",  # Magenta
        "RESET": "\033[0m",
    }

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "")
        reset = self.COLORS["RESET"]
        record.levelname = f"{color}{record.levelname:<7}{reset}"
        return super().format(record)


def setup_logging(log_level: Optional[str] = None) -> None:
    """
    配置应用日志系统。

    日志格式:
    - development: 彩色控制台，可读格式
    - staging/production: JSON 格式 + 控制台，可被 ELK/Fluentd 收集
    """
    level_name = log_level or settings.LOG_LEVEL
    level = getattr(logging, level_name.upper(), logging.INFO)

    # 清除已有处理器
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.setLevel(level)

    # ---- 控制台处理器 ----
    if settings.is_development and settings.LOG_FORMAT == "text":
        # 开发环境：彩色可读格式
        fmt = (
            "%(asctime)s.%(msecs)03d | %(levelname)s | "
            "%(name)s:%(lineno)d | %(message)s"
        )
        formatter = ColoredFormatter(fmt, datefmt="%H:%M:%S")
    else:
        # 生产/staging 环境：JSON 格式
        formatter = JsonFormatter()

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # ---- 文件处理器 (仅生产环境) ----
    if settings.is_production:
        try:
            file_handler = logging.handlers.RotatingFileHandler(
                filename="logs/app.log",
                maxBytes=10 * 1024 * 1024,  # 10 MB
                backupCount=10,
                encoding="utf-8",
            )
            file_handler.setLevel(logging.INFO)
            file_handler.setFormatter(JsonFormatter())
            root_logger.addHandler(file_handler)

            # 错误日志单独文件
            error_handler = logging.handlers.RotatingFileHandler(
                filename="logs/error.log",
                maxBytes=10 * 1024 * 1024,
                backupCount=5,
                encoding="utf-8",
            )
            error_handler.setLevel(logging.ERROR)
            error_handler.setFormatter(JsonFormatter())
            root_logger.addHandler(error_handler)
        except (OSError, PermissionError):
            # 文件不可写时不影响应用启动
            pass

    # ---- 抑制第三方库的 DEBUG 日志 ----
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.pool").setLevel(logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("websockets").setLevel(logging.WARNING)
    logging.getLogger("ccxt").setLevel(logging.WARNING)
    logging.getLogger("redis").setLevel(logging.WARNING)
    logging.getLogger("celery").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    # 应用日志器
    logger = logging.getLogger("quant")
    logger.info(f"Logging configured (level={level_name}, env={settings.APP_ENV}, format={settings.LOG_FORMAT})")


def setup_sentry() -> None:
    """初始化 Sentry 错误追踪（仅 non-development 环境）"""
    if not settings.SENTRY_DSN:
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        from sentry_sdk.integrations.redis import RedisIntegration
        from sentry_sdk.integrations.celery import CeleryIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.sentry_environment,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            send_default_pii=settings.SENTRY_SEND_DEFAULT_PII,
            release=settings.APP_VERSION,
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
                RedisIntegration(),
                CeleryIntegration(),
                LoggingIntegration(
                    level=logging.WARNING,
                    event_level=logging.ERROR,
                ),
            ],
        )
        logging.getLogger("quant").info(f"Sentry initialized (env={settings.sentry_environment})")
    except Exception as e:
        logging.getLogger("quant").warning(f"Failed to initialize Sentry: {e}")


def get_logger(name: str) -> logging.Logger:
    """获取应用日志记录器"""
    logger = logging.getLogger(f"quant.{name}")
    if not logger.handlers:
        logger.addHandler(logging.NullHandler())
    return logger


class RequestIDFilter(logging.Filter):
    """向日志记录注入 request_id"""

    def filter(self, record: logging.LogRecord) -> bool:
        import contextvars

        request_id = contextvars.ContextVar("request_id", default="-")
        record.request_id = request_id.get()
        return True
