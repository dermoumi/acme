// What each runtime has to be handed for the kit's own arm to answer: nothing
// on node, where a directory is config, and the binding on workerd.
export type CreateBindings = () => Record<string, unknown>;
