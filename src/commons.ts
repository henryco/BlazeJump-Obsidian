import {NamedValue} from "./search_tree";
import {EditorPosition} from "obsidian";
import {EditorView} from "@codemirror/view";

export interface Coord {
    bottom: number;
    left: number;
    right: number;
    top: number;
}

export interface SearchStyle {
    bg: string;
    text: string;
    border: string;
    offset: number;
    fix?: number;
    idx: number;
}

export interface SearchPosition extends NamedValue {
    start: EditorPosition;
    end: EditorPosition;
    index_s: number;
    index_e: number;
    value: string;
    coord: Coord;
}

export interface InterState {
    plugin_draw_callback?: () => void;
    editor_callback?: (view: EditorView) => void;
    style_provider?: (i: number) => SearchStyle;
    positions?: SearchPosition[];
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

    public getState(): InterState {
        return this.state;
    }
}

export const state = InterPluginState.getInstance();
