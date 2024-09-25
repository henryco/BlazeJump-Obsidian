import {App, Editor, Modifier, Plugin, PluginSettingTab, Setting} from 'obsidian';

interface ExpandSelectPluginSettings {
	hotkey?: string;
}

const DEFAULT_SETTINGS: ExpandSelectPluginSettings = {
	hotkey: undefined
}

export default class BlazeJumpPlugin extends Plugin {
	settings: ExpandSelectPluginSettings;

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

		this.addSettingTab(new BlazeJumpSettingTab(this.app, this));
	}

	onunload() {
	}

	private startAction(editor: Editor) {

	}

	parseModifiers(hotkey: string): Modifier[] {
		const parts = hotkey.split('+');
		// @ts-ignore
		return parts.slice(0, parts.length - 1);
	}

	parseKey(hotkey: string): string {
		const parts = hotkey.split('+');
		return parts[parts.length - 1];  // Last part is the key
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
