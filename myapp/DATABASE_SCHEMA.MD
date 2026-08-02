## Table `profiles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `full_name` | `text` |  |
| `matric_number` | `text` |  Nullable Unique |
| `preferred_language` | `text` |  |
| `role` | `text` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `subjects`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  |
| `created_at` | `timestamptz` |  Nullable |
| `subject_code` | `text` |  Nullable |
| `description` | `text` |  Nullable |
| `created_by` | `uuid` |  Nullable |

## Table `materials`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `course_id` | `uuid` |  Nullable |
| `title` | `text` |  |
| `file_url` | `text` |  |
| `file_type` | `text` |  |
| `status` | `text` |  |
| `created_at` | `timestamptz` |  Nullable |
| `category` | `text` |  |
| `year` | `int4` |  |
| `semester` | `text` |  |

## Table `chunks`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `material_id` | `uuid` |  Nullable |
| `page` | `int4` |  |
| `chunk_index` | `int4` |  |
| `text` | `text` |  |
| `embedding` | `vector` |  Nullable |

## Table `papers`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `course_id` | `uuid` |  Nullable |
| `year` | `int4` |  |
| `semester` | `text` |  |
| `file_url` | `text` |  |
| `extracted_text` | `text` |  |

## Table `summaries`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `material_id` | `uuid` |  Nullable |
| `mode` | `text` |  |
| `language` | `text` |  |
| `content` | `text` |  |

## Table `decks`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `material_id` | `uuid` |  Nullable |
| `title` | `text` |  |

## Table `cards`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `deck_id` | `uuid` |  Nullable |
| `front` | `text` |  |
| `back` | `text` |  |
| `easiness` | `float4` |  |
| `interval` | `int4` |  |
| `repetitions` | `int4` |  |
| `due_date` | `timestamptz` |  |

## Table `quizzes`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `material_id` | `uuid` |  Nullable |
| `title` | `text` |  |

## Table `questions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `quiz_id` | `uuid` |  Nullable |
| `kind` | `text` |  |
| `prompt` | `text` |  |
| `options` | `jsonb` |  Nullable |
| `answer` | `text` |  |
| `rubric` | `text` |  Nullable |

## Table `attempts`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `quiz_id` | `uuid` |  Nullable |
| `score` | `float4` |  |
| `answers` | `jsonb` |  Nullable |
| `graded_at` | `timestamptz` |  Nullable |

## Table `study_plans`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `course_id` | `uuid` |  Nullable |
| `exam_date` | `text` |  |
| `goals` | `text` |  |

## Table `plan_days`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `plan_id` | `uuid` |  Nullable |
| `day_number` | `int4` |  |
| `date` | `text` |  |
| `topic` | `text` |  |
| `tasks` | `jsonb` |  Nullable |
| `done` | `bool` |  |

## Table `schedule_blocks`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `title` | `text` |  |
| `kind` | `text` |  |
| `starts_at` | `timestamptz` |  |
| `ends_at` | `timestamptz` |  |

## Table `predictions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `course_id` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `freq_json` | `jsonb` |  Nullable |
| `questions_json` | `jsonb` |  Nullable |
| `studied_ids` | `jsonb` |  Nullable |

## Table `search_index`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `material_id` | `uuid` | Primary |
| `index_data` | `jsonb` |  Nullable |

## Table `semcache`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `question` | `text` |  |
| `answer` | `text` |  |
| `embedding` | `vector` |  Nullable |
| `kind` | `text` |  |

## Table `conversations`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `title` | `text` |  |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |
| `summary` | `text` |  |

## Table `messages`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `conversation_id` | `uuid` |  |
| `role` | `text` |  |
| `content` | `text` |  |
| `created_at` | `timestamptz` |  Nullable |

## Table `memories`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `course_id` | `uuid` |  Nullable |
| `conversation_id` | `uuid` |  Nullable |
| `type` | `text` |  |
| `tags` | `_text` |  |
| `content` | `text` |  |
| `importance` | `float4` |  |
| `source` | `text` |  |
| `embedding` | `vector` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `generated_exams`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `course_id` | `uuid` |  Nullable |
| `title` | `text` |  |
| `course_code` | `text` |  |
| `file_url` | `text` |  |
| `questions_json` | `jsonb` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## Table `llm_logs`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `request_id` | `text` |  Nullable |
| `task` | `text` |  Nullable |
| `model` | `text` |  Nullable |
| `prompt_version` | `text` |  Nullable |
| `latency_ms` | `int4` |  Nullable |
| `input_tokens` | `int4` |  Nullable |
| `output_tokens` | `int4` |  Nullable |
| `cost_us` | `numeric` |  Nullable |
| `tool_calls` | `jsonb` |  Nullable |
| `retrieved_chunk_ids` | `_text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## RLS Policies

### `profiles`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Enable users to view their own data only` | SELECT | authenticated | PERMISSIVE | `(( SELECT auth.uid() AS uid) = id)` | — |
| `Enable insert for users based on user id` | INSERT | public | PERMISSIVE | — | `(( SELECT auth.uid() AS uid) = id)` |
| `Enable update for users based on user_id` | UPDATE | public | PERMISSIVE | `(( SELECT auth.uid() AS uid) = id)` | `(( SELECT auth.uid() AS uid) = id)` |

