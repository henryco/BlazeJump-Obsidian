import {PulseStyle, SearchPosition, SearchStyle, state as inter_plugin_state} from "./src/commons";
import {App, Editor, EditorPosition, Notice, Plugin, PluginSettingTab, Setting} from 'obsidian';
import {EditorView, Rect} from "@codemirror/view";
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

    search_dim_style?: string;
    search_dim_enabled?: boolean;

    search_spellcheck_disable?: boolean;

    search_jump_pulse?: boolean;
    search_jump_pulse_color?: string;
    search_jump_pulse_duration?: number;

    search_start_pulse?: boolean;
    search_start_pulse_duration?: number;

    search_not_found_text?: string;

    terminator_exceptions?: string;

    convert_utf8_to_ascii?: boolean;
    auto_jump_on_single?: boolean;
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

    search_color_text_start: 'Crimson',
    search_color_text_end: 'Blue',
    search_color_text_any: 'Aqua',

	search_color_bg_start: 'Yellow',
	search_color_bg_end: 'Yellow',
	search_color_bg_any: 'Purple',

    search_dim_enabled: true,
    search_dim_style: 'color: var(--text-faint);',

    search_spellcheck_disable: true,

    search_jump_pulse: true,
    search_jump_pulse_color: 'red',
    search_jump_pulse_duration: 0.15,

    search_start_pulse: true,
    search_start_pulse_duration: 0.15,

    terminator_exceptions: `.,;:'"\``,

    search_not_found_text: '🚫',

    convert_utf8_to_ascii: true,
    auto_jump_on_single: false
}

// noinspection DuplicatedCode
export default class BlazeJumpPlugin extends Plugin {
	public default_settings: ExpandSelectPluginSettings;
	public settings: ExpandSelectPluginSettings;

	private search_tree: SearchTree;
	private mode?: MODE_TYPE = undefined;

	private statusBar?: HTMLElement;

	private callback_provided_input: any;
	private callback_start_search: any;
    private callback_mouse_reset: any;

    private spellcheck?: string;

    private offset: number = 0;

	private range_from: number;
	private range_to: number;

	public async onload() {
		await this.loadSettings();

		this.search_tree = new SearchTree(
			this.settings.keyboard_layout,
			this.settings.keyboard_allowed,
			this.settings.keyboard_depth
		);

		inter_plugin_state.state.style_provider = (idx: number = 0) => this.resolveSearchColor(idx);
        inter_plugin_state.state.pulse_provider = () => this.resolvePulseStyle();

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

        this.addCommand({
            id: 'blaze-jump-line',
            name: "BlazeJump jump to line",
            editorCallback: (editor, ctx) => this.beginningAction(editor, ctx)
        });

        this.addCommand({
            id: 'blaze-jump-terminator',
            name: "BlazeJump jump to the end of a line",
            editorCallback: (editor, ctx) => this.terminatorAction(editor, ctx)
        });

		this.addSettingTab(new BlazeJumpSettingTab(this.app, this));
	}

	public onunload() {
		inter_plugin_state.state = {};
		this.resetAction();
	}

    private resolveStatusColor(): string {
        return <string> {
            'start': this.settings.status_color_start,
            'end': this.settings.status_color_end,
            'any': this.settings.status_color_any,
            'line': this.settings.status_color_line,
            'terminator': this.settings.status_color_terminator,
        }[this.mode ?? this.settings.default_action];
    }

