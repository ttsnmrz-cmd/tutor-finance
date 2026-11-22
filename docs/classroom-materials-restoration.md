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


## Verified source integration — 2026-11-22

Source repository: `ttsnmrz-cmd/my-english-classroom`, branch `source/latest-classroom-2026-11-22`, path `source/app/`.

- Vite + React 19 + TypeScript app: `source/app/package.json`.
- Real editor: `src/builder/MaterialBuilder.tsx`, `ExerciseEditor.tsx`, `ExercisePreview.tsx`.
- Library UI: `src/materials/MaterialsLibraryPreview.tsx`; currently imports **mockRepository** (localStorage), not production persistence.
- Existing `src/blocks/MaterialsLibrary.tsx` also uses localStorage for folders/text drafts.
- Main entry `src/main.tsx` checks `teacher_accounts` and `student_access_links` for authorization; this is incompatible with production teacher auth until adapted.
- `src/planning/api.ts` calls `save_teaching_plan`, `publish_teaching_plan`, and `create_planned_live_session` RPCs. These were NOT created by the five-table production SQL migration.
- Classroom migration `source/app/supabase/migrations/006_teaching_lesson_plans.sql` references Classroom-specific `teacher_accounts`, `live_sessions` and other functions. **Do not run it unmodified against ProfiProfit**.

### Safe integration gates

1. Preserve production Dashboard, Students, Calendar, Payments and existing Supabase Auth.
2. Copy the existing React builder source into an isolated build target, rather than copying the public compiled JS.
3. Replace mockRepository with a real production repository using `material_sections`, `teaching_lesson_plans` and `teaching_lesson_versions`, scoped by the existing authenticated user. Never seed sample content into production.
4. Implement and test revision-aware save and publish with matching database functions or equivalent secure repository methods. Enforce teacher ownership and revision conflicts.
5. Mount the built UI only inside the Materials section, reusing the parent session. Do not introduce a second sign-in, replace the main entrypoint, or change the finance tables.
6. Validate build, folder nesting, edit/save/reload, publish/preview, and permissions in a staging deployment before changing production.

This branch is staging only; the Builder is **not** integrated or published by this document.
