"""
Unit and integration tests for Redis-backed Chat Service horizontal scaling and Pub/Sub across worker processes.
"""
import asyncio
import json
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock

import pytest
import services.chat_service as svc
from core import security


class FakePubSub:
    """Mock Redis PubSub channel that uses an asyncio.Queue for asynchronous message delivery."""

    def __init__(self, fake_redis, channel: str):
        self.fake_redis = fake_redis
        self.channel = channel
        self.queue = asyncio.Queue()
        self.subscribed = False

    async def subscribe(self, channel: str):
        self.channel = channel
        self.subscribed = True
        self.fake_redis._subscribers.setdefault(channel, []).append(self)

    async def unsubscribe(self, channel: str):
        self.subscribed = False
        if channel in self.fake_redis._subscribers:
            if self in self.fake_redis._subscribers[channel]:
                self.fake_redis._subscribers[channel].remove(self)

    async def listen(self):
        while self.subscribed:
            try:
                msg = await asyncio.wait_for(self.queue.get(), timeout=0.1)
                yield msg
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break

    async def close(self):
        await self.unsubscribe(self.channel)


class FakeAsyncRedisClient:
    """
    In-memory async Redis mock implementing key-value, hashes, and Pub/Sub
    for multi-worker chat_service testing.
    """

    def __init__(self):
        self.store: Dict[str, str] = {}
        self.hashes: Dict[str, Dict[str, str]] = {}
        self.zsets: Dict[str, Dict[str, float]] = {}
        self.ttls: Dict[str, float] = {}
        self._subscribers: Dict[str, List[FakePubSub]] = {}

    async def ping(self):
        return True

    async def set(self, key: str, value: str, ex: Optional[int] = None):
        self.store[key] = value
        if ex is not None:
            self.ttls[key] = time.time() + ex
        return True

    def sync_set(self, key: str, value: str, ex: Optional[int] = None):
        self.store[key] = value
        if ex is not None:
            self.ttls[key] = time.time() + ex
        return True

    async def get(self, key: str) -> Optional[str]:
        if key not in self.store:
            return None
        if key in self.ttls and time.time() > self.ttls[key]:
            del self.store[key]
            del self.ttls[key]
            return None
        return self.store[key]

    def sync_get(self, key: str) -> Optional[str]:
        if key not in self.store:
            return None
        if key in self.ttls and time.time() > self.ttls[key]:
            del self.store[key]
            del self.ttls[key]
            return None
        return self.store[key]

    async def delete(self, *keys: str):
        count = 0
        for key in keys:
            if key in self.store:
                del self.store[key]
                self.ttls.pop(key, None)
                count += 1
            if key in self.hashes:
                del self.hashes[key]
                self.ttls.pop(key, None)
                count += 1
            if key in self.zsets:
                del self.zsets[key]
                self.ttls.pop(key, None)
                count += 1
        return count

    async def ttl(self, key: str) -> int:
        if key not in self.store and key not in self.hashes and key not in self.zsets:
            return -2
        if key in self.ttls:
            remaining = int(self.ttls[key] - time.time())
            return max(0, remaining)
        return -1

    async def expire(self, key: str, seconds: int):
        if key in self.store or key in self.hashes or key in self.zsets:
            self.ttls[key] = time.time() + seconds
            return True
        return False

    async def hset(self, key: str, field: str, value: str):
        if key not in self.hashes:
            self.hashes[key] = {}
        self.hashes[key][field] = value
        return 1

    async def hget(self, key: str, field: str) -> Optional[str]:
        return self.hashes.get(key, {}).get(field)

    async def hdel(self, key: str, *fields: str):
        count = 0
        h = self.hashes.get(key, {})
        for f in fields:
            if f in h:
                del h[f]
                count += 1
        return count

    async def hlen(self, key: str) -> int:
        return len(self.hashes.get(key, {}))

    def sync_hlen(self, key: str) -> int:
        return len(self.hashes.get(key, {}))

    async def hvals(self, key: str) -> List[str]:
        return list(self.hashes.get(key, {}).values())

    async def hexists(self, key: str, field: str) -> bool:
        return field in self.hashes.get(key, {})

    async def zadd(self, key: str, mapping: Dict[str, float]):
        if key not in self.zsets:
            self.zsets[key] = {}
        self.zsets[key].update(mapping)
        return len(mapping)

    def sync_zadd(self, key: str, mapping: Dict[str, float]):
        if key not in self.zsets:
            self.zsets[key] = {}
        self.zsets[key].update(mapping)
        return len(mapping)

    async def zrem(self, key: str, *members: str):
        count = 0
        if key in self.zsets:
            for m in members:
                if m in self.zsets[key]:
                    del self.zsets[key][m]
                    count += 1
        return count

    def sync_zrem(self, key: str, *members: str):
        count = 0
        if key in self.zsets:
            for m in members:
                if m in self.zsets[key]:
                    del self.zsets[key][m]
                    count += 1
        return count

    async def zcard(self, key: str) -> int:
        return len(self.zsets.get(key, {}))

    def sync_zcard(self, key: str) -> int:
        return len(self.zsets.get(key, {}))

    async def zremrangebyscore(self, key: str, min_score, max_score):
        if key not in self.zsets:
            return 0
        min_s = float("-inf") if str(min_score) == "-inf" else float(min_score)
        max_s = float("inf") if str(max_score) == "+inf" else float(max_score)
        to_del = [m for m, s in self.zsets[key].items() if min_s <= s <= max_s]
        for m in to_del:
            del self.zsets[key][m]
        return len(to_del)

    def sync_zremrangebyscore(self, key: str, min_score, max_score):
        if key not in self.zsets:
            return 0
        min_s = float("-inf") if str(min_score) == "-inf" else float(min_score)
        max_s = float("inf") if str(max_score) == "+inf" else float(max_score)
        to_del = [m for m, s in self.zsets[key].items() if min_s <= s <= max_s]
        for m in to_del:
            del self.zsets[key][m]
        return len(to_del)

    async def publish(self, channel: str, message: str) -> int:
        subs = self._subscribers.get(channel, [])
        for sub in list(subs):
            await sub.queue.put({"type": "message", "channel": channel, "data": message})
        return len(subs)

    def pubsub(self):
        return FakePubSub(self, "")

    async def close(self):
        self._subscribers.clear()


