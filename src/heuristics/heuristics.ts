export interface KeyboardHeuristic {
    next_char: (
        position: [number, number],
        mid_point: [number, number],
        search_radius: number,
        layout_width: number,
        layout_height: number,
        maximum_depth: number
    ) => [x: number, y: number, depth: number];
}
