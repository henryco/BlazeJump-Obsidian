import {Decoration, DecorationSet, EditorView, PluginSpec, PluginValue, ViewPlugin, ViewUpdate} from "@codemirror/view";
import {PulseStyle, SearchPosition, SearchStyle, state as inter_plugin_state} from "./commons";
import {BlazePointerPulseWidget} from "./widgets/pulse_widget";
import {BlazeFoundAreaWidget} from "./widgets/found_widget";
import {RangeSetBuilder} from "@codemirror/state";

class BlazeViewPlugin implements PluginValue {
    private static id_counter: number = 0;

    private readonly local_id: number;
    public decorations: DecorationSet = Decoration.none;

    public constructor() {
        this.local_id = BlazeViewPlugin.id_counter++;

        if (!inter_plugin_state.state.plugin_draw_observers)
            inter_plugin_state.state.plugin_draw_observers = [];

        inter_plugin_state.state.plugin_draw_observers.push({
            id: `${this.local_id}`,
            fn: () => this.build_decorations(),
        });
    }

    public update(update: ViewUpdate) {
        if (inter_plugin_state.state.editor_callback)
            inter_plugin_state.state.editor_callback(update.view);
    }

    public destroy() {
        if (!inter_plugin_state.state.plugin_draw_observers)
            return;
        for (let observer of inter_plugin_state.state.plugin_draw_observers) {
            if (observer.id !== `${this.local_id}`)
                continue;
            inter_plugin_state.state.plugin_draw_observers.remove(observer);
        }
    }

    private build_decorations() {
        const positions = inter_plugin_state.state.positions;
        const pointer = inter_plugin_state.state.pointer;

        if (!pointer && !(positions && positions.length > 0)) {
            this.decorations = Decoration.none;
            return;
        }

        const builder = new RangeSetBuilder<Decoration>();

        // if (positions && positions.length > 0) {
        //     const style = <SearchStyle>(inter_plugin_state.state.style_provider?.());
        //     const grouped: SearchPosition[][] = [];
        //
        //     let prev_node = null;
        //     let prev_top = null;
        //
        //     for (let position of positions) {
        //         const top = position.coord.top;
        //         if (prev_top === null || prev_top !== top) {
        //             prev_node = <SearchPosition[]>[];
        //             grouped.push(prev_node);
        //         }
        //         prev_node?.push(position);
        //         prev_top = top;
        //     }
        //
        //     for (let i = 0; i < grouped.length; i++) {
        //         const char = inter_plugin_state.state.target;
        //         const group = grouped[i];
        //         const zero = group[0];
        //         const pos = zero.index_s;
        //         builder.add(pos, pos, Decoration.widget({widget: new BlazeTagWidget(i, group, style, char)}));
        //     }
        // }

        if (positions && positions.length > 0) {

            let j = -1;
            let prev_top = null;
            const grouped: SearchPosition[][] = [];
            for (let position of positions) {
                const top = position.coord.top;
                if (prev_top === null || !top || prev_top !== top) {
                    grouped.push([]);
                    prev_top = top;
                    j++;
                }
                grouped[j].push(position);
            }

            let i = 0;
            for (let position of positions) {
                builder.add(
                    position.index_s,
                    position.index_s,
                    Decoration.widget({
                        widget: new BlazeFoundAreaWidget(
                            i++,
                            position.name,
                            position,
                            <SearchStyle> {
                                ...(inter_plugin_state.state.style_provider?.()),
                            })
                    })
                );
            }
        }

        else if (pointer) {
            builder.add(
                pointer.index_s,
                pointer.index_s,
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
