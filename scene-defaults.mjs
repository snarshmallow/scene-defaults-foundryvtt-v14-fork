Hooks.on("init", () => {
  game.settings.register("scene-defaults", "config", {
    scope: "world",
    config: false,
    type: Object,
    default: {}
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

const SCENE_DEFAULTS_STRIP_KEYS = [
  "name",
  "navName",
  "thumb",
  "background.src",
  "foreground",
  "foregroundElevation",
  "width",
  "height",
  "padding",
  "initial.x",
  "initial.y",
  "initial.scale",
  "background.offsetX",
  "background.offsetY",
  "background.rotation",
  "background.scaleX",
  "background.scaleY",
  "grid.size",
  "grid.distance",
  "grid.units"
];

function unsetPropertyPath(obj, path) {
  const parts = path.split(".");
  let target = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!target || typeof target !== "object") return;
    target = target[parts[i]];
  }
  if (target && typeof target === "object") delete target[parts.at(-1)];
}

function stripSceneSpecificFields(data) {
  const clone = foundry.utils.deepClone(data ?? {});
  for (const key of SCENE_DEFAULTS_STRIP_KEYS) unsetPropertyPath(clone, key);

  // cleanup empty containers
  for (const top of ["background", "grid", "initial"]) {
    if (clone[top] && !Object.keys(clone[top]).length) delete clone[top];
  }

  return clone;
}

class DefaultSceneConfig extends foundry.applications.sheets.SceneConfig {
  constructor(options = {}) {
    const defaults = foundry.utils.deepClone(
      game.settings.get("scene-defaults", "config") ?? {}
    );

    const existingScene = game.scenes?.contents?.[0];
    if (!existingScene) {
      ui.notifications.warn("Create at least one scene first, then reopen Scene Defaults.");
    }

    const document = existingScene ?? new CONFIG.Scene.documentClass(
      { name: "Prototype Scene" },
      { parent: null, pack: null, collection: game.scenes }
    );

    const originalSource = foundry.utils.deepClone(document.toObject());

    // Only apply NON-dimension defaults onto the borrowed scene
    const merged = foundry.utils.mergeObject(
      foundry.utils.deepClone(originalSource),
      stripSceneSpecificFields(defaults),
      { inplace: false }
    );
    document.updateSource(merged);

    super({
      ...options,
      document
    });

    this._sceneDefaultsOriginalSource = originalSource;
  }

  async _onRender(context, options) {
    await super._onRender?.(context, options);

    // visually blank inherited dimension-ish values so they don't look like defaults
    const namesToBlank = [
      "width",
      "height",
      "padding",
      "initial.x",
      "initial.y",
      "initial.scale",
      "background.offsetX",
      "background.offsetY",
      "background.rotation",
      "background.scaleX",
      "background.scaleY",
      "grid.size",
      "grid.distance",
      "grid.units"
    ];

    for (const name of namesToBlank) {
      const el = this.element?.querySelector?.(`[name="${name}"]`);
      if (el) el.value = "";
    }
  }

  async close(options = {}) {
    if (this.document && this._sceneDefaultsOriginalSource) {
      this.document.updateSource(foundry.utils.deepClone(this._sceneDefaultsOriginalSource));
    }
    return super.close(options);
  }

  async _processSubmitData(event, form, submitData, options) {
    const expanded = foundry.utils.expandObject(submitData);

    if (expanded.environment?.darknessLock !== undefined) {
      delete expanded.environment.darknessLock;
    }

    // Remove anything scene-instance-specific or dimension-specific
    const cleaned = stripSceneSpecificFields(expanded);

    // Diff against a blank prototype scene so only actual defaults are stored
    const base = new CONFIG.Scene.documentClass(
      { name: "Prototype Scene" },
      { parent: null, pack: null, collection: game.scenes }
    );

    const diffed = foundry.utils.diffObject(base.toObject(), cleaned);

    await game.settings.set("scene-defaults", "config", diffed);

    // restore borrowed scene and close without saving to it
    if (this.document && this._sceneDefaultsOriginalSource) {
      this.document.updateSource(foundry.utils.deepClone(this._sceneDefaultsOriginalSource));
    }

    ui.notifications.info("Scene defaults saved.");
    await this.close();
    return false;
  }
}

Hooks.on("preCreateScene", (doc, data) => {
  const defaults = stripSceneSpecificFields(
    game.settings.get("scene-defaults", "config") ?? {}
  );

  const merged = foundry.utils.mergeObject(
    foundry.utils.deepClone(defaults),
    data,
    { inplace: false }
  );

  doc.updateSource(merged);
});
