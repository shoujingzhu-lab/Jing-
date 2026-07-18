"""
交易所适配器测试
================
P2-007: 测试 BaseExchangeAdapter 接口、工厂方法、适配器缓存。
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.adapters.base import BaseExchangeAdapter
from app.adapters.exchanges import (
    EXCHANGE_MAP, BinanceAdapter, OKXAdapter, BybitAdapter,
    GateIOAdapter, create_adapter,
)
from app.adapters.cache import AdapterCache


# ============================================================
# Base Adapter Interface
# ============================================================
class TestBaseAdapter:
    def test_normalize_symbol_slash(self):
        assert BaseExchangeAdapter.normalize_symbol("BTC-USDT") == "BTC/USDT"

    def test_normalize_symbol_underscore(self):
        assert BaseExchangeAdapter.normalize_symbol("BTC_USDT") == "BTC/USDT"

    def test_normalize_symbol_already_ok(self):
        assert BaseExchangeAdapter.normalize_symbol("BTC/USDT") == "BTC/USDT"

    def test_adapter_name(self):
        adapter = BinanceAdapter()
        assert adapter.name == "binance"


# ============================================================
# Factory Method
# ============================================================
class TestFactory:
    def test_create_binance(self):
        adapter = create_adapter("binance", "key", "secret")
        assert isinstance(adapter, BinanceAdapter)

    def test_create_okx(self):
        adapter = create_adapter("okx", "key", "secret", "pass")
        assert isinstance(adapter, OKXAdapter)

    def test_create_bybit(self):
        adapter = create_adapter("bybit")
        assert isinstance(adapter, BybitAdapter)

    def test_create_gateio(self):
        adapter = create_adapter("gateio")
        assert isinstance(adapter, GateIOAdapter)

    def test_create_gate_alias(self):
        adapter = create_adapter("gate")
        assert isinstance(adapter, GateIOAdapter)

    def test_create_case_insensitive(self):
        adapter = create_adapter("BINANCE")
        assert isinstance(adapter, BinanceAdapter)

    def test_create_unsupported_exchange(self):
        with pytest.raises(ValueError, match="不支持的交易所"):
            create_adapter("nonexistent_exchange")

    def test_exchange_map_has_four_entries(self):
        assert len(EXCHANGE_MAP) >= 4


# ============================================================
# Adapter Cache
# ============================================================
class TestAdapterCache:
    @pytest.fixture
    def cache(self):
        return AdapterCache(max_size=10, ttl_seconds=60.0)

    @pytest.mark.asyncio
    async def test_get_creates_adapter(self, cache):
        adapter = await cache.get("binance")
        assert isinstance(adapter, BinanceAdapter)
        assert cache.size == 1

    @pytest.mark.asyncio
    async def test_get_returns_cached(self, cache):
        a1 = await cache.get("binance")
        a2 = await cache.get("binance")
        assert a1 is a2  # Same instance
        assert cache.size == 1

    @pytest.mark.asyncio
    async def test_different_exchanges_different_instances(self, cache):
        a1 = await cache.get("binance")
        a2 = await cache.get("okx")
        assert a1 is not a2
        assert cache.size == 2

    @pytest.mark.asyncio
    async def test_different_api_keys_different_instances(self, cache):
        a1 = await cache.get("binance", api_key="key1", secret="s1")
        a2 = await cache.get("binance", api_key="key2", secret="s2")
        assert a1 is not a2

    @pytest.mark.asyncio
    async def test_invalidate_removes_entry(self, cache):
        await cache.get("binance")
        assert cache.size == 1
        await cache.invalidate("binance")
        assert cache.size == 0

    @pytest.mark.asyncio
    async def test_stats(self, cache):
        await cache.get("binance")
        stats = cache.stats()
        assert stats["total"] == 1
        assert stats["max_size"] == 10
        assert len(stats["entries"]) == 1

    @pytest.mark.asyncio
    async def test_max_size_eviction(self, cache):
        small_cache = AdapterCache(max_size=3, ttl_seconds=60.0)
        for i in range(5):
            await small_cache.get(f"binance", api_key=f"key{i}", secret="s")
        assert small_cache.size <= 3

    @pytest.mark.asyncio
    async def test_cleanup_expired(self, cache):
        cache.ttl_seconds = -1  # Immediate expiry (all entries older than -1 seconds are expired)
        await cache.get("binance")
        assert cache.size == 1
        await cache._cleanup_expired()
        assert cache.size == 0  # All expired


# ============================================================
# Exchange-specific adapter methods (mocked CCXT)
# ============================================================
class TestBinanceAdapter:
    @pytest.fixture
    def adapter(self):
        return BinanceAdapter(api_key="test_key", secret="test_secret")

    @pytest.mark.asyncio
    async def test_fetch_ticker_structure(self, adapter):
        with patch.object(adapter, '_get_spot', new_callable=AsyncMock) as mock_spot:
            mock_ex = AsyncMock()
            mock_ex.fetch_ticker = AsyncMock(return_value={
                "last": 50000.0, "bid": 49990.0, "ask": 50010.0,
                "high": 51000.0, "low": 49000.0,
                "baseVolume": 1000.0, "quoteVolume": 50000000.0,
                "percentage": 2.5, "timestamp": 1700000000000,
            })
            mock_spot.return_value = mock_ex

            result = await adapter.fetch_ticker("BTC/USDT")
            assert result["symbol"] == "BTC/USDT"
            assert result["last"] == 50000.0
            assert "bid" in result and "ask" in result

    @pytest.mark.asyncio
    async def test_fetch_orderbook_structure(self, adapter):
        with patch.object(adapter, '_get_spot', new_callable=AsyncMock) as mock_spot:
            mock_ex = AsyncMock()
            mock_ex.fetch_order_book = AsyncMock(return_value={
                "bids": [[50000, 1.0], [49990, 2.0]],
                "asks": [[50010, 1.5], [50020, 3.0]],
                "timestamp": 1700000000000,
            })
            mock_spot.return_value = mock_ex

            result = await adapter.fetch_orderbook("BTC/USDT", depth=5)
            assert "bids" in result and "asks" in result
            assert result["best_bid"] == 50000
            assert result["best_ask"] == 50010

    @pytest.mark.asyncio
    async def test_create_order(self, adapter):
        with patch.object(adapter, '_get_spot', new_callable=AsyncMock) as mock_spot:
            mock_ex = AsyncMock()
            mock_ex.create_order = AsyncMock(return_value={
                "id": "test_order_123", "status": "open",
            })
            mock_spot.return_value = mock_ex

            result = await adapter.create_order(
                "BTC/USDT", "buy", "limit", 0.1, price=50000,
            )
            assert result["order_id"] == "test_order_123"
            assert result["status"] == "open"

    @pytest.mark.asyncio
    async def test_cancel_order(self, adapter):
        with patch.object(adapter, '_get_spot', new_callable=AsyncMock) as mock_spot:
            mock_ex = AsyncMock()
            mock_ex.cancel_order = AsyncMock(return_value={"status": "canceled"})
            mock_spot.return_value = mock_ex

            result = await adapter.cancel_order("order123", "BTC/USDT")
            assert result["status"] == "canceled"

    @pytest.mark.asyncio
    async def test_fetch_balance(self, adapter):
        with patch.object(adapter, '_get_spot', new_callable=AsyncMock) as mock_spot:
            mock_ex = AsyncMock()
            mock_ex.fetch_balance = AsyncMock(return_value={
                "total": {"BTC": 1.5, "USDT": 50000},
            })
            mock_spot.return_value = mock_ex

            result = await adapter.fetch_balance()
            assert "BTC" in result
            assert "USDT" in result
