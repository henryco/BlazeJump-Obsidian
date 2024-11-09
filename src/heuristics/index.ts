import {KeyboardHeuristic} from "./heuristics";
import {SpiralHeuristic} from "./alg/spiral";
import {StraightHeuristic} from "./alg/straight";

export type {KeyboardHeuristic};


// **** HEURISTICS SHOULD BE REGISTERED THERE ****
export const HEURISTICS: {[name: string]: KeyboardHeuristic} = {
    'spiral': SpiralHeuristic,
    'straight': StraightHeuristic,
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
