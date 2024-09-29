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
	bg: string,
	text: string,
	border: string
}

interface SearchPosition {
	start: EditorPosition;
	end: EditorPosition;
	index_s: number;
	index_e: number;
	value: string;
	coord: Coord;
}

const DEFAULT_SETTINGS: ExpandSelectPluginSettings = {
	default_action: "start",
	keyboard_layout: "1234567890 qwertyuiop asdfghjkl zxcvbnm",
	keyboard_allowed: "0123456789abcdefghijklmnopqrstuvwxyz",
	keyboard_depth: -1,

	status_color_bg: 'transparent',

	status_color_start: 'Crimson',
	status_color_end: 'Blue',
	status_color_any: 'Green',
	status_color_line: 'Magenta',
	status_color_terminator: 'DimGray'
}

const inter_plugin_state: any = {
	state: {}
}

export class SearchState {
	layout_characters: (string | null)[];
	layout_width: number;
	layout_height: number;
	layout_depth: number;

	search_tree: any;
	search_depth: number;
	search_position?: [number, number];

	constructor(keyboard_layout: string, keyboard_allowed: string, distance: number) {
		this.initKeyboardLayout(keyboard_layout, keyboard_allowed);
		this.search_position = undefined;
		this.layout_depth = distance;
		this.search_tree = {};
		this.search_depth = 0;
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

	nextPos(pos: [number, number],
			mid: [number, number],
			depth: number
	): [nx: number, ny: number, nd: number] {

		const [x, y] = pos;
		const [mx, my] = mid;

		if (depth <= 0)
			return [mx, my, 1];

		// spiral movement

		const sx = mx - depth;
		const sy = my - depth;

		let px = x;
		let py = y;

		if (py < 0) {
			px = mx + depth;
		}

		if (px >= this.layout_width) {
			py = my + depth;
		}

		if (py >= this.layout_height) {
			px = mx - depth;
		}

		if (px < 0) {
			py = my - depth;
		}

		// full circle
		if (px === sx && py === sy && (px !== x || py !== y)) {
			if (px < 0 || py < 0 || px >= this.layout_width || py >= this.layout_height) {
				// out of range
				return [...mid, -1];
			}

			// depth += 1
			return this.nextPos([px - 1, py - 1], mid, depth + 1);
		}

		if (py >= this.layout_height && px >= 0) {
			py = this.layout_height - 1;
		}

		if (py < 0 && px >= 0) {
			py = 0;
		}

		const dx = mx - px;
		const dy = my - py;

		if (Math.abs(dx) === depth && Math.abs(dy) === depth) {
			if (dx > 0 && dy > 0)
				px += 1;
			else if (dx > 0 && dy < 0)
				py -= 1;
			else if (dx < 0 && dy > 0)
				py += 1;
			else
				px -= 1;
		}

		else if (Math.abs(dx) < depth) {
			px += (dy <= 0 ? (-1) : 1);
		}

		else if (Math.abs(dy) < depth) {
			py += (Math.sign(dx) * (-1));
		}

		if (px === sx && py === sy) {
			// depth += 1
			return this.nextPos([px - 1, py - 1], mid, depth + 1);
		}

		return [px, py, depth];
	}

	assign(input: string, position: SearchPosition): string {
		const [x, y] = this.coord(input);

		let char: string | null = null;
		let loop = 0;
		while (true) {
			if (loop++ >= 100) {
				// TODO
				return '#'; // prevent from dead-spinning
			}

			const [last_x, last_y] = this.search_position ?? [x, y];
			const [n_x, n_y, depth] = this.nextPos([last_x, last_y], [x, y], this.search_depth);

			this.search_position = [n_x, n_y];
			this.search_depth = depth;

			char = this.from(n_x, n_y);

			if (char === null) {
				continue;
			}

			const prev = this.search_tree[char];
			if (!prev) {
				this.search_tree[char] = position;
				return char;
			}

			return char;
		}
	}

	reset(): void {
		this.search_position = undefined;
		this.search_depth = 0;
		this.search_tree = {};
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
		const el = document.createElement("mark");
		el.innerText = this.replace_text.toLowerCase();
		el.style.backgroundColor = `${this.style.bg}`;
		el.style.color = `${this.style.text}`;
		el.style.border = `thin dashed ${this.style.border}`;
		el.style.position = 'absolute';
		el.style.zIndex = '9999';
		el.style.fontWeight = 'bold';
		el.style.paddingLeft = '2px';
		el.style.paddingRight = '2px';
		el.style.whiteSpace = 'pre-wrap';
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

		const search_style: SearchStyle = inter_plugin_state.state['style_provider']();
		const builder = new RangeSetBuilder<Decoration>();

		for (let position of positions) {
			builder.add(
				position.index_s,
				position.index_s,
				Decoration.replace({
					widget: new BlazeFoundAreaWidget(
						position.value,
						position,
						search_style),
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

	resolveSearchColor(): SearchStyle {
		const settings = <any> this.settings;
		const st = this.resolveStatusColor();
		return {
			bg: settings[`search_color_bg_${this.mode ?? this.settings.default_action}`] ?? 'white',
			text: settings[`search_color_text_${this.mode ?? this.settings.default_action}`] ?? st,
			border: settings[`search_color_border_${this.mode ?? this.settings.default_action}`] ?? st
		}
	}

	async onload() {
		await this.loadSettings();

		this.search_state = new SearchState(
			this.settings.keyboard_layout,
			this.settings.keyboard_allowed,
			this.settings.keyboard_depth
		);

		inter_plugin_state.state['style_provider'] = () => this.resolveSearchColor();

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

	resetAction(_?: Editor) {
		this.active = false;
		this.statusClear();
		this.search_state.reset();

		if (this.callback_start_search)
			window.removeEventListener("keydown", this.callback_start_search);
		if (this.callback_provided_input)
			window.removeEventListener("keydown", this.callback_provided_input);

		this.callback_provided_input = null;
		this.callback_start_search = null;
		this.mode = undefined;

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
				// const char = event.key;

				event.preventDefault();
				event.stopPropagation();
				window.removeEventListener("keydown", callback_on_provided);

				// TODO

				this.resetAction(editor);
				if (inter_plugin_state.state['plugin_draw_callback'])
					inter_plugin_state.state['plugin_draw_callback']();
				// @ts-ignore
				editor['cm'].dispatch();

			} catch (e) {
				console.error(e);
				this.resetAction(editor);
				// @ts-ignore
				editor['cm'].dispatch();
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
						// @ts-ignore
						editor['cm'].dispatch();
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
				// @ts-ignore
				editor['cm'].dispatch();
			} catch (e) {
				console.error(e);
				this.resetAction(editor);
				// @ts-ignore
				editor['cm'].dispatch();
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
		const positions = [];

		let index = search_area.indexOf(search_lower);
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
				const n_val = this.search_state.assign(search_lower, search_position);
				search_position.value = n_val;
				positions.push(search_position);
			}

			else if (this.mode === 'start') {
				const pre = editor.offsetToPos((index > 0 ? index - 1 : index) + this.range_from);
				const nv = editor.getRange(pre, end).trim();
				if (nv.length == 1) {
					const n_val = this.search_state.assign(search_lower, search_position);
					search_position.value = n_val;
					positions.push(search_position);
				}
			}

			else if (this.mode === 'end') {
				// TODO FIXME
				const post = editor.offsetToPos(Math.min(search_area.length - 1, index + 1) + this.range_from);
				const nv = editor.getRange(start, post).trim();
				if (nv.length == 1) {
					const n_val = this.search_state.assign(search_lower, search_position);
					search_position.value = n_val;
					positions.push(search_position);
				}
			}

			index = search_area.indexOf(search_lower, index + 1);
		}

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
