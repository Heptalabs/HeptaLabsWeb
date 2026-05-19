import unreal

SOURCE_MAP = '/Game/ThirdPerson/Lvl_ThirdPerson'
DEST_MAPS = [
    '/Game/Maps/L_CyberPlaza',
    '/Game/Maps/L_CyberShop',
    '/Game/Maps/L_CyberCasino',
]

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
editor_assets = unreal.EditorAssetLibrary

source_asset = unreal.load_asset(SOURCE_MAP)
if not source_asset:
    raise RuntimeError(f'Source map not found: {SOURCE_MAP}')

for dest in DEST_MAPS:
    if editor_assets.does_asset_exist(dest):
        editor_assets.delete_asset(dest)

for dest in DEST_MAPS:
    package_path, asset_name = dest.rsplit('/', 1)
    duplicated = asset_tools.duplicate_asset(asset_name, package_path, source_asset)
    if not duplicated:
        raise RuntimeError(f'Failed to duplicate map: {dest}')
    editor_assets.save_asset(dest, only_if_is_dirty=False)
    unreal.log(f'Duplicated map: {dest}')

unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
unreal.log('Cyber map regeneration completed.')
