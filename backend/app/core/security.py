"""
安全模块
========
JWT Token 管理 + 密码哈希 + API Key 加密解密。
"""

from datetime import datetime, timedelta
from typing import Any, Optional

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

# ============================================================
# 密码哈希 (bcrypt)
# ============================================================


def hash_password(password: str) -> str:
    """对密码进行 bcrypt 哈希"""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码是否匹配"""
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


# ============================================================
# JWT Token
# ============================================================
def create_access_token(
    subject: str,
    extra_claims: Optional[dict[str, Any]] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """生成 Access Token"""
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    now = datetime.utcnow()
    claims = {
        "sub": subject,
        "iat": now,
        "exp": now + expires_delta,
        "type": "access",
    }
    if extra_claims:
        claims.update(extra_claims)

    return jwt.encode(claims, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(
    subject: str,
    extra_claims: Optional[dict[str, Any]] = None,
) -> str:
    """生成 Refresh Token"""
    expires_delta = timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)

    now = datetime.utcnow()
    claims = {
        "sub": subject,
        "iat": now,
        "exp": now + expires_delta,
        "type": "refresh",
    }
    if extra_claims:
        claims.update(extra_claims)

    return jwt.encode(claims, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """解码并验证 JWT Token"""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")


# ============================================================
# API Key 加密 (AES-256-GCM)
# ============================================================
import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _get_aesgcm() -> AESGCM:
    """获取 AESGCM 实例"""
    key = settings.API_KEY_ENCRYPTION_KEY.encode("utf-8")
    # 确保密钥长度为 32 字节
    if len(key) < 32:
        key = key.ljust(32, b"\x00")
    elif len(key) > 32:
        key = key[:32]
    return AESGCM(key)


def encrypt_api_secret(plaintext: str) -> str:
    """加密 API Key 敏感字段 (AES-256-GCM)"""
    aesgcm = _get_aesgcm()
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    # 返回 base64 编码: nonce + ciphertext
    return base64.b64encode(nonce + ciphertext).decode("utf-8")


def decrypt_api_secret(encrypted: str) -> str:
    """解密 API Key 敏感字段"""
    aesgcm = _get_aesgcm()
    data = base64.b64decode(encrypted)
    nonce, ciphertext = data[:12], data[12:]
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext.decode("utf-8")
