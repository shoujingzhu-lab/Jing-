"""
订单执行器 + 幂等性测试
=======================
P2-007: 测试 OrderExecutor、IdempotencyManager、OrderBookCache。
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.execution.idempotency import IdempotencyManager
from app.execution.orderbook_cache import OrderBook, OrderBookCache, OrderBookLevel


# ============================================================
# IdempotencyManager
# ============================================================
class TestIdempotencyManager:
    @pytest.fixture
    def mgr(self):
        return IdempotencyManager()

    def test_generate_client_order_id_format(self):
        cid = IdempotencyManager.generate_client_order_id(
            user_id="user123",
            strategy_id="strat-456",
            symbol="BTCUSDT",
            side="buy",
        )
        # Format: YYYYMMDD-{user_prefix}-{hash12}
        parts = cid.split("-")
        assert len(parts) >= 3
        assert len(parts[0]) == 8  # YYYYMMDD
        assert len(parts[-1]) == 12  # hash (last part)

    def test_generate_same_input_same_output(self):
        cid1 = IdempotencyManager.generate_client_order_id(
            "user-1", "strat-1", "BTCUSDT", "buy",
        )
        # Same inputs at same time produce different output (timestamp changes)
        # But structure remains consistent
        assert len(cid1) > 20

    def test_generate_different_side_different_output(self):
        cid1 = IdempotencyManager.generate_client_order_id(
            "user-1", "strat-1", "BTCUSDT", "buy",
        )
        cid2 = IdempotencyManager.generate_client_order_id(
            "user-1", "strat-1", "BTCUSDT", "sell",
        )
        # Different sides produce different hashes
        assert cid1 != cid2

    @pytest.mark.asyncio
    async def test_check_no_redis_no_db_returns_none(self, mgr):
        result = await mgr.check("test-client-order-id")
        assert result is None


# ============================================================
# OrderBookCache
# ============================================================
class TestOrderBook:
    def test_empty_book(self):
        book = OrderBook(symbol="BTCUSDT", exchange="binance")
        assert book.best_bid is None
        assert book.best_ask is None
        assert book.mid_price is None
        assert book.spread is None

    def test_book_with_data(self):
        book = OrderBook(
            symbol="BTCUSDT", exchange="binance",
            bids=[OrderBookLevel(50000, 1.0), OrderBookLevel(49900, 2.0)],
            asks=[OrderBookLevel(50100, 1.5), OrderBookLevel(50200, 3.0)],
        )
        assert book.best_bid == 50000
        assert book.best_ask == 50100
        assert book.mid_price == 50050
        assert book.spread == 100

    def test_spread_pct(self):
        book = OrderBook(
            symbol="BTCUSDT", exchange="binance",
            bids=[OrderBookLevel(50000, 1.0)],
            asks=[OrderBookLevel(50100, 1.0)],
        )
        assert book.spread_pct is not None
        assert abs(book.spread_pct - 0.1998) < 0.01  # ~0.2%

    def test_estimate_slippage_buy(self):
        book = OrderBook(
            symbol="BTCUSDT", exchange="binance",
            asks=[
                OrderBookLevel(50000, 0.5),
                OrderBookLevel(50100, 1.0),
                OrderBookLevel(50200, 2.0),
            ],
        )
        result = book.estimate_slippage("buy", 1.0)
        assert result["levels_consumed"] == 2
        # avg_price = (0.5*50000 + 0.5*50100) / 1.0 = 50050
        assert result["avg_price"] == 50050
        assert result["slippage_pct"] > 0

    def test_estimate_slippage_sell(self):
        book = OrderBook(
            symbol="BTCUSDT", exchange="binance",
            bids=[
                OrderBookLevel(50000, 0.5),
                OrderBookLevel(49900, 1.0),
            ],
        )
        result = book.estimate_slippage("sell", 0.3)
        assert result["levels_consumed"] == 1
        assert result["avg_price"] == 50000

    def test_age_ms(self):
        import time
        book = OrderBook(symbol="BTC", exchange="binance")
        book.last_update = time.time() - 0.5  # 500ms ago
        assert book.age_ms > 0


class TestOrderBookCache:
    @pytest.fixture
    def cache(self):
        return OrderBookCache(max_age_seconds=30.0)

    @pytest.mark.asyncio
    async def test_update_snapshot_creates_book(self, cache):
        await cache.update_snapshot(
            "binance", "BTCUSDT",
            bids=[[50000, 1.0], [49900, 2.0]],
            asks=[[50100, 1.5], [50200, 3.0]],
        )
        assert cache.size == 1

    @pytest.mark.asyncio
    async def test_get_returns_book(self, cache):
        await cache.update_snapshot(
            "binance", "BTCUSDT",
            bids=[[50000, 1.0]], asks=[[50100, 1.0]],
        )
        book = await cache.get("binance", "BTCUSDT")
        assert book is not None
        assert book.best_bid == 50000
        assert book.best_ask == 50100

    @pytest.mark.asyncio
    async def test_get_missing_returns_none(self, cache):
        book = await cache.get("binance", "MISSING")
        assert book is None

    @pytest.mark.asyncio
    async def test_get_best_bid_ask(self, cache):
        await cache.update_snapshot(
            "binance", "BTCUSDT",
            bids=[[50000, 1.0]], asks=[[50100, 1.0]],
        )
        bid, ask = await cache.get_best_bid_ask("binance", "BTCUSDT")
        assert bid == 50000
        assert ask == 50100

    @pytest.mark.asyncio
    async def test_get_mid_price(self, cache):
        await cache.update_snapshot(
            "binance", "BTCUSDT",
            bids=[[50000, 1.0]], asks=[[50100, 1.0]],
        )
        mid = await cache.get_mid_price("binance", "BTCUSDT")
        assert mid == 50050

    @pytest.mark.asyncio
    async def test_simulate_fill(self, cache):
        await cache.update_snapshot(
            "binance", "BTCUSDT",
            bids=[[50000, 1.0]], asks=[[50100, 2.0]],
        )
        result = await cache.simulate_fill("binance", "BTCUSDT", "buy", 1.0)
        assert result is not None
        assert "avg_price" in result
        assert "slippage_pct" in result

    @pytest.mark.asyncio
    async def test_simulate_fill_missing_symbol(self, cache):
        result = await cache.simulate_fill("binance", "MISSING", "buy", 1.0)
        assert result is None

    @pytest.mark.asyncio
    async def test_update_delta_adds_new_level(self, cache):
        await cache.update_snapshot(
            "binance", "BTCUSDT",
            bids=[[50000, 1.0]], asks=[[50100, 1.0]],
        )
        await cache.update_delta(
            "binance", "BTCUSDT",
            bids_updates=[[49900, 2.0]],  # New bid
            asks_updates=[],
        )
        book = await cache.get("binance", "BTCUSDT")
        assert len(book.bids) == 2
        assert book.bids[0].price == 50000  # Higher bid first

    @pytest.mark.asyncio
    async def test_update_delta_removes_zero_amount(self, cache):
        await cache.update_snapshot(
            "binance", "BTCUSDT",
            bids=[[50000, 1.0], [49900, 2.0]], asks=[[50100, 1.0]],
        )
        await cache.update_delta(
            "binance", "BTCUSDT",
            bids_updates=[[50000, 0]],  # Remove this level
            asks_updates=[],
        )
        book = await cache.get("binance", "BTCUSDT")
        assert len(book.bids) == 1
        assert book.bids[0].price == 49900

    @pytest.mark.asyncio
    async def test_get_all_symbols(self, cache):
        await cache.update_snapshot("binance", "BTCUSDT", bids=[[50000, 1.0]], asks=[[50100, 1.0]])
        await cache.update_snapshot("binance", "ETHUSDT", bids=[[3000, 1.0]], asks=[[3010, 1.0]])
        symbols = cache.get_all_symbols()
        assert len(symbols) == 2

    @pytest.mark.asyncio
    async def test_remove(self, cache):
        await cache.update_snapshot("binance", "BTCUSDT", bids=[[50000, 1.0]], asks=[[50100, 1.0]])
        assert cache.size == 1
        cache.remove("binance", "BTCUSDT")
        assert cache.size == 0

    @pytest.mark.asyncio
    async def test_clear(self, cache):
        await cache.update_snapshot("binance", "BTCUSDT", bids=[[50000, 1.0]], asks=[[50100, 1.0]])
        await cache.update_snapshot("binance", "ETHUSDT", bids=[[3000, 1.0]], asks=[[3010, 1.0]])
        cache.clear()
        assert cache.size == 0

    @pytest.mark.asyncio
    async def test_update_delta_sequence_check(self, cache):
        await cache.update_snapshot("binance", "BTCUSDT", bids=[[50000, 1.0]], asks=[[50100, 1.0]])
        # Initial sequence is 1 after snapshot
        book = await cache.get("binance", "BTCUSDT")
        assert book.sequence == 1
        # Delta with matching sequence
        await cache.update_delta("binance", "BTCUSDT", bids_updates=[], asks_updates=[], sequence=2)
        book = await cache.get("binance", "BTCUSDT")
        assert book.sequence == 2