class FakeSyncRedisClient:
    """Synchronous facade over FakeAsyncRedisClient for security.get_redis_client()."""

    def __init__(self, async_client: FakeAsyncRedisClient):
        self.ac = async_client

    def get(self, key: str):
        return self.ac.sync_get(key)

    def set(self, key: str, value: str, ex: Optional[int] = None):
        return self.ac.sync_set(key, value, ex=ex)

    def delete(self, *keys: str):
        for k in keys:
            self.ac.store.pop(k, None)
            self.ac.hashes.pop(k, None)
            self.ac.zsets.pop(k, None)
            self.ac.ttls.pop(k, None)
        return len(keys)

    def hlen(self, key: str):
        return self.ac.sync_hlen(key)

    def zadd(self, key: str, mapping: Dict[str, float]):
        return self.ac.sync_zadd(key, mapping)

    def zrem(self, key: str, *members: str):
        return self.ac.sync_zrem(key, *members)

    def zcard(self, key: str) -> int:
        return self.ac.sync_zcard(key)

    def zremrangebyscore(self, key: str, min_score, max_score):
        return self.ac.sync_zremrangebyscore(key, min_score, max_score)

    def expire(self, key: str, seconds: int):
        self.ac.ttls[key] = time.time() + seconds
        return True


def _make_mock_websocket():
    ws = AsyncMock()
    ws.send_json = AsyncMock()
    ws.close = AsyncMock()
    return ws


@pytest.fixture(autouse=True)
async def cleanup_chat_test_state():
    yield
    await svc.close_chat_service()
    svc.set_async_redis_client(None)
    security.set_redis_client(None)


