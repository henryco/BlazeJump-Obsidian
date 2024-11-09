import {KeyboardHeuristic, KeyboardLayout} from "../heuristics";

const next_continuous = (
    position: [number, number],
    depth: number,
    layout_width: number,
    layout_height: number
): [x: number, y: number, depth: number] => {
    const inc = depth > 0 ? 1 : 0;
    const [px, py] = position;
    return ((px + inc) >= layout_width || px >= layout_width)
        ? (((py + inc) >= layout_height || py >= layout_height) ? [0, 0, 1] : [0, py + inc, 1])
        : [px + inc, py, 1];
}

export class Continuous implements KeyboardHeuristic {
    private static instance: Continuous;
    private keyboard_layouts: KeyboardLayout[] = [];

    private constructor() {
    }

    public initialize(layouts: KeyboardLayout[]) {
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
        return next_continuous(position, search_radius, l.layout_width, l.layout_height);
    }

    public static getInstance() {
        if (!Continuous.instance)
            Continuous.instance = new Continuous();
        return Continuous.instance;
    }
}

export const ContinuousHeuristic = Continuous.getInstance();