    private resolveSearchColor(idx: number = 0): SearchStyle {
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

    private resolvePulseStyle(): PulseStyle {
        return {
            duration: this.settings.search_jump_pulse_duration ?? 0.15,
            bg: this.settings.search_jump_pulse_color ?? 'red'
        }
    }

    private statusSet(text: string) {
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

    private statusClear() {
		this.statusBar?.remove();
		this.statusBar = undefined;
	}

    private toggleMode(_?: Editor) {
		const mode_map = {
			'start': 'end',
			'end': 'any',
			'any': 'start'
		};

		const mode = this.mode ? (mode_map as any)[this.mode] : this.settings.default_action;
		this.resetAction();

		this.mode = <MODE_TYPE> mode;
	}

    private toggleLineMode(left: boolean, _?: Editor) {
        this.resetAction(_);
        this.mode = left ? 'line' : 'terminator';
    }

    private toggleDim(active: boolean) {
        if (!this.settings.search_dim_enabled)
            return;

        const style_id = 'dim-editor-style';
        const existingStyle = document.getElementById(style_id);
        if (active) {
            if (!existingStyle) {
                const style = document.createElement('style');
                style.id = style_id;
                style.textContent = `
                    .markdown-source-view {
                      
                    }
                    .cm-content {
                      ${this.settings.search_dim_style ?? ''}
                    }
                `;
                document.head.appendChild(style);
            }
        } else if (existingStyle) {
            existingStyle.remove();
        }
    }

    private toggleSpellcheck(active: boolean) {
        if (!this.settings.search_spellcheck_disable)
            return;

        const content = document.getElementsByClassName("cm-content");
        if (!content) return;

        for (let i = 0; i < content.length; i++) {
            const el = content[i];
            const spellcheck = el.getAttribute("spellcheck");
            if (!spellcheck || spellcheck.trim() === "")
                continue;

            if (!active) {
                this.spellcheck = spellcheck;
                el.setAttribute("spellcheck", "false");
                return;
            }

            if (this.spellcheck) {
                el.setAttribute("spellcheck", this.spellcheck);
            }

            return;
        }
    }

    private pulseInit(active: boolean): void {
        if (!this.settings.search_start_pulse)
            return;

        const style_id = 'pulse-once-init';
        const existingStyle = document.getElementById(style_id);

        if (!active && existingStyle) {
            existingStyle.remove();
            return
        }

        if (active && !existingStyle) {
            const style = document.createElement('style');
            style.id = style_id;
            style.textContent = `                  
                    .cm-content {
                      animation: pulse ${this.settings.search_start_pulse_duration ?? 0.15}s 1 forwards;
                    }
                    @keyframes pulse {
                        0% { opacity: 1; }
                        50% { opacity: 0.5; }
                        100% { opacity: 1; }
                    }
                `;
            document.head.appendChild(style);
        }
    }

    private jumpTo(editor: Editor, position: SearchPosition) {
        editor.setCursor(position.start);

        if (!this.settings.search_jump_pulse)
            return;

        inter_plugin_state.state.pointer = position;
        inter_plugin_state.state.positions = undefined;

        if (inter_plugin_state.state.plugin_draw_callback)
            inter_plugin_state.state.plugin_draw_callback();
        (editor as any)['cm'].dispatch();

        window.setTimeout(() => {
            inter_plugin_state.state.pointer = undefined;
            if (inter_plugin_state.state.plugin_draw_callback)
                inter_plugin_state.state.plugin_draw_callback();
        }, (this.settings.search_jump_pulse_duration ?? 0) * 1000);
    }

    private resetAction(_?: Editor, full: boolean = true) {
        if (full) {
            this.statusClear();
            this.toggleDim(false);
            this.pulseInit(false);
            this.toggleSpellcheck(true);
            this.search_tree.reset();
            this.mode = undefined;
            this.offset = 0;

            if (this.callback_mouse_reset) {
                window.removeEventListener("click", this.callback_mouse_reset);
                window.removeEventListener("contextmenu", this.callback_mouse_reset);
                window.removeEventListener("auxclick", this.callback_mouse_reset);
            }
            this.callback_mouse_reset = null;
        }

		if (this.callback_start_search)
			window.removeEventListener("keydown", this.callback_start_search);
		if (this.callback_provided_input)
			window.removeEventListener("keydown", this.callback_provided_input);

		this.callback_provided_input = null;
		this.callback_start_search = null;

		inter_plugin_state.state.positions = undefined;
        inter_plugin_state.state.pointer = undefined;
	}

    private blazeAction(editor: Editor, _: any) {
        this.resetAction(editor, false);
        this.toggleMode(editor);
		this.searchAction(editor);
	}

    private startAction(editor: Editor, _: any) {
        this.resetAction(editor);
        this.mode = 'start';
		this.searchAction(editor);
	}

	private endAction(editor: Editor, _: any) {
        this.resetAction(editor);
        this.mode = 'end';
		this.searchAction(editor);
	}

	private anyAction(editor: Editor, _: any) {
        this.resetAction(editor);
        this.mode = 'any';
		this.searchAction(editor);
	}

    private beginningAction(editor: Editor, _: any) {
        this.resetAction(editor);
        this.mode = 'line';
        this.lineAction(editor);
    }

    private terminatorAction(editor: Editor, _: any) {
        this.resetAction(editor);
        this.mode = 'terminator';
        this.lineAction(editor);
    }

    private lineAction(editor: Editor) {
        this.statusSet("BlazeMode: ");
        this.toggleSpellcheck(false);
        this.pulseInit(true);
        this.toggleDim(true);

        let positions: SearchPosition[];

        try {
            positions = this.performLineSearch(editor);
            if (!positions || positions.length <= 0) {
                this.resetAction(editor);
                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();
                (editor as any)['cm'].dispatch();
                return;
            }
        } catch (e) {
            console.error(e);
            this.resetAction(editor);
            if (inter_plugin_state.state.plugin_draw_callback)
                inter_plugin_state.state.plugin_draw_callback();
            (editor as any)['cm'].dispatch();
            return;
        }

        const callback_on_mouse_reset = (event: any) => {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            try {
                this.resetAction(editor);
                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();
            } finally {
                (editor as any)['cm'].dispatch();
            }
        };

        const callback_on_provided = (event: any) => {
            window.removeEventListener("keydown", callback_on_provided);
            event.preventDefault();
            event.stopPropagation();

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

            if (event.which === 37 ||
                event.keyCode === 37 ||
                `${event.code}`.toLowerCase() === 'arrowleft' ||
                `${event.key}`.toLowerCase() === 'arrowleft')
            {
                this.toggleLineMode(true, editor);
                this.lineAction(editor);
                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();
                (editor as any)['cm'].dispatch();
                return;
            }

            if (event.which === 39 ||
                event.keyCode === 39 ||
                `${event.code}`.toLowerCase() === 'arrowright' ||
                `${event.key}`.toLowerCase() === 'arrowright')
            {
                this.toggleLineMode(false, editor);
                this.lineAction(editor);
                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();
                (editor as any)['cm'].dispatch();
                return;
            }

            try {
                const char = event.key;
                this.search_tree.narrow(char);
                this.offset += 1;

                const new_positions = this.freeze_positions();
                this.resetAction(editor, new_positions.length <= 1);

                if (new_positions.length > 1) {
                    this.statusSet("BlazeMode: " + `${char}`);
                    inter_plugin_state.state.positions = [...new_positions];
                    window.addEventListener('keydown', callback_on_provided, { once: true });
                }

                else if (new_positions.length === 1) {
                    this.jumpTo(editor, new_positions[0]);
                }

                else if (this.settings.search_not_found_text &&
                    this.settings.search_not_found_text.trim() !== '') {
                    new Notice(this.settings.search_not_found_text);
                }

                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();
            }

            catch (e) {
                console.error(e);
                this.resetAction(editor);
                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();
                throw e;
            }

            finally {
                // forcing re-render
                (editor as any)['cm'].dispatch();
            }
        };

        inter_plugin_state.state.positions = [...positions];
        inter_plugin_state.state.pointer = undefined;

        if (inter_plugin_state.state.plugin_draw_callback)
            inter_plugin_state.state.plugin_draw_callback();
        (editor as any)['cm'].dispatch();

        this.callback_provided_input = callback_on_provided;
        this.callback_mouse_reset = callback_on_mouse_reset;

        window.addEventListener("keydown", callback_on_provided, { once: true });

        window.addEventListener("click", callback_on_mouse_reset, { once: true });
        window.addEventListener("contextmenu", callback_on_mouse_reset, { once: true });
        window.addEventListener("auxclick", callback_on_mouse_reset, { once: true });
    }

	private searchAction(editor: Editor) {
        this.statusSet("BlazeMode: ");
        this.pulseInit(true);

        const callback_on_mouse_reset = (event: any) => {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            try {
                this.resetAction(editor);
                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();
            } finally {
                (editor as any)['cm'].dispatch();
            }
        };

		const callback_on_provided = (event: any) => {
			try {
                window.removeEventListener("keydown", callback_on_provided);
                event.preventDefault();
                event.stopPropagation();

                if (event.keyCode === 27 ||
                    event.which === 27 ||
                    `${event.key}`.toLowerCase() === 'escape' ||
                    `${event.code}`.toLowerCase() === 'escape')
                {
                    this.resetAction(editor);
                    if (inter_plugin_state.state.plugin_draw_callback)
                        inter_plugin_state.state.plugin_draw_callback();
                    return;
                }

                if (event.which === 37 ||
                    event.keyCode === 37 ||
                    `${event.code}`.toLowerCase() === 'arrowleft' ||
                    `${event.key}`.toLowerCase() === 'arrowleft')
                {
                    this.toggleLineMode(true, editor);
                    this.lineAction(editor);
                    if (inter_plugin_state.state.plugin_draw_callback)
                        inter_plugin_state.state.plugin_draw_callback();
                    return;
                }

                if (event.which === 39 ||
                    event.keyCode === 39 ||
                    `${event.code}`.toLowerCase() === 'arrowright' ||
                    `${event.key}`.toLowerCase() === 'arrowright')
                {
                    this.toggleLineMode(false, editor);
                    this.lineAction(editor);
                    if (inter_plugin_state.state.plugin_draw_callback)
                        inter_plugin_state.state.plugin_draw_callback();
                    return;
                }

                const char = event.key;

                this.offset += 1;
                this.search_tree.narrow(char);

                const new_positions = this.freeze_positions();

                this.resetAction(editor, new_positions.length <= 1);

                if (new_positions.length > 1) {
                    this.statusSet("BlazeMode: " + `${char}`);
                    inter_plugin_state.state.positions = [...new_positions];
                    window.addEventListener('keydown', callback_on_provided, { once: true });
                }

                else if (new_positions.length === 1) {
                    this.jumpTo(editor, new_positions[0]);
                }

                else if (this.settings.search_not_found_text &&
                    this.settings.search_not_found_text.trim() !== '') {
                    new Notice(this.settings.search_not_found_text);
                }

                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();
            }

            catch (e) {
				console.error(e);
				this.resetAction(editor);
                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();
				throw e;
			}

            finally {
                // forcing re-render
                (editor as any)['cm'].dispatch();
            }
		}

		const callback_on_start = (event: any) => {
            window.removeEventListener("keydown", callback_on_start);
            event.preventDefault();
            event.stopPropagation();

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

            if (event.which === 37 ||
                event.keyCode === 37 ||
                `${event.code}`.toLowerCase() === 'arrowleft' ||
                `${event.key}`.toLowerCase() === 'arrowleft')
            {
                this.toggleLineMode(true, editor);
                this.lineAction(editor);
                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();
                (editor as any)['cm'].dispatch();
                return;
            }

            if (event.which === 39 ||
                event.keyCode === 39 ||
                `${event.code}`.toLowerCase() === 'arrowright' ||
                `${event.key}`.toLowerCase() === 'arrowright')
            {
                this.toggleLineMode(false, editor);
                this.lineAction(editor);
                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();
                (editor as any)['cm'].dispatch();
                return;
            }

            try {
                this.toggleSpellcheck(false);
                this.toggleDim(true);

                const char = event.key;

				if (char.length <= 2 && char.trim().length > 0) {
					const positions = this.performSearch(editor, char);
					if (!positions || positions.length <= 0) {
						this.resetAction(editor);
						if (inter_plugin_state.state.plugin_draw_callback)
							inter_plugin_state.state.plugin_draw_callback();
						return;
					}

                    if (positions.length === 1 && (this.settings.auto_jump_on_single === true)) {
                        this.resetAction(editor);
                        this.jumpTo(editor, positions[0]);
                        return;
                    }

					inter_plugin_state.state.positions = [...positions];
                    inter_plugin_state.state.pointer = undefined;

					this.statusSet("BlazeMode: " + `${char}`);
					window.addEventListener('keydown', callback_on_provided, { once: true });
				} else {
					this.resetAction(editor);
				}

                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();
			}

            catch (e) {
				console.error(e);
				this.resetAction(editor);
                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();
				throw e;
			}

            finally {
                // forcing re-render
                (editor as any)['cm'].dispatch();
            }
		};

		this.callback_provided_input = callback_on_provided;
		this.callback_start_search = callback_on_start;
        this.callback_mouse_reset = callback_on_mouse_reset;

		window.addEventListener("keydown", callback_on_start, { once: true });

		window.addEventListener("click", callback_on_mouse_reset, { once: true });
		window.addEventListener("contextmenu", callback_on_mouse_reset, { once: true });
		window.addEventListener("auxclick", callback_on_mouse_reset, { once: true });
	}

    private performLineSearch(editor: Editor) {
        const view = (<EditorView> (<any> editor)['cm']);

        const from = editor.offsetToPos(this.range_from);
        const to = editor.offsetToPos(this.range_to);

        if (!from || !to) {
            this.search_tree.reset();
            return [];
        }

        const search_char = this.search_tree.midLayoutChar();

        const line_f = from.line;
        const line_t = to.line;

        let first: Rect | null = null;
        let anchor: EditorPosition | null = null;

        for (let i = line_f; i < line_t; i++) {
            const start = <EditorPosition> { line: i, ch: 0 };
            const length = editor.getLine(i).length;

            if (length > 0) {
                first = view.coordsAtPos(editor.posToOffset(start));
                anchor = start;
            }

            else if (length <= 0) {
                if (!first || !anchor) {
                    for (let k = i + 1; k < line_t; k++) {
                        const st = <EditorPosition> { line: k, ch: 0 };
                        if (editor.getLine(k).length > 0) {
                            first = view.coordsAtPos(editor.posToOffset(st));
                            anchor = st;
                            break;
                        }
                    }
                }
                if (!first || !anchor)
                    continue;

                const end = <EditorPosition> { line: i, ch: 1 };
                const pos = editor.posToOffset(anchor);
                const zero = view.coordsAtPos(editor.posToOffset(start));
                this.search_tree.assign(search_char, <SearchPosition> {
                    index_e: pos + 1,
                    index_s: pos,
                    origin: first,
                    coord: zero,
                    start: start,
                    end: end
                });

                continue;
            }

            if (this.mode === 'line') {
                const end = <EditorPosition> { line: i, ch: 1 };
                const pos = editor.posToOffset(start);
                const zero = view.coordsAtPos(pos);
                this.search_tree.assign(search_char, <SearchPosition> {
                    index_e: pos + 1,
                    index_s: pos,
                    origin: zero,
                    coord: zero,
                    start: start,
                    end: end
                });
            }

            else if (this.mode === 'terminator') {
                const stp = <EditorPosition> { line: i, ch: Math.max(0, length - 1) };
                const edp = <EditorPosition> { line: i, ch: Math.max(0, length ) };
                const zero = view.coordsAtPos(editor.posToOffset(start));
                const pos = editor.posToOffset(stp);
                const coord = view.coordsAtPos(pos);
                this.search_tree.assign(search_char, <SearchPosition> {
                    index_e: pos + 1,
                    index_s: pos,
                    origin: zero,
                    coord: coord,
                    start: edp,
                    end: edp
                });
            }
        }

        return this.freeze_positions();
    }

	private performSearch(editor: Editor, search: string) {
		const term_exceptions = [...this.settings.terminator_exceptions ?? ''];

        const view = (<EditorView> (<any> editor)['cm']);
        const search_lower = this.normalize_text(search.toLowerCase());
		const visible_text = editor.getValue().toLowerCase();
		const search_area = visible_text.substring(this.range_from, this.range_to);

		let index = search_area.indexOf(search_lower);
		const t0 = new Date().getTime();
		while (index > -1) {
			const end = editor.offsetToPos(index + this.range_from + search.length);
			const start = editor.offsetToPos(index + this.range_from);

            const zero = view.coordsAtPos(index + this.range_from - start.ch);
            const coord = view.coordsAtPos(index + this.range_from);

			let search_position = <SearchPosition> {
				index_e: index + this.range_from - start.ch + search.length,
				index_s: index + this.range_from - start.ch,
				value: editor.getRange(start, end),
                origin: zero,
				coord: coord,
				start: start,
				end: end
			};

			if (this.mode === 'any') {
				this.search_tree.assign(search_lower, search_position);
			}

			else if (this.mode === 'start') {
				const pre = editor.offsetToPos((index > 0 ? index - 1 : index) + this.range_from);
				const nv = editor.getRange(pre, end).trim();
				if (nv.length === 1) {
                    this.search_tree.assign(search_lower, search_position);
                }
			}

			else if (this.mode === 'end') {
				const two = editor.offsetToPos(index + search.length + 1 + this.range_from);
				const nv = editor.getRange(start, two).trim();
				if (nv.length === 1) {
                    search_position.start.ch += 1;
                    this.search_tree.assign(search_lower, search_position);
                } else if (nv.length === 2 && term_exceptions.some(x => x === nv.substring(1))) {
                    search_position.start.ch += 1;
                    this.search_tree.assign(search_lower, search_position);
                }
			}

			index = search_area.indexOf(search_lower, index + 1);
		}

        let positions = this.freeze_positions();

		const t1 = new Date().getTime();

		console.log(`indexing: ${t1 - t0}ms`);
		console.log(`found: ${positions.length}`);

		return positions;
	}

    private freeze_positions(): SearchPosition[] {
        return this.search_tree.freeze_nodes()
            .map(x => ({...x.value as SearchPosition, name: x.full_id.substring(1)}))
            .sort((a, b) => a.index_s - b.index_s);
    }

    private normalize_text(str: string): string {
        return (this.settings.convert_utf8_to_ascii === true)
            ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            : str;
    }

    public async loadSettings() {
        this.default_settings = {...this.settings};
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

    public async resetSettings() {
        this.settings = {...this.default_settings};
        await this.saveData(this.settings);
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    public async saveProperty(name: string, value?: any) {
        if (!name || name.trim().length <= 0)
            return;
        (this.settings as any)[name] = value;
        await this.saveData(this.settings);
    }
}

class BlazeJumpSettingTab extends PluginSettingTab {
	private plugin: BlazeJumpPlugin;

	public constructor(app: App, plugin: BlazeJumpPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	public display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("BlazeJump Settings")
			.setHeading()
            .addButton(x => {
                x.setButtonText("Reset")
                    .onClick(async () => {
                        await this.plugin.resetSettings();
                        this.hide();
                        this.display();
                    });
            });

        new Setting(containerEl)
            .setName("Default Mode")
            .addDropdown(x => {
                x.setValue(this.plugin.settings.default_action)
                    .addOption('start', "Word start")
                    .addOption('end', "Word end")
                    .addOption('any', "Any character")
                    .addOption('line', "Line start")
                    .addOption('terminator', "Line end")
                    .onChange(async (value) => {
                        await this.plugin.saveProperty('default_action', value);
                    });
            })

        new Setting(containerEl)
            .setName("Keyboard Layout")
            .addTextArea(x => {
                x.setValue((this.plugin.settings.keyboard_layout ?? '')
                    .trim().replace(/\s+/g, '\n'))
                    .onChange(async (value) => {
                        await this.plugin.saveProperty('keyboard_layout', value);
                    });
            })

        // TODO settings
	}
}
