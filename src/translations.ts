export interface Translations {
    readonly bj: string;
    readonly mode: string;
    readonly language: string;
    readonly word_start: string;
    readonly word_end: string;
    readonly any_char: string;
    readonly line_start: string;
    readonly line_end: string;
    readonly def_mode: string;
    readonly keyboard_layout_main: string;
    readonly keyboard_layouts: string;
    readonly keyboard_recognize: string;
    readonly keyboard_recognize_desc: string;
    readonly keyboard_arrows: string;
    readonly keyboard_arrows_desc: string;
    readonly layout: string;
    readonly add_layout: string;
    readonly remove_layout: string;
    readonly ignored_chars: string;
    readonly search_depth: string;
    readonly opaque: string;
    readonly status_color: string;
    readonly status_color_bg: string;
    readonly tag_bg: string;
    readonly tag_fg: string;
    readonly tag_border: string;
    readonly color_bg: string;
    readonly color_fg: string;
    readonly border_color: string;
    readonly pulse: string;
    readonly pulse_start_duration: string;
    readonly value_ms: string;
    readonly duration_ms: string;
    readonly enable: string;
    readonly pulse_jump_duration: string;
    readonly pulse_jump_color: string;
    readonly pulse_jump_color_desc: string;
    readonly miscellaneous: string;
    readonly special_chars: string;
    readonly special_chars_exceptions: string;
    readonly not_found_msg: string;
    readonly not_found_msg_desc: string;
    readonly dim_editor_style: string;
    readonly dim_editor_style_desc: string;
    readonly convert_utf8: string;
    readonly convert_utf8_desc: string;
    readonly auto_jump: string;
    readonly auto_jump_desc: string;
    readonly disable_spellcheck: string;
    readonly disable_spellcheck_desc: string;
    readonly disable: string;
    readonly capitalize_tags: string;
    readonly capitalize_tags_desc: string;
    readonly jump_to_word_end: string;
    readonly jump_to_word_end_desc: string;
    readonly reset: string
    readonly reset_defaults: string;
    readonly command_toggle: string;
    readonly command_word_start: string;
    readonly command_word_end: string;
    readonly command_any_char: string;
    readonly command_abort: string;
    readonly command_line_start: string;
    readonly command_line_end: string;
    readonly command_layout: string;
}

export const EN_TRANSLATIONS: Translations = {
    bj: 'BlazeJump',
    mode: 'BlazeMode',
    language: 'Language',
    word_start: 'Word start',
    word_end: 'Word end',
    any_char: 'Any character',
    line_start: 'Line start',
    line_end: 'Line end',
    def_mode: 'Default mode',
    keyboard_layout_main: 'Layout Main',
    keyboard_layouts: 'Keyboard',
    keyboard_recognize: 'Recognize layout',
    keyboard_recognize_desc: 'Try to automatically recognize keyboard layout',
    keyboard_arrows: 'Cycle through keyboard layouts',
    keyboard_arrows_desc: 'Use arrow keys to cycle through keyboard layouts',
    layout: 'Layout',
    add_layout: 'Add layout',
    remove_layout: 'Remove layout',
    ignored_chars: 'Excluded characters',
    search_depth: 'Search depth',
    opaque: 'Opaque',
    status_color: 'Color status',
    status_color_bg: 'Color status background',
    tag_bg: 'Tag Background',
    tag_fg: 'Tag Foreground',
    tag_border: 'Tag Border',
    color_bg: 'background color',
    color_fg: 'foreground color',
    border_color: 'border color',
    pulse: 'Pulse',
    pulse_start_duration: 'Start pulse duration',
    value_ms: 'Value in milliseconds',
    duration_ms: 'Duration in ms',
    enable: 'Enable',
    pulse_jump_duration: 'Jump pulse duration',
    pulse_jump_color: 'Jump pulse color',
    pulse_jump_color_desc: 'Pulse color of area under caret after jump',
    miscellaneous: 'Miscellaneous',
    special_chars: 'Special characters',
    special_chars_exceptions: 'Characters ignored when performing search on words',
    not_found_msg: 'Nothing found message',
    not_found_msg_desc: 'Generic message shown when nothing found',
    dim_editor_style: 'Dim editor style',
    dim_editor_style_desc: 'Dims editor when search, drastically improves readability',
    convert_utf8: 'Convert Unicode to ASCII',
    convert_utf8_desc: 'For example: Ü -> U',
    auto_jump: 'Auto jump',
    auto_jump_desc: 'Jump automatically whenever there is only single candidate',
    disable_spellcheck: 'Disable spellcheck',
    disable_spellcheck_desc: 'Disable spellcheck in editor when searching',
    disable: 'Disable',
    capitalize_tags: 'Capitalize text inside tags',
    capitalize_tags_desc: 'May improve readability',
    jump_to_word_end: 'Jump to the end at word-end',
    jump_to_word_end_desc: 'Jumps to the end of the word in \'Word end\' mode',
    reset: 'Reset',
    reset_defaults: 'Reset defaults',
    command_toggle: 'Toggle and jump',
    command_word_start: 'Jump to words start',
    command_word_end: 'Jump to words end',
    command_any_char: 'Jump to any',
    command_abort: 'Abort search',
    command_line_start: 'Jump to line',
    command_line_end: 'Jump to the line end',
    command_layout: 'Switch layout'
}


// **** LANGUAGES SHOULD BE REGISTERED THERE ****
export const TRANSLATIONS: {[lang: string]: Translations} = {
    'en': EN_TRANSLATIONS
}
// **** LANGUAGES SHOULD BE REGISTERED THERE ****


export const provide_translations = (lang: string): Translations => {
    const obj = TRANSLATIONS[`${lang}`.toLowerCase()]
    if (obj !== null && obj !== undefined)
        return obj;
    return EN_TRANSLATIONS;
}

export const provide_languages = (): string[] => {
    return Object.keys(TRANSLATIONS).filter(x => TRANSLATIONS.hasOwnProperty(x));
}
