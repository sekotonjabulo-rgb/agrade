// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use screenshots::Screen;
use std::io::Cursor;
use image::ImageEncoder;
use image::codecs::png::PngEncoder;
use leptess::LepTess;

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
    text
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![capture_screen])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}