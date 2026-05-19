import unreal

DEST_MAPS = [
    '/Game/Maps/L_CyberPlaza',
    '/Game/Maps/L_CyberShop',
    '/Game/Maps/L_CyberCasino',
]

level_subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
editor_assets = unreal.EditorAssetLibrary

for dest in DEST_MAPS:
    ok = level_subsystem.new_level(dest)
    if not ok:
        raise RuntimeError(f'Failed to create level: {dest}')
    editor_assets.save_asset(dest, only_if_is_dirty=False)
    unreal.log(f'Created level: {dest}')

unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
unreal.log('Clean cyber maps created successfully.')
