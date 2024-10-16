import {Decoration, DecorationSet, EditorView, PluginSpec, PluginValue, ViewPlugin, ViewUpdate, WidgetType} from "@codemirror/view";
import {PulseStyle, SearchPosition, SearchStyle, state as inter_plugin_state} from "./commons";
import {RangeSetBuilder} from "@codemirror/state";

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
                    .blaze-widget-pulse {
                      animation: pulse-pointer ${this.style.duration ?? 0.15}s 1 forwards;
                      background-color: ${this.style.bg ?? 'red'};
                    }
                    @keyframes pulse-pointer {
                        0% { opacity: 0; }
                        50% { opacity: 1; }
                        100% { opacity: 0; visibility: hidden; }
                    }
                `;
            document.head.appendChild(style);
        }

        const el = document.createElement("span");
        el.addClass('blaze-widget-pulse');
        el.innerText = " ";
        el.style.position = 'absolute';
        el.style.left = `${offset_x}px`;
        el.style.top = `${offset_y}px`;
        el.style.zIndex = '-1';
        el.style.fontFamily = 'monospace';
        el.style.fontWeight = 'bold';
        el.style.marginTop = '-1px';
        el.style.overflowWrap = 'normal';
        el.style.wordBreak = 'keep-all';
        el.style.whiteSpace = 'pre';
        el.style.cursor = 'default';
        return el;
    }

    public destroy(dom: HTMLElement) {
        const existingStyle = document.getElementById(BlazePointerPulseWidget.style_id);
        if (existingStyle)
            existingStyle.remove();
        super.destroy(dom);
    }

}

export class BlazeFoundAreaWidget extends WidgetType {
    private search_position: SearchPosition;
    private style: SearchStyle;
    private text: string;

    public constructor(text: string, search_position: SearchPosition, style: SearchStyle) {
        super();
        this.search_position = search_position;
        this.style = style;
        this.text = text;
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
        el.innerText = text;

        el.style.backgroundColor = `${this.style.bg}`;
        el.style.color = `${this.style.text}`;
        el.style.border = `thin dashed ${this.style.border}`;
        el.style.zIndex = `${5000 + this.style.idx}`;
        el.style.left = `${offset_x}px`;
        el.style.top = `${offset_y}px`;
        el.style.position = 'absolute';
        el.style.fontWeight = 'bold';
        el.style.paddingLeft = '3px';
        el.style.paddingRight = '3px';
        el.style.fontFamily = 'monospace';
        el.style.marginTop = '-1px';
        el.style.overflowWrap = 'normal';
        el.style.wordBreak = 'keep-all';
        el.style.whiteSpace = 'pre';
        el.style.cursor = 'default';

        return el;
    }
}

class BlazeViewPlugin implements PluginValue {
    decorations: DecorationSet = Decoration.none;

    public constructor() {
        // TODO REPLACE WITH ARRAY OBSERVERS
        if (!inter_plugin_state.state.plugin_draw_callback)
            inter_plugin_state.state.plugin_draw_callback =
                () => this.build_decorations();
    }

    public update(update: ViewUpdate) {
        if (inter_plugin_state.state.editor_callback)
            inter_plugin_state.state.editor_callback(update.view);
    }

    public destroy() {

    }

    private build_decorations() {
        const positions = inter_plugin_state.state.positions;
        const pointer = inter_plugin_state.state.pointer;

        if (!pointer && !(positions && positions.length > 0)) {
            this.decorations = Decoration.none;
            return;
        }

        const builder = new RangeSetBuilder<Decoration>();

        if (positions && positions.length > 0) {
            let i = 0;
            for (let position of positions) {
                builder.add(
                    position.index_s + position.offset,
                    position.index_s + position.offset,
                    Decoration.widget({
                        widget: new BlazeFoundAreaWidget(
                            position.name,
                            position,
                            <SearchStyle> {
                                ...(inter_plugin_state.state.style_provider?.(i++)),
                            })
                    })
                );
            }
        }

        else if (pointer) {
            builder.add(
                pointer.index_s + pointer.offset,
                pointer.index_s + pointer.offset,
                Decoration.widget({
                    widget: new BlazePointerPulseWidget(
                        pointer,
                        <PulseStyle> {
                            ...(inter_plugin_state.state.pulse_provider?.()),
                        }),
                    inclusive: false
                })
            );
        }

        this.decorations = builder.finish();
    }

}

const plugin_spec: PluginSpec<BlazeViewPlugin> = {
    decorations: v => v.decorations,
    eventObservers: {
        keydown: (_, view: EditorView) => {
            if (inter_plugin_state.state.editor_callback)
                inter_plugin_state.state.editor_callback(view);
        }
    }
}

export const blaze_jump_view_plugin = ViewPlugin.fromClass(
    BlazeViewPlugin,
    plugin_spec
);
