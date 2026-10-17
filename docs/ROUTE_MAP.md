# Route and navigation map

PATHWISE uses the existing prototype's hash-route convention so browser Back, Forward and refresh retain the active experience.

| Hash route | Screen | Primary next action | Guard or fallback |
| --- | --- | --- | --- |
| #/ | Landing | Start interview or open labelled example | Always available |
| #/interview | AI Interview | Profile or optional activity | Falls back to guided prompt if live AI is unavailable |
| #/activity | Camera activity | Review or skip | Camera permission is optional; denial does not block progress |
| #/profile-review | Profile update | Confirm observations or continue | No camera analysis claim is made |
| #/profile | Personal profile | Confirm and discover | All fields remain editable |
| #/discover | Discover possibilities | Compare pathways | Catalogue records are labelled starter data |
| #/pathways | Pathway comparison | Select a route | Computes Plan A, B and C from the current profile |
| #/recommended | Recommended pathway | What-if or comparison | Falls back to comparison if no selected route exists |
| #/what-if | What-if simulation | Recalculate | A scenario cannot overwrite the profile without Apply scenario |
| #/recalculated | Recalculated pathway | Apply or revise scenario | Displays actual before and after engine output |
| #/action-plan | 30-day action plan | My path | Prompts to select a route if tasks have not been generated |
| #/my-path | Timeline | Continue interview | Explicitly states whether storage is local-only |

The bottom navigation provides Home, Interview, My path and What-if access. What-if starts from the latest confirmed profile; direct navigation never creates an AI request or database record.
