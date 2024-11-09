import {Translations} from "./translations";
import {EN_TRANSLATIONS} from "./lang/en";

export type {Translations} from "./translations";

// **** LANGUAGES SHOULD BE REGISTERED THERE ****
export const TRANSLATIONS: {[lang: string]: Translations} = {
    'en': EN_TRANSLATIONS,
    // **** MORE TRANSLATIONS HERE ****
}
// **** LANGUAGES SHOULD BE REGISTERED THERE ****


export const provide_translations = (lang: string): Translations => {
    try {
        const obj = TRANSLATIONS[`${lang}`.toLowerCase()];
        if (obj !== null && obj !== undefined)
            return obj;
        return EN_TRANSLATIONS;
    } catch (e) {
        console.error("Cannot provide translations error, using fallback option", e);
        return EN_TRANSLATIONS;
    }
}

export const provide_languages = (): string[] => {
    return Object.keys(TRANSLATIONS)
        .filter(x => TRANSLATIONS.hasOwnProperty(x));
}
