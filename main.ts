import {App, Editor, EditorPosition, Modifier, Plugin, PluginSettingTab, Setting} from 'obsidian';
import {
	ViewUpdate,
	PluginValue,
	EditorView,
	ViewPlugin,
	WidgetType,
	PluginSpec,
	DecorationSet,
	Decoration
} from "@codemirror/view";
import {RangeSetBuilder} from "@codemirror/state";

interface ExpandSelectPluginSettings {
	hotkey?: string;
}

interface SearchPosition {
	start: EditorPosition;
	end: EditorPosition;
	index_s: number;
	index_e: number;
}

const DEFAULT_SETTINGS: ExpandSelectPluginSettings = {
	hotkey: 'Ctrl+`'
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
		div.innerText = '👉';
		return div;
	}
}

class BlazeViewPlugin implements PluginValue {
	decorations: DecorationSet = Decoration.none;

	update(update: ViewUpdate) {
		if (inter_plugin_state.state['editor_callback'])
			inter_plugin_state.state['editor_callback'](update);

		if (inter_plugin_state.state['positions'])
			this.build_decorations();
	}

	destroy() {
		inter_plugin_state.state = {};
	}

	build_decorations() {
		console.log('UPDATE');

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
				Decoration.replace({
					widget: new BlazeFoundAreaWidget()
				})
			);
		}

		console.log('UPDATED');
		this.decorations = builder.finish();
	}

}

const plugin_spec: PluginSpec<BlazeViewPlugin> = {
	decorations: v => v.decorations
}

export const blaze_jump_plugin = ViewPlugin.fromClass(
	BlazeViewPlugin,
	plugin_spec
);

export default class BlazeJumpPlugin extends Plugin {
	settings: ExpandSelectPluginSettings;

	statusBar?: HTMLElement;

	callback_start_search: any;
	active: boolean = false;

	range_from: number;
	range_to: number;

	async onload() {

		inter_plugin_state.state['editor_callback'] = (update: ViewUpdate) => {
			if (update.view.visibleRanges.length <= 0)
				return;
			const range = update.view.visibleRanges[0];
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
			editorCallback: (editor) => this.startAction(editor),
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
		if (!this.statusBar)
			this.statusBar = this.addStatusBarItem();
		this.statusBar.setText(text);
	}

	statusClear() {
		this.statusBar?.remove();
		this.statusBar = undefined;
	}

	resetAction(editor?: Editor) {
		this.active = false;
		this.statusClear();

		if (this.callback_start_search)
			window.removeEventListener("keydown", this.callback_start_search);

		inter_plugin_state.state['positions'] = undefined;
	}

	startAction(editor: Editor) {
		console.log('start');
		console.log(editor);

		this.statusSet("BlazeMode: ");

		const callback = (event: any) => {
			const char = event.key;
			if (char.length <= 2) {
				event.preventDefault();
				event.stopPropagation();
				window.removeEventListener("keydown", callback);

				const positions = this.performSearch(editor, char);
				this.active = true;

				inter_plugin_state.state['positions'] = [...positions];
				console.log(positions);
			} else
				this.resetAction(editor);
		};

		this.callback_start_search = callback;
		window.addEventListener("keydown", callback, { once: true });
	}

	performSearch(editor: Editor, search: string) {
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
				index_e: index + this.range_from + search.length
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
