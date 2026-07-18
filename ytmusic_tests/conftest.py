"""
Shared pytest fixtures for ytmusicapi test suite.
"""
import pytest
from pathlib import Path
from ytmusicapi import YTMusic

@pytest.fixture(scope="session")
def yt() -> YTMusic:
    return YTMusic()

@pytest.fixture(scope="session")
def yt_auth():
    oauth_path = Path(__file__).parent / "oauth.json"
    if not oauth_path.exists():
        return None
    try:
        return YTMusic(str(oauth_path))
    except Exception:
        return None

@pytest.fixture
def require_auth(yt_auth):
    if yt_auth is None:
        pytest.skip("oauth.json not found — skipping auth-required test")
    return yt_auth

KNOWN_VIDEO_ID = "ZbZSe6N_BXs"

@pytest.fixture(scope="session")
def known_video_id() -> str:
    return KNOWN_VIDEO_ID

@pytest.fixture(scope="session")
def known_song(yt) -> dict:
    return yt.get_song(KNOWN_VIDEO_ID)

@pytest.fixture(scope="session")
def artist_channel_id() -> str:
    return "UCtJe0RYzgPddQXKtWduxz_w"
