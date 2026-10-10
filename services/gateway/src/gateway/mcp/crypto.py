"""Cryptographic helpers for encrypting sensitive upstream credentials at rest."""
from __future__ import annotations

import base64
import hashlib
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from gateway.config import settings


def _derive_key() -> bytes:
    """Derive a 256-bit AES key from settings.gateway_secret_key using SHA-256."""
    return hashlib.sha256(settings.gateway_secret_key.encode()).digest()


def encrypt_credential(plaintext: str) -> str:
    """
    Encrypt plaintext credential using AES-256-GCM.
    Returns base64-encoded string containing (12-byte nonce + ciphertext + 16-byte tag).
    """
    if not plaintext:
        return ""
    key = _derive_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)
    return base64.b64encode(nonce + ciphertext).decode()


def decrypt_credential(encrypted_b64: str) -> str:
    """
    Decrypt AES-256-GCM ciphertext from base64 string.
    Returns decrypted plaintext.
    """
    if not encrypted_b64:
        return ""
    try:
        data = base64.b64decode(encrypted_b64.encode())
        nonce = data[:12]
        ciphertext = data[12:]
        key = _derive_key()
        aesgcm = AESGCM(key)
        decrypted = aesgcm.decrypt(nonce, ciphertext, None)
        return decrypted.decode()
    except Exception as exc:
        raise ValueError(f"Failed to decrypt credential: {exc}") from exc
