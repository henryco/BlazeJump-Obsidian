import {App, Editor, EditorPosition, Plugin, PluginSettingTab, Setting} from 'obsidian';
import {
	Decoration,
	DecorationSet,
	EditorView,
	PluginSpec,
	PluginValue,
	ViewPlugin,
	ViewUpdate,
	WidgetType
} from "@codemirror/view";
import {RangeSetBuilder} from "@codemirror/state";

type MODE_TYPE = 'start' | 'end' | 'any' | 'line' | 'terminator';

interface ExpandSelectPluginSettings {
	default_action: MODE_TYPE;
	keyboard_layout: string;
	keyboard_allowed: string;
	keyboard_depth: number;

	status_color_bg?: string;
	status_color_start?: string;
	status_color_end?: string;
	status_color_any?: string;
	status_color_line?: string;
	status_color_terminator?: string;

	search_color_bg_start?: string;
	search_color_bg_end?: string;
	search_color_bg_any?: string;
	search_color_bg_line?: string;
	search_color_bg_terminator?: string;

	search_color_text_start?: string;
	search_color_text_end?: string;
	search_color_text_any?: string;
	search_color_text_line?: string;
	search_color_text_terminator?: string;

	search_color_border_start?: string;
	search_color_border_end?: string;
	search_color_border_any?: string;
	search_color_border_line?: string;
	search_color_border_terminator?: string;
}

interface Coord {
	bottom: number;
	left: number;
	right: number;
	top: number;
}

interface SearchStyle {
	bg: string;
	text: string;
	border: string;
    offset: number;
	fix?: number;
	idx: number;
}

interface SearchPosition {
	start: EditorPosition;
	end: EditorPosition;
	index_s: number;
	index_e: number;
	value: string;
	coord: Coord;
}

interface NodeContext {
	position?: [x: number, y: number];
	counter: number;
	depth: number;
	full: boolean;
}

interface BlazeNode {
	id: string;
	context: NodeContext;
	parent: BlazeNode | null;
	children?: BlazeNode[];
	value?: SearchPosition;
}

const create_node = (
	id: string,
	parent?: BlazeNode,
	context?: NodeContext,
	value?: SearchPosition,
	children?: BlazeNode[],
): BlazeNode => ({
	id: id,
	value: value,
	children: children,
	parent: parent ?? null,
	context: (context ?? <NodeContext>{
		position: undefined,
		full: false,
		counter: 0,
		depth: 0
	})
});

const find_node = (node: BlazeNode, name: string): BlazeNode | undefined => {
	if (!node.children || node.children.length <= 0)
		return undefined;
	const children: BlazeNode[] = node.children;
	for (let child of children) {
		if (child.id === name) {
			return child;
		}
	}
	return undefined;
}

const swap_children = (node: BlazeNode): BlazeNode => {
    const last_node = node.children?.pop();
    if (!last_node)
        throw "Impossible! Last node not exists!";
    node.children?.unshift(last_node);
    return node;
}