@pytest.mark.asyncio
async def test_session_creation_and_discovery_across_workers():
    """Verify session created on Worker 1 can be discovered by Worker 2 via Redis."""
    shared_redis = FakeAsyncRedisClient()
    sync_facade = FakeSyncRedisClient(shared_redis)

    svc.set_async_redis_client(shared_redis)
    security.set_redis_client(sync_facade)

    # Worker 1 creates session
    token, pin, expires_at = svc.create_session(ttl_seconds=300)
    assert token in svc._SESSIONS

    # Verify Redis contains session metadata with TTL
    redis_meta_str = await shared_redis.get(f"chat:session:{token}")
    assert redis_meta_str is not None
    redis_meta = json.loads(redis_meta_str)
    assert redis_meta["creator_pin"] == pin
    assert redis_meta["locked"] is False

    # Simulate Worker 2 (which has an empty local _SESSIONS)
    svc._SESSIONS.clear()
    assert token not in svc._SESSIONS

    # Worker 2 discovers session via get_session and session_info
    session_on_w2 = svc.get_session(token)
    assert session_on_w2 is not None
    assert session_on_w2.token == token
    assert session_on_w2.creator_pin == pin
    assert session_on_w2.locked is False

    info_on_w2 = svc.session_info(token)
    assert info_on_w2 is not None
    assert info_on_w2["token"] == token
    assert info_on_w2["seconds_remaining"] > 0


@pytest.mark.asyncio
async def test_websocket_broadcast_across_workers_via_pubsub():
    """Verify WebSocket message from Worker 1 is broadcast to Worker 2 via Redis Pub/Sub."""
    shared_redis = FakeAsyncRedisClient()
    sync_facade = FakeSyncRedisClient(shared_redis)

    svc.set_async_redis_client(shared_redis)
    security.set_redis_client(sync_facade)

    token, pin, _ = svc.create_session(300)

    # Worker 1 connection
    ws_1 = _make_mock_websocket()
    p1, s1 = await svc.join_session(token, ws_1, "Alice", pin=pin)
    assert s1 == svc.JoinStatus.OK

    # Simulate Worker 2: save Worker 1's participants, clear local _SESSIONS, connect Worker 2 client
    w1_participants = dict(svc._SESSIONS[token].participants)
    w1_task = svc._PUBSUB_TASKS.get(token)

    # Start Worker 2 view of session
    svc._SESSIONS[token].participants.clear()
    ws_2 = _make_mock_websocket()
    p2, s2 = await svc.join_session(token, ws_2, "Bob")
    assert s2 == svc.JoinStatus.OK

    # Both workers have their local participants
    # Restore Worker 1's participant in memory to simulate 2 live workers sharing pubsub
    svc._SESSIONS[token].participants[p1.ws_id] = p1

    # Give Pub/Sub tasks a moment to register
    await asyncio.sleep(0.05)

    # Alice on Worker 1 broadcasts a message
    success = await svc.broadcast_message(
        token,
        p1.ws_id,
        ciphertext="AAAA",
        iv="BBBB",
    )
    assert success is True

    # Give Pub/Sub dispatch time to deliver
    await asyncio.sleep(0.05)

    # Bob on Worker 2 must have received the message
    ws_2_calls = [call.args[0] for call in ws_2.send_json.call_args_list]
    chat_msgs_for_bob = [c for c in ws_2_calls if c.get("type") == "message"]
    assert len(chat_msgs_for_bob) >= 1
    assert chat_msgs_for_bob[0]["ciphertext"] == "AAAA"
    assert chat_msgs_for_bob[0]["sender_name"] == "Alice"

    # Alice on Worker 1 also receives the broadcast message (server-confirmed chat echo)
    ws_1_calls = [call.args[0] for call in ws_1.send_json.call_args_list]
    chat_msgs_for_alice = [c for c in ws_1_calls if c.get("type") == "message"]
    assert len(chat_msgs_for_alice) >= 1

    # Verify sender exclusion with exclude_ws_id (e.g. system join notification)
    # Alice should NOT receive her own join notification because exclude_ws_id was used
    join_system_for_alice = [
        c for c in ws_1_calls if c.get("type") == "system" and "Alice joined" in c.get("text", "")
    ]
    assert len(join_system_for_alice) == 0


