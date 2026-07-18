"""
Pydantic response models for the Music Provider API.
All fields are Optional to gracefully handle None values from ytmusicapi.
"""
from typing import Optional, List, Any
from pydantic import BaseModel


class Thumbnail(BaseModel):
    url: str
    width: Optional[int] = None
    height: Optional[int] = None


class ArtistRef(BaseModel):
    name: Optional[str] = None
    id: Optional[str] = None


class TrackResult(BaseModel):
    videoId: Optional[str] = None
    title: Optional[str] = None
    artists: Optional[List[ArtistRef]] = None
    album: Optional[Any] = None
    duration: Optional[str] = None
    duration_seconds: Optional[int] = None
    thumbnails: Optional[List[Thumbnail]] = None
    isAvailable: Optional[bool] = None
    isExplicit: Optional[bool] = None
    feedbackTokens: Optional[Any] = None
    resultType: Optional[str] = None


class SearchResult(BaseModel):
    results: List[Any]
    total: int


class HomeSection(BaseModel):
    title: Optional[str] = None
    contents: Optional[List[Any]] = None
    strapline: Optional[str] = None


class ChartResult(BaseModel):
    countries: Optional[dict] = None
    videos: Optional[Any] = None
    artists: Optional[Any] = None
    trending: Optional[Any] = None
    songs: Optional[Any] = None


class MoodCategory(BaseModel):
    categories: dict


class LyricsResult(BaseModel):
    lyrics: Optional[str] = None
    source: Optional[str] = None


class ArtistResult(BaseModel):
    name: Optional[str] = None
    channelId: Optional[str] = None
    description: Optional[str] = None
    subscribers: Optional[str] = None
    thumbnails: Optional[List[Thumbnail]] = None
    songs: Optional[Any] = None
    albums: Optional[Any] = None
    singles: Optional[Any] = None
    videos: Optional[Any] = None
    related: Optional[Any] = None


class AlbumResult(BaseModel):
    title: Optional[str] = None
    trackCount: Optional[int] = None
    year: Optional[str] = None
    thumbnails: Optional[List[Thumbnail]] = None
    tracks: Optional[List[Any]] = None
    audioPlaylistId: Optional[str] = None
    description: Optional[str] = None
    artists: Optional[List[ArtistRef]] = None


class PlaylistResult(BaseModel):
    title: Optional[str] = None
    trackCount: Optional[int] = None
    description: Optional[str] = None
    thumbnails: Optional[List[Thumbnail]] = None
    tracks: Optional[List[Any]] = None
    author: Optional[Any] = None


class PodcastResult(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    episodes: Optional[List[Any]] = None
    author: Optional[Any] = None


class EpisodeResult(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    videoId: Optional[str] = None
    date: Optional[str] = None


class WatchPlaylistResult(BaseModel):
    tracks: Optional[List[Any]] = None
    lyrics: Optional[str] = None
    related: Optional[str] = None
    playlistId: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
