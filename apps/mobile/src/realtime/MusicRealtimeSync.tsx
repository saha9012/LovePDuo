import { useEffect, useRef } from 'react';
import { useApp, TrackItem, Playlist } from '../store/AppStore';
import { pairRealtime } from './PairRealtime';

/**
 * Applies Music pair-sync mutations app-wide (not only while Music tab is mounted).
 * Toast / juice / local playback stop stay in music.tsx.
 */
export function MusicRealtimeSync() {
  const {
    user,
    pair,
    tracks,
    playlists,
    addTrack,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    removeTrackMeta,
    clearTracks,
    reactTrackMeta,
    setPartnerNowPlaying,
    setActivePlaylist,
    setMood,
    renamePlaylist,
    receivePlaylist,
    removePlaylist,
    setNowPlaying,
    nowPlayingId,
  } = useApp();

  const tracksRef = useRef(tracks);
  const playlistsRef = useRef(playlists);
  const nowPlayingIdRef = useRef(nowPlayingId);
  tracksRef.current = tracks;
  playlistsRef.current = playlists;
  nowPlayingIdRef.current = nowPlayingId;

  useEffect(() => {
    if (!user || !pair) return;
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type === 'peer_left') {
        setPartnerNowPlaying(null);
        return;
      }
      if (msg.type !== 'game') return;
      const fromId = (msg.payload as { fromId?: string } | undefined)?.fromId;
      if (fromId && fromId === user.id) return;

      if (msg.gameId === 'track-meta') {
        const payload = msg.payload as {
          title?: string;
          artist?: string;
          sourceType?: TrackItem['sourceType'];
          from?: string;
        };
        if (!payload?.title) return;
        const already = tracksRef.current.some(
          (t) =>
            t.title === payload.title &&
            (payload.artist ? t.artist === payload.artist : true),
        );
        if (!already) {
          addTrack({
            title: payload.title,
            artist: payload.artist ?? 'Партнёр',
            sourceType: payload.sourceType ?? 'link',
            playbackMode: payload.sourceType === 'spotify' ? 'spotify' : 'link',
            addedBy: payload.from ?? 'Партнёр',
          });
        }
        return;
      }

      if (msg.gameId === 'now-playing') {
        const payload = msg.payload as { title?: string | null; from?: string };
        if (payload?.title) {
          setPartnerNowPlaying(`${payload.from ?? 'Партнёр'}: ${payload.title}`);
        } else if (payload && payload.title === null) {
          setPartnerNowPlaying(null);
        }
        return;
      }

      if (msg.gameId === 'playlist-add') {
        const payload = msg.payload as {
          playlistId?: string;
          title?: string;
          artist?: string;
        };
        if (!payload?.playlistId || !payload.title) return;
        const match = tracksRef.current.find(
          (t) =>
            t.title === payload.title &&
            (payload.artist ? t.artist === payload.artist : true),
        );
        if (!match) return;
        const pl = playlistsRef.current.find((p) => p.id === payload.playlistId);
        if (pl?.trackIds.includes(match.id)) return;
        addTrackToPlaylist(payload.playlistId, match.id);
        return;
      }

      if (msg.gameId === 'track-react') {
        const payload = msg.payload as {
          title?: string;
          artist?: string;
          reaction?: TrackItem['reaction'];
        };
        if (!payload?.title || !payload.reaction) return;
        reactTrackMeta(payload.title, payload.artist ?? '', payload.reaction);
        return;
      }

      if (msg.gameId === 'track-remove') {
        const payload = msg.payload as { title?: string; artist?: string };
        if (!payload?.title) return;
        const playing = tracksRef.current.find((t) => t.id === nowPlayingIdRef.current);
        const hitPlaying =
          playing &&
          playing.title === payload.title &&
          (!payload.artist || playing.artist === payload.artist);
        const ok = removeTrackMeta(payload.title, payload.artist);
        if (ok && hitPlaying) setNowPlaying(null);
        return;
      }

      if (msg.gameId === 'track-clear') {
        clearTracks();
        setPartnerNowPlaying(null);
        setNowPlaying(null);
        return;
      }

      if (msg.gameId === 'playlist-remove') {
        const payload = msg.payload as {
          playlistId?: string;
          title?: string;
          artist?: string;
        };
        if (!payload?.playlistId || !payload.title) return;
        const match = tracksRef.current.find(
          (t) =>
            t.title === payload.title &&
            (payload.artist ? t.artist === payload.artist : true),
        );
        if (!match) return;
        const pl = playlistsRef.current.find((p) => p.id === payload.playlistId);
        if (!pl?.trackIds.includes(match.id)) return;
        removeTrackFromPlaylist(payload.playlistId, match.id);
        return;
      }

      if (msg.gameId === 'playlist') {
        const payload = msg.payload as {
          playlistId?: string;
          mood?: 'night' | 'warm' | 'rain' | 'pulse';
        };
        if (!payload?.playlistId) return;
        setActivePlaylist(payload.playlistId);
        if (payload.mood && payload.mood !== 'pulse') setMood(payload.mood);
        return;
      }

      if (msg.gameId === 'playlist-rename') {
        const payload = msg.payload as { playlistId?: string; name?: string };
        if (!payload?.playlistId || !payload.name) return;
        renamePlaylist(payload.playlistId, payload.name);
        return;
      }

      if (msg.gameId === 'playlist-create') {
        const payload = msg.payload as Playlist | undefined;
        if (!payload?.id || !payload.name) return;
        receivePlaylist({
          id: payload.id,
          name: payload.name,
          mood: payload.mood ?? 'warm',
          trackIds: [],
        });
        return;
      }

      if (msg.gameId === 'playlist-delete') {
        const payload = msg.payload as { playlistId?: string };
        if (!payload?.playlistId) return;
        removePlaylist(payload.playlistId);
      }
    });
    return () => off();
  }, [
    user?.id,
    pair?.code,
    addTrack,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    removeTrackMeta,
    clearTracks,
    reactTrackMeta,
    setPartnerNowPlaying,
    setActivePlaylist,
    setMood,
    renamePlaylist,
    receivePlaylist,
    removePlaylist,
    setNowPlaying,
  ]);

  return null;
}
