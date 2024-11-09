import {KeyboardHeuristic, KeyboardLayout, char_from, char_coord} from "./heuristics";
import {BackwardHeuristic} from "./alg/backward";
import {ForwardHeuristic} from "./alg/forward";
import {SpiralHeuristic} from "./alg/spiral";
import {PlainHeuristic} from "./alg/plain";

export type {KeyboardHeuristic, KeyboardLayout};
export {char_from, char_coord};


// **** HEURISTICS SHOULD BE REGISTERED THERE ****
export const HEURISTICS: { [name: string]: KeyboardHeuristic } = {
    'spiral': SpiralHeuristic,
    'plain': PlainHeuristic,
    'forward': ForwardHeuristic,
    'backward': BackwardHeuristic,
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
