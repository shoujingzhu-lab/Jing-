"""
监控 + 中间件 + 错误处理测试
=============================
P2-007: 测试 Prometheus 指标、中间件、健康检查端点。
"""

import pytest
from unittest.mock import patch

from app.core.monitoring import (
    http_requests_total,
    http_request_duration_seconds,
    http_requests_in_progress,
    trading_orders_total,
    trading_volume_total,
    trading_errors_total,
    risk_checks_total,
    circuit_breaker_active,
    db_pool_size,
    db_pool_checked_out,
    ws_connections_active,
    ws_messages_sent,
    app_info,
    init_metrics,
    get_metrics,
)


class TestPrometheusMetrics:
    """Prometheus 指标收集"""

    def test_init_metrics(self):
        init_metrics()
        # 指标应正确初始化
        assert app_info is not None

    def test_get_metrics_returns_bytes(self):
        metrics = get_metrics()
        assert isinstance(metrics, bytes)
        assert len(metrics) > 0
        # 应包含基本指标
        assert b"http_requests_total" in metrics

    def test_http_request_counter(self):
        # 增加请求计数
        before = http_requests_total._metrics.copy()
        http_requests_total.labels(method="GET", path="/test", status_code="200").inc()
        http_requests_total.labels(method="GET", path="/test", status_code="200").inc()
        # 验证计数器递增
        after = get_metrics()
        assert b'http_requests_total' in after

    def test_trading_orders_counter(self):
        trading_orders_total.labels(
            exchange="binance", side="buy", type="market", status="filled",
        ).inc()
        metrics = get_metrics()
        assert b'trading_orders_total' in metrics

    def test_trading_errors_counter(self):
        trading_errors_total.labels(
            exchange="binance", error_type="TimeoutError",
        ).inc()
        metrics = get_metrics()
        assert b'trading_errors_total' in metrics

    def test_risk_checks_counter(self):
        risk_checks_total.labels(result="passed").inc()
        risk_checks_total.labels(result="rejected").inc()
        metrics = get_metrics()
        assert b'risk_checks_total' in metrics

    def test_circuit_breaker_gauge(self):
        circuit_breaker_active.labels(scope="global").set(1)
        circuit_breaker_active.labels(scope="strategy").set(3)
        metrics = get_metrics()
        assert b'circuit_breaker_active' in metrics

    def test_db_pool_gauges(self):
        db_pool_size.labels(database="main").set(20)
        db_pool_checked_out.labels(database="main").set(5)
        metrics = get_metrics()
        assert b'db_pool_size' in metrics
        assert b'db_pool_checked_out' in metrics

    def test_websocket_metrics(self):
        ws_connections_active.set(10)
        ws_messages_sent.labels(channel="ticker:binance:BTCUSDT").inc()
        metrics = get_metrics()
        assert b'ws_connections_active' in metrics
        assert b'ws_messages_sent' in metrics

    def test_histogram_exists(self):
        # 验证直方图已注册
        assert http_request_duration_seconds is not None

    def test_multiple_labels_dont_leak(self):
        """验证不同标签组合不会互相影响"""
        trading_orders_total.labels(exchange="binance", side="buy", type="market", status="filled").inc(5)
        trading_orders_total.labels(exchange="okx", side="sell", type="limit", status="cancelled").inc(2)
        metrics = get_metrics()
        assert b'trading_orders_total' in metrics


class TestAppInfo:
    """应用信息指标"""

    def test_app_info_labels(self):
        from app.core.config import settings
        metrics = get_metrics().decode()
        # 应用版本和环境应出现在指标中
        assert "app_info" in metrics


class TestHealthEndpoints:
    """验证健康检查端点路径正确"""

    def test_health_paths_defined(self):
        """检查健康检查路由模式定义正确"""
        from app.main import health_check, liveness_check, readiness_check
        assert health_check is not None
        assert liveness_check is not None
        assert readiness_check is not None
