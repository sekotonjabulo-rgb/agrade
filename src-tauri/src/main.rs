#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use screenshots::Screen;
use std::io::Cursor;
use image::ImageEncoder;
use image::codecs::png::PngEncoder;
use leptess::LepTess;

#[cfg(target_os = "windows")]
use windows::Win32::Foundation::HWND;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowLongW, SetWindowLongW, SetWindowDisplayAffinity,
    GWL_EXSTYLE, WS_EX_TRANSPARENT, WS_EX_LAYERED, WDA_EXCLUDEFROMCAPTURE,
};

#[cfg(target_os = "windows")]
fn apply_stealth_flags(hwnd: HWND) -> windows::core::Result<()> {
    unsafe {
        eprintln!("Applying stealth flags to HWND: {:?}", hwnd);
        let current_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
        SetWindowLongW(
            hwnd,
            GWL_EXSTYLE,
            current_style | WS_EX_TRANSPARENT.0 as i32 | WS_EX_LAYERED.0 as i32,
        );
        SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)?;
        eprintln!("Stealth flags applied successfully");
    }
    Ok(())
}

#[tauri::command]
fn capture_screen() -> String {
    let screens = Screen::all().unwrap();
    let screen = screens[0];
    let image = screen.capture().unwrap();
    let mut bytes: Vec<u8> = Vec::new();
    PngEncoder::new(Cursor::new(&mut bytes))
        .write_image(
            image.as_raw(),
            image.width(),
            image.height(),
            image::ColorType::Rgba8.into(),
        )
        .unwrap();
    let mut lt = LepTess::new(None, "eng").unwrap();
    lt.set_image_from_mem(&bytes).unwrap();
    let text = lt.get_utf8_text().unwrap();
    eprintln!("Captured screen text length: {}", text.len());
    text
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![capture_screen])
        .setup(|app| {
            #[cfg(target_os = "windows")]
            {
                use tauri::Manager;
                let main_window = app.get_webview_window("main").unwrap();
                main_window.set_always_on_top(true).unwrap();
                let hwnd = HWND(main_window.hwnd().unwrap().0 as *mut core::ffi::c_void);
                apply_stealth_flags(hwnd).expect("Failed to apply stealth flags");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
