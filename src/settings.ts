import {MODE_TYPE} from "./commons";
import {App, Plugin, PluginSettingTab, Setting} from "obsidian";

export interface BlazeJumpPluginSettings {
    default_action: MODE_TYPE;

    // set
    keyboard_layout: string;
    keyboard_allowed: string;
    keyboard_depth: number;

    // set
    status_color_fallback: string;
    status_color_bg: string;

    // ASSIGNED AUTOMATICALLY
    status_color_start?: string;
    status_color_end?: string;
    status_color_any?: string;
    status_color_line?: string;
    status_color_terminator?: string;

    // ASSIGNED AUTOMATICALLY
    search_color_bg_start?: string;
    search_color_bg_end?: string;
    search_color_bg_any?: string;
    search_color_bg_line?: string;
    search_color_bg_terminator?: string;

    // ASSIGNED AUTOMATICALLY
    search_color_text_start?: string;
    search_color_text_end?: string;
    search_color_text_any?: string;
    search_color_text_line?: string;
    search_color_text_terminator?: string;

    // ASSIGNED AUTOMATICALLY
    search_color_border_start?: string;
    search_color_border_end?: string;
    search_color_border_any?: string;
    search_color_border_line?: string;
    search_color_border_terminator?: string;

    //set
    search_jump_pulse?: boolean;
    search_jump_pulse_color?: string;
    search_jump_pulse_duration?: number;

    // set
    search_start_pulse?: boolean;
    search_start_pulse_duration?: number;

    convert_utf8_to_ascii?: boolean;
    auto_jump_on_single?: boolean;
    search_spellcheck_disable?: boolean;
    capitalize_tags_labels?: boolean;

    search_dim_enabled?: boolean;
    search_dim_style?: string;

    search_not_found_text?: string;
    terminator_exceptions?: string;
}

export const DEFAULT_SETTINGS: BlazeJumpPluginSettings = {
    default_action: "start",

    keyboard_layout: "1234567890 qwertyuiop asdfghjkl zxcvbnm",
    keyboard_allowed: "123456789abcdefghijklmnopqrstuvwxyz",
    keyboard_depth: 2,

    status_color_fallback: '#FF5733',
    status_color_bg: '#FFFFFF00',

    status_color_start: '#FF5733',
    status_color_end: '#0000FF',
    status_color_any: '#008000',

    status_color_line: '#FF00FF',
    status_color_terminator: '#696969',

    search_color_text_start: '#FF5733',
    search_color_text_end: '#0000FF',
    search_color_text_any: '#00FFFF',

    search_color_bg_start: '#FFFF00',
    search_color_bg_end: '#FFFF00',
    search_color_bg_any: '#800080',

    search_dim_enabled: true,
    search_dim_style: 'color: var(--text-faint);',

    search_spellcheck_disable: true,

    search_jump_pulse: true,
    search_jump_pulse_color: '#FF0000',
    search_jump_pulse_duration: 0.15,

    search_start_pulse: true,
    search_start_pulse_duration: 0.15,

    terminator_exceptions: `.,;:'"\``,

    search_not_found_text: '🚫',

    convert_utf8_to_ascii: false,
    auto_jump_on_single: false,
    capitalize_tags_labels: false
}

export class BlazeJumpSettingTab extends PluginSettingTab {

    private default_settings: BlazeJumpPluginSettings;
    private settings: BlazeJumpPluginSettings;

    private plugin: Plugin;

    private difference: boolean = false;
    private initialized: boolean = false;

