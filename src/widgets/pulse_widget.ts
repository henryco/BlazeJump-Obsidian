import { EditorView, WidgetType } from "@codemirror/view";
import { PulseStyle, SearchPosition } from "../commons";

export class BlazePointerPulseWidget extends WidgetType {
    private position: SearchPosition;
    private style: PulseStyle;

    public constructor(position: SearchPosition, style: PulseStyle) {
        super();
        this.position = position;
        this.style = style;
    }

    public toDOM(_: EditorView): HTMLElement {
        const offset_x = this.position.coord.left - this.position.origin.left;
        const offset_y = this.position.coord.top - this.position.origin.top;

        const el = createSpan({ cls: 'blaze-jump-widget-pulse' });
        el.style.left = `${offset_x}px`;
        el.style.top = `${offset_y}px`;
        el.style.animationDuration = `${this.style.duration ?? 0.15}s`;
        el.style.backgroundColor = this.style.bg ?? 'red';
        el.setText(" ");

        return el;
    }
}
