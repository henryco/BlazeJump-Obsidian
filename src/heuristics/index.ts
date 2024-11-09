import {KeyboardHeuristic, KeyboardLayout} from "./heuristics";
import {SpiralHeuristic} from "./alg/spiral";
import {ContinuousHeuristic} from "./alg/continuous";
import {StraightHeuristic} from "./alg/straight";
import {char_from, char_coord} from "./heuristics";

export type {KeyboardHeuristic, KeyboardLayout};
export {char_from, char_coord};

// **** HEURISTICS SHOULD BE REGISTERED THERE ****
export const HEURISTICS: {[name: string]: KeyboardHeuristic} = {
    'spiral': SpiralHeuristic,
    'straight': StraightHeuristic,
    'continuous': ContinuousHeuristic,
    // **** MORE HEURISTICS HERE ****
}
// **** HEURISTICS SHOULD BE REGISTERED THERE ****


export const provide_heuristic = (name: string): KeyboardHeuristic => {
    try {
        const obj = HEURISTICS[`${name}`.toLowerCase()];
        if (obj !== null && obj !== undefined)
            return obj;
        return SpiralHeuristic;
    } catch (e) {
        console.error('Error providing heuristic, using fallback version instead', e);
        return SpiralHeuristic;
    }
}

export const provide_heuristics = (): string[] => {
    return Object.keys(HEURISTICS)
        .filter(x => HEURISTICS.hasOwnProperty(x));
}
