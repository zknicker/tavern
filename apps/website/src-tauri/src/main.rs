#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{env, process::Command, sync::Once};
use tauri::{
    menu::{Menu, MenuEvent, MenuItemBuilder, Submenu},
    utils::{
        config::WindowEffectsConfig, WindowEffect as Effect, WindowEffectState as EffectState,
    },
    App, LogicalPosition, Manager, Runtime, TitleBarStyle, WebviewUrl, WebviewWindowBuilder,
};

static DEV_PORT_CLEANUP: Once = Once::new();
const OPEN_DEVTOOLS_MENU_ID: &str = "open-devtools";

fn main() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init());
    #[cfg(all(not(debug_assertions), feature = "updater"))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    let app = builder
        .setup(|app| {
            create_main_window(app)?;
            install_app_menu(app)?;
            app.on_menu_event(handle_menu_event);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Tavern desktop");

    app.run(|_, event| match event {
        tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
            cleanup_dev_ports_once();
        }
        _ => {}
    });
}

fn create_main_window<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    let builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
        .title("Tavern")
        .inner_size(1440.0, 960.0)
        .min_inner_size(1100.0, 760.0)
        .resizable(true)
        .hidden_title(true)
        .title_bar_style(TitleBarStyle::Overlay)
        .traffic_light_position(LogicalPosition::new(17.0, 24.0))
        .devtools(true);

    #[cfg(target_os = "macos")]
    let builder = builder.transparent(true).effects(WindowEffectsConfig {
        effects: vec![Effect::Menu],
        state: Some(EffectState::Active),
        radius: Some(12.0),
        color: None,
    });

    builder.build()?;

    Ok(())
}

fn install_app_menu<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    let handle = app.handle();
    let menu = Menu::default(&handle)?;
    let open_devtools_item = MenuItemBuilder::with_id(OPEN_DEVTOOLS_MENU_ID, "Open Web Inspector")
        .accelerator("CmdOrCtrl+Alt+I")
        .build(app)?;
    let developer_submenu = Submenu::with_items(app, "Developer", true, &[&open_devtools_item])?;

    menu.append(&developer_submenu)?;
    handle.set_menu(menu)?;

    Ok(())
}

fn handle_menu_event<R: Runtime>(app: &tauri::AppHandle<R>, event: MenuEvent) {
    if !is_open_devtools_menu_event(&event) {
        return;
    }

    let Some(webview_window) = app
        .get_webview_window("main")
        .or_else(|| app.webview_windows().into_values().next())
    else {
        return;
    };

    webview_window.open_devtools();
}

fn is_open_devtools_menu_event(event: &MenuEvent) -> bool {
    event.id() == OPEN_DEVTOOLS_MENU_ID
}

fn cleanup_dev_ports_once() {
    DEV_PORT_CLEANUP.call_once(cleanup_dev_ports);
}

fn cleanup_dev_ports() {
    if !cfg!(debug_assertions) {
        return;
    }

    for key in ["TAVERN_WEBSITE_PORT", "TAVERN_SERVER_PORT"] {
        let Some(port) = read_port(key) else {
            continue;
        };

        kill_processes_listening_on_port(port);
    }

    if env::var("TAVERN_DEV_STACK_HAS_RUNTIME").ok().as_deref() != Some("1") {
        return;
    }

    for key in ["TAVERN_RUNTIME_PORT", "TAVERN_OPENCLAW_GATEWAY_PORT"] {
        let Some(port) = read_port(key) else {
            continue;
        };

        kill_processes_listening_on_port(port);
    }
}

fn read_port(key: &str) -> Option<u16> {
    env::var(key)
        .ok()?
        .parse::<u16>()
        .ok()
        .filter(|port| *port > 0)
}

fn kill_processes_listening_on_port(port: u16) {
    let output = Command::new("lsof")
        .args(["-nP", "-t", &format!("-iTCP:{port}"), "-sTCP:LISTEN"])
        .output();

    let Ok(output) = output else {
        return;
    };

    for pid in String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
    {
        if pid == std::process::id().to_string() {
            continue;
        }

        let _ = Command::new("kill").args(["-TERM", pid]).status();
    }
}

#[cfg(test)]
mod tests {
    use super::{is_open_devtools_menu_event, OPEN_DEVTOOLS_MENU_ID};
    use tauri::menu::MenuEvent;

    #[test]
    fn matches_devtools_menu_event() {
        let event = MenuEvent {
            id: OPEN_DEVTOOLS_MENU_ID.into(),
        };

        assert!(is_open_devtools_menu_event(&event));
    }

    #[test]
    fn ignores_other_menu_events() {
        let event = MenuEvent {
            id: "other-menu-item".into(),
        };

        assert!(!is_open_devtools_menu_event(&event));
    }
}
