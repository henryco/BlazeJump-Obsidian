export interface NodeContext {
    position?: [x: number, y: number];
    counter: number;
    depth: number;
    full: boolean;
}

export interface SearchContext {
    single: boolean;
    index: number;
    min: number;
    max: number;
}

export interface BlazeNode<T> {
    id: string;
    context: NodeContext;
    parent: BlazeNode<T> | null;
    children?: BlazeNode<T>[];
    value?: T;
    search?: SearchContext;

    get full_id(): string;
}

export const create_node = <T> (
    id: string,
    parent?: BlazeNode<T>,
    context?: NodeContext,
    value?: T,
    children?: BlazeNode<T>[],
): BlazeNode<T> => (<BlazeNode<T>> {

    id: id,
    value: value,
    children: children,
    parent: parent ?? null,
    context: (context ?? <NodeContext>{
        position: undefined,
        full: false,
        counter: 0,
        depth: 0
    }),

    get full_id(): string {
        const rec_id = (this as any)['rec_id'];
        if (rec_id) {
            return rec_id;
        }
        if (!this.parent) {
            (this as any)['rec_id'] = this.id;
            return this.id;
        }
        const new_id = `${this.parent.full_id}${this.id}`;
        (this as any)['rec_id'] = new_id;
        return new_id;
    }

});

export const find_node = <T> (node: BlazeNode<T>, name: string): BlazeNode<T> | undefined => {
    if (!node.children || node.children.length <= 0)
        return undefined;
    const children: BlazeNode<T>[] = node.children;
    for (let child of children) {
        if (child.id === name) {
            return child;
        }
    }
    return undefined;
}

export const swap_children = <T> (node: BlazeNode<T>): BlazeNode<T> => {
    const last_node = node.children?.pop();
    if (!last_node)
        throw "Impossible! Last node not exists!";
    node.children?.unshift(last_node);
    return node;
}

export const rotate_node = <T> (node: BlazeNode<T>, n: number = 0, limit: number = 100): BlazeNode<T> => {
    if (n > limit)
        throw "Overflow";

    if (!node.children)
        return node;

    swap_children(node);

    node.context.counter -= 1;
    if (node.context.counter > 0)
        return node;

    node.context.counter = node.children.length;
    node.context.full = true;

    return !node.parent ? node : rotate_node(node.parent, n + 1);
}

const collect_nodes = <T> (
    node: BlazeNode<T>,
    arr: BlazeNode<T>[] = [],
    n: number = 0,
    limit: number = 1000
): BlazeNode<T>[] => {
    if (n > limit)
        throw "Overflow";

    const children = node.children;
    if (!children) {
        if (node.value) {
            arr.push(node);
        }
        return arr;
    }

    for (let child of children) {
        arr = collect_nodes(child, arr, n + 1, limit);
    }

    return arr;
}

export class SearchTree {
    private readonly layout_depth: number;
    private layout_characters: (string | null)[];
    private layout_width: number;
    private layout_height: number;

    // private search_array: BlazeNode<any>[];
    private search_node: BlazeNode<any>;

    public constructor(keyboard_layout: string, keyboard_allowed: string, distance: number) {
        this.initKeyboardLayout(keyboard_layout, keyboard_allowed);
        this.search_node = create_node("#");
        this.layout_depth = distance;
        // this.search_array = [];
    }

    private initKeyboardLayout(keyboard_layout: string, keyboard_allowed: string): void {
        const arr = `${keyboard_layout}`.toLowerCase().trim().split(/\s+|\n+/);
        const width = arr.reduce((p, c) => Math.max(p, c.length), 0);
        this.layout_characters = arr.reduce((p, c) => [...p, ...c, ...Array(width - c.length).fill(null)], [])
            .map(x => `${keyboard_allowed}`.toLowerCase().includes(x) ? x : null)
            .map(x => x !== '#' ? x : null);
        this.layout_height = arr.length;
        this.layout_width = width;
    }

    private coord(input: string): [x: number, y: number] {
        let index = this.layout_characters.indexOf(input.toLowerCase());
        if (index <= -1)
            index = this.layout_characters.length / 2;
        const y = Math.floor(index / this.layout_width);
        const x = index - (this.layout_width * y);
        return [x, y];
    }

    private from(x: number, y: number): string | null {
        if (x < 0 || y < 0 || y >= this.layout_height || x >= this.layout_width)
            return null;
        return this.layout_characters[x + (this.layout_width * y)];
    }

