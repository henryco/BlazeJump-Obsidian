import {EditorView, WidgetType} from "@codemirror/view";
import {SearchPosition, SearchStyle} from "../commons";

export class BlazeTagWidget extends WidgetType {
    private readonly positions: SearchPosition[];
    private readonly style: SearchStyle;
    private readonly idx: number;

    private readonly char?: string;

    public constructor(
        idx: number,
        positions: SearchPosition[],
        style: SearchStyle,
        char?: string
    ) {
        super();
        this.positions = positions;
        this.style = style;
        this.idx = idx;
        this.char = char;
    }

    private provide_text(p: SearchPosition): string {
        if (this.style.capitalize)
            return p.name.toUpperCase().substring(this.style.offset);
        return p.name.toLowerCase().substring(this.style.offset);
    }

    private empty(): HTMLElement {
        const el = document.createElement("span");
        if (!this.char)
            return el;

        el.className = 'blaze-jump-search-empty';
        el.style.borderColor = `${this.style.border}`;
        el.innerText = `${this.char}`;
        return el;
    }

    private tag(text: string): HTMLElement {
        const el = document.createElement("span");
        el.className = 'blaze-jump-search-tag';
        el.style.backgroundColor = `${this.style.bg}`;
        el.style.borderColor = `${this.style.border}`;
        el.style.color = `${this.style.text}`;
        el.innerText = text;
        return el;
    }

    public toDOM(_: EditorView): HTMLElement {
        const positions = [...this.positions].sort((a, b) => a.index_s - b.index_s);

        const first = positions[0];
        const prefix = Array(this.style.offset).fill(' ').reduce((p, c) => p + c, '');
        const offset_x = first.coord.left - first.origin.left;
        const offset_y = first.coord.top - first.origin.top;

        const div = document.createElement('div');
        div.className = 'blaze-jump-search-box';
        div.style.zIndex = `${5000 + this.idx}`
        div.style.left = `${offset_x}px`;
        div.style.top = `${offset_y}px`;

        for (let i = 0; i < positions.length; i++) {
            const position = positions[i];

            const el = this.tag(`${prefix}${this.provide_text(position)}`);

            if (!!this.char)
                div.appendChild(this.empty());

            div.appendChild(el);
        }

        return div;
    }
}
