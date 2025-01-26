// src/types/services/music.ts

export interface MusicConfig {
    spotifyClientId?: string;
    spotifyClientSecret?: string;
    appleMusicKey?: string;
}

export interface MusicService {
    executeCommand(command: string): Promise<void>;
    play(query: string): Promise<void>;
    pause(): Promise<void>;
    next(): Promise<void>;
    previous(): Promise<void>;
    setVolume(level: number): Promise<void>;
    getStatus(): Promise<MusicStatus>;
}

export interface MusicStatus {
    isPlaying: boolean;
    currentTrack?: {
        title: string;
        artist: string;
        duration: number;
        position?: number;
    };
    volume: number;
    queue: number;
    repeat?: 'off' | 'track' | 'queue';
    shuffle?: boolean;
}