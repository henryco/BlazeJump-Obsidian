import {MODE_TYPE, PulseStyle, SearchPosition, SearchStyle, state as inter_plugin_state} from "./src/commons";
import {Editor, EditorPosition, Notice, Plugin} from 'obsidian';
import {EditorView, Rect} from "@codemirror/view";
import {SearchTree} from "./src/search_tree";
import {blaze_jump_view_plugin} from "./src/view"
import {BlazeJumpPluginSettings, BlazeJumpSettingTab} from "./src/settings";
import {EN_TRANSLATIONS, provide_translations, Translations} from "./src/translations";

// noinspection DuplicatedCode,JSUnusedGlobalSymbols
export default class BlazeJumpPlugin extends Plugin {

    private plugin_settings: BlazeJumpSettingTab;

	private search_tree: SearchTree;
	private mode?: MODE_TYPE = undefined;
    private current_char?: string = undefined;

    private override_recognize: boolean = false;

    private layout_def: number = 0;
    private layout_cur: number = 0;
    private layout_num: number = 1;

	private statusBar?: HTMLElement;
	private layoutBar?: HTMLElement;

	private callback_provided_input: any;
	private callback_start_search: any;
    private callback_mouse_reset: any;

    private spellcheck?: string;

    private offset: number = 0;

	private range_from: number;
	private range_to: number;

    private get settings(): BlazeJumpPluginSettings {
        return this.plugin_settings.getSettings();
    }

    private get lang(): Translations {
        try {
            return provide_translations(this.settings.language);
        } catch (e) {
            console.error("Provide translations error", e);
            return EN_TRANSLATIONS;
        }
    }

    private async initialize() {
        const layouts = [this.settings.keyboard_layout_main,
            ...(this.settings.keyboard_layout_custom?.filter(x => x.trim() !== ''))];

        this.layout_num = layouts.length;
        this.layout_cur = 0;
        this.layout_def = 0;

        this.search_tree = new SearchTree(
            layouts,
            this.settings.keyboard_ignored,
            this.settings.keyboard_depth
        );

        this.layoutSet(this.layout_cur);
    }

	public async onload() {
        try {
            this.plugin_settings = await new BlazeJumpSettingTab(this.app, this).initialize();
            this.plugin_settings.setCallback(() => this.initialize());

            await this.initialize();

            inter_plugin_state.state.style_provider = (idx: number = 0) => this.resolveSearchColor(idx);
            inter_plugin_state.state.pulse_provider = () => this.resolvePulseStyle();

            inter_plugin_state.state.editor_callback = (view: EditorView) => {
                if (view.visibleRanges.length <= 0)
                    return;
                this.range_from = view.visibleRanges[0].from;
                this.range_to = view.visibleRanges[view.visibleRanges.length - 1].to;
            };

            this.registerEditorExtension(blaze_jump_view_plugin);

            this.addCommand({
                id: "toggle",
                name: this.lang.command_toggle,
                editorCallback: (editor, ctx) => this.blazeAction(editor, ctx),

                // hotkeys: [{
                //     modifiers: ['Ctrl'],
                //     key: '`',
                // }]

            });

            this.addCommand({
                id: "start",
                name: this.lang.command_word_start,
                editorCallback: (editor, ctx) => this.startAction(editor, ctx)
            });

            this.addCommand({
                id: "end",
                name: this.lang.command_word_end,
                editorCallback: (editor, ctx) => this.endAction(editor, ctx)
            });

            this.addCommand({
                id: "any",
                name: this.lang.command_any_char,
                editorCallback: (editor, ctx) => this.anyAction(editor, ctx)
            });

            this.addCommand({
                id: 'abort',
                name: this.lang.command_abort,
                editorCallback: (editor) => this.resetAction(editor)
            });

            this.addCommand({
                id: 'line',
                name: this.lang.command_line_start,
                editorCallback: (editor, ctx) => this.beginningAction(editor, ctx)
            });

            this.addCommand({
                id: 'terminator',
                name: this.lang.command_line_end,
                editorCallback: (editor, ctx) => this.terminatorAction(editor, ctx)
            });

            this.addCommand({
               id: 'layout',
               name: this.lang.command_layout,
               editorCallback: (editor, ctx) => this.layoutAction(editor, ctx)
            });
        } catch (e) {
            console.error(e);
        } finally {
            this.addSettingTab(this.plugin_settings);
        }
	}

