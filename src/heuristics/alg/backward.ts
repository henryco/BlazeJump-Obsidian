import {KeyboardHeuristic, KeyboardLayout} from "../heuristics";

const next_backward = (
    position: [number, number],
    depth: number,
    layout_width: number,
    layout_height: number
): [x: number, y: number, depth: number] => {
    const inc = depth > 0 ? 1 : 0;
    const [px, py] = position;
    if ((px - inc) < 0 || px < 0) {
        if ((py - inc) < 0 || py < 0)
            return [layout_width - 1, layout_height - 1, 1];
        return [layout_width - 1, py - inc, 1];
    }
    return [px - inc, py, 1];
}

export class Backward implements KeyboardHeuristic {
    private static instance: Backward;
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
        return next_backward(position, search_radius, l.layout_width, l.layout_height);
    }

    public static getInstance() {
        if (!Backward.instance)
            Backward.instance = new Backward();
        return Backward.instance;
    }
}

export const BackwardHeuristic = Backward.getInstance();
