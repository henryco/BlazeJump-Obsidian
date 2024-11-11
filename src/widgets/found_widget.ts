import {EditorView, WidgetType} from "@codemirror/view";
import {SearchPosition, SearchStyle} from "../commons";

export class BlazeFoundAreaWidget extends WidgetType {
    private readonly search_position: SearchPosition;
    private readonly style: SearchStyle;
    private readonly text: string;
    private readonly idx: number;

    public constructor(
        idx: number,
        text: string,
        search_position: SearchPosition,
        style: SearchStyle
    ) {
        super();
        this.search_position = search_position;
        this.style = style;
        this.text = text;
        this.idx = idx;
    }

    private provide_text(): string {
        if (this.style.capitalize)
            return this.text.toUpperCase();
        return this.text.toLowerCase();
    }

    public toDOM(_: EditorView): HTMLElement {
        const prefix = Array(this.style.offset).fill(' ').reduce((p, c) => p + c, '');
        const text = prefix + this.provide_text().substring(this.style.offset);

        const offset_x = this.search_position.coord.left - this.search_position.origin.left;
        const offset_y = this.search_position.coord.top - this.search_position.origin.top;

        const el = document.createElement("span");
        el.className = 'blaze-jump-area-tag';

        el.style.backgroundColor = `${this.style.bg}`;
        el.style.color = `${this.style.text}`;
        el.style.borderColor = `${this.style.border}`;
        el.style.zIndex = `${5000 + this.idx}`;
        el.style.left = `${offset_x}px`;
        el.style.top = `${offset_y}px`;

        el.innerText = text;

        return el;
    }
}