	public onunload() {
		inter_plugin_state.state = {};
		this.resetAction();
        this.layoutClear();
	}

    private resolveStatusColor(): string {
        return <string>(this.settings as any)[`status_color_${this.mode ?? this.settings.default_action}`];
    }

    private resolveSearchColor(idx: number = 0): SearchStyle {
        const settings = <any> this.settings;
        const st = this.resolveStatusColor();
        return {
            capitalize: this.settings.capitalize_tags_labels === true,
            bg: settings[`search_color_bg_${this.mode ?? this.settings.default_action}`] ?? '#FFFFFF',
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

		this.statusBar.createEl("span", { text: `${text} `, cls: 'blaze-jump-status-bar', attr: {
			style: `
			background-color: ${this.settings.status_color_bg ?? '#FFFFFF00'}; 
			border: thin solid ${this.resolveStatusColor() ?? this.settings.status_color_fallback};
			color: ${this.resolveStatusColor() ?? this.settings.status_color_fallback};
			`
		}});
	}

    private layoutSet(idx: number) {
        const text = idx > 0 ? `${idx}` : 'M';

        if (!this.layoutBar) {
            this.layoutBar = this.addStatusBarItem();
            this.layoutBar.addEventListener('click', () => this.layoutAction());
        } else {
            const nodes = this.layoutBar.childNodes;
            for (let i = 0; i < nodes.length; i++) {
                this.layoutBar.removeChild(nodes[i]);
            }
        }

        this.layoutBar.createEl("span", {text: text, cls: 'blaze-jump-layout-bar'});
    }

    private statusClear() {
		this.statusBar?.remove();
		this.statusBar = undefined;
	}

    private layoutClear() {
        this.layoutBar?.remove();
        this.layoutBar = undefined;
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

    private resetLayout() {
        this.layout_cur = this.layout_def;
        this.layoutSet(this.layout_cur);
    }

    private toggleLayout(sign: number = 1) {
        this.layout_cur += sign;
        if (this.layout_cur >= this.layout_num)
            this.layout_cur = 0;
        if (this.layout_cur < 0) {
            this.layout_cur = this.layout_num - 1;
        }
        this.layoutSet(this.layout_cur);
    }

    private toggleLineMode(left: boolean, _?: Editor) {
        const current_mode = this.mode;
        this.resetAction(_);
        this.mode = left ? 'line' : 'terminator';
        return current_mode !== this.mode;
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
                      animation: blaze-jump-content-pulse ${this.settings.search_start_pulse_duration ?? 0.15}s 1 forwards;
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

            this.override_recognize = false;
            this.callback_mouse_reset = null;
            this.current_char = undefined;
            this.resetLayout();
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

    private layoutAction(_?: Editor, __?: any) {
        this.toggleLayout();
        this.layout_def = this.layout_cur;
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
        this.statusSet(`${this.lang.mode}: `);
        this.toggleSpellcheck(false);
        this.pulseInit(true);
        this.toggleDim(true);

        editor.blur();

        let positions: SearchPosition[];

        try {
            positions = this.performLineSearch(editor);
            if (!positions || positions.length <= 0) {
                this.resetAction(editor);
                editor.focus();
                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();
                (editor as any)['cm'].dispatch();
                return;
            }
        } catch (e) {
            console.error(e);
            this.resetAction(editor);
            editor.focus();
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
                editor.focus();
                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();

                window.removeEventListener("click", callback_on_mouse_reset);
                window.removeEventListener("contextmenu", callback_on_mouse_reset);
                window.removeEventListener("auxclick", callback_on_mouse_reset);
            } finally {
                (editor as any)['cm'].dispatch();
            }
        };

        const callback_on_provided = (event: any) => {
            window.removeEventListener("keydown", callback_on_provided);
            event.preventDefault();
            event.stopPropagation();

            if (event.which === 16 ||
                event.keyCode === 16 ||
                `${event.key}`.toLowerCase() === 'shift'
            ) {
                this.callback_provided_input = callback_on_provided;
                window.addEventListener('keydown', callback_on_provided, { once: true });
                return;
            }

            if (event.keyCode === 27 ||
                event.which === 27 ||
                `${event.key}`.toLowerCase() === 'escape' ||
                `${event.code}`.toLowerCase() === 'escape')
            {
                this.resetAction(editor);
                editor.focus();
                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();
                (editor as any)['cm'].dispatch();
                return;
            }

            if (event.which === 38 ||
                event.keyCode === 38 ||
                `${event.code}`.toLowerCase() === 'arrowup' ||
                `${event.key}`.toLowerCase() === 'arrowup') {
                if (this.settings.keyboard_arrows_switch) {
                    const curr_layout = this.layout_cur;
                    const curr_mode = this.mode;
                    this.resetAction(editor);
                    this.layout_cur = curr_layout;
                    this.mode = curr_mode;
                    this.toggleLayout(+1);
                    this.lineAction(editor);
                    if (inter_plugin_state.state.plugin_draw_callback)
                        inter_plugin_state.state.plugin_draw_callback();
                    (editor as any)['cm'].dispatch();
                    return;
                }
            }

            if (event.which === 40 ||
                event.keyCode === 40 ||
                `${event.code}`.toLowerCase() === 'arrowdown' ||
                `${event.key}`.toLowerCase() === 'arrowdown') {
                if (this.settings.keyboard_arrows_switch) {
                    const curr_layout = this.layout_cur;
                    const curr_mode = this.mode;
                    this.resetAction(editor);
                    this.layout_cur = curr_layout;
                    this.mode = curr_mode;
                    this.toggleLayout(-1);
                    this.lineAction(editor);
                    if (inter_plugin_state.state.plugin_draw_callback)
                        inter_plugin_state.state.plugin_draw_callback();
                    (editor as any)['cm'].dispatch();
                    return;
                }
            }

            if (event.which === 37 ||
                event.keyCode === 37 ||
                `${event.code}`.toLowerCase() === 'arrowleft' ||
                `${event.key}`.toLowerCase() === 'arrowleft')
            {
                const curr_layout = this.layout_cur;
                const changed = this.toggleLineMode(true, editor);
                if (this.settings.keyboard_arrows_switch && !changed) {
                    this.layout_cur = curr_layout;
                    this.toggleLayout();
                }

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
                const curr_layout = this.layout_cur;
                const changed = this.toggleLineMode(false, editor);
                if (this.settings.keyboard_arrows_switch && !changed) {
                    this.layout_cur = curr_layout;
                    this.toggleLayout()
                }

                this.lineAction(editor);
                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();
                (editor as any)['cm'].dispatch();
                return;
            }

            try {
                const char = `${event.key}`.toLowerCase();
                this.search_tree.narrow(char);
                this.offset += 1;

                const new_positions = this.freeze_positions();
                this.resetAction(editor, new_positions.length <= 1);

                if (new_positions.length > 1) {
                    this.statusSet(`${this.lang.mode}: ${char}`);
                    inter_plugin_state.state.positions = [...new_positions];

                    this.callback_provided_input = callback_on_provided;
                    window.addEventListener('keydown', callback_on_provided, { once: true });
                }

                else if (new_positions.length === 1) {
                    this.jumpTo(editor, new_positions[0]);
                    editor.focus();
                }

                else if (this.settings.search_not_found_text &&
                    this.settings.search_not_found_text.trim() !== '') {
                    editor.focus();
                    new Notice(this.settings.search_not_found_text);
                }

                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();
            }

            catch (e) {
                console.error(e);
                this.resetAction(editor);
                editor.focus();
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
        this.statusSet(`${this.lang.mode}: `);
        this.pulseInit(true);

        editor.blur();

        const callback_on_mouse_reset = (event: any) => {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            try {
                this.resetAction(editor);
                editor.focus();
                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();

                window.removeEventListener("click", callback_on_mouse_reset);
                window.removeEventListener("contextmenu", callback_on_mouse_reset);
                window.removeEventListener("auxclick", callback_on_mouse_reset);
            } finally {
                (editor as any)['cm'].dispatch();
            }
        };

		const callback_on_provided = (event: any) => {
			try {
                window.removeEventListener("keydown", callback_on_provided);
                event.preventDefault();
                event.stopPropagation();

                if (event.which === 16 ||
                    event.keyCode === 16 ||
                    `${event.key}`.toLowerCase() === 'shift'
                ) {
                    this.callback_provided_input = callback_on_provided;
                    window.addEventListener('keydown', callback_on_provided, { once: true });
                    return;
                }

                if (event.keyCode === 27 ||
                    event.which === 27 ||
                    `${event.key}`.toLowerCase() === 'escape' ||
                    `${event.code}`.toLowerCase() === 'escape')
                {
                    this.resetAction(editor);
                    editor.focus();
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


                if (event.which === 38 ||
                    event.keyCode === 38 ||
                    `${event.code}`.toLowerCase() === 'arrowup' ||
                    `${event.key}`.toLowerCase() === 'arrowup')
                {
                    if (this.settings.keyboard_arrows_switch) {
                        const curr_layout = this.layout_cur;
                        const curr_key = this.current_char;
                        const curr_mode = this.mode;
                        this.resetAction(editor);
                        this.override_recognize = true;
                        this.layout_cur = curr_layout;
                        this.mode = curr_mode;
                        this.toggleLayout(+1);

                        this.callback_mouse_reset = callback_on_mouse_reset;
                        window.addEventListener("click", callback_on_mouse_reset, { once: true });
                        window.addEventListener("contextmenu", callback_on_mouse_reset, { once: true });
                        window.addEventListener("auxclick", callback_on_mouse_reset, { once: true });

                        callback_on_start({key: curr_key, code: curr_key});
                        return;
                    }
                }

                if (event.which === 40 ||
                    event.keyCode === 40 ||
                    `${event.code}`.toLowerCase() === 'arrowdown' ||
                    `${event.key}`.toLowerCase() === 'arrowdown')
                {
                    if (this.settings.keyboard_arrows_switch) {
                        const curr_layout = this.layout_cur;
                        const curr_key = this.current_char;
                        const curr_mode = this.mode;
                        this.resetAction(editor);
                        this.override_recognize = true;
                        this.layout_cur = curr_layout;
                        this.mode = curr_mode;
                        this.toggleLayout(-1);

                        this.callback_mouse_reset = callback_on_mouse_reset;
                        window.addEventListener("click", callback_on_mouse_reset, { once: true });
                        window.addEventListener("contextmenu", callback_on_mouse_reset, { once: true });
                        window.addEventListener("auxclick", callback_on_mouse_reset, { once: true });

                        callback_on_start({key: curr_key, code: curr_key});
                        return;
                    }
                }

                const char = `${event.key}`.toLowerCase();

                this.offset += 1;
                this.search_tree.narrow(char);

                const new_positions = this.freeze_positions();

                this.resetAction(editor, new_positions.length <= 1);

                if (new_positions.length > 1) {
                    this.statusSet(`${this.lang.mode}: ${char}`);
                    inter_plugin_state.state.positions = [...new_positions];

                    this.callback_provided_input = callback_on_provided;
                    window.addEventListener('keydown', callback_on_provided, { once: true });
                }

                else if (new_positions.length === 1) {
                    editor.focus();
                    this.jumpTo(editor, new_positions[0]);
                }

                else if (this.settings.search_not_found_text &&
                    this.settings.search_not_found_text.trim() !== '') {
                    editor.focus();
                    new Notice(this.settings.search_not_found_text);
                }

                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();
            }

            catch (e) {
				console.error(e);
				this.resetAction(editor);
                editor.focus();
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
            event?.preventDefault?.();
            event?.stopPropagation?.();

            if (event.which === 16 ||
                event.keyCode === 16 ||
                `${event.key}`.toLowerCase() === 'shift'
            ) {
                this.callback_start_search = callback_on_start;
                window.addEventListener('keydown', callback_on_start, { once: true });
                return;
            }

            if (event.keyCode === 27 ||
                event.which === 27 ||
                `${event.key}`.toLowerCase() === 'escape' ||
                `${event.code}`.toLowerCase() === 'escape')
            {
                this.resetAction(editor);
                editor.focus();
                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();
                (editor as any)['cm'].dispatch();
                return;
            }

            if (event.which === 38 ||
                event.keyCode === 38 ||
                `${event.code}`.toLowerCase() === 'arrowup' ||
                `${event.key}`.toLowerCase() === 'arrowup')
            {
                if (this.settings.keyboard_arrows_switch) {
                    const curr_layout = this.layout_cur;
                    const curr_mode = this.mode;
                    this.resetAction(editor);
                    this.layout_cur = curr_layout;
                    this.mode = curr_mode;
                    this.toggleLayout(+1);

                    this.searchAction(editor);
                    if (inter_plugin_state.state.plugin_draw_callback)
                        inter_plugin_state.state.plugin_draw_callback();
                    return;
                }
            }

            if (event.which === 40 ||
                event.keyCode === 40 ||
                `${event.code}`.toLowerCase() === 'arrowdown' ||
                `${event.key}`.toLowerCase() === 'arrowdown')
            {
                if (this.settings.keyboard_arrows_switch) {
                    const curr_layout = this.layout_cur;
                    const curr_mode = this.mode;
                    this.resetAction(editor);
                    this.layout_cur = curr_layout;
                    this.mode = curr_mode;
                    this.toggleLayout(-1);

                    this.searchAction(editor);
                    if (inter_plugin_state.state.plugin_draw_callback)
                        inter_plugin_state.state.plugin_draw_callback();
                    return;
                }
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

                const char = `${event.key}`.toLowerCase();
                this.current_char = event.key;

				if (char.length <= 2 && char.trim().length > 0) {
					const positions = this.performSearch(editor, char);
					if (!positions || positions.length <= 0) {
						this.resetAction(editor);
                        editor.focus();
						if (inter_plugin_state.state.plugin_draw_callback)
							inter_plugin_state.state.plugin_draw_callback()
                        if (this.settings.search_not_found_text &&
                            this.settings.search_not_found_text.trim() !== '') {
                            new Notice(this.settings.search_not_found_text);
                        }
						return;
					}

                    if (positions.length === 1 && (this.settings.auto_jump_on_single === true)) {
                        this.resetAction(editor);
                        editor.focus();
                        this.jumpTo(editor, positions[0]);
                        return;
                    }

					inter_plugin_state.state.positions = [...positions];
                    inter_plugin_state.state.pointer = undefined;

					this.statusSet(`${this.lang.mode}: ${char}`);

                    this.callback_provided_input = callback_on_provided;
					window.addEventListener('keydown', callback_on_provided, { once: true });
				} else {
					this.resetAction(editor);
                    editor.focus();
				}

                if (inter_plugin_state.state.plugin_draw_callback)
                    inter_plugin_state.state.plugin_draw_callback();
			}

            catch (e) {
				console.error(e);
				this.resetAction(editor);
                editor.focus();
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
        const term_exceptions = [...this.settings.exceptions ?? ''];
        const view = (<EditorView> (<any> editor)['cm']);

        const from = editor.offsetToPos(this.range_from);
        const to = editor.offsetToPos(this.range_to);

        if (!from || !to) {
            this.search_tree.reset();
            return [];
        }

        const layout_idx = this.layout_cur;
        const search_char = this.search_tree.mid_layout_char(layout_idx);

        const line_f = from.line;
        const line_t = to.line;

        let first: Rect | null = null;
        let anchor: EditorPosition | null = null;

        for (let i = line_f; i <= line_t; i++) {
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

                if (!zero)
                    continue;

                this.search_tree.assign(search_char, <SearchPosition> {
                    offset: this.calc_offset(editor.getLine(anchor.line), term_exceptions),
                    index_e: pos + 1,
                    index_s: pos,
                    origin: first,
                    coord: zero,
                    start: start,
                    end: end
                }, layout_idx);

                continue;
            }

            if (this.mode === 'line') {
                const end = <EditorPosition> { line: i, ch: 1 };
                const pos = editor.posToOffset(start);
                const zero = view.coordsAtPos(pos);

                if (!zero)
                    continue;

                this.search_tree.assign(search_char, <SearchPosition> {
                    offset: this.calc_offset(editor.getLine(i), term_exceptions),
                    index_e: pos + 1,
                    index_s: pos,
                    origin: zero,
                    coord: zero,
                    start: start,
                    end: end
                }, layout_idx);
            }

            else if (this.mode === 'terminator') {
                const stp = <EditorPosition> { line: i, ch: Math.max(0, length - 1) };
                const edp = <EditorPosition> { line: i, ch: Math.max(0, length ) };
                const zero = view.coordsAtPos(editor.posToOffset(start));
                const tos = editor.posToOffset(start);
                const pos = editor.posToOffset(stp);
                const coord = view.coordsAtPos(pos);

                if (!coord || !zero)
                    continue;

                this.search_tree.assign(search_char, <SearchPosition> {
                    offset: this.calc_offset(editor.getLine(i), term_exceptions),
                    index_e: tos + 1,
                    index_s: tos,
                    origin: zero,
                    coord: coord,
                    start: edp,
                    end: edp
                }, layout_idx);
            }
        }

        return this.freeze_positions();
    }

	private performSearch(editor: Editor, search: string) {
		const term_exceptions = [...this.settings.exceptions ?? ''];
        const word_end_offset = this.settings.jump_after_word_on_end ? 1 : 0;

        const view = (<EditorView> (<any> editor)['cm']);
        const search_lower = this.normalize_text(search.toLowerCase());
		const visible_text = editor.getValue().toLowerCase();
		const search_area = visible_text.substring(this.range_from, this.range_to);

        const layout_idx = (this.settings.keyboard_recognize && !this.override_recognize)
            ? this.search_tree.recognize_layout(search, this.layout_cur)
            : this.layout_cur;

        if (this.settings.keyboard_recognize && !this.override_recognize) {
            this.layout_cur = layout_idx;
            this.layoutSet(layout_idx);
        }

		let index = search_area.indexOf(search_lower);
		const t0 = new Date().getTime();
		while (index > -1) {
			const end = editor.offsetToPos(index + this.range_from + search.length);
			const start = editor.offsetToPos(index + this.range_from);

            const zero = view.coordsAtPos(index + this.range_from - start.ch);
            const coord = view.coordsAtPos(index + this.range_from);

            if (!zero || !coord) {
                index = search_area.indexOf(search_lower, index + 1);
                continue;
            }

			let search_position = <SearchPosition> {
                offset: this.calc_offset(editor.getLine(start.line), term_exceptions),
				index_e: index + this.range_from - start.ch + search.length,
				index_s: index + this.range_from - start.ch,
                origin: zero,
				coord: coord,
				start: start,
				end: end
			};

			if (this.mode === 'any') {
				this.search_tree.assign(search_lower, search_position, layout_idx);
			}

			else if (this.mode === 'start') {
				const pre = editor.offsetToPos((index > 0 ? index - 1 : index) + this.range_from);
				const nv = editor.getRange(pre, end).trim();
				if (nv.length === 1) {
                    this.search_tree.assign(search_lower, search_position, layout_idx);
                } else if (nv.length === 2 && term_exceptions.some(x => x === nv.at(0))) {
                    this.search_tree.assign(search_lower, search_position, layout_idx);
                }
			}

			else if (this.mode === 'end') {
				const two = editor.offsetToPos(index + search.length + 1 + this.range_from);
				const nv = editor.getRange(start, two).trim();
				if (nv.length === 1) {
                    search_position.start.ch += word_end_offset;
                    this.search_tree.assign(search_lower, search_position, layout_idx);
                } else if (nv.length === 2 && term_exceptions.some(x => x === nv.at(1))) {
                    search_position.start.ch += word_end_offset;
                    this.search_tree.assign(search_lower, search_position, layout_idx);
                }
			}

			index = search_area.indexOf(search_lower, index + 1);
		}

        let positions = this.freeze_positions();

		const t1 = new Date().getTime();

		console.debug(`indexing: ${t1 - t0}ms`);
		console.debug(`found: ${positions.length}`);

		return positions;
	}

    private calc_offset(line: string, term_exceptions: string[]): number {
        // this is workaround for very *peculiar* behaviour of markdown editor live-preview for bold/italics/etc...
        let l_offset = 1;
        while (l_offset < line.length - 1) {
            const cc = line.at(l_offset);
            if (cc && term_exceptions.some(x => x === cc)) {
                l_offset += 1;
                continue;
            }
            break;
        }
        return l_offset;
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
}
