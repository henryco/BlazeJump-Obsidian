import {App, Editor, Hotkey, Modifier, Plugin, PluginSettingTab, Setting} from 'obsidian';

interface ExpandSelectPluginSettings {
	hotkey?: string;
}

const DEFAULT_SETTINGS: ExpandSelectPluginSettings = {
	hotkey: 'Ctrl+`'
}

export default class BlazeJumpPlugin extends Plugin {
	settings: ExpandSelectPluginSettings;

	statusBar?: HTMLElement;

	active: boolean = false;
	callback: any;

	async onload() {
		await this.loadSettings();

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
		console.log('Reset');
		this.active = false;
		this.statusClear();

		if (this.callback)
			window.removeEventListener("keydown", this.callback);
	}

	startAction(editor: Editor) {
		console.log('start');
		console.log(editor);

		this.active = true;
		this.statusSet("BlazeMode: ");

		const callback = (event: any) => {
			const char = event.key;
			if (char.length <= 2) {
				event.preventDefault();
				event.stopPropagation();
				window.removeEventListener("keydown", callback);
				this.performSearch(editor, char);
			} else
				this.resetAction(editor);
		};

		this.callback = callback;
		window.addEventListener("keydown", callback, { once: true });
	}

	performSearch(editor: Editor, search: string) {
		const search_lower = search.toLowerCase();

		const visible_text = editor.getValue().toLowerCase();
		const positions = [];

		let index = visible_text.indexOf(search_lower);
		while (index > -1) {
			const start = editor.offsetToPos(index);
			const end = editor.offsetToPos(index + search.length);
			positions.push({start: start, end: end});
			index = visible_text.indexOf(search_lower, index + 1);
		}

		console.log(positions);

		this.active = false;
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
