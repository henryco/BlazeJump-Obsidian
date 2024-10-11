import {EditorPosition} from "obsidian";
import {EditorView} from "@codemirror/view";

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
    idx: number;
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
    value: string;
    coord: Coord;
    origin: Coord;
    name: string;
}

export interface InterState {
    plugin_draw_callback?: () => void;
    editor_callback?: (view: EditorView) => void;
    style_provider?: (i: number) => SearchStyle;
    pulse_provider?: () => PulseStyle;
    positions?: SearchPosition[];
    pointer?: SearchPosition;
}

class InterPluginState {
    private static instance: InterPluginState;
    public state: InterState;

    private constructor() {
        this.state = {};
    }

    public static getInstance() {
        if (!InterPluginState.instance)
            InterPluginState.instance = new InterPluginState();
        return InterPluginState.instance;
    }
}

export const state = InterPluginState.getInstance();
