declare module 'rpio' {
    export function init(options: { gpiomem: boolean; mapping: 'gpio' | 'physical' }): void;
    export function open(pin: number, mode: number, pull?: number): void;
    export function close(pin: number): void;
    export function read(pin: number): number;
    export function write(pin: number, value: number): void;
    export function pwmSetClockDivider(divider: number): void;
    export function pwmSetRange(pin: number, range: number): void;
    export function pwmSetData(pin: number, data: number): void;

    export const INPUT: number;
    export const OUTPUT: number;
    export const LOW: number;
    export const HIGH: number;
    export const PULL_UP: number;
    export const PULL_DOWN: number;
    export const PULL_OFF: number;
}
