import {App, Editor, EditorPosition, Modifier, Plugin, PluginSettingTab, Setting} from 'obsidian';
import {ViewUpdate, PluginValue, EditorView, ViewPlugin, WidgetType, PluginSpec, DecorationSet, Decoration} from "@codemirror/view";
import {RangeSetBuilder} from "@codemirror/state";

interface ExpandSelectPluginSettings {
	hotkey?: string;
	status_color_bg?: string;
	status_color_text?: string;
}

interface SearchPosition {
	start: EditorPosition;
	end: EditorPosition;
	index_s: number;
	index_e: number;
	value: string;
}

const DEFAULT_SETTINGS: ExpandSelectPluginSettings = {
	hotkey: 'Ctrl+`',
	status_color_bg: 'transparent',
	status_color_text: 'red',
}

const inter_plugin_state: any = {
	state: {}
}

export class BlazeFoundAreaWidget extends WidgetType {
	replace_text: string = '👉';

	constructor(replace_text: string = '👉') {
		super();
		this.replace_text = replace_text;
	}

	toDOM(view: EditorView): HTMLElement {
		const div = document.createElement("span");
		div.innerText = this.replace_text;
		div.style.backgroundColor = 'red';
		div.style.color = 'white';
		div.style.position = 'absolute';
		div.style.zIndex = '9999';
		div.style.border = 'thin solid white';
		return div;
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
		// console.log('UPDATE');

		const positions: SearchPosition[] = inter_plugin_state.state['positions'];
		if (!positions) {
			this.decorations = Decoration.none;
			return;
		}

		const builder = new RangeSetBuilder<Decoration>();

		for (let position of positions) {
			builder.add(
				position.index_s,
				position.index_e,
				// Decoration.replace({
				// 	widget: new BlazeFoundAreaWidget()
				// })
				Decoration.widget({
					widget: new BlazeFoundAreaWidget(position.value),
				})
			);
		}

		// console.log('UPDATED');
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

	statusBar?: HTMLElement;

	callback_provided_input: any;
	callback_start_search: any;
	active: boolean = false;

	range_from: number;
	range_to: number;

	async onload() {

		inter_plugin_state.state['editor_callback'] = (view: EditorView) => {
			if (view.visibleRanges.length <= 0)
				return;
			const range = view.visibleRanges[0];
			console.log(range);
			this.range_from = range.from;
			this.range_to = range.to;
		};

		await this.loadSettings();
		this.registerEditorExtension(blaze_jump_plugin);

		let extra: any = {};
		if (this.settings.hotkey) {
			extra = {
				hotkeys: [{
					modifiers: this.parseModifiers(this.settings.hotkey),
					key: this.parseKey(this.settings.hotkey),
				}]
			}
		}

		this.addCommand({
			id: "blaze-jump-start",
			name: "BlazeJump",
			editorCallback: (editor, ctx) => this.startAction(editor, ctx),
			...extra
		});

		this.addCommand({
			id: 'blaze-jump-abort',
			name: "BlazeJump abort search",
			editorCallback: (editor) => this.resetAction(editor),
			hotkeys: [{
				modifiers: ['Ctrl'],
				key: 'G'
			}, {
				modifiers: [],
				key: 'Esc'
			}]
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
			color: ${this.settings.status_color_text ?? 'red'};
			font-size: xx-small;
			border: thin solid ${this.settings.status_color_text ?? 'red'};
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

	resetAction(_?: Editor) {
		this.active = false;
		this.statusClear();

		if (this.callback_start_search)
			window.removeEventListener("keydown", this.callback_start_search);
		if (this.callback_provided_input)
			window.removeEventListener("keydown", this.callback_provided_input);

		this.callback_provided_input = null;
		this.callback_start_search = null;

		inter_plugin_state.state['positions'] = undefined;
	}

	startAction(editor: Editor, _: any) {
		this.statusSet("BlazeMode: ");
		console.log('start');

		const callback_on_provided = (event: any) => {
			try {
				const char = event.key;

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
				if (char.length <= 2) {
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
				} else
					this.resetAction(editor);

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
		// console.log('search: ' + search);

		const search_lower = search.toLowerCase();
		const visible_text = editor.getValue().toLowerCase();
		const search_area = visible_text.substring(this.range_from, this.range_to);
		const positions = [];

		let index = search_area.indexOf(search_lower);
		while (index > -1) {
			const start = editor.offsetToPos(index + this.range_from);
			const end = editor.offsetToPos(index + this.range_from + search.length);
			positions.push(<SearchPosition> {
				start: start,
				end: end,
				index_s: index + this.range_from,
				index_e: index + this.range_from + search.length,
				value: editor.getRange(start, end)
			});
			index = search_area.indexOf(search_lower, index + 1);
		}

		return positions;
	}

	parseModifiers(hotkey: string): Modifier[] {
		const parts = hotkey.split('+');
		// @ts-ignore
		return parts.slice(0, parts.length - 1);
	}

	parseKey(hotkey: string): string {
		const parts = hotkey.split('+');
		return parts[parts.length - 1];
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

		new Setting(containerEl)
			.setName("Hotkey (Plugin restart required)")
			.setDesc("Set the hotkey (requires restart)")
			.addText((text) =>
				text
					.setPlaceholder("Enter hotkey")
					.setValue(this.plugin.settings.hotkey ?? '')
					.onChange(async (value) => {
						this.plugin.settings.hotkey = value;
						await this.plugin.saveSettings();
					})
			);

	}
}
