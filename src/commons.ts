import {EditorPosition} from "obsidian";
import {EditorView} from "@codemirror/view";

export type MODE_TYPE = 'start' | 'end' | 'any' | 'line' | 'terminator';

export interface Coord {
    bottom: number;
    left: number;
    right: number;
    top: number;
}

export interface SearchStyle {
    capitalize: boolean;
    bg: string;
    text: string;
    border: string;
    offset: number;
    fix?: number;
}

export interface PulseStyle {
    duration: number;
    bg: string;
}

export interface SearchPosition {
    start: EditorPosition;
    end: EditorPosition;
    index_s: number;
    index_e: number;
    coord: Coord;
    origin: Coord;
    name: string;
}

export interface InterState {
    plugin_draw_observers?: ({ id: string, fn: () => void })[];
    plugin_draw_callback?: () => void;
    editor_callback?: (view: EditorView) => void;
    style_provider?: () => SearchStyle;
    pulse_provider?: () => PulseStyle;
    positions?: SearchPosition[];
    pointer?: SearchPosition;
    target?: string;
}

class InterPluginState {
    private static instance: InterPluginState;
    public state: InterState;

    private constructor() {
        this.state = {
            plugin_draw_observers: [],
            plugin_draw_callback: function () {
                if (!this.plugin_draw_observers || this.plugin_draw_observers.length <= 0)
                    return;
                for (let observer of this.plugin_draw_observers)
                    observer?.fn();
            }
        };
    }

    public static getInstance() {
        if (!InterPluginState.instance)
            InterPluginState.instance = new InterPluginState();
        return InterPluginState.instance;
    }
}

export const state = InterPluginState.getInstance();
