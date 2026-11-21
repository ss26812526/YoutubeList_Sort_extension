# YT Playlist Sorter

[繁體中文](README.md) | English

A browser extension for Chrome and Edge that makes reordering your YouTube playlists easier.

## Problems it solves

1. **The page reloads after you drag to reorder.** YouTube's native drag-and-drop refreshes the playlist, so you lose your scroll position.
2. **The drag handle is too small.** The native ≡ handle is hard to grab.
3. **It's hard to find the target position in a long playlist.** The page loads only about 100 videos at a time, so you have to scroll to a spot just to see its position number.

## Features

- A ↕ button next to each video: click it, type a target position, and the video moves there
- A "Move to top" shortcut
- **Multi-select move**: tick videos on the page, or press "☑ Select" at the top of the screen to pick several videos from the full playlist, then move them all to one position at once. They stay together, in their original order. The action bar uses colors that contrast with your YouTube theme, and you can place it at the top or bottom of the screen in the settings panel
- **Pick from full list**: a pop-up lists the whole playlist (number, thumbnail, title, channel). Search by title, channel or number, then click a row to fill in the target position. Works beyond the first 100 videos the page loads
- **Move progress**: the panel shows the steps "Load full playlist" → "Save to YouTube" and marks the step that failed, if any
- **Move animation**: when both the start and end positions are on screen, the video slides into place while the others make room. For longer distances the page scrolls to the new position. The landing spot flashes briefly. No animation plays when your system's "reduce motion" setting is on
- No page reload after a move. YouTube's own playlist data is updated too, so native drag-and-drop keeps working afterwards
- A position number in the top-right corner of each video, updated right after each move (the "Recommended videos" section at the bottom of the page is not numbered)
- Follows YouTube's dark and light themes
- **Settings panel**: click the extension icon in the toolbar to turn the extension on or off, show or hide position numbers, place the multi-select bar at the top or bottom, and switch the interface language (Auto, matching YouTube / 繁體中文 / English). Changes apply right away

## Installation

1. Download or clone this repository
2. Open the extensions page in your browser (`chrome://extensions` or `edge://extensions`)
3. Turn on "Developer mode"
4. Click "Load unpacked" and select this folder

After updating the code, click "Reload" on the extensions page and refresh any open YouTube tabs. Tabs opened before the reload keep running the old version.

## Usage

1. Open one of your own YouTube playlists
2. A ↕ button appears on the right of each video
3. Click it and type a target position, or press "📋 Pick from full list" to search the playlist and click the position you want
4. Press "Move" (or Enter). The video moves to that position without reloading the page

## How it works

- **Manifest V3**: works on Chrome and Edge
- **Content script (`world: "MAIN"`)**: reads `window.ytcfg` for the API session info
- **Settings bridge (`bridge.js`)**: reads settings from `chrome.storage` in the isolated world and passes them to the main script. The only permission needed is `storage`
- **YouTube InnerTube API**: `/youtubei/v1/browse` loads the full playlist, and `/youtubei/v1/browse/edit_playlist` performs the moves
- **SAPISIDHASH authentication**: the auth header is built from a SHA-1 hash
- **Polymer data sync**: after a move, YouTube's own playlist data is updated with `splice`, and the page re-renders from it
- **FLIP animation**: moves are animated with CSS `transform`, only for videos on screen

## Limitations

- Works only on playlists you own (you need edit access)
- If the playlist hides unavailable videos, the extension counts only the visible ones, so its numbers and total are lower than the count shown in the playlist header
- Avoid editing the same playlist in several tabs at once. Other tabs don't update on their own; refresh them to see the new order
- YouTube may change its API or page structure at any time, which may require updates to the extension
