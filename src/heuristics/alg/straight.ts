import {KeyboardHeuristic, KeyboardLayout} from "../heuristics";

const next_straight = (
    position: [number, number],
    depth: number,
    layout_width: number,
    layout_height: number
): [x: number, y: number, depth: number] => {
    if (depth <= 0)
        return [0, 0, 1];
    const [px, py] = position;
    return ((px + 1) >= layout_width || px >= layout_width)
        ? (((py + 1) >= layout_height || py >= layout_height) ? [0, 0, 1] : [0, py + 1, 1])
        : [px + 1, py, 1];
}

export class Straight implements KeyboardHeuristic {
    private static instance: Straight;
    private keyboard_layouts: KeyboardLayout[] = [];

    private constructor() {
    }

    public initialize(layouts: KeyboardLayout[]): KeyboardHeuristic {
        this.keyboard_layouts = layouts;
        return this;
    }

    public next_char(
        position: [number, number],
        _: [number, number],
        search_radius: number,
        layout_index: number,
        __: number
    ): [x: number, y: number, depth: number] {
        const l = this.keyboard_layouts[layout_index];
        return  next_straight(position, search_radius, l.layout_width, l.layout_height);
    }

    public static getInstance() {
        if (!Straight.instance)
            Straight.instance = new Straight();
        return Straight.instance;
    }
}

export const StraightHeuristic = Straight.getInstance();