const rotate_node = (node: BlazeNode, n: number = 0, limit: number = 100): BlazeNode => {
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

const collect_nodes = (
    node: BlazeNode,
    arr: [string, SearchPosition][] = [],
    parent_id: string = "",
    n: number = 0,
    limit: number = 1000
): [string, SearchPosition][] => {
    if (n > limit)
        throw "Overflow";

    const id = `${parent_id}${node.parent === null ? '' : node.id}`;
    const children = node.children;
    if (!children) {
        if (node.value) {
            node.value.value = id;
            arr.push([id, node.value]);
        }
        return arr;
    }

    for (let child of children) {
        arr = collect_nodes(child, arr, id, n + 1, limit);
    }

    return arr;
}

const DEFAULT_SETTINGS: ExpandSelectPluginSettings = {
	default_action: "start",
	keyboard_layout: "1234567890 qwertyuiop asdfghjkl zxcvbnm",
	keyboard_allowed: "123456789abcdefghijklmnopqrstuvwxyz",
	keyboard_depth: 2,

	status_color_bg: 'transparent',

	status_color_start: 'Crimson',
	status_color_end: 'Blue',
	status_color_any: 'Green',
	status_color_line: 'Magenta',
	status_color_terminator: 'DimGray',

	search_color_bg_start: 'yellow'
}

const inter_plugin_state: any = {
	state: {}
}

export class SearchState {
	layout_characters: (string | null)[];
	layout_width: number;
	layout_height: number;
	layout_depth: number;
	search_node: BlazeNode;

	constructor(keyboard_layout: string, keyboard_allowed: string, distance: number) {
		this.initKeyboardLayout(keyboard_layout, keyboard_allowed);
		this.search_node = create_node("#");
		this.layout_depth = distance;
	}

	initKeyboardLayout(keyboard_layout: string, keyboard_allowed: string): void {
		const arr = keyboard_layout.toLowerCase().trim().split(/\s+|\n+/);
		const width = arr.reduce((p, c) => Math.max(p, c.length), 0);
		this.layout_characters = arr.reduce((p, c) => [...p, ...c, ...Array(width - c.length).fill(null)], [])
			.map(x => keyboard_allowed.toLowerCase().includes(x) ? x : null)
			.map(x => x !== '#' ? x : null);
		this.layout_height = arr.length;
		this.layout_width = width;
	}

	coord(input: string): [x: number, y: number] {
		let index = this.layout_characters.indexOf(input.toLowerCase());
		if (index <= -1)
			index = this.layout_characters.length / 2;
		const y = Math.floor(index / this.layout_width);
		const x = index - (this.layout_width * y);
		return [x, y];
	}

	from(x: number, y: number): string | null {
		if (x < 0 || y < 0 || y >= this.layout_height || x >= this.layout_width)
			return null;
		return this.layout_characters[x + (this.layout_width * y)];
	}

	static predict_xy_spiral(
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

	static validate_xy_spiral(
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

			return SearchState.validate_xy_spiral(
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

			return SearchState.validate_xy_spiral(
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

			return SearchState.validate_xy_spiral(
				[nx, ny], [mx, my], nr, w, h, n + 1
			);
		}

		if (y >= h) {
			nx = mx - nr;

			if (nx >= 0) {
				ny = h - 1;
			}

			return SearchState.validate_xy_spiral(
				[nx, ny], [mx, my], nr, w, h, n + 1
			);
		}

		return [...pos, r];
	}

	static next_spiral(
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
		const [u_x, u_y, u_depth] = SearchState.predict_xy_spiral(
			[...pos],
			[...mid],
			radius
		);

		const [n_x, n_y, depth] = SearchState.validate_xy_spiral(
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

    next_key(

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

            const [i_x, i_y, i_depth] = SearchState.next_spiral(
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

	add_node(

		input: string,
		position: SearchPosition,
		node: BlazeNode,
		root: BlazeNode,
		n: number = 0,
		limit: number = 100

    ): BlazeNode {
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

	assign(input: string, position: SearchPosition): void {
        this.add_node(input, position, this.search_node, this.search_node);
	}

    narrow(input: string): void {
        let node = this.search_node;

        if (node.id === input && (!node.children || node.children.length <= 0)) {
            this.search_node = node;
            return;
        }

        if (!node.children || node.children.length <= 0) {
            return;
        }

        for (let child of node.children) {
            if (child.id === input) {
                this.search_node = child;
                return;
            }
        }

        this.reset();
    }

    process_positions(): [string, SearchPosition][] {
        return collect_nodes(this.search_node);
    }

	reset(): void {
		this.search_node = create_node("#");
	}
}

export class BlazeFoundAreaWidget extends WidgetType {
	search_position: SearchPosition;
	style: SearchStyle;
	replace_text: string;

	constructor(replace_text: string, search_position: SearchPosition, style: SearchStyle) {
		super();
		this.search_position = search_position;
		this.replace_text = replace_text;
		this.style = style;
	}

	toDOM(_: EditorView): HTMLElement {
        const prefix = Array(this.style.offset).fill(' ').reduce((p, c) => p + c, '');

		const el = document.createElement("mark");
		el.innerText = prefix + this.replace_text.toLowerCase().substring(this.style.offset);

		el.style.backgroundColor = `${this.style.bg}`;
		el.style.color = `${this.style.text}`;
		el.style.border = `thin dashed ${this.style.border}`;
		el.style.zIndex = `${5000 + this.style.idx}`;
		el.style.position = 'absolute';
		el.style.fontWeight = 'bold';
		el.style.paddingLeft = '2px';
		el.style.paddingRight = '2px';
        el.style.fontFamily = 'monospace';
		el.style.marginTop = '-1px';

		if (this.style.fix !== undefined) {
			el.style.marginLeft = `${this.style.fix}px`;
		}

		return el;
	}
}

class BlazeViewPlugin implements PluginValue {
	decorations: DecorationSet = Decoration.none;

	constructor() {
		inter_plugin_state.state['plugin_draw_callback'] =
			() => this.build_decorations();
	}

	update(update: ViewUpdate) {
		if (inter_plugin_state.state['editor_callback'])
			inter_plugin_state.state['editor_callback'](update.view);
	}

	destroy() {
		inter_plugin_state.state = {};
	}

	build_decorations() {
		const positions: SearchPosition[] = inter_plugin_state.state['positions'];
		if (!positions) {
			this.decorations = Decoration.none;
			return;
		}

		let i = 0;
		const builder = new RangeSetBuilder<Decoration>();
		for (let position of positions) {
			const fix = position.start.ch > 0 ? 0 : 1;
			builder.add(
				position.index_s + fix,
				position.index_s + fix,
				Decoration.replace({
					widget: new BlazeFoundAreaWidget(
						position.value,
						position,
						<SearchStyle> {
							...(<SearchStyle> (inter_plugin_state.state['style_provider'](i++))),
							fix: (fix > 0) ? -10 : undefined
						}),
					inclusive: false
				})
			);
		}

		this.decorations = builder.finish();
	}

}

const plugin_spec: PluginSpec<BlazeViewPlugin> = {
	decorations: v => v.decorations,
	eventObservers: {
		keydown: (_, view: EditorView) => {
			if (inter_plugin_state.state['editor_callback'])
				inter_plugin_state.state['editor_callback'](view);
		}
	}
}

export const blaze_jump_plugin = ViewPlugin.fromClass(
	BlazeViewPlugin,
	plugin_spec
);

export default class BlazeJumpPlugin extends Plugin {
	settings: ExpandSelectPluginSettings;

	search_state: SearchState;
	mode?: MODE_TYPE = undefined;

	statusBar?: HTMLElement;

	callback_provided_input: any;
	callback_start_search: any;
	active: boolean = false;
    offset: number = 0;

	range_from: number;
	range_to: number;

	resolveStatusColor(): string {
		return <string> {
			'start': this.settings.status_color_start,
			'end': this.settings.status_color_end,
			'any': this.settings.status_color_any,
			'line': this.settings.status_color_line,
			'terminator': this.settings.status_color_terminator,
		}[this.mode ?? this.settings.default_action];
	}

	resolveSearchColor(idx: number = 0): SearchStyle {
		const settings = <any> this.settings;
		const st = this.resolveStatusColor();
		return {
			bg: settings[`search_color_bg_${this.mode ?? this.settings.default_action}`] ?? 'white',
			text: settings[`search_color_text_${this.mode ?? this.settings.default_action}`] ?? st,
			border: settings[`search_color_border_${this.mode ?? this.settings.default_action}`] ?? st,
            offset: this.offset,
			idx: idx
		}
	}

	async onload() {
		await this.loadSettings();

		this.search_state = new SearchState(
			this.settings.keyboard_layout,
			this.settings.keyboard_allowed,
			this.settings.keyboard_depth
		);

		inter_plugin_state.state['style_provider'] = (idx: number = 0) => this.resolveSearchColor(idx);

		inter_plugin_state.state['editor_callback'] = (view: EditorView) => {
			if (view.visibleRanges.length <= 0)
				return;
			const range = view.visibleRanges[0];
			this.range_from = range.from;
			this.range_to = range.to;
		};

		this.registerEditorExtension(blaze_jump_plugin);

		this.addCommand({
			id: "blaze-jump-toggle",
			name: "BlazeJump toggle and jump",
			editorCallback: (editor, ctx) => this.blazeAction(editor, ctx),
			hotkeys: [{
				modifiers: ['Ctrl'],
				key: '`',
			}]
		});

		this.addCommand({
			id: "blaze-jump-start",
			name: "BlazeJump start",
			editorCallback: (editor, ctx) => this.startAction(editor, ctx)
		});

		this.addCommand({
			id: "blaze-jump-end",
			name: "BlazeJump end",
			editorCallback: (editor, ctx) => this.endAction(editor, ctx)
		});

		this.addCommand({
			id: "blaze-jump-any",
			name: "BlazeJump any",
			editorCallback: (editor, ctx) => this.anyAction(editor, ctx)
		});

		this.addCommand({
			id: 'blaze-jump-abort',
			name: "BlazeJump abort search",
			editorCallback: (editor) => this.resetAction(editor)
		});

		this.addSettingTab(new BlazeJumpSettingTab(this.app, this));
	}

	onunload() {
		inter_plugin_state.state = {};
		this.resetAction();
	}

	statusSet(text: string) {
		this.statusClear();
		this.statusBar = this.addStatusBarItem();

		this.statusBar.createEl("span", { text: `${text} `, attr: {
			style: `
			background-color: ${this.settings.status_color_bg ?? 'transparent'}; 
			border: thin solid ${this.resolveStatusColor() ?? 'red'};
			color: ${this.resolveStatusColor() ?? 'red'};
			font-size: xx-small;
			border-radius: 5px;
			display: inline-grid;
			align-items: center;
			align-content: center;
			text-align: center;
			line-height: 13px;
			margin: -3px;
			padding-left: 4px;
			padding-right: 4px;
			`
		}});
	}

	statusClear() {
		this.statusBar?.remove();
		this.statusBar = undefined;
	}

	toggleMode(_?: Editor) {
		const mode_map = {
			'start': 'end',
			'end': 'any',
			'any': 'start'
		};
		// @ts-ignore
		const mode = this.mode ? mode_map[this.mode] : this.settings.default_action;
		this.resetAction();

		this.mode = <MODE_TYPE> mode;
	}

	resetAction(_?: Editor, full: boolean = true) {

        if (full) {
            this.statusClear();
            this.search_state.reset();
            this.mode = undefined;
            this.active = false;
            this.offset = 0;
        }

		if (this.callback_start_search)
			window.removeEventListener("keydown", this.callback_start_search);
		if (this.callback_provided_input)
			window.removeEventListener("keydown", this.callback_provided_input);

		this.callback_provided_input = null;
		this.callback_start_search = null;

		inter_plugin_state.state['positions'] = undefined;
	}

	blazeAction(editor: Editor, _: any) {
		this.toggleMode(editor);
		this.searchAction(editor);
	}

	startAction(editor: Editor, _: any) {
		this.mode = 'start';
		this.searchAction(editor);
	}

	endAction(editor: Editor, _: any) {
		this.mode = 'end';
		this.searchAction(editor);
	}

	anyAction(editor: Editor, _: any) {
		this.mode = 'any';
		this.searchAction(editor);
	}

	searchAction(editor: Editor) {
		this.statusSet("BlazeMode: ");
		const callback_on_provided = (event: any) => {
			try {
                window.removeEventListener("keydown", callback_on_provided);
                event.preventDefault();
                event.stopPropagation();
                const char = event.key;

                if (event.keyCode === 27 ||
                    event.which === 27 ||
                    `${event.key}`.toLowerCase() === 'escape' ||
                    `${event.code}`.toLowerCase() === 'escape')
                {
                    this.resetAction(editor);
                    if (inter_plugin_state.state['plugin_draw_callback'])
                        inter_plugin_state.state['plugin_draw_callback']();
                    (editor as any)['cm'].dispatch();
                    return;
                }

                this.offset += 1;
                this.search_state.narrow(char);

                const new_positions = this.search_state.process_positions()
                    .map(x => x[1])
                    .sort((a, b) => a.index_s - b.index_s);

                this.resetAction(editor, new_positions.length <= 1);

                if (new_positions.length > 1) {
                    inter_plugin_state.state['positions'] = [...new_positions];
                    this.statusSet("BlazeMode: " + `${char}`);
                    window.addEventListener('keydown', callback_on_provided, { once: true });
                    // TODO
                }

                else if (new_positions.length === 1) {
                    const position = new_positions[0];
                    editor.setCursor(position.start);
                    console.log('Jumped');
                    // TODO
                }

                else {
                    console.warn("Nothing found...");
                    // TODO
                }

                if (inter_plugin_state.state['plugin_draw_callback'])
                    inter_plugin_state.state['plugin_draw_callback']();

                (editor as any)['cm'].dispatch();

            } catch (e) {
				console.error(e);
				this.resetAction(editor);
                (editor as any)['cm'].dispatch();
				throw e;
			}
		}

		const callback_on_start = (event: any) => {
			try {
				const char = event.key;
				if (char.length <= 2 && char.trim().length > 0) {
					event.preventDefault();
					event.stopPropagation();
					window.removeEventListener("keydown", callback_on_start);

					const positions = this.performSearch(editor, char);
					if (!positions || positions.length <= 0) {
						this.resetAction(editor);
						if (inter_plugin_state.state['plugin_draw_callback'])
							inter_plugin_state.state['plugin_draw_callback']();
						// forcing re-render
                        (editor as any)['cm'].dispatch();
						return;
					}

					this.active = true;

					inter_plugin_state.state['positions'] = [...positions];

					this.statusSet("BlazeMode: " + `${char}`);
					window.addEventListener('keydown', callback_on_provided, { once: true });
				} else {
					event.preventDefault();
					event.stopPropagation();
					window.removeEventListener("keydown", callback_on_start);
					this.resetAction(editor);
				}

				if (inter_plugin_state.state['plugin_draw_callback'])
					inter_plugin_state.state['plugin_draw_callback']();

				// forcing re-render
				(editor as any)['cm'].dispatch();
			} catch (e) {
				console.error(e);
				this.resetAction(editor);
                (editor as any)['cm'].dispatch();
				throw e;
			}
		};

		this.callback_provided_input = callback_on_provided;
		this.callback_start_search = callback_on_start;
		window.addEventListener("keydown", callback_on_start, { once: true });
	}


	performSearch(editor: Editor, search: string) {
		const view = (<EditorView> (<any> editor)['cm']);

		const search_lower = search.toLowerCase();
		const visible_text = editor.getValue().toLowerCase();
		const search_area = visible_text.substring(this.range_from, this.range_to);

        let positions: SearchPosition[] = [];

		let index = search_area.indexOf(search_lower);
		const t0 = new Date().getTime();
		while (index > -1) {
			const end = editor.offsetToPos(index + this.range_from + search.length);
			const start = editor.offsetToPos(index + this.range_from);

			let search_position = <SearchPosition>{
				start: start,
				end: end,
				index_s: index + this.range_from,
				index_e: index + this.range_from + search.length,
				value: editor.getRange(start, end),
				coord: view.coordsAtPos(index + this.range_from)
			};

			if (this.mode === 'any') {
				this.search_state.assign(search_lower, search_position);
                positions.push(search_position);
			}

			else if (this.mode === 'start') {
				const pre = editor.offsetToPos((index > 0 ? index - 1 : index) + this.range_from);
				const nv = editor.getRange(pre, end).trim();
				if (nv.length == 1) {
                    this.search_state.assign(search_lower, search_position);
                    positions.push(search_position);
                }
			}

			else if (this.mode === 'end') {
				// TODO FIXME
				const post = editor.offsetToPos(Math.min(search_area.length - 1, index + 1) + this.range_from);
				const nv = editor.getRange(start, post).trim();
				if (nv.length == 1) {
                    this.search_state.assign(search_lower, search_position);
                    positions.push(search_position);
                }
			}

			index = search_area.indexOf(search_lower, index + 1);
		}

        this.search_state.process_positions();

		const t1 = new Date().getTime();

		console.log(`indexing: ${t1 - t0}ms`);
		console.log(`found: ${positions.length}`);

		return positions;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class BlazeJumpSettingTab extends PluginSettingTab {
	plugin: BlazeJumpPlugin;

	constructor(app: App, plugin: BlazeJumpPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("BlazeJump Settings")
			.setHeading();
	}
}
