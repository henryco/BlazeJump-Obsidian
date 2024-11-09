import {KeyboardHeuristic, KeyboardLayout} from "../heuristics";

const predict_xy_spiral = (
    pos: [number, number],
    mid: [number, number],
    r: number
): [x: number,
    y: number,
    d: number
] => {
    const x0 = mid[0] - r;
    const y0 = mid[1] - r;
    const x1 = mid[0] + r;
    const y1 = mid[1] + r;
    const [x, y] = pos;

    let rx = x;
    let ry = y;

    if (r <= 0) {
        // very beginning
        return [mid[0], mid[1], 1];
    }

    if (r <= 1 && x === mid[0] && y === mid[1]) {
        return [mid[0] - 1, mid[1] - 1, 1];
    }

    if (x === x0 && y <= y1 && y > y0) {
        ry = y - 1;
        rx = x;
    }

    else if (x === x1 && y >= y0 && y < y1) {
        ry = y + 1;
        rx = x;
    }

    else if (y === y0 && x >= x0 && x < x1) {
        rx = x + 1;
        ry = y;
    }

    else if (y === y1 && x <= x1 && x > x0) {
        rx = x - 1;
        ry = y;
    }

    if (rx === x0 && ry === y0) {
        // next circle
        return [x0 - 1, y0 - 1, r + 1];
    }

    return [rx, ry, r];
}

const validate_xy_spiral = (
    pos: [number, number],
    mid: [number, number],
    r: number,
    w: number,
    h: number,
    n: number = 0
): [x: number,
    y: number,
    d: number
] => {
    const [mx, my] = mid;
    const [x, y] = pos;

    if (x >= 0 && y >= 0 && x < w && y < h) {
        return [...pos, r];
    }

    if ((mx - r) < 0 && (mx + r) > w && (my - r) < 0 && (my + r) > h) {
        return [...mid, -1]; // circle too big
    }

    if (n > 100) {
        console.warn('overflow', [...mid, -1]);
        return [...mid, -1]; // prevent stack overflow, normally shouldn't happen
    }
    let nx = x;
    let ny = y;
    let nr = r;

    if (x < 0) {
        // not a starting point
        if (!(x === mx - r && y === my - r)) {
            nr = r + 1;
            nx = mx - nr;
            ny = my - nr;
        }

        if (ny >= 0) {
            nx = 0;
        }

        else if (ny < 0) {
            nx = mx + nr;
        }

        return validate_xy_spiral(
            [nx, ny], [mx, my], nr, w, h, n + 1
        );
    }

    if (y < 0) {
        nx = mx + nr;

        if (nx < w) {
            ny = 0;
        }

        else if (nx >= w) {
            ny = my + nr;
        }

        return validate_xy_spiral(
            [nx, ny], [mx, my], nr, w, h, n + 1
        );
    }

    if (x >= w) {
        ny = my + nr;

        if (ny < h) {
            nx = w - 1;
        }

        else if (ny >= h) {
            nx = mx - nr;
        }

        return validate_xy_spiral(
            [nx, ny], [mx, my], nr, w, h, n + 1
        );
    }

    if (y >= h) {
        nx = mx - nr;

        if (nx >= 0) {
            ny = h - 1;
        }

        return validate_xy_spiral(
            [nx, ny], [mx, my], nr, w, h, n + 1
        );
    }

    return [...pos, r];
}

const next_spiral = (
    pos: [number, number],
    mid: [number, number],
    radius: number,
    w: number,
    h: number,
    max_depth: number = -1
): [x: number,
    y: number,
    d: number
] => {
    const [u_x, u_y, u_depth] = predict_xy_spiral(
        [...pos],
        [...mid],
        radius
    );

    const [n_x, n_y, depth] = validate_xy_spiral(
        [u_x, u_y],
        [...mid],
        u_depth,
        w,
        h
    );

    if (max_depth > 0 && depth > max_depth)
        return [...mid, -1];

    return [n_x, n_y, depth];
}

export class Spirale implements KeyboardHeuristic {
    private static instance: Spirale;
    private keyboard_layouts: KeyboardLayout[] = [];

    private constructor() {}

    public initialize(layouts: KeyboardLayout[]) {
        this.keyboard_layouts = layouts;
        return this;
    }

    public next_char(position: [number, number],
              mid_point: [number, number],
              search_radius: number,
              layout_index: number,
              maximum_depth: number
    ): [x: number, y: number, depth: number] {
        const l = this.keyboard_layouts[layout_index];
        return next_spiral(position, mid_point, search_radius, l.layout_width, l.layout_height, maximum_depth);
    }

    public static getInstance() {
        if (!Spirale.instance)
            Spirale.instance = new Spirale();
        return Spirale.instance;
    }
}

export const SpiralHeuristic = Spirale.getInstance();
