import {Decoration, DecorationSet, EditorView, PluginSpec, PluginValue, ViewPlugin, ViewUpdate, WidgetType} from "@codemirror/view";
import {SearchPosition, SearchStyle, state as inter_plugin_state} from "./commons";
import {RangeSetBuilder} from "@codemirror/state";

export class BlazeFoundAreaWidget extends WidgetType {
    search_position: SearchPosition;
    style: SearchStyle;
    replace_text: string;

    constructor(replace_text: string, search_position: SearchPosition, style: SearchStyle) {
        super();
        this.search_position = search_position;
        this.replace_text = replace_text;
        this.style = style;
    }

    toDOM(_: EditorView): HTMLElement {
        const prefix = Array(this.style.offset).fill(' ').reduce((p, c) => p + c, '');

        const offset_x = this.search_position.coord.left - this.search_position.origin.left;
        const offset_y = this.search_position.coord.top - this.search_position.origin.top;

        const el = document.createElement("mark");
        el.innerText = prefix + this.replace_text.toLowerCase().substring(this.style.offset);

        el.style.backgroundColor = `${this.style.bg}`;
        el.style.color = `${this.style.text}`;
        el.style.border = `thin dashed ${this.style.border}`;
        el.style.zIndex = `${5000 + this.style.idx}`;
        el.style.position = 'absolute';
        el.style.fontWeight = 'bold';
        el.style.paddingLeft = '2px';
        el.style.paddingRight = '2px';
        el.style.fontFamily = 'monospace';
        el.style.marginTop = '-1px';
        el.style.overflowWrap = 'normal';
        el.style.wordBreak = 'keep-all';
        el.style.whiteSpace = 'pre';
        el.style.cursor = 'default';

        el.style.left = `${offset_x}px`;
        el.style.top = `${offset_y}px`;

        return el;
    }
}

class BlazeViewPlugin implements PluginValue {
    decorations: DecorationSet = Decoration.none;

    constructor() {
        inter_plugin_state.state.plugin_draw_callback =
            () => this.build_decorations();
    }

    update(update: ViewUpdate) {
        if (inter_plugin_state.state.editor_callback)
            inter_plugin_state.state.editor_callback(update.view);
    }

    destroy() {
        inter_plugin_state.state = {};
    }

    build_decorations() {
        const positions = inter_plugin_state.state.positions;
        if (!positions || positions.length <= 0) {
            this.decorations = Decoration.none;
            return;
        }

        let i = 0;
        const builder = new RangeSetBuilder<Decoration>();
        for (let position of positions) {
            builder.add(
                position.index_s + 1,
                position.index_s + 1,
                Decoration.replace({
                    widget: new BlazeFoundAreaWidget(
                        position.name,
                        position,
                        <SearchStyle> {
                            ...(inter_plugin_state.state.style_provider?.(i++)),
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
