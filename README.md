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

Use the personal Microsoft account gordonbrown24@gmail.com. Sign in once. The rain figures then open from the copy kept on the phone, including when there is no network.

On an iPhone, Safari and the home-screen icon do not share a sign-in. Add the page to the Home Screen, open that icon, and sign in once there. That sign-in stays with the icon. You do not sign in again to see the figures.

## What the page may open

Only these, in that OneDrive folder:

- `rain-log.json`
- `backups/` (a copy is kept before each save, last 30)
- `rainfall-book.json`

Nothing else. Not the herd file. Not Personal Vault.
