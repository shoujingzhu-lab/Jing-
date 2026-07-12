"""
日志配置模块
============
集中管理应用日志格式、级别、输出目标。
"""

import logging
import sys
from typing import Optional

from app.core.config import settings


def setup_logging(log_level: Optional[str] = None) -> None:
    """
    配置应用日志系统。

    - 开发环境: 彩色控制台输出
    - 生产环境: JSON 格式输出（便于 ELK 收集）
    """
    level_name = log_level or settings.LOG_LEVEL
    level = getattr(logging, level_name.upper(), logging.INFO)

    if settings.is_development:
        # 开发环境：可读格式
        fmt = (
            "%(asctime)s.%(msecs)03d | %(levelname)-7s | %(name)s:%(lineno)d | %(message)s"
        )
        datefmt = "%H:%M:%S"
        formatter = logging.Formatter(fmt, datefmt=datefmt)
    else:
        # 生产环境: JSON 格式
        formatter = logging.Formatter(
            '{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","line":%(lineno)d,'
            '"message":"%(message)s"}'
        )

    # 控制台处理器
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)

    # 根日志记录器
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.handlers.clear()
    root_logger.addHandler(console_handler)

    # 抑制第三方库的 DEBUG 日志
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("websockets").setLevel(logging.WARNING)
    logging.getLogger("ccxt").setLevel(logging.WARNING)

    # 应用日志器
    logger = logging.getLogger("quant")
    logger.info(f"Logging configured (level={level_name}, env={settings.APP_ENV})")


def get_logger(name: str) -> logging.Logger:
    """获取应用日志记录器"""
    logger = logging.getLogger(f"quant.{name}")
    if not logger.handlers:
        # 如果根日志器未配置，使用默认设置
        logger.addHandler(logging.NullHandler())
    return logger
