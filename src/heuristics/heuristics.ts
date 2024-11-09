export interface KeyboardLayout {
    readonly layout_characters: (string | null)[];
    readonly layout_original: string[];
    readonly layout_width: number;
    readonly layout_height: number;
}

export interface KeyboardHeuristic {
    initialize: (layouts: KeyboardLayout[]) => KeyboardHeuristic,
    next_char: (
        position: [number, number],
        mid_point: [number, number],
        search_radius: number,
        layout_index: number,
        maximum_depth: number
    ) => [x: number, y: number, depth: number];
}