    public constructor(app: App, plugin: Plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    public getSettings(): BlazeJumpPluginSettings {
        return this.settings;
    }

    public async initialize(): Promise<BlazeJumpSettingTab> {
        try {
            console.debug("settings initialization");
            await this.loadSettings();
        } catch (e) {
            console.error(e);
        }
        this.initialized = true;
        return this;
    }

    public display(): void {
        this.difference = false;

        if (!this.initialized) {
            throw "Should call initialize() before!"
        }

        const all_modes = [
            'start',
            'end',
            'any',
            'line',
            'terminator'
        ];
        const map_modes = {
            [all_modes[0]]: 'Word start',
            [all_modes[1]]: 'Word end',
            [all_modes[2]]: 'Any character',
            [all_modes[3]]: 'Line start',
            [all_modes[4]]: 'Line end',
        };

        const {containerEl} = this;
        containerEl.empty();

        let head = this.ns("BlazeJump Settings")
            .setDesc("Beta")
            .setHeading();

        this.ns("Default Mode", 'default_action')
            .addDropdown(x =>
                x.addOption('start', map_modes['start'])
                    .addOption('end', map_modes['end'])
                    .addOption('any', map_modes['any'])
                    .setValue(this.settings.default_action)
                    .onChange(async (value) => {
                        await this.saveProperty('default_action', value);
                        this.hide();
                        this.display();
                    }));

        this.ns('Keyboard').setHeading();

        let kl = this.ns("Keyboard Layout", 'keyboard_layout', true)
            .addTextArea(x =>
                x.setValue((this.settings.keyboard_layout ?? '')
                    .trim().replace(/\s+/g, '\n'))
                    .onChange(async (value) => {
                        await this.saveProperty('keyboard_layout', value);
                        this.toggle_defaults(kl, true);
                        this.with_global_reset(head);
                    }));

        let ka = this.ns("Allowed Characters", "keyboard_allowed", true)
            .addText(x =>
                x.setValue(this.settings.keyboard_allowed)
                    .onChange(async (value) => {
                        await this.saveProperty('keyboard_allowed', value);
                        this.toggle_defaults(ka, true);
                        this.with_global_reset(head);
                    }));

        let kd = this.ns('Keyboard Depth', 'keyboard_depth', true)
            .addText(x =>
                x.setValue(`${this.settings.keyboard_depth}`)
                    .onChange(async (value) => {
                        try {
                            await this.saveProperty('keyboard_depth', Number(value));
                        } catch (e) {
                            console.error(e);
                        } finally {
                            this.toggle_defaults(kd, true);
                            this.with_global_reset(head);
                        }
                    }));

        this.ns('Status Color').setHeading();
        this.ns('Color status background', 'status_color_bg')
            .addToggle(x =>
                x.setTooltip("Opaque")
                    .setValue(this.is_opaque(`status_color_bg`))
                    .onChange(async (value) => {
                        await this.saveProperty(`status_color_bg`,
                            this.make_transparent(`status_color_bg`, !value));
                        this.hide();
                        this.display();
                    }))
            .addColorPicker(x =>
                x.setValue((this.settings as any)[`status_color_bg`])
                    .setDisabled(!this.is_opaque(`status_color_bg`))
                    .onChange(async (value) => {
                        await this.saveProperty(`status_color_bg`, value);
                        this.hide();
                        this.display();
                    }));

        for (let mode of all_modes) {
            this.ns(`Color status ${map_modes[mode]}`, `status_color_${mode}`)
                .addToggle(x =>
                    x.setTooltip("Opaque")
                        .setValue(this.is_opaque(`status_color_${mode}`))
                        .onChange(async (value) => {
                            await this.saveProperty(`status_color_${mode}`,
                                this.make_transparent(`status_color_${mode}`, !value));
                            this.hide();
                            this.display();
                        }))
                .addColorPicker(x =>
                    x.setValue((this.settings as any)[`status_color_${mode}`])
                        .setDisabled(!this.is_opaque(`status_color_${mode}`))
                        .onChange(async (value) => {
                            await this.saveProperty(`status_color_${mode}`, value);
                            this.hide();
                            this.display();
                        }));
        }

        this.ns("Tag Background").setHeading();
        for (let mode of all_modes) {
            this.ns(`${map_modes[mode]} background color`, `search_color_bg_${mode}`)
                .addToggle(x =>
                    x.setTooltip("Opaque")
                        .setValue(this.is_opaque(`search_color_bg_${mode}`))
                        .onChange(async (value) => {
                            await this.saveProperty(`search_color_bg_${mode}`,
                                this.make_transparent(`search_color_bg_${mode}`, !value));
                            this.hide();
                            this.display();
                        }))
                .addColorPicker(x =>
                    x.setValue((this.settings as any)[`search_color_bg_${mode}`])
                        .setDisabled(!this.is_opaque(`search_color_bg_${mode}`))
                        .onChange(async (value) => {
                            await this.saveProperty(`search_color_bg_${mode}`, value);
                            this.hide();
                            this.display();
                        }));
        }

        this.ns("Tag Foreground").setHeading();
        for (let mode of all_modes) {
            this.ns(`${map_modes[mode]} foreground color`, `search_color_text_${mode}`)
                .addToggle(x =>
                    x.setTooltip("Opaque")
                        .setValue(this.is_opaque(`search_color_text_${mode}`))
                        .onChange(async (value) => {
                            await this.saveProperty(`search_color_text_${mode}`,
                                this.make_transparent(`search_color_text_${mode}`, !value));
                            this.hide();
                            this.display();
                        }))
                .addColorPicker(x =>
                    x.setValue((this.settings as any)[`search_color_text_${mode}`])
                        .setDisabled(!this.is_opaque(`search_color_text_${mode}`))
                        .onChange(async (value) => {
                            await this.saveProperty(`search_color_text_${mode}`, value);
                            this.hide();
                            this.display();
                        }));
        }

        this.ns("Tag Border").setHeading();
        for (let mode of all_modes) {
            this.ns(`${map_modes[mode]} border color`, `search_color_border_${mode}`)
                .addToggle(x =>
                    x.setTooltip("Opaque")
                        .setValue(this.is_opaque(`search_color_border_${mode}`))
                        .onChange(async (value) => {
                            await this.saveProperty(`search_color_border_${mode}`,
                                this.make_transparent(`search_color_border_${mode}`, !value));
                            this.hide();
                            this.display();
                        }))
                .addColorPicker(x =>
                    x.setValue((this.settings as any)[`search_color_border_${mode}`])
                        .setDisabled(!this.is_opaque(`search_color_border_${mode}`))
                        .onChange(async (value) => {
                            await this.saveProperty(`search_color_border_${mode}`, value);
                            this.hide();
                            this.display();
                        }));
        }

        this.ns("Pulse").setHeading();

        let pu = this.ns("Start pulse duration", ['search_start_pulse', 'search_start_pulse_duration'], true)
            .setDesc("Value in milliseconds")
            .addToggle(x =>
                x.setValue(this.settings.search_start_pulse === true)
                    .setTooltip("Enable")
                    .onChange(async (value) => {
                        await this.saveProperty(`search_start_pulse`, value);
                        this.hide();
                        this.display();
                    }))
            .addText(x =>
                x.setValue(`${(this.settings.search_start_pulse_duration ?? 0) * 1000}`)
                    .setDisabled(this.settings.search_start_pulse !== true)
                    .setPlaceholder("Duration in ms")
                    .onChange(async (value) => {
                        try {
                            await this.saveProperty('search_start_pulse_duration', Number(value) / 1000);
                        } catch (e) {
                            console.error(e);
                        } finally {
                            this.toggle_defaults(pu, true);
                            this.with_global_reset(head);
                        }
                    }));

        let pj = this.ns("Jump pulse duration", ['search_jump_pulse', 'search_jump_pulse_duration'], true)
            .setDesc("Value in milliseconds")
            .addToggle(x =>
                x.setValue(this.settings.search_jump_pulse === true)
                    .setTooltip("Enable")
                    .onChange(async (value) => {
                        await this.saveProperty(`search_jump_pulse`, value);
                        this.hide();
                        this.display();
                    }))
            .addText(x =>
                x.setValue(`${(this.settings.search_jump_pulse_duration ?? 0) * 1000}`)
                    .setDisabled(this.settings.search_jump_pulse !== true)
                    .setPlaceholder("Duration in ms")
                    .onChange(async (value) => {
                        try {
                            await this.saveProperty('search_jump_pulse_duration', Number(value) / 1000);
                        } catch (e) {
                            console.error(e);
                        } finally {
                            this.toggle_defaults(pj, true);
                            this.with_global_reset(head);
                        }
                    }));

        this.ns('Jump pulse color', 'search_jump_pulse_color')
            .setDesc("Pulse color of area under caret after jump")
            .addToggle(x =>
                x.setTooltip("Opaque")
                    .setValue(this.is_opaque(`search_jump_pulse_color`))
                    .onChange(async (value) => {
                        await this.saveProperty(`search_jump_pulse_color`,
                            this.make_transparent(`search_jump_pulse_color`, !value));
                        this.hide();
                        this.display();
                    }))
            .addColorPicker(x =>
                x.setValue((this.settings as any)[`search_jump_pulse_color`])
                    .setDisabled(!this.is_opaque(`search_jump_pulse_color`))
                    .onChange(async (value) => {
                        await this.saveProperty(`search_jump_pulse_color`, value);
                        this.hide();
                        this.display();
                    }));

        this.ns("Miscellaneous").setHeading();
        let we = this.ns("Word endings", "terminator_exceptions", true)
            .setDesc("Characters ignored when performing search on words endings")
            .addToggle(x =>
                x.setValue(this.settings.terminator_exceptions !== undefined)
                    .setTooltip("Enable")
                    .onChange(async (value) => {
                        if (value) await this.resetProperty('terminator_exceptions');
                        else await this.saveProperty('terminator_exceptions', undefined);
                        this.hide();
                        this.display();
                    }))
            .addText(x =>
                x.setValue(this.settings.terminator_exceptions ?? '')
                    .setDisabled(this.settings.terminator_exceptions === undefined)
                    .onChange(async (value) => {
                        await this.saveProperty('terminator_exceptions', value);
                        this.toggle_defaults(we, true);
                        this.with_global_reset(head);
                    }));

        let nf = this.ns("Nothing found message", 'search_not_found_text', true)
            .setDesc("Generic message shown when nothing found")
            .addToggle(x =>
                x.setValue(this.settings.search_not_found_text !== undefined)
                    .setTooltip("Enable")
                    .onChange(async (value) => {
                        if (value) await this.resetProperty('search_not_found_text');
                        else await this.saveProperty('search_not_found_text', undefined);
                        this.hide();
                        this.display();
                    }))
            .addText(x =>
                x.setValue(this.settings.search_not_found_text ?? '')
                    .setDisabled(this.settings.search_not_found_text === undefined)
                    .onChange(async (value) => {
                        await this.saveProperty('search_not_found_text', value);
                        this.toggle_defaults(nf, true);
                        this.with_global_reset(head);
                    }));

        let di = this.ns("Dim editor style", ['search_dim_enabled', 'search_dim_style'], true)
            .setDesc("Dims editor when search, drastically improves readability")
            .addToggle(x =>
                x.setValue(this.settings.search_dim_enabled === true)
                    .setTooltip("Enable")
                    .onChange(async (value) => {
                        await this.saveProperty(`search_dim_enabled`, value);
                        this.hide();
                        this.display();
                    }))
            .addTextArea(x =>
                x.setValue((this.settings.search_dim_style ?? '').trim())
                    .setDisabled(this.settings.search_dim_enabled !== true)
                    .onChange(async (value) => {
                        await this.saveProperty('search_dim_style', value);
                        this.toggle_defaults(di, true);
                        this.with_global_reset(head);
                    }));

        this.ns("Convert Unicode to ASCII", 'convert_utf8_to_ascii')
            .setDesc("For example: Ü -> U")
            .addToggle(x =>
                x.setValue(this.settings.convert_utf8_to_ascii === true)
                    .setTooltip("Enable")
                    .onChange(async (value) => {
                        await this.saveProperty(`convert_utf8_to_ascii`, value);
                        this.hide();
                        this.display();
                    }));

        this.ns("Auto jump", 'auto_jump_on_single')
            .setDesc("Jump automatically whenever there is only single candidate")
            .addToggle(x =>
                x.setValue(this.settings.auto_jump_on_single === true)
                    .setTooltip("Enable")
                    .onChange(async (value) => {
                        await this.saveProperty(`auto_jump_on_single`, value);
                        this.hide();
                        this.display();
                    }));

        this.ns("Disable spellcheck", 'search_spellcheck_disable')
            .setDesc("Disable spellcheck in editor when searching")
            .addToggle(x =>
                x.setValue(this.settings.search_spellcheck_disable === true)
                    .setTooltip("Disable")
                    .onChange(async (value) => {
                        await this.saveProperty(`search_spellcheck_disable`, value);
                        this.hide();
                        this.display();
                    }));

        this.ns("Capitalize text inside tags", 'capitalize_tags_labels')
            .setDesc("May improve readability")
            .addToggle(x =>
                x.setValue(this.settings.capitalize_tags_labels === true)
                    .setTooltip("Enable")
                    .onChange(async (value) => {
                        await this.saveProperty(`capitalize_tags_labels`, value);
                        this.hide();
                        this.display();
                    }));

        if (this.difference)
            head = this.with_global_reset(head);
    }

    private async loadSettings() {
        const all_modes = ['start', 'end', 'any', 'line', 'terminator'];
        // TODO
        let def_set = {...DEFAULT_SETTINGS};
        for (let mode of all_modes) {
            const st = ((def_set as any)[`status_color_${mode}`]) ?? ((def_set as any)['status_color_fallback']);
            (def_set as any)[`search_color_bg_${mode}`] = ((def_set as any)[`search_color_bg_${mode}`] ?? '#FFFFFF');
            (def_set as any)[`search_color_text_${mode}`] = ((def_set as any)[`search_color_text_${mode}`] ?? st);
            (def_set as any)[`search_color_border_${mode}`] = ((def_set as any)[`search_color_text_${mode}`] ?? st);
        }

        this.default_settings = {...def_set};
        this.settings = Object.assign({}, this.default_settings, await this.plugin.loadData());
    }

    private async resetSettings() {
        this.settings = {...this.default_settings};
        await this.plugin.saveData(this.settings);
        this.settings = Object.assign({}, this.default_settings, await this.plugin.loadData());
    }

    private async resetProperty(name: string) {
        console.debug('resetProperty', name);
        if (!name || name.trim().length <= 0)
            return;
        (this.settings as any)[name] = (this.default_settings as any)[name];
        await this.plugin.saveData(this.settings);
    }

    private async saveProperty(name: string, value?: any) {
        console.debug("saveProperty:", name, value);
        if (!name || name.trim().length <= 0)
            return;
        (this.settings as any)[name] = value;
        await this.plugin.saveData(this.settings);
    }

    private toggle_defaults(setting: Setting, enable: boolean = false): Setting {
        if (!enable)
            (setting.components[0] as any)?.extraSettingsEl?.hide();
        else
            (setting.components[0] as any)?.extraSettingsEl?.show();
        return setting;
    }

    private with_global_reset(setting: Setting): Setting {
        const label = 'Reset';
        if (setting.components?.length >= 1)
            return setting;
        return setting
            .addButton(x =>
                x.setButtonText(label)
                    .setWarning()
                    .onClick(async () => {
                        await this.resetSettings();
                        this.hide();
                        this.display();
                    }))
    }

    private with_reset(names: string[], setting: Setting, always: boolean = false): Setting {
        const label = 'Reset defaults';

        for (let name of names) {
            const basic = (this.default_settings as any)[name];
            const current = (this.settings as any)[name];

            if (`${basic}` != `${current}` && !this.difference) {
                this.difference = true;
            }

            if (`${basic}` != `${current}` || always) {

                if ((setting.components?.[0] as any)?.extraSettingsEl?.ariaLabel === label)
                    return setting;
                if ((setting.components?.[setting.components?.length - 1 ] as any)?.extraSettingsEl?.ariaLabel === label)
                    return setting;

                let extra_button = setting.addExtraButton(x =>
                    x.setIcon('rotate-ccw')
                        .setTooltip(label)
                        .onClick(async () => {
                            for (let nn of names)
                                await this.resetProperty(nn);
                            this.hide();
                            this.display();
                        }));

                if (always) {
                    return this.toggle_defaults(extra_button, `${basic}` != `${current}`)
                }

                return extra_button;
            }
        }
        return setting;
    }

    private is_opaque(name: string): boolean {
        const value = `${(this.settings as any)[name]}`;
        if (value.startsWith("#") && value.length < 9)
            return true;
        return value.startsWith("#") && value.length === 9 && value.endsWith("FF");
    }

    private make_transparent(name: string, transparent: boolean): string {
        const value = `${(this.settings as any)[name]}`;
        if (!value)
            return transparent ? '#FFFFFF00' : '#FFFFFFFF';

        if (value.startsWith("#") && value.length === 7)
            return `${value}${transparent ? '00' : ''}`;
        if (value.startsWith("#") && value.length === 9)
            return `${value.substring(0, 7)}${transparent ? '00' : ''}`;

        return value;
    }

    private ns(name: string, fields?: string[] | string, extra: boolean = false): Setting {
        const {containerEl} = this;
        let setting = new Setting(containerEl).setName(name);
        return fields
            ? this.with_reset(Array.isArray(fields) ? [...fields] : [fields], setting, extra)
            : setting;
    }
}
