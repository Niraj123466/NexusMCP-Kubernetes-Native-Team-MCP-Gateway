"""Unit tests for API key generation, bcrypt hashing, verification, and HMAC args hashing."""
import secrets
import pytest

from gateway.auth.api_keys import (
    generate_api_key,
    verify_api_key,
    hash_args,
    _hash_key,
    utcnow,
)


def test_generate_api_key_format():
    plaintext, key_hash, prefix = generate_api_key()

    # Plaintext starts with nexus_
    assert plaintext.startswith("nexus_")
    # Prefix matches first 8 chars
    assert prefix == plaintext[:8]
    assert len(prefix) == 8
    # Key hash is bcrypt hash
    assert key_hash.startswith("$2b$") or key_hash.startswith("$2a$")
    # Verify matches
    assert verify_api_key(plaintext, key_hash) is True


def test_verify_api_key_invalid():
    plaintext, key_hash, prefix = generate_api_key()
    wrong_key = "nexus_wrongkey1234567890abcdefghijklmnopqrstuvwxyz"

    assert verify_api_key(wrong_key, key_hash) is False
    assert verify_api_key("", key_hash) is False
    assert verify_api_key(plaintext, "invalid_hash_format") is False


def test_key_entropy():
    # Multiple generated keys should be unique and distinct
    keys = [generate_api_key() for _ in range(20)]
    plaintexts = [k[0] for k in keys]
    prefixes = [k[2] for k in keys]

    assert len(set(plaintexts)) == 20
    assert len(set(prefixes)) == 20


def test_hash_args_integrity():
    secret = "test-secret-key-12345"
    args1 = {"product_id": 101, "status": "publish"}
    args2 = {"status": "publish", "product_id": 101}  # different key order
    args3 = {"product_id": 102, "status": "publish"}

    hash1 = hash_args(args1, secret)
    hash2 = hash_args(args2, secret)
    hash3 = hash_args(args3, secret)

    # Order of keys in JSON should not affect the hash due to sort_keys=True
    assert hash1 == hash2
    assert len(hash1) == 64  # SHA-256 hex string

    # Different arguments produce different hashes
    assert hash1 != hash3

    # Different secrets produce different hashes
    assert hash1 != hash_args(args1, "different-secret")


def test_utcnow_timezone_aware():
    now = utcnow()
    assert now.tzinfo is not None
