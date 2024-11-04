import {MODE_TYPE} from "./commons";
import {App, Plugin, PluginSettingTab, Setting} from "obsidian";
import {EN_TRANSLATIONS, provide_translations, Translations} from "./translations";

export interface BlazeJumpPluginSettings {
    default_action: MODE_TYPE;

    language: string;

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
    jump_after_word_on_end?: boolean;

    search_dim_enabled?: boolean;
    search_dim_style?: string;

    search_not_found_text?: string;
    exceptions?: string;
}

export const DEFAULT_SETTINGS: BlazeJumpPluginSettings = {
    default_action: "start",

    language: 'EN',

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

    exceptions: `!?@#$%^&*()<>[]{}/\\|_+-=~.,;:'"\``,

    search_not_found_text: '🚫',

    convert_utf8_to_ascii: false,
    auto_jump_on_single: false,
    capitalize_tags_labels: false,
    jump_after_word_on_end: true
}

export class BlazeJumpSettingTab extends PluginSettingTab {

    private default_settings: BlazeJumpPluginSettings;
    private settings: BlazeJumpPluginSettings;
    private lang: Translations;
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

            this.lang = provide_translations(this.settings.language);
        } catch (e) {
            console.error(e);
            this.lang = EN_TRANSLATIONS;
        }
        this.initialized = true;
        return this;
    }

    public display(): void {
        this.difference = false;

        if (!this.initialized) {
            console.error("Settings are not initialized");
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
            [all_modes[0]]: this.lang.word_start,
            [all_modes[1]]: this.lang.word_end,
            [all_modes[2]]: this.lang.any_char,
            [all_modes[3]]: this.lang.line_start,
            [all_modes[4]]: this.lang.line_end,
        };

        const {containerEl} = this;
        containerEl.empty();

        let head = this.ns(this.lang.bj)
            .setDesc(`Version: ${this.plugin?.manifest?.version ?? 'latest'}`)
            .setHeading();

        this.ns(this.lang.def_mode, 'default_action')
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

        let kl = this.ns(this.lang.keyboard_layout, 'keyboard_layout', true)
            .addTextArea(x =>
                x.setValue((this.settings.keyboard_layout ?? '')
                    .trim().replace(/\s+/g, '\n'))
                    .onChange(async (value) => {
                        await this.saveProperty('keyboard_layout', value);
                        this.toggle_defaults(kl, true);
                        this.with_global_reset(head);
                    }));

        let ka = this.ns(this.lang.allowed_chars, "keyboard_allowed", true)
            .addText(x =>
                x.setValue(this.settings.keyboard_allowed)
                    .onChange(async (value) => {
                        await this.saveProperty('keyboard_allowed', value);
                        this.toggle_defaults(ka, true);
                        this.with_global_reset(head);
                    }));

        let kd = this.ns(this.lang.search_depth, 'keyboard_depth', true)
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

        this.ns(this.lang.status_color).setHeading();
        this.ns(this.lang.status_color_bg, 'status_color_bg')
            .addToggle(x =>
                x.setTooltip(this.lang.opaque)
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
            this.ns(`${this.lang.status_color} ${map_modes[mode]}`, `status_color_${mode}`)
                .addToggle(x =>
                    x.setTooltip(this.lang.opaque)
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

        this.ns(this.lang.tag_bg).setHeading();
        for (let mode of all_modes) {
            this.ns(`${map_modes[mode]} ${this.lang.color_bg}`, `search_color_bg_${mode}`)
                .addToggle(x =>
                    x.setTooltip(this.lang.opaque)
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

        this.ns(this.lang.tag_fg).setHeading();
        for (let mode of all_modes) {
            this.ns(`${map_modes[mode]} ${this.lang.color_fg}`, `search_color_text_${mode}`)
                .addToggle(x =>
                    x.setTooltip(this.lang.opaque)
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

        this.ns(this.lang.tag_border).setHeading();
        for (let mode of all_modes) {
            this.ns(`${map_modes[mode]} ${this.lang.border_color}`, `search_color_border_${mode}`)
                .addToggle(x =>
                    x.setTooltip(this.lang.opaque)
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

        this.ns(this.lang.pulse).setHeading();

        let pu = this.ns(this.lang.pulse_start_duration, ['search_start_pulse', 'search_start_pulse_duration'], true)
            .setDesc(this.lang.value_ms)
            .addToggle(x =>
                x.setValue(this.settings.search_start_pulse === true)
                    .setTooltip(this.lang.enable)
                    .onChange(async (value) => {
                        await this.saveProperty(`search_start_pulse`, value);
                        this.hide();
                        this.display();
                    }))
            .addText(x =>
                x.setValue(`${(this.settings.search_start_pulse_duration ?? 0) * 1000}`)
                    .setDisabled(this.settings.search_start_pulse !== true)
                    .setPlaceholder(this.lang.duration_ms)
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

        let pj = this.ns(this.lang.pulse_jump_duration, ['search_jump_pulse', 'search_jump_pulse_duration'], true)
            .setDesc(this.lang.value_ms)
            .addToggle(x =>
                x.setValue(this.settings.search_jump_pulse === true)
                    .setTooltip(this.lang.enable)
                    .onChange(async (value) => {
                        await this.saveProperty(`search_jump_pulse`, value);
                        this.hide();
                        this.display();
                    }))
            .addText(x =>
                x.setValue(`${(this.settings.search_jump_pulse_duration ?? 0) * 1000}`)
                    .setDisabled(this.settings.search_jump_pulse !== true)
                    .setPlaceholder(this.lang.duration_ms)
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

        this.ns(this.lang.pulse_jump_color, 'search_jump_pulse_color')
            .setDesc(this.lang.pulse_jump_color_desc)
            .addToggle(x =>
                x.setTooltip(this.lang.opaque)
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

        this.ns(this.lang.miscellaneous).setHeading();
        let we = this.ns(this.lang.special_chars, "exceptions", true)
            .setDesc(this.lang.special_chars_exceptions)
            .addToggle(x =>
                x.setValue(this.settings.exceptions !== undefined)
                    .setTooltip(this.lang.enable)
                    .onChange(async (value) => {
                        if (value) await this.resetProperty('exceptions');
                        else await this.saveProperty('exceptions', undefined);
                        this.hide();
                        this.display();
                    }))
            .addText(x =>
                x.setValue(this.settings.exceptions ?? '')
                    .setDisabled(this.settings.exceptions === undefined)
                    .onChange(async (value) => {
                        await this.saveProperty('exceptions', value);
                        this.toggle_defaults(we, true);
                        this.with_global_reset(head);
                    }));

        let nf = this.ns(this.lang.not_found_msg, 'search_not_found_text', true)
            .setDesc(this.lang.not_found_msg_desc)
            .addToggle(x =>
                x.setValue(this.settings.search_not_found_text !== undefined)
                    .setTooltip(this.lang.enable)
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

        let di = this.ns(this.lang.dim_editor_style, ['search_dim_enabled', 'search_dim_style'], true)
            .setDesc(this.lang.dim_editor_style_desc)
            .addToggle(x =>
                x.setValue(this.settings.search_dim_enabled === true)
                    .setTooltip(this.lang.enable)
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

        this.ns(this.lang.convert_utf8, 'convert_utf8_to_ascii')
            .setDesc(this.lang.convert_utf8_desc)
            .addToggle(x =>
                x.setValue(this.settings.convert_utf8_to_ascii === true)
                    .setTooltip(this.lang.enable)
                    .onChange(async (value) => {
                        await this.saveProperty(`convert_utf8_to_ascii`, value);
                        this.hide();
                        this.display();
                    }));

        this.ns(this.lang.auto_jump, 'auto_jump_on_single')
            .setDesc(this.lang.auto_jump_desc)
            .addToggle(x =>
                x.setValue(this.settings.auto_jump_on_single === true)
                    .setTooltip(this.lang.enable)
                    .onChange(async (value) => {
                        await this.saveProperty(`auto_jump_on_single`, value);
                        this.hide();
                        this.display();
                    }));

        this.ns(this.lang.disable_spellcheck, 'search_spellcheck_disable')
            .setDesc(this.lang.disable_spellcheck_desc)
            .addToggle(x =>
                x.setValue(this.settings.search_spellcheck_disable === true)
                    .setTooltip(this.lang.disable)
                    .onChange(async (value) => {
                        await this.saveProperty(`search_spellcheck_disable`, value);
                        this.hide();
                        this.display();
                    }));

        this.ns(this.lang.capitalize_tags, 'capitalize_tags_labels')
            .setDesc(this.lang.capitalize_tags_desc)
            .addToggle(x =>
                x.setValue(this.settings.capitalize_tags_labels === true)
                    .setTooltip(this.lang.enable)
                    .onChange(async (value) => {
                        await this.saveProperty(`capitalize_tags_labels`, value);
                        this.hide();
                        this.display();
                    }));

        this.ns(this.lang.jump_to_word_end, 'jump_after_word_on_end')
            .setDesc(this.lang.jump_to_word_end_desc)
            .addToggle(x =>
                x.setValue(this.settings.jump_after_word_on_end === true)
                    .setTooltip(this.lang.enable)
                    .onChange(async (value) => {
                        await this.saveProperty(`jump_after_word_on_end`, value);
                        this.hide();
                        this.display();
                    }));

        if (this.difference)
            head = this.with_global_reset(head);
    }

    private async loadSettings() {
        const all_modes = ['start', 'end', 'any', 'line', 'terminator'];

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
        const label = this.lang.reset;
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
        const label = this.lang.reset_defaults;

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