### `plan_days`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `authenticated all` | ALL | authenticated | PERMISSIVE | `true` | `true` |

### `schedule_blocks`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `authenticated all` | ALL | authenticated | PERMISSIVE | `true` | `true` |

### `attempts`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can manage own attempts` | ALL | authenticated | PERMISSIVE | `(EXISTS ( SELECT 1    FROM ((quizzes q      JOIN materials m ON ((q.material_id = m.id)))      JOIN subjects s ON ((m.course_id = s.id)))   WHERE ((q.id = attempts.quiz_id) AND (s.created_by = auth.uid()))))` | `(EXISTS ( SELECT 1    FROM ((quizzes q      JOIN materials m ON ((q.material_id = m.id)))      JOIN subjects s ON ((m.course_id = s.id)))   WHERE ((q.id = attempts.quiz_id) AND (s.created_by = auth.uid()))))` |

### `memories`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `public all` | ALL | public | PERMISSIVE | `true` | `true` |
| `Users can manage own memories` | ALL | authenticated | PERMISSIVE | `(EXISTS ( SELECT 1    FROM subjects s   WHERE ((s.id = memories.course_id) AND (s.created_by = auth.uid()))))` | `(EXISTS ( SELECT 1    FROM subjects s   WHERE ((s.id = memories.course_id) AND (s.created_by = auth.uid()))))` |

### `semcache`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `public all` | ALL | public | PERMISSIVE | `true` | `true` |

### `generated_exams`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `public all generated_exams` | ALL | public | PERMISSIVE | `true` | `true` |
| `Users can manage own generated_exams` | ALL | authenticated | PERMISSIVE | `(EXISTS ( SELECT 1    FROM subjects s   WHERE ((s.id = generated_exams.course_id) AND (s.created_by = auth.uid()))))` | `(EXISTS ( SELECT 1    FROM subjects s   WHERE ((s.id = generated_exams.course_id) AND (s.created_by = auth.uid()))))` |

### `subjects`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can view own subjects` | SELECT | authenticated | PERMISSIVE | `(created_by = auth.uid())` | — |
| `Users can create own subjects` | INSERT | authenticated | PERMISSIVE | — | `(created_by = auth.uid())` |
| `Users can update own subjects` | UPDATE | authenticated | PERMISSIVE | `(created_by = auth.uid())` | — |
| `Users can delete own subjects` | DELETE | authenticated | PERMISSIVE | `(created_by = auth.uid())` | — |

### `materials`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can manage own materials` | ALL | authenticated | PERMISSIVE | `(EXISTS ( SELECT 1    FROM subjects s   WHERE ((s.id = materials.course_id) AND (s.created_by = auth.uid()))))` | `(EXISTS ( SELECT 1    FROM subjects s   WHERE ((s.id = materials.course_id) AND (s.created_by = auth.uid()))))` |

### `papers`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can manage own papers` | ALL | authenticated | PERMISSIVE | `(EXISTS ( SELECT 1    FROM subjects s   WHERE ((s.id = papers.course_id) AND (s.created_by = auth.uid()))))` | `(EXISTS ( SELECT 1    FROM subjects s   WHERE ((s.id = papers.course_id) AND (s.created_by = auth.uid()))))` |

### `study_plans`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can manage own study_plans` | ALL | authenticated | PERMISSIVE | `(EXISTS ( SELECT 1    FROM subjects s   WHERE ((s.id = study_plans.course_id) AND (s.created_by = auth.uid()))))` | `(EXISTS ( SELECT 1    FROM subjects s   WHERE ((s.id = study_plans.course_id) AND (s.created_by = auth.uid()))))` |

### `predictions`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can manage own predictions` | ALL | authenticated | PERMISSIVE | `(EXISTS ( SELECT 1    FROM subjects s   WHERE ((s.id = predictions.course_id) AND (s.created_by = auth.uid()))))` | `(EXISTS ( SELECT 1    FROM subjects s   WHERE ((s.id = predictions.course_id) AND (s.created_by = auth.uid()))))` |

