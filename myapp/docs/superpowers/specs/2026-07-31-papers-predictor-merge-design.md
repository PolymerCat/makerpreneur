# Papers & Predictor Merge

## Goal
Merge `/study/papers` (exam paper browser) and `/study/predictor` (AI question prediction) into a single unified feature at `/study/papers`. Delete `/study/predictor`.

## Scope
- **Route kept:** `/study/papers`
- **Route deleted:** `/study/predictor`
- **Feature grid:** Update papers entry description, remove predictor entry

## Layout (single scroll)

1. **PageHero** — "Papers & Exam Predictions"
2. **CourseBar** — active course
3. **Source Materials card**
   - Filter tabs: `[Exam Papers]` `[All Materials]`
   - `SourceSelector` with checkboxes, metadata, "View PDF" links
   - Language toggle (en/ms)
   - "Predict Questions" button
4. **Saved Predictions card** (conditional)
   - List of saved predictions with date + question count
   - [Load] and [Delete] per item
   - Active prediction highlighted
5. **Predicted Questions card** (conditional)
   - Probability key: ● High ● Medium ● Low
   - Per question: text, marks badge, probability dot, collapsible answer, "Studied" toggle

## Data Flow
- `db.listAll("materials", { category?: "exam_paper", courseId })` on filter change
- `db.materialText([ids])` → `aiPredictQuestions(text, courseName, language)` → `db.insert("predictions", ...)` → display
- Load saved: `db.getById("predictions", id)` → parse `questionsJson`
- Studied toggle: `db.update("predictions", id, { studiedIds })`

## Changes

### Delete
- `app/study/predictor/page.tsx`
- Feature grid entry for predictor

### Rewrite
- `app/study/papers/page.tsx` — merged page

### Update
- `app/study/page.tsx` — feature grid: papers desc becomes "Browse past exam papers and predict exam questions"
