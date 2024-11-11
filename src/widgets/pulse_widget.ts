import {EditorView, WidgetType} from "@codemirror/view";
import {PulseStyle, SearchPosition} from "../commons";

export class BlazePointerPulseWidget extends WidgetType {
    private static readonly style_id: string = 'pulse-widget-style';

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

        const existingStyle = document.getElementById(BlazePointerPulseWidget.style_id);

        if (!existingStyle) {
            const style = document.createElement('style');
            style.id = BlazePointerPulseWidget.style_id;
            style.textContent = `                  
                    .blaze-jump-widget-pulse {
                      animation: blaze-jump-pulse-pointer ${this.style.duration ?? 0.15}s 1 forwards;
                      background-color: ${this.style.bg ?? 'red'};
                    }
                `;
            document.head.appendChild(style);
        }

        const el = document.createElement("span");
        el.className = 'blaze-jump-widget-pulse';

        el.style.left = `${offset_x}px`;
        el.style.top = `${offset_y}px`;

        el.innerText = " ";

        return el;
    }

    public destroy(dom: HTMLElement) {
        const existingStyle = document.getElementById(BlazePointerPulseWidget.style_id);
        if (existingStyle)
            existingStyle.remove();
        super.destroy(dom);
    }
}