@pytest.mark.asyncio
async def test_unicast_session_key_across_workers():
    """Verify creator on Worker 1 can unicast wrapped E2E session key to participant on Worker 2."""
    shared_redis = FakeAsyncRedisClient()
    sync_facade = FakeSyncRedisClient(shared_redis)

    svc.set_async_redis_client(shared_redis)
    security.set_redis_client(sync_facade)

    token, pin, _ = svc.create_session(300)

    # Alice (creator) on Worker 1
    ws_1 = _make_mock_websocket()
    creator, _ = await svc.join_session(token, ws_1, "CreatorAlice", pin=pin)

    # Bob (participant) on Worker 2
    ws_2 = _make_mock_websocket()
    bob, _ = await svc.join_session(token, ws_2, "Bob")

    # Keep both in local session simulation
    await asyncio.sleep(0.05)

    # Creator unicasts session key for Bob
    wrapped_key_payload = "dGVzdC13cmFwcGVkLWtleQ=="
    success = await svc.relay_e2e_session_key(
        token,
        actor_ws_id=creator.ws_id,
        for_ws_id=bob.ws_id,
        wrapped_key=wrapped_key_payload,
    )
    assert success is True

    await asyncio.sleep(0.05)

    # Bob on Worker 2 should receive the session_key frame
    ws_2_calls = [call.args[0] for call in ws_2.send_json.call_args_list]
    key_msgs = [c for c in ws_2_calls if c.get("type") == "session_key"]
    assert len(key_msgs) == 1
    assert key_msgs[0]["from_ws_id"] == creator.ws_id
    assert key_msgs[0]["wrapped_key"] == wrapped_key_payload


@pytest.mark.asyncio
async def test_creator_kick_across_workers():
    """Verify creator on Worker 1 can kick participant connected to Worker 2."""
    shared_redis = FakeAsyncRedisClient()
    sync_facade = FakeSyncRedisClient(shared_redis)

    svc.set_async_redis_client(shared_redis)
    security.set_redis_client(sync_facade)

    token, pin, _ = svc.create_session(300)

    # Creator on Worker 1
    ws_1 = _make_mock_websocket()
    creator, _ = await svc.join_session(token, ws_1, "CreatorAlice", pin=pin)

    # User on Worker 2
    ws_2 = _make_mock_websocket()
    user, _ = await svc.join_session(token, ws_2, "BadActor")

    await asyncio.sleep(0.05)

    # Creator kicks user
    kicked = await svc.kick_participant(token, creator.ws_id, user.ws_id)
    assert kicked is True

    await asyncio.sleep(0.05)

    # User's websocket should be closed with code 4001
    ws_2.close.assert_called_with(code=4001, reason="Kicked by creator")

    # User should be removed from Redis participants hash
    assert not await shared_redis.hexists(f"chat:session:{token}:participants", user.ws_id)


@pytest.mark.asyncio
async def test_room_lock_and_ttl_extension_across_workers():
    """Verify room lock and TTL extensions synchronize across workers via Pub/Sub."""
    shared_redis = FakeAsyncRedisClient()
    sync_facade = FakeSyncRedisClient(shared_redis)

    svc.set_async_redis_client(shared_redis)
    security.set_redis_client(sync_facade)

    token, pin, _ = svc.create_session(300)

    ws_1 = _make_mock_websocket()
    creator, _ = await svc.join_session(token, ws_1, "CreatorAlice", pin=pin)

    ws_2 = _make_mock_websocket()
    user, _ = await svc.join_session(token, ws_2, "UserBob")

    await asyncio.sleep(0.05)

    # Lock room
    locked = await svc.lock_room(token, creator.ws_id, locked=True)
    assert locked is True
    assert svc._SESSIONS[token].locked is True

    # Check Redis
    redis_meta = json.loads(await shared_redis.get(f"chat:session:{token}"))
    assert redis_meta["locked"] is True

    # Extend TTL
    extended = await svc.extend_ttl(token, creator.ws_id, extra_seconds=600)
    assert extended is True

    await asyncio.sleep(0.05)

    # Bob receives room_locked and ttl_extended
    ws_2_calls = [call.args[0] for call in ws_2.send_json.call_args_list]
    assert any(c.get("type") == "room_locked" and c.get("locked") is True for c in ws_2_calls)
    assert any(c.get("type") == "ttl_extended" for c in ws_2_calls)


