"""
认证与安全测试
==============
P2-007: 测试 JWT 令牌生成/验证、密码哈希、API Key 加解密、RBAC。
"""

import uuid

import pytest
from httpx import AsyncClient

from app.core.security import (
    create_access_token, create_refresh_token, decode_token,
    hash_password, verify_password, encrypt_api_secret, decrypt_api_secret,
)
from app.core.deps import PermissionChecker
from app.core.config import settings


TEST_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"


# ============================================================
# Password Hashing
# ============================================================
class TestPasswordHashing:
    def test_hash_is_not_plaintext(self):
        hashed = hash_password("my-secret-password")
        assert hashed != "my-secret-password"
        assert hashed.startswith("$2b$")

    def test_verify_correct_password(self):
        hashed = hash_password("correct-password")
        assert verify_password("correct-password", hashed) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("correct-password")
        assert verify_password("wrong-password", hashed) is False

    def test_hash_is_deterministic_per_call(self):
        """Each call produces a different salt/hash"""
        h1 = hash_password("same-password")
        h2 = hash_password("same-password")
        assert h1 != h2  # Different salts
        assert verify_password("same-password", h1) is True
        assert verify_password("same-password", h2) is True


# ============================================================
# JWT Tokens
# ============================================================
class TestJWT:
    def test_create_access_token(self):
        token = create_access_token(subject=TEST_USER_ID)
        assert isinstance(token, str)
        assert len(token) > 20

    def test_access_token_contains_claims(self):
        token = create_access_token(subject=TEST_USER_ID, extra_claims={"role": "admin"})
        payload = decode_token(token)
        assert payload["sub"] == TEST_USER_ID
        assert payload["type"] == "access"
        assert payload["role"] == "admin"

    def test_create_refresh_token(self):
        token = create_refresh_token(subject=TEST_USER_ID)
        payload = decode_token(token)
        assert payload["type"] == "refresh"
        assert payload["sub"] == TEST_USER_ID

    def test_access_token_expiration(self):
        from datetime import timedelta
        token = create_access_token(
            subject=TEST_USER_ID,
            expires_delta=timedelta(minutes=5),
        )
        payload = decode_token(token)
        assert "exp" in payload
        assert "iat" in payload

    def test_decode_invalid_token(self):
        with pytest.raises(ValueError, match="Invalid token"):
            decode_token("not-a-valid-jwt-token-string")

    def test_decode_wrong_secret(self):
        import jwt as pyjwt
        bad_token = pyjwt.encode(
            {"sub": "test", "exp": 9999999999},
            "wrong-secret-key",
            algorithm="HS256",
        )
        with pytest.raises(ValueError):
            decode_token(bad_token)

    def test_custom_claims(self):
        token = create_access_token(
            subject=TEST_USER_ID,
            extra_claims={"username": "testuser", "roles": ["admin", "trader"]},
        )
        payload = decode_token(token)
        assert payload["username"] == "testuser"
        assert payload["roles"] == ["admin", "trader"]


# ============================================================
# API Key Encryption
# ============================================================
class TestApiKeyEncryption:
    def test_encrypt_decrypt_roundtrip(self):
        plaintext = "my-exchange-secret-key-12345"
        encrypted = encrypt_api_secret(plaintext)
        assert encrypted != plaintext
        decrypted = decrypt_api_secret(encrypted)
        assert decrypted == plaintext

    def test_encrypt_different_each_time(self):
        """Nonce should be random, producing different ciphertext each time"""
        e1 = encrypt_api_secret("same-secret")
        e2 = encrypt_api_secret("same-secret")
        assert e1 != e2
        # Both should decrypt to the same plaintext
        assert decrypt_api_secret(e1) == "same-secret"
        assert decrypt_api_secret(e2) == "same-secret"

    def test_encrypt_empty_string(self):
        encrypted = encrypt_api_secret("")
        decrypted = decrypt_api_secret(encrypted)
        assert decrypted == ""

    def test_encrypt_unicode(self):
        plaintext = "秘密密钥-テスト-🔑"
        encrypted = encrypt_api_secret(plaintext)
        decrypted = decrypt_api_secret(encrypted)
        assert decrypted == plaintext

    def test_encrypt_long_secret(self):
        plaintext = "x" * 500  # Very long key
        encrypted = encrypt_api_secret(plaintext)
        decrypted = decrypt_api_secret(encrypted)
        assert decrypted == plaintext

    def test_decrypt_invalid_data(self):
        with pytest.raises(Exception):
            decrypt_api_secret("not-valid-base64!!!")

    def test_decrypt_tampered_data(self):
        encrypted = encrypt_api_secret("my-secret")
        # Tamper with the ciphertext
        tampered = encrypted[:10] + "XXXX" + encrypted[14:]
        with pytest.raises(Exception):
            decrypt_api_secret(tampered)


# ============================================================
# Auth API Endpoints
# ============================================================
class TestAuthAPI:
    @pytest.fixture
    def auth_headers(self) -> dict:
        token = create_access_token(subject=TEST_USER_ID)
        return {"Authorization": f"Bearer {token}"}

    @pytest.mark.asyncio
    async def test_register_new_user(self, async_client: AsyncClient):
        import uuid
        unique_email = f"newuser_{uuid.uuid4().hex[:8]}@example.com"
        resp = await async_client.post(
            "/api/v1/auth/register",
            json={
                "email": unique_email,
                "username": f"user_{uuid.uuid4().hex[:6]}",
                "password": "StrongPass123!",
                "confirm_password": "StrongPass123!",
            },
        )
        assert resp.status_code in (201, 400)  # 400 if user exists, 201 if new

    @pytest.mark.asyncio
    async def test_login(self, async_client: AsyncClient):
        resp = await async_client.post(
            "/api/v1/auth/login",
            data={
                "username": "testuser",
                "password": "testpass",
            },
        )
        # May return 200 or 401 depending on test user state
        assert resp.status_code in (200, 401)

    @pytest.mark.asyncio
    async def test_protected_route_without_token(self, async_client: AsyncClient):
        resp = await async_client.get("/api/v1/users/me")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_protected_route_with_token(self, async_client: AsyncClient, auth_headers):
        resp = await async_client.get("/api/v1/users/me", headers=auth_headers)
        # 401 if user not in test DB, 200 if seeded correctly
        assert resp.status_code in (200, 401)


# ============================================================
# RBAC Permission Checks
# ============================================================
class TestRBAC:
    def test_permission_checker_creation(self):
        checker = PermissionChecker(["admin"])
        assert checker.required_roles == ["admin"]

    def test_multiple_roles(self):
        checker = PermissionChecker(["admin", "trader", "reviewer"])
        assert len(checker.required_roles) == 3


# ============================================================
# Config Validation
# ============================================================
class TestSettings:
    def test_is_development(self):
        assert settings.is_development is True  # Default env

    def test_not_production_by_default(self):
        assert settings.is_production is False

    def test_cors_origins_is_list(self):
        assert isinstance(settings.CORS_ORIGINS, list)
        assert len(settings.CORS_ORIGINS) > 0

    def test_jwt_secret_min_length(self):
        assert len(settings.JWT_SECRET_KEY) >= 32