### `chunks`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can manage own chunks` | ALL | authenticated | PERMISSIVE | `(EXISTS ( SELECT 1    FROM (materials m      JOIN subjects s ON ((m.course_id = s.id)))   WHERE ((m.id = chunks.material_id) AND (s.created_by = auth.uid()))))` | `(EXISTS ( SELECT 1    FROM (materials m      JOIN subjects s ON ((m.course_id = s.id)))   WHERE ((m.id = chunks.material_id) AND (s.created_by = auth.uid()))))` |

### `summaries`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can manage own summaries` | ALL | authenticated | PERMISSIVE | `(EXISTS ( SELECT 1    FROM (materials m      JOIN subjects s ON ((m.course_id = s.id)))   WHERE ((m.id = summaries.material_id) AND (s.created_by = auth.uid()))))` | `(EXISTS ( SELECT 1    FROM (materials m      JOIN subjects s ON ((m.course_id = s.id)))   WHERE ((m.id = summaries.material_id) AND (s.created_by = auth.uid()))))` |

### `decks`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can manage own decks` | ALL | authenticated | PERMISSIVE | `(EXISTS ( SELECT 1    FROM (materials m      JOIN subjects s ON ((m.course_id = s.id)))   WHERE ((m.id = decks.material_id) AND (s.created_by = auth.uid()))))` | `(EXISTS ( SELECT 1    FROM (materials m      JOIN subjects s ON ((m.course_id = s.id)))   WHERE ((m.id = decks.material_id) AND (s.created_by = auth.uid()))))` |

### `cards`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can manage own cards` | ALL | authenticated | PERMISSIVE | `(EXISTS ( SELECT 1    FROM ((decks d      JOIN materials m ON ((d.material_id = m.id)))      JOIN subjects s ON ((m.course_id = s.id)))   WHERE ((d.id = cards.deck_id) AND (s.created_by = auth.uid()))))` | `(EXISTS ( SELECT 1    FROM ((decks d      JOIN materials m ON ((d.material_id = m.id)))      JOIN subjects s ON ((m.course_id = s.id)))   WHERE ((d.id = cards.deck_id) AND (s.created_by = auth.uid()))))` |

### `quizzes`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can manage own quizzes` | ALL | authenticated | PERMISSIVE | `(EXISTS ( SELECT 1    FROM (materials m      JOIN subjects s ON ((m.course_id = s.id)))   WHERE ((m.id = quizzes.material_id) AND (s.created_by = auth.uid()))))` | `(EXISTS ( SELECT 1    FROM (materials m      JOIN subjects s ON ((m.course_id = s.id)))   WHERE ((m.id = quizzes.material_id) AND (s.created_by = auth.uid()))))` |

### `questions`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can manage own questions` | ALL | authenticated | PERMISSIVE | `(EXISTS ( SELECT 1    FROM ((quizzes q      JOIN materials m ON ((q.material_id = m.id)))      JOIN subjects s ON ((m.course_id = s.id)))   WHERE ((q.id = questions.quiz_id) AND (s.created_by = auth.uid()))))` | `(EXISTS ( SELECT 1    FROM ((quizzes q      JOIN materials m ON ((q.material_id = m.id)))      JOIN subjects s ON ((m.course_id = s.id)))   WHERE ((q.id = questions.quiz_id) AND (s.created_by = auth.uid()))))` |

### `search_index`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can manage own search_index` | ALL | authenticated | PERMISSIVE | `(EXISTS ( SELECT 1    FROM (materials m      JOIN subjects s ON ((m.course_id = s.id)))   WHERE ((m.id = search_index.material_id) AND (s.created_by = auth.uid()))))` | `(EXISTS ( SELECT 1    FROM (materials m      JOIN subjects s ON ((m.course_id = s.id)))   WHERE ((m.id = search_index.material_id) AND (s.created_by = auth.uid()))))` |

### `conversations`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can manage own conversations` | ALL | authenticated | PERMISSIVE | `(user_id = auth.uid())` | `(user_id = auth.uid())` |

### `messages`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can manage own messages` | ALL | authenticated | PERMISSIVE | `(EXISTS ( SELECT 1    FROM conversations c   WHERE ((c.id = messages.conversation_id) AND (c.user_id = auth.uid()))))` | `(EXISTS ( SELECT 1    FROM conversations c   WHERE ((c.id = messages.conversation_id) AND (c.user_id = auth.uid()))))` |

### `llm_logs`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can insert own llm logs` | INSERT | authenticated | PERMISSIVE | — | `(user_id = auth.uid())` |
| `Users can select own llm logs` | SELECT | authenticated | PERMISSIVE | `(user_id = auth.uid())` | — |

