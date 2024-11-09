import {KeyboardHeuristic} from "../heuristics";

export const StraightHeuristic: KeyboardHeuristic = {
    next_char(
        position: [number, number],
        _: [number, number],
        depth: number,
        layout_width: number,
        layout_height: number,
        __: number
    ): [x: number, y: number, depth: number] {
        const inc = depth > 0 ? 1 : 0;
        const [px, py] = position;
        return ((px + inc) >= layout_width || px >= layout_width)
            ? (((py + inc) >= layout_height || py >= layout_height) ? [0, 0, 1] : [0, py + inc, 1])
            : [px + inc, py, 1];
    }
}
