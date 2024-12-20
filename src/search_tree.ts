import {KeyboardHeuristic, KeyboardLayout, char_from, char_coord} from "./heuristics";

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
    private readonly heuristic: KeyboardHeuristic;
    private readonly layouts: KeyboardLayout[] = [];
    private readonly layout_depth: number;

    private search_node: BlazeNode<any>;

    public constructor(heuristic: KeyboardHeuristic, keyboard_layouts: string[], keyboard_ignored: string, distance: number) {
        for (const layout of keyboard_layouts) {
            this.layouts.push(SearchTree.initKeyboardLayout(layout, keyboard_ignored));
        }
        this.heuristic = heuristic.initialize(this.layouts);
        this.search_node = create_node("#");
        this.layout_depth = distance;
    }

    private static initKeyboardLayout(keyboard_layout: string, keyboard_ignored: string): KeyboardLayout {
        const arr = `${keyboard_layout}`.toLowerCase().trim().split(/\s+|\n+/);
        const width = arr.reduce((p, c) => Math.max(p, c.length), 0);
        const layout_original = [...(`${keyboard_layout}`.toLowerCase().trim())];
        const layout_characters = arr.reduce((p, c) => [...p, ...c, ...Array(width - c.length).fill(null)], [])
            .map(x => `${keyboard_ignored}`.toLowerCase().includes(x) ? null : x)
            .map(x => x !== '#' ? x : null);
        const layout_height = arr.length;
        const layout_width = width;
        return <KeyboardLayout> {
            layout_characters,
            layout_original,
            layout_width,
            layout_height
        }
    }

    private next_key(

        layout: number,
        input: string,
        depth?: number,
        pos?: [number, number]

    ): [char: string, pos: [number, number], depth: number] {
        const [x, y] = char_coord(input, this.layouts[layout] ?? this.layouts[0]);
        return this.next_key_xy(layout, [x, y], depth, pos);
    }

    private next_key_xy(

        layout_index: number,
        mid_point: [number, number],
        depth?: number,
        pos?: [number, number]

    ): [char: string, pos: [number, number], depth: number] {

        const [x, y] = mid_point;

        let k_pos: [number, number] | undefined = pos ? [...pos] : undefined;
        let k_depth: number = depth ?? 0;

        const layout = this.layouts[layout_index] ?? this.layouts[0];
        const max_spin = Math.min(
            Math.pow(1 + (Math.max(0, k_depth) * 2), 2) + 1,
            (layout.layout_height + layout.layout_width) * 2
        );

        let char: string | null = null;
        let loop = 0;

        while (true) {
            if (loop > max_spin) {
                console.error("max spin");
                throw "Max spin";
            }

            const [i_x, i_y, i_depth] = this.heuristic.next_char(
                (k_pos ?? [x, y]),
                [x, y],
                k_depth,
                layout_index,
                this.layout_depth
            );

            char = char_from(i_x, i_y, layout);

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

        layout: number,
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
            return this.add_node(layout, left.id, position, left, root, n + 1, limit);
        }

        const [char, i_pos, i_depth] = this.next_key(layout, input, node.context.depth, node.context.position);
        node.context.position = i_pos;
        node.context.depth = i_depth;

        if (!!node.value) {
            // Existing singular value in node

            const [_, n_pos, n_depth] = this.next_key(layout, node.id);
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

            const [_, n_pos, n_depth] = this.next_key(layout, char);
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
            return this.add_node(layout, input, position, root, root, n + 1, limit);
        }

        if (!node.children || node.children.length <= 0)
            throw "Impossible state, full node MUST contain children";
        let left = node.children[0];
        return this.add_node(layout, left.id, position, left, root, n + 1, limit);
    }

    public assign(input: string, position: any, layout_index?: number): void {
        const layout = layout_index ?? this.recognize_layout(input);
        this.add_node(layout, input, position, this.search_node, this.search_node);
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

    public mid_layout_char(layout_index: number): string {
        const layout = this.layouts[layout_index] ?? this.layouts[0];
        const li = this.layouts[layout_index] ? layout_index : 0;

        const mid_x = Math.floor(layout.layout_width / 2);
        const mid_y = Math.floor(layout.layout_height / 2);

        const char = char_from(mid_x, mid_y, layout);
        if (char)
            return char;

        const [c, _, d] = this.next_key_xy(li, [mid_x, mid_y]);
        if (c && d >= 0)
            return c;

        console.warn('No allowed characters found');
        return 'h';
    }

    public recognize_layout(input: string, def_layout: number = -1): number {
        try {
            if (def_layout >= 0) {
                if (this.layouts[def_layout].layout_original.indexOf(input.toLowerCase()) >= 0)
                    return def_layout;
            }
            for (let i = 0; i < this.layouts.length; i++) {
                if (def_layout >= 0 && i === def_layout)
                    continue;
                const layout = this.layouts[i];
                if (layout.layout_original.indexOf(input.toLowerCase()) >= 0)
                    return i;
            }
        } catch (e) {
            console.error(`unknown layout for input: ${input}`, e);
            return 0;
        }

        console.warn(`unknown layout for input ${input}`);
        return 0;
    }

    public reset(): void {
        this.search_node = create_node("#");
    }
}
