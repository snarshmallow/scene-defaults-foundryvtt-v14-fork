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

class DefaultSceneConfig extends foundry.applications.sheets.SceneConfig {
  constructor(options = {}) {
    const SceneDocument = CONFIG.Scene.documentClass;
    const defaults = foundry.utils.deepClone(
      game.settings.get("scene-defaults", "config") ?? {}
    );

    // Prefer a REAL world scene so SceneConfig has a proper collection-backed document.
    const existingScene = game.scenes?.contents?.[0];

    let document;
    let originalSource = null;

    if (existingScene) {
      document = existingScene;
      originalSource = foundry.utils.deepClone(existingScene.toObject());

      // Apply saved defaults into the live in-memory source only.
      // This should not persist unless the sheet explicitly updates the doc.
      const merged = foundry.utils.mergeObject(
        foundry.utils.deepClone(originalSource),
        defaults,
        { inplace: false }
      );
      document.updateSource(merged);
    } else {
      // Fallback for worlds with no scenes yet: construct a Scene with collection context.
      const source = foundry.utils.mergeObject(
        { name: "Prototype Scene" },
        defaults,
        { inplace: false }
      );

      document = new SceneDocument(source, {
        parent: null,
        pack: null,
        collection: game.scenes
      });
    }

    super({
      ...options,
      document
    });

    this._sceneDefaultsOriginalSource = originalSource;
    this._sceneDefaultsUsingExistingScene = !!existingScene;
  }

  async close(options = {}) {
    // Restore the original scene source if we were borrowing a real scene.
    if (this._sceneDefaultsUsingExistingScene && this.document && this._sceneDefaultsOriginalSource) {
      this.document.updateSource(foundry.utils.deepClone(this._sceneDefaultsOriginalSource));
    }
    return super.close(options);
  }

  async _processSubmitData(event, form, submitData, options) {
    // Remove fields that should not be stored as defaults if present.
    if (submitData.environment?.darknessLock !== undefined) {
      delete submitData.environment.darknessLock;
    }

    const SceneDocument = CONFIG.Scene.documentClass;
    const base = new SceneDocument(
      { name: "Prototype Scene" },
      { parent: null, pack: null, collection: game.scenes }
    );

    const expanded = foundry.utils.expandObject(submitData);
    const diffed = foundry.utils.diffObject(base.toObject(), expanded);

    await game.settings.set("scene-defaults", "config", diffed);

    // Prevent accidental persistence to the borrowed live scene.
    if (this._sceneDefaultsUsingExistingScene && this.document && this._sceneDefaultsOriginalSource) {
      this.document.updateSource(foundry.utils.deepClone(this._sceneDefaultsOriginalSource));
      ui.notifications.info("Scene defaults saved.");
      await this.close();
      return false;
    }

    return super._processSubmitData?.(event, form, submitData, options);
  }
}

Hooks.on("preCreateScene", (doc, data) => {
  const defaults = game.settings.get("scene-defaults", "config") ?? {};
  const merged = foundry.utils.mergeObject(
    foundry.utils.deepClone(defaults),
    data,
    { inplace: false }
  );
  doc.updateSource(merged);
});
