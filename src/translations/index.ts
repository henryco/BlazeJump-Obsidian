import {Translations} from "./translations";
import {EN_TRANSLATIONS} from "./lang/en";
import {moment} from "obsidian";

export type {Translations} from "./translations";

// **** LANGUAGES SHOULD BE REGISTERED THERE ****
export const TRANSLATIONS: {[lang: string]: Translations} = {
    'en': EN_TRANSLATIONS,
    // **** MORE TRANSLATIONS HERE ****
}
// **** LANGUAGES SHOULD BE REGISTERED THERE ****


export const provide_translations = (): Translations => {
    try {
        const obj = TRANSLATIONS[`${moment.locale()}`.toLowerCase()];
        if (obj !== null && obj !== undefined)
            return obj;
        console.warn("Using fallback language");
        return EN_TRANSLATIONS;
    } catch (e) {
        console.error("Cannot provide translations error, using fallback option", e);
        return EN_TRANSLATIONS;
    }
}
