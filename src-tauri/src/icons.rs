#[tauri::command]
pub fn get_icon_path(name: &str) -> String {
    let themed = gtk::IconTheme::default();

    let icon = themed
        .lookup_icon(
            name,
            &["scalable", "64x64", "48x48", "32x32", "24x24"],
            64,
            1,
            gtk::TextDirection::Ltr,
            gtk::IconLookupFlags::FORCE_REGULAR,
        )
        .icon_name();

    let path = icon.unwrap().to_str().unwrap().to_string();

    print!("Icon path: {}", path);
    return path;
}
