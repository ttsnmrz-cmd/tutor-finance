# Classroom Materials restoration — scope and compatibility contract

Source reviewed: `ttsnmrz-cmd/classroom-web` deployed bundle `assets/index-Cf2gzXwX.js`, and current `legacy/js/app.js` / `index.html`.

## Keep unchanged
- Root ProfiProfit app, dashboard, weekly calendar, student details, financial cards, four student tabs, payments, auth, and Supabase data.
- Do not replace root `index.html` with Classroom React app or embed a separate full app iframe.
- Do not copy Classroom's test notes into the student records.

## Existing Classroom implementation
- Materials listing: `learning_materials` (`id,title,folder_id,revision,updated_at,body`) and `learning_folders` (`id,title,parent_id,position`), filtered by `teacher_id`.
- Save: RPC `learning_save_material` with `p_id,p_title,p_body,p_revision,p_folder_id`.
- Publish: RPC `learning_publish_material` with `p_material_id`.
- Folder operations: RPC `learning_folder_action` with `p_action,p_id,p_title,p_parent`.
- The bundle also contains a legacy material-section API (`material_section_action`, `save_builder_material`), which must not be silently substituted for the current learning_* contract.
- Lesson Builder supports exercise types, stages, editing and preview.
- Student preview includes Pointer and Follow Me teacher/student navigation. These require session and real-time coordination, not only UI buttons.

## Current ProfiProfit
- `#tab-materials` only lists folders/material titles through `loadNativeMaterials()`.
- No native editor, preview, publishing or pointer/follow-me flow is mounted.

## Acceptance criteria
1. Material library and folders open inside current ProfiProfit shell.
2. Existing material body can be opened and edited without schema loss; new materials can be created and saved using correct revision.
3. All exercise types in the source are preserved, not reduced to a generic text editor.
4. Teacher/student preview works with Pointer and Follow Me; verify actual cross-session delivery.
5. Existing students, calendar, finance, and approved UI remain unchanged.
6. Test in browser and confirm publication only after feature verification.

This file is a migration checklist, not a claim that the feature has been restored.
