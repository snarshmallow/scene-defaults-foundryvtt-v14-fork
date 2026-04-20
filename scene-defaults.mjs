class DefaultSceneConfig extends foundry.applications.sheets.SceneConfig {
  constructor(options = {}, ...args) {
    const SceneDocument = CONFIG.Scene.documentClass;

    const base = new SceneDocument({ name: "Prototype Scene" });
    const savedDefaults = game.settings.get("scene-defaults", "config") ?? {};
    const source = foundry.utils.mergeObject(base.toObject(), savedDefaults, { inplace: false });

    // Foundry v14 SceneConfig is happier when backed by a real Scene document shape.
    // Prefer cloning an existing world scene so all expected internals/flags are present.
    let document;
    const existing = game.scenes?.contents?.[0];
    if (existing) {
      document = existing.clone(source, { save: false, keepId: true });
    } else {
      source._id ??= foundry.utils.randomID();
      document = new SceneDocument(source);
    }

    options.document = document;
    super(options, ...args);
  }

  async _processSubmitData(event, form, submitData, options) {
    delete submitData.environment?.darknessLock;

    const SceneDocument = CONFIG.Scene.documentClass;
    const base = new SceneDocument({ name: "Prototype Scene" });
    const expanded = foundry.utils.expandObject(submitData);
    const diffed = foundry.utils.diffObject(base.toObject(), expanded);

    await game.settings.set("scene-defaults", "config", diffed);
  }
}

Hooks.on("init", () => {
  game.settings.register("scene-defaults", "config", {
    scope: "world",
    config: false,
    type: Object,
    default: { name: "Prototype Scene" }
  });

  game.settings.registerMenu("scene-defaults", "defaults_config", {
    name: "SCENE-DEFAULTS.settings.config.title",
    label: "SCENE-DEFAULTS.settings.config.label",
    hint: "SCENE-DEFAULTS.settings.config.hint",
    icon: "fas fa-cogs",
    type: DefaultSceneConfig,
    restricted: false
  });
});

Hooks.on("preCreateScene", (doc, data) => {
  const defaults = game.settings.get("scene-defaults", "config") ?? {};
  doc.updateSource(foundry.utils.mergeObject(defaults, data, { inplace: false }));
});