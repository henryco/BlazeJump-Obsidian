export interface KeyboardLayout {
    readonly layout_characters: (string | null)[];
    readonly layout_original: string[];
    readonly layout_width: number;
    readonly layout_height: number;
}

export const char_coord = (input: string, layout: KeyboardLayout): [x: number, y: number] => {
    let index = layout.layout_characters.indexOf(input.toLowerCase());
    if (index <= -1)
        index = Math.floor(layout.layout_characters.length / 2);
    const y = Math.floor(index / layout.layout_width);
    const x = index - (layout.layout_width * y);
    return [x, y];
}

export const char_from = (x: number, y: number, layout: KeyboardLayout): string | null => {
    if (x < 0 || y < 0 || y >= layout.layout_height || x >= layout.layout_width)
        return null;
    return layout.layout_characters[x + (layout.layout_width * y)];
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