    private static predict_xy_spiral(
        pos: [number, number],
        mid: [number, number],
        r: number
    ): [x: number,
        y: number,
        d: number
    ] {
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

    private static validate_xy_spiral(
        pos: [number, number],
        mid: [number, number],
        r: number,
        w: number,
        h: number,
        n: number = 0
    ): [x: number,
        y: number,
        d: number
    ] {
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

            return SearchTree.validate_xy_spiral(
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

            return SearchTree.validate_xy_spiral(
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

            return SearchTree.validate_xy_spiral(
                [nx, ny], [mx, my], nr, w, h, n + 1
            );
        }

        if (y >= h) {
            nx = mx - nr;

            if (nx >= 0) {
                ny = h - 1;
            }

            return SearchTree.validate_xy_spiral(
                [nx, ny], [mx, my], nr, w, h, n + 1
            );
        }

        return [...pos, r];
    }

    private static next_spiral(
        pos: [number, number],
        mid: [number, number],
        radius: number,
        w: number,
        h: number,
        max_depth: number = -1
    ): [x: number,
        y: number,
        d: number
    ] {
        const [u_x, u_y, u_depth] = SearchTree.predict_xy_spiral(
            [...pos],
            [...mid],
            radius
        );

        const [n_x, n_y, depth] = SearchTree.validate_xy_spiral(
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

    private next_key(

        input: string,
        depth?: number,
        pos?: [number, number]

    ): [char: string, pos: [number, number], depth: number] {

        const [x, y] = this.coord(input);

        let k_pos: [number, number] | undefined = pos ? [...pos] : undefined;
        let k_depth: number = depth ?? 0;

        const max_spin = Math.min(
            Math.pow(1 + (Math.max(0, k_depth) * 2), 2) + 1,
            (this.layout_height + this.layout_width) * 2
        );

        let char: string | null = null;
        let loop = 0;

        while (true) {
            if (loop > max_spin) {
                console.error("max spin");
                throw "Max spin";
            }

            const [i_x, i_y, i_depth] = SearchTree.next_spiral(
                (k_pos ?? [x, y]),
                [x, y],
                k_depth,
                this.layout_width,
                this.layout_height,
                this.layout_depth
            );

            char = this.from(i_x, i_y);

            k_pos = [i_x, i_y];
            k_depth = i_depth;

            if (char === null) {
                continue;
            }

            break;
        }

        return [char, k_pos, k_depth];
    }

    private add_node(

        input: string,
        position: any,
        node: BlazeNode<any>,
        root: BlazeNode<any>,
        n: number = 0,
        limit: number = 100

    ): BlazeNode<any> {
        if (n >= limit) {
            node.context.depth = -1;
            throw "Stack overflow";
        }

        if (node.context.full) {
            if (!node.children || node.children.length <= 0)
                throw "Impossible state, full node MUST contain children";
            let left = node.children[0];
            return this.add_node(left.id, position, left, root, n + 1, limit);
        }

        const [char, i_pos, i_depth] = this.next_key(input, node.context.depth, node.context.position);
        node.context.position = i_pos;
        node.context.depth = i_depth;

        if (!!node.value) {
            // Existing singular value in node

            const [_, n_pos, n_depth] = this.next_key(node.id);
            let n_context = <NodeContext> {
                position: n_pos,
                depth: n_depth,
                counter: 0,
                full: false
            }

            let prev_node = create_node(node.id, node, n_context, node.value);
            node.children = [...(node.children ?? []), prev_node];
            node.value = undefined;
        }

        if (!find_node(node, char)) {
            // There is no children which also means that there were no singular values previously
            if (!node.children && !!node.parent) {
                node.value = position;
                return node;
            }

            if (!node.parent && !node.children) {
                node.value = undefined;
                node.children = [];
            }

            const [_, n_pos, n_depth] = this.next_key(char);
            let n_context = <NodeContext> {
                position: n_pos,
                depth: n_depth,
                counter: 0,
                full: false
            }

            let prev_node = create_node(char, node, n_context, position);
            node.children?.push(prev_node);
            node.value = undefined;

            return node;
        }

        if (!node.context.full) {
            rotate_node(node);
            return this.add_node(input, position, root, root, n + 1, limit);
        }

        if (!node.children || node.children.length <= 0)
            throw "Impossible state, full node MUST contain children";
        let left = node.children[0];
        return this.add_node(left.id, position, left, root, n + 1, limit);
    }

    public assign(input: string, position: any): void {
        this.add_node(input, position, this.search_node, this.search_node);
    }

    public narrow(input: string): BlazeNode<any> {
        let node = this.search_node;

        if (node.id === input && (!node.children || node.children.length <= 0)) {
            this.search_node = node;
            return this.search_node;
        }

        if (!node.children || node.children.length <= 0) {
            this.reset();
            return this.search_node;
        }

        for (let child of node.children) {
            if (child.id === input) {
                this.search_node = child;
                return this.search_node;
            }
        }

        this.reset();
        return this.search_node;
    }

    public freeze_nodes(): BlazeNode<any>[] {
        return collect_nodes(this.search_node);
    }

    public midLayoutChar(): string {
        const mid_x = Math.floor(this.layout_width / 2);
        const mid_y = Math.floor(this.layout_height / 2);
        let char = this.from(mid_x, mid_y);
        if (char)
            return char;
        for (let j = 0; j < this.layout_characters.length; j++) {
            char = this.layout_characters[j];
            if (char)
                return char;
        }
        console.warn('No allowed characters found');
        return 'h';
    }

    // private init_search_tree(
    //     node: BlazeNode<any>,
    //     index: number = 0,
    //     n: number = 0,
    //     limit: number = 1000
    // ): number {
    //     if (n > limit)
    //         throw "Overflow";
    //
    //     node.search = <SearchContext> {
    //         single: true,
    //         index: index,
    //         max: index,
    //         min: index
    //     };
    //
    //     this.search_array.push(node);
    //
    //     const children = node.children;
    //     if (!children) {
    //         return index;
    //     }
    //
    //     let max: number = index;
    //     for (let child of children) {
    //         max = this.init_search_tree(child, max + 1, n + 1, limit);
    //     }
    //
    //     node.search.single = false;
    //     node.search.min = index + 1;
    //     node.search.max = max;
    //
    //     return max;
    // }

    public reset(): void {
        this.search_node = create_node("#");
        // this.search_array = [];
    }
}
