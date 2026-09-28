# Portable offline Windows edition

## What will change
- Make the light-mode theme button clearly white against the sidebar.
- Move Dashboard above the centre picker in desktop navigation, while keeping the mobile navigation usable.
- Add a fully local data mode used only by the packaged Windows edition; the existing online app will continue using its current shared cloud data.
- Add Backup & Restore controls so users can export all local centres, yard positions, sizes/types, rakes, containers, and logs to one backup file and restore it on another PC.
- Package the app as one portable Windows `.exe` that users can copy and double-click without installing.

## Offline behavior
- The 12 default centres and default size/type options are created automatically on first launch.
- Every change is stored only on that Windows PC and remains available after closing and reopening the app.
- Excel/CSV importing, editing, ISO validation, reports, dispatching, logs, themes, and search continue without internet access.
- Each PC has independent records unless a user transfers a backup file.

## Technical details
- Keep the existing data interface and introduce a browser-local IndexedDB implementation for offline mode, avoiding changes to each operational screen.
- Use hash-based navigation in the desktop package so every screen works when loaded locally.
- Bundle all app assets and remove runtime font/network dependencies from the offline package.
- Build the Windows package with Electron using isolated browser permissions, then wrap the packaged application as a single self-extracting portable executable.
- Validate the web build, offline navigation, local data persistence, backup/restore round trip, and packaged file contents before delivery.
