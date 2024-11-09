export interface KeyboardHeuristic {

}

export const SpiralHeuristic: KeyboardHeuristic = {
    // TODO
}


// **** HEURISTICS SHOULD BE REGISTERED THERE ****
export const HEURISTICS: {[name: string]: KeyboardHeuristic} = {
    'spiral': SpiralHeuristic
}
// **** HEURISTICS SHOULD BE REGISTERED THERE ****


export const provide_heuristic = (name: string): KeyboardHeuristic => {
    const obj = HEURISTICS[`${name}`.toLowerCase()];
    if (obj !== null && obj !== undefined)
        return obj;
    return SpiralHeuristic; // TODO
}

export const provide_heuristics = (): string[] => {
    return Object.keys(HEURISTICS)
        .filter(x => HEURISTICS.hasOwnProperty(x));
}
