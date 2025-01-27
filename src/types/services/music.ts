// src/types/services/music.ts

export interface MusicConfig {
    spotifyClientId?: string;
    spotifyClientSecret?: string;
    appleMusicKey?: string;
    provider?: 'spotify' | 'appleMusic' | 'local';
}

export interface MusicService {
    initialize(): Promise<void>;
    executeCommand(command: string): Promise<void>;
    play(query: string): Promise<void>;
    pause(): Promise<void>;
    next(): Promise<void>;
    previous(): Promise<void>;
    setVolume(level: number): Promise<void>;
    getStatus(): Promise<MusicStatus>;
    shutdown(): Promise<void>;
}

export interface MusicStatus {
    isPlaying: boolean;
    currentTrack?: {
        title: string;
        artist: string;
        duration: number;
        position?: number;
        album?: string;
        artworkUrl?: string;
    };
    volume: number;
    queueLength: number;
    repeat: 'off' | 'track' | 'queue';
    shuffle: boolean;
    provider: string;
}