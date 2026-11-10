# Palmyra Rain on the iPhone

This folder is only the phone page. It has no rain readings and no rainfall book. Those stay in OneDrive.

The page is meant to be published at:

https://gordon55-a11y.github.io/palmyra-rainfall-phone/

## One-time rainfall book

On a computer that has this private repository, run:

```bash
python3 scripts/export_rainfall_book.py --out ~/rainfall-book.json
```

Upload `rainfall-book.json` yourself to:

`Farming Apps/Palmyra Rainfall/rainfall-book.json`

Do that again when a newer SAWS extract or farm book is built. The phone picks it up the next time it has a signal.

## Sign in

Use the personal Microsoft account gordonbrown24@gmail.com. The first time, tap **Sign in to send** or **Sign in to check the rain file**. After that, the last copy stays on the phone, so the gauge can be written down with no signal.

## What the page may open

Only these, in that OneDrive folder:

- `rain-log.json`
- `backups/` (a copy is kept before each save, last 30)
- `rainfall-book.json`

Nothing else. Not the herd file. Not Personal Vault.