@pytest.mark.asyncio
async def test_destroyed_event_cleans_up_worker_2_session_and_websockets():
    """Verify that when Worker 1 destroys a session, Worker 2 closes local WebSockets and evicts state."""
    shared_redis = FakeAsyncRedisClient()
    sync_facade = FakeSyncRedisClient(shared_redis)

    svc.set_async_redis_client(shared_redis)
    security.set_redis_client(sync_facade)

    token, pin, _ = svc.create_session(300)

    # Worker 2 has participant Bob
    ws_bob = _make_mock_websocket()
    bob, _ = await svc.join_session(token, ws_bob, "Bob")
    assert token in svc._SESSIONS
    assert bob.ws_id in svc._SESSIONS[token].participants

    await asyncio.sleep(0.05)

    # Worker 1 destroys the session
    await svc._destroy_session(token)

    # Give Pub/Sub time to deliver to Worker 2
    await asyncio.sleep(0.1)

    # Bob's websocket must be closed with code 1000
    ws_bob.close.assert_called_with(code=1000, reason="Session expired")

    # Session must be purged from local memory on Worker 2
    assert token not in svc._SESSIONS
    assert svc.get_session(token) is None


@pytest.mark.asyncio
async def test_get_session_evicts_stale_local_session_when_burned_in_redis():
    """Verify get_session returns None and purges local cache if key is absent in Redis."""
    shared_redis = FakeAsyncRedisClient()
    sync_facade = FakeSyncRedisClient(shared_redis)

    svc.set_async_redis_client(shared_redis)
    security.set_redis_client(sync_facade)

    token, pin, _ = svc.create_session(300)
    assert token in svc._SESSIONS

    # Another worker/process deletes the session in Redis (burn/destroy)
    await shared_redis.delete(f"chat:session:{token}")

    # get_session should detect the missing Redis key, purge local memory, and return None
    assert svc.get_session(token) is None
    assert token not in svc._SESSIONS


@pytest.mark.asyncio
async def test_pin_rate_limiter_distributed_via_redis():
    """Verify that PIN failure tracking uses Redis and blocks across workers."""
    shared_redis = FakeAsyncRedisClient()
    sync_facade = FakeSyncRedisClient(shared_redis)

    svc.set_async_redis_client(shared_redis)
    security.set_redis_client(sync_facade)

    client_ip = "203.0.113.42"
    token = "test-token-pin-rl"

    # Initially not blocked
    assert not svc.is_pin_rate_limited(client_ip, token)

    # Record failures up to MAX_FAILURES (3)
    failures, remaining = svc.record_pin_failure(client_ip, token)
    assert failures == 1
    assert remaining == 2
    assert not svc.is_pin_rate_limited(client_ip, token)

    svc.record_pin_failure(client_ip, token)
    failures, remaining = svc.record_pin_failure(client_ip, token)
    assert failures == 3
    assert remaining == 0

    # Now blocked
    assert svc.is_pin_rate_limited(client_ip, token)


@pytest.mark.asyncio
async def test_global_session_cap_enforced_across_workers():
    """Verify that MAX_SESSIONS cap is enforced globally across workers using Redis."""
    shared_redis = FakeAsyncRedisClient()
    sync_facade = FakeSyncRedisClient(shared_redis)

    svc.set_async_redis_client(shared_redis)
    security.set_redis_client(sync_facade)

    orig_max = svc.MAX_SESSIONS
    try:
        svc.MAX_SESSIONS = 2
        t1, _, _ = svc.create_session(300)
        t2, _, _ = svc.create_session(300)

        with pytest.raises(RuntimeError, match="Maximum concurrent chat sessions reached"):
            svc.create_session(300)

        # Destroy one session
        await svc._destroy_session(t1)

        # Now can create again
        t3, _, _ = svc.create_session(300)
        assert t3 is not None
    finally:
        svc.MAX_SESSIONS = orig_max
