fn main() {
    if cfg!(feature = "updater") {
        tauri_build::build();
        return;
    }

    tauri_build::try_build(
        tauri_build::Attributes::new().plugin(
            "updater",
            tauri_build::InlinedPlugin::new()
                .commands(&["check", "download", "install", "download_and_install"])
                .default_permission(tauri_build::DefaultPermissionRule::AllowAllCommands),
        ),
    )
    .expect("failed to build Tavern desktop");
}
