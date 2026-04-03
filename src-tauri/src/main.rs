#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod capture;
mod save;

use std::fs::OpenOptions;
use std::io::Write;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tauri_plugin_autostart::ManagerExt;

fn log(msg: &str) {
    if let Some(mut dir) = dirs::data_local_dir() {
        dir.push("SafeShot");
        std::fs::create_dir_all(&dir).ok();
        dir.push("safeshot.log");
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&dir) {
            let _ = writeln!(
                f,
                "[{}] {}",
                chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
                msg
            );
        }
    }
}

fn main() {
    // Catch panics and log them
    std::panic::set_hook(Box::new(|info| {
        log(&format!("PANIC: {}", info));
    }));

    log("SafeShot starting...");

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(capture::CaptureCache(std::sync::Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![
            capture::capture_screens,
            save::save_screenshot,
            save::get_next_filename,
            save::copy_to_clipboard,
            close_overlay,
        ])
        .setup(|app| {
            log("Setup starting...");

            // Enable auto-start on OS boot
            let autostart = app.autolaunch();
            if !autostart.is_enabled().unwrap_or(false) {
                autostart.enable().ok();
                log("Autostart enabled");
            }

            // Build tray menu
            let capture_item =
                MenuItem::with_id(app, "capture", "Capture Screenshot", true, None::<&str>)?;
            let open_folder =
                MenuItem::with_id(app, "open_folder", "Open Save Folder", true, None::<&str>)?;
            let about_item = MenuItem::with_id(app, "about", "About", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit SafeShot", true, None::<&str>)?;
            let menu =
                Menu::with_items(app, &[&capture_item, &open_folder, &about_item, &quit_item])?;
            log("Tray menu built");

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("SafeShot")
                .menu(&menu)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "capture" => start_capture(app),
                    "open_folder" => open_save_folder(app),
                    "about" => show_about(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        start_capture(tray.app_handle());
                    }
                })
                .build(app)?;
            log("Tray icon created");

            // Register PrtScn global shortcut
            let shortcut = Shortcut::new(Some(Modifiers::empty()), Code::PrintScreen);
            let app_handle = app.handle().clone();
            match app
                .global_shortcut()
                .on_shortcut(shortcut, move |_app, _shortcut, _event| {
                    start_capture(&app_handle);
                }) {
                Ok(_) => log("PrtScn shortcut registered"),
                Err(e) => log(&format!("PrtScn shortcut failed: {}", e)),
            }

            log("Setup complete. SafeShot ready");
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error building tauri app")
        .run(|_app, event| {
            // Keep the app alive when all windows are closed (tray-only mode)
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                api.prevent_exit();
            }
        });

    log("SafeShot exited normally");
}

#[tauri::command]
fn close_overlay(app: AppHandle) {
    if let Some(win) = app.get_webview_window("overlay") {
        win.close().ok();
    }
    log("Overlay closed");
}

fn start_capture(app: &AppHandle) {
    if app.get_webview_window("overlay").is_some() {
        return;
    }
    log("Starting capture...");

    // Capture screens BEFORE opening the overlay so we don't screenshot our own window
    match capture::do_capture() {
        Ok(data) => {
            log(&format!("Captured {} displays", data.len()));
            let cache = app.state::<capture::CaptureCache>();
            *cache.0.lock().unwrap() = data;
        }
        Err(e) => {
            log(&format!("Capture failed: {}", e));
            return;
        }
    }

    match WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("index.html".into()))
        .title("SafeShot")
        .fullscreen(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(true)
        .transparent(true)
        .build()
    {
        Ok(_) => log("Overlay window created"),
        Err(e) => log(&format!("Overlay window failed: {}", e)),
    }
}

fn open_save_folder(_app: &AppHandle) {
    let dir = save::get_save_directory();
    std::fs::create_dir_all(&dir).ok();
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&dir)
            .spawn()
            .ok();
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(&dir).spawn().ok();
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&dir)
            .spawn()
            .ok();
    }
}

fn show_about(_app: &AppHandle) {
    let version = env!("CARGO_PKG_VERSION");
    rfd::MessageDialog::new()
        .set_title("About SafeShot")
        .set_description(&format!("SafeShot v{}\n\nPrivacy-first screenshot tool.\nYour screenshots stay yours, always.\nNo cloud, no tracking, no compromises.\n\nDeveloped by Matheus Chiappina\nhttps://chiappina.com", version))
        .set_level(rfd::MessageLevel::Info)
        .show();
}
