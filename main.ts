import {SearchPosition, SearchStyle, state as inter_plugin_state} from "./src/commons";
import {App, Editor, Notice, Plugin, PluginSettingTab, Setting} from 'obsidian';
import {EditorView} from "@codemirror/view";
import {SearchTree} from "./src/search_tree";
import {blaze_jump_view_plugin} from "./src/view"

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

export default class BlazeJumpPlugin extends Plugin {
	settings: ExpandSelectPluginSettings;

	search_tree: SearchTree;
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

		this.search_tree = new SearchTree(
			this.settings.keyboard_layout,
			this.settings.keyboard_allowed,
			this.settings.keyboard_depth
		);

		inter_plugin_state.state.style_provider = (idx: number = 0) => this.resolveSearchColor(idx);
		inter_plugin_state.state.editor_callback = (view: EditorView) => {
			if (view.visibleRanges.length <= 0)
				return;
			const range = view.visibleRanges[0];
			this.range_from = range.from;
			this.range_to = range.to;
		};

		this.registerEditorExtension(blaze_jump_view_plugin);

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

    toggleDim(active: boolean) {
        const existingStyle = document.getElementById('dim-editor-style');
        if (active) {

            if (!existingStyle) {
                const style = document.createElement('style');
                style.id = 'dim-editor-style';
                style.textContent = `
                
                    .markdown-source-view {
                      
                    }
                    
                `;
                document.head.appendChild(style);
            }

        } else if (existingStyle) {
            existingStyle.remove();
        }
    }

    toggleSpellcheck(active: boolean) {
        // TODO
    }

	resetAction(_?: Editor, full: boolean = true) {

        if (full) {
            this.statusClear();
            this.toggleDim(false);
            this.toggleSpellcheck(true);
            this.search_tree.reset();
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

		inter_plugin_state.state.positions = undefined;
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

        this.toggleDim(true);
        this.toggleSpellcheck(false);
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
                    if (inter_plugin_state.state.plugin_draw_callback)
                        inter_plugin_state.state.plugin_draw_callback();
                    (editor as any)['cm'].dispatch();
                    return;
                }

                this.offset += 1;
                this.search_tree.narrow(char);

                const new_positions = this.search_tree.process_positions()
                    .map(x => x[1] as SearchPosition)
                    .sort((a, b) => a.index_s - b.index_s);

                this.resetAction(editor, new_positions.length <= 1);

                if (new_positions.length > 1) {
                    inter_plugin_state.state.positions = [...new_positions];
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
                    new Notice("Nothing found"); // TODO FIXME?
                }

                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();

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
						if (inter_plugin_state.state.plugin_draw_callback)
							inter_plugin_state.state.plugin_draw_callback();
						// forcing re-render
                        (editor as any)['cm'].dispatch();
						return;
					}

					this.active = true;

					inter_plugin_state.state.positions = [...positions];

					this.statusSet("BlazeMode: " + `${char}`);
					window.addEventListener('keydown', callback_on_provided, { once: true });
				} else {
					event.preventDefault();
					event.stopPropagation();
					window.removeEventListener("keydown", callback_on_start);
					this.resetAction(editor);
				}

                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();

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

			let search_position = <SearchPosition> {
				start: start,
				end: end,
				index_s: index + this.range_from,
				index_e: index + this.range_from + search.length,
				value: editor.getRange(start, end),
				coord: view.coordsAtPos(index + this.range_from)
			};

			if (this.mode === 'any') {
				this.search_tree.assign(search_lower, search_position);
                positions.push(search_position);
			}

			else if (this.mode === 'start') {
				const pre = editor.offsetToPos((index > 0 ? index - 1 : index) + this.range_from);
				const nv = editor.getRange(pre, end).trim();
				if (nv.length == 1) {
                    this.search_tree.assign(search_lower, search_position);
                    positions.push(search_position);
                }
			}

			else if (this.mode === 'end') {
				// TODO FIXME
				const post = editor.offsetToPos(Math.min(search_area.length - 1, index + 1) + this.range_from);
				const nv = editor.getRange(start, post).trim();
				if (nv.length == 1) {
                    this.search_tree.assign(search_lower, search_position);
                    positions.push(search_position);
                }
			}

			index = search_area.indexOf(search_lower, index + 1);
		}

        this.search_tree.process_positions();

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
