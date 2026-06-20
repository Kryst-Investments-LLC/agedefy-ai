# Anatomical 3D model (optional)

The `/body` 3D view renders a **stylized primitive humanoid** by default — no
external asset required, and it ships out of the box.

To upgrade to a **true anatomical model**, drop a licensed `.glb` / `.gltf` file
here and point the app at it:

```
# .env (NEXT_PUBLIC_ so the client can read it)
NEXT_PUBLIC_ANATOMY_MODEL_URL=/models/anatomy.glb
```

When that variable is set and the model loads, it **replaces** the primitive
body. If the URL is missing or the load fails, the viewer falls back to the
primitive humanoid automatically — nothing breaks.

## Licensing — this is your decision

This repository does **not** ship an anatomical model. Human-anatomy 3D models
are licensed assets. Source one you have the rights to, e.g.:

- A commercial/medical anatomy asset (TurboSquid, Sketchfab Store, BioDigital, Z-Anatomy)
- An open-licensed model (e.g. **Z-Anatomy**, CC-BY-SA) — check attribution terms
- A model your team commissions

Verify the licence permits web embedding and redistribution in your product
before committing the file.

## Organ tinting by biomarker status

If the model's mesh/node names include organ keywords, those meshes are tinted
by the user's biomarker status (green = optimal, amber = borderline,
red = out of range). Recognised name patterns (case-insensitive substring):

| Organ system   | Matches node names containing            |
| -------------- | ---------------------------------------- |
| cardiovascular | heart, cardio, aorta, vascul             |
| liver          | liver, hepat                             |
| kidney         | kidney, renal                            |
| metabolic      | pancrea, stomach, intestine, gut, metabol|
| thyroid        | thyroid                                  |
| immune         | spleen, lymph, immun                     |
| hematology     | marrow, blood, vein, hemato              |
| endocrine      | adrenal, pituitary, gland, endocrin      |

Meshes that don't match an organ are rendered semi-transparent so the tinted
organs stand out. Clickable organ markers remain in both modes, so the
inspect-on-click UX works regardless of the model.

## Model guidance

- **Format:** glTF 2.0 (`.glb` preferred — single binary file)
- **Orientation:** Y-up, facing +Z; the viewer auto-scales to ~3.4 units tall
  and re-centres, so absolute scale doesn't matter
- **Budget:** keep it web-friendly (≤ ~5–10 MB, draco-compressed if possible)
